import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  const endIndex = source.indexOf(end, startIndex);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 source lifecycle recompute route guards", () => {
  it("keeps GA4 revenue source responses off the heavyweight KPI/Benchmark job", () => {
    expect(routes).toContain('import { refreshCampaignCurrentValuesForCampaign, resolveCampaignCurrentValueForAlert } from "./utils/campaign-current-values";');

    const ga4Helper = sliceBetween(
      routes,
      "const recomputeGA4KPIAndBenchmarkValues",
      "const scheduleGA4RevenuePostResponseRecompute",
    );
    expect(ga4Helper).toContain("await runGA4DailyKPIAndBenchmarkJobs({ campaignId });");

    const scheduleHelper = sliceBetween(
      routes,
      "const scheduleGA4RevenuePostResponseRecompute",
      "const recomputeCampaignDerivedValues",
    );
    expect(scheduleHelper).toContain("setImmediate(() => {");
    expect(scheduleHelper).toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Revenue Update");');
    expect(scheduleHelper).toContain("await checkPerformanceAlerts();");

    const revenueHelper = sliceBetween(
      routes,
      "const recomputeCampaignDerivedValues",
      "// When \"revenue to date\"",
    );
    expect(revenueHelper).toContain("if (isGA4RevenuePlatformContext(opts.platformContext))");
    expect(revenueHelper).toContain("await refreshCampaignCurrentValuesForCampaign(campaignId);");
    expect(revenueHelper).toContain("scheduleGA4RevenuePostResponseRecompute(campaignId);");
    expect(revenueHelper.indexOf("await refreshCampaignCurrentValuesForCampaign(campaignId);")).toBeLessThan(
      revenueHelper.indexOf("scheduleGA4RevenuePostResponseRecompute(campaignId);"),
    );
    expect(revenueHelper).not.toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Revenue Update");');
  });

  it("passes platform context through GA4 revenue source add, edit, and delete recompute paths", () => {
    const platformContextCalls = routes.match(/await recomputeCampaignDerivedValues\(campaignId, \{ platformContext \}\);/g) || [];
    expect(platformContextCalls.length).toBe(6);

    const platformCtxCalls = routes.match(/await recomputeCampaignDerivedValues\(campaignId, \{ platformContext: platformCtx \}\);/g) || [];
    expect(platformCtxCalls.length).toBe(5);
    expect(routes).toContain("await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });");

    const bulkDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources", async',
      '// Individual revenue source delete',
    );
    expect(bulkDeleteRoute.indexOf("await storage.deleteRevenueRecordsBySource(sid);")).toBeLessThan(
      bulkDeleteRoute.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });"),
    );

    const singleDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/revenue-sources/:sourceId", async',
      '// Individual spend source delete',
    );
    expect(singleDeleteRoute.indexOf("await storage.deleteRevenueRecordsBySource(sourceId);")).toBeLessThan(
      singleDeleteRoute.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext: sourcePlatformContext });"),
    );
  });

  it("keeps spend source process responses off the heavyweight GA4 KPI/Benchmark job", () => {
    const scheduleHelper = sliceBetween(
      routes,
      "const scheduleGA4SpendPostResponseRecompute",
      "const recomputeCampaignDerivedValues",
    );
    expect(scheduleHelper).toContain("setImmediate(() => {");
    expect(scheduleHelper).toContain('void recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update").catch');
    expect((routes.match(/scheduleGA4SpendPostResponseRecompute\(campaignId\);/g) || []).length).toBe(4);

    const processRoutes = [
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/process/manual"', "const processConnectorDerivedSpend"),
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/linkedin/process"', 'app.post("/api/campaigns/:id/spend/csv/preview"'),
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/csv/process"', 'app.post("/api/campaigns/:id/spend/sheets/preview"'),
      sliceBetween(routes, 'app.post("/api/campaigns/:id/spend/sheets/process"', "  // Salesforce PKCE support"),
    ];

    for (const route of processRoutes) {
      expect(route.indexOf("await recalcCampaignSpend(campaignId);")).toBeGreaterThanOrEqual(0);
      expect(route.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(
        route.indexOf("scheduleGA4SpendPostResponseRecompute(campaignId);"),
      );
      expect(route).not.toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");');
    }
  });

  it("keeps spend cleanup and delete recomputes after durable spend total changes", () => {
    const duplicateCleanupRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/cleanup"',
      'app.post("/api/campaigns/:id/spend-sources/google-sheets-duplicates/purge-inactive"',
    );
    expect(duplicateCleanupRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(
      duplicateCleanupRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );

    const singleDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/spend-sources/:sourceId"',
      'app.get("/api/campaigns/:id/revenue-totals"',
    );
    expect(singleDeleteRoute.indexOf("await recalcCampaignSpend(campaignId);")).toBeLessThan(
      singleDeleteRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );

    const bulkSpendDeleteRoute = sliceBetween(
      routes,
      'app.delete("/api/campaigns/:id/spend-sources", requireCampaignAccessParamId',
      'app.get("/api/campaigns/:id/spend-totals"',
    );
    expect(bulkSpendDeleteRoute.indexOf('await storage.updateCampaign(campaignId, { spend: "0" as any } as any);')).toBeLessThan(
      bulkSpendDeleteRoute.indexOf('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");'),
    );
  });
});
