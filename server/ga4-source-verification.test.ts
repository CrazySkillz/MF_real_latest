import { beforeEach, describe, expect, it, vi } from 'vitest';
const provider = vi.hoisted(() => ({ getTimeSeriesWithToken: vi.fn(), getAcquisitionBreakdown: vi.fn(), getLandingPagesReport: vi.fn(), getConversionEventsReport: vi.fn() }));
vi.mock('./analytics', () => ({ GoogleAnalytics4Service: class { constructor() { return provider; } } }));
import { checkGA4SourceNumbers, ga4VerificationInputHash, verifyGA4InitialImport } from './ga4-source-verification';

const day = '2026-11-07';
const daily = () => ({ campaignId: 'a', propertyId: '123', date: day, sessions: 10, users: 8, pageviews: 15, conversions: 2, revenue: '20.25', engagedSessions: 6, engagementRate: 0.6, isSimulated: false });
const overview = () => ({ campaignId: 'a', propertyId: '123', windowStart: day, windowEnd: day,
  campaignBreakdown: { meta: { propertyId: '123', currencyCode: 'EUR', revenueMetric: 'totalRevenue', dimensions: ['campaignName'],
    distinctUsers: { version: 1, metric: 'totalUsers', propertyId: '123', startDate: day, endDate: day, total: 8, daily: [{ date: day, users: 8 }], campaigns: [{ name: 'sale', users: 8 }], windows: [] } },
    totals: { sessions: 10, sessionsRaw: 10, users: 8, conversions: 2, revenue: 20.25, engagedSessions: 6, engagementRate: 0.6 },
    rows: [{ campaign: 'sale', sessions: 10, users: 8, conversions: 2, revenue: 20.25, engagedSessions: 6, sessionKeyEventRate: 0.2 }] },
  landingPages: { propertyId: '123', revenueMetric: 'totalRevenue', rows: [{ landingPage: '/sale', source: 'google', medium: 'cpc', sessions: 10, users: 8, conversions: 2 }] },
  conversionEvents: { propertyId: '123', revenueMetric: 'totalRevenue', rows: [{ eventName: 'purchase', conversions: 2, eventCount: 2, users: 2 }] },
});
const connection = () => ({ id: 'connection-a', campaignId: 'a', propertyId: '123', importStartDate: day, isActive: true, accessToken: 'read-only-token', refreshToken: 'never-use', serviceAccountKey: 'never-use' });
const owned = { campaignId: 'a', ownerId: 'owner-a', reportingDate: day, work: { id: 'work-a', leaseToken: 'lease-a' } };
let stored: ReturnType<typeof overview>, savedDaily: ReturnType<typeof daily>[], storage: any, ownership: ReturnType<typeof vi.fn>;
beforeEach(() => {
  vi.clearAllMocks(); stored = overview(); savedDaily = [daily()]; ownership = vi.fn().mockResolvedValue(undefined);
  storage = { getCampaign: vi.fn().mockResolvedValue({ id: 'a', ownerId: 'owner-a', clientId: 'client-a', status: 'draft', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', ga4CampaignFilter: '["sale"]' }),
    getGA4Connections: vi.fn().mockResolvedValue([connection()]), getGA4OverviewSnapshot: vi.fn().mockImplementation(async () => stored),
    getGA4DailyMetrics: vi.fn().mockImplementation(async () => savedDaily), recordGA4InitialImportVerification: vi.fn().mockResolvedValue(undefined) };
  provider.getTimeSeriesWithToken.mockResolvedValue([daily()]);
  provider.getAcquisitionBreakdown.mockResolvedValue(overview().campaignBreakdown);
  provider.getLandingPagesReport.mockResolvedValue(overview().landingPages);
  provider.getConversionEventsReport.mockResolvedValue(overview().conversionEvents);
});
describe('first-import source verification', () => {
  it.each(['total', 'campaign', 'daily'])('blocks a changed distinct-user %s result', async kind => {
    const users = stored.campaignBreakdown.meta.distinctUsers;
    if (kind === 'total') users.total = 999;
    if (kind === 'campaign') users.campaigns[0].users = 999;
    if (kind === 'daily') users.daily[0].users = 999;
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_DIFFERENCE');
  });
  it('does not certify an old daily sum as distinct Users', async () => {
    delete (stored.campaignBreakdown.meta as any).distinctUsers;
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
    expect(storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it('compares saved inputs with fresh exact-scope queries without writing figures or refreshing credentials', async () => {
    const before = JSON.stringify([stored, savedDaily]);
    await verifyGA4InitialImport(storage, owned, ownership);
    expect(JSON.stringify([stored, savedDaily])).toBe(before);
    expect(provider.getTimeSeriesWithToken).toHaveBeenCalledWith('123', 'read-only-token', day, ['sale'], day, 'EUR', expect.objectContaining({ campaignId: 'a' }));
    const args = provider.getAcquisitionBreakdown.mock.calls[0];
    expect(args.slice(2, 10)).toEqual([day, '123', 10000, ['sale'], day, true, false, 'EUR']);
    expect(await args[1].getGA4Connection('a', '123')).toMatchObject({ refreshToken: null, serviceAccountKey: null });
    await expect(args[1].getGA4Connection('other', '123')).rejects.toThrow('SCOPE_CHANGED');
    expect(storage.recordGA4InitialImportVerification).toHaveBeenCalledWith(owned, [expect.objectContaining({ propertyId: '123', inputHash: ga4VerificationInputHash(stored, savedDaily), unavailable: [] })]);
  });
  it.each(['sessions', 'users', 'pageviews', 'conversions', 'revenue', 'engagedSessions', 'engagementRate'])('blocks a changed daily %s value', async metric => {
    (savedDaily[0] as any)[metric] = 999;
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_DIFFERENCE');
    expect(storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it.each(['campaignBreakdown', 'landingPages', 'conversionEvents'])('blocks changed %s rows', async table => {
    (stored as any)[table].rows[0].conversions = 3;
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_DIFFERENCE');
  });
  it('records unavailable event counts separately instead of certifying them as zero', async () => {
    (stored.conversionEvents.rows[0] as any).eventCount = null;
    provider.getConversionEventsReport.mockResolvedValue(structuredClone(stored.conversionEvents));
    await verifyGA4InitialImport(storage, owned, ownership);
    expect(storage.recordGA4InitialImportVerification.mock.calls[0][1][0].unavailable).toEqual(['Overview / conversionEvents:eventCount_UNAVAILABLE']);
    stored.conversionEvents.rows[0].eventCount = 0;
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
  });
  it('compares the actual Landing Pages date window even when the row values match', async () => {
    const meta = { historyLimited: true, requestedStartDate: '2026-11-01', startDate: day, endDate: day };
    (stored.landingPages as any).meta = meta;
    provider.getLandingPagesReport.mockResolvedValue({ ...overview().landingPages, meta: { ...meta } });
    await verifyGA4InitialImport(storage, owned, ownership);
    (stored.landingPages as any).meta = { ...meta, startDate: '2026-11-06' };
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
  });
  it.each(['getTimeSeriesWithToken', 'getAcquisitionBreakdown', 'getLandingPagesReport', 'getConversionEventsReport'] as const)('cannot certify a failed %s query', async method => {
    provider[method].mockRejectedValue(new Error('provider failure with private data'));
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('GA4_INITIAL_VERIFICATION_UNVERIFIED');
    expect(storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it('rejects missing daily dates and duplicate provider rows', async () => {
    savedDaily = [];
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_DIFFERENCE');
    savedDaily = [daily()]; provider.getTimeSeriesWithToken.mockResolvedValue([daily(), daily()]);
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
  });
  it.each(['currency', 'property', 'date'])('fails closed for a mismatched %s boundary', async kind => {
    if (kind === 'currency') stored.campaignBreakdown.meta.currencyCode = 'USD';
    if (kind === 'property') stored.campaignBreakdown.meta.propertyId = '456';
    if (kind === 'date') stored.windowEnd = '2026-11-06';
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
    expect(provider.getTimeSeriesWithToken).not.toHaveBeenCalled();
  });
  it('does not verify a different owner or activate a partial multi-property import', async () => {
    await expect(verifyGA4InitialImport(storage, { ...owned, ownerId: 'other' }, ownership)).rejects.toThrow('SCOPE_CHANGED');
    storage.getGA4Connections.mockResolvedValue([connection(), { ...connection(), id: 'second', propertyId: '456' }]);
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('VERIFICATION_UNVERIFIED');
    expect(storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it('refuses a receipt when the work loses ownership after comparison', async () => {
    ownership.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('GA4_REFRESH_WORK_OWNERSHIP_LOST'));
    await expect(verifyGA4InitialImport(storage, owned, ownership)).rejects.toThrow('OWNERSHIP_LOST');
    expect(storage.recordGA4InitialImportVerification).not.toHaveBeenCalled();
  });
  it('distinguishes a complete provider zero result from an unavailable response', async () => {
    const zero = Object.fromEntries(Object.keys(daily()).filter(k => typeof (daily() as any)[k] === 'number').map(k => [k, 0]));
    savedDaily = [{ ...daily(), ...zero, revenue: '0' }];
    const publication = overview(); publication.campaignBreakdown.rows = []; Object.keys(publication.campaignBreakdown.totals).forEach(k => (publication.campaignBreakdown.totals as any)[k] = 0);
    publication.campaignBreakdown.meta.distinctUsers.total = 0;
    publication.campaignBreakdown.meta.distinctUsers.daily[0].users = 0;
    publication.campaignBreakdown.meta.distinctUsers.campaigns[0].users = 0;
    publication.landingPages.rows = []; publication.conversionEvents.rows = [];
    provider.getTimeSeriesWithToken.mockResolvedValue([]); provider.getAcquisitionBreakdown.mockResolvedValue(publication.campaignBreakdown);
    provider.getLandingPagesReport.mockResolvedValue(publication.landingPages); provider.getConversionEventsReport.mockResolvedValue(publication.conversionEvents);
    const checks = await checkGA4SourceNumbers({ campaignId: 'a', connection: connection(), publication, filter: ['sale'], startDate: day, endDate: day, currency: 'EUR' }, savedDaily);
    expect(checks.every(c => c.status === 'passed')).toBe(true);
  });
});
