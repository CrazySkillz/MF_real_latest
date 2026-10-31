// Bounded fixture operations only; no application startup/provider loading.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),{parseEnv}=require('node:util'),{Client}=require('pg');
const fixture=require('./fixture.cjs'),hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const dir=__dirname,mode=process.argv[2],commit=process.argv.includes('--commit'),args=process.argv.slice(3).filter(x=>x!=='--commit');
assert.ok(['plan','inventory','seed','cleanup','cancel','verify'].includes(mode));
if(mode==='plan'){
 const run=crypto.randomUUID(),m={version:1,run,tag:`B1_SOURCE_${run}`,ids:Object.fromEntries(Object.keys(fixture.tables).map(key=>[key,crypto.randomUUID()]))};fixture.validate(m);
 fs.writeFileSync(path.join(dir,'manifest.json'),JSON.stringify(m,null,2)+'\n',{flag:'wx'});
 fs.writeFileSync(path.join(dir,'manual-source-bundle.js'),fs.readFileSync(path.join(dir,'manual-template.js'),'utf8').replace('/* SOURCE_FIXTURE */ null',JSON.stringify(m)),{flag:'wx'});
 console.log('Exact-ID plan and browser script prepared locally. No database connection.');
}else{
 const mBytes=fs.readFileSync(path.join(dir,'manifest.json')),m=JSON.parse(mBytes);fixture.validate(m);
 const rehearsal=JSON.parse(fs.readFileSync(path.join(dir,'rehearsal.json')));assert.equal(rehearsal.result,'PASS');
 for(const name of ['fixture.cjs','manual-template.js'])assert.equal(hash(fs.readFileSync(path.join(dir,name))),rehearsal.sourceHashes[name]);
 assert.equal(fs.readFileSync(path.join(dir,'manual-source-bundle.js'),'utf8'),fs.readFileSync(path.join(dir,'manual-template.js'),'utf8').replace('/* SOURCE_FIXTURE */ null',JSON.stringify(m)));
 const receipt={at:new Date().toISOString(),mode,commitRequested:commit,manifestSha256:hash(mBytes),run:m.run,providerCalls:0,secretValuesEmitted:false};let client;
 (async()=>{
   const url=new URL(parseEnv(fs.readFileSync('.env','utf8')).DATABASE_URL);
   const target='073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0';assert.equal(hash(JSON.stringify([url.hostname,url.port||'5432',url.pathname])),target);
   for(const key of ['sslmode','sslcert','sslkey','sslrootcert','ssl','options'])url.searchParams.delete(key);
   client=new Client({connectionString:url.href,ssl:{rejectUnauthorized:true},application_name:'batch1-source-acceptance',connectionTimeoutMillis:10000,statement_timeout:15000,query_timeout:18000});await client.connect();
   await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');assert.equal((await client.query('SHOW transaction_read_only')).rows[0].transaction_read_only,'on');
   assert.equal((await client.query('SELECT current_schema() name')).rows[0].name,'public');
   receipt.tablePresence={};for(const table of new Set(Object.values(fixture.tables)))receipt.tablePresence[table]=(await client.query('SELECT to_regclass($1) IS NOT NULL present',[`public.${table}`])).rows[0].present;
   if(mode==='inventory'){receipt.result='PASS_TABLE_INVENTORY';receipt.databaseReadOnly=true;receipt.exactRemaining={};for(const [key,table]of Object.entries(fixture.tables))if(receipt.tablePresence[table])receipt.exactRemaining[key]=(await client.query(`SELECT count(*)::int n FROM ${table} WHERE id=$1`,[m.ids[key]])).rows[0].n;await client.query('ROLLBACK');return;}
   assert.ok(Object.values(receipt.tablePresence).every(Boolean),'Fixture tables must already exist');
   assert.equal((await client.query("SELECT count(*)::int n FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname=ANY($1::text[]) AND NOT t.tgisinternal",[[...new Set(Object.values(fixture.tables))]])).rows[0].n,0);
   const protectedIds=['b74f98af-ede9-47af-9b19-0720ebb4d2c0','36493a43-accd-4360-8ff2-de62f5a19b6e','36631f9f-5f32-4ae6-8d20-d8430abb364c'];
   const rows=(await client.query('SELECT id,name,status,owner_id,client_id FROM campaigns WHERE id=ANY($1::text[]) ORDER BY id',[protectedIds])).rows;assert.equal(rows.length,3);assert.ok(rows.every(x=>x.status==='active'&&x.owner_id&&x.client_id));
   const primary=rows.find(x=>x.id===protectedIds[0]),secondary=rows.find(x=>x.id===protectedIds[2]);assert.equal(primary.owner_id,'user_3K7q6o5pF0aykjIQSHy5O7mVi2U');assert.equal(hash(secondary.owner_id),'1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096');
   assert.equal(primary.name,'Promo');assert.equal(secondary.name,'Batch 1 Provider Check');assert.equal(rows.find(x=>x.id===protectedIds[1]).owner_id,primary.owner_id);
   const owners={primary:{ownerId:primary.owner_id,clientId:primary.client_id},secondary:{ownerId:secondary.owner_id,clientId:secondary.client_id}};
   receipt.targetFingerprint=target;receipt.protectedCampaigns=rows.map(x=>({id:x.id,name:x.name,status:x.status,ownerHash:hash(x.owner_id),clientId:x.client_id}));
   if(mode==='verify'){
     assert.equal(commit,false);receipt.exactRemaining={};for(const [key,table]of Object.entries(fixture.tables)){receipt.exactRemaining[key]=(await client.query(`SELECT count(*)::int n FROM ${table} WHERE id=$1`,[m.ids[key]])).rows[0].n;assert.equal(receipt.exactRemaining[key],0);}
     receipt.result='PASS_ABSENCE_READBACK';receipt.databaseReadOnly=true;await client.query('ROLLBACK');return;
   }
   await client.query('ROLLBACK');
   if(commit){const dry=JSON.parse(fs.readFileSync(args[0]));assert.equal(dry.result,mode==='seed'?'PASS_SEED_REHEARSAL':mode==='cancel'?'PASS_CANCELLATION_REHEARSAL':'PASS_CLEANUP_REHEARSAL');assert.equal(dry.commitRequested,false);assert.equal(dry.manifestSha256,receipt.manifestSha256);assert.equal(dry.targetFingerprint,target);}
   if(mode==='cleanup'){
     const userBytes=fs.readFileSync(commit?args[1]:args[0]),user=JSON.parse(userBytes);
     assert.equal(user.batch1SourceBundle,'PASS_SOURCE_FOREIGN');assert.equal(user.phase,'awaiting_cleanup');assert.equal(user.run,m.run);assert.deepEqual(user.ids,m.ids);assert.equal(user.account,'Promo owner');
     assert.ok(user.ownerChecks?.length===9&&user.checks?.length===7&&[...user.ownerChecks,...user.checks].every(x=>x.passed===true));
     receipt.userReceiptSha256=hash(userBytes);
     if(commit)assert.equal(JSON.parse(fs.readFileSync(args[0])).userReceiptSha256,receipt.userReceiptSha256);
   }
   receipt.databaseWritesAttempted=true;receipt.operation=await fixture[mode==='cancel'?'cleanup':mode](client,m,owners,commit,mode==='cancel'?'partial':true);
   receipt.result=mode==='seed'?(commit?'PASS_EXACT_FIXTURE_SEED':'PASS_SEED_REHEARSAL'):mode==='cancel'?(commit?'PASS_EXACT_FIXTURE_CANCELLATION':'PASS_CANCELLATION_REHEARSAL'):(commit?'PASS_EXACT_FIXTURE_CLEANUP':'PASS_CLEANUP_REHEARSAL');
 })().catch(e=>{receipt.result='NOT_VERIFIED';receipt.errorCode=e.code||e.name;process.exitCode=1;}).finally(async()=>{await client?.end().catch(()=>{});const name=`${mode}-${receipt.at.replace(/[:.]/g,'-')}.json`;fs.writeFileSync(path.join(dir,name),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:receipt.result,file:name,errorCode:receipt.errorCode||null}));});
}
