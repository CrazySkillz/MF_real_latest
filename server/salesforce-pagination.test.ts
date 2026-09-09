import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  fetchCompleteSalesforceQuery,
  SALESFORCE_PAGINATION_ERROR_CODE,
  SALESFORCE_RESULT_LIMIT_ERROR_CODE,
} from './utils/salesforce-pagination';
import { escapeSalesforceSoqlLikePrefix, isSafeSalesforceFieldPath } from './utils/salesforce-query';

const instanceUrl = 'https://example.my.salesforce.com';
const initialUrl = `${instanceUrl}/services/data/v59.0/query?q=test`;

const page = (body: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as any;

describe('Salesforce bounded query pagination', () => {
  it('validates field paths and escapes Salesforce prefix-search literals', () => {
    expect(isSafeSalesforceFieldPath('Campaign_Name__c')).toBe(true);
    expect(isSafeSalesforceFieldPath('Owner.Name')).toBe(true);
    expect(isSafeSalesforceFieldPath("Name FROM Account")).toBe(false);
    expect(escapeSalesforceSoqlLikePrefix("'")).toBe("\\'");
    expect(escapeSalesforceSoqlLikePrefix('\\')).toBe('\\\\');
    expect(escapeSalesforceSoqlLikePrefix('%_')).toBe('\\%\\_');
  });

  it('retrieves a result that crosses the Salesforce 2,000-record page boundary', async () => {
    const batches = [
      { records: Array.from({ length: 2_000 }, (_, id) => ({ id })), done: false, nextRecordsUrl: '/services/data/v59.0/query/next-1' },
      { records: [{ id: 2_000 }], done: true },
    ];
    const fetchImpl = (async () => page(batches.shift())) as typeof fetch;

    const records = await fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl });

    expect(records).toHaveLength(2_001);
    expect(records.at(-1)).toEqual({ id: 2_000 });
  });

  it('retrieves every page and accepts an exactly-at-limit result', async () => {
    const batches = [
      { records: Array.from({ length: 2_000 }, (_, id) => ({ id })), done: false, nextRecordsUrl: '/services/data/v59.0/query/next-1' },
      { records: Array.from({ length: 2_000 }, (_, id) => ({ id: id + 2_000 })), done: false, nextRecordsUrl: '/services/data/v59.0/query/next-2' },
      { records: Array.from({ length: 1_000 }, (_, id) => ({ id: id + 4_000 })), done: true },
    ];
    const fetchImpl = (async () => page(batches.shift())) as typeof fetch;

    const records = await fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl });

    expect(records).toHaveLength(5_000);
    expect(batches).toHaveLength(0);
  });

  it('rejects results above the safe record limit', async () => {
    const fetchImpl = (async () => page({ records: Array.from({ length: 5_001 }, (_, id) => ({ id })), done: true })) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl }))
      .rejects.toMatchObject({ code: SALESFORCE_RESULT_LIMIT_ERROR_CODE });
  });

  it('fails closed when Salesforce reports incomplete results without a locator', async () => {
    const fetchImpl = (async () => page({ records: [{ id: 1 }], done: false })) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl }))
      .rejects.toMatchObject({ code: SALESFORCE_PAGINATION_ERROR_CODE });
  });

  it('fails the complete query when a later page request fails', async () => {
    let calls = 0;
    const fetchImpl = (async () => {
      calls += 1;
      return calls === 1
        ? page({ records: [{ id: 1 }], done: false, nextRecordsUrl: '/next' })
        : page([{ message: 'query locator expired' }], 404);
    }) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl }))
      .rejects.toMatchObject({ code: 'SALESFORCE_QUERY_FAILED', status: 404 });
    expect(calls).toBe(2);
  });

  it('rejects a repeated query locator', async () => {
    const repeated = '/services/data/v59.0/query/repeated';
    const fetchImpl = (async (url: any) => page({ records: [{ id: String(url) }], done: false, nextRecordsUrl: repeated })) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl }))
      .rejects.toMatchObject({ code: SALESFORCE_PAGINATION_ERROR_CODE });
  });

  it('rejects a continuation after the final safe page', async () => {
    const fetchImpl = (async () => page({ records: [{ id: 1 }], done: false, nextRecordsUrl: '/next' })) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl, maxPages: 1 }))
      .rejects.toMatchObject({ code: SALESFORCE_PAGINATION_ERROR_CODE });
  });

  it('rejects a query locator for a different host', async () => {
    const fetchImpl = (async () => page({ records: [{ id: 1 }], done: false, nextRecordsUrl: 'https://attacker.example/next' })) as typeof fetch;

    await expect(fetchCompleteSalesforceQuery({ initialUrl, instanceUrl, accessToken: 'token', fetchImpl }))
      .rejects.toMatchObject({ code: SALESFORCE_PAGINATION_ERROR_CODE });
  });

  it('uses complete bounded queries for preview and save before any revenue mutation', () => {
    const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');
    const previewStart = routes.indexOf('// Salesforce Opportunity preview (before processing revenue metrics)');
    const saveStart = routes.indexOf('app.post("/api/campaigns/:id/salesforce/save-mappings"');
    const pipelineStart = routes.indexOf('// Salesforce pipeline proxy status', saveStart);
    const previewRoute = routes.slice(previewStart, saveStart);
    const saveRoute = routes.slice(saveStart, pipelineStart);

    expect(previewRoute).toContain('fetchCompleteSalesforceQuery({');
    expect(saveRoute).toContain('fetchCompleteSalesforceQuery({');
    expect(previewRoute).not.toContain('`LIMIT 2000`;');
    expect(saveRoute.slice(0, saveRoute.indexOf('const fetched = await fetchOppRecords(true);'))).not.toContain('`LIMIT 2000`;');
    expect(saveRoute.indexOf('const fetched = await fetchOppRecords(true);')).toBeLessThan(saveRoute.indexOf('await storage.replaceGa4SalesforceRevenueSourceWithRecords'));
  });

  it('uses complete bounded fallback scans for Salesforce campaign choices', () => {
    const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');
    const uniqueValuesStart = routes.indexOf('// Salesforce Opportunity unique values for a field');
    const previewStart = routes.indexOf('// Salesforce Opportunity preview', uniqueValuesStart);
    const uniqueValuesRoute = routes.slice(uniqueValuesStart, previewStart);

    expect(uniqueValuesRoute.match(/fetchCompleteSalesforceQuery\(\{/g)).toHaveLength(2);
    expect(uniqueValuesRoute).not.toContain('LIMIT 2000');
    expect(uniqueValuesRoute).not.toContain('nextRecordsUrl');
    expect(uniqueValuesRoute).toContain('boundedQueryFailure ? 413 : Number(error?.status || 500)');
    expect(uniqueValuesRoute.match(/\$\{searchClause\}/g)).toHaveLength(4);
    expect(uniqueValuesRoute).toContain("search.length < 2 || search.length > MAX_SALESFORCE_VALUE_SEARCH_LENGTH");
    expect(uniqueValuesRoute).toContain("escapeSalesforceSoqlLikePrefix(search)}%'");
  });

  it('keeps Salesforce selections within the save API limit', () => {
    const wizard = readFileSync(join(process.cwd(), 'client', 'src', 'components', 'SalesforceRevenueWizard.tsx'), 'utf8');

    expect(wizard).toContain('const MAX_SALESFORCE_SELECTED_VALUES = 200;');
    expect(wizard).toContain('disabled={valuesLoading || (!checked && selectedValues.length >= MAX_SALESFORCE_SELECTED_VALUES)}');
    expect(wizard).toContain('prev.includes(value) || prev.length >= MAX_SALESFORCE_SELECTED_VALUES');
    expect(wizard).toContain('selectedValues.length === 0 || selectedValues.length > MAX_SALESFORCE_SELECTED_VALUES');
  });

  it('wires bounded prefix search without dropping selected Salesforce values', () => {
    const wizard = readFileSync(join(process.cwd(), 'client', 'src', 'components', 'SalesforceRevenueWizard.tsx'), 'utf8');

    expect(wizard).toContain('const MAX_SALESFORCE_VALUE_SEARCH_LENGTH = 80;');
    expect(wizard).toContain('`&search=${encodeURIComponent(normalizedSearch)}`');
    expect(wizard).toContain('Search matches the beginning of a Salesforce value.');
    expect(wizard).toContain('const missing = selectedValues.filter((v) => v && !allowed.has(String(v)));');
    expect(wizard).not.toContain('prev.filter((v) => allowed.has(v))');
    expect(wizard).toContain('valuesLoading && uniqueValues.length === 0');
    expect(wizard).toContain('fetchUniqueValues(campaignField, valueSearch)');
  });

  it('uses complete bounded Pipeline Proxy totals while keeping preview rows sampled', () => {
    const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');
    const wizard = readFileSync(join(process.cwd(), 'client', 'src', 'components', 'SalesforceRevenueWizard.tsx'), 'utf8');
    const previewStart = routes.indexOf('// Salesforce Opportunity preview (before processing revenue metrics)');
    const saveStart = routes.indexOf('app.post("/api/campaigns/:id/salesforce/save-mappings"');
    const pipelineStart = routes.indexOf('// Salesforce pipeline proxy status', saveStart);
    const hubspotStart = routes.indexOf('// HubSpot deals properties', pipelineStart);
    const previewRoute = routes.slice(previewStart, saveStart);
    const saveRoute = routes.slice(saveStart, pipelineStart);
    const pipelineRoute = routes.slice(pipelineStart, hubspotStart);
    const savePipeline = saveRoute.slice(
      saveRoute.indexOf('// Best-effort: compute an exec-facing pipeline proxy'),
      saveRoute.indexOf('pipelineProxyFields = {'),
    );

    expect(previewRoute).toContain('const pipelineTotalToDate = pRecords.reduce');
    expect(previewRoute).toContain('pRecords.slice(0, rowLimit)');
    expect(previewRoute).toContain('totalRecordCount: pRecords.length');
    expect(previewRoute).toContain('totalToDate: Number(pipelineTotalToDate.toFixed(2))');
    expect(savePipeline).toContain('fetchCompleteSalesforceQuery({');
    expect(savePipeline).not.toContain('LIMIT 2000');
    expect(pipelineRoute.match(/fetchCompleteSalesforceQuery\(\{/g)).toHaveLength(2);
    expect(pipelineRoute).not.toContain('LIMIT 2000');
    expect(pipelineRoute).not.toContain('nextRecordsUrl');
    expect(pipelineRoute).toContain('const pipelineSelected = Array.from(new Set(selected));');
    expect(pipelineRoute).not.toContain('runStageScan');
    expect(pipelineRoute).not.toContain('matchSelectedCampaignValue');

    expect(wizard).toContain('setPipelinePreviewTotalToDate(Number.isFinite(Number(pp?.totalToDate)) ? Number(pp.totalToDate) : null)');
    expect(wizard).toContain('previewKey === reviewPreviewKey && pipelinePreviewTotalToDate != null');
    expect(wizard).toContain('pipelinePreviewError !== null || pipelinePreviewTotalToDate === null');
    expect(wizard).toContain('{pipelinePreviewError && <div className="text-sm text-red-600">{pipelinePreviewError}</div>}');
    expect(wizard).not.toContain('pipelinePreviewRows.reduce');
  });

  it('keeps on-demand confirmed revenue recovery aligned with the saved won rule', () => {
    const routes = readFileSync(join(process.cwd(), 'server', 'routes-oauth.ts'), 'utf8');
    const pipelineStart = routes.indexOf('// Salesforce pipeline proxy status');
    const hubspotStart = routes.indexOf('// HubSpot deals properties', pipelineStart);
    const pipelineRoute = routes.slice(pipelineStart, hubspotStart);

    expect(pipelineRoute).toContain("const confirmedWonClause = `(IsWon = true OR StageName LIKE 'Closed Won%')`;");
    expect(pipelineRoute).toContain('`WHERE ${confirmedWonClause} AND ${dateField} = LAST_N_DAYS:${days} AND ${attribField} IN (${confirmedQuoted})`;');
    expect(pipelineRoute).not.toContain('`WHERE IsWon = true AND ${dateField}');
  });
});
