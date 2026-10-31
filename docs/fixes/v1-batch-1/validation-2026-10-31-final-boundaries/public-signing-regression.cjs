// Original public-secret attack, without cookies, real codes, provider requests
// or real campaign IDs. Four requests maximum; no quota resets or bypasses.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function declarations(text){const source=ts.createSourceFile('routes.ts',text,ts.ScriptTarget.Latest,true),found=new Map();function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))found.set(n.name.text,`const ${n.getText(source)};`);ts.forEachChild(n,visit)}visit(source);return found}
const baseline=declarations(execFileSync('git',['show','777aae6f:server/routes-oauth.ts'],{encoding:'utf8',windowsHide:true,maxBuffer:8*1024*1024}));
const current=declarations(fs.readFileSync('server/routes-oauth.ts','utf8'));
function pair(source,provider,configured){const vault={},processFixture={env:{NODE_ENV:'production',...(configured?{TOKEN_ENCRYPTION_KEY:'B1_SYNTHETIC_NON_PUBLIC_SIGNING_KEY'}:{})}};
 new Function('exports','require','process',compile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(vault,require,processFixture);
 const prefix=provider==='linkedin'?'LinkedIn':'Meta',names=[`${provider.toUpperCase()}_OAUTH_STATE_TTL_MS`,`sign${prefix}OAuthState`,`verify${prefix}OAuthState`];
 for(const n of names)assert.ok(source.has(n));const deps={...crypto,Buffer,process:processFixture,resolveOAuthStateSigningSecret:vault.resolveOAuthStateSigningSecret};
 return new Function(...Object.keys(deps),compile(names.map(n=>source.get(n)).join('\n'))+`\nreturn {sign:sign${prefix}OAuthState,verify:verify${prefix}OAuthState};`)(...Object.values(deps));
}
async function main(){const receipt={at:new Date().toISOString(),result:'NOT_VERIFIED',requests:0,checks:[],cookiesUsed:false,realAuthorizationCodesUsed:false,realCampaignIdsUsed:false,providerRequestsIntended:0};
 try{
  const mode=process.argv[2];assert.ok(['--local','--deployed','--deployed-meta-only'].includes(mode));
  const deployed=mode!=='--local';
  const health=deployed?await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(20000)}).then(r=>r.json()):null;
  if(health){assert.equal(health.ok,true);assert.equal(health.commit,'357e950fcf03d02c93465cd602eda119f08cf7f6');receipt.runtimeCommit=health.commit}
  for(const provider of mode==='--deployed-meta-only'?['meta']:['linkedin','meta']){
   const old=pair(baseline,provider,false),fixed=pair(current,provider,true),missing=pair(current,provider,false);
   const state=old.sign('b1-public-secret-test-no-campaign-'+crypto.randomUUID());
   const rejection=fixed.verify(state);
   assert.equal(old.verify(state).ok,true);assert.equal(rejection.ok,false);assert.ok(['Invalid state','Tampered state'].includes(rejection.error));assert.throws(()=>missing.verify(state),/not configured/);
   receipt.checks.push({provider,check:'original public-secret forgery accepted by baseline and rejected by current verifier; missing production key fails closed',passed:true});
   if(deployed)for(let attempt=1;attempt<=2;attempt++){
    assert.ok(receipt.requests<4);const r=await fetch(`https://marketforensics.onrender.com/api/auth/${provider}/callback?${new URLSearchParams({state,code:'B1_SYNTHETIC_NOT_A_PROVIDER_CODE'})}`,{redirect:'error',headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(20000)});receipt.requests++;
    const body=await r.text(),remaining=r.headers.get('ratelimit-remaining')??r.headers.get('x-ratelimit-remaining');
    const passed=r.status===200&&body.includes(`${provider}_auth_error`)&&body.includes(rejection.error)&&!body.includes(`${provider}_auth_success`);
    receipt.checks.push({provider,attempt,status:r.status,remaining:remaining===null?null:Number(remaining),passed});assert.ok(passed,'DEPLOYED_PUBLIC_SIGNATURE_NOT_REJECTED');
    if(remaining!==null&&Number(remaining)<3&&receipt.requests<4)throw Error('QUOTA_RESERVE_STOP');
   }
  }
  receipt.result=deployed?'PASS_DEPLOYED_PUBLIC_SECRET_REJECTION':'PASS_LOCAL_ATTACK_REPRODUCTION';
  receipt.limits='Exact public-fallback signing regression and repeated invalid-signature denial only. Does not claim real-provider authorization-code replay, single-use OAuth states, provider reconnect or whole-provider readiness.';
 }catch(e){receipt.code=e.message==='QUOTA_RESERVE_STOP'?e.message:'CHECK_FAILED';process.exitCode=1}
 fs.writeFileSync(path.join(__dirname,'public-signing-'+new Date().toISOString().replace(/[:.]/g,'-')+'.json'),JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));
}
main().catch(()=>{console.error('PUBLIC_SIGNING_CHECK_FAILED');process.exitCode=1});
