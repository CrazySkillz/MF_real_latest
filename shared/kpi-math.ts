export type KpiBand = "above" | "near" | "below";
export type KpiThresholdPolicyKind = "count" | "rate" | "revenue" | "ratio" | "cost" | "generic";
export type BenchmarkThresholdStatus = "on_track" | "needs_attention" | "behind";
export type BenchmarkThresholdDirection = "higher_is_better" | "lower_is_better";

export type KpiThresholdPolicy = {
  kind: KpiThresholdPolicyKind;
  nearTargetBandPct: number;
  absoluteTolerance: number;
};
export type BenchmarkThresholdPolicy = {
  kind: KpiThresholdPolicyKind;
  direction: BenchmarkThresholdDirection;
  onTrackTolerancePct: number;
  absoluteTolerance: number;
  behindThresholdPct: number;
};
export type BenchmarkThresholdResult = {
  policy: BenchmarkThresholdPolicy;
  status: BenchmarkThresholdStatus | null;
  ratio: number | null;
  pct: number;
  labelPct: string;
  effectiveDeltaPct: number | null;
  lowerIsBetter: boolean;
};
export type KpiDataSufficiencyCode = "insufficient_sessions" | "insufficient_conversions" | "insufficient_spend";
export type BenchmarkDataSufficiencyCode = KpiDataSufficiencyCode;

export type KpiDataSufficiencyResult = {
  sufficient: boolean;
  code?: KpiDataSufficiencyCode;
  reason?: string;
};
export type BenchmarkDataSufficiencyResult = KpiDataSufficiencyResult;

const LOWER_IS_BETTER_HINTS = ["cpc", "cpm", "cpa", "cpl", "spend"];
const RATE_HINTS = ["rate", "ctr", "cvr", "percentage"];
const REVENUE_HINTS = ["revenue", "sales", "profit", "value"];
const RATIO_HINTS = ["roas", "roi", "ratio"];
const COUNT_HINTS = ["conversion", "conversions", "users", "sessions", "leads", "events", "count"];
const DEFAULT_NEAR_TARGET_BAND_PCT = 5;
const DEFAULT_BENCHMARK_BEHIND_THRESHOLD_PCT = 70;
const FLOAT_EPSILON = 1e-9;

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

function normalizeMetricKey(value?: string | null): string {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function isCurrencyUnit(unit: string): boolean {
  return unit === "currency" || unit === "$" || unit === "€" || unit === "£" || unit === "¥" || /^[a-z]{3}$/.test(unit);
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

  if (unit === "ratio" || unit === "x" || includesAnyMetricHint(metric, name, RATIO_HINTS)) {
    return { kind: "ratio", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  if (unit === "%" || unit === "percent" || unit === "percentage" || includesAnyMetricHint(metric, name, RATE_HINTS)) {
    const absoluteTolerance = target >= 2 ? 0.25 : 0;
    return { kind: "rate", nearTargetBandPct: defaultBand, absoluteTolerance };
  }

  if (unit === "count" || includesAnyMetricHint(metric, name, COUNT_HINTS)) {
    const absoluteTolerance = target < 5 ? 0 : target < 20 ? 1 : Math.max(1, target * (defaultBand / 100));
    const nearTargetBandPct = target > 0 ? Math.max(defaultBand, (absoluteTolerance / target) * 100) : defaultBand;
    return { kind: "count", nearTargetBandPct, absoluteTolerance };
  }

  if (isCurrencyUnit(unit) || includesAnyMetricHint(metric, name, REVENUE_HINTS)) {
    return { kind: lowerIsBetter ? "cost" : "revenue", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  if (lowerIsBetter) {
    return { kind: "cost", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
  }

  return { kind: "generic", nearTargetBandPct: defaultBand, absoluteTolerance: 0 };
}

export function isLowerIsBetterBenchmark(opts: { metric?: string | null; name?: string | null }): boolean {
  return isLowerIsBetterKpi(opts);
}

export function resolveBenchmarkThresholdPolicy(opts: {
  metric?: string | null;
  name?: string | null;
  unit?: string | null;
  benchmarkValue: number;
  currentValue?: number;
  lowerIsBetter?: boolean;
  defaultOnTrackTolerancePct?: number;
  behindThresholdPct?: number;
  legacyRatioPolicy?: boolean;
}): BenchmarkThresholdPolicy {
  const lowerIsBetter = opts.lowerIsBetter ?? isLowerIsBetterBenchmark({ metric: opts.metric, name: opts.name });
  const behindThresholdPct = Math.max(0, Number(opts.behindThresholdPct ?? DEFAULT_BENCHMARK_BEHIND_THRESHOLD_PCT));

  if (opts.legacyRatioPolicy) {
    return {
      kind: "generic",
      direction: lowerIsBetter ? "lower_is_better" : "higher_is_better",
      onTrackTolerancePct: 10,
      absoluteTolerance: 0,
      behindThresholdPct,
    };
  }

  const kpiPolicy = resolveKpiThresholdPolicy({
    metric: opts.metric,
    name: opts.name,
    unit: opts.unit,
    target: opts.benchmarkValue,
    current: opts.currentValue,
    lowerIsBetter,
    defaultNearTargetBandPct: opts.defaultOnTrackTolerancePct ?? DEFAULT_NEAR_TARGET_BAND_PCT,
  });

  return {
    kind: kpiPolicy.kind,
    direction: lowerIsBetter ? "lower_is_better" : "higher_is_better",
    onTrackTolerancePct: kpiPolicy.nearTargetBandPct,
    absoluteTolerance: kpiPolicy.absoluteTolerance,
    behindThresholdPct,
  };
}

export function computeBenchmarkAttainmentRatio(opts: { current: number; benchmarkValue: number; lowerIsBetter: boolean }): number | null {
  const current = Number.isFinite(opts.current) ? opts.current : 0;
  const benchmarkValue = Number.isFinite(opts.benchmarkValue) ? opts.benchmarkValue : 0;
  if (benchmarkValue <= 0) return null;
  return opts.lowerIsBetter ? (current > 0 ? benchmarkValue / current : 0) : current / benchmarkValue;
}

export function classifyBenchmarkStatusWithPolicy(opts: {
  current: number;
  benchmarkValue: number;
  lowerIsBetter: boolean;
  policy: BenchmarkThresholdPolicy;
}): BenchmarkThresholdStatus | null {
  const ratio = computeBenchmarkAttainmentRatio(opts);
  if (ratio === null) return null;
  if (ratio <= FLOAT_EPSILON) return "behind";

  const effectiveDeltaPct = computeEffectiveDeltaPct({
    current: opts.current,
    target: opts.benchmarkValue,
    lowerIsBetter: opts.lowerIsBetter,
  });
  if (effectiveDeltaPct === null) return null;

  const rawDelta = computeDelta(opts.current, opts.benchmarkValue);
  const effectiveDelta = rawDelta === null ? null : opts.lowerIsBetter ? -rawDelta : rawDelta;
  const absoluteTolerance = Math.max(0, Number(opts.policy.absoluteTolerance || 0));
  if (effectiveDelta !== null && Math.abs(effectiveDelta) <= absoluteTolerance + FLOAT_EPSILON) return "on_track";

  const onTrackTolerancePct = Math.max(0, Number(opts.policy.onTrackTolerancePct || 0));
  if (effectiveDeltaPct + FLOAT_EPSILON >= -onTrackTolerancePct) return "on_track";

  const behindThresholdRatio = Math.max(0, Number(opts.policy.behindThresholdPct || 0)) / 100;
  return ratio + FLOAT_EPSILON < behindThresholdRatio ? "behind" : "needs_attention";
}

export function computeBenchmarkThresholdResult(opts: {
  metric?: string | null;
  name?: string | null;
  unit?: string | null;
  current: number;
  benchmarkValue: number;
  lowerIsBetter?: boolean;
  defaultOnTrackTolerancePct?: number;
  behindThresholdPct?: number;
  legacyRatioPolicy?: boolean;
}): BenchmarkThresholdResult {
  const lowerIsBetter = opts.lowerIsBetter ?? isLowerIsBetterBenchmark({ metric: opts.metric, name: opts.name });
  const policy = resolveBenchmarkThresholdPolicy({
    metric: opts.metric,
    name: opts.name,
    unit: opts.unit,
    benchmarkValue: opts.benchmarkValue,
    currentValue: opts.current,
    lowerIsBetter,
    defaultOnTrackTolerancePct: opts.defaultOnTrackTolerancePct,
    behindThresholdPct: opts.behindThresholdPct,
    legacyRatioPolicy: opts.legacyRatioPolicy,
  });
  const ratio = computeBenchmarkAttainmentRatio({ current: opts.current, benchmarkValue: opts.benchmarkValue, lowerIsBetter });
  const pct = ratio === null ? 0 : Math.max(0, Math.min(ratio * 100, 100));
  const status = classifyBenchmarkStatusWithPolicy({ current: opts.current, benchmarkValue: opts.benchmarkValue, lowerIsBetter, policy });

  return {
    policy,
    status,
    ratio,
    pct,
    labelPct: pct.toFixed(1),
    effectiveDeltaPct: computeEffectiveDeltaPct({ current: opts.current, target: opts.benchmarkValue, lowerIsBetter }),
    lowerIsBetter,
  };
}

export function resolveBenchmarkDataSufficiency(opts: {
  metric?: string | null;
  name?: string | null;
  sessions?: number | null;
  conversions?: number | null;
  spend?: number | null;
  minSessions?: number;
  minConversions?: number;
  minSpend?: number;
}): BenchmarkDataSufficiencyResult {
  const metric = normalizeMetricKey(opts.metric);
  const name = normalizeMetricKey(opts.name);
  const keys = [metric, name];
  const sessions = Number.isFinite(opts.sessions) ? Number(opts.sessions) : 0;
  const conversions = Number.isFinite(opts.conversions) ? Number(opts.conversions) : 0;
  const spend = Number.isFinite(opts.spend) ? Number(opts.spend) : 0;
  const minSessions = Math.max(1, Number(opts.minSessions || 1));
  const minConversions = Math.max(1, Number(opts.minConversions || 1));
  const minSpend = Math.max(0.01, Number(opts.minSpend || 0.01));

  if (keys.some((key) => key === "conversionrate" || key === "engagementrate") && sessions < minSessions) {
    return { sufficient: false, code: "insufficient_sessions", reason: "Needs sessions before this Benchmark can be scored." };
  }

  if (keys.some((key) => key === "cpa" || key.includes("costperacquisition")) && conversions < minConversions) {
    return { sufficient: false, code: "insufficient_conversions", reason: "Needs conversions before this Benchmark can be scored." };
  }

  if (keys.some((key) => key === "cpa" || key === "roas" || key === "roi" || key.includes("costperacquisition")) && spend < minSpend) {
    return { sufficient: false, code: "insufficient_spend", reason: "Needs spend before this Benchmark can be scored." };
  }

  return { sufficient: true };
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

export function resolveKpiDataSufficiency(opts: {
  metric?: string | null;
  name?: string | null;
  sessions?: number | null;
  conversions?: number | null;
  spend?: number | null;
  minSessions?: number;
  minConversions?: number;
  minSpend?: number;
}): KpiDataSufficiencyResult {
  const metric = normalizeMetricKey(opts.metric);
  const name = normalizeMetricKey(opts.name);
  const keys = [metric, name];
  const sessions = Number.isFinite(opts.sessions) ? Number(opts.sessions) : 0;
  const conversions = Number.isFinite(opts.conversions) ? Number(opts.conversions) : 0;
  const spend = Number.isFinite(opts.spend) ? Number(opts.spend) : 0;
  const minSessions = Math.max(1, Number(opts.minSessions || 1));
  const minConversions = Math.max(1, Number(opts.minConversions || 1));
  const minSpend = Math.max(0.01, Number(opts.minSpend || 0.01));

  if (keys.some((key) => key === "conversionrate" || key === "engagementrate") && sessions < minSessions) {
    return { sufficient: false, code: "insufficient_sessions", reason: "Needs sessions before this KPI can be scored." };
  }

  if (keys.some((key) => key === "cpa" || key.includes("costperacquisition")) && conversions < minConversions) {
    return { sufficient: false, code: "insufficient_conversions", reason: "Needs conversions before this KPI can be scored." };
  }

  if (keys.some((key) => key === "roas" || key === "roi") && spend < minSpend) {
    return { sufficient: false, code: "insufficient_spend", reason: "Needs spend before this KPI can be scored." };
  }

  return { sufficient: true };
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


