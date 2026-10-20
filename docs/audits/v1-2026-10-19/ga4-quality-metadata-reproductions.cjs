// Provider quality flags are synthetic; no Google call or credential access.
const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compiled=ts.transpileModule(fs.readFileSync('server/analytics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let quality={},empty=false,revenue=100,requests=0;
const qualityKeys=['dataLossFromOtherRow','samplingMetadatas','dataTruncationReasons','schemaRestrictionResponse','emptyReason','subjectToThresholding'];
const fetchFixture=async(_url,options)=>{
 requests++;
 const body=JSON.parse(options.body);
 const metrics={sessions:100,totalUsers:80,conversions:10,keyEvents:10,screenPageViews:200,totalRevenue:revenue,purchaseRevenue:revenue,engagedSessions:50,engagementRate:0.5,sessionKeyEventRate:0.1,eventCount:20};
 const dimensions={date:'20261018',sessionDefaultChannelGroup:'Paid Search',sessionSource:'fixture-source',sessionMedium:'cpc',sessionCampaignName:'fixture',deviceCategory:'desktop',country:'NL',eventName:'purchase'};
 const values=body.metrics.map(metric=>({value:String(metrics[metric.name]??0)}));
 const data={metadata:{currencyCode:'USD',timeZone:'UTC',...quality},rowCount:empty?0:1,
  dimensionHeaders:(body.dimensions||[]).map(d=>({name:d.name})),metricHeaders:body.metrics.map(m=>({name:m.name,type:'TYPE_FLOAT'})),
  rows:empty?[]:[{dimensionValues:(body.dimensions||[]).map(d=>({value:dimensions[d.name]||'fixture'})),metricValues:values}],
  totals:empty?[]:[{metricValues:values}]};
 return{ok:true,status:200,json:async()=>data};
};
const exported={};
new Function('exports','require','fetch',compiled)(exported,id=>{
 if(id==='google-auth-library')return{JWT:class{constructor(){throw Error('No auth permitted');}}};
 if(id==='./utils/ga4-service-account')return{isSupportedGA4ConnectionMethod:()=>true};
 if(id==='./utils/retry')return{retryWithBackoff:()=>{throw Error('Transport must be fixture');}};
 throw Error('Unexpected module '+id);
},fetchFixture);
const storage={getGA4Connection:async()=>({id:'fixture',propertyId:'123',accessToken:'synthetic'}),getCampaign:async()=>({currency:'USD'})};
const warnings=[
 ['sampled report',{samplingMetadatas:[{samplesReadCount:'10',samplingSpaceSize:'100'}]}],
 ['other-row data loss',{dataLossFromOtherRow:true}],
 ['threshold-subject report',{subjectToThresholding:true}],
 ['active Revenue restriction',{schemaRestrictionResponse:{activeMetricRestrictions:[{metricName:'totalRevenue',restrictedMetricTypes:['REVENUE_DATA']}]}}],
 ['date-range truncation',{dataTruncationReasons:[{dataTruncationType:'DATA_TRUNCATION_TYPE_DATE_RANGE',dataTruncationMessage:'Fixture range is incomplete',dataTruncationDate:'2026-10-18'}]}],
 ['provider empty reason',{emptyReason:'fixture-provider-empty-reason'}],
];
(async()=>{const results=[];
 for(const [name,flags] of warnings){
  quality=flags;empty=Boolean(flags.emptyReason);revenue=flags.schemaRestrictionResponse?0:100;requests=0;
  const service=new exported.GoogleAnalytics4Service();service.requestReport=fetchFixture;
  const output=await service.getTotalsWithRevenue('123','synthetic','2026-10-18','2026-10-18',['fixture'],'USD');
  const serialized=JSON.stringify(output);assert.ok(qualityKeys.every(key=>!serialized.includes('"'+key+'"')));
  assert.equal(output.totals.revenue,empty?0:revenue);
  results.push({case:'Totals accepts '+name+' without returning quality metadata',providerMetadata:flags,requestCount:requests,returnedRevenue:output.totals.revenue,returnedKeys:Object.keys(output),qualityRetained:false});
 }
 quality={dataLossFromOtherRow:true,samplingMetadatas:[{samplesReadCount:'10',samplingSpaceSize:'100'}]};empty=false;revenue=100;
 for(const method of ['acquisition','daily']){
  requests=0;const service=new exported.GoogleAnalytics4Service();service.requestReport=fetchFixture;
  const output=method==='acquisition'
   ? await service.getAcquisitionBreakdown('fixture',storage,'2026-10-18','123',2000,['fixture'],'2026-10-18',true,false,'USD')
   : await service.getTimeSeriesWithToken('123','synthetic','2026-10-18',['fixture'],'2026-10-18','USD');
  assert.ok(qualityKeys.every(key=>!JSON.stringify(output).includes('"'+key+'"')));
  const rows=Array.isArray(output)?output:output.rows;assert.equal(rows.length,1);
  results.push({case:method+' accepts rows but discards sampling/other-row metadata',providerMetadata:quality,requestCount:requests,returnedRows:rows.length,qualityRetained:false});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-quality-metadata-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact GA4 service methods, synthetic provider responses, fixture storage and transport. Flags demonstrate missing metadata handling, not occurrence in a live account. Threshold-subject/other-row flags do not by themselves prove every returned value wrong. Publication/downstream behavior is separately traced, not executed here.',results},null,2)+'\n');
 console.log(`${results.length} GA4 response-quality cases executed`);
})().catch(error=>{console.error(error);process.exitCode=1;});
