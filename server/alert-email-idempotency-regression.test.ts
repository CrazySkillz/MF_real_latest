import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildAlertEmailDedupeKey,
  claimAlertEmailSend,
  getAlertEmailFrequencyWindowStart,
  getAlertEmailScheduleConfig,
  isAlertEmailScheduleDue,
  type AlertEmailClaimInsert,
} from "./utils/alert-email-audit";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

function inMemoryClaimInsert(): AlertEmailClaimInsert {
  const seen = new Set<string>();
  return async (values) => {
    if (seen.has(values.dedupeKey)) return null;
    seen.add(values.dedupeKey);
    return { id: `claim-${seen.size}` };
  };
}

describe("alert email idempotency regression guard", () => {
  beforeEach(() => {
    vi.spyOn(console, "info").mockImplementation(() => undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("builds deterministic frequency-window dedupe keys", () => {
    const now = new Date("2026-06-25T10:34:12.000Z");

    expect(getAlertEmailFrequencyWindowStart("immediate", now).toISOString()).toBe("2026-06-25T10:00:00.000Z");
    expect(getAlertEmailFrequencyWindowStart("daily", now).toISOString()).toBe("2026-06-25T00:00:00.000Z");
    expect(buildAlertEmailDedupeKey({
      itemType: "kpi",
      itemId: "kpi-1",
      frequency: "immediate",
      now,
    })).toBe("alert-email:kpi:kpi-1:immediate:2026-06-25T10:00:00.000Z");
  });

  it("honors optional local timezone schedule metadata for KPI alert emails", () => {
    const legacyDailyConfig = { alertEmailSchedule: { frequency: "daily", hour: 9 } };
    const dailyConfig = { alertEmailSchedule: { frequency: "daily", hour: 9, timeZone: "Europe/Amsterdam" } };
    const weeklyConfig = { alertEmailSchedule: { frequency: "weekly", hour: "16", dayOfWeek: "monday", timeZone: "Europe/Amsterdam" } };

    expect(isAlertEmailScheduleDue(undefined, "daily", new Date("2026-06-29T08:00:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(legacyDailyConfig, "daily", new Date("2026-06-29T09:15:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(legacyDailyConfig, "daily", new Date("2026-06-29T08:59:00.000Z"))).toBe(false);
    expect(isAlertEmailScheduleDue(dailyConfig, "daily", new Date("2026-06-29T07:15:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(dailyConfig, "daily", new Date("2026-06-29T06:59:00.000Z"))).toBe(false);
    expect(getAlertEmailScheduleConfig(weeklyConfig)).toEqual({ frequency: "weekly", hour: 16, dayOfWeek: "monday", timeZone: "Europe/Amsterdam" });
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-29T14:30:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-30T14:30:00.000Z"))).toBe(false);
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-29T13:30:00.000Z"))).toBe(false);
    expect(isAlertEmailScheduleDue(weeklyConfig, "daily", new Date("2026-06-29T15:30:00.000Z"))).toBe(true);
  });

  it("scopes alert email dedupe keys to sender and recipients", () => {
    const now = new Date("2026-06-25T10:34:12.000Z");
    const base = {
      itemType: "kpi" as const,
      itemId: "kpi-1",
      frequency: "immediate",
      now,
    };

    const scoped = buildAlertEmailDedupeKey({
      ...base,
      recipients: ["Exec@Example.com", "ops@example.com"],
      sender: "alerts@mimo.app",
    });
    const sameScope = buildAlertEmailDedupeKey({
      ...base,
      recipients: ["ops@example.com", "exec@example.com"],
      sender: "ALERTS@MIMO.APP",
    });
    const differentSender = buildAlertEmailDedupeKey({
      ...base,
      recipients: ["exec@example.com", "ops@example.com"],
      sender: "alerts@metricmind.app",
    });
    const differentRecipient = buildAlertEmailDedupeKey({
      ...base,
      recipients: ["exec@example.com"],
      sender: "alerts@mimo.app",
    });

    expect(scoped).toBe(sameScope);
    expect(scoped).not.toBe(buildAlertEmailDedupeKey(base));
    expect(scoped).not.toBe(differentSender);
    expect(scoped).not.toBe(differentRecipient);
  });
  it("allows one KPI send claim and skips a duplicate in the same frequency window", async () => {
    const insertClaim = inMemoryClaimInsert();
    const args = {
      itemType: "kpi" as const,
      itemId: "kpi-1",
      frequency: "immediate",
      recipients: ["exec@example.com"],
      subject: "Alert email send claim: Revenue",
      campaignId: "campaign-1",
      campaignName: "Campaign One",
      now: new Date("2026-06-25T10:34:12.000Z"),
    };

    const first = await claimAlertEmailSend(args, insertClaim);
    const duplicate = await claimAlertEmailSend(args, insertClaim);

    expect(first.claimed).toBe(true);
    expect(first.status).toBe("sending");
    expect(first.auditEventId).toBe("claim-1");
    expect(duplicate.claimed).toBe(false);
    expect(duplicate.status).toBe("skipped");
    expect(duplicate.reason).toBe("duplicate");
  });

  it("allows one Benchmark send claim and skips a duplicate in the same frequency window", async () => {
    const insertClaim = inMemoryClaimInsert();
    const args = {
      itemType: "benchmark" as const,
      itemId: "benchmark-1",
      frequency: "daily",
      recipients: ["exec@example.com"],
      subject: "Alert email send claim: ROAS",
      campaignId: "campaign-1",
      campaignName: "Campaign One",
      now: new Date("2026-06-25T10:34:12.000Z"),
    };

    const first = await claimAlertEmailSend(args, insertClaim);
    const duplicate = await claimAlertEmailSend(args, insertClaim);

    expect(first.claimed).toBe(true);
    expect(first.auditEventId).toBe("claim-1");
    expect(duplicate.claimed).toBe(false);
    expect(duplicate.reason).toBe("duplicate");
  });

  it("allows a new claim when the next frequency window is reached", async () => {
    const insertClaim = inMemoryClaimInsert();
    const base = {
      itemType: "kpi" as const,
      itemId: "kpi-1",
      frequency: "immediate",
      recipients: ["exec@example.com"],
      subject: "Alert email send claim: Revenue",
      campaignId: "campaign-1",
      campaignName: "Campaign One",
    };

    const first = await claimAlertEmailSend({ ...base, now: new Date("2026-06-25T10:34:12.000Z") }, insertClaim);
    const nextWindow = await claimAlertEmailSend({ ...base, now: new Date("2026-06-25T11:00:00.000Z") }, insertClaim);

    expect(first.claimed).toBe(true);
    expect(nextWindow.claimed).toBe(true);
    expect(first.dedupeKey).not.toBe(nextWindow.dedupeKey);
  });

  it("allows immediate retries to reclaim failed alert email claims without duplicating successful sends", () => {
    const audit = source("server/utils/alert-email-audit.ts");

    expect(audit).toContain('import { and, eq, inArray } from "drizzle-orm";');
    expect(audit).toContain('if (!dedupeKey || !dedupeKey.includes(":immediate:")) return null;');
    expect(audit).toContain('const reclaimableStatuses = ["failed", "skipped", "retry_scheduled"];');
    expect(audit).toContain('eq(emailAlertEvents.dedupeKey, dedupeKey)');
    expect(audit).toContain('inArray(emailAlertEvents.deliveryStatus, reclaimableStatuses)');
    expect(audit).toContain('deliveryStatus: "sending"');
    expect(audit).toContain('nextAttemptAt: null');
    expect(audit).not.toContain('const reclaimableStatuses = ["sending"');
    expect(audit).not.toContain('"accepted", "delivered"');
  });

  it("claims before provider sends and keeps lastAlertSent as a compatibility mirror", () => {
    const alertMonitoring = source("server/services/alert-monitoring.ts");

    expect(alertMonitoring).toContain('claimAlertEmailSend, isAlertEmailScheduleDue, type AlertEmailSendClaim');
    expect(alertMonitoring.match(/await this\.claimAlertEmailWindow\(/g) || []).toHaveLength(4);
    expect(alertMonitoring.match(/auditEventId: claim\.auditEventId/g) || []).toHaveLength(4);
    expect(alertMonitoring.match(/dedupeKey: claim\.dedupeKey/g) || []).toHaveLength(4);

    const firstClaimIndex = alertMonitoring.indexOf("const claim = await this.claimAlertEmailWindow({");
    const firstSendIndex = alertMonitoring.indexOf("const emailSent = await emailService.sendAlertEmail", firstClaimIndex);
    const firstLastSentIndex = alertMonitoring.indexOf("lastAlertSent: sql`CURRENT_TIMESTAMP`", firstSendIndex);
    expect(firstClaimIndex).toBeGreaterThan(-1);
    expect(firstSendIndex).toBeGreaterThan(firstClaimIndex);
    expect(firstLastSentIndex).toBeGreaterThan(firstSendIndex);
  });

  it("updates the claimed audit row instead of inserting a second row after provider send", () => {
    const emailService = source("server/services/email-service.ts");
    const updateIndex = emailService.indexOf("await db.update(emailAlertEvents)");
    const insertIndex = emailService.indexOf("await db.insert(emailAlertEvents).values(auditValues as any);");

    expect(emailService).toContain("auditEventId?: string;");
    expect(emailService).toContain("auditEventId: auditContext?.auditEventId,");
    expect(emailService).toContain("dedupeKey: auditContext?.dedupeKey,");
    expect(emailService).toContain("attemptCount: auditContext?.attemptCount,");
    expect(emailService).toContain('const auditEventId = String(ctx?.auditEventId || "").trim();');
    expect(emailService).toContain(".where(eq(emailAlertEvents.id, auditEventId));");
    expect(updateIndex).toBeGreaterThan(-1);
    expect(insertIndex).toBeGreaterThan(updateIndex);
  });
});
