type FinancialSource = {
  id?: unknown;
  sourceId?: unknown;
  displayName?: unknown;
  sourceType?: unknown;
};

type FinancialTotal = {
  sourceIds?: unknown;
  spendToDate?: unknown;
  totalRevenue?: unknown;
};

const finiteAmount = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
};

const sourceIds = (value: unknown): string[] =>
  Array.isArray(value) ? Array.from(new Set(value.map(String).filter(Boolean))) : [];

const sourceLabel = (source: FinancialSource): string => {
  const type = String(source.sourceType || "").trim().toLowerCase();
  const fallback: Record<string, string> = {
    csv: "CSV", google_sheets: "Google Sheets", manual: "Manual",
    hubspot: "HubSpot", salesforce: "Salesforce", shopify: "Shopify",
    ga4: "Imported GA4 Revenue",
  };
  return String(source.displayName || fallback[type] || source.sourceType || "").trim();
};

const labelsForIds = (ids: string[], sources: FinancialSource[]) => {
  const labels: string[] = [];
  let missing = 0;
  for (const id of ids) {
    const source = sources.find((item) => String(item.sourceId || item.id || "") === id);
    const label = source ? sourceLabel(source) : "";
    if (!label) missing += 1;
    else if (!labels.includes(label)) labels.push(label);
  }
  return { labels, missing };
};

export const resolveGA4InsightsExecutiveFinancials = (input: {
  spendToDate?: FinancialTotal;
  spendBreakdown?: { totalSpend?: unknown; sources?: unknown };
  spendDisplaySources?: FinancialSource[];
  spendSourceDefinitions?: FinancialSource[];
  spendDetailsError?: boolean;
  spendBreakdownError?: boolean;
  spendToDateError?: boolean;
  revenueToDate?: FinancialTotal;
  revenueDisplaySources?: FinancialSource[];
  revenueDetailsError?: boolean;
  hasNativeRevenueMetric: boolean;
}) => {
  const breakdownSpend = finiteAmount(input.spendBreakdown?.totalSpend);
  const toDateSpend = finiteAmount(input.spendToDate?.spendToDate);
  const useToDateSpend = input.spendBreakdownError && !input.spendToDateError && toDateSpend !== null;
  const spend = useToDateSpend ? toDateSpend : breakdownSpend ?? toDateSpend ?? 0;
  const useBreakdownDetails = input.spendToDateError && !input.spendBreakdownError;
  const spendSources = useBreakdownDetails
    ? [...(input.spendDisplaySources || []), ...(input.spendSourceDefinitions || [])]
    : [...(input.spendSourceDefinitions || []), ...(input.spendDisplaySources || [])];
  const breakdownIds = sourceIds(
    Array.isArray(input.spendBreakdown?.sources)
      ? input.spendBreakdown.sources.map((source: FinancialSource) => source.sourceId)
      : [],
  );
  const spendIds = sourceIds(input.spendToDate?.sourceIds);
  const selectedSpendIds = useBreakdownDetails && breakdownIds.length > 0
    ? breakdownIds
    : spendIds.length > 0 ? spendIds : breakdownIds;
  const spendDetails = labelsForIds(selectedSpendIds, spendSources);
  const spendSourceLabels = selectedSpendIds.length > 0
    ? spendDetails.labels
    : spend === 0 ? Array.from(new Set(spendSources.map(sourceLabel).filter(Boolean))) : [];
  if (spendDetails.missing > 0) {
    spendSourceLabels.push(`Source details unavailable (${spendDetails.missing} ${spendDetails.missing === 1 ? "source" : "sources"})`);
  } else if (selectedSpendIds.length === 0 && (spend !== 0 || input.spendDetailsError) && spendSources.length === 0) {
    spendSourceLabels.push("Source details unavailable");
  }

  const revenueIds = sourceIds(input.revenueToDate?.sourceIds);
  const revenueSources = input.revenueDisplaySources || [];
  const revenueDetails = labelsForIds(revenueIds, revenueSources);
  const revenueSourceLabels = input.hasNativeRevenueMetric ? ["GA4 native revenue"] : [];
  const selectedRevenueLabels = revenueIds.length > 0
    ? revenueDetails.labels
    : finiteAmount(input.revenueToDate?.totalRevenue) === 0
      ? Array.from(new Set(revenueSources.map(sourceLabel).filter(Boolean)))
      : [];
  for (const label of selectedRevenueLabels) {
    if (!revenueSourceLabels.includes(label)) revenueSourceLabels.push(label);
  }
  if (revenueDetails.missing > 0) {
    revenueSourceLabels.push(`Imported source details unavailable (${revenueDetails.missing} ${revenueDetails.missing === 1 ? "source" : "sources"})`);
  } else if (revenueIds.length === 0 &&
    ((input.revenueToDate !== undefined && finiteAmount(input.revenueToDate.totalRevenue) !== 0) || input.revenueDetailsError) &&
    revenueSources.length === 0) {
    revenueSourceLabels.push("Imported source details unavailable");
  }

  return {
    spend,
    spendAvailable: (breakdownSpend !== null || toDateSpend !== null) &&
      (selectedSpendIds.length > 0 || spendSources.length > 0),
    spendSourceLabels,
    revenueSourceLabels,
  };
};
