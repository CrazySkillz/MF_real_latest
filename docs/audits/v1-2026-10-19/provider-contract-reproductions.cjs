// Audit-only: exact current functions/handler, fixture transports and persistence.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleAt(file){const e={};new Function('exports','require',transpile(fs.readFileSync(file,'utf8')))(e,id=>id.startsWith('.')?moduleAt(path.resolve(path.dirname(file),id)+'.ts'):require(id));return e;}
const source=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),named=new Map(),routes=new Map();
function visit(n){if(ts.isFunctionDeclaration(n)&&n.name)named.set(n.name.text,n.getText(source));if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))named.set(n.name.text,'const '+n.getText(source)+';');if(ts.isCallExpression(n)&&n.expression.getText(source)==='app.post'&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.getText(source));ts.forEachChild(n,visit);}visit(source);
function bind(code,names,env){return new Function(...Object.keys(env),transpile(code)+'\nreturn {'+names.join(',')+'};')(...Object.values(env));}
const z=require('zod').z;
const definitions=bind(['zHubSpotRevenuePlatformContext','zValueSource','zNumberLike','zSelectedValues','deriveDefaultClosedWonStageIds'].map(n=>named.get(n)).join('\n'),['zHubSpotRevenuePlatformContext','zValueSource','zNumberLike','zSelectedValues','deriveDefaultClosedWonStageIds'],{z,MAX_SELECTED_VALUES:200});
const dateSource=ts.createSourceFile('date.ts',fs.readFileSync('server/utils/data-transformation.ts','utf8'),ts.ScriptTarget.Latest,true);let dateText;dateSource.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='normalizeStrictUtcDateKey')dateText=n.getText(dateSource);});const dates={};new Function('exports',transpile(dateText))(dates);
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}};}
(async()=>{
 const results=[];
 const deal=amount=>({id:'same-deal',properties:{campaign:'selected',amount,closedate:'2026-10-18',hs_currency:'USD'}});
 for(const [name,pages,expected,stageIds] of [
  ['missing results accepted as zero',[{}],0],
  ['nonnumeric amount accepted as zero',[{results:[deal('not available')]}],0],
  ['malformed amount accepted',[{results:[deal('12oops')]}],12],
  ['repeated deal ID across pages counted twice',[{results:[deal('10')],paging:{next:{after:'next'}}},{results:[deal('10')]}],20],
  ['open stage allowed as confirmed revenue',[{results:[deal('10')]}],10,['open-stage']],
  ['explicit empty results zero control',[{results:[]}],0],
 ]){
  let h,persisted,queries=[];let index=0;
  const fetchWithTimeout=async(_url,options)=>{queries.push(JSON.parse(options.body));return{ok:true,json:async()=>pages[index++]};};
  const env={z,...definitions,...dates,...moduleAt('server/utils/hubspot-pagination.ts'),...moduleAt('server/utils/hubspot-currency.ts'),MAX_HUBSPOT_RESULTS:5000,MAX_CRM_REVIEW_BREAKDOWN_ROWS:200,
   app:{post:(...args)=>h=args.at(-1)},importRateLimiter:()=>{},requireCampaignAccessParamId:()=>{},getInternalGA4RefreshWriteInput:()=>({}),ensureCampaignAccess:async()=>true,sendBadRequest:()=>{throw Error('Unexpected invalid fixture request');},getHubspotAccessTokenForCampaign:async()=>({accessToken:'fixture'}),
   fetch:async()=>({ok:true,json:async()=>({results:[{stages:[{id:'closedwon',metadata:{isClosed:true,probability:1}},{id:'open-stage',metadata:{isClosed:false,probability:0.3}}]}]})}),fetchWithTimeout,googleAdsCampaignIdFromValueOrMapping:()=>null,recomputeCampaignDerivedValues:async()=>{},
   storage:{getCampaign:async()=>({id:'fixture',currency:'USD'}),getHubspotConnection:async()=>({id:'fixture-connection'}),getRevenueSources:async()=>[],replaceGa4HubspotRevenueSourceWithRecords:async(...args)=>{persisted={source:args[4],records:args[5]};return{id:'fixture-source'};}},console:{error(){},warn(){}}};
  Object.assign(env,bind(named.get('hubspotSearchDeals'),['hubspotSearchDeals'],env));
  new Function(...Object.keys(env),transpile(routes.get('/api/campaigns/:id/hubspot/save-mappings')))(...Object.values(env));
  const res=response();await h({params:{id:'fixture'},body:{campaignProperty:'campaign',selectedValues:['selected'],platformContext:'ga4',...(stageIds?{stageIds}:{})}},res);
  assert.equal(res.statusCode,200,JSON.stringify(res.payload));assert.equal(res.payload.totalRevenue,expected);assert.equal(Number(persisted.records.reduce((s,r)=>s+Number(r.revenue),0).toFixed(2)),expected);
  results.push({case:'HubSpot '+name,queries,response:res.payload,persisted,boundary:'Exact current save handler/search/number/date/currency logic; owner check, provider transport, storage and recomputation are fixtures. No provider/DB called.'});
 }
 const sf=moduleAt('server/utils/salesforce-pagination.ts');
 for(const payload of [{},{totalSize:10,done:true,records:[]}]){
  const rows=await sf.fetchCompleteSalesforceQuery({initialUrl:'https://fixture.salesforce.com/services/data/v59.0/query',instanceUrl:'https://fixture.salesforce.com',accessToken:'fixture',fetchImpl:async()=>({ok:true,json:async()=>payload})});assert.deepEqual(rows,[]);results.push({case:'Salesforce incomplete response accepted as complete empty rows',payload,rows,boundary:'Exact query helper, fixture fetch only; downstream materialization traced in source, not exercised here.'});
 }
 const shop=moduleAt('server/utils/shopify-revenue.ts');
 for(const [amount,expected] of [['12oops',12],['not available',null]]){
  const actual=shop.getShopifyConfirmedRevenueAmounts({test:false,financial_status:'paid',current_total_price:amount,currency:'USD'});assert.equal(actual?.shopAmount??null,expected);results.push({case:'Shopify malformed money',amount,actual,boundary:'Exact money helper only; nonnumeric becomes zero then omitted order, malformed 12oops becomes12.'});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/provider-contract-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} provider-contract cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
