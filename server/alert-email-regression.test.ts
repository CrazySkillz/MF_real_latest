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
    expect(source).toContain("private getFromAddress(): string");
    expect(source).toContain("|| 'alerts@mimo.app'");
    expect(source).toContain("const from = this.getFromAddress();");
    expect(source).not.toContain("alerts@metricmind.app");
    expect(source).not.toContain("Performance Alert</h1>");
    expect(source).not.toContain("linear-gradient(135deg, #667eea 0%, #764ba2 100%)");
    expect(source).not.toContain("Review this ${data.type} in your MetricMind dashboard");
    expect(source).not.toContain("Review this ${data.type} in your MimoSaaS dashboard");
    expect(source).not.toContain("This is an automated alert from MetricMind");
  });

  it("tries the alternate Mailgun API region only after auth or forbidden failures", () => {
    const source = readEmailService();

    expect(source).toContain("const regionsToTry = region === 'eu' ? ['eu', 'us'] : ['us', 'eu'];");
    expect(source).toContain("const authLikeFailure = response.status === 401 || response.status === 403;");
    expect(source).toContain("if (!authLikeFailure || attempt === regionsToTry.length - 1)");
    expect(source).toContain("Mailgun ${candidateRegion} API rejected the request; trying ${regionsToTry[attempt + 1]} region before failing.");
    expect(source).toContain("Mailgun ${candidateRegion} API ${response.status}: ${errorText}");
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

  it("keeps invalid values fail-closed and uses audit claims, not lastAlertSent, for immediate sends", () => {
    const source = readAlertMonitoring();
    const kpiImmediate = source.slice(source.indexOf("async sendImmediateKPIAlertIfNeeded"), source.indexOf("async sendImmediateBenchmarkAlertIfNeeded"));
    const benchmarkImmediate = source.slice(source.indexOf("async sendImmediateBenchmarkAlertIfNeeded"), source.indexOf("private async markAlertEmailRetrySkipped"));

    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;");
    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) continue;");
    expect(kpiImmediate).not.toContain("shouldThrottleAlert(kpi.lastAlertSent");
    expect(benchmarkImmediate).not.toContain("shouldThrottleAlert(benchmark.lastAlertSent");
    expect(source).toContain("if (this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) {");
    expect(source).toContain("if (this.shouldThrottleAlert(benchmark.lastAlertSent, frequencyHours)) {");
    const parseIndex = kpiImmediate.indexOf("const currentValue = this.parseAlertNumber(kpi.currentValue);");
    const claimIndex = kpiImmediate.indexOf("const claim = retryClaim || await this.claimAlertEmailWindow({");
    const sendIndex = kpiImmediate.indexOf("const emailSent = await emailService.sendAlertEmail(recipients, {");
    expect(parseIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(parseIndex);
    expect(sendIndex).toBeGreaterThan(claimIndex);
  });

  it("honors scheduled KPI alert email delivery metadata before sending", () => {
    const source = readAlertMonitoring();

    expect(source).toContain("isAlertEmailScheduleDue");
    expect(source.match(/isAlertEmailScheduleDue\(\(kpi as any\)\.calculationConfig, frequency\)/g) || []).toHaveLength(2);
  });

  it("awaits immediate email checks after KPI and Benchmark create/update routes", () => {
    const routes = readRoutes();

    expect(routes).toContain('await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "KPI Create");');
    expect(routes).toContain('await runImmediateKPIEmailAlertCheck(kpiId, "KPI Update");');
    expect(routes).toContain('await runImmediateKPIEmailAlertCheck((kpi as any)?.id, "Campaign KPI Create");');
    expect(routes).toContain('await runImmediateKPIEmailAlertCheck(kpiId, "Campaign KPI Update");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Campaign Benchmark Create");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Campaign Benchmark Update");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Platform Benchmark Create");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck(benchmarkId, "Platform Benchmark Update");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck((benchmark as any)?.id, "Benchmark Create");');
    expect(routes).toContain('await runImmediateBenchmarkEmailAlertCheck(id, "Benchmark Update");');
    expect(routes).not.toContain(".then(({ alertMonitoringService }) => alertMonitoringService.sendImmediate");
  });
});
