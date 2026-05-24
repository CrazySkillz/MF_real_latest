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

  it("keeps mock GA4 Trend Analysis rows aligned with the GA4 mock source path", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/trend-analysis"');
    const routeEnd = routes.indexOf("// Limits + timeouts", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("isYesopMockProperty(primaryGA4PropertyId)");
    expect(route).toContain("const sim = simulateGA4({");
    expect(route).toContain("const simDates = new Set(simRows.map((row: any) => String(row.date)));");
    expect(route).toContain("ga4Rows = simRows.map((row: any) => {");
    expect(route).toContain("if (row?.date && !simDates.has(String(row.date))) ga4Rows.push(row);");
  });
});
