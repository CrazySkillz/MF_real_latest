import { resolveKpiDataSufficiency } from "../../shared/kpi-math";
import { evaluateAlertThreshold } from "./alert-evaluation";

export type AlertDecisionReason =
  | "blocked"
  | "unavailable"
  | "stale"
  | "insufficient_sessions"
  | "insufficient_conversions"
  | "insufficient_spend";

export type AlertDecisionMetadata = {
  __alertDecisionEligible?: boolean;
  __alertDecisionReason?: AlertDecisionReason;
};

export function blockAlertDecision<T>(row: T, reason: AlertDecisionReason): T & AlertDecisionMetadata {
  return { ...row, __alertDecisionEligible: false, __alertDecisionReason: reason };
}

export function applyAlertDataSufficiency<T>(
  row: T,
  inputs: { metric?: string | null; name?: string | null; sessions?: number | null; conversions?: number | null; spend?: number | null },
): T & AlertDecisionMetadata {
  const sufficiency = resolveKpiDataSufficiency(inputs);
  if (!sufficiency.sufficient) {
    return blockAlertDecision(row, sufficiency.code || "blocked");
  }
  return { ...row, __alertDecisionEligible: true };
}

export function isAlertDecisionBreached(row: any): boolean {
  if (row?.__alertDecisionEligible === false) return false;
  if (!row?.alertsEnabled || row?.alertThreshold === null || typeof row?.alertThreshold === "undefined") return false;
  return evaluateAlertThreshold({
    currentValue: row?.currentValue,
    thresholdValue: row?.alertThreshold,
    condition: row?.alertCondition,
  }).triggered;
}
