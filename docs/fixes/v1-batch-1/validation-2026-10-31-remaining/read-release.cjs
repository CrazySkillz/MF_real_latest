// Read-only release checks. Existing Git credentials stay in memory and are never emitted.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
const commit=process.argv[2]||execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8',windowsHide:true}).trim();assert.match(commit,/^[0-9a-f]{40}$/);
const receipt={at:new Date().toISOString(),expectedCommit:commit,credentialsEmitted:false};
(async()=>{try{
 const response=await fetch('https://marketforensics.onrender.com/api/health',{redirect:'error',signal:AbortSignal.timeout(20000)}),data=await response.json();receipt.health={status:response.status,ok:data.ok,commit:data.commit,nodeEnv:data.nodeEnv};
 const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',windowsHide:true,timeout:15000,stdio:['pipe','pipe','pipe'],env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 const credential=raw.split(/\r?\n/).find(x=>x.startsWith('password='))?.slice(9);assert.ok(credential,'Existing Git credential unavailable');
 const headers={Authorization:'Bearer '+credential,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'};
 const r=await fetch('https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs?head_sha='+commit,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const runs=await r.json();
 receipt.runs=runs.workflow_runs.map(x=>({id:x.id,name:x.name,status:x.status,conclusion:x.conclusion,headSha:x.head_sha,url:x.html_url}));
 for(const run of receipt.runs){const response=await fetch(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/runs/${run.id}/jobs`,{headers,redirect:'error',signal:AbortSignal.timeout(20000)});if(response.ok)run.jobs=(await response.json()).jobs.map(j=>({id:j.id,name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}));}
 receipt.result=receipt.health.status===200&&receipt.health.ok&&receipt.health.commit===commit&&receipt.runs.some(r=>r.name==='Tests'&&r.headSha===commit&&r.status==='completed'&&r.conclusion==='success')?'PASS':'PENDING';
}catch(e){receipt.result='NOT_VERIFIED';receipt.errorCode=e.code||e.name}finally{const filename='release-'+receipt.at.replace(/[:.]/g,'-')+'.json';fs.writeFileSync(path.join(__dirname,filename),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({...receipt,file:filename}))}})();
