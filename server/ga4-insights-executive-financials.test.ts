import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolveGA4InsightsExecutiveFinancials } from "../client/src/lib/ga4-insights-executive-financials";

describe("GA4 Insights Executive Financials Overview inputs", () => {
  it("renders the Overview financial values without replacing them inside Executive Financials", () => {
    const page = readFileSync(new URL("../client/src/pages/ga4-metrics.tsx", import.meta.url), "utf8");
    const start = page.indexOf("const executive = resolveGA4InsightsExecutiveFinancials({");
    const end = page.indexOf("{/* Trends card", start);
    const section = page.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(section).toContain("overviewSpend: financialSpend");
    expect(section).toContain("overviewSpendAvailable: financialSpendAvailable");
    expect(section).toContain("formatMoney(Number(financialSpend || 0))");
    expect(section).toContain("formatMoney(Number(financialRevenue || 0))");
    expect(section).toContain("formatMoney(financialRevenue - financialSpend)");
    expect(section).toContain("Number(financialROAS || 0).toFixed(2)");
    expect(section).toContain("formatPercentage(Number(financialROI || 0))");
    expect(section).not.toMatch(/const financial(?:Spend|Revenue|ROAS|ROI)\s*=/);
  });

  it("keeps complete source names when all Overview responses succeed", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 338,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendToDate: { spendToDate: 338, sourceIds: ["csv", "sheet"] },
      spendBreakdown: { totalSpend: 338, sources: [{ sourceId: "csv" }, { sourceId: "sheet" }] },
      spendDisplaySources: [
        { sourceId: "csv", displayName: "csv_spend_updated.csv" },
        { sourceId: "sheet", displayName: "Google Sheets" },
      ],
      revenueToDate: { totalRevenue: 57676.9, sourceIds: ["imported"] },
      revenueDisplaySources: [{ sourceId: "imported", displayName: "Imported Revenue" }],
      hasNativeRevenueMetric: true,
    });

    expect(result).toEqual({
      spendAvailable: true,
      spendSourceLabels: ["csv_spend_updated.csv", "Google Sheets"],
      revenueSourceLabels: ["GA4 native revenue", "Imported Revenue"],
    });
  });

  it("withholds an unverified Overview zero when source details fail", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 0,
      overviewSpendAvailable: true,
      overviewHasSpendSources: false,
      spendToDate: { spendToDate: 338, sourceIds: ["csv", "sheet"] },
      spendDetailsError: true,
      revenueToDate: { totalRevenue: 57676.9, sourceIds: ["csv", "sheet", "crm"] },
      revenueDetailsError: true,
      hasNativeRevenueMetric: true,
    });

    expect(result.spendAvailable).toBe(false);
    expect(result.spendSourceLabels).toEqual(["Source details unavailable (2 sources)"]);
    expect(result.revenueSourceLabels).toEqual([
      "GA4 native revenue", "Imported source details unavailable (3 sources)",
    ]);
  });

  it("distinguishes a connected valid zero from unavailable source details", () => {
    const zero = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 0,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendToDate: { spendToDate: 0, sourceIds: ["csv"] },
      spendDisplaySources: [{ sourceId: "csv", displayName: "CSV spend" }],
      revenueToDate: { totalRevenue: 0, sourceIds: ["rev"] },
      revenueDisplaySources: [{ sourceId: "rev", displayName: "CSV revenue" }],
      hasNativeRevenueMetric: true,
    });
    expect(zero.spendAvailable).toBe(true);
    expect(zero.spendSourceLabels).toEqual(["CSV spend"]);
    expect(zero.revenueSourceLabels).toEqual(["GA4 native revenue", "CSV revenue"]);

    const unavailable = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 0,
      overviewSpendAvailable: true,
      overviewHasSpendSources: false,
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
      overviewSpend: 38,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendBreakdown: {
        totalSpend: 38,
        sources: [{ sourceId: "csv" }],
      },
      spendDisplaySources: [{ sourceId: "csv", displayName: "CSV spend" }],
      hasNativeRevenueMetric: false,
    });
    expect(result.spendAvailable).toBe(true);
    expect(result.spendSourceLabels).toEqual(["CSV spend"]);
    expect(result.revenueSourceLabels).toEqual([]);
  });

  it("attributes the Overview spend to its cached breakdown when that response is stale", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 338,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendToDate: { spendToDate: 348, sourceIds: ["new"] },
      spendBreakdown: { totalSpend: 338, sources: [{ sourceId: "old" }] },
      spendDisplaySources: [{ sourceId: "old", displayName: "Old source" }],
      spendSourceDefinitions: [{ id: "new", displayName: "Updated source" }],
      spendDetailsError: true,
      hasNativeRevenueMetric: true,
    });
    expect(result.spendAvailable).toBe(true);
    expect(result.spendSourceLabels).toEqual(["Old source"]);
  });

  it("uses breakdown labels for a breakdown value and saved labels for a to-date value", () => {
    const input = {
      overviewSpend: 38,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendToDate: { spendToDate: 38, sourceIds: ["csv"] },
      spendBreakdown: { totalSpend: 38, sources: [{ sourceId: "csv" }] },
      spendDisplaySources: [{ sourceId: "csv", displayName: "Breakdown label" }],
      spendSourceDefinitions: [{ id: "csv", displayName: "Saved source label" }],
      hasNativeRevenueMetric: false,
    };
    expect(resolveGA4InsightsExecutiveFinancials(input).spendSourceLabels).toEqual(["Breakdown label"]);
    expect(resolveGA4InsightsExecutiveFinancials({
      ...input,
      spendBreakdown: undefined,
    }).spendSourceLabels).toEqual(["Saved source label"]);
  });

  it("does not name a positive breakdown value from unmatched source definitions", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 38,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
      spendBreakdown: { totalSpend: 38, sources: [] },
      spendToDate: { spendToDate: 38, sourceIds: ["csv"] },
      spendSourceDefinitions: [{ id: "csv", displayName: "Saved CSV" }],
      hasNativeRevenueMetric: false,
    });
    expect(result.spendAvailable).toBe(true);
    expect(result.spendSourceLabels).toEqual(["Source details unavailable"]);
  });

  it("names known contributors and marks only missing source names unavailable", () => {
    const result = resolveGA4InsightsExecutiveFinancials({
      overviewSpend: 338,
      overviewSpendAvailable: true,
      overviewHasSpendSources: true,
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
