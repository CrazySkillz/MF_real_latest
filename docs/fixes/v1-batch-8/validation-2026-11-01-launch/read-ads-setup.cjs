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
  if (process.argv.includes('--after-check')) {
    const fixtureId = 'b89ead82-29a3-4671-b281-66756051f966';
    const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'user-ads-service-account.json'), 'utf8'));
    assert.equal(result.googleAdsServiceAccount, 'PASS_ADS_SERVICE_ACCOUNT'); assert.equal(result.campaignId, fixtureId); assert.equal(result.cleanup, true);
    receipt.fixtureRows = {};
    for (const table of ['campaigns', 'ga4_google_ads_spend_connections', 'ga4_google_ads_spend_daily_metrics', 'spend_sources', 'spend_records', 'ga4_refresh_work']) {
      const count = (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${table === 'campaigns' ? 'id' : 'campaign_id'}=$1`, [fixtureId])).rows[0].n;
      receipt.fixtureRows[table] = count; assert.equal(count, 0);
    }
    const requests = (await db.query('SELECT created,cancelled FROM campaign_creation_requests WHERE owner_id=$1 AND client_id=$2 AND request_id=$3', [ownerId, c.client_id, fixtureId])).rows;
    assert.deepEqual(requests, [{ created: true, cancelled: true }]);
    receipt.exactCancellationRetained = true;
    assert.equal(receipt.exactDatabaseGrant, true); assert.equal(receipt.existingAdsSpendConnections, 0);
    receipt.cleanupIndependentlyVerified = true;
    // Only resource identifiers/methods for the next already-authorized alternative-path check.
    receipt.remainingGoogleSetup = (await db.query(`SELECT 'ga4' AS provider,g.property_id AS resource_id,g.method,EXISTS(SELECT 1 FROM service_account_resource_grants p WHERE p.owner_id=c.owner_id AND p.client_id=c.client_id AND p.provider='ga4' AND p.resource_id=g.property_id) AS exact_database_grant FROM ga4_connections g JOIN campaigns c ON c.id=g.campaign_id WHERE c.id=$1 AND g.is_active=true UNION ALL SELECT 'google_sheets',g.spreadsheet_id,g.method,EXISTS(SELECT 1 FROM service_account_resource_grants p WHERE p.owner_id=c.owner_id AND p.client_id=c.client_id AND p.provider='google_sheets' AND p.resource_id=g.spreadsheet_id) FROM google_sheets_connections g JOIN campaigns c ON c.id=g.campaign_id WHERE c.id=$1 AND g.is_active=true`, [campaignId])).rows;
  }
  if (process.argv.includes('--after-google-check')) {
    const fixtureId = '8798ff85-8850-473f-b8ff-6c6b43d5726a';
    const result = JSON.parse(fs.readFileSync(path.join(__dirname, 'user-google-alternative.json'), 'utf8'));
    assert.equal(result.googleAlternative, 'PASS_GOOGLE_ALTERNATIVE'); assert.equal(result.campaignId, fixtureId); assert.equal(result.cleanup, true);
    receipt.googleFixtureRows = {};
    for (const table of ['campaigns', 'ga4_connections', 'google_sheets_connections', 'ga4_refresh_work', 'ga4_daily_metrics', 'ga4_overview_snapshots', 'revenue_sources', 'revenue_records', 'spend_sources', 'spend_records']) {
      const count = (await db.query(`SELECT count(*)::int n FROM ${table} WHERE ${table === 'campaigns' ? 'id' : 'campaign_id'}=$1`, [fixtureId])).rows[0].n;
      receipt.googleFixtureRows[table] = count; assert.equal(count, 0);
    }
    assert.equal((await db.query('SELECT count(*)::int n FROM google_sheets_connections WHERE id=$1', [result.sheetConnectionId])).rows[0].n, 0);
    assert.deepEqual((await db.query('SELECT created,cancelled FROM campaign_creation_requests WHERE owner_id=$1 AND client_id=$2 AND request_id=$3', [ownerId, c.client_id, fixtureId])).rows, [{ created: true, cancelled: true }]);
    receipt.exactGoogleCancellationRetained = true;
    const setup = (await db.query(`SELECT 'ga4' AS provider,g.property_id AS resource_id,g.method FROM ga4_connections g WHERE g.campaign_id=$1 AND g.is_active=true UNION ALL SELECT 'google_sheets',g.spreadsheet_id,g.method FROM google_sheets_connections g WHERE g.campaign_id=$1 AND g.is_active=true ORDER BY provider`, [campaignId])).rows;
    assert.deepEqual(setup, [
      { provider: 'ga4', resource_id: '542352127', method: 'access_token' },
      { provider: 'google_sheets', resource_id: '1VMN6f089lsPISQ80pxT8Sq4awNU71-jQh5OgyFTXSeU', method: 'access_token' },
    ]);
    for (const item of setup) assert.equal((await db.query('SELECT count(*)::int n FROM service_account_resource_grants WHERE owner_id=$1 AND client_id=$2 AND provider=$3 AND resource_id=$4', [ownerId, c.client_id, item.provider, item.resource_id])).rows[0].n, 1);
    receipt.retainedOAuthResourceBindingsUnchanged = true; receipt.exactGoogleClientPermissionsRetained = true;
    receipt.googleCleanupIndependentlyVerified = true;
  }
  receipt.result = 'READ_ONLY_PREFLIGHT_COMPLETE';
})().catch(error => { receipt.result = 'CHECK_REQUIRED'; receipt.errorCode = /^[A-Z0-9_]+$/.test(String(error.code || '')) ? error.code : error.name; process.exitCode = 1; })
.finally(async () => {
  if (db) { await db.query('ROLLBACK').catch(() => {}); await db.end().catch(() => {}); }
  const file = 'ads-setup-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, file), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, file }));
});
