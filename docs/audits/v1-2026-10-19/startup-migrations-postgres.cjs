const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),{sql}=require('drizzle-orm');
const url=new URL(process.env.NOTIFICATION_TEST_DATABASE_URL||'');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55442');assert.equal(url.pathname,'/notifications_test');assert.equal(process.env.DATABASE_URL||'','');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sf=ts.createSourceFile('index.ts',fs.readFileSync('server/index.ts','utf8'),ts.ScriptTarget.Latest,true);let callback;
function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='setTimeout'&&n.arguments[1]?.getText(sf)==='5000')callback=n.arguments[0].getText(sf);ts.forEachChild(n,walk)}walk(sf);assert.ok(callback);
const storageSf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),storageClass=storageSf.statements.find(n=>ts.isClassDeclaration(n)&&n.name?.text==='DatabaseStorage');
const methods=['upsertGA4DailyMetrics','upsertLinkedInDailyMetrics','upsertGoogleAdsDailyMetrics','upsertMetaDailyMetrics'].map(name=>{const n=storageClass.members.find(n=>n.name?.getText(storageSf)===name);assert.ok(n);return n.getText(storageSf)});
const schemaExports={};new Function('exports','require',transpile(fs.readFileSync('shared/schema.ts','utf8')))(schemaExports,require);
const generated=JSON.parse(fs.readFileSync('docs/audits/v1-2026-10-19/schema-generation.json','utf8'));assert.equal(generated.tables.length,62);assert.ok(generated.statements.every(s=>!/(?:"public"|\bpublic)\s*\./i.test(s)));
const admin=new Pool({connectionString:url.href}),results=[];
(async()=>{try{for(const fromDeclared of [false,true]){
 const schema='v1_startup_'+crypto.randomUUID().replaceAll('-','');assert.match(schema,/^v1_startup_[a-f0-9]{32}$/);
 await admin.query(`CREATE SCHEMA "${schema}"`);const pool=new Pool({connectionString:url.href,options:`-c search_path=${schema}`}),db=drizzle(pool),calls=[],errors=[],logs=[];
 try{
  if(fromDeclared)for(const statement of generated.statements)await pool.query(statement);
  const auditedDb={execute:async query=>{try{return await db.execute(query)}catch(e){errors.push({code:e.code||e.cause?.code,message:String(e.message)});throw e}}};
  const bindings={db:auditedDb,sql,port:0,log:v=>logs.push(v),console:{error:(...a)=>logs.push(a.map(String).join(' '))},seedDashboardData:async()=>calls.push('seedDashboardData:stubbed'),snapshotScheduler:{start:()=>calls.push('snapshotScheduler')},executiveSummarySnapshotScheduler:{start:()=>calls.push('executiveSummarySnapshotScheduler')}};
  for(const name of ['startKPIScheduler','startReportScheduler','startLinkedInScheduler','startMetaScheduler','startGoogleSheetsTokenScheduler','startDailyAutoRefreshScheduler','startGA4DailyScheduler','startGoogleAdsScheduler','startInstagramScheduler','startTikTokScheduler','startAlertEmailScheduler'])bindings[name]=()=>calls.push(name);
  const run=new Function(...Object.keys(bindings),transpile('return ('+callback+');'))(...Object.values(bindings));await run();
  const tables=(await pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename',[schema])).rows.map(r=>r.tablename);
  assert.equal(calls.filter(x=>!x.startsWith('seed')).length,13);
  if(!fromDeclared){assert.equal(errors[0].code,'42P01');assert.ok(!tables.includes('campaigns'));assert.ok(tables.includes('ga4_refresh_work'));results.push({case:'Empty schema: first migration fails, later groups and all scheduler starts continue',firstError:errors[0],schedulerStarts:13,seedInvoked:true,tables});}
  else{
   assert.equal(errors.length,0);const firstStartups=calls.length;await run();assert.equal(errors.length,0);assert.equal(calls.length,firstStartups*2);
   const bindingsStorage={db,sql,...schemaExports},instance=new Function(...Object.keys(bindingsStorage),transpile('class Extracted {'+methods.join('\n')+'};return new Extracted();'))(...Object.values(bindingsStorage)),upserts=[];
   for(const [method,row] of [['upsertGA4DailyMetrics',{campaignId:'fixture',propertyId:'123',date:'2026-10-18',sessions:1,users:1,revenue:'0'}],['upsertLinkedInDailyMetrics',{campaignId:'fixture',date:'2026-10-18',spend:'1'}],['upsertGoogleAdsDailyMetrics',{campaignId:'fixture',googleCampaignId:'ad-fixture',date:'2026-10-18',spend:'1'}],['upsertMetaDailyMetrics',{campaignId:'fixture',metaCampaignId:'ad-fixture',date:'2026-10-18',spend:'1'}]]){
    let failure;try{await instance[method]([row])}catch(e){failure={code:e.code||e.cause?.code,message:String(e.message)}}assert.equal(failure?.code,'42P10',method);upserts.push({method,errorCode:failure.code,meaning:'No unique or exclusion constraint matches ON CONFLICT target'});
   }
   const indexRows=(await pool.query("SELECT tablename,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename=ANY($2) ORDER BY tablename,indexname",[schema,['ga4_daily_metrics','linkedin_daily_metrics','google_ads_daily_metrics','meta_daily_metrics','instagram_daily_metrics','tiktok_daily_metrics']])).rows.map(r=>({table:r.tablename,definition:r.indexdef.replaceAll(schema,'<isolated_schema>')}));
   results.push({case:'Declared62-table schema plus two successful startup migration passes still lacks four upsert constraints',startupMigrationErrors:0,startupPasses:2,upserts,indexRows,limitation:'GA4 upsert current route caller is demo seeding; normal native refresh uses transactional replacement. LinkedIn/Ads/Meta upserts have current import/scheduler callers. No deployed schema inference.'});
   const legacy=fs.readFileSync('migrations/0006_add_daily_spend_revenue_granularity.sql','utf8');assert.ok(!/(?:"public"|\bpublic)\s*\./i.test(legacy));
   await pool.query("INSERT INTO campaigns(id,name,currency) VALUES('legacy-fixture','Isolated legacy migration','EUR')");
   await pool.query("INSERT INTO ga4_daily_metrics(campaign_id,property_id,date,revenue) VALUES('legacy-fixture','123','2026-10-18',100)");
   await pool.query("INSERT INTO linkedin_daily_metrics(campaign_id,date,spend) VALUES('legacy-fixture','2026-10-18',20)");
   await pool.query(legacy);await pool.query(legacy);
   const revenue=(await pool.query("SELECT count(*)::int AS rows,sum(revenue)::text AS total,min(currency) AS currency FROM revenue_records WHERE campaign_id='legacy-fixture' AND revenue_source_id='ga4_daily_metrics'")).rows[0];
   const spend=(await pool.query("SELECT count(*)::int AS rows,sum(spend)::text AS total,min(currency) AS currency FROM spend_records WHERE campaign_id='legacy-fixture' AND spend_source_id='linkedin_daily_metrics'")).rows[0];
   assert.equal(revenue.rows,2);assert.equal(Number(revenue.total),200);assert.equal(revenue.currency,'USD');assert.equal(spend.rows,2);assert.equal(Number(spend.total),40);
   results.push({case:'Explicit legacy0006 execution twice duplicates synthetic financial rows and labels EUR campaign amounts USD',revenue,spend,limitation:'Manually executed only in fixture. File is not called by current startup/build/start scripts. Current active-source read filters may exclude these orphan rows; no doubled current UI amount is claimed.'});
  }
 }finally{await pool.end();assert.match(schema,/^v1_startup_[a-f0-9]{32}$/);await admin.query(`DROP SCHEMA "${schema}" CASCADE`)}
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/startup-migrations-postgres.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact delayed startup callback with actual DDL/DML in disposable PostgreSQL schemas, installed Drizzle-generated current schema and four exact upsert methods. Seed and scheduler functions stubbed to record invocation. No HTTP server, production DB, outbound provider/email or real scheduler was started.',results},null,2)+'\n');console.log(`${results.length} PostgreSQL startup scenarios executed`);
 }finally{await admin.end()}})().catch(e=>{console.error(e);process.exitCode=1});
