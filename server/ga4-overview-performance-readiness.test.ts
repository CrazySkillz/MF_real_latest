import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const overview = read("client", "src", "pages", "ga4-metrics.tsx");
const performance = read("client", "src", "pages", "campaign-performance.tsx");
const campaignDetail = read("client", "src", "pages", "campaign-detail.tsx");
const routes = read("server", "routes-oauth.ts");
const analytics = read("server", "analytics.ts");
const scheduler = read("server", "report-scheduler.ts");
const scheduledOverviewPdf = read("server", "ga4-scheduled-report-pdf.ts");

const slice = (source: string, startText: string, endText: string) => {
  const start = source.indexOf(startText);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endText, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("GA4 Overview Performance readiness contract", () => {
  it("keeps the four formulas finite at valid and zero-denominator boundaries", () => {
    const revenue = 102_980.6;
    const spend = 338;
    const conversions = 251;

    expect(revenue - spend).toBeCloseTo(102_642.6, 10);
    expect(revenue / spend).toBeCloseTo(304.6763313609467, 10);
    expect(computeRoiPercent(revenue, spend)).toBeCloseTo(30_367.633136094674, 10);
    expect(computeCpa(spend, conversions)).toBeCloseTo(1.346613545816733, 10);
    expect(computeRoiPercent(revenue, 0)).toBe(0);
    expect(computeCpa(spend, 0)).toBe(0);
    expect(computeRoiPercent(Number.NaN, Number.POSITIVE_INFINITY)).toBe(0);
    expect(computeCpa(Number.POSITIVE_INFINITY, Number.NaN)).toBe(0);
  });

  it("sources CPA conversions from the campaign-scoped GA4 financial response, not Summary conversions", () => {
    const route = slice(
      routes,
      'app.get("/api/campaigns/:id/ga4-to-date"',
      "// Benchmark-read-only GA4 input validation",
    );
    const provider = slice(analytics, "async getTotalsWithRevenue(", "async getOverviewDimensionDiagnostics(");
    const overviewFinancials = slice(overview, "const ga4FinancialCandidates", "const overviewVisibleDataUsingLastGoodData");

    expect(route).toContain("ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(route).toContain("storage.getGA4Connection(campaignId, pid)");
    expect(route).toContain("startDateUsed");
    expect(route).toContain("endDateUsed");
    expect(route).toContain("campaignFilter");
    expect(route).toContain("campaignCurrency");
    expect(provider).toContain("{ name: 'conversions' }");
    expect(provider).toContain("const conversions = parseInt(String(mv?.[2]?.value || '0'), 10) || 0;");
    expect(overviewFinancials).toContain("const financialConversions = Number(ga4FinancialTotalsSource.conversions || 0);");
    expect(overviewFinancials).not.toContain("overviewSummaryTotals.conversions");
    expect(performance).toContain("const scoringFinancialConversions = demoMode");
    expect(performance).toContain(": Number(performanceGA4RevenueResponse?.native?.totals?.conversions);");
    expect(performance).not.toContain("const financialConversionsInputState: GA4KpiInputState = trafficInputState;");
  });

  it("renders zero-denominator states consistently in the cards and both Overview PDF paths", () => {
    const cards = slice(overview, '<h4 className="text-sm font-semibold text-foreground mb-2">Performance</h4>', "{/* Campaign Breakdown */}");
    const browserPdf = slice(overview, "if (includeOverviewPerformance)", "if (includeOverviewCampaignBreakdown)");
    const serverPdf = slice(scheduledOverviewPdf, "if (includePerformance)", "if (includeCampaignBreakdown)");

    expect(cards).toContain('financialSpend > 0 ? `${financialROAS.toFixed(2)}x` : "—"');
    expect(cards).toContain('financialSpend > 0 ? formatPercentage(financialROI) : "—"');
    expect(cards).toContain('financialSpend > 0 && Number(financialConversions || 0) > 0 ? formatMoney(Number(financialCPA || 0)) : "—"');
    expect(browserPdf).toContain('["ROAS", spend > 0 ? `${Number(financialROAS || 0).toFixed(2)}x` : "—"]');
    expect(browserPdf).toContain('["ROI", spend > 0 ? fP(roi) : "—"]');
    expect(browserPdf).toContain('["CPA", spend > 0 && convTot > 0 ? fC(cpa) : "—"]');
    expect(serverPdf).toContain('["ROAS", payload.financialSpend > 0 ? `${Number(payload.financialROAS || 0).toFixed(2)}x` : "—"]');
    expect(serverPdf).toContain('["ROI", payload.financialSpend > 0 ? formatPct(payload.financialROI) : "—"]');
    expect(serverPdf).toContain('["CPA", payload.financialSpend > 0 && payload.financialConversions > 0 ? formatMoney(payload.financialCPA) : "—"]');
  });

  it("propagates paired financial conversions to DeepDive, KPI, Benchmark, and scheduled Report CPA consumers", () => {
    expect(performance).toContain("financialConversions: scoringFinancialConversions");
    expect(performance).toContain("financialConversionsState: financialConversionsInputState,");
    expect(overview).toContain("financialConversionsState: financialConversionsKpiInputState,");
    expect(campaignDetail).toContain("parseNumSafe(financials?.conversions ?? getUnifiedConversions())");
    expect(campaignDetail).not.toContain("parseNumSafe(financials?.conversions) || getUnifiedConversions()");
    expect(campaignDetail).not.toContain("parseNumSafe((kpiConnectedPlatformTotals as any)?.conversions) || getUnifiedConversions()");
    expect(campaignDetail).not.toContain("parseNumSafe((benchConnectedPlatformTotals as any)?.conversions) || getUnifiedConversions()");
    expect(scheduler).toContain("const performanceFinancialConversionsAvailable = performancePageTotals?.financialConversionsAvailable === true");
    expect(scheduler).toContain("financialConversions: performanceFinancialConversions");
    expect(scheduler).toContain("financialConversionsState: performanceFinancialConversionsAvailable ? \"ready\" : \"unavailable\"");
  });

  it("keeps downstream Insights report zero-denominator formatting unavailable", () => {
    expect(overview).toContain('["ROAS", financialSpend > 0 ? `${Number(financialROAS || 0).toFixed(2)}x` : "—"]');
    expect(overview).toContain('["ROI", financialSpend > 0 ? fP(Number(financialROI || 0)) : "—"]');
    expect(scheduledOverviewPdf).toContain('["ROAS", payload.financialSpend > 0 ? `${Number(payload.financialROAS || 0).toFixed(2)}x` : "—"]');
    expect(scheduledOverviewPdf).toContain('payload.financialSpend > 0 && payload.financialConversions > 0 ? [["CPA", formatMoney(payload.financialCPA), ""]] : []');
  });
});
