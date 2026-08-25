import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  expandTrendRowsToCalendarWindow,
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

  it("fails an incomplete cumulative GA4 chart window closed at the authoritative import boundary", () => {
    const rows = [
      { date: "2026-06-19" },
      { date: "2026-07-01" },
      { date: "2026-07-02" },
      { date: "2026-08-10" },
      { date: "2026-08-23" },
    ];
    expect(filterTrendRowsToCalendarWindow(rows, "2026-08-22", 90, "2026-07-02").map((row) => row.date))
      .toEqual([]);
    expect(filterTrendRowsToCalendarWindow(rows, "2026-09-29", 90, "2026-07-02").map((row) => row.date))
      .toEqual(["2026-07-02", "2026-08-10", "2026-08-23"]);
    expect(filterTrendRowsToCalendarWindow(rows, "2026-08-22", 7, "invalid")).toEqual([]);

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page.match(/filterTrendRowsToCalendarWindow\([^\n]+currentValueWindow\?\.startDate/g)).toHaveLength(5);
  });

  it("preserves missing GA4 calendar dates as empty chart gaps", () => {
    const rows = [
      { date: "2026-08-08", users: 108 },
      { date: "2026-08-10", users: 103 },
    ];
    expect(expandTrendRowsToCalendarWindow(rows, "2026-08-12", 5)).toEqual([
      rows[0],
      { date: "2026-08-09" },
      rows[1],
      { date: "2026-08-11" },
      { date: "2026-08-12" },
    ]);
    const emptyFourteenDayWindow = expandTrendRowsToCalendarWindow([], "2026-08-24", 14);
    expect([emptyFourteenDayWindow[0]?.date, emptyFourteenDayWindow.at(-1)?.date])
      .toEqual(["2026-08-11", "2026-08-24"]);
    expect(expandTrendRowsToCalendarWindow([], "2026-08-24", 90, "2026-07-02")).toHaveLength(54);
    expect(expandTrendRowsToCalendarWindow([], "2026-09-29", 90, "2026-07-02")).toHaveLength(90);

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page).toContain('strokeDasharray="6 4"');
    expect(page).toContain("missing dates remain gaps");
    expect(page).toContain("No GA4 daily records for {trendWindowStartLabel}–{trendWindowEndLabel}.");
    expect(page).toContain("Latest recorded date: ${latestTrendDailyDateLabel}.");
    expect(page).not.toContain("No daily activity is available in this trend window");
    expect(page).toContain("{perfDays}-day trend unavailable: {trendWindowCalendar.length} of {perfDays} calendar days are available.");
    expect(page).toContain("series: efficiencyChartSeries");
    expect(page).toContain('<SelectItem value="90d">Last 90 Days</SelectItem>');
  });

  it("keeps authoritative cumulative values visible when a trend window has no daily rows", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    expect(page).toContain("overviewTrendData.series.length > 0 || (usesCumulativeGA4Consumer && authoritativeTrendCurrent)");
    expect(page).toContain("No GA4 daily records for {trendWindowStartLabel}–{trendWindowEndLabel}.");
    expect(page).toContain("efficiencyTrendData?.series.length > 0");
    expect(page).toContain("Trend & comparison window");
  });

  it("keeps KPI card height stable and avoids redundant availability paragraphs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const styles = readFileSync(join(process.cwd(), "client", "src", "index.css"), "utf-8");
    expect(page).toContain('className="min-h-[5rem]"');
    expect(page).toContain("<SelectContent data-trend-window-select>");
    expect(styles).toContain("body[data-scroll-locked]:has([data-trend-window-select])");
    expect(styles).toContain("margin-right: 0 !important;");
    expect(page).not.toContain("const trafficComparisonAvailabilityMessage");
    expect(page).not.toContain("Exact traffic and financial comparisons are unavailable");
    const executiveViewStart = page.indexOf('<TabsContent value="overview"');
    const executiveViewEnd = page.indexOf('<TabsContent value="efficiency"', executiveViewStart);
    expect(page.slice(executiveViewStart, executiveViewEnd)).not.toContain("Exact comparison for {trendComparisonDate} is unavailable");

    const cumulativeRenderStart = page.indexOf("cumulativeComparison ? (");
    const cumulativeRenderEnd = page.indexOf(") : (", cumulativeRenderStart);
    expect(page.slice(cumulativeRenderStart, cumulativeRenderEnd)).not.toContain("ArrowUpRight");
    expect(page.slice(cumulativeRenderStart, cumulativeRenderEnd)).not.toContain("text-green-600");
  });
});
