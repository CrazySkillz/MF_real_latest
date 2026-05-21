import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Budget & Financial Analysis regression guard", () => {
  it("adds the shared performanceSummary aggregate contract for Budget & Financial tabs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");

    expect(page).toContain("const { data: outcomeTotals, isLoading: outcomeTotalsLoading } = useQuery<any>({");
    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days"');
    expect(page).toContain("outcome-totals?dateRange=90days");
    expect(page).toContain("const performanceSummary = outcomeTotals?.performanceSummary;");
    expect(page).toContain("const performanceSources = Array.isArray(performanceSummary?.sources) ? performanceSummary.sources : [];");
    expect(page).toContain("const aggregateMetric = (metricName: string) => performanceSummary?.totals?.[metricName];");
    expect(page).toContain("const aggregateMetricAvailable = (metricName: string) => aggregateMetric(metricName)?.available === true;");
    expect(page).toContain("const aggregateMetricValue = (metricName: string): number | null => {");
    expect(page).toContain("const aggregateMetricSources = (metricName: string): string[] => {");
    expect(page).toContain("const aggregateMetricUnavailableReasons = (metricName: string): string[] => {");
    expect(page).toContain("void budgetFinancialAggregate;");
  });

  it("wires the Overview tab to aggregate financial metrics with unavailable states", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="roi-roas"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain("const dataLoading = !demoMode && (linkedInLoading || ciLoading || metaLoading || ga4Loading || outcomeTotalsLoading);");
    expect(page).toContain('const overviewSpendMetric = getOverviewMetric("spend", totalSpend);');
    expect(page).toContain('const overviewRevenueMetric = getOverviewMetric("revenue", estimatedRevenue);');
    expect(page).toContain('const overviewConversionsMetric = getOverviewMetric("conversions", totalConversions);');
    expect(page).toContain('const overviewCpcMetric = getOverviewMetric("cpc", cpc);');
    expect(page).toContain('const overviewCpaMetric = getOverviewMetric("cpa", cpa);');
    expect(page).toContain('const overviewCpmMetric = getOverviewMetric("cpm", cpm);');
    expect(page).toContain('const overviewCtrMetric = getOverviewMetric("ctr", ctr);');
    expect(page).toContain('const overviewCvrMetric = getOverviewMetric("cvr", conversionRate);');
    expect(page).toContain('const overviewRoiMetric = getOverviewMetric("roi", roi);');
    expect(page).toContain('const overviewRoasMetric = getOverviewMetric("roas", roas);');

    expect(overview).toContain("formatOverviewCurrency(overviewSpendMetric)");
    expect(overview).toContain("formatOverviewNumber(overviewConversionsMetric)");
    expect(overview).toContain("formatOverviewCurrency(overviewCpcMetric)");
    expect(overview).toContain("formatOverviewCurrency(overviewCpaMetric)");
    expect(overview).toContain("formatOverviewPercentage(overviewCvrMetric)");
    expect(overview).toContain("formatOverviewPercentage(overviewRoiMetric)");
    expect(overview).toContain("overviewRoasMetric.available ? `${overviewRoasMetric.value.toFixed(2)}x` : \"Unavailable\"");
    expect(overview).toContain("pacingStatus === 'unavailable' ? 'Unavailable'");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCpcMetric");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCpaMetric");
    expect(overview).toContain("overviewMetricUnavailableText(overviewCvrMetric");
    expect(overview).not.toContain("{formatCurrency(cpc)}");
    expect(overview).not.toContain("{formatCurrency(cpa)}");
    expect(overview).not.toContain("{formatPercentage(conversionRate)}");
  });

  it("wires the ROI & ROAS tab to aggregate totals and source breakdowns", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const roiStart = page.indexOf('<TabsContent value="roi-roas"');
    const roiEnd = page.indexOf('<TabsContent value="costs"', roiStart);
    const roiTab = page.slice(roiStart, roiEnd);

    expect(page).toContain('const financialSpendMetric = getOverviewMetric("spend", totalSpend);');
    expect(page).toContain('const financialRevenueMetric = getOverviewMetric("revenue", estimatedRevenue);');
    expect(page).toContain('const financialRoiMetric = getOverviewMetric("roi", roi);');
    expect(page).toContain('const financialRoasMetric = getOverviewMetric("roas", roas);');
    expect(page).toContain("const financialMainSources = performanceSources");
    expect(page).toContain("const useAggregateSourceTotals = financialMainSources.length === 1;");
    expect(page).toContain("const financialSourceBreakdowns: FinancialSourceBreakdown[] = financialMainSources");
    expect(page).toContain("const aggregateRevenueInputBreakdowns: FinancialChildSourceBreakdown[] = performanceSources");
    expect(page).toContain("const financialChildSourceBreakdowns: FinancialChildSourceBreakdown[] = financialRevenueInputs.length > 0");
    expect(page).toContain("const revenue = useAggregateSourceTotals && financialRevenueMetric.available ? financialRevenueMetric.value : sourceRevenue;");
    expect(page).toContain("const spend = useAggregateSourceTotals && financialSpendMetric.available ? financialSpendMetric.value : sourceSpend;");
    expect(page).toContain("const financialRevenueInputs = Array.isArray(outcomeTotals?.financialInputs?.revenue) ? outcomeTotals.financialInputs.revenue : [];");
    expect(page).toContain("const financialSpendInputs = Array.isArray(outcomeTotals?.financialInputs?.spend) ? outcomeTotals.financialInputs.spend : [];");

    expect(roiTab).toContain("financialRoasMetric.available ? `${financialRoasMetric.value.toFixed(2)}x` : \"Unavailable\"");
    expect(roiTab).toContain("formatOverviewCurrency(financialSpendMetric)");
    expect(roiTab).toContain("formatOverviewCurrency(financialRevenueMetric)");
    expect(roiTab).toContain("formatOverviewPercentage(financialRoiMetric)");
    expect(roiTab).toContain("performanceSummary && financialSourceBreakdowns.map");
    expect(roiTab).toContain("Financial Inputs");
    expect(roiTab).toContain('className="text-sm font-semibold">Revenue</h5>');
    expect(roiTab).toContain('className="text-sm font-semibold">Spend</h5>');
    expect(roiTab).toContain("are not separate main Connected Platforms");
    expect(roiTab).not.toContain("formatSourceType(source.sourceType)");
    expect(roiTab).not.toContain("{roas.toFixed(2)}x");
    expect(roiTab).not.toContain("{formatPercentage(roi)}");
    expect(roiTab).not.toContain("{formatCurrency(estimatedRevenue)}");
  });

  it("wires the Cost Analysis tab to aggregate metrics with unavailable states", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");
    const costStart = page.indexOf('<TabsContent value="costs"');
    const costEnd = page.indexOf('<TabsContent value="budget"', costStart);
    const costTab = page.slice(costStart, costEnd);

    expect(costTab).toContain("formatOverviewCurrency(overviewCpcMetric)");
    expect(costTab).toContain("formatOverviewCurrency(overviewCpaMetric)");
    expect(costTab).toContain("formatOverviewCurrency(overviewCpmMetric)");
    expect(costTab).toContain("formatOverviewPercentage(overviewCtrMetric)");
    expect(costTab).toContain("formatOverviewPercentage(overviewCvrMetric)");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpcMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpaMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCpmMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCtrMetric");
    expect(costTab).toContain("overviewMetricUnavailableText(overviewCvrMetric");
    expect(costTab).not.toContain("{formatCurrency(cpc)}");
    expect(costTab).not.toContain("clickThroughCPA");
    expect(costTab).not.toContain("clickThroughCVR");
    expect(costTab).not.toContain("totalImpressions > 0 ? formatCurrency");
  });
});
