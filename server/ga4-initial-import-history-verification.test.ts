import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';
import { verifyGA4InitialImport } from './ga4-source-verification';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

async function fixture(days: number) {
  vi.stubEnv('DATABASE_URL', '');
  const start = '2025-11-19', end = new Date(Date.parse(start) + (days - 1) * 86400000).toISOString().slice(0, 10);
  const daily = Array.from({ length: days }, (_, index) => {
    const active = index % 7 !== 0;
    return { campaignId: 'a', propertyId: '123', date: new Date(Date.parse(start) + index * 86400000).toISOString().slice(0, 10),
      sessions: active ? 10 : 0, users: active ? 1 : 0, pageviews: active ? 15 : 0, conversions: active ? 2 : 0,
      revenue: active ? '20.25' : '0', engagedSessions: active ? 7 : 0, engagementRate: active ? 0.7 : 0, isSimulated: false, person: index % 5 };
  });
  const requests: any[] = [];
  const period = (from: string, to: string) => {
    const active = daily.filter(row => row.date >= from && row.date <= to && row.sessions > 0);
    return { users: new Set(active.map(row => row.person)).size, sessions: active.length * 10, engagedSessions: active.length * 7,
      engagementRate: active.length ? 0.7 : 0, sessionKeyEventRate: active.length ? 0.096 : 0 };
  };
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
    expect(url).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport');
    const body = JSON.parse(options.body); requests.push(body);
    expect(JSON.stringify(body.dimensionFilter)).toContain('selected-campaign');
    const metricValues = (range: any) => body.metrics.map((metric: any) => ({ value: String((period(range.startDate, range.endDate) as any)[metric.name === 'totalUsers' ? 'users' : metric.name]) }));
    if (body.metricAggregations) return new Response(JSON.stringify({ dimensionHeaders: [{ name: 'dateRange' }], metricHeaders: [{ name: 'totalUsers' }], rows: [], rowCount: 0,
      totals: body.dateRanges.map((range: any) => ({ dimensionValues: [{ value: range.name }], metricValues: metricValues(range) })) }));
    const range = body.dateRanges[0];
    const rows = body.dimensions ? daily.filter(row => row.date >= range.startDate && row.date <= range.endDate && row.sessions > 0)
      .map(row => ({ dimensionValues: [{ value: row.date.replace(/-/g, '') }], metricValues: [{ value: String(row.users) }] }))
      : [{ metricValues: metricValues(range) }];
    return new Response(JSON.stringify({ rows, rowCount: rows.length }));
  }));
  const service = new GoogleAnalytics4Service();
  const breakdown = async (capture: any) => {
    const distinctUsers = await service.getDistinctUsersWithToken('123', 'fixture', start, end, ['selected-campaign'],
      { propertyId: '123', startDate: start, endDate: end, campaigns: ['selected-campaign'], throughDate: end }, true, capture.rollingUsersStartDate);
    const totals = { ...period(start, end), sessionsRaw: period(start, end).sessions,
      conversions: daily.reduce((sum, row) => sum + row.conversions, 0), revenue: daily.reduce((sum, row) => sum + Number(row.revenue), 0) };
    return { meta: { propertyId: '123', currencyCode: 'EUR', revenueMetric: 'totalRevenue', dimensions: ['campaignName'], distinctUsers },
      totals, rows: [{ campaign: 'selected-campaign', ...totals }] };
  };
  const publication = { campaignId: 'a', propertyId: '123', windowStart: start, windowEnd: end,
    campaignBreakdown: await breakdown({ rollingUsersStartDate: start }),
    landingPages: { propertyId: '123', revenueMetric: 'totalRevenue', rows: [] },
    conversionEvents: { propertyId: '123', revenueMetric: 'totalRevenue', rows: [] } };
  vi.spyOn(GoogleAnalytics4Service.prototype, 'getTimeSeriesWithToken').mockResolvedValue(daily);
  vi.spyOn(GoogleAnalytics4Service.prototype, 'getAcquisitionBreakdown').mockImplementation(async (...args: any[]) => breakdown(args[11]) as any);
  vi.spyOn(GoogleAnalytics4Service.prototype, 'getLandingPagesReport').mockResolvedValue(publication.landingPages as any);
  vi.spyOn(GoogleAnalytics4Service.prototype, 'getConversionEventsReport').mockResolvedValue(publication.conversionEvents as any);
  const owned = { campaignId: 'a', ownerId: 'owner', reportingDate: end, work: { id: 'work', leaseToken: 'lease' } };
  const storage: any = { getCampaign: async () => ({ id: 'a', ownerId: 'owner', clientId: 'client', status: 'draft', currency: 'EUR', reportingTimeZone: 'Europe/London', ga4CampaignFilter: '["selected-campaign"]' }),
    getGA4Connections: async () => [{ id: 'connection', campaignId: 'a', propertyId: '123', importStartDate: start, isActive: true, accessToken: 'fixture' }],
    getGA4OverviewSnapshot: async () => publication, getGA4DailyMetrics: async () => daily, recordGA4InitialImportVerification: vi.fn() };
  const verify = (signal?: AbortSignal) => verifyGA4InitialImport(storage, owned, async () => {}, signal);
  requests.length = 0;
  return { publication, daily, requests, storage, verify, start, end };
}

describe('real distinct-period queries through initial-import verification', () => {
  it.each([30, 31, 365, 366])('verifies %i days including recorded zeros, rolling users and native period rates', async days => {
    const f = await fixture(days), before = JSON.stringify([f.publication, f.daily]);
    await f.verify();
    expect(f.storage.recordGA4InitialImportVerification).toHaveBeenCalledOnce();
    expect(JSON.stringify([f.publication, f.daily])).toBe(before);
    const queried = new Set(f.requests.filter(body => body.metricAggregations).flatMap(body => body.dateRanges.map((range: any) => `${range.startDate}/${range.endDate}`)));
    for (const width of [7, 30]) for (let index = width - 1; index < days; index++) {
      const from = f.daily[index - width + 1].date, to = f.daily[index].date;
      const window = f.publication.campaignBreakdown.meta.distinctUsers.windows.find(row => row.startDate === from && row.endDate === to);
      expect(window).toBeDefined();
      if (!Object.hasOwn(window!, 'sessionKeyEventRate')) expect(queried.has(`${from}/${to}`)).toBe(true);
    }
  });
  it.each(['rolling value', 'missing rolling window', 'extra rolling window', 'period rate', 'missing period rate', 'rolling boundary'])('still rejects %s damage', async damage => {
    const f = await fixture(30), users = f.publication.campaignBreakdown.meta.distinctUsers;
    const index = users.windows.findIndex(row => !Object.hasOwn(row, 'sessionKeyEventRate'));
    if (damage === 'rolling value') users.windows[index].users += 1;
    if (damage === 'missing rolling window') users.windows.splice(index, 1);
    if (damage === 'extra rolling window') users.windows.push({ startDate: '2025-11-01', endDate: f.end, users: 999 });
    if (damage === 'period rate') (users.windows[0] as any).sessionKeyEventRate = 0.99;
    if (damage === 'missing period rate') delete (users.windows[0] as any).sessionKeyEventRate;
    if (damage === 'rolling boundary') users.rollingUsersStartDate = '2025-11-20';
    await expect(f.verify()).rejects.toThrow(/VERIFICATION_(DIFFERENCE|UNVERIFIED)/);
    expect(f.storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it('bounds rolling requests to four while preserving every comparison and its order', async () => {
    const f = await fixture(365), original = vi.mocked(fetch).getMockImplementation()!;
    let active = 0, maximum = 0;
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => {
      if (!JSON.parse(String(args[1]?.body)).metricAggregations) return original(...args);
      maximum = Math.max(maximum, ++active);
      try { await new Promise(resolve => setTimeout(resolve, active % 2 ? 3 : 1)); return await original(...args); }
      finally { active--; }
    }));
    const before = JSON.stringify(f.publication);
    await f.verify();
    expect(maximum).toBe(4);
    expect(active).toBe(0);
    expect(JSON.stringify(f.publication)).toBe(before);
    expect(f.storage.recordGA4InitialImportVerification).toHaveBeenCalledOnce();
  });
  it.each(['incomplete response', 'cancelled'])('does not certify a %s rolling batch', async failure => {
    const f = await fixture(30), original = vi.mocked(fetch).getMockImplementation()!, controller = new AbortController();
    vi.stubGlobal('fetch', vi.fn(async (...args: Parameters<typeof fetch>) => {
      if (!JSON.parse(String(args[1]?.body)).metricAggregations) return original(...args);
      if (failure === 'cancelled') { controller.abort(); throw new DOMException('Aborted', 'AbortError'); }
      return new Response(JSON.stringify({ metricHeaders: [{ name: 'totalUsers' }], totals: [], rows: [], rowCount: 0 }));
    }));
    await expect(f.verify(controller.signal)).rejects.toThrow();
    expect(f.storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
});
