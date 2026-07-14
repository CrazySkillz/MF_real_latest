import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import { buildShopifyRepairConfirmation, shopifyRepairConfirmationMatches } from './utils/shopify-revenue';
import { assertProductionTokenEncryptionConfigured } from './utils/tokenVault';

const originalNodeEnv = process.env.NODE_ENV;
const originalTokenKey = process.env.TOKEN_ENCRYPTION_KEY;
const originalEncryptionKey = process.env.ENCRYPTION_KEY;

afterEach(() => {
  if (originalNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = originalNodeEnv;
  if (originalTokenKey === undefined) delete process.env.TOKEN_ENCRYPTION_KEY; else process.env.TOKEN_ENCRYPTION_KEY = originalTokenKey;
  if (originalEncryptionKey === undefined) delete process.env.ENCRYPTION_KEY; else process.env.ENCRYPTION_KEY = originalEncryptionKey;
});

const input = () => ({
  source: { id: 'source-1', campaignId: 'campaign-1', sourceType: 'shopify', platformContext: 'ga4', displayName: 'Shopify', currency: 'USD', mappingConfig: '{"saved":true}', isActive: true },
  connection: { id: 'connection-1', campaignId: 'campaign-1', shopDomain: 'example.myshopify.com', mappingConfig: '{"authType":"token"}', isActive: true },
  request: { campaignField: 'utm_campaign', selectedValues: ['brand', 'search'], revenueMetric: 'current_total_price', days: 3650, platformContext: 'ga4', campaignDisplayName: '', campaignMappings: [] },
  providerOrders: [
    { id: '2', updatedAt: '2026-07-13T10:00:00Z', createdAt: '2026-07-12T10:00:00Z', campaignValue: 'search', shopAmount: 50, shopCurrency: 'USD' },
    { id: '1', updatedAt: '2026-07-13T09:00:00Z', createdAt: '2026-07-11T10:00:00Z', campaignValue: 'brand', shopAmount: 100, shopCurrency: 'USD' },
  ],
});

describe('controlled Shopify repair', () => {
  it('binds confirmation to source, connection, request, and provider order state', () => {
    const expected = buildShopifyRepairConfirmation(input());
    const reordered = input();
    reordered.request.selectedValues.reverse();
    reordered.providerOrders.reverse();
    expect(shopifyRepairConfirmationMatches(expected, buildShopifyRepairConfirmation(reordered))).toBe(true);

    for (const mutate of [
      (value: ReturnType<typeof input>) => { value.source.mappingConfig = '{"saved":false}'; },
      (value: ReturnType<typeof input>) => { value.connection.mappingConfig = '{"authType":"oauth"}'; },
      (value: ReturnType<typeof input>) => { value.request.campaignField = 'tags'; },
      (value: ReturnType<typeof input>) => { value.providerOrders[0].shopAmount = 51; },
    ]) {
      const changed = input();
      mutate(changed);
      expect(shopifyRepairConfirmationMatches(expected, buildShopifyRepairConfirmation(changed))).toBe(false);
    }
  });

  it('returns a non-secret production encryption preflight code', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertProductionTokenEncryptionConfigured()).toThrow(expect.objectContaining({
      code: 'TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED',
      message: 'Production token encryption key is not configured',
    }));
  });

  it('keeps preview confirmation before the existing transactional replacement', () => {
    const routes = readFileSync(join(__dirname, 'routes-oauth.ts'), 'utf8');
    const start = routes.indexOf('app.post("/api/campaigns/:id/shopify/save-mappings"');
    const end = routes.indexOf('app.post("/api/campaigns/:id/chat"', start);
    const route = routes.slice(start, end);
    expect(route.indexOf('shopifyRepairConfirmationMatches')).toBeGreaterThan(-1);
    expect(route.indexOf('shopifyRepairConfirmationMatches')).toBeLessThan(route.indexOf('await storage.replaceGa4ShopifyRevenueSourceWithRecords('));
    expect(route).toContain('if (platformCtx === "ga4" && !isDryRun && !repairConfirmation)');
    expect(route).toContain("code: 'SHOPIFY_REPAIR_PREVIEW_CHANGED'");
    expect(route).toContain("error?.code === 'TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED'");
  });

  it('guards the transaction against source or connection changes after preview', () => {
    const storage = readFileSync(join(__dirname, 'storage.ts'), 'utf8');
    expect(storage).toContain('expectedState.sourceMappingConfig === null ? isNull(revenueSources.mappingConfig) : eq(revenueSources.mappingConfig, expectedState.sourceMappingConfig)');
    expect(storage).toContain('expectedState.connectionMappingConfig === null ? isNull(shopifyConnections.mappingConfig) : eq(shopifyConnections.mappingConfig, expectedState.connectionMappingConfig)');
    expect(storage).toContain("'Shopify revenue source changed since preview'");
    expect(storage).toContain("'Shopify connection changed since preview'");
  });

  it('exposes one confirmed repair action and automatically reruns inventory', () => {
    const wizard = readFileSync(join(__dirname, '..', 'client', 'src', 'components', 'ShopifyRevenueWizard.tsx'), 'utf8');
    expect(wizard).toContain('const isRepair = mode === "edit" && !hasEditChanges;');
    expect(wizard).toContain('Repair from Shopify');
    expect(wizard).toContain('{previewError}');
    expect(wizard).toContain('repairConfirmation: preview.repairConfirmation');
    expect(wizard).toContain('/ga4-overview/source-damage-inventory');
    expect(wizard).toContain('shopifyLocalPersistencePass === true');
  });

  it('retains only the original saved edit value when Shopify currently returns no match', () => {
    const wizard = readFileSync(join(__dirname, '..', 'client', 'src', 'components', 'ShopifyRevenueWizard.tsx'), 'utf8');
    expect(wizard).toContain('mode === "edit" && campaignField === savedField && savedValues.has(v)');
    expect(wizard).toContain('const unavailableSavedValues = useMemo');
    expect(wizard).toContain('Continue to Review to confirm the zero-match provider preview.');
  });
});
