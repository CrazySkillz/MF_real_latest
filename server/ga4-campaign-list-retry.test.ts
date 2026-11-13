import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';

const row = (name: string, users: number) => ({ dimensionValues: [{ value: name }], metricValues: [{ value: String(users) }] });
const response = (rows: any[] = [], rowCount = rows.length, metadata?: object) => Response.json({ rows, rowCount, ...(metadata ? { metadata } : {}) });
const timeout = () => new DOMException('synthetic timeout', 'TimeoutError');
const wait = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  signal.throwIfAborted();
  const abort = () => { clearTimeout(timer); reject(signal.reason); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, ms);
  signal.addEventListener('abort', abort, { once: true });
});
const start = (service = new GoogleAnalytics4Service(), partial = true, limit = 200) => {
  const result: { value?: any; error?: any } = {};
  const storage = { getGA4Connection: vi.fn(async () => ({ id: 'fixture', propertyId: '123', accessToken: 'private-synthetic-token' })) };
  void service.getCampaignValues('fixture', storage, '30daysAgo', '123', limit, partial).then(value => { result.value = value; }, error => { result.error = error; });
  return result;
};

beforeEach(() => {
  vi.stubEnv('DATABASE_URL', '');
  vi.useFakeTimers();
  vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => { const c = new AbortController(); setTimeout(() => c.abort(timeout()), ms); return c.signal; });
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(async () => { await vi.runAllTimersAsync(); vi.unstubAllGlobals(); vi.unstubAllEnvs(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('onboarding primary campaign-list timeout recovery', () => {
  it('retries a stalled primary request after 30 seconds and returns exact complete names and counts', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); calls.push({ body, signal: init.signal });
      if (calls.length === 1) await wait(300_000, init.signal);
      return body.dimensions[0].name === 'pageLocation' ? response() : response([row('exact_campaign', 19)]);
    }));
    const result = start();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(result.error).toBeUndefined();
    expect(result.value).toEqual({ propertyId: '123', campaigns: [{ name: 'exact_campaign', users: 19 }] });
    expect(calls).toHaveLength(3);
    expect(calls[0].body).toEqual(calls[1].body);
    expect(calls[0].signal.aborted).toBe(true); expect(calls[1].signal.aborted).toBe(false);
    expect(calls[1].body).toMatchObject({ dateRanges: [{ startDate: '30daysAgo', endDate: 'today' }], dimensions: [{ name: 'sessionCampaignName' }], metrics: [{ name: 'totalUsers' }], limit: 200, offset: 0 });
  });
  it('lets the second attempt use the remaining overall budget instead of imposing another 30-second cutoff', async () => {
    let calls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); if (body.dimensions[0].name === 'pageLocation') return response();
      calls++; await wait(calls === 1 ? 300_000 : 60_000, init.signal); return response([row('slow_valid', 7)]);
    }));
    const result = start(); await vi.advanceTimersByTimeAsync(91_000);
    expect(result.value?.campaigns).toEqual([{ name: 'slow_valid', users: 7 }]); expect(calls).toBe(2);
  });
  it('retries the same failed page without duplicating earlier pages', async () => {
    const offsets: number[] = []; let failed = false;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); if (body.dimensions[0].name === 'pageLocation') return response();
      offsets.push(body.offset);
      if (body.offset === 1 && !failed) { failed = true; throw timeout(); }
      return response([row(body.offset ? 'Beta' : 'Alpha', body.offset ? 2 : 3)], 2);
    }));
    const result = start(undefined, true, 1); await vi.advanceTimersByTimeAsync(1_000);
    expect(result.value?.campaigns).toEqual([{ name: 'Alpha', users: 3 }, { name: 'Beta', users: 2 }]);
    expect(offsets).toEqual([0, 1, 1]);
  });
  it('stops within the existing two-minute budget and does not publish an unfinished primary list', async () => {
    const calls: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); calls.push(body);
      if (!body.offset) return response([row('first_page', 10)], 2);
      await wait(300_000, init.signal); return response([row('second_page', 5)], 2);
    }));
    const result = start(undefined, true, 1); await vi.advanceTimersByTimeAsync(120_000);
    expect(result.error?.name).toBe('TimeoutError'); expect(result.value).toBeUndefined();
    expect(calls.map(c => c.offset)).toEqual([0, 1, 1]);
  });
  it('does not retry a caller cancellation', async () => {
    const caller = new AbortController(), fetch = vi.fn(async (_url, init) => { await wait(300_000, init.signal); return response(); });
    vi.stubGlobal('fetch', fetch); const result = start(new GoogleAnalytics4Service(caller.signal));
    await vi.advanceTimersByTimeAsync(5_000); caller.abort(new DOMException('cancelled', 'AbortError')); await vi.advanceTimersByTimeAsync(1_000);
    expect(result.error?.name).toBe('AbortError'); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 'quality', 'incomplete'])('does not retry or suppress %s errors', async mode => {
    const fetch = vi.fn(async () => typeof mode === 'number' ? Response.json({}, { status: mode })
      : mode === 'quality' ? response([], 0, { subjectToThresholding: true }) : response([], 3));
    vi.stubGlobal('fetch', fetch); const result = start(); await vi.advanceTimersByTimeAsync(1_000);
    expect(result.error).toBeDefined(); expect(result.value).toBeUndefined(); expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('leaves strict discovery timing unchanged', async () => {
    let primaryCalls = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (JSON.parse(init.body).dimensions[0].name === 'pageLocation') return response();
      primaryCalls++; await wait(45_000, init.signal); return response([row('strict_campaign', 9)]);
    }));
    const result = start(undefined, false); await vi.advanceTimersByTimeAsync(46_000);
    expect(result.value?.campaigns).toEqual([{ name: 'strict_campaign', users: 9 }]); expect(primaryCalls).toBe(1);
  });
  it('records the failed dimension, page and attempt without credentials, campaign names or provider error text', async () => {
    let n = 0;
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); if (body.dimensions[0].name === 'pageLocation') return response();
      if (++n === 1) throw timeout(); return response([row('private-campaign-name', 4)]);
    }));
    const result = start(); await vi.advanceTimersByTimeAsync(1_000); expect(result.value).toBeDefined();
    const records = [...vi.mocked(console.info).mock.calls, ...vi.mocked(console.warn).mock.calls]
      .filter(call => call[0] === '[GA4 Campaign Discovery]').map(call => JSON.parse(String(call[1])));
    expect(records).toContainEqual(expect.objectContaining({ campaignId: 'fixture', propertyId: '123', dimension: 'sessionCampaignName', offset: 0, attempt: 1, outcome: 'timeout' }));
    expect(records).toContainEqual(expect.objectContaining({ dimension: 'sessionCampaignName', attempt: 2, status: 200 }));
    expect(JSON.stringify(records)).not.toContain('private-synthetic-token'); expect(JSON.stringify(records)).not.toContain('private-campaign-name');
  });
});
