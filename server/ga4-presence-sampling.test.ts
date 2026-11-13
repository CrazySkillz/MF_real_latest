import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';

const sampled = { samplingMetadatas: [{ samplesReadCount: '10', samplingSpaceSize: '100' }] };
const report = (dates: string[] = [], metadata: any = {}, rowCount = dates.length) => new Response(JSON.stringify({
  metadata: { currencyCode: 'EUR', ...metadata }, rowCount,
  rows: dates.map(date => ({ dimensionValues: [{ value: date.replace(/-/g, '') }], metricValues: [{ value: '99999' }] })),
}));
const from = '2026-10-14', to = '2026-11-13';
const dailyRows = [{ date: from, sessions: 2, users: 1, conversions: 0.5, revenue: 12.34 }];
const run = (service = new GoogleAnalytics4Service(), start = from, end = to) => service.getTrendsDailyPresenceWithToken(
  '123', 'synthetic-token', start, end, ['coffee', 'sale'], 'EUR', undefined, dailyRows,
);

describe('unsampled GA4 daily-presence recovery', () => {
  beforeEach(() => {
    vi.stubEnv('DATABASE_URL', '');
    for (const method of ['log', 'warn', 'error'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.useRealTimers(); });

  it('recovers the second presence query, preserving scope, dates and daily figures exactly', async () => {
    const queries: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (url, init) => {
      expect(String(url)).toBe('https://analyticsdata.googleapis.com/v1beta/properties/123:runReport');
      const body = JSON.parse(String(init.body)); queries.push(body);
      if (queries.length === 1) return report([from]);
      if (queries.length === 2) return report(['2026-10-15'], sampled);
      return report([body.dateRanges[0].startDate, body.dateRanges[0].endDate]);
    }));
    const original = structuredClone(dailyRows);
    const result = await run();
    expect(result.dailyRows).toBe(dailyRows); expect(result.dailyRows).toEqual(original);
    expect(result.presentDates).toEqual([from, '2026-10-29', '2026-10-30', to]);
    expect(result.presentDates).not.toContain('2026-10-15'); // Sampled dates are discarded too.
    expect(queries).toHaveLength(4);
    expect(queries[1].metrics).toEqual([{ name: 'conversions' }, { name: 'totalRevenue' }]);
    expect(queries[1].dimensionFilter.orGroup.expressions.map((x: any) => x.filter.stringFilter.value)).toEqual(['coffee', 'sale']);
    for (const query of queries.slice(2)) expect({ ...query, dateRanges: queries[1].dateRanges }).toEqual(queries[1]);
    expect(queries.slice(2).map(q => q.dateRanges[0])).toEqual([
      { startDate: from, endDate: '2026-10-29' }, { startDate: '2026-10-30', endDate: to },
    ]);
  });

  it('can subdivide to complete unsampled individual days without duplicates or gaps', async () => {
    const leaves: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body)), range = body.dateRanges[0];
      if (body.metrics[0].name === 'sessions') return report();
      if (range.startDate !== range.endDate) return report([], sampled);
      leaves.push(range.startDate); return report([range.startDate]);
    }));
    const result = await run();
    expect(leaves).toHaveLength(31); expect(new Set(leaves).size).toBe(31);
    expect(leaves[0]).toBe(from); expect(leaves.at(-1)).toBe(to);
    expect(result.presentDates).toEqual(leaves); expect(fetch).toHaveBeenCalledTimes(62);
    expect(result.dailyRows).toBe(dailyRows);
  });

  it('also recovers sampled traffic presence without using its user counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(String(init.body)), r = body.dateRanges[0];
      return body.metrics[0].name === 'sessions' && r.startDate !== r.endDate
        ? report([], sampled) : report([r.startDate]);
    }));
    const result = await run(undefined, from, '2026-10-15');
    expect(result.presentDates).toEqual([from, '2026-10-15']); expect(result.dailyRows).toBe(dailyRows);
  });

  it('keeps unflagged zero responses and the normal two-request path unchanged', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => report()));
    expect(await run()).toEqual({ dailyRows, presentDates: [from] }); expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('rejects sampling on a single day instead of publishing partial data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => report([], sampled)));
    await expect(run()).rejects.toMatchObject({ code: 'GA4_DATA_QUALITY_UNAVAILABLE', reasons: ['sampling'] });
    expect(fetch).toHaveBeenCalledTimes(6);
  });

  it.each([
    { subjectToThresholding: true }, { dataLossFromOtherRow: true },
    { dataTruncationReasons: [{ dataTruncationType: 'DATA_TRUNCATION_TYPE_DATE_RANGE' }] },
    { schemaRestrictionResponse: { activeMetricRestrictions: [{ metricName: 'totalRevenue' }] } },
    { emptyReason: 'NO_ACCESS' }, { ...sampled, subjectToThresholding: true },
  ])('does not split or bypass other quality restrictions: %j', async metadata => {
    vi.stubGlobal('fetch', vi.fn(async () => report([], metadata)));
    await expect(run()).rejects.toMatchObject({ code: 'GA4_DATA_QUALITY_UNAVAILABLE' });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it.each(['currency', 'pagination', 'date', 'provider', 'quality'])(
    'fails the whole check if a later unsampled chunk has a %s problem', async kind => {
      let call = 0;
      vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
        const range = JSON.parse(String(init.body)).dateRanges[0];
        if (++call === 1) return report([], sampled);
        if (call === 2) return report([range.startDate]);
        if (kind === 'currency') return report([], { currencyCode: 'USD' });
        if (kind === 'pagination') return report([], {}, 2);
        if (kind === 'date') return report([from]);
        if (kind === 'quality') return report([], { subjectToThresholding: true });
        return new Response('denied', { status: 403 });
      }));
      await expect(run()).rejects.toThrow(); expect(fetch).toHaveBeenCalledTimes(3);
    },
  );

  it('caps requests rather than silently dropping remaining dates', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const range = JSON.parse(String(init.body)).dateRanges[0];
      return range.startDate === range.endDate ? report() : report([], sampled);
    }));
    await expect(run(undefined, '2026-01-01', to)).rejects.toThrow('presence_request_limit');
    expect(fetch).toHaveBeenCalledTimes(64);
  });

  it('stops subdivision when the owning refresh is cancelled', async () => {
    const owner = new AbortController(); let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (++call === 2) owner.abort(new Error('owner-stopped'));
      return call === 1 ? report([], sampled) : report();
    }));
    await expect(run(new GoogleAnalytics4Service(owner.signal))).rejects.toThrow('owner-stopped');
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('keeps the original 120-second deadline across subdivisions', async () => {
    let now = 0; const started: number[] = [];
    // Model a shared deadline without real timers or any external calls.
    const deadline = new AbortController();
    const service = new GoogleAnalytics4Service();
    vi.spyOn(service as any, 'requestAbortSignal').mockImplementation(() => { started.push(now); return deadline.signal; });
    let call = 0;
    vi.stubGlobal('fetch', vi.fn(async () => {
      if (++call === 1) { now = 110000; return report([], sampled); }
      now = 120000; deadline.abort(new DOMException('deadline', 'TimeoutError')); return report();
    }));
    await expect(run(service)).rejects.toMatchObject({ name: 'TimeoutError' });
    expect(started).toEqual([0]); expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('still rejects sampled totals and distinct users without partitioning them', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => report([], sampled)));
    const service = new GoogleAnalytics4Service();
    await expect(service.getTotalsWithRevenue('123', 'synthetic-token', from, to, ['coffee'], 'EUR')).rejects.toMatchObject({ reasons: ['sampling'] });
    await expect(service.getDistinctUsersWithToken('123', 'synthetic-token', from, to, ['coffee'],
      { propertyId: '123', startDate: from, endDate: to, campaigns: ['coffee'], throughDate: to })).rejects.toMatchObject({ reasons: ['sampling'] });
    expect(fetch).toHaveBeenCalledTimes(3); // totals once; aggregate + daily users in parallel
  });
});
