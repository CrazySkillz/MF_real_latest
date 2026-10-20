// Deployed GET-only smoke. No cookies, credentials, provider calls, or mutations.
const fs=require('node:fs');
(async()=>{
 const results=[];
 for(const path of ['/api/health','/api/metrics','/api/performance','/api/integrations','/api/clients','/api/campaigns','/privacy','/sign-in']) {
  const start=Date.now();
  const response=await fetch('https://marketforensics.onrender.com'+path,{signal:AbortSignal.timeout(30000),redirect:'follow'});
  const body=await response.text(); let parsed; try{parsed=JSON.parse(body)}catch{}
  results.push({path,status:response.status,elapsedMs:Date.now()-start,contentType:response.headers.get('content-type'),bytes:Buffer.byteLength(body),rowCount:Array.isArray(parsed)?parsed.length:undefined,keys:parsed&&!Array.isArray(parsed)?Object.keys(parsed):undefined,commit:path==='/api/health'?parsed?.commit:undefined,headers:Object.fromEntries(['content-security-policy','strict-transport-security','x-content-type-options','x-frame-options','cache-control'].map(h=>[h,response.headers.get(h)]))});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/public-smoke.json',JSON.stringify({at:new Date().toISOString(),base:'https://marketforensics.onrender.com',unauthenticated:true,results},null,2)+'\n');
 console.log(results.map(x=>({path:x.path,status:x.status,rowCount:x.rowCount,elapsedMs:x.elapsedMs})));
})().catch(e=>{console.error(e.message);process.exitCode=1});
