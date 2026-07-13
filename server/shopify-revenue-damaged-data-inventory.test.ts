import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { inspectGa4ShopifyRevenueDamage } from './utils/shopify-revenue-damage-inventory';

const sourceMapping = (overrides: Record<string, any> = {}) => JSON.stringify({
  provider: 'shopify',
  platformContext: 'ga4',
  campaignField: 'utm_campaign',
  selectedValues: ['Alpha'],
  revenueMetric: 'current_total_price',
  currencyBasis: 'shop_money_campaign_parity',
  orderIdentityField: 'id',
  orderDateBasis: 'created_at_campaign_reporting_timezone',
  orderWindowStart: '2026-07-01',
  materializationGranularity: 'order',
  currency: 'USD',
  lastTotalRevenue: 150,
  lastMatchedOrderCount: 2,
  campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: 150 }],
  ...overrides,
});

const connectionMapping = (overrides: Record<string, any> = {}) => JSON.stringify({
  platformContext: 'ga4',
  campaignField: 'utm_campaign',
  selectedValues: ['Alpha'],
  revenueMetric: 'current_total_price',
  currency: 'USD',
  shopDomain: 'alpha.myshopify.com',
  ...overrides,
});

describe('Shopify Revenue damaged-data inventory', () => {
  it('passes only locally inspectable persisted invariants and keeps provider scope incomplete', () => {
    const result = inspectGa4ShopifyRevenueDamage({
      campaign: { id: 'c1', currency: 'USD' },
      connections: [{
        id: 'conn-1', campaignId: 'c1', shopDomain: 'alpha.myshopify.com', isActive: true,
        mappingConfig: connectionMapping(), connectedAt: '2026-07-01T00:00:00.000Z',
      }],
      allSources: [{
        id: 'source-1', campaignId: 'c1', sourceType: 'shopify', platformContext: 'ga4',
        displayName: 'Shopify (alpha.myshopify.com)', currency: 'USD', isActive: true,
        mappingConfig: sourceMapping(),
      }],
      allRecords: [
        { id: 'r1', campaignId: 'c1', revenueSourceId: 'source-1', sourceType: 'shopify', currency: 'USD', date: '2026-07-01', revenue: '100', externalId: 'order-1' },
        { id: 'r2', campaignId: 'c1', revenueSourceId: 'source-1', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '50', externalId: 'order-2' },
      ],
    });

    expect(result.pass).toBe(true);
    expect(result.scopeComplete).toBe(false);
    expect(result.summary).toEqual({
      campaignId: 'c1',
      ga4ShopifySourceCount: 1,
      activeGa4ShopifySourceCount: 1,
      ga4ShopifyRecordCount: 2,
      shopifyConnectionCount: 1,
      activeShopifyConnectionCount: 1,
      findingCount: 0,
    });
    expect(result.inventory).toMatchObject({
      campaignId: 'c1',
      connections: [{ campaignId: 'c1', connectionId: 'conn-1', shopDomain: 'alpha.myshopify.com', isActive: true }],
      sources: [{ campaignId: 'c1', sourceId: 'source-1', connectionIds: ['conn-1'], recordIds: ['r1', 'r2'] }],
      shopifyTypedRecordGroups: [{ campaignId: 'c1', sourceId: 'source-1', recordIds: ['r1', 'r2'] }],
    });
    expect(result.notLocallyVerifiable.map((row) => row.reasonCode)).toContain('provider_order_state_not_persisted');
    expect(result.notLocallyVerifiable.map((row) => row.reasonCode)).toContain('cross_campaign_order_overlap_requires_privileged_multi_campaign_inventory');
  });

  it('allows the intentional zero placeholder without inventing an order identity finding', () => {
    const result = inspectGa4ShopifyRevenueDamage({
      campaign: { id: 'c1', currency: 'USD' },
      connections: [{
        id: 'conn-1', shopDomain: 'alpha.myshopify.com', isActive: true,
        mappingConfig: connectionMapping(), connectedAt: '2026-07-01T00:00:00.000Z',
      }],
      allSources: [{
        id: 'source-1', campaignId: 'c1', sourceType: 'shopify', platformContext: 'ga4',
        displayName: 'Shopify (alpha.myshopify.com)', currency: 'USD', isActive: true,
        mappingConfig: sourceMapping({
          lastTotalRevenue: 0,
          lastMatchedOrderCount: 0,
          campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: 0 }],
        }),
      }],
      allRecords: [
        { id: 'zero', campaignId: 'c1', revenueSourceId: 'source-1', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '0', externalId: null },
      ],
    });

    expect(result.pass).toBe(true);
    expect(result.findings.missingOrderIdentityRecordGroups).toEqual([]);
    expect(result.findings.invalidRevenueRecordGroups).toEqual([]);
  });

  it('returns exact persisted-data candidates with reason codes and no provider overclaim', () => {
    const currentSources = [
      {
        id: 'damaged', campaignId: 'c1', sourceType: 'shopify', platformContext: null,
        displayName: 'Shopify (alpha.myshopify.com)', currency: 'EUR', isActive: true,
        mappingConfig: sourceMapping({
          currency: 'EUR',
          lastTotalRevenue: 999,
          lastMatchedOrderCount: 4,
          campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: 800 }],
        }),
      },
      {
        id: 'overlap', campaignId: 'c1', sourceType: 'shopify', platformContext: 'ga4',
        displayName: 'Shopify (alpha.myshopify.com)', currency: 'USD', isActive: true,
        mappingConfig: sourceMapping({ lastTotalRevenue: 10, lastMatchedOrderCount: 1, campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: 10 }] }),
      },
      {
        id: 'inactive', campaignId: 'c1', sourceType: 'shopify', platformContext: 'ga4',
        displayName: 'Shopify (alpha.myshopify.com)', currency: 'USD', isActive: false,
        mappingConfig: sourceMapping(),
      },
      { id: 'sheet', campaignId: 'c1', sourceType: 'google_sheets', platformContext: 'ga4', currency: 'USD', isActive: true },
    ];
    const records = [
      { id: 'r1', campaignId: 'c1', revenueSourceId: 'damaged', sourceType: 'shopify', currency: 'EUR', date: '2026-07-02', revenue: '40', externalId: 'order-1' },
      { id: 'r2', campaignId: 'c1', revenueSourceId: 'damaged', sourceType: 'shopify', currency: 'EUR', date: '2026-07-03', revenue: '60', externalId: 'order-1' },
      { id: 'r3', campaignId: 'c1', revenueSourceId: 'damaged', sourceType: 'csv', currency: 'USD', date: '2026-02-30', revenue: '-5', externalId: null },
      { id: 'r4', campaignId: 'c1', revenueSourceId: 'damaged', sourceType: 'shopify', currency: 'EUR', date: '2026-06-30', revenue: '5', externalId: 'order-old' },
      { id: 'r5', campaignId: 'c1', revenueSourceId: 'overlap', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: 'order-1' },
      { id: 'r6', campaignId: 'c1', revenueSourceId: 'inactive', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '25', externalId: 'inactive-order' },
      { id: 'r7', campaignId: 'c1', revenueSourceId: 'missing', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: 'orphan-order' },
      { id: 'r8', campaignId: 'c1', revenueSourceId: 'sheet', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: 'wrong-source' },
      { id: 'r9', campaignId: 'c1', revenueSourceId: 'foreign', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: 'foreign-order' },
    ];
    const result = inspectGa4ShopifyRevenueDamage({
      campaign: { id: 'c1', currency: 'USD' },
      connections: [
        { id: 'conn-old', campaignId: 'c1', shopDomain: 'alpha.myshopify.com', isActive: true, mappingConfig: connectionMapping(), connectedAt: '2026-07-01T00:00:00.000Z' },
        { id: 'conn-new', campaignId: 'c1', shopDomain: 'beta.myshopify.com', isActive: true, mappingConfig: connectionMapping({ shopDomain: 'beta.myshopify.com' }), connectedAt: '2026-07-02T00:00:00.000Z' },
      ],
      allSources: currentSources,
      allRecords: records,
      referencedSources: [
        ...currentSources,
        { id: 'foreign', campaignId: 'c2', sourceType: 'shopify', platformContext: 'ga4', currency: 'USD', isActive: true, mappingConfig: sourceMapping() },
      ],
    });

    expect(result.pass).toBe(false);
    expect(result.findings.sourceRecordTotalMismatches[0]).toMatchObject({
      reasonCode: 'configured_record_total_mismatch', campaignId: 'c1', sourceId: 'damaged',
      recordIds: ['r1', 'r2', 'r3', 'r4'], configuredTotal: 999, materializedTotal: 100,
    });
    expect(result.findings.duplicateOrderIdentityGroups[0]).toMatchObject({
      reasonCode: 'duplicate_shopify_order_identity_within_source', sourceId: 'damaged', orderId: 'order-1', recordIds: ['r1', 'r2'],
    });
    expect(result.findings.sameStoreOrderIdentityOverlapGroups[0]).toMatchObject({
      reasonCode: 'same_store_order_identity_across_active_sources', campaignId: 'c1',
      sourceIds: ['damaged', 'overlap'], orderId: 'order-1',
    });
    expect(result.findings.invalidDateRecordGroups[0]).toMatchObject({ reasonCode: 'invalid_order_date', sourceId: 'damaged', recordIds: ['r3'] });
    expect(result.findings.outOfWindowRecordGroups[0]).toMatchObject({ reasonCode: 'order_date_before_configured_window', sourceId: 'damaged', recordIds: ['r4'] });
    expect(result.findings.missingOrderIdentityRecordGroups[0]).toMatchObject({ reasonCode: 'missing_shopify_order_identity', sourceId: 'damaged', recordIds: ['r3'] });
    expect(result.findings.recordSourceTypeMismatchGroups[0]).toMatchObject({ reasonCode: 'record_source_type_mismatch', sourceId: 'damaged', recordIds: ['r3'] });
    expect(result.findings.recordCurrencyMismatchGroups[0]).toMatchObject({ reasonCode: 'record_currency_mismatch', sourceId: 'damaged', recordIds: ['r3'] });
    expect(result.findings.campaignCurrencyMismatchSources[0]).toMatchObject({ reasonCode: 'shopify_campaign_currency_mismatch', sourceId: 'damaged' });
    expect(result.findings.invalidRevenueRecordGroups[0]).toMatchObject({ reasonCode: 'invalid_shopify_order_revenue', sourceId: 'damaged', recordIds: ['r3'] });
    expect(result.findings.inactiveSourceRecordGroups[0]).toMatchObject({ reasonCode: 'inactive_shopify_source_has_records', sourceId: 'inactive', recordIds: ['r6'] });
    expect(result.findings.orphanShopifyRecordGroups[0]).toMatchObject({ reasonCode: 'orphan_shopify_records', sourceId: 'missing', recordIds: ['r7'] });
    expect(result.findings.shopifyTypedRecordsOnNonShopifySources[0]).toMatchObject({ reasonCode: 'shopify_records_linked_to_non_shopify_source', sourceId: 'sheet', recordIds: ['r8'] });
    expect(result.findings.crossCampaignRecordGroups[0]).toMatchObject({ reasonCode: 'record_campaign_does_not_match_shopify_source', sourceId: 'foreign', recordIds: ['r9'] });
    expect(result.findings.activeConnectionBoundaryFindings.map((row) => row.reasonCode)).toEqual([
      'multiple_active_shopify_connections',
      'active_source_store_does_not_match_active_connection',
    ]);
  });

  it('does not treat the same provider order ID from different stores as proven overlap', () => {
    const makeSource = (id: string, domain: string) => ({
      id, campaignId: 'c1', sourceType: 'shopify', platformContext: 'ga4',
      displayName: `Shopify (${domain})`, currency: 'USD', isActive: true,
      mappingConfig: sourceMapping({ lastTotalRevenue: 10, lastMatchedOrderCount: 1, campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: 10 }] }),
    });
    const result = inspectGa4ShopifyRevenueDamage({
      campaign: { id: 'c1', currency: 'USD' },
      connections: [],
      allSources: [makeSource('alpha', 'alpha.myshopify.com'), makeSource('beta', 'beta.myshopify.com')],
      allRecords: [
        { id: 'a', campaignId: 'c1', revenueSourceId: 'alpha', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: '1' },
        { id: 'b', campaignId: 'c1', revenueSourceId: 'beta', sourceType: 'shopify', currency: 'USD', date: '2026-07-02', revenue: '10', externalId: '1' },
      ],
    });

    expect(result.findings.sameStoreOrderIdentityOverlapGroups).toEqual([]);
  });

  it('keeps the campaign-guarded endpoint GET-only and forbids cleanup generation', () => {
    const routes = readFileSync('server/routes-oauth.ts', 'utf8');
    const start = routes.indexOf('app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"');
    const end = routes.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"', start);
    const route = routes.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(route).toContain('requireCampaignAccessParamId');
    expect(route).toContain('inspectGa4ShopifyRevenueDamage');
    expect(route).toContain('shopifyLocalPersistencePass');
    expect(route).toContain('shopifyInventoryScopeComplete');
    expect(route).toContain('shopifyInventoryEntities');
    expect(route).toContain('shopifyNotLocallyVerifiable');
    expect(route).toContain('shopifyCleanupAssessment');
    expect(route).toContain('automaticCleanupAllowed: false');
    expect(route).toContain('cleanupProposalGenerated: false');
    expect(route).not.toMatch(/[.](insert|update|delete)[(]/);
    expect(route).not.toContain('deleteRevenue');
    expect(route).not.toContain('recomputeCampaignDerivedValues');
  });
});
