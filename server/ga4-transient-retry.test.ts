import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ga4Service } from "./analytics";

const date = "2026-10-17";
const storage = { getGA4Connection: vi.fn(), getCampaign: vi.fn(), updateGA4ConnectionTokens: vi.fn() };
const json = (status = 200, headers: Record<string, string> = {}) => new Response(JSON.stringify(status === 200
  ? { rows: [], rowCount: 0, metadata: { currencyCode: "EUR" } } : { error: { code: status } }), { status, headers });
const daily = () => ga4Service.getTimeSeriesData("a", storage, date, "123", undefined, date, "EUR");
const cases = [
  { name: "daily series", run: daily },
  { name: "landing pages", run: () => ga4Service.getLandingPagesReport("a", storage, date, "123", 50, "sale", date) },
  { name: "conversion events", run: () => ga4Service.getConversionEventsReport("a", storage, date, "123", 50, "sale", date) },
  { name: "acquisition", run: () => ga4Service.getAcquisitionBreakdown("a", storage, date, "123", 50, "sale", date, false, true, "EUR") },
  { name: "presence", run: () => ga4Service.getTrendsDailyPresenceWithToken("123", "test-token", date, date, "sale", "EUR", undefined, []) },
];
beforeEach(() => {
  vi.useFakeTimers(); vi.resetAllMocks();
  storage.getGA4Connection.mockResolvedValue({ id: "connection", campaignId: "a", propertyId: "123", method: "access_token", accessToken: "test-token" });
  storage.getCampaign.mockResolvedValue({ currency: "EUR" });
  vi.spyOn(Math, "random").mockReturnValue(0.5);
  for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => undefined);
});
afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("bounded GA4 report retries", () => {
  it.each([429, 500, 502, 503, 504])("recovers HTTP %s with the identical property, body, token and cancellation signal", async status => {
    const fetchMock = vi.fn().mockResolvedValueOnce(json(status)).mockResolvedValueOnce(json());
    vi.stubGlobal("fetch", fetchMock);
    const pending = daily();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });
  it.each(cases)("stops $name after three failures without widening scope or returning empty success", async test => {
    const fetchMock = vi.fn().mockImplementation(async () => json(503));
    vi.stubGlobal("fetch", fetchMock);
    const pending = test.run().catch(error => error);
    await vi.advanceTimersByTimeAsync(3000);
    expect(await pending).toMatchObject({ code: "GA4_TRANSIENT_ERROR", status: 503 });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]).toEqual(fetchMock.mock.calls[0]);
    expect(fetchMock.mock.calls[2]).toEqual(fetchMock.mock.calls[0]);
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });
  it.each([400, 401, 403, 404, 501])("does not retry HTTP %s as a temporary failure", async status => {
    const fetchMock = vi.fn().mockImplementation(async () => json(status));
    vi.stubGlobal("fetch", fetchMock);
    const error = await daily().catch(error => error);
    expect(error).toBeInstanceOf(Error);
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });
  it.each(["4", new Date(Date.now() + 4000).toUTCString()])("honors Retry-After %s before retrying", async header => {
    if (!/^\d+$/.test(header)) vi.setSystemTime(new Date(header).getTime() - 4000);
    const fetchMock = vi.fn().mockResolvedValueOnce(json(429, { "Retry-After": header })).mockResolvedValueOnce(json());
    vi.stubGlobal("fetch", fetchMock);
    const pending = daily();
    await vi.advanceTimersByTimeAsync(3999); expect(fetchMock).toHaveBeenCalledOnce();
    await vi.advanceTimersByTimeAsync(1); expect(await pending).toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it.each(["60", "invalid"])("stops safely when Retry-After cannot be honored within the bounded retry: %s", async header => {
    const fetchMock = vi.fn().mockResolvedValue(json(429, { "Retry-After": header })); vi.stubGlobal("fetch", fetchMock);
    await expect(daily()).rejects.toMatchObject({ code: "GA4_TRANSIENT_ERROR", status: 429 });
    expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(["ECONNRESET", "ETIMEDOUT", "EAI_AGAIN", "UND_ERR_SOCKET"])("recovers a confirmed %s network interruption", async code => {
    const fetchMock = vi.fn().mockRejectedValueOnce(Object.assign(new TypeError("fetch failed"), { cause: { code } })).mockResolvedValueOnce(json());
    vi.stubGlobal("fetch", fetchMock); const pending = daily();
    await vi.advanceTimersByTimeAsync(1000);
    expect(await pending).toEqual([]); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it("does not retry an unknown exception", async () => {
    const error = new Error("application failure"); const fetchMock = vi.fn().mockRejectedValue(error); vi.stubGlobal("fetch", fetchMock);
    await expect(daily()).rejects.toBe(error); expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not retry cancelled work", async () => {
    const error = new DOMException("Cancelled", "AbortError"); const fetchMock = vi.fn().mockRejectedValue(error); vi.stubGlobal("fetch", fetchMock);
    await expect(daily()).rejects.toBe(error); expect(fetchMock).toHaveBeenCalledOnce();
  });
  it("does not start another request if cancellation happens during backoff", async () => {
    const controller = new AbortController(); vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
    const fetchMock = vi.fn().mockResolvedValue(json(503)); vi.stubGlobal("fetch", fetchMock);
    const pending = daily().catch(error => error);
    await vi.advanceTimersByTimeAsync(500); controller.abort(new DOMException("Cancelled", "AbortError"));
    await vi.advanceTimersByTimeAsync(500);
    expect(await pending).toMatchObject({ name: "AbortError" }); expect(fetchMock).toHaveBeenCalledOnce();
  });
  it.each(["invalid_grant", "server_error", "temporarily_unavailable"])("classifies acquisition OAuth failure correctly: %s", async oauthError => {
    storage.getGA4Connection.mockResolvedValue({ id: "connection", campaignId: "a", propertyId: "123", method: "access_token",
      accessToken: "test-token", refreshToken: "test-refresh", clientId: "test-client", clientSecret: "test-secret" });
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response('{"error":{"code":401,"status":"UNAUTHENTICATED"}}', { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: oauthError }), { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    const error = await cases.find(test => test.name === "acquisition")!.run().catch(error => error);
    expect(error.isAutoRefreshNeeded === true).toBe(oauthError === "invalid_grant");
    if (oauthError !== "invalid_grant") expect(error.code).toBe("GA4_TRANSIENT_ERROR");
    expect(fetchMock).toHaveBeenCalledTimes(2); expect(storage.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });
});
