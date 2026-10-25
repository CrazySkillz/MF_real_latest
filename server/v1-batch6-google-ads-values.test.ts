import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getReportingDateWindow } from './utils/reporting-timezone';

// Execute the actual page calculations and handlers; no DB, credentials or provider I/O.
function parse(file: string) {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map<string, string>(), routes = new Map<string, string>();
  function walk(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !declarations.has(node.name.text)) declarations.set(node.name.text, `const ${node.getText(source)};`);
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(source));
    if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && ts.isStringLiteral(node.arguments[0])) routes.set(node.arguments[0].text, node.arguments.at(-1)!.getText(source));
    ts.forEachChild(node, walk);
  }
  walk(source);
  return { declarations, routes };
}
const page = parse('client/src/pages/google-ads-analytics.tsx'), api = parse('server/routes-oauth.ts');
function bind(code: string, name: string, env: Record<string, any> = {}) {
  const js = ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  return new Function(...Object.keys(env), `${js}\nreturn ${name};`)(...Object.values(env));
}
function value(name: string, env: Record<string, any> = {}) { return bind(page.declarations.get(name)!, name, { useMemo: (fn: any) => fn(), ...env }); }
const parent = { id: 'campaign-a', ownerId: 'owner-a', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: '2026-01-01' };
function context(overrides: Record<string, any> = {}, campaign: any = parent) {
  const storage = { getRevenueSources: vi.fn(async () => [{ id: 'source-a', currency: 'EUR', isActive: true, mappingConfig: '{"lastTotalRevenue":9999}' }]),
    getRevenueBreakdownBySource: vi.fn(async () => []), getRevenueTotalForRange: vi.fn(async () => ({ totalRevenue: 250, currency: 'EUR', sourceIds: ['source-a'] })),
    getGoogleAdsConnection: vi.fn(async () => ({ customerId: 'customer-a', method: 'oauth', selectedCampaignIds: '["selected"]' })),
    getGoogleAdsDailyMetrics: vi.fn(async () => []), ...overrides };
  const env: Record<string, any> = { storage, getReportingDateWindow, console: { error() {} },
    ensureCampaignAccess: vi.fn(async (_req, res) => { if (!campaign) res.status(404).json({ error: 'Not found' }); return campaign; }),
    parseRevenueReadPlatformContext: (context: string) => context, getShopifyRevenueSourceFreshness: () => null,
    getActiveGoogleAdsCampaignIdSet: async () => new Set(['selected']), sql: (parts: any, ...values: any[]) => ({ parts, values }),
    db: { execute: vi.fn(async () => ({ rows: [] })) } };
  env.normalizeDate = bind(api.declarations.get('normalizeDate')!, 'normalizeDate', env);
  env.getDateRangeBounds = bind(api.declarations.get('getDateRangeBounds')!, 'getDateRangeBounds', env);
  return { env, storage };
}
async function invoke(path: string, f: ReturnType<typeof context>, query: Record<string, any> = {}) {
  const handler = bind(`const handler = ${api.routes.get(path)};`, 'handler', f.env);
  const res: any = { statusCode: 200, setHeader() {}, status(code: number) { this.statusCode = code; return this; }, json(body: any) { this.body = body; return this; } };
  await handler({ params: { id: parent.id, campaignId: parent.id }, query, headers: {} }, res);
  return res;
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-25T10:00:00Z')); });
afterEach(() => vi.useRealTimers());

describe('Google Ads money uses one completed calendar window', () => {
  it.each([['2026-01-01', '2026-07-27'], ['2026-10-01', '2026-10-01']])('bounds all three reads for campaign starting %s', async (startDate, expectedStart) => {
    const f = context({}, { ...parent, startDate });
    const totals = await invoke('/api/campaigns/:id/revenue-totals', f, { platformContext: 'google_ads', dateRange: '90days' });
    const daily = await invoke('/api/google-ads/:campaignId/daily-metrics', f, { dateRange: '90days' });
    const breakdown = await invoke('/api/campaigns/:id/google-ads-campaign-revenue', f, { dateRange: '90days' });
    for (const response of [totals, daily, breakdown]) {
      expect(response.statusCode).toBe(200);
      expect(response.body.startDate).toBe(expectedStart);
      expect(response.body.endDate).toBe('2026-10-24');
    }
  });
  it('does not change the existing GA4 revenue-totals window', async () => {
    const f = context();
    const res = await invoke('/api/campaigns/:id/revenue-totals', f, { platformContext: 'ga4', dateRange: '90days' });
    expect(res.body.startDate).toBe('2026-07-28'); expect(res.body.endDate).toBe('2026-10-25');
  });
  it('does not change an explicitly dated Spend preview', async () => {
    const f = context({ getGA4GoogleAdsSpendConnection: async () => ({ method: 'oauth', spendOnly: true }), getGA4GoogleAdsSpendDailyMetrics: async () => [] });
    const res = await invoke('/api/google-ads/:campaignId/daily-metrics', f, { spendPreview: '1', startDate: '2026-09-01', endDate: '2026-09-30' });
    expect(res.body.startDate).toBe('2026-09-01'); expect(res.body.endDate).toBe('2026-09-30');
  });
  it('never substitutes all-time source totals for the bounded 250 EUR', () => {
    expect(value('googleAdsAttributedRevenue', { googleAdsAttributedRevenueFromSources: 9999, googleAdsRevenueTotalsData: { success: true, totalRevenue: 250, currency: 'EUR' }, currency: 'EUR' })).toBe(250);
  });
  it.each([0, -25])('preserves measured revenue %s', amount => {
    expect(value('googleAdsAttributedRevenue', { googleAdsAttributedRevenueFromSources: 9999, googleAdsRevenueTotalsData: { success: true, totalRevenue: amount, currency: 'EUR' }, currency: 'EUR' })).toBe(amount);
  });
  it.each([{ success: false, totalRevenue: 0 }, { success: true, totalRevenue: 100, currency: 'USD' }, { success: true, totalRevenue: 100 }, { success: true, totalRevenue: null, currency: 'EUR' }])('keeps failed/mismatched/missing revenue unavailable: %j', data => {
    expect(Number.isFinite(value('googleAdsAttributedRevenue', { googleAdsAttributedRevenueFromSources: 9999, googleAdsRevenueTotalsData: data, currency: 'EUR' }))).toBe(false);
  });
  it('exposes the campaign currency on the connection response', async () => {
    expect((await invoke('/api/google-ads/:campaignId/connection', context())).body.currency).toBe('EUR');
  });
  it('does not resurrect undated mapping-config amounts in a dated campaign breakdown', async () => {
    const f = context({ getRevenueSources: async () => [{ id: 'source-a', currency: 'EUR', mappingConfig: JSON.stringify({ campaignMappings: [{ crmValue: 'old-sale', googleAdsCampaignId: 'selected', revenue: 900 }] }) }] });
    expect((await invoke('/api/campaigns/:id/google-ads-campaign-revenue', f)).body.breakdown).toEqual([]);
  });
  it('keeps measured zero and negative exact campaign records', async () => {
    const f = context();
    f.env.db.execute.mockResolvedValue({ rows: [{ campaign_id: 'selected', source_id: 'source-a', revenue: '0', currency: 'EUR', source_currency: 'EUR' }, { campaign_id: 'selected', source_id: 'source-a', revenue: '-25', currency: 'EUR', source_currency: 'EUR' }] });
    expect((await invoke('/api/campaigns/:id/google-ads-campaign-revenue', f)).body.breakdown[0]?.revenue).toBe(-25);
  });
  it('refuses a different currency in an exact campaign record', async () => {
    const f = context();
    f.env.db.execute.mockResolvedValue({ rows: [{ campaign_id: 'selected', source_id: 'source-a', revenue: '10', currency: 'USD' }] });
    expect((await invoke('/api/campaigns/:id/google-ads-campaign-revenue', f)).statusCode).toBe(500);
  });
  it('fails the source list explicitly on a currency/read error instead of showing cached 9999', async () => {
    const f = context({ getRevenueBreakdownBySource: async () => { throw new Error('Mixed currencies'); } });
    const res = await invoke('/api/campaigns/:id/revenue-sources', f, { platformContext: 'google_ads' });
    expect(res.statusCode).toBe(500); expect(res.body.sources).toBeUndefined();
  });
  it('does not turn an empty successful source read into a cached nonzero amount', async () => {
    const res = await invoke('/api/campaigns/:id/revenue-sources', context(), { platformContext: 'google_ads' });
    expect(res.body.sources[0].lastTotalRevenue).toBe(0);
  });
  it('does not access revenue totals for a missing/inaccessible campaign', async () => {
    const f = context({}, null);
    expect((await invoke('/api/campaigns/:id/revenue-totals', f, { platformContext: 'google_ads' })).statusCode).toBe(404);
    expect(f.storage.getRevenueTotalForRange).not.toHaveBeenCalled();
  });
});

describe('Google Ads daily ratios and calendar coverage', () => {
  const row = (date: string) => ({ date, impressions: 1000, clicks: 10, conversions: 2, spend: 50, conversionValue: 100, videoViews: 0 });
  const env = (dates: string[]) => ({ metricsData: { endDate: '2026-10-24' }, dailySeries: value('dailySeries', { chartData: dates.map(row) }) });
  it('weights CTR by impression counts rather than averaging row percentages', () => {
    const chart = value('chartData', { metrics: [{ ...row('2026-10-24'), clicks: 10, impressions: 100, ctr: '10' }, { ...row('2026-10-24'), clicks: 0, impressions: 900, ctr: '0' }] });
    expect(chart[0].ctr).toBe(1);
  });
  it('never calls seven sparse observations a seven-day rolling window', () => {
    const dates = Array.from({ length: 14 }, (_, i) => new Date(Date.UTC(2026, 8, 28 + i * 2)).toISOString().slice(0, 10));
    const f = env(dates);
    expect(f.dailySeries.rolling7).toHaveLength(0);
    expect(value('insightsRollups', f).availableDays).toBeLessThan(14);
  });
  it('retains a complete pair of seven-day calendar windows', () => {
    const f = env(Array.from({ length: 14 }, (_, i) => `2026-10-${11 + i}`));
    const rollups = value('insightsRollups', f);
    expect(rollups.availableDays).toBe(14); expect(rollups.last7.startDate).toBe('2026-10-18'); expect(rollups.prior7.endDate).toBe('2026-10-17');
    expect(f.dailySeries.rolling7).toHaveLength(8);
  });
  it('does not compare stale last-observed periods as current weeks', () => {
    const f = env(Array.from({ length: 14 }, (_, i) => `2026-09-${11 + i}`));
    expect(value('insightsRollups', f).availableDays).toBe(0);
  });
  it('requires all sixty dates for month-over-month eligibility, across month boundaries', () => {
    const dates = Array.from({ length: 60 }, (_, i) => new Date(Date.UTC(2026, 7, 26 + i)).toISOString().slice(0, 10));
    const rollups = value('insightsRollups', env(dates));
    expect(rollups.availableDays).toBe(60); expect(rollups.last30.days).toBe(30); expect(rollups.prior30.days).toBe(30);
    expect(value('insightsRollups', env(dates.filter(date => date !== '2026-10-01'))).availableDays).toBe(23);
  });
});

describe('Google Ads unavailable inputs and currency propagate into goals', () => {
  const summary = { impressions: 100, clicks: 0, conversions: 0, spend: 100, cpc: 0, cpm: 1000, costPerConv: 0, ctr: 0, convRate: 0 };
  function goalEnv(overrides: Record<string, any> = {}) {
    const env: Record<string, any> = { summary, hasGoogleAdsAttributedRevenue: false, googleAdsAttributedRevenue: Number.NaN,
      googleAdsAttributedProfit: Number.NaN, googleAdsAttributedRoas: Number.NaN, googleAdsAttributedRoi: Number.NaN, ...overrides };
    env.getLiveMetricValue = value('getLiveMetricValue', env);
    env.computeProgress = value('computeProgress', { LOWER_IS_BETTER_METRICS: value('LOWER_IS_BETTER_METRICS') });
    return env;
  }
  it.each(['cpc', 'costPerConversion', 'conversionRate', 'totalRevenue', 'profit', 'roas', 'roi', 'unknownMetric'])('never scores an unavailable %s as zero, on track or behind', metric => {
    const env = goalEnv(), current = env.getLiveMetricValue(metric);
    expect(Number.isFinite(current)).toBe(false);
    expect(env.computeProgress(current, 2, metric)).toEqual({ pct: 0, status: 'unknown' });
  });
  it.each([['cpc', 1, 2, 200], ['clicks', 100, 100, 100], ['totalRevenue', 0, 250, 0]])('preserves finite %s scoring', (metric, current, target, pct) => {
    expect(goalEnv().computeProgress(current, target, metric).pct).toBe(pct);
  });
  it.each([[0, 2], [1, 0], [1, -1], [Infinity, 2], [1, Infinity]])('keeps invalid cost progress finite and unknown (%s/%s)', (current, target) => {
    expect(goalEnv().computeProgress(current, target, 'cpc')).toEqual({ pct: 0, status: 'unknown' });
  });
  for (const [tracker, itemsKey] of [['kpiTracker', 'kpisData'], ['benchmarkTracker', 'benchmarksData']]) {
    it(`${tracker} counts unknown separately and excludes it from the average`, () => {
      const env = goalEnv();
      const result = value(tracker, { ...env, [itemsKey]: [{ metric: 'cpc', targetValue: 2 }, { metric: 'impressions', targetValue: 100 }] });
      expect(result).toMatchObject({ total: 2, unavailable: 1, onTrack: 1, behind: 0, avgPct: 100 });
    });
  }
  it.each(['EUR', 'GBP', 'JPY'])('formats monetary metrics in %s', currency => {
    const defs = value('GOOGLE_ADS_METRICS', { formatPct: (n: number) => `${n}%` });
    const getDef = bind(page.declarations.get('getGoogleAdsMetricDef')!, 'getGoogleAdsMetricDef', { GOOGLE_ADS_METRICS: defs });
    for (const metric of ['spend', 'cpc', 'cpm', 'costPerConversion', 'totalRevenue', 'profit']) {
      expect(getDef(metric, currency).format(250)).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(250));
      expect(getDef(metric, currency).format(Number.NaN)).toBe('Unavailable');
    }
  });
  it.each(['Kpi', 'Benchmark'])('%s modal never prefills an unavailable live value with zero', kind => {
    const modal = parse(`client/src/pages/google-ads-analytics/GoogleAds${kind}Modal.tsx`);
    const name = kind === 'Kpi' ? 'getMetricValue' : 'autoPopulateCurrentValue';
    const props = { getLiveMetricValue: () => Number.NaN, currency: 'EUR' };
    const fn = bind(modal.declarations.get(name)!, name, { props, summary: { totalRevenue: Number.NaN } });
    expect(fn('totalRevenue')).toEqual(kind === 'Kpi' ? { value: '', unit: 'EUR' } : { currentValue: '', unit: 'EUR' });
    props.getLiveMetricValue = () => 0;
    expect(fn('totalRevenue')).toEqual(kind === 'Kpi' ? { value: '0', unit: 'EUR' } : { currentValue: '0', unit: 'EUR' });
  });
  it.each(['KPI', 'Benchmark'])('%s save refuses unavailable automatic values and accepts explicit zero', kind => {
    const lower = kind === 'KPI' ? 'kpi' : 'benchmark';
    const mutate = vi.fn(), toast = vi.fn();
    const form = { metric: 'totalRevenue', currentValue: '', name: 'Revenue', targetValue: '100', benchmarkValue: '100', unit: 'EUR' };
    const env = { ...goalEnv(), [`${lower}Form`]: form, [`editing${kind}`]: null, [`create${kind === 'KPI' ? 'Kpi' : kind}Mutation`]: { mutate }, toast, currency: 'EUR',
      stripNumberFormatting: value('stripNumberFormatting') };
    const save = value(`handleCreate${kind}`, env);
    save(); expect(mutate).not.toHaveBeenCalled(); expect(toast).toHaveBeenCalledOnce();
    form.currentValue = '0'; save(); expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ currentValue: '0' }));
  });
});
