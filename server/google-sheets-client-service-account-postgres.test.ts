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
const namespace = `sheets_accounts_${randomUUID().replace(/-/g, '')}`;
const migration = readFileSync('migrations/0030_google_sheets_client_service_accounts.sql', 'utf8');
let admin: Pool, pool: Pool, created = false;
const storage = new DatabaseStorage();
const reserve = (campaign = 'a', owner = 'owner-a', customer = '4951281615') => storage.reserveGoogleSheetsClientServiceAccount(campaign, customer, owner);
const complete = (binding: any, campaign = 'a', owner = 'owner-a', googleId = '111', verified = true) => storage.completeGoogleSheetsClientServiceAccount(campaign, binding.spreadsheetId, binding.id, googleId, owner, verified);
const save = (binding: any, campaign = 'a') => storage.createGoogleSheetsConnection({ campaignId: campaign, spreadsheetId: binding.spreadsheetId, serviceAccountBindingId: binding.id, method: 'service_account', sheetName: 'Data', purpose: 'spend' });

describe.skipIf(!testUrl)('Google Sheets dedicated identity PostgreSQL boundaries', () => {
  beforeAll(async () => {
    vi.stubEnv('GA4_CLIENT_SERVICE_ACCOUNT_JSON', JSON.stringify({ type: 'service_account', project_id: 'fixture-project', client_email: 'issuer@fixture-project.iam.gserviceaccount.com', private_key: 'fixture-only' }));
    admin = new Pool({ connectionString: testUrl, max: 1 }); await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace}`, max: 5 }); database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of [schema.clients, schema.campaigns, schema.googleSheetsConnections, schema.spendSources, schema.ga4RefreshWork, schema.metricSnapshots]) {
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
    await pool.query('TRUNCATE google_sheets_client_service_accounts,google_sheets_connections,spend_sources,campaigns,clients,ga4_refresh_work,metric_snapshots');
    await database.current.insert(schema.clients).values([{ id: 'client-a', ownerId: 'owner-a', name: 'Acme' }, { id: 'client-b', ownerId: 'owner-b', name: 'Beta' }]);
    await database.current.insert(schema.campaigns).values([{ id: 'a', ownerId: 'owner-a', clientId: 'client-a', name: 'A', status: 'active' }, { id: 'a2', ownerId: 'owner-a', clientId: 'client-a', name: 'A2', status: 'draft' }, { id: 'b', ownerId: 'owner-b', clientId: 'client-b', name: 'B', status: 'active' }]);
  });
  it('reuses the same identity for concurrent setup within one client/file', async () => {
    const rows = await Promise.all([reserve(), reserve('a2'), reserve()]); expect(new Set(rows.map(r => r.id)).size).toBe(1);
    expect(rows[0].verifiedAt).toBeNull();
  });
  it('rejects foreign owners, other clients and other files', async () => {
    const a = await reserve(); await expect(reserve('a', 'owner-b')).rejects.toThrow();
    expect(await storage.getGoogleSheetsClientServiceAccount('b', a.spreadsheetId, a.id)).toBeUndefined();
    expect(await storage.getGoogleSheetsClientServiceAccount('a', '9999999999', a.id)).toBeUndefined();
    await expect(complete(a, 'b', 'owner-b')).rejects.toThrow(); await complete(a);
    await expect(save(a, 'b')).rejects.toThrow('not verified');
  });
  it('checks verification within save and update transactions', async () => {
    const a = await reserve(); await expect(save(a)).rejects.toThrow('not verified'); await complete(a);
    const connection = await save(a);
    await expect(storage.updateGoogleSheetsConnection(connection.id, { spreadsheetId: '9999999999' })).rejects.toThrow('not verified');
    expect((await storage.getGoogleSheetsConnection('a', a.spreadsheetId))?.id).toBe(connection.id);
  });
  it('hydrates pending and selected tabs without persisting credentials', async () => {
    const a = await reserve(); await complete(a);
    const pending = await storage.createGoogleSheetsConnection({ campaignId: 'a', spreadsheetId: 'pending', serviceAccountBindingId: a.id, method: 'service_account', purpose: 'spend' });
    expect(pending.accessToken).toBe('dedicated-ads-token');
    await storage.updateGoogleSheetsConnection(pending.id, { spreadsheetId: a.spreadsheetId, sheetName: 'Data' });
    expect((await storage.getGoogleSheetsConnections('a'))[0].accessToken).toBe('dedicated-ads-token');
    expect((await pool.query('SELECT access_token,refresh_token,client_secret,encrypted_tokens FROM google_sheets_connections')).rows[0]).toEqual({ access_token: null, refresh_token: null, client_secret: null, encrypted_tokens: { v: 1, accessToken: null, refreshToken: null, clientSecret: null } });
    await pool.query('UPDATE google_sheets_client_service_accounts SET verified_at=NULL');
    expect((await storage.getGoogleSheetsConnections('a'))[0].accessToken).toBeNull();
  });
  it('keeps identities unavailable after client ownership changes or campaign deletion', async () => {
    const a = await reserve(); await complete(a);
    await pool.query("UPDATE campaigns SET status='deleted' WHERE id='a'"); expect(await storage.getGoogleSheetsClientServiceAccount('a', a.spreadsheetId)).toBeUndefined();
    await pool.query("UPDATE clients SET owner_id='owner-b' WHERE id='client-a'"); expect(await storage.getGoogleSheetsClientServiceAccount('a2', a.spreadsheetId)).toBeUndefined();
    expect((await pool.query('SELECT count(*) FROM google_sheets_client_service_accounts')).rows[0].count).toBe('1');
  });
  it('does not transfer an identity after rename, or collide for identically named clients', async () => {
    const a = await reserve(); await complete(a); await pool.query("UPDATE clients SET name='Acme' WHERE id='client-b'");
    expect((await reserve('b','owner-b')).email).not.toBe(a.email);
    await pool.query("UPDATE clients SET name='Renamed' WHERE id='client-a'"); expect((await reserve()).email).toBe(a.email);
    await expect(complete(a,'a','owner-a','222')).rejects.toThrow();
  });
  it('runs the additive migration twice without changing legacy connections', async () => {
    await database.current.insert(schema.googleSheetsConnections).values({ campaignId: 'a', spreadsheetId: 'legacy-sheet', method: 'oauth', accessToken: 'synthetic' });
    const before = (await pool.query('SELECT to_jsonb(t) AS row FROM google_sheets_connections t')).rows;
    await pool.query(migration); await pool.query(migration);
    expect((await pool.query('SELECT to_jsonb(t) AS row FROM google_sheets_connections t')).rows).toEqual(before);
  });
});
