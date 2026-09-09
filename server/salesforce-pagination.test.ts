import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, expect, it } from 'vitest';
import {
  fetchCompleteSalesforceQuery,
  SALESFORCE_PAGINATION_ERROR_CODE,
  SALESFORCE_RESULT_LIMIT_ERROR_CODE,
} from './utils/salesforce-pagination';

const instanceUrl = 'https://example.my.salesforce.com';
const initialUrl = `${instanceUrl}/services/data/v59.0/query?q=test`;

const page = (body: any, status = 200) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => body,
}) as any;

describe('Salesforce bounded query pagination', () => {
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
});
