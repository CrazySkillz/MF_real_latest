// Count/metadata-only production inventory. Never decrypts credentials or imports app services.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const label = process.argv[2] || 'persisted-boundaries';
assert.match(label, /^[a-z0-9-]+$/);
const result = { at: new Date().toISOString(), boundary: 'Verified database identity and TLS; enforced REPEATABLE READ READ ONLY; aggregate metadata only; no provider calls or cleanup' };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname, url.port || '5432', url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl', 'options']) url.searchParams.delete(key);
  client = new Client({ connectionString: url.href, ssl: { rejectUnauthorized: true }, application_name: 'batches1-5-readonly-boundaries', connectionTimeoutMillis: 10000, statement_timeout: 12000, query_timeout: 15000, idle_in_transaction_session_timeout: 20000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only, 'on');
  result.readOnly = true;
  const columns = (await client.query("SELECT table_name,column_name,data_type,numeric_precision,numeric_scale FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
  const has = (table, column) => columns.some(row => row.table_name === table && row.column_name === column);
  result.ownerColumns = ['metrics','integrations','performance_data','attribution_models','customer_journeys'].map(table => ({ table, present: has(table, 'owner_id') }));
  result.requiredTables = ['inbound_webhook_receipts','service_account_resource_grants','ga4_refresh_work','ga4_daily_metrics','metric_snapshots'].map(table => ({ table, present: columns.some(row => row.table_name === table) }));
  result.precisionColumns = columns.filter(row => ['ga4_daily_metrics','kpis','benchmarks','kpi_history','benchmark_history'].includes(row.table_name) && ['conversions','value','current_value','target_value'].includes(row.column_name));
  result.invalidIndexes = (await client.query("SELECT c.relname AS index_name FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND (NOT i.indisvalid OR NOT i.indisready)")).rows;
  result.campaignOwnership = (await client.query("SELECT count(*)::int total,count(*) FILTER(WHERE c.owner_id IS NULL)::int owner_missing,count(*) FILTER(WHERE c.client_id IS NOT NULL AND p.id IS NULL)::int client_missing,count(*) FILTER(WHERE p.id IS NOT NULL AND c.owner_id IS DISTINCT FROM p.owner_id)::int owner_mismatch FROM campaigns c LEFT JOIN clients p ON p.id=c.client_id")).rows[0];
  result.connections = [];
  for (const table of ['ga4_connections','google_sheets_connections','google_ads_connections','hubspot_connections','salesforce_connections','shopify_connections']) {
    assert.ok(has(table, 'campaign_id'), 'Expected connection table unavailable');
    const active = has(table, 'is_active') ? 't.is_active=true' : 'true';
    const plain = ['access_token','refresh_token','client_secret'].filter(column => has(table,column)).map(column => `NULLIF(t."${column}",'') IS NOT NULL`).join(' OR ') || 'false';
    const encrypted = has(table,'encrypted_tokens') ? "t.encrypted_tokens IS NOT NULL AND t.encrypted_tokens::text <> '{}'" : 'false';
    result.connections.push({ table, ...(await client.query(`SELECT count(*)::int total,count(*) FILTER(WHERE c.id IS NULL)::int missing_parent,count(*) FILTER(WHERE c.id IS NOT NULL AND ${active})::int active_with_parent,count(*) FILTER(WHERE c.id IS NOT NULL AND ${active} AND (${plain}))::int active_plaintext_present,count(*) FILTER(WHERE c.id IS NOT NULL AND ${active} AND (${encrypted}))::int active_encrypted_present FROM "${table}" t LEFT JOIN campaigns c ON c.id=t.campaign_id`)).rows[0] });
  }
  result.sourceFamilies = {};
  for (const kind of ['revenue','spend']) {
    const source = kind + '_sources', records = kind + '_records', sourceId = kind + '_source_id';
    result.sourceFamilies[kind] = {
      sources: (await client.query(`SELECT s.source_type,coalesce(s.platform_context,'ga4') AS platform_context,s.is_active,count(*)::int count,count(*) FILTER(WHERE c.id IS NULL)::int missing_parent FROM ${source} s LEFT JOIN campaigns c ON c.id=s.campaign_id GROUP BY s.source_type,coalesce(s.platform_context,'ga4'),s.is_active ORDER BY 1,2,3`)).rows,
      records: (await client.query(`SELECT count(*)::int total,count(*) FILTER(WHERE c.id IS NULL)::int missing_campaign,count(*) FILTER(WHERE s.id IS NULL)::int missing_source,count(*) FILTER(WHERE s.id IS NOT NULL AND s.campaign_id IS DISTINCT FROM r.campaign_id)::int source_campaign_mismatch,count(*) FILTER(WHERE s.id IS NOT NULL AND s.currency IS NOT NULL AND r.currency IS DISTINCT FROM s.currency)::int source_currency_mismatch,count(*) FILTER(WHERE r.date !~ '^\\d{4}-\\d{2}-\\d{2}$')::int invalid_date_shape FROM ${records} r LEFT JOIN ${source} s ON s.id::text=r.${sourceId} LEFT JOIN campaigns c ON c.id=r.campaign_id`)).rows[0],
    };
  }
  result.duplicateDailyKeys = [];
  for (const [table, keys] of [['ga4_daily_metrics','campaign_id,property_id,date'],['linkedin_daily_metrics','campaign_id,date'],['google_ads_daily_metrics','campaign_id,google_campaign_id,date'],['meta_daily_metrics','campaign_id,meta_campaign_id,date']]) {
    result.duplicateDailyKeys.push({ table, ...(await client.query(`SELECT count(*)::int groups,coalesce(sum(n-1),0)::int extra_rows FROM (SELECT count(*) n FROM ${table} GROUP BY ${keys} HAVING count(*)>1) d`)).rows[0] });
  }
  result.legacyCandidates = {
    limitation: 'These fingerprints identify candidates only; they do not prove historical provenance or authorize deletion.',
    retiredRevenue: (await client.query("SELECT count(*)::int n FROM revenue_records WHERE revenue_source_id='ga4_daily_metrics'")).rows[0].n,
    retiredSpend: (await client.query("SELECT count(*)::int n FROM spend_records WHERE spend_source_id='linkedin_daily_metrics'")).rows[0].n,
    demoMetrics: (await client.query("SELECT count(*)::int total,count(*) FILTER(WHERE owner_id IS NULL)::int unowned FROM metrics WHERE (name,value) IN (('Total Impressions','284,521'),('Total Clicks','12,847'),('Click-through Rate','4.51%'),('Ad Spend','$18,420'))")).rows[0],
  };
  result.orphanRefreshWork = (await client.query('SELECT count(*)::int n FROM ga4_refresh_work w WHERE NOT EXISTS(SELECT 1 FROM campaigns c WHERE c.id=w.campaign_id)')).rows[0].n;
  await client.query('ROLLBACK');
})().catch(error => { result.error = { code: error.code || error.name, detail: 'Bounded read-only inventory did not complete; connection details redacted' }; process.exitCode = 1; })
  .finally(async () => { if (client) await client.end().catch(() => {}); fs.writeFileSync(__dirname + '/' + label + '.json', JSON.stringify(result, null, 2) + '\n', {flag:'wx'}); console.log(JSON.stringify(result, null, 2)); });
