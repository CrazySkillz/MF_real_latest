// Current PATCH, storage write callback, daily response block and client formatter.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(file){const module={exports:{}};new Function('module','exports','require',compile(fs.readFileSync(file,'utf8')))(module,module.exports,id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)+'.ts'):require(id));return module.exports;}
const schema=load('shared/schema.ts'),timezone=load('server/utils/reporting-timezone.ts'),traffic=load('shared/ga4-traffic-window.ts');
const source=fs.readFileSync('server/routes-oauth.ts','utf8'),sf=ts.createSourceFile('routes.ts',source,ts.ScriptTarget.Latest,true),named=new Map(),routes=new Map();
function visit(n){if(ts.isVariableDeclaration(n)&&!named.has(n.name.getText(sf)))named.set(n.name.getText(sf),'const '+n.getText(sf)+';');if(ts.isFunctionDeclaration(n)&&n.name)named.set(n.name.text,n.getText(sf));if(ts.isCallExpression(n)&&/^app\.(get|patch)$/.test(n.expression.getText(sf))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.expression.name.text+' '+n.arguments[0].text,n.arguments.at(-1));ts.forEachChild(n,visit);}visit(sf);
const bind=(code,env)=>new Function(...Object.keys(env),compile(code))(...Object.values(env));
const response=()=>({statusCode:200,status(n){this.statusCode=n;return this;},json(p){this.payload=p;return this;}});
const page=ts.createSourceFile('page.tsx',fs.readFileSync('client/src/pages/ga4-metrics.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let formatCallback;
function findFormat(n){if(ts.isVariableDeclaration(n)&&n.name.getText(page)==='formatMoney')formatCallback=n.initializer.arguments[0].getText(page);ts.forEachChild(n,findFormat);}findFormat(page);assert.ok(formatCallback);
const dailyStatements=routes.get('get /api/campaigns/:id/ga4-daily').body.statements.find(ts.isTryStatement).tryBlock.statements;
const dailyNamed=name=>dailyStatements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(sf)===name));
const dailySegment=source.slice(dailyNamed('providerRefreshWarning').getStart(sf),dailyStatements.at(-1).end);
const storageAst=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true);let storageUpdate;
function findUpdate(n){if(ts.isMethodDeclaration(n)&&n.name.getText(storageAst)==='updateCampaign')storageUpdate=n.getText(storageAst);ts.forEachChild(n,findUpdate);}findUpdate(storageAst);
(async()=>{const results=[];
 for(const [name,body,expectInvalidation] of [
  ['Currency edit retains native daily history',{currency:'EUR'},false],
  ['Campaign-filter edit invalidates native history',{ga4CampaignFilter:'other'},true],
  ['Reporting-timezone edit invalidates native history',{reportingTimeZone:'Europe/Amsterdam'},true],
 ]){
  let campaign={id:'currency-fixture',ownerId:'owner-a',status:'active',currency:'USD',reportingTimeZone:'UTC',ga4CampaignFilter:'saved_campaign'},rows=[{date:'2026-10-18',sessions:100,users:80,conversions:10,revenue:100,pageviews:200,engagedSessions:50,updatedAt:'2026-10-19T04:00:00Z'}],invalidationCalls=0,ordinaryCalls=0;
  const db={update:()=>({set:data=>({where:()=>({returning:async()=>{campaign={...campaign,...data};return[campaign];}})})})};
  const exactStorage=bind('class FixtureStorage {'+storageUpdate+'}\nreturn new FixtureStorage();',{db,campaigns:{id:'id'},eq:()=>true});
  exactStorage.writeGA4RefreshInputChange=async(_id,write)=>write(db);
  const storage={updateCampaign:async(...args)=>{ordinaryCalls++;return exactStorage.updateCampaign(...args);},updateCampaignWithGA4DailyInvalidation:async(_id,data)=>{invalidationCalls++;campaign={...campaign,...data};rows=[];return campaign;},getGA4DailyMetrics:async()=>rows};
  const env={storage,ensureCampaignAccess:async()=>campaign,insertCampaignSchema:schema.insertCampaignSchema,z:require('zod').z,normalizeReportingTimeZone:timezone.normalizeReportingTimeZone,console,process:{env:{}}};
  Object.assign(env,bind(named.get('parseGA4CampaignFilter')+'\n'+named.get('getGA4CampaignFilterValues')+'\n'+named.get('withReportingTimeZone')+'\nreturn {getGA4CampaignFilterValues,withReportingTimeZone};',env));
  const handler=bind('return '+routes.get('patch /api/campaigns/:id').getText(sf),env),res=response();await handler({params:{id:campaign.id},body},res);
  assert.equal(res.statusCode,200);assert.equal(invalidationCalls,expectInvalidation?1:0);assert.equal(ordinaryCalls,expectInvalidation?0:1);
  if(expectInvalidation){assert.equal(rows.length,0);results.push({case:name,invalidationCalls,ordinaryCalls,remainingRows:rows.length});continue;}
  const dailyRes=response(),dailyEnv={storage,campaignId:campaign.id,campaign,selectedConnection:{propertyId:'123',importStartDate:'2026-10-18'},startDate:'2026-10-18',endDate:'2026-10-18',dataThroughDate:'2026-10-18',reportingTimeZone:'UTC',days:7,readOnly:true,res:dailyRes,
   GA4_OVERVIEW_LEGACY_IMPORT_START_DATE:timezone.GA4_OVERVIEW_LEGACY_IMPORT_START_DATE,summarizeGA4TrafficRows:traffic.summarizeGA4TrafficRows,addDerivedEngagedSessions:traffic.addDerivedGA4EngagedSessions,getLatestCompleteReportingDate:timezone.getLatestCompleteReportingDate,buildFreshness:()=>({refreshIsStale:true}),getGA4DailyRefreshAttempt:()=>null};
  await bind(dailyNamed('getLatestStoredDailyDate').getText(sf)+'\n'+dailyNamed('addDateOnlyDays').getText(sf)+'\nreturn (async()=>{'+dailySegment+'})();',dailyEnv);
  assert.equal(dailyRes.payload.success,true);assert.equal(dailyRes.payload.data[0].revenue,100);assert.equal(dailyRes.payload.currency,undefined);
  const money=bind('return '+formatCallback,{campaignCurrency:campaign.currency});assert.equal(money(dailyRes.payload.data[0].revenue),'€100.00');
  results.push({case:name,invalidationCalls,ordinaryCalls,originalNativeCurrency:'USD',newCampaignCurrency:campaign.currency,dailyRevenue:dailyRes.payload.data[0].revenue,responseCurrency:dailyRes.payload.currency??null,formattedRevenue:money(dailyRes.payload.data[0].revenue),dailySuccess:dailyRes.payload.success});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/campaign-currency-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current campaign PATCH, updateCampaign write, real schema/timezone helpers, final native daily response block and client money formatter. Fixture owner/storage/transaction wrapper/freshness decoration. Control invalidation method is a fixture; actual storage deletion lines719–720 are separately traced. No DB/provider/network mutation; complete React render and live currency conversion not executed.',results},null,2)+'\n');console.log(`${results.length} currency/invalidation cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
