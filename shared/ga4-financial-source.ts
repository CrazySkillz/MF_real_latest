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

// Detect retained financial values without treating a later save as proof that all
// Overview sources completed the same refresh. This never changes metric inputs.
export function resolveGA4OverviewFinancialRefreshWarning(input: {
  campaignId: string;
  currency: string;
  selectedPropertyId: string;
  primaryPropertyId: string;
  daily?: { propertyId?: string; overviewStartDate?: string; latestStoredDailyDate?: string; reportingTimeZone?: string; lastUpdated?: string | null };
  snapshot?: {
    campaignId?: string; reportingDate?: string; recordedAt?: string;
    metrics?: { financialDaily?: { currency?: string; currentValueWindow?: { startDate?: string; endDate?: string; reportingTimeZone?: string } } };
  } | null;
}): "earlier_update" | "unverified" | null {
  const { daily, snapshot } = input;
  // Initial/placeholder responses have no comparable displayed pair yet.
  if (!snapshot || !daily || !input.selectedPropertyId || daily.propertyId !== input.selectedPropertyId) return null;
  const financial = snapshot.metrics?.financialDaily;
  const window = financial?.currentValueWindow;
  const validDate = (value: string | undefined): value is string => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const timestamp = Date.parse(`${value}T00:00:00.000Z`);
    return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
  };
  if (!input.campaignId || snapshot.campaignId !== input.campaignId || input.selectedPropertyId !== input.primaryPropertyId
    || !input.currency || financial?.currency !== input.currency
    || !validDate(daily.overviewStartDate) || window?.startDate !== daily.overviewStartDate
    || !daily.reportingTimeZone || window?.reportingTimeZone !== daily.reportingTimeZone
    || !validDate(snapshot.reportingDate) || window?.endDate !== snapshot.reportingDate
    || !validDate(daily.latestStoredDailyDate)) return "unverified";
  if (snapshot.reportingDate < daily.latestStoredDailyDate) return "earlier_update";
  if (snapshot.reportingDate > daily.latestStoredDailyDate) return "unverified";
  const financialUpdatedAt = Date.parse(snapshot.recordedAt || "");
  const ga4UpdatedAt = Date.parse(daily.lastUpdated || "");
  if (!Number.isFinite(financialUpdatedAt) || !Number.isFinite(ga4UpdatedAt)) return "unverified";
  return financialUpdatedAt < ga4UpdatedAt ? "earlier_update" : null;
}
