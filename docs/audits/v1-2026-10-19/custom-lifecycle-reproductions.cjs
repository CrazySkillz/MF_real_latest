const fs = require('node:fs');
const ts = require('typescript');
const assert = require('node:assert/strict');
const root = 'docs/audits/v1-2026-10-19/';
const transpile = source => ts.transpileModule(source, {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function sourceFile(file) {return ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);}
function find(sf, name, kind) {let found;function walk(n){if(kind(n) && n.name?.getText(sf) === name) found=n;ts.forEachChild(n,walk);}walk(sf);assert.ok(found, name);return found.getText(sf);}
(async () => {
  const results=[];
  const sf=sourceFile('server/storage.ts');
  const method=find(sf,'createCustomIntegration',ts.isMethodDeclaration);
  let saved;
  const db={update(){return{set(value){saved=value;return{where(){return{returning:async()=>[{id:'fixture',...value}]};}};}};}};
  const Storage=new Function('db','customIntegrations','eq',transpile('class Fixture { '+method+' }\nreturn Fixture;'))(db,{id:'id'},()=>true);
  const instance=new Storage();
  instance.getCustomIntegration=async()=>({id:'fixture',allowedEmailAddresses:['old@example.invalid']});
  await instance.createCustomIntegration({campaignId:'fixture-campaign',email:'fixture@example.invalid',webhookToken:'fixture-token',allowedEmailAddresses:['new@example.invalid']});
  assert.equal(Object.hasOwn(saved,'allowedEmailAddresses'),false);
  results.push({case:'Existing custom integration update drops replacement sender whitelist',requestedWhitelist:['new@example.invalid'],writtenFields:Object.keys(saved),boundary:'Exact extracted storage method with mock DB; no persisted user data.'});
  const ui=sourceFile('client/src/pages/custom-integration-analytics.tsx');
  const resolver=find(ui,'resolveCustomIntegrationMetric',ts.isFunctionDeclaration);
  const resolve=new Function('getCustomIntegrationMetricOption','getCustomIntegrationSourceLabel','normalizeCustomIntegrationFinancialMetricKey','parseCustomIntegrationMetricNumber','getCustomIntegrationRawMetric',transpile(resolver+'\nreturn resolveCustomIntegrationMetric;'))(
    key=>({key,label:'Clicks',unit:'',type:'count'}),()=> 'Fixture import',v=>v,v=>v==null?null:Number(v),(row,option)=>row[option.key]);
  const result=resolve({clicks:12,parserMetadata:{requiresReview:true,confidence:20,warnings:['Fixture warning']}},'clicks');
  assert.equal(result.available,true);assert.equal(result.currentValue,12);
  results.push({case:'Custom UI metric resolver exposes review-required metric',result,boundary:'Exact resolver; metric metadata accessors are mocks. UI warning badge exists separately; this does not claim warnings are hidden.'});
  const report=sourceFile('server/report-scheduler.ts');
  const financial=find(report,'buildCustomIntegrationFinancialReportMetrics',ts.isFunctionDeclaration);
  const build=new Function('storage','parseCustomIntegrationMetricNumber',transpile(financial+'\nreturn buildCustomIntegrationFinancialReportMetrics;'))({
    getRevenueSources:async()=>[{id:'fixture-revenue',isActive:true}],getRevenueTotalForRange:async()=>{throw Error('fixture read outage');},
    getSpendSources:async()=>[],getSpendBreakdownBySource:async()=>[],
  },v=>v==null?null:Number(v));
  const financialResult=await build('fixture-campaign',{});
  assert.deepEqual([financialResult.get('overview.total_revenue').available,financialResult.get('overview.total_revenue').value],[true,0]);
  results.push({case:'Custom report turns failed revenue read into available zero',result:financialResult.get('overview.total_revenue'),boundary:'Exact financial report builder with active source and failed total-read fixture.'});
  const routeSource=sourceFile('server/routes-oauth.ts');let transfer;
  function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(routeSource)==='app.post'&&n.arguments[0]?.text==='/api/custom-integration/transfer')transfer=n.getText(routeSource);ts.forEachChild(n,walk);}walk(routeSource);assert.ok(transfer);
  let h, integration={id:'fixture-integration',campaignId:'same-fixture'},metrics=[{clicks:12,parserMetadata:{requiresReview:true},uploadedAt:'2020-01-01'}],copied=[];
  new Function('app','storage','ensureCampaignAccess','console',transpile(transfer))({post:(...a)=>h=a.at(-1)},{
    getCustomIntegration:async()=>integration,createCustomIntegration:async()=>integration,
    getAllCustomIntegrationMetrics:async()=>metrics.slice(),createCustomIntegrationMetrics:async row=>{copied.push(row);metrics.push(row);},
    deleteCustomIntegration:async()=>{integration=undefined;metrics=[];return true;},
  },async()=>({id:'same-fixture'}),{log(){},error(){}});
  const res={statusCode:200,status(n){this.statusCode=n;return this;},json(value){this.payload=value;return this;}};
  await h({body:{fromCampaignId:'same-fixture',toCampaignId:'same-fixture'}},res);
  assert.equal(res.payload.success,true);assert.equal(integration,undefined);assert.equal(metrics.length,0);
  assert.equal(Object.hasOwn(copied[0],'parserMetadata'),false);assert.equal(Object.hasOwn(copied[0],'uploadedAt'),false);
  results.push({case:'Same-source transfer deletes connection and metrics but reports success; copy drops review metadata and import timestamp',response:res.payload,remainingMetrics:metrics.length,copiedFields:Object.keys(copied[0]),boundary:'Exact retained API handler with mock storage and successful owner guards. No current frontend caller found; no database/customer mutation.'});
  let connect;function findConnect(n){if(ts.isCallExpression(n)&&n.expression.getText(routeSource)==='app.post'&&n.arguments[0]?.text==='/api/custom-integration/:campaignId/connect')connect=n.getText(routeSource);ts.forEachChild(n,findConnect);}findConnect(routeSource);assert.ok(connect);
  let connectHandler,guardCalls=0,tempWrite;
  new Function('app','storage','ensureCampaignAccess','console','require','randomBytes',transpile(connect))({post:(...a)=>connectHandler=a.at(-1)},
    {createCustomIntegration:async row=>{tempWrite=row;return{id:'fixture-temp',...row};}},
    async()=>{guardCalls++;throw Error('Guard must reject anonymous actor');},{log(){},error(){}},
    id=>{assert.equal(id,'./utils/email-generator');return{generateCampaignEmail:async()=> 'fixture@example.invalid'};},()=>Buffer.from('fixture-token'));
  await connectHandler({params:{campaignId:'temp-campaign-setup'},body:{campaignName:'Fixture',allowedEmailAddresses:[]},protocol:'http',get:()=> 'fixture.invalid'},res);
  assert.equal(guardCalls,0);assert.equal(res.payload.success,true);assert.equal(tempWrite.campaignId,'temp-campaign-setup');
  results.push({case:'Magic temporary campaign ID bypasses custom connect actor/owner guard',guardCalls,writtenCampaignId:tempWrite.campaignId,success:res.payload.success,boundary:'Exact retained handler with mocked email-name generation, randomness and storage. No network, email or user data.'});
  fs.writeFileSync(root+'custom-lifecycle-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');
  console.log(`${results.length} custom lifecycle cases executed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
