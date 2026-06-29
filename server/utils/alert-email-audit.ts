import { db } from "../db";
import { and, eq, inArray } from "drizzle-orm";
import { emailAlertEvents } from "../../shared/schema.js";
import { createHash } from "crypto";

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

export const ALERT_EMAIL_MAX_ATTEMPTS = 3;
export const ALERT_EMAIL_RETRY_BASE_DELAY_MS = 15 * 60 * 1000;
export const ALERT_EMAIL_RETRY_MAX_DELAY_MS = 4 * 60 * 60 * 1000;

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

type AlertEmailScheduledFrequency = Exclude<AlertEmailFrequency, "immediate">;

export type AlertEmailScheduleConfig = {
  frequency: AlertEmailScheduledFrequency;
  hour: number;
  dayOfWeek?: string;
  timeZone?: string;
};

const ALERT_EMAIL_DAY_INDEX: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

function normalizeAlertEmailScheduleTimeZone(value: unknown): string | undefined {
  const timeZone = String(value || "").trim();
  if (!timeZone) return undefined;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
    return timeZone;
  } catch {
    return undefined;
  }
}

function getAlertEmailScheduleDateParts(now: Date, timeZone?: string): { hour: number; dayOfWeek: number } {
  if (!timeZone) return { hour: now.getUTCHours(), dayOfWeek: now.getUTCDay() };
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "long",
      hour: "2-digit",
      hourCycle: "h23",
    }).formatToParts(now);
    const hour = Number(parts.find((part) => part.type === "hour")?.value);
    const weekday = String(parts.find((part) => part.type === "weekday")?.value || "").toLowerCase();
    const dayOfWeek = ALERT_EMAIL_DAY_INDEX[weekday];
    if (Number.isInteger(hour) && hour >= 0 && hour <= 23 && typeof dayOfWeek === "number") {
      return { hour, dayOfWeek };
    }
  } catch {
    // Fall through to UTC compatibility behavior.
  }
  return { hour: now.getUTCHours(), dayOfWeek: now.getUTCDay() };
}

export function getAlertEmailScheduleConfig(calculationConfig: unknown): AlertEmailScheduleConfig | null {
  if (!calculationConfig || typeof calculationConfig !== "object" || Array.isArray(calculationConfig)) return null;
  const schedule = (calculationConfig as any).alertEmailSchedule;
  if (!schedule || typeof schedule !== "object" || Array.isArray(schedule)) return null;

  const rawFrequency = String((schedule as any).frequency || "").trim().toLowerCase();
  if (rawFrequency !== "daily" && rawFrequency !== "weekly") return null;
  const frequency = rawFrequency as AlertEmailScheduledFrequency;

  const hour = Number((schedule as any).hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null;

  const timeZone = normalizeAlertEmailScheduleTimeZone((schedule as any).timeZone);

  if (frequency === "weekly") {
    const dayOfWeek = String((schedule as any).dayOfWeek || "").trim().toLowerCase();
    if (!(dayOfWeek in ALERT_EMAIL_DAY_INDEX)) return null;
    return { frequency, hour, dayOfWeek, ...(timeZone ? { timeZone } : {}) };
  }

  return { frequency, hour, ...(timeZone ? { timeZone } : {}) };
}

export function isAlertEmailScheduleDue(
  calculationConfig: unknown,
  frequency: unknown,
  now: Date = new Date(),
): boolean {
  const normalizedFrequency = normalizeAlertEmailFrequency(frequency);
  if (normalizedFrequency === "immediate") return true;

  const schedule = getAlertEmailScheduleConfig(calculationConfig);
  if (!schedule || schedule.frequency !== normalizedFrequency) return true;
  const scheduledNow = getAlertEmailScheduleDateParts(now, schedule.timeZone);
  if (scheduledNow.hour !== schedule.hour) return false;
  if (normalizedFrequency === "weekly") {
    return scheduledNow.dayOfWeek === ALERT_EMAIL_DAY_INDEX[String(schedule.dayOfWeek || "")];
  }
  return true;
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
  recipients?: string[];
  sender?: string;
  now?: Date;
}): string {
  const itemType = args.itemType === "benchmark" ? "benchmark" : "kpi";
  const itemId = String(args.itemId || "").trim();
  const frequency = normalizeAlertEmailFrequency(args.frequency);
  const windowStart = getAlertEmailFrequencyWindowStart(frequency, args.now);
  const recipients = Array.isArray(args.recipients)
    ? args.recipients.map((recipient) => String(recipient || "").trim().toLowerCase()).filter(Boolean).sort()
    : [];
  const sender = String(args.sender || "").trim().toLowerCase();
  const scope = [sender, recipients.join(",")].filter(Boolean).join("|");
  const scopeSuffix = scope ? `:${createHash("sha1").update(scope).digest("hex").slice(0, 12)}` : "";
  return `alert-email:${itemType}:${itemId}:${frequency}:${windowStart.toISOString()}${scopeSuffix}`;
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
  if (inserted?.[0]) return { id: String(inserted[0].id) };

  const dedupeKey = String(values.dedupeKey || "").trim();
  if (!dedupeKey || !dedupeKey.includes(":immediate:")) return null;
  const reclaimableStatuses = ["failed", "skipped", "retry_scheduled"];
  const reclaimed = await db
    .update(emailAlertEvents)
    .set({
      ...values,
      deliveryStatus: "sending",
      provider: "pending",
      success: false,
      nextAttemptAt: null,
      failedAt: null,
      error: null,
      lastAttemptAt: new Date(),
    } as any)
    .where(and(
      eq(emailAlertEvents.dedupeKey, dedupeKey),
      inArray(emailAlertEvents.deliveryStatus, reclaimableStatuses),
    ))
    .returning({ id: emailAlertEvents.id })
    .catch((error: any) => {
      console.warn("[Alert Email Audit] Failed to reclaim failed alert email send claim:", error?.message || error);
      return [];
    });
  return reclaimed?.[0] ? { id: String(reclaimed[0].id) } : null;
}

export async function claimAlertEmailSend(
  args: {
    itemType: AlertEmailItemType;
    itemId: string;
    frequency: unknown;
    recipients: string[];
    sender?: string;
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
    recipients: args.recipients,
    sender: args.sender,
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
export function normalizeAlertEmailAttemptCount(value: unknown): number {
  const attemptCount = Number(value);
  return Number.isFinite(attemptCount) ? Math.max(0, Math.trunc(attemptCount)) : 0;
}

export function getAlertEmailRetryDelayMs(attemptCount: unknown): number {
  const currentAttempt = Math.max(1, normalizeAlertEmailAttemptCount(attemptCount));
  const delay = ALERT_EMAIL_RETRY_BASE_DELAY_MS * Math.pow(2, currentAttempt - 1);
  return Math.min(delay, ALERT_EMAIL_RETRY_MAX_DELAY_MS);
}

export function buildAlertEmailRetryState(args: {
  attemptCount: unknown;
  now?: Date;
  maxAttempts?: number;
}): {
  deliveryStatus: AlertEmailDeliveryStatus;
  nextAttemptAt?: Date;
  failedAt?: Date;
  retryExhausted: boolean;
} {
  const now = args.now || new Date();
  const attemptCount = normalizeAlertEmailAttemptCount(args.attemptCount);
  const maxAttempts = Math.max(1, normalizeAlertEmailAttemptCount(args.maxAttempts ?? ALERT_EMAIL_MAX_ATTEMPTS));

  if (attemptCount >= maxAttempts) {
    return {
      deliveryStatus: "failed",
      failedAt: now,
      retryExhausted: true,
    };
  }

  return {
    deliveryStatus: "retry_scheduled",
    nextAttemptAt: new Date(now.getTime() + getAlertEmailRetryDelayMs(attemptCount)),
    retryExhausted: false,
  };
}
