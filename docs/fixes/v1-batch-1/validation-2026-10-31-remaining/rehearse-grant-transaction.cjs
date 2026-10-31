const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict'), { Client } = require('pg');
const { run } = require('./grant-transaction.cjs');
const schema = 'b1_grant_' + crypto.randomUUID().replaceAll('-', ''), clients = [];
const receipt = { at: new Date().toISOString(), result: 'NOT_VERIFIED', productionAccess: false };
(async () => {
  let admin;
  try {
    assert.equal(process.env.DATABASE_URL || '', '');
    admin = new Client({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test' }); await admin.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    for (let i = 0; i < 2; i++) { const client = new Client({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test', options: `-c search_path=${schema}` }); clients.push(client); await client.connect(); }
    await clients[0].query('CREATE TABLE clients(id text PRIMARY KEY,owner_id text NOT NULL,name text NOT NULL); CREATE TABLE campaigns(id text PRIMARY KEY,owner_id text,client_id text REFERENCES clients(id),name text NOT NULL,platform text,status text,currency text); CREATE TABLE service_account_resource_grants(id text PRIMARY KEY DEFAULT gen_random_uuid()::text,owner_id text NOT NULL,client_id text NOT NULL REFERENCES clients(id),provider text NOT NULL,resource_id text NOT NULL,UNIQUE(owner_id,client_id,provider,resource_id))');
    receipt.acceptance = await run(...clients);
    await assert.rejects(run(...clients, { failAfterSeed: true }), error => error.code === 'INJECTED_AFTER_SEED');
    for (const table of ['clients', 'campaigns', 'service_account_resource_grants']) assert.equal((await clients[1].query(`SELECT count(*)::int n FROM ${table}`)).rows[0].n, 0);
    receipt.injectedFailureRolledBack = true; receipt.result = 'PASS';
  } catch (error) { receipt.errorCode = error.code || error.name; console.error(error); process.exitCode = 1; }
  finally {
    for (const client of clients) await client.end().catch(() => {});
    if (admin) { await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.end(); }
    fs.writeFileSync(path.join(__dirname, 'grant-transaction-local.json'), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify(receipt));
  }
})();
