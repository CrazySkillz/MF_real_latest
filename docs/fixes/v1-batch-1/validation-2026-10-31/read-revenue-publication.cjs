// Exact disposable campaign only. No application imports, provider calls or writes.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg');
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
const receipt = { at: new Date().toISOString(), databaseWritesAttempted: false, secretValuesReturned: false };
let client;
(async () => {
  const url = new URL(parseEnv(fs.readFileSync('.env', 'utf8')).DATABASE_URL);
  assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])), '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
  for (const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
  client = new Client({ connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'batch1-publication-read-only',options:'-c default_transaction_read_only=on',connectionTimeoutMillis:10000,statement_timeout:25000,query_timeout:28000,idle_in_transaction_session_timeout:60000 });
  await client.connect();
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  receipt.databaseReadOnly=true;
  const id='36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const [campaign]=(await client.query(`SELECT c.id,c.name,c.currency,c.reporting_time_zone,c.owner_id,cl.name AS client_name,c.owner_id=cl.owner_id AS consistent_owner FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1`,[id])).rows;
  assert.equal(campaign.name,'Batch 1 Provider Check');assert.equal(campaign.client_name,'Batch 1 Validation');assert.equal(campaign.consistent_owner,true);
  assert.equal(hash(campaign.owner_id),'1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');delete campaign.owner_id;receipt.campaign=campaign;
  receipt.sources=(await client.query(`SELECT id,source_type,platform_context,currency,created_at,connected_at FROM revenue_sources WHERE campaign_id=$1 AND is_active=true ORDER BY id`,[id])).rows;
  receipt.records=(await client.query(`SELECT revenue_source_id,date,revenue,currency,external_id,sub_campaign_urn FROM revenue_records WHERE campaign_id=$1 ORDER BY revenue_source_id,date`,[id])).rows;
  receipt.snapshots=(await client.query(`SELECT id,reporting_date,recorded_at,metrics->'financialDaily' AS financial,metrics->'revenuePublication' AS publication FROM metric_snapshots WHERE campaign_id=$1 AND snapshot_type='financial_daily' ORDER BY reporting_date DESC LIMIT 4`,[id])).rows;
  receipt.work=(await client.query(`SELECT id,due_at,reporting_date,status,scope->>'kind' AS kind,scope_hash LIKE 'invalidated:%' AS invalidated,attempt_count,started_at,completed_at,updated_at,retryable,last_error IS NOT NULL AS has_error FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC LIMIT 12`,[id])).rows;
  receipt.overview=(await client.query(`SELECT property_id,window_start,window_end,updated_at,campaign_breakdown->'totals' AS totals FROM ga4_overview_snapshots WHERE campaign_id=$1`,[id])).rows;
  for (const snapshot of receipt.snapshots) {
    snapshot.sourceMatches=Object.fromEntries(receipt.sources.map(source=>{
      const included=receipt.records.filter(row=>row.revenue_source_id===source.id && row.date>='1900-01-01' && row.date<=snapshot.reporting_date)
        .map(row=>JSON.stringify([row.date,String(row.revenue),row.currency,row.external_id,row.sub_campaign_urn])).sort();
      const current=hash(JSON.stringify([source.source_type,source.currency,included]));
      return [source.id,{hash:current,matches:snapshot.publication?.sources?.[source.id]===current}];
    }));
  }
  // Source identifiers suffice for reconciliation; do not emit provider order identifiers.
  receipt.records=receipt.records.map(({external_id,sub_campaign_urn,...row})=>row);
  await client.query('ROLLBACK');receipt.rolledBack=true;receipt.result='PASS_READ_ONLY_OBSERVATION';
})().catch(error=>{receipt.result='NOT_VERIFIED';receipt.errorCode=error.code||error.name;process.exitCode=1;})
.finally(async()=>{if(client) await client.end().catch(()=>{});const filename='revenue-publication-'+receipt.at.replace(/[:.]/g,'-')+'.json';fs.writeFileSync(path.join(__dirname,filename),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...receipt,filename}));});
