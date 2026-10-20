const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const dir='docs/audits/v1-2026-10-19',code=fs.readFileSync('server/routes-oauth.ts','utf8');
const sf=ts.createSourceFile('routes.ts',code,ts.ScriptTarget.Latest,true),routes=new Map();
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='app.get'&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.arguments.at(-1).getText(sf));ts.forEachChild(n,visit)}visit(sf);
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const fields={};new Function('exports',compile(fs.readFileSync('server/utils/field-definitions.ts','utf8')))(fields);
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this},json(data){this.data=data;return this}});
const results=[];
(async()=>{
 for(const actor of [null,'unrelated-owner']){
  for(const path of ['/api/campaigns/:id/google-trends','/api/campaigns/:campaignId/attribution','/api/platforms/:platform/fields']){
   let accessChecks=0;const reads=[],providerCalls=[];
   const fixtureStorage={
    getCampaign:async id=>{reads.push({method:'getCampaign',id});return{id,ownerId:'other-owner',industry:'private-fixture-industry',trendKeywords:['private-fixture-keyword']};},
    getCampaignTouchpoints:async id=>{reads.push({method:'getCampaignTouchpoints',id});return[{id:'private-fixture-event',campaignId:id,eventValue:'42',channel:'private-fixture-channel'}];},
    getCampaignAttributionInsights:async id=>{reads.push({method:'getCampaignAttributionInsights',id});return[{campaignId:id,fixturePrivateInsight:true}];},
    getLinkedInConnection:async id=>{reads.push({method:'getLinkedInConnection',id});return{campaignId:id};},
    getGoogleSheetsConnections:async id=>{reads.push({method:'getGoogleSheetsConnections',id});return[{campaignId:id,spreadsheetId:'fixture-private-sheet',accessToken:'fixture-only-not-a-secret',isPrimary:true}];},
   };
   const env={storage:fixtureStorage,getPlatformFields:fields.getPlatformFields,getActorId:()=>actor,ensureCampaignAccess:async()=>{accessChecks++;return null},console:{log(){},warn(){},error(){}},
    require:name=>{assert.equal(name,'google-trends-api');return{interestOverTime:async request=>{providerCalls.push({provider:'google-trends',keywords:request.keyword});return JSON.stringify({default:{timelineData:[{time:'1',value:[7]}]}});}};},
    fetch:async url=>{providerCalls.push({provider:'google-sheets',url});return{ok:true,json:async()=>url.includes('/values/')?{values:[['Platform','Revenue']]}:{sheets:[{properties:{title:'Sheet1',gridProperties:{rowCount:1}}}]}};},
   };
   const handler=new Function(...Object.keys(env),compile('return ('+routes.get(path)+')'))(...Object.values(env)),res=response();
   await handler({auth:{userId:actor},params:{id:'foreign-fixture',campaignId:'foreign-fixture',platform:'linkedin'},query:{campaignId:'foreign-fixture'}},res);
   assert.equal(res.statusCode,200);assert.equal(accessChecks,0);assert.ok(reads.length);
   if(path.endsWith('/google-trends'))assert.equal(res.data.keywords[0],'private-fixture-keyword');
   if(path.endsWith('/attribution'))assert.equal(res.data.touchpoints[0].id,'private-fixture-event');
   if(path.endsWith('/fields')){assert.equal(providerCalls.length,2);assert.equal(res.data.fields.find(f=>f.id==='platform').required,true);}
   results.push({case:path,actor:actor||'anonymous',status:res.statusCode,accessChecks,reads,providerCalls,response:res.data});
  }
 }
 fs.writeFileSync(dir+'/retained-private-read-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current GET handlers and static field definitions. All private data, identities and provider replies are synthetic. No HTTP app/middleware/provider/database access; unauthorized handler access and provider dispatch proven, not live data exposure.',results},null,2)+'\n');
 console.log(JSON.stringify({cases:results.length,allAssertionsPassed:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
