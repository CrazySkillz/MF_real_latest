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
    expect(benchmark).toContain("providerCoverageThroughDate");
  });

  it("runs scoped alert checks only after the campaign-scoped GA4 refresh", () => {
    const routes = source("routes-oauth.ts");
    const start = routes.indexOf('app.post("/api/campaigns/:id/ga4-notifications/reconcile"');
    const end = routes.indexOf("// GA4 daily metrics", start);
    const route = routes.slice(start, end > start ? end : undefined);
    const refresh = route.indexOf("await runGA4DailyRefreshPipeline({ campaignId, suppressAlerts: true });");
    const kpi = route.indexOf("await checkGA4PerformanceAlertsForCampaign(campaignId, providerCoverageThroughDate);");
    const benchmark = route.indexOf("await checkGA4BenchmarkPerformanceAlertsForCampaign(campaignId, providerCoverageThroughDate);");

    expect(refresh).toBeGreaterThan(-1);
    expect(route).toContain("await ensureCampaignAccess(req as any, res as any, campaignId)");
    expect(route).toContain('refreshStatus.lastRunStatus === "skipped" && refreshStatus.inProgress');
    expect(route).toContain("getGA4KPIReportingWindow((campaign as any)?.reportingTimeZone).endDate");
    expect(kpi).toBeGreaterThan(refresh);
    expect(benchmark).toBeGreaterThan(kpi);
  });
});
