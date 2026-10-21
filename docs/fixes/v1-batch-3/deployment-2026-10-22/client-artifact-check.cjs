// Public asset smoke check; not authenticated rendered-UI validation.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{const origin='https://marketforensics.onrender.com';
 const r=await fetch(origin+'/',{signal:AbortSignal.timeout(20000)});assert.equal(r.status,200);const html=await r.text();
 const scripts=[...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"[^>]*>/g)].map(m=>new URL(m[1],origin)).filter(u=>u.origin===origin&&u.pathname.startsWith('/assets/')&&u.pathname.endsWith('.js'));
 assert.ok(scripts.length>0);const assets=[],seen=new Set();
 for(let i=0;i<scripts.length;i++){const url=scripts[i];if(seen.has(url.href))continue;seen.add(url.href);assert.ok(seen.size<=6);
  const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);const code=await response.text();assets.push({path:url.pathname,sha256:crypto.createHash('sha256').update(code).digest('hex'),bytes:Buffer.byteLength(code),precisionFormatterPresent:/maximumSignificantDigits\s*:\s*21/.test(code)});
  for(const m of code.matchAll(/["']((?:\.\/|\/assets\/|assets\/)[^"'\s]*(?:metric-math|ga4-metrics)[^"'\s]*\.js)["']/g)){
   const next=new URL(m[1],m[1].startsWith('assets/')?origin+'/':url);assert.equal(next.origin,origin);assert.ok(next.pathname.startsWith('/assets/'));if(!seen.has(next.href))scripts.push(next);
  }
 }
 assert.ok(assets.some(a=>a.precisionFormatterPresent));const result={at:new Date().toISOString(),result:'PASS',assets,boundary:'Deployed entry, GA4 page and observed shared chunk references checked; fractional formatter is present. No owner session or rendered Ptomo UI is available.',initialCheckCorrection:'Entry-only scan omitted the lazy shared chunk. Followed observed GA4/metric-math references; no application change.'};
 fs.writeFileSync(__dirname+'/client-artifact-check.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
})().catch(e=>{console.error(e.name+': public client artifact check failed');process.exitCode=1;});
