// Exact existing test-resource permissions for the user-requested service-account alternative.
// Default rehearses and rolls back. --apply requires the same source and successful rehearsal.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const owner = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl', clientId = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220';
const reference = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
const grants = [
  { provider: 'ga4', resourceId: '542352127', table: 'ga4_connections', column: 'property_id' },
  { provider: 'google_sheets', resourceId: '1VMN6f089lsPISQ80pxT8Sq4awNU71-jQh5OgyFTXSeU', table: 'google_sheets_connections', column: 'spreadsheet_id' },
];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const sourceHash = hash(fs.readFileSync(__filename)), apply = process.argv.includes('--apply');
const receipt = { at: new Date().toISOString(), mode: apply ? 'apply' : 'rollback_preflight', ownerId: owner, clientId, sourceHash,
  result: 'CHECK_REQUIRED', committed: false, grants: [], providerCalls: 0, analyticsWrites: 0, connectionWrites: 0 };
const exact = 'SELECT id,owner_id,client_id,provider,resource_id FROM service_account_resource_grants WHERE owner_id=$1 AND client_id=$2 AND provider=$3 AND resource_id=$4';
let db;
(async () => {
  assert.ok(process.argv.slice(2).every(arg => arg === '--apply'));
  if (apply) {
    const p = JSON.parse(fs.readFileSync(path.join(__dirname, 'google-test-grants-preflight.json'), 'utf8'));
    assert.equal(p.result, 'PASS'); assert.equal(p.rolledBack, true); assert.equal(p.sourceHash, sourceHash);
    assert.equal(p.ownerId, owner); assert.equal(p.clientId, clientId); assert.ok(Date.now() - Date.parse(p.at) < 86400000);
  }
  const health = await fetch('https://app.mimosaas.app/api/health', { redirect: 'error', signal: AbortSignal.timeout(20000) });
  const data = await health.json(); assert.equal(health.status, 200); assert.equal(data.ok, true);
  assert.equal(data.commit, 'b2bfe6cc5bd5151d42ad000a153620ec984d7360');
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'launch-exact-google-test-grants',
    connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000, idle_in_transaction_session_timeout: 30000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL SERIALIZABLE'); await db.query("SET LOCAL lock_timeout='3s'");
  const rows = (await db.query('SELECT c.owner_id,c.client_id,c.name,c.status,cl.owner_id AS client_owner,cl.name AS client_name FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1 FOR SHARE OF c,cl', [reference])).rows;
  assert.equal(rows.length, 1); const c = rows[0];
  assert.equal(c.owner_id, owner); assert.equal(c.client_owner, owner); assert.equal(c.client_id, clientId);
  assert.equal(c.name, 'Batch 1 Provider Check'); assert.equal(c.client_name, 'Batch 1 Validation'); assert.equal(c.status, 'active');
  assert.equal((await db.query("SELECT count(*)::int n FROM pg_trigger WHERE tgrelid='public.service_account_resource_grants'::regclass AND NOT tgisinternal")).rows[0].n, 0);
  const snapshots = [];
  for (const grant of grants) {
    const connections = (await db.query(`SELECT ${grant.column} AS resource_id,method FROM ${grant.table} WHERE campaign_id=$1 AND is_active=true FOR SHARE`, [reference])).rows;
    assert.deepEqual(connections, [{ resource_id: grant.resourceId, method: 'access_token' }]);
    const values = [owner, clientId, grant.provider, grant.resourceId];
    const before = (await db.query(exact, values)).rows; assert.ok(before.length <= 1);
    const inserted = await db.query('INSERT INTO service_account_resource_grants(owner_id,client_id,provider,resource_id) VALUES($1,$2,$3,$4) ON CONFLICT(owner_id,client_id,provider,resource_id) DO NOTHING RETURNING id', values);
    assert.equal(inserted.rowCount, before.length ? 0 : 1);
    const after = (await db.query(exact, values)).rows; assert.equal(after.length, 1);
    assert.deepEqual([after[0].owner_id,after[0].client_id,after[0].provider,after[0].resource_id], values);
    snapshots.push({ values, before, after });
    receipt.grants.push({ provider: grant.provider, resourceId: grant.resourceId, grantId: after[0].id, insertedRows: inserted.rowCount });
  }
  await db.query(apply ? 'COMMIT' : 'ROLLBACK'); receipt.committed = apply; receipt.rolledBack = !apply;
  await db.query('BEGIN READ ONLY');
  for (const s of snapshots) assert.deepEqual((await db.query(exact, s.values)).rows, apply ? s.after : s.before);
  await db.query('ROLLBACK'); receipt.independentTransactionVerified = true; receipt.result = 'PASS';
})().catch(error => { receipt.errorCode = /^[A-Z0-9_]+$/.test(String(error.code || '')) ? error.code : error.name; process.exitCode = 1; })
.finally(async () => {
  if (db) { await db.query('ROLLBACK').catch(() => {}); await db.end().catch(() => {}); }
  const file = apply ? 'google-test-grants-applied-' + receipt.at.replace(/[:.]/g, '-') + '.json' : 'google-test-grants-preflight.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n'); console.log(JSON.stringify({ ...receipt, file }));
});
