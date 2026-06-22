import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const EMAIL_SERVICE_FILE = join(__dirname, "services", "email-service.ts");
const ALERT_MONITORING_FILE = join(__dirname, "services", "alert-monitoring.ts");
const ROUTES_FILE = join(__dirname, "routes-oauth.ts");

function readEmailService(): string {
  return readFileSync(EMAIL_SERVICE_FILE, "utf-8");
}

function readAlertMonitoring(): string {
  return readFileSync(ALERT_MONITORING_FILE, "utf-8");
}

function readRoutes(): string {
  return readFileSync(ROUTES_FILE, "utf-8");
}

describe("alert email regression guard", () => {
  it("keeps KPI and Benchmark alert emails unbranded by the old header", () => {
    const source = readEmailService();

    expect(source).toContain('const alertTypeLabel = data.type === "kpi" ? "KPI" : "Benchmark";');
    expect(source).toContain("Review this ${alertTypeLabel} in your MimoSaaS dashboard");
    expect(source).toContain("campaignName: campaigns.name");
    expect(source).toContain("<p><strong>Campaign:</strong> ${campaignName}</p>");
    expect(source).toContain("This is an automated alert from MimoSaaS");
    expect(source).not.toContain("Performance Alert</h1>");
    expect(source).not.toContain("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
    expect(source).not.toContain("Review this ${data.type} in your MetricMind dashboard");
    expect(source).not.toContain("Review this ${data.type} in your MimoSaaS dashboard");
    expect(source).not.toContain("This is an automated alert from MetricMind");
  });

  it("uses resolved campaign current values for immediate and scheduled email alert checks", () => {
    const source = readAlertMonitoring();

    expect(source).toContain('import { resolveCampaignCurrentValueForAlert } from "../utils/campaign-current-values";');
    expect(source).toContain("const kpi = await resolveCampaignCurrentValueForAlert(rawKpi);");
    expect(source).toContain("const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark);");
    expect(source).toContain("const campaignMetricCache = new Map<string, Promise<any>>();");
    expect(source).toContain("const kpi = await resolveCampaignCurrentValueForAlert(rawKpi, campaignMetricCache);");
    expect(source).toContain("const benchmark = await resolveCampaignCurrentValueForAlert(rawBenchmark, campaignMetricCache);");
  });

  it("keeps invalid values fail-closed and throttling before email sends", () => {
    const source = readAlertMonitoring();

    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;");
    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) continue;");
    const throttleIndex = source.indexOf("if (this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) return false;");
    const parseIndex = source.indexOf("const currentValue = this.parseAlertNumber(kpi.currentValue);");
    const sendIndex = source.indexOf("const emailSent = await emailService.sendAlertEmail(recipients, {");
    expect(throttleIndex).toBeGreaterThan(-1);
    expect(parseIndex).toBeGreaterThan(throttleIndex);
    expect(sendIndex).toBeGreaterThan(parseIndex);
  });

  it("attempts immediate email checks after GA4 KPI and Benchmark create/update routes", () => {
    const routes = readRoutes();

    expect(routes).toContain("alertMonitoringService.sendImmediateKPIAlertIfNeeded(String((kpi as any)?.id || \"\"))");
    expect(routes).toContain("alertMonitoringService.sendImmediateKPIAlertIfNeeded(String(kpiId))");
    expect(routes).toContain("alertMonitoringService.sendImmediateBenchmarkAlertIfNeeded(String((benchmark as any)?.id || \"\"))");
    expect(routes).toContain("alertMonitoringService.sendImmediateBenchmarkAlertIfNeeded(String(id))");
  });
});
