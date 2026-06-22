import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("notification visibility regression guard", () => {
  it("hides resolved alert notifications from visible notification lists", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("return !!meta?.dismissedAt || !!meta?.resolved;");
  });

  it("hides orphaned or cross-campaign performance alert notifications", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain('const isPerformanceAlert = String(n.type || "") === "performance-alert";');
    expect(routesFile).toContain('if (!kpi || String((kpi as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain('if (!benchmark || String((benchmark as any).campaignId || "") !== String(n.campaignId || "")) return null;');
    expect(routesFile).toContain("if (isPerformanceAlert) return null;");
    expect(routesFile).toContain('if (String((n as any)?.type || "") !== "performance-alert") return true;');
    expect(routesFile).toContain("const kpi = await storage.getKPI(String(meta.kpiId)).catch(() => undefined as any);");
    expect(routesFile).toContain("const benchmark = await storage.getBenchmark(String(meta.benchmarkId)).catch(() => undefined as any);");
  });

  it("hides performance alert notifications when the linked row no longer breaches", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isAlertRowBreached = (row: any): boolean => {");
    expect(routesFile).toContain("if (isPerformanceAlert && !isAlertRowBreached(kpi)) return null;");
    expect(routesFile).toContain("if (isPerformanceAlert && !isAlertRowBreached(benchmark)) return null;");
    expect(routesFile).toContain("&& isAlertRowBreached(kpi);");
    expect(routesFile).toContain("&& isAlertRowBreached(benchmark);");
  });

  it("deduplicates visible performance alerts by linked KPI or Benchmark", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const visiblePerformanceAlertKey = (n: any): string | null => {");
    expect(routesFile).toContain('if (meta?.kpiId) return `kpi:${String(meta.kpiId)}`;');
    expect(routesFile).toContain('if (meta?.benchmarkId) return `benchmark:${String(meta.benchmarkId)}`;');
    expect(routesFile).toContain("const dedupeVisiblePerformanceAlerts = (rows: any[]) => {");
    expect(routesFile).toContain("const scoped = dedupeVisiblePerformanceAlerts(scopedRows.filter(Boolean));");
    expect(routesFile).toContain("return res.json(dedupeVisiblePerformanceAlerts(list));");
  });

  it("prevents stale KPI and Benchmark alert creation from missing campaigns or non-breaches", () => {
    const kpiNotificationsFile = readFileSync(
      join(process.cwd(), "server", "kpi-notifications.ts"),
      "utf-8"
    );
    const benchmarkNotificationsFile = readFileSync(
      join(process.cwd(), "server", "benchmark-notifications.ts"),
      "utf-8"
    );

    expect(kpiNotificationsFile).toContain("if (!shouldTriggerAlert(kpi)) {");
    expect(kpiNotificationsFile).toContain("await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiNotificationsFile).toContain('const campaignId = String(kpi.campaignId || "").trim();');
    expect(kpiNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(kpiNotificationsFile).toContain("if (!campaign) {");
    expect(kpiNotificationsFile).toContain("if (usesSingleActiveAlert) await resolveKPIAlerts(String(kpi.id), 'cleared');");
    expect(kpiNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
    expect(benchmarkNotificationsFile).toContain('const campaignId = String(b.campaignId || "").trim();');
    expect(benchmarkNotificationsFile).toContain("const campaign = await storage.getCampaign(campaignId).catch(() => undefined);");
    expect(benchmarkNotificationsFile).toContain("if (!campaign) {");
    expect(benchmarkNotificationsFile).toContain('if (usesSingleActiveAlert) await resolveBenchmarkAlerts(String(b.id), "cleared");');
    expect(benchmarkNotificationsFile).toContain('const usesSingleActiveAlert = platformType === "google_analytics" || !platformType || platformType === "campaign";');
  });

  it("prevents stale or misparsed email alert sends", () => {
    const alertMonitoringFile = readFileSync(
      join(process.cwd(), "server", "services", "alert-monitoring.ts"),
      "utf-8"
    );

    expect(alertMonitoringFile).toContain("private parseAlertNumber(value: unknown): number {");
    expect(alertMonitoringFile).toContain("private async getExistingCampaignName(campaignId: unknown): Promise<string | null> {");
    expect(alertMonitoringFile).toContain("const campaignName = await this.getExistingCampaignName((kpi as any).campaignId);");
    expect(alertMonitoringFile).toContain("const campaignName = await this.getExistingCampaignName((benchmark as any).campaignId);");
    expect(alertMonitoringFile).toContain("if (!campaignName) return false;");
    expect(alertMonitoringFile).toContain("if (!campaignName) continue;");
    expect(alertMonitoringFile).toContain("const currentValue = this.parseAlertNumber(kpi.currentValue);");
    expect(alertMonitoringFile).toContain("const thresholdValue = this.parseAlertNumber(kpi.alertThreshold);");
    expect(alertMonitoringFile).toContain("const currentValue = this.parseAlertNumber(benchmark.currentValue);");
    expect(alertMonitoringFile).toContain("const thresholdValue = this.parseAlertNumber(benchmark.alertThreshold);");
  });

  it("waits for GA4 KPI and Benchmark in-app alert reconciliation before create/update responses", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    const kpiCreateStart = routesFile.indexOf('app.post("/api/platforms/:platformType/kpis"');
    const kpiCreateEnd = routesFile.indexOf('app.patch("/api/platforms/:platformType/kpis/:kpiId"', kpiCreateStart);
    const kpiUpdateEnd = routesFile.indexOf('app.delete("/api/platforms/:platformType/kpis/:kpiId"', kpiCreateEnd);
    const kpiCreateRoute = routesFile.slice(kpiCreateStart, kpiCreateEnd);
    const kpiUpdateRoute = routesFile.slice(kpiCreateEnd, kpiUpdateEnd);

    expect(kpiCreateRoute).toContain("if (String(platformType || '').toLowerCase() === 'google_analytics')");
    expect(kpiCreateRoute).toContain("await checkPerformanceAlerts();");
    expect(kpiCreateRoute.indexOf("await checkPerformanceAlerts();")).toBeLessThan(kpiCreateRoute.indexOf("res.json(responseKpi || kpi);"));
    expect(kpiUpdateRoute).toContain("if (String((okKpi as any)?.platformType || '').toLowerCase() === 'google_analytics')");
    expect(kpiUpdateRoute).toContain("await checkPerformanceAlerts();");
    expect(kpiUpdateRoute.indexOf("await checkPerformanceAlerts();")).toBeLessThan(kpiUpdateRoute.indexOf("res.json(responseKPI || updatedKPI);"));

    const benchmarkCreateStart = routesFile.indexOf('app.post("/api/benchmarks"');
    const benchmarkCreateEnd = routesFile.indexOf('app.put("/api/benchmarks/:id"', benchmarkCreateStart);
    const benchmarkUpdateEnd = routesFile.indexOf('app.delete("/api/benchmarks/:id"', benchmarkCreateEnd);
    const benchmarkCreateRoute = routesFile.slice(benchmarkCreateStart, benchmarkCreateEnd);
    const benchmarkUpdateRoute = routesFile.slice(benchmarkCreateEnd, benchmarkUpdateEnd);

    expect(benchmarkCreateRoute).toContain("await checkBenchmarkPerformanceAlerts();");
    expect(benchmarkCreateRoute.indexOf("await checkBenchmarkPerformanceAlerts();")).toBeLessThan(benchmarkCreateRoute.indexOf("res.status(201).json(benchmark);"));
    expect(benchmarkUpdateRoute).toContain("await checkBenchmarkPerformanceAlerts();");
    expect(benchmarkUpdateRoute.indexOf("await checkBenchmarkPerformanceAlerts();")).toBeLessThan(benchmarkUpdateRoute.indexOf("res.json(benchmark);"));
  });

  it("refreshes notifications after GA4 KPI and Benchmark create/update/delete mutations", () => {
    const ga4MetricsFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(ga4MetricsFile).toContain("const refreshNotificationQueries = useCallback(async () => {");
    expect(ga4MetricsFile).toContain('await queryClient.invalidateQueries({ queryKey: ["/api/notifications"] });');
    expect(ga4MetricsFile).toContain('await queryClient.refetchQueries({ queryKey: ["/api/notifications"], exact: true });');
    expect(ga4MetricsFile.match(/await refreshNotificationQueries\(\);/g) || []).toHaveLength(6);

    const createKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const createKPIMutation"), ga4MetricsFile.indexOf("const updateKPIMutation"));
    const updateKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const updateKPIMutation"), ga4MetricsFile.indexOf("// Delete KPI mutation"));
    const deleteKpi = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const deleteKPIMutation"), ga4MetricsFile.indexOf("// GA4 Reports"));
    const createBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const createBenchmarkMutation"), ga4MetricsFile.indexOf("const updateBenchmarkMutation"));
    const updateBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const updateBenchmarkMutation"), ga4MetricsFile.indexOf("const deleteBenchmarkMutation"));
    const deleteBenchmark = ga4MetricsFile.slice(ga4MetricsFile.indexOf("const deleteBenchmarkMutation"), ga4MetricsFile.indexOf("// Benchmark handlers"));

    for (const mutation of [createKpi, updateKpi, deleteKpi, createBenchmark, updateBenchmark, deleteBenchmark]) {
      expect(mutation).toContain("await refreshNotificationQueries();");
    }
  });
});
