import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";
import { MIMOSAAS_BROWSER_TRACKER_SOURCE } from "./mimosaas-browser-tracker";

const trackingId = `mtk_${"a".repeat(32)}`;
const trackingSecret = `mts_${"b".repeat(43)}`;

function createHarness(options: { newlyVerified?: boolean; validCredentials?: boolean; failFirstEvent?: boolean } = {}) {
  const stored = new Map<string, string>();
  const timers: Array<{ callback: () => void; delay: number }> = [];
  const listeners = new Map<string, () => void>();
  let randomCounter = 0;
  let eventAttempts = 0;
  const fetchMock = vi.fn(async (input: string, init: any) => {
    if (input.endsWith("/installations/verify")) {
      return { ok: true, json: async () => ({ success: true, verified: true, newlyVerified: options.newlyVerified ?? false }) };
    }
    eventAttempts += 1;
    if (options.failFirstEvent && eventAttempts === 1) throw new Error("temporary network failure");
    return { ok: true, json: async () => ({ success: true, accepted: true }) };
  });
  const scriptAttributes: Record<string, string> = {
    "data-tracking-id": options.validCredentials === false ? "invalid" : trackingId,
    "data-tracking-secret": trackingSecret,
  };
  const script = {
    src: "https://app.example/api/mimosaas-tracking/tracker.js",
    getAttribute: (name: string) => scriptAttributes[name] || null,
  };
  const windowObject: any = {
    location: { href: "https://shop.example/landing?utm_source=email&utm_medium=newsletter&utm_campaign=autumn_sale&gclid=click-1" },
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
    },
    crypto: { randomUUID: () => `00000000-0000-4000-8000-${String(++randomCounter).padStart(12, "0")}` },
    fetch: fetchMock,
    setTimeout: (callback: () => void, delay: number) => { timers.push({ callback, delay }); return timers.length; },
    clearTimeout: vi.fn(),
  };
  const documentObject: any = {
    currentScript: script,
    referrer: "https://search.example/results",
    visibilityState: "visible",
    getElementsByTagName: () => [script],
    addEventListener: (name: string, callback: () => void) => listeners.set(name, callback),
  };
  const context = {
    window: windowObject,
    document: documentObject,
    URL,
    Uint8Array,
    Date,
    Math,
    JSON,
    Number,
    Error,
  };
  return {
    fetchMock,
    stored,
    timers,
    run: () => runInNewContext(MIMOSAAS_BROWSER_TRACKER_SOURCE, context),
    flush: () => new Promise<void>((resolve) => setImmediate(resolve)),
  };
}

describe("Mimosaas universal browser tracker", () => {
  it("uses the first valid load only for installation proof", async () => {
    const harness = createHarness({ newlyVerified: true });
    harness.run();
    await harness.flush();

    expect(harness.fetchMock).toHaveBeenCalledTimes(1);
    expect(harness.fetchMock.mock.calls[0][0]).toBe("https://app.example/api/mimosaas-tracking/installations/verify");
    expect(JSON.parse(harness.fetchMock.mock.calls[0][1].body)).toEqual({
      trackingId,
      trackingSecret,
      url: "https://shop.example/landing?utm_source=email&utm_medium=newsletter&utm_campaign=autumn_sale&gclid=click-1",
    });
  });

  it("sends bounded non-financial page and visible engagement events after verification", async () => {
    const harness = createHarness({ newlyVerified: false });
    harness.run();
    await harness.flush();

    expect(harness.fetchMock).toHaveBeenCalledTimes(2);
    const pageEvent = JSON.parse(harness.fetchMock.mock.calls[1][1].body);
    expect(pageEvent).toMatchObject({
      trackingId,
      trackingSecret,
      eventName: "page_view",
      url: "https://shop.example/landing?utm_source=email&utm_medium=newsletter&utm_campaign=autumn_sale&gclid=click-1",
      referrer: "https://search.example/results",
      utmSource: "email",
      utmMedium: "newsletter",
      utmCampaign: "autumn_sale",
      gclid: "click-1",
    });
    expect(pageEvent).not.toHaveProperty("revenue");
    expect(pageEvent).not.toHaveProperty("spend");
    expect(pageEvent.anonymousVisitorId).toMatch(/^mv_/);
    expect(pageEvent.sessionId).toMatch(/^ms_/);

    const engagementTimer = harness.timers.find((timer) => timer.delay === 10000);
    expect(engagementTimer).toBeDefined();
    engagementTimer!.callback();
    await harness.flush();
    const engagementEvent = JSON.parse(harness.fetchMock.mock.calls[2][1].body);
    expect(engagementEvent.eventName).toBe("user_engagement");
    expect(engagementEvent.anonymousVisitorId).toBe(pageEvent.anonymousVisitorId);
    expect(engagementEvent.sessionId).toBe(pageEvent.sessionId);
    expect(Array.from(harness.stored.values()).join(" ")).not.toContain(trackingSecret);
  });

  it("retries a failed event once with the same event ID and ignores invalid credentials", async () => {
    const harness = createHarness({ newlyVerified: false, failFirstEvent: true });
    harness.run();
    await harness.flush();
    const retryTimer = harness.timers.find((timer) => timer.delay === 2000);
    expect(retryTimer).toBeDefined();
    const firstEvent = JSON.parse(harness.fetchMock.mock.calls[1][1].body);
    retryTimer!.callback();
    await harness.flush();
    const retryEvent = JSON.parse(harness.fetchMock.mock.calls[2][1].body);
    expect(retryEvent.eventId).toBe(firstEvent.eventId);

    const invalid = createHarness({ validCredentials: false });
    invalid.run();
    await invalid.flush();
    expect(invalid.fetchMock).not.toHaveBeenCalled();
  });
});
