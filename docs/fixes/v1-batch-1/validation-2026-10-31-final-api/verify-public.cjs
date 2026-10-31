const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const origin='https://marketforensics.onrender.com',commit='adc5a6fe82219699454c9c21225534450c940a9a',id='b74f98af-ede9-47af-9b19-0720ebb4d2c0';
const receipt={at:new Date().toISOString(),commit,checks:[],authenticated:false,providerRequests:0,secretValuesReturned:false};
(async()=>{try{
 const h=await fetch(origin+'/api/health',{redirect:'error',signal:AbortSignal.timeout(20000)}),v=await h.json();assert.equal(h.status,200);assert.equal(v.ok,true);assert.equal(v.commit,commit);receipt.runtime={status:h.status,ok:v.ok,commit:v.commit};
 for(const [method,p]of [['GET',`/api/campaigns/${id}/spend-to-date?platformContext=custom_integration`],['GET',`/api/campaigns/${id}/spend-sources?platformContext=custom_integration`],['POST',`/api/campaigns/${id}/spend/process/connectors`],['POST',`/api/campaigns/${id}/spend/process/ad-platforms`]]){const r=await fetch(origin+p,{method,redirect:'error',signal:AbortSignal.timeout(20000),...(method==='POST'?{headers:{'Content-Type':'application/json'},body:'{}'}:{})});receipt.checks.push({method,path:p,status:r.status,passed:r.status===401});assert.equal(r.status,401)}
 receipt.result='PASS';
 }catch(e){receipt.result='NOT_VERIFIED';receipt.errorCode=e.code||e.name;process.exitCode=1}
 finally{fs.writeFileSync(path.join(__dirname,'public.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt))}
})();
