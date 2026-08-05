import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 KPI create latency regression", () => {
  it("reuses the successful recompute alert sweep and preserves the fail-closed fallback", () => {
    const jobs = read("server/ga4-kpi-benchmark-jobs.ts");
    const routes = read("server/routes-oauth.ts");
    const createRoute = routes.slice(
      routes.indexOf('app.post("/api/platforms/:platformType/kpis"'),
      routes.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"'),
    );

    expect(jobs).toContain("let kpiAlertReconciliationAttempted = false;");
    expect(jobs).toContain("kpiAlertReconciliationAttempted = true;");
    expect(jobs).toContain("kpiAlertReconciliationAttempted,");
    expect(createRoute).toContain("const refreshResult = await runGA4DailyKPIAndBenchmarkJobs");
    expect(createRoute).toContain("refreshResult.kpiAlertReconciliationAttempted");
    expect(createRoute).toContain('!refreshResult.alertReconciliationFailures.includes("kpi")');
    expect(createRoute).toContain("if (!ga4KpiAlertReconciled)");
    expect(createRoute).toContain("await checkPerformanceAlerts();");
    expect(createRoute.indexOf("await checkPerformanceAlerts();")).toBeLessThan(createRoute.indexOf("res.json(responseKpi || kpi);"));
    expect(createRoute).toContain('await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "KPI Create");');
  });

  it("closes the successful create UI before refreshing independent queries", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const createMutation = client.slice(
      client.indexOf("const createKPIMutation"),
      client.indexOf("const updateKPIMutation"),
    );

    expect(createMutation).toContain("await Promise.all([");
    expect(createMutation).toContain("queryClient.invalidateQueries");
    expect(createMutation).toContain("refreshNotificationQueries(),");
    expect(createMutation.indexOf("setShowKPIDialog(false);"))
      .toBeLessThan(createMutation.indexOf("await Promise.all(["));
  });

  it("parallelizes only independent recompute reads", () => {
    const jobs = read("server/ga4-kpi-benchmark-jobs.ts");

    expect(jobs).toContain("const [campaignKpisResult, campaignBenchmarksResult, connectionsResult] = await Promise.allSettled([");
    expect(jobs).toContain("const [reportingRows, toDateRows] = await Promise.all([");
    expect(jobs).toContain("const financialInputsPromise = Promise.allSettled([");
    expect(jobs).toContain("const [importedRevenueResult, spendTotalResult] = await financialInputsPromise;");
    expect(jobs).toContain("providerFinancialCandidate");
  });
});
