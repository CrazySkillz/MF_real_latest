import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
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
    expect(page).toContain("Boolean((ga4InsightsDailyResp as any)?.refreshIsStale) || Boolean(ga4InsightsDailyError && ga4InsightsDailyResp !== undefined)");
    expect(section).toContain("trendsRefreshIsStale && dataSummaryHistoryAvailable");
    expect(section).toContain('data-testid="insights-data-summary-stale"');
    expect(section).toContain("Daily data may be out of date; verify the refresh before using these figures.");
  });
});
