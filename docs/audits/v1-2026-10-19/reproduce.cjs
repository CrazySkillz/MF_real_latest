// Isolated audit reproductions of current handlers. No application DB, provider,
// email transport, or deployed mutation. Does not certify full middleware flows.
const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const source = fs.readFileSync('server/routes-oauth.ts','utf8');
const sf = ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true);
const registrations = new Map();
function visit(n) {
  if(ts.isCallExpression(n) && /^app\.(get|post|patch|delete)$/.test(n.expression.getText(sf)) && ts.isStringLiteral(n.arguments[0])) registrations.set(n.expression.getText(sf).slice(4)+' '+n.arguments[0].text,n.getText(sf));
  ts.forEachChild(n,visit);
}
visit(sf);
let writes=[],reads=[],sent=[];
const storage=new Proxy({}, {get(_,name) {return async (...args)=>{
  if(/^(get)/.test(name)) reads.push({name,args}); else writes.push({name,args});
  if(name==='getCampaign') return {id:args[0],ownerId:'different-owner',currency:'EUR'};
  if(name==='getLatestLinkedInImportSession') return {id:'private-session'};
  if(name==='getLinkedInImportMetrics') return [{campaignUrn:'private-urn',campaignName:'Private campaign'}];
  if(name==='getRevenueTotalForRange') return {totalRevenue:123};
  if(/Connection$/.test(name)) return undefined;
  if(name==='getMetrics') return [{name:'private metric'}];
  if(name==='getConversionEvents') return [{value:'100',currency:'USD'},{value:'200',currency:'EUR'}];
  if(name==='getCustomIntegrationByEmail') return undefined; // stop before parsing/persistence
  if(name==='createConversionEvent') return {id:'fixture',...args[0]};
  return args[0] || [];
}}});
const mocks={
 './services/email-service.js':{emailService:{sendEmail:async (...args)=>{sent.push(args);return true}}},
 './utils/email-generator':{extractEmailAddress:s=>s},
 crypto:require('node:crypto'),
};
function handler(method,path) {
  let result;
  const app=new Proxy({}, {get:()=> (...args)=>{result=args.at(-1)}});
  const text=registrations.get(method+' '+path); assert.ok(text,path);
  const js=ts.transpileModule(text,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  new Function('app','storage','require','upload','console',js)(app,storage,id=>{assert.ok(mocks[id],`Unexpected module ${id}`);return mocks[id]}, {any:()=>()=>{}}, {log(){},error(){}});
  return result;
}
async function invoke(method,path,body={},params={}) {
  writes=[];reads=[];sent=[];
  const response={statusCode:200,payload:null,status(n){this.statusCode=n;return this},json(p){this.payload=p;return this},setHeader(){}};
  await handler(method,path)({body,params,query:{},headers:{}},response);
  return {status:response.statusCode,payload:response.payload,writes:[...writes],reads:[...reads],sent:[...sent]};
}
(async()=>{
  const results=[];
  let r=await invoke('get','/api/metrics'); assert.equal(r.status,200); results.push({case:'Unauthenticated global metric read',...r});
  r=await invoke('post','/api/metrics',{name:'fixture',value:'123'}); assert.equal(r.writes[0].name,'createMetric');results.push({case:'Unauthenticated global metric write',...r});
  r=await invoke('get','/api/campaigns/:id/linkedin-campaigns',{}, {id:'other-owner-campaign'});assert.equal(r.payload.campaigns[0].name,'Private campaign');results.push({case:'LinkedIn campaign labels read without owner check',...r});
  r=await invoke('get','/api/campaigns/:id/linkedin-campaign-revenue',{}, {id:'other-owner-campaign'});assert.equal(r.payload.totalRevenue,123);results.push({case:'LinkedIn financial totals read without owner check',...r});
  r=await invoke('post','/api/webhook/conversion/:campaignId',{value:100,currency:'USD',conversionId:'same-id'}, {campaignId:'other-owner-campaign'});assert.equal(r.status,200);assert.equal(r.writes[1].name,'updateCampaign');assert.equal(r.writes[1].args[1].conversionValue,'150.00');results.push({case:'Unsigned conversion write and mixed-currency average',...r});
  r=await invoke('post','/api/webhook/conversion/:campaignId',{value:0}, {campaignId:'other-owner-campaign'});assert.equal(r.status,400);results.push({case:'Numeric zero conversion rejected',...r});
  process.env.MAILGUN_WEBHOOK_SIGNING_KEY='isolated-fixture-not-a-real-key';
  r=await invoke('post','/api/mailgun/inbound',{recipient:'fixture@example.invalid'});assert.ok(r.reads.some(x=>x.name==='getCustomIntegrationByEmail'));results.push({case:'Missing Mailgun signature accepted past verification even with configured key',...r});
  delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
  process.env.SMTP_PASS='isolated-fixture-not-a-real-key';
  r=await invoke('post','/api/alerts/test-email',{to:'fixture@example.invalid',subject:'Fixture'});assert.equal(r.sent.length,1);results.push({case:'Unauthenticated email route reaches mocked transport',status:r.status,mockedTransportCalls:r.sent.length});
  delete process.env.SMTP_PASS;
  const indexSource=ts.createSourceFile('index.ts',fs.readFileSync('server/index.ts','utf8'),ts.ScriptTarget.Latest,true);
  const seed=indexSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='seedDashboardData');
  const queries=[];const seedWrites=[];
  const seedStorage=new Proxy({}, {get:(_,name)=>async(...args)=>name==='getMetrics'?[]:seedWrites.push({name,args})});
  const seedJs=ts.transpileModule(seed.getText(indexSource),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const seedFn=new Function('storage','db','sql','log',seedJs+';return seedDashboardData;')(seedStorage,{execute:async query=>queries.push(query)},parts=>parts.join(''),()=>{});
  await seedFn(); assert.equal(queries.length,1); assert.match(queries[0],/status = 'active'/); assert.doesNotMatch(queries[0],/owner_id|is_demo/);
  results.push({case:'Empty global metrics trigger startup fabrication and activation',seedWriteCount:seedWrites.length,query:queries[0],boundary:'Query captured only; no database execution'});
  const schedulerSource=ts.createSourceFile('report-scheduler.ts',fs.readFileSync('server/report-scheduler.ts','utf8'),ts.ScriptTarget.Latest,true);
  const check=schedulerSource.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='checkScheduledReports');
  const checkJs=ts.transpileModule(check.getText(schedulerSource),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
  const stale={status:'pending',createdAt:new Date(Date.now()-3600000),reportId:'report-fixture'};
  let enteredAfterClaim=0;const retryWrites=[];
  const fakeDb={insert:()=>({values:()=>({onConflictDoNothing:()=>({returning:async()=>[]})})}),select:()=>({from:()=>({where:()=>({limit:async()=>[{...stale}]})})}),update:()=>({set:value=>({where:async()=>{retryWrites.push(value);return []}})})};
  const args={exports:{},db:fakeDb,storage:{getScheduledPlatformReports:async()=>[{id:'report-fixture',name:'Fixture',scheduleEnabled:true,status:'active',scheduleRecipients:[]}]},schedulerMetrics:{totalChecks:0},SCHEDULED_REPORT_PLATFORM_TYPES:['google_analytics'],isReportDueNow:()=>({due:true,scheduledKey:'fixture-slot',tz:'UTC'}),getScheduledReportAlignedRefreshGate:async()=>({ready:true}),reportSendEvents:{},linkedinReports:{},eq:(...xs)=>xs,and:(...xs)=>xs,getLatestReportEmailError:async()=>'',validateInstagramScheduledReportScope:async()=>{enteredAfterClaim++;return {ok:false,message:'Fixture stops before artifact/email'}} ,console:{log(){},warn(){},error(e){throw e}}};
  const checkFn=new Function(...Object.keys(args),checkJs+';return checkScheduledReports;')(...Object.values(args));
  await Promise.all([checkFn(),checkFn()]);assert.equal(enteredAfterClaim,2);
  results.push({case:'Two scheduled-report invocations both pass stale-event retry claim',enteredAfterClaim,retryWrites,boundary:'Exact scheduler function with fixture database. Stops at first scope check before artifacts/email; does not prove actual duplicate live delivery.'});
  fs.writeFileSync('docs/audits/v1-2026-10-19/reproductions.json',JSON.stringify({boundary:'Exact handler extraction, fixture storage and no outer Clerk middleware; source review separately establishes no requireAuth enforcement. No live requests, database or email.',results},null,2)+'\n');
  console.log(`${results.length} audit reproductions confirmed; no runtime changes.`);
})().catch(e=>{console.error(e);process.exitCode=1});
