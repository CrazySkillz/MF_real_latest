export function parseGA4FinancialNumber(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function isGA4FinancialTotalsCandidate(candidate: unknown): boolean {
  if (!candidate) return false;
  return ["revenue", "conversions"].every((field) => {
    const value = (candidate as any)?.[field];
    return parseGA4FinancialNumber(value) !== null;
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
