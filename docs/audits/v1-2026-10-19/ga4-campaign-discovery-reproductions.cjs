const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const compiled=ts.transpileModule(fs.readFileSync('server/analytics.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const exportsObject={};let transport;
new Function('exports','require','fetch',compiled)(exportsObject,id=>{
 if(id==='google-auth-library')return{JWT:class{constructor(){throw Error('No provider auth permitted');}}};
 if(id==='./utils/ga4-service-account')return{isSupportedGA4ConnectionMethod:()=>true};
 if(id==='./utils/retry')return{retryWithBackoff:()=>{throw Error('Unexpected real transport');}};
 throw Error('Unexpected import '+id);
},(...args)=>transport(...args));
const storage={getGA4Connection:async()=>({id:'fixture',propertyId:'123',accessToken:'fixture'})};
(async()=>{
 const results=[],service=new exportsObject.GoogleAnalytics4Service();let requests=[];
 transport=async(_url,options)=>{requests.push({body:JSON.parse(options.body),hasSignal:!!options.signal});return{ok:false,status:429,text:async()=>'{"error":{"code":429,"message":"Quota exhausted"}}'};};
 const failed=await service.getCampaignValues('fixture',storage,'30daysAgo','123',200);assert.deepEqual(failed,{propertyId:'123',campaigns:[]});assert.equal(requests.length,7);assert.ok(requests.every(r=>!r.hasSignal));
 results.push({case:'All campaign-discovery queries fail429 but service returns ordinary empty list',response:failed,requestCount:requests.length,allRequestsWithoutSignal:true});
 requests=[];transport=async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);const rows=body.dimensions[0].name==='pageLocation'?[]:Array.from({length:200},(_,i)=>({dimensionValues:[{value:`campaign-${String(i).padStart(3,'0')}`}],metricValues:[{value:String(1000-i)}]}));return{ok:true,json:async()=>({rows,rowCount:body.dimensions[0].name==='pageLocation'?0:201})};};
 const limited=await service.getCampaignValues('fixture',storage,'30daysAgo','123',200);assert.equal(limited.campaigns.length,200);assert.equal(requests.length,2);assert.ok(requests.every(r=>r.offset===undefined));assert.deepEqual(Object.keys(limited).sort(),['campaigns','propertyId']);
 results.push({case:'Campaign-discovery rowCount201 is ignored after top200; no pagination/completeness marker',returnedCount:limited.campaigns.length,requestCount:requests.length,requestDimensions:requests.map(r=>r.dimensions[0].name),responseKeys:Object.keys(limited)});
 fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-campaign-discovery-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current analytics service with deterministic provider responses; no Google API, database or browser. Current guarded route wraps these results in success:true; reconnect picker trace separately shows manual entry only when list empty.',results},null,2)+'\n');console.log(`${results.length} GA4 campaign discovery cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
