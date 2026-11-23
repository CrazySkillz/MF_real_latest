import { afterEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import { getGA4PeriodTraffic } from '../shared/ga4-traffic-window';
import evidence from './fixtures/ga4-comparison-sampling-real-2026-11-19.json';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const key = (body: any) => JSON.stringify([body.dateRanges, body.dimensions || [], body.metrics, body.dimensionFilter, body.limit, body.metricAggregations]);
const mixed = (body: any) => Boolean(body.dimensionFilter?.orGroup?.expressions?.[0]?.andGroup);
const run = () => ga4Service.getDistinctUsersWithToken(evidence.scope.propertyId, 'recorded-only', evidence.scope.from,
  evidence.scope.through, evidence.scope.filter, evidence.primaryScope, true, evidence.scope.from);

function replay(mode = 'recorded') {
  const calls: any[] = [];
  vi.stubEnv('DATABASE_URL', '');
  vi.stubGlobal('fetch', vi.fn(async (url: string, options: any) => {
    expect(url).toBe(`https://analyticsdata.googleapis.com/v1beta/properties/${evidence.scope.propertyId}:runReport`);
    const body = JSON.parse(options.body); calls.push(body);
    let match = evidence.responses.find(row => key(row.request) === key(body));
    // Substitute the recorded, independently queried window response to model
    // a provider response that does not require recovery.
    if (['rolling-only', 'unsampled'].includes(mode) && match?.data.metadata?.samplingMetadatas && !body.metricAggregations) {
      const native = { ...body, dimensionFilter: body.dimensionFilter.orGroup.expressions[0].andGroup.expressions[0],
        dateRanges: body.dateRanges.map((range: any) => ({ ...range, endDate: range.endDate > evidence.primaryScope.throughDate ? evidence.primaryScope.throughDate : range.endDate })) };
      match = evidence.responses.find(row => key(row.request) === key(native));
    }
    if (!match) throw new Error('Unrecorded request: ' + key(body));
    const data: any = structuredClone(match.data), proof = body.metrics[0].name === 'eventCount';
    if (mode === 'property-retention' && data.metadata.samplingMetadatas) {
      data.metadata.dataTruncationReasons = [{ dataTruncationType: 'DATA_TRUNCATION_TYPE_PROPERTY', dataTruncationDate: '2026-11-01' }];
    }
    if (mode === 'unsampled' && body.metricAggregations && data.metadata.samplingMetadatas) {
      // Synthetic unsampled batch with the same independently verified windows.
      delete data.metadata.samplingMetadatas;
      data.totals = body.dateRanges.map((range: any) => ({ dimensionValues: [{ value: range.name }],
        metricValues: [{ value: String(evidence.result.windows.find(window => window.startDate === range.startDate && window.endDate === range.endDate)!.users) }] }));
      data.dimensionHeaders = [{ name: 'dateRange' }];
    }
    if (proof && mode === 'positive-proof') Object.assign(data, { metricHeaders: [{ name: 'eventCount' }], rows: [{ metricValues: [{ value: '1' }] }], rowCount: 1 });
    if (proof && mode === 'thresholded-proof') data.metadata.subjectToThresholding = true;
    if (mode === 'sampled-recovery' && !mixed(body) && !proof) data.metadata.samplingMetadatas = [{ samplesReadCount: '1', samplingSpaceSize: '2' }];
    if (mode === 'mixed-restriction' && data.metadata.samplingMetadatas) data.metadata.subjectToThresholding = true;
    return new Response(JSON.stringify(data), { status: 200 });
  }));
  return calls;
}

describe('sampling in later exact GA4 comparisons', () => {
  it('recovers the recorded November 19 failure and retains all exact windows and dates', async () => {
    const calls = replay(), result = await run();
    expect(result).toEqual(evidence.result);
    expect(result.total).toBe(9);
    expect(result.campaigns.reduce((sum, row) => sum + row.users, 0)).toBe(10);
    expect(result.sessions).toBe(38);
    expect(calls.filter(body => !body.dimensions && !body.metricAggregations && mixed(body)
      && body.dateRanges[0].startDate === evidence.scope.from && body.dateRanges[0].endDate === evidence.scope.through
      && body.dimensionFilter.orGroup.expressions[0].andGroup.expressions[0].orGroup)).toHaveLength(1);
    expect(result.windows).toHaveLength(43);
    expect(result.daily.at(-1)).toEqual({ date: '2026-11-19', users: 0 });
    const snapshot = { windowStart: evidence.scope.from, windowEnd: evidence.scope.through,
      campaignBreakdown: { meta: { propertyId: evidence.scope.propertyId, distinctUsers: result } } };
    expect(getGA4PeriodTraffic(snapshot, '2026-11-13', '2026-11-19')).toMatchObject({ sessions: 16, engagementRate: 0.625 });
    expect(getGA4PeriodTraffic(snapshot, '2026-11-06', '2026-11-19')).toMatchObject({ sessions: 23 });
    expect(calls.filter(body => body.metrics[0].name === 'eventCount')).toHaveLength(1);
  });
  it('recovers a sampled rolling batch even when the other comparisons succeed', async () => {
    const calls = replay('rolling-only');
    expect(await run()).toEqual(evidence.result);
    expect(calls.filter(body => body.metrics[0].name === 'eventCount')).toHaveLength(1);
  });
  it('retains exact recorded windows when later comparisons also carry property retention', async () => {
    const calls = replay('property-retention');
    expect(await run()).toEqual(evidence.result);
    expect(calls.filter(body => body.metrics[0].name === 'eventCount')).toHaveLength(1);
  });
  it('adds no proof or retry when all original requests are unsampled', async () => {
    const calls = replay('unsampled');
    expect(await run()).toEqual(evidence.result);
    expect(calls.some(body => body.metrics[0].name === 'eventCount')).toBe(false);
  });
  it.each(['positive-proof', 'thresholded-proof', 'sampled-recovery', 'mixed-restriction'])('fails closed for %s', async mode => {
    const calls = replay(mode);
    await expect(run()).rejects.toThrow(/QUALITY_UNAVAILABLE/);
    expect(calls.filter(body => body.metrics[0].name === 'eventCount').length).toBeLessThanOrEqual(1);
  });
});
