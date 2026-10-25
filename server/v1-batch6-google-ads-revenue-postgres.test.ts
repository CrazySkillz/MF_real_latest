import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL, sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import ts from 'typescript';
import * as schema from '../shared/schema';
import { getReportingDateWindow } from './utils/reporting-timezone';

const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';
const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Only the isolated local fixture database is allowed');
}
const schemaName = `v1_ads_values_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.revenueSources, schema.revenueRecords, schema.googleAdsDailyMetrics, schema.spendSources, schema.spendRecords];
let admin: Pool, pool: Pool, created = false;
const storage = new DatabaseStorage();
const source = ts.createSourceFile('routes.ts', readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const declarations = new Map<string, string>(), routes = new Map<string, string>();
function walk(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && !declarations.has(node.name.text)) declarations.set(node.name.text, `const ${node.getText(source)};`);
  if (ts.isCallExpression(node) && node.expression.getText(source) === 'app.get' && ts.isStringLiteral(node.arguments[0])) routes.set(node.arguments[0].text, node.arguments.at(-1)!.getText(source));
  ts.forEachChild(node, walk);
}
walk(source);
function bind(code: string, name: string, env: Record<string, any>) {
  return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText + `\nreturn ${name};`)(...Object.values(env));
}
async function invoke(kind: 'revenue-totals' | 'google-ads-campaign-revenue' | 'revenue-sources') {
  const env: Record<string, any> = { storage, db: database.current, sql, getReportingDateWindow,
    ensureCampaignAccess: () => storage.getCampaign('a'), getActiveGoogleAdsCampaignIdSet: async () => new Set(['selected']),
    parseRevenueReadPlatformContext: () => 'google_ads', getShopifyRevenueSourceFreshness: () => null, console: { error() {} } };
  for (const name of ['normalizeDate', 'getDateRangeBounds']) env[name] = bind(declarations.get(name)!, name, env);
  const fn = bind(`const handler = ${routes.get(`/api/campaigns/:id/${kind}`)};`, 'handler', env);
  const res: any = { code: 200, setHeader() {}, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; return this; } };
  await fn({ params: { id: 'a' }, query: { platformContext: 'google_ads', dateRange: '90days' } }, res);
  return res;
}
async function record(revenue: string, date: string, extra: any = {}) {
  await database.current.insert(schema.revenueRecords).values({ campaignId: 'a', revenueSourceId: 'ads-a', revenue, date, currency: 'EUR', sourceType: 'csv', subCampaignUrn: 'selected', ...extra });
}
describe.skipIf(!testUrl)('Google Ads revenue query and storage boundary with PostgreSQL', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 2 });
    await admin.query(`CREATE SCHEMA "${schemaName}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${schemaName}`, max: 2 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of tables) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${defaultSql}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(', ')})`);
    }
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`); await admin?.end(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    for (const id of ['a', 'b']) {
      await database.current.insert(schema.campaigns).values({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: new Date('2026-01-01T00:00:00Z') });
      await database.current.insert(schema.revenueSources).values({ id: `ads-${id}`, campaignId: id, sourceType: 'csv', platformContext: 'google_ads', currency: 'EUR', displayName: id, isActive: true, mappingConfig: '{"lastTotalRevenue":9999}' });
    }
  });
  it('returns the same dated 250 EUR in total and selected campaign; preserves all-time source provenance', async () => {
    const { startDate, endDate } = getReportingDateWindow(90, 'Europe/Amsterdam');
    await record('200', startDate); await record('50', endDate); await record('900', '2020-01-01'); await record('800', '2999-01-01');
    await record('500', endDate, { revenueSourceId: 'ads-b', campaignId: 'b' });
    await record('600', endDate, { revenueSourceId: 'ads-b' }); // damaged cross-parent link must be excluded
    const total = await invoke('revenue-totals'), breakdown = await invoke('google-ads-campaign-revenue'), sources = await invoke('revenue-sources');
    expect(total.code).toBe(200); expect(total.body.totalRevenue).toBe(250);
    expect(breakdown.code).toBe(200); expect(breakdown.body.breakdown).toEqual([expect.objectContaining({ campaignId: 'selected', revenue: 250, currency: 'EUR' })]);
    expect(sources.body.sources[0].lastTotalRevenue).toBe(1950);
  });
  it('ignores inactive, foreign-context and unmapped rows in the exact campaign breakdown', async () => {
    const { endDate } = getReportingDateWindow(90, 'Europe/Amsterdam');
    await record('10', endDate); await record('20', endDate, { subCampaignUrn: null }); await record('30', endDate, { subCampaignUrn: 'unselected' });
    await database.current.insert(schema.revenueSources).values({ id: 'ga4-a', campaignId: 'a', sourceType: 'csv', platformContext: 'ga4', currency: 'EUR', isActive: true });
    await record('40', endDate, { revenueSourceId: 'ga4-a' });
    expect((await invoke('google-ads-campaign-revenue')).body.breakdown[0].revenue).toBe(10);
    await pool.query("UPDATE revenue_sources SET is_active=false WHERE id='ads-a'");
    expect((await invoke('google-ads-campaign-revenue')).body.breakdown).toEqual([]);
  });
  it('refuses mixed currency at the total, source-list and exact campaign boundaries', async () => {
    const { endDate } = getReportingDateWindow(90, 'Europe/Amsterdam');
    await record('10', endDate); await record('20', endDate, { currency: 'USD' });
    for (const kind of ['revenue-totals', 'revenue-sources', 'google-ads-campaign-revenue'] as const) expect((await invoke(kind)).code).toBe(500);
  });
  it('preserves measured zero and negative revenue without guessing from the cached config', async () => {
    const { endDate } = getReportingDateWindow(90, 'Europe/Amsterdam');
    await record('0', endDate);
    expect((await invoke('google-ads-campaign-revenue')).body.breakdown[0].revenue).toBe(0);
    await record('-25', endDate);
    expect((await invoke('revenue-totals')).body.totalRevenue).toBe(-25);
    expect((await invoke('google-ads-campaign-revenue')).body.breakdown[0].revenue).toBe(-25);
  });
  it('excludes historical name-matched amounts from reads without altering stored/native facts', async () => {
    await database.current.insert(schema.googleAdsDailyMetrics).values({ campaignId: 'a', googleCampaignId: 'selected', date: '2026-10-01', spend: '10', conversionValue: '25', ga4Revenue: '100', ga4UtmName: 'launch' });
    await database.current.insert(schema.googleAdsDailyMetrics).values({ campaignId: 'b', googleCampaignId: 'foreign', date: '2026-10-01', ga4Revenue: '999' });
    const rows = await storage.getGoogleAdsDailyMetrics('a', '2026-10-01', '2026-10-24');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ spend: '10.00', conversionValue: '25.00', ga4Revenue: null, ga4UtmName: null });
    expect((await pool.query("SELECT ga4_revenue, ga4_utm_name FROM google_ads_daily_metrics WHERE campaign_id='a'")).rows[0]).toEqual({ ga4_revenue: '100.00', ga4_utm_name: 'launch' });
  });
  it('blocks direct unverified enrichment writes and keeps the existing row intact', async () => {
    await database.current.insert(schema.googleAdsDailyMetrics).values({ campaignId: 'a', googleCampaignId: 'selected', date: '2026-10-01', ga4Revenue: '100' });
    await expect(storage.updateGoogleAdsDailyMetricsGA4Revenue('a', [{ googleCampaignId: 'selected', date: '2026-10-01', ga4Revenue: '200', ga4UtmName: 'launch' }])).rejects.toThrow('attribution is unavailable');
    expect((await pool.query("SELECT ga4_revenue FROM google_ads_daily_metrics WHERE campaign_id='a'")).rows[0].ga4_revenue).toBe('100.00');
    expect(await storage.updateGoogleAdsDailyMetricsGA4Revenue('a', [])).toEqual({ updated: 0 });
  });
  it('replaces one platform source and preserves other campaigns and GA4 records', async () => {
    const source = { campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'tiktok', currency: 'EUR', displayName: 'TikTok Ads', isActive: true, mappingConfig: '{"platform":"tiktok"}' };
    for (const [id, campaignId, context] of [['spend-a', 'a', 'tiktok'], ['spend-b', 'b', 'tiktok'], ['spend-ga4', 'a', 'ga4']]) {
      await database.current.insert(schema.spendSources).values({ ...source, id, campaignId, platformContext: context });
      await database.current.insert(schema.spendRecords).values({ campaignId, spendSourceId: id, sourceType: 'tiktok_api', currency: 'EUR', date: '2026-10-01', spend: '70' });
    }
    const record = { campaignId: 'a', date: '2026-10-02', spend: '10', currency: 'EUR', sourceType: 'tiktok_api' };
    await storage.replaceSpendSourceWithRecords('a', 'spend-a', 'tiktok_api', 'tiktok', source, [record], source.mappingConfig);
    expect((await storage.getSpendTotalForRange('a', '2026-10-01', '2026-10-24', 'tiktok')).totalSpend).toBe(10);
    expect((await pool.query("SELECT spend_source_id, spend FROM spend_records ORDER BY spend_source_id")).rows).toEqual([
      { spend_source_id: 'spend-a', spend: '10.00' }, { spend_source_id: 'spend-b', spend: '70.00' }, { spend_source_id: 'spend-ga4', spend: '70.00' },
    ]);
  });
  it('rolls back both source metadata and deleted facts if replacement insertion fails', async () => {
    const source = { campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'tiktok', currency: 'EUR', displayName: 'original', isActive: true, mappingConfig: '{"platform":"tiktok"}' };
    await database.current.insert(schema.spendSources).values({ ...source, id: 'spend-a' });
    await database.current.insert(schema.spendRecords).values({ campaignId: 'a', spendSourceId: 'spend-a', sourceType: 'tiktok_api', currency: 'EUR', date: '2026-10-01', spend: '70' });
    await expect(storage.replaceSpendSourceWithRecords('a', 'spend-a', 'tiktok_api', 'tiktok', { ...source, displayName: 'changed' }, [{ campaignId: 'a', date: '2026-10-02', spend: 'not-a-number', currency: 'EUR', sourceType: 'tiktok_api' }], source.mappingConfig)).rejects.toThrow();
    expect((await pool.query("SELECT display_name FROM spend_sources WHERE id='spend-a'")).rows[0].display_name).toBe('original');
    expect((await pool.query("SELECT spend FROM spend_records WHERE spend_source_id='spend-a'")).rows).toEqual([{ spend: '70.00' }]);
    await expect(storage.replaceSpendSourceWithRecords('a', null, 'tiktok_api', 'tiktok', source, [{ campaignId: 'a', date: '2026-10-02', spend: 'not-a-number', currency: 'EUR', sourceType: 'tiktok_api' }])).rejects.toThrow();
    expect((await pool.query('SELECT count(*)::int AS count FROM spend_sources')).rows[0].count).toBe(1);
  });
  it('rejects stale mappings, foreign parents and foreign contexts without deleting facts', async () => {
    const source = { campaignId: 'a', sourceType: 'tiktok_api', platformContext: 'tiktok', currency: 'EUR', isActive: true, mappingConfig: '{"revision":2}' };
    await database.current.insert(schema.spendSources).values({ ...source, id: 'spend-a' });
    await database.current.insert(schema.spendRecords).values({ campaignId: 'a', spendSourceId: 'spend-a', sourceType: 'tiktok_api', currency: 'EUR', date: '2026-10-01', spend: '70' });
    for (const [campaignId, context, mapping] of [['a', 'tiktok', '{"revision":1}'], ['b', 'tiktok', source.mappingConfig], ['a', 'google_ads', source.mappingConfig]]) {
      await expect(storage.replaceSpendSourceWithRecords(campaignId, 'spend-a', 'tiktok_api', context as any, source, [], mapping)).rejects.toThrow();
    }
    expect((await pool.query("SELECT spend FROM spend_records WHERE spend_source_id='spend-a'")).rows).toEqual([{ spend: '70.00' }]);
  });
});
