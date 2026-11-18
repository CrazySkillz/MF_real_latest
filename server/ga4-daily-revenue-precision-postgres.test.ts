import { afterAll, beforeAll, expect, it, describe, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
import { buildGA4InsightsRollups, normalizeGA4InsightsDailyRows } from '../shared/ga4-insights';
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';
const testUrl = String(process.env.GA4_TEST_DATABASE_URL || '');
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL) throw Error('Isolated local fixture required');
}
const namespace = `ga4_revenue_${randomUUID().replace(/-/g, '')}`;
const migration = readFileSync('migrations/0031_ga4_daily_revenue_precision.sql', 'utf8');
let admin: Pool, pool: Pool;
const storage = new DatabaseStorage();
describe.skipIf(!testUrl)('GA4 daily Revenue real PostgreSQL boundary', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl, max: 1 });
    await admin.query(`CREATE SCHEMA "${namespace}"`);
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 1 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    const columns = Object.values(getTableColumns(schema.ga4DailyMetrics)).map((column: any) => {
      const value = column.default;
      const defaultSql = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
      return `"${column.name}" ${column.name === 'revenue' ? 'numeric(15,2)' : column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${defaultSql}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
    });
    await pool.query(`CREATE TABLE ga4_daily_metrics (${columns.join(', ')}, UNIQUE(campaign_id,property_id,date))`);
  });
  afterAll(async () => { await pool?.end(); if (admin) { await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin.end(); } });
  it('widens without rewriting history, then preserves both storage writers, zeros, refunds and campaign boundaries', async () => {
    await pool.query("INSERT INTO ga4_daily_metrics(id,campaign_id,property_id,date,revenue) VALUES('control','other','123','2026-09-17',2374.66)");
    const before = (await pool.query('SELECT * FROM ga4_daily_metrics')).rows;
    const heap = (await pool.query("SELECT relfilenode FROM pg_class WHERE oid='ga4_daily_metrics'::regclass")).rows;
    await pool.query(migration); await pool.query(migration);
    expect((await pool.query('SELECT * FROM ga4_daily_metrics')).rows).toEqual(before);
    expect((await pool.query("SELECT relfilenode FROM pg_class WHERE oid='ga4_daily_metrics'::regclass")).rows).toEqual(heap);
    const amounts = ['2374.661207','1875.742727','1605.573028','1859.109129','2512.478237','1984.912502','0'];
    const rows = amounts.map((revenue, i) => ({campaignId:'promo',propertyId:'123',date:`2026-09-${17+i}`,revenue,users:10,sessions:12,engagedSessions:6,pageviews:20,conversions:1.5,isSimulated:false}));
    await storage.upsertGA4DailyMetrics(rows);
    let saved = await storage.getGA4DailyMetrics('promo','123','2026-09-17','2026-09-23');
    expect(saved.map(row => row.revenue)).toEqual(amounts);
    await storage.replaceGA4DailyMetricsWindow('promo','123','2026-09-17','2026-09-23',saved);
    saved = await storage.getGA4DailyMetrics('promo','123','2026-09-17','2026-09-23');
    expect(saved.map(row => row.revenue)).toEqual(amounts);
    expect(buildGA4InsightsRollups(normalizeGA4InsightsDailyRows(saved),'2026-09-23').last7.revenue.toFixed(2)).toBe('12212.48');
    expect(saved.map(row => [row.users,row.sessions,row.conversions])).toEqual(Array(7).fill([10,12,1.5]));
    await storage.upsertGA4DailyMetrics([{...rows[0],revenue:'-1.005001'}]);
    expect((await storage.getGA4DailyMetrics('promo','123','2026-09-17','2026-09-17'))[0].revenue).toBe('-1.005001');
    expect((await pool.query("SELECT * FROM ga4_daily_metrics WHERE campaign_id='other'")).rows).toEqual(before);
    for (const invalid of ['NaN','Infinity','-Infinity','10000000000000']) {
      await expect(pool.query("UPDATE ga4_daily_metrics SET revenue=$1 WHERE id='control'",[invalid])).rejects.toThrow();
    }
    await pool.query('ALTER TABLE ga4_daily_metrics ALTER COLUMN revenue TYPE NUMERIC(15,3)');
    await expect(pool.query(migration)).rejects.toThrow('Unexpected GA4 daily revenue precision');
  });
});
