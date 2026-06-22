export type KpiBand = "above" | "near" | "below";
export type KpiThresholdPolicyKind = "count" | "rate" | "revenue" | "ratio" | "cost" | "generic";

export type KpiThresholdPolicy = {
  kind: KpiThresholdPolicyKind;
  nearTargetBandPct: number;
  absoluteTolerance: number;
};

const LOWER_IS_BETTER_HINTS = ["cpc", "cpm", "cpa", "cpl", "spend"];
const RATE_HINTS = ["rate", "ctr", "cvr", "percentage"];
const REVENUE_HINTS = ["revenue", "sales", "profit", "value"];
const RATIO_HINTS = ["roas", "roi", "ratio"];
const COUNT_HINTS = ["conversion", "conversions", "users", "sessions", "leads", "events", "count"];
const DEFAULT_NEAR_TARGET_BAND_PCT = 5;

export function isLowerIsBetterKpi(opts: { metric?: string | null; name?: string | null }): boolean {
  const metric = String(opts.metric || "").toLowerCase();
  const name = String(opts.name || "").toLowerCase();
  return LOWER_IS_BETTER_HINTS.some((m) => metric.includes(m) || name.includes(m));
}

export function computeDelta(current: number, target: number): number | null {
  const c = Number.isFinite(current) ? current : 0;
  const t = Number.isFinite(target) ? target : 0;
  if (t <= 0) return null;
  return c - t;
}

// Percent difference vs target. Example: current=110, target=100 => +10
export function computeDeltaPct(current: number, target: number): number | null {
  const c = Number.isFinite(current) ? current : 0;
  const t = Number.isFinite(target) ? target : 0;
  if (t <= 0) return null;
  return ((c - t) / t) * 100;
}

// "Effective" delta for banding where positive means "better vs target".
// For lower-is-better KPIs, this flips the sign so being below target is positive (better).
export function computeEffectiveDeltaPct(opts: { current: number; target: number; lowerIsBetter: boolean }): number | null {
  const raw = computeDeltaPct(opts.current, opts.target);
  if (raw === null) return null;
  return opts.lowerIsBetter ? -raw : raw;
}

// Mutual-exclusive bands for summary cards.
// If within +/- nearTargetBandPct => "near", otherwise above/below.
export function classifyKpiBand(opts: { effectiveDeltaPct: number; nearTargetBandPct: number }): KpiBand {
  const band = Math.max(0, Number(opts.nearTargetBandPct || 0));
  if (opts.effectiveDeltaPct > band) return "above";
  if (opts.effectiveDeltaPct < -band) return "below";
  return "near";
}

function includesAnyMetricHint(metric: string, name: string, hints: string[]): boolean {
  return hints.some((hint) => metric.includes(hint) || name.includes(hint));
}

function normalizeUnit(unit?: string | null): string {
  return String(unit || "").trim().toLowerCase();
}

export function resolveKpiThresholdPolicy(opts: {
  metric?: string | null;
  name?: string | null;
  unit?: string | null;
  target: number;
  current?: number;
  lowerIsBetter?: boolean;
  defaultNearTargetBandPct?: number;
}): KpiThresholdPolicy {
  const metric = String(opts.metric || "").toLowerCase();
  const name = String(opts.name || "").toLowerCase();
  const unit = normalizeUnit(opts.unit);
  const target = Number.isFinite(opts.target) ? Math.abs(opts.target) : 0;
  const defaultBand = Math.max(0, Number(opts.defaultNearTargetBandPct ?? DEFAULT_NEAR_TARGET_BAND_PCT));
  const lowerIsBetter = opts.lowerIsBetter ?? isLowerIsBetterKpi({ metric, name });

  if (unit === "%" || unit === "percent" || unit === "percentage" || includesAnyMetricHint(metric, name, RATE_HINTS)) {
    const absoluteTolerance = target >= 2 ? 0.25 : 0;
    return { kind: "rate", nearTargetBandPct: defaultBand, absoluteTolerance };
  }

  if (unit === "count" || includesAnyMetricHint(metric, name, COUNT_HINTS)) {
    const absoluteTolerance = target < 5 ? 0 : target < 20 ? 1 : Math.max(1, target * (defaultBand / 100));
    const nearTargetBandPct = target > 0 ? Math.max(defaultBand, (absoluteTolerance / target) * 100) : defaultBand;
    return { kind: "count", nearTargetBandPct, absoluteTolerance };
  }

  if (unit === "currency" || unit === "$" || unit === "usd" || unit === "eur" || unit === "gbp" || includesAnyMetricHint(metric, name, REVENUE_HINTS)) {
    return { kind: lowerIsBetter ? "cost" : "revenue", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  if (unit === "ratio" || unit === "x" || includesAnyMetricHint(metric, name, RATIO_HINTS)) {
    return { kind: "ratio", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  if (lowerIsBetter) {
    return { kind: "cost", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  return { kind: "generic", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
}

export function classifyKpiBandWithPolicy(opts: {
  current: number;
  target: number;
  lowerIsBetter: boolean;
  policy: KpiThresholdPolicy;
}): KpiBand | null {
  const effectiveDeltaPct = computeEffectiveDeltaPct({
    current: opts.current,
    target: opts.target,
    lowerIsBetter: opts.lowerIsBetter,
  });
  if (effectiveDeltaPct === null) return null;

  const rawDelta = computeDelta(opts.current, opts.target);
  const effectiveDelta = rawDelta === null ? null : opts.lowerIsBetter ? -rawDelta : rawDelta;
  const absoluteTolerance = Math.max(0, Number(opts.policy.absoluteTolerance || 0));
  if (effectiveDelta !== null && Math.abs(effectiveDelta) <= absoluteTolerance) return "near";

  return classifyKpiBand({ effectiveDeltaPct, nearTargetBandPct: opts.policy.nearTargetBandPct });
}

// Progress for KPI cards:
// - Label uses uncapped attainment percent (can be > 100 when beating target).
// - Bar fill is capped to 0..100 for stable UI.
export function computeAttainmentPct(opts: { current: number; target: number; lowerIsBetter: boolean }): number | null {
  const c = Number.isFinite(opts.current) ? opts.current : 0;
  const t = Number.isFinite(opts.target) ? opts.target : 0;
  if (t <= 0) return null;

  const ratio = opts.lowerIsBetter ? (c > 0 ? t / c : 1) : c / t;
  if (!Number.isFinite(ratio)) return null;
  return Math.max(0, ratio * 100);
}

export function computeAttainmentFillPct(attainmentPct: number): number {
  const pct = Number.isFinite(attainmentPct) ? attainmentPct : 0;
  return Math.max(0, Math.min(pct, 100));
}


