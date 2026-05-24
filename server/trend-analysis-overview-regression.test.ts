import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Trend Analysis Executive Overview regression guard", () => {
  it("wires the Overview tab to the source-aware trend aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="efficiency"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain('queryKey: [`/api/campaigns/${campaignId}/trend-analysis`, trendDateRange, perfDays]');
    expect(page).toContain("trend-analysis?dateRange=${trendDateRange}&days=${perfDays * 2}");
    expect(page).toContain("const trendAggregate = (trendAnalysisResponse as any)?.trendAnalysis;");
    expect(page).toContain("const overviewTrendData = useMemo<any>(() => {");
    expect(page).toContain("normalizeRateToPercent");
    expect(overview).toContain("overviewTrendData.availableSeries.map");
    expect(overview).toContain("overviewVisibleSeries.has('sessions')");
    expect(overview).toContain("overviewVisibleSeries.has('users')");
    expect(overview).toContain("overviewVisibleSeries.has('revenue')");
    expect(overview).toContain("No connected source trend data available");
    expect(overview).not.toContain("crossPlatformData");
    expect(overview).not.toContain("Connect a platform (GA4, LinkedIn, Meta, or Google Ads) to see performance trends.");
  });

  it("does not show previous-period comparison until a complete previous window exists", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf("const overviewTrendData = useMemo<any>(() => {");
    const overviewEnd = page.indexOf("const overviewVisibleSeries", overviewStart);
    const overviewModel = page.slice(overviewStart, overviewEnd);

    expect(overviewModel).toContain("const hasCompleteCurrentPeriod = currentPeriod.length >= perfDays;");
    expect(overviewModel).toContain("const hasCompletePreviousPeriod = previousPeriod.length >= perfDays;");
    expect(overviewModel).toContain("hasPrevious: hasCompletePreviousPeriod");
    expect(overviewModel).toContain("currentPeriodDays: currentPeriod.length");
    expect(overviewModel).toContain("requestedPeriodDays: perfDays");
    expect(page).toContain("Full-period trend comparisons appear once enough daily history exists.");
  });

  it("wires the Efficiency Metrics tab to aggregate-backed derived metrics", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const efficiencyStart = page.indexOf('<TabsContent value="efficiency"');
    const efficiencyEnd = page.indexOf('<TabsContent value="funnel"', efficiencyStart);
    const efficiency = page.slice(efficiencyStart, efficiencyEnd);

    expect(page).toContain("const efficiencyTrendData = useMemo<any>(() => {");
    expect(page).toContain("roas: toMetric(metrics.roas)");
    expect(page).toContain("roi: toMetric(metrics.roi)");
    expect(page).toContain("cpa: toMetric(metrics.cpa)");
    expect(page).toContain("engagementRate === null ? null : normalizeRateToPercent(engagementRate)");
    expect(efficiency).toContain("No connected source efficiency metrics available");
    expect(efficiency).toContain("ROAS and ROI require both spend and revenue from connected source data.");
    expect(efficiency).not.toContain("crossPlatformData");
    expect(efficiency).not.toContain("Avg ROAS");
  });

  it("keeps mock GA4 Trend Analysis rows aligned with the GA4 mock source path", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/trend-analysis"');
    const routeEnd = routes.indexOf("// Limits + timeouts", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("isYesopMockProperty(primaryGA4PropertyId)");
    expect(route).toContain('days >= 90 ? "90days" : days >= 60 ? "60days" : days >= 14 ? "30days" : "7days"');
    expect(route).toContain("const sim = simulateGA4({");
    expect(route).toContain("const simDates = new Set(simRows.map((row: any) => String(row.date)));");
    expect(route).toContain("ga4Rows = simRows.map((row: any) => {");
    expect(route).toContain("if (row?.date && !simDates.has(String(row.date))) ga4Rows.push(row);");
  });
});
