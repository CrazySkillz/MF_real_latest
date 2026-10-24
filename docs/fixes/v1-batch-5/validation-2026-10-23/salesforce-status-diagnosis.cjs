// Exact reported test campaign only; read-only metadata, never credentials or token renewal.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const output = `${__dirname}/salesforce-status-diagnosis.json`;
assert.ok(!fs.existsSync(output));
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', databaseWrites: false, providerCalls: false, credentialReads: false };
let db;
(async () => {
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json(); result.live = { status: response.status, ok: health.ok, commit: health.commit };
  assert.equal(response.status, 200);
  const env = parseEnv(fs.readFileSync('.env', 'utf8')), url = new URL(env.DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-salesforce-status-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const campaigns = (await db.query('SELECT id, currency, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1); const campaign = campaigns[0]; assert.equal(campaign.owned, true);
  assert.equal(hash(campaign.id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  result.campaign = { ref: hash(campaign.id), currency: campaign.currency };
  const rows = (await db.query(`SELECT id,is_active,connected_at,expires_at,
    NULLIF(instance_url,'') IS NOT NULL AS has_instance_url, NULLIF(client_id,'') IS NOT NULL AS has_client_id,
    NULLIF(access_token,'') IS NOT NULL AS has_plain_access, NULLIF(refresh_token,'') IS NOT NULL AS has_plain_refresh,
    NULLIF(client_secret,'') IS NOT NULL AS has_plain_client_secret,
    NULLIF(encrypted_tokens->'accessToken'->>'data','') IS NOT NULL AS has_encrypted_access,
    NULLIF(encrypted_tokens->'refreshToken'->>'data','') IS NOT NULL AS has_encrypted_refresh,
    NULLIF(encrypted_tokens->'clientSecret'->>'data','') IS NOT NULL AS has_encrypted_client_secret
    FROM salesforce_connections WHERE campaign_id=$1 ORDER BY connected_at DESC`, [campaign.id])).rows;
  result.connections = rows.map(({ id, ...metadata }) => ({ ref: hash(id), ...metadata }));
  result.sources = (await db.query(`SELECT id,is_active,platform_context,currency,mapping_config::jsonb->>'lastSyncedAt' AS last_synced_at,
    mapping_config::jsonb->>'pipelineLastUpdatedAt' AS pipeline_last_updated_at, mapping_config::jsonb->>'lastTotalRevenue' AS last_total_revenue
    FROM revenue_sources WHERE campaign_id=$1 AND source_type='salesforce'`, [campaign.id])).rows.map(({ id, ...metadata }) => ({ ref: hash(id), ...metadata }));
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_CHECK_COMPLETE';
})().catch(error => { result.result = 'CHECK_INCOMPLETE'; result.errorCode = error.code || error.name; process.exitCode = 1; })
  .finally(async () => { if (db) await db.end().catch(() => {}); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result)); });
