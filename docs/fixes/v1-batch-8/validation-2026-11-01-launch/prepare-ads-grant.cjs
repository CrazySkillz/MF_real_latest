// Fixed-scope operator operation for the test account the user supplied.
// Default: one uncommitted permission insert, rolled back. --apply requires its exact preflight.
// No provider calls, application imports, schema changes or connection/analytics writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const grant = { ownerId: 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl', clientId: 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220', provider: 'google_ads', resourceId: '4951281615' };
const campaignId = '36631f9f-5f32-4ae6-8d20-d8430abb364c', runtime = 'b2bfe6cc5bd5151d42ad000a153620ec984d7360';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const apply = process.argv.includes('--apply'), sourceHash = hash(fs.readFileSync(__filename));
const values = [grant.ownerId, grant.clientId, grant.provider, grant.resourceId];
const exact = 'SELECT id,owner_id,client_id,provider,resource_id FROM service_account_resource_grants WHERE owner_id=$1 AND client_id=$2 AND provider=$3 AND resource_id=$4';
const receipt = { at: new Date().toISOString(), mode: apply ? 'apply' : 'rollback_preflight', grant, sourceHash, committed: false, providerCalls: 0, analyticsWrites: 0, connectionWrites: 0, result: 'CHECK_REQUIRED' };
let db;
(async () => {
  assert.ok(process.argv.slice(2).every(value => value === '--apply'));
  if (apply) {
    const preflight = JSON.parse(fs.readFileSync(path.join(__dirname, 'ads-grant-preflight.json'), 'utf8'));
    assert.equal(preflight.result, 'PASS'); assert.equal(preflight.rolledBack, true);
    assert.equal(preflight.sourceHash, sourceHash); assert.deepEqual(preflight.grant, grant);
    assert.ok(Date.now() - Date.parse(preflight.at) < 24 * 60 * 60 * 1000);
  }
  const response = await fetch('https://app.mimosaas.app/api/health', { redirect: 'error', signal: AbortSignal.timeout(20000) });
  const health = await response.json(); assert.equal(response.status, 200); assert.equal(health.ok, true); assert.equal(health.commit, runtime);
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'launch-exact-test-ads-grant', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  await db.query("SET LOCAL lock_timeout='3s'"); await db.query("SET LOCAL idle_in_transaction_session_timeout='30s'");
  const rows = (await db.query('SELECT c.owner_id,c.client_id,c.name,c.status,cl.owner_id AS client_owner,cl.name AS client_name FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1 FOR SHARE OF c,cl', [campaignId])).rows;
  assert.equal(rows.length, 1); const scope = rows[0];
  assert.equal(scope.owner_id, grant.ownerId); assert.equal(scope.client_owner, grant.ownerId); assert.equal(scope.client_id, grant.clientId);
  assert.equal(scope.name, 'Batch 1 Provider Check'); assert.equal(scope.client_name, 'Batch 1 Validation'); assert.equal(scope.status, 'active');
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.service_account_resource_grants'::regclass AND NOT tgisinternal")).rows[0].n, 0);
  const before = (await db.query(exact, values)).rows; assert.ok(before.length <= 1);
  const inserted = await db.query('INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,client_id,provider,resource_id) DO NOTHING RETURNING id', values);
  assert.equal(inserted.rowCount, before.length ? 0 : 1);
  const after = (await db.query(exact, values)).rows; assert.equal(after.length, 1);
  assert.deepEqual([after[0].owner_id,after[0].client_id,after[0].provider,after[0].resource_id], values);
  receipt.grantId = after[0].id; receipt.insertedRows = inserted.rowCount;
  await db.query(apply ? 'COMMIT' : 'ROLLBACK'); receipt.committed = apply; receipt.rolledBack = !apply;
  // A new transaction proves either the exact committed binding or complete rollback.
  await db.query('BEGIN READ ONLY');
  const verified = (await db.query(exact, values)).rows;
  assert.deepEqual(verified, apply ? after : before);
  await db.query('ROLLBACK'); receipt.independentTransactionVerified = true; receipt.result = 'PASS';
})().catch(error => { receipt.errorCode = /^[A-Z0-9_]+$/.test(String(error.code || '')) ? error.code : error.name; process.exitCode = 1; })
.finally(async () => {
  if (db) { await db.query('ROLLBACK').catch(() => {}); await db.end().catch(() => {}); }
  const file = apply ? 'ads-grant-applied-' + receipt.at.replace(/[:.]/g, '-') + '.json' : 'ads-grant-preflight.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n');
  console.log(JSON.stringify({ ...receipt, file }));
});
