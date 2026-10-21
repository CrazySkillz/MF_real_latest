// Production reads only. No app imports, providers, migrations or customer rows in output.
const fs = require('node:fs'), crypto = require('node:crypto'), { parseEnv } = require('node:util');
const { Client } = require('pg');
const out = 'docs/fixes/v1-batch-2/deployment-preflight.json';
const result = { at: new Date().toISOString(), boundary: 'User-confirmed production DATABASE_URL; TLS verified, bounded READ ONLY transaction. Aggregate counts/schema only; no data changes.' };
let client;
(async () => {
  const manifest = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-2/candidate-files.json','utf8'));
  result.candidateHashMismatches = manifest.files.filter(f => crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex') !== f.sha256).map(f=>f.path);
  const env = parseEnv(fs.readFileSync('.env','utf8')), url = new URL(env.DATABASE_URL);
  for (const k of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(k);
  client = new Client({connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'mf-batch2-readonly-preflight',connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000,idle_in_transaction_session_timeout:20000});
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  result.readOnly = (await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only === 'on';
  if (!result.readOnly) throw Object.assign(new Error(),{code:'READ_ONLY_REQUIRED'});
  result.serverVersion = (await client.query('SHOW server_version')).rows[0].server_version;
  result.databaseBytes = (await client.query('SELECT pg_database_size(current_database())::text bytes')).rows[0].bytes;
  result.tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname=current_schema() ORDER BY tablename")).rows.map(r=>r.tablename);
  result.columns = (await client.query("SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema=current_schema() ORDER BY table_name,ordinal_position")).rows;
  result.tableCounts = {};
  for(const t of result.tables) {
    if(!/^[a-z_0-9]+$/.test(t)) throw Object.assign(new Error(),{code:'UNEXPECTED_TABLE'});
    result.tableCounts[t] = (await client.query(`SELECT count(*)::int n FROM "${t}"`)).rows[0].n;
  }
  result.indexes = (await client.query("SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=current_schema() ORDER BY tablename,indexname")).rows;
  result.foreignKeys = (await client.query("SELECT conrelid::regclass::text AS relation,conname,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE contype='f' AND connamespace=current_schema()::regnamespace ORDER BY 1,2")).rows;
  result.duplicateDailyKeys = [];
  for(const [table,keys] of [['ga4_daily_metrics','campaign_id,property_id,date'],['linkedin_daily_metrics','campaign_id,date'],['google_ads_daily_metrics','campaign_id,google_campaign_id,date'],['meta_daily_metrics','campaign_id,meta_campaign_id,date']]) {
    result.duplicateDailyKeys.push({table,...(await client.query(`SELECT count(*)::int groups,coalesce(sum(n-1),0)::int extra_rows FROM (SELECT count(*) n FROM ${table} GROUP BY ${keys} HAVING count(*)>1) d`)).rows[0]});
  }
  result.campaignBoundaries = (await client.query(`SELECT count(*)::int total, count(*) FILTER(WHERE c.client_id IS NULL)::int no_client, count(*) FILTER(WHERE c.client_id IS NOT NULL AND p.id IS NULL)::int orphan_client, count(*) FILTER(WHERE p.id IS NOT NULL AND c.owner_id IS DISTINCT FROM p.owner_id)::int owner_mismatch FROM campaigns c LEFT JOIN clients p ON p.id=c.client_id`)).rows[0];
  result.startupDmlCandidates = {
    shopifyRefreshNotifications:(await client.query(`SELECT count(*)::int n FROM notifications WHERE metadata IS NOT NULL AND metadata::text ~ '"kind"[[:space:]]*:[[:space:]]*"shopify_revenue_refresh_failure"'`)).rows[0].n,
    sheetsNullFlags:(await client.query('SELECT count(*)::int n FROM google_sheets_connections WHERE is_primary IS NULL OR is_active IS NULL')).rows[0].n,
    legacyConnectedIntegrations:(await client.query("SELECT count(*)::int n FROM integrations WHERE platform IN ('facebook','linkedin') AND connected=true")).rows[0].n
  };
  result.historicalDamageCandidates = {
    note:'Fingerprints identify candidates only; they cannot prove historical provenance or authorize cleanup.',
    seededCampaignValues: ['platform','impressions','clicks','spend','conversions','revenue'].every(c=>result.columns.some(r=>r.table_name==='campaigns'&&r.column_name===c)) ? (await client.query(`SELECT count(*)::int n FROM campaigns WHERE impressions=CASE WHEN platform='facebook' THEN 85240 WHEN platform='linkedin' THEN 42180 ELSE 65430 END AND clicks=CASE WHEN platform='facebook' THEN 3842 WHEN platform='linkedin' THEN 1915 ELSE 2937 END AND spend::numeric=CASE WHEN platform='facebook' THEN 5200 WHEN platform='linkedin' THEN 7800 ELSE 4800 END AND conversions=CASE WHEN platform='facebook' THEN 280 WHEN platform='linkedin' THEN 145 ELSE 195 END AND revenue::numeric=CASE WHEN platform='facebook' THEN 14500 WHEN platform='linkedin' THEN 22300 ELSE 12600 END`)).rows[0].n : 'Not queryable: the legacy seed references columns absent from the current production campaigns table.',
    revenueRetiredBackfillSource:(await client.query("SELECT count(*)::int n FROM revenue_records WHERE revenue_source_id='ga4_daily_metrics'")).rows[0].n,
    spendRetiredBackfillSource:(await client.query("SELECT count(*)::int n FROM spend_records WHERE spend_source_id='linkedin_daily_metrics'")).rows[0].n
  };
  await client.query('ROLLBACK'); await client.end(); client=null;
  try { const response = await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(20000)}); const h=await response.json(); result.liveHealth={status:response.status,ok:h.ok,commit:h.commit}; } catch(e) {result.liveHealth={error:e.name};}
  result.migrationPreconditionsPass = result.candidateHashMismatches.length===0 && result.duplicateDailyKeys.every(r=>r.groups===0);
})().catch(e=>{result.errorCode=e.code||e.name;process.exitCode=1;}).finally(async()=>{
  if(client)await client.end().catch(()=>{});
  fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
  const {indexes,foreignKeys,tables,tableCounts,columns,...summary}=result;
  console.log(JSON.stringify({...summary,tableCount:tables?.length,totalRows:tableCounts&&Object.values(tableCounts).reduce((a,b)=>a+b,0)},null,2));
});
