import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Trend Analysis Overview regression guard", () => {
  it("wires the Overview tab to the source-aware trend aggregate contract", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('<TabsContent value="efficiency"', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).toContain('<TabsTrigger value="overview">Overview</TabsTrigger>');
    expect(page).not.toContain('<TabsTrigger value="overview">Executive Overview</TabsTrigger>');
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
    expect(page).toContain("hasCompleteCurrentPeriod: currentPeriod.length >= perfDays");
    expect(page).toContain("Validate full-period efficiency trends after enough daily history exists.");
    expect(efficiency).toContain("No connected source efficiency metrics available");
    expect(efficiency).toContain("ROAS and ROI require both spend and revenue from connected source data.");
    expect(efficiency).not.toContain("crossPlatformData");
    expect(efficiency).not.toContain("Avg ROAS");
  });

  it("wires the Conversion Funnel tab to aggregate-backed source capabilities", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const funnelStart = page.indexOf('<TabsContent value="funnel"');
    const funnelEnd = page.indexOf('<TabsContent value="platforms"', funnelStart);
    const funnel = page.slice(funnelStart, funnelEnd);

    expect(page).toContain("const conversionFunnelData = useMemo<any>(() => {");
    expect(page).toContain('paidAvailable: hasMetric("impressions") || hasMetric("clicks")');
    expect(funnel).toContain("Web Analytics Funnel");
    expect(funnel).toContain("Paid-Media Funnel");
    expect(funnel).toContain("Paid-media funnel metrics require a connected paid-media source with impressions or clicks.");
    expect(funnel).toContain("Validate full-period funnel trends after enough daily history exists.");
    expect(funnel).not.toContain("crossPlatformData");
    expect(funnel).not.toContain("Connect an ad platform to see conversion funnel trends.");
  });

  it("wires the Platform Breakdown tab to aggregate-backed connected sources", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const platformsStart = page.indexOf('<TabsContent value="platforms"');
    const platformsEnd = page.indexOf('<TabsContent value="market"', platformsStart);
    const platforms = page.slice(platformsStart, platformsEnd);

    expect(page).toContain("const platformBreakdownData = useMemo<any>(() => {");
    expect(page).toContain("const sources = Array.isArray(aggregate?.sources) ? aggregate.sources : [];");
    expect(platforms).toContain("platformBreakdownData.sources.map");
    expect(platforms).toContain("No connected main source provides source-level spend for this selection.");
    expect(platforms).toContain("CPA and CPC require source-level spend plus conversions or clicks from a connected main source.");
    expect(platforms).toContain("p.unavailable.join");
    expect(platforms).not.toContain("crossPlatformData");
    expect(platforms).not.toContain("Connect at least one ad platform to see breakdown analysis.");
    expect(platforms).not.toContain("li_${platformMetric}");
  });

  it("wires the Insights tab to aggregate-backed executive recommendations", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "trend-analysis.tsx"), "utf-8");
    const headerStart = page.indexOf("{/* Header */}");
    const headerEnd = page.indexOf("{/* Tabs */}", headerStart);
    const header = page.slice(headerStart, headerEnd);
    const insightsStart = page.indexOf('<TabsContent value="insights"');
    const insightsEnd = page.indexOf("</TabsContent>", insightsStart);
    const insights = page.slice(insightsStart, insightsEnd);

    expect(page).toContain('<TabsTrigger value="insights">Insights</TabsTrigger>');
    expect(header).toContain('activeTab !== "insights"');
    expect(header).toContain("<Select value={perfPeriod} onValueChange={setPerfPeriod}>");
    expect(page).toContain("const trendInsights = useMemo<any[]>(() => {");
    expect(page).toContain("overviewTrendData?.hasPrevious");
    expect(page).toContain("efficiencyTrendData?.cards?.length");
    expect(page).toContain("conversionFunnelData?.webAvailable");
    expect(page).toContain("platformBreakdownData?.sources?.length === 1");
    expect(insights).toContain("Trend Performance Insights");
    expect(insights).toContain("Executive recommendations based on connected-source trend data from the other Trend Analysis tabs.");
    expect(insights).toContain("trendInsights.map");
  });

  it("stores scheduler snapshots with the Trend Analysis aggregate contract", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");

    expect(scheduler).toContain('import { buildTrendAnalysisAggregate }');
    expect(scheduler).toContain("const includeTrendAnalysis = options.includeTrendAnalysis !== false;");
    expect(scheduler).toContain("const trendAnalysis = includeTrendAnalysis ? buildTrendAnalysisAggregate({");
    expect(scheduler).toContain('dateRange: "90days"');
    expect(scheduler).toContain("financialDailyRows: trendFinancialDailyRows");
    expect(scheduler).toContain("storage.getGA4DailyMetrics(campaignId");
    expect(scheduler).toContain("storage.getLinkedInDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("storage.getMetaDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)");
    expect(scheduler).toContain("trendAnalysis,");
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
