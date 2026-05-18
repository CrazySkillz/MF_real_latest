import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Performance Summary Insights aggregate contract regression guard", () => {
  it("generates Insights from aggregate source capabilities instead of hard-coded platform pairs", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const helperStart = page.indexOf("const buildPerformanceInsights = () => {");
    const helperEnd = page.indexOf("  // Get top priority action", helperStart);
    const helper = page.slice(helperStart, helperEnd);
    const insightsStart = page.indexOf('{/* Insights Tab */}');
    const insights = page.slice(insightsStart);

    expect(page).toContain("performanceSummary?.totals?.[metricName]");
    expect(page).toContain("source.includedMetrics.includes(metricName)");
    expect(helper).toContain("source?.category === 'paid_media' || source?.category === 'custom'");
    expect(helper).toContain("const webSources = performanceSources.filter");
    expect(helper).toContain("Web Analytics Outcomes");
    expect(helper).toContain("Aggregate CPA");
    expect(helper).toContain("Revenue Efficiency");
    expect(helper).toContain("ROAS and ROI are not shown unless both revenue and spend are available");
    expect(insights).toContain("const insights = buildPerformanceInsights();");
    expect(helper).not.toContain("LinkedIn Outperforming");
    expect(helper).not.toContain("Custom Integration Outperforming");
    expect(helper).not.toContain("LinkedIn + CI");
    expect(helper).not.toContain("ciSpend");
    expect(helper).not.toContain("linkedinSpend");
  });
});
