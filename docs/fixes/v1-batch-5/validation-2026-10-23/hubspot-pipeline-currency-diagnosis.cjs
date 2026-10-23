// Read only exact user test campaign and bounded HubSpot search; no OAuth refresh or database/provider mutation.
const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { parseEnv } = require('node:util'), { Client } = require('pg'), ts = require('typescript');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const output = `${__dirname}/hubspot-pipeline-currency-diagnosis.json`;
assert.ok(!fs.existsSync(output));
const result = { at: new Date().toISOString(), campaignName: 'V1 Batch 5 Test', databaseWrites: false, providerWrites: false, oauthRefresh: false };
let db;
(async () => {
 const healthResponse = await fetch('https://marketforensics.onrender.com/api/health', {signal: AbortSignal.timeout(20000)});
 const health = await healthResponse.json(); result.live = {httpStatus: healthResponse.status, commit: health.commit, ok: health.ok};
 assert.equal(healthResponse.status,200); assert.equal(health.commit,'de3ce82f9297d84f3571690a996c573543d6b0c4');
 const env = parseEnv(fs.readFileSync('.env','utf8')), url = new URL(env.DATABASE_URL);
 assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])),'073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');
 for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options']) url.searchParams.delete(key);
 db = new Client({connectionString:url.href,ssl:{rejectUnauthorized:true},options:'-c default_transaction_read_only=on',connectionTimeoutMillis:10000,statement_timeout:10000,query_timeout:12000,lock_timeout:2000,idle_in_transaction_session_timeout:15000});
 await db.connect(); await db.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
 const campaigns = (await db.query('SELECT id,currency,ga4_campaign_filter,owner_id IS NOT NULL AS owned FROM campaigns WHERE name=$1',[result.campaignName])).rows;
 assert.equal(campaigns.length,1); const campaign=campaigns[0];assert.equal(campaign.owned,true);assert.equal(hash(campaign.id),'de4775c3b435c3350ea24f5d538e60e639c9f9cd21de63d5432956b44551e722');
 const sources = (await db.query("SELECT id,mapping_config FROM revenue_sources WHERE campaign_id=$1 AND source_type='hubspot' AND is_active=true AND platform_context='ga4'",[campaign.id])).rows;
 assert.equal(sources.length,1);const cfg=JSON.parse(sources[0].mapping_config);
 assert.equal(cfg.campaignProperty,'dealname');assert.deepEqual(cfg.selectedValues,['yesop_prospecting']);assert.equal(cfg.pipelineStageId,'contractsent');assert.equal(cfg.revenueProperty,'amount');
 result.campaign={currency:campaign.currency,scope:campaign.ga4_campaign_filter};
 result.source={ref:hash(sources[0].id),pipelineTotalToDate:cfg.pipelineTotalToDate,pipelineCurrency:cfg.pipelineCurrency,pipelineProxyMode:cfg.pipelineProxyMode,pipelineLastUpdatedAt:cfg.pipelineLastUpdatedAt,pipelineWarning:cfg.pipelineWarning,items:cfg.pipelineValueRevenueTotals};
 const connections=(await db.query('SELECT access_token,encrypted_tokens,expires_at FROM hubspot_connections WHERE campaign_id=$1 AND is_active=true ORDER BY connected_at DESC',[campaign.id])).rows;
 assert.equal(connections.length,1);const conn=connections[0];
 await db.query('ROLLBACK');await db.end();db=null;result.transactionEnded='ROLLBACK';
 const vault={};const code=ts.transpileModule(fs.readFileSync('server/utils/tokenVault.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
 const keyEnv={NODE_ENV:'production'};for(const key of ['TOKEN_ENCRYPTION_KEY','ENCRYPTION_KEY']) if(env[key]||process.env[key]) keyEnv[key]=env[key]||process.env[key];
 new Function('require','exports','process',code)(name=>{assert.equal(name,'crypto');return crypto;},vault,{env:keyEnv});
 const accessToken=vault.decryptTokens(conn.encrypted_tokens).accessToken||conn.access_token;
 assert.ok(accessToken,'Available access token required; no refresh performed');
 const read=async(path,body)=>{const r=await fetch('https://api.hubapi.com'+path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${accessToken}`,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),redirect:'error',signal:AbortSignal.timeout(20000)});return {status:r.status,data:r.ok?await r.json():null};};
 result.properties=[];
 for(const name of ['hs_currency','deal_currency_code']){const r=await read('/crm/v3/properties/deals/'+name);result.properties.push({requested:name,httpStatus:r.status,...(r.data?{name:r.data.name,label:r.data.label,hubspotDefined:r.data.hubspotDefined,type:r.data.type}: {})});}
 const found=[];let after;const seen=new Set();
 for(let i=0;i<5;i++){
  const r=await read('/crm/v3/objects/deals/search',{filterGroups:[{filters:[{propertyName:cfg.campaignProperty,operator:'IN',values:cfg.selectedValues},{propertyName:'dealstage',operator:'IN',values:[cfg.pipelineStageId]}]}],properties:[cfg.campaignProperty,cfg.revenueProperty,'hs_currency','deal_currency_code','dealstage'],limit:100,...(after?{after}: {})});
  result.searchHttpStatus=r.status;assert.equal(r.status,200);assert.ok(Array.isArray(r.data.results));assert.ok(r.data.total<=500);
  for(const row of r.data.results){assert.ok(!seen.has(row.id));seen.add(row.id);const q=row.properties;assert.ok(cfg.selectedValues.includes(q[cfg.campaignProperty]));assert.equal(q.dealstage,cfg.pipelineStageId);found.push({ref:hash(String(row.id)),amount:q.amount,hs_currency:q.hs_currency??null,deal_currency_code:q.deal_currency_code??null,stage:q.dealstage});}
  after=r.data.paging?.next?.after;if(!after){assert.equal(found.length,r.data.total);break;}
 }
 assert.ok(!after);result.deals=found;result.result='EXACT_SOURCE_PROVIDER_READ_COMPLETE';
})().catch(e=>{result.result='CHECK_INCOMPLETE';result.errorCode=e.code||e.name;process.exitCode=1;}).finally(async()=>{if(db)await db.end().catch(()=>{});fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(result));});
