// Current handlers/storage plus actual Reports component in isolated Chromium/PostgreSQL.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript');
const {Pool}=require('pg'),{drizzle}=require('drizzle-orm/node-postgres'),orm=require('drizzle-orm'),{PgDialect}=require('drizzle-orm/pg-core');
const {chromium}=require('playwright'),esbuild=require('esbuild');
const fixture=require('./fixture.cjs');
assert.equal(process.env.DATABASE_URL||'','');
const url=new URL(process.env.B1_ACCOUNT_TEST_DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'55444');assert.equal(url.pathname,'/notifications_test');
const compile=text=>ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
const schema={},vault={};new Function('exports','require',compile(fs.readFileSync('shared/schema.ts','utf8')))(schema,require);
new Function('exports','require','process',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault,require,{env:{NODE_ENV:'production',TOKEN_ENCRYPTION_KEY:'isolated-fixture-key'}});
const source=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true),methods=new Map();
function scan(n){if(ts.isMethodDeclaration(n))methods.set(n.name.getText(source),n.getText(source));ts.forEachChild(n,scan);}scan(source);
const routesSource=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),routes=new Map(),names=new Map();
function scanRoutes(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&!names.has(n.name.text))names.set(n.name.text,`const ${n.getText(routesSource)};`);if(ts.isCallExpression(n)&&/^app\.(get|post|patch)$/.test(n.expression.getText(routesSource))&&ts.isStringLiteral(n.arguments[0]))routes.set(`${n.expression.name.text.toUpperCase()} ${n.arguments[0].text}`,n.arguments.at(-1).getText(routesSource));ts.forEachChild(n,scanRoutes);}scanRoutes(routesSource);
const schemaName=`b1_source_${crypto.randomUUID().replaceAll('-','')}`,admin=new Pool({connectionString:url.href,max:1}),pool=new Pool({connectionString:url.href,options:`-c search_path=${schemaName}`,max:3});
const db=drizzle(pool),deps={...schema,...orm,...vault,db};
const hydrate=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='hydrateDecryptedTokens');
deps.hydrateDecryptedTokens=new Function(...Object.keys(deps),compile(hydrate.getText(source))+'\nreturn hydrateDecryptedTokens;')(...Object.values(deps));
const selected=['getCampaign','getKPI','getMetaKPIById','updateMetaKPI','getMetaBenchmarkById','updateMetaBenchmark','getLinkedInConnection','updateLinkedInConnection','writeGA4RefreshInputChange','transferCustomIntegration'];
const storage=new Function(...Object.keys(deps),compile(`class Storage{${selected.map(name=>{assert.ok(methods.has(name),name);return methods.get(name)}).join('\n')}};return new Storage();`))(...Object.values(deps));
const owners={primary:{ownerId:'user_3K7q6o5pF0aykjIQSHy5O7mVi2U',clientId:'fixture-primary-client'},secondary:{ownerId:'fixture-second',clientId:'fixture-secondary-client'}};
let actor=owners.secondary.ownerId;
const routeErrors=[];
const env={...schema,storage,z:require('zod').z,getAuth:()=>({userId:actor}),isInternalAutoRefreshRequest:()=>false,console:{log(){},warn(){},error(...args){routeErrors.push(args.map(x=>x?.stack||x?.message||String(x)).join(' '));}},process:{env:{NODE_ENV:'production'}}};
for(const name of ['campaignIdSchema','getActorId','ensureCampaignAccess'])env[name]=new Function(...Object.keys(env),compile(names.get(name))+`\nreturn ${name};`)(...Object.values(env));
const handlers={};for(const route of ['PATCH /api/linkedin/update/:campaignId','PATCH /api/platforms/meta/kpis/:kpiId','PATCH /api/benchmarks/:benchmarkId','POST /api/custom-integration/transfer'])handlers[route]=new Function(...Object.keys(env),'return '+compile('const h='+routes.get(route)).replace(/^const h = /,'').replace(/;\s*$/,''))(...Object.values(env));
const run=crypto.randomUUID(),m={version:1,run,tag:`B1_SOURCE_${run}`,ids:Object.fromEntries(Object.keys(fixture.tables).map(key=>[key,crypto.randomUUID()]))};
const outsideRun=crypto.randomUUID(),outside={version:1,run:outsideRun,tag:`B1_SOURCE_${outsideRun}`,ids:Object.fromEntries(Object.keys(fixture.tables).map(key=>[key,crypto.randomUUID()]))};
const template=fs.readFileSync(path.join(__dirname,'manual-template.js'),'utf8');
const manual=template.replace('/* SOURCE_FIXTURE */ null',JSON.stringify(m)).replace('1900b95d7361b41cd41b7a23571cb4645a1511a139d4044f04b9937ab86c6096',crypto.createHash('sha256').update(owners.secondary.ownerId).digest('hex'));
const checks=[],apiRequests=[],errors=[];let browser,created=false;
const reportCampaign='36631f9f-5f32-4ae6-8d20-d8430abb364c';
async function api(raw,method,body){
 const parsed=new URL(raw),p=parsed.pathname;apiRequests.push({p,method});
 let status=200,data,params={},handler;
 if(method==='GET'){
   const id=p.match(/^\/api\/campaigns\/([^/]+)$/)?.[1];
   if(id){const c=id===reportCampaign?{id,name:'Batch 1 Provider Check',ownerId:owners.secondary.ownerId,currency:'EUR'}:await storage.getCampaign(id);return c?.ownerId===actor?{status:200,data:c}:{status:404,data:{message:'Campaign not found'}};}
   if(p.endsWith('/reports'))return actor===owners.secondary.ownerId?{status:200,data:[]}:{status:404,data:{message:'Campaign not found'}};
   if(p.endsWith('/kpis')||p.endsWith('/benchmarks'))return {status:200,data:[]};
   if(p.endsWith('/outcome-totals')||p.endsWith('/executive-summary'))return {status:200,data:{}};
   throw Error(`Unexpected GET ${p}`);
 }
 for(const [key,fn]of Object.entries(handlers)){const [verb,pattern]=key.split(' ');const keys=[...pattern.matchAll(/:([^/]+)/g)].map(x=>x[1]);const match=p.match(new RegExp('^'+pattern.replace(/:[^/]+/g,'([^/]+)')+'$'));if(method===verb&&match){handler=fn;params=Object.fromEntries(keys.map((k,i)=>[k,decodeURIComponent(match[i+1])]));break;}}
 assert.ok(handler,`${method} ${p}`);
 const req={params,body:body||{},headers:{},query:Object.fromEntries(parsed.searchParams),get:()=>undefined};
 const res={status(n){status=n;return this},json(x){data=x;return this}};await handler(req,res);return {status,data};
}
(async()=>{try{
 await admin.query(`CREATE SCHEMA "${schemaName}"`);created=true;
 const dialect=new PgDialect();
 for(const name of ['clients','campaigns','linkedinConnections','metaKpis','metaBenchmarks','customIntegrations','customIntegrationMetrics','inboundWebhookReceipts','kpis','ga4RefreshWork','metricSnapshots']){
  const table=schema[name],columns=Object.values(orm.getTableColumns(table)).map(c=>{const v=c.default,def=v instanceof orm.SQL?dialect.sqlToQuery(v).sql:typeof v==='string'?`'${v.replaceAll("'","''")}'`:String(v);return `"${c.name}" ${c.getSQLType()}${c.notNull?' NOT NULL':''}${v!==undefined?` DEFAULT ${def}`:''}${c.primary?' PRIMARY KEY':''}`;});await pool.query(`CREATE TABLE "${orm.getTableName(table)}" (${columns.join(',')})`);
 }
 for(const scope of Object.values(owners))await pool.query('INSERT INTO clients(id,owner_id,name)VALUES($1,$2,$3)',[scope.clientId,scope.ownerId,'Untouched fixture client']);
 const client=await pool.connect();try{
  await fixture.seed(client,outside,owners,true);
  assert.equal((await fixture.seed(client,m,owners,false)).committed,false);assert.equal((await pool.query('SELECT count(*)::int n FROM campaigns')).rows[0].n,3);await fixture.seed(client,m,owners,true);
  await pool.query('UPDATE linkedin_connections SET ad_account_name=$1 WHERE id=$2',[`${m.tag}:edited`,m.ids.linkedin]);
  await fixture.cleanup(client,m,owners,false,'partial');
  await pool.query('UPDATE linkedin_connections SET ad_account_name=$1 WHERE id=$2',[`${m.tag}:unexpected`,m.ids.linkedin]);
  await assert.rejects(()=>fixture.cleanup(client,m,owners,true,'partial'));
  await pool.query('UPDATE linkedin_connections SET ad_account_name=$1 WHERE id=$2',[`${m.tag}:original`,m.ids.linkedin]);
  checks.push('Partial-run cleanup rolls back and rejects unplanned field changes');
 }finally{client.release();}
 checks.push('Seeding rollback then exact draft-only seed');
 const entry=`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClient,QueryClientProvider}from'@tanstack/react-query';import Reports from './client/src/pages/reports';const q=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{const r=await fetch(queryKey.join('/'));if(!r.ok)throw Error('Denied');return r.json();}}}});createRoot(document.getElementById('root')).render(<QueryClientProvider client={q}><Reports/></QueryClientProvider>);`;
 const built=await esbuild.build({stdin:{contents:entry,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')},define:{'process.env.NODE_ENV':'"test"','import.meta.env':'{}'},plugins:[{name:'layout-fixture',setup(b){b.onResolve({filter:/components\/layout\/(navigation|sidebar)$/},args=>({path:args.path,namespace:'layout'}));b.onLoad({filter:/.*/,namespace:'layout'},()=>({contents:'export default function Layout(){return null}',loader:'js'}));}}]});
 browser=await chromium.launch({headless:true});const page=await browser.newPage();const outputs=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',msg=>{if(msg.type()==='log'&&msg.text().startsWith('{'))outputs.push(JSON.parse(msg.text()));});
 await page.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());assert.equal(u.origin,'https://marketforensics.onrender.com');if(u.pathname.startsWith('/api/')){const r=await api(req.url(),req.method(),req.postData()?JSON.parse(req.postData()):undefined);await route.fulfill({status:r.status,contentType:'application/json',body:JSON.stringify(r.data)});}else if(u.pathname==='/reports')await route.fulfill({contentType:'text/html',body:`<html><body><div id="root"></div><script>${built.outputFiles[0].text.replaceAll('</script','<\\/script')}</script></body></html>`});else await route.abort();});
 await page.addInitScript(()=>{window.Clerk={user:{id:'fixture-second'}};});
 const destination=`https://marketforensics.onrender.com/reports?campaignId=${reportCampaign}`;
 await page.goto(destination);await page.getByText('No scheduled reports yet',{exact:true}).waitFor();
 await page.evaluate(manual);assert.equal(outputs.at(-1)?.batch1SourceBundle,'PASS_SOURCE_OWNER',JSON.stringify({output:outputs.at(-1),routeErrors}));
 await page.getByText(m.tag,{exact:true}).waitFor();assert.equal(errors.length,0,errors.join('\n'));checks.push('Real Reports component displays the exact paused owner card');
 const requestsBefore=apiRequests.length;await page.evaluate(manual);assert.equal(outputs.at(-1).batch1SourceBundle,'ALREADY_RECORDED_OR_OTHER_ACCOUNT_REQUIRED');assert.equal(apiRequests.length,requestsBefore);checks.push('Completed owner pass makes no duplicate requests');
 actor=owners.primary.ownerId;await page.reload();await page.evaluate(id=>{window.Clerk.user.id=id},actor);await page.getByText('Reports unavailable',{exact:true}).waitFor();assert.equal(await page.getByText(m.tag,{exact:true}).count(),0);
 await page.evaluate(manual);assert.equal(outputs.at(-1)?.batch1SourceBundle,'PASS_SOURCE_FOREIGN',JSON.stringify(outputs.at(-1)));checks.push('Foreign actual report hidden, edits and both transfer parents denied');
 const result=outputs.at(-1);assert.ok([...result.ownerChecks,...result.checks].every(x=>x.passed));
 const cx=await pool.connect();try{
  await fixture.cleanup(cx,m,owners,false);checks.push('Complete cleanup rehearsal rolls back');
  await pool.query('UPDATE campaigns SET status=$1 WHERE id=$2',['active',m.ids.a]);await assert.rejects(()=>fixture.cleanup(cx,m,owners,true));await pool.query('UPDATE campaigns SET status=$1 WHERE id=$2',['draft',m.ids.a]);checks.push('Activated campaign blocks cleanup');
  await pool.query("INSERT INTO custom_integration_metrics(id,campaign_id)VALUES('unexpected',$1)",[m.ids.a]);await assert.rejects(()=>fixture.cleanup(cx,m,owners,true));await pool.query("DELETE FROM custom_integration_metrics WHERE id='unexpected'");checks.push('Unexpected dependent blocks cleanup');
  const fault={query(sql,params){if(sql.startsWith('DELETE FROM campaigns')&&params[0]===m.ids.a)throw Error('Last-delete fault');return cx.query(sql,params)}};
  await assert.rejects(()=>fixture.cleanup(fault,m,owners,true));
  await cx.query('BEGIN');await fixture.inspect(cx,m,owners,true);await cx.query('ROLLBACK');checks.push('Last-delete failure rolls back all earlier deletes');
  await fixture.cleanup(cx,m,owners,true);assert.equal((await pool.query('SELECT count(*)::int n FROM campaigns')).rows[0].n,3);
  await cx.query('BEGIN');await fixture.inspect(cx,outside,owners,false);await cx.query('ROLLBACK');checks.push('Exact cleanup preserves all five unrelated rows and both clients');
  await fixture.cleanup(cx,outside,owners,true,false);assert.equal((await pool.query('SELECT count(*)::int n FROM campaigns')).rows[0].n,0);assert.equal((await pool.query('SELECT count(*)::int n FROM clients')).rows[0].n,2);
 }finally{cx.release();}
 const receipt={at:new Date().toISOString(),result:'PASS',checks,manualChecks:[...result.ownerChecks,...result.checks],pageErrors:errors,externalRequests:0,productionConnections:0,sourceHashes:Object.fromEntries(['fixture.cjs','manual-template.js','rehearse.cjs'].map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,n))).digest('hex')])),limits:'Synthetic Clerk identity and routed API transport. Current actual handlers/storage, isolated PostgreSQL and real Reports component. Production manual acceptance remains required.'};fs.writeFileSync(path.join(__dirname,'rehearsal.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({result:'PASS',manualChecks:receipt.manualChecks.length,checks:checks.length}));
}finally{await browser?.close();await pool.end();if(created)await admin.query(`DROP SCHEMA "${schemaName}" CASCADE`);await admin.end();}})().catch(e=>{console.error(e);process.exitCode=1;});
