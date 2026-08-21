import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getExpectedDailyRefreshAt, getLatestCompleteReportingDate, getReportingDateWindow, normalizeReportingTimeZone, resolveGA4DailyFreshness } from "./utils/reporting-timezone";

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

  it("treats successful provider coverage as current without inventing missing activity rows", () => {
    expect(resolveGA4DailyFreshness({
      dataThroughDate: "2026-07-29",
      expectedRefreshAt: new Date("2026-07-30T03:00:00.000Z"),
      lastCompletedRefreshAt: "2026-07-30T11:54:41.666Z",
      oldestDueMissingDailyDate: "2026-07-13",
      providerCoverageThroughDate: "2026-07-29",
      now: new Date("2026-07-30T13:00:00.000Z"),
    })).toEqual({
      providerCoverageThroughDate: "2026-07-29",
      oldestDueMissingDailyDate: null,
      refreshIsStale: false,
    });
  });

  it("treats a completed full-window refresh as current when GA4 returns sparse activity rows", () => {
    expect(resolveGA4DailyFreshness({
      dataThroughDate: "2026-08-05",
      expectedRefreshAt: new Date("2026-08-06T01:00:00.000Z"),
      lastCompletedRefreshAt: "2026-08-06T10:30:00.000Z",
      oldestDueMissingDailyDate: "2026-08-05",
      providerCoverageThroughDate: null,
      now: new Date("2026-08-06T12:00:00.000Z"),
    })).toEqual({
      providerCoverageThroughDate: null,
      oldestDueMissingDailyDate: null,
      refreshIsStale: false,
    });
  });


  it("retains a failed provider warning even when prior coverage was current", () => {
    expect(resolveGA4DailyFreshness({
      dataThroughDate: "2026-07-29",
      expectedRefreshAt: new Date("2026-07-30T03:00:00.000Z"),
      lastCompletedRefreshAt: "2026-07-30T11:54:41.666Z",
      oldestDueMissingDailyDate: "2026-07-13",
      providerCoverageThroughDate: "2026-07-29",
      providerRefreshWarning: "provider failed",
      now: new Date("2026-07-30T13:00:00.000Z"),
    }).refreshIsStale).toBe(true);
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
    expect(routes).toContain("oldestDueMissingDailyDate: getOldestDueMissingDailyDate(latestStoredDailyDate, now),");
    expect(routes).toContain("providerRefreshWarning,");
    expect(routes).toContain("const freshness = resolveGA4DailyFreshness({");
    expect(routes).toContain("providerRefreshAttempted,");
    expect(routes).toContain("providerRefreshOutcome,");
    expect(routes).toContain("providerRefreshRowCount,");
    expect(routes).toContain("providerCoverageThroughDate = dataThroughDate;");
    expect(routes).toContain("providerRefreshCompletedAt || lastUpdated");
    expect(routes).toContain("getOldestDueMissingDailyDate(getLatestStoredDailyDate(stored))");
    expect(routes).toContain("Existing rows can still be stale. Try to fill due missing completed days, but keep serving stored rows if the provider fails.");

    expect(page).toContain("const trendsReportingTimeZone = normalizeClientReportingTimeZone((ga4InsightsDailyResp as any)?.reportingTimeZone);");
    expect(page).toContain("const trendsDataThroughDate = String(ga4InsightsDataThroughDate || \"\").trim();");
    expect(page).toContain("completed {trendsReportingTimeZoneLabel} GA4 daily rows");
    expect(page).toContain("const ga4DailyRefreshIsStale = (ga4DailyResp as any)?.refreshIsStale === true;");
    expect(page).toContain("Checked through ${ga4DailyProviderCoverageThroughDate}; latest activity ${ga4DailyLatestStoredDate");
    expect(page).not.toContain('data-testid="ga4-overview-freshness-summary"');
    expect(page).not.toContain('data-testid="ga4-overview-freshness-warning"');
    expect(page).toContain("Latest visible refresh metadata from the GA4 page inputs.");
    expect(page).toContain("formatConnectionTimestamp((ga4DailyResp as any)?.lastCompletedRefreshAt)");
    expect(page).not.toContain("formatConnectionTimestamp(provenanceLastUpdated)");

    const runner = read("client", "public", "ga4-overview-validation-runner.js");
    expect(runner).toContain("dailyFreshnessContractPresent:");
    expect(runner).toContain("providerRefreshOutcome: dailyData.providerRefreshOutcome || null");
    expect(runner).toContain("providerCoverageThroughDate: dailyData.providerCoverageThroughDate || null");
    expect(runner).toContain("providerRefreshWarningPresent: Boolean(dailyData.providerRefreshWarning)");
    expect(runner).toContain("does not invent zero rows or prove GA4 has finished delayed event processing");
  });

  it("keeps GA4 to-date from calling the provider with an inverted completed-day window", () => {
    const routes = read("server", "routes-oauth.ts");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-to-date"');
    const routeEnd = routes.indexOf('  // Benchmark-read-only GA4 input validation', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(routeStart).toBeGreaterThan(-1);
    expect(routeEnd).toBeGreaterThan(routeStart);
    expect(route).toContain("const raw = (campaign as any)?.startDate || (campaign as any)?.createdAt || null;");
    expect(route).toContain("const startDateUsed = (() => {");
    expect(route).not.toContain("startDateUsed = currentValueWindow.startDate;");
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
