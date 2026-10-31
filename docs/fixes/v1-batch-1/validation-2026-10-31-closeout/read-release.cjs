// Read-only GitHub commit checks and anonymous Render health. No user browser,
// provider traffic, session extraction, deployment command or credential output.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{execFileSync}=require('node:child_process');
(async()=>{
 const expected=process.argv[2];assert.match(expected,/^[a-f0-9]{40}$/);
 const raw=execFileSync('git',['credential','fill'],{input:'protocol=https\nhost=github.com\n\n',encoding:'utf8',stdio:['pipe','pipe','pipe'],windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0',GCM_INTERACTIVE:'never'}});
 const credential=raw.split(/\r?\n/).find(x=>x.startsWith('password='))?.slice(9);assert.ok(credential);
 const get=async(url,authenticated=false)=>{
  const r=await fetch(url,{headers:authenticated?{Authorization:`Bearer ${credential}`,Accept:'application/vnd.github+json','User-Agent':'MF-Batch1-release-read-only'}:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(25000)});assert.equal(r.status,200);return r.json();
 };
 const[health,checks]=await Promise.all([get('https://marketforensics.onrender.com/api/health'),get(`https://api.github.com/repos/CrazySkillz/MF_real_latest/commits/${expected}/check-runs`,true)]);
 const result={at:new Date().toISOString(),expected,deployed:health.commit,healthy:health.ok===true,checks:checks.check_runs.map(c=>({name:c.name,status:c.status,conclusion:c.conclusion,url:c.details_url}))};
 const jobId=result.checks.find(c=>c.name==='unit-tests')?.url?.match(/\/job\/(\d+)$/)?.[1];
 if(jobId){const job=await get(`https://api.github.com/repos/CrazySkillz/MF_real_latest/actions/jobs/${jobId}`,true);result.steps=job.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}));}
 result.complete=result.deployed===expected&&result.healthy&&result.checks.some(c=>c.name==='unit-tests'&&c.conclusion==='success');
 fs.writeFileSync(path.join(__dirname,'release-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(()=>{console.error('READ_ONLY_RELEASE_CHECK_FAILED');process.exitCode=1});
