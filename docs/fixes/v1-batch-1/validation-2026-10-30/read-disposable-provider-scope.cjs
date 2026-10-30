// Exact known database and named disposable scope; enforced READ ONLY metadata. No app/provider imports.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const receipt = { at: new Date().toISOString(), databaseWritesAttempted: false, credentialValuesReturned: false, applicationImports: false, checks: {} };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch1-test-scope-read-only', options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 25000, query_timeout: 28000, idle_in_transaction_session_timeout: 60000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  receipt.databaseReadOnly = true;
  const scopes = (await client.query(`SELECT c.id,c.name,c.status,c.currency,c.reporting_time_zone,c.created_at,cl.name AS client_name,c.owner_id=cl.owner_id AS consistent_owner,c.owner_id,cl.owner_id AS client_owner_id FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.name=$1 AND cl.name=$2 ORDER BY c.created_at`, ['Batch 1 Provider Check','Batch 1 Validation'])).rows;
  assert.ok(scopes.length <= 1, 'Ambiguous test scope');
  for (const row of scopes) {
    assert.equal(row.id,'36631f9f-5f32-4ae6-8d20-d8430abb364c');
    assert.ok(row.consistent_owner);
    assert.notEqual(hash(row.owner_id),'d57d0159277204eede2f1cb2ac0977958abab3f8bb21ee9a878a689aaf920a60');
    row.ownerSha256=hash(row.owner_id); delete row.owner_id; delete row.client_owner_id;
    row.connections=(await client.query(`SELECT id,method,property_id,is_active,encrypted_tokens IS NOT NULL AS encrypted_container_present,NULLIF(access_token,'') IS NOT NULL AS legacy_access_present,NULLIF(refresh_token,'') IS NOT NULL AS legacy_refresh_present FROM ga4_connections WHERE campaign_id=$1 ORDER BY created_at`,[row.id])).rows;
    row.hubspotConnections=(await client.query(`SELECT id,is_active,created_at,encrypted_tokens IS NOT NULL AS encrypted_container_present,NULLIF(access_token,'') IS NOT NULL AS legacy_access_present,NULLIF(refresh_token,'') IS NOT NULL AS legacy_refresh_present,NULLIF(client_secret,'') IS NOT NULL AS legacy_secret_present,mapping_config IS NOT NULL AS mapping_present FROM hubspot_connections WHERE campaign_id=$1 ORDER BY created_at`,[row.id])).rows;
    row.initialImport=(await client.query(`SELECT status,reporting_date,attempt_count,completed_at,retryable,scope_hash LIKE 'invalidated:%' AS invalidated,last_error IS NOT NULL AS has_error FROM ga4_refresh_work WHERE campaign_id=$1 AND scope->>'kind'='initial_import' ORDER BY due_at DESC,updated_at DESC LIMIT 1`,[row.id])).rows;
    row.dailyImport=(await client.query(`SELECT property_id,count(*)::int AS days,min(date) AS first_day,max(date) AS last_day,count(*) FILTER (WHERE is_simulated)::int AS simulated_days FROM ga4_daily_metrics WHERE campaign_id=$1 GROUP BY property_id ORDER BY property_id`,[row.id])).rows;
    row.overviewSnapshots=(await client.query(`SELECT property_id,window_start,window_end FROM ga4_overview_snapshots WHERE campaign_id=$1 ORDER BY property_id`,[row.id])).rows;
  }
  receipt.checks.disposableScope=scopes;
  await client.query('ROLLBACK');receipt.rolledBack=true;receipt.result='PASS';
  receipt.limits='Exact named test client/campaign metadata only; encryption-container presence does not prove decryption, consent or provider validity. No provider calls or writes.';
})().catch(error => { receipt.result = 'NOT_VERIFIED'; receipt.errorCode = error.code || error.name; process.exitCode = 1; })
.finally(async () => {
  if (client) await client.end().catch(() => {});
  const filename = 'disposable-scope-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, filename }));
});
