import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ga4Service, GoogleAnalytics4Service } from './analytics';

const store = vi.hoisted(() => ({ getCampaign: vi.fn(), getGA4Connections: vi.fn(), getGA4DailyMetrics: vi.fn(),
  getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(), getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(), getGA4OverviewSnapshot: vi.fn(), updateGA4ConnectionTokens: vi.fn(),
  upsertFinancialDailySnapshot: vi.fn(), updateKPI: vi.fn(), updateBenchmark: vi.fn() }));
vi.mock('./storage', () => ({ storage: store }));
import { getCampaignMetricTotalsAtDate } from './utils/campaign-current-values';
import { resolveFinancialDailyComparisonPrevious } from './utils/financial-daily-comparison';
import { resolveCompatibleTrendFinancialDaily, formatTrendComparison } from '../client/src/lib/trend-analysis-cumulative';

const day = '2026-10-20', campaignId = 'signed-revenue-fixture';
type Totals = { revenue: number; conversions: number; sessions: number };
const alternate: Totals = { revenue: 100, conversions: 2, sessions: 10 };
function reports(primary: Totals, fallback: Totals = alternate, options: {
  purchaseOnly?: boolean; supplementalCurrency?: string; supplementalQuality?: boolean;
} = {}) {
  const queries: any[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport');
    const query = JSON.parse(init.body); queries.push(query);
    expect(query.dateRanges).toEqual([{ startDate: day, endDate: day }]);
    expect(query.currencyCode).toBe('EUR');
    const scope = query.dimensionFilter.filter.fieldName;
    expect(['sessionCampaignName', 'campaignName', 'pageLocation']).toContain(scope);
    if (scope !== 'pageLocation') expect(query.dimensionFilter.filter.stringFilter).toMatchObject({ matchType: 'EXACT', value: 'sale' });
    if (options.purchaseOnly && query.metrics.some((m: any) => m.name === 'totalRevenue')) {
      return new Response(JSON.stringify({ error: 'totalRevenue metric unavailable' }), { status: 400 });
    }
    const base = scope === 'sessionCampaignName' ? primary : fallback;
    const values: Record<string, number> = { totalRevenue: base.revenue, purchaseRevenue: base.revenue,
      conversions: base.conversions, sessions: base.sessions, totalUsers: base.sessions ? 8 : 0,
      screenPageViews: base.sessions * 2, engagedSessions: base.sessions / 2, engagementRate: base.sessions ? 0.5 : 0 };
    return new Response(JSON.stringify({ rowCount: 1,
      metadata: { currencyCode: scope === 'campaignName' ? options.supplementalCurrency || 'EUR' : 'EUR',
        timeZone: 'Europe/Amsterdam', ...(scope === 'campaignName' && options.supplementalQuality ? { dataLossFromOtherRow: true } : {}) },
      rows: [{ dimensionValues: (query.dimensions || []).map(() => ({ value: '20261020' })),
        metricValues: query.metrics.map((m: any) => ({ value: String(values[m.name]) })) }] }));
  }));
  return queries;
}
const totals = () => ga4Service.getTotalsWithRevenue('123', 'fixture', day, day, ['sale'], 'EUR');

describe('GA4 signed native revenue remains available through fallback selection', () => {
  beforeEach(() => {
    for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
    for (const mock of Object.values(store)) mock.mockReset();
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });

  it.each([
    { revenue: -1, conversions: 0, sessions: 10, expectedConversions: 2 },
    { revenue: -25, conversions: 0, sessions: 10, expectedConversions: 2 },
    { revenue: -100, conversions: 0.75, sessions: 10, expectedConversions: 0.75 },
    { revenue: -25, conversions: 0, sessions: 0, expectedConversions: 0 },
    { revenue: -25, conversions: 0.75, sessions: 10, expectedConversions: 0.75 },
    { revenue: 25, conversions: 0, sessions: 10, expectedConversions: 2 },
    { revenue: 25.75, conversions: 0.125, sessions: 10, expectedConversions: 0.125 },
  ])('preserves primary $revenue revenue with $conversions conversions and $sessions sessions', async value => {
    const queries = reports(value);
    expect((await totals()).totals).toMatchObject({ revenue: value.revenue, conversions: value.expectedConversions, sessions: value.sessions });
    expect(queries.some(query => query.dimensionFilter.filter.fieldName === 'pageLocation')).toBe(false);
    if (!value.sessions) expect(queries).toHaveLength(1);
  });

  it.each([-25, 0, 100])('retains existing zero-only aggregate supplementation for signed amount %s', async revenue => {
    reports({ revenue: 0, conversions: 0, sessions: 10 }, { revenue, conversions: 0, sessions: 10 });
    expect((await totals()).totals).toMatchObject({ revenue, conversions: 0, sessions: 10 });
  });
  it.each([-25, 0, 100])('retains genuine empty primary UTM fallback for signed amount %s', async revenue => {
    reports({ revenue: 0, conversions: 0, sessions: 0 }, { revenue, conversions: 0, sessions: 0 });
    expect((await totals()).totals).toMatchObject({ revenue, conversions: 0, sessions: 0 });
  });
  it('preserves purchaseRevenue compatibility fallback without dropping a refund', async () => {
    reports({ revenue: -25, conversions: 0, sessions: 10 }, alternate, { purchaseOnly: true });
    expect(await totals()).toMatchObject({ revenueMetric: 'purchaseRevenue', currencyCode: 'EUR', totals: { revenue: -25, conversions: 2 } });
  });
  it.each([
    { options: { supplementalCurrency: 'USD' }, code: 'GA4_CURRENCY_UNVERIFIED' },
    { options: { supplementalQuality: true }, code: 'GA4_DATA_QUALITY_UNAVAILABLE' },
  ])('still rejects unsafe supplemental evidence: $code', async ({ options, code }) => {
    reports({ revenue: -25, conversions: 0, sessions: 10 }, alternate, options);
    await expect(totals()).rejects.toMatchObject({ code });
  });
  it('preserves signed daily values and fills only exact matching zero dates', () => {
    const row = (date: string, conversions: number, revenue: number) => ({ dimensionValues: [{ value: date }], metricValues: [{ value: String(conversions) }, { value: String(revenue) }] });
    expect((new GoogleAnalytics4Service() as any).mergeDailyConversionRevenueTotals(
      { rows: [row('20261020', 0, -25), row('20261021', 0, 0)] },
      { rows: [row('20261020', 2, 100), row('20261021', 0.125, -5), row('20261022', 99, 999)] }, 0, 1, 0, 1,
    )).toEqual({ revenue: -30, conversions: 2.125 });
  });
  it('keeps the real historical comparison chain signed without any persistence or token writes', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-22T12:00:00Z'));
    const queries = reports({ revenue: -25, conversions: 0, sessions: 10 });
    store.getCampaign.mockResolvedValue({ id: campaignId, currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', ga4CampaignFilter: 'sale' });
    store.getGA4Connections.mockResolvedValue([{ id: 'connection', campaignId, propertyId: '123', accessToken: 'fixture', method: 'access_token', isActive: true, isPrimary: true, importStartDate: day }]);
    store.getGA4DailyMetrics.mockResolvedValue([{ campaignId, propertyId: '123', date: day, sessions: 10, users: 8, conversions: 0, revenue: '-25', engagementRate: '0.5' }]);
    store.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: '' });
    store.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, sourceIds: ['spend-fixture'], currency: 'EUR' });
    store.getRevenueBreakdownBySource.mockResolvedValue([]); store.getSpendBreakdownBySource.mockResolvedValue([]);
    const native = await getCampaignMetricTotalsAtDate(campaignId, day);
    expect(native).toMatchObject({ ga4Revenue: -25, revenue: -25, spend: 20, ga4FinancialSource: 'provider_to_date' });
    const snapshot = await resolveFinancialDailyComparisonPrevious({ campaignId, reportingDate: day, storedPrevious: null });
    expect(snapshot).toMatchObject({ campaignId, reportingDate: day, snapshotType: 'financial_daily', metrics: { financialDaily: { inputs: {
      revenue: { value: '-25.00', available: true, sources: ['ga4'] }, spend: { value: '20.00', available: true },
    } } } });
    expect(resolveCompatibleTrendFinancialDaily({ snapshot, campaignId, comparisonDate: day, campaignCurrency: 'EUR',
      currentValueWindow: { startDate: day, reportingTimeZone: 'Europe/Amsterdam' } })?.inputs.revenue.value).toBe('-25.00');
    // Existing display policy withholds percentage comparisons against a negative
    // baseline. This fix must not manufacture a positive historical comparison.
    expect(formatTrendComparison({ current: 200, previous: -25, comparisonDate: day, kind: 'count' })).toBeNull();
    expect(store.getGA4DailyMetrics).toHaveBeenCalledWith(campaignId, '123', day, day);
    expect(store.getRevenueTotalForRange).toHaveBeenCalledWith(campaignId, '1900-01-01', day, 'ga4');
    const requestCount = queries.length;
    expect(await resolveFinancialDailyComparisonPrevious({ campaignId, reportingDate: day, storedPrevious: snapshot })).toBe(snapshot);
    expect(queries).toHaveLength(requestCount);
    for (const method of [store.updateGA4ConnectionTokens, store.upsertFinancialDailySnapshot, store.updateKPI, store.updateBenchmark]) expect(method).not.toHaveBeenCalled();
  });
});
