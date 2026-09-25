import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveGA4InsightsRefreshIsStale } from "../shared/ga4-insights";
import { resolveGA4DailyFreshness } from "./utils/reporting-timezone";

describe("GA4 Insights Data Summary stale warning", () => {
  it("labels visible daily values when refresh or coverage is stale", () => {
    const current = {
      dataThroughDate: "2026-09-16",
      expectedRefreshAt: new Date("2026-09-17T10:05:00.000Z"),
      lastCompletedRefreshAt: "2026-09-17T10:06:00.000Z",
      oldestDueMissingDailyDate: null,
      providerCoverageThroughDate: "2026-09-16",
      now: new Date("2026-09-17T12:00:00.000Z"),
    };
    expect(resolveGA4DailyFreshness(current).refreshIsStale).toBe(false);
    expect(resolveGA4DailyFreshness({ ...current, providerRefreshWarning: "refresh failed" }).refreshIsStale).toBe(true);
    expect(resolveGA4DailyFreshness({ ...current, lastCompletedRefreshAt: null, providerCoverageThroughDate: null }).refreshIsStale).toBe(true);

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
    const start = page.indexOf('<CardTitle className="text-lg">Data Summary</CardTitle>');
    const end = page.indexOf('data-testid="insights-summary-sessions"', start);
    const section = page.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(page).toContain("const trendsRefreshIsStale = resolveGA4InsightsRefreshIsStale({");
    expect(section).toContain("trendsRefreshIsStale && dataSummaryHistoryAvailable");
    expect(section).toContain('data-testid="insights-data-summary-stale"');
    expect(section).toContain("Daily data may be out of date; verify the refresh before using these figures.");
  });

  it("accepts exact live coverage of sparse zero-activity dates without hiding real failures", () => {
    const dailyResponse = {
      propertyId: "542352127",
      startDate: "2026-07-27",
      dataThroughDate: "2026-09-24",
      reportingTimeZone: "Europe/Amsterdam",
      refreshIsStale: true,
    };
    const coverageResponse = {
      propertyId: "properties/542352127",
      startDate: "2026-08-23",
      endDate: "2026-09-24",
      reportingTimeZone: "Europe/Amsterdam",
      verified: true,
      providerVerified: true,
      providerZeroDatesVerified: true,
      dailyRows: [],
    };
    const resolve = (overrides: Record<string, unknown> = {}) => resolveGA4InsightsRefreshIsStale({
      dailyResponse,
      dailyRequestError: null,
      coverageResponse,
      coverageRequestError: null,
      propertyId: "542352127",
      ...overrides,
    });

    expect(resolve()).toBe(false);
    expect(resolve({ dailyRequestError: new Error("daily read failed") })).toBe(true);
    expect(resolve({ coverageRequestError: new Error("coverage check failed") })).toBe(true);
    expect(resolve({ coverageResponse: { ...coverageResponse, verified: false } })).toBe(true);
    expect(resolve({ coverageResponse: { ...coverageResponse, endDate: "2026-09-23" } })).toBe(true);
    expect(resolve({ coverageResponse: { ...coverageResponse, propertyId: "other-property" } })).toBe(true);
    expect(resolve({ coverageResponse: { ...coverageResponse, reportingTimeZone: "UTC" } })).toBe(true);
    expect(resolve({ dailyResponse: { ...dailyResponse, refreshIsStale: false }, coverageResponse: undefined })).toBe(false);
  });
});
