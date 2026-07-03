import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getExpectedDailyRefreshAt, getLatestCompleteReportingDate, getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 reporting-day cutoff", () => {
  it("keeps UTC campaigns on the previous UTC date", () => {
    expect(getLatestCompleteReportingDate("UTC", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-19");
  });

  it("uses the campaign timezone around local midnight", () => {
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-20");
  });

  it("handles Amsterdam DST calendar boundaries", () => {
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-03-29T21:30:00.000Z"))).toBe("2026-03-28");
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-03-29T22:30:00.000Z"))).toBe("2026-03-29");
  });

  it("falls back to UTC for invalid timezone input", () => {
    expect(normalizeReportingTimeZone("not/a-zone")).toBe("UTC");
    expect(getLatestCompleteReportingDate("not/a-zone", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-19");
  });

  it("returns a compatible date window with data-through metadata", () => {
    expect(getReportingDateWindow(7, "Europe/Amsterdam", new Date("2026-06-20T22:30:00.000Z"))).toEqual({
      reportingTimeZone: "Europe/Amsterdam",
      dataThroughDate: "2026-06-20",
      endDate: "2026-06-20",
      startDate: "2026-06-14",
    });
  });

  it("calculates the expected refresh time for a completed reporting day", () => {
    expect(getExpectedDailyRefreshAt("2026-06-20", "Europe/Amsterdam", 3, 0)?.toISOString()).toBe("2026-06-21T01:00:00.000Z");
  });

  it("wires the timezone cutoff through the GA4 daily route and Trends UI", () => {
    const routes = read("server", "routes-oauth.ts");
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(routes).toContain("const reportingWindow = getReportingDateWindow(days, (campaign as any)?.reportingTimeZone);");
    expect(routes).toContain("const { startDate, endDate, dataThroughDate, reportingTimeZone } = reportingWindow;");
    expect(routes).toContain("dataThroughDate,");
    expect(routes).toContain("expectedRefreshAt: expectedRefreshAtISO,");
    expect(routes).toContain("lastCompletedRefreshAt,");
    expect(routes).toContain("latestStoredDailyDate,");
    expect(routes).toContain("oldestDueMissingDailyDate,");
    expect(routes).toContain("providerRefreshWarning,");
    expect(routes).toContain("refreshIsStale:");
    expect(routes).toContain("getOldestDueMissingDailyDate(getLatestStoredDailyDate(stored))");
    expect(routes).toContain("Existing rows can still be stale. Try to fill due missing completed days, but keep serving stored rows if the provider fails.");

    expect(page).toContain("const trendsReportingTimeZone = normalizeClientReportingTimeZone((ga4DailyResp as any)?.reportingTimeZone);");
    expect(page).toContain("const trendsDataThroughDate = String(ga4DailyDataThroughDate || ga4ReportDate || \"\").trim();");
    expect(page).toContain("completed {trendsReportingTimeZoneLabel} GA4 daily rows");
  });

  it("keeps GA4 to-date from calling the provider with an inverted completed-day window", () => {
    const routes = read("server", "routes-oauth.ts");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"');
    const routeEnd = routes.indexOf('  // Benchmark-read-only GA4 input validation', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(route).toContain("if (startDateUsed > endDateUsed)");
    expect(route).toContain("noCompletedWindow: true");
    expect(route).toContain("No completed GA4 reporting day is available for this campaign yet.");
    expect(route.indexOf("if (startDateUsed > endDateUsed)")).toBeLessThan(route.indexOf("ga4Service.getTotalsWithRevenue"));
  });
  it("maps GA4 timeseries token refresh failures to a reconnect response", () => {
    const routes = read("server", "routes-oauth.ts");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-timeseries"');
    const routeEnd = routes.indexOf('  // List GA4 campaign values', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    const autoRefreshIndex = route.indexOf("error.message === 'AUTO_REFRESH_NEEDED'");
    const tokenExpiredIndex = route.indexOf("error.message === 'TOKEN_EXPIRED'");
    const genericFallbackIndex = route.indexOf("error: error.message || 'Failed to fetch time series data'");

    expect(autoRefreshIndex).toBeGreaterThan(-1);
    expect(tokenExpiredIndex).toBeGreaterThan(-1);
    expect(genericFallbackIndex).toBeGreaterThan(tokenExpiredIndex);
    expect(route).toContain("requiresReauthorization: true");
    expect(route).toContain("Google Analytics needs to be reconnected.");
  });
});
