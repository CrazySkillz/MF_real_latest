import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const source = (name: string) => readFileSync(join(process.cwd(), "server", name), "utf8");

describe("GA4 campaign run-now notification reconciliation", () => {
  it("keeps KPI and Benchmark alert checks scoped to the authorized campaign", () => {
    const kpi = source("kpi-scheduler.ts");
    const benchmark = source("benchmark-notifications.ts");

    expect(kpi).toContain('String(kpi?.campaignId || "") === requestedCampaignId && String(kpi?.platformType || "") === "google_analytics"');
    expect(benchmark).toContain('eq(benchmarks.campaignId, requestedCampaignId), eq(benchmarks.platformType, "google_analytics")');
    expect(kpi).toContain("providerCoverageThroughDate");
    const scopedAlertCheck = kpi.slice(
      kpi.indexOf("async function checkPerformanceAlertsForScope"),
      kpi.indexOf("export async function captureEndOfPeriod"),
    );
    expect(scopedAlertCheck).toContain("requireCurrentTrafficFreshness: true");
    expect(scopedAlertCheck).toContain("providerCoverageThroughDate,");
    expect(benchmark).toContain("providerCoverageThroughDate");
  });

  it("runs scoped alert checks from the latest scheduler-stored GA4 date without refreshing history", () => {
    const routes = source("routes-oauth.ts");
    const start = routes.indexOf('app.post("/api/campaigns/:id/ga4-notifications/reconcile"');
    const end = routes.indexOf("// GA4 daily metrics", start);
    const route = routes.slice(start, end > start ? end : undefined);
    const kpi = route.indexOf("await checkGA4PerformanceAlertsForCampaign(campaignId, providerCoverageThroughDate);");
    const benchmark = route.indexOf("await checkGA4BenchmarkPerformanceAlertsForCampaign(campaignId, providerCoverageThroughDate);");

    expect(route).not.toContain("runGA4DailyRefreshPipeline");
    expect(route).toContain("await ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(route).toContain('storage.getPlatformKPIs("google_analytics", campaignId)');
    expect(route).toContain('storage.getPlatformBenchmarks("google_analytics", campaignId)');
    expect(route).toContain("if (!hasEnabledAlertRule) return res.json({ success: true, campaignId });");
    expect(route).toContain("await storage.getLatestGA4DailyMetric(campaignId, String(primaryConnection.propertyId))");
    expect(route).toContain('const providerCoverageThroughDate = String((latestDailyMetric as any)?.date || "").trim();');
    expect(route).toContain("if (!providerCoverageThroughDate) return res.json({ success: true, campaignId });");
    expect(kpi).toBeGreaterThan(route.indexOf("const providerCoverageThroughDate"));
    expect(benchmark).toBeGreaterThan(kpi);
  });
});
