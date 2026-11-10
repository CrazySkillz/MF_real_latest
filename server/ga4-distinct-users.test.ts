import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import { getGA4DistinctUsers } from '../shared/ga4-traffic-window';
import { deriveExactCumulativeGA4Traffic } from '../client/src/lib/trend-analysis-cumulative';

const start = '2026-10-01', end = '2026-10-10';
const events = [
  { user: 'returning', date: '20261001', campaign: 'brand' },
  { user: 'returning', date: '20261002', campaign: 'brand' },
  { user: 'returning', date: '20261003', campaign: 'social' },
  { user: 'new', date: '20261003', campaign: 'social' },
  { user: 'later', date: '20261010', campaign: 'brand' },
  { user: 'outside', date: '20260930', campaign: 'brand' },
  { user: 'unselected', date: '20261003', campaign: 'brand-extra' },
];
let fallback = false;
let corrupt = '';
let requests: any[] = [];
function matches(expression: any, event: typeof events[number]): boolean {
  if (!expression) return true;
  if (expression.andGroup) return expression.andGroup.expressions.every((item: any) => matches(item, event));
  if (expression.orGroup) return expression.orGroup.expressions.some((item: any) => matches(item, event));
  if (expression.notExpression) return !matches(expression.notExpression, event);
  const filter = expression.filter;
  const value = filter.fieldName === 'date' ? event.date : filter.fieldName === 'pageLocation'
    ? `https://test.invalid/landing?utm_campaign=${event.campaign}` : fallback && event.date > '20261002' ? '(not set)' : event.campaign;
  if (filter.numericFilter) return Number(value) <= Number(filter.numericFilter.value.int64Value);
  if (filter.stringFilter.matchType === 'EXACT') return value.toLowerCase() === filter.stringFilter.value.toLowerCase();
  return new RegExp(filter.stringFilter.value, 'i').test(value);
}
beforeEach(() => {
  fallback = false; corrupt = ''; requests = [];
  vi.stubEnv('DATABASE_URL', '');
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
    expect(url).toContain('/properties/123:runReport');
    const body = JSON.parse(options.body); requests.push(body);
    expect(body.metrics).toEqual([{ name: 'totalUsers' }]);
    const window = body.dateRanges[0];
    const selected = events.filter(event => event.date >= window.startDate.replace(/-/g, '') && event.date <= window.endDate.replace(/-/g, '') && matches(body.dimensionFilter, event));
    const daily = body.dimensions?.[0]?.name === 'date';
    const keys = daily ? [...new Set(selected.map(event => event.date))].sort() : selected.length ? [''] : [];
    const rows = keys.map(date => ({ ...(daily ? { dimensionValues: [{ value: date }] } : {}),
      metricValues: [{ value: String(new Set(selected.filter(event => !date || event.date === date).map(event => event.user)).size) }] }));
    if (corrupt === 'negative' && rows[0]) rows[0].metricValues[0].value = '-1';
    return new Response(JSON.stringify({ rows, rowCount: rows.length + (corrupt === 'truncated' ? 1 : 0),
      metadata: corrupt === 'thresholded' ? { subjectToThresholding: true } : {} }), { status: 200 });
  }));
});
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); });
const fetchUsers = () => ga4Service.getDistinctUsersWithToken('123', 'read-only', start, end, ['brand', 'social']);

describe('GA4 distinct Users contract', () => {
  it('counts returning and cross-campaign users once in the period; keeps native daily and campaign counts', async () => {
    const result = await fetchUsers();
    expect(result.total).toBe(3);
    expect(result.campaigns).toEqual([{ name: 'brand', users: 2 }, { name: 'social', users: 2 }]);
    expect(result.daily.reduce((sum, row) => sum + row.users, 0)).toBe(5);
    expect(result.daily).toHaveLength(10);
    expect(result.windows.find(row => row.startDate === start && row.endDate === '2026-10-03')?.users).toBe(2);
    expect(requests.filter(body => !body.dimensions).every(body => body.dateRanges.length === 1)).toBe(true);
  });
  it('deduplicates a user across primary attribution and the UTM tail in one aggregate request', async () => {
    fallback = true;
    const result = await fetchUsers();
    expect(result.total).toBe(3);
    expect(result.campaigns.map(row => row.users)).toEqual([2, 2]);
    expect(requests.some(body => !body.dimensions && body.dimensionFilter?.orGroup?.expressions?.[0]?.andGroup)).toBe(true);
  });
  it('keeps exact campaign boundaries and returns a verified zero for no matching activity', async () => {
    const result = await ga4Service.getDistinctUsersWithToken('123', 'read-only', start, end, ['brand-ex']);
    expect(result.total).toBe(0);
    expect(result.daily.every(row => row.users === 0)).toBe(true);
  });
  it.each(['negative', 'truncated', 'thresholded'])('rejects %s results without inventing an audience', async reason => {
    corrupt = reason;
    await expect(fetchUsers()).rejects.toThrow(/INCOMPLETE|QUALITY_UNAVAILABLE/);
  });
  it('rejects another property or campaign capture before querying', async () => {
    await expect(ga4Service.getDistinctUsersWithToken('123', 'read-only', start, end, ['brand'], {
      propertyId: 'other', startDate: start, endDate: end, campaigns: ['brand'], throughDate: end,
    })).rejects.toThrow('SCOPE_UNVERIFIED');
    expect(requests).toHaveLength(0);
  });
  it('reads only exact published scopes; never substitutes old daily sums or unrelated dates', async () => {
    const packet = await fetchUsers();
    const snapshot = { windowStart: start, windowEnd: end, campaignBreakdown: { meta: { propertyId: '123', distinctUsers: packet }, totals: { users: 999 } } };
    expect(getGA4DistinctUsers(snapshot, start, end)).toBe(3);
    expect(getGA4DistinctUsers(snapshot, start, end, 'BRAND')).toBe(2);
    expect(getGA4DistinctUsers(snapshot, start, '2026-10-03')).toBe(2);
    expect(getGA4DistinctUsers(snapshot, start, '2026-10-04')).toBeNull();
    expect(getGA4DistinctUsers({ campaignBreakdown: { totals: { users: 999 } } }, start, end)).toBeNull();
    snapshot.campaignBreakdown.meta.propertyId = 'other';
    expect(getGA4DistinctUsers(snapshot, start, end)).toBeNull();
  });
  it('uses a directly queried historical audience instead of subtracting daily users', () => {
    const current = { users: 3, sessions: 10, conversions: 4, engagedSessions: 8 };
    const result = deriveExactCumulativeGA4Traffic({ overviewStartDate: start, dataThroughDate: end, startDate: start, endDate: end,
      overviewTotals: current, usersComparisons: [{ startDate: start, endDate: '2026-10-03', users: 2 }],
      data: [{ date: end, users: 3, sessions: 4, conversions: 1, engagedSessions: 3 }],
    }, '2026-10-03');
    expect(result?.previous).toMatchObject({ users: 2, sessions: 6, conversions: 3 });
    expect(current.users).toBe(3);
  });
});
