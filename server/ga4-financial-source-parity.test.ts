import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 downstream financial-source parity", () => {
  it("selects the greatest native revenue candidate without mixing conversions", () => {
    const toDate = { revenue: 100, conversions: 4, source: "to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    const breakdown = { revenue: 175, conversions: 30, source: "breakdown" };
    expect(selectGA4FinancialTotalsSource([toDate, daily, breakdown], toDate)).toBe(daily);
  });

  it("keeps candidate order authoritative when native revenue ties", () => {
    const toDate = { revenue: 250, conversions: 4, source: "to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    expect(selectGA4FinancialTotalsSource([toDate, daily], toDate)).toBe(toDate);
  });

  it("uses the shared ordered selector in Overview, outcome totals, and campaign current values", () => {
    const overview = read("client/src/pages/ga4-metrics.tsx");
    const outcome = read("server/routes-oauth.ts");
    const campaign = read("server/utils/campaign-current-values.ts");
    for (const source of [overview, outcome, campaign]) {
      expect(source).toContain("selectGA4FinancialTotalsSource([");
    }
    expect(overview.indexOf("ga4ToDateOverviewTotals,")).toBeLessThan(overview.indexOf("dailySummedTotals,"));
    expect(outcome.indexOf("toDateFinancialCandidate || {}")).toBeLessThan(outcome.indexOf("persistedFinancialCandidate || {}"));
    expect(campaign.indexOf("toDateCandidate || {}")).toBeLessThan(campaign.indexOf("dailyCandidate,"));
  });

  it("limits provider candidate reads to campaign financial metrics and isolates cache variants", () => {
    const campaign = read("server/utils/campaign-current-values.ts");
    expect(campaign).toContain('["revenue", "profit", "roas", "roi", "cpa"]');
    expect(campaign).toContain("} else if (useFullFinancialCandidate) {");
    expect(campaign).toContain('useFullFinancialCandidate ? "financial" : "base"');
    expect(campaign).toContain('storage.getRevenueTotalForRange(campaignId, financialSourceStartDate, endDate, "ga4")');
    expect(campaign).toContain("storage.getSpendTotalForRange(campaignId, financialSourceStartDate, endDate)");
    expect(campaign).not.toContain("pipelineTotalToDate");
  });

  it("keeps all five financial formulas on selected native plus materialized imported revenue", () => {
    const campaign = read("server/utils/campaign-current-values.ts");
    expect(campaign).toContain("revenue: round2(ga4Revenue + parseNum((revenueTotals as any)?.totalRevenue))");
    expect(campaign).toContain('if (sourceId === "ga4" && inputKey === "revenue") return totals.ga4Revenue');
    expect(campaign).toContain('if (metric === "revenue")');
    expect(campaign).toContain('if (metric === "profit")');
    expect(campaign).toContain('if (metric === "roas")');
    expect(campaign).toContain('if (metric === "roi")');
    expect(campaign).toContain('if (metric === "cpa")');
    expect(campaign).toContain("sumSelectedFinancialConversions(cfg?.inputs?.conversions, totals)");
    const outcome = read("server/routes-oauth.ts");
    const deepDive = read("client/src/pages/campaign-detail.tsx");
    expect(outcome).toContain("const financials = {");
    expect(outcome).toContain("nativeRevenue: onsiteRevenue");
    expect(outcome).toContain("importedRevenue: parseFloat(offsiteRevenueTotal.toFixed(2))");
    expect(deepDive).toContain("(outcomeTotals as any)?.financials?.totalRevenue");
    expect(deepDive).toContain("financials?.nativeRevenue");
  });
});
