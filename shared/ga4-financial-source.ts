export function selectGA4FinancialTotalsSource<T>(
  candidates: T[],
  fallback: T,
): T {
  return candidates.reduce((best, current) => (
    Number((current as any)?.revenue || 0) > Number((best as any)?.revenue || 0)
      ? current
      : best
  ), fallback);
}

export function normalizeGA4CampaignAllocationKey(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
