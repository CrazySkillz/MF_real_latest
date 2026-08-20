import { resolveGA4KpiMetricIdentity } from "./ga4-kpi-metric-identity";

export type GA4KpiInputState = "ready" | "loading" | "unavailable" | "stale";
export type GA4KpiListState = "ready" | "loading" | "failed" | "stale";
export type GA4KpiConsumerStateCode =
  | "verified"
  | "loading"
  | "failed"
  | "unavailable"
  | "stale"
  | "blocked"
  | "insufficient_data";

export type GA4KpiConsumerState = {
  code: GA4KpiConsumerStateCode;
  eligible: boolean;
  label: string;
  detail: string;
};

const state = (
  code: GA4KpiConsumerStateCode,
  label: string,
  detail: string,
): GA4KpiConsumerState => ({ code, eligible: code === "verified", label, detail });

export function getGA4KpiReportingWindowLabel(metric: unknown, name?: unknown): string {
  const identity = resolveGA4KpiMetricIdentity(metric, name);
  if (identity === "revenue" || identity === "roas" || identity === "roi" || identity === "cpa") {
    return "Campaign-to-date financial inputs";
  }
  if (identity) return "Initial import through latest completed reporting day";
  return "Saved custom value (no standard GA4 reporting window)";
}

export type GA4InsightTargetPeriodCompatibility = {
  comparable: boolean;
  currentWindow: string;
  configuredPeriod: string;
  reason: string | null;
};

export function resolveGA4InsightTargetPeriodCompatibility(input: {
  metric?: unknown;
  name?: unknown;
  timeframe?: unknown;
  trackingPeriod?: unknown;
  period?: unknown;
}): GA4InsightTargetPeriodCompatibility {
  const identity = resolveGA4KpiMetricIdentity(input.metric, input.name);
  const currentWindow = getGA4KpiReportingWindowLabel(input.metric, input.name);
  const configuredPeriod = String(input.period ?? input.timeframe ?? "").trim().toLowerCase();
  if (!identity) {
    return {
      comparable: false,
      currentWindow,
      configuredPeriod: configuredPeriod || "not specified",
      reason: "A standard GA4 reporting window cannot be verified for this custom value.",
    };
  }

  // Standard GA4 KPI/Benchmark targets are absolute goals. Legacy period fields
  // are metadata and must not replace the authoritative cumulative current value.
  return {
    comparable: true,
    currentWindow,
    configuredPeriod: configuredPeriod || "absolute target",
    reason: null,
  };
}

export function resolveGA4KpiConsumerState(input: {
  metric?: unknown;
  name?: unknown;
  listState: GA4KpiListState;
  trafficState: GA4KpiInputState;
  revenueState: GA4KpiInputState;
  spendState: GA4KpiInputState;
  missingDependencies?: string[];
  sufficiencyReason?: string | null;
  entityLabel?: "KPI" | "Benchmark";
}): GA4KpiConsumerState {
  const entityLabel = input.entityLabel || "KPI";
  if (input.listState === "loading") {
    return state("loading", "Loading", `The ${entityLabel} list is still loading.`);
  }
  if (input.listState === "failed") {
    return state("failed", "Failed", `The ${entityLabel} list could not be loaded.`);
  }
  if (input.listState === "stale") {
    return state("stale", "Last-good — not verified", `The last loaded ${entityLabel} row is visible, but its current state was not freshly verified.`);
  }

  const identity = resolveGA4KpiMetricIdentity(input.metric, input.name);
  const requiredStates: GA4KpiInputState[] = [];
  if (identity === "revenue") requiredStates.push(input.revenueState);
  else if (identity === "roas" || identity === "roi") requiredStates.push(input.revenueState, input.spendState);
  else if (identity === "cpa") requiredStates.push(input.trafficState, input.spendState);
  else if (identity) requiredStates.push(input.trafficState);

  if (requiredStates.includes("unavailable")) {
    return state("unavailable", "Unavailable", "A required source input could not be verified.");
  }
  if (requiredStates.includes("stale")) {
    return state("stale", "Last-good — not verified", "A required source failed to refresh; the visible value is retained last-good data.");
  }
  if (requiredStates.includes("loading")) {
    return state("loading", "Loading", "Required source inputs are still loading.");
  }
  const missing = input.missingDependencies || [];
  if (missing.length > 0) {
    return state("blocked", "Blocked", `Missing ${missing.join(" + ")}.`);
  }
  if (input.sufficiencyReason) {
    return state("insufficient_data", "Insufficient data", input.sufficiencyReason);
  }
  return state("verified", "Verified current value", "Required browser inputs are available for evaluation.");
}
