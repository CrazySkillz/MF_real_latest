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
    expect(route).toContain("ga4Service.getTotalsWithRevenue(propertyId, token, fromDate, toDate, campaignFilter)");
    expect(route).toContain('storage.getPlatformBenchmarks("google_analytics", campaignId)');
    expect(route).toContain("const currentValueStartDate = campaignStartDate;");
    expect(route).toContain("currentValue: { startDate: currentValueStartDate, endDate: currentValueEndDate }");
    expect(route).toContain("currentValueProvider");
    expect(route).toContain("currentValuePersistedDaily");
    expect(route).toContain("live_provider_current_value_window");
    expect(route).toContain("computeKpiValue(metricKey, schedulerInputs)");
    expect(route).toContain("uiCandidateCurrentValue");
    expect(route).toContain('certificationStatus: "validation_output_only"');
    expect(route).toContain("ga4Service.refreshAccessToken(");
    expect(route).toContain("await storage.updateGA4ConnectionTokens(selectedConnection.id");
    expect(route).toContain("live_provider_success_after_refresh");
    expect(route).toContain("const simulateRefreshFailure = [\"1\", \"true\", \"yes\"].includes");
    expect(route).toContain("if (simulateRefreshFailure) {");
    expect(route).toContain('providerStatus = "live_provider_refresh_failed";');
    expect(route).toContain("no token refresh was attempted and no token metadata was changed");
    expect(route).toContain("simulation: { refreshFailure: simulateRefreshFailure }");
    expect(route).toContain("Refreshes and persists GA4 OAuth token metadata only after a provider auth failure");

    const simulationBranch = route.slice(route.indexOf("if (simulateRefreshFailure) {"), route.indexOf("} else if (isYesopMockProperty(propertyId))"));
    expect(simulationBranch).toContain('providerStatus = "live_provider_refresh_failed";');
    expect(simulationBranch).not.toContain("ga4Service.refreshAccessToken");
    expect(simulationBranch).not.toContain("updateGA4ConnectionTokens");

    expect(route).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(route).not.toContain("updateBenchmark");
    expect(route).not.toContain("recordBenchmarkHistory");
    expect(route).not.toContain("checkBenchmarkPerformanceAlerts");
    expect(route).not.toContain("sendImmediateBenchmarkAlertIfNeeded");
  });

  it("documents Commit 2 evidence, Commit 3 deployed auth proof, and Commit 4 validation-window RCA", () => {
    const doc = read("GA4", "BENCHMARKS_PRODUCTION_READINESS.md");

    expect(doc).toContain("### Current Commit 2 - Prove Live GA4 Provider Accuracy And Processing Freshness For Benchmark Inputs");
    expect(doc).toContain("first returned provider.status = live_provider_error with 401 UNAUTHENTICATED");
    expect(doc).toContain("`401 UNAUTHENTICATED`");
    expect(doc).toContain("Commit 3 deployed validation passed with `provider.status = live_provider_success`");
    expect(doc).toContain("simulateRefreshFailure=1");
    expect(doc).toContain("Current Commit 4 proved the earlier `12376.38` versus `21922.96` comparison was a validation-window defect");
    expect(doc).toContain("Final deployed Current Commit 2 validation on July 1, 2026");
    expect(doc).toContain("Total Conversions stored `84.00` versus scheduler candidate `84` with `storedVsSchedulerDelta = 0`");
    expect(doc).toContain("Benchmark Revenue stored `14669.58` versus scheduler candidate `14669.58` with `storedVsSchedulerDelta = 0`");
    expect(doc).toContain("Current Commit 4 Follow-Up - Prove Deployed Scheduler And Report-Preflight Benchmark Recompute");
    expect(doc).toContain("No Current Commit blockers remain open for the current GA4 Benchmarks certification scope");
    expect(doc).toContain("Future-reference boundary rule:");
    expect(doc).toContain("The future-boundary items are not current blockers");
    expect(doc).toContain("future platform readiness without fresh evidence");
  });
});
