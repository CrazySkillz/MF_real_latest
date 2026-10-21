// Production READ ONLY; no app imports, providers, DDL or customer rows in output.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {parseEnv}=require('node:util'),{Client}=require('pg');
assert.ok(process.argv.length===2 || (process.argv.length===3 && process.argv[2]==='--after'));
const out='docs/fixes/v1-batch-3/deployment-2026-10-22/'+(process.argv[2]==='--after'?'production-after.json':'production-before.json');
const targets={ga4_daily_metrics:['conversions'],metric_snapshots:['total_conversions'],kpis:['current_value','last_computed_value'],kpi_periods:['final_value','previous_period_value','change_amount'],kpi_progress:['value','rolling_average_7d','rolling_average_30d'],kpi_alerts:['current_value'],benchmarks:['current_value'],benchmark_history:['current_value']};
const result={at:new Date().toISOString(),candidate:'001ddfa87c445a51e63320cde9737b774aa1af0c',boundary:'Bounded TLS-verified read-only queries against the user-confirmed production DATABASE_URL. Schema, aggregate counts, configuration hashes and Ptomo saved publication values only. Timestamp-without-time-zone fields are raw database text; no driver-local timezone conversion. No provider or authenticated UI certification.'};
let c;
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const expectedCommit=process.argv[2]==='--after'?process.env.MF_EXPECTED_DEPLOYED_COMMIT:'839bf508bffea4742f992616753dc68eabcfab3e';
assert.match(expectedCommit||'',/^[a-f0-9]{40}$/);
(async()=>{
 const m=JSON.parse(fs.readFileSync('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/candidate-manifest.json','utf8'));
 result.manifestMismatches=m.files.filter(f=>crypto.createHash('sha256').update(fs.readFileSync(f.file,'utf8').replace(/\r\n/g,'\n')).digest('hex')!==f.sha256LF).map(f=>f.file);assert.equal(result.manifestMismatches.length,0);
 const health=await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(20000)}),h=await health.json();result.liveHealth={status:health.status,ok:h.ok,commit:h.commit};assert.equal(health.status,200);assert.equal(h.ok,true);assert.equal(h.commit,expectedCommit);
 const u=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);result.databaseTargetSha256=hash([u.hostname,u.port||'5432',u.pathname]);
 for(const k of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])u.searchParams.delete(k);
 c=new Client({connectionString:u.href,ssl:{rejectUnauthorized:true},application_name:'mf-batch3-readonly-preflight',connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000,idle_in_transaction_session_timeout:20000});
 await c.connect();await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 result.readOnly=(await c.query('SHOW transaction_read_only')).rows[0].transaction_read_only==='on';assert.ok(result.readOnly);
 result.serverVersion=(await c.query('SHOW server_version')).rows[0].server_version;
 result.databaseTimeZone=(await c.query('SHOW timezone')).rows[0].TimeZone;
 result.databaseBytes=(await c.query('SELECT pg_database_size(current_database())::text bytes')).rows[0].bytes;
 result.columns=(await c.query(`SELECT c.relname table_name,a.attname column_name,format_type(a.atttypid,a.atttypmod) type,a.attnotnull not_null,pg_get_expr(d.adbin,d.adrelid) default_value,pg_has_role(current_user,c.relowner,'USAGE') owner_role_access FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum WHERE n.nspname=current_schema() AND c.relname=ANY($1) AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attnum`,[Object.keys(targets)])).rows.filter(r=>targets[r.table_name].includes(r.column_name));
 assert.equal(result.columns.length,13);
 for(const row of result.columns){assert.ok(row.owner_role_access);assert.match(row.type,['ga4_daily_metrics','metric_snapshots'].includes(row.table_name)?/^(integer|double precision)$/:/^numeric(?:\(\d+,\d+\))?$/);}
 result.tables={};
 for(const [table,cols] of Object.entries(targets)){
  const bad=cols.map(col=>`count(*) FILTER(WHERE "${col}"::text IN ('NaN','Infinity','-Infinity'))::int "${col}_nonfinite"`).join(',');
  const row=(await c.query(`SELECT count(*)::text rows,${bad} FROM "${table}"`)).rows[0];assert.ok(Object.entries(row).filter(([k])=>k!=='rows').every(([,v])=>v===0));
  result.tables[table]={...row,...(await c.query('SELECT pg_relation_size($1::regclass)::text heap_bytes,pg_total_relation_size($1::regclass)::text total_bytes',[table])).rows[0]};
 }
 result.constraints=(await c.query("SELECT conrelid::regclass::text table_name,conname,convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid=ANY($1::regclass[]) ORDER BY 1,2",[Object.keys(targets)])).rows;
 result.dependencies=(await c.query("SELECT DISTINCT c.relname table_name,v.relname dependent_view FROM pg_depend d JOIN pg_rewrite r ON r.oid=d.objid JOIN pg_class v ON v.oid=r.ev_class JOIN pg_class c ON c.oid=d.refobjid WHERE c.oid=ANY($1::regclass[]) AND v.oid<>c.oid ORDER BY 1,2",[Object.keys(targets)])).rows;
 result.lockSnapshot=(await c.query("SELECT relation::regclass::text table_name,mode,granted,count(*)::int locks FROM pg_locks WHERE relation=ANY($1::regclass[]) AND pid<>pg_backend_pid() GROUP BY 1,2,3 ORDER BY 1,2",[Object.keys(targets)])).rows;
 result.startupDmlCandidates={shopifyRefreshNotifications:(await c.query(`SELECT count(*)::int n FROM notifications WHERE metadata IS NOT NULL AND metadata::text ~ '"kind"[[:space:]]*:[[:space:]]*"shopify_revenue_refresh_failure"'`)).rows[0].n,sheetsNullFlags:(await c.query('SELECT count(*)::int n FROM google_sheets_connections WHERE is_primary IS NULL OR is_active IS NULL')).rows[0].n,legacyConnectedIntegrations:(await c.query("SELECT count(*)::int n FROM integrations WHERE platform IN ('facebook','linkedin') AND connected=true")).rows[0].n};
 assert.ok(Object.values(result.startupDmlCandidates).every(n=>n===0));
 const ptomo=(await c.query("SELECT c.id,c.owner_id,c.client_id,p.owner_id client_owner,c.name,c.status,c.currency,c.reporting_time_zone,c.ga4_campaign_filter FROM campaigns c JOIN clients p ON p.id=c.client_id WHERE lower(c.name)='ptomo'")).rows;assert.equal(ptomo.length,1);assert.ok(ptomo[0].owner_id);assert.equal(ptomo[0].owner_id,ptomo[0].client_owner);
 const connections=(await c.query('SELECT id,property_id,method,is_active,is_primary,import_start_date FROM ga4_connections WHERE campaign_id=$1 ORDER BY id',[ptomo[0].id])).rows;
 result.ptomo={configurationSha256:hash(ptomo[0]),connectionConfigurationSha256:hash(connections),activeConnectionCount:connections.filter(x=>x.is_active).length};
 const before=JSON.parse(fs.readFileSync('docs/fixes/v1-batch-2/acceptance-2026-10-21/live-deployment-after.json','utf8'));
 assert.equal(result.ptomo.configurationSha256,before.ptomo.configurationSha256);assert.equal(result.ptomo.connectionConfigurationSha256,before.ptomo.connectionConfigurationSha256);result.ptomo.configurationPreserved=true;
 const active=connections.filter(x=>x.is_active);assert.equal(active.length,1);
 const property=active[0].property_id;
 const overview=(await c.query('SELECT window_start,window_end,updated_at::text,campaign_breakdown,conversion_events FROM ga4_overview_snapshots WHERE campaign_id=$1 AND property_id=$2',[ptomo[0].id,property])).rows;assert.equal(overview.length,1);
 const ov=overview[0];
 result.ptomo.native={windowStart:ov.window_start,windowEnd:ov.window_end,overviewUpdatedAt:ov.updated_at,
  ...(await c.query('SELECT count(*)::int dates,count(DISTINCT date)::int unique_dates,min(date) first_date,max(date) last_date,min(updated_at)::text earliest_row_update,max(updated_at)::text latest_row_update,sum(sessions)::float8 sessions,sum(users)::float8 users,sum(conversions)::float8 conversions,count(*) FILTER (WHERE conversions<>trunc(conversions))::int fractional_rows FROM ga4_daily_metrics WHERE campaign_id=$1 AND property_id=$2 AND date BETWEEN $3 AND $4',[ptomo[0].id,property,ov.window_start,ov.window_end])).rows[0],
  breakdownConversions:ov.campaign_breakdown?.totals?.conversions,eventsConversions:ov.conversion_events?.totals?.conversions};
 assert.equal(result.ptomo.native.dates,result.ptomo.native.unique_dates);
 const financial=(await c.query("SELECT reporting_date,recorded_at::text,total_conversions,metrics FROM metric_snapshots WHERE campaign_id=$1 AND snapshot_type='financial_daily' AND reporting_date=$2 ORDER BY recorded_at DESC LIMIT 1",[ptomo[0].id,ov.window_end])).rows[0];
 if(financial){const f=financial.metrics?.financialDaily;result.ptomo.financial={reportingDate:financial.reporting_date,recordedAt:financial.recorded_at,totalConversions:financial.total_conversions,currency:f?.currency,currentValueWindow:f?.currentValueWindow,revenue:f?.inputs?.revenue?.value,spendAvailable:f?.inputs?.spend?.available,conversions:f?.inputs?.conversions?.value};}
 result.ptomo.refresh=(await c.query('SELECT reporting_date,due_at,status,attempt_count,completed_at FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC LIMIT 3',[ptomo[0].id])).rows;
 if(process.argv[2]==='--after'){
  for(const col of result.columns)assert.equal(col.type,['ga4_daily_metrics','metric_snapshots'].includes(col.table_name)?'double precision':'numeric');
  const finite=result.constraints.filter(x=>x.conname.endsWith('_finite'));assert.equal(finite.length,13);assert.ok(finite.every(x=>x.convalidated));
  result.precisionMigration='PASS: all 13 target columns and finite constraints';
 }
 await c.query('ROLLBACK');result.result='PASS';
})().catch(e=>{result.result='FAIL';result.error={code:e.code||e.name,message:e.name==='AssertionError'?String(e.message).slice(0,200):'Read-only check failed; no connection or credential details emitted'};process.exitCode=1;}).finally(async()=>{if(c)await c.end().catch(()=>{});result.completedAt=new Date().toISOString();fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');const {columns,constraints,dependencies,...summary}=result;console.log(JSON.stringify(summary,null,2));});
