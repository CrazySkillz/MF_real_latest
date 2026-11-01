// Preparation only: exact known database, verified TLS and enforced READ ONLY.
// No app startup, provider/Clerk calls, credentials returned or database writes.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util');
const { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const originalOwner = 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U';
const productionOwner = process.argv[2] || null;
const receipt = {
  at: new Date().toISOString(), result: 'NOT_VERIFIED', databaseWritesAttempted: false,
  credentialValuesReturned: false, originalOwnerSha256: hash(originalOwner),
  productionOwnerSupplied: Boolean(productionOwner),
};
let client;
(async () => {
  if (productionOwner) {
    assert.match(productionOwner, /^user_[A-Za-z0-9]{10,80}$/);
    assert.notEqual(productionOwner, originalOwner);
    receipt.productionOwnerSha256 = hash(productionOwner);
  }
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])),
    '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true },
    application_name: 'clerk-cutover-owner-read-only', options: '-c default_transaction_read_only=on',
    connectionTimeoutMillis: 10000, statement_timeout: 10000, query_timeout: 12000,
    idle_in_transaction_session_timeout: 30000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  receipt.databaseReadOnly = true;
  const promo = (await client.query(
    'SELECT id, client_id, name, owner_id FROM campaigns WHERE id=$1',
    ['b74f98af-ede9-47af-9b19-0720ebb4d2c0'])).rows;
  assert.equal(promo.length, 1);
  assert.equal(promo[0].name, 'Promo');
  assert.equal(promo[0].owner_id, originalOwner);
  assert.equal(promo[0].client_id, '861d3921-1903-491c-8ec3-57c0f6d05e92');
  receipt.clients = (await client.query('SELECT id,name,owner_id FROM clients ORDER BY id')).rows
    .map(({ owner_id, ...row }) => ({ ...row, originalOwner: owner_id === originalOwner,
      ownerSha256: hash(owner_id) }));
  receipt.visibleCampaigns = (await client.query(`SELECT c.id,c.name,c.status,c.client_id,
    c.owner_id,c.owner_id=cl.owner_id AS parent_owner_matches
    FROM campaigns c JOIN clients cl ON cl.id=c.client_id ORDER BY c.id`)).rows
    .map(({ owner_id, ...row }) => ({ ...row, originalOwner: owner_id === originalOwner,
      ownerSha256: hash(owner_id) }));
  receipt.unparentedCampaigns = (await client.query(`SELECT count(*)::int AS total,
    count(*) FILTER(WHERE c.owner_id=$1)::int AS original_owner_count
    FROM campaigns c LEFT JOIN clients cl ON cl.id=c.client_id WHERE cl.id IS NULL`, [originalOwner])).rows[0];
  receipt.secondOwnerHistoricalCampaigns = (await client.query(`SELECT c.id,c.name,c.status,c.client_id,
    c.owner_id=sample.owner_id AS second_owner FROM campaigns c
    JOIN campaigns sample ON sample.id='36631f9f-5f32-4ae6-8d20-d8430abb364c'
    LEFT JOIN clients cl ON cl.id=c.client_id WHERE cl.id IS NULL AND c.owner_id=sample.owner_id ORDER BY c.id`)).rows;
  const references = (await client.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema='public' AND column_name IN ('owner_id','user_id','created_by','actor_id')
    ORDER BY table_name,column_name`)).rows;
  receipt.identityReferences = [];
  for (const { table_name: table, column_name: column } of references) {
    assert.match(table, /^[a-z_]+$/); assert.match(column, /^[a-z_]+$/);
    const counts = (await client.query(`SELECT count(*)::int AS total,
      count(*) FILTER(WHERE "${column}"=$1)::int AS original_owner_count,
      count(*) FILTER(WHERE "${column}"=$2)::int AS production_owner_count,
      count(*) FILTER(WHERE NULLIF("${column}",'') IS NULL)::int AS unowned_count
      FROM "${table}"`, [originalOwner, productionOwner])).rows[0];
    receipt.identityReferences.push({ table, column, ...counts,
      production_owner_count: productionOwner ? counts.production_owner_count : null });
  }
  receipt.originalClientChildren = {};
  for (const table of ['campaign_creation_requests', 'service_account_resource_grants']) {
    receipt.originalClientChildren[table] = (await client.query(`SELECT t.id,t.client_id,
      t.owner_id=$1 AS original_owner, t.owner_id=cl.owner_id AS parent_owner_matches
      FROM "${table}" t JOIN clients cl ON cl.id=t.client_id WHERE cl.owner_id=$1 ORDER BY t.id`,
    [originalOwner])).rows;
  }
  receipt.refreshWork = (await client.query(`SELECT w.campaign_id,w.status,
    w.scope->>'kind' AS kind,w.scope->'campaign'->>'ownerId'=$1 AS original_scope_owner,
    w.scope_hash LIKE 'invalidated:%' AS invalidated,
    w.lease_token IS NOT NULL AS has_lease,w.lease_expires_at>now() AS unexpired_lease,
    count(*)::int AS rows FROM ga4_refresh_work w JOIN campaigns c ON c.id=w.campaign_id
    JOIN clients cl ON cl.id=c.client_id AND cl.owner_id=c.owner_id WHERE c.owner_id=$1
    GROUP BY w.campaign_id,w.status,w.scope->>'kind',w.scope->'campaign'->>'ownerId'=$1,w.scope_hash LIKE 'invalidated:%',
      w.lease_token IS NOT NULL,w.lease_expires_at>now() ORDER BY w.campaign_id,w.status`, [originalOwner])).rows;
  await client.query('ROLLBACK');
  receipt.rolledBack = true;
  receipt.result = 'PASS_READ_ONLY_INVENTORY';
  receipt.limits = 'No ownership migration authorized or performed by this reader. IDs identify candidate rows, not approval to change them. Serialized references, refresh-work compatibility, live environment grants and external website ownership require disposition before any write. Production user existence/email is not verified by database counts.';
})().catch(error => {
  receipt.errorCode = error.code || error.name;
  process.exitCode = 1;
}).finally(async () => {
  if (client) await client.end().catch(() => {});
  const filename = 'owner-scope-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, filename }, null, 2));
});
