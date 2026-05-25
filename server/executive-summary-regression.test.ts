import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Executive Summary regression guard", () => {
  it("guards the endpoint and builds current values from the shared aggregate contract", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, id);");
    expect(route).not.toContain("const campaign = await storage.getCampaign(id);");
    expect(route).toContain("const performanceSummary = buildPerformanceSummaryAggregate({");
    expect(route).toContain("const metaConnection = await storage.getMetaConnection(id).catch(() => null);");
    expect(route).toContain("if (metaConnection && !(metaConnection as any).spendOnly) {");
    expect(route).toContain("dateRange: executiveDateRange");
    expect(route).toContain("const metrics = await ga4Service.getMetricsWithAutoRefresh(id, storage, ga4DateRange, primaryPropertyId || undefined, campaignFilter);");
    expect(route).toContain('periodParam === "90d" ? "90daysAgo" : "30daysAgo"');
    expect(route).toContain("let usedGA4SourceTruth = false;");
    expect(route).toContain("if (!usedGA4SourceTruth) {");
    expect(route).toContain("ga4: { connected: hasGA4Connection, ...ga4Metrics }");
    expect(route).toContain("const spendBreakdown = await storage.getSpendBreakdownBySource(id, \"1900-01-01\", endDate).catch(() => []);");
    expect(route).toContain("const revenueBreakdown = await storage.getRevenueBreakdownBySource(id, \"1900-01-01\", endDate, \"ga4\").catch(() => []);");
    expect(route).toContain("const aggregateRevenue = hasGA4Connection");
    expect(route).toContain("parseFloat((ga4Metrics.revenue + importedRevenueToDateTotal).toFixed(2))");
    expect(route).toContain("spendSource: performanceSummarySpend > 0 ? \"persisted_spend_sources\" : \"platform_spend_fallback\"");
    expect(route).toContain("meta: { connected: hasMetaConnection");
    expect(route).toContain("const aggregateMetricValue = (metricName: string): number => {");
    expect(route).toContain('const totalImpressions = aggregateMetricValue("impressions");');
    expect(route).toContain('const totalClicks = aggregateMetricValue("clicks");');
    expect(route).toContain('const totalConversions = aggregateMetricValue("conversions");');
    expect(route).toContain('const totalSpend = aggregateMetricValue("spend");');
    expect(route).toContain('const totalRevenue = aggregateMetricValue("revenue");');
    expect(route).toContain('const roas = aggregateMetricValue("roas");');
    expect(route).toContain('const roi = aggregateMetricValue("roi");');
    expect(route).toContain('const ctr = aggregateMetricValue("ctr");');
    expect(route).toContain('const cvr = aggregateMetricValue("cvr");');
  });

  it("derives main platform rows from performanceSummary sources and excludes financial child inputs", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/executive-summary"');
    const routeEnd = routes.indexOf("// ============================================================================", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const mainAggregateSources = Array.isArray((performanceSummary as any)?.sources)");
    expect(route).toContain('source?.connected === true && source?.category !== "financial"');
    expect(route).toContain("const platformsForDisplay: any[] = mainAggregateSources.map");
    expect(route).toContain("let executiveRevenueSources: any[] = [];");
    expect(route).toContain("const revenueBreakdown = await storage.getRevenueBreakdownBySource(id, \"1900-01-01\", endDate, \"ga4\").catch(() => []);");
    expect(route).toContain("revenueSources: executiveRevenueSources");
    expect(route).toContain("name: source.label");
    expect(route).toContain("sourceId: source.id");
    expect(route).toContain("includedMetrics: source.includedMetrics");
    expect(route).toContain("excludedMetrics: source.excludedMetrics");
    expect(route).not.toContain("spend: 0,\n          revenue: 0,\n          conversions: ga4Metrics.conversions");
    expect(route).toContain("performanceSummary,");
    expect(route).toContain("aggregateVersion: (performanceSummary as any)?.version");
  });

  it("renders Executive Overview current values from aggregate availability", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "executive-summary.tsx"), "utf-8");
    const overviewStart = page.indexOf('<TabsContent value="overview"');
    const overviewEnd = page.indexOf('{/* Strategic Recommendations Tab */}', overviewStart);
    const overview = page.slice(overviewStart, overviewEnd);

    expect(page).not.toContain("const [period");
    expect(page).not.toContain('params.set("period"');
    expect(page).not.toContain("<Select value={period}");
    expect(page).toContain('const executiveOutcomeDateRange = "90days";');
    expect(page).toContain("`/api/campaigns/${campaignId}/outcome-totals?dateRange=${executiveOutcomeDateRange}${demoMode ? \"&demo=1\" : \"\"}`");
    expect(page).toContain("const performanceSummary = (outcomeTotals as any)?.performanceSummary || (executiveSummary as any).performanceSummary;");
    expect(page).toContain("const aggregateMetric = (metricName: string) => (performanceSummary as any)?.totals?.[metricName];");
    expect(page).toContain("const formatAggregateInteger = (metricName: string) =>");
    expect(page).toContain("aggregateMetricAvailable(metricName) ? Math.round(aggregateMetricValue(metricName)).toLocaleString() : \"Unavailable\";");
    expect(page).not.toContain("2,984");
    expect(page).not.toContain("2984");
    expect(page).toContain('const reachMetricKey = pickFirstAvailableMetric(["impressions", "users", "sessions"]);');
    expect(page).toContain('const engagementMetricKey = pickFirstAvailableMetric(["clicks", "sessions", "users"]);');
    expect(page).toContain("const funnelPathLabel = `${reachMetricLabels[reachMetricKey]} -> ${engagementMetricLabels[engagementMetricKey]} -> Conversions -> Revenue`;");
    expect(overview).toContain("{funnelPathLabel}");
    expect(overview).toContain("{reachStageQuestion}");
    expect(overview).toContain("{engagementStageQuestion}");
    expect(overview).toContain("Are visits becoming conversions and revenue?");
    expect(overview).toContain("{formatAggregateNumber(reachMetricKey)} {reachMetricLabels[reachMetricKey]}");
    expect(overview).toContain("{formatAggregateNumber(engagementMetricKey)} {engagementMetricLabels[engagementMetricKey]}");
    expect(overview).toContain('{formatAggregatePercent("ctr")}');
    expect(overview).toContain('{formatAggregatePercent("cvr")}');
    expect(overview).toContain('{formatAggregateInteger("conversions")}');
    expect(overview).toContain('{formatAggregateCurrency("revenue")}');
    expect(overview).toContain('{formatAggregateRatio("roas")}');
    expect(overview).not.toContain('{formatAggregateNumber("conversions")}');
    expect(overview).not.toContain("{formatNumber((executiveSummary as any).metrics.totalImpressions)} Impressions");
    expect(overview).not.toContain("{formatNumber((executiveSummary as any).metrics.totalClicks)} Clicks");
    expect(overview).not.toContain("{formatCurrency((executiveSummary as any).metrics.totalRevenue)}");
  });
});
