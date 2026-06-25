import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  ALERT_EMAIL_DELIVERY_STATUSES,
  buildAlertEmailAuditState,
  normalizeAlertEmailDeliveryStatus,
} from "./utils/alert-email-audit";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

describe("alert email audit state regression guard", () => {
  it("keeps the EMAIL-1 schema and migration contract for audit state and dedupe", () => {
    const schema = source("shared/schema.ts");
    const migration = source("migrations/0011_add_alert_email_audit_state.sql");
    const startup = source("server/index.ts");

    for (const text of [schema, migration, startup]) {
      expect(text).toContain("dedupe_key");
      expect(text).toContain("delivery_status");
      expect(text).toContain("provider_response_id");
      expect(text).toContain("attempt_count");
      expect(text).toContain("last_attempt_at");
      expect(text).toContain("next_attempt_at");
      expect(text).toContain("delivered_at");
      expect(text).toContain("failed_at");
      expect(text).toContain("email_alert_events_dedupe_key_unique");
    }

    expect(schema).toContain('success: boolean("success").notNull().default(false),');
    expect(schema).toContain('deliveryStatus: text("delivery_status").notNull().default("pending"),');
    expect(schema).toContain('uniqueIndex("email_alert_events_dedupe_key_unique").on(table.dedupeKey)');
    expect(migration).toContain("ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending'");
    expect(migration).toContain("CREATE UNIQUE INDEX IF NOT EXISTS email_alert_events_dedupe_key_unique");
    expect(migration).not.toContain("DROP COLUMN");
    expect(migration).not.toContain("DROP TABLE");
  });

  it("normalizes the supported alert email delivery statuses without treating acceptance as delivery", () => {
    expect(ALERT_EMAIL_DELIVERY_STATUSES).toEqual([
      "pending",
      "sending",
      "accepted",
      "pending_delivery",
      "delivered",
      "failed",
      "retry_scheduled",
      "skipped",
    ]);
    expect(normalizeAlertEmailDeliveryStatus("pending-delivery")).toBe("pending_delivery");
    expect(normalizeAlertEmailDeliveryStatus("provider accepted")).toBe("accepted");
    expect(normalizeAlertEmailDeliveryStatus("sent")).toBe("accepted");
    expect(normalizeAlertEmailDeliveryStatus("retrying")).toBe("retry_scheduled");
    expect(normalizeAlertEmailDeliveryStatus("duplicate")).toBe("skipped");
    expect(normalizeAlertEmailDeliveryStatus("unknown-status")).toBe("pending");
  });

  it("builds backward-compatible audit insert state from the existing success flag", () => {
    const now = new Date("2026-06-25T00:00:00.000Z");
    const accepted = buildAlertEmailAuditState({
      success: true,
      providerResponseId: "<provider-id>",
      now,
    });

    expect(accepted.deliveryStatus).toBe("accepted");
    expect(accepted.providerResponseId).toBe("<provider-id>");
    expect(accepted.attemptCount).toBe(1);
    expect(accepted.lastAttemptAt).toBe(now);
    expect(accepted.deliveredAt).toBeUndefined();
    expect(accepted.failedAt).toBeUndefined();

    const failed = buildAlertEmailAuditState({
      success: false,
      error: "provider rejected message",
      now,
    });

    expect(failed.deliveryStatus).toBe("failed");
    expect(failed.attemptCount).toBe(1);
    expect(failed.failedAt).toBe(now);
    expect(failed.deliveredAt).toBeUndefined();
  });

  it("extends the existing email-service audit insert without removing old consumers", () => {
    const emailService = source("server/services/email-service.ts");

    expect(emailService).toContain("const metadata = JSON.stringify({");
    expect(emailService).toContain("providerResponseId: args.providerResponseId");
    expect(emailService).toContain("success: args.success,");
    expect(emailService).toContain("deliveryStatus: retryState?.deliveryStatus || auditState.deliveryStatus,");
    expect(emailService).toContain("providerResponseId: auditState.providerResponseId,");
    expect(emailService).toContain("attemptCount: auditState.attemptCount,");
    expect(emailService).not.toContain('deliveryStatus: "delivered"');
  });
});
