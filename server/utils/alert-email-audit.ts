import { db } from "../db";
import { emailAlertEvents } from "../../shared/schema.js";

export const ALERT_EMAIL_DELIVERY_STATUSES = [
  "pending",
  "sending",
  "accepted",
  "pending_delivery",
  "delivered",
  "failed",
  "retry_scheduled",
  "skipped",
] as const;

export type AlertEmailDeliveryStatus = typeof ALERT_EMAIL_DELIVERY_STATUSES[number];
export type AlertEmailItemType = "kpi" | "benchmark";
export type AlertEmailFrequency = "immediate" | "daily" | "weekly";

type AlertEmailClaimInsertValues = {
  kind: "alert";
  entityType: AlertEmailItemType;
  entityId: string;
  dedupeKey: string;
  campaignId?: string;
  campaignName?: string;
  to: string;
  subject: string;
  provider: string;
  success: boolean;
  deliveryStatus: AlertEmailDeliveryStatus;
  attemptCount: number;
  lastAttemptAt: Date;
  metadata: string;
};

export type AlertEmailClaimInsert = (
  values: AlertEmailClaimInsertValues,
) => Promise<{ id: string } | null>;

export type AlertEmailSendClaim = {
  claimed: boolean;
  status: "sending" | "skipped";
  dedupeKey: string;
  frequency: AlertEmailFrequency;
  windowStart: Date;
  auditEventId?: string;
  reason?: "duplicate" | "claim_failed";
};

const DELIVERY_STATUS_SET = new Set<string>(ALERT_EMAIL_DELIVERY_STATUSES);

const DELIVERY_STATUS_ALIASES: Record<string, AlertEmailDeliveryStatus> = {
  queued: "pending",
  sendable: "pending",
  sent: "accepted",
  success: "accepted",
  succeeded: "accepted",
  provider_accepted: "accepted",
  pending_delivery_confirmation: "pending_delivery",
  retry: "retry_scheduled",
  retrying: "retry_scheduled",
  failed_delivery: "failed",
  failure: "failed",
  error: "failed",
  duplicate: "skipped",
};

export function normalizeAlertEmailFrequency(value: unknown): AlertEmailFrequency {
  const normalized = String(value || "daily").trim().toLowerCase();
  if (normalized === "immediate" || normalized === "weekly") return normalized;
  return "daily";
}

function alertEmailFrequencyWindowMs(frequency: AlertEmailFrequency): number {
  if (frequency === "immediate") return 60 * 60 * 1000;
  if (frequency === "weekly") return 7 * 24 * 60 * 60 * 1000;
  return 24 * 60 * 60 * 1000;
}

export function getAlertEmailFrequencyWindowStart(
  frequency: unknown,
  now: Date = new Date(),
): Date {
  const windowMs = alertEmailFrequencyWindowMs(normalizeAlertEmailFrequency(frequency));
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

export function buildAlertEmailDedupeKey(args: {
  itemType: AlertEmailItemType;
  itemId: string;
  frequency: unknown;
  now?: Date;
}): string {
  const itemType = args.itemType === "benchmark" ? "benchmark" : "kpi";
  const itemId = String(args.itemId || "").trim();
  const frequency = normalizeAlertEmailFrequency(args.frequency);
  const windowStart = getAlertEmailFrequencyWindowStart(frequency, args.now);
  return `alert-email:${itemType}:${itemId}:${frequency}:${windowStart.toISOString()}`;
}

async function insertAlertEmailClaimRow(values: AlertEmailClaimInsertValues): Promise<{ id: string } | null> {
  if (!db) return null;
  const inserted = await db
    .insert(emailAlertEvents)
    .values(values as any)
    .onConflictDoNothing()
    .returning({ id: emailAlertEvents.id })
    .catch((error: any) => {
      console.warn("[Alert Email Audit] Failed to claim alert email send:", error?.message || error);
      return [];
    });
  return inserted?.[0] ? { id: String(inserted[0].id) } : null;
}

export async function claimAlertEmailSend(
  args: {
    itemType: AlertEmailItemType;
    itemId: string;
    frequency: unknown;
    recipients: string[];
    subject: string;
    campaignId?: string;
    campaignName?: string;
    now?: Date;
  },
  insertClaim: AlertEmailClaimInsert = insertAlertEmailClaimRow,
): Promise<AlertEmailSendClaim> {
  const now = args.now || new Date();
  const frequency = normalizeAlertEmailFrequency(args.frequency);
  const windowStart = getAlertEmailFrequencyWindowStart(frequency, now);
  const dedupeKey = buildAlertEmailDedupeKey({
    itemType: args.itemType,
    itemId: args.itemId,
    frequency,
    now,
  });

  try {
    const inserted = await insertClaim({
      kind: "alert",
      entityType: args.itemType,
      entityId: String(args.itemId || ""),
      dedupeKey,
      campaignId: args.campaignId,
      campaignName: args.campaignName,
      to: args.recipients.join(", "),
      subject: args.subject,
      provider: "pending",
      success: false,
      deliveryStatus: "sending",
      attemptCount: 1,
      lastAttemptAt: now,
      metadata: JSON.stringify({
        frequency,
        windowStart: windowStart.toISOString(),
      }),
    });

    if (inserted?.id) {
      return { claimed: true, status: "sending", dedupeKey, frequency, windowStart, auditEventId: inserted.id };
    }

    console.info("[Alert Email Audit] Skipping duplicate alert email send claim", {
      dedupeKey,
      itemType: args.itemType,
      itemId: args.itemId,
      frequency,
    });
    return { claimed: false, status: "skipped", dedupeKey, frequency, windowStart, reason: "duplicate" };
  } catch (error: any) {
    console.warn("[Alert Email Audit] Failed to claim alert email send:", error?.message || error);
    return { claimed: false, status: "skipped", dedupeKey, frequency, windowStart, reason: "claim_failed" };
  }
}

export function normalizeAlertEmailDeliveryStatus(
  value: unknown,
  fallback: AlertEmailDeliveryStatus = "pending",
): AlertEmailDeliveryStatus {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (!normalized) return fallback;
  if (DELIVERY_STATUS_SET.has(normalized)) return normalized as AlertEmailDeliveryStatus;
  return DELIVERY_STATUS_ALIASES[normalized] || fallback;
}

export function buildAlertEmailAuditState(args: {
  dedupeKey?: string | null;
  deliveryStatus?: unknown;
  providerResponseId?: string;
  attemptCount?: number;
  success: boolean;
  error?: string;
  now?: Date;
  nextAttemptAt?: Date;
}): {
  dedupeKey?: string;
  deliveryStatus: AlertEmailDeliveryStatus;
  providerResponseId?: string;
  attemptCount: number;
  lastAttemptAt: Date;
  nextAttemptAt?: Date;
  deliveredAt?: Date;
  failedAt?: Date;
} {
  const now = args.now || new Date();
  const deliveryStatus = args.deliveryStatus
    ? normalizeAlertEmailDeliveryStatus(args.deliveryStatus)
    : args.success
      ? "accepted"
      : args.error
        ? "failed"
        : "pending";
  const attemptCount = Number.isFinite(args.attemptCount)
    ? Math.max(0, Math.trunc(Number(args.attemptCount)))
    : 1;
  const dedupeKey = String(args.dedupeKey || "").trim() || undefined;

  return {
    dedupeKey,
    deliveryStatus,
    providerResponseId: args.providerResponseId,
    attemptCount,
    lastAttemptAt: now,
    nextAttemptAt: args.nextAttemptAt,
    deliveredAt: deliveryStatus === "delivered" ? now : undefined,
    failedAt: deliveryStatus === "failed" ? now : undefined,
  };
}
