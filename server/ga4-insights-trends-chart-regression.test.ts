import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { transpileModule, ScriptTarget } from "typescript";
import { addGA4InsightsDateDays, buildGA4InsightsCalendarRollup } from "../shared/ga4-insights";

const page = readFileSync(join(process.cwd(), "client/src/pages/ga4-metrics.tsx"), "utf8").replace(/\r\n/g, "\n");
const start = page.indexOf('const windowDays = insightsTrendMode === "7d" ? 7 : 30;', page.indexOf("{/* Trends line chart */}"));
const end = page.indexOf("\n                          }\n\n                          const fmtValue", start);
if (start < 0 || end < 0) throw new Error("Trends rolling-chart body not found");

// Execute the chart body used by the page, with synthetic daily rows that the live property lacks.
const body = transpileModule(`
  function chart(sorted: any[], insightsTrendMode: "7d" | "30d") {
    const metric = "sessions";
    const isRate = false;
    const complete7DayRows = sorted.filter((row) => buildGA4InsightsCalendarRollup(sorted, row.date, 7).complete);
    const complete30DayRows = sorted.filter((row) => buildGA4InsightsCalendarRollup(sorted, row.date, 30).complete);
    let chartData: { date: string; value: number | null; idx: number }[] = [];
    let rollingChartStartDate = "";
    let rollingChartEndDate = "";
    ${page.slice(start, end)}
    return { chartData, rollingChartStartDate, rollingChartEndDate };
  }
  return chart;
`, { compilerOptions: { target: ScriptTarget.ES2022 } }).outputText;
const chart = new Function("buildGA4InsightsCalendarRollup", "addGA4InsightsDateDays", body)(
  buildGA4InsightsCalendarRollup,
  addGA4InsightsDateDays,
) as (rows: { date: string; sessions: number }[], mode: "7d" | "30d") => {
  chartData: { date: string; value: number | null; idx: number }[];
  rollingChartStartDate: string;
  rollingChartEndDate: string;
};

const days = (startDate: string, count: number, step = 1) => Array.from({ length: count }, (_, index) => ({
  date: addGA4InsightsDateDays(startDate, index * step)!,
  sessions: 2,
}));

describe("Insights Trends rolling chart", () => {
  it("retains an older complete seven-day window after more than 14 later sparse rows", () => {
    const rows = [...days("2026-08-01", 7), ...days("2026-08-10", 15, 2)];
    const result = chart(rows, "7d");
    expect(result.chartData).toEqual([{ date: "08-07", value: 14, idx: 0 }]);
    expect(result.rollingChartStartDate).toBe("2026-08-01");
    expect(result.rollingChartEndDate).toBe("2026-08-07");
  });

  it("places null calendar dates between separate complete seven-day runs", () => {
    const rows = [...days("2026-08-01", 7), ...days("2026-08-15", 7)];
    const result = chart(rows, "7d");
    expect(result.chartData).toHaveLength(15);
    expect(result.chartData[0]).toEqual({ date: "08-07", value: 14, idx: 0 });
    expect(result.chartData.slice(1, -1).every((point) => point.value === null)).toBe(true);
    expect(result.chartData.at(-1)).toEqual({ date: "08-21", value: 14, idx: 14 });
    expect(page).toContain("connectNulls={false}");
    expect(page).toContain("chartData.some((point) => point.value === null) ? (");
    expect(page).toContain("dot={{ r: 3 }} connectNulls={false}");
  });

  it("retains an older complete thirty-day window when later days are sparse", () => {
    const rows = [...days("2026-07-01", 30), ...days("2026-08-01", 15, 2)];
    const result = chart(rows, "30d");
    expect(result.chartData).toEqual([{ date: "07-30", value: 60, idx: 0 }]);
  });
});
