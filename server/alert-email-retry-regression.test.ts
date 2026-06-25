import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ALERT_EMAIL_MAX_ATTEMPTS,
  ALERT_EMAIL_RETRY_BASE_DELAY_MS,
  buildAlertEmailRetryState,
  getAlertEmailRetryDelayMs,
} from "./utils/alert-email-audit";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

function sliceBetween(text: string, start: string, end: string): string {
  const startIndex = text.indexOf(start);
  expect(startIndex).toBeGreaterThan(-1);
  const endIndex = text.indexOf(end, startIndex + start.length);
  expect(endIndex).toBeGreaterThan(startIndex);
  return text.slice(startIndex, endIndex);
}

describe("alert email retry regression guard", () => {
  it("schedules bounded retry backoff before attempts are exhausted", () => {
    const now = new Date("2026-06-25T10:00:00.000Z");
    const retry = buildAlertEmailRetryState({ attemptCount: 1, now });

    expect(ALERT_EMAIL_MAX_ATTEMPTS).toBe(3);
    expect(getAlertEmailRetryDelayMs(1)).toBe(ALERT_EMAIL_RETRY_BASE_DELAY_MS);
    expect(getAlertEmailRetryDelayMs(2)).toBe(ALERT_EMAIL_RETRY_BASE_DELAY_MS * 2);
    expect(retry.deliveryStatus).toBe("retry_scheduled");
    expect(retry.nextAttemptAt?.toISOString()).toBe("2026-06-25T10:15:00.000Z");
    expect(retry.failedAt).toBeUndefined();
    expect(retry.retryExhausted).toBe(false);
  });

  it("marks exhausted retries as final failed state", () => {
    const now = new Date("2026-06-25T10:00:00.000Z");
    const retry = buildAlertEmailRetryState({ attemptCount: ALERT_EMAIL_MAX_ATTEMPTS, now });

    expect(retry.deliveryStatus).toBe("failed");
    expect(retry.nextAttemptAt).toBeUndefined();
    expect(retry.failedAt).toBe(now);
    expect(retry.retryExhausted).toBe(true);
  });

  it("schedules retries for provider send failures and confirmed Mailgun delivery failures", () => {
    const emailService = source("server/services/email-service.ts");
    const confirmedFailure = sliceBetween(
      emailService,
      "private async confirmMailgunAlertDelivery",
      "private async logEmailAuditEvent"
    );
    const auditLogging = sliceBetween(
      emailService,
      "private async logEmailAuditEvent",
      "const auditEventId = String(ctx?.auditEventId"
    );

    expect(confirmedFailure).toContain("const retryState = buildAlertEmailRetryState({");
    expect(confirmedFailure).toContain("updates.deliveryStatus = retryState.deliveryStatus;");
    expect(confirmedFailure).toContain("updates.nextAttemptAt = retryState.nextAttemptAt || null;");
    expect(auditLogging).toContain('ctx?.kind === "alert" && !args.success');
    expect(auditLogging).toContain("buildAlertEmailRetryState({ attemptCount: auditState.attemptCount })");
    expect(auditLogging).toContain("deliveryStatus: retryState?.deliveryStatus || auditState.deliveryStatus,");
    expect(auditLogging).toContain("nextAttemptAt: retryState ? (retryState.nextAttemptAt || null) : auditState.nextAttemptAt,");
  });

  it("processes due retries through the same audit row and dedupe key", () => {
    const alertMonitoring = source("server/services/alert-monitoring.ts");
    const retryProcessor = sliceBetween(
      alertMonitoring,
      "async processDueAlertEmailRetries",
      "// Check all KPIs for alerts"
    );

    expect(retryProcessor).toContain('eq(emailAlertEvents.deliveryStatus, "retry_scheduled")');
    expect(retryProcessor).toContain("lte(emailAlertEvents.nextAttemptAt, now)");
    expect(retryProcessor).toContain("if (attemptCount >= ALERT_EMAIL_MAX_ATTEMPTS)");
    expect(retryProcessor).toContain("auditEventId: id,");
    expect(retryProcessor).toContain("dedupeKey,");
    expect(retryProcessor).toContain("attemptCount: attemptCount + 1,");
    expect(retryProcessor).toContain("await this.sendImmediateKPIAlertIfNeeded(entityId, retryClaim)");
    expect(retryProcessor).toContain("await this.sendImmediateBenchmarkAlertIfNeeded(entityId, retryClaim)");
  });

  it("suppresses retries when KPI or Benchmark alerts are no longer sendable", () => {
    const alertMonitoring = source("server/services/alert-monitoring.ts");
    const kpiGate = sliceBetween(
      alertMonitoring,
      "private async isKPIAlertRetryStillSendable",
      "private async isBenchmarkAlertRetryStillSendable"
    );
    const benchmarkGate = sliceBetween(
      alertMonitoring,
      "private async isBenchmarkAlertRetryStillSendable",
      "async processDueAlertEmailRetries"
    );

    for (const gate of [kpiGate, benchmarkGate]) {
      expect(gate).toContain("alertsEnabled");
      expect(gate).toContain("emailNotifications");
      expect(gate).toContain("emailRecipients");
      expect(gate).toContain("getExistingCampaignName");
      expect(gate).toContain("true");
      expect(gate).toContain("!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)");
      expect(gate).toContain("!this.shouldSendAlert(currentValue, thresholdValue, condition)");
      expect(gate).toContain("return this.parseEmailRecipients");
    }
    expect(benchmarkGate).toContain("status || 'active'");
    expect(alertMonitoring).toContain('deliveryStatus: "skipped"');
    expect(alertMonitoring).toContain('"retry skipped: alert no longer sendable"');
  });

  it("does not create duplicate claims or KPI alert rows for retries", () => {
    const alertMonitoring = source("server/services/alert-monitoring.ts");

    expect(alertMonitoring).toContain("const claim = retryClaim || await this.claimAlertEmailWindow({");
    expect(alertMonitoring).toContain("if (!retryClaim && this.shouldThrottleAlert(kpi.lastAlertSent, frequencyHours)) return false;");
    expect(alertMonitoring).toContain("if (!retryClaim && this.shouldThrottleAlert(benchmark.lastAlertSent, frequencyHours)) return false;");
    expect(alertMonitoring).toContain("if (!retryClaim) {");
    expect(alertMonitoring).toContain("const retries = await this.processDueAlertEmailRetries();");
  });
});