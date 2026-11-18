import { afterEach, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import evidence from './fixtures/ga4-native-values-real-2026-11-15.json';
import { buildGA4InsightsRollups, normalizeGA4InsightsDailyRows } from '../shared/ga4-insights';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('retains recorded GA4 fractions through the actual attribution fallbacks and rolling totals', async () => {
  vi.stubGlobal('fetch', vi.fn(async (_url, options: any) => {
    const request = JSON.parse(options.body);
    const recorded = evidence.requests.find(row => JSON.stringify(row.request) === JSON.stringify(request));
    if (!recorded) throw new Error('Unrecorded GA4 request: ' + JSON.stringify(request));
    return new Response(JSON.stringify(recorded.response), { status: recorded.status });
  }));
  const { propertyId, startDate, endDate, campaigns } = evidence.scope;
  const rows = await ga4Service.getTimeSeriesWithToken(propertyId, 'recorded-only', startDate, campaigns, endDate, 'EUR', { campaignId: 'recorded' });
  expect(rows.find(row => row.date === '2026-09-17')?.revenue).toBe(2374.661207);
  expect(rows.find(row => row.date === '2026-09-18')?.revenue).toBe(1875.742727);
  const byDate = new Map(rows.map(row => [row.date, row]));
  const complete = normalizeGA4InsightsDailyRows(evidence.daily.map(row => ({ ...row, revenue: byDate.get(row.date)?.revenue ?? 0 })));
  const totals = buildGA4InsightsRollups(complete, '2026-09-30');
  expect(totals.prior7.revenue.toFixed(2)).toBe('12212.48');
  expect(totals.last7.revenue.toFixed(2)).toBe('8569.66');
  expect(((totals.last7.revenue / totals.prior7.revenue - 1) * 100).toFixed(1)).toBe('-29.8');
  expect(rows.reduce((sum, row) => sum + row.revenue, 0).toFixed(2)).toBe('114314.62');
  for (const row of rows) {
    const previous = evidence.daily.find(item => item.date === row.date)!;
    for (const key of ['sessions', 'conversions', 'pageviews']) expect(row[key]).toBe((previous as any)[key]);
  }
});

it.each(['primary', 'purchase', 'supplemental'])('preserves sub-cent and negative Revenue on the %s daily path', async path => {
  const values = ['0.004999', '-1.005001', '2.000002'];
  vi.stubGlobal('fetch', vi.fn(async (_url, options: any) => {
    const request = JSON.parse(options.body), metrics = request.metrics.map((m: any) => m.name);
    if (path === 'purchase' && metrics.includes('totalRevenue')) return new Response('Unknown metric totalRevenue', { status: 400 });
    const supplemental = metrics.length === 2;
    const rows = values.map((revenue, i) => ({ dimensionValues: [{ value: `2026100${i + 1}` }],
      metricValues: metrics.map((metric: string) => ({ value: metric.includes('Revenue')
        ? path === 'supplemental' && !supplemental ? '0' : revenue
        : metric === 'engagementRate' || metric === 'sessionKeyEventRate' ? '0.5'
        : metric === 'conversions' ? path === 'supplemental' && !supplemental ? '0' : '1.5'
        : metric === 'engagedSessions' ? '5' : '10' })) }));
    return new Response(JSON.stringify({ rows, rowCount: rows.length, metadata: { currencyCode: 'EUR', timeZone: 'Europe/Amsterdam' } }));
  }));
  const rows = await ga4Service.getTimeSeriesWithToken('123', 'fixture-only', '2026-10-01', path === 'supplemental' ? ['promo'] : undefined, '2026-10-03', 'EUR');
  expect(rows.map(row => row.revenue)).toEqual(values.map(Number));
  expect(rows.map(row => row.conversions)).toEqual([1.5, 1.5, 1.5]);
  expect(rows.map(row => row.revenueMetric)).toEqual(Array(3).fill(path === 'purchase' ? 'purchaseRevenue' : 'totalRevenue'));
});
