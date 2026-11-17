import { afterEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import { buildGA4InsightsCalendarRollup, getGA4InsightsSevenDayUsers } from '../shared/ga4-insights';
import { getGA4DistinctUsers } from '../shared/ga4-traffic-window';

const start = '2026-10-01', end = '2026-10-18';
const events = [{ date: '20261001', user: 'returning' }, { date: '20261002', user: 'returning' }, { date: '20261018', user: 'new' }];
const requests: any[] = [];
function fixture(corrupt = '') {
  requests.length = 0;
  vi.stubEnv('DATABASE_URL', '');
  vi.stubGlobal('fetch', vi.fn(async (_url, options) => {
    const body = JSON.parse(options.body); requests.push(body);
    const named = body.dateRanges[0].name;
    const daily = body.dimensions?.[0]?.name === 'date';
    const rows: any[] = [];
    for (const range of body.dateRanges) {
      const selected = events.filter(e => e.date >= range.startDate.replaceAll('-', '') && e.date <= range.endDate.replaceAll('-', ''));
      for (const date of daily ? [...new Set(selected.map(e => e.date))] : ['']) rows.push({
        dimensionValues: daily ? [{ value: date }] : named && body.dateRanges.length > 1 ? [{ value: range.name }] : [],
        metricValues: [{ value: String(new Set(selected.filter(e => !date || date === e.date).map(e => e.user)).size) }],
      });
    }
    const totals = rows.map(row => ({ ...row, metricValues: row.metricValues.map((v: any) => ({ ...v })) }));
    if (named && corrupt === 'missing') totals.pop();
    if (named && corrupt === 'duplicate') totals[1] = totals[0];
    if (named && corrupt === 'negative') totals[0].metricValues[0].value = '-1';
    if (named && corrupt === 'invalid') totals[0].metricValues[0].value = '';
    return new Response(JSON.stringify({
      dimensionHeaders: daily ? [{ name: 'date' }] : named && body.dateRanges.length > 1 ? [{ name: 'dateRange' }] : [],
      metricHeaders: [{ name: 'totalUsers' }], rows, totals, rowCount: rows.length + (named && corrupt === 'truncated' ? 1 : 0),
      metadata: named && corrupt === 'threshold' ? { subjectToThresholding: true } : named && corrupt === 'sampled' ? { samplingMetadatas: [{ samplesReadCount: '1', samplingSpaceSize: '2' }] } : {},
    }), { status: 200 });
  }));
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const fetchWindows = () => ga4Service.getDistinctUsersWithToken('123', 'isolated', start, end, ['brand'], {
  propertyId: '123', startDate: start, endDate: end, campaigns: ['brand'], throughDate: '',
}, false, start);
describe('GA4 seven-day distinct Users', () => {
  it('uses GA4 window totals instead of adding daily users, retaining real zeros and exact campaign scope', async () => {
    fixture(); const result = await fetchWindows();
    expect(result.daily.slice(0, 7).reduce((n, row) => n + row.users, 0)).toBe(2);
    const rollup = buildGA4InsightsCalendarRollup(result.daily, '2026-10-07', 7);
    expect(getGA4InsightsSevenDayUsers(result.windows, rollup)).toBe(1);
    expect(getGA4InsightsSevenDayUsers(result.windows, buildGA4InsightsCalendarRollup(result.daily, '2026-10-10', 7))).toBe(0);
    const seven = result.windows.filter(w => Date.parse(w.endDate) - Date.parse(w.startDate) === 6 * 86400000);
    expect(seven).toHaveLength(12);
    for (const request of requests.filter(r => r.dateRanges[0].name)) {
      expect(request.dateRanges.length).toBeLessThanOrEqual(4);
      expect(request.metrics).toEqual([{ name: 'totalUsers' }]);
      expect(request.dimensions).toBeUndefined();
      expect(request.dimensionFilter.filter.fieldName).toBe('pageLocation');
      expect(request.dimensionFilter.filter.stringFilter.value).toContain('brand');
    }
    const snapshot = { windowStart: start, windowEnd: end, campaignBreakdown: { meta: { propertyId: '123', distinctUsers: result } } };
    expect(getGA4DistinctUsers(snapshot, '2026-10-01', '2026-10-07')).toBe(1);
  });
  it.each(['missing', 'duplicate', 'negative', 'invalid', 'truncated', 'threshold', 'sampled'])('rejects %s provider results before publication', async failure => {
    fixture(failure); await expect(fetchWindows()).rejects.toThrow();
  });
  it('keeps absent, duplicate, invalid and incomplete windows unavailable', () => {
    const rollup = { startDate: start, endDate: '2026-10-07', complete: true };
    const window = { ...rollup, users: 1 };
    expect(getGA4InsightsSevenDayUsers([window], rollup)).toBe(1);
    for (const rows of [[], [window, window], [{ ...window, users: null }], [{ ...window, users: '1' }]]) expect(getGA4InsightsSevenDayUsers(rows, rollup)).toBeNull();
    expect(getGA4InsightsSevenDayUsers([window], { ...rollup, complete: false })).toBeNull();
    expect(getGA4InsightsSevenDayUsers([window], { ...rollup, endDate: '2026-10-08' })).toBeNull();
  });
});
