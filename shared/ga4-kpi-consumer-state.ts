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
  if (identity) return "30 completed reporting days (campaign reporting timezone)";
  return "Saved custom value (no standard GA4 reporting window)";
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
}): GA4KpiConsumerState {
  if (input.listState === "loading") {
    return state("loading", "Loading", "The KPI list is still loading.");
  }
  if (input.listState === "failed") {
    return state("failed", "Failed", "The KPI list could not be loaded.");
  }
  if (input.listState === "stale") {
    return state("stale", "Last-good — not verified", "The last loaded KPI row is visible, but its current state was not freshly verified.");
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
