// Read-only public deployment observation. No credentials or provider requests.
const fs=require('node:fs'),assert=require('node:assert/strict');
const expected=process.argv[2];assert.match(expected||'',/^[a-f0-9]{40}$/);
const output=__dirname+'/deployment-observations.json',result={expected,startedAt:new Date().toISOString(),observations:[]};
assert.equal(fs.existsSync(output),false);
async function check(path){const r=await fetch('https://marketforensics.onrender.com'+path,{signal:AbortSignal.timeout(15000)});return r;}
(async()=>{
 let stable=0;
 for(let i=0;i<36;i++){
  let observation={at:new Date().toISOString()};
  try{const r=await check('/api/health'),h=await r.json();Object.assign(observation,{status:r.status,ok:h.ok,commit:h.commit});stable=r.status===200&&h.ok&&h.commit===expected?stable+1:0;}catch(e){observation.error=e.name;stable=0;}
  result.observations.push(observation);fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(observation));
  if(stable>=3){
   const root=await check('/'),health=await check('/health'),protectedRoute=await check('/api/campaigns');
   result.publicChecks={root:root.status,readiness:health.status,unauthenticatedCampaignList:protectedRoute.status};
   assert.equal(root.status,200);assert.equal(health.status,200);assert.ok([401,403].includes(protectedRoute.status));
   const r=await check('/health/scheduler'),s=await r.json(),g=s.ga4DailyScheduler;
   result.scheduler={httpStatus:r.status,startedAt:g?.startedAt,nextRunAt:g?.nextRunAt,nextDataThroughDate:g?.nextDataThroughDate,config:g?.config,lastRunStatus:g?.lastRunStatus};
   result.result='PASS: exact deployment revision, stable readiness and unauthenticated data denial';return;
  }
  await new Promise(resolve=>setTimeout(resolve,20000));
 }
 throw new Error('EXPECTED_REVISION_NOT_OBSERVED');
})().catch(e=>{result.result='FAIL';result.error=e.message;process.exitCode=1;}).finally(()=>{result.completedAt=new Date().toISOString();fs.writeFileSync(output,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,expected,publicChecks:result.publicChecks,scheduler:result.scheduler}));});
