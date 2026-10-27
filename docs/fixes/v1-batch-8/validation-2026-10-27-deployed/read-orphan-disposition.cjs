// Metadata-only orphan review; READ ONLY and no provider/application service imports.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
process.env.TZ = 'UTC';
const hash = value => crypto.createHash('sha256').update(value).digest('hex').slice(0,12);
const result = { at: new Date().toISOString() };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);
  assert.equal(crypto.createHash('sha256').update(JSON.stringify([url.hostname,url.port||'5432',url.pathname])).digest('hex'), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  client = new Client({ connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'batch8-orphan-disposition-readonly',connectionTimeoutMillis:10000,statement_timeout:12000,query_timeout:15000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  result.readOnly = true;
  const connections = (await client.query(`SELECT g.id,g.campaign_id,g.method,g.is_active,g.is_primary,g.created_at,g.connected_at
    FROM ga4_connections g WHERE NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=g.campaign_id) ORDER BY g.created_at,g.id`)).rows;
  const reports = (await client.query(`SELECT r.id,r.campaign_id,r.platform_type,r.report_type,r.status,r.schedule_enabled,r.created_at,r.updated_at,r.last_sent_at
    FROM linkedin_reports r WHERE NULLIF(r.campaign_id,'') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM campaigns c WHERE c.id=r.campaign_id) ORDER BY r.created_at,r.id`)).rows;
  const campaignIds = [...new Set([...connections,...reports].map(row=>row.campaign_id))];
  const reportIds = reports.map(row=>row.id);
  const redact = ({ id,campaign_id,...row })=>({idHash:hash(id),campaignHash:hash(campaign_id),...row});
  result.connections = connections.map(redact);
  result.reports = reports.map(redact);
  result.distinctMissingCampaigns = campaignIds.length;
  result.references = {};
  for (const table of ['ga4_refresh_work','revenue_sources','spend_sources','kpis','benchmarks','metric_snapshots','ga4_daily_metrics','ga4_overview_snapshots','google_sheets_connections','hubspot_connections','salesforce_connections','shopify_connections']) {
    result.references[table] = (await client.query(`SELECT count(*)::int AS count FROM "${table}" WHERE campaign_id=ANY($1::text[])`,[campaignIds])).rows[0].count;
  }
  result.sendEvents = (await client.query(`SELECT status,count(*)::int AS count FROM report_send_events WHERE report_id=ANY($1::text[]) GROUP BY status`,[reportIds])).rows;
  result.reportSnapshots = (await client.query(`SELECT count(*)::int AS count FROM report_snapshots WHERE report_id=ANY($1::text[])`,[reportIds])).rows[0].count;
  result.emailAudits = (await client.query(`SELECT delivery_status,count(*)::int AS count FROM email_alert_events WHERE entity_type='report' AND entity_id=ANY($1::text[]) GROUP BY delivery_status`,[reportIds])).rows;
  result.checks = {
    exactPriorRowCounts:connections.length===14&&reports.length===6,
    allReportSchedulesDisabled:reports.every(row=>row.schedule_enabled===false),
    noRefreshWork:result.references.ga4_refresh_work===0,
    noPendingReportRecovery:result.sendEvents.every(row=>!['pending','pending_delivery','sending'].includes(row.status)),
    noKnownActiveSourceOrGoalReferences:['revenue_sources','spend_sources','kpis','benchmarks','google_sheets_connections','hubspot_connections','salesforce_connections','shopify_connections'].every(table=>result.references[table]===0)
  };
  await client.query('ROLLBACK');
})().catch(error=>{result.error={code:error.code||error.name,message:'Read-only orphan review failed; connection details redacted'};process.exitCode=1;})
  .finally(async()=>{if(client)await client.end().catch(()=>{});fs.writeFileSync(__dirname+`/orphan-disposition-${result.at.replace(/[:.]/g,'-')}.json`,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result,null,2));});
