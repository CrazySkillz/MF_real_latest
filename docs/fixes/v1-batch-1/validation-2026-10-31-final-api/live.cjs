// Explicit modes only; exact disposable fixture, pinned database, no providers/app startup.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseEnv}=require('node:util'),{Client}=require('pg');
const fixture=require('./fixture.cjs'),hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const mode=process.argv[2],allowed=['preflight','seed-rehearsal','seed','inspect','cleanup-rehearsal','cleanup','cleanup-partial'];
assert.ok(allowed.includes(mode),'Explicit reviewed mode required');
const manifestPath=path.join(__dirname,'manifest.json'),receipt={at:new Date().toISOString(),mode,result:'NOT_VERIFIED',secretValuesReturned:false,providerCalls:0};let client;
async function owner(){const row=(await client.query('SELECT id,owner_id,name FROM clients WHERE id=$1',['e3ec20ad-89ea-450d-8caf-8c0ab7abd220'])).rows[0];assert.ok(row);assert.equal(hash(row.owner_id),'1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');assert.equal(row.name,'Batch 1 Validation');return{ownerId:row.owner_id,clientId:row.id}}
async function noFixture(m){
 for(const[k,table]of Object.entries(fixture.tables))assert.equal((await client.query(`SELECT id FROM ${table} WHERE id=$1`,[m.ids[k]])).rowCount,0);
 for(const {table_name:table}of(await client.query("SELECT table_name FROM information_schema.columns WHERE table_schema='public' AND column_name='campaign_id' ORDER BY table_name")).rows){assert.match(table,/^[a-z_][a-z0-9_]*$/);assert.equal((await client.query(`SELECT count(*)::int n FROM "${table}" WHERE campaign_id=$1`,[m.ids.campaign])).rows[0].n,0)}
 assert.equal((await client.query('SELECT count(*)::int n FROM attribution_results WHERE journey_id=$1 OR attribution_model_id=ANY($2::text[]) OR touchpoint_id=$3',[m.ids.journey,[m.ids.modelA,m.ids.modelB],m.ids.touchpoint])).rows[0].n,0);
}
function checkedSources(){const r=JSON.parse(fs.readFileSync(path.join(__dirname,'rehearsal.json')));assert.equal(r.result,'PASS');assert.equal(r.schemaRemoved,true);assert.equal(r.apiChecks.length,18);assert.equal(r.checks.length,13);for(const[f,h]of Object.entries(r.sourceHashes))assert.equal(hash(fs.readFileSync(path.join(__dirname,f))),h,`Unrehearsed ${f}`);for(const[f,h]of Object.entries(r.appHashes))assert.equal(hash(fs.readFileSync(f)),h,`Changed ${f}`);return r}
(async()=>{try{
 checkedSources();const u=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);assert.equal(hash(JSON.stringify([u.hostname,u.port||'5432',u.pathname])),'073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0');for(const k of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])u.searchParams.delete(k);
 client=new Client({connectionString:u.href,ssl:{rejectUnauthorized:true},application_name:'batch1-exact-final-fixture',connectionTimeoutMillis:10000,statement_timeout:20000,query_timeout:25000});await client.connect();await client.query("SET search_path TO public");const o=await owner();
 if(mode==='preflight'){
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
  receipt.existingOwnerModels=(await client.query('SELECT count(*)::int n FROM attribution_models WHERE owner_id=$1',[o.ownerId])).rows[0].n;assert.equal(receipt.existingOwnerModels,0,'Existing models prevent disposable default test');
  receipt.protectedCampaigns=(await client.query('SELECT id,status FROM campaigns WHERE id=ANY($1::text[]) ORDER BY id',[['b74f98af-ede9-47af-9b19-0720ebb4d2c0','36493a43-accd-4360-8ff2-de62f5a19b6e','36631f9f-5f32-4ae6-8d20-d8430abb364c']])).rows;assert.equal(receipt.protectedCampaigns.length,3);
  const m=fs.existsSync(manifestPath)?JSON.parse(fs.readFileSync(manifestPath)):fixture.plan();fixture.validate(m);await noFixture(m);await client.query('ROLLBACK');
  if(!fs.existsSync(manifestPath))fs.writeFileSync(manifestPath,JSON.stringify(m,null,2)+'\n',{flag:'wx'});receipt.manifest=m;receipt.databaseWritesAttempted=false;
 }else{
  const m=JSON.parse(fs.readFileSync(manifestPath));fixture.validate(m);receipt.run=m.run;
  if(mode.startsWith('seed')){
   assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'preflight.json'))).result,'PASS');
   if(mode==='seed'){
    assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'seed-rehearsal.json'))).result,'PASS');
    const release=JSON.parse(fs.readFileSync(path.join(__dirname,'release.json')));assert.equal(release.result,'PASS');assert.match(release.commit,/^[a-f0-9]{40}$/);assert.equal(release.runtime.commit,release.commit);assert.equal(release.runtime.ok,true);assert.equal(release.workflow.conclusion,'success');assert.equal(release.workflow.headSha,release.commit);assert.ok(Date.now()-Date.parse(release.at)<15*60*1000,'Recheck deployed release');
   }
   receipt.execution=await fixture.seed(client,m,o,mode==='seed');if(mode==='seed')fs.writeFileSync(path.join(__dirname,'manual.js'),fs.readFileSync(path.join(__dirname,'manual-template.js'),'utf8').replace('/* FINAL_FIXTURE */ null',JSON.stringify(m)),'utf8');else await noFixture(m);
  }else if(mode==='inspect'){
   await client.query('BEGIN');try{receipt.execution=await fixture.inspect(client,m,o,true)}finally{await client.query('ROLLBACK')}
  }else{
   if(mode==='cleanup')assert.equal(JSON.parse(fs.readFileSync(path.join(__dirname,'cleanup-rehearsal.json'))).result,'PASS');
   receipt.execution=await fixture.cleanup(client,m,o,mode!=='cleanup-rehearsal',mode!=='cleanup-partial');if(mode!=='cleanup-rehearsal')await noFixture(m);
  }
 }
 receipt.result='PASS';
 }catch(e){receipt.errorCode=e.code||e.name;receipt.result='NOT_VERIFIED';process.exitCode=1}
 finally{await client?.end().catch(()=>{});fs.writeFileSync(path.join(__dirname,`${mode}.json`),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))}
})();
