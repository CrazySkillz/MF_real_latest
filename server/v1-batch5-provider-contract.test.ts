import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';
import { z } from 'zod';
import * as hubspotPagination from './utils/hubspot-pagination';
import * as hubspotCurrency from './utils/hubspot-currency';
import { normalizeStrictUtcDateKey } from './utils/data-transformation';
import { fetchCompleteSalesforceQuery } from './utils/salesforce-pagination';
import { getShopifyConfirmedRevenueAmounts } from './utils/shopify-revenue';
import { getShopifyApiVersion } from './utils/shopify-provider';
import * as salesforceQuery from './utils/salesforce-query';
import { detectSalesforceCurrency, validateSalesforceRevenueCurrency } from './utils/salesforceCurrency';

// Execute the actual centralized handler with isolated provider/storage boundaries.
const source = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map<string, string>();
let route = '';
let salesforceRoute = '';
const proxyRoutes = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) named.set(node.name.text, node.getText(source));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) named.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.post' && node.arguments[0]?.getText(source) === '"/api/campaigns/:id/hubspot/save-mappings"') route = node.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.post' && node.arguments[0]?.getText(source) === '"/api/campaigns/:id/salesforce/save-mappings"') salesforceRoute = node.getText(source);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text.endsWith('/pipeline-proxy')) proxyRoutes.set(node.arguments[0].text, node.getText(source));
  ts.forEachChild(node, visit);
}
visit(source);
const transpile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const bind = (code: string, env: any, result = '') => new Function(...Object.keys(env), `${transpile(code)}\n${result}`)(...Object.values(env));
const definitionNames = ['zHubSpotRevenuePlatformContext', 'zSalesforceRevenuePlatformContext', 'zValueSource', 'zNumberLike', 'zSelectedValues', 'deriveDefaultClosedWonStageIds', 'isGA4RevenuePlatformContext'];
const definitions = bind(definitionNames.map(n => named.get(n)).join('\n'), { z, MAX_SELECTED_VALUES: 200 }, `return {${definitionNames.join(',')}}`);
const deal = (amount: any, id = 'deal-1') => ({ id, properties: { campaign: 'selected', amount, closedate: '2026-10-18', hs_currency: 'USD', dealstage: 'closedwon' } });
const page = (results: any[], total = results.length, after?: string) => ({ total, results, ...(after ? { paging: { next: { after } } } : {}) });

export async function runHubspotSave(pages: any[], options: any = {}) {
  let handler: any, writes: any[] = [], queries: any[] = [];
  const fetchFixture = async (url: string, init: any) => {
    if (url.includes('/pipelines/')) return { ok: options.pipelineOk !== false, json: async () => options.metadata ?? { results: [{ stages: [{ id: 'closedwon', metadata: { isClosed: true, probability: '1.0' } }, { id: 'open-stage', metadata: { isClosed: false, probability: '0.3' } }] }] } };
    if (url.includes('/account-info/')) return { ok: !!options.accountCurrency, json: async () => ({ companyCurrency: options.accountCurrency }) };
    queries.push(JSON.parse(init.body));
    return { ok: true, json: async () => pages.shift() };
  };
  const env: any = {
    z, ...definitions, ...hubspotPagination, ...hubspotCurrency, normalizeStrictUtcDateKey,
    ...salesforceQuery, fetchCompleteSalesforceQuery, validateSalesforceRevenueCurrency,
    SALESFORCE_PAGINATION_ERROR_CODE: 'SALESFORCE_PAGINATION_INCOMPLETE', SALESFORCE_RESULT_LIMIT_ERROR_CODE: 'SALESFORCE_TOO_MANY_RESULTS',
    detectSalesforceCurrency: async (args: any) => args.requireSingleCurrency ? detectSalesforceCurrency(args) : ({ detectedCurrencies: ['USD'] }), yesterdayUTC: () => '2026-10-22',
    getSalesforceAccessTokenForCampaign: async () => ({ accessToken: 'fixture', instanceUrl: 'https://fixture.salesforce.com', fetchImpl: options.sfFetch ?? (async () => ({ ok: true, json: async () => pages.shift() ?? { records: [] } })) }),
    MAX_HUBSPOT_RESULTS: 5000, MAX_CRM_REVIEW_BREAKDOWN_ROWS: 200,
    app: { post: (...args: any[]) => { handler = args.at(-1); } }, importRateLimiter() {}, requireCampaignAccessParamId() {},
    getInternalGA4RefreshWriteInput: () => ({}), ensureCampaignAccess: async () => true,
    sendBadRequest: () => { throw Error('Invalid fixture request'); }, getHubspotAccessTokenForCampaign: async () => ({ accessToken: 'fixture' }),
    fetch: fetchFixture, fetchWithTimeout: fetchFixture, googleAdsCampaignIdFromValueOrMapping: () => null, recomputeCampaignDerivedValues: options.recompute ?? (async () => {}),
    storage: options.storage ?? { getCampaign: async () => ({ id: 'fixture', currency: options.campaignCurrency ?? 'USD' }), getHubspotConnection: async () => ({ id: 'fixture-connection' }), getSalesforceConnection: async () => ({ id: 'fixture-connection' }), getRevenueSources: async () => [], replaceGa4HubspotRevenueSourceWithRecords: async (...args: any[]) => { writes.push(args); return { id: 'fixture-source' }; }, replaceGa4SalesforceRevenueSourceWithRecords: async (...args: any[]) => { writes.push(args); return { id: 'fixture-source' }; } },
    console: { error() {}, warn() {} },
  };
  for (const name of ['parseCrmRevenueAmount', 'hubspotSearchDeals', 'fetchOpenSalesforceOpportunityStages']) if (named.has(name)) env[name] = bind(named.get(name)!, env, `return ${name}`);
  bind(options.provider === 'salesforce' ? salesforceRoute : route, env);
  const res: any = { statusCode: 200, status(n: number) { this.statusCode = n; return this; }, json(value: any) { this.payload = value; return this; } };
  await handler({ params: { id: 'fixture' }, body: { campaignProperty: 'campaign', campaignField: 'Campaign__c', selectedValues: ['selected'], platformContext: 'ga4', ...options.body } }, res);
  return { res, writes, queries };
}

describe('Batch 5 HubSpot actual save contract', () => {
  it.each(['12oops', 'not available', '', '1,234.50', '$10', true, {}, null])('rejects malformed money %j without publishing', async amount => {
    const { res, writes } = await runHubspotSave([page([deal(amount)])]);
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(writes).toEqual([]);
  });
  it.each([{}, { total: 1 }, { results: [] }, { total: 1, results: [] }, { total: 0, results: null }])('rejects incomplete success %j without publishing', async payload => {
    const { res, writes } = await runHubspotSave([payload]);
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(writes).toEqual([]);
  });
  it.each([false, true])('rejects repeated identity; conflicting=%s', async conflict => {
    const { res, writes } = await runHubspotSave([page([deal('10')], 2, 'next'), page([deal(conflict ? '20' : '10')], 2)]);
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(writes).toEqual([]);
  });
  it.each(['0', '12.75', '-2.50'])('preserves valid decimal money %s', async amount => {
    const { res, writes } = await runHubspotSave([page([deal(amount)])]);
    expect(res.statusCode).toBe(200); expect(res.payload.totalRevenue).toBe(Number(amount)); expect(writes).toHaveLength(1);
  });
  it('publishes an explicitly complete empty result as zero', async () => {
    const { res, writes } = await runHubspotSave([page([])]);
    expect(res.statusCode).toBe(200); expect(res.payload.totalRevenue).toBe(0); expect(writes).toHaveLength(1);
  });
  it('publishes unique results across pages once', async () => {
    const { res } = await runHubspotSave([page([deal('10')], 2, 'next'), page([deal('2.75', 'deal-2')], 2)]);
    expect(res.statusCode).toBe(200); expect(res.payload.totalRevenue).toBe(12.75);
  });
  it.each([{ body: { stageIds: ['open-stage'] } }, { pipelineOk: false }, { metadata: {} }, { metadata: { results: [{ stages: [{ id: 'closedwon', label: 'Closed Won', metadata: { isClosed: false, probability: '0.3' } }] }] } }])('requires verified closed-won metadata %j', async options => {
    const { res, writes } = await runHubspotSave([page([deal('10')])], options);
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(writes).toEqual([]);
  });
});

const pipelineDeal = (amount: number, code: string | null = 'EUR', id = 'open-1') => ({ id,
  properties: { campaign: 'selected', amount: String(amount), dealstage: 'open-stage', hs_currency: null, deal_currency_code: code } });
const currencyBody = { pipelineEnabled: true, pipelineStageId: 'open-stage', pipelineStageLabel: 'Contract Sent' };
async function readHubspotCurrencyProxy(pages: any[], change: any = {}, options: any = {}) {
  let handler: any; const writes: any[] = [], queries: any[] = [], accountReads: string[] = [];
  const cfg = { platformContext: 'ga4', campaignProperty: 'campaign', revenueProperty: 'amount', selectedValues: ['selected'],
    pipelineEnabled: true, pipelineStageId: 'open-stage', pipelineStageLabel: 'Contract Sent', pipelineProxyMode: 'current_stage',
    pipelineTotalToDate: 3200, pipelineCurrency: null, pipelineLastUpdatedAt: '2026-10-23T21:00:00Z',
    pipelineValueRevenueTotals: [{ campaignValue: 'selected', revenue: 3200 }], lastTotalRevenue: 0, ...change };
  const fetchImpl = async (url: string, init: any) => {
    if (url.includes('/account-info/')) { accountReads.push(url); return { ok: !!options.accountCurrency, json: async () => ({ companyCurrency: options.accountCurrency }) }; }
    queries.push(JSON.parse(init.body));
    return { ok: options.providerOk !== false, status: options.providerOk === false ? 503 : 200, json: async () => pages.shift() };
  };
  const env: any = { ...definitions, ...hubspotPagination, ...hubspotCurrency, MAX_HUBSPOT_RESULTS: 5000,
    app: { get: (...args: any[]) => { handler = args.at(-1); } }, ensureCampaignAccess: async () => options.access !== false,
    getGA4CampaignFilterValues: () => ['selected'], getHubspotAccessTokenForCampaign: async () => ({ accessToken: 'fixture' }),
    fetch: fetchImpl, fetchWithTimeout: fetchImpl, console: { error() {} },
    storage: options.storage ?? { getCampaign: async () => ({ currency: 'EUR', ga4CampaignFilter: 'selected' }),
      getHubspotConnection: async () => ({ id: 'connection', mappingConfig: JSON.stringify(cfg) }),
      getRevenueSources: async () => [{ id: 'source', sourceType: 'hubspot', mappingConfig: JSON.stringify(cfg) }],
      updateHubspotConnection: async (...args: any[]) => writes.push(['connection', ...args]),
      updateRevenueSource: async (...args: any[]) => writes.push(['source', ...args]) } };
  for (const name of ['parseCrmRevenueAmount', 'hubspotSearchDeals']) env[name] = bind(named.get(name)!, env, `return ${name}`);
  bind(proxyRoutes.get('/api/hubspot/:campaignId/pipeline-proxy')!, env);
  const res: any = { statusCode: 200, setHeader() {}, status(n: number) { this.statusCode = n; return this; }, json(value: any) { this.payload = value; return this; } };
  await handler({ params: { campaignId: 'fixture' }, query: { platformContext: 'ga4' } }, res);
  return { res, writes, queries, accountReads };
}
describe('HubSpot Pipeline Proxy currency regression', () => {
  it.each([null, 'USD'])('recovers the existing %s currency cache using exact selected deals', async pipelineCurrency => {
    const {res,writes,queries,accountReads} = await readHubspotCurrencyProxy([page([pipelineDeal(200),pipelineDeal(3000,'EUR','open-2')])],{pipelineCurrency});
    expect(res.statusCode,JSON.stringify(res.payload)).toBe(200);
    expect(res.payload).toMatchObject({currency:'EUR',totalToDate:3200,sourceId:'source',warning:null,pipelineValueRevenueTotals:[{campaignValue:'selected',revenue:3200}]});
    expect(queries).toHaveLength(1);expect(queries[0].properties).toContain('deal_currency_code');
    expect(queries[0].filterGroups[0].filters).toEqual([{propertyName:'campaign',operator:'IN',values:['selected']},{propertyName:'dealstage',operator:'IN',values:['open-stage']}]);
    expect(writes).toHaveLength(1);expect(writes[0][0]).toBe('source');for(const write of writes)expect(JSON.parse(write[2].mappingConfig)).toMatchObject({pipelineCurrency:'EUR',pipelineTotalToDate:3200,lastTotalRevenue:0});
    expect(accountReads).toHaveLength(0);
  });
  it.each([false,true])('uses provider deal currency in save and preview (preview=%s)', async previewOnly => {
    const {res,writes,queries}=await runHubspotSave([page([]),page([pipelineDeal(200),pipelineDeal(3000,'EUR','open-2')])],{body:{...currencyBody,previewOnly},storage:undefined});
    // Default save harness campaign is USD; actual EUR mismatch must fail before publishing.
    expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(writes).toEqual([]);expect(queries[1].properties).toContain('deal_currency_code');
  });
  it.each([false,true])('preserves EUR3200 and zero confirmed revenue in preview/save (preview=%s)',async previewOnly=>{
    const {res,writes,queries}=await runHubspotSave([page([]),page([pipelineDeal(200),pipelineDeal(3000,'EUR','open-2')])],{campaignCurrency:'EUR',body:{...currencyBody,previewOnly}});
    expect(res.statusCode,JSON.stringify(res.payload)).toBe(200);expect(res.payload.totalRevenue).toBe(0);
    if(previewOnly){expect(res.payload).toMatchObject({currency:'EUR',pipelinePreviewTotal:3200});expect(writes).toEqual([]);}else expect(writes).toHaveLength(1);
    expect(queries[1].properties).toContain('deal_currency_code');
  });
  it.each([false,true])('rejects incomplete, mixed and unknown preview/save currencies (preview=%s)',async previewOnly=>{
    for(const code of [null,'USD']){const {res,writes}=await runHubspotSave([page([]),page([pipelineDeal(200),pipelineDeal(3000,code,'open-2')])],{campaignCurrency:'EUR',body:{...currencyBody,previewOnly}});expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(writes).toEqual([]);}
  });
  it.each(['USD','GBP'])('dynamically respects %s campaign currency and explicit native currency',async currency=>{
    const row=pipelineDeal(12.75,currency);row.properties.hs_currency='EUR' as any;
    const {res}=await runHubspotSave([page([]),page([row])],{campaignCurrency:currency,body:{...currencyBody,previewOnly:true}});
    expect(res.payload).toMatchObject({success:true,currency,pipelinePreviewTotal:12.75});
  });
  it('retains legacy hs_currency and a complete empty provider result',async()=>{
    const row=pipelineDeal(12.75,null);row.properties.hs_currency='EUR' as any;
    const legacy=await readHubspotCurrencyProxy([page([row])]);expect(legacy.res.payload).toMatchObject({currency:'EUR',totalToDate:12.75});
    const zero=await readHubspotCurrencyProxy([page([])]);expect(zero.res.payload).toMatchObject({currency:null,totalToDate:0,pipelineValueRevenueTotals:[]});expect(zero.accountReads).toEqual([]);
  });
  it('reads native currency for confirmed revenue as well as the proxy',async()=>{
    const row={...pipelineDeal(25),properties:{...pipelineDeal(25).properties,dealstage:'closedwon',closedate:'2026-10-18'}};
    const {res,queries}=await runHubspotSave([page([row])],{campaignCurrency:'EUR'});expect(res.statusCode,JSON.stringify(res.payload)).toBe(200);expect(res.payload.totalRevenue).toBe(25);expect(queries[0].properties).toContain('deal_currency_code');
  });
  it('recovers complete paginated amounts and retains the source on a truncated next page',async()=>{
    const recovered=await readHubspotCurrencyProxy([page([pipelineDeal(200)],2,'next'),page([pipelineDeal(3000,'EUR','open-2')],2)]);
    expect(recovered.res.payload).toMatchObject({currency:'EUR',totalToDate:3200});expect(recovered.queries).toHaveLength(2);
    const failed=await readHubspotCurrencyProxy([page([pipelineDeal(200)],2,'next'),{total:2}]);expect(failed.res.statusCode).toBeGreaterThanOrEqual(400);expect(failed.writes).toEqual([]);
  });
  it.each([null,'GBP'])('retains saved data if matching deal currency cannot be verified: %s',async code=>{
    const {res,writes}=await readHubspotCurrencyProxy([page([pipelineDeal(3200,code)])]);
    expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(writes).toEqual([]);
  });
  it('rejects mixed currencies and a partial missing-currency response without overwriting the cache',async()=>{
    for(const code of ['USD',null]){const {res,writes}=await readHubspotCurrencyProxy([page([pipelineDeal(200),pipelineDeal(3000,code,'open-2')])]);expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(writes).toEqual([]);}
  });
  it('uses verified account currency only when selected deal currency is absent',async()=>{
    const {res,accountReads,writes}=await readHubspotCurrencyProxy([page([pipelineDeal(3200,null)])],{},{accountCurrency:'EUR'});
    expect(res.payload).toMatchObject({currency:'EUR',totalToDate:3200});expect(accountReads).toHaveLength(1);expect(writes).toHaveLength(1);expect(writes[0][0]).toBe('source');
  });
  it('keeps verified currency caches and complete zero without provider calls',async()=>{
    for(const change of [{pipelineCurrency:'EUR'},{pipelineCurrency:' eur '},{pipelineTotalToDate:0,pipelineValueRevenueTotals:[]}]){
      const {res,writes,queries}=await readHubspotCurrencyProxy([],change);expect(res.statusCode).toBe(200);if(change.pipelineCurrency)expect(res.payload.currency).toBe('EUR');expect(writes).toEqual([]);expect(queries).toEqual([]);
    }
  });
  it('does not use a missing-currency cached amount after provider failure or bypass access checks',async()=>{
    const failed=await readHubspotCurrencyProxy([],{},{providerOk:false});expect(failed.res.statusCode).toBe(503);expect(failed.writes).toEqual([]);
    const denied=await readHubspotCurrencyProxy([],{},{access:false});expect(denied.queries).toEqual([]);expect(denied.writes).toEqual([]);expect(denied.res.payload).toBeUndefined();
  });
});

const sf = (pages: any[]) => fetchCompleteSalesforceQuery({ initialUrl: 'https://fixture.salesforce.com/query', instanceUrl: 'https://fixture.salesforce.com', accessToken: 'fixture', fetchImpl: (async () => ({ ok: true, json: async () => pages.shift() })) as any });
describe('Batch 5 Salesforce complete result contract', () => {
  it.each(['12oops', 'not available', '', true, null, {}])('actual save rejects malformed money %j before publication', async amount => {
    const { res, writes } = await runHubspotSave([{ totalSize: 1, done: true, records: [{ Id: 'one', Amount: amount, Campaign__c: 'selected', CloseDate: '2026-10-18', CurrencyIsoCode: 'USD' }] }], { provider: 'salesforce' });
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(writes).toEqual([]);
  });
  it.each([0, 12.75])('actual save retains complete amount %s', async amount => {
    const { res, writes } = await runHubspotSave([{ totalSize: 1, done: true, records: [{ Id: 'one', Amount: amount, Campaign__c: 'selected', CloseDate: '2026-10-18', CurrencyIsoCode: 'USD' }] }], { provider: 'salesforce' });
    expect(res.statusCode).toBe(200); expect(res.payload.totalRevenue).toBe(amount); expect(writes).toHaveLength(1);
  });
  it.each([{}, { totalSize: 10, done: true, records: [] }, { totalSize: 0, records: [] }, { done: true, records: [] }, { totalSize: 1, done: true, records: [{}] }])('rejects incomplete payload %j', async payload => { await expect(sf([payload])).rejects.toThrow(); });
  it.each([false, true])('rejects duplicate ID; conflicting=%s', async conflict => {
    await expect(sf([{ totalSize: 2, done: false, records: [{ Id: 'same', Amount: 10 }], nextRecordsUrl: '/next' }, { totalSize: 2, done: true, records: [{ Id: 'same', Amount: conflict ? 20 : 10 }] }])).rejects.toThrow();
  });
  it('accepts complete zero', async () => { await expect(sf([{ totalSize: 0, done: true, records: [] }])).resolves.toEqual([]); });
  it('accepts complete unique records', async () => { await expect(sf([{ totalSize: 1, done: true, records: [{ Id: 'one', Amount: 0.75 }] }])).resolves.toEqual([{ Id: 'one', Amount: 0.75 }]); });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || '');
function salesforceCurrencyFixture(options: any = {}) {
  const calls: string[] = [];
  const fetchImpl = (async (url: string) => {
    calls.push(url);
    if (url.includes('/Soap/')) {
      if (options.soapThrows) throw Error('Currency provider unavailable');
      return { ok: options.soapOk !== false, status: options.soapOk === false ? 403 : 200, text: async () => `<s:Envelope><s:Body><getUserInfoResponse><result>${options.soap ?? '<organizationMultiCurrency>false</organizationMultiCurrency><orgDefaultCurrencyIsoCode>USD</orgDefaultCurrencyIsoCode>'}</result></getUserInfoResponse></s:Body></s:Envelope>` };
    }
    const query = new URL(url).searchParams.get('q') || '';
    if (query.includes('FROM OpportunityStage')) return { ok: true, status: 200, json: async () => ({ totalSize: 1, done: true, records: [{ Id: 'stage', MasterLabel: 'Open' }] }) };
    const pipeline = query.includes('IsClosed = false');
    if (pipeline && options.withCurrency !== true && query.includes('CurrencyIsoCode')) return { ok: false, status: 400, json: async () => [{ message: "No such column 'CurrencyIsoCode' on entity 'Opportunity'" }] };
    const records = pipeline ? (options.records ?? [{ Id: 'open', Campaign__c: 'selected', Amount: 12.75 }]) : [{ Id: 'won', Campaign__c: 'selected', Amount: 100, CloseDate: '2026-10-18', CurrencyIsoCode: 'USD' }];
    return { ok: true, status: 200, json: async () => ({ totalSize: records.length, done: true, records }) };
  }) as any;
  return { calls, fetchImpl };
}

async function readSalesforceCurrencyProxy(provider: ReturnType<typeof salesforceCurrencyFixture>, change: any = {}) {
  let handler: any; const writes: any[] = [];
  const cfg = { platformContext: 'ga4', campaignField: 'Campaign__c', selectedValues: ['selected'], pipelineEnabled: true, pipelineStageName: 'Open', pipelineProxyMode: 'current_stage', pipelineTotalToDate: 100, pipelineValueRevenueTotals: [{ campaignValue: 'selected', revenue: 100 }], pipelineLastUpdatedAt: '2026-10-23T12:00:00Z', pipelineCurrency: null, campaignValueRevenueTotals: [{ campaignValue: 'selected', revenue: 100 }], ...change };
  const env: any = { ...definitions, ...salesforceQuery, fetchCompleteSalesforceQuery, detectSalesforceCurrency, validateSalesforceRevenueCurrency,
    app: { get: (...args: any[]) => { handler = args.at(-1); } }, ensureCampaignAccess: async () => true, getGA4CampaignFilterValues: () => ['selected'],
    getSalesforceAccessTokenForCampaign: async () => ({ accessToken: 'fixture', instanceUrl: 'https://fixture.salesforce.com', fetchImpl: provider.fetchImpl }),
    storage: { getCampaign: async () => ({ ga4CampaignFilter: 'selected', currency: 'USD' }), getRevenueSources: async () => [{ id: 'source', sourceType: 'salesforce', mappingConfig: JSON.stringify(cfg) }],
      getSalesforceConnection: async () => ({ id: 'connection' }), updateRevenueSource: async (...args: any[]) => writes.push(['source', ...args]), updateSalesforceConnection: async (...args: any[]) => writes.push(['connection', ...args]) },
    console: { log() {}, warn() {}, error() {} },
  };
  env.parseCrmRevenueAmount = bind(named.get('parseCrmRevenueAmount')!, env, 'return parseCrmRevenueAmount');
  bind(proxyRoutes.get('/api/salesforce/:campaignId/pipeline-proxy')!, env);
  const res: any = { statusCode: 200, setHeader() {}, status(n: number) { this.statusCode = n; return this; }, json(v: any) { this.payload = v; return this; } };
  await handler({ params: { campaignId: 'fixture' }, query: { platformContext: 'ga4' } }, res);
  return { res, writes };
}

describe('Batch 5 Salesforce legacy pipeline currency recovery', () => {
  it.each([null, 'EUR'])('recomputes an incomplete or mismatched cache (%s) with verified currency', async pipelineCurrency => {
    const provider = salesforceCurrencyFixture(); const { res, writes } = await readSalesforceCurrencyProxy(provider, { pipelineCurrency, pipelineWarning: 'Earlier failure' });
    expect(res.statusCode, JSON.stringify(res.payload)).toBe(200); expect(res.payload).toMatchObject({ sourceId: 'source', currency: 'USD', totalToDate: 12.75, warning: null, pipelineValueRevenueTotals: [{ campaignValue: 'selected', revenue: 12.75 }] });
    expect(writes).toHaveLength(1); expect(writes[0][0]).toBe('source'); for (const write of writes) expect(JSON.parse(write[2].mappingConfig)).toMatchObject({ pipelineCurrency: 'USD', pipelineTotalToDate: 12.75 });
    expect(provider.calls.filter(url => url.includes('/Soap/'))).toHaveLength(1);
  });
  it('does not treat an otherwise complete missing-currency cache as usable', async () => {
    const provider = salesforceCurrencyFixture(); const { res } = await readSalesforceCurrencyProxy(provider);
    expect(res.payload).toMatchObject({ currency: 'USD', totalToDate: 12.75 }); expect(provider.calls.length).toBeGreaterThan(0);
  });
  it.each([
    { soapOk: false }, { soapThrows: true }, { soap: '<result/>' },
    { soap: '<Fault/><organizationMultiCurrency>false</organizationMultiCurrency><orgDefaultCurrencyIsoCode>USD</orgDefaultCurrencyIsoCode>' },
    { soap: '<organizationMultiCurrency>true</organizationMultiCurrency><orgDefaultCurrencyIsoCode>USD</orgDefaultCurrencyIsoCode><userDefaultCurrencyIsoCode>USD</userDefaultCurrencyIsoCode>' },
    { soap: '<organizationMultiCurrency>false</organizationMultiCurrency><orgDefaultCurrencyIsoCode>EUR</orgDefaultCurrencyIsoCode>' },
    { withCurrency: true, records: [{ Id: 'open', Campaign__c: 'selected', Amount: 12.75 }] },
    { withCurrency: true, records: [{ Id: 'open', Campaign__c: 'selected', Amount: 12.75, CurrencyIsoCode: 'EUR' }] },
  ])('preserves cached settings on unverified currency %j', async options => {
    const provider = salesforceCurrencyFixture(options); const { res, writes } = await readSalesforceCurrencyProxy(provider);
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(res.payload.success).toBe(false); expect(writes).toEqual([]);
  });
  it('keeps a valid cache without contacting Salesforce', async () => {
    const provider = salesforceCurrencyFixture({ soapThrows: true }); const { res, writes } = await readSalesforceCurrencyProxy(provider, { pipelineCurrency: 'USD' });
    expect(res.payload.totalToDate).toBe(100); expect(writes).toEqual([]); expect(provider.calls).toEqual([]);
  });
  it('preserves a complete empty result without guessing currency or requesting organization data', async () => {
    const provider = salesforceCurrencyFixture({ records: [] }); const { res } = await readSalesforceCurrencyProxy(provider);
    expect(res.payload).toMatchObject({ currency: null, totalToDate: 0, pipelineValueRevenueTotals: [] }); expect(provider.calls.some(url => url.includes('/Soap/'))).toBe(false);
  });
  it('uses per-record currency without organization fallback', async () => {
    const provider = salesforceCurrencyFixture({ withCurrency: true, records: [{ Id: 'open', Campaign__c: 'selected', Amount: 12.75, CurrencyIsoCode: 'USD' }] }); const { res } = await readSalesforceCurrencyProxy(provider);
    expect(res.payload).toMatchObject({ currency: 'USD', totalToDate: 12.75 }); expect(provider.calls.some(url => url.includes('/Soap/'))).toBe(false);
  });
});

if (testUrl && (new URL(testUrl).hostname !== '127.0.0.1' || new URL(testUrl).pathname !== '/ga4_alignment_test' || process.env.DATABASE_URL)) throw Error('Requires isolated local PostgreSQL');
describe.skipIf(!testUrl)('Batch 5 real PostgreSQL preservation and replacement', () => {
  const tables = [schema.clients, schema.campaigns, schema.ga4RefreshWork, schema.hubspotConnections, schema.salesforceConnections, schema.revenueSources, schema.revenueRecords, schema.metricSnapshots];
  const namespace = `batch5_${randomUUID().replace(/-/g, '')}`;
  const storage = new DatabaseStorage();
  let admin: Pool, pool: Pool, created = false;
  async function snapshot() { const state: any = {}; for (const table of tables) state[getTableName(table)] = (await pool.query(`SELECT * FROM "${getTableName(table)}" ORDER BY id`)).rows; return state; }
  async function seed(table: any, supplied: any) {
    const row = { ...supplied };
    for (const [key, col] of Object.entries(getTableColumns(table)) as [string, any][]) {
      if (row[key] !== undefined || !col.notNull || col.default !== undefined) continue;
      row[key] = col.dataType === 'date' ? new Date('2026-10-18T00:00:00Z') : col.dataType === 'boolean' ? true : col.dataType === 'number' ? 1 : col.dataType === 'json' ? {} : 'fixture';
    }
    await database.current.insert(table).values(row);
  }
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 }); await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 4 }); database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const cols = Object.values(getTableColumns(table)).map((col: any) => {
        const d = col.default; const value = d instanceof SQL ? dialect.sqlToQuery(d).sql : typeof d === 'string' ? `'${d.replace(/'/g, "''")}'` : String(d);
        return `"${col.name}" ${col.getSQLType()}${col.notNull ? ' NOT NULL' : ''}${d !== undefined ? ` DEFAULT ${value}` : ''}${col.primary ? ' PRIMARY KEY' : ''}`;
      }); await pool.query(`CREATE TABLE "${getTableName(table)}" (${cols.join(', ')})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    await seed(schema.clients, { id: 'client', ownerId: 'owner', name: 'Fixture' });
    for (const id of ['fixture', 'neighbor']) await seed(schema.campaigns, { id, clientId: 'client', ownerId: 'owner', currency: 'USD' });
    for (const provider of ['hubspot', 'salesforce']) {
      await seed(provider === 'hubspot' ? schema.hubspotConnections : schema.salesforceConnections, { id: `${provider}-connection`, campaignId: 'fixture', mappingConfig: '{}', isActive: true });
      for (const id of ['fixture', 'neighbor']) {
        await seed(schema.revenueSources, { id: `${provider}-${id}`, campaignId: id, sourceType: provider, platformContext: 'ga4', currency: 'USD', mappingConfig: '{}', isActive: true });
        await seed(schema.revenueRecords, { id: `${provider}-${id}-row`, campaignId: id, revenueSourceId: `${provider}-${id}`, sourceType: provider, currency: 'USD', revenue: '100.00', date: '2026-10-18' });
      }
    }
  });
  it.each(['recover','missing','mixed','failed'])('HubSpot persisted proxy currency %s preserves exact records and other campaigns',async mode=>{
    await pool.query("UPDATE campaigns SET currency='EUR' WHERE id='fixture'");
    const cfg={platformContext:'ga4',campaignProperty:'campaign',revenueProperty:'amount',selectedValues:['selected'],pipelineEnabled:true,pipelineStageId:'open-stage',pipelineStageLabel:'Contract Sent',pipelineProxyMode:'current_stage',pipelineTotalToDate:3200,pipelineCurrency:null,pipelineLastUpdatedAt:'2026-10-23T21:00:00Z',pipelineValueRevenueTotals:[{campaignValue:'selected',revenue:3200}],lastTotalRevenue:100};
    await pool.query("UPDATE revenue_sources SET mapping_config=$1 WHERE id='hubspot-fixture'",[JSON.stringify(cfg)]);
    await pool.query("UPDATE hubspot_connections SET mapping_config=$1 WHERE id='hubspot-connection'",[JSON.stringify(cfg)]);
    const before=await snapshot();
    const {res}=await readHubspotCurrencyProxy([page([pipelineDeal(200),pipelineDeal(3000,mode==='missing'?null:mode==='mixed'?'USD':'EUR','open-2')])],{},{storage,providerOk:mode!=='failed'});
    const after=await snapshot();
    if(mode!=='recover'){expect(res.statusCode).toBeGreaterThanOrEqual(400);expect(after).toEqual(before);return;}
    expect(res.statusCode,JSON.stringify(res.payload)).toBe(200);expect(res.payload).toMatchObject({sourceId:'hubspot-fixture',currency:'EUR',totalToDate:3200,warning:null});
    expect(after.revenue_records).toEqual(before.revenue_records);
    expect(after.revenue_sources.map((row:any)=>row.id)).toEqual(before.revenue_sources.map((row:any)=>row.id));
    expect(JSON.parse(after.revenue_sources.find((row:any)=>row.id==='hubspot-fixture').mapping_config)).toMatchObject({...cfg,pipelineCurrency:'EUR',pipelineLastUpdatedAt:expect.any(String)});
    for(const table of ['clients','campaigns','ga4_refresh_work','hubspot_connections','salesforce_connections','metric_snapshots'])expect(after[table]).toEqual(before[table]);
    expect(after.revenue_sources.filter((row:any)=>row.id!=='hubspot-fixture')).toEqual(before.revenue_sources.filter((row:any)=>row.id!=='hubspot-fixture'));
    const again=await readHubspotCurrencyProxy([],{},{storage});expect(again.res.payload).toMatchObject({currency:'EUR',totalToDate:3200});expect(again.queries).toEqual([]);expect(await snapshot()).toEqual(after);
  });
  it.each(['add', 'edit'])('HubSpot %s starts recovery after saving without synchronously publishing partial KPI values', async mode => {
    await pool.query("UPDATE campaigns SET currency='EUR' WHERE id='fixture'");
    await seed(schema.ga4RefreshWork, { id: 'completed', campaignId: 'fixture', ownerId: 'owner', status: 'completed',
      reportingDate: '2026-10-22', dueAt: new Date('2026-10-23T06:00:00Z'), completedAt: new Date('2026-10-23T06:10:00Z'), scope: {} });
    for (const id of ['fixture', 'neighbor']) await seed(schema.metricSnapshots, { id: `executive-${id}`, campaignId: id,
      snapshotType: 'executive_summary_daily', reportingDate: '2026-10-22', metrics: {}, notes: 'ga4_aligned_refresh_v1:2026-10-22:fixture' });
    const jobs = vi.fn().mockResolvedValue({ campaignsProcessed: 1, campaignIdsFailed: [], campaignIdsSkipped: [],
      kpiIdsSkipped: [], kpiIdsFailed: [], benchmarkIdsSkipped: [], benchmarkIdsFailed: [], alertReconciliationFailures: [] });
    const recovery = vi.fn().mockResolvedValue(undefined);
    const env: any = { storage, getReportingDateWindow: () => ({ endDate: '2026-10-22' }), runGA4DailyKPIAndBenchmarkJobs: jobs, recoverInterruptedGA4Refreshes: recovery,
      refreshCampaignCurrentValuesForCampaign: vi.fn().mockResolvedValue({}), isGA4RevenuePlatformContext: () => true,
      GA4_REVENUE_RECOMPUTE_RESPONSE_WAIT_MS: 15000, setTimeout, clearTimeout, console: { warn() {} } };
    env.recomputeGA4KPIAndBenchmarkValues = bind(named.get('recomputeGA4KPIAndBenchmarkValues')!, env, 'return recomputeGA4KPIAndBenchmarkValues');
    const recompute = bind(named.get('recomputeCampaignDerivedValues')!, env, 'return recomputeCampaignDerivedValues');
    const body = { ...(mode === 'edit' ? { sourceId: 'hubspot-fixture' } : {}), pipelineEnabled: true, pipelineStageId: 'open-stage', pipelineStageLabel: 'Contract Sent' };
    const run = () => runHubspotSave([page([]), page([200, 3000].map((amount, index) => ({ id: `open-${index}`,
      properties: { campaign: 'selected', amount: String(amount), dealstage: 'open-stage', hs_currency: null, deal_currency_code: 'EUR' } })))], { storage, recompute, body });
    const before = await snapshot();
    const { res } = await run();
    expect(res.statusCode, JSON.stringify(res.payload)).toBe(200);
    expect(res.payload).toMatchObject({ success: true, totalRevenue: 0 });
    const version = await storage.getGA4PublicationVersion('fixture');
    expect(version).not.toBeNull();
    expect(recovery).toHaveBeenCalledWith('fixture');
    expect(jobs).not.toHaveBeenCalled();
    const after = await snapshot();
    const selected = after.revenue_sources.filter((row: any) => row.campaign_id === 'fixture' && row.source_type === 'hubspot');
    expect(selected).toHaveLength(mode === 'add' ? 2 : 1);
    const saved = selected.find((row: any) => JSON.parse(row.mapping_config).pipelineEnabled);
    expect(JSON.parse(saved.mapping_config)).toMatchObject({ lastTotalRevenue: 0, pipelineTotalToDate: 3200, pipelineCurrency: 'EUR' });
    expect(after.revenue_records.filter((row: any) => row.revenue_source_id === saved.id).map((row: any) => Number(row.revenue))).toEqual([0]);
    expect(after.metric_snapshots.find((row: any) => row.id === 'executive-fixture').notes).toBeNull();
    for (const table of ['revenue_sources', 'revenue_records', 'metric_snapshots'])
      expect(after[table].filter((row: any) => row.campaign_id === 'neighbor')).toEqual(before[table].filter((row: any) => row.campaign_id === 'neighbor'));
    // An unchanged retry of the same selection reuses the saved source.
    const retried = await run(); expect(retried.res.statusCode, JSON.stringify(retried.res.payload)).toBe(200);
    expect((await snapshot()).revenue_sources.map((row: any) => row.id)).toEqual(after.revenue_sources.map((row: any) => row.id));
  });
  it.each([
    { soapOk: false }, { soapThrows: true }, { soap: '<organizationMultiCurrency>true</organizationMultiCurrency><orgDefaultCurrencyIsoCode>USD</orgDefaultCurrencyIsoCode>' },
    { soap: '<organizationMultiCurrency>false</organizationMultiCurrency><orgDefaultCurrencyIsoCode>EUR</orgDefaultCurrencyIsoCode>' },
    { withCurrency: true, records: [{ Id: 'open', Campaign__c: 'selected', Amount: 12.75 }] },
  ])('Salesforce pipeline currency failure preserves every stored row %j', async options => {
    const before = await snapshot(); const provider = salesforceCurrencyFixture(options);
    const { res } = await runHubspotSave([], { provider: 'salesforce', storage, sfFetch: provider.fetchImpl, body: { sourceId: 'salesforce-fixture', expectedSourceMappingConfig: '{}', pipelineEnabled: true, pipelineStageName: 'Open' } });
    expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(res.payload.error).toMatch(/currency|unavailable/i); expect(await snapshot()).toEqual(before);
  });
  it.each([0, 12.75])('Salesforce saves verified pipeline currency and %s without changing neighbors', async amount => {
    const before = await snapshot(); const provider = salesforceCurrencyFixture({ records: amount ? [{ Id: 'open', Campaign__c: 'selected', Amount: amount }] : [] });
    const { res } = await runHubspotSave([], { provider: 'salesforce', storage, sfFetch: provider.fetchImpl, body: { sourceId: 'salesforce-fixture', expectedSourceMappingConfig: '{}', pipelineEnabled: true, pipelineStageName: 'Open' } });
    expect(res.statusCode, JSON.stringify(res.payload)).toBe(200); const after = await snapshot();
    const config = JSON.parse(after.revenue_sources.find((r: any) => r.id === 'salesforce-fixture').mapping_config);
    expect(config).toMatchObject({ pipelineTotalToDate: amount, pipelineCurrency: amount ? 'USD' : null, pipelineWarning: null });
    expect(after.revenue_records.filter((r: any) => r.revenue_source_id !== 'salesforce-fixture')).toEqual(before.revenue_records.filter((r: any) => r.revenue_source_id !== 'salesforce-fixture'));
    expect(after.revenue_sources.filter((r: any) => r.id !== 'salesforce-fixture')).toEqual(before.revenue_sources.filter((r: any) => r.id !== 'salesforce-fixture'));
  });
  for (const provider of ['hubspot', 'salesforce']) {
    it.each(['malformed', 'incomplete', 'duplicate'])(`${provider} preserves every saved row on %s response`, async kind => {
      const record = provider === 'hubspot' ? deal(kind === 'malformed' ? '12oops' : '10') : { Id: 'one', Amount: kind === 'malformed' ? '12oops' : 10, Campaign__c: 'selected', CloseDate: '2026-10-18', CurrencyIsoCode: 'USD' };
      const records = kind === 'duplicate' ? [record, record] : [record];
      const payload = kind === 'incomplete' ? {} : provider === 'hubspot' ? page(records) : { totalSize: records.length, done: true, records };
      const before = await snapshot(); const { res } = await runHubspotSave([payload], { provider, storage, body: { sourceId: `${provider}-fixture`, expectedSourceMappingConfig: '{}' } });
      expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(await snapshot()).toEqual(before);
    });
    it.each([0, 12.75])(`${provider} atomically replaces only its selected source with %s`, async amount => {
      const payload = provider === 'hubspot' ? page(amount ? [deal(String(amount))] : []) : { totalSize: amount ? 1 : 0, done: true, records: amount ? [{ Id: 'one', Amount: amount, Campaign__c: 'selected', CloseDate: '2026-10-18', CurrencyIsoCode: 'USD' }] : [] };
      const before = await snapshot(); const { res } = await runHubspotSave([payload], { provider, storage, body: { sourceId: `${provider}-fixture`, expectedSourceMappingConfig: '{}' } });
      expect(res.statusCode, JSON.stringify(res.payload)).toBe(200);
      const after = await snapshot(); const selected = after.revenue_records.filter((r: any) => r.revenue_source_id === `${provider}-fixture`);
      expect(selected.reduce((sum: number, r: any) => sum + Number(r.revenue), 0)).toBe(amount);
      expect(after.revenue_records.filter((r: any) => r.revenue_source_id !== `${provider}-fixture`)).toEqual(before.revenue_records.filter((r: any) => r.revenue_source_id !== `${provider}-fixture`));
      expect(after.revenue_sources.map((r: any) => r.id)).toEqual(before.revenue_sources.map((r: any) => r.id));
    });
  }
});
describe('Batch 5 Shopify money and supported version', () => {
  it.each(['12oops', 'not available', true, {}, '1,234.00', '$12'])('rejects malformed money %j', amount => { expect(() => getShopifyConfirmedRevenueAmounts({ test: false, financial_status: 'paid', current_total_price: amount, currency: 'USD' })).toThrow(); });
  it('retains valid fractional money', () => { expect(getShopifyConfirmedRevenueAmounts({ test: false, financial_status: 'paid', current_total_price: '0.75', currency: 'USD' })?.shopAmount).toBe(0.75); });
  it('rejects malformed optional presentment money instead of manufacturing an amount', () => { expect(() => getShopifyConfirmedRevenueAmounts({ test: false, financial_status: 'paid', current_total_price_set: { shop_money: { amount: '10.00', currency_code: 'USD' }, presentment_money: { amount: '12oops', currency_code: 'EUR' } } })).toThrow(); });
  it('rejects retired 2025-10 and retains the validated default', () => { expect(() => getShopifyApiVersion('2025-10')).toThrow(); expect(getShopifyApiVersion()).toBe('2026-07'); });
});

describe.each(['hubspot', 'salesforce'])('Batch 5 %s proxy API cache boundary', provider => {
  async function readProxy(change: any) {
    let handler: any; const writes: any[] = [];
    const cfg = { platformContext: 'ga4', campaignProperty: 'campaign', campaignField: 'Campaign__c', selectedValues: ['selected'], pipelineEnabled: true, pipelineStageId: 'open', pipelineStageName: 'Open', pipelineProxyMode: 'current_stage', pipelineTotalToDate: 0, pipelineValueRevenueTotals: [], pipelineLastUpdatedAt: '2026-10-23T12:00:00Z', pipelineCurrency: 'USD', ...change };
    const env: any = { ...definitions, ...salesforceQuery, app: { get: (...args: any[]) => { handler = args.at(-1); } }, ensureCampaignAccess: async () => true,
      getGA4CampaignFilterValues: () => ['selected'], getHubspotAccessTokenForCampaign: async () => { throw Error('fixture provider unavailable'); }, getSalesforceAccessTokenForCampaign: async () => { throw Error('fixture provider unavailable'); },
      storage: { getCampaign: async () => ({ ga4CampaignFilter: 'selected', currency: 'USD' }), getRevenueSources: async () => [{ id: 'source', sourceType: provider, mappingConfig: JSON.stringify(cfg) }],
        getHubspotConnection: async () => ({}), getSalesforceConnection: async () => ({}), updateRevenueSource: async (...args: any[]) => writes.push(args), updateHubspotConnection: async (...args: any[]) => writes.push(args) },
      console: { log() {}, warn() {}, error() {} }, ...hubspotPagination,
    };
    bind(proxyRoutes.get(`/api/${provider}/:campaignId/pipeline-proxy`)!, env);
    const res: any = { statusCode: 200, setHeader() {}, status(n: number) { this.statusCode = n; return this; }, json(v: any) { this.payload = v; return this; } };
    await handler({ params: { campaignId: 'fixture' }, query: { platformContext: 'ga4' } }, res); return { res, writes };
  }
  it('returns a verified zero with exact source and freshness', async () => { const { res, writes } = await readProxy({}); expect(res.statusCode, JSON.stringify(res.payload)).toBe(200); expect(res.payload).toMatchObject({ sourceId: 'source', totalToDate: 0, pipelineValueRevenueTotals: [], lastUpdatedAt: '2026-10-23T12:00:00Z' }); expect(writes).toEqual([]); });
  it.each([{ pipelineTotalToDate: undefined }, { pipelineTotalToDate: 'bad' }, { pipelineWarning: 'Previous failure' }, { pipelineLastUpdatedAt: 'bad-date' }, { pipelineTotalToDate: 100, pipelineValueRevenueTotals: [] }])('does not publish stale or incomplete cache after provider failure %j', async change => { const { res, writes } = await readProxy(change); expect(res.statusCode).toBeGreaterThanOrEqual(400); expect(res.payload.success).toBe(false); expect(res.payload.error.toLowerCase()).toContain("unavailable"); expect(writes).toEqual([]); });
});
