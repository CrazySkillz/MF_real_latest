// Script-safety checks only: fake HTTP responses; no network/database access.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.join(__dirname,'public-oauth-denials.cjs'),'utf8');
async function check(mode){let calls=0,saved;const urls=[];
 const context={__dirname,process:{exitCode:0,argv:mode==='remaining-ads'?['node','script','--remaining-google-ads']:[]},console:{log(){}},URLSearchParams,AbortSignal,
  require:n=>n==='node:fs'?{writeFileSync:(_f,data)=>{saved=JSON.parse(data)}}:require(n),
  fetch:async url=>{calls++;urls.push(url);return {status:mode==='rate-limit'?429:200,headers:{get:()=>mode==='low-quota'?'1':null},text:async()=>'<h2>Authentication Error</h2>'}}};
 await vm.runInNewContext(source,context);assert.ok(saved);
 if(mode==='normal'){assert.equal(calls,23);assert.equal(saved.result,'PASS');assert.equal(urls.filter(u=>/auth\/(google|linkedin|meta|google-ads)\/callback/.test(u)).length,8)}
 else if(mode==='remaining-ads'){assert.equal(calls,2);assert.equal(saved.result,'PASS');assert.ok(urls.every(u=>u.includes('/auth/google-ads/callback?code=')))}
 else{assert.equal(calls,1);assert.equal(saved.result,'NOT_VERIFIED');assert.equal(context.process.exitCode,1)}
 return {case:mode,passed:true,syntheticRequests:calls};
}
(async()=>{const checks=[];for(const mode of ['normal','low-quota','rate-limit','remaining-ads'])checks.push(await check(mode));const result={at:new Date().toISOString(),result:'PASS',networkCalls:0,checks};fs.writeFileSync(path.join(__dirname,'callback-budget.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result))})().catch(e=>{console.error(e);process.exitCode=1});
