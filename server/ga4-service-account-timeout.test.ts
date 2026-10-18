import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ authorize: vi.fn(), options: [] as any[] }));
vi.mock("google-auth-library", () => ({ JWT: class {
  constructor(private options: any) { mocks.options.push(options); }
  authorize() { return mocks.authorize(this.options); }
  getAccessToken() { return mocks.authorize(this.options); }
} }));
import { getGA4ServiceAccountAccessToken } from "./utils/ga4-service-account";
import { ga4Service } from "./analytics";

describe("GA4 service-account token deadline", () => {
  beforeEach(() => {
    vi.useFakeTimers(); mocks.authorize.mockReset(); mocks.options.length = 0;
    vi.stubEnv("GA4_SERVICE_ACCOUNT_JSON", JSON.stringify({ type: "service_account", client_email: "test@example.invalid", private_key: `test-${Math.random()}` }));
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), ms);
      return controller.signal;
    });
  });
  afterEach(() => { vi.clearAllTimers(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); });
  it("supplies the SDK a cancellable deadline, does not cache a failure, and permits a later successful request", async () => {
    mocks.authorize.mockImplementationOnce((options) => new Promise((_resolve, reject) => {
      options.transporterOptions.signal.addEventListener("abort", () => reject(options.transporterOptions.signal.reason), { once: true });
    })).mockResolvedValueOnce({ access_token: "new-token", expiry_date: Date.now() + 3_600_000 });
    let settled = false;
    const pending = getGA4ServiceAccountAccessToken().catch(error => error).finally(() => { settled = true; });
    expect(mocks.options[0].transporterOptions).toMatchObject({ timeout: 120_000, signal: expect.any(AbortSignal) });
    await vi.advanceTimersByTimeAsync(119999); expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(await pending).toMatchObject({ name: "TimeoutError" });
    expect(await getGA4ServiceAccountAccessToken()).toMatchObject({ accessToken: "new-token" });
    expect(await getGA4ServiceAccountAccessToken()).toMatchObject({ accessToken: "new-token" });
    expect(mocks.authorize).toHaveBeenCalledTimes(2);
  });
  it.each(["temporary", "cancelled"])("preserves %s failure in legacy acquisition token setup", async state => {
    const failure = state === "temporary" ? Object.assign(new Error("Service unavailable"), { response: { status: 503 } })
      : Object.assign(new Error("Cancelled"), { code: "ERR_CANCELED" });
    mocks.authorize.mockRejectedValue(failure);
    const storage = { getGA4Connection: vi.fn().mockResolvedValue({ method: "service_account", propertyId: "123",
      serviceAccountKey: JSON.stringify({ client_email: "test@example.invalid", private_key: "test" }) }) };
    const error = await ga4Service.getAcquisitionBreakdown("a", storage, "2026-10-17", "123", 50, "sale", "2026-10-17", false, false, "EUR").catch(error => error);
    expect(error.code).toBe(state === "temporary" ? "GA4_TRANSIENT_ERROR" : "ERR_CANCELED");
    expect(error.isTokenExpired).not.toBe(true);
    expect(mocks.options[0].transporterOptions).toMatchObject({ timeout: 120_000, signal: expect.any(AbortSignal) });
  });
});
