export type AlertCondition = "below" | "above" | "equals";

export function parseAlertNumber(input: unknown): number {
  const s = String(input ?? "").trim();
  if (!s) return NaN;
  const cleaned = s.replace(/,/g, "").replace(/[^\d.-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

export function normalizeAlertCondition(condition: unknown): AlertCondition {
  const normalized = String(condition || "below").trim().toLowerCase();
  return normalized === "above" || normalized === "equals" ? normalized : "below";
}

export function evaluateAlertCondition(
  currentValue: number,
  thresholdValue: number,
  condition: unknown
): boolean {
  if (!Number.isFinite(currentValue) || !Number.isFinite(thresholdValue)) return false;
  switch (normalizeAlertCondition(condition)) {
    case "above":
      return currentValue > thresholdValue;
    case "equals":
      return Math.abs(currentValue - thresholdValue) < 0.01;
    case "below":
    default:
      return currentValue < thresholdValue;
  }
}

export function evaluateAlertThreshold(opts: {
  currentValue: unknown;
  thresholdValue: unknown;
  condition?: unknown;
}): { triggered: boolean; currentValue: number; thresholdValue: number; condition: AlertCondition } {
  const currentValue = parseAlertNumber(opts.currentValue);
  const thresholdValue = parseAlertNumber(opts.thresholdValue);
  const condition = normalizeAlertCondition(opts.condition);
  return {
    triggered: evaluateAlertCondition(currentValue, thresholdValue, condition),
    currentValue,
    thresholdValue,
    condition,
  };
}
