import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { selectGA4FinancialTotalsSource } from "../shared/ga4-financial-source";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 downstream financial-source parity", () => {
  it("keeps campaign-to-date authoritative instead of selecting the greatest incompatible-window revenue", () => {
    const toDate = { revenue: 100, conversions: 4, source: "to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    const breakdown = { revenue: 175, conversions: 30, source: "breakdown" };
    expect(selectGA4FinancialTotalsSource([toDate, daily, breakdown], toDate)).toBe(toDate);
  });

  it("preserves valid zero and negative campaign-to-date adjustments", () => {
    const zero = { revenue: 0, conversions: 0, source: "zero-to-date" };
    const negative = { revenue: -25, conversions: 1, source: "negative-to-date" };
    const daily = { revenue: 250, conversions: 9, source: "daily" };
    expect(selectGA4FinancialTotalsSource([zero, daily], daily)).toBe(zero);
    expect(selectGA4FinancialTotalsSource([negative, daily], daily)).toBe(negative);
  });

  it("falls through provider-empty candidates in declared order", () => {
    const daily = { revenue: 0, conversions: 0, source: "daily" };
    const breakdown = { revenue: 175, conversions: 30, source: "breakdown" };
    expect(selectGA4FinancialTotalsSource([{}, { sessions: 20, users: 10 }, null, daily, breakdown], breakdown)).toBe(daily);
  });

  it("uses the shared ordered selector in Overview, outcome totals, and campaign current values", () => {
    const overview = read("client/src/pages/ga4-metrics.tsx");
    const outcome = read("server/routes-oauth.ts");
    const campaign = read("server/utils/campaign-current-values.ts");
    expect(overview).toContain("selectGA4FinancialTotalsSource(ga4FinancialCandidates");
    for (const source of [outcome, campaign]) expect(source).toContain("selectGA4FinancialTotalsSource([");
    expect(overview.indexOf("(ga4ToDateResp as any)?.totals,")).toBeLessThan(overview.indexOf("ga4DailyRows.length > 0 ? dailySummedTotals : null"));
    expect(outcome.indexOf("toDateFinancialCandidate,")).toBeLessThan(outcome.indexOf("persistedFinancialCandidate,"));
    expect(campaign.indexOf("toDateCandidate,")).toBeLessThan(campaign.indexOf("financialRows.length > 0 ? dailyCandidate : null"));
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
