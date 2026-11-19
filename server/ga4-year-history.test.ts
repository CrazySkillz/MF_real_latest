import { afterEach, describe, expect, it, vi } from "vitest";
import { ga4Service } from "./analytics";
import { getGA4HistoricalImportStartDate, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { getGA4DistinctUsers, getGA4PeriodTraffic } from "../shared/ga4-traffic-window";
import { buildGA4InsightsCalendarRollup, getGA4InsightsPeriodUsers, getGA4InsightsSessionConversionRate } from "../shared/ga4-insights";

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("new-campaign annual history boundaries and exact provider periods", () => {
  it.each([
    ["2026-11-19T12:00:00Z", "Europe/Amsterdam", "2025-11-19", "2026-11-18"],
    ["2024-03-01T12:00:00Z", "Europe/Amsterdam", "2023-03-02", "2024-02-29"],
    ["2026-03-29T22:30:00Z", "Europe/Amsterdam", "2025-03-30", "2026-03-29"],
    ["2026-11-19T00:30:00Z", "America/Los_Angeles", "2025-11-18", "2026-11-17"],
  ])("selects 365 completed local calendar days at %s in %s", (at, zone, start, end) => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "false");
    const now = new Date(at);
    expect(getGA4HistoricalImportStartDate(now, 365, zone)).toBe(start);
    expect(resolveGA4ImportToDateWindow(start, zone, now)).toMatchObject({ startDate: start, endDate: end, days: 365 });
    const oldStart = getGA4HistoricalImportStartDate(now, 30, zone);
    expect(resolveGA4ImportToDateWindow(oldStart, zone, now)?.days).toBe(30);
    // The existing current-day policy can additionally include today's provisional data.
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    expect(resolveGA4ImportToDateWindow(start, zone, now)?.days).toBe(366);
  });

  it("queries native annual, rolling and monthly audiences without summing daily users or rates", async () => {
    const start = "2025-11-19", end = "2026-11-18", requests: any[] = [];
    const events = Array.from({ length: 365 }, (_, i) => ({ date: new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10),
      user: i % 5, sessions: i % 7 ? 10 : 0 }));
    vi.stubGlobal("fetch", vi.fn(async (url: string, options: any) => {
      expect(url).toBe("https://analyticsdata.googleapis.com/v1beta/properties/123:runReport");
      const body = JSON.parse(options.body); requests.push(body);
      expect(JSON.stringify(body.dimensionFilter)).toContain("selected-campaign");
      const selected = (range: any) => events.filter(e => e.date >= range.startDate && e.date <= range.endDate && e.sessions > 0);
      const users = (range: any) => new Set(selected(range).map(e => e.user)).size;
      const values = (range: any) => body.metrics.map((metric: any) => ({ value: String(metric.name === "totalUsers" ? users(range)
        : metric.name === "sessions" ? selected(range).length * 10 : metric.name === "engagedSessions" ? selected(range).length * 7
        : metric.name === "engagementRate" ? 0.7 : 0.096) }));
      if (body.metricAggregations) return new Response(JSON.stringify({ dimensionHeaders: [{ name: "dateRange" }], metricHeaders: [{ name: "totalUsers" }], rows: [], rowCount: 0,
        totals: body.dateRanges.map((range: any) => ({ dimensionValues: [{ value: range.name }], metricValues: values(range) })) }));
      const rows = body.dimensions ? selected(body.dateRanges[0]).map(e => ({ dimensionValues: [{ value: e.date.replace(/-/g, "") }], metricValues: [{ value: "1" }] }))
        : [{ metricValues: values(body.dateRanges[0]) }];
      return new Response(JSON.stringify({ rows, rowCount: rows.length }));
    }));
    const result = await ga4Service.getDistinctUsersWithToken("123", "fixture", start, end, ["selected-campaign"], undefined, true, start);
    expect(result.total).toBe(5); expect(result.daily).toHaveLength(365);
    expect(result.daily.reduce((sum, row) => sum + row.users, 0)).toBe(312);
    expect(result).toMatchObject({ sessions: 3120, engagementRate: 0.7, sessionKeyEventRate: 0.096 });
    expect(result.windows.some(w => w.startDate === "2026-01-01" && w.endDate === "2026-01-31" && w.users === 5)).toBe(true);
    const snapshot = { windowStart: start, windowEnd: end, campaignBreakdown: { meta: { propertyId: "123", distinctUsers: result } } };
    expect(getGA4DistinctUsers(snapshot, start, end)).toBe(5);
    expect(getGA4PeriodTraffic(snapshot, start, end)).toMatchObject({ sessions: 3120, engagementRate: 0.7, conversionRate: 9.6 });
    const rows = events.map(e => ({ date: e.date, sessions: e.sessions, users: e.sessions ? 1 : 0, conversions: e.sessions ? 2 : 0, revenue: 0, pageviews: 0, engagementRate: e.sessions ? 0.7 : 0 }));
    for (const days of [7, 30]) {
      const window = buildGA4InsightsCalendarRollup(rows, end, days);
      expect(getGA4InsightsPeriodUsers(result.windows, window)).toBe(5);
      expect(getGA4InsightsSessionConversionRate(result.windows, window)).toBe(9.6);
      const missing = buildGA4InsightsCalendarRollup(rows.slice(0, -1), end, days);
      expect(getGA4InsightsPeriodUsers(result.windows, missing)).toBeNull();
      expect(getGA4InsightsSessionConversionRate(result.windows, missing)).toBeNull();
    }
    expect(requests.every(r => r.dateRanges.length <= 4)).toBe(true);
    expect(requests.length).toBeLessThan(200);
  });
});
