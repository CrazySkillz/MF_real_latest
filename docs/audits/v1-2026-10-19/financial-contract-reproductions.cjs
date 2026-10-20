const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const transpile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleFrom(file,mocks={}){const e={};new Function('exports','require',transpile(fs.readFileSync(file,'utf8')))(e,id=>id in mocks?mocks[id]:require(id));return e;}
(async()=>{
  const results=[];
  const revenue=moduleFrom('server/utils/revenue-record-total.ts');
  const sf=ts.createSourceFile('storage.ts',fs.readFileSync('server/storage.ts','utf8'),ts.ScriptTarget.Latest,true);let method;
  function walk(n){if(ts.isMethodDeclaration(n)&&n.name.getText(sf)==='getRevenueTotalForRange')method=n.getText(sf);ts.forEachChild(n,walk);}walk(sf);assert.ok(method);
  const table=new Proxy({},{get:(_target,key)=>String(key)});const predicate=()=>true;
  const bindings={db:{select:()=>({from:()=>({innerJoin:()=>({where:async()=>[]})})})},revenueRecords:table,revenueSources:table,sql:predicate,eq:predicate,and:predicate,or:predicate,isNull:predicate,lte:predicate,
    getReportingDateEndAt:()=>new Date('2026-10-18T23:59:59Z'),isCreatedThroughReportingDate:()=>true,...revenue};
  const Storage=new Function(...Object.keys(bindings),transpile('class Fixture {'+method+'}\nreturn Fixture;'))(...Object.values(bindings));const storage=new Storage();
  storage.getCampaign=async()=>({currency:'USD',reportingTimeZone:'UTC'});
  storage.getRevenueSources=async()=>[{id:'source-fixture',isActive:true,createdAt:'2026-10-01T00:00:00Z'}];
  const breakdown=[{sourceId:'source-fixture',displayName:'Fixture',sourceType:'csv',revenue:100,currency:'USD'}];
  storage.getRevenueBreakdownBySource=async()=>breakdown;
  let failure;try{await storage.getRevenueTotalForRange('campaign-fixture','1900-01-01','2026-10-18','ga4');}catch(e){failure={code:e.code,message:e.message,sourceIds:e.sourceIds};}
  assert.equal(failure.code,'GA4_REVENUE_MATERIALIZATION_INCOMPLETE');
  revenue.assertGa4RevenueMaterializationComplete([{id:'source-fixture'}],[{revenueSourceId:'source-fixture',revenue:100}]);
  results.push({case:'All-date revenue fallback cannot recognize sourceId returned by its breakdown helper',breakdown,failure,boundary:'Exact storage method and completeness helper; SQL predicates mocked, date-filtered result empty, actual breakdown contract supplied. Control with revenueSourceId passes.'});
  const schema=moduleFrom('shared/schema.ts');
  const cumulative=moduleFrom('server/utils/campaign-cumulative-financials.ts',{'../../shared/schema':schema});
  const native=moduleFrom('shared/ga4-financial-source.ts');
  const currentValueWindow={mode:'initial_import_to_latest_completed_day',startDate:'2026-10-01',endDate:'2026-10-18',dataThroughDate:'2026-10-18',reportingTimeZone:'UTC'};
  const input=value=>({campaignId:'campaign-fixture',currency:'USD',performanceSummary:{version:'performance_summary_aggregate_v3',campaignId:'campaign-fixture',currentValueWindow,totals:{spend:{value:100,available:true,sources:['spend-fixture']},revenue:{value,available:true,sources:['ga4']},conversions:{value:2,available:true,sources:['ga4']}}},nativeRevenue:value,importedRevenue:0});
  assert.equal(native.isGA4FinancialTotalsCandidate({revenue:-10,conversions:2}),true);
  let negativeError;try{cumulative.resolveCampaignCumulativeFinancials(input(-10));}catch(e){negativeError=e.message;}
  assert.match(negativeError,/non-negative/);
  results.push({case:'Valid negative native revenue is accepted upstream but rejected by cumulative financial publication',upstreamCandidateAccepted:true,revenue:-10,error:negativeError,boundary:'Actual financial helpers and shared Zod schema; no storage or provider.'});
  const zero=cumulative.resolveCampaignCumulativeFinancials(input(0));assert.equal(zero.financials.roi,-100);assert.equal(zero.snapshot.inputs.revenue.available,true);
  results.push({case:'Control: measured zero revenue remains available with ROI -100%',financials:zero.financials,snapshotRevenue:zero.snapshot.inputs.revenue});
  fs.writeFileSync('docs/audits/v1-2026-10-19/financial-contract-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');
  console.log(`${results.length} financial contract cases executed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
