import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
import { mapGoogleAdsDailyInsights } from './googleAdsClient';
import { buildGA4GoogleAdsSpendMaterialization } from './ga4-google-ads-spend';
import { buildPerformanceSummaryAggregate } from './utils/performance-summary-aggregate';
import { resolveCampaignCumulativeFinancials } from './utils/campaign-cumulative-financials';
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';

const testUrl = String(process.env.GA4_TEST_DATABASE_URL || '');
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.port !== '55444' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated local fixture required');
}
const namespace = `ads_money_${randomUUID().replace(/-/g, '')}`;
const tables = [schema.campaigns, schema.googleAdsConnections, schema.ga4GoogleAdsSpendConnections,
  schema.googleAdsDailyMetrics, schema.ga4GoogleAdsSpendDailyMetrics, schema.spendSources, schema.spendRecords,
  schema.metricSnapshots, schema.ga4RefreshWork];
const migration = readFileSync('migrations/0027_google_ads_spend_precision.sql', 'utf8');
let admin: Pool, pool: Pool, created = false;
const storage = new DatabaseStorage();
const day = '2026-10-01', end = '2026-10-02';

describe.skipIf(!testUrl)('ACCURACY-001 real PostgreSQL spend precision', () => {
  beforeAll(async () => {
    vi.stubEnv('TOKEN_ENCRYPTION_KEY', 'local-test-only-not-a-production-key');
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 2 });
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
    await pool.query(migration);
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin?.end(); vi.unstubAllEnvs(); });
  beforeEach(async () => {
    for (const table of [...tables].reverse()) await pool.query(`DELETE FROM "${getTableName(table)}"`);
    await database.current.insert(schema.campaigns).values(['a', 'b'].map(id => ({ id, ownerId: `owner-${id}`, name: id, status: 'active', currency: 'EUR', reportingTimeZone: 'Europe/Amsterdam', startDate: new Date(day) })));
  });
  const widenTables = ['google_ads_daily_metrics', 'ga4_google_ads_spend_daily_metrics', 'spend_records'];
  it('migrates old cent columns without changing values, IDs or integer capacity; second run is a no-op', async () => {
    for (const name of widenTables) await pool.query(`ALTER TABLE ${name} ALTER COLUMN spend TYPE NUMERIC(${name === 'google_ads_daily_metrics' ? 10 : 12},2)`);
    await pool.query("INSERT INTO google_ads_daily_metrics(id,campaign_id,google_campaign_id,date,spend) VALUES('main','a','1',$1,99999999.99)", [day]);
    await pool.query("INSERT INTO ga4_google_ads_spend_daily_metrics(id,campaign_id,google_campaign_id,date,spend) VALUES('child','a','1',$1,9999999999.99)", [day]);
    await pool.query("INSERT INTO spend_records(id,campaign_id,spend_source_id,date,spend) VALUES('spend','a','fixture',$1,-0.01)", [day]);
    await pool.query(migration); await pool.query(migration);
    const expected = ['99999999.990000', '9999999999.990000', '-0.01'];
    for (const [i, name] of widenTables.entries()) expect((await pool.query(`SELECT spend FROM ${name}`)).rows[0].spend).toBe(expected[i]);
    const columns = (await pool.query("SELECT table_name,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema=$1 AND column_name='spend' AND table_name=ANY($2) ORDER BY table_name", [namespace, widenTables])).rows;
    expect(columns.map(row => [row.numeric_precision, row.numeric_scale])).toEqual([[16, 6], [14, 6], [null, null]]);
  });
  it('rolls back the entire migration if a later column has an unexpected definition', async () => {
    await pool.query('ALTER TABLE google_ads_daily_metrics ALTER COLUMN spend TYPE NUMERIC(10,2)');
    await pool.query('ALTER TABLE spend_records ALTER COLUMN spend TYPE NUMERIC(12,3)');
    await expect(pool.query(migration)).rejects.toThrow('Unexpected spend column precision');
    expect((await pool.query("SELECT numeric_scale FROM information_schema.columns WHERE table_schema=$1 AND table_name='google_ads_daily_metrics' AND column_name='spend'", [namespace])).rows[0].numeric_scale).toBe(2);
    await pool.query('ALTER TABLE spend_records ALTER COLUMN spend TYPE NUMERIC(12,2)');
    await pool.query(migration);
  });
  it('preserves the shared heap, unrelated indexes and dependent index definition while enforcing micro precision and amount limits', async () => {
    await pool.query('ALTER TABLE spend_records DROP CONSTRAINT spend_records_spend_micros');
    await pool.query('ALTER TABLE spend_records ALTER COLUMN spend TYPE NUMERIC(12,2)');
    await pool.query("INSERT INTO spend_records(id,campaign_id,spend_source_id,date,spend) VALUES('old','a','fixture',$1,10.25)", [day]);
    await pool.query('CREATE INDEX idx_spend_records_date_range ON spend_records(campaign_id,date DESC) WHERE (spend::numeric(15,2)>0)');
    const files = () => pool.query("SELECT oid,relfilenode FROM pg_class WHERE (oid='spend_records'::regclass OR oid IN (SELECT indexrelid FROM pg_index WHERE indrelid='spend_records'::regclass)) AND relname<>'idx_spend_records_date_range' ORDER BY oid");
    const dependentIndex = () => pool.query("SELECT pg_get_indexdef(indexrelid) definition,indisvalid,indisready FROM pg_index WHERE indexrelid='idx_spend_records_date_range'::regclass");
    const before = (await files()).rows;
    const indexBefore = (await dependentIndex()).rows;
    await pool.query(migration);
    expect((await files()).rows).toEqual(before);
    expect((await dependentIndex()).rows).toEqual(indexBefore);
    expect(indexBefore).toEqual([expect.objectContaining({ indisvalid: true, indisready: true })]);
    expect((await pool.query('SELECT spend FROM spend_records')).rows[0].spend).toBe('10.25');
    for (const value of ['0.0000001','10000000000','-10000000000','NaN','Infinity']) {
      await expect(pool.query('UPDATE spend_records SET spend=$1', [value])).rejects.toThrow('spend_records_spend_micros');
    }
    await pool.query('UPDATE spend_records SET spend=0.000001');
    await pool.query('ALTER TABLE spend_records VALIDATE CONSTRAINT spend_records_spend_micros');
    expect((await pool.query("SELECT convalidated FROM pg_constraint WHERE conrelid='spend_records'::regclass AND conname='spend_records_spend_micros'")).rows[0].convalidated).toBe(true);
  });
  it('converts only the observed empty legacy text Ads column; populated legacy data fails closed', async () => {
    await pool.query('ALTER TABLE google_ads_daily_metrics ALTER COLUMN spend DROP DEFAULT, ALTER COLUMN spend DROP NOT NULL, ALTER COLUMN spend TYPE TEXT');
    await pool.query("INSERT INTO google_ads_daily_metrics(id,campaign_id,google_campaign_id,date,spend) VALUES('legacy','a','1',$1,'1.234567')", [day]);
    await expect(pool.query(migration)).rejects.toThrow('Populated legacy');
    expect((await pool.query('SELECT spend FROM google_ads_daily_metrics')).rows[0].spend).toBe('1.234567');
    await pool.query('DELETE FROM google_ads_daily_metrics');
    await pool.query(migration); await pool.query(migration);
    expect((await pool.query("SELECT format_type(atttypid,atttypmod) type,attnotnull FROM pg_attribute WHERE attrelid='google_ads_daily_metrics'::regclass AND attname='spend'")).rows[0]).toEqual({ type: 'numeric(14,6)', attnotnull: false });
    await pool.query('ALTER TABLE google_ads_daily_metrics ALTER COLUMN spend SET DEFAULT 0, ALTER COLUMN spend SET NOT NULL');
  });
  for (const dedicated of [false, true]) it.each([
    { costs: [1234567, 2234567], expected: 3.47 },
    { costs: [12345678, 12345678], expected: 24.69 },
    { costs: [1004999, 1], expected: 1.01 },
    { costs: [4999, 4999, 4999], expected: 0.01 },
    { costs: [1250000, 2750000], expected: 4 },
  ])(`provider -> ${dedicated ? 'dedicated' : 'main'} storage -> records -> totals/financials: $expected`, async c => {
    const rows = mapGoogleAdsDailyInsights('a', c.costs.map((costMicros, i) => ({ campaignId: String(i + 1), campaignName: 'Fixture', date: i % 2 ? end : day,
      costMicros, impressions: 100, clicks: 5, conversions: 1, conversionsValue: 0, ctr: 0.05, averageCpc: 0, averageCpm: 0, interactionRate: 0, videoViews: 0, searchImpressionShare: 0 })));
    const connection: any = { campaignId: 'a', customerId: '123', method: 'oauth', spendOnly: true };
    if (dedicated) await storage.replaceGA4GoogleAdsSpendConnection(connection, rows);
    else await storage.replaceGoogleAdsConnection(connection, rows);
    const saved = dedicated ? await storage.getGA4GoogleAdsSpendDailyMetrics('a', day, end) : await storage.getGoogleAdsDailyMetrics('a', day, end);
    expect(saved.map(row => row.spend).sort()).toEqual(rows.map(row => row.spend).sort());
    const materialized = buildGA4GoogleAdsSpendMaterialization({ campaignId: 'a', currency: 'EUR', accountName: 'Fixture', selectedCampaignIds: rows.map(row => row.googleCampaignId), rows: saved, startDate: day, endDate: end, fetchedAt: '2026-10-03T00:00:00Z' });
    const source = await storage.replaceSpendSourceWithRecords('a', null, 'ad_platforms', 'ga4', { campaignId: 'a', sourceType: 'ad_platforms', platformContext: 'ga4', currency: 'EUR', displayName: 'Google Ads', mappingConfig: JSON.stringify(materialized.mappingConfig), isActive: true }, materialized.records as any);
    const totals = await storage.getSpendTotalForRange('a', day, end, 'ga4');
    expect(totals.totalSpend).toBe(c.expected);
    expect((await storage.getSpendBreakdownBySource('a', day, end, 'ga4'))[0].spend).toBe(c.expected);
    expect(materialized.amount).toBe(c.expected);
    // Same source edit/retry must replace exact records, not add them again.
    await storage.replaceSpendRecordsForSource('a', source.id, 'ad_platforms', 'ga4', materialized.records as any);
    expect((await storage.getSpendTotalForRange('a', day, end, 'ga4')).totalSpend).toBe(c.expected);
    const currentValueWindow = { mode: 'initial_import_to_latest_completed_day' as const, startDate: day, endDate: end, dataThroughDate: end, reportingTimeZone: 'Europe/Amsterdam' };
    const summary = buildPerformanceSummaryAggregate({ campaignId: 'a', dateRange: '30days', currentValueWindow,
      ga4: { connected: true, available: true, revenue: 100, sessions: 10, users: 8, conversions: 2 },
      spend: { available: true, unifiedSpend: totals.totalSpend, spendSource: 'persisted_spend_sources', sourceIds: [source.id] },
      revenue: { available: true, onsiteRevenue: 100, offsiteRevenue: 0, totalRevenue: 100 }, financialConversions: { value: 2, available: true, sources: ['ga4'] } });
    const financial = resolveCampaignCumulativeFinancials({ campaignId: 'a', currency: 'EUR', performanceSummary: summary, nativeRevenue: 100, importedRevenue: 0 });
    expect(financial.snapshot.inputs.spend.value).toBe(c.expected.toFixed(2));
    expect(financial.financials.profit).toBeCloseTo(100 - c.expected, 2);
    expect(financial.financials.roas).toBeCloseTo(100 / c.expected, 8);
    // Neighboring cent-based imports and other campaigns retain exact ownership and values.
    for (const [kind, amount] of [['csv', '10.25'], ['google_sheets', '5.59']]) await storage.replaceSpendSourceWithRecords('a', null, kind, 'ga4', { campaignId: 'a', sourceType: kind, platformContext: 'ga4', currency: 'EUR', displayName: kind, isActive: true }, [{ campaignId: 'a', date: day, spend: amount, currency: 'EUR' }] as any);
    await storage.replaceSpendSourceWithRecords('b', null, 'csv', 'ga4', { campaignId: 'b', sourceType: 'csv', platformContext: 'ga4', currency: 'EUR', displayName: 'Neighbor', isActive: true }, [{ campaignId: 'b', date: day, spend: '99.00', currency: 'EUR' }] as any);
    expect((await storage.getSpendTotalForRange('a', day, end, 'ga4')).totalSpend).toBeCloseTo(c.expected + 15.84, 2);
    expect((await storage.getSpendTotalForRange('b', day, end, 'ga4')).totalSpend).toBe(99);
  });
});
