import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { findHubspotConnectionSourceMappingMismatches, inspectGa4HubspotRevenueDamage } from './utils/hubspot-revenue-damage-inventory';

const mapping = (total: number, campaignTotal = total) => JSON.stringify({
  provider: 'hubspot',
  platformContext: 'ga4',
  campaignProperty: 'dealname',
  selectedValues: ['Alpha'],
  revenueProperty: 'amount',
  dateField: 'closedate',
  lastTotalRevenue: total,
  campaignValueRevenueTotals: [{ campaignValue: 'Alpha', revenue: campaignTotal }],
});

describe('HubSpot Revenue damaged-data inventory', () => {
  it('allows distinct active source mappings when the latest connection mapping matches one source', () => {
    const source = (sourceId: string, selectedValue: string) => ({
      sourceId,
      mapping: {
        campaignProperty: 'dealname',
        selectedValues: [selectedValue],
        revenueProperty: 'amount',
        dateField: 'closedate',
        pipelineEnabled: false,
        pipelineStageId: null,
      },
    });
    const sources = [source('hs-alpha', 'Alpha'), source('hs-beta', 'Beta'), source('hs-gamma', 'Gamma')];

    expect(findHubspotConnectionSourceMappingMismatches(sources, sources[2].mapping)).toEqual([]);
    expect(findHubspotConnectionSourceMappingMismatches(sources, source('missing', 'Missing').mapping)).toEqual([{
      reason: 'active HubSpot connection mapping does not match any active GA4 HubSpot source',
      activeSourceIds: ['hs-alpha', 'hs-beta', 'hs-gamma'],
    }]);
  });

  it('passes a reconciled GA4 source without double-counting attributed records', () => {
    const result = inspectGa4HubspotRevenueDamage([
      { id: 'hs-clean', campaignId: 'c1', sourceType: 'hubspot', platformContext: 'ga4', currency: 'USD', isActive: true, mappingConfig: mapping(150) },
    ], [
      { id: 'r1', campaignId: 'c1', revenueSourceId: 'hs-clean', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '100' },
      { id: 'r2', campaignId: 'c1', revenueSourceId: 'hs-clean', sourceType: 'hubspot', currency: 'USD', date: '2026-07-02', revenue: '50' },
      { id: 'r3', campaignId: 'c1', revenueSourceId: 'hs-clean', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '100', subCampaignUrn: 'alpha' },
    ]);

    expect(result.pass).toBe(true);
    expect(result.summary).toEqual({ ga4HubspotSourceCount: 1, activeGa4HubspotSourceCount: 1, ga4HubspotRecordCount: 3, findingCount: 0 });
  });

  it('returns exact contradictory-source and damaged-record candidates without cleanup authority', () => {
    const currentSources = [
      { id: 'hs-damaged', campaignId: 'c1', sourceType: 'hubspot', platformContext: null, currency: 'USD', isActive: true, mappingConfig: mapping(200, 180) },
      { id: 'sheet', campaignId: 'c1', sourceType: 'google_sheets', platformContext: 'ga4', currency: 'USD', isActive: true, mappingConfig: '{}' },
    ];
    const records = [
      { id: 'r1', campaignId: 'c1', revenueSourceId: 'hs-damaged', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '40' },
      { id: 'r2', campaignId: 'c1', revenueSourceId: 'hs-damaged', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '60' },
      { id: 'r3', campaignId: 'c1', revenueSourceId: 'hs-damaged', sourceType: 'csv', currency: 'EUR', date: '2026-02-30', revenue: '20' },
      { id: 'r4', campaignId: 'c1', revenueSourceId: 'other-hs', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '30' },
      { id: 'r5', campaignId: 'c1', revenueSourceId: 'sheet', sourceType: 'hubspot', currency: 'USD', date: '2026-07-01', revenue: '10' },
    ];
    const result = inspectGa4HubspotRevenueDamage(currentSources, records, [
      ...currentSources,
      { id: 'other-hs', campaignId: 'c2', sourceType: 'hubspot', platformContext: 'ga4', currency: 'USD', isActive: true, mappingConfig: mapping(30) },
    ]);

    expect(result.pass).toBe(false);
    expect(result.findings.sourceRecordTotalMismatches[0]).toMatchObject({ sourceId: 'hs-damaged', configuredTotal: 200, materializedTotal: 120 });
    expect(result.findings.campaignValueTotalMismatches[0]).toMatchObject({ sourceId: 'hs-damaged', configuredTotal: 200, campaignValueTotal: 180 });
    expect(result.findings.invalidDateRecordGroups).toEqual([{ sourceId: 'hs-damaged', recordCount: 1, recordIds: ['r3'], dates: ['2026-02-30'] }]);
    expect(result.findings.duplicateRecordGroups).toEqual([{ sourceId: 'hs-damaged', grain: '2026-07-01|', recordCount: 2, amountTotal: 100, recordIds: ['r1', 'r2'] }]);
    expect(result.findings.crossCampaignRecordGroups).toEqual([{ sourceId: 'other-hs', recordCount: 1, recordIds: ['r4'] }]);
    expect(result.findings.recordSourceTypeMismatchGroups[0]).toMatchObject({ sourceId: 'hs-damaged', recordIds: ['r3'], sourceTypes: ['csv'] });
    expect(result.findings.hubspotTypedRecordsOnNonHubspotSources).toEqual([{ sourceId: 'sheet', recordCount: 1, recordIds: ['r5'] }]);
    expect(result.findings.recordCurrencyMismatchGroups[0]).toMatchObject({ sourceId: 'hs-damaged', recordIds: ['r3'], recordCurrencies: ['EUR'] });
    expect(result.findings.partialReplacementCandidates[0].issueCodes).toEqual([
      'configured_record_total_mismatch',
      'campaign_value_total_mismatch',
      'invalid_record_dates',
      'duplicate_record_grains',
      'record_source_type_mismatch',
      'record_currency_mismatch',
    ]);
  });

  it('excludes non-GA4 HubSpot sources from strict daily-materialization checks', () => {
    const result = inspectGa4HubspotRevenueDamage([
      { id: 'linkedin-hs', campaignId: 'c1', sourceType: 'hubspot', platformContext: 'linkedin', isActive: true, mappingConfig: '{}' },
      { id: 'salesforce', campaignId: 'c1', sourceType: 'salesforce', platformContext: 'ga4', isActive: true, mappingConfig: '{}' },
    ], []);

    expect(result.pass).toBe(true);
    expect(result.summary.ga4HubspotSourceCount).toBe(0);
  });

  it('keeps the campaign-guarded endpoint read-only and forbids automatic cleanup', () => {
    const routes = readFileSync('server/routes-oauth.ts', 'utf8');
    const start = routes.indexOf('app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"');
    const end = routes.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"', start);
    const route = routes.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(route).toContain('requireCampaignAccessParamId');
    expect(route).toContain('inspectGa4HubspotRevenueDamage');
    expect(route).toContain('hubspotCleanupAssessment');
    expect(route).toContain('hubspotFindings.missingActiveHubspotAccount = hubspotProvenanceFindings.missingActiveHubspotAccount');
    expect(route).toContain('hubspotFindings.activeHubspotSourcesMissingMappingProvenance = hubspotProvenanceFindings.activeHubspotSourcesMissingMappingProvenance');
    expect(route).toContain('automaticCleanupAllowed: false');
    expect(route).not.toMatch(/[.](insert|update|delete)[(]/);
    expect(route).not.toContain('deleteRevenue');
    expect(route).not.toContain('recomputeCampaignDerivedValues');
    const runner = readFileSync('client/public/ga4-overview-validation-runner.js', 'utf8');
    expect(runner).toContain('var VERSION = "2026-07-12.5";');
    expect(runner).toContain('hubspotFindings: Object.assign({}, hubspotFindings');
    expect(runner).toContain('cleanupAssessment: data.hubspotCleanupAssessment || null');
    expect(runner).toContain('data.hubspotCleanupAssessment.automaticCleanupAllowed === false');
  });
});
