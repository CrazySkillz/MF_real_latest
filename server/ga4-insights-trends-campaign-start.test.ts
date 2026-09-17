import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ScriptTarget, transpileModule } from "typescript";
import { addGA4InsightsDateDays, buildGA4InsightsMonthlySeries, buildGA4InsightsRollups, normalizeGA4InsightsDailyRows } from "../shared/ga4-insights";

const page = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8").replace(/\r\n/g, "\n");
const extract = (startMarker: string, endMarker: string) => {
  const start = page.indexOf(startMarker);
  const end = page.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error(`Trends source boundary missing: ${startMarker}`);
  return page.slice(start, end);
};
const js = (source: string) => transpileModule(source, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;

const getStartDate = new Function(js(`${extract("const getTrendsCampaignStartDate =", "\nconst formatReportingTimeZoneLabel")}; return getTrendsCampaignStartDate;`))() as
  (createdAt: string | null, reportingTimeZone: string) => string;
const buildRows = new Function("normalizeGA4InsightsDailyRows", js(`
  return (ga4InsightsTimeSeries: any[], ga4TrendsCoverage: any, trendsZeroDaysVerified: boolean, trendsDataThroughDate: string, trendsCampaignStartDate: string) => {
    ${extract("    if (!trendsCampaignStartDate) return [];", "\n  }, [ga4InsightsTimeSeries,")}
  };
`))(normalizeGA4InsightsDailyRows) as (rows: any[], coverage: any, verified: boolean, cutoff: string, startDate: string) => any[];
const importedRows = new Function(js(`
  return (ga4InsightsTimeSeries: any[], ga4TrendsCoverage: any, trendsZeroDaysVerified: boolean, trendsCampaignStartDate: string) => {
    ${extract("  const trendsImportedRows =", "\n  const trendsLatestImportedDate =")}
    return trendsImportedRows;
  };
`))() as (rows: any[], coverage: any, verified: boolean, startDate: string) => any[];
const dailyChart = new Function("addGA4InsightsDateDays", js(`
  return (sorted: any[], trendsCampaignStartDate: string) => {
    const metric = "sessions";
    const isRate = false;
    let chartData: any[] = [];
    let dailyChartStartDate = "";
    let dailyChartEndDate = "";
    ${extract("                            // Show up to 30 calendar days", "\n                          } else if (insightsTrendMode === \"monthly\")")}
    return { chartData, dailyChartStartDate, dailyChartEndDate };
  };
`))(addGA4InsightsDateDays) as (rows: any[], startDate: string) => { chartData: any[]; dailyChartStartDate: string; dailyChartEndDate: string };

const row = (date: string, sessions: number) => ({ date, sessions, users: sessions, conversions: 0, revenue: 0, pageviews: sessions, engagedSessions: 0, engagementRate: 0 });

describe("GA4 Insights Trends campaign creation boundary", () => {
  it("uses the campaign reporting date when creation crosses a UTC midnight", () => {
    expect(getStartDate("2026-09-03T22:30:00.000Z", "Europe/Amsterdam")).toBe("2026-09-04");
    expect(getStartDate("2026-09-03T22:30:00.000Z", "America/New_York")).toBe("2026-09-03");
    expect(getStartDate(null, "Europe/Amsterdam")).toBe("");
    expect(getStartDate("invalid", "Europe/Amsterdam")).toBe("");
  });

  it("excludes verified zero and imported dates before creation from every Trends rollup", () => {
    const startDate = getStartDate("2026-09-08T10:06:04.469Z", "Europe/Amsterdam");
    const coverage = {
      startDate: "2026-08-18",
      dailyRows: [row("2026-09-07", 39), row("2026-09-09", 38), row("2026-09-10", 38), row("2026-09-12", 74), row("2026-09-13", 36), row("2026-09-14", 32), row("2026-09-15", 31), row("2026-09-16", 34)],
      zeroDates: ["2026-08-18", "2026-09-08", "2026-09-11"],
    };
    const rows = buildRows([], coverage, true, "2026-09-16", startDate);
    expect(rows.map((item) => item.date)).toEqual(Array.from({ length: 9 }, (_, index) => addGA4InsightsDateDays("2026-09-08", index)));
    expect(rows.find((item) => item.date === "2026-09-08")?.sessions).toBe(0);
    expect(rows.find((item) => item.date === "2026-09-11")?.sessions).toBe(0);
    expect(importedRows([], coverage, true, startDate).map((item) => item.date)).toEqual(coverage.dailyRows.slice(1).map((item) => item.date));

    const rollups = buildGA4InsightsRollups(rows, "2026-09-16");
    expect(rollups.last7.complete).toBe(true);
    expect(rollups.prior7.complete).toBe(false);
    expect(rollups.prior7.days).toBe(2);
    expect(rollups.last30.complete).toBe(false);
    expect(buildGA4InsightsMonthlySeries(rows, "2026-09-16", "sessions").map((month) => ({ month: month.month, value: month.value, partial: month.partial }))).toEqual([
      { month: "2026-09", value: 283, partial: true },
    ]);
    expect(page).toContain('insightsTrendMode === "monthly"\n                            ? availableMonths >= 1');
    expect(page).not.toContain("monthValues.length < 2");
    expect(page).toContain('comparable ? "No % baseline" : "Not comparable"');
  });

  it("keeps unverified missing days absent and fails closed without a creation date", () => {
    const rows = [row("2026-09-03", 10), row("2026-09-04", 30), row("2026-09-06", 34)];
    expect(buildRows(rows, null, false, "2026-09-16", "2026-09-04").map((item) => item.date)).toEqual(["2026-09-04", "2026-09-06"]);
    expect(buildRows(rows, null, false, "2026-09-16", "")).toEqual([]);
    expect(importedRows(rows, null, false, "")).toEqual([]);
    const chart = dailyChart([row("2026-09-09", 38), row("2026-09-10", 38)], "2026-09-08");
    expect(chart.dailyChartStartDate).toBe("2026-09-08");
    expect(chart.chartData.map((point) => point.value)).toEqual([null, 38, 38]);
  });
});
