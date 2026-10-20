const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const source=fs.readFileSync('server/analytics.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};let directRequests=[];
const fetchFixture=async(url,options)=>{
  const body=JSON.parse(options.body);directRequests.push({hasSignal:!!options.signal,metrics:body.metrics.map(x=>x.name)});
  const values={sessions:10,totalUsers:8,conversions:2,screenPageViews:20,totalRevenue:20,engagedSessions:5,engagementRate:0.5};
  return{ok:true,json:async()=>({metadata:{currencyCode:'USD',timeZone:'UTC'},rowCount:1,rows:[{dimensionValues:(body.dimensions||[]).map(()=>({value:'20261018'})),metricValues:body.metrics.map(x=>({value:String(values[x.name]??0)}))}]})};
};
new Function('exports','require','fetch',compiled)(exportsObject,id=>{
  if(id==='google-auth-library')return{JWT:class{constructor(){throw Error('No auth network allowed');}}};
  if(id==='./utils/ga4-service-account')return{isSupportedGA4ConnectionMethod:()=>true};
  if(id==='./utils/retry')return{retryWithBackoff:()=>{throw Error('Transport must be stubbed');}};
  throw Error('Unexpected module '+id);
},fetchFixture);
const {GoogleAnalytics4Service}=exportsObject;
const storage={getGA4Connection:async()=>({id:'fixture',propertyId:'123',accessToken:'fixture'}),getCampaign:async()=>({currency:'USD'})};
const row=(dims,metrics)=>({dimensionValues:dims.map(value=>({value})),metricValues:metrics.map(value=>({value:String(value)}))});
const report=(rows,totals)=>({metadata:{currencyCode:'USD'},rowCount:rows.length,rows,...(totals?{totals:[{metricValues:totals.map(value=>({value:String(value)}))}]}:{})});
(async()=>{
  const results=[];
  const incomplete=new GoogleAnalytics4Service();let incompleteCalls=0;
  incomplete.requestReport=async()=>{incompleteCalls++;const response=report([row(['20261018','Paid Search','google','cpc','fixture','desktop','NL'],[10,8,2,20,5])]);delete response.rowCount;return{ok:true,json:async()=>response};};
  const accepted=await incomplete.getAcquisitionBreakdown('fixture',storage,'2026-10-18','123',1,['fixture'],'2026-10-18',true,false,'USD');
  assert.equal(incompleteCalls,1);assert.equal(accepted.rows.length,1);
  results.push({case:'Acquisition accepts a full bounded page with absent provider rowCount',requestedLimit:1,requestCount:incompleteCalls,returnedMeta:accepted.meta,boundary:'Exact service with provider fixture; proves no completeness rejection, not occurrence on real Google response.'});
  const coverage=new GoogleAnalytics4Service();const sources=['google','google_ads'];const urls=sources.map(s=>'https://fixture.invalid/?utm_campaign=fixture&utm_source='+s+'&utm_medium=cpc');let filters=[];
  coverage.requestReport=async(_url,options)=>{
    const body=JSON.parse(options.body);const dimensions=body.dimensions.map(x=>x.name);
    let response;
    if(dimensions.includes('sessionDefaultChannelGroup'))response=report([row(['20261018','Paid Search','google','cpc','fixture','desktop','NL'],[10,8,0,0,5])],[10,8,0,0,5]);
    else if(dimensions.includes('pageLocation'))response=report(urls.map(url=>row(['20261018',url],[20,20,10])),[40,40,20]);
    else {
      const expressions=[];function visit(x){if(!x||typeof x!=='object')return;if(x.stringFilter)expressions.push(x.stringFilter);Object.values(x).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));}visit(body.dimensionFilter);
      const contains=expressions.filter(x=>x.matchType==='CONTAINS');filters.push(contains);
      const selected=urls.filter(url=>contains.every(x=>url.toLowerCase().includes(x.value.toLowerCase())));
      response=report([row(['20261018'],[selected.length*20,selected.length*20,selected.length*10])]);
    }
    return{ok:true,json:async()=>response};
  };
  const result=await coverage.getAcquisitionBreakdown('fixture',storage,'2026-10-18','123',2000,['fixture'],'2026-10-18',true,true,'USD');
  assert.equal(result.meta.insightsLandingCoverage.selected,true);assert.equal(result.totals.sessions,60);
  results.push({case:'Insights UTM prefix collision selects 60 sessions from 40 actual landing sessions',actualLandingSessions:40,returnedSessions:result.totals.sessions,filters,rows:result.rows,coverage:result.meta.insightsLandingCoverage,boundary:'Exact service; deterministic provider fixture applies generated CONTAINS predicates to two fixture URLs. No real provider call.'});
  const totals=new GoogleAnalytics4Service();await totals.getTotalsWithRevenue('123','fixture','2026-10-18','2026-10-18',['fixture'],'USD');
  assert.ok(directRequests.length>0);assert.ok(directRequests.every(r=>!r.hasSignal));
  results.push({case:'GA4 total and supplemental daily queries bypass request deadline/cancellation',requests:directRequests,boundary:'Exact service, fetch mocked; no hanging request or network.'});
  fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-query-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');
  console.log(`${results.length} GA4 query cases executed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
