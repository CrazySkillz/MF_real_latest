import { afterEach, describe, expect, it, vi } from 'vitest';
import { ga4Service } from './analytics';
import { getGA4DistinctUsers, getGA4PeriodTraffic } from '../shared/ga4-traffic-window';

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const from = '2025-11-20', end = '2026-11-23', through = '2026-11-20';
const campaigns = ['coffee_bags', 'served_here'];
// Restriction and scope reported by the live read-only diagnostic on November 23.
// Successful response values below are synthetic, deliberately non-additive users.
const restriction = { dataTruncationType: 'DATA_TRUNCATION_TYPE_PROPERTY', dataTruncationDate: '2026-09-23' };
const mixed = (body: any) => Boolean(body.dimensionFilter?.orGroup?.expressions?.[0]?.andGroup);
const run = (startDate = from) => ga4Service.getDistinctUsersWithToken('425831989', 'fixture-only', startDate, end,
  campaigns, { propertyId: '425831989', startDate, endDate: end, campaigns, throughDate: through }, true, startDate);

function replay(mode = 'combined') {
  const calls: any[] = [];
  vi.stubEnv('DATABASE_URL', '');
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: any) => {
    const body = JSON.parse(options.body); calls.push(body);
    const proof = body.metrics[0].name === 'eventCount';
    const metadata: any = {};
    const limited = () => {
      metadata.dataTruncationReasons = [{ ...restriction }];
      if (mode !== 'truncated-only') metadata.samplingMetadatas = [{ samplesReadCount: '1', samplingSpaceSize: '2' }];
    };
    if (mixed(body) && mode !== 'unrestricted') {
      limited();
      if (mode === 'thresholded') metadata.subjectToThresholding = true;
      if (mode === 'unknown-type') metadata.dataTruncationReasons[0].dataTruncationType = 'DATA_TRUNCATION_TYPE_UNKNOWN';
      if (mode === 'invalid-date') metadata.dataTruncationReasons[0].dataTruncationDate = '2026-02-30';
      if (mode === 'unavailable-tail') metadata.dataTruncationReasons[0].dataTruncationDate = '2026-11-22';
      if (mode === 'missing-boundary') delete metadata.dataTruncationReasons[0].dataTruncationDate;
      return new Response(JSON.stringify({ metadata, rows: [{ metricValues: [{ value: '999' }] }], rowCount: 1 }));
    }
    if (proof) {
      if (mode === 'restricted-proof') limited();
      return new Response(JSON.stringify({ metadata, metricHeaders: [{ name: 'eventCount' }],
        rows: [{ metricValues: [{ value: mode === 'positive-tail' ? '1' : '0' }] }], rowCount: 1 }));
    }
    if (mode === 'restricted-recovery') limited();
    const dates = ['2026-08-13', through];
    const selected = (range: any) => dates.filter(date => date >= range.startDate && date <= range.endDate);
    const value = (name: string, range: any) => {
      const count = selected(range).length;
      return name === 'totalUsers' ? Number(count > 0) : name === 'sessions' ? count * 5
        : name === 'engagedSessions' ? count * 3 : name === 'engagementRate' ? (count ? 0.6 : 0) : count ? 0.2 : 0;
    };
    const metricValues = (range: any) => body.metrics.map((metric: any) => ({ value: String(value(metric.name, range)) }));
    const range = body.dateRanges[0];
    const rows = body.dimensions?.some((d: any) => d.name === 'date')
      ? selected(range).map(date => ({ dimensionValues: [{ value: date.replaceAll('-', '') }], metricValues: [{ value: '1' }] }))
      : [{ metricValues: metricValues(range) }];
    return new Response(JSON.stringify({ metadata, metricHeaders: body.metrics, rowCount: rows.length, rows,
      ...(body.metricAggregations ? { dimensionHeaders: [{ name: 'dateRange' }],
        totals: body.dateRanges.map((r: any) => ({ dimensionValues: [{ value: r.name }], metricValues: metricValues(r) })) } : {}) }));
  }));
  return calls;
}

describe('property retention on mixed GA4 annual history queries', () => {
  it.each(['combined', 'truncated-only'])('discards %s results and preserves older native history after exact zero-tail proof', async mode => {
    const calls = replay(mode), result = await run();
    expect(result.total).toBe(1);
    expect(result.sessions).toBe(10);
    expect(result.engagementRate).toBe(0.6);
    expect(result.sessionKeyEventRate).toBe(0.2);
    expect(result.daily.filter(row => row.users > 0)).toEqual([{ date: '2026-08-13', users: 1 }, { date: through, users: 1 }]);
    expect(result.daily[0].date).toBe(from);
    expect(result.daily.at(-1)).toEqual({ date: end, users: 0 });
    expect(result.startDate).toBe(from); expect(result.endDate).toBe(end);
    const proofs = calls.filter(body => body.metrics[0].name === 'eventCount');
    expect(proofs).toHaveLength(1);
    expect(proofs[0].dateRanges).toEqual([{ startDate: '2026-11-21', endDate: end }]);
    expect(JSON.stringify(proofs[0].dimensionFilter)).toContain('pageLocation');
    expect(JSON.stringify(proofs[0].dimensionFilter)).toContain('coffee_bags');
    expect(JSON.stringify(proofs[0].dimensionFilter)).toContain('served_here');
    expect(calls.some(body => !mixed(body) && body.metrics[0].name === 'totalUsers' && !body.dimensions
      && body.dateRanges[0].startDate === from && body.dateRanges[0].endDate === through)).toBe(true);
    const snapshot = { windowStart: from, windowEnd: end, campaignBreakdown: { meta: { propertyId: '425831989', distinctUsers: result } } };
    expect(getGA4DistinctUsers(snapshot, from, end)).toBe(1);
    expect(getGA4PeriodTraffic(snapshot, from, end)).toMatchObject({ sessions: 10, engagementRate: 0.6, conversionRate: 20 });
    expect(result.windows.find(row => row.startDate === '2026-08-07' && row.endDate === '2026-08-13')?.users).toBe(1);
  });
  it.each(['positive-tail', 'restricted-proof', 'restricted-recovery'])('still refuses %s', async mode => {
    replay(mode); await expect(run()).rejects.toThrow('GA4_DATA_QUALITY_UNAVAILABLE');
  });
  it.each(['thresholded', 'unknown-type', 'invalid-date', 'unavailable-tail', 'missing-boundary'])('does not attempt recovery for %s', async mode => {
    const calls = replay(mode); await expect(run()).rejects.toThrow('GA4_DATA_QUALITY_UNAVAILABLE');
    expect(calls.some(body => body.metrics[0].name === 'eventCount')).toBe(false);
  });
  it.each([from, '2026-10-25'])('leaves unrestricted long/30-day results and request behavior unchanged: %s', async start => {
    const calls = replay('unrestricted'), result = await run(start);
    expect(result.total).toBe(1); expect(result.sessions).toBe(start === from ? 10 : 5);
    expect(result.startDate).toBe(start); expect(result.endDate).toBe(end);
    expect(calls.some(body => body.metrics[0].name === 'eventCount')).toBe(false);
  });
});
