import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildGA4InsightsRollups } from "../shared/ga4-insights";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";

describe("GA4 Insights Data Summary history window", () => {
  it("includes imported days before the rolling window without changing findings inputs", () => {
    const rows = [
      { date: "2026-08-09", sessions: 35, conversions: 6 },
      { date: "2026-08-10", sessions: 33, conversions: 5 },
      { date: "2026-08-18", sessions: 428, conversions: 73 },
    ];
    expect(buildGA4InsightsRollups(rows, "2026-09-16").last30).toMatchObject({ sessions: 428, conversions: 73 });
    expect(summarizeGA4TrafficRows(rows)).toMatchObject({ sessions: 496, conversions: 84 });

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
    const start = page.indexOf('<CardTitle className="text-lg">Data Summary</CardTitle>');
    const end = page.indexOf('data-testid="insights-trackers"', start);
    const section = page.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(page).toContain("const dataSummaryHistoryTotals = (ga4InsightsDailyResp as any)?.overviewTotals;");
    expect(page).toContain("const dataSummaryHistoryChannelAnalysis = dataSummaryHistoryAvailable && channelAnalysis &&");
    expect(page).toContain('String((ga4Breakdown as any)?.startDate || "") === dataSummaryHistoryStartDate');
    expect(page).toContain('String((ga4Breakdown as any)?.endDate || "") === dataSummaryHistoryEndDate');
    expect(page).toContain("channelAnalysis.totalSessions === dataSummaryHistorySessions");
    expect(page).toContain("channelAnalysis.totalConversions === dataSummaryHistoryConversions");
    expect(page).not.toContain("dataSummaryHistoryAvailable && dataSummaryChannelAnalysis &&");
    expect(section).toContain("formatNumber(dataSummaryHistorySessions)");
    expect(section).toContain("formatNumber(dataSummaryHistoryConversions)");
    expect(section).toContain("dataSummaryHistoryChannelAnalysis && dataSummaryHistoryChannelAnalysis.channels");
    expect(page).toContain("const recommendationChannelAnalysis = breakdownError ? null : dataSummaryChannelAnalysis;");
  });
});
