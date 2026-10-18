import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createServer, type Server } from "node:http";
import { ga4Service } from "./analytics";

const nativeFetch = globalThis.fetch;
const nativeTimeout = AbortSignal.timeout.bind(AbortSignal);
const date = "2026-10-16";
const connection = { id: "connection-a", campaignId: "campaign-a", propertyId: "123", accessToken: "test-token", refreshToken: "test-refresh", clientId: "test-client", clientSecret: "test-secret", method: "access_token" };
const storage = { getGA4Connection: vi.fn(), getCampaign: vi.fn(), updateGA4ConnectionTokens: vi.fn() };
const daily = () => ga4Service.getTimeSeriesData("campaign-a", storage, date, "123", "sale", date, "EUR");
const acquisition = (insights = false) => ga4Service.getAcquisitionBreakdown("campaign-a", storage, date, "123", 50, "sale", date, false, insights, "EUR");
const json = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const empty = () => json({ rows: [], rowCount: 0, metadata: { currencyCode: "EUR" } });
const requestCases = [
  { name: "daily series", run: daily, target: () => true },
  { name: "daily conversion supplement", run: daily, target: (body: any) => body.metrics.length === 2,
    prior: () => json({ rows: [{ dimensionValues: [{ value: "20261016" }], metricValues: ["100", "120", "0", "80", "0", "50", "0.5"].map(value => ({ value })) }], metadata: { currencyCode: "EUR" } }) },
  { name: "daily presence", run: () => ga4Service.getTrendsDailyPresenceWithToken("123", "test-token", date, date, "sale", "EUR", undefined, []), target: () => true },
  { name: "landing pages", run: () => ga4Service.getLandingPagesReport("campaign-a", storage, date, "123", 50, "sale", date), target: () => true },
  { name: "conversion events", run: () => ga4Service.getConversionEventsReport("campaign-a", storage, date, "123", 50, "sale", date), target: () => true },
  { name: "conversion daily reconciliation", run: () => ga4Service.getConversionEventsReport("campaign-a", storage, date, "123", 50, "sale", date, false, { [date]: 1 }), target: (body: any) => body.dimensions.length === 2 },
  { name: "acquisition", run: () => acquisition(), target: () => true },
  { name: "acquisition pagination", run: () => acquisition(), target: (body: any) => body.offset === 1,
    prior: () => json({ rows: [{ dimensionValues: [{ value: "20261016" }], metricValues: [] }], rowCount: 2, metadata: { currencyCode: "EUR" } }) },
  { name: "acquisition OAuth retry", run: () => acquisition(), target: (_body: any, call: number) => call === 3,
    prior: (_body: any, call: number) => call === 1 ? json({ error: { code: 401, status: "UNAUTHENTICATED" } }, 401) : json({ access_token: "renewed-token", expires_in: 3600 }) },
  { name: "acquisition optional landing coverage", run: () => acquisition(true), target: (body: any) => body.dimensions.some((d: any) => d.name === "pageLocation") },
  { name: "acquisition empty URL fallback", run: () => acquisition(), target: (body: any) => body.dimensions.some((d: any) => d.name === "pageLocation") },
  { name: "OAuth renewal", run: () => ga4Service.refreshAccessToken("test-refresh", "test-client", "test-secret"), target: () => true },
  { name: "OAuth credential fallback", run: () => ga4Service.refreshAccessToken("test-refresh"), target: () => true },
];

describe("GA4 native request cancellation", () => {
  beforeEach(() => {
    vi.useFakeTimers(); vi.resetAllMocks();
    vi.stubEnv("GOOGLE_CLIENT_ID", ""); vi.stubEnv("GOOGLE_CLIENT_SECRET", "");
    storage.getGA4Connection.mockResolvedValue(connection);
    storage.getCampaign.mockResolvedValue({ id: "campaign-a", currency: "EUR" });
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => undefined);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      expect(ms).toBe(120000);
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")), ms);
      return controller.signal;
    });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

  for (const phase of ["headers", "JSON body", "error body"] as const) {
    it.each(requestCases)(`cancels $name while waiting for ${phase} without changing it to empty data or an auth failure`, async test => {
      let calls = 0, cancelled = 0, targetSignal: AbortSignal | undefined;
      const wait = (signal: AbortSignal) => new Promise<never>((_resolve, reject) => {
        signal.addEventListener("abort", () => { cancelled++; reject(phase === "headers" ? signal.reason : new DOMException("The operation was aborted", "AbortError")); }, { once: true });
      });
      vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
        calls++;
        if (!test.target(body, calls)) return "prior" in test ? test.prior!(body, calls) : empty();
        if (!init.signal) throw new Error("Missing request cancellation signal");
        targetSignal = init.signal;
        if (phase === "headers") return wait(init.signal);
        return { ok: phase !== "error body", json: () => wait(init.signal), text: () => wait(init.signal) };
      }));
      let settled = false;
      const result = test.run().then(value => ({ value, error: undefined }), error => ({ error, value: undefined })).finally(() => { settled = true; });
      await vi.advanceTimersByTimeAsync(119999);
      expect(targetSignal).toBeInstanceOf(AbortSignal);
      expect(settled).toBe(false);
      await vi.advanceTimersByTimeAsync(1);
      const { error, value } = await result;
      expect(value).toBeUndefined();
      expect(error?.name).toBe(phase === "headers" ? "TimeoutError" : "AbortError");
      expect(error?.isAutoRefreshNeeded).not.toBe(true);
      expect(error?.isTokenExpired).not.toBe(true);
      expect(cancelled).toBe(1);
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(calls);
      expect(storage.updateGA4ConnectionTokens).toHaveBeenCalledTimes(test.name === "acquisition OAuth retry" ? 1 : 0);
      if (test.name === "acquisition OAuth retry") expect(storage.updateGA4ConnectionTokens).toHaveBeenCalledWith("connection-a", expect.objectContaining({ accessToken: "renewed-token" }));
    });
  }

  it("does not attempt token renewal for a timed-out daily report and succeeds on the next attempt", async () => {
    const signals: AbortSignal[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      if (!init.signal) throw new Error("Missing request cancellation signal");
      signals.push(init.signal);
      if (signals.length === 1) return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
      return empty();
    }));
    const result = daily().catch(error => error);
    await vi.advanceTimersByTimeAsync(120000);
    expect((await result).name).toBe("TimeoutError");
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
    expect(await ga4Service.getTimeSeriesWithToken("123", "test-token", date, undefined, date, "EUR")).toEqual([]);
    expect(signals[1]).not.toBe(signals[0]);
    expect(signals[1].aborted).toBe(false);
  });
  it.each(requestCases.filter(test => !["OAuth renewal", "OAuth credential fallback"].includes(test.name)))
    ("propagates exhausted transient failure in $name without accepting partial or empty data", async test => {
      let calls = 0, failing = false, failures = 0;
      vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
        const body = typeof init.body === "string" ? JSON.parse(init.body) : {};
        calls++;
        if (!failing && !test.target(body, calls)) return "prior" in test ? test.prior!(body, calls) : empty();
        failing = true; failures++;
        return json({ error: { code: 503 } }, 503);
      }));
      const pending = test.run().catch(error => error);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(await pending).toMatchObject({ code: "GA4_TRANSIENT_ERROR", status: 503 });
      expect(failures).toBe(3);
      expect(storage.updateGA4ConnectionTokens).toHaveBeenCalledTimes(test.name === "acquisition OAuth retry" ? 1 : 0);
    });

  it.each(["success", "invalid_grant", "server_error"])("preserves confirmed-auth renewal behavior: %s", async outcome => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(json({ error: { code: 401, status: "UNAUTHENTICATED" } }, 401))
      .mockResolvedValueOnce(outcome === "success" ? json({ access_token: "renewed-token", expires_in: 3600 }) : json({ error: outcome }, 400))
      .mockImplementation(async () => empty()));
    const result = ga4Service.getTimeSeriesData("campaign-a", storage, date, "123", undefined, date, "EUR");
    if (outcome === "success") {
      expect(await result).toEqual([]);
      expect(storage.updateGA4ConnectionTokens).toHaveBeenCalledExactlyOnceWith("connection-a", expect.objectContaining({ accessToken: "renewed-token" }));
      expect(vi.mocked(fetch).mock.calls[2][1]?.headers).toMatchObject({ Authorization: "Bearer renewed-token" });
    } else {
      const error = await result.catch(error => error);
      expect(error.isAutoRefreshNeeded === true).toBe(outcome === "invalid_grant");
      expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
      expect(fetch).toHaveBeenCalledTimes(2);
    }
    for (const [, init] of vi.mocked(fetch).mock.calls) expect(init?.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("GA4 cancellation with native fetch and a local HTTP server", () => {
  let server: Server | undefined;
  afterEach(async () => {
    vi.restoreAllMocks(); vi.unstubAllGlobals();
    server?.closeAllConnections();
    if (server?.listening) await new Promise<void>(resolve => server!.close(() => resolve()));
    server = undefined;
  });
  it.each(["headers", "body"])("actually closes a stalled %s request", async phase => {
    let closed!: () => void;
    const disconnected = new Promise<void>(resolve => { closed = resolve; });
    const controller = new AbortController();
    let readingBody = false;
    const expire = () => nativeTimeout(30).addEventListener("abort", () => controller.abort(new DOMException("Request timed out", "TimeoutError")), { once: true });
    server = createServer((_req, res) => {
      res.on("close", closed);
      if (phase === "body") { res.writeHead(200, { "Content-Type": "application/json" }); res.write('{"rows":'); }
      if (phase === "headers") expire();
    });
    await new Promise<void>(resolve => server!.listen(0, "127.0.0.1", resolve));
    const address = server.address() as { port: number };
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => { expect(ms).toBe(120000); return controller.signal; });
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      expect(init.signal).toBe(controller.signal);
      const response = await nativeFetch(`http://127.0.0.1:${address.port}/report`, init);
      if (phase === "body") {
        const read = response.json.bind(response);
        response.json = () => { readingBody = true; expire(); return read(); };
      }
      return response;
    }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(ga4Service.getTimeSeriesWithToken("123", "test-token", date, undefined, date, "EUR"))
      .rejects.toMatchObject({ name: expect.stringMatching(/^(TimeoutError|AbortError)$/) });
    await disconnected;
    expect(controller.signal.aborted).toBe(true);
    expect(readingBody).toBe(phase === "body");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
