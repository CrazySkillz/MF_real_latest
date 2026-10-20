const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),routes=new Map();function walk(n){if(ts.isCallExpression(n)&&/^app\.(patch|post)$/.test(n.expression.getText(sf))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.getText(sf));ts.forEachChild(n,walk);}walk(sf);
const schemas={};new Function('exports','require',compile(fs.readFileSync('shared/schema.ts','utf8')))(schemas,require);
function handler(route,env){let h;const bindings={app:{patch:(...a)=>h=a.at(-1),post:(...a)=>h=a.at(-1)},console:{log(){},error(){}},z:require('zod').z,...schemas,...env};new Function(...Object.keys(bindings),compile(routes.get(route)))(...Object.values(bindings));return h;}
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}};}
(async()=>{
 const results=[];
 for(const [kind,route,getName,updateName,param] of [
  ['LinkedIn connection','/api/linkedin/update/:campaignId',null,'updateLinkedInConnection','campaignId'],
  ['legacy Meta KPI','/api/platforms/meta/kpis/:kpiId','getMetaKPIById','updateMetaKPI','kpiId'],
  ['legacy Meta Benchmark','/api/benchmarks/:benchmarkId','getMetaBenchmarkById','updateMetaBenchmark','benchmarkId'],
 ]){
  const checked=[],writes=[];const storage={getKPI:async()=>null,[updateName]:async(id,updates)=>{writes.push({id,updates});return{id,...updates};},...(getName?{[getName]:async()=>({id:'fixture-row',campaignId:'owned'})}:{})};
  const h=handler(route,{storage,process:{env:{NODE_ENV:'production'}},ensureCampaignAccess:async(_req,res,id)=>{checked.push(id);if(id!=='owned'){res.status(404).json({error:'foreign'});return null;}return{id:'owned',ownerId:'owner-a'};}});
  const res=response();await h({params:{[param]:param==='campaignId'?'owned':'fixture-row'},body:{campaignId:'foreign'}},res);assert.equal(res.statusCode,200);assert.deepEqual(checked,['owned']);assert.equal(writes[0].updates.campaignId,'foreign');results.push({case:kind+' accepts foreign replacement campaignId after checking only original owner',checked,writes,response:res.payload,boundary:'Exact current route and real shared validation schema where used; fixture access helper denies foreign IDs if called. Storage capture proves unsafe write argument; real storage .set behavior separately traced, no DB mutation.'});
 }
 let sources=[],records=[],campaignUpdates=[];
 const h=handler('/api/campaigns/:id/spend/ad-platform/import',{ensureCampaignAccess:async()=>({id:'fixture',currency:'EUR'}),storage:{getGoogleAdsDailyMetrics:async()=>[{googleCampaignId:'selected',date:'2026-10-18',spend:'10'},{googleCampaignId:'unselected',date:'2026-10-18',spend:'90'}],getSpendSources:async()=>[],createSpendSource:async s=>{sources.push(s);return{id:'source'};},deleteSpendRecordsBySource:async()=>{},createSpendRecords:async r=>records=r,getSpendTotalForRange:async()=>({totalSpend:0}),updateCampaign:async(...a)=>campaignUpdates.push(a)}});
 const res=response();await h({params:{id:'fixture'},body:{platform:'google_ads',startDate:'2026-10-01',endDate:'2026-10-18'}},res);assert.equal(res.payload.totalSpend,100);assert.equal(sources[0].currency,'USD');assert.equal(records[0].currency,'USD');results.push({case:'Retained ad-platform Spend imports all stored campaigns and labels EUR campaign money USD',sources,records,campaignUpdates,response:res.payload,boundary:'Exact handler; no connection/selected-ID lookup for Google Ads/Meta/LinkedIn, unlike TikTok. Storage fixtures only; campaign total uses default GA4 scope separately.'});
 fs.writeFileSync('docs/audits/v1-2026-10-19/retained-mutation-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} retained-mutation cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
