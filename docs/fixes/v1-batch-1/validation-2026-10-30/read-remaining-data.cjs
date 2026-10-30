// Exact known database; enforced READ ONLY; aggregate metadata only. No app/provider imports.
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
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batch1-remaining-read-only', options: '-c default_transaction_read_only=on', connectionTimeoutMillis: 10000, statement_timeout: 25000, query_timeout: 28000, idle_in_transaction_session_timeout: 60000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  receipt.databaseReadOnly = true;
  receipt.checks.thisConnectionTls = (await client.query('SELECT ssl,version,bits FROM pg_stat_ssl WHERE pid=pg_backend_pid()')).rows;
  receipt.checks.otherDatabaseConnections = (await client.query(`SELECT ssl,version,count(*)::int AS connections FROM pg_stat_ssl WHERE pid<>pg_backend_pid() GROUP BY ssl,version ORDER BY ssl,version`)).rows;
  receipt.checks.globalTables = [];
  for (const table of ['metrics','performance_data','integrations','attribution_models','customer_journeys']) {
    const row = (await client.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE owner_id IS NULL OR owner_id='')::int AS unowned FROM ${table}`)).rows[0];
    receipt.checks.globalTables.push({ table, ...row });
  }
  receipt.checks.genericCredentialPresence = (await client.query(`SELECT count(*) FILTER (WHERE NULLIF(credentials,'') IS NOT NULL)::int AS populated FROM integrations`)).rows[0];
  receipt.checks.conversionHistory = (await client.query(`SELECT count(*)::int AS total,count(*) FILTER (WHERE c.id IS NULL)::int AS missing_campaign,count(*) FILTER (WHERE e.currency IS DISTINCT FROM COALESCE(c.currency,'USD'))::int AS currency_mismatch FROM conversion_events e LEFT JOIN campaigns c ON c.id=e.campaign_id`)).rows[0];
  receipt.checks.connectorSpendSources = (await client.query(`SELECT s.is_active,c.id IS NOT NULL AS campaign_exists,count(*)::int AS sources FROM spend_sources s LEFT JOIN campaigns c ON c.id=s.campaign_id WHERE s.source_type='connector_derived' GROUP BY s.is_active,c.id IS NOT NULL`)).rows;
  receipt.checks.attributionCounts = [];
  for (const table of ['touchpoints','attribution_results','attribution_insights']) receipt.checks.attributionCounts.push({ table, ...((await client.query(`SELECT count(*)::int AS total FROM ${table}`)).rows[0]) });
  receipt.checks.protectedCampaigns = (await client.query(`SELECT c.name,c.status,c.owner_id=cl.owner_id AS consistent_owner,(SELECT count(*)::int FROM linkedin_connections l WHERE l.campaign_id=c.id) AS linkedin_connections,(SELECT count(*)::int FROM conversion_events e WHERE e.campaign_id=c.id) AS conversion_events FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.name=ANY($1::text[]) ORDER BY c.name`, [['Promo','V1 Batch 5 Test']])).rows;
  assert.equal(receipt.checks.protectedCampaigns.length, 2);
  assert.ok(receipt.checks.protectedCampaigns.every(c => c.status === 'active' && c.consistent_owner));
  await client.query('ROLLBACK'); receipt.rolledBack = true; receipt.result = 'PASS';
  receipt.limits = 'Presence and current metadata only. Other-session TLS does not prove certificate verification or identify the Render application. Empty current tables do not prove what historical requests occurred. No live authenticated mutation, provider acceptance, historical log inspection or cleanup.';
})().catch(error => { receipt.result = 'NOT_VERIFIED'; receipt.errorCode = error.code || error.name; process.exitCode = 1; })
.finally(async () => {
  if (client) await client.end().catch(() => {});
  const filename = 'remaining-data-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, filename), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ ...receipt, filename }));
});
