import { computeCpa } from "./metric-math";

function round2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return parseFloat(n.toFixed(2));
}

// All functions below return numbers rounded to 2 decimals (enterprise deterministic display values).
export function computeCtrPercent(clicks: number, impressions: number): number {
  const c = Number.isFinite(clicks) ? clicks : 0;
  const i = Number.isFinite(impressions) ? impressions : 0;
  return i > 0 ? round2((c / i) * 100) : 0;
}

export function computeCpc(spend: number, clicks: number): number {
  const sp = Number.isFinite(spend) ? spend : 0;
  const c = Number.isFinite(clicks) ? clicks : 0;
  return c > 0 ? round2(sp / c) : 0;
}

export function computeCpm(spend: number, impressions: number): number {
  const sp = Number.isFinite(spend) ? spend : 0;
  const i = Number.isFinite(impressions) ? impressions : 0;
  return i > 0 ? round2((sp / i) * 1000) : 0;
}

export function computeCvrPercent(conversions: number, clicks: number): number {
  const conv = Number.isFinite(conversions) ? conversions : 0;
  const c = Number.isFinite(clicks) ? clicks : 0;
  return c > 0 ? round2((conv / c) * 100) : 0;
}

export function computeCpaRounded(spend: number, conversions: number): number {
  return round2(computeCpa(spend, conversions));
}

export function computeCpl(spend: number, leads: number): number {
  const sp = Number.isFinite(spend) ? spend : 0;
  const l = Number.isFinite(leads) ? leads : 0;
  return l > 0 ? round2(sp / l) : 0;
}

export function computeErPercent(engagements: number, impressions: number): number {
  const e = Number.isFinite(engagements) ? engagements : 0;
  const i = Number.isFinite(impressions) ? impressions : 0;
  return i > 0 ? round2((e / i) * 100) : 0;
}


