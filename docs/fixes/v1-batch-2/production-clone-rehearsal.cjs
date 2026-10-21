// LOCAL CLONE ONLY. Executes the actual startup callback with all workers stubbed.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),{sql}=require('drizzle-orm');
const privateDir=path.resolve('audit-temp/v1-batch2-predeploy-private');
const target='v1_batch2_production_clone';
const pool=new Pool({host:'127.0.0.1',port:55443,user:'v1_audit',database:target,statement_timeout:120000,query_timeout:125000});
const result={at:new Date().toISOString(),target:'127.0.0.1:55443/'+target,boundary:'Actual production backup restored locally; actual startup SQL; provider and worker registration stubbed. Production database not used by this script.',checks:[]};
const compile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function boot(source,db=drizzle(pool)){
 const sf=ts.createSourceFile('index.ts',source,99,true);let callback;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='setTimeout'&&n.arguments[1]?.getText(sf)==='5000')callback=n.arguments[0].getText(sf);ts.forEachChild(n,visit);}visit(sf);assert.ok(callback);
 const calls=[],errors=[],exits=[];
 const env={db,sql,readFileSync:fs.readFileSync,resolve:path.resolve,port:0,process:{cwd:()=>process.cwd(),exit:c=>exits.push(c)},log(){},console:{error:(...a)=>errors.push(a.map(String).join(' '))},snapshotScheduler:{start:()=>calls.push('snapshots')},executiveSummarySnapshotScheduler:{start:()=>calls.push('executive')}};
 for(const name of ['startKPIScheduler','startReportScheduler','startLinkedInScheduler','startMetaScheduler','startGoogleSheetsTokenScheduler','startDailyAutoRefreshScheduler','startGA4DailyScheduler','startGoogleAdsScheduler','startInstagramScheduler','startTikTokScheduler','startAlertEmailScheduler'])env[name]=()=>calls.push(name);
 const instance=new Function(...Object.keys(env),compile(`let applicationReady=false;return {run:${callback},ready:()=>applicationReady};`))(...Object.values(env));
 return {...instance,calls,errors,exits};
}
function safeName(n){assert.match(n,/^[a-z_0-9]+$/);return '"'+n+'"';}
async function fingerprint(columns){
 const rows={};
 for(const [table,cols] of Object.entries(columns)){
  const r=await pool.query(`SELECT count(*)::text count,coalesce(sum(hashtextextended(to_jsonb(r)::text,0)::numeric),0)::text hash0,coalesce(sum(hashtextextended(to_jsonb(r)::text,1)::numeric),0)::text hash1 FROM (SELECT ${cols.map(safeName).join(',')} FROM ${safeName(table)}) r`);
  rows[table]=r.rows[0];
 }
 return rows;
}
function noSeedRollback(){
 const base=execFileSync('git',['show','afce1ced06c8ecfcf2178be4a33a9c0148214dc6:server/index.ts'],{encoding:'utf8',windowsHide:true});
 const sf=ts.createSourceFile('index.ts',base,99,true),cuts=[];
 function visit(n){if(ts.isFunctionDeclaration(n)&&n.name?.text==='seedDashboardData')cuts.push([n.getFullStart(),n.end]);if(ts.isTryStatement(n)&&n.tryBlock.statements.some(s=>ts.isExpressionStatement(s)&&ts.isAwaitExpression(s.expression)&&ts.isCallExpression(s.expression.expression)&&s.expression.expression.expression.getText(sf)==='seedDashboardData'))cuts.push([n.getFullStart(),n.end]);ts.forEachChild(n,visit);}visit(sf);assert.equal(cuts.length,2);
 let source=base;for(const [a,b]of cuts.sort((x,y)=>y[0]-x[0]))source=source.slice(0,a)+source.slice(b);
 assert.equal(source.includes('seedDashboardData'),false);
 fs.writeFileSync(path.join(privateDir,'rollback-index.ts'),source);
 result.rollback={base:'afce1ced06c8ecfcf2178be4a33a9c0148214dc6',change:'Only the seed function and invocation are removed; additive Batch 2 schema retained.',sourceSha256:crypto.createHash('sha256').update(source).digest('hex'),artifact:'audit-temp/v1-batch2-predeploy-private/rollback-index.ts',deployed:false};
 return source;
}
(async()=>{
 const identity=(await pool.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,version() version')).rows[0];assert.equal(identity.db,target);assert.equal(identity.host,'127.0.0.1');assert.equal(identity.port,55443);result.localVersion=identity.version;
 if(process.argv.includes('--rollback-only')){
  const prior=JSON.parse(fs.readFileSync('docs/fixes/v1-batch-2/production-clone-results.json','utf8'));
  assert.equal(prior.target,result.target);assert.equal(prior.checks.length,3);assert.ok(prior.checks.every(c=>c.result==='PASS'));assert.equal(prior.error?.code,'ERR_ASSERTION');assert.ok(prior.error.message.includes('3 !== 2'));
  for(const f of JSON.parse(fs.readFileSync('docs/fixes/v1-batch-2/candidate-files.json','utf8')).files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);
  Object.assign(result,prior,{resumedAt:new Date().toISOString(),resumeBoundary:'Only rollback source-builder fixture corrected; previous three successful scenarios retained; all 35 candidate hashes rechecked.'});
  const columns={};for(const c of JSON.parse(fs.readFileSync('docs/fixes/v1-batch-2/deployment-preflight.json','utf8')).columns)if(prior.before[c.table_name])(columns[c.table_name]??=[]).push(c.column_name);
  assert.deepEqual(Object.keys(columns).sort(),Object.keys(prior.before).sort());
  console.log('Checking previous-runtime schema compatibility with seed removed.');
  const rollback=boot(noSeedRollback());await rollback.run();assert.deepEqual(rollback.exits,[]);assert.deepEqual(rollback.errors,[]);assert.equal(rollback.calls.length,13);assert.deepEqual(await fingerprint(columns),prior.before);
  result.checks.push({name:'previous-runtime startup with seed removed against upgraded schema',result:'PASS',boundary:'Startup/schema compatibility only; not an application rollback deployment or provider/UI test.'});
  delete result.error;result.result='PASS';return;
 }
 const cols=(await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows;
 const columns={};for(const c of cols)(columns[c.table_name]??=[]).push(c.column_name);
 console.log('Fingerprinting all restored tables.');
 const before=await fingerprint(columns);result.before=before;result.totalRows=Object.values(before).reduce((n,r)=>n+Number(r.count),0);result.tablesChecked=Object.keys(before).length;
 for(const label of ['actual upgrade','repeat upgrade']){
  console.log('Checking '+label+'.');
  const b=boot(fs.readFileSync('server/index.ts','utf8')),start=Date.now();await b.run();const migrationElapsedMs=Date.now()-start;
  if(b.errors.length)fs.writeFileSync(path.join(privateDir,label.replaceAll(' ','-')+'.errors'),b.errors.join('\n'));
  assert.deepEqual(b.exits,[]);assert.deepEqual(b.errors,[]);assert.equal(b.ready(),true);assert.equal(b.calls.length,13);
  const after=await fingerprint(columns);assert.deepEqual(after,before);
  result.checks.push({name:label,result:'PASS',migrationElapsedMs,schemaAndFingerprintElapsedMs:Date.now()-start,unchangedExistingTables:Object.keys(before).length});
  console.log(label+': PASS; all existing table fingerprints unchanged.');
 }
 const indexes=(await pool.query("SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND indexname IN ('ga4_daily_metrics_campaign_property_date_unique','linkedin_daily_metrics_campaign_date_unique','google_ads_daily_metrics_campaign_date_unique','meta_daily_metrics_campaign_date_unique','campaign_creation_requests_scope_unique') ORDER BY indexname")).rows;assert.equal(indexes.length,5);result.newIndexes=indexes;
 const constraint=(await pool.query("SELECT convalidated,pg_get_constraintdef(oid) definition FROM pg_constraint WHERE conrelid='campaigns'::regclass AND conname='campaigns_client_id_clients_id_fk'")).rows[0];assert.ok(constraint);result.clientConstraint=constraint;
 // Prove a subsequent failure rolls back the real startup migration transaction on this schema.
 console.log('Checking failed migration rollback and retry.');
 await pool.query('DROP TABLE campaign_creation_requests');
 const baseDb=drizzle(pool);
 const wrapped={transaction:fn=>baseDb.transaction(async tx=>{await fn(tx);throw new Error('EXPECTED_REHEARSAL_ROLLBACK');})};
 const failed=boot(fs.readFileSync('server/index.ts','utf8'),wrapped);await failed.run();assert.equal(failed.ready(),false);assert.deepEqual(failed.exits,[1]);assert.equal(failed.calls.length,0);assert.equal(failed.errors.length,1);assert.match(failed.errors[0],/EXPECTED_REHEARSAL_ROLLBACK/);
 assert.equal((await pool.query("SELECT to_regclass('campaign_creation_requests') name")).rows[0].name,null);
 const restore=boot(fs.readFileSync('server/index.ts','utf8'));await restore.run();assert.equal(restore.ready(),true);assert.deepEqual(await fingerprint(columns),before);
 result.checks.push({name:'additive migration rollback and retry on restored production schema',result:'PASS'});
 console.log('Checking previous-runtime schema compatibility with seed removed.');
 const rollback=boot(noSeedRollback());await rollback.run();assert.deepEqual(rollback.exits,[]);assert.deepEqual(rollback.errors,[]);assert.equal(rollback.calls.length,13);assert.deepEqual(await fingerprint(columns),before);
 result.checks.push({name:'previous-runtime startup with seed removed against upgraded schema',result:'PASS',boundary:'Startup/schema compatibility only; not an application rollback deployment or provider/UI test.'});
 result.result='PASS';
})().catch(e=>{result.result='FAIL';result.error={code:e.code||e.name,message:e.name==='AssertionError'?String(e.message).slice(0,500):'See protected local error log'};fs.writeFileSync(path.join(privateDir,'rehearsal-error.txt'),String(e.stack));process.exitCode=1;}).finally(async()=>{await pool.end();result.completedAt=new Date().toISOString();fs.writeFileSync('docs/fixes/v1-batch-2/production-clone-results.json',JSON.stringify(result,null,2)+'\n');const {before,...summary}=result;console.log(JSON.stringify(summary,null,2));});
