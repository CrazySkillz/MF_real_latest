import { normalizeGA4CampaignAllocationKey } from "./ga4-financial-source";

// Display-only cent reconciliation within the already selected campaign rows.
// Keep the rounded sum of their exact amounts; never use an unrelated card total.
export function roundGA4CampaignRevenueForDisplay<T extends { name: string; revenue: number }>(rows: T[]): T[] {
  const cents = rows.map(row => Math.round(Number(row.revenue.toFixed(2)) * 100));
  const total = Math.round(Number(rows.reduce((sum, row) => sum + row.revenue, 0).toFixed(2)) * 100);
  const delta = total - cents.reduce((sum, value) => sum + value, 0);
  const direction = Math.sign(delta);
  const candidates = rows.map((row, index) => ({ index, name: row.name,
    error: direction * (row.revenue * 100 - cents[index]),
  })).filter(row => row.error > 0).sort((a, b) => b.error - a.error
    || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
  if (cents.every(Number.isSafeInteger) && Number.isSafeInteger(total)
    && Number.isSafeInteger(delta) && Math.abs(delta) <= candidates.length) {
    for (let i = 0; i < Math.abs(delta); i++) cents[candidates[i].index] += direction;
  }
  return rows.map((row, index) => ({ ...row, revenue: cents[index] === 0 ? 0 : cents[index] / 100 }));
}

const parseMappingConfig = (value: any) => {
  if (typeof value === "string") {
    try { return JSON.parse(value); } catch { return {}; }
  }
  return value || {};
};

export const resolveExactGA4CampaignBreakdownRevenue = (
  campaignRows: any[],
  revenueSources: any[],
  requiredCurrency?: string,
) => {
  const rowCounts = new Map<string, number>();
  const rowNameByKey = new Map<string, string>();
  for (const row of Array.isArray(campaignRows) ? campaignRows : []) {
    const name = String(row?.name ?? row?.campaign ?? "").trim();
    const key = normalizeGA4CampaignAllocationKey(name);
    if (!key) continue;
    rowCounts.set(key, (rowCounts.get(key) || 0) + 1);
    if (!rowNameByKey.has(key)) rowNameByKey.set(key, name);
  }

  let ambiguous = Array.from(rowCounts.values()).some((count) => count !== 1);
  let currencyMismatch = false;
  let materializationMismatch = false;
  let allImportedRevenueMapped = true;
  let mappedRevenue = 0;
  let unmatchedRevenue = 0;
  const mappedSourceIds = new Set<string>();
  const revenueByCampaign = new Map<string, number>();
  for (const source of Array.isArray(revenueSources) ? revenueSources : []) {
    const cfg = parseMappingConfig(source?.mappingConfig);
    const mappings = Array.isArray(cfg?.campaignMappings) ? cfg.campaignMappings : [];
    const totals = source?.boundedRevenueZero === true || source?.pendingCompletedDay === true
      ? []
      : Array.isArray(cfg?.campaignValueRevenueTotals) ? cfg.campaignValueRevenueTotals : [];
    const targetByValue = new Map<string, string>();
    const mappingCounts = new Map<string, number>();
    const selectedMappingCounts = new Map<string, number>();
    for (const mapping of mappings) {
      const valueKey = normalizeGA4CampaignAllocationKey(mapping?.crmValue);
      const targetKey = normalizeGA4CampaignAllocationKey(mapping?.linkedinCampaignName || mapping?.linkedinCampaignUrn);
      if (!valueKey || !targetKey) continue;
      mappingCounts.set(valueKey, (mappingCounts.get(valueKey) || 0) + 1);
      if (rowCounts.get(targetKey) === 1) {
        selectedMappingCounts.set(valueKey, (selectedMappingCounts.get(valueKey) || 0) + 1);
      }
      targetByValue.set(valueKey, targetKey);
    }
    const seenValues = new Set<string>();
    let configuredRevenue = 0;
    let sourceHasSelectedMapping = false;
    for (const item of totals) {
      const valueKey = normalizeGA4CampaignAllocationKey(item?.campaignValue);
      if (!valueKey) continue;
      const duplicateTotal = seenValues.has(valueKey);
      seenValues.add(valueKey);
      const targetKey = targetByValue.get(valueKey);
      const selectedMappingCount = selectedMappingCounts.get(valueKey) || 0;
      const mappingAmbiguous = (mappingCounts.get(valueKey) || 0) > 1 && selectedMappingCount > 0;
      const revenue = Number(item?.revenue);
      if (!Number.isFinite(revenue)) {
        if (selectedMappingCount > 0) ambiguous = true;
        allImportedRevenueMapped = false;
        continue;
      }
      configuredRevenue += revenue;
      if (revenue !== 0 && selectedMappingCount > 0) {
        sourceHasSelectedMapping = true;
        mappedSourceIds.add(String(source?.sourceId || source?.id || ""));
      }
      if (mappingAmbiguous || (duplicateTotal && selectedMappingCount > 0)) {
        ambiguous = true;
        unmatchedRevenue += revenue;
        allImportedRevenueMapped = false;
        continue;
      }
      if (!targetKey || rowCounts.get(targetKey) !== 1) {
        unmatchedRevenue += revenue;
        if (revenue !== 0) allImportedRevenueMapped = false;
        continue;
      }
      mappedRevenue += revenue;
      if (revenue === 0) continue;
      const rowName = rowNameByKey.get(targetKey)!;
      revenueByCampaign.set(rowName, (revenueByCampaign.get(rowName) || 0) + revenue);
    }
    const materializedRevenue = Number(source?.revenue);
    const materializationMatches = source?.revenue != null && Number.isFinite(materializedRevenue) &&
      Math.abs(materializedRevenue - configuredRevenue) < 0.01;
    if (!materializationMatches) allImportedRevenueMapped = false;
    if (sourceHasSelectedMapping && !materializationMatches) materializationMismatch = true;
    if (!sourceHasSelectedMapping && source?.revenue != null && Number.isFinite(materializedRevenue) && !materializationMatches) {
      unmatchedRevenue += materializedRevenue - configuredRevenue;
    }
    if (sourceHasSelectedMapping && requiredCurrency) {
      const sourceCurrencyMismatch = String(source?.currency || "").trim().toUpperCase() !== requiredCurrency.trim().toUpperCase();
      currencyMismatch = currencyMismatch || sourceCurrencyMismatch;
      if (sourceCurrencyMismatch) allImportedRevenueMapped = false;
    }
  }

  return {
    ambiguous,
    currencyMismatch,
    materializationMismatch,
    allImportedRevenueMapped: allImportedRevenueMapped && !ambiguous,
    mappedRevenue,
    unmatchedRevenue,
    mappedSourceIds,
    revenueByCampaign,
  };
};
