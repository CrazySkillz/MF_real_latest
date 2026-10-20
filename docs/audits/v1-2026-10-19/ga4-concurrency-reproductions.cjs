// Measures in-flight provider dispatch from current service code using local responses only.
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compiled=ts.transpileModule(fs.readFileSync('server/analytics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exported={};
new Function('exports','require','fetch',compiled)(exported,id=>{
 if(id==='google-auth-library')return{JWT:class{constructor(){throw Error('Unexpected authentication');}}};
 if(id==='./utils/ga4-service-account')return{isSupportedGA4ConnectionMethod:()=>true};
 if(id==='./utils/retry')return{retryWithBackoff:()=>{throw Error('Unexpected transport');}};
 throw Error('Unexpected module '+id);
},()=>{throw Error('Network forbidden in fixture');});
const storage={getGA4Connection:async()=>({id:'fixture',propertyId:'123',accessToken:'synthetic'}),getCampaign:async()=>({currency:'USD'})};
const row=(dims,values)=>({dimensionValues:dims.map(value=>({value})),metricValues:values.map(value=>({value:String(value)}))});
const report=(rows,totals)=>({metadata:{currencyCode:'USD'},rowCount:rows.length,rows,totals:[{metricValues:totals.map(value=>({value:String(value)}))}]});
(async()=>{
 const results=[];
 for(const [channels,readers] of [[2,1],[12,1],[12,2]]){
  const service=new exported.GoogleAnalytics4Service();let active=0,peak=0,channelCalls=0,requests=0,quotaRequests=0;
  service.requestReport=async(_url,options)=>{
   const body=JSON.parse(options.body),dimensions=body.dimensions.map(d=>d.name);requests++;if(body.returnPropertyQuota)quotaRequests++;
   let data;
   if(dimensions.includes('sessionDefaultChannelGroup'))data=report([row(['20261018','Paid Search','source_00','cpc','fixture','desktop','NL'],[10,8,0,0,5])],[10,8,0,0,5]);
   else if(dimensions.includes('pageLocation'))data=report(Array.from({length:channels},(_,i)=>row(['20261018',`https://fixture.invalid/?utm_campaign=fixture&utm_source=source_${String(i).padStart(2,'0')}&utm_medium=cpc`],[20,16,10])),[channels*20,channels*16,channels*10]);
   else {
    channelCalls++;active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setImmediate(resolve));
    active--;data=report([row(['20261018'],[20,16,10])],[20,16,10]);
   }
   return{ok:true,json:async()=>data};
  };
  const outputs=await Promise.all(Array.from({length:readers},()=>service.getAcquisitionBreakdown('fixture',storage,'2026-10-18','123',2000,['fixture'],'2026-10-18',true,true,'USD')));
  assert.equal(peak,channels*readers);assert.equal(channelCalls,channels*readers);assert.equal(quotaRequests,0);
  assert.ok(outputs.every(out=>out.meta.insightsLandingCoverage.selected));
  results.push({case:'Insights channel fan-out',channels,concurrentReaders:readers,peakConcurrentChannelRequests:peak,channelRequests:channelCalls,totalProviderRequests:requests,requestsAskingForPropertyQuota:quotaRequests});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-concurrency-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact GA4 service with requestReport replaced by immediate/local delayed response fixtures. No provider, database or HTTP server. Measures dispatch fan-out only, not live quota consumption, latency, actual 429s or end-to-end tester load. Current requestReport implementation has retries/deadlines but no concurrency queue.',results},null,2)+'\n');
 console.log(`${results.length} GA4 provider-dispatch concurrency cases executed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
