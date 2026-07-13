export type ShopifyRevenueRefreshTrigger = "manual" | "scheduler";

export type ShopifyRevenueRefreshEvent = {
  attemptAt: string;
  at: string;
  runId: string;
  trigger: ShopifyRevenueRefreshTrigger;
};

const stringValue = (value: any): string | null => {
  const normalized = String(value || "").trim();
  return normalized || null;
};

export function sanitizeShopifyRefreshError(error: any): string {
  return String(error?.message || error || "Shopify refresh failed")
    .replace(/(access[_-]?token|authorization|bearer)(\s*[:=]\s*|\s+)[^\s,;]+/gi, "$1$2[redacted]")
    .replace(/\bshp(?:at|ua|ca|pa)_[a-z0-9]+\b/gi, "[redacted]")
    .slice(0, 500);
}

export function markShopifyRevenueRefreshAttempt(
  existing: Record<string, any>,
  event: ShopifyRevenueRefreshEvent,
): Record<string, any> {
  return {
    ...(existing || {}),
    refreshStatus: "attempted",
    lastRefreshAttemptAt: event.attemptAt,
    lastRefreshRunId: event.runId,
    lastRefreshTrigger: event.trigger,
  };
}

export function markShopifyRevenueRefreshSuccess(
  nextMapping: Record<string, any>,
  previous: Record<string, any>,
  event: ShopifyRevenueRefreshEvent,
): Record<string, any> {
  const lastRefreshFailureAt = stringValue(previous?.lastRefreshFailureAt);
  return {
    ...(nextMapping || {}),
    ...(lastRefreshFailureAt ? { lastRefreshFailureAt } : {}),
    refreshStatus: "success",
    lastRefreshAttemptAt: event.attemptAt,
    lastRefreshSuccessAt: event.at,
    lastGoodAt: event.at,
    lastRefreshRunId: event.runId,
    lastRefreshTrigger: event.trigger,
    lastRefreshError: null,
    lastSyncedAt: event.at,
  };
}

export function markShopifyRevenueRefreshFailure(
  existing: Record<string, any>,
  event: ShopifyRevenueRefreshEvent,
  error: any,
): Record<string, any> {
  return {
    ...(existing || {}),
    refreshStatus: "failed",
    lastRefreshAttemptAt: event.attemptAt,
    lastRefreshFailureAt: event.at,
    lastRefreshRunId: event.runId,
    lastRefreshTrigger: event.trigger,
    lastRefreshError: sanitizeShopifyRefreshError(error),
  };
}

export function getShopifyRevenueRefreshFreshness(mapping: any): Record<string, any> | undefined {
  if (!mapping || typeof mapping !== "object") return undefined;
  const lastGoodAt = stringValue(mapping.lastGoodAt) || stringValue(mapping.lastRefreshSuccessAt) || stringValue(mapping.lastSyncedAt);
  const values = {
    provider: "shopify",
    refreshStatus: stringValue(mapping.refreshStatus),
    lastRefreshAttemptAt: stringValue(mapping.lastRefreshAttemptAt),
    lastRefreshSuccessAt: stringValue(mapping.lastRefreshSuccessAt) || stringValue(mapping.lastSyncedAt),
    lastRefreshFailureAt: stringValue(mapping.lastRefreshFailureAt),
    lastGoodAt,
    lastRefreshRunId: stringValue(mapping.lastRefreshRunId),
    lastRefreshTrigger: stringValue(mapping.lastRefreshTrigger),
    lastRefreshError: stringValue(mapping.lastRefreshError),
  };
  return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== null));
}
