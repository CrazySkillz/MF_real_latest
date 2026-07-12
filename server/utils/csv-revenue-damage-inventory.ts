import { aggregateCsvRevenueRows } from "./csv";

const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const sourceId = (value: any) => String(value?.id || "");
const isGa4CsvSource = (source: any) =>
  String(source?.sourceType || "").trim().toLowerCase() === "csv"
  && ["", "ga4"].includes(String(source?.platformContext || "").trim().toLowerCase());

const parseMapping = (value: any): Record<string, any> | null => {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    return null;
  }
};

const materializedTotal = (records: any[]) => {
  let aggregate = 0;
  let attributed = 0;
  for (const record of records) {
    const amount = Number(record?.revenue);
    if (!Number.isFinite(amount)) continue;
    if (String(record?.subCampaignUrn || "").trim()) attributed += amount;
    else aggregate += amount;
  }
  return round2(aggregate > 0 ? aggregate : attributed);
};

const summarizeSource = (source: any, records: any[], extra: Record<string, any> = {}) => ({
  sourceId: sourceId(source),
  displayName: source?.displayName || null,
  isActive: source?.isActive !== false,
  recordCount: records.length,
  recordIds: records.map((record) => String(record?.id || "")).filter(Boolean),
  materializedTotal: materializedTotal(records),
  ...extra,
});

export function inspectGa4CsvRevenueDamage(allSources: any[], allRecords: any[], referencedSources: any[] = allSources) {
  const csvSources = allSources.filter(isGa4CsvSource);
  const sourceById = new Map(allSources.map((source) => [sourceId(source), source]));
  const referencedSourceById = new Map(referencedSources.map((source) => [sourceId(source), source]));
  const recordsBySource = new Map<string, any[]>();
  for (const record of allRecords) {
    const id = String(record?.revenueSourceId || "");
    if (!recordsBySource.has(id)) recordsBySource.set(id, []);
    recordsBySource.get(id)!.push(record);
  }

  const activeSourcesWithZeroRecords: any[] = [];
  const incompleteStoredMappingSources: any[] = [];
  const storedTotalMismatchSources: any[] = [];
  const datedRevenueLossSources: any[] = [];
  const duplicateRecordGroups: any[] = [];

  for (const source of csvSources) {
    const records = recordsBySource.get(sourceId(source)) || [];
    if (source?.isActive !== false && records.length === 0) {
      activeSourcesWithZeroRecords.push(summarizeSource(source, records));
    }

    const duplicateGrains = new Map<string, any[]>();
    for (const record of records) {
      const key = `${String(record?.date || "")}|${String(record?.subCampaignUrn || "")}`;
      if (!duplicateGrains.has(key)) duplicateGrains.set(key, []);
      duplicateGrains.get(key)!.push(record);
    }
    for (const [grain, grouped] of Array.from(duplicateGrains.entries())) {
      if (grouped.length < 2) continue;
      duplicateRecordGroups.push({
        sourceId: sourceId(source),
        grain,
        recordCount: grouped.length,
        recordIds: grouped.map((record: any) => String(record?.id || "")).filter(Boolean),
      });
    }

    if (source?.isActive === false) continue;
    const mapping = parseMapping(source?.mappingConfig);
    const rows = Array.isArray(mapping?.csvStoredRevenueRows) ? mapping!.csvStoredRevenueRows : null;
    const headers = Array.isArray(mapping?.csvHeaders) ? mapping!.csvHeaders : null;
    const revenueColumn = String(mapping?.storedRevenueColumn || mapping?.revenueColumn || "").trim();
    const campaignColumn = String(mapping?.storedCampaignColumn || mapping?.campaignColumn || "").trim();
    const dateColumn = String(mapping?.storedDateColumn || mapping?.dateColumn || "").trim();
    const rowCount = Number(mapping?.csvRowCount);
    const issueCodes = [
      ...(!mapping ? ["unparseable_mapping"] : []),
      ...(!rows?.length ? ["missing_stored_rows"] : []),
      ...(!headers?.length ? ["missing_headers"] : []),
      ...(!revenueColumn ? ["missing_revenue_role"] : []),
      ...(!Number.isFinite(rowCount) || rowCount !== rows?.length ? ["stored_row_count_mismatch"] : []),
      ...(revenueColumn && campaignColumn === revenueColumn ? ["revenue_campaign_role_collision"] : []),
      ...(dateColumn && (dateColumn === revenueColumn || dateColumn === campaignColumn) ? ["date_role_collision"] : []),
    ];
    if (issueCodes.length > 0) {
      incompleteStoredMappingSources.push(summarizeSource(source, records, { issueCodes }));
    }
    if (!rows?.length || !revenueColumn) continue;

    const normalizedRows = rows.map((row: any) => ({
      revenue: String(row?.revenueRaw ?? row?.revenue ?? ""),
      campaign: String(row?.campaignKey ?? ""),
      date: String(row?.dateRaw ?? ""),
    }));
    const aggregation = aggregateCsvRevenueRows(normalizedRows, {
      revenueColumn: "revenue",
      campaignColumn: campaignColumn ? "campaign" : null,
      campaignValue: mapping?.campaignValue || null,
      campaignValues: Array.isArray(mapping?.campaignValues) ? mapping.campaignValues : null,
      dateColumn: dateColumn ? "date" : null,
    });
    const actualTotal = materializedTotal(records);
    if (aggregation.totalRevenue > 0 && Math.abs(aggregation.totalRevenue - actualTotal) >= 0.01) {
      storedTotalMismatchSources.push(summarizeSource(source, records, {
        expectedStoredTotal: aggregation.totalRevenue,
      }));
    }
    if (dateColumn && aggregation.undatedRevenue > 0) {
      datedRevenueLossSources.push(summarizeSource(source, records, {
        expectedStoredTotal: aggregation.totalRevenue,
        undatedRevenue: aggregation.undatedRevenue,
      }));
    }
  }

  const orphanCsvRecordGroups = Array.from(recordsBySource.entries())
    .filter(([id, records]) => !referencedSourceById.has(id) && records.some((record) => String(record?.sourceType || "").toLowerCase() === "csv"))
    .map(([id, records]) => ({
      sourceId: id,
      recordCount: records.length,
      recordIds: records.map((record) => String(record?.id || "")).filter(Boolean),
    }));
  const crossCampaignCsvRecordGroups = Array.from(recordsBySource.entries())
    .filter(([id, records]) => {
      const source = referencedSourceById.get(id);
      return isGa4CsvSource(source) && records.some((record) => String(record?.campaignId || "") !== String(source?.campaignId || ""));
    })
    .map(([id, records]) => {
      const source = referencedSourceById.get(id);
      const mismatched = records.filter((record) => String(record?.campaignId || "") !== String(source?.campaignId || ""));
      return {
        sourceId: id,
        recordCount: mismatched.length,
        recordIds: mismatched.map((record) => String(record?.id || "")).filter(Boolean),
      };
    });
  const wrongSourceTypeRecordGroups = Array.from(recordsBySource.entries())
    .filter(([id, records]) => {
      const source = referencedSourceById.get(id);
      return Boolean(source)
        && String(source?.sourceType || "").toLowerCase() !== "csv"
        && records.some((record) => String(record?.sourceType || "").toLowerCase() === "csv");
    })
    .map(([id, records]) => {
      const mismatched = records.filter((record) => String(record?.sourceType || "").toLowerCase() === "csv");
      return {
        sourceId: id,
        recordCount: mismatched.length,
        recordIds: mismatched.map((record) => String(record?.id || "")).filter(Boolean),
      };
    });
  const inactiveCsvSourceRecordGroups = csvSources
    .filter((source) => source?.isActive === false && (recordsBySource.get(sourceId(source)) || []).length > 0)
    .map((source) => summarizeSource(source, recordsBySource.get(sourceId(source)) || []));

  const findings = {
    activeSourcesWithZeroRecords,
    inactiveCsvSourceRecordGroups,
    orphanCsvRecordGroups,
    crossCampaignCsvRecordGroups,
    wrongSourceTypeRecordGroups,
    incompleteStoredMappingSources,
    storedTotalMismatchSources,
    datedRevenueLossSources,
    duplicateRecordGroups,
  };
  const findingCount = Object.values(findings).reduce((sum, rows) => sum + rows.length, 0);
  return {
    pass: findingCount === 0,
    summary: {
      csvSourceCount: csvSources.length,
      activeCsvSourceCount: csvSources.filter((source) => source?.isActive !== false).length,
      csvRecordCount: csvSources.reduce((sum, source) => sum + (recordsBySource.get(sourceId(source)) || []).length, 0),
      findingCount,
    },
    findings,
  };
}
