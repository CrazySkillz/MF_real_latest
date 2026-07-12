const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const sourceId = (value: any) => String(value?.id || '');
const isGa4HubspotSource = (source: any) =>
  String(source?.sourceType || '').trim().toLowerCase() === 'hubspot'
  && ['', 'ga4'].includes(String(source?.platformContext || '').trim().toLowerCase());

const parseMapping = (value: any): Record<string, any> | null => {
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const isStrictDateKey = (value: any) => {
  const raw = String(value || '');
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const recordTotal = (records: any[]) => {
  let aggregate = 0;
  let attributed = 0;
  for (const record of records) {
    const revenue = Number(record?.revenue);
    if (!Number.isFinite(revenue)) continue;
    if (String(record?.subCampaignUrn || '').trim()) attributed += revenue;
    else aggregate += revenue;
  }
  return round2(aggregate > 0 ? aggregate : attributed);
};

const summarize = (source: any, records: any[], extra: Record<string, any> = {}) => ({
  sourceId: sourceId(source),
  displayName: source?.displayName || null,
  recordCount: records.length,
  recordIds: records.map((record) => String(record?.id || '')).filter(Boolean),
  materializedTotal: recordTotal(records),
  ...extra,
});

export function inspectGa4HubspotRevenueDamage(allSources: any[], allRecords: any[], referencedSources: any[] = allSources) {
  const sources = allSources.filter(isGa4HubspotSource);
  const referencedById = new Map(referencedSources.map((source) => [sourceId(source), source]));
  const recordsBySource = new Map<string, any[]>();
  for (const record of allRecords) {
    const id = String(record?.revenueSourceId || '');
    if (!recordsBySource.has(id)) recordsBySource.set(id, []);
    recordsBySource.get(id)!.push(record);
  }

  const sourceRecordTotalMismatches: any[] = [];
  const campaignValueTotalMismatches: any[] = [];
  const invalidDateRecordGroups: any[] = [];
  const duplicateRecordGroups: any[] = [];
  const recordSourceTypeMismatchGroups: any[] = [];
  const recordCurrencyMismatchGroups: any[] = [];
  const partialReplacementCandidates: any[] = [];

  for (const source of sources.filter((item) => item?.isActive !== false)) {
    const records = recordsBySource.get(sourceId(source)) || [];
    const mapping = parseMapping(source?.mappingConfig);
    const materializedTotal = recordTotal(records);
    const configuredTotal = Number(mapping?.lastTotalRevenue);
    const hasConfiguredTotal = Number.isFinite(configuredTotal);
    const campaignTotals = Array.isArray(mapping?.campaignValueRevenueTotals) ? mapping!.campaignValueRevenueTotals : null;
    const campaignValueTotal = campaignTotals
      ? round2(campaignTotals.reduce((sum: number, item: any) => sum + (Number.isFinite(Number(item?.revenue)) ? Number(item.revenue) : 0), 0))
      : null;
    const issueCodes: string[] = [];

    if (!hasConfiguredTotal || Math.abs(round2(configuredTotal) - materializedTotal) >= 0.01) {
      sourceRecordTotalMismatches.push(summarize(source, records, {
        configuredTotal: hasConfiguredTotal ? round2(configuredTotal) : null,
        issueCode: hasConfiguredTotal ? 'configured_record_total_mismatch' : 'missing_configured_total',
      }));
      issueCodes.push(hasConfiguredTotal ? 'configured_record_total_mismatch' : 'missing_configured_total');
    }
    if (campaignValueTotal === null || !hasConfiguredTotal || Math.abs(campaignValueTotal - round2(configuredTotal)) >= 0.01) {
      campaignValueTotalMismatches.push(summarize(source, records, {
        configuredTotal: hasConfiguredTotal ? round2(configuredTotal) : null,
        campaignValueTotal,
        issueCode: campaignValueTotal === null ? 'missing_campaign_value_totals' : 'campaign_value_total_mismatch',
      }));
      issueCodes.push(campaignValueTotal === null ? 'missing_campaign_value_totals' : 'campaign_value_total_mismatch');
    }

    const invalidDates = records.filter((record) => !isStrictDateKey(record?.date));
    if (invalidDates.length > 0) {
      invalidDateRecordGroups.push({
        sourceId: sourceId(source),
        recordCount: invalidDates.length,
        recordIds: invalidDates.map((record) => String(record?.id || '')).filter(Boolean),
        dates: Array.from(new Set(invalidDates.map((record) => String(record?.date || '')))),
      });
      issueCodes.push('invalid_record_dates');
    }

    const grains = new Map<string, any[]>();
    for (const record of records) {
      const grain = `${String(record?.date || '')}|${String(record?.subCampaignUrn || '')}`;
      if (!grains.has(grain)) grains.set(grain, []);
      grains.get(grain)!.push(record);
    }
    for (const [grain, grouped] of Array.from(grains.entries())) {
      if (grouped.length < 2) continue;
      duplicateRecordGroups.push({
        sourceId: sourceId(source),
        grain,
        recordCount: grouped.length,
        amountTotal: round2(grouped.reduce((sum, record) => sum + Number(record?.revenue || 0), 0)),
        recordIds: grouped.map((record) => String(record?.id || '')).filter(Boolean),
      });
      if (!issueCodes.includes('duplicate_record_grains')) issueCodes.push('duplicate_record_grains');
    }

    const typeMismatches = records.filter((record) => String(record?.sourceType || '').trim().toLowerCase() !== 'hubspot');
    if (typeMismatches.length > 0) {
      recordSourceTypeMismatchGroups.push({
        sourceId: sourceId(source),
        recordCount: typeMismatches.length,
        recordIds: typeMismatches.map((record) => String(record?.id || '')).filter(Boolean),
        sourceTypes: Array.from(new Set(typeMismatches.map((record) => String(record?.sourceType || '')))),
      });
      issueCodes.push('record_source_type_mismatch');
    }
    const sourceCurrency = String(source?.currency || '').trim().toUpperCase();
    const currencyMismatches = records.filter((record) => String(record?.currency || '').trim().toUpperCase() !== sourceCurrency);
    if (currencyMismatches.length > 0) {
      recordCurrencyMismatchGroups.push({
        sourceId: sourceId(source),
        sourceCurrency: sourceCurrency || null,
        recordCount: currencyMismatches.length,
        recordIds: currencyMismatches.map((record) => String(record?.id || '')).filter(Boolean),
        recordCurrencies: Array.from(new Set(currencyMismatches.map((record) => String(record?.currency || '')))),
      });
      issueCodes.push('record_currency_mismatch');
    }
    if (issueCodes.length > 0) partialReplacementCandidates.push(summarize(source, records, { issueCodes }));
  }

  const crossCampaignRecordGroups = Array.from(recordsBySource.entries())
    .filter(([id, records]) => {
      const source = referencedById.get(id);
      return isGa4HubspotSource(source) && records.some((record) => String(record?.campaignId || '') !== String(source?.campaignId || ''));
    })
    .map(([id, records]) => {
      const source = referencedById.get(id);
      const mismatched = records.filter((record) => String(record?.campaignId || '') !== String(source?.campaignId || ''));
      return { sourceId: id, recordCount: mismatched.length, recordIds: mismatched.map((record) => String(record?.id || '')).filter(Boolean) };
    });
  const hubspotTypedRecordsOnNonHubspotSources = Array.from(recordsBySource.entries())
    .filter(([id, records]) => {
      const source = referencedById.get(id);
      return Boolean(source)
        && String(source?.sourceType || '').trim().toLowerCase() !== 'hubspot'
        && records.some((record) => String(record?.sourceType || '').toLowerCase() === 'hubspot');
    })
    .map(([id, records]) => {
      const mismatched = records.filter((record) => String(record?.sourceType || '').toLowerCase() === 'hubspot');
      return { sourceId: id, recordCount: mismatched.length, recordIds: mismatched.map((record) => String(record?.id || '')).filter(Boolean) };
    });

  const findings = {
    sourceRecordTotalMismatches,
    campaignValueTotalMismatches,
    invalidDateRecordGroups,
    duplicateRecordGroups,
    crossCampaignRecordGroups,
    recordSourceTypeMismatchGroups,
    hubspotTypedRecordsOnNonHubspotSources,
    recordCurrencyMismatchGroups,
    partialReplacementCandidates,
  };
  const findingCount = Object.values(findings).reduce((sum, rows) => sum + rows.length, 0);
  return {
    pass: findingCount === 0,
    summary: {
      ga4HubspotSourceCount: sources.length,
      activeGa4HubspotSourceCount: sources.filter((source) => source?.isActive !== false).length,
      ga4HubspotRecordCount: sources.reduce((sum, source) => sum + (recordsBySource.get(sourceId(source)) || []).length, 0),
      findingCount,
    },
    findings,
  };
}
