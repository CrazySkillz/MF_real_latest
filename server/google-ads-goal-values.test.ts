import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReportingDateWindow } from './utils/reporting-timezone';
import { blockAlertDecision, isAlertDecisionBreached } from './utils/alert-decision';

// Execute actual declarations and route handlers with isolated storage; no provider, DB or email.
const sources = new Map<string, Map<string, string>>();
function declarations(file: string) {
  if (sources.has(file)) return sources.get(file)!;
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const found = new Map<string, string>();
  function walk(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name) found.set(node.name.text, node.getText(source));
    if (ts.isMethodDeclaration(node) && node.name.getText(source) === 'getGoogleAdsConnection') found.set('getGoogleAdsConnection', node.getText(source).replace(/^async /, 'async function '));
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !found.has(node.name.text)) found.set(node.name.text, `const ${node.getText(source)};`);
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && ts.isStringLiteral(node.arguments[0])) found.set(node.arguments[0].text, `const handler = ${node.arguments.at(-1)!.getText(source)};`);
    ts.forEachChild(node, walk);
  }
  walk(source); sources.set(file, found); return found;
}
function bind(file: string, name: string, env: Record<string, any> = {}) {
  const code = declarations(file).get(name);
  if (!code) throw new Error(`Missing ${name}`);
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function('exports', ...Object.keys(env), `${js}\nreturn ${name.startsWith('/') ? 'handler' : name};`)({}, ...Object.values(env));
}
const page = 'client/src/pages/google-ads-analytics.tsx';
const resolverFile = 'server/utils/ga4-alert-current-value.ts';
const goal = (extra: any = {}) => ({ id: 'goal', campaignId: 'campaign-a', platformType: 'google_ads', metric: 'cpc',
  name: 'CPC', currentValue: '137', targetValue: '2', benchmarkValue: '2', unit: '',
  calculationConfig: { currentValueMode: 'automatic' }, alertsEnabled: true, alertThreshold: '2', alertCondition: 'above', ...extra });
const daily = (extra: any = {}) => ({ campaignId: 'campaign-a', googleCampaignId: 'selected', date: '2026-10-24',
  spend: '100', impressions: 100, clicks: 10, conversions: '0.5', conversionValue: '150', videoViews: 5, searchImpressionShare: '25', ...extra });
function fixture() {
  const campaign: any = { id: 'campaign-a', status: 'active', startDate: '2026-09-01', reportingTimeZone: 'Europe/Amsterdam', currency: 'EUR' };
  const connection: any = { id: 'connection-a', campaignId: 'campaign-a', method: 'oauth', selectedCampaignIds: '["selected"]', lastRefreshAt: '2026-10-25T07:00:00Z' };
  const storage = {
    getCampaign: vi.fn(async () => campaign), getGoogleAdsConnection: vi.fn(async () => connection),
    getGoogleAdsDailyMetrics: vi.fn(async () => [daily(), daily({ googleCampaignId: 'excluded', spend: '99999' })]),
    getRevenueTotalForRange: vi.fn(async () => ({ totalRevenue: 250, currency: 'EUR', sourceIds: ['revenue-a'] })),
  };
  const resolveCampaignCurrentValueForAlert = bind('server/utils/campaign-current-values.ts', 'resolveCampaignCurrentValueForAlert', {
    isCampaignLevel: bind('server/utils/campaign-current-values.ts', 'isCampaignLevel'),
  });
  const resolve = bind(resolverFile, 'resolveAlertCurrentValueForDecision', { storage, getReportingDateWindow,
    resolveCampaignCurrentValueForAlert, blockAlertDecision, isGA4Platform: bind(resolverFile, 'isGA4Platform') });
  return { storage, campaign, connection, resolve };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T12:00:00Z')); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('Google Ads automatic and saved goal values', () => {
  it.each([undefined, {}, { currentValueMode: 'manual' }])('preserves legacy/manual values without source reads: %j', async calculationConfig => {
    const f = fixture(), row = goal({ calculationConfig });
    expect(await f.resolve(row)).toBe(row);
    expect(f.storage.getCampaign).not.toHaveBeenCalled();
    expect(bind(page, 'getGoalCurrentValue')(row)).toBe(137);
  });
  it.each(['linkedin', 'instagram', 'tiktok', 'google_sheets'])('does not change %s goals', async platformType => {
    const f = fixture(), row = goal({ platformType });
    expect(await f.resolve(row)).toBe(row);
    expect(f.storage.getCampaign).not.toHaveBeenCalled();
  });
  it.each([['1', 100, true], ['137', 10, false]])('aligns live page and alert decisions when saved value is %s', async (saved, spend, breached) => {
    const f = fixture(); f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ spend })]);
    const row = goal({ currentValue: saved }), result = await f.resolve(row);
    expect(result.currentValue).toBe(String(Number(spend) / 10));
    expect(bind(page, 'getGoalCurrentValue')(result)).toBe(Number(spend) / 10);
    expect(isAlertDecisionBreached(result)).toBe(breached);
    expect(row.currentValue).toBe(saved);
    expect(f.storage.getGoogleAdsConnection).toHaveBeenCalledWith('campaign-a', { migrateLegacyTokens: false });
    expect(f.storage.getGoogleAdsDailyMetrics).toHaveBeenCalledWith('campaign-a', '2026-09-01', '2026-10-24');
  });
  it.each([['impressions', 100], ['clicks', 10], ['spend', 100], ['conversions', 0.5], ['videoViews', 5], ['conversionValue', 150],
    ['ctr', 10], ['cpc', 10], ['cpm', 1000], ['conversionRate', 5], ['costPerConversion', 200], ['searchImpressionShare', 25],
    ['totalRevenue', 250], ['revenue', 250], ['profit', 150], ['roas', 2.5], ['roi', 150]])('resolves %s without including unselected campaigns', async (metric, expected) => {
    expect(Number((await fixture().resolve(goal({ metric }))).currentValue)).toBe(expected);
  });
  it('matches the page formulas across multiple dates and fractional conversions', async () => {
    const f = fixture(), metrics = [daily(), daily({ date: '2026-10-23', impressions: 200, clicks: 20, spend: '120', conversions: '1.5' })];
    f.storage.getGoogleAdsDailyMetrics.mockResolvedValue(metrics);
    const summary = bind(page, 'summary', { useMemo: (fn: any) => fn(), metrics });
    const live = bind(page, 'getLiveMetricValue', { summary, hasGoogleAdsAttributedRevenue: false });
    for (const metric of ['impressions', 'clicks', 'spend', 'conversions', 'videoViews', 'conversionValue', 'ctr', 'cpc', 'cpm', 'conversionRate', 'costPerConversion']) {
      expect(Number((await f.resolve(goal({ metric }))).currentValue), metric).toBe(live(metric));
    }
    expect((await f.resolve(goal({ metric: 'searchImpressionShare' }))).currentValue).toBeNull();
  });
  it.each(['cpc', 'ctr', 'cpm', 'conversionRate', 'costPerConversion', 'roas', 'roi'])('blocks unavailable %s without a false below-threshold alert', async metric => {
    const f = fixture(); f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ spend: '0', impressions: 0, clicks: 0, conversions: '0' })]);
    const row = await f.resolve(goal({ metric, currentValue: '0', alertCondition: 'below' }));
    expect(row.currentValue).toBeNull(); expect(isAlertDecisionBreached(row)).toBe(false);
    expect(bind(page, 'getGoalCurrentValue')(row)).toBeNaN();
  });
  it('preserves measured zero and intentionally entered manual zero', async () => {
    const f = fixture(); f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ spend: '0' })]);
    expect((await f.resolve(goal())).currentValue).toBe('0');
    const manual = goal({ currentValue: '0', calculationConfig: { currentValueMode: 'manual' }, alertCondition: 'below' });
    expect(await f.resolve(manual)).toBe(manual); expect(isAlertDecisionBreached(manual)).toBe(true);
  });
  it.each(['missing-campaign', 'inactive', 'disconnected', 'other-campaign', 'spend-only', 'unsupported', 'invalid-selection', 'stale', 'unrefreshed', 'future-start', 'no-rows', 'bad-number', 'foreign-row', 'out-of-window', 'read-failure', 'production-test'])('fails closed for %s', async reason => {
    const f = fixture();
    if (reason === 'missing-campaign') f.storage.getCampaign.mockResolvedValue(undefined);
    if (reason === 'inactive') f.campaign.status = 'draft';
    if (reason === 'disconnected') f.storage.getGoogleAdsConnection.mockResolvedValue(undefined);
    if (reason === 'other-campaign') f.connection.campaignId = 'campaign-b';
    if (reason === 'spend-only') f.connection.spendOnly = true;
    if (reason === 'unsupported') f.connection.method = 'api_key';
    if (reason === 'invalid-selection') f.connection.selectedCampaignIds = '{bad';
    if (reason === 'stale') f.connection.lastRefreshAt = '2026-10-24T07:00:00Z';
    if (reason === 'unrefreshed') f.connection.lastRefreshAt = null;
    if (reason === 'future-start') f.campaign.startDate = '2026-10-26';
    if (reason === 'no-rows') f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([]);
    if (reason === 'bad-number') f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ spend: null })]);
    if (reason === 'foreign-row') f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ campaignId: 'campaign-b' })]);
    if (reason === 'out-of-window') f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ date: '2026-10-25' })]);
    if (reason === 'read-failure') f.storage.getGoogleAdsDailyMetrics.mockRejectedValue(new Error('isolated failure'));
    if (reason === 'production-test') { f.connection.method = 'test_mode'; vi.stubEnv('NODE_ENV', 'production'); }
    const result = await f.resolve(goal());
    expect(result.currentValue).toBeNull(); expect(isAlertDecisionBreached(result)).toBe(false);
  });
  it.each([{ totalRevenue: 0, currency: 'EUR', sourceIds: [] }, { totalRevenue: 250, currency: 'USD', sourceIds: ['a'] },
    { totalRevenue: NaN, currency: 'EUR', sourceIds: ['a'] }])('rejects unavailable or incompatible revenue: %j', async revenue => {
    const f = fixture(); f.storage.getRevenueTotalForRange.mockResolvedValue(revenue);
    expect((await f.resolve(goal({ metric: 'totalRevenue' }))).currentValue).toBeNull();
  });
  it('reads only Google Ads revenue in the completed campaign window, including a verified zero', async () => {
    const f = fixture(); f.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: 'EUR', sourceIds: ['a'] });
    expect((await f.resolve(goal({ metric: 'totalRevenue' }))).currentValue).toBe('0');
    expect(f.storage.getRevenueTotalForRange).toHaveBeenCalledWith('campaign-a', '2026-09-01', '2026-10-24', 'google_ads');
  });
  it('shares a request read, but does not reuse rows after a selection change', async () => {
    const f = fixture(), cache = new Map();
    await f.resolve(goal(), cache); await f.resolve(goal({ metric: 'spend' }), cache);
    expect(f.storage.getGoogleAdsDailyMetrics).toHaveBeenCalledTimes(1);
    f.connection.selectedCampaignIds = '["different"]';
    expect((await f.resolve(goal(), cache)).currentValue).toBeNull();
    expect(f.storage.getGoogleAdsDailyMetrics).toHaveBeenCalledTimes(2);
  });
  it('preserves the local test-mode path without permitting it in production', async () => {
    const f = fixture(); f.connection.method = 'test_mode'; f.connection.lastRefreshAt = null;
    expect((await f.resolve(goal())).currentValue).toBe('10');
  });
  it.each(['disconnect', 'selection', 'currency', 'refresh', 'ownership'])('rejects a %s during an automatic read', async change => {
    const f = fixture();
    f.storage.getGoogleAdsDailyMetrics.mockImplementation(async () => {
      if (change === 'disconnect') f.storage.getGoogleAdsConnection.mockResolvedValue(undefined);
      if (change === 'selection') f.connection.selectedCampaignIds = '["excluded"]';
      if (change === 'currency') f.campaign.currency = 'USD';
      if (change === 'refresh') f.connection.lastRefreshAt = '2026-10-25T11:00:00Z';
      if (change === 'ownership') f.campaign.ownerId = 'new-owner';
      return [daily()];
    });
    const result = await f.resolve(goal());
    expect(result.currentValue).toBeNull(); expect(isAlertDecisionBreached(result)).toBe(false);
  });
  it('uses the campaign reporting timezone across UTC midnight', async () => {
    vi.setSystemTime(new Date('2026-10-25T00:30:00Z'));
    const f = fixture(); f.campaign.reportingTimeZone = 'America/Los_Angeles'; f.campaign.startDate = '2026-01-01';
    f.connection.lastRefreshAt = '2026-10-24T14:00:00Z';
    f.storage.getGoogleAdsDailyMetrics.mockResolvedValue([daily({ date: '2026-10-23' })]);
    expect((await f.resolve(goal())).currentValue).toBe('10');
    expect(f.storage.getGoogleAdsDailyMetrics).toHaveBeenCalledWith('campaign-a', '2026-07-26', '2026-10-23');
  });
});

it.each([{}, { migrateLegacyTokens: false }, { refreshScope: null }])('keeps credential migration opt-in behavior backward compatible: %j', async options => {
  const row = { id: 'connection', campaignId: 'campaign-a', accessToken: 'isolated-fixture', encryptedTokens: null };
  const write = vi.fn(async () => {}), encrypt = vi.fn(() => 'isolated-encrypted-fixture');
  const db = { select: () => ({ from: () => ({ where: async () => [row] }) }), update: vi.fn(() => ({ set: () => ({ where: write }) })) };
  const read = bind('server/storage.ts', 'getGoogleAdsConnection', { db, googleAdsConnections: {}, hydrateDecryptedTokens: (value: any) => ({ ...value }),
    buildEncryptedTokens: encrypt, eq: () => true, and: () => true, isNull: () => true, sql: () => true });
  expect(await read('campaign-a', options)).toEqual(row);
  expect(write).toHaveBeenCalledTimes(Object.keys(options).length === 0 ? 1 : 0);
});

describe('Google Ads goal save and API consumers', () => {
  it.each(['KPI', 'Benchmark'])('%s saves explicit mode, preserves manual zero and rejects blanks', kind => {
    const formKey = kind === 'KPI' ? 'kpiForm' : 'benchmarkForm', editKey = kind === 'KPI' ? 'editingKPI' : 'editingBenchmark';
    const mutation = { mutate: vi.fn() }, toast = vi.fn(), form: any = { metric: 'cpc', currentValue: '137', currentValueMode: 'automatic' };
    const save = bind(page, `handleCreate${kind}`, { [formKey]: form, [editKey]: { id: 'goal', calculationConfig: { existing: true } },
      stripNumberFormatting: bind(page, 'stripNumberFormatting'), getLiveMetricValue: () => 10,
      getGoogleAdsMetricDef: () => ({ unit: 'EUR' }), currency: 'EUR', toast,
      updateKpiMutation: mutation, updateBenchmarkMutation: mutation });
    save(); expect(mutation.mutate.mock.calls[0][0].data).toMatchObject({ currentValue: '10', calculationConfig: { currentValueMode: 'automatic', existing: true } });
    form.currentValueMode = 'manual'; form.currentValue = '0'; save();
    expect(mutation.mutate.mock.calls[1][0].data.currentValue).toBe('0');
    form.currentValue = ''; save(); expect(mutation.mutate).toHaveBeenCalledTimes(2); expect(toast).toHaveBeenCalled();
  });
  it.each(['kpis', 'benchmarks'])('%s GET checks access and resolves only its scoped rows', async type => {
    const f = fixture(), getter = vi.fn(async () => [goal()]), access = vi.fn(async () => f.campaign);
    const route = bind('server/routes-oauth.ts', `/api/platforms/:platformType/${type}`, {
      ensureCampaignAccess: access, isCampaignKPIPlatformType: () => false, isCampaignBenchmarkPlatformType: () => false,
      refreshInstagramBenchmarksIfNeeded: async () => {}, storage: { getPlatformKPIs: getter, getPlatformBenchmarks: getter },
      resolveAlertCurrentValueForDecision: f.resolve,
    });
    const res: any = { json: vi.fn(), status: vi.fn(() => res) }, req = { params: { platformType: 'google_ads' }, query: { campaignId: 'campaign-a' } };
    await route(req, res); expect(res.json.mock.calls[0][0][0].currentValue).toBe('10');
    expect(getter).toHaveBeenCalledWith('google_ads', 'campaign-a');
    access.mockResolvedValue(null); getter.mockClear(); await route(req, res); expect(getter).not.toHaveBeenCalled();
  });
});

describe('Google Ads report values', () => {
  it.each(['kpis', 'benchmarks'])('%s report agrees with page/alerts and keeps saved/unavailable values distinct', async type => {
    const f = fixture(), text: string[] = [];
    const doc = new Proxy({ internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } }, text: (value: unknown) => text.push(String(value)) }, {
      get: (target, key) => key in target ? (target as any)[key] : () => undefined,
    });
    const rows = [goal(), goal({ calculationConfig: { currentValueMode: 'manual' } }), goal({ calculationConfig: null, currentValue: null })];
    const getter = vi.fn(async () => rows), wrongPlatformGetter = vi.fn(() => { throw new Error('cross-platform read'); });
    const file = 'server/report-scheduler.ts';
    const build = bind(file, 'buildPdfAttachmentForReport', {
      storage: { getPlatformKPIs: getter, getPlatformBenchmarks: getter, getCampaignBenchmarks: wrongPlatformGetter },
      resolveAlertCurrentValueForDecision: f.resolve,
      formatWithUnit: bind(file, 'formatWithUnit', { formatNumberLike: bind(file, 'formatNumberLike') }),
      parseReportConfiguration: bind(file, 'parseReportConfiguration'),
      require: (name: string) => { if (name !== 'jspdf') throw new Error(name); return { jsPDF: function () { return doc; } }; },
      coercePdfBufferFromDoc: () => Buffer.from('isolated renderer capture'),
    });
    const result = await build({ report: { id: 'report', name: 'Fixture', campaignId: 'campaign-a', platformType: 'google_ads', reportType: type, configuration: {} },
      windowStart: '2026-10-01', windowEnd: '2026-10-24', campaignName: 'Fixture' });
    expect(result).not.toBeNull(); expect(text).toEqual(expect.arrayContaining(['10', '137', 'Unavailable']));
    expect(getter).toHaveBeenCalledWith('google_ads', 'campaign-a'); expect(wrongPlatformGetter).not.toHaveBeenCalled();
  });
});
