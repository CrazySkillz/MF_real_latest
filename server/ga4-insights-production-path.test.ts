import { describe, expect, it } from "vitest";
import {
  buildGA4InsightsCalendarRollup,
  buildGA4InsightsMonthlySeries,
  buildGA4InsightsRollups,
  normalizeGA4InsightsDailyRows,
} from "../shared/ga4-insights";

const rows = (start: string, days: number) => Array.from({ length: days }, (_, index) => {
  const date = new Date(`${start}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + index);
  return {
    date: date.toISOString().slice(0, 10),
    sessions: index + 1,
    users: index + 1,
    conversions: 1,
    revenue: 10,
    pageviews: (index + 1) * 2,
    engagementRate: 0.5,
  };
});

describe("GA4 Insights production calendar paths", () => {
  it("uses exact calendar boundaries instead of the last N returned rows", () => {
    const input = rows("2026-06-03", 60).filter((row) => row.date !== "2026-07-27");
    const result = buildGA4InsightsRollups(input, "2026-08-01");

    expect(result.last7.startDate).toBe("2026-07-26");
    expect(result.last7.endDate).toBe("2026-08-01");
    expect(result.last7.days).toBe(6);
    expect(result.last7.complete).toBe(false);
    expect(result.prior7.startDate).toBe("2026-07-19");
    expect(result.prior7.endDate).toBe("2026-07-25");
    expect(result.prior7.complete).toBe(true);
  });

  it("supports two complete 30-day windows when 60 completed days are returned", () => {
    const result = buildGA4InsightsRollups(rows("2026-06-03", 60), "2026-08-01");

    expect(result.last30.complete).toBe(true);
    expect(result.prior30.complete).toBe(true);
    expect(result.last30.startDate).toBe("2026-07-03");
    expect(result.prior30.startDate).toBe("2026-06-03");
    expect(result.prior30.endDate).toBe("2026-07-02");
  });

  it("excludes intraday and duplicate rows before calculating", () => {
    const normalized = normalizeGA4InsightsDailyRows([
      { date: "2026-08-01", sessions: 1 },
      { date: "2026-08-01", sessions: 4 },
      { date: "2026-08-02", sessions: 99 },
    ], "2026-08-01");
    const result = buildGA4InsightsCalendarRollup(normalized, "2026-08-01", 1);

    expect(normalized).toHaveLength(1);
    expect(result.sessions).toBe(4);
    expect(result.complete).toBe(true);
  });

  it("preserves valid zero as a complete observed day", () => {
    const result = buildGA4InsightsRollups([
      { date: "2026-08-01", sessions: 0, conversions: 0, revenue: 0 },
    ], "2026-08-01");

    expect(result.last3.days).toBe(1);
    expect(result.last3.sessions).toBe(0);
    expect(result.last3.complete).toBe(false);
  });

  it("uses the completed-day cutoff for monthly completeness and comparisons", () => {
    const result = buildGA4InsightsMonthlySeries(rows("2026-06-03", 60), "2026-08-01", "sessions");

    expect(result.map((month) => ({
      month: month.month,
      days: month.days,
      expectedDays: month.expectedDays,
      partial: month.partial,
    }))).toEqual([
      { month: "2026-06", days: 28, expectedDays: 30, partial: true },
      { month: "2026-07", days: 31, expectedDays: 31, partial: false },
      { month: "2026-08", days: 1, expectedDays: 1, partial: true },
    ]);
  });
});
