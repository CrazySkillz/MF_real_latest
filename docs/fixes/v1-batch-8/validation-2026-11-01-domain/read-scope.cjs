// Exact second-account test scope only; no credentials, application imports or writes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const owner = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl';
const existingId = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
const receipt = { at: new Date().toISOString(), databaseWritesAttempted: false, credentialValuesReturned: false };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'domain-authorization-read-only', options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000, idle_in_transaction_session_timeout: 60000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  receipt.databaseReadOnly = true;
  const drafts = (await client.query(`SELECT c.id,c.client_id,c.name,c.status,c.created_at FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.name=$1 AND c.owner_id=$2 AND cl.owner_id=$2 AND cl.name=$3`, ['Domain Connection Check', owner, 'Batch 1 Validation'])).rows;
  const reviewedIds = ['815d0cf6-1de9-466f-a226-a66e429bf812', '519ee09b-b509-4162-b716-3d8a5395f2dc'];
  assert.ok(drafts.length >= 1 && drafts.length <= 2, 'Expected a surviving reviewed test draft');
  assert.ok(drafts.every(draft => reviewedIds.includes(draft.id) && draft.status === 'draft'));
  receipt.drafts = drafts;
  const existing = (await client.query(`SELECT c.id,c.client_id,c.name,c.status,c.currency FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1 AND c.owner_id=$2 AND cl.owner_id=$2 AND cl.name=$3`, [existingId, owner, 'Batch 1 Validation'])).rows;
  assert.equal(existing.length, 1);
  assert.equal(existing[0].name, 'Batch 1 Provider Check');
  assert.equal(existing[0].status, 'active');
  assert.ok(drafts.every(draft => draft.client_id === existing[0].client_id));
  receipt.existing = existing[0];
  receipt.ownerSha256 = hash(owner);
  for (const draft of drafts) {
    draft.pendingGoogle = (await client.query(`SELECT id,is_active,property_id,property_name,encrypted_tokens IS NOT NULL AS encrypted FROM ga4_connections WHERE campaign_id=$1`, [draft.id])).rows;
    assert.ok(draft.pendingGoogle.length <= 1);
    assert.ok(draft.pendingGoogle.every(row => !row.is_active && row.property_id === '' && row.property_name === 'Pending OAuth' && row.encrypted));
    draft.content = (await client.query(`SELECT (SELECT count(*)::int FROM revenue_sources WHERE campaign_id=$1) AS revenue_sources,(SELECT count(*)::int FROM spend_sources WHERE campaign_id=$1) AS spend_sources,(SELECT count(*)::int FROM ga4_daily_metrics WHERE campaign_id=$1) AS daily_metrics,(SELECT count(*)::int FROM ga4_refresh_work WHERE campaign_id=$1 AND scope->>'kind'='initial_import') AS initial_imports`, [draft.id])).rows[0];
    assert.ok(Object.values(draft.content).every(value => value === 0));
    draft.hubspot = (await client.query(`SELECT id,is_active,encrypted_tokens IS NOT NULL AS encrypted,mapping_config IS NOT NULL AS has_mapping FROM hubspot_connections WHERE campaign_id=$1`, [draft.id])).rows;
    draft.salesforce = (await client.query(`SELECT id,is_active,encrypted_tokens IS NOT NULL AS encrypted,mapping_config IS NOT NULL AS has_mapping FROM salesforce_connections WHERE campaign_id=$1`, [draft.id])).rows;
  }
  assert.ok(drafts.reduce((count, draft) => count + draft.pendingGoogle.length, 0) <= 1);
  receipt.shopify = (await client.query(`SELECT id,lower(shop_domain) AS shop_domain,is_active,encrypted_tokens IS NOT NULL AS encrypted,mapping_config::jsonb->>'authType' AS auth_type,connected_at FROM shopify_connections WHERE campaign_id=$1 AND is_active=true`, [existingId])).rows;
  assert.equal(receipt.shopify.length, 1);
  assert.equal(receipt.shopify[0].auth_type, 'oauth');
  assert.equal(receipt.shopify[0].encrypted, true);
  assert.match(receipt.shopify[0].shop_domain, /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/);
  receipt.sources = (await client.query(`SELECT id,source_type,is_active,platform_context,currency,md5(coalesce(mapping_config,'')) AS mapping_hash FROM revenue_sources WHERE campaign_id=$1 ORDER BY id`, [existingId])).rows;
  receipt.records = (await client.query(`SELECT revenue_source_id,count(*)::int AS count,sum(revenue)::text AS total,md5(string_agg(row_to_json(r)::text,'|' ORDER BY id)) AS rows_hash FROM revenue_records r WHERE campaign_id=$1 GROUP BY revenue_source_id ORDER BY revenue_source_id`, [existingId])).rows;
  await client.query('ROLLBACK');
  receipt.result = 'PASS_EXACT_DOMAIN_SCOPE';
})().catch(error => { receipt.result = 'CHECK_REQUIRED'; receipt.errorCode = error.code || error.name; process.exitCode = 1; })
.finally(async () => {
  if (client) await client.end().catch(() => {});
  const filename = 'scope-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: receipt.result, filename, drafts: receipt.drafts?.map(draft => ({ id: draft.id, content: draft.content })), errorCode: receipt.errorCode }));
});
