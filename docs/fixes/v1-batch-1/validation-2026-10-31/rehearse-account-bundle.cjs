// Isolated loopback PostgreSQL only. Current route/storage bodies, synthetic identity.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto'), ts = require('typescript');
const { Pool } = require('pg'), { drizzle } = require('drizzle-orm/node-postgres'), orm = require('drizzle-orm');
const { PgDialect } = require('drizzle-orm/pg-core');
const { cleanup, tables: fixtureTables } = require('./account-fixture-cleanup.cjs');
assert.equal(process.env.DATABASE_URL || '', '');
const url = new URL(process.env.B1_ACCOUNT_TEST_DATABASE_URL || '');
assert.equal(url.hostname, '127.0.0.1'); assert.equal(url.port, '55444'); assert.equal(url.pathname, '/notifications_test');
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
const schema = {}, vault = {}, fixtureEnv = { env: { NODE_ENV: 'production', TOKEN_ENCRYPTION_KEY: 'batch1-local-fixture-key' } };
new Function('exports','require',compile(fs.readFileSync('shared/schema.ts','utf8')))(schema, require);
new Function('exports','require','process',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault, require, fixtureEnv);
const storageSource = ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true);
const methods = new Map();
function scanMethods(n) { if (ts.isMethodDeclaration(n)) methods.set(n.name.getText(storageSource),n.getText(storageSource)); ts.forEachChild(n,scanMethods); }
scanMethods(storageSource);
const routesSource = ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true);
const routes = new Map(), names = new Map();
function scanRoutes(n) {
  if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && !names.has(n.name.text)) names.set(n.name.text,`const ${n.getText(routesSource)};`);
  if (ts.isCallExpression(n) && /^app\.(get|post|patch|delete)$/.test(n.expression.getText(routesSource)) && ts.isStringLiteral(n.arguments[0])) routes.set(`${n.expression.name.text.toUpperCase()} ${n.arguments[0].text}`,n.arguments.at(-1).getText(routesSource));
  ts.forEachChild(n,scanRoutes);
}
scanRoutes(routesSource);
const fixtureSchema = `b1_account_${crypto.randomUUID().replaceAll('-','')}`;
const admin = new Pool({ connectionString:url.href,max:1 });
const pool = new Pool({ connectionString:url.href, options:`-c search_path=${fixtureSchema}`, max:3, statement_timeout:15000 });
const db = drizzle(pool);
const selected = ['getCampaign','getMetrics','createMetric','getPerformanceData','createPerformanceData','getIntegrations','createIntegration','getAttributionModels','getAttributionModel','createAttributionModel','updateAttributionModel','deleteAttributionModel','getCustomerJourneys','getCustomerJourney','createCustomerJourney','updateCustomerJourney','getJourneyTouchpoints','createTouchpoint','calculateAttributionResults'];
const storeEnv = { ...schema,...orm,...vault,db,randomUUID:crypto.randomUUID };
const storage = new Function(...Object.keys(storeEnv),compile(`class Storage {${selected.map(n=>{assert.ok(methods.has(n),n);return methods.get(n)}).join('\n')}}; return new Storage();`))(...Object.values(storeEnv));
const owner = 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U', second = 'fixture-second-owner';
let actor = second;
const env = { ...schema, z:require('zod').z, storage, getAuth:()=>({userId:actor}), isInternalAutoRefreshRequest:()=>false,
  console:{log(){},warn(){},error(){}}, process:fixtureEnv, require:()=>{throw Error('Provider loading forbidden');} };
const bind = (code,name) => new Function(...Object.keys(env),compile(code)+`\nreturn ${name};`)(...Object.values(env));
for (const name of ['campaignIdSchema','getActorId','ensureCampaignAccess']) env[name] = bind(names.get(name),name);
const limiterExports = {};
new Function('exports','require','process',compile(fs.readFileSync('server/middleware/rateLimiter.ts','utf8')))(limiterExports, name=>{
  if(name==='express-rate-limit')return {__esModule:true,default:config=>config};
  if(name==='@clerk/express')return {getAuth:env.getAuth};
  if(name==='../internal-request-auth')return {isInternalAutoRefreshRequest:()=>false};
  throw Error('Unexpected limiter import');
},fixtureEnv);
const storageMap = new Map(), outputs = [], requests = [], checks = [];
const manual = fs.readFileSync(path.join(__dirname,'manual-account-bundle.js'),'utf8');
const key = 'mimosaas_batch1_account_acceptance_20261031';
const reportKey = 'marketpulse_reports';
const reportSentinel = {id:'existing-report',name:'Untouched report',generatedAt:'2026-01-01T00:00:00.000Z',status:'Paused',campaignId:'unrelated',format:'PDF'};
const reportsSource=ts.createSourceFile('reports.tsx',fs.readFileSync('client/src/pages/reports.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const reportsBody=reportsSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='Reports').body.statements;
const reportDeclaration=name=>reportsBody.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(reportsSource)===name)).getText(reportsSource);
const reportReader={};
new Function('exports','localStorage',compile(fs.readFileSync('client/src/lib/reportStorage.ts','utf8')))(reportReader,{getItem:k=>storageMap.get(k)||null});
function verifyReportVisibility(allowed, expected = allowed ? 1 : 0) {
  const campaignId='36631f9f-5f32-4ae6-8d20-d8430abb364c';
  const visible=new Function('campaignContextId','liveCampaignFinancialContext','allStoredReports','backendScheduledReportIds','backendScheduledStoredReports',compile(`${reportDeclaration('hasCampaignReportAccess')}\n${reportDeclaration('localVisibleReports')}\n${reportDeclaration('visibleStoredReports')}\n${reportDeclaration('storedScheduledReports')}\nreturn storedScheduledReports;`))(campaignId,allowed?{id:campaignId}:undefined,reportReader.reportStorage.getReports(),new Set(),[]);
  assert.equal(visible.length,expected);if(expected)assert.equal(visible[0].name,JSON.parse(storageMap.get(key)).tag);
}
const limiterCounts = new Map();
const allowed = new Set(['GET /api/metrics','POST /api/metrics','GET /api/performance','POST /api/performance','GET /api/integrations','POST /api/integrations','GET /api/attribution/models','POST /api/attribution/models','PATCH /api/attribution/models/:id','DELETE /api/attribution/models/:id','GET /api/attribution/journeys','POST /api/attribution/journeys','PATCH /api/attribution/journeys/:id','GET /api/attribution/journeys/:id','GET /api/attribution/touchpoints','POST /api/attribution/touchpoints','POST /api/attribution/calculate','GET /api/campaigns/:id/google-trends','POST /api/auth/hubspot/connect','POST /api/linkedin/campaigns']);
async function fetchFixture(raw, init) {
  assert.ok(raw.startsWith('/api/')); assert.equal(init.redirect,'error'); assert.equal(init.credentials,'same-origin');
  const parsed = new URL(raw,'http://127.0.0.1'), method=init.method;
  requests.push({method,path:parsed.pathname});
  const req={body:init.body?JSON.parse(init.body):{},params:{},query:Object.fromEntries(parsed.searchParams),headers:{},get:()=>undefined,socket:{remoteAddress:'127.0.0.1'}};
  const headers=new Headers(); let status=200,data;
  const res={status(n){status=n;return this},json(x){data=x;return this},send(x){data=x;return this},setHeader(n,v){headers.set(n,v)}};
  let limiter;
  if(parsed.pathname==='/api/auth/hubspot/connect')limiter=limiterExports.oauthRateLimiter;
  if(parsed.pathname==='/api/linkedin/campaigns')limiter=limiterExports.linkedInApiRateLimiter;
  if(parsed.pathname.endsWith('/spend/csv/preview'))limiter=limiterExports.importRateLimiter;
  if(limiter && !limiter.skip?.(req)) {
    const count=(limiterCounts.get(limiter)||0)+1;limiterCounts.set(limiter,count);
    headers.set('ratelimit-limit',String(limiter.max));headers.set('ratelimit-remaining',String(Math.max(0,limiter.max-count)));
  }
  if(method==='GET' && /^\/api\/campaigns\/[^/]+$/.test(parsed.pathname)) {
    const c=await env.ensureCampaignAccess(req,res,parsed.pathname.split('/').at(-1));if(c)res.json(c);
  } else if(method==='POST' && /^\/api\/campaigns\/[^/]+\/spend\/csv\/preview$/.test(parsed.pathname)) {
    assert.equal(await env.ensureCampaignAccess(req,res,parsed.pathname.split('/')[3]),null,'Only missing-campaign preview allowed');
  } else {
    let matched=false;
    for(const entry of allowed) {
      const [verb,route]=entry.split(' ');if(verb!==method)continue;
      const keys=[...route.matchAll(/:([^/]+)/g)].map(m=>m[1]);
      const match=parsed.pathname.match(new RegExp('^'+route.replace(/:[^/]+/g,'([^/]+)')+'$'));if(!match)continue;
      matched=true;req.params=Object.fromEntries(keys.map((k,i)=>[k,decodeURIComponent(match[i+1])]));
      assert.ok(routes.has(entry),entry);
      await bind(`const handler=${routes.get(entry)};`,'handler')(req,res,e=>{throw e});break;
    }
    assert.ok(matched,`Unreviewed route ${method} ${parsed.pathname}`);
  }
  return {status,headers,json:async()=>JSON.parse(JSON.stringify(data))};
}
async function run(expected, overrides={}, record=true) {
  const before=outputs.length;
  await vm.runInNewContext(manual,{location:{origin:'https://marketforensics.onrender.com'},window:{Clerk:{user:{id:actor}},dispatchEvent:event=>assert.equal(event.type,'reportAdded')},Event,
    localStorage:{getItem:k=>storageMap.get(k)||null,setItem:(k,v)=>storageMap.set(k,v)},
    console:{log:s=>outputs.push(s)},fetch:fetchFixture,TextEncoder,Uint8Array,AbortSignal,Headers,
    crypto:{randomUUID:crypto.randomUUID,subtle:{digest:async(algorithm,data)=>new TextDecoder().decode(data)===second?Buffer.from('1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096','hex'):crypto.webcrypto.subtle.digest(algorithm,data)}},...overrides});
  const added=outputs.slice(before);const result=added.find(s=>s.startsWith('{'));
  if(expected==='INCOMPLETE'){assert.ok(added.some(s=>s.includes('INCOMPLETE')));return;}
  assert.ok(result,added.join('\n'));const parsed=JSON.parse(result);assert.equal(parsed.batch1AccountBundle,expected,added.join('\n'));
  if(record)checks.push(...parsed.checks);return parsed;
}
(async()=>{
  try {
    await admin.query(`CREATE SCHEMA "${fixtureSchema}"`);
    const tableNames=['campaigns','metrics','performanceData','integrations','attributionModels','customerJourneys','touchpoints','attributionResults','attributionInsights'];
    const dialect=new PgDialect();
    for(const name of tableNames){const table=schema[name];const columns=Object.values(orm.getTableColumns(table)).map(c=>{
      const v=c.default;const defaultSql=v instanceof orm.SQL?dialect.sqlToQuery(v).sql:typeof v==='string'?`'${v.replaceAll("'","''")}'`:String(v);
      return `"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${v!==undefined?' DEFAULT '+defaultSql:''}${c.primary?' PRIMARY KEY':''}`;
    });await pool.query(`CREATE TABLE "${orm.getTableName(table)}" (${columns.join(',')})`);}
    await db.insert(schema.campaigns).values([
      {id:'b74f98af-ede9-47af-9b19-0720ebb4d2c0',ownerId:owner,name:'Promo',platform:'google-analytics',status:'active',currency:'EUR'},
      {id:'36631f9f-5f32-4ae6-8d20-d8430abb364c',ownerId:second,name:'Batch 1 Provider Check',platform:'google-analytics',status:'active',currency:'EUR'},
    ]);
    await storage.createMetric({name:'outside sentinel',value:'5',change:'1',icon:'Activity'},owner);
    await storage.createPerformanceData({date:'2026-01-01',impressions:10,clicks:1,conversions:0},owner);
    await storage.createIntegration({name:'outside sentinel',platform:'fixture',connected:false},owner);
    const baseline={};for(const [name,table]of Object.entries(fixtureTables))baseline[name]=(await pool.query(`SELECT id FROM ${table}`)).rows.map(r=>r.id);
    storageMap.set(reportKey,JSON.stringify([reportSentinel]));
    const startRequests=requests.length;
    await run('INCOMPLETE',{location:{origin:'https://example.invalid'}});assert.equal(requests.length,startRequests);
    await run('INCOMPLETE',{window:{Clerk:{user:{id:'unknown-account'}}}});assert.equal(requests.length,startRequests);
    await run('PASS_OWNER');
    const reportChecks=[];
    const originalCache=JSON.parse(storageMap.get(reportKey));
    storageMap.set(reportKey,JSON.stringify(originalCache.map(x=>x.id===reportSentinel.id?x:{...x,schedule:null})));
    verifyReportVisibility(true,0);reportChecks.push('Original schedule-null fixture reproduces missing scheduled card');
    const beforeRepair=requests.length;
    await run('PASS_REPORT_READY');verifyReportVisibility(true);
    await run('PASS_REPORT_READY');assert.equal(requests.length,beforeRepair);
    reportChecks.push('Existing fixture repair and repeat make zero API requests');
    const repairedCache=storageMap.get(reportKey);
    const savedState=storageMap.get(key);
    for(const changes of [{name:'unrelated'},{campaignId:'unrelated'},{status:'Scheduled'},{backendReportId:'real-report'},{downloadUrl:'https://example.invalid/private'},{schedule:{frequency:'daily',day:'monday',time:'09:00',recipients:['do-not-send@example.invalid']}}]) {
      storageMap.set(reportKey,JSON.stringify(JSON.parse(repairedCache).map(x=>x.id===reportSentinel.id?x:{...x,...changes})));
      const before=storageMap.get(reportKey);
      await run('CHECK_REQUIRED',{},false);
      assert.equal(storageMap.get(reportKey),before);assert.equal(storageMap.get(key),savedState);assert.equal(requests.length,beforeRepair);
    }
    reportChecks.push('Changed marker, campaign, active status, backend report, URL or recipients prevent repair without writes');
    storageMap.set(reportKey,repairedCache);
    assert.equal((await pool.query('SELECT count(*)::int n FROM customer_journeys')).rows[0].n,1,'No duplicate on repeat');
    const cache=JSON.parse(storageMap.get(reportKey));assert.deepEqual(cache[0],reportSentinel);assert.equal(cache.length,2);
    verifyReportVisibility(true);verifyReportVisibility(false);
    actor=owner;await run('PASS_FOREIGN');
    verifyReportVisibility(false);
    actor=second;await run('PASS_RECHECK');
    assert.deepEqual(JSON.parse(storageMap.get(reportKey)),[reportSentinel]);
    const manifest=JSON.parse(storageMap.get(key));
    const client=await pool.connect();
    const cleanupChecks=[];
    try {
      const reject=async(name,changed,changedBaseline=baseline,changedOwner=second)=>{await assert.rejects(()=>cleanup(client,changed,changedOwner,changedBaseline,true));cleanupChecks.push({name,result:'PASS'});};
      await reject('wrong owner fails without deletion',manifest,baseline,'different-owner');
      await reject('incomplete phase fails', {...manifest,phase:'creating'});
      await reject('pre-existing record protected', {...manifest,ids:{...manifest.ids,metric:baseline.metric[0]}});
      await reject('changed run marker rejected', {...manifest,tag:'changed'});
      await pool.query('UPDATE attribution_models SET is_default=true WHERE id=$1',[manifest.ids.model]);
      await reject('changed fixture fails with rollback',manifest);
      await pool.query('UPDATE attribution_models SET is_default=false WHERE id=$1',[manifest.ids.model]);
      const extra=await storage.createTouchpoint({journeyId:manifest.ids.journey,channel:'direct',touchpointType:'view',position:2,timestamp:new Date(),metadata:manifest.tag});
      await reject('unexpected child prevents broadened cleanup',manifest);
      await pool.query('DELETE FROM touchpoints WHERE id=$1',[extra.id]);
      await pool.query('UPDATE customer_journeys SET total_touchpoints=1 WHERE id=$1',[manifest.ids.journey]);
      await pool.query("CREATE FUNCTION reject_fixture_delete() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'fixture delete failure'; END $$");
      await pool.query('CREATE TRIGGER reject_fixture_delete BEFORE DELETE ON metrics FOR EACH ROW EXECUTE FUNCTION reject_fixture_delete()');
      await reject('last-delete failure rolls back all prior deletions',manifest);
      for(const [name,table]of Object.entries(fixtureTables))assert.equal((await pool.query(`SELECT count(*)::int n FROM ${table} WHERE id=$1`,[manifest.ids[name]])).rows[0].n,1);
      await pool.query('DROP TRIGGER reject_fixture_delete ON metrics');await pool.query('DROP FUNCTION reject_fixture_delete()');
      const dry=await cleanup(client,manifest,second,baseline,false);assert.equal(dry.committed,false);
      assert.equal((await pool.query('SELECT count(*)::int n FROM attribution_models')).rows[0].n,1);
      cleanupChecks.push({name:'full cleanup rehearsal rolls back',result:'PASS'});
      const done=await cleanup(client,manifest,second,baseline,true);assert.equal(done.exactSyntheticRows,7);
      for(const [name,table]of Object.entries(fixtureTables))assert.deepEqual((await pool.query(`SELECT id FROM ${table} ORDER BY id`)).rows.map(r=>r.id).sort(),[...baseline[name]].sort());
      cleanupChecks.push({name:'exact seven-row cleanup preserves all outside records',result:'PASS'});
    } finally {client.release();}
    storageMap.delete(key);
    await run('CHECK_REQUIRED',{fetch:async(raw,init)=>{const r=await fetchFixture(raw,init);if(init.method==='POST')throw Error('FIXTURE_LOST_RESPONSE');return r;}},false);
    const partial=JSON.parse(storageMap.get(key));assert.equal(partial.pending,'metric');assert.equal(partial.phase,'creating');
    assert.equal((await pool.query('SELECT count(*)::int n FROM metrics')).rows[0].n,baseline.metric.length+1);
    const beforeRetry=requests.length;
    await run('CHECK_REQUIRED',{},false);assert.equal(requests.length,beforeRetry,'Partial run must not repeat any request');
    assert.equal((await pool.query('SELECT count(*)::int n FROM metrics')).rows[0].n,baseline.metric.length+1);
    assert.deepEqual(JSON.parse(storageMap.get(reportKey)),[reportSentinel]);
    const sourceHashes=Object.fromEntries(['manual-account-bundle.js','account-fixture-cleanup.cjs'].map(name=>[name,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,name))).digest('hex')]));
    const receipt={at:new Date().toISOString(),result:'PASS',boundary:'Current extracted API handlers and storage bodies against isolated PostgreSQL; synthetic identity and browser storage. Actual Reports storage reader, access/merge filters and final storedScheduledReports selection exercised. Original schedule-null fixture reproduces missing card. Quota headers simulated from current limiter configuration/skip functions; live Clerk, middleware transport, full rendered Reports, process restart and production acceptance remain separate.',apiChecks:checks.length,checks,cleanupChecks,requests:requests.length,wrongOriginAndAccountRequests:0,browserCacheOtherEntriesUnchanged:true,reportChecks,lostCreateResponseStopsRetry:true,providerCalls:0,productionConnections:0,sourceHashes};
    fs.writeFileSync(path.join(__dirname,'account-bundle-report-correction.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
    console.log(JSON.stringify({result:'PASS',apiChecks:checks.length,cleanupChecks:cleanupChecks.length}));
  }finally{await pool.end();await admin.query(`DROP SCHEMA IF EXISTS "${fixtureSchema}" CASCADE`);await admin.end();}
})().catch(error=>{console.error(error);process.exitCode=1;});
