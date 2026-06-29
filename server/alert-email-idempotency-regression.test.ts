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

  it("honors optional UTC schedule metadata for KPI alert emails", () => {
    const dailyConfig = { alertEmailSchedule: { frequency: "daily", hour: 9 } };
    const weeklyConfig = { alertEmailSchedule: { frequency: "weekly", hour: "16", dayOfWeek: "monday" } };

    expect(isAlertEmailScheduleDue(undefined, "daily", new Date("2026-06-29T08:00:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(dailyConfig, "daily", new Date("2026-06-29T09:15:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(dailyConfig, "daily", new Date("2026-06-29T08:59:00.000Z"))).toBe(false);
    expect(getAlertEmailScheduleConfig(weeklyConfig)).toEqual({ frequency: "weekly", hour: 16, dayOfWeek: "monday" });
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-29T16:30:00.000Z"))).toBe(true);
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-30T16:30:00.000Z"))).toBe(false);
    expect(isAlertEmailScheduleDue(weeklyConfig, "weekly", new Date("2026-06-29T15:30:00.000Z"))).toBe(false);
    expect(isAlertEmailScheduleDue(weeklyConfig, "daily", new Date("2026-06-29T15:30:00.000Z"))).toBe(true);
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
