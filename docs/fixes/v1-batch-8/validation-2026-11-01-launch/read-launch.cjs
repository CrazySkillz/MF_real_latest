// Final launch evidence only: anonymous GETs and an exact-scope READ ONLY transaction.
// No app imports, provider requests, emails, job triggers, credentials returned or live writes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const root = path.resolve(__dirname, '../../../..');
const runtime = '0a42aac893b56e471246a75f3a4a0a5423e846e3';
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const git = args => execFileSync('git', args, { cwd: root, encoding:'utf8', windowsHide:true }).trim();
const targets = {
  'b74f98af-ede9-47af-9b19-0720ebb4d2c0': ['Promo', 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN'],
  '36493a43-accd-4360-8ff2-de62f5a19b6e': ['V1 Batch 5 Test', 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN'],
  '36631f9f-5f32-4ae6-8d20-d8430abb364c': ['Batch 1 Provider Check', 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl'],
};
const receipt = { at:new Date().toISOString(), runtime, liveWrites:0, providerCalls:0, emailsSent:0, jobsTriggered:0, credentialValuesReturned:false };
let client;
(async () => {
  receipt.head = git(['rev-parse', 'HEAD']);
  assert.ok(git(['diff','--name-only',runtime,'HEAD']).split('\n').filter(Boolean).every(file => file.startsWith('docs/')));
  assert.equal(git(['diff','--name-only','HEAD','--','server','client','shared','migrations','package.json','package-lock.json','render.yaml']), '');
  receipt.applicationUnchangedSinceRuntime = true;
  receipt.unchangedSinceFullSuite = {};
  for (const file of ['server/storage.ts','server/ga4-daily-scheduler.ts','server/auto-refresh-scheduler.ts','server/report-scheduler.ts','server/ga4-scheduled-report-pdf.ts','client/src/pages/ga4-metrics.tsx','shared']) {
    receipt.unchangedSinceFullSuite[file] = git(['rev-parse',`357e950f:${file}`]) === git(['rev-parse',`${runtime}:${file}`]);
  }
  for (const route of ['/api/health','/health/scheduler','/api/clients','/api/campaigns']) {
    const response = await fetch('https://app.mimosaas.app' + route, { redirect:'error', headers:{ Accept:'application/json' }, signal:AbortSignal.timeout(20000) });
    if (route === '/api/health') {
      const body = await response.json(); assert.equal(response.status,200); assert.equal(body.ok,true); assert.equal(body.commit,runtime); assert.equal(body.nodeEnv,'production');
      receipt.health = { status:response.status, ok:body.ok, commit:body.commit, nodeEnv:body.nodeEnv };
    } else if (route === '/health/scheduler') {
      const body = await response.json(); assert.equal(response.status,200);
      const pick = value => Object.fromEntries(Object.entries(value || {}).filter(([key,value]) => /^(isRunning|isScheduled|lastRun|lastRunAt|lastRunStatus|lastSuccessfulRunAt|nextRunAt|lastCheckTime|lastSuccessTime|totalChecks|totalSent|totalFailed|writeFailedCampaigns)$/.test(key) && (value === null || ['string','number','boolean'].includes(typeof value))));
      receipt.scheduler = { status:body.status, reports:pick(body.scheduler), autoRefresh:pick(body.autoRefreshScheduler), ga4:pick(body.ga4DailyScheduler), financial:pick(body.financialDailySnapshot), recordedErrors:Boolean(body.scheduler?.lastError || body.scheduler?.lastErrorTime || body.autoRefreshScheduler?.lastError || body.ga4DailyScheduler?.lastError) };
      const g = body.ga4DailyScheduler || {}, message = String(g.lastError || '');
      receipt.ga4Failure = { at:g.lastErrorTime, startedAt:g.lastRunStartedAt, finishedAt:g.lastRunFinishedAt, trigger:g.lastRunTrigger, recognizedMessage:/^(Aligned GA4 publication failed for \d+ campaign stage\(s\)|GA4 daily refresh failed for \d+ campaign\(s\)(; GA4 daily refresh failed for \d+ campaign\(s\))*)$/.test(message) ? message : null, errorSha256:hash(message), stages:(g.lastAlignedRefreshFailures || []).map(x => ({campaignIdHash:x.campaignIdHash,stage:/^[a-z_]+$/.test(x.stage) ? x.stage : 'unclassified'})) };
    } else { assert.equal(response.status,401); (receipt.signedOutDenials ||= []).push({route,status:response.status}); }
  }
  const url = new URL(parseEnv(fs.readFileSync(path.join(root,'.env'),'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname,url.port || '5432',url.pathname])),'073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  client = new Client({ connectionString:url.href, ssl:{rejectUnauthorized:true}, application_name:'minimum-launch-read-only', options:'-c default_transaction_read_only=on', connectionTimeoutMillis:10000, statement_timeout:15000, query_timeout:18000, idle_in_transaction_session_timeout:60000 });
  await client.connect(); await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on'); receipt.databaseReadOnly = true;
  const ids = Object.keys(targets);
  const campaigns = (await client.query('SELECT c.id,c.name,c.owner_id,c.status,c.currency,cl.owner_id AS client_owner FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=ANY($1::text[]) ORDER BY c.id',[ids])).rows;
  assert.equal(campaigns.length,ids.length);
  for (const c of campaigns) { assert.equal(c.name,targets[c.id][0]); assert.equal(c.owner_id,targets[c.id][1]); assert.equal(c.client_owner,c.owner_id); assert.equal(c.status,'active'); }
  receipt.campaigns = campaigns.map(({id,name,status,currency}) => ({id,name,status,currency,ownerMatches:true}));
  // Metadata-only diagnostic for the new global failure; no historical credentials are returned.
  receipt.otherActiveGa4Targets = (await client.query(`SELECT c.id,c.client_id IS NULL AS client_id_missing,cl.id IS NULL AS client_missing,c.owner_id=ANY($2::text[]) AS current_owner,count(g.id)::int AS active_connections,bool_and(g.encrypted_tokens IS NULL AND coalesce(g.access_token,'')='' AND coalesce(g.refresh_token,'')='' AND coalesce(g.service_account_key,'')='') AS all_credentials_absent FROM campaigns c JOIN ga4_connections g ON g.campaign_id=c.id AND g.is_active=true AND trim(g.property_id)<>'' LEFT JOIN clients cl ON cl.id=c.client_id WHERE lower(trim(c.status))='active' AND NOT(c.id=ANY($1::text[])) GROUP BY c.id,cl.id ORDER BY c.id`,[ids,Object.values(targets).map(x=>x[1])])).rows;
  receipt.recentWork = (await client.query(`SELECT campaign_id,status,reporting_date,due_at,started_at,completed_at,attempt_count,retryable,has_error,kind FROM (SELECT campaign_id,status,reporting_date,due_at,started_at,completed_at,attempt_count,retryable,last_error IS NOT NULL AND last_error<>'' AS has_error,scope->>'kind' AS kind,row_number() OVER (PARTITION BY campaign_id ORDER BY due_at DESC,updated_at DESC) AS rn FROM ga4_refresh_work WHERE campaign_id=ANY($1::text[])) w WHERE rn<=3 ORDER BY campaign_id,due_at DESC`,[ids])).rows;
  receipt.unfinishedDueWork = (await client.query(`SELECT campaign_id,status,retryable,scope_hash LIKE 'invalidated:%' AS invalidated,count(*)::int AS count,bool_or(last_error IS NOT NULL AND last_error<>'') AS has_error,min(due_at) AS earliest_due,max(due_at) AS latest_due,count(*) FILTER (WHERE scope_hash NOT LIKE 'invalidated:%' AND retryable=true AND attempt_count<3 AND (status='pending' OR (status='running' AND lease_expires_at<=now())) AND (next_attempt_at IS NULL OR next_attempt_at<=now()))::int AS eligible_for_recovery FROM ga4_refresh_work WHERE campaign_id=ANY($1::text[]) AND status<>'completed' AND due_at<now() GROUP BY campaign_id,status,retryable,scope_hash LIKE 'invalidated:%'`,[ids])).rows;
  receipt.reports = (await client.query('SELECT id,campaign_id,platform_type,report_type,schedule_enabled,status,last_sent_at,next_scheduled_at,cardinality(schedule_recipients) AS recipient_count FROM linkedin_reports WHERE campaign_id=ANY($1::text[]) ORDER BY campaign_id,id',[ids])).rows;
  const reportIds = receipt.reports.map(r => r.id);
  receipt.emailAudit = (await client.query(`SELECT campaign_id,entity_id AS report_id,provider,delivery_status,count(*)::int AS count,max(created_at) AS latest_created_at,max(delivered_at) AS latest_delivered_at,bool_and(success) AS all_accepted FROM email_alert_events WHERE campaign_id=ANY($1::text[]) AND kind='report' AND entity_type='report' AND entity_id=ANY($2::text[]) GROUP BY campaign_id,entity_id,provider,delivery_status ORDER BY campaign_id,entity_id,delivery_status`,[ids,reportIds])).rows;
  // Text casts preserve timestamp-without-time-zone database values without host timezone conversion.
  receipt.latestDeliveryAudit = (await client.query(`SELECT a.id,a.campaign_id,a.entity_id AS report_id,a.provider,a.success,a.delivery_status,a.created_at::text AS created_at_database,a.delivered_at::text AS delivered_at_database,a.error IS NOT NULL AND a.error<>'' AS has_error,coalesce(a.provider_response_id,'')<>'' AS has_provider_response_id,a."to"=array_to_string(r.schedule_recipients,', ') AS matches_saved_recipients FROM email_alert_events a JOIN linkedin_reports r ON r.id::text=a.entity_id WHERE a.campaign_id=ANY($1::text[]) AND a.entity_id=ANY($2::text[]) AND r.campaign_id=a.campaign_id AND a.kind='report' AND a.entity_type='report' ORDER BY a.created_at DESC LIMIT 1`,[ids,reportIds])).rows;
  receipt.latestReportSends = (await client.query(`SELECT id,report_id,status,sent_at,created_at,has_error,snapshot_id,audit_delivery_status,exact_audit_match,snapshot_scope_matches FROM (SELECT e.id,e.report_id,e.status,e.sent_at,e.created_at,e.error IS NOT NULL AND e.error<>'' AS has_error,e.snapshot_id,a.delivery_status AS audit_delivery_status,(a.id::text=e.id::text AND a.entity_id=e.report_id AND a.campaign_id=r.campaign_id) AS exact_audit_match,(s.report_id=e.report_id AND s.campaign_id=r.campaign_id AND s.platform_type=r.platform_type) AS snapshot_scope_matches,row_number() OVER (PARTITION BY e.report_id ORDER BY e.created_at DESC,e.id) AS rn FROM report_send_events e JOIN linkedin_reports r ON r.id::text=e.report_id::text LEFT JOIN email_alert_events a ON a.id::text=e.id::text AND a.kind='report' AND a.entity_type='report' LEFT JOIN report_snapshots s ON s.id::text=e.snapshot_id::text WHERE r.id::text=ANY($1::text[]) AND r.campaign_id=ANY($2::text[])) x WHERE rn<=3 ORDER BY report_id,created_at DESC`,[reportIds,ids])).rows;
  const failures = (await client.query(`SELECT created_at,error FROM email_alert_events WHERE campaign_id=ANY($1::text[]) AND kind='report' AND entity_type='report' AND entity_id=ANY($2::text[]) AND delivery_status='failed' ORDER BY created_at DESC LIMIT 3`,[ids,reportIds])).rows;
  receipt.recentEmailFailures = failures.map(row => { const match = String(row.error).match(/^Mailgun (us|eu) API (\d{3}):\s*(Forbidden|Unauthorized)\s*$/i); return { at:row.created_at, errorSha256:hash(String(row.error)), recognizedProviderResponse:match ? { region:match[1],status:Number(match[2]),message:match[3] } : null, classifications:['Unauthorized','Forbidden','rate limit','Daily','limit','quota','recipient','domain','Invalid','authentication','Mailgun','timeout','ECONN','ENOTFOUND','payment','funds','credit','disabled','not allowed','rejected','sandbox'].filter(word => String(row.error).toLowerCase().includes(word.toLowerCase())) }; });
  receipt.googleAdsConnections = (await client.query('SELECT campaign_id,spend_only,method,count(*)::int AS count FROM ga4_google_ads_spend_connections WHERE campaign_id=ANY($1::text[]) GROUP BY campaign_id,spend_only,method',[ids])).rows;
  await client.query('ROLLBACK');
  receipt.result = 'READ_ONLY_EVIDENCE_COLLECTED';
})().catch(error => { receipt.result='CHECK_REQUIRED'; receipt.errorCode=error.code || error.name; process.exitCode=1; })
.finally(async () => { if (client) await client.end().catch(() => {}); const file='read-'+receipt.at.replace(/[:.]/g,'-')+'.json'; fs.writeFileSync(path.join(__dirname,file),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'}); console.log(JSON.stringify({result:receipt.result,file,errorCode:receipt.errorCode,health:receipt.health,scheduler:receipt.scheduler,reports:receipt.reports?.length,unfinishedDueWork:receipt.unfinishedDueWork})); });
