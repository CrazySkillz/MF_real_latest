import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { ScriptTarget, transpileModule } from "typescript";
import { addGA4InsightsDateDays, buildGA4InsightsMonthlySeries, buildGA4InsightsRollups } from "../shared/ga4-insights";

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
const buildRows = new Function("addGA4InsightsDateDays", js(`
  return (ga4InsightsTimeSeries: any[], trendsDataThroughDate: string, trendsCampaignStartDate: string) => {
    ${extract("    if (!trendsCampaignStartDate ||", "\n  }, [ga4InsightsTimeSeries,")}
  };
`))(addGA4InsightsDateDays) as (rows: any[], cutoff: string, startDate: string) => any[];
const importedRows = new Function(js(`
  return (ga4InsightsTimeSeries: any[], trendsCampaignStartDate: string, trendsDataThroughDate: string) => {
    ${extract("  const trendsImportedRows =", "\n  const trendsLatestImportedDate =")}
    return trendsImportedRows;
  };
`))() as (rows: any[], startDate: string, cutoff: string) => any[];
const dailyChart = new Function("addGA4InsightsDateDays", js(`
  return (sorted: any[], trendsCampaignStartDate: string) => {
    const metric = "sessions";
    const isRate = false;
    let chartData: any[] = [];
    ${extract("                            // Show up to 30 calendar days", "\n                          } else if (insightsTrendMode === \"monthly\")")}
    return { chartData };
  };
`))(addGA4InsightsDateDays) as (rows: any[], startDate: string) => { chartData: any[] };

const row = (date: string, sessions: number) => ({ date, sessions, users: sessions, conversions: 0, revenue: 0, pageviews: sessions, engagedSessions: 0, engagementRate: 0 });

describe("GA4 Insights Trends campaign creation boundary", () => {
  it("uses the campaign reporting date when creation crosses a UTC midnight", () => {
    expect(getStartDate("2026-09-03T22:30:00.000Z", "Europe/Amsterdam")).toBe("2026-09-04");
    expect(getStartDate("2026-09-03T22:30:00.000Z", "America/New_York")).toBe("2026-09-03");
    expect(getStartDate(null, "Europe/Amsterdam")).toBe("");
    expect(getStartDate("invalid", "Europe/Amsterdam")).toBe("");
  });

  it("excludes dates before creation and leaves unrecorded dates unavailable", () => {
    const startDate = getStartDate("2026-09-08T10:06:04.469Z", "Europe/Amsterdam");
    const coverage = {
      startDate: "2026-08-18",
      dailyRows: [row("2026-09-07", 39), row("2026-09-09", 38), row("2026-09-10", 38), row("2026-09-12", 74), row("2026-09-13", 36), row("2026-09-14", 32), row("2026-09-15", 31), row("2026-09-16", 34)],
      zeroDates: ["2026-08-18", "2026-09-08", "2026-09-11"],
    };
    const rows = buildRows(coverage.dailyRows, "2026-09-16", startDate);
    expect(rows.map((item) => item.date)).toEqual(coverage.dailyRows.slice(1).map(item => item.date));
    expect(rows.find((item) => item.date === "2026-09-08")).toBeUndefined();
    expect(rows.find((item) => item.date === "2026-09-11")).toBeUndefined();
    expect(importedRows(coverage.dailyRows, startDate, "2026-09-16").map((item) => item.date)).toEqual(coverage.dailyRows.slice(1).map((item) => item.date));

    const rollups = buildGA4InsightsRollups(rows, "2026-09-16");
    expect(rollups.last7.complete).toBe(false);
    expect(rollups.prior7.complete).toBe(false);
    expect(rollups.prior7.days).toBe(1);
    expect(rollups.last30.complete).toBe(false);
    expect(buildGA4InsightsMonthlySeries(rows, "2026-09-16", "sessions").map((month) => ({ month: month.month, value: month.value, partial: month.partial }))).toEqual([
      { month: "2026-09", value: 283, partial: true },
    ]);
    expect(page).toContain('insightsTrendMode === "monthly"\n                            ? availableMonths >= 1');
    expect(page).not.toContain("monthValues.length < 2");
    expect(page).toContain('comparable ? "No % baseline" : "Not comparable"');
  });

  it("renders missing dates as gaps and fails closed without a creation date", () => {
    const rows = [row("2026-09-03", 10), row("2026-09-04", 30), row("2026-09-06", 34)];
    expect(buildRows(rows, "2026-09-06", "2026-09-04")).toEqual([
      row("2026-09-04", 30),
      row("2026-09-06", 34),
    ]);
    expect(buildRows(rows, "2026-09-16", "")).toEqual([]);
    expect(importedRows(rows, "", "2026-09-16")).toEqual([]);
    const chart = dailyChart([row("2026-09-09", 38), row("2026-09-10", 38)], "2026-09-08");
    expect(chart.chartData.map((point) => point.date)).toEqual(["09-08", "09-09", "09-10"]);
    expect(chart.chartData.map((point) => point.value)).toEqual([null, 38, 38]);
  });

  it("keeps recorded rows bounded by creation and the completed-day cutoff", () => {
    const rows = buildRows([row("2026-09-09", 38), row("2026-09-17", 8)], "2026-09-17", "2026-09-08");
    expect(rows).toHaveLength(2);
    expect(rows.filter((item) => item.sessions === 0)).toEqual([]);
  });

  it("renders Campaign3 from Sep 22 through Sep 24 with explicit zero points", () => {
    expect(buildRows([row("2026-09-22", 127), row("2026-09-23", 0), row("2026-09-24", 0)], "2026-09-24", "2026-09-22").map((item) => ({ date: item.date, sessions: item.sessions }))).toEqual([
      { date: "2026-09-22", sessions: 127 },
      { date: "2026-09-23", sessions: 0 },
      { date: "2026-09-24", sessions: 0 },
    ]);
  });
});
