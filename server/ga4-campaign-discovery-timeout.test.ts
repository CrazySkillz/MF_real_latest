import { afterEach, describe, expect, it, vi } from 'vitest';
import { GoogleAnalytics4Service } from './analytics';

const row = (name: string, users = 25) => ({ dimensionValues: [{ value: name }], metricValues: [{ value: String(users) }] });
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { 'retry-after': '60' } });
const storage = () => ({ getGA4Connection: vi.fn(async () => ({ id: 'fixture', propertyId: '123', accessToken: 'synthetic' })) });
const timeout = () => new DOMException('The operation was aborted due to timeout', 'TimeoutError');
const discover = (service = new GoogleAnalytics4Service(), partial = true, limit = 200) => service.getCampaignValues('fixture', storage(), '30daysAgo', '123', limit, partial);
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });

describe('onboarding campaign discovery timeout recovery', () => {
  it('returns complete primary results after ten seconds of a stalled supplemental scan', async () => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController(); setTimeout(() => controller.abort(timeout()), ms); return controller.signal;
    });
    const requests: any[] = [];
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body); requests.push(body);
      if (body.dimensions[0].name === 'sessionCampaignName') return json({ rows: [row('selected')], rowCount: 1 });
      return new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true }));
    }));
    let settled = false;
    const result = discover().then(value => { settled = true; return value; });
    await vi.advanceTimersByTimeAsync(9_999); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await result).toEqual({ propertyId: '123', campaigns: [{ name: 'selected', users: 25 }], discoveryComplete: false });
    expect(requests.map(body => body.dimensions[0].name)).toEqual(['sessionCampaignName', 'pageLocation']);
    expect(requests.every(body => body.dateRanges[0].startDate === '30daysAgo' && body.dateRanges[0].endDate === 'today')).toBe(true);
  });
  it('retains complete primary results when the shared deadline expires during the URL scan', async () => {
    const deadline = new AbortController(), service = new GoogleAnalytics4Service();
    vi.spyOn(service as any, 'requestAbortSignal').mockReturnValue(deadline.signal);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      if (JSON.parse(init.body).dimensions[0].name !== 'pageLocation') return json({ rows: [row('primary')], rowCount: 1 });
      deadline.abort(timeout()); init.signal.throwIfAborted(); return json({});
    }));
    expect((await discover(service)).discoveryComplete).toBe(false);
  });
  it.each([429, 502, 503])('retains complete primary results on supplemental HTTP %s', async status => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => JSON.parse(init.body).dimensions[0].name === 'pageLocation'
      ? json({}, status) : json({ rows: [row('primary')], rowCount: 1 })));
    expect(await discover()).toMatchObject({ campaigns: [{ name: 'primary', users: 25 }], discoveryComplete: false });
  });
  it.each(['strict', 'primary-timeout', 'primary-second-page', 'empty-primary', 'caller-cancelled', 'unauthorized', 'forbidden', 'invalid-url-page', 'quality'])('does not hide %s failures', async mode => {
    const cancel = new AbortController(), service = new GoogleAnalytics4Service(mode === 'caller-cancelled' ? cancel.signal : undefined);
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body), isUrl = body.dimensions[0].name === 'pageLocation';
      if (!isUrl) {
        if (mode === 'primary-timeout' || (mode === 'primary-second-page' && body.offset > 0)) throw timeout();
        if (mode === 'empty-primary') return json({ rows: [], rowCount: 0 });
        return json({ rows: [row('primary')], rowCount: mode === 'primary-second-page' ? 2 : 1 });
      }
      if (mode === 'caller-cancelled') { cancel.abort(timeout()); init.signal.throwIfAborted(); }
      if (mode === 'unauthorized' || mode === 'forbidden') return json({}, mode === 'unauthorized' ? 401 : 403);
      if (mode === 'invalid-url-page') return json({ rows: [], rowCount: 2 });
      if (mode === 'quality') return json({ rows: [], rowCount: 0, metadata: { subjectToThresholding: true } });
      throw timeout();
    }));
    await expect(discover(service, mode !== 'strict', 1)).rejects.toThrow();
  });
  it('discards unfinished supplemental pages rather than publishing their partial counts', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const body = JSON.parse(init.body);
      if (body.dimensions[0].name !== 'pageLocation') return json({ rows: [row('primary')], rowCount: 1 });
      if (!body.offset) return json({ rows: [row('https://fixture.invalid/?utm_campaign=incomplete', 3)], rowCount: 2 });
      throw timeout();
    }));
    expect(await discover(undefined, true, 1)).toEqual({ propertyId: '123', campaigns: [{ name: 'primary', users: 25 }], discoveryComplete: false });
  });
  it('keeps URL-only discovery working when no dimension provides campaign names', async () => {
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => json({ rows: [row(JSON.parse(init.body).dimensions[0].name === 'pageLocation'
      ? 'https://fixture.invalid/?utm_campaign=url_only' : '(not set)')], rowCount: 1 })));
    expect(await discover()).toEqual({ propertyId: '123', campaigns: [{ name: 'url_only', users: 25 }] });
  });
  it('preserves successful supplemental merging and reports an actual empty result unchanged', async () => {
    const fetch = vi.fn(async (_url, init) => json({ rows: [row(JSON.parse(init.body).dimensions[0].name === 'pageLocation'
      ? 'https://fixture.invalid/?utm_campaign=supplemental' : 'primary')], rowCount: 1 }));
    vi.stubGlobal('fetch', fetch);
    expect(await discover()).toEqual({ propertyId: '123', campaigns: [{ name: 'primary', users: 25 }, { name: 'supplemental', users: 25 }] });
    fetch.mockImplementation(async () => json({ rows: [], rowCount: 0 }));
    expect(await discover()).toEqual({ propertyId: '123', campaigns: [] });
  });
});
