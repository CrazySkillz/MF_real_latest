import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';

const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const flags = [
  ['sampling', { samplingMetadatas: [{ samplesReadCount: '10', samplingSpaceSize: '100' }] }],
  ['other_row', { dataLossFromOtherRow: true }],
  ['thresholding', { subjectToThresholding: true }],
  ['restricted', { schemaRestrictionResponse: { activeMetricRestrictions: [{ metricName: 'totalRevenue', restrictedMetricTypes: ['REVENUE_DATA'] }] } }],
  ['truncated', { dataTruncationReasons: [{ dataTruncationType: 'DATA_TRUNCATION_TYPE_DATE_RANGE' }] }],
  ['empty_reason', { emptyReason: 'NO_ACCESS' }],
] as const;
const connection = { propertyId: '123', accessToken: 'fixture' };
const storage = { getGA4Connection: async () => connection };
const queries = {
  totals: (s: GoogleAnalytics4Service) => s.getTotalsWithRevenue('123', 'fixture', '2026-10-20', '2026-10-20', ['sale'], 'EUR'),
  daily: (s: GoogleAnalytics4Service) => s.getTimeSeriesWithToken('123', 'fixture', '2026-10-20', ['sale'], '2026-10-20', 'EUR'),
  acquisition: (s: GoogleAnalytics4Service) => s.getAcquisitionBreakdown('fixture', storage, '2026-10-20', '123', 2000, ['sale'], '2026-10-20', true, false, 'EUR'),
  landing: (s: GoogleAnalytics4Service) => s.getLandingPagesReport('fixture', storage, '2026-10-20', '123', 50, ['sale'], '2026-10-20', true),
  events: (s: GoogleAnalytics4Service) => s.getConversionEventsReport('fixture', storage, '2026-10-20', '123', 50, ['sale'], '2026-10-20', true),
  landingComparison: (s: GoogleAnalytics4Service) => s.getLandingPagesWoWReport('fixture', storage, '123', 50, ['sale']),
  eventComparison: (s: GoogleAnalytics4Service) => s.getConversionEventsWoWReport('fixture', storage, '123', 50, ['sale']),
  geographic: (s: GoogleAnalytics4Service) => s.getGeographicMetrics('123', 'fixture', '2026-10-20', ['sale']),
  summary: (s: GoogleAnalytics4Service) => s.getMetricsWithToken('123', 'fixture', '2026-10-20', ['sale']),
  presence: (s: GoogleAnalytics4Service) => s.getTrendsDailyPresenceWithToken('123', 'fixture', '2026-10-20', '2026-10-20', ['sale'], 'EUR'),
  discovery: (s: GoogleAnalytics4Service) => s.getCampaignValues('fixture', storage, '2026-10-20', '123'),
  diagnostics: (s: GoogleAnalytics4Service) => s.getOverviewDimensionDiagnostics('fixture', storage, '2026-10-20', '123', ['sale'], '2026-10-20', 'EUR'),
};
describe('GA4 property dispatch and quality gate', () => {
  beforeEach(() => { for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {}); });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
  for (const [name, metadata] of flags) it.each(Object.keys(queries) as (keyof typeof queries)[])(`blocks ${name} before %s can return publishable figures`, async query => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(String(options.body));
      return json({ metadata: { currencyCode: 'EUR', ...metadata }, rowCount: 1,
        rows: [{ dimensionValues: (body.dimensions || []).map(() => ({ value: '20261020' })),
          metricValues: body.metrics.map(() => ({ value: '0' })) }] });
    }));
    await expect(queries[query](new GoogleAnalytics4Service())).rejects.toMatchObject({ code: 'GA4_DATA_QUALITY_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('keeps genuine unflagged zero totals available', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(String(options.body));
      return json({ metadata: { currencyCode: 'EUR', samplingMetadatas: [], subjectToThresholding: false }, rowCount: 0,
        rows: [], metricHeaders: body.metrics.map((m: any) => ({ name: m.name })) });
    }));
    expect((await queries.totals(new GoogleAnalytics4Service())).totals.revenue).toBe(0);
  });
  it('bounds concurrent calls across service instances until response bodies finish', async () => {
    let active = 0, peak = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      active++; peak = Math.max(peak, active);
      return { ok: true, status: 200, headers: new Headers(), json: async () => {
        await new Promise(resolve => setTimeout(resolve, 5)); active--; return { rows: [] };
      } };
    }));
    await Promise.all(Array.from({ length: 25 }, async () => {
      const response = await (new GoogleAnalytics4Service() as any).requestReport('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport', { method: 'POST', body: '{}' });
      await response.json();
    }));
    expect(peak).toBeLessThanOrEqual(5); expect(active).toBe(0); expect(fetch).toHaveBeenCalledTimes(25);
  });
  it('cancels a queued request without dispatch and recovers every slot', async () => {
    let release!: () => void;
    const body = new Promise(resolve => { release = () => resolve({ rows: [] }); });
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, headers: new Headers(), json: () => body })));
    const url = 'https://analyticsdata.googleapis.com/v1beta/properties/123:runReport';
    const active = Array.from({ length: 5 }, () => (new GoogleAnalytics4Service() as any).requestReport(url, {}));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(5));
    const owner = new AbortController();
    const queued = (new GoogleAnalytics4Service(owner.signal) as any).requestReport(url, {}).catch((e: Error) => e);
    owner.abort(new Error('stopped'));
    expect(await queued).toMatchObject({ message: 'stopped' });
    expect(fetch).toHaveBeenCalledTimes(5);
    release(); await Promise.all(active);
    await expect((new GoogleAnalytics4Service() as any).requestReport(url, {})).resolves.toMatchObject({ ok: true });
  });
  it('keeps five simultaneous Insights readers with twelve channels within the property limit', async () => {
    let active = 0, peak = 0, channelCalls = 0, quotaRequests = 0;
    const row = (dimensions: string[], values: number[]) => ({ dimensionValues: dimensions.map(value => ({ value })), metricValues: values.map(value => ({ value: String(value) })) });
    const report = (rows: any[], totals: number[]) => ({ metadata: { currencyCode: 'EUR' }, rowCount: rows.length, rows, totals: [{ metricValues: totals.map(value => ({ value: String(value) })) }] });
    vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
      const body = JSON.parse(String(options.body)), dimensions = body.dimensions.map((d: any) => d.name);
      active++; peak = Math.max(peak, active); if (body.returnPropertyQuota) quotaRequests++;
      let data;
      if (dimensions.includes('sessionDefaultChannelGroup')) data = report([row(['20261020', 'Paid Search', 'source_0', 'cpc', 'sale', 'desktop', 'NL'], [10, 8, 0, 0, 5])], [10, 8, 0, 0, 5]);
      else if (dimensions.includes('pageLocation')) data = report(Array.from({ length: 12 }, (_, i) => row(['20261020', `https://fixture.invalid/?utm_campaign=sale&utm_source=source_${i}&utm_medium=cpc`], [20, 16, 10])), [240, 192, 120]);
      else { channelCalls++; data = report([row(['20261020'], [20, 16, 10])], [20, 16, 10]); }
      return { ok: true, status: 200, headers: new Headers(), json: async () => {
        await new Promise(resolve => setTimeout(resolve, 10)); active--; return data;
      } };
    }));
    const results = await Promise.all(Array.from({ length: 5 }, (_, i) => new GoogleAnalytics4Service().getAcquisitionBreakdown(
      `fixture-${i}`, storage, '2026-10-20', '123', 2000, ['sale'], '2026-10-20', true, true, 'EUR')));
    expect(channelCalls).toBe(60); expect(peak).toBeLessThanOrEqual(5); expect(active).toBe(0);
    expect(quotaRequests).toBe(vi.mocked(fetch).mock.calls.length);
    for (const result of results) {
      expect(result.meta.insightsLandingCoverage?.selected).toBe(true);
      expect(result.totals.sessions).toBe(240);
    }
  });
});
