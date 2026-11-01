// One reviewed disposable draft only. Default is read-only; no provider calls.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const mode = process.argv[2] || '--inspect';
assert.ok(['--inspect', '--apply', '--verify'].includes(mode));
const apply = mode === '--apply', verify = mode === '--verify';
const draftId = '519ee09b-b509-4162-b716-3d8a5395f2dc';
const clientId = 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220';
const ownerId = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl';
const baseline = JSON.parse(fs.readFileSync(path.join(__dirname, 'scope-2026-11-01T12-05-56-418Z.json')));
const expected = { hubspot_connections: '0786ac6c-d481-4ea4-8ccc-f450c5579e39', salesforce_connections: '3d37f999-69e8-4c9b-b7af-9e6796290567' };
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const receipt = { at: new Date().toISOString(), mode, draftId, databaseWritesAttempted: false, credentialValuesReturned: false };
const filename = path.join(__dirname, 'cleanup-' + receipt.at.replace(/[:.]/g, '-') + '.json');
let db;
async function preserve() {
  const existingId = baseline.existing.id;
  const campaign = (await db.query('SELECT id,client_id,name,status,currency FROM campaigns WHERE id=$1 AND owner_id=$2', [existingId, ownerId])).rows;
  assert.deepEqual(campaign, [baseline.existing]);
  const shopify = (await db.query(`SELECT id,lower(shop_domain) AS shop_domain,is_active,encrypted_tokens IS NOT NULL AS encrypted,mapping_config::jsonb->>'authType' AS auth_type,connected_at FROM shopify_connections WHERE campaign_id=$1 AND is_active=true`, [existingId])).rows;
  assert.deepEqual(JSON.parse(JSON.stringify(shopify)), baseline.shopify);
  const sources = (await db.query(`SELECT id,source_type,is_active,platform_context,currency,md5(coalesce(mapping_config,'')) AS mapping_hash FROM revenue_sources WHERE campaign_id=$1 ORDER BY id`, [existingId])).rows;
  const records = (await db.query(`SELECT revenue_source_id,count(*)::int AS count,sum(revenue)::text AS total,md5(string_agg(row_to_json(r)::text,'|' ORDER BY id)) AS rows_hash FROM revenue_records r WHERE campaign_id=$1 GROUP BY revenue_source_id ORDER BY revenue_source_id`, [existingId])).rows;
  assert.deepEqual(sources, baseline.sources); assert.deepEqual(records, baseline.records);
  return { existingCampaignUnchanged: true, currentShopifyPreserved: shopify[0].id, sourceConfigurationsUnchanged: sources.length, revenueRowsUnchanged: records.reduce((n, r) => n + r.count, 0) };
}
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'exact-domain-draft-cleanup', options: apply ? '' : '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000, idle_in_transaction_session_timeout: 60000 });
  await db.connect();
  await db.query(apply ? 'BEGIN ISOLATION LEVEL SERIALIZABLE' : 'BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  await db.query("SET LOCAL lock_timeout='3s'");
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, apply ? 'off' : 'on');
  const cl = (await db.query('SELECT id,name,owner_id FROM clients WHERE id=$1' + (apply ? ' FOR KEY SHARE' : ''), [clientId])).rows;
  assert.deepEqual(cl, [{ id: clientId, name: 'Batch 1 Validation', owner_id: ownerId }]);
  const requests = (await db.query('SELECT id,created,cancelled FROM campaign_creation_requests WHERE request_id=$1 AND owner_id=$2 AND client_id=$3' + (apply ? ' FOR UPDATE' : ''), [draftId, ownerId, clientId])).rows;
  assert.equal(requests.length, 1); assert.equal(requests[0].created, true); assert.equal(requests[0].cancelled, verify);
  receipt.creationRequest = requests[0];
  const drafts = (await db.query('SELECT id,client_id,owner_id,name,status,created_at FROM campaigns WHERE id=$1' + (apply ? ' FOR UPDATE' : ''), [draftId])).rows;
  assert.equal(drafts.length, verify ? 0 : 1);
  if (!verify) {
    const draft = drafts[0];
    assert.equal(draft.client_id, clientId); assert.equal(draft.owner_id, ownerId);
    assert.equal(draft.name, 'Domain Connection Check'); assert.equal(draft.status, 'draft');
    assert.equal(draft.created_at.toISOString(), '2026-11-01T10:35:38.632Z');
  }
  // Refuse unexpected children, including unimplemented/legacy campaign tables.
  const columns = (await db.query("SELECT c.table_name FROM information_schema.columns c JOIN information_schema.tables t USING(table_schema,table_name) WHERE c.table_schema='public' AND c.column_name='campaign_id' AND t.table_type='BASE TABLE' ORDER BY c.table_name")).rows;
  assert.ok(columns.length > 30);
  receipt.childCounts = {};
  for (const { table_name: table } of columns) {
    assert.match(table, /^[a-z_][a-z0-9_]*$/);
    const n = (await db.query(`SELECT count(*)::int n FROM public."${table}" WHERE campaign_id=$1`, [draftId])).rows[0].n;
    receipt.childCounts[table] = n;
    assert.equal(n, !verify && expected[table] ? 1 : 0, 'Unexpected child: ' + table);
  }
  for (const [table, id] of Object.entries(expected)) {
    assert.ok(Object.hasOwn(receipt.childCounts, table));
    const rows = (await db.query(`SELECT id,campaign_id,is_active,encrypted_tokens IS NOT NULL AS encrypted,mapping_config FROM public."${table}" WHERE id=$1` + (apply ? ' FOR UPDATE' : ''), [id])).rows;
    assert.deepEqual(rows, verify ? [] : [{ id, campaign_id: draftId, is_active: true, encrypted: true, mapping_config: null }]);
  }
  // No hidden trigger or foreign-key cascade outside the enumerated campaign columns.
  const tables = ['campaigns', 'campaign_creation_requests', ...Object.keys(expected)];
  assert.equal((await db.query('SELECT 1 FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname=ANY($2::text[]) AND NOT t.tgisinternal', ['public', tables])).rowCount, 0);
  const refs = (await db.query(`SELECT t.relname AS target,c.relname AS child,a.attname AS column_name,cardinality(f.conkey) AS columns FROM pg_constraint f JOIN pg_class t ON t.oid=f.confrelid JOIN pg_namespace n ON n.oid=t.relnamespace JOIN pg_class c ON c.oid=f.conrelid JOIN pg_attribute a ON a.attrelid=c.oid AND a.attnum=f.conkey[1] WHERE f.contype='f' AND n.nspname='public' AND t.relname=ANY($1::text[])`, [tables])).rows;
  assert.ok(refs.every(r => r.target === 'campaigns' && r.columns === 1 && r.column_name === 'campaign_id' && Object.hasOwn(receipt.childCounts, r.child)), 'Unexpected inbound foreign key');
  receipt.preservation = await preserve();
  if (apply) {
    receipt.databaseWritesAttempted = true;
    for (const [table, id] of Object.entries(expected)) {
      assert.equal((await db.query(`DELETE FROM public."${table}" WHERE id=$1 AND campaign_id=$2 AND is_active=true AND mapping_config IS NULL RETURNING id`, [id, draftId])).rowCount, 1);
    }
    assert.equal((await db.query("DELETE FROM campaigns WHERE id=$1 AND owner_id=$2 AND client_id=$3 AND name=$4 AND status='draft' RETURNING id", [draftId, ownerId, clientId, 'Domain Connection Check'])).rowCount, 1);
    // Preserve the normal wizard cancellation tombstone; prevent stale draft recreation.
    assert.equal((await db.query('UPDATE campaign_creation_requests SET cancelled=true WHERE id=$1 AND request_id=$2 AND owner_id=$3 AND client_id=$4 AND created=true AND cancelled=false RETURNING id', [requests[0].id, draftId, ownerId, clientId])).rowCount, 1);
    for (const { table_name: table } of columns) assert.equal((await db.query(`SELECT count(*)::int n FROM public."${table}" WHERE campaign_id=$1`, [draftId])).rows[0].n, 0);
    receipt.preservation = await preserve();
    receipt.commitAttemptPending = true;
    fs.writeFileSync(filename, JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx', flush: true });
    await db.query('COMMIT');
    receipt.committed = true; receipt.commitAttemptPending = false;
    receipt.result = 'PASS_EXACT_DRAFT_CLEANUP';
  } else {
    await db.query('ROLLBACK');
    receipt.result = verify ? 'PASS_INDEPENDENT_CLEANUP_VERIFICATION' : 'PASS_READ_ONLY_CLEANUP_PREFLIGHT';
  }
})().catch(async error => {
  if (db) await db.query('ROLLBACK').catch(() => {});
  receipt.result = 'CHECK_REQUIRED'; receipt.errorCode = error.code || error.name;
  process.exitCode = 1;
}).finally(async () => {
  if (db) await db.end().catch(() => {});
  fs.writeFileSync(filename, JSON.stringify(receipt, null, 2) + '\n', { flush: true });
  console.log(JSON.stringify({ result: receipt.result, filename: path.basename(filename), committed: receipt.committed, errorCode: receipt.errorCode }));
});
