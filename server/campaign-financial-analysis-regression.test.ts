import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Budget & Financial Analysis regression guard", () => {
  it("adds the shared performanceSummary aggregate contract without changing tab calculations yet", () => {
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

    expect(page).toContain("const totalSpend = platformMetrics.linkedIn.spend + platformMetrics.customIntegration.spend + platformMetrics.sheets.spend + platformMetrics.meta.spend;");
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
});
