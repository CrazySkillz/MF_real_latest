import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { emailService } from "./services/email-service";

const EMAIL_SERVICE_FILE = join(__dirname, "services", "email-service.ts");
const ALERT_MONITORING_FILE = join(__dirname, "services", "alert-monitoring.ts");
const ROUTES_FILE = join(__dirname, "routes-oauth.ts");
const GA4_METRICS_FILE = join(__dirname, "..", "client", "src", "pages", "ga4-metrics.tsx");

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
  afterEach(() => vi.restoreAllMocks());

  it("keeps KPI and Benchmark alert emails unbranded by the old header", () => {
    const source = readEmailService();

    expect(source).toContain('const alertTypeLabel = data.type === "kpi" ? "KPI" : "Benchmark";');
    expect(source).toContain('const subject = `⚠️ Alert: ${data.name} has ${conditionText} ${alertTypeLabel} threshold`;');
    expect(source).not.toContain('has ${conditionText} threshold`');
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

  it.each([
    ["kpi", "KPI"],
    ["benchmark", "Benchmark"],
  ] as const)("identifies %s threshold alerts in the email subject", async (type, label) => {
    const sendEmail = vi.spyOn(emailService as any, "sendEmail").mockResolvedValue(true);

    await emailService.sendAlertEmail(["exec@example.com"], {
      type,
      name: "Engagement Rate",
      currentValue: 4,
      thresholdValue: 5,
      condition: "below",
    });

    expect(sendEmail.mock.calls[0][0].subject).toBe(`⚠️ Alert: Engagement Rate has fallen below ${label} threshold`);
  });
  it("uses resolved campaign current values for immediate and scheduled email alert checks", () => {
    const source = readAlertMonitoring();

    expect(source).toContain('import { resolveAlertCurrentValueForDecision } from "../utils/ga4-alert-current-value";');
    expect(source).toContain('import { isAlertDecisionBreached } from "../utils/alert-decision";');
    expect(source).toContain("const kpi = await resolveAlertCurrentValueForDecision(rawKpi);");
    expect(source).toContain("const benchmark = await resolveAlertCurrentValueForDecision(rawBenchmark);");
    expect(source).toContain("const campaignMetricCache = new Map<string, Promise<any>>();");
    expect(source).toContain("const kpi = await resolveAlertCurrentValueForDecision(rawKpi, campaignMetricCache);");
    expect(source).toContain("const benchmark = await resolveAlertCurrentValueForDecision(rawBenchmark, campaignMetricCache);");
    expect(source.match(/if \(!isAlertDecisionBreached\((kpi|benchmark)\)\) (return false|continue);/g)).toHaveLength(6);
  });

  it("keeps invalid values fail-closed and suppresses repeated successful Immediate sends", () => {
    const source = readAlertMonitoring();
    const kpiImmediate = source.slice(source.indexOf("async sendImmediateKPIAlertIfNeeded"), source.indexOf("async sendImmediateBenchmarkAlertIfNeeded"));
    const benchmarkImmediate = source.slice(source.indexOf("async sendImmediateBenchmarkAlertIfNeeded"), source.indexOf("private async markAlertEmailRetrySkipped"));

    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;");
    expect(source).toContain("if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) continue;");
    expect(kpiImmediate).not.toContain("shouldThrottleAlert(kpi.lastAlertSent");
    expect(benchmarkImmediate).not.toContain("shouldThrottleAlert(benchmark.lastAlertSent");
    expect(kpiImmediate).toContain("if (!retryClaim && frequency === 'immediate' && kpi.lastAlertSent) return false;");
    expect(benchmarkImmediate).toContain("if (!retryClaim && frequency === 'immediate' && benchmark.lastAlertSent) return false;");
    expect(source).toContain("if (frequency === 'immediate' && kpi.lastAlertSent) continue;");
    expect(source).toContain("if (frequency === 'immediate' && benchmark.lastAlertSent) continue;");
    expect(source).not.toContain("frequency === 'immediate' ? 1");
    expect(source).toContain("if (this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) {");
    expect(source).toContain("if (this.shouldThrottleAlert(benchmark.lastAlertSent, frequencyHours)) {");
    const parseIndex = kpiImmediate.indexOf("const currentValue = this.parseAlertNumber(kpi.currentValue);");
    const claimIndex = kpiImmediate.indexOf("const claim = retryClaim || await this.claimAlertEmailWindow({");
    const sendIndex = kpiImmediate.indexOf("const emailSent = await emailService.sendAlertEmail(recipients, {");
    expect(parseIndex).toBeGreaterThan(-1);
    expect(claimIndex).toBeGreaterThan(parseIndex);
    expect(sendIndex).toBeGreaterThan(claimIndex);
  });

  it("uses a campaign-scoped breach episode and re-arms Immediate only after recovery", () => {
    const source = readAlertMonitoring();
    const kpiNotifications = readFileSync(join(__dirname, "kpi-notifications.ts"), "utf-8");
    const benchmarkNotifications = readFileSync(join(__dirname, "benchmark-notifications.ts"), "utf-8");

    expect(source).toContain('eq(notifications.campaignId, scopedCampaignId)');
    expect(source).toContain('const metadataId = itemType === "kpi" ? "kpiId" : "benchmarkId";');
    expect(source).toContain('row.metadata?.resolvedReason === "cleared"');
    expect(source).toContain('immediateEpisodeKey: immediateEpisodeKey || undefined,');
    for (const notificationsSource of [kpiNotifications, benchmarkNotifications]) {
      expect(notificationsSource).toContain("isNotNull(");
      expect(notificationsSource).toContain("lastAlertSent: null");
      expect(notificationsSource).toContain("reason ===");
      expect(notificationsSource).toContain("alertFrequency");
      expect(notificationsSource).toContain("immediate");
    }
  });

  it("explains the Immediate frequency in both GA4 KPI and Benchmark editors", () => {
    const source = readFileSync(GA4_METRICS_FILE, "utf-8");

    expect(source.match(/<SelectItem value="immediate">Immediate \(once per breach\)<\/SelectItem>/g) || []).toHaveLength(2);
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
