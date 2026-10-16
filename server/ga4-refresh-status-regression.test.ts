import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveStoredGA4TrafficFreshness } from "./utils/ga4-alert-current-value";
import { getExpectedDailyRefreshAt, getExpectedScheduledRefreshAt, resolveGA4DailyFreshness } from "./utils/reporting-timezone";

describe("GA4 scheduled refresh status", () => {
  afterEach(() => vi.unstubAllEnvs());

  const schedule = { reportingTimeZone: "Europe/Amsterdam", hour: 8, hours: [8, 14, 20], minute: 0 };

  it.each([
    ["2026-10-13", "2026-10-14T05:59:59.000Z", "2026-10-14T06:00:00.000Z"],
    ["2026-10-13", "2026-10-14T06:00:00.000Z", "2026-10-14T06:00:00.000Z"],
    ["2026-10-13", "2026-10-14T11:59:59.000Z", "2026-10-14T06:00:00.000Z"],
    ["2026-10-13", "2026-10-14T12:00:00.000Z", "2026-10-14T12:00:00.000Z"],
    ["2026-10-13", "2026-10-14T18:00:00.000Z", "2026-10-14T18:00:00.000Z"],
    ["2026-03-28", "2026-03-29T12:00:00.000Z", "2026-03-29T12:00:00.000Z"],
    ["2026-10-24", "2026-10-25T13:00:00.000Z", "2026-10-25T13:00:00.000Z"],
  ])("uses the correct deadline for %s at %s", (day, time, expected) => {
    expect(getExpectedScheduledRefreshAt(day, schedule, new Date(time))?.toISOString()).toBe(expected);
  });

  it("honors configured minutes without marking a later run due early", () => {
    const config = { ...schedule, minute: 35 };
    expect(getExpectedScheduledRefreshAt("2026-10-13", config, new Date("2026-10-14T12:34:59Z"))?.toISOString())
      .toBe("2026-10-14T06:35:00.000Z");
    expect(getExpectedScheduledRefreshAt("2026-10-13", config, new Date("2026-10-14T12:35:00Z"))?.toISOString())
      .toBe("2026-10-14T12:35:00.000Z");
  });

  it("preserves single-hour deadlines and rejects an invalid reporting date", () => {
    const config = { reportingTimeZone: "UTC", hour: 3, minute: 20 };
    const expected = getExpectedDailyRefreshAt("2026-10-13", "UTC", 3, 20);
    expect(getExpectedScheduledRefreshAt("2026-10-13", config, new Date("2026-10-14T02:00:00Z"))).toEqual(expected);
    expect(getExpectedScheduledRefreshAt("2026-10-13", { ...config, hours: [] }, new Date("2026-10-14T22:00:00Z"))).toEqual(expected);
    expect(getExpectedScheduledRefreshAt("invalid", schedule)).toBeNull();
  });

  it("keeps a fresh campaign independent of another campaign's older stored update", () => {
    const input = {
      startDate: "2026-10-13", dataThroughDate: "2026-10-13", schedulerConfig: schedule,
      now: new Date("2026-10-14T12:10:00Z"),
    };
    expect(resolveStoredGA4TrafficFreshness({ ...input, rows: [{ date: "2026-10-13", updatedAt: "2026-10-14T06:05:00Z" }] }).refreshIsStale).toBe(true);
    expect(resolveStoredGA4TrafficFreshness({ ...input, rows: [{ date: "2026-10-13", updatedAt: "2026-10-14T12:05:00Z" }] }).refreshIsStale).toBe(false);
  });

  it("retains explicit provider failure warnings after a later scheduled deadline", () => {
    const now = new Date("2026-10-14T18:10:00Z");
    expect(resolveGA4DailyFreshness({
      dataThroughDate: "2026-10-13", expectedRefreshAt: getExpectedScheduledRefreshAt("2026-10-13", schedule, now),
      lastCompletedRefreshAt: "2026-10-14T18:05:00Z", oldestDueMissingDailyDate: null,
      providerCoverageThroughDate: "2026-10-13", providerRefreshWarning: "provider failed", now,
    }).refreshIsStale).toBe(true);
  });

  it.each([
    ["20,8,14", "05:59:59", false],
    ["20,8,14", "06:00:00", true],
    ["invalid,24,-1,1.5", "00:59:59", false],
    ["invalid,24,-1,1.5", "01:00:00", true],
  ])("uses the first configured or legacy deadline for a missing day with %s at %s", (hours, time, stale) => {
    vi.stubEnv("GA4_DAILY_REFRESH_TIME_ZONE", "Europe/Amsterdam");
    vi.stubEnv("GA4_DAILY_REFRESH_HOURS", hours);
    vi.stubEnv("GA4_DAILY_REFRESH_HOUR", "3");
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "0");
    expect(resolveStoredGA4TrafficFreshness({
      rows: [], startDate: "2026-08-01", dataThroughDate: "2026-08-01", now: new Date(`2026-08-02T${time}.000Z`),
    }).refreshIsStale).toBe(stale);
  });

  it.each([
    ["11:59:00", "06:05:00", false],
    ["12:00:00", "06:05:00", true],
    ["12:10:00", "12:05:00", false],
    ["18:00:00", "12:05:00", true],
    ["18:10:00", "18:05:00", false],
  ])("checks alert freshness at %s against the latest saved update %s", (time, updatedTime, stale) => {
    vi.stubEnv("GA4_DAILY_REFRESH_TIME_ZONE", "Europe/Amsterdam");
    vi.stubEnv("GA4_DAILY_REFRESH_HOURS", "20,8,14,8,invalid,24");
    vi.stubEnv("GA4_DAILY_REFRESH_HOUR", "3");
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "0");
    expect(resolveStoredGA4TrafficFreshness({
      rows: [{ date: "2026-08-01", updatedAt: `2026-08-02T${updatedTime}.000Z` }],
      startDate: "2026-08-01",
      dataThroughDate: "2026-08-01",
      now: new Date(`2026-08-02T${time}.000Z`),
    }).refreshIsStale).toBe(stale);
  });
});
