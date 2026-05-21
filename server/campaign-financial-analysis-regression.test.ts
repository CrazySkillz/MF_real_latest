import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Budget & Financial Analysis regression guard", () => {
  it("adds the shared performanceSummary aggregate contract without changing tab calculations yet", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "financial-analysis.tsx"), "utf-8");

    expect(page).toContain("const { data: outcomeTotals } = useQuery<any>({");
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
});
