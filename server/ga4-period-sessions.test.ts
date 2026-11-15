import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import evidence from './fixtures/ga4-native-values-real-2026-11-15.json';
import { ga4Service } from './analytics';
import { getGA4PeriodTraffic, summarizeGA4TrafficRows } from '../shared/ga4-traffic-window';
import { deriveExactCumulativeGA4Traffic } from '../client/src/lib/trend-analysis-cumulative';

const { scope, breakdown, daily } = evidence;
const snapshot = { windowStart: scope.startDate, windowEnd: scope.endDate, campaignBreakdown: breakdown };
const key = (body: any) => JSON.stringify([body.dateRanges, body.dimensions || [], body.metrics,
  body.dimensionFilter, body.limit]);
const aggregate = evidence.requests.find(row => row.request.metrics.length === 5 && !('dimensions' in row.request))!;
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe('whole-period Sessions from recorded real GA4 responses', () => {
  const replay = (damage?: string) => vi.stubGlobal('fetch', vi.fn(async (_url: string, options: any) => {
    const body = JSON.parse(options.body);
    const found = evidence.requests.find(row => key(row.request) === key(body));
    if (!found) throw new Error('Unrecorded GA4 request: ' + JSON.stringify(body));
    const data: any = structuredClone(found.response);
    if (!body.dimensions && damage) {
      if (damage === 'missing') data.rows[0].metricValues.splice(1, 1);
      if (damage === 'negative') data.rows[0].metricValues[1].value = '-1';
      if (damage === 'truncated') data.rowCount += 1;
      if (damage === 'sampled') data.metadata.samplingMetadatas = [{ samplesReadCount: '1', samplingSpaceSize: '2' }];
      if (damage === 'thresholded') data.metadata.subjectToThresholding = true;
    }
    return new Response(JSON.stringify(data), { status: 200 });
  }));
  const fetchPeriod = () => ga4Service.getDistinctUsersWithToken(scope.propertyId, 'recorded-response-only', scope.startDate, scope.endDate, scope.campaigns, scope, true);

  it('matches a separate Sessions-only provider query rather than adding daily counts', async () => {
    replay(); const result = await fetchPeriod();
    const independent = evidence.requests.find(row => row.request.metrics.length === 4 && row.request.metrics[0].name === 'sessions')!;
    expect(result.sessions).toBe(Number(independent.response.rows[0].metricValues[0].value));
    expect(result.sessions).toBe(4472);
    expect(daily.reduce((sum, row) => sum + row.sessions, 0)).toBe(4497);
    expect(result.campaigns.map(row => row.sessions)).toEqual([3159, 1358]);
    expect(result.sessions).not.toBe(result.campaigns.reduce((sum, row) => sum + row.sessions!, 0));
  });
  it('uses provider Sessions and engagement rate while preserving conversion and revenue inputs', () => {
    const before = JSON.stringify(daily), result = summarizeGA4TrafficRows(daily, snapshot, scope.startDate, scope.endDate);
    expect(result.sessions).toBe(4472);
    expect(result.engagedSessions).toBe(3246);
    expect(result.engagementRate).toBe(Number(aggregate.response.rows[0].metricValues[3].value));
    expect(result.conversions).toBe(440);
    expect(result.conversionRate?.toFixed(1)).toBe('9.6');
    expect((result.engagementRate * 100).toFixed(1)).toBe('72.6');
    expect(result.revenue).toBe(summarizeGA4TrafficRows(daily).revenue);
    expect(JSON.stringify(daily)).toBe(before);
  });
  it('keeps exact campaign and historical-window totals without subtracting daily Sessions', () => {
    expect(getGA4PeriodTraffic(snapshot, scope.startDate, scope.endDate, 'yesop_brand_search')?.sessions).toBe(3159);
    expect(getGA4PeriodTraffic(snapshot, scope.startDate, scope.endDate, 'unselected')).toBeNull();
    const period = breakdown.meta.distinctUsers;
    const previous = period.windows.find(row => row.startDate === scope.startDate)!;
    const result = deriveExactCumulativeGA4Traffic({ overviewStartDate: scope.startDate, dataThroughDate: scope.endDate,
      startDate: scope.startDate, endDate: scope.endDate, usersComparisons: period.windows,
      overviewTotals: { ...summarizeGA4TrafficRows(daily, snapshot, scope.startDate, scope.endDate), users: period.total }, data: daily }, previous.endDate);
    expect(result?.previous.sessions).toBe(previous.sessions);
    expect(result?.previous.engagedSessions).toBe(previous.engagedSessions);
  });
  it.each(['missing', 'negative', 'truncated', 'sampled', 'thresholded'])('fails closed on %s aggregate data', async damage => {
    replay(damage); await expect(fetchPeriod()).rejects.toThrow(/UNVERIFIED|INCOMPLETE|QUALITY_UNAVAILABLE/);
  });
  it('rejects mismatched saved dates/property and corrupt period metadata', () => {
    expect(getGA4PeriodTraffic({ ...snapshot, windowEnd: '2026-11-14' }, scope.startDate, scope.endDate)).toBeNull();
    const corrupt = structuredClone(snapshot); corrupt.campaignBreakdown.meta.propertyId = 'other';
    expect(() => summarizeGA4TrafficRows(daily, corrupt, scope.startDate, scope.endDate)).toThrow('GA4_PERIOD_SESSIONS_UNVERIFIED');
  });
  it.each([true, false])('returns period Sessions in saved diagnostic inputs (available=%s)', available => {
    const source = readFileSync('server/routes-oauth.ts', 'utf8').replace(/\r\n/g, '\n');
    const start = source.indexOf('      if (useSavedOverview) {\n        ga4Totals.users = financialGa4Totals.users');
    const end = source.indexOf('      res.json({', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const ga4 = { ...summarizeGA4TrafficRows(daily) }, web = { ...ga4, provider: 'ga4' };
    const saved = { ...breakdown.totals, available };
    new Function('useSavedOverview', 'ga4Totals', 'financialGa4Totals', 'webAnalytics', 'financialWebAnalytics', source.slice(start, end))(true, ga4, saved, web, saved);
    expect(ga4.sessions).toBe(available ? 4472 : null);
    expect(web.sessions).toBe(available ? 4472 : null);
    expect(ga4.conversions).toBe(440);
    expect(ga4.revenue).toBe(summarizeGA4TrafficRows(daily).revenue);
  });
});
