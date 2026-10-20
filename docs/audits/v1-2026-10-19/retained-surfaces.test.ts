import fs from 'node:fs';
import ts from 'typescript';
import { z } from 'zod';
import { afterAll, expect, it } from 'vitest';
import { insertKPIProgressSchema } from '../../../shared/schema';

const dir = 'docs/audits/v1-2026-10-19/';
const results: any[] = [];
function source(file: string) { return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true); }
function compile(expression: string, env: Record<string, any> = {}) {
  return new Function(...Object.keys(env), ts.transpileModule(`return (${expression});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
}
function declaration(sf: ts.SourceFile, name: string) {
  let node: any;
  function walk(n: ts.Node) {
    if ((ts.isVariableDeclaration(n) || ts.isFunctionDeclaration(n)) && n.name?.getText(sf) === name && !node) node = n;
    ts.forEachChild(n, walk);
  }
  walk(sf);
  if (!node) throw new Error(`Missing ${name}`);
  return ts.isFunctionDeclaration(node) ? node.getText(sf) : node.initializer.getText(sf);
}
const kpis = source('client/src/pages/kpis.tsx');
const comparison = source('client/src/pages/platform-comparison.tsx');
const routes = source('server/routes-oauth.ts');
function route(method: string, path: string, env: Record<string, any>) {
  let callback: ts.Node | undefined;
  function walk(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(routes) === `app.${method}` && (n.arguments[0] as any)?.text === path) callback = n.arguments.at(-1);
    ts.forEachChild(n, walk);
  }
  walk(routes);
  if (!callback) throw new Error('Missing route');
  return compile(callback.getText(routes), env);
}
const response = () => ({ statusCode: 200, body: null as any, status(n: number) { this.statusCode = n; return this; }, json(x: any) { this.body = x; return this; } });
function platforms(overrides: any) {
  return compile(declaration(comparison, 'buildPlatformMetrics'), {
    outcomeTotals: null, outcomeTotalsFetched: true, ga4Data: null, linkedInData: null,
    customIntegrationData: null, metaAnalytics: null, ...overrides,
  })();
}

it('the current campaign progress form rejects the visible payload because kpiId is absent', () => {
  const schema = compile(declaration(kpis, 'progressFormSchema'), { insertKPIProgressSchema, z });
  const result = schema.safeParse({ value: 10, notes: 'Fixture' });
  expect(result.success).toBe(false);
  expect(result.error.issues.map((x: any) => x.path.join('.'))).toContain('kpiId');
  expect(schema.safeParse({ kpiId: 'fixture-kpi', value: 10, notes: 'Fixture' }).success).toBe(true);
  results.push({ case: 'Campaign progress form requires kpiId which its defaults, fields and selection handler never populate', finding: 'V1-129', positiveControl: 'Same values with kpiId parse' });
});
it('the retained campaign score labels higher costs achieved and lower costs incomplete', () => {
  const progress = compile(declaration(kpis, 'calculateProgress'));
  expect(progress(50, 25)).toBe(100);
  expect(progress(10, 25)).toBe(40);
  expect(progress(0, 0)).toBe(0);
  expect(Number.isNaN(progress('not-numeric', '25'))).toBe(true);
  results.push({ case: 'CPA preset target25/current50 yields100%; current10 yields40%; malformed values becomeNaN', finding: 'V1-130' });
});
it('the retained campaign form refuses a legitimate negative ROI progress value', () => {
  const schema = compile(declaration(kpis, 'progressFormSchema'), { insertKPIProgressSchema, z });
  expect(schema.safeParse({ kpiId: 'fixture', value: -10 }).success).toBe(false);
  results.push({ case: 'Negative ROI progress is rejected by the unconditional nonnegative form rule', finding: 'V1-130' });
});
it('the platform page current list request lacks required campaign context', async () => {
  const res = response();
  await route('get', '/api/platforms/:platformType/kpis', {
    isCampaignKPIPlatformType: compile(declaration(routes, 'isCampaignKPIPlatformType')),
    ensureCampaignAccess: () => { throw new Error('Unexpected access or storage operation'); },
  })({ params: { platformType: 'google_analytics' }, query: {} }, res);
  expect(res.statusCode).toBe(200); expect(res.body).toEqual([]);
  results.push({ case: 'Exact platform GET without campaignId returns empty before access/storage', finding: 'V1-129' });
});
it('the platform page current create payload fails before persistence', async () => {
  const res = response();
  await route('post', '/api/platforms/:platformType/kpis', {
    isCampaignKPIPlatformType: compile(declaration(routes, 'isCampaignKPIPlatformType')),
    ensureCampaignAccess: () => { throw new Error('Unexpected access or storage operation'); },
    z,
  })({ params: { platformType: 'google_analytics' }, body: { name: 'Sessions', unit: 'count', targetValue: '10', priority: 'medium' } }, res);
  expect(res.statusCode).toBe(400); expect(res.body.message).toBe('campaignId is required');
  results.push({ case: 'Exact platform POST rejects the visible page payload without campaignId', finding: 'V1-129' });
});
it('failed aggregate data permits invented Custom Integration revenue', () => {
  const rows = platforms({ customIntegrationData: { metrics: { spend: '100', conversions: 5, revenue: 0, sessions: 50, pageviews: 100 } } });
  expect(rows[0].revenue).toBe(250); expect(rows[0].roi).toBe(150);
  results.push({ case: 'Aggregate unavailable: Custom measured revenue0 replaced with5conversions times assumedAOV50 =>250', finding: 'V1-062' });
});
it('aggregate unavailable can hide a separately loaded GA4 source', () => {
  expect(platforms({ ga4Data: { sessions: 50, conversions: 5, revenue: 100 } })).toEqual([]);
  results.push({ case: 'Separate GA4 metrics data alone does not create a platform row after aggregate failure', finding: 'V1-062' });
});
it('canonical measured zero revenue is mis-scored as break-even in comparison cards', () => {
  const rows = platforms({ outcomeTotals: { performanceSummary: { sources: [{ id: 'custom', label: 'Fixture', connected: true, category: 'paid_media',
    includedMetrics: ['spend', 'revenue', 'conversions'], metrics: { spend: 100, revenue: 0, conversions: 2 } }] } } });
  expect(rows[0].roi).toBe(0); expect((rows[0].revenue - rows[0].spend) / rows[0].spend * 100).toBe(-100);
  results.push({ case: 'Canonical row revenue0/spend100 gets ROI0 while table total formula gives-100', finding: 'V1-062' });
});
it('canonical comparison ignores source availability when capability names remain', () => {
  const rows = platforms({ outcomeTotals: { performanceSummary: { sources: [{ id: 'custom', label: 'Fixture', connected: true,
    available: false, includedMetrics: ['spend', 'revenue'], metrics: { spend: 100, revenue: 300 } }] } } });
  expect(rows[0].roi).toBe(200);
  results.push({ case: 'Connected unavailable source carrying stale metrics and included names still scores200%ROI', finding: 'V1-062', boundary: 'Consumer input contract fixture, not evidence that every current producer emits this shape' });
});
it('positive canonical comparison control preserves exact measured ROI', () => {
  const rows = platforms({ outcomeTotals: { performanceSummary: { sources: [{ id: 'custom', connected: true,
    includedMetrics: ['spend', 'revenue'], metrics: { spend: 100, revenue: 300 } }] } } });
  expect(rows[0].roi).toBe(200); expect(rows[0].roas).toBe(3);
  results.push({ case: 'Measured revenue300/spend100 positive control givesROI200 andROAS3' });
});
it('audience totals and averages come only from fixed page data', () => {
  const sf = source('client/src/pages/audiences.tsx');
  const rows = compile(declaration(sf, 'audienceSegments'));
  expect(rows.length).toBe(4); expect(rows.reduce((s: number, r: any) => s + r.size, 0)).toBe(65390);
  expect((rows.reduce((s: number, r: any) => s + r.conversion_rate, 0) / rows.length).toFixed(1)).toBe('7.4');
  expect(sf.text).not.toMatch(/useQuery|apiRequest|fetch\(/);
  results.push({ case: 'All customers see fixed4segments/65,390reach/7.4%unweightedCVR with no data query', finding: 'V1-061' });
});
afterAll(() => fs.writeFileSync(dir + 'retained-surface-reproductions.json', JSON.stringify({ at: new Date().toISOString(),
  boundary: 'Exact current schema/helpers/routes with synthetic inputs. No database, browser session, provider, email or production request.', results }, null, 2) + '\n'));
