import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const getValidationRoute = () => {
  const routes = read("server", "routes-oauth.ts");
  const routeStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-benchmark-provider-validation"');
  const routeEnd = routes.indexOf("  // ============================================================================", routeStart);

  expect(routeStart).toBeGreaterThan(-1);
  expect(routeEnd).toBeGreaterThan(routeStart);

  return routes.slice(routeStart, routeEnd);
};

describe("GA4 Benchmark provider validation guard", () => {
  it("keeps the provider validation route campaign-scoped and Benchmark-read-only", () => {
    const route = getValidationRoute();

    expect(route).toContain("const campaign = await ensureCampaignAccess(req as any, res as any, campaignId);");
    expect(route).toContain("storage.getGA4Connection(campaignId, pid)");
    expect(route).toContain("storage.getGA4Connections(campaignId)");
    expect(route).toContain("storage.getGA4DailyMetrics(campaignId, propertyId, startDate, endDate)");
    expect(route).toContain("ga4Service.getTotalsWithRevenue(propertyId, token, startDate, endDate, campaignFilter)");
    expect(route).toContain('storage.getPlatformBenchmarks("google_analytics", campaignId)');
    expect(route).toContain("computeKpiValue(metricKey, schedulerInputs)");
    expect(route).toContain("uiCandidateCurrentValue");
    expect(route).toContain('certificationStatus: "validation_output_only"');
    expect(route).toContain("ga4Service.refreshAccessToken(");
    expect(route).toContain("await storage.updateGA4ConnectionTokens(selectedConnection.id");
    expect(route).toContain("live_provider_success_after_refresh");
    expect(route).toContain("Refreshes and persists GA4 OAuth token metadata only after a provider auth failure");

    expect(route).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(route).not.toContain("updateBenchmark");
    expect(route).not.toContain("recordBenchmarkHistory");
    expect(route).not.toContain("checkBenchmarkPerformanceAlerts");
    expect(route).not.toContain("sendImmediateBenchmarkAlertIfNeeded");
  });

  it("documents Commit 2 as failed/unproven and Commit 3 validation token-refresh support", () => {
    const doc = read("GA4", "BENCHMARKS_PRODUCTION_READINESS.md");

    expect(doc).toContain("### Current Commit 2 - Prove Live GA4 Provider Accuracy And Processing Freshness For Benchmark Inputs");
    expect(doc).toContain("Deployed Commit 2 validation failed with `provider.status = live_provider_error`");
    expect(doc).toContain("`401 UNAUTHENTICATED`");
    expect(doc).toContain("stored Benchmark current value `12376.38` did not match the recalculated candidate `21922.96`");
    expect(doc).toContain("Current Commit 3 token-refresh support is locally implemented for this validation endpoint");
    expect(doc).toContain("Full unqualified GA4 Benchmark production readiness remains blocked");
  });
});