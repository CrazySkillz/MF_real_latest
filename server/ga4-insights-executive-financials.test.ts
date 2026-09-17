import { describe, expect, it } from "vitest";
import { resolveGA4InsightsExecutiveFinancials } from "../client/src/lib/ga4-insights-executive-financials";

describe("GA4 Insights Executive Financials source detail fallback", () => {
  it("uses the scoped spend total and complete source names when all responses succeed", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 338, sourceIds: ["csv", "sheet"] },
      spendBreakdown: { totalSpend: 338 },
      spendDisplaySources: [
        { sourceId: "csv", displayName: "csv_spend_updated.csv" },
        { sourceId: "sheet", displayName: "Google Sheets" },
      ],
      revenueToDate: { totalRevenue: 57676.9, sourceIds: ["imported"] },
      revenueDisplaySources: [{ sourceId: "imported", displayName: "Imported Revenue" }],
      hasNativeRevenueMetric: true,
    });

    expect(result).toEqual({
      spend: 338,
      spendAvailable: true,
      spendSourceLabels: ["csv_spend_updated.csv", "Google Sheets"],
      revenueSourceLabels: ["GA4 native revenue", "Imported Revenue"],
    });
  });

  it("does not turn a successful spend-to-date response into zero when source details fail", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 338, sourceIds: ["csv", "sheet"] },
      spendDetailsError: true,
      revenueToDate: { totalRevenue: 57676.9, sourceIds: ["csv", "sheet", "crm"] },
      revenueDetailsError: true,
      hasNativeRevenueMetric: true,
    });

    expect(result.spend).toBe(338);
    expect(result.spendAvailable).toBe(true);
    expect(result.spendSourceLabels).toEqual(["Source details unavailable (2 sources)"]);
    expect(result.revenueSourceLabels).toEqual([
      "GA4 native revenue", "Imported source details unavailable (3 sources)",
    ]);
  });

  it("distinguishes a connected valid zero from unavailable source details", () => {
    const zero = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 0, sourceIds: ["csv"] },
      spendDisplaySources: [{ sourceId: "csv", displayName: "CSV spend" }],
      revenueToDate: { totalRevenue: 0, sourceIds: ["rev"] },
      revenueDisplaySources: [{ sourceId: "rev", displayName: "CSV revenue" }],
      hasNativeRevenueMetric: true,
    });
    expect(zero.spend).toBe(0);
    expect(zero.spendAvailable).toBe(true);
    expect(zero.spendSourceLabels).toEqual(["CSV spend"]);
    expect(zero.revenueSourceLabels).toEqual(["GA4 native revenue", "CSV revenue"]);

    const unavailable = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 0, sourceIds: [] },
      spendDetailsError: true,
      revenueToDate: { totalRevenue: 0, sourceIds: [] },
      revenueDetailsError: true,
      hasNativeRevenueMetric: true,
    });
    expect(unavailable.spendAvailable).toBe(false);
    expect(unavailable.spendSourceLabels).toEqual(["Source details unavailable"]);
    expect(unavailable.revenueSourceLabels).toEqual([
      "GA4 native revenue", "Imported source details unavailable",
    ]);
  });

  it("uses a successful spend breakdown when the to-date response is unavailable", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      spendBreakdown: {
        totalSpend: 38,
        sources: [{ sourceId: "csv" }],
      },
      spendDisplaySources: [{ sourceId: "csv", displayName: "CSV spend" }],
      hasNativeRevenueMetric: false,
    });
    expect(result.spend).toBe(38);
    expect(result.spendAvailable).toBe(true);
    expect(result.spendSourceLabels).toEqual(["CSV spend"]);
    expect(result.revenueSourceLabels).toEqual([]);
  });

  it("prefers a fresh spend total over a stale cached breakdown after refresh failure", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 348, sourceIds: ["new"] },
      spendBreakdown: { totalSpend: 338, sources: [{ sourceId: "old" }] },
      spendDisplaySources: [{ sourceId: "old", displayName: "Old source" }],
      spendSourceDefinitions: [{ id: "new", displayName: "Updated source" }],
      spendBreakdownError: true,
      hasNativeRevenueMetric: true,
    });
    expect(result.spend).toBe(348);
    expect(result.spendSourceLabels).toEqual(["Updated source"]);
  });

  it("preserves source-definition labels on the normal path and uses breakdown labels if to-date fails", () => {
    const input = {
      spendToDate: { spendToDate: 38, sourceIds: ["csv"] },
      spendBreakdown: { totalSpend: 38, sources: [{ sourceId: "csv" }] },
      spendDisplaySources: [{ sourceId: "csv", displayName: "Breakdown label" }],
      spendSourceDefinitions: [{ id: "csv", displayName: "Saved source label" }],
      hasNativeRevenueMetric: false,
    };
    expect(resolveGA4InsightsExecutiveFinancials(input).spendSourceLabels).toEqual(["Saved source label"]);
    expect(resolveGA4InsightsExecutiveFinancials({
      ...input,
      spendToDateError: true,
    }).spendSourceLabels).toEqual(["Breakdown label"]);
  });

  it("names known contributors and marks only missing source names unavailable", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      spendToDate: { spendToDate: 338, sourceIds: ["csv", "sheet"] },
      spendDisplaySources: [{ sourceId: "csv", displayName: "CSV spend" }],
      revenueToDate: { totalRevenue: 100, sourceIds: ["csv", "crm"] },
      revenueDisplaySources: [{ sourceId: "csv", displayName: "CSV revenue" }],
      hasNativeRevenueMetric: true,
    });
    expect(result.spendSourceLabels).toEqual([
      "CSV spend", "Source details unavailable (1 source)",
    ]);
    expect(result.revenueSourceLabels).toEqual([
      "GA4 native revenue", "CSV revenue", "Imported source details unavailable (1 source)",
    ]);
  });
});
