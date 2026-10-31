// Current storage methods, two separate Node processes, disposable loopback schema.
// Never loads .env, app startup, live identities, credentials, or providers.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const {spawnSync}=require('node:child_process'),{Pool}=require('pg'),orm=require('drizzle-orm'),{drizzle}=require('drizzle-orm/node-postgres'),{PgDialect}=require('drizzle-orm/pg-core');
const target='postgresql://v1_audit@127.0.0.1:55444/notifications_test';
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const schema={};new Function('exports','require',compile(fs.readFileSync('shared/schema.ts','utf8')))(schema,require);
const src=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),methods=new Map();
function visit(n){if(ts.isMethodDeclaration(n))methods.set(n.name.getText(src),n.getText(src));ts.forEachChild(n,visit)}visit(src);
const names=['getAttributionModels','getAttributionModel','createAttributionModel','setDefaultAttributionModel','getCustomerJourneys','getCustomerJourney','createCustomerJourney','createTouchpoint','getJourneyTouchpoints','getCampaignTouchpoints','calculateAttributionResults','getAttributionResults'];
function storage(db){const deps={...schema,...orm,db,randomUUID:crypto.randomUUID};return new Function(...Object.keys(deps),compile(`class S{${names.map(n=>{assert.ok(methods.has(n));return methods.get(n)}).join('\n')}}return new S()`))(...Object.values(deps))}
async function child(phase,namespace){
 assert.match(namespace,/^b1_restart_[a-f0-9]{32}$/);assert.ok(['write','read'].includes(phase));
 const pool=new Pool({connectionString:target,options:`-c search_path=${namespace}`,max:2,statement_timeout:10000}),db=drizzle(pool),s=storage(db),checks=[];
 try{
  if(phase==='write'){
   await db.insert(schema.clients).values([{id:'client-a',ownerId:'owner-a',name:'A'},{id:'client-b',ownerId:'owner-b',name:'B'}]);
   await db.insert(schema.campaigns).values([{id:'campaign-a',clientId:'client-a',ownerId:'owner-a',name:'A',currency:'EUR',status:'draft'},{id:'campaign-b',clientId:'client-b',ownerId:'owner-b',name:'B',currency:'EUR',status:'draft'}]);
   const a=await s.createAttributionModel({name:'A original',type:'linear'},'owner-a'),a2=await s.createAttributionModel({name:'A selected',type:'linear'},'owner-a'),b=await s.createAttributionModel({name:'B untouched',type:'linear'},'owner-b');
   await s.setDefaultAttributionModel(b.id);await s.setDefaultAttributionModel(a.id);await s.setDefaultAttributionModel(a2.id);
   assert.equal((await s.getAttributionModel(b.id)).isDefault,true);assert.equal((await s.getAttributionModel(a.id)).isDefault,false);checks.push('Default selection changes only the selected owner');
   const j=await s.createCustomerJourney({customerId:'synthetic',journeyStart:new Date('2026-10-01T00:00:00Z'),conversionValue:'30.00'},'owner-a');
   await s.createTouchpoint({journeyId:j.id,campaignId:'campaign-a',channel:'email',touchpointType:'click',position:1,timestamp:new Date('2026-10-01T00:00:00Z')});
   await assert.rejects(s.createTouchpoint({journeyId:j.id,campaignId:'campaign-b',channel:'email',touchpointType:'click',position:2,timestamp:new Date()}),/Campaign unavailable/);checks.push('Campaign-linked owner accepted and foreign parent rejected');
   assert.deepEqual(await s.calculateAttributionResults(j.id,b.id),[]);const result=await s.calculateAttributionResults(j.id,a2.id);assert.equal(result.length,1);assert.equal(Number(result[0].attributedValue),30);checks.push('Calculation respects model owner and persists exact linked result');
  }else{
   const a=await s.getAttributionModels('owner-a'),b=await s.getAttributionModels('owner-b');assert.equal(a.length,2);assert.equal(b.length,1);assert.deepEqual(a.filter(x=>x.isDefault).map(x=>x.name),['A selected']);assert.equal(b[0].isDefault,true);checks.push('Fresh process retains both owner partitions and defaults');
   const journeys=await s.getCustomerJourneys(undefined,'owner-a');assert.equal(journeys.length,1);assert.deepEqual(await s.getCustomerJourneys(undefined,'owner-b'),[]);
   const points=await s.getCampaignTouchpoints('campaign-a');assert.equal(points.length,1);assert.equal(points[0].journeyId,journeys[0].id);assert.deepEqual(await s.getCampaignTouchpoints('campaign-b'),[]);checks.push('Fresh process retains linked touchpoint and denies cross-owner collection');
   const results=await s.getAttributionResults(journeys[0].id,a.find(x=>x.isDefault).id);assert.equal(results.length,1);assert.equal(results[0].campaignId,'campaign-a');assert.equal(Number(results[0].attributedValue),30);checks.push('Fresh process retains calculated value and campaign provenance');
  }
  console.log(JSON.stringify({phase,pid:process.pid,result:'PASS',checks}));
 }finally{await pool.end()}
}
async function main(){
 const namespace='b1_restart_'+crypto.randomUUID().replaceAll('-',''),admin=new Pool({connectionString:target,max:1,statement_timeout:15000}),receipt={at:new Date().toISOString(),boundary:'Two terminated/fresh Node processes using exact current storage bodies and an isolated loopback PostgreSQL schema; not a Render restart or whole-attribution analytics certification.',phases:[],storageSha256:crypto.createHash('sha256').update(fs.readFileSync('server/storage.ts')).digest('hex')};
 let created=false;
 try{
  await admin.query(`CREATE SCHEMA "${namespace}"`);created=true;await admin.query(`SET search_path TO "${namespace}"`);const dialect=new PgDialect();
  for(const name of ['clients','campaigns','attributionModels','customerJourneys','touchpoints','attributionResults']){const table=schema[name],columns=Object.values(orm.getTableColumns(table)).map(c=>{const v=c.default,def=v instanceof orm.SQL?dialect.sqlToQuery(v).sql:typeof v==='string'?`'${v.replaceAll("'","''")}'`:String(v);return `"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${v!==undefined?` DEFAULT ${def}`:''}${c.primary?' PRIMARY KEY':''}`});await admin.query(`CREATE TABLE "${orm.getTableName(table)}" (${columns.join(',')})`)}
  const env={};for(const[k,v]of Object.entries(process.env))if(/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(k))env[k]=v;
  Object.assign(env,{NODE_ENV:'test',DATABASE_URL:'',NODE_OPTIONS:`--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\','/')}`});
  for(const phase of ['write','read']){const r=spawnSync(process.execPath,[__filename,'--child',phase,namespace],{env,encoding:'utf8',windowsHide:true,timeout:60000});assert.equal(r.status,0,r.stderr);const result=JSON.parse(r.stdout);assert.equal(result.result,'PASS');receipt.phases.push(result)}
  assert.notEqual(receipt.phases[0].pid,receipt.phases[1].pid);receipt.result='PASS';
 }catch(e){receipt.result='FAIL';receipt.error=e.message;process.exitCode=1}
 finally{if(created){assert.match(namespace,/^b1_restart_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA "${namespace}" CASCADE`);receipt.schemaRemoved=(await admin.query('SELECT count(*)::int n FROM pg_namespace WHERE nspname=$1',[namespace])).rows[0].n===0}await admin.end();fs.writeFileSync(path.join(__dirname,'attribution-process-restart.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))}
}
if(process.argv[2]==='--child')child(process.argv[3],process.argv[4]).catch(e=>{console.error(e.message);process.exitCode=1});else main().catch(e=>{console.error(e.message);process.exitCode=1});
