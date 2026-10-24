import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
import * as provider from './utils/shopify-provider';
import * as revenue from './utils/shopify-revenue';
import * as refresh from './utils/shopify-refresh-state';
import { normalizeReportingTimeZone } from './utils/reporting-timezone';

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';

const ast = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const named = new Map<string, string>(), routes = new Map<string, string>();
function visit(node: ts.Node) {
  if (ts.isFunctionDeclaration(node) && node.name) named.set(node.name.text, node.getText(ast));
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name)) named.set(node.name.text, `const ${node.getText(ast)};`);
  if (ts.isCallExpression(node) && ['app.get', 'app.post'].includes(node.expression.getText(ast)) && ts.isStringLiteral(node.arguments[0])) routes.set(node.arguments[0].text, node.getText(ast));
  ts.forEachChild(node, visit);
}
visit(ast);
const bind = (code: string, env: any, result = '') => new Function(...Object.keys(env), ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText + '\n' + result)(...Object.values(env));
const order = (changes: any = {}) => ({ id: 1014, name: '#1014', created_at: '2026-09-28T10:00:00Z', updated_at: '2026-10-23T10:00:00Z',
  tags: 'campaign3_eur_test', landing_site: '/?utm_campaign=campaign3_eur_test', discount_codes: [{ code: 'campaign3_eur_test' }],
  financial_status: 'paid', test: false, cancelled_at: null, current_total_price: '785.95', currency: 'EUR', ...changes });
const campaign = { id: 'a', name: 'V1 Batch 5 Test', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: null, createdAt: new Date('2026-10-23T16:53:23.694Z') };
const defaultConnection = { id: 'shopify-a', campaignId: 'a', isActive: true, shopDomain: 'fixture.myshopify.com', accessToken: 'fixture',
  mappingConfig: JSON.stringify({ authType: 'oauth', grantedScopesList: ['read_orders'] }) };
const savePath = '/api/campaigns/:id/shopify/save-mappings';
const valuesPath = '/api/shopify/:campaignId/orders/unique-values';
const statusPath = '/api/shopify/:campaignId/status';

// Actual centralized handlers and pagination; only provider HTTP, auth/renewal and downstream orchestration are isolated.
function harness(options: any = {}) {
  const state: any = { sources: [], records: [], connection: { ...defaultConnection, ...options.connection }, orders: [order()], ...options.state };
  const queries: URL[] = [], writes: any[] = [];
  const storage = options.storage ?? {
    getCampaign: async () => ({ ...campaign, ...options.campaign }),
    getShopifyConnection: async () => state.connection,
    getRevenueSources: async (_id: string, context: string) => state.sources.filter((s: any) => s.campaignId === 'a' && s.platformContext === context),
    getRevenueSource: async (_id: string, id: string) => state.sources.find((s: any) => s.campaignId === 'a' && s.id === id),
    updateGa4ShopifyRevenueSourceRefreshState: async (_id: string, id: string, mappingConfig: string) => {
      const s = state.sources.find((s: any) => s.id === id); if (s) s.mappingConfig = mappingConfig; return s;
    },
    replaceGa4ShopifyRevenueSourceWithRecords: async (_id: string, id: string | null, _connectionId: string, mappingConfig: string, source: any, records: any[]) => {
      const saved = { ...source, id: id || 'shopify-source' }; writes.push({ saved, records });
      state.sources = [...state.sources.filter((s: any) => s.id !== saved.id), saved]; state.records = records;
      state.connection.mappingConfig = mappingConfig; return saved;
    },
  };
  const env: any = { ...provider, ...revenue, ...refresh, z, createHash, randomUUID, normalizeReportingTimeZone,
    MAX_SELECTED_VALUES: 200, storage, console: { error() {}, warn() {} }, devLog() {},
    importRateLimiter() {}, requireCampaignAccessParamId() {}, assertProductionTokenEncryptionConfigured() {},
    ensureCampaignAccess: async (_req: any, res: any) => { if (options.denied) { res.status(403).json({ error: 'Forbidden' }); return null; } return storage.getCampaign('a'); },
    getInternalGA4RefreshWriteInput: () => ({}), isInternalAutoRefreshRequest: (req: any) => req.scheduler === true,
    recomputeCampaignDerivedValues: vi.fn(async () => {}), isShopifyOauthAvailable: () => true,
    sendBadRequest: (res: any, error: string) => res.status(400).json({ error }),
    getShopifyConnectionForCampaign: async () => storage.getShopifyConnection('a'),
    isShopifyPartnerDevelopmentStore: async () => options.developmentStore === true,
    shopifyApiFetch: async () => ({ access_scopes: JSON.parse(state.connection.mappingConfig).grantedScopesList.map((handle: string) => ({ handle })) }),
    shopifyAdminFetch: async (args: any) => {
      const url = new URL(args.endpoint); queries.push(url);
      args.onResponse?.({ status: 200, attempt: 0 });
      if (options.providerFailure) return new Response(JSON.stringify({ errors: 'Fixture failure' }), { status: 503 });
      const start = url.searchParams.get('created_at_min') || queries[0].searchParams.get('created_at_min')!;
      const selected = state.orders.filter((o: any) => Date.parse(o.created_at) >= Date.parse(start));
      const paged = options.pages && !url.searchParams.has('page_info');
      const orders = options.pages ? (paged ? selected.slice(0, 1) : selected.slice(1)) : selected;
      return new Response(JSON.stringify(options.incomplete ? {} : { orders }), { status: 200, headers: paged ? { link: '<https://fixture.myshopify.com/admin/api/2026-07/orders.json?page_info=next>; rel="next"' } : {} });
    },
  };
  for (const name of ['zNumberLike', 'zSelectedValues', 'zShopifyRevenuePlatformContext', 'getShopifyConnectionOrderAccess',
    'getShopifyCampaignWindowStartAt', 'getShopifyCampaignOrderWindow', 'getShopifyOrderTags', 'shopifyFetchAllOrders', 'shopifyRequiresMerchantApproval', 'shopifyRequiresProtectedCustomerDataApproval']) {
    if (!named.has(name)) throw Error(`Missing actual fixture dependency: ${name}`);
    env[name] = bind(named.get(name)!, env, `return ${name}`);
  }
  async function call(path = savePath, body: any = {}, query: any = {}, scheduler = false) {
    let handler: any;
    bind(routes.get(path)!, { ...env, app: { get: (...args: any[]) => { handler = args.at(-1); }, post: (...args: any[]) => { handler = args.at(-1); } } });
    const res: any = { statusCode: 200, setHeader() {}, status(n: number) { this.statusCode = n; return this; }, json(payload: any) { this.payload = payload; return this; } };
    await handler({ params: { id: 'a', campaignId: 'a' }, body: { campaignField: 'tags', selectedValues: ['campaign3_eur_test'], platformContext: 'ga4', ...body }, query: { field: 'tags', platformContext: 'ga4', ...query }, scheduler }, res);
    return res;
  }
  return { call, state, queries, writes, storage };
}

beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-24T12:00:00Z')); });
afterEach(() => vi.useRealTimers());
describe('Shopify sale dates through real discovery, preview, save and scheduler handlers', () => {
  it.each(['tags', 'discount_code', 'utm_campaign'])('finds September 28 in an October 23 campaign by %s and saves it once', async field => {
    const h = harness();
    const status = await h.call(statusPath); expect(status.payload.orderWindow).toMatchObject({ eligible: true, campaignStart: '2026-08-26' });
    const values = await h.call(valuesPath, {}, { field }); expect(values.statusCode, JSON.stringify(values.payload)).toBe(200);
    expect(values.payload.values).toEqual([{ value: 'campaign3_eur_test', count: 1 }]);
    const preview = await h.call(savePath, { campaignField: field, dryRun: true });
    expect(preview.payload).toMatchObject({ success: true, totalRevenue: 785.95, currency: 'EUR' }); expect(h.writes).toEqual([]);
    const saved = await h.call(savePath, { campaignField: field });
    expect(saved.statusCode, JSON.stringify(saved.payload)).toBe(200); expect(saved.payload.totalRevenue).toBe(785.95);
    expect(h.state.records).toMatchObject([{ date: '2026-09-28', revenue: 785.95, currency: 'EUR', externalId: '1014' }]);
    expect(JSON.parse(h.state.sources[0].mappingConfig).earliestOrderCreatedAt).toBe('2026-09-28T10:00:00.000Z');
    expect(h.queries.every(url => url.searchParams.get('created_at_min') === '2026-08-26T00:00:00.000Z')).toBe(true);
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    const refreshed = await h.call(savePath, { sourceId: 'shopify-source', campaignField: field }, {}, true);
    expect(refreshed.statusCode, JSON.stringify(refreshed.payload)).toBe(200); expect(h.state.sources).toHaveLength(1); expect(h.state.records[0].revenue).toBe(785.95);
  });
  it('does not use campaign age for GA4, while preserving the non-GA4 campaign window', async () => {
    const h = harness({ campaign: { startDate: '2025-01-01' } });
    expect((await h.call(valuesPath)).payload.values).toHaveLength(1);
    expect((await h.call(valuesPath, {}, { platformContext: 'linkedin' })).statusCode).toBe(409);
    const current = harness(); await current.call(valuesPath, {}, { platformContext: 'linkedin' });
    expect(current.queries[0].searchParams.get('created_at_min')).toBe('2026-10-23T16:53:23.694Z');
  });
  it.each(['oauth', 'token'])('uses full history for %s with historical access', async authType => {
    const h = harness({ connection: { mappingConfig: JSON.stringify({ authType, grantedScopesList: ['read_orders', 'read_all_orders'] }) }, state: { orders: [order({ created_at: '2025-01-01T10:00:00Z' })] } });
    expect((await h.call(valuesPath)).payload.values).toHaveLength(1);
    expect((await h.call()).payload.totalRevenue).toBe(785.95);
    expect(h.state.records[0].date).toBe('2025-01-01');
  });
  it('preserves saved revenue when its oldest order ages out, then resumes with historical access', async () => {
    const h = harness(); await h.call(); const before = structuredClone(h.state.records);
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    for (const dryRun of [true, false]) {
      const result = await h.call(savePath, { sourceId: 'shopify-source', dryRun }, {}, !dryRun);
      expect(result.statusCode, JSON.stringify(result.payload)).toBe(409); expect(h.state.records).toEqual(before);
    }
    expect((await h.call(statusPath, {}, { sourceId: 'shopify-source' })).payload.orderWindow.eligible).toBe(false);
    expect(h.queries).toHaveLength(1);
    const config = JSON.parse(h.state.connection.mappingConfig); config.grantedScopesList.push('read_all_orders'); h.state.connection.mappingConfig = JSON.stringify(config);
    expect((await h.call(savePath, { sourceId: 'shopify-source' }, {}, true)).statusCode).toBe(200);
    expect(h.state.records).toEqual(before);
  });
  it('executes the actual scheduled reprocess with the saved mapping and stable source ID', async () => {
    const h = harness(); await h.call();
    const scheduler = ts.createSourceFile('scheduler.ts', readFileSync('server/auto-refresh-scheduler.ts', 'utf8'), ts.ScriptTarget.Latest, true);
    const definition = scheduler.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'reprocessShopify')!;
    const calls: any[] = [];
    const reprocess = bind(definition.getText(scheduler), {
      console: { log() {}, warn() {}, error() {} }, isStaleRevenueSourceReprocess: () => false,
      postJson: async (path: string, body: any) => { calls.push({ path, body }); const res = await h.call(savePath, body, {}, true); return { ok: res.statusCode === 200, status: res.statusCode, json: res.payload }; },
    }, 'return reprocessShopify');
    vi.setSystemTime(new Date('2026-10-25T12:00:00Z'));
    expect(await reprocess('a', JSON.parse(h.state.sources[0].mappingConfig), 'shopify-source')).toBe(true);
    expect(calls[0]).toMatchObject({ path: '/api/campaigns/a/shopify/save-mappings', body: { sourceId: 'shopify-source', campaignField: 'tags', selectedValues: ['campaign3_eur_test'], platformContext: 'ga4' } });
    expect(h.state.records[0].revenue).toBe(785.95); expect(h.state.sources).toHaveLength(1);
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    expect(await reprocess('a', JSON.parse(h.state.sources[0].mappingConfig), 'shopify-source')).toBe(false);
    expect(h.state.records[0].revenue).toBe(785.95);
  });
  it('retains the history boundary after a complete refund/zero match', async () => {
    const h = harness(); await h.call(); h.state.orders = [order({ financial_status: 'refunded' })];
    expect((await h.call(savePath, { sourceId: 'shopify-source' })).payload.totalRevenue).toBe(0);
    expect(JSON.parse(h.state.sources[0].mappingConfig).earliestOrderCreatedAt).toBe('2026-09-28T10:00:00.000Z');
  });
  it.each([{ providerFailure: true }, { incomplete: true }, { state: { orders: [order({ currency: 'USD' })] } }, { state: { orders: [order({ current_total_price: '785oops' })] } }])('fails before replacement for %j', async failure => {
    const h = harness(failure); expect((await h.call()).statusCode).toBeGreaterThanOrEqual(400); expect(h.writes).toEqual([]);
  });
  it('requires exact selected tags, preserves pagination and excludes cancelled/unverified test orders', async () => {
    const h = harness({ pages: true, state: { orders: [order(), order({ id: 2, tags: 'campaign3_eur_test_extra' }), order({ id: 3, cancelled_at: '2026-10-01' }), order({ id: 4, test: true })] } });
    expect((await h.call()).payload.totalRevenue).toBe(785.95); expect(h.state.records).toHaveLength(1); expect(h.queries).toHaveLength(2);
  });
  it('includes test orders only after development-store verification', async () => {
    const h = harness({ developmentStore: true, state: { orders: [order({ test: true })] } });
    expect((await h.call()).payload.totalRevenue).toBe(785.95);
  });
  it('rejects inaccessible source IDs and campaign access before reading provider data', async () => {
    for (const path of [savePath, valuesPath, statusPath]) {
      const h = harness(); expect((await h.call(path, { sourceId: 'foreign' }, { sourceId: 'foreign' })).statusCode).toBeGreaterThanOrEqual(400); expect(h.queries).toEqual([]); expect(h.writes).toEqual([]);
      const denied = harness({ denied: true }); expect((await denied.call(path)).statusCode).toBe(403); expect(denied.queries).toEqual([]);
    }
  });
  it('uses legacy saved query history and fails closed when it cannot be established', async () => {
    for (const mapping of [{ providerQueryAudit: { orderWindowStart: '2026-07-01T00:00:00Z' } }, {}, { earliestOrderCreatedAt: 'invalid' }]) {
      const h = harness({ state: { sources: [{ id: 'legacy', campaignId: 'a', sourceType: 'shopify', platformContext: 'ga4', isActive: true, mappingConfig: JSON.stringify(mapping) }] } });
      expect((await h.call(savePath, { sourceId: 'legacy' })).statusCode).toBeGreaterThanOrEqual(400); expect(h.writes).toEqual([]); expect(h.queries).toEqual([]);
    }
  });
});

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || '');
if (testUrl) { const url = new URL(testUrl); if (url.hostname !== '127.0.0.1' || url.pathname !== '/ga4_alignment_test' || process.env.DATABASE_URL) throw Error('Local fixture database required'); }
const schemaName = `ga4_shopify_window_it_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.ga4Connections, schema.metricSnapshots, schema.revenueSources, schema.revenueRecords, schema.shopifyConnections];
let admin: Pool, pool: Pool, created = false;
describe.skipIf(!testUrl)('Shopify September sale route through real PostgreSQL records, totals and publication queue', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 }); await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 4 }); database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default, defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${defaultSql}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      }); await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`);
    }
    for (const file of ['0020_add_ga4_refresh_work.sql', '0021_add_ga4_refresh_recovery.sql']) await pool.query(readFileSync(`migrations/${file}`, 'utf8'));
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  it('adds EUR785.95 to EUR8003.96, excludes today, preserves neighbors and refreshes by the same source ID', async () => {
    const storage = new DatabaseStorage();
    for (const id of ['a', 'neighbor']) {
      await database.current.insert(schema.campaigns).values({ ...campaign, id, ownerId: id, status: 'active', ga4CampaignFilter: 'sale' });
      await database.current.insert(schema.ga4Connections).values({ id: `ga4-${id}`, campaignId: id, propertyId: '123', method: 'access_token', isPrimary: true, importStartDate: '2026-09-04' });
      await database.current.insert(schema.shopifyConnections).values({ ...defaultConnection, id: `shopify-${id}`, campaignId: id });
      await database.current.insert(schema.revenueSources).values({ id: `hubspot-${id}`, campaignId: id, sourceType: 'hubspot', platformContext: 'ga4', currency: 'EUR', mappingConfig: '{}' });
      await database.current.insert(schema.revenueRecords).values({ campaignId: id, revenueSourceId: `hubspot-${id}`, date: '2026-09-30', revenue: '350', currency: 'EUR' });
    }
    const h = harness({ storage, state: { orders: [order(), order({ id: 1015, created_at: '2026-10-24T09:00:00Z', current_total_price: '100' })] } });
    expect((await h.call(valuesPath)).payload.values).toEqual([{ value: 'campaign3_eur_test', count: 2 }]);
    expect((await h.call()).statusCode).toBe(200);
    const source = (await storage.getRevenueSources('a')).find(s => s.sourceType === 'shopify')!; expect(source).toBeDefined();
    const total = await storage.getRevenueTotalForRange('a', '1900-01-01', '2026-10-23'); expect(total.totalRevenue).toBe(1135.95); expect(7653.96 + total.totalRevenue).toBeCloseTo(8789.91, 2);
    expect((await storage.getGA4RevenuePublicationStatus('a', '2026-10-23'))[source.id].status).toBe('pending');
    expect((await storage.getRecoverableGA4RefreshWork()).filter(w => w.campaignId === 'a')).toHaveLength(1);
    expect((await storage.getRevenueTotalForRange('neighbor', '1900-01-01', '2026-10-23')).totalRevenue).toBe(350);
    h.state.orders[0].current_total_price = '800';
    expect((await h.call(savePath, { sourceId: source.id }, {}, true)).statusCode).toBe(200);
    expect((await storage.getRevenueSources('a')).filter(s => s.sourceType === 'shopify').map(s => s.id)).toEqual([source.id]);
    expect((await storage.getRevenueTotalForRange('a', '1900-01-01', '2026-10-23')).totalRevenue).toBe(1150);
    expect((await storage.getRevenueBreakdownBySource('a', '1900-01-01', '2026-10-23')).find(s => s.sourceId === source.id)?.revenue).toBe(800);
    vi.setSystemTime(new Date('2026-11-27T12:00:00Z'));
    expect((await h.call(savePath, { sourceId: source.id }, {}, true)).statusCode).toBe(409);
    expect((await storage.getRevenueTotalForRange('a', '1900-01-01', '2026-10-23')).totalRevenue).toBe(1150);
  });
});
