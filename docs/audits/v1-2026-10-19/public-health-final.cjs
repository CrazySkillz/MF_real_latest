// Two public GETs only. Persist allowlisted operational counters, never campaign records/errors.
const fs=require('node:fs');
const dir='docs/audits/v1-2026-10-19/',base='https://marketforensics.onrender.com';
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o&&Object.hasOwn(o,k)).map(k=>[k,o[k]]));
async function main(){
  const result={at:new Date().toISOString(),base,checks:[]};
  for(const path of ['/api/health','/health/scheduler']){
    const response=await fetch(base+path,{method:'GET',signal:AbortSignal.timeout(20000),redirect:'error'});
    if(!response.ok) {result.checks.push({path,status:response.status});continue;}
    const json=await response.json();
    const data=path==='/api/health'?pick(json,['ok','commit','nodeEnv','ts']):{
      publicStatus:json.status,
      reportScheduler:pick(json.scheduler,['totalChecks','totalSent','totalFailed','lastScheduledReportsFound','lastDueReportsFound','lastRefreshDeferredReports','lastCheckTime']),
      ga4Daily:pick(json.ga4DailyScheduler,['started','inProgress','lastRunStatus','lastRunStartedAt','lastRunFinishedAt','lastRunTrigger','nextRunAt','totalRuns']),
      autoRefresh:{...pick(json.autoRefreshScheduler,['started','inProgress','lastRunStatus','lastRunStartedAt','lastRunFinishedAt']),
        lastRunSummary:pick(json.autoRefreshScheduler?.lastRunSummary,['campaignsScanned','providerJobsAttempted','providerJobsSucceeded','providerJobsRetained','providerJobsSkipped','campaignErrors','recomputeFailed','linkedInRefreshFailed'])},
    };
    result.checks.push({path,status:response.status,data});
  }
  fs.writeFileSync(dir+'deployed-public-final-2026-10-20.json',JSON.stringify(result,null,2)+'\n');
  console.log(JSON.stringify(result));
}
main().catch(e=>{console.error(String(e));process.exitCode=1;});
