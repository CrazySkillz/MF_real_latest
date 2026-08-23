import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  filterTrendRowsToCalendarWindow,
  resolveTrendComparisonDate,
} from "../client/src/lib/trend-analysis-cumulative";

describe("Trend Analysis window regression guard", () => {
  it("maps every selector option to its exact comparison date and request identity", () => {
    expect(resolveTrendComparisonDate("2026-08-22", 7)).toBe("2026-08-15");
    expect(resolveTrendComparisonDate("2026-08-22", 14)).toBe("2026-08-08");
    expect(resolveTrendComparisonDate("2026-08-22", 30)).toBe("2026-07-23");
    expect(resolveTrendComparisonDate("2026-08-22", 90)).toBe("2026-05-24");

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page).toContain('const trendDateRange = `${perfDays}days`;');
    expect(page).toContain("trend-analysis?dateRange=${trendDateRange}&days=${perfDays * 2}");
  });

  it("clamps cumulative GA4 chart rows to the authoritative import boundary", () => {
    const rows = [
      { date: "2026-06-19" },
      { date: "2026-07-01" },
      { date: "2026-07-02" },
      { date: "2026-08-10" },
      { date: "2026-08-23" },
    ];
    expect(filterTrendRowsToCalendarWindow(rows, "2026-08-22", 90, "2026-07-02").map((row) => row.date))
      .toEqual(["2026-07-02", "2026-08-10"]);
    expect(filterTrendRowsToCalendarWindow(rows, "2026-08-22", 7, "invalid")).toEqual([]);

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page.match(/filterTrendRowsToCalendarWindow\([^\n]+currentValueWindow\?\.startDate/g)).toHaveLength(5);
  });

  it("keeps authoritative cumulative values visible when a trend window has no daily rows", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page).toContain("overviewTrendData.series.length > 0 || (usesCumulativeGA4Consumer && authoritativeTrendCurrent)");
    expect(page).toContain("No daily activity is available in this trend window. Current cumulative and campaign-to-date values remain visible above.");
    expect(page).toContain("efficiencyTrendData?.series.length > 0");
    expect(page).toContain("Trend & comparison window");
  });
});
