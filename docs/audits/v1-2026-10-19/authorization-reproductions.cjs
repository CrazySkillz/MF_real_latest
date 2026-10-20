// Exact guard and retained-handler controls; storage/auth identities are isolated fixtures.
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),named=new Map(),routes=new Map();
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&!named.has(n.name.text))named.set(n.name.text,'const '+n.getText(sf)+';');if(ts.isCallExpression(n)&&/^app\.(get|post|patch|delete)$/.test(n.expression.getText(sf))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.expression.name.text.toUpperCase()+' '+n.arguments[0].text,n.arguments.at(-1).getText(sf));ts.forEachChild(n,visit);}visit(sf);
const bind=(code,names,env)=>new Function(...Object.keys(env),compile(code)+'\nreturn {'+names.join(',')+'};')(...Object.values(env));
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(p){this.payload=p;return this;}});
const internal={};new Function('exports','require',compile(fs.readFileSync('server/internal-request-auth.ts','utf8')))(internal,require);
(async()=>{
 const results=[];
 for(const [name,actor,campaign,status] of [
  ['Unauthenticated campaign access denied','',null,401],['Missing campaign denied','owner-a',null,404],['Ownerless campaign denied','owner-a',{id:'fixture'},404],['Foreign campaign denied','owner-a',{id:'fixture',ownerId:'owner-b'},404],['Owned campaign control allowed','owner-a',{id:'fixture',ownerId:'owner-a'},200],
 ]){
  const env={z:require('zod').z,getAuth:()=>({userId:actor}),storage:{getCampaign:async()=>campaign},isInternalAutoRefreshRequest:()=>false};
  const guards=bind(['campaignIdSchema','getActorId','ensureCampaignAccess'].map(n=>named.get(n)).join('\n'),['ensureCampaignAccess'],env),res=response();
  const value=await guards.ensureCampaignAccess({},res,'fixture');assert.equal(res.statusCode,status);assert.equal(Boolean(value),status===200);results.push({case:name,status,allowed:Boolean(value)});
 }
 for(const [name,getter] of [['ensureKpiAccess','getKPI'],['ensureBenchmarkAccess','getBenchmark'],['ensurePlatformReportAccess','getLinkedInReport']]){
  let parentCalls=0;const guard=bind(named.get(name),[name],{getActorId:()=> 'owner-a',storage:{[getter]:async()=>({id:'fixture',campaignId:null})},ensureCampaignAccess:async()=>{parentCalls++;return{};}})[name];
  const res=response();assert.equal(await guard({},res,'fixture'),null);assert.equal(res.statusCode,404);assert.equal(parentCalls,0);results.push({case:name+' rejects unscoped row',status:res.statusCode});
 }
 for(const key of ['POST /api/alerts/check','GET /api/alerts/status','POST /api/linkedin/connect']){
  const env={process:{env:{NODE_ENV:'production'}},console:{error(){}}},h=bind('const handler='+routes.get(key),['handler'],env).handler,res=response();await h({},res);assert.equal(res.statusCode,404);results.push({case:key+' fails closed in production before storage/provider imports',status:res.statusCode});
 }
 for(const verb of ['PATCH','DELETE']){
  const storage={getMetaReportById:async()=>({id:'fixture',campaignId:'owned'}),updateMetaReport:async()=>undefined,deleteMetaReport:async()=>false};
  const h=bind('const handler='+routes.get(verb+' /api/meta/reports/:reportId'),['handler'],{storage,ensureCampaignAccess:async()=>({id:'owned'}),console:{error(){}}}).handler,res=response();
  await h({params:{reportId:'fixture'},body:{name:'fixture'}},res);assert.equal(res.statusCode,200);if(verb==='DELETE')assert.equal(res.payload.success,true);else assert.equal(res.payload.report,undefined);
  results.push({case:verb+' legacy Meta report returns200 after zero-row mutation',status:res.statusCode,response:res.payload});
 }
 const token=internal.getInternalAutoRefreshToken();
 for(const [remote,expected] of [['203.0.113.1',false],['127.0.0.1',true]]){const value=internal.isInternalAutoRefreshRequest({socket:{remoteAddress:remote},headers:{'x-internal-auto-refresh-token':token}});assert.equal(value,expected);results.push({case:'Internal token remote-address control',remote,allowed:value});}
 for(const route of ['/api/campaigns/:id/spend/process/connectors','/api/campaigns/:id/spend/process/ad-platforms']){
  const writes=[];let accessCalls=0;
  const env={storage:{getCampaign:async()=>({id:'foreign-fixture',ownerId:'other-owner',currency:'USD'}),updateCampaign:async(id,data)=>writes.push({operation:'campaign-update',id,data}),createSpendSource:async data=>{writes.push({operation:'source-create',data});return{id:'source-fixture'};}},ensureCampaignAccess:async()=>{accessCalls++;return null;},console:{error(){}}};
  Object.assign(env,bind(named.get('parseNum'),['parseNum'],env));Object.assign(env,bind(named.get('processConnectorDerivedSpend'),['processConnectorDerivedSpend'],env));
  const h=bind('const handler='+routes.get('POST '+route),['handler'],env).handler,res=response();await h({params:{id:'foreign-fixture'},body:{amount:123,currency:'EUR'}},res);
  assert.equal(res.statusCode,200);assert.equal(accessCalls,0);assert.equal(writes[0].data.currency,'EUR');assert.equal(writes[0].data.spend,'123.00');assert.equal(writes[1].data.campaignId,'foreign-fixture');results.push({case:'Anonymous connector-derived Spend alias mutates foreign campaign and currency',route,status:res.statusCode,accessCalls,writes});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/authorization-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current helper/handler extraction. Fake actors and storage, actual internal token checker with ephemeral in-memory token (not recorded). No HTTP, provider, email or database mutation. Helper correctness does not establish every caller guard ordering or post-authorization write scope.',results},null,2)+'\n');console.log(`${results.length} authorization/retained-report cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
