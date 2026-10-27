import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createServer, type Server } from 'node:http';
import ts from 'typescript';
import { GoogleAnalytics4Service } from './analytics';
import { fetchCompleteSalesforceQuery } from './utils/salesforce-pagination';
import { validateHubspotSearchPage } from './utils/hubspot-pagination';

const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const connection = { propertyId: '123', accessToken: 'fixture' };
const nativeFetch = globalThis.fetch;
const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
const storage = { getGA4Connection: vi.fn(async () => connection) };
const diagnostic = (service = new GoogleAnalytics4Service()) => service.getOverviewDimensionDiagnostics(
  'fixture-campaign', storage, '2026-10-20', '123', ['fixture-sale'], '2026-10-20', 'EUR');
const salesforce = (fetchImpl: typeof fetch) => fetchCompleteSalesforceQuery({
  initialUrl: 'https://fixture.my.salesforce.com/services/data/v59.0/query?q=fixture',
  instanceUrl: 'https://fixture.my.salesforce.com', accessToken: 'fixture', fetchImpl,
});

describe('Diagnostic and Salesforce native transport cancellation', () => {
  let server: Server | undefined;
  afterEach(async () => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  });
  for (const phase of ['headers', 'body'] as const) {
    it.each(['diagnostic', 'salesforce', 'salesforce route helper'])(`closes the %s socket during stalled ${phase}`, async path => {
      const controller = new AbortController();
      let closed!: () => void;
      const disconnected = new Promise<void>(resolve => { closed = resolve; });
      server = createServer((_req, res) => {
        res.on('close', closed);
        if (phase === 'body') { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{"records":'); }
        nativeTimeout(30).addEventListener('abort', () => controller.abort(new DOMException('Timed out', 'TimeoutError')), { once: true });
      });
      await new Promise<void>(resolve => server!.listen(0, '127.0.0.1', resolve));
      const address = server.address() as { port: number };
      vi.spyOn(AbortSignal, 'timeout').mockImplementation(() => controller.signal);
      const transport = vi.fn(async (_url, init) => nativeFetch(`http://127.0.0.1:${address.port}/fixture`, init));
      vi.stubGlobal('fetch', transport);
      let request: Promise<unknown>;
      if (path === 'diagnostic') request = diagnostic();
      else if (path === 'salesforce') request = salesforce(transport as typeof fetch);
      else {
        const source = readFileSync('server/routes-oauth.ts', 'utf8');
        const start = source.indexOf('  const fetchWithTimeout =');
        const end = source.indexOf('\n  const readGoogleSheetsRevenueChunks', start);
        const compiled = ts.transpileModule(`${source.slice(start, end)}\nreturn fetchWithTimeout;`, {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
        }).outputText;
        const helper = new Function('fetch', 'EXTERNAL_API_TIMEOUT_MS', compiled)(transport, 30_000);
        request = salesforce(helper);
      }
      await expect(request).rejects.toMatchObject({ name: expect.stringMatching(/^(TimeoutError|AbortError)$/) });
      await disconnected;
      expect(transport).toHaveBeenCalledTimes(1);
    });
  }
});
const waitForAbort = (signal?: AbortSignal | null) => new Promise<never>((_resolve, reject) => {
  if (!signal) { reject(new Error('Missing request cancellation')); return; }
  if (signal.aborted) { reject(signal.reason); return; }
  signal.addEventListener('abort', () => reject(signal.reason), { once: true });
});

describe('Batch 3 diagnostic and Salesforce timeout boundaries', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(AbortSignal, 'timeout').mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException('Timed out', 'TimeoutError')), ms);
      return controller.signal;
    });
    for (const method of ['warn', 'error', 'log'] as const) vi.spyOn(console, method).mockImplementation(() => {});
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  for (const phase of ['headers', 'body'] as const) {
    it(`interrupts a stalled diagnostic ${phase} and starts no further queries`, async () => {
      const transport = vi.fn(async (_url, init) => phase === 'headers'
        ? waitForAbort(init.signal)
        : { ok: true, json: () => waitForAbort(init.signal) });
      vi.stubGlobal('fetch', transport);
      const result = diagnostic().catch(error => error);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await result).toMatchObject({ name: 'TimeoutError' });
      expect(transport).toHaveBeenCalledTimes(1);
    });

    it(`interrupts a stalled Salesforce ${phase} without returning empty or partial records`, async () => {
      const transport = vi.fn(async (_url, init) => phase === 'headers'
        ? waitForAbort(init.signal)
        : { ok: true, json: () => waitForAbort(init.signal) });
      const result = salesforce(transport as typeof fetch).catch(error => error);
      await vi.advanceTimersByTimeAsync(120_000);
      expect(await result).toMatchObject({ name: 'TimeoutError' });
      expect(transport).toHaveBeenCalledTimes(1);
    });
  }

  it('preserves plain-Error diagnostic owner cancellation instead of running later dimensions', async () => {
    const controller = new AbortController();
    const transport = vi.fn(async (_url, init) => waitForAbort(init.signal));
    vi.stubGlobal('fetch', transport);
    const result = diagnostic(new GoogleAnalytics4Service(controller.signal)).catch(error => error);
    await vi.advanceTimersByTimeAsync(1);
    const reason = new Error('GA4_REFRESH_WORK_STOPPED'); controller.abort(reason);
    expect(await result).toBe(reason);
    expect(transport).toHaveBeenCalledTimes(1);
  });

  it('bounds the complete diagnostic sequence, including individually responsive requests', async () => {
    const transport = vi.fn(async (_url, init) => {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 10_000);
        init.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(init.signal.reason); }, { once: true });
      });
      return json({ rows: [], metadata: { currencyCode: 'EUR' } });
    });
    vi.stubGlobal('fetch', transport);
    const result = diagnostic().catch(error => error);
    await vi.advanceTimersByTimeAsync(200_000);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    expect(transport.mock.calls.length).toBeLessThanOrEqual(12);
  });

  it('propagates exhausted diagnostic transient failure; later reads can recover', async () => {
    const transport = vi.fn(async () => json({ error: { code: 503 } }, 503));
    vi.stubGlobal('fetch', transport);
    const result = diagnostic().catch(error => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({ code: 'GA4_TRANSIENT_ERROR' });
    expect(transport).toHaveBeenCalledTimes(3);
    transport.mockImplementation(async () => json({ rows: [], metadata: { currencyCode: 'EUR' } }));
    expect(await diagnostic()).toMatchObject({ pageLocationTraffic: { ok: true, rows: [] } });
  });

  it('retains successful diagnostics, unsupported-dimension and currency-mismatch shapes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ rows: [], metadata: { currencyCode: 'EUR' } })));
    expect(await diagnostic()).toMatchObject({ traffic: { sessionCampaignName: { ok: true, rows: [] } } });
    vi.mocked(fetch).mockImplementation(async () => json({ error: 'unsupported' }, 400));
    expect(await diagnostic()).toMatchObject({ traffic: { sessionCampaignName: { ok: false, status: 400 } } });
    vi.mocked(fetch).mockImplementation(async () => json({ rows: [], metadata: { currencyCode: 'USD' } }));
    expect(await diagnostic()).toMatchObject({ traffic: { sessionCampaignName: { ok: false, status: 'currency-mismatch' } } });
  });

  it('uses one Salesforce query deadline across pages and never returns first-page data after expiry', async () => {
    let call = 0;
    const transport = vi.fn(async (_url, init) => {
      if (++call === 1) {
        await new Promise(resolve => setTimeout(resolve, 110_000));
        return json({ records: [{ Id: 'first' }], totalSize: 2, done: false, nextRecordsUrl: '/next' });
      }
      return waitForAbort(init.signal);
    });
    const result = salesforce(transport as typeof fetch).catch(error => error);
    await vi.advanceTimersByTimeAsync(120_000);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    expect(transport).toHaveBeenCalledTimes(2);
    expect(transport.mock.calls[0][1].signal).toBe(transport.mock.calls[1][1].signal);
  });

  it('does not turn malformed Salesforce success JSON into measured zero', async () => {
    await expect(salesforce(vi.fn(async () => new Response('{invalid', { status: 200 })) as typeof fetch))
      .rejects.toBeInstanceOf(SyntaxError);
  });

  it('does not let the shared deadline turn an interrupted HubSpot body into an empty successful search', async () => {
    const source = readFileSync('server/routes-oauth.ts', 'utf8');
    const start = source.indexOf('  async function hubspotSearchDeals(');
    const end = source.indexOf('\n  // HubSpot unique values', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const compiled = ts.transpileModule(`${source.slice(start, end)}\nreturn hubspotSearchDeals;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const failure = new DOMException('Response body interrupted', 'AbortError');
    const transport = vi.fn(async () => ({ ok: true, json: async () => { throw failure; } }));
    const helper = new Function('fetchWithTimeout', 'validateHubspotSearchPage', compiled)(transport, validateHubspotSearchPage);
    await expect(helper('fixture', {})).rejects.toBe(failure);
    transport.mockResolvedValue(json({ results: [], total: 0 }) as any);
    expect(await helper('fixture', {})).toEqual({ results: [], total: 0 });
    transport.mockResolvedValue(json({ message: 'fixture failure' }, 403) as any);
    await expect(helper('fixture', {})).rejects.toThrow('fixture failure');
  });

  it('keeps route-helper cancellation active through body reads and respects the caller signal', async () => {
    const source = readFileSync('server/routes-oauth.ts', 'utf8');
    const start = source.indexOf('  const fetchWithTimeout =');
    const end = source.indexOf('\n  const readGoogleSheetsRevenueChunks', start);
    expect(start).toBeGreaterThan(0); expect(end).toBeGreaterThan(start);
    const compiled = ts.transpileModule(`${source.slice(start, end)}\nreturn fetchWithTimeout;`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None },
    }).outputText;
    const transport = vi.fn(async (_url, init) => ({ json: () => waitForAbort(init.signal) }));
    const helper = new Function('fetch', 'EXTERNAL_API_TIMEOUT_MS', compiled)(transport, 30_000);
    const first = await helper('https://fixture.invalid', {});
    const body = first.json().catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(await body).toMatchObject({ name: 'TimeoutError' });
    const controller = new AbortController();
    const second = await helper('https://fixture.invalid', { signal: controller.signal });
    const result = second.json().catch((error: Error) => error);
    const reason = new Error('query deadline'); controller.abort(reason);
    expect(await result).toBe(reason);
  });
  it.each([
    ['token', '  async function refreshGoogleSheetsToken(', '    const fetchWithTimeout =', '\n\n    const refreshResponse', 'fetchWithTimeout', 15000],
    ['data', '// Try to fetch spreadsheet data with timeout', '      const fetchWithTimeout =', '\n\n      let rows:', 'fetchWithTimeout', 30000],
    ['retry', '// Try to fetch spreadsheet data with timeout', '      const fetchWithTimeout =', '\n\n      let rows:', 'fetchWithTimeout', 30000],
  ] as const)('keeps nested Sheets %s deadlines through body parsing and preserves caller cancellation', async (_name, anchor, begin, end, name, duration) => {
    const source = readFileSync('server/routes-oauth.ts', 'utf8').replace(/\r\n/g, '\n');
    const start = source.indexOf(begin, source.indexOf(anchor));
    const finish = source.indexOf(end, start);
    expect(start).toBeGreaterThan(0); expect(finish).toBeGreaterThan(start);
    const transport = vi.fn((_url: string, init: RequestInit) => Promise.resolve({ json: () => waitForAbort(init.signal) }));
    let helper = new Function('fetch', ts.transpileModule(`${source.slice(start, finish)}\nreturn ${name};`, {
      compilerOptions: { target: ts.ScriptTarget.ES2022 },
    }).outputText)(transport);
    if (_name === 'retry') {
      const retryStart = source.indexOf('rows = await readCompleteGoogleSheetsData(connection,', finish);
      const retryEnd = source.indexOf('connection.lastDataRefreshAt', retryStart);
      expect(retryStart).toBeGreaterThan(finish); expect(retryEnd).toBeGreaterThan(retryStart);
      const fetchWithTimeout = helper;
      helper = async (url: string, options: RequestInit) => {
        transport.mockResolvedValueOnce({ status: 401 } as any);
        const refresh = vi.fn(async () => 'renewed-fixture');
        const run = new Function('connection', 'accessToken', 'readCompleteGoogleSheetsData', 'refreshGoogleSheetsToken', 'fetchWithTimeout',
          ts.transpileModule(`return (async () => { let rows; ${source.slice(retryStart, retryEnd)} return rows; })();`, {
            compilerOptions: { target: ts.ScriptTarget.ES2022 },
          }).outputText);
        const response = await run({ refreshToken: 'fixture' }, 'expired-fixture',
          (_connection: unknown, fetchPage: Function) => fetchPage(url, options.signal), refresh, fetchWithTimeout);
        expect(refresh).toHaveBeenCalledTimes(1);
        expect(transport.mock.lastCall?.[1].headers).toEqual({ Authorization: 'Bearer renewed-fixture' });
        return response;
      };
    }
    const response = await helper('https://fixture.invalid', {});
    const result = response.json().catch((error: Error) => error);
    await vi.advanceTimersByTimeAsync(duration);
    expect(await result).toMatchObject({ name: 'TimeoutError' });
    const owner = new AbortController();
    const response2 = await helper('https://fixture.invalid', { signal: owner.signal });
    const result2 = response2.json().catch((error: Error) => error);
    owner.abort(new Error('stopped'));
    expect(await result2).toMatchObject({ message: 'stopped' });
  });
});
