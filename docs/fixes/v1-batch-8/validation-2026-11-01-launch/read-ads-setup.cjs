// Read-only metadata preflight for the user-supplied test Ads account.
// No application startup, Google requests, token issuance, imports or database writes.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const customerId = '4951281615', campaignId = '36631f9f-5f32-4ae6-8d20-d8430abb364c';
const ownerId = 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const receipt = { at: new Date().toISOString(), customerId, liveWrites: 0, providerCalls: 0, credentialValuesReturned: false };
let db;
(async () => {
  const env = parseEnv(fs.readFileSync('.env', 'utf8'));
  const raw = String(env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON || env.GA4_SERVICE_ACCOUNT_JSON || '').trim();
  let config; try { config = raw ? JSON.parse(raw) : null; } catch { config = null; }
  receipt.localConfigurationOnly = {
    authoritativeForRender: false,
    serviceAccountConfigured: config?.type === 'service_account' && Boolean(config?.client_email && config?.private_key),
    adsSpecificCredentials: Boolean(env.GOOGLE_ADS_SERVICE_ACCOUNT_JSON),
    customerAllowlisted: String(env.GOOGLE_ADS_SERVICE_ACCOUNT_ALLOWED_CUSTOMER_IDS || '').split(',').map(value => value.trim().replace(/-/g, '')).includes(customerId),
    managerConfigured: Boolean(env.GOOGLE_ADS_SERVICE_ACCOUNT_LOGIN_CUSTOMER_ID),
  };
  const url = new URL(env.DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  db = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'launch-ads-read-only', connectionTimeoutMillis: 10000, statement_timeout: 15000, query_timeout: 18000, options: '-c default_transaction_read_only=on' });
  await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await db.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  const rows = (await db.query('SELECT c.id,c.name,c.owner_id,c.client_id,c.currency,c.reporting_time_zone,cl.name AS client_name,cl.owner_id AS client_owner FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1', [campaignId])).rows;
  assert.equal(rows.length, 1); const c = rows[0];
  assert.equal(c.owner_id, ownerId); assert.equal(c.client_owner, ownerId);
  assert.equal(c.name, 'Batch 1 Provider Check'); assert.equal(c.client_name, 'Batch 1 Validation');
  receipt.testClient = { id: c.client_id, name: c.client_name, ownerMatches: true, referenceCampaignCurrency: c.currency, referenceCampaignTimeZone: c.reporting_time_zone };
  receipt.exactDatabaseGrant = (await db.query('SELECT count(*)::int n FROM service_account_resource_grants WHERE owner_id=$1 AND client_id=$2 AND provider=$3 AND resource_id=$4', [ownerId, c.client_id, 'google_ads', customerId])).rows[0].n === 1;
  receipt.existingAdsSpendConnections = (await db.query('SELECT count(*)::int n FROM ga4_google_ads_spend_connections g JOIN campaigns c ON c.id=g.campaign_id WHERE c.owner_id=$1 AND c.client_id=$2', [ownerId, c.client_id])).rows[0].n;
  receipt.result = 'READ_ONLY_PREFLIGHT_COMPLETE';
})().catch(error => { receipt.result = 'CHECK_REQUIRED'; receipt.errorCode = /^[A-Z0-9_]+$/.test(String(error.code || '')) ? error.code : error.name; process.exitCode = 1; })
.finally(async () => {
  if (db) { await db.query('ROLLBACK').catch(() => {}); await db.end().catch(() => {}); }
  const file = 'ads-setup-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, file }));
});
