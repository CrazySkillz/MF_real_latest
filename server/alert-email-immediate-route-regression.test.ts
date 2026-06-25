import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTES_FILE = join(__dirname, "routes-oauth.ts");
const ALERT_MONITORING_FILE = join(__dirname, "services", "alert-monitoring.ts");

function readRoutes(): string {
  return readFileSync(ROUTES_FILE, "utf-8");
}

function readAlertMonitoring(): string {
  return readFileSync(ALERT_MONITORING_FILE, "utf-8");
}

function sliceBetween(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  expect(startIndex).toBeGreaterThan(-1);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function sliceBetweenAfter(source: string, after: string, start: string, end: string): string {
  const afterIndex = source.indexOf(after);
  expect(afterIndex).toBeGreaterThan(-1);
  const startIndex = source.indexOf(start, afterIndex);
  expect(startIndex).toBeGreaterThan(afterIndex);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

function expectBefore(source: string, first: string, second: string): void {
  const firstIndex = source.indexOf(first);
  const secondIndex = source.indexOf(second);
  expect(firstIndex).toBeGreaterThan(-1);
  expect(secondIndex).toBeGreaterThan(-1);
  expect(firstIndex).toBeLessThan(secondIndex);
}

describe("immediate alert email route durability regression guard", () => {
  it("awaits durable immediate attempts before GA4 platform KPI create/update routes return", () => {
    const routes = readRoutes();
    const createRoute = sliceBetween(
      routes,
      'app.post("/api/platforms/:platformType/kpis"',
      'app.patch("/api/platforms/:platformType/kpis/:kpiId"'
    );
    const updateRoute = sliceBetween(
      routes,
      'app.patch("/api/platforms/:platformType/kpis/:kpiId"',
      'app.delete("/api/platforms/:platformType/kpis/:kpiId"'
    );

    expect(createRoute).toContain("toLowerCase() === 'google_analytics' && validatedKPI.campaignId");
    expect(updateRoute).toContain("toLowerCase() === 'google_analytics' && (okKpi as any)?.campaignId");
    expectBefore(createRoute, "const kpi = await storage.createKPI(validatedKPI);", 'await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "KPI Create");');
    expectBefore(createRoute, 'await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "KPI Create");', "res.json(responseKpi || kpi);");
    expectBefore(updateRoute, "const updatedKPI = await storage.updateKPI(kpiId, validated);", 'await runImmediateKPIEmailAlertCheck(kpiId, "KPI Update");');
    expectBefore(updateRoute, 'await runImmediateKPIEmailAlertCheck(kpiId, "KPI Update");', "res.json(responseKPI || updatedKPI);");
  });

  it("awaits durable immediate attempts before campaign KPI create/update routes return", () => {
    const routes = readRoutes();
    const createRoute = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/kpis"',
      'app.patch("/api/campaigns/:id/kpis/:kpiId"'
    );
    const updateRoute = sliceBetween(
      routes,
      'app.patch("/api/campaigns/:id/kpis/:kpiId"',
      'app.delete("/api/campaigns/:id/kpis/:kpiId"'
    );

    expectBefore(createRoute, "const kpi = await storage.createKPI(validatedKPI);", 'await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "Campaign KPI Create");');
    expectBefore(createRoute, 'await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "Campaign KPI Create");', "res.json(kpi);");
    expectBefore(updateRoute, "const kpi = await storage.updateKPI(kpiId, updateData);", 'await runImmediateKPIEmailAlertCheck(kpiId, "Campaign KPI Update");');
    expectBefore(updateRoute, 'await runImmediateKPIEmailAlertCheck(kpiId, "Campaign KPI Update");', "res.json(kpi);");
  });

  it("awaits durable immediate attempts before Benchmark create/update routes return", () => {
    const routes = readRoutes();
    const campaignCreate = sliceBetweenAfter(
      routes,
      "// KPI routes",
      'app.post("/api/campaigns/:id/benchmarks", async',
      'app.patch("/api/campaigns/:campaignId/benchmarks/:benchmarkId"'
    );
    const campaignUpdate = sliceBetween(
      routes,
      'app.patch("/api/campaigns/:campaignId/benchmarks/:benchmarkId"',
      'app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId"'
    );
    const platformCreate = sliceBetween(
      routes,
      'app.post("/api/platforms/:platformType/benchmarks"',
      'app.put("/api/platforms/:platformType/benchmarks/:benchmarkId"'
    );
    const platformUpdate = sliceBetween(
      routes,
      'app.put("/api/platforms/:platformType/benchmarks/:benchmarkId"',
      'app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId"'
    );
    const genericCreate = sliceBetween(
      routes,
      'app.post("/api/benchmarks", async',
      'app.put("/api/benchmarks/:id"'
    );
    const genericUpdate = sliceBetween(
      routes,
      'app.put("/api/benchmarks/:id"',
      'app.delete("/api/benchmarks/:id"'
    );

    expectBefore(campaignCreate, "const benchmark = await storage.createBenchmark(validatedBenchmark);", 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Campaign Benchmark Create");');
    expectBefore(campaignCreate, 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Campaign Benchmark Create");', "res.json(benchmark);");
    expectBefore(campaignUpdate, "const benchmark = await storage.updateBenchmark(benchmarkId, validatedBenchmark);", 'await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Campaign Benchmark Update");');
    expectBefore(campaignUpdate, 'await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Campaign Benchmark Update");', "res.json(benchmark);");
    expectBefore(platformCreate, "const benchmark = await storage.createBenchmark(validatedData);", 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Platform Benchmark Create");');
    expectBefore(platformCreate, 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Platform Benchmark Create");', "res.status(201).json(responseBenchmark || benchmark);");
    expectBefore(platformUpdate, "const benchmark = await storage.updateBenchmark(benchmarkId, validatedData);", 'await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Platform Benchmark Update");');
    expectBefore(platformUpdate, 'await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Platform Benchmark Update");', "res.json(responseBenchmark || benchmark);");
    expectBefore(genericCreate, "const benchmark = await storage.createBenchmark(validatedData);", 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Benchmark Create");');
    expectBefore(genericCreate, 'await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Benchmark Create");', "res.status(201).json(benchmark);");
    expectBefore(genericUpdate, "const benchmark = await storage.updateBenchmark(id, validated);", 'await runImmediateBenchmarkEmailAlertCheck(id, "Benchmark Update");');
    expectBefore(genericUpdate, 'await runImmediateBenchmarkEmailAlertCheck(id, "Benchmark Update");', "res.json(benchmark);");
  });

  it("keeps immediate send eligibility gates before any sendable audit claim", () => {
    const source = readAlertMonitoring();
    const kpiImmediate = sliceBetween(source, "async sendImmediateKPIAlertIfNeeded", "async sendImmediateBenchmarkAlertIfNeeded");
    const benchmarkImmediate = sliceBetween(source, "async sendImmediateBenchmarkAlertIfNeeded", "// Check all KPIs for alerts");

    expect(kpiImmediate).toContain("if (!rawKpi || !rawKpi.alertsEnabled || !rawKpi.emailNotifications || !rawKpi.emailRecipients) return false;");
    expect(benchmarkImmediate).toContain("if (!rawBenchmark || !rawBenchmark.alertsEnabled || !rawBenchmark.emailNotifications || !rawBenchmark.emailRecipients) return false;");
    for (const immediateSource of [kpiImmediate, benchmarkImmediate]) {
      expectBefore(immediateSource, "if (!campaignName) return false;", "const claim = await this.claimAlertEmailWindow({");
      expectBefore(immediateSource, "if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;", "const claim = await this.claimAlertEmailWindow({");
      expectBefore(immediateSource, "if (!this.shouldSendAlert(currentValue, thresholdValue, condition)) return false;", "const claim = await this.claimAlertEmailWindow({");
      expectBefore(immediateSource, "if (recipients.length === 0) return false;", "const claim = await this.claimAlertEmailWindow({");
      expectBefore(immediateSource, "const claim = await this.claimAlertEmailWindow({", "const emailSent = await emailService.sendAlertEmail(recipients, {");
    }
  });

  it("does not use fire-and-forget dynamic imports for critical immediate email checks", () => {
    const routes = readRoutes();

    expect(routes).toContain("await alertMonitoringService.sendImmediateKPIAlertIfNeeded(id);");
    expect(routes).toContain("await alertMonitoringService.sendImmediateBenchmarkAlertIfNeeded(id);");
    expect(routes).toContain('console.warn(`[${logPrefix}] Immediate email alert check failed:`, (e as any)?.message || e);');
    expect(routes).not.toContain(".then(({ alertMonitoringService }) => alertMonitoringService.sendImmediate");
  });
});
