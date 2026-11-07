import { describe, expect, it, vi } from "vitest";
import { assessHostedHealth, checkHostedHealth } from "../scripts/check-hosted-health";

const commit = "5ed8e816adfed6e7174c9687a0c9e18df01bb34d";
const config = { baseUrl: "https://marketforensics-test.onrender.com", expectedCommit: commit, graceMinutes: 20,
  campaigns: [{ campaignIdHash: "2e353d874c51", reportingTimeZone: "Europe/Amsterdam" }] };
function fixture(at = "2026-11-05T11:30:00Z", completedAt = "2026-11-05T07:00:24Z", reportingDate = "2026-11-04") {
  const now = new Date(at);
  return { now, health: { ok: true, commit, nodeEnv: "production", ts: now.toISOString() }, scheduler: {
    status: "healthy", timestamp: now.toISOString(), ga4DailyScheduler: {
      started: true, timerScheduled: true, inProgress: false, nextRunAt: "2026-11-05T13:00:00Z",
      lastRunStartedAt: null as string | null, lastRunStatus: "idle", lastError: null as string | null,
      config: { hours: [8, 14, 20], minute: 0 },
      alignedRefreshCampaigns: [{ campaignIdHash: "2e353d874c51", reportingDate, completedAt }],
    },
  } };
}
const assess = (f: ReturnType<typeof fixture>, c: any = config) => assessHostedHealth(f.health, f.scheduler, c, f.now);
describe("read-only hosted operations monitor", () => {
  it("waits for a new campaign's first slot, then detects a missed refresh", () => {
    const c = { ...config, campaigns: [{ ...config.campaigns[0], monitorFrom: "2026-11-05T10:00:00Z" }] };
    const first = fixture(); first.scheduler.ga4DailyScheduler.alignedRefreshCampaigns = [];
    expect(assess(first, c)).toMatchObject({ status: "pending", failures: [], pending: ["FIRST_SCHEDULED_REFRESH_PENDING:2e353d874c51"] });
    const later = fixture("2026-11-05T13:20:00Z"); later.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-05T19:00:00Z";
    later.scheduler.ga4DailyScheduler.alignedRefreshCampaigns = [];
    expect(assess(later, c).failures).toContain("REFRESH_UNCONFIRMED:2e353d874c51");
  });
  it("accepts restored completion evidence with idle process counters", () => expect(assess(fixture()).status).toBe("passed"));
  it("rejects an unexpected deployed commit", () => {
    const f = fixture(); f.health.commit = "other";
    expect(assess(f).failures).toContain("UNEXPECTED_APP_REVISION");
  });
  it("rejects a job failure even when the HTTP request succeeds", () => {
    const f = fixture(); f.scheduler.status = "unhealthy";
    expect(assess(f).failures).toContain("RECORDED_JOB_FAILURE");
  });
  it("does not rely solely on the top-level healthy label", () => {
    const f = fixture(); f.scheduler.ga4DailyScheduler.lastError = "provider failure";
    expect(assess(f).failures).toContain("RECORDED_JOB_FAILURE");
  });
  it.each(["started", "timerScheduled"])("detects a stopped %s", key => {
    const f = fixture(); (f.scheduler.ga4DailyScheduler as any)[key] = false;
    expect(assess(f).failures).toContain("GA4_SCHEDULER_STOPPED");
  });
  it("accepts a bounded busy-slot skip while publication remains current", () => {
    const f = fixture(); f.scheduler.ga4DailyScheduler.lastRunStatus = "skipped";
    expect(assess(f).status).toBe("passed");
  });
  it("detects an accidentally changed schedule", () => {
    const f = fixture(); f.scheduler.ga4DailyScheduler.config.hours = [3];
    expect(assess(f).failures).toContain("GA4_SCHEDULE_CHANGED");
  });
  it("detects a timer left in the past", () => {
    const f = fixture(); f.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-05T07:00:00Z";
    expect(assess(f).failures).toContain("GA4_TIMER_OVERDUE");
  });
  it("allows completion grace at 14:19 Amsterdam", () => {
    const f = fixture("2026-11-05T13:19:59Z"); f.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-05T19:00:00Z";
    expect(assess(f).status).toBe("passed");
  });
  it("detects a missed 14:00 completion at the end of grace", () => {
    const f = fixture("2026-11-05T13:20:00Z"); f.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-05T19:00:00Z";
    expect(assess(f).failures).toContain("REFRESH_UNCONFIRMED:2e353d874c51");
  });
  it("accepts a later successful 14:00 publication", () => {
    const f = fixture("2026-11-05T13:21:00Z", "2026-11-05T13:00:24Z");
    f.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-05T19:00:00Z";
    expect(assess(f).status).toBe("passed");
  });
  it("requires the previous evening before the morning slot", () => {
    const f = fixture("2026-11-06T05:00:00Z", "2026-11-05T19:00:24Z");
    f.scheduler.ga4DailyScheduler.nextRunAt = "2026-11-06T07:00:00Z";
    expect(assess(f).status).toBe("passed");
    f.scheduler.ga4DailyScheduler.alignedRefreshCampaigns[0].completedAt = "2026-11-05T13:00:24Z";
    expect(assess(f).status).toBe("failed");
  });
  it.each([
    ["Europe/Amsterdam", "2026-03-29T06:21:00Z", "2026-03-29T06:00:24Z", "2026-03-28"],
    ["Europe/Amsterdam", "2026-10-25T07:21:00Z", "2026-10-25T07:00:24Z", "2026-10-24"],
    ["America/New_York", "2026-11-05T13:21:00Z", "2026-11-05T13:00:24Z", "2026-11-04"],
    ["Asia/Kathmandu", "2026-11-05T02:36:00Z", "2026-11-05T02:15:24Z", "2026-11-04"],
  ])("uses campaign-local slots in %s (%s)", (zone, at, completed, date) => {
    const f = fixture(at, completed, date);
    f.scheduler.ga4DailyScheduler.nextRunAt = new Date(f.now.getTime() + 3600_000).toISOString();
    const c = { ...config, campaigns: [{ ...config.campaigns[0], reportingTimeZone: zone }] };
    expect(assess(f, c).status).toBe("passed");
    f.scheduler.ga4DailyScheduler.alignedRefreshCampaigns[0].completedAt = new Date(Date.parse(completed) - 60_000).toISOString();
    expect(assess(f, c).failures).toContain("REFRESH_UNCONFIRMED:2e353d874c51");
  });
  it("reports in-progress evidence separately while cache is cleared", () => {
    const f = fixture("2026-11-05T13:01:00Z");
    Object.assign(f.scheduler.ga4DailyScheduler, { inProgress: true, lastRunStartedAt: "2026-11-05T13:00:00Z", alignedRefreshCampaigns: [] });
    expect(assess(f).status).toBe("pending");
  });
  it("does not allow a long-running job to hide missing evidence", () => {
    const f = fixture("2026-11-05T13:21:00Z");
    Object.assign(f.scheduler.ga4DailyScheduler, { inProgress: true, lastRunStartedAt: "2026-11-05T13:00:00Z", alignedRefreshCampaigns: [] });
    expect(assess(f).failures).toEqual(expect.arrayContaining(["GA4_RUN_OVERDUE", "REFRESH_UNCONFIRMED:2e353d874c51"]));
  });
  it.each(["2026-11-03", "2026-11-06", "bad-date"])("rejects the wrong reporting date %s", date => {
    expect(assess(fixture(undefined, undefined, date)).status).toBe("failed");
  });
  it("rejects future completion and duplicate markers", () => {
    const f = fixture(undefined, "2026-11-06T07:00:00Z");
    expect(assess(f).failures).toContain("INVALID_COMPLETION:2e353d874c51");
    f.scheduler.ga4DailyScheduler.alignedRefreshCampaigns.push(f.scheduler.ga4DailyScheduler.alignedRefreshCampaigns[0]);
    expect(assess(f).failures).toContain("INVALID_COMPLETION:2e353d874c51");
  });
  it("does not use another campaign's success", () => {
    const f = fixture(); f.scheduler.ga4DailyScheduler.alignedRefreshCampaigns[0].campaignIdHash = "aaaaaaaaaaaa";
    expect(assess(f).failures).toContain("REFRESH_UNCONFIRMED:2e353d874c51");
  });
  it("fails closed on cached or malformed health responses", () => {
    const f = fixture(); f.health.ts = "2026-11-05T07:00:00Z"; f.scheduler.timestamp = f.health.ts;
    expect(assess(f).failures).toEqual(expect.arrayContaining(["APP_HEALTH_STALE", "SCHEDULER_HEALTH_STALE"]));
    expect(assessHostedHealth({}, {}, config, f.now).failures).toEqual(["APP_HEALTH_INVALID", "SCHEDULER_HEALTH_INVALID"]);
  });
  it.each([
    { baseUrl: "http://marketforensics-test.onrender.com" }, { baseUrl: "https://user:secret@example.com" },
    { baseUrl: "https://example.com/path" }, { campaigns: [] }, { graceMinutes: 0 },
    { campaigns: [{ ...config.campaigns[0], reportingTimeZone: "invalid" }] },
    { campaigns: [config.campaigns[0], config.campaigns[0]] },
    { maxResponseMilliseconds: 0 }, { maxResponseMilliseconds: 15001 },
  ])("rejects unsafe or incomplete configuration %j", change => expect(() => assess(fixture(), { ...config, ...change })).toThrow());
  it("requests only the two public endpoints with GET and no credentials", async () => {
    const f = fixture(new Date().toISOString());
    const request = vi.fn(async (url: URL) => new Response(JSON.stringify(url.pathname === "/api/health" ? f.health : f.scheduler)));
    await checkHostedHealth(config, request as any);
    expect(request.mock.calls.map(call => call[0].pathname)).toEqual(["/api/health", "/health/scheduler"]);
    for (const call of request.mock.calls as any[]) expect(call[1]).toMatchObject({ method: "GET", redirect: "error", headers: { "Cache-Control": "no-cache" } });
  });
  it.each(["network", "http", "json"])("fails safely on %s errors without printing response content", async kind => {
    const request = async () => {
      if (kind === "network") throw new Error("sensitive network detail");
      return new Response("sensitive response detail", { status: kind === "http" ? 503 : 200 });
    };
    const result = await checkHostedHealth(config, request as any);
    expect(result.status).toBe("failed");
    expect(JSON.stringify(result)).not.toContain("sensitive");
  });
  it("alerts when a health response exceeds the configured latency limit", async () => {
    const f = fixture(new Date().toISOString());
    const timer = vi.spyOn(performance, "now").mockReturnValueOnce(0).mockReturnValueOnce(0).mockReturnValue(6000);
    try {
      const result = await checkHostedHealth({ ...config, maxResponseMilliseconds: 5000 }, (async (url: URL) =>
        new Response(JSON.stringify(url.pathname === "/api/health" ? f.health : f.scheduler))) as any);
      expect(result.failures).toContain("HEALTH_RESPONSE_SLOW");
    } finally { timer.mockRestore(); }
  });
});
