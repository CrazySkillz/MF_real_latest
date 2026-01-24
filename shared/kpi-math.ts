export type KpiBand = "above" | "near" | "below";

const LOWER_IS_BETTER_HINTS = ["cpc", "cpm", "cpa", "cpl", "spend"];

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


