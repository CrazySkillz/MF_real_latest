import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { describe, expect, it, vi } from 'vitest';

// Characterization evidence, NOT fixed-flow acceptance. Compare actual declarations
// with the original audit revision; no DB, provider, email or application startup.
const baseline = '777aae6f6353e998d60b635d3e66b413093117c2';
// Freeze the reproduced pre-fix state; fixed-flow acceptance lives in google-ads-goal-values.test.ts.
const audited = '9f7a40db5be72b89d256c44d94db730ae279d399';
const files = new Map<string, Map<string, string>>();
function declarations(file: string, revision: string) {
  const key = `${revision}:${file}`;
  if (files.has(key)) return files.get(key)!;
  const raw = execFileSync('git', ['show', `${revision === 'current' ? audited : revision}:${file}`], { encoding: 'utf8', windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  const source = ts.createSourceFile(file, raw, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map<string, string>();
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) found.set(node.name.text, node.getText(source));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !found.has(node.name.text)) found.set(node.name.text, `const ${node.getText(source)};`);
    ts.forEachChild(node, visit);
  }
  visit(source); files.set(key, found); return found;
}
function bind(file: string, name: string, revision: string, env: Record<string, any> = {}) {
  const code = declarations(file, revision).get(name);
  if (!code) throw new Error(`Missing actual declaration ${name}`);
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('exports', ...Object.keys(env), `${js}\nreturn ${name};`)({}, ...Object.values(env));
}
const page = 'client/src/pages/google-ads-analytics.tsx';
const reportFile = 'server/report-scheduler.ts';
function live(revision: string, cpc: number, clicks = 10) {
  return bind(page, 'getLiveMetricValue', revision, { summary: { cpc, clicks }, hasGoogleAdsAttributedRevenue: false })('cpc');
}
function resolver(revision: string) {
  const isCampaignLevel = bind('server/utils/campaign-current-values.ts', 'isCampaignLevel', revision);
  const resolveCampaignCurrentValueForAlert = bind('server/utils/campaign-current-values.ts', 'resolveCampaignCurrentValueForAlert', revision, { isCampaignLevel });
  const isGA4Platform = bind('server/utils/ga4-alert-current-value.ts', 'isGA4Platform', revision);
  return bind('server/utils/ga4-alert-current-value.ts', 'resolveAlertCurrentValueForDecision', revision, { resolveCampaignCurrentValueForAlert, isGA4Platform });
}
function breached(revision: string, row: any) {
  const env: Record<string, any> = {};
  for (const name of ['parseAlertNumber', 'normalizeAlertCondition', 'evaluateAlertCondition', 'evaluateAlertThreshold']) {
    env[name] = bind('server/utils/alert-evaluation.ts', name, revision, env);
  }
  return bind('server/utils/alert-decision.ts', 'isAlertDecisionBreached', revision, env)(row);
}
async function reportText(revision: string, type: string, currentValue: unknown) {
  const text: string[] = [];
  const doc = new Proxy({ internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }, text: (value: unknown) => text.push(String(value)) }, {
    get: (target, key) => key in target ? (target as any)[key] : () => undefined,
  });
  const row = { id: 'test-goal', campaignId: 'test-campaign', platformType: 'google_ads', name: 'Fixture CPC', metric: 'cpc', currentValue, targetValue: '2', benchmarkValue: '2', unit: '', status: 'active' };
  const storage = { getPlatformKPIs: vi.fn(async () => [row]), getCampaignBenchmarks: vi.fn(async () => [row]), getPlatformBenchmarks: vi.fn(async () => [row]) };
  const formatNumberLike = bind(reportFile, 'formatNumberLike', revision);
  const formatWithUnit = bind(reportFile, 'formatWithUnit', revision, { formatNumberLike });
  const build = bind(reportFile, 'buildPdfAttachmentForReport', revision, {
    storage, formatWithUnit, parseReportConfiguration: bind(reportFile, 'parseReportConfiguration', revision),
    require: (name: string) => { if (name !== 'jspdf') throw new Error(`Unexpected import ${name}`); return { jsPDF: function () { return doc; } }; },
    coercePdfBufferFromDoc: () => Buffer.from('synthetic renderer capture'),
  });
  const result = await build({ report: { id: 'test-report', name: 'Fixture', campaignId: 'test-campaign', platformType: 'google_ads', reportType: type, configuration: {} }, windowStart: '2026-10-01', windowEnd: '2026-10-24', campaignName: 'Fixture' });
  expect(result).not.toBeNull();
  if (type === 'kpis') expect(storage.getPlatformKPIs).toHaveBeenCalledWith('google_ads', 'test-campaign');
  else expect(storage.getCampaignBenchmarks).toHaveBeenCalledWith('test-campaign');
  return text;
}

describe.each(['current', baseline])('Google Ads saved-consumer audit reproduction at %s (not acceptance)', revision => {
  it.each([{ saved: '1', current: 10, savedBreach: false, liveBreach: true }, { saved: '137', current: 1, savedBreach: true, liveBreach: false }])('reproduces a stored/live alert disagreement for $saved -> $current', async sample => {
    const row = { id: 'test-goal', campaignId: 'test-campaign', platformType: 'google_ads', metric: 'cpc', currentValue: sample.saved, alertsEnabled: true, alertThreshold: '2', alertCondition: 'above' };
    const resolved = await resolver(revision)(row);
    expect(resolved).toBe(row);
    expect(breached(revision, resolved)).toBe(sample.savedBreach);
    expect(breached(revision, { ...row, currentValue: live(revision, sample.current) })).toBe(sample.liveBreach);
  });
  it('has an agreeing positive control when stored and source-backed values match', async () => {
    const row = { campaignId: 'test-campaign', platformType: 'google_ads', metric: 'cpc', currentValue: '10', alertsEnabled: true, alertThreshold: '2', alertCondition: 'above' };
    expect(breached(revision, await resolver(revision)(row))).toBe(breached(revision, { ...row, currentValue: live(revision, 10) }));
  });
  it('retains explicit manual input through the existing resolver', async () => {
    const row = { campaignId: 'test-campaign', platformType: 'google_ads', metric: 'cpc', currentValue: '137' };
    expect(await resolver(revision)(row)).toBe(row);
  });
  it.each(['kpis', 'benchmarks'])('%s renderer uses the saved 137 even when the page resolves 10', async type => {
    expect(live(revision, 10)).toBe(10);
    expect(await reportText(revision, type, '137')).toContain('137');
  });
  it.each(['kpis', 'benchmarks'])('%s renderer turns a null saved amount into displayed zero', async type => {
    expect(await reportText(revision, type, null)).toContain('0');
  });
});

it('current page correctly keeps unavailable CPC distinct from the stored-zero alert path', async () => {
  expect(live('current', Number.NaN, 0)).toBeNaN();
  const row = { campaignId: 'test-campaign', platformType: 'google_ads', metric: 'cpc', currentValue: '0', alertsEnabled: true, alertThreshold: '2', alertCondition: 'below' };
  expect(breached('current', await resolver('current')(row))).toBe(true);
});
