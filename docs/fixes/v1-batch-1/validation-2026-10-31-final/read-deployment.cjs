// Read-only commit/deployment evidence. Existing Git credentials remain in process memory.
const fs=require('node:fs'),path=require('node:path'),{execFileSync}=require('node:child_process');
const commit=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();
const receipt={at:new Date().toISOString(),expectedCommit:commit,credentialsEmitted:false};
(async()=>{
 const health=await fetch('https://marketforensics.onrender.com/api/health',{redirect:'error',signal:AbortSignal.timeout(20000)});const data=await health.json();receipt.health={status:health.status,ok:data.ok,commit:data.commit,nodeEnv:data.nodeEnv};
 let credential;try{const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,timeout:15000,stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});credential=raw.split(/\r?\n/).find(x=>x.startsWith('password='))?.slice(9);}catch{receipt.github='AUTH_UNAVAILABLE';return;}
 if(!credential){receipt.github='AUTH_UNAVAILABLE';return;}
 const headers={Authorization:'Bearer '+credential,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};credential=undefined;
 const r=await fetch('https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs?head_sha='+commit,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});receipt.githubStatus=r.status;if(!r.ok)return;const runs=await r.json();receipt.runs=runs.workflow_runs.map(x=>({id:x.id,name:x.name,status:x.status,conclusion:x.conclusion,headSha:x.head_sha,url:x.html_url}));
 for(const run of receipt.runs){const jobs=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs/${run.id}/jobs`,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});if(jobs.ok)run.jobs=(await jobs.json()).jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}));}
})().catch(e=>{receipt.errorCode=e.code||e.name}).finally(()=>{const name='deployment-'+receipt.at.replace(/[:.]/g,'-')+'.json';fs.writeFileSync(path.join(__dirname,name),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));});
