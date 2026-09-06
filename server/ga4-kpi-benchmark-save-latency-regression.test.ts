import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("GA4 KPI and Benchmark save latency regression", () => {
  it("keeps targeted GA4 job alert reconciliation inside the affected campaign", () => {
    const jobs = read("server/ga4-kpi-benchmark-jobs.ts");
    const reconciliation = sliceBetween(jobs, "if (opts?.campaignId && processed > 0", "return {");

    expect(reconciliation).toContain("checkGA4PerformanceAlertsForCampaign");
    expect(reconciliation).toContain("checkGA4BenchmarkPerformanceAlertsForCampaign");
    expect(reconciliation).toContain("String(opts.campaignId), reportedDate");
    expect(reconciliation).not.toContain("await checkPerformanceAlerts();");
    expect(reconciliation).not.toContain("await checkBenchmarkPerformanceAlerts();");
  });

  it("does not repeat a successful KPI alert reconciliation after GA4 recompute", () => {
    const routes = read("server/routes-oauth.ts");
    const updateRoute = sliceBetween(
      routes,
      'app.patch("/api/platforms/:platformType/kpis/:kpiId"',
      'app.delete("/api/platforms/:platformType/kpis/:kpiId"',
    );

    expect(updateRoute).toContain("let ga4KpiAlertReconciled = false;");
    expect(updateRoute).toContain("ga4KpiAlertReconciled = refreshResult.kpiAlertReconciliationAttempted");
    expect(updateRoute).toContain("if (!ga4KpiAlertReconciled)");
    expect(updateRoute).toContain("await reconcileGA4KPIAlertsAfterMutation");
    expect(updateRoute).not.toContain("await checkPerformanceAlerts();");
  });

  it("reconciles GA4 Benchmark saves only inside their campaign", () => {
    const routes = read("server/routes-oauth.ts");
    const helper = sliceBetween(
      routes,
      "async function reconcileBenchmarkAlertsAfterMutation",
      "// Helper functions for column type detection",
    );
    const createRoute = sliceBetween(routes, 'app.post("/api/benchmarks", async', 'app.put("/api/benchmarks/:id"');
    const updateRoute = sliceBetween(routes, 'app.put("/api/benchmarks/:id"', 'app.delete("/api/benchmarks/:id"');

    expect(helper).toContain("checkGA4BenchmarkPerformanceAlertsForCampaign");
    expect(helper).toContain("getReportingDateWindow(1, (campaign as any)?.reportingTimeZone).endDate");
    expect(createRoute).toContain('await reconcileBenchmarkAlertsAfterMutation(benchmark, ok, "Benchmark Create");');
    expect(updateRoute).toContain('await reconcileBenchmarkAlertsAfterMutation(benchmark, undefined, "Benchmark Update");');
  });

  it("closes successful GA4 dialogs before refreshing cached rows and Notifications", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const sections = [
      sliceBetween(client, "const updateKPIMutation", "// Delete KPI mutation"),
      sliceBetween(client, "const createBenchmarkMutation", "const updateBenchmarkMutation"),
      sliceBetween(client, "const updateBenchmarkMutation", "const deleteBenchmarkMutation"),
    ];

    for (const section of sections) {
      expect(section.indexOf("setShow")).toBeGreaterThan(-1);
      expect(section.indexOf("setShow")).toBeLessThan(section.indexOf("Promise.all(["));
      expect(section).toContain("refreshNotificationQueries()");
    }
  });
});
