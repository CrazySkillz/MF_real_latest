const round2 = (value: number) => Number((Number.isFinite(value) ? value : 0).toFixed(2));
const clean = (value: any) => String(value ?? '').trim();
const lower = (value: any) => clean(value).toLowerCase();
const upper = (value: any) => clean(value).toUpperCase();
const sourceId = (value: any) => clean(value?.id);

const parseMapping = (value: any): Record<string, any> | null => {
  if (value && typeof value === 'object') return value;
  try {
    const parsed = JSON.parse(String(value || ''));
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
};

const isGa4ShopifySource = (source: any) =>
  lower(source?.sourceType) === 'shopify'
  && ['', 'ga4'].includes(lower(source?.platformContext));

const isStrictDateKey = (value: any) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(clean(value));
  if (!match) return false;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return date.getUTCFullYear() === Number(match[1])
    && date.getUTCMonth() === Number(match[2]) - 1
    && date.getUTCDate() === Number(match[3]);
};

const normalizedValues = (value: any) => (Array.isArray(value) ? value : [])
  .map(clean)
  .filter(Boolean)
  .sort()
  .join('\n');

const displayShopDomain = (source: any) => {
  const match = /^Shopify \(([^)]+)\)$/i.exec(clean(source?.displayName));
  return match ? lower(match[1]) : null;
};

const mappedShopDomain = (source: any) => {
  const mapping = parseMapping(source?.mappingConfig);
  return lower(mapping?.shopDomain) || displayShopDomain(source);
};

const recordsTotal = (records: any[]) => round2(records.reduce((sum, record) => {
  const value = Number(record?.revenue);
  return sum + (Number.isFinite(value) ? value : 0);
}, 0));

const summarizeRecords = (campaignId: string, source: any, records: any[], extra: Record<string, any> = {}) => ({
  reasonCode: clean(extra.reasonCode),
  campaignId,
  sourceId: sourceId(source),
  connectionIds: Array.isArray(extra.connectionIds) ? extra.connectionIds : [],
  recordCount: records.length,
  recordIds: records.map((record) => clean(record?.id)).filter(Boolean),
  ...extra,
});

const sourceMappingMatchesConnection = (sourceMapping: any, connectionMapping: any) => Boolean(sourceMapping && connectionMapping)
  && lower(sourceMapping.platformContext || 'ga4') === lower(connectionMapping.platformContext || 'ga4')
  && clean(sourceMapping.campaignField) === clean(connectionMapping.campaignField)
  && normalizedValues(sourceMapping.selectedValues) === normalizedValues(connectionMapping.selectedValues)
  && clean(sourceMapping.revenueMetric) === clean(connectionMapping.revenueMetric)
  && upper(sourceMapping.currency) === upper(connectionMapping.currency);

export interface ShopifyRevenueDamageInventoryInput {
  campaign: any;
  connections: any[];
  allSources: any[];
  allRecords: any[];
  referencedSources?: any[];
}

export function inspectGa4ShopifyCrossCampaignOverlap(inputs: ShopifyRevenueDamageInventoryInput[]) {
  const locations = new Map<string, Array<{ campaignId: string; sourceId: string; recordIds: string[] }>>();
  for (const input of inputs) {
    const campaignId = clean(input.campaign?.id);
    const recordsBySource = new Map<string, any[]>();
    for (const record of input.allRecords) {
      const id = clean(record?.revenueSourceId);
      if (!recordsBySource.has(id)) recordsBySource.set(id, []);
      recordsBySource.get(id)!.push(record);
    }
    for (const source of input.allSources.filter((row) => isGa4ShopifySource(row) && row?.isActive !== false)) {
      const domain = mappedShopDomain(source);
      if (!campaignId || !domain) continue;
      for (const record of recordsBySource.get(sourceId(source)) || []) {
        const orderId = clean(record?.externalId);
        if (!orderId) continue;
        const key = `${domain}\n${orderId}`;
        if (!locations.has(key)) locations.set(key, []);
        locations.get(key)!.push({
          campaignId,
          sourceId: sourceId(source),
          recordIds: [clean(record?.id)].filter(Boolean),
        });
      }
    }
  }

  const findings = Array.from(locations.entries()).flatMap(([key, rows]) => {
    const campaignIds = Array.from(new Set(rows.map((row) => row.campaignId)));
    if (campaignIds.length < 2) return [];
    const [shopDomain, orderId] = key.split('\n');
    return [{
      reasonCode: 'same_store_order_identity_across_campaigns',
      shopDomain,
      orderId,
      campaignIds,
      sourceIds: Array.from(new Set(rows.map((row) => row.sourceId))),
      recordIds: Array.from(new Set(rows.flatMap((row) => row.recordIds))),
    }];
  });

  return { pass: findings.length === 0, findings };
}

export function inspectGa4ShopifyRevenueDamage(input: ShopifyRevenueDamageInventoryInput) {
  const campaignId = clean(input.campaign?.id);
  const campaignCurrency = upper(input.campaign?.currency);
  const sources = input.allSources.filter(isGa4ShopifySource);
  const activeSources = sources.filter((source) => source?.isActive !== false);
  const sourceIds = new Set(sources.map(sourceId));
  const referencedById = new Map((input.referencedSources || input.allSources).map((source) => [sourceId(source), source]));
  const recordsBySource = new Map<string, any[]>();
  for (const record of input.allRecords) {
    const id = clean(record?.revenueSourceId);
    if (!recordsBySource.has(id)) recordsBySource.set(id, []);
    recordsBySource.get(id)!.push(record);
  }

  const activeConnections = input.connections.filter((connection) => connection?.isActive !== false);
  const activeConnectionIds = activeConnections.map((connection) => clean(connection?.id)).filter(Boolean);
  const latestActiveConnection = activeConnections.slice().sort((a, b) =>
    new Date(b?.connectedAt || b?.createdAt || 0).getTime() - new Date(a?.connectedAt || a?.createdAt || 0).getTime()
  )[0] || null;
  const latestConnectionId = clean(latestActiveConnection?.id);
  const latestConnectionDomain = lower(latestActiveConnection?.shopDomain);

  const findings: Record<string, any[]> = {
    activeSourcesWithZeroRecords: [],
    inactiveSourceRecordGroups: [],
    orphanShopifyRecordGroups: [],
    crossCampaignRecordGroups: [],
    shopifyTypedRecordsOnNonShopifySources: [],
    incompleteSourceMappingSources: [],
    sourceRecordTotalMismatches: [],
    campaignValueTotalMismatches: [],
    matchedOrderCountMismatches: [],
    invalidDateRecordGroups: [],
    outOfWindowRecordGroups: [],
    missingOrderIdentityRecordGroups: [],
    duplicateOrderIdentityGroups: [],
    sameStoreOrderIdentityOverlapGroups: [],
    recordSourceTypeMismatchGroups: [],
    recordCurrencyMismatchGroups: [],
    campaignCurrencyMismatchSources: [],
    invalidRevenueRecordGroups: [],
    activeConnectionBoundaryFindings: [],
    connectionSourceMappingMismatches: [],
    providerQueryAuditSources: [],
  };

  for (const source of sources) {
    const id = sourceId(source);
    const records = recordsBySource.get(id) || [];
    if (source?.isActive === false && records.length > 0) {
      findings.inactiveSourceRecordGroups.push(summarizeRecords(campaignId, source, records, {
        reasonCode: 'inactive_shopify_source_has_records',
      }));
    }
    if (source?.isActive === false) continue;

    const mapping = parseMapping(source?.mappingConfig);
    if (records.length === 0) {
      findings.activeSourcesWithZeroRecords.push(summarizeRecords(campaignId, source, records, {
        reasonCode: 'active_shopify_source_has_zero_records',
        connectionIds: activeConnectionIds,
      }));
    }

    const mappingIssueCodes: string[] = [];
    if (!mapping) mappingIssueCodes.push('invalid_mapping_json');
    else {
      if (lower(mapping.provider) !== 'shopify') mappingIssueCodes.push('missing_or_invalid_provider');
      if (lower(mapping.platformContext || source?.platformContext || 'ga4') !== 'ga4') mappingIssueCodes.push('invalid_platform_context');
      if (!clean(mapping.campaignField)) mappingIssueCodes.push('missing_campaign_field');
      if (!Array.isArray(mapping.selectedValues) || mapping.selectedValues.map(clean).filter(Boolean).length === 0) mappingIssueCodes.push('missing_selected_values');
      if (clean(mapping.revenueMetric) !== 'current_total_price') mappingIssueCodes.push('invalid_revenue_metric');
      if (clean(mapping.currencyBasis) !== 'shop_money_campaign_parity') mappingIssueCodes.push('missing_currency_basis');
      if (clean(mapping.orderIdentityField) !== 'id') mappingIssueCodes.push('missing_order_identity_field');
      if (clean(mapping.orderDateBasis) !== 'created_at_campaign_reporting_timezone') mappingIssueCodes.push('missing_order_date_basis');
      if (!isStrictDateKey(mapping.orderWindowStart)) mappingIssueCodes.push('missing_or_invalid_order_window_start');
      if (clean(mapping.materializationGranularity) !== 'order') mappingIssueCodes.push('invalid_materialization_granularity');
      if (!upper(mapping.currency)) mappingIssueCodes.push('missing_mapping_currency');
      if (!mappedShopDomain(source)) mappingIssueCodes.push('missing_store_provenance');
    }
    if (mappingIssueCodes.length > 0) {
      findings.incompleteSourceMappingSources.push(summarizeRecords(campaignId, source, records, {
        reasonCode: 'incomplete_shopify_source_mapping',
        connectionIds: activeConnectionIds,
        issueCodes: mappingIssueCodes,
      }));
    }

    const providerAudit = mapping?.providerQueryAudit;
    const providerAuditIssueCodes: string[] = [];
    if (!providerAudit || typeof providerAudit !== 'object') providerAuditIssueCodes.push('missing_provider_query_audit');
    else {
      if (providerAudit.queryComplete !== true) providerAuditIssueCodes.push('provider_query_not_complete');
      if (!/^\d{4}-\d{2}$/.test(clean(providerAudit.apiVersion))) providerAuditIssueCodes.push('invalid_provider_api_version');
      if (!Number.isFinite(Date.parse(clean(providerAudit.queriedAt)))) providerAuditIssueCodes.push('invalid_provider_query_time');
      if (!Number.isInteger(providerAudit.pageCount) || providerAudit.pageCount < 1) providerAuditIssueCodes.push('invalid_provider_page_count');
      if (!Number.isInteger(providerAudit.requestCount) || providerAudit.requestCount < providerAudit.pageCount) providerAuditIssueCodes.push('invalid_provider_request_count');
      if (!Number.isInteger(providerAudit.throttledResponseCount) || providerAudit.throttledResponseCount < 0
        || providerAudit.throttledResponseCount > providerAudit.requestCount) providerAuditIssueCodes.push('invalid_provider_throttle_count');
      if (!Number.isInteger(providerAudit.maxRetryAttempt) || providerAudit.maxRetryAttempt < 0) providerAuditIssueCodes.push('invalid_provider_retry_count');
      if (!Number.isInteger(providerAudit.rawOrderCount) || providerAudit.rawOrderCount < 0) providerAuditIssueCodes.push('invalid_provider_raw_order_count');
      if (!Number.isInteger(providerAudit.deduplicatedOrderCount) || providerAudit.deduplicatedOrderCount < 0
        || providerAudit.deduplicatedOrderCount > providerAudit.rawOrderCount) providerAuditIssueCodes.push('invalid_provider_deduplicated_order_count');
      if (!Number.isInteger(providerAudit.duplicateOrderCount)
        || providerAudit.duplicateOrderCount !== providerAudit.rawOrderCount - providerAudit.deduplicatedOrderCount) providerAuditIssueCodes.push('invalid_provider_duplicate_order_count');
      if (providerAudit.ordering !== 'created_at asc' || providerAudit.pageSize !== 250) providerAuditIssueCodes.push('invalid_provider_query_shape');
      if (!clean(providerAudit.orderWindowStart).startsWith(clean(mapping?.orderWindowStart))) providerAuditIssueCodes.push('provider_window_mismatch');
      if (!Number.isInteger(providerAudit.matchedOrderCount) || providerAudit.matchedOrderCount !== Number(mapping?.lastMatchedOrderCount)) providerAuditIssueCodes.push('provider_matched_order_count_mismatch');
      if (!Number.isInteger(providerAudit.selectedCandidateOrderCount) || providerAudit.selectedCandidateOrderCount < providerAudit.matchedOrderCount
        || !Number.isInteger(providerAudit.excludedSelectedOrderCount)
        || providerAudit.excludedSelectedOrderCount !== providerAudit.selectedCandidateOrderCount - providerAudit.matchedOrderCount) providerAuditIssueCodes.push('invalid_provider_eligibility_counts');
      if (!Number.isInteger(providerAudit.testOrderCount) || providerAudit.testOrderCount < 0
        || !Number.isInteger(providerAudit.cancelledOrderCount) || providerAudit.cancelledOrderCount < 0
        || !providerAudit.financialStatusCounts || typeof providerAudit.financialStatusCounts !== 'object') providerAuditIssueCodes.push('invalid_provider_order_state_counts');
      if (!/^[a-f0-9]{64}$/.test(clean(providerAudit.matchedOrderStateHash))) providerAuditIssueCodes.push('invalid_provider_state_hash');
      if (upper(providerAudit.resolvedRevenueCurrency) !== upper(mapping?.currency)) providerAuditIssueCodes.push('provider_currency_mismatch');
    }
    if (providerAuditIssueCodes.length > 0) {
      findings.providerQueryAuditSources.push(summarizeRecords(campaignId, source, records, {
        reasonCode: 'incomplete_shopify_provider_query_audit',
        connectionIds: activeConnectionIds,
        issueCodes: providerAuditIssueCodes,
      }));
    }

    const materializedTotal = recordsTotal(records);
    const configuredTotal = Number(mapping?.lastTotalRevenue);
    if (!Number.isFinite(configuredTotal) || Math.abs(round2(configuredTotal) - materializedTotal) >= 0.01) {
      findings.sourceRecordTotalMismatches.push(summarizeRecords(campaignId, source, records, {
        reasonCode: Number.isFinite(configuredTotal) ? 'configured_record_total_mismatch' : 'missing_configured_total',
        configuredTotal: Number.isFinite(configuredTotal) ? round2(configuredTotal) : null,
        materializedTotal,
      }));
    }
    const campaignTotals = Array.isArray(mapping?.campaignValueRevenueTotals) ? mapping.campaignValueRevenueTotals : null;
    const campaignValueTotal = campaignTotals
      ? round2(campaignTotals.reduce((sum: number, row: any) => sum + (Number.isFinite(Number(row?.revenue)) ? Number(row.revenue) : 0), 0))
      : null;
    if (campaignValueTotal === null || !Number.isFinite(configuredTotal) || Math.abs(campaignValueTotal - round2(configuredTotal)) >= 0.01) {
      findings.campaignValueTotalMismatches.push(summarizeRecords(campaignId, source, records, {
        reasonCode: campaignValueTotal === null ? 'missing_campaign_value_totals' : 'campaign_value_total_mismatch',
        configuredTotal: Number.isFinite(configuredTotal) ? round2(configuredTotal) : null,
        campaignValueTotal,
      }));
    }

    const expectedOrderCount = Number(mapping?.lastMatchedOrderCount);
    const orderRecordCount = records.filter((record) => clean(record?.externalId)).length;
    if (!Number.isInteger(expectedOrderCount) || expectedOrderCount < 0 || expectedOrderCount !== orderRecordCount) {
      findings.matchedOrderCountMismatches.push(summarizeRecords(campaignId, source, records, {
        reasonCode: Number.isInteger(expectedOrderCount) ? 'matched_order_count_mismatch' : 'missing_matched_order_count',
        configuredOrderCount: Number.isInteger(expectedOrderCount) ? expectedOrderCount : null,
        materializedOrderCount: orderRecordCount,
      }));
    }

    const invalidDates = records.filter((record) => !isStrictDateKey(record?.date));
    if (invalidDates.length > 0) {
      findings.invalidDateRecordGroups.push(summarizeRecords(campaignId, source, invalidDates, {
        reasonCode: 'invalid_order_date',
        dates: Array.from(new Set(invalidDates.map((record) => clean(record?.date)))),
      }));
    }
    const orderWindowStart = isStrictDateKey(mapping?.orderWindowStart) ? clean(mapping?.orderWindowStart) : null;
    const outOfWindow = orderWindowStart
      ? records.filter((record) => isStrictDateKey(record?.date) && clean(record?.date) < orderWindowStart)
      : [];
    if (outOfWindow.length > 0) {
      findings.outOfWindowRecordGroups.push(summarizeRecords(campaignId, source, outOfWindow, {
        reasonCode: 'order_date_before_configured_window',
        orderWindowStart,
        dates: Array.from(new Set(outOfWindow.map((record) => clean(record?.date)))),
      }));
    }

    const isZeroPlaceholder = records.length === 1
      && !clean(records[0]?.externalId)
      && Number(records[0]?.revenue) === 0
      && expectedOrderCount === 0;
    const missingIdentity = isZeroPlaceholder ? [] : records.filter((record) => !clean(record?.externalId));
    if (missingIdentity.length > 0) {
      findings.missingOrderIdentityRecordGroups.push(summarizeRecords(campaignId, source, missingIdentity, {
        reasonCode: 'missing_shopify_order_identity',
      }));
    }
    const recordsByOrderId = new Map<string, any[]>();
    for (const record of records) {
      const orderId = clean(record?.externalId);
      if (!orderId) continue;
      if (!recordsByOrderId.has(orderId)) recordsByOrderId.set(orderId, []);
      recordsByOrderId.get(orderId)!.push(record);
    }
    for (const [orderId, grouped] of Array.from(recordsByOrderId.entries())) {
      if (grouped.length < 2) continue;
      findings.duplicateOrderIdentityGroups.push(summarizeRecords(campaignId, source, grouped, {
        reasonCode: 'duplicate_shopify_order_identity_within_source',
        orderId,
      }));
    }

    const typeMismatches = records.filter((record) => lower(record?.sourceType) !== 'shopify');
    if (typeMismatches.length > 0) {
      findings.recordSourceTypeMismatchGroups.push(summarizeRecords(campaignId, source, typeMismatches, {
        reasonCode: 'record_source_type_mismatch',
        sourceTypes: Array.from(new Set(typeMismatches.map((record) => clean(record?.sourceType)))),
      }));
    }
    const sourceCurrency = upper(source?.currency);
    const currencyMismatches = records.filter((record) => upper(record?.currency) !== sourceCurrency);
    if (currencyMismatches.length > 0) {
      findings.recordCurrencyMismatchGroups.push(summarizeRecords(campaignId, source, currencyMismatches, {
        reasonCode: 'record_currency_mismatch',
        sourceCurrency: sourceCurrency || null,
        recordCurrencies: Array.from(new Set(currencyMismatches.map((record) => upper(record?.currency)))),
      }));
    }
    const mappingCurrency = upper(mapping?.currency);
    if (!campaignCurrency || !sourceCurrency || sourceCurrency !== campaignCurrency || (mappingCurrency && mappingCurrency !== campaignCurrency)) {
      findings.campaignCurrencyMismatchSources.push(summarizeRecords(campaignId, source, records, {
        reasonCode: 'shopify_campaign_currency_mismatch',
        campaignCurrency: campaignCurrency || null,
        sourceCurrency: sourceCurrency || null,
        mappingCurrency: mappingCurrency || null,
      }));
    }
    const invalidRevenue = records.filter((record) => {
      const value = Number(record?.revenue);
      return !Number.isFinite(value) || value < 0 || (Boolean(clean(record?.externalId)) && value === 0);
    });
    if (invalidRevenue.length > 0) {
      findings.invalidRevenueRecordGroups.push(summarizeRecords(campaignId, source, invalidRevenue, {
        reasonCode: 'invalid_shopify_order_revenue',
        revenues: invalidRevenue.map((record) => clean(record?.revenue)),
      }));
    }
  }

  for (const [id, records] of Array.from(recordsBySource.entries())) {
    const referencedSource = referencedById.get(id);
    const shopifyRecords = records.filter((record) => lower(record?.sourceType) === 'shopify');
    if (!referencedSource && shopifyRecords.length > 0) {
      findings.orphanShopifyRecordGroups.push({
        reasonCode: 'orphan_shopify_records', campaignId, sourceId: id, connectionIds: [],
        recordCount: shopifyRecords.length, recordIds: shopifyRecords.map((record) => clean(record?.id)).filter(Boolean),
      });
    } else if (referencedSource && !isGa4ShopifySource(referencedSource) && shopifyRecords.length > 0) {
      findings.shopifyTypedRecordsOnNonShopifySources.push({
        reasonCode: 'shopify_records_linked_to_non_shopify_source', campaignId, sourceId: id, connectionIds: [],
        recordCount: shopifyRecords.length, recordIds: shopifyRecords.map((record) => clean(record?.id)).filter(Boolean),
      });
    }
    if (isGa4ShopifySource(referencedSource)) {
      const mismatched = records.filter((record) => clean(record?.campaignId) !== clean(referencedSource?.campaignId));
      if (mismatched.length > 0) {
        findings.crossCampaignRecordGroups.push({
          reasonCode: 'record_campaign_does_not_match_shopify_source', campaignId, sourceId: id, connectionIds: [],
          recordCount: mismatched.length, recordIds: mismatched.map((record) => clean(record?.id)).filter(Boolean),
        });
      }
    }
  }

  const activeOrderLocations = new Map<string, Array<{ source: any; records: any[] }>>();
  for (const source of activeSources) {
    const domain = mappedShopDomain(source);
    if (!domain) continue;
    const byOrder = new Map<string, any[]>();
    for (const record of recordsBySource.get(sourceId(source)) || []) {
      const orderId = clean(record?.externalId);
      if (!orderId) continue;
      if (!byOrder.has(orderId)) byOrder.set(orderId, []);
      byOrder.get(orderId)!.push(record);
    }
    for (const [orderId, records] of Array.from(byOrder.entries())) {
      const key = `${domain}\n${orderId}`;
      if (!activeOrderLocations.has(key)) activeOrderLocations.set(key, []);
      activeOrderLocations.get(key)!.push({ source, records });
    }
  }
  for (const [key, locations] of Array.from(activeOrderLocations.entries())) {
    if (locations.length < 2) continue;
    const [shopDomain, orderId] = key.split('\n');
    findings.sameStoreOrderIdentityOverlapGroups.push({
      reasonCode: 'same_store_order_identity_across_active_sources',
      campaignId,
      connectionIds: activeConnectionIds,
      sourceIds: locations.map((location) => sourceId(location.source)),
      recordIds: locations.flatMap((location) => location.records.map((record) => clean(record?.id)).filter(Boolean)),
      shopDomain,
      orderId,
    });
  }

  if (activeSources.length > 0 && activeConnections.length === 0) {
    findings.activeConnectionBoundaryFindings.push({
      reasonCode: 'active_shopify_sources_without_active_connection', campaignId,
      connectionIds: [], sourceIds: activeSources.map(sourceId), recordIds: [],
    });
  }
  if (activeConnections.length > 1) {
    findings.activeConnectionBoundaryFindings.push({
      reasonCode: 'multiple_active_shopify_connections', campaignId,
      connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [],
    });
  }
  if (latestActiveConnection) {
    const domainMismatches = activeSources.filter((source) => mappedShopDomain(source) !== latestConnectionDomain);
    if (domainMismatches.length > 0) {
      findings.activeConnectionBoundaryFindings.push({
        reasonCode: 'active_source_store_does_not_match_active_connection', campaignId,
        connectionIds: [latestConnectionId], sourceIds: domainMismatches.map(sourceId), recordIds: [],
        connectionShopDomain: latestConnectionDomain || null,
        sourceShopDomains: domainMismatches.map((source) => ({ sourceId: sourceId(source), shopDomain: mappedShopDomain(source) })),
      });
    }
    const connectionMapping = parseMapping(latestActiveConnection?.mappingConfig);
    if (activeSources.length > 0 && !activeSources.some((source) => sourceMappingMatchesConnection(parseMapping(source?.mappingConfig), connectionMapping))) {
      findings.connectionSourceMappingMismatches.push({
        reasonCode: 'active_connection_mapping_matches_no_active_shopify_source', campaignId,
        connectionIds: [latestConnectionId], sourceIds: activeSources.map(sourceId), recordIds: [],
      });
    }
  }

  const findingCount = Object.values(findings).reduce((sum, rows) => sum + rows.length, 0);
  const retainedLastGoodAfterFailureSources = activeSources.filter((source) => {
    const mapping = parseMapping(source?.mappingConfig);
    const failedAt = Date.parse(clean(mapping?.lastRefreshFailureAt));
    const goodAt = Date.parse(clean(mapping?.lastGoodAt || mapping?.lastRefreshSuccessAt || mapping?.lastSyncedAt));
    return Number.isFinite(failedAt) && Number.isFinite(goodAt) && failedAt > goodAt && (recordsBySource.get(sourceId(source)) || []).length > 0;
  }).map((source) => ({
    campaignId,
    sourceId: sourceId(source),
    connectionIds: latestConnectionId ? [latestConnectionId] : [],
    recordIds: (recordsBySource.get(sourceId(source)) || []).map((record) => clean(record?.id)).filter(Boolean),
    reasonCode: 'last_good_rows_retained_after_refresh_failure',
  }));

  return {
    pass: findingCount === 0,
    scopeComplete: false,
    inventory: {
      campaignId,
      connections: input.connections.map((connection) => ({
        campaignId,
        connectionId: clean(connection?.id),
        shopDomain: lower(connection?.shopDomain) || null,
        isActive: connection?.isActive !== false,
      })),
      sources: sources.map((source) => ({
        campaignId,
        sourceId: sourceId(source),
        connectionIds: activeConnectionIds,
        shopDomain: mappedShopDomain(source),
        isActive: source?.isActive !== false,
        recordIds: (recordsBySource.get(sourceId(source)) || []).map((record) => clean(record?.id)).filter(Boolean),
      })),
      shopifyTypedRecordGroups: Array.from(recordsBySource.entries())
        .filter(([id, records]) => sourceIds.has(id) || records.some((record) => lower(record?.sourceType) === 'shopify'))
        .map(([id, records]) => ({
          campaignId,
          sourceId: id,
          recordIds: records.filter((record) => sourceIds.has(id) || lower(record?.sourceType) === 'shopify')
            .map((record) => clean(record?.id))
            .filter(Boolean),
        })),
    },
    summary: {
      campaignId,
      ga4ShopifySourceCount: sources.length,
      activeGa4ShopifySourceCount: activeSources.length,
      ga4ShopifyRecordCount: sources.reduce((sum, source) => sum + (recordsBySource.get(sourceId(source)) || []).length, 0),
      shopifyConnectionCount: input.connections.length,
      activeShopifyConnectionCount: activeConnections.length,
      findingCount,
    },
    findings,
    observations: { retainedLastGoodAfterFailureSources },
    notLocallyVerifiable: [
      { reasonCode: 'provider_order_state_lineage_not_persisted', campaignId, connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [] },
      { reasonCode: 'provider_refund_and_cancellation_lineage_not_persisted', campaignId, connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [] },
      { reasonCode: 'provider_query_history_before_latest_audit_not_reconstructable', campaignId, connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [] },
      { reasonCode: 'cross_campaign_order_overlap_requires_privileged_multi_campaign_inventory', campaignId, connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [] },
      { reasonCode: 'historical_order_change_convergence_not_persisted', campaignId, connectionIds: activeConnectionIds, sourceIds: activeSources.map(sourceId), recordIds: [] },
    ],
  };
}
