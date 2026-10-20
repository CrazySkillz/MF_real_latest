// Bounded component characterization only: never starts the app or contacts a provider.
const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {performance,monitorEventLoopDelay}=require('node:perf_hooks');
const {Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),orm=require('drizzle-orm');
const out='docs/audits/v1-2026-10-19/pilot-load-local.json';
const url=new URL(process.env.NOTIFICATION_TEST_DATABASE_URL||'');
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55442');assert.equal(url.pathname,'/notifications_test');assert.equal(process.env.DATABASE_URL||'','');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleExports(file,req=require){const ex={};new Function('exports','require',transpile(fs.readFileSync(file,'utf8')))(ex,req);return ex;}
const schemaExports=moduleExports('shared/schema.ts'),dates=moduleExports('server/utils/reporting-timezone.ts');
const sf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true);
const klass=sf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage');
const names=['getClients','getCampaigns','getCampaign','getSpendSources','getSpendTotalForRange','getSpendBreakdownBySource'];
const methods=names.map(name=>{const m=klass.members.find(n=>n.name?.getText(sf)===name);assert.ok(m,name);return m.getText(sf);});
let predicate;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='spendPlatformContextPredicate')predicate=n.initializer.getText(sf);ts.forEachChild(n,visit);}visit(sf);assert.ok(predicate);
const df=ts.createSourceFile('dates.ts',fs.readFileSync('server/utils/data-transformation.ts','utf8'),ts.ScriptTarget.Latest,true);
const dateFunction=df.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='normalizeStrictUtcDateKey');assert.ok(dateFunction);
const dateExports={};new Function('exports',transpile(dateFunction.getText(df)))(dateExports);
const csv=moduleExports('server/utils/csv.ts',id=>{assert.equal(id,'./data-transformation');return dateExports;});
const generated=JSON.parse(fs.readFileSync('docs/audits/v1-2026-10-19/schema-generation.json','utf8'));
const statements=generated.statements.filter(s=>/^CREATE TABLE "(?:clients|campaigns|spend_sources|spend_records)"/.test(s));assert.equal(statements.length,4);
assert.ok(statements.every(s=>!/(?:"public"|\bpublic)\s*\./i.test(s)));
const admin=new Pool({connectionString:url.href,max:1});
const fixtureSchema='v1_pilot_'+crypto.randomUUID().replaceAll('-','');assert.match(fixtureSchema,/^v1_pilot_[a-f0-9]{32}$/);
const pause=ms=>new Promise(r=>setTimeout(r,ms));
function quantiles(values){const sorted=values.slice().sort((a,b)=>a-b);return{n:sorted.length,minMs:+sorted[0].toFixed(2),p50Ms:+sorted[Math.ceil(sorted.length*.5)-1].toFixed(2),p95Ms:+sorted[Math.ceil(sorted.length*.95)-1].toFixed(2),maxMs:+sorted.at(-1).toFixed(2)};}
(async()=>{let pool,created=false;try{
 await admin.query(`CREATE SCHEMA "${fixtureSchema}"`);created=true;
 pool=new Pool({connectionString:url.href,options:`-c search_path=${fixtureSchema}`,max:10,connectionTimeoutMillis:10000,statement_timeout:120000,query_timeout:125000,idle_in_transaction_session_timeout:120000});
 for(const statement of statements)await pool.query(statement);
 await pool.query("INSERT INTO clients(id,owner_id,name) SELECT 'client-'||n,'owner-'||n,'Synthetic pilot client '||n FROM generate_series(1,5) n");
 await pool.query("INSERT INTO campaigns(id,owner_id,client_id,name,currency,reporting_time_zone,platform) SELECT 'campaign-'||n,'owner-'||(1+(n-1)/5),'client-'||(1+(n-1)/5),'Synthetic pilot campaign '||n,'USD','UTC','ga4' FROM generate_series(1,25) n");
 await pool.query("INSERT INTO spend_sources(id,campaign_id,source_type,platform_context,display_name,currency,created_at) SELECT 'source-'||c||'-'||s,'campaign-'||c,'csv','ga4','Synthetic source '||s,'USD','2026-07-01' FROM generate_series(1,25) c CROSS JOIN generate_series(1,4) s");
 await pool.query("INSERT INTO spend_records(campaign_id,spend_source_id,date,spend,currency,source_type) SELECT 'campaign-'||c,'source-'||c||'-'||s,to_char(date '2026-07-21'+d,'YYYY-MM-DD'),1,'USD','csv' FROM generate_series(1,25) c CROSS JOIN generate_series(1,4) s CROSS JOIN generate_series(0,89) d");
 await pool.query('ANALYZE');
 const bindings={db:drizzle(pool),...orm,...schemaExports,...dates};
 const instance=new Function(...Object.keys(bindings),transpile('const spendPlatformContextPredicate='+predicate+';class Extracted{'+methods.join('\n')+'};return new Extracted();'))(...Object.values(bindings));
 let queryCount=0;const originalQuery=pool.query.bind(pool);pool.query=(...args)=>{queryCount++;return originalQuery(...args);};
 const durations=[],firstBatchMs=[],importMs=[],errors=[];let maxWaiting=0,maxConnections=0;
 const sample=setInterval(()=>{maxWaiting=Math.max(maxWaiting,pool.waitingCount);maxConnections=Math.max(maxConnections,pool.totalCount);},5);
 const loop=monitorEventLoopDelay({resolution:10});loop.enable();const cpuStart=process.cpuUsage(),memoryStart=process.memoryUsage(),start=performance.now();
 const input='date,spend\n'+Array.from({length:10000},(_,i)=>new Date(Date.UTC(2026,6,21+(i%90))).toISOString().slice(0,10)+',1').join('\n');
 const readers=Array.from({length:5},(_,reader)=>(async()=>{
  for(let turn=0;turn<20;turn++){
   const t=performance.now();try{
    const owner='owner-'+(reader+1),campaign='campaign-'+(reader*5+1+turn%5);
    const [clients,allCampaigns,sources,total,breakdown]=await Promise.all([instance.getClients(owner),instance.getCampaigns(),instance.getSpendSources(campaign,'ga4'),instance.getSpendTotalForRange(campaign,'2026-07-21','2026-10-18','ga4'),instance.getSpendBreakdownBySource(campaign,'2026-07-21','2026-10-18','ga4')]);
    assert.equal(clients.length,1);assert.equal(allCampaigns.length,25);assert.equal(allCampaigns.filter(c=>c.ownerId===owner).length,5);assert.equal(sources.length,4);assert.equal(total.totalSpend,360);assert.equal(total.currency,'USD');assert.equal(total.sourceIds.length,4);assert.equal(breakdown.length,4);assert.equal(breakdown.reduce((n,s)=>n+s.spend,0),360);
   }catch(e){errors.push({reader,turn,message:String(e.message)});}
   const elapsed=performance.now()-t;durations.push(elapsed);if(turn===0)firstBatchMs.push(elapsed);await pause(200);
  }
 })());
 const imports=(async()=>{for(let n=0;n<5;n++){await pause(350);const t=performance.now();const parsed=csv.parseCsvText(input,50000,{strict:true});const result=csv.aggregateCsvSpendRows(parsed.rows,{spendColumn:'spend',dateColumn:'date'});assert.equal(parsed.rows.length,10000);assert.equal(result.keptRows,10000);assert.equal(result.totalSpend,10000);assert.equal(result.dailySpend.length,90);importMs.push(performance.now()-t);}})();
 try{await Promise.all([...readers,imports]);}finally{clearInterval(sample);loop.disable();}
 const elapsedMs=performance.now()-start,cpu=process.cpuUsage(cpuStart),memoryEnd=process.memoryUsage();
 const counts=(await originalQuery('SELECT (SELECT count(*)::int FROM clients) clients,(SELECT count(*)::int FROM campaigns) campaigns,(SELECT count(*)::int FROM spend_sources) sources,(SELECT count(*)::int FROM spend_records) records')).rows[0];
 const databaseVersion=(await originalQuery('SHOW server_version')).rows[0].server_version;
 const result={at:new Date().toISOString(),head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact six current storage methods and CSV parser/Spend aggregator; real isolated PostgreSQL, current four-table generated schema. No app HTTP/auth/browser/scheduler/provider/report or import persistence/recompute path. Fixture owner filtering is an assertion, not an authorization test.',baseline:{simultaneousReaders:5,owners:5,campaigns:25,days:90,spendSourcesPerCampaign:4,importRows:10000,readerBatches:100,imports:5,thinkTimeMs:200},counts,node:process.version,databaseVersion,poolMax:10,elapsedMs:+elapsedMs.toFixed(2),queryCount,readBatches:quantiles(durations),firstBatches:quantiles(firstBatchMs),csvParseAndAggregate:quantiles(importMs),eventLoopDelay:{p95Ms:+(loop.percentile(95)/1e6).toFixed(2),maxMs:+(loop.max/1e6).toFixed(2)},processOnly:{cpuUserMs:cpu.user/1000,cpuSystemMs:cpu.system/1000,rssBeforeBytes:memoryStart.rss,rssAfterBytes:memoryEnd.rss,heapBeforeBytes:memoryStart.heapUsed,heapAfterBytes:memoryEnd.heapUsed},pool:{maxWaitingObserved:maxWaiting,maxConnectionsObserved:maxConnections},errors,localAcceptance:{criteria:'Zero incorrect totals/errors and p95 component read batch under1000ms; each10k-row parse/aggregate under1000ms. Provisional local characterization threshold, not deployed SLA.',pass:errors.length===0&&quantiles(durations).p95Ms<1000&&Math.max(...importMs)<1000},limitations:['Short warm-up/bounded run, not a sustained load or saturation test.','Database and Node run on same workstation; no HTTP/network/browser/Clerk/provider latency.','Only Spend read subset and CSV computation; missing Revenue, GA4 publication, actual import transaction/recompute, exports, reports and competing jobs.','All rows synthetic. Database query plan/resource usage and Render capacity are not inferred.','Pool queue sampling can miss sub5ms spikes; process memory/CPU excludes PostgreSQL and Chromium.']};
 fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));assert.equal(result.localAcceptance.pass,true);
 }finally{if(pool)await pool.end();if(created){assert.match(fixtureSchema,/^v1_pilot_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA "${fixtureSchema}" CASCADE`);}await admin.end();}
})().catch(e=>{console.error(e);process.exitCode=1;});
