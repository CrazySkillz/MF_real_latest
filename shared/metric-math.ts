export type ProgressStatus = "on_track" | "needs_attention" | "behind";

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

export function computeProgressRatio(opts: { current: number; target: number; lowerIsBetter: boolean }): number {
  const current = Number.isFinite(opts.current) ? opts.current : 0;
  const target = Number.isFinite(opts.target) ? opts.target : 0;

  if (opts.lowerIsBetter) {
    // <= target is good, so progress is target/current.
    return current > 0 ? target / current : 0;
  }

  return target > 0 ? current / target : 0;
}

export function assessProgressStatus(ratio: number, thresholds?: { onTrack?: number; needsAttention?: number }): ProgressStatus {
  const onTrack = thresholds?.onTrack ?? 0.9;
  const needsAttention = thresholds?.needsAttention ?? 0.7;
  if (ratio >= onTrack) return "on_track";
  if (ratio >= needsAttention) return "needs_attention";
  return "behind";
}

export function computeProgress(opts: { current: number; target: number; lowerIsBetter: boolean }) {
  const ratio = computeProgressRatio(opts);
  const pct = clamp(ratio * 100, 0, 100);
  const status = assessProgressStatus(ratio);
  return {
    ratio,
    pct,
    labelPct: pct.toFixed(1),
    status,
  };
}

export function computeConversionRatePercent(conversions: number, sessions: number): number {
  const c = Number.isFinite(conversions) ? conversions : 0;
  const s = Number.isFinite(sessions) ? sessions : 0;
  return s > 0 ? (c / s) * 100 : 0;
}

// ROAS as percent: (Revenue ÷ Spend) × 100
export function computeRoasPercent(revenue: number, spend: number): number {
  const r = Number.isFinite(revenue) ? revenue : 0;
  const s = Number.isFinite(spend) ? spend : 0;
  return s > 0 ? (r / s) * 100 : 0;
}

// ROI as percent: ((Revenue − Spend) ÷ Spend) × 100
export function computeRoiPercent(revenue: number, spend: number): number {
  const r = Number.isFinite(revenue) ? revenue : 0;
  const s = Number.isFinite(spend) ? spend : 0;
  return s > 0 ? ((r - s) / s) * 100 : 0;
}

// CPA: Spend ÷ Conversions
export function computeCpa(spend: number, conversions: number): number {
  const sp = Number.isFinite(spend) ? spend : 0;
  const c = Number.isFinite(conversions) ? conversions : 0;
  return c > 0 ? sp / c : 0;
}


