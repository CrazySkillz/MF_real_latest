// Exact test-campaign metadata, enforced READ ONLY. No tokens, provider calls or app startup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseEnv}=require('node:util'),{Client}=require('pg');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'),campaignId='36631f9f-5f32-4ae6-8d20-d8430abb364c';
const receipt={at:new Date().toISOString(),result:'NOT_VERIFIED',databaseWritesAttempted:false,providerCalls:0,secretValuesEmitted:false};let client;
(async()=>{try{
 const u=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);assert.equal(hash(JSON.stringify([u.hostname,u.port||'5432',u.pathname])),'073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');for(const k of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])u.searchParams.delete(k);
 client=new Client({connectionString:u.href,ssl:{rejectUnauthorized:true},options:'-c default_transaction_read_only=on',application_name:'batch1-publication-read-only',connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000});await client.connect();await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
 const target=(await client.query('SELECT c.owner_id,c.client_id,c.status,cl.owner_id=c.owner_id owner_matches FROM campaigns c JOIN clients cl ON cl.id=c.client_id WHERE c.id=$1',[campaignId])).rows[0];assert.ok(target?.owner_matches&&target.status==='active');assert.equal(target.client_id,'e3ec20ad-89ea-450d-8caf-8c0ab7abd220');assert.equal(hash(target.owner_id),'1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');
 receipt.campaignId=campaignId;receipt.connectionMetadata=[];
 for(const table of ['ga4_connections','google_sheets_connections','hubspot_connections','salesforce_connections','shopify_connections']){
  const columns=(await client.query("SELECT column_name,data_type FROM information_schema.columns WHERE table_schema='public' AND table_name=$1",[table])).rows;
  const expiry=columns.filter(c=>['expires_at','access_token_expires_at','refresh_token_expires_at'].includes(c.column_name));
  const fields=['access_token','refresh_token','client_secret'].filter(f=>columns.some(c=>c.column_name===f));
  const selected=['id','is_active',...expiry.map(c=>`${c.column_name}::text AS ${c.column_name}`),'encrypted_tokens IS NOT NULL AS encrypted_present',`(${fields.map(f=>`NULLIF(${f},'') IS NOT NULL`).join(' OR ')||'false'}) AS plaintext_present`];
  receipt.connectionMetadata.push({table,expiryTypes:expiry,rows:(await client.query(`SELECT ${selected.join(',')} FROM ${table} WHERE campaign_id=$1 ORDER BY id`,[campaignId])).rows});
 }
 receipt.sources=(await client.query("SELECT id,source_type,is_active,currency,mapping_config::jsonb->>'lastSyncedAt' last_synced_at,mapping_config::jsonb->>'lastRefreshRunId' last_refresh_run_id,mapping_config::jsonb->>'lastTotalRevenue' last_total_revenue FROM revenue_sources WHERE campaign_id=$1 ORDER BY id",[campaignId])).rows;
 receipt.work=(await client.query("SELECT id,status,due_at,started_at,completed_at,reporting_date,attempt_count,scope_hash LIKE 'invalidated:%' invalidated,last_error IS NOT NULL has_error FROM ga4_refresh_work WHERE campaign_id=$1 ORDER BY due_at DESC,completed_at DESC NULLS LAST LIMIT 4",[campaignId])).rows;
 receipt.snapshots=(await client.query("SELECT DISTINCT ON(snapshot_type) snapshot_type,reporting_date,recorded_at::text recorded_at,notes LIKE 'ga4_aligned_refresh_v1:%' aligned FROM metric_snapshots WHERE campaign_id=$1 ORDER BY snapshot_type,reporting_date DESC,recorded_at DESC",[campaignId])).rows;
 assert.ok(receipt.connectionMetadata.every(t=>t.rows.length===1&&t.rows[0].is_active&&t.rows[0].encrypted_present&&!t.rows[0].plaintext_present));
 assert.ok(receipt.work.some(w=>w.status==='completed'&&!w.invalidated&&!w.has_error));
 await client.query('ROLLBACK');receipt.result='PASS_SCHEDULED_PUBLICATION_METADATA';
 receipt.limits='Naive timestamps are returned as stored text, avoiding Windows pg timezone conversion. Advanced expiry metadata and completed publications are observational continuity evidence, not captured token-grant exchanges or reconnect/revocation acceptance.';
}catch(e){receipt.errorCode=e.code||e.name;process.exitCode=1}finally{await client?.end().catch(()=>{});const name='provider-publication-'+receipt.at.replace(/[:.]/g,'-')+'.json';fs.writeFileSync(path.join(__dirname,name),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:receipt.result,file:name,errorCode:receipt.errorCode,sources:receipt.sources,work:receipt.work}));}})();
