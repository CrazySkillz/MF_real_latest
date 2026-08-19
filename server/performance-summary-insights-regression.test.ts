import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Performance Summary Insights aggregate contract regression guard", () => {
  it("generates Insights from aggregate source capabilities instead of hard-coded platform pairs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const helperStart = page.indexOf("const buildPerformanceInsights = () => {");
    const helperEnd = page.indexOf("  // Get top priority action", helperStart);
    const helper = page.slice(helperStart, helperEnd);
    const cvrStart = helper.indexOf("if (aggregateMetricAvailable('cvr'))");
    const cvrEnd = helper.indexOf("if (aggregateMetricAvailable('cpa'))", cvrStart);
    const cvrInsight = helper.slice(cvrStart, cvrEnd);
    const insightsStart = page.indexOf('{/* Insights Tab */}');
    const insights = page.slice(insightsStart);

    expect(page).toContain("performanceSummary?.totals?.[metricName]");
    expect(page).toContain("source.includedMetrics.includes(metricName)");
    expect(helper).toContain("source?.category === 'paid_media' || source?.category === 'custom'");
    expect(helper).toContain("const webSources = performanceSources.filter");
    expect(page).toContain("priority: number;");
    expect(page).toContain("category: string;");
    expect(helper).toContain("const finalizeInsights = () => {");
    expect(helper).toContain("const byCategory = new Map<string, PerformanceInsight>();");
    expect(helper).toContain(".sort((a, b) => a.priority - b.priority)");
    expect(helper).toContain(".slice(0, 5)");
    expect(helper).toContain("Web Analytics Outcomes");
    expect(helper).toContain("Aggregate CPA");
    expect(helper).toContain("Revenue Efficiency");
    expect(helper).toContain("ROAS and ROI are not shown unless both revenue and spend are available");
    expect(helper).toContain("Review creative, targeting, and offer clarity first.");
    expect(helper).toContain("const cvrDenominator = cvrSources.includes('clicks') ? 'clicks' : cvrSources.includes('sessions') ? 'sessions' : null;");
    expect(helper).toContain("if (cvrDenominator) {");
    expect(helper).toContain("aggregateMetricValue('conversions')");
    expect(helper).toContain("aggregateMetricValue(cvrDenominator)");
    expect(helper).toContain("Compare this result with a configured KPI or Benchmark before judging performance or changing spend.");
    expect(cvrInsight).not.toContain("Excellent Conversion Rate");
    expect(cvrInsight).not.toContain("Conversion Rate Opportunity");
    expect(cvrInsight).not.toContain("aggregateMetricValue('clicks'))} clicks and");
    expect(insights).toContain("const insights = buildPerformanceInsights();");
    expect(helper).not.toContain("LinkedIn Outperforming");
    expect(helper).not.toContain("Custom Integration Outperforming");
    expect(helper).not.toContain("LinkedIn + CI");
    expect(helper).not.toContain("ciSpend");
    expect(helper).not.toContain("linkedinSpend");
  });
});
