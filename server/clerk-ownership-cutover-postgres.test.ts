import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';
import { getTableColumns, getTableName, SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import * as schema from '../shared/schema';
const database = vi.hoisted(() => ({ current: null as any }));
vi.mock('./db', () => ({ get db() { return database.current; }, pool: null }));
import { DatabaseStorage } from './storage';
const { capture, transfer } = createRequire(import.meta.url)('../docs/fixes/v1-batch-8/validation-2026-11-01-clerk-cutover/ownership-transfer.cjs');
const testUrl = process.env.GA4_TEST_DATABASE_URL || '';
if (testUrl) {
  const url = new URL(testUrl);
  if (url.hostname !== '127.0.0.1' || url.pathname !== '/ga4_alignment_test' || url.search || process.env.DATABASE_URL)
    throw Error('Only isolated local PostgreSQL is permitted');
}
const namespace = `clerk_cutover_${randomUUID().replace(/-/g, '')}`;
const mappings = [
  { from: 'user_original00001', to: 'user_production001' },
  { from: 'user_second000001', to: 'user_production002' },
];
const exclusions = ['historical'];
const storage = new DatabaseStorage();
let admin: Pool, pool: Pool, created = false;
const plan = async () => capture(pool, mappings, exclusions);
async function execute(packet: any, options: any = {}) {
  const client = await pool.connect();
  try { return await transfer(client, packet, options); } finally { client.release(); }
}
async function allRows() {
  const tables = (await pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [namespace])).rows;
  const result: any = {};
  for (const { tablename } of tables) result[tablename] = (await pool.query(`SELECT to_jsonb(t) AS row FROM "${tablename}" t ORDER BY id`)).rows;
  return result;
}
describe.skipIf(!testUrl)('one-time two-account Clerk ownership transfer', () => {
  beforeAll(async () => {
    admin = new Pool({ connectionString: testUrl });
    await admin.query(`CREATE SCHEMA "${namespace}"`); created = true;
    pool = new Pool({ connectionString: testUrl, options: `-c search_path=${namespace} -c timezone=UTC`, max: 5 });
    database.current = drizzle(pool, { schema });
    const dialect = new PgDialect();
    for (const table of [schema.clients, schema.campaigns, schema.campaignCreationRequests, schema.serviceAccountResourceGrants, schema.ga4Connections]) {
      const columns = Object.values(getTableColumns(table)).map((column: any) => {
        const value = column.default;
        const d = value instanceof SQL ? dialect.sqlToQuery(value).sql : typeof value === 'string' ? `'${value.replace(/'/g, "''")}'` : String(value);
        return `"${column.name}" ${column.getSQLType()}${column.notNull ? ' NOT NULL' : ''}${value !== undefined ? ` DEFAULT ${d}` : ''}${column.primary ? ' PRIMARY KEY' : ''}`;
      });
      await pool.query(`CREATE TABLE "${getTableName(table)}" (${columns.join(',')})`);
    }
    await pool.query('ALTER TABLE campaigns ADD FOREIGN KEY(client_id) REFERENCES clients(id)');
    await pool.query('CREATE UNIQUE INDEX request_identity ON campaign_creation_requests(owner_id,client_id,request_id)');
    await pool.query('CREATE UNIQUE INDEX grant_identity ON service_account_resource_grants(owner_id,client_id,provider,resource_id)');
    for (const [table, cols] of Object.entries({ ab_test_events: 'user_id text', attribution_models: 'owner_id text',
      customer_journeys: 'owner_id text,user_id text', integrations: 'owner_id text', mapping_templates: 'created_by text',
      metrics: 'owner_id text', mimosaas_website_connections: 'owner_id text', performance_data: 'owner_id text' })) {
      await pool.query(`CREATE TABLE ${table}(id text PRIMARY KEY,${cols},payload jsonb)`);
    }
    for (const file of ['0020_add_ga4_refresh_work.sql', '0021_add_ga4_refresh_recovery.sql'])
      await pool.query(readFileSync(new URL(`../migrations/${file}`, import.meta.url), 'utf8'));
  });
  afterAll(async () => {
    await pool?.end();
    if (created) await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await admin?.end();
  });
  beforeEach(async () => {
    const names = (await pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1', [namespace])).rows;
    await pool.query(`TRUNCATE ${names.map(r => `"${r.tablename}"`).join(',')} CASCADE`);
    for (const [id, owner] of [['a', mappings[0].from], ['b', mappings[1].from], ['empty', mappings[0].from]]) {
      await pool.query('INSERT INTO clients(id,owner_id,name) VALUES($1,$2,$1)', [id, owner]);
    }
    for (const [id, clientId, owner] of [['a', 'a', mappings[0].from], ['a2', 'a', mappings[0].from], ['b', 'b', mappings[1].from],
      ['historical', null, mappings[1].from], ['foreign', null, 'user_foreign00001'], ['unowned', null, null]]) {
      await pool.query("INSERT INTO campaigns(id,name,client_id,owner_id,currency,spend,ga4_campaign_filter) VALUES($1::text,$1::text,$2,$3,'EUR',785.95,'selected-campaign')", [id, clientId, owner]);
    }
    for (let i = 0; i < 5; i++) await pool.query('INSERT INTO campaign_creation_requests(id,client_id,owner_id,request_id) VALUES($1::text,$2,$3,$1::text)',
      [`request-${i}`, i < 4 ? 'a' : 'b', mappings[i < 4 ? 0 : 1].from]);
    await pool.query("INSERT INTO service_account_resource_grants(id,client_id,owner_id,provider,resource_id) VALUES('grant','a',$1,'ga4','123')", [mappings[0].from]);
    await pool.query("INSERT INTO ga4_connections(id,campaign_id,property_id,method,access_token,is_active,is_primary) VALUES('connection','a','123','access_token','enc:v1:unchanged',true,true)");
    await pool.query("INSERT INTO mimosaas_website_connections VALUES('website',$1,'{\"token\":\"preserve\"}')", [mappings[0].from]);
    await pool.query("INSERT INTO metrics VALUES('unowned-metric',NULL,'{\"revenue\":31000}')");
    await pool.query(`INSERT INTO ga4_refresh_work(id,campaign_id,due_at,reporting_date,scope_hash,scope,status,completed_at)
      VALUES('completed','a',now()-interval '2 days','2026-10-30','historical-hash',$1,'completed',now()),
      ('invalidated','a',now()-interval '1 day','2026-10-31','invalidated:old',$1,'pending',NULL)`,
    [JSON.stringify({ campaign: { ownerId: mappings[0].from }, version: 1 })]);
  });
  it('moves exactly 12 references, keeps accounts separate, preserves all other data, and reverses exactly', async () => {
    const before = await allRows(), packet = await plan();
    const result = await execute(packet, { commit: true, beforeCommit: async () => {} });
    expect(result.changed).toBe(12);
    expect((await storage.getClients(mappings[0].to)).map(c => c.id).sort()).toEqual(['a', 'empty']);
    expect((await storage.getClients(mappings[1].to)).map(c => c.id)).toEqual(['b']);
    expect(await storage.getClients(mappings[0].from)).toEqual([]);
    const after = await allRows();
    for (const table of Object.keys(after)) {
      for (const entry of after[table]) {
        const original = before[table].find((r: any) => r.row.id === entry.row.id).row;
        const target = packet.rows[table]?.find((r: any) => r.id === entry.row.id);
        expect(entry.row).toEqual(target ? { ...original, owner_id: mappings.find(m => m.from === original.owner_id)!.to } : original);
      }
    }
    await execute(result.rollbackPlan, { commit: true, beforeCommit: async () => {} });
    expect(await allRows()).toEqual(before);
  });
  it('defaults to rollback even when every update succeeds', async () => {
    const before = await allRows();
    expect((await execute(await plan())).result).toBe('REHEARSAL_ROLLED_BACK');
    expect(await allRows()).toEqual(before);
  });
  it('allows the existing scheduler to create work for the new owner and rejects the old owner', async () => {
    await execute(await plan(), { commit: true, beforeCommit: async () => {} });
    const due = new Date(Date.now() - 1000);
    expect(await storage.ensureGA4RefreshWork('a', mappings[0].from, due, '2026-11-01')).toBeUndefined();
    const work = await storage.ensureGA4RefreshWork('a', mappings[0].to, due, '2026-11-01');
    expect(work?.scope.campaign.ownerId).toBe(mappings[0].to);
    expect(await storage.claimGA4RefreshWork('a', mappings[1].to, work!.id, 60000)).toBeUndefined();
    expect(await storage.claimGA4RefreshWork('a', mappings[0].to, work!.id, 60000)).toMatchObject({ status: 'running' });
  });
  for (const [name, mutation] of [
    ['wrong parent owner', "UPDATE campaigns SET client_id='b' WHERE id='a'"],
    ['extra owned row', "INSERT INTO clients(id,name,owner_id) SELECT 'extra','extra',owner_id FROM clients WHERE id='a'"],
    ['missing reviewed row', "DELETE FROM campaign_creation_requests WHERE id='request-0'"],
    ['changed financial data', "UPDATE campaigns SET spend=999 WHERE id='a'"],
    ['historical row attached to a client', "UPDATE campaigns SET client_id='b' WHERE id='historical'"],
    ['unexpected identity column', 'ALTER TABLE metrics ADD COLUMN actor_id text'],
  ]) it(`aborts on ${name} without any partial transfer`, async () => {
    const packet = await plan();
    await pool.query(mutation);
    const before = await allRows();
    try { await expect(execute(packet)).rejects.toThrow(); expect(await allRows()).toEqual(before); }
    finally { if (name === 'unexpected identity column') await pool.query('ALTER TABLE metrics DROP COLUMN actor_id'); }
  });
  it('refuses destination collisions and unmapped owner references', async () => {
    await pool.query("INSERT INTO integrations VALUES('occupied',$1,NULL)", [mappings[1].to]);
    await expect(plan()).rejects.toThrow('Destination already owns');
    await pool.query('UPDATE integrations SET owner_id=$1', [mappings[0].from]);
    await expect(plan()).rejects.toThrow('Unplanned identity');
  });
  for (const running of [false, true]) it(`refuses ${running ? 'running' : 'pending'} work even when it appears after planning`, async () => {
    const packet = await plan();
    const work = await storage.ensureGA4RefreshWork('a', mappings[0].from, new Date(Date.now() - 1000), '2026-11-01');
    if (running) await storage.claimGA4RefreshWork('a', mappings[0].from, work!.id, 60000);
    const before = await allRows();
    await expect(execute(packet)).rejects.toThrow('Unfinished refresh');
    expect(await allRows()).toEqual(before);
  });
  it('rolls back all updates if durable rollback receipt saving fails', async () => {
    const before = await allRows();
    await expect(execute(await plan(), { commit: true, beforeCommit: async () => { throw Error('disk failure'); } })).rejects.toThrow('disk failure');
    expect(await allRows()).toEqual(before);
  });
  it('rolls back a failure midway through the ownership updates', async () => {
    const packet = await plan(), before = await allRows(), client = await pool.connect();
    let updates = 0;
    try {
      const wrapped = { query: (...args: any[]) => {
        if (String(args[0]).startsWith('UPDATE') && ++updates === 3) throw Error('injected transaction failure');
        return (client.query as any)(...args);
      } };
      await expect(transfer(wrapped, packet)).rejects.toThrow('injected transaction failure');
    } finally { client.release(); }
    expect(await allRows()).toEqual(before);
  });
});
