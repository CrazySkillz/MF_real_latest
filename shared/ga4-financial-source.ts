export function isGA4FinancialTotalsCandidate(candidate: unknown): boolean {
  if (!candidate) return false;
  return ["revenue", "conversions"].every((field) => {
    const value = (candidate as any)?.[field];
    return value !== null && value !== undefined && Number.isFinite(Number(value));
  });
}

export function selectGA4FinancialTotalsSource<T>(
  candidates: Array<T | null | undefined>,
  fallback: T,
): T {
  const selected = candidates.find(isGA4FinancialTotalsCandidate);
  return selected ?? fallback;
}

export function normalizeGA4CampaignAllocationKey(value: unknown): string {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
}
