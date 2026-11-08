import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
vi.mock('google-auth-library', async original => ({ ...await original<any>(), JWT: class { transporter = { defaults: {} }; async getAccessToken() { return { token: 'synthetic-issuer' }; } } }));
import { DatabaseStorage } from './storage';
const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) { const u = new URL(testUrl); if (u.hostname !== '127.0.0.1' || u.port !== '55444' || u.pathname !== '/ga4_alignment_test' || u.search || process.env.DATABASE_URL) throw Error('Isolated local fixture required'); }
const namespace = `ads_accounts_${randomUUID().replace(/-/g, '')}`;
const migration = readFileSync('migrations/0029_google_ads_client_service_accounts.sql', 'utf8');
let admin: Pool, pool: Pool, created = false;
const storage = new DatabaseStorage();
const reserve = (campaign = 'a', owner = 'owner-a', customer = '4951281615') => storage.reserveGoogleAdsClientServiceAccount(campaign, customer, owner);
const complete = (binding: any, campaign = 'a', owner = 'owner-a', googleId = '111', verified = true) => storage.completeGoogleAdsClientServiceAccount(campaign, binding.customerId, binding.id, googleId, owner, verified);
const save = (binding: any, campaign = 'a', owner = 'owner-a') => storage.replaceGA4GoogleAdsSpendConnection({ campaignId: campaign, customerId: binding.customerId, serviceAccountBindingId: binding.id, method: 'service_account', spendOnly: true }, [{ campaignId: campaign, googleCampaignId: '24273140790', googleCampaignName: 'Campaign #1', date: '2026-09-25', spend: '4.89', clicks: 1, impressions: 10 }], owner);

describe.skipIf(!testUrl)('Google Ads dedicated identity PostgreSQL boundaries', () => {
  beforeAll(async () => {
    vi.stubEnv('GA4_CLIENT_SERVICE_ACCOUNT_JSON', JSON.stringify({ type: 'service_account', project_id: 'fixture-project', client_email: 'issuer@fixture-project.iam.gserviceaccount.com', private_key: 'fixture-only' }));
    admin = new Pool({ connectionString: testUrl, max: 1 }); await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 5 }); database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of [schema.clients, schema.campaigns, schema.ga4GoogleAdsSpendConnections, schema.ga4GoogleAdsSpendDailyMetrics, schema.spendSources]) {
      const columns = Object.values(getTableColumns(table)).filter(c => c.name !== 'service_account_binding_id').map((column: any) => {
        const value = column.default, d = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${d}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      }); await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(',')})`);
    }
    await pool.query(migration);
  });
  afterAll(async () => { await pool?.end(); if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`); await admin?.end(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  beforeEach(async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ accessToken: 'dedicated-ads-token', expireTime: new Date(Date.now() + 3600000).toISOString() }))));
    await pool.query('TRUNCATE google_ads_client_service_accounts,ga4_google_ads_spend_connections,ga4_google_ads_spend_daily_metrics,spend_sources,campaigns,clients');
    await database.current.insert(schema.clients).values([{ id: 'client-a', ownerId: 'owner-a', name: 'Acme' }, { id: 'client-b', ownerId: 'owner-b', name: 'Beta' }]);
    await database.current.insert(schema.campaigns).values([{ id: 'a', ownerId: 'owner-a', clientId: 'client-a', name: 'A', status: 'active' }, { id: 'a2', ownerId: 'owner-a', clientId: 'client-a', name: 'A2', status: 'draft' }, { id: 'b', ownerId: 'owner-b', clientId: 'client-b', name: 'B', status: 'active' }]);
  });
  it('serializes repeated requests across campaigns of the same client/account', async () => {
    const rows = await Promise.all([reserve(), reserve('a2'), reserve()]); expect(new Set(rows.map(r => r.id)).size).toBe(1); expect(rows[0].email).toBe('acme-ads-4951281615@fixture-project.iam.gserviceaccount.com'); expect(rows[0].verifiedAt).toBeNull();
  });
  it('blocks foreign owners, bindings and account IDs', async () => {
    const a = await reserve(); await expect(reserve('a', 'owner-b')).rejects.toThrow();
    expect(await storage.getGoogleAdsClientServiceAccount('b', a.customerId, a.id)).toBeUndefined();
    await expect(complete(a, 'b', 'owner-b')).rejects.toThrow(); expect(await storage.getGoogleAdsClientServiceAccount('a', '9999999999', a.id)).toBeUndefined();
  });
  it('rejects reused names and changed Google identities instead of sharing access', async () => {
    const a = await reserve(); await complete(a); await pool.query("UPDATE clients SET name='Acme' WHERE id='client-b'"); await expect(reserve('b', 'owner-b')).rejects.toThrow();
    await expect(complete(a, 'a', 'owner-a', '222')).rejects.toThrow();
    await pool.query("UPDATE clients SET name='Renamed' WHERE id='client-a'"); expect((await reserve()).email).toBe(a.email);
  });
  it('requires verification and current ownership inside the save transaction', async () => {
    const a = await reserve(); await expect(save(a)).rejects.toThrow('not verified'); await complete(a);
    await expect(save(a, 'b', 'owner-b')).rejects.toThrow('not verified'); await expect(save(a, 'a', 'owner-b')).rejects.toThrow('not verified');
    expect((await pool.query('SELECT count(*) FROM ga4_google_ads_spend_connections')).rows[0].count).toBe('0');
  });
  it('persists only the binding, hydrates short-lived credentials and preserves data on retries', async () => {
    const a = await reserve(); await complete(a); const first = await save(a);
    const before = (await pool.query('SELECT to_jsonb(t) AS row FROM ga4_google_ads_spend_daily_metrics t')).rows;
    expect((await save(a)).id).toBe(first.id); expect((await pool.query('SELECT to_jsonb(t) AS row FROM ga4_google_ads_spend_daily_metrics t')).rows).toEqual(before);
    expect((await storage.getGA4GoogleAdsSpendConnection('a'))?.accessToken).toBe('dedicated-ads-token');
    expect((await pool.query('SELECT access_token,refresh_token,client_secret,encrypted_tokens FROM ga4_google_ads_spend_connections')).rows[0]).toEqual({ access_token: null, refresh_token: null, client_secret: null, encrypted_tokens: { v: 1, accessToken: null, refreshToken: null, clientSecret: null } });
    await pool.query('UPDATE google_ads_client_service_accounts SET verified_at=NULL'); await expect(storage.getGA4GoogleAdsSpendConnection('a')).rejects.toThrow('not verified');
  });
  it.each(['oauth', 'service_account'])('cannot overwrite an existing %s connection', async method => {
    const a = await reserve(); await complete(a); await database.current.insert(schema.ga4GoogleAdsSpendConnections).values({ campaignId: 'a', customerId: a.customerId, method });
    await expect(save(a)).rejects.toThrow('has changed'); expect((await pool.query('SELECT count(*) FROM ga4_google_ads_spend_daily_metrics')).rows[0].count).toBe('0');
  });
  it('blocks orphaned sources including legacy platform scope', async () => {
    const a = await reserve(); await complete(a); await database.current.insert(schema.spendSources).values({ campaignId: 'a', sourceType: 'ad_platforms', displayName: 'Custom name', platformContext: null, mappingConfig: '{"platform":"google_ads"}', isActive: true }); await expect(save(a)).rejects.toThrow('disconnected');
  });
  it('retains retired identities but makes deleted/changed client ownership inaccessible', async () => {
    const a = await reserve(); await complete(a); await pool.query("UPDATE campaigns SET status='deleted' WHERE id='a'"); await expect(reserve()).rejects.toThrow(); expect(await storage.getGoogleAdsClientServiceAccount('a', a.customerId)).toBeUndefined();
    await pool.query("UPDATE clients SET owner_id='owner-b' WHERE id='client-a'"); expect(await storage.getGoogleAdsClientServiceAccount('a2', a.customerId)).toBeUndefined(); expect((await pool.query('SELECT count(*) FROM google_ads_client_service_accounts')).rows[0].count).toBe('1');
  });
  it('runs the additive migration twice without changing old connections', async () => {
    await database.current.insert(schema.ga4GoogleAdsSpendConnections).values({ campaignId: 'a', customerId: '4951281615', method: 'oauth', accessToken: 'synthetic' });
    const before = (await pool.query('SELECT to_jsonb(t) AS row FROM ga4_google_ads_spend_connections t')).rows; await pool.query(migration); expect((await pool.query('SELECT to_jsonb(t) AS row FROM ga4_google_ads_spend_connections t')).rows).toEqual(before);
    await pool.query('ALTER TABLE ga4_google_ads_spend_connections DROP COLUMN service_account_binding_id');
    try { expect((await storage.getGA4GoogleAdsSpendConnection('a'))?.accessToken).toBe('synthetic'); } finally { await pool.query(migration); }
  });
});
