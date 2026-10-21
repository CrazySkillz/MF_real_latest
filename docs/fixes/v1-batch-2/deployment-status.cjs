// Read-only GitHub deployment status and public Render health. Never prints credentials.
const fs=require('node:fs'),{execFileSync}=require('node:child_process'),assert=require('node:assert/strict');
const sha=process.argv[2];assert.match(sha||'',/^[a-f0-9]{40}$/);
const headers={Accept:'application/vnd.github+json','User-Agent':'MF-batch2-deployment-verification'};
const result={at:new Date().toISOString(),expectedCommit:sha};
const file='docs/fixes/v1-batch-2/deployment-status.json';
(async()=>{
 let response=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/commits/${sha}/status`,{headers,signal:AbortSignal.timeout(20000)});
 if([401,404].includes(response.status)){
  let token;try{token=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',timeout:30000,windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'Never'},stdio:['pipe','pipe','pipe']}).split(/\r?\n/).find(l=>l.startsWith('password='))?.slice(9);}catch{throw Object.assign(new Error(),{code:'NO_NONINTERACTIVE_GITHUB_CREDENTIAL'});}
  assert.ok(token);headers.Authorization='Bearer '+token;
  response=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/commits/${sha}/status`,{headers,signal:AbortSignal.timeout(20000)});
 }
 result.githubHttp=response.status;
 if(response.ok){const body=await response.json();result.github={state:body.state,statuses:body.statuses.map(s=>({context:s.context,state:s.state,description:s.description,updatedAt:s.updated_at,targetUrl:s.target_url}))};}
 const reads=await Promise.allSettled([
  fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/commits/${sha}/check-runs`,{headers,signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)return{http:r.status};const b=await r.json();return b.check_runs.map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,startedAt:x.started_at,completedAt:x.completed_at,detailsUrl:x.details_url}));}),
  fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/deployments?sha=${sha}&per_page=10`,{headers,signal:AbortSignal.timeout(20000)}).then(async r=>{if(!r.ok)return{http:r.status};const b=await r.json();return Promise.all(b.map(async x=>{const s=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/deployments/${x.id}/statuses?per_page=5`,{headers,signal:AbortSignal.timeout(20000)});return{id:x.id,sha:x.sha,environment:x.environment,createdAt:x.created_at,statuses:s.ok?(await s.json()).map(v=>({state:v.state,description:v.description,createdAt:v.created_at,environmentUrl:v.environment_url,logUrl:v.log_url})):[]};}));})
 ]);for(let i=0;i<reads.length;i++)result[i?'deployments':'checkRuns']=reads[i].status==='fulfilled'?reads[i].value:{error:'GitHub read failed'};
 const run=Array.isArray(result.checkRuns)&&result.checkRuns[0]?.detailsUrl?.match(/\/actions\/runs\/(\d+)\//)?.[1];
 if(run){const j=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs/${run}/jobs`,{headers,signal:AbortSignal.timeout(20000)});if(j.ok)result.jobs=(await j.json()).jobs.map(x=>({name:x.name,status:x.status,conclusion:x.conclusion,steps:x.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}));}
 const health=await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(20000)});result.healthStatus=health.status;
 const h=await health.json().catch(()=>({}));result.observedCommit=h.commit;result.healthOk=h.ok;result.expectedRuntimeLive=health.ok&&h.ok===true&&h.commit===sha;
})().catch(e=>{result.errorCode=e.code||e.name;process.exitCode=1;}).finally(()=>{const r=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{expectedCommit:sha,observations:[]};assert.equal(r.expectedCommit,sha);r.observations.push(result);fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');console.log(JSON.stringify(result,null,2));});
