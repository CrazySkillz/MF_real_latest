const normalize = (value: unknown) => String(value ?? "").trim();
const normalizeLower = (value: unknown) => normalize(value).toLowerCase();
const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const sourceId = (value: any) => normalize(value?.id);

const isGa4GoogleSheetsSource = (source: any) =>
  normalizeLower(source?.sourceType) === "google_sheets"
  && ["", "ga4"].includes(normalizeLower(source?.platformContext));

const parseMapping = (value: unknown): Record<string, any> | null => {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, any>;
  try {
    const parsed = JSON.parse(String(value || ""));
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const isCalendarDate = (value: unknown) => {
  const raw = normalize(value);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.toISOString().slice(0, 10) === raw;
};

const materializedTotal = (records: any[]) => {
  let aggregate = 0;
  let attributed = 0;
  let hasAggregate = false;
  for (const record of records) {
    const amount = Number(record?.revenue);
    if (!Number.isFinite(amount)) continue;
    if (normalize(record?.subCampaignUrn)) attributed += amount;
    else {
      aggregate += amount;
      hasAggregate = true;
    }
  }
  return round2(hasAggregate ? aggregate : attributed);
};

const summarizeRecords = (id: string, records: any[]) => ({
  sourceId: id,
  recordCount: records.length,
  recordIds: records.map((record) => normalize(record?.id)).filter(Boolean),
});

const summarizeSource = (source: any, records: any[], extra: Record<string, any> = {}) => ({
  sourceId: sourceId(source),
  campaignId: normalize(source?.campaignId) || null,
  displayName: source?.displayName || null,
  isActive: source?.isActive !== false,
  recordCount: records.length,
  materializedTotal: materializedTotal(records),
  ...extra,
});

const groupRecords = (records: any[]) => {
  const grouped = new Map<string, any[]>();
  for (const record of records) {
    const id = normalize(record?.revenueSourceId);
    grouped.set(id, [...(grouped.get(id) || []), record]);
  }
  return grouped;
};

export function inspectGa4GoogleSheetsRevenueDamage(input: {
  campaigns: any[];
  connections: any[];
  sources: any[];
  records: any[];
}) {
  const campaigns = Array.isArray(input?.campaigns) ? input.campaigns : [];
  const connections = Array.isArray(input?.connections) ? input.connections : [];
  const allSources = Array.isArray(input?.sources) ? input.sources : [];
  const allRecords = Array.isArray(input?.records) ? input.records : [];
  const googleSheetsSources = allSources.filter(isGa4GoogleSheetsSource);
  const googleSheetsSourceIds = new Set(googleSheetsSources.map(sourceId).filter(Boolean));
  const sourceById = new Map(allSources.map((source) => [sourceId(source), source]));
  const connectionById = new Map(connections.map((connection) => [normalize(connection?.id), connection]));
  const campaignById = new Map(campaigns.map((campaign) => [normalize(campaign?.id), campaign]));
  const recordsBySource = groupRecords(allRecords.filter((record) =>
    googleSheetsSourceIds.has(normalize(record?.revenueSourceId)),
  ));

  const activeSourcesWithZeroRecords: any[] = [];
  const inactiveSourceRecordGroups: any[] = [];
  const unparseableMappingSources: any[] = [];
  const incompleteMappingSources: any[] = [];
  const missingConnectionSources: any[] = [];
  const crossCampaignConnectionSources: any[] = [];
  const inactiveConnectionSources: any[] = [];
  const connectionMetadataSources: any[] = [];
  const connectionIdentityMismatchSources: any[] = [];
  const missingCampaignSources: any[] = [];
  const sourceCurrencyMismatchGroups: any[] = [];
  const campaignValueTotalMismatchSources: any[] = [];
  const lastSyncedAtMismatchSources: any[] = [];
  const invalidRecordDateGroups: any[] = [];
  const invalidRecordRevenueGroups: any[] = [];
  const duplicateRecordGroups: any[] = [];
  const sourceObservations: any[] = [];
  const duplicateSignatures = new Map<string, any[]>();

  for (const source of googleSheetsSources) {
    const id = sourceId(source);
    const records = recordsBySource.get(id) || [];
    const mapping = parseMapping(source?.mappingConfig);
    const campaignId = normalize(source?.campaignId);
    const campaign = campaignById.get(campaignId);
    const campaignCurrency = normalize(campaign?.currency).toUpperCase();
    const sourceCurrency = normalize(source?.currency).toUpperCase();
    const mappingCurrency = normalize(mapping?.currency).toUpperCase();
    const connectionId = normalize(mapping?.connectionId);
    const connection = connectionId ? connectionById.get(connectionId) : null;

    if (source?.isActive !== false && records.length === 0) activeSourcesWithZeroRecords.push(summarizeSource(source, records));
    if (source?.isActive === false) {
      if (records.length > 0) inactiveSourceRecordGroups.push(summarizeSource(source, records));
      sourceObservations.push(summarizeSource(source, records, {
        connectionId: connectionId || null,
        connectionPurpose: connection?.purpose || null,
        lastSyncedAt: normalize(mapping?.lastSyncedAt) || null,
        connectionLastDataRefreshAt: connection?.lastDataRefreshAt || null,
      }));
      continue;
    }
    if (!mapping) unparseableMappingSources.push(summarizeSource(source, records));
    if (!campaign) missingCampaignSources.push(summarizeSource(source, records));

    const revenueColumn = normalize(mapping?.revenueColumn);
    const campaignColumn = normalize(mapping?.campaignColumn);
    const dateColumn = normalize(mapping?.dateColumn);
    const campaignValues = Array.isArray(mapping?.campaignValues)
      ? mapping.campaignValues.map(normalize).filter(Boolean)
      : normalize(mapping?.campaignValue) ? [normalize(mapping?.campaignValue)] : [];
    const lastSyncedAt = normalize(mapping?.lastSyncedAt);
    const lastSyncedTime = Date.parse(lastSyncedAt);
    const mappingIssueCodes = [
      ...(!connectionId ? ["missing_connection_id"] : []),
      ...(!normalize(mapping?.spreadsheetId) ? ["missing_spreadsheet_id"] : []),
      ...(!normalize(mapping?.sheetName) ? ["missing_sheet_name"] : []),
      ...(!revenueColumn ? ["missing_revenue_column"] : []),
      ...(campaignColumn && campaignValues.length === 0 ? ["missing_campaign_values"] : []),
      ...(campaignColumn && campaignColumn === revenueColumn ? ["revenue_campaign_role_collision"] : []),
      ...(dateColumn && (dateColumn === revenueColumn || dateColumn === campaignColumn) ? ["date_role_collision"] : []),
      ...(!lastSyncedAt || !Number.isFinite(lastSyncedTime) ? ["missing_or_invalid_last_synced_at"] : []),
    ];
    if (mappingIssueCodes.length > 0) {
      incompleteMappingSources.push(summarizeSource(source, records, { issueCodes: mappingIssueCodes }));
    }

    if (connectionId && !connection) missingConnectionSources.push(summarizeSource(source, records, { connectionId }));
    if (connection && normalize(connection?.campaignId) !== campaignId) {
      crossCampaignConnectionSources.push(summarizeSource(source, records, {
        connectionId,
        connectionCampaignId: normalize(connection?.campaignId) || null,
      }));
    }
    if (connection && connection?.isActive === false) inactiveConnectionSources.push(summarizeSource(source, records, { connectionId }));
    if (connection) {
      const hasDurableRefreshMaterial = Boolean(connection?.hasEncryptedTokens)
        || Boolean(connection?.hasRefreshToken && connection?.hasClientId && connection?.hasClientSecret);
      const connectionIssueCodes = [
        ...(!normalize(connection?.spreadsheetId) || normalizeLower(connection?.spreadsheetId) === "pending" ? ["missing_spreadsheet_id"] : []),
        ...(!normalize(connection?.sheetName) ? ["missing_sheet_name"] : []),
        ...(!(connection?.hasAccessToken || hasDurableRefreshMaterial) ? ["missing_credential_material"] : []),
        ...(!hasDurableRefreshMaterial ? ["missing_refresh_credential_material"] : []),
      ];
      if (connectionIssueCodes.length > 0) {
        connectionMetadataSources.push(summarizeSource(source, records, { connectionId, issueCodes: connectionIssueCodes }));
      }
      const identityIssueCodes = [
        ...(normalize(mapping?.spreadsheetId) && normalize(mapping?.spreadsheetId) !== normalize(connection?.spreadsheetId) ? ["spreadsheet_id_mismatch"] : []),
        ...(normalize(mapping?.sheetName) && normalize(mapping?.sheetName) !== normalize(connection?.sheetName) ? ["sheet_name_mismatch"] : []),
      ];
      if (identityIssueCodes.length > 0) {
        connectionIdentityMismatchSources.push(summarizeSource(source, records, { connectionId, issueCodes: identityIssueCodes }));
      }
    }

    const mismatchedRecordIds = records
      .filter((record) => normalize(record?.currency).toUpperCase() !== campaignCurrency)
      .map((record) => normalize(record?.id)).filter(Boolean);
    if (campaign && (sourceCurrency !== campaignCurrency || (mappingCurrency && mappingCurrency !== campaignCurrency) || mismatchedRecordIds.length > 0)) {
      sourceCurrencyMismatchGroups.push(summarizeSource(source, records, {
        sourceCurrency: sourceCurrency || null,
        mappingCurrency: mappingCurrency || null,
        campaignCurrency,
        mismatchedRecordIds,
      }));
    }

    const campaignTotals = Array.isArray(mapping?.campaignValueRevenueTotals) ? mapping.campaignValueRevenueTotals : [];
    const totalValues = campaignTotals.map((item: any) => ({
      campaignValue: normalize(item?.campaignValue),
      revenue: Number(item?.revenue),
    }));
    const totalKeys = totalValues.map((item) => item.campaignValue).filter(Boolean);
    const selectedSet = new Set(campaignValues);
    const campaignTotalsInvalid = totalValues.some((item) =>
      !item.campaignValue || !Number.isFinite(item.revenue) || item.revenue < 0 || (selectedSet.size > 0 && !selectedSet.has(item.campaignValue)),
    ) || new Set(totalKeys).size !== totalKeys.length;
    const expectedCampaignTotal = round2(totalValues.reduce((sum, item) => sum + (Number.isFinite(item.revenue) ? item.revenue : 0), 0));
    const actualTotal = materializedTotal(records);
    if (
      (campaignColumn && (campaignTotals.length === 0 || mapping?.allocationMethod !== "ga4_campaign_exact_match_v1" || campaignTotalsInvalid || Math.abs(expectedCampaignTotal - actualTotal) >= 0.01))
      || (!campaignColumn && (campaignTotals.length > 0 || Boolean(mapping?.allocationMethod)))
    ) {
      campaignValueTotalMismatchSources.push(summarizeSource(source, records, {
        expectedCampaignTotal,
        allocationMethod: mapping?.allocationMethod || null,
      }));
    }

    const recordTimes = records.map((record) => Date.parse(normalize(record?.createdAt))).filter(Number.isFinite);
    const latestRecordTime = recordTimes.length > 0 ? Math.max(...recordTimes) : null;
    if (Number.isFinite(lastSyncedTime) && latestRecordTime !== null && Math.abs(lastSyncedTime - latestRecordTime) > 10 * 60 * 1000) {
      lastSyncedAtMismatchSources.push(summarizeSource(source, records, {
        lastSyncedAt,
        latestRecordCreatedAt: new Date(latestRecordTime).toISOString(),
      }));
    }

    const invalidDates = records.filter((record) => !isCalendarDate(record?.date));
    if (invalidDates.length > 0) invalidRecordDateGroups.push(summarizeRecords(id, invalidDates));
    const invalidRevenue = records.filter((record) => !Number.isFinite(Number(record?.revenue)) || Number(record?.revenue) <= 0);
    if (invalidRevenue.length > 0) invalidRecordRevenueGroups.push(summarizeRecords(id, invalidRevenue));
    const recordsByGrain = new Map<string, any[]>();
    for (const record of records) {
      const grain = `${normalize(record?.date)}|${normalize(record?.subCampaignUrn)}`;
      recordsByGrain.set(grain, [...(recordsByGrain.get(grain) || []), record]);
    }
    for (const [grain, grouped] of Array.from(recordsByGrain.entries())) {
      if (grouped.length > 1) duplicateRecordGroups.push({ ...summarizeRecords(id, grouped), grain });
    }

    if (source?.isActive !== false && mapping) {
      const signature = [campaignId, connectionId, revenueColumn, campaignColumn, campaignValues.slice().sort().join("\u001f"), dateColumn, sourceCurrency].join("|");
      duplicateSignatures.set(signature, [...(duplicateSignatures.get(signature) || []), source]);
    }
    sourceObservations.push(summarizeSource(source, records, {
      connectionId: connectionId || null,
      connectionPurpose: connection?.purpose || null,
      lastSyncedAt: lastSyncedAt || null,
      connectionLastDataRefreshAt: connection?.lastDataRefreshAt || null,
    }));
  }

  const orphanGoogleSheetsRecordGroups = Array.from(groupRecords(allRecords.filter((record) =>
    normalizeLower(record?.sourceType) === "google_sheets" && !sourceById.has(normalize(record?.revenueSourceId)),
  )).entries()).map(([id, records]) => summarizeRecords(id, records));
  const crossCampaignRecordGroups = Array.from(recordsBySource.entries())
    .map(([id, records]) => ({ id, source: sourceById.get(id), records: records.filter((record) => normalize(record?.campaignId) !== normalize(sourceById.get(id)?.campaignId)) }))
    .filter((group) => group.records.length > 0)
    .map((group) => summarizeRecords(group.id, group.records));
  const wrongSourceTypeRecordGroups = Array.from(groupRecords(allRecords.filter((record) => {
    const source = sourceById.get(normalize(record?.revenueSourceId));
    return (googleSheetsSourceIds.has(normalize(record?.revenueSourceId)) && normalizeLower(record?.sourceType) !== "google_sheets")
      || (normalizeLower(record?.sourceType) === "google_sheets" && Boolean(source) && normalizeLower(source?.sourceType) !== "google_sheets");
  })).entries()).map(([id, records]) => summarizeRecords(id, records));
  const duplicateActiveSourceGroups = Array.from(duplicateSignatures.entries())
    .filter(([, sources]) => sources.length > 1)
    .map(([, sources]) => ({ sourceIds: sources.map(sourceId), sourceCount: sources.length }));

  const findings = {
    activeSourcesWithZeroRecords,
    inactiveSourceRecordGroups,
    orphanGoogleSheetsRecordGroups,
    crossCampaignRecordGroups,
    wrongSourceTypeRecordGroups,
    duplicateActiveSourceGroups,
    unparseableMappingSources,
    incompleteMappingSources,
    missingConnectionSources,
    crossCampaignConnectionSources,
    inactiveConnectionSources,
    connectionMetadataSources,
    connectionIdentityMismatchSources,
    missingCampaignSources,
    sourceCurrencyMismatchGroups,
    campaignValueTotalMismatchSources,
    lastSyncedAtMismatchSources,
    invalidRecordDateGroups,
    invalidRecordRevenueGroups,
    duplicateRecordGroups,
  };
  const findingCount = Object.values(findings).reduce((sum, rows) => sum + rows.length, 0);
  return {
    pass: findingCount === 0,
    scopeComplete: false,
    summary: {
      ga4GoogleSheetsSourceCount: googleSheetsSources.length,
      activeGa4GoogleSheetsSourceCount: googleSheetsSources.filter((source) => source?.isActive !== false).length,
      referencedConnectionCount: new Set(googleSheetsSources.map((source) => normalize(parseMapping(source?.mappingConfig)?.connectionId)).filter(Boolean)).size,
      googleSheetsRecordCount: Array.from(recordsBySource.values()).reduce((sum, rows) => sum + rows.length, 0),
      findingCount,
    },
    findings,
    observations: { sources: sourceObservations },
    notLocallyVerifiable: [
      "provider spreadsheet and tab still exist and remain accessible",
      "provider allocated row count remains within the 50,000-row supported boundary",
      "the latest provider read was complete and matched the persisted materialization",
      "stored OAuth material can currently decrypt, refresh, and authorize provider reads",
    ],
  };
}
