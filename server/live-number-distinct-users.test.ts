import { describe, expect, it } from 'vitest';
import { checkStoredNumbers, monitoredUsers, resolveMonitorScope, type LiveNumberSnapshot } from './live-number-checks';
import { expectedOutputNumbers } from './live-number-output-checks';
import { expectedBrowserCampaignRows } from '../scripts/live-number-browser-checks';

const now = new Date('2026-11-05T13:00:00Z');
const fixture = (): LiveNumberSnapshot => ({
  usersDefinition: 'ga4_totalUsers_distinct_v1',
  campaign: { id: 'a', ownerId: 'owner', clientId: 'client', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', ga4CampaignFilter: '["brand","social"]' },
  rows: {
    ga4Connections: [{ campaignId: 'a', propertyId: '123', isActive: true, isPrimary: true, importStartDate: '2026-11-03' }],
    ga4OverviewSnapshots: [{ campaignId: 'a', propertyId: '123', windowStart: '2026-11-03', windowEnd: '2026-11-04', campaignBreakdown: {
      meta: { propertyId: '123', currencyCode: 'EUR', distinctUsers: { version: 1, metric: 'totalUsers', propertyId: '123', startDate: '2026-11-03', endDate: '2026-11-04', total: 3, campaigns: [{ name: 'brand', users: 2 }, { name: 'social', users: 2 }] } },
      totals: { users: 3, sessions: 6, conversions: 1, revenue: 0 },
      rows: [{ campaign: 'brand', users: 4, sessions: 4, conversions: 1, revenue: 0 }, { campaign: 'social', users: 2, sessions: 2, conversions: 0, revenue: 0 }],
    } }],
    ga4DailyMetrics: ['2026-11-03', '2026-11-04'].map((date, index) => ({ campaignId: 'a', propertyId: '123', date, users: index ? 3 : 2, sessions: 3, conversions: index, revenue: 0, pageviews: 3, engagedSessions: 1, isSimulated: false })),
    revenueSources: [], revenueRecords: [], spendSources: [], spendRecords: [],
  },
});

describe('distinct Users monitor definition', () => {
  it('checks total and campaign Users independently of daily and campaign sums', () => {
    const snapshot = fixture();
    expect(expectedOutputNumbers(snapshot, now).totals.users).toBe(3);
    expect(expectedBrowserCampaignRows(snapshot, now).map(row => row.users)).toEqual([2, 2]);
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: 'DISTINCT_USERS', status: 'passed' }));
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.totals.users = 5;
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: 'DISTINCT_USERS', status: 'difference' }));
  });
  it.each(['missing', 'property', 'dates', 'negative'])('fails closed for %s native evidence', problem => {
    const snapshot = fixture(), meta = snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta;
    if (problem === 'missing') delete meta.distinctUsers;
    if (problem === 'property') meta.distinctUsers.propertyId = 'other';
    if (problem === 'dates') meta.distinctUsers.endDate = '2026-11-03';
    if (problem === 'negative') meta.distinctUsers.total = -1;
    expect(monitoredUsers(snapshot, resolveMonitorScope(snapshot, now))).toBeNull();
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: 'DISTINCT_USERS', status: 'unverified' }));
  });
});
