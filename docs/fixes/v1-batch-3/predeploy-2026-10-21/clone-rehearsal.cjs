// LOCAL CLONE ONLY. Actual startup callback; provider and worker bodies never run.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const ts=require('typescript'),{execFileSync}=require('node:child_process'),{Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),{sql}=require('drizzle-orm');
const target='v1_batch3_production_clone',dir='docs/fixes/v1-batch-3/predeploy-2026-10-21',privateDir='audit-temp/v1-batch3-predeploy-private';
const pool=new Pool({host:'127.0.0.1',port:55443,user:'v1_audit',database:target,max:3,statement_timeout:120000,query_timeout:125000});
const tables=['ga4_daily_metrics','metric_snapshots','kpis','kpi_periods','kpi_progress','kpi_alerts','benchmarks','benchmark_history'];
const result={at:new Date().toISOString(),candidate:'001ddfa87c445a51e63320cde9737b774aa1af0c',target:'127.0.0.1:55443/'+target,boundary:'Fresh encrypted production backup restored locally. Actual startup SQL, stubbed worker/provider bodies. No production writes. PostgreSQL 18 rehearsal does not prove hosted PostgreSQL 17 timing or full runtime rollback.',checks:[]};
const source=fs.readFileSync('server/index.ts','utf8');
function boot(text,db=drizzle(pool)){
 const sf=ts.createSourceFile('index.ts',text,99,true);let callback;
 function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='setTimeout'&&n.arguments[1]?.getText(sf)==='5000')callback=n.arguments[0].getText(sf);ts.forEachChild(n,visit);}visit(sf);assert.ok(callback);
 const calls=[],errors=[],exits=[];
 const env={db,sql,readFileSync:fs.readFileSync,resolve:path.resolve,port:0,process:{cwd:()=>process.cwd(),exit:c=>exits.push(c)},log(){},console:{error:(...a)=>errors.push(a.map(e=>e instanceof Error?[e.message,e.cause?.message,e.cause?.code].filter(Boolean).join(' | '):String(e)).join(' '))},snapshotScheduler:{start:()=>calls.push('snapshots')},executiveSummarySnapshotScheduler:{start:()=>calls.push('executive')}};
 for(const name of ['startKPIScheduler','startReportScheduler','startLinkedInScheduler','startMetaScheduler','startGoogleSheetsTokenScheduler','startDailyAutoRefreshScheduler','startGA4DailyScheduler','startGoogleAdsScheduler','startInstagramScheduler','startTikTokScheduler','startAlertEmailScheduler'])env[name]=()=>calls.push(name);
 const code=ts.transpileModule(`let applicationReady=false;return {run:${callback},ready:()=>applicationReady};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 return {...new Function(...Object.keys(env),code)(...Object.values(env)),calls,errors,exits};
}
function ident(n){assert.match(n,/^[a-z_0-9]+$/);return '"'+n+'"';}
async function fingerprint(columns){
 const rows={},entries=Object.entries(columns);let cursor=0;
 async function worker(){while(cursor<entries.length){const [t,cols]=entries[cursor++];const r=await pool.query(`SELECT count(*)::text count,coalesce(sum(hashtextextended(to_jsonb(r)::text,0)::numeric),0)::text hash0,coalesce(sum(hashtextextended(to_jsonb(r)::text,1)::numeric),0)::text hash1 FROM (SELECT ${cols.map(ident).join(',')} FROM ${ident(t)}) r`);rows[t]=r.rows[0];}}
 await Promise.all([worker(),worker()]);return Object.fromEntries(Object.entries(rows).sort(([a],[b])=>a.localeCompare(b)));
}
async function types(){return (await pool.query("SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) type FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid WHERE c.oid=ANY($1::regclass[]) AND a.attnum>0 AND NOT a.attisdropped ORDER BY 1,2",[tables])).rows;}
async function mustBoot(label,text=source){const b=boot(text),start=Date.now();await b.run();if(b.errors.length)fs.writeFileSync(path.join(privateDir,label.replaceAll(' ','-')+'.errors'),b.errors.join('\n'));assert.deepEqual(b.errors,[]);assert.deepEqual(b.exits,[]);assert.equal(b.ready(),true);assert.equal(b.calls.length,13);return {name:label,result:'PASS',startupMs:Date.now()-start};}
function failed(b){assert.equal(b.ready(),false);assert.deepEqual(b.exits,[1]);assert.equal(b.calls.length,0);assert.equal(b.errors.length,1);}
(async()=>{
 const backup=JSON.parse(fs.readFileSync(dir+'/backup-restore-results.json','utf8'));assert.equal(backup.restore?.result,'PASS');assert.equal(backup.restore.target,result.target);
 const identity=(await pool.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port,version() version')).rows[0];assert.equal(identity.db,target);assert.equal(identity.host,'127.0.0.1');assert.equal(identity.port,55443);result.localVersion=identity.version;
 const columns={};for(const r of (await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema='public' ORDER BY table_name,ordinal_position")).rows)(columns[r.table_name]??=[]).push(r.column_name);
 const selected=Object.fromEntries(tables.map(t=>[t,columns[t]]));
 result.restoredTableBytes=(await pool.query('SELECT c.relname table_name,pg_relation_size(c.oid)::text heap_bytes,pg_total_relation_size(c.oid)::text total_bytes FROM pg_class c WHERE c.oid=ANY($1::regclass[]) ORDER BY c.relname',[tables])).rows;
 console.log('Fingerprinting all restored tables (two local read workers).');
 const before=await fingerprint(columns),beforeTypes=await types();result.before=before;result.tablesChecked=Object.keys(before).length;result.totalRows=Object.values(before).reduce((n,r)=>n+Number(r.count),0);
 const beforeSelected=Object.fromEntries(Object.entries(before).filter(([t])=>tables.includes(t)));
 console.log('Testing injected failure after migration SQL and before commit.');
 const failedBoot=boot(source,{transaction:fn=>drizzle(pool).transaction(async tx=>{await fn(tx);throw new Error('EXPECTED_BATCH3_MIGRATION_ROLLBACK');})});await failedBoot.run();failed(failedBoot);assert.match(failedBoot.errors[0],/EXPECTED_BATCH3_MIGRATION_ROLLBACK/);assert.deepEqual(await types(),beforeTypes);assert.deepEqual(await fingerprint(selected),beforeSelected);
 result.checks.push({name:'injected failure rolls back widening and values; no readiness or workers',result:'PASS'});
 console.log('Testing real lock contention and the existing 10-second lock timeout.');
 const blocker=await pool.connect();try{await blocker.query('BEGIN');await blocker.query('LOCK TABLE metric_snapshots IN ACCESS SHARE MODE');const b=boot(source),start=Date.now();await b.run();failed(b);assert.match(b.errors[0],/lock timeout/);result.checks.push({name:'contended migration fails closed without workers',result:'PASS',elapsedMs:Date.now()-start});}finally{await blocker.query('ROLLBACK');blocker.release();}
 assert.deepEqual(await types(),beforeTypes);assert.deepEqual(await fingerprint(selected),beforeSelected);
 console.log('Applying actual candidate startup to the restored production copy.');
 result.checks.push(await mustBoot('candidate upgrade'));
 assert.deepEqual(await fingerprint(selected),beforeSelected);
 result.afterTypes=await types();
 const required=JSON.parse(fs.readFileSync(dir+'/production-preflight.json','utf8')).columns;
 for(const col of required){const actual=result.afterTypes.find(x=>x.relname===col.table_name&&x.attname===col.column_name);assert.equal(actual.type,['ga4_daily_metrics','metric_snapshots'].includes(col.table_name)?'double precision':'numeric');}
 const constraints=(await pool.query("SELECT conname,convalidated FROM pg_constraint WHERE conrelid=ANY($1::regclass[]) AND conname LIKE '%_finite' ORDER BY conname",[tables])).rows;assert.equal(constraints.length,13);assert.ok(constraints.every(x=>x.convalidated));result.finiteConstraints=constraints;
 result.checks.push(await mustBoot('repeat candidate startup'));assert.deepEqual(await fingerprint(selected),beforeSelected);
 const old=execFileSync('git',['show','839bf508bffea4742f992616753dc68eabcfab3e:server/index.ts'],{encoding:'utf8',windowsHide:true});
 let compatible=old;
 for(const col of ['current_value','last_computed_value','value','rolling_average_7d','rolling_average_30d']){const before=`ALTER COLUMN ${col} TYPE DECIMAL(18, 2)`,after=`ALTER COLUMN ${col} TYPE NUMERIC`;assert.equal(compatible.split(before).length,2);compatible=compatible.replace(before,after);}
 fs.writeFileSync(path.join(privateDir,'rollback-startup-only-index.ts'),compatible);
 result.rollback={base:'839bf508bffea4742f992616753dc68eabcfab3e',startupOnlyArtifactSha256:crypto.createHash('sha256').update(compatible).digest('hex'),artifact:'audit-temp/v1-batch3-predeploy-private/rollback-startup-only-index.ts',boundary:'Five startup type changes only; NOT a deployable or validated whole-application rollback. Previous runtime read/write rounding must also be retained from the precision fix.',deployed:false};
 for(const [label,text,expected] of [['old startup demonstrates precision loss',old,0],['startup-only compatibility patch preserves precision',compatible,0.000075],['candidate restart preserves precision',source,0.000075]]){
  console.log('Checking '+label+' in a local transaction that is always rolled back.');
  const c=await pool.connect();try{
   await c.query('BEGIN');
   await c.query('UPDATE kpis SET current_value=0.000075,last_computed_value=0.000075 WHERE id=(SELECT id FROM kpis ORDER BY id LIMIT 1)');
   await c.query('UPDATE kpi_progress SET value=0.000075,rolling_average_7d=0.000075,rolling_average_30d=0.000075 WHERE id=(SELECT id FROM kpi_progress ORDER BY id LIMIT 1)');
   const b=boot(text,{transaction:fn=>fn(drizzle(c))});await b.run();assert.deepEqual(b.errors,[]);assert.deepEqual(b.exits,[]);assert.equal(b.ready(),true);
   const a=(await c.query('SELECT current_value,last_computed_value FROM kpis ORDER BY id LIMIT 1')).rows[0],p=(await c.query('SELECT value,rolling_average_7d,rolling_average_30d FROM kpi_progress ORDER BY id LIMIT 1')).rows[0];assert.ok(a&&p);assert.ok(Object.values({...a,...p}).every(v=>Number(v)===expected));
   result.checks.push({name:label,result:'PASS',observed:Number(a.current_value),expected,localProbeRolledBack:true});
  }finally{await c.query('ROLLBACK');c.release();}
 }
 assert.deepEqual(await types(),result.afterTypes);
 console.log('Verifying all original rows and values after every rehearsal.');
 assert.deepEqual(await fingerprint(columns),before);
 result.checks.push({name:'all existing table row counts and two full-row fingerprints preserved',result:'PASS',tables:result.tablesChecked});
 result.result='PASS';result.pushDecision='HOLD: old runtime rollback is unsafe; a whole-application precision-compatible rollback is not yet validated.';
})().catch(e=>{result.result='FAIL';result.error={code:e.code||e.name,message:e.name==='AssertionError'?String(e.message).slice(0,300):'See protected local rehearsal error'};fs.writeFileSync(path.join(privateDir,'rehearsal-error.txt'),String(e.stack));process.exitCode=1;}).finally(async()=>{await pool.end();result.completedAt=new Date().toISOString();fs.writeFileSync(dir+'/clone-results.json',JSON.stringify(result,null,2)+'\n');const {before,afterTypes,...summary}=result;console.log(JSON.stringify(summary,null,2));});
