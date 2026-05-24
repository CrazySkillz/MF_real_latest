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
    expect(route).toContain("dateRange: executiveDateRange");
    expect(route).toContain("ga4: { connected: hasGA4Connection, ...ga4Metrics }");
    expect(route).toContain("spendSource: canonicalSpend > 0 ? \"persisted_spend_sources\" : \"platform_spend_fallback\"");
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
    expect(route).toContain("name: source.label");
    expect(route).toContain("sourceId: source.id");
    expect(route).toContain("includedMetrics: source.includedMetrics");
    expect(route).toContain("excludedMetrics: source.excludedMetrics");
    expect(route).not.toContain("spend: 0,\n          revenue: 0,\n          conversions: ga4Metrics.conversions");
    expect(route).toContain("performanceSummary,");
    expect(route).toContain("aggregateVersion: (performanceSummary as any)?.version");
  });
});
