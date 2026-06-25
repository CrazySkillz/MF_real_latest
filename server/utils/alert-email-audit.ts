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
