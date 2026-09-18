export const datedFinancialSourceIds = (response: any, kind: "spend" | "revenue", currency: string): string[] | null => {
  if (response?.success !== true || !Array.isArray(response?.sources) || !currency) return null;
  const ids: string[] = [];
  for (const source of response.sources) {
    const id = String(source?.id || "").trim();
    const type = String(source?.sourceType || "").trim().toLowerCase();
    let mapping: any;
    try { mapping = typeof source?.mappingConfig === "string" ? JSON.parse(source.mappingConfig) : source?.mappingConfig; } catch { return null; }
    const mappedDate = String(mapping?.storedDateColumn || mapping?.dateColumn || "").trim();
    const dated = type === "csv" || type === "google_sheets" ? !!mappedDate
      : kind === "revenue" && (type === "hubspot" || type === "salesforce") ? !!String(mapping?.dateField || "").trim()
      : kind === "revenue" && type === "shopify" ? mapping?.materializationGranularity === "order" && !!mapping?.orderDateBasis
      : false;
    if (!id || source?.isActive === false || String(source?.currency || "").toUpperCase() !== currency || !dated
      || (kind === "revenue" && source?.materializedRevenueStatus !== "available")) return null;
    ids.push(id);
  }
  return new Set(ids).size === ids.length ? ids.sort() : null;
};

export const datedFinancialSourceSetsCompatible = (activeIds: string[] | null, currentIds: unknown, priorIds: unknown): boolean => {
  if (activeIds === null || !Array.isArray(currentIds) || !Array.isArray(priorIds)) return false;
  const normalize = (ids: unknown[]): string[] | null => {
    const values = ids.map((id) => String(id || "").trim()).sort();
    return values.every(Boolean) && new Set(values).size === values.length ? values : null;
  };
  const current = normalize(currentIds);
  const prior = normalize(priorIds);
  return current !== null && prior !== null
    && JSON.stringify(current) === JSON.stringify(activeIds)
    && prior.every((id) => activeIds.includes(id));
};
