import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("GA4 KPI create latency regression", () => {
  it("returns a GA4 create after scheduling complete downstream processing", () => {
    const routes = read("server/routes-oauth.ts");
    const scheduleHelper = routes.slice(
      routes.indexOf("const scheduleGA4KpiCreatePostResponseProcessing"),
      routes.indexOf("const recomputeCampaignDerivedValues"),
    );
    const createRoute = routes.slice(
      routes.indexOf('app.post("/api/platforms/:platformType/kpis"'),
      routes.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"'),
    );

    const ga4Return = "return res.json(responseKpi || kpi);";
    expect(createRoute).toContain("const kpi = await storage.createKPI(validatedKPI);");
    expect(createRoute).toContain("if (String(platformType || '').toLowerCase() === 'google_analytics')");
    expect(createRoute).toContain("scheduleGA4KpiCreatePostResponseProcessing(");
    expect(createRoute).toContain(ga4Return);
    expect(createRoute.indexOf("const kpi = await storage.createKPI(validatedKPI);"))
      .toBeLessThan(createRoute.indexOf(ga4Return));
    expect(createRoute.indexOf("scheduleGA4KpiCreatePostResponseProcessing("))
      .toBeLessThan(createRoute.indexOf(ga4Return));
    expect(createRoute.indexOf(ga4Return)).toBeLessThan(createRoute.indexOf("checkPerformanceAlerts().catch"));
    expect(createRoute).not.toContain("runGA4DailyKPIAndBenchmarkJobs");
    expect(scheduleHelper).toContain("setImmediate(() => {");
    expect(scheduleHelper).toContain("await runGA4DailyKPIAndBenchmarkJobs({ campaignId });");
    expect(scheduleHelper).toContain("await checkPerformanceAlerts();");
    expect(scheduleHelper).toContain('await runImmediateKPIEmailAlertCheck(kpiId, "KPI Create");');
    expect(scheduleHelper.indexOf("await runGA4DailyKPIAndBenchmarkJobs({ campaignId });"))
      .toBeLessThan(scheduleHelper.indexOf("await runImmediateKPIEmailAlertCheck"));
  });

  it("closes the successful create UI before refreshing independent queries", () => {
    const client = read("client/src/pages/ga4-metrics.tsx");
    const createMutation = client.slice(
      client.indexOf("const createKPIMutation"),
      client.indexOf("const updateKPIMutation"),
    );

    expect(createMutation).toContain(".invalidateQueries");
    expect(createMutation).not.toContain("refreshNotificationQueries()");
    expect(createMutation.indexOf("setShowKPIDialog(false);"))
      .toBeLessThan(createMutation.indexOf(".invalidateQueries"));
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
