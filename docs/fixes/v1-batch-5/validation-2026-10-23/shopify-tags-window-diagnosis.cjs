// Exact user test campaign only. No provider calls, token refresh or database writes.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = `${__dirname}/shopify-tags-window-diagnosis.json`;
assert.ok(!fs.existsSync(output));
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', databaseWrites: false, providerCalls: false };
let db;
(async () => {
  const response = await fetch('https://marketforensics.onrender.com/api/health', { signal: AbortSignal.timeout(20000) });
  const health = await response.json();
  result.live = { status: response.status, ok: health.ok, commit: health.commit };
  assert.equal(response.status, 200); assert.equal(health.commit, '493dd4d28f6bc2b75436211d6b2eabf97ed877d7');
  const env = parseEnv(fs.readFileSync('.env', 'utf8')), url = new URL(env.DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'mf-shopify-tags-readonly',
    options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 10000,
    query_timeout: 12000, lock_timeout: 2000, idle_in_transaction_session_timeout: 15000 });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const campaigns = (await db.query('SELECT id, currency, start_date, created_at, reporting_time_zone, owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1', [result.campaignName])).rows;
  assert.equal(campaigns.length, 1); const campaign = campaigns[0]; assert.equal(campaign.owned, true);
  assert.equal(hash(campaign.id), 'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
  result.campaign = { ref: hash(campaign.id), currency: campaign.currency, startDate: campaign.start_date, createdAt: campaign.created_at, reportingTimeZone: campaign.reporting_time_zone };
  const connections = (await db.query('SELECT id, shop_domain, is_active, connected_at, mapping_config FROM shopify_connections WHERE campaign_id=$1 AND is_active=true', [campaign.id])).rows;
  result.connections = connections.map(connection => {
    const cfg = typeof connection.mapping_config === 'string' ? JSON.parse(connection.mapping_config) : connection.mapping_config || {};
    return { ref: hash(connection.id), storeRef: hash(connection.shop_domain), active: connection.is_active, connectedAt: connection.connected_at,
      authType: cfg.authType || null, scopes: cfg.grantedScopesList || cfg.grantedScopes || null, accessTokenExpiresAt: cfg.accessTokenExpiresAt || null };
  });
  await db.query('ROLLBACK'); result.transactionEnded = 'ROLLBACK'; result.result = 'READ_ONLY_CHECK_COMPLETE';
})().catch(error => { result.result = 'CHECK_INCOMPLETE'; result.errorCode = error.code || error.name; process.exitCode = 1; })
  .finally(async () => { if (db) await db.end().catch(() => {}); fs.writeFileSync(output, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify(result)); });
