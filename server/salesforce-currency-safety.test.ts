import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), 'utf8');

describe('Salesforce revenue currency safety', () => {
  it('validates currency before any Salesforce revenue mutation and persists the validated value', () => {
    const routes = readSource('server', 'routes-oauth.ts');
    const start = routes.indexOf('app.post("/api/campaigns/:id/salesforce/save-mappings"');
    const end = routes.indexOf('// Salesforce pipeline proxy status', start);
    const route = routes.slice(start, end);
    const detection = route.indexOf('const currencyDetection = await detectSalesforceCurrency({');
    const validation = route.indexOf('const currencyValidation = validateSalesforceRevenueCurrency({', detection);

    expect(detection).toBeGreaterThanOrEqual(0);
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(validation).toBeGreaterThan(detection);
    expect(route.indexOf('await storage.updateLinkedInConnection', validation)).toBeGreaterThan(validation);
    expect(route.indexOf('await storage.updateSalesforceConnection', validation)).toBeGreaterThan(validation);
    expect(route.indexOf('await storage.updateRevenueSource', validation)).toBeGreaterThan(validation);
    expect(route.indexOf('await storage.createRevenueSource', validation)).toBeGreaterThan(validation);
    expect(route.indexOf('await storage.deleteRevenueRecordsBySource', validation)).toBeGreaterThan(validation);
    expect(route.indexOf('await storage.replaceGa4SalesforceRevenueSourceWithRecords', validation)).toBeGreaterThan(validation);
    expect(route).toContain('const cur = sfCurrency;');
    expect(route).toContain('currency: sfCurrency,');
  });

  it('blocks review while Salesforce currency is unknown or mismatched', () => {
    const wizard = readSource('client', 'src', 'components', 'SalesforceRevenueWizard.tsx');

    expect(wizard).toContain('const effectiveCurrencyUnknown = previewKey === reviewPreviewKey && !!previewCampaignCurrency && !effectiveSalesforceCurrency;');
    expect(wizard).toContain('(step === "review" && (previewLoading || previewKey !== reviewPreviewKey || !previewCampaignCurrency || effectiveCurrencyUnknown || effectiveCurrencyMismatch))');
    expect(wizard).toContain('Salesforce currency could not be verified.');
  });
});
