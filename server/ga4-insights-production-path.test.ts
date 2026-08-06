import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertGA4InsightsFinancialCurrencyScope,
  buildGA4InsightsHistoryScopeMarker,
  buildGA4InsightsCalendarRollup,
  areGA4InsightsMonthsAdjacent,
  buildGA4InsightsMonthlySeries,
  buildGA4InsightsRollups,
  buildGA4InsightsSpendSourceLabels,
  calculateGA4InsightsDeltaPct,
  countGA4InsightsConsecutiveDays,
  filterGA4InsightsHistoryByScope,
  hasGA4InsightsAnalyticsHistory,
  isGA4InsightsAnalyticsHistoryInSelectedPropertyScope,
  normalizeGA4InsightsDailyRows,
  resolveGA4InsightsCampaignToDateSufficiencyReason,
  resolveGA4InsightsRevenueWindowState,
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
  it("treats a missing completed GA4 day as insufficient native revenue rather than a missing connection", () => {
    expect(resolveGA4InsightsRevenueWindowState({
      noCompletedWindow: true,
      hasImportedRevenueSource: false,
      revenueMetricAvailable: false,
    })).toEqual({
      awaitingFirstCompletedDay: true,
      missingRevenueDependency: false,
      sufficiencyReason: "No completed GA4 reporting day is available for native revenue yet.",
      unavailableLabel: "No completed GA4 day",
    });

    expect(resolveGA4InsightsRevenueWindowState({
      noCompletedWindow: true,
      hasImportedRevenueSource: true,
      revenueMetricAvailable: true,
    })).toMatchObject({
      awaitingFirstCompletedDay: false,
      missingRevenueDependency: false,
      sufficiencyReason: null,
    });
    expect(resolveGA4InsightsCampaignToDateSufficiencyReason({
      noCompletedWindow: true,
      hasImportedRevenueSource: true,
      metric: "CPA",
    })).toContain("No completed GA4 reporting day");
    expect(resolveGA4InsightsCampaignToDateSufficiencyReason({
      noCompletedWindow: true,
      hasImportedRevenueSource: true,
      metric: "Revenue",
    })).toBeNull();
  });

  it("fails closed for missing or mixed native/imported financial currencies", () => {
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [], "EUR", "GA4 native revenue", true)).not.toThrow();
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [], null, "GA4 native revenue", true)).toThrow("currency is unavailable");
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [{ currency: "EUR", isActive: true }], "EUR", "Revenue")).not.toThrow();
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [{ currency: "USD", isActive: true }], "EUR", "Revenue")).toThrow("does not match campaign currency EUR");
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [{ sourceType: "csv", currency: null, isActive: true }], null, "Spend")).toThrow("source currency is unavailable");
  });

  it("fails closed when a disabled-release connector is stored in GA4 Insights scope", () => {
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [
      { sourceType: "ad_platforms", currency: "EUR", mappingConfig: JSON.stringify({ platform: "google_ads" }) },
      { sourceType: "csv", currency: "EUR" },
      { sourceType: "google_sheets", currency: "EUR" },
    ], "EUR", "Spend")).toThrow("outside the current GA4 Insights release scope");
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [
      { sourceType: "ad_platforms", currency: "EUR", mappingConfig: JSON.stringify({ platform: "meta" }) },
    ], "EUR", "Spend")).toThrow("outside the current GA4 Insights release scope");
    expect(() => assertGA4InsightsFinancialCurrencyScope({ currency: "EUR" }, [
      { sourceType: "instagram_api", currency: "EUR" },
    ], "EUR", "Imported revenue")).toThrow("outside the current GA4 Insights release scope");
  });

  it("does not treat scattered imported rows as two complete 7-day windows", () => {
    const input = [
      "2026-08-04", "2026-07-12", "2026-07-10", "2026-07-09", "2026-07-08",
      "2026-07-06", "2026-07-05", "2026-07-04", "2026-07-03", "2026-07-02",
      "2026-07-01", "2026-06-30", "2026-06-29", "2026-06-28", "2026-06-27",
      "2026-06-26", "2026-06-25", "2026-06-24", "2026-06-23", "2026-06-22",
      "2026-06-21",
    ].map((date) => ({ date, sessions: 1 }));

    const result = buildGA4InsightsRollups(input, "2026-08-04");

    expect(input).toHaveLength(21);
    expect(result.last7).toMatchObject({
      startDate: "2026-07-29", endDate: "2026-08-04", days: 1, expectedDays: 7, complete: false,
    });
    expect(result.prior7).toMatchObject({
      startDate: "2026-07-22", endDate: "2026-07-28", days: 0, expectedDays: 7, complete: false,
    });
  });

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

  it("drops corrupt numeric daily rows instead of presenting them as valid zero", () => {
    const normalized = normalizeGA4InsightsDailyRows([
      { date: "2026-08-01", sessions: "invalid", conversions: 2 },
      { date: "2026-08-02", sessions: 0, conversions: 0, revenue: 0, pageviews: 0, users: 0, engagementRate: 0 },
    ], "2026-08-02");
    expect(normalized.map((row) => row.date)).toEqual(["2026-08-02"]);
    expect(normalized[0].sessions).toBe(0);
  });

  it("calculates visible deltas without reversing negative revenue direction", () => {
    expect(calculateGA4InsightsDeltaPct(100, 0)).toBe(100);
    expect(calculateGA4InsightsDeltaPct(-10, 0)).toBe(-100);
    expect(calculateGA4InsightsDeltaPct(20, -20)).toBe(200);
    expect(calculateGA4InsightsDeltaPct(-30, -20)).toBe(-50);
  });

  it("keeps valid-zero spend source provenance visible", () => {
    expect(buildGA4InsightsSpendSourceLabels(0, [], [
      { id: "source-1", displayName: "Budget CSV", isActive: true },
    ])).toEqual(["Budget CSV"]);
    expect(buildGA4InsightsSpendSourceLabels(50, ["source-2"], [
      { id: "source-1", displayName: "Unused source", isActive: true },
      { id: "source-2", displayName: "Contributing source", isActive: true },
    ])).toEqual(["Contributing source"]);
  });

  it("requires adjacent calendar dates before calling snapshots a day streak", () => {
    const points = [
      { recordedAt: "2026-08-04T04:00:00Z", value: 1 },
      { recordedAt: "2026-08-02T04:00:00Z", value: 1 },
      { recordedAt: "2026-08-01T04:00:00Z", value: 1 },
    ];
    expect(countGA4InsightsConsecutiveDays(points, (point) => point.recordedAt, () => true)).toBe(1);
    expect(countGA4InsightsConsecutiveDays(
      points.map((point, index) => ({ ...point, recordedAt: `2026-08-0${4 - index}T04:00:00Z` })),
      (point) => point.recordedAt,
      () => true,
    )).toBe(3);
  });

  it("distinguishes successful empty analytics responses from recorded history", () => {
    expect(hasGA4InsightsAnalyticsHistory({ progress: [] }, "progress")).toBe(false);
    expect(hasGA4InsightsAnalyticsHistory({ history: [{ recordedAt: "2026-08-04" }] }, "history")).toBe(true);
  });

  it("allows stored KPI and Benchmark history only for the selected primary property", () => {
    expect(isGA4InsightsAnalyticsHistoryInSelectedPropertyScope("properties/123", "123")).toBe(true);
    expect(isGA4InsightsAnalyticsHistoryInSelectedPropertyScope("properties/456", "properties/123")).toBe(false);
    expect(isGA4InsightsAnalyticsHistoryInSelectedPropertyScope("", "properties/123")).toBe(false);
  });

  it("withholds legacy and previous-filter KPI/Benchmark history from the current scope", () => {
    const current = buildGA4InsightsHistoryScopeMarker("properties/123", ["retargeting", "brand"]);
    const reordered = buildGA4InsightsHistoryScopeMarker("123", ["brand", "retargeting", "brand"]);
    const previous = buildGA4InsightsHistoryScopeMarker("123", ["old_campaign"]);
    const rows = [
      { id: "legacy", notes: "auto:ga4_daily:2026-08-01" },
      { id: "previous", notes: `auto:ga4_daily:2026-08-02;${previous}` },
      { id: "current", notes: `auto:ga4_daily:2026-08-03;${current}` },
    ];

    expect(reordered).toBe(current);
    expect(buildGA4InsightsHistoryScopeMarker("123", ["brand", "retargeting"], "Europe/Amsterdam", "USD")).not.toBe(current);
    expect(buildGA4InsightsHistoryScopeMarker("123", ["brand", "retargeting"], "UTC", "EUR")).not.toBe(current);
    expect(filterGA4InsightsHistoryByScope(rows, current).map((row) => row.id)).toEqual(["current"]);
  });

  it("atomically removes absent provider dates inside only the requested campaign/property window", () => {
    const source = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const start = source.indexOf("async replaceGA4DailyMetricsWindow");
    const end = source.indexOf("async getGA4DailyMetrics", start);
    const method = source.slice(start, end);

    expect(method).toContain("await db.transaction(async (tx: any) =>");
    expect(method).toContain("eq(ga4DailyMetrics.campaignId, cid)");
    expect(method).toContain("eq(ga4DailyMetrics.propertyId, pid)");
    expect(method).toContain("ga4DailyMetrics.date} >= ${start} AND ${ga4DailyMetrics.date} <= ${end}");
    expect(method.indexOf("await tx.delete(ga4DailyMetrics)")).toBeLessThan(method.indexOf("await tx.insert(ga4DailyMetrics)"));
    expect(method).toContain('if (normalizedRows.some((row) => !row)) throw new Error("GA4 daily replacement contains an invalid metric value")');
    expect(method.indexOf("GA4 daily replacement contains an invalid metric value")).toBeLessThan(method.indexOf("await db.transaction"));
    expect(method).toContain("if (scoped.length !== inputRows.length)");
    expect(method).toContain('throw new Error("GA4 daily replacement row scope mismatch")');
  });

  it("compares only adjacent calendar months", () => {
    expect(areGA4InsightsMonthsAdjacent("2026-08", "2026-07")).toBe(true);
    expect(areGA4InsightsMonthsAdjacent("2027-01", "2026-12")).toBe(true);
    expect(areGA4InsightsMonthsAdjacent("2026-08", "2026-06")).toBe(false);
  });

  it("preserves explicit zero engaged sessions and derives only a genuinely missing value", () => {
    const result = buildGA4InsightsCalendarRollup(normalizeGA4InsightsDailyRows([
      { date: "2026-08-01", sessions: 100, engagedSessions: 0, engagementRate: 0.75 },
      { date: "2026-08-02", sessions: 100, engagedSessions: null, engagementRate: 0.5 },
    ], "2026-08-02"), "2026-08-02", 2);

    expect(result.engagedSessions).toBe(50);
    expect(result.engagementRate).toBe(25);
    expect(result.complete).toBe(true);
  });

  it("calculates every visible rollup metric from the actual shared production function", () => {
    const result = buildGA4InsightsCalendarRollup(normalizeGA4InsightsDailyRows([
      { date: "2026-08-01", sessions: 100, users: 80, conversions: 5, revenue: 120, pageviews: 240, engagedSessions: 40 },
      { date: "2026-08-02", sessions: 50, users: 45, conversions: 10, revenue: 80, pageviews: 60, engagedSessions: 30 },
    ], "2026-08-02"), "2026-08-02", 2);

    expect(result).toMatchObject({
      sessions: 150, users: 125, conversions: 15, revenue: 200, pageviews: 300,
      engagedSessions: 70, cr: 10, pvps: 2, engagementRate: 70 / 1.5,
      days: 2, expectedDays: 2, complete: true,
    });
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
