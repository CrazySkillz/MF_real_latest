import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { buildGA4InsightsRollups } from "../shared/ga4-insights";

describe("GA4 Insights Data Summary empty window", () => {
  it("distinguishes no imported days from an imported day with valid zero values", () => {
    const endDate = "2026-09-16";
    const missing = buildGA4InsightsRollups([], endDate).last30;
    const verifiedZero = buildGA4InsightsRollups([
      { date: endDate, sessions: 0, conversions: 0, users: 0, revenue: 0, pageviews: 0, engagementRate: 0 },
    ], endDate).last30;

    expect(missing).toMatchObject({ days: 0, sessions: 0, conversions: 0 });
    expect(verifiedZero).toMatchObject({ days: 1, sessions: 0, conversions: 0 });

    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf-8");
    const start = page.indexOf('<CardTitle className="text-lg">Data Summary</CardTitle>');
    const end = page.indexOf("</CardContent>", start);
    const section = page.slice(start, end);
    const guard = "dataSummaryHistoryAvailable && (";

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(page).toContain("dataSummaryHistoryTotals?.sessions != null && dataSummaryHistoryTotals?.conversions != null");
    expect(page).toContain("ga4InsightsTimeSeries.some((row) => row.date >= dataSummaryHistoryStartDate && row.date <= dataSummaryHistoryEndDate)");
    expect(section).toContain("no usable imported history was returned for this property");
    for (const card of ["insights-summary-sessions", "insights-summary-conversions"]) {
      const cardStart = section.indexOf(`data-testid="${card}"`);
      expect(cardStart).toBeGreaterThan(-1);
      expect(section.slice(cardStart - 175, cardStart)).toContain(guard);
    }
  });
});
