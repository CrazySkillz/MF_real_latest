// Bounded anonymous callbacks with synthetic invalid input only. No cookies, credentials,
// valid authorization codes, real shop domain, authorization start, or database access.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const origin='https://marketforensics.onrender.com';
const receipt={at:new Date().toISOString(),result:'NOT_VERIFIED',cookiesUsed:false,realAuthorizationCodesUsed:false,requests:[]};
const routes=[['ga4','google-sheets','ga4:batch1-invalid-state'],['sheets','google-sheets','batch1-invalid-state'],['legacy-ga4','google','batch1-invalid-state'],['hubspot','hubspot','batch1-invalid-state'],['salesforce','salesforce','batch1-invalid-state'],['shopify','shopify','batch1-invalid-state'],['linkedin','linkedin','batch1-invalid-state'],['meta','meta','batch1-invalid-state'],['google-ads','google-ads','batch1-invalid-state']];
const remainingAds=process.argv.includes('--remaining-google-ads');
receipt.scope=remainingAds?'Only the two unfinished Google Ads invalid-state cases':'Bounded anonymous callback denial inventory';
const limited=new Set(['google','linkedin','meta','google-ads']);
let limitedRequests=0;
(async()=>{try{
 for(const [label,route,state] of routes.filter(row=>!remainingAds||row[0]==='google-ads')){
  for(const phase of remainingAds?['invalid','repeat-invalid']:limited.has(route)?['missing','invalid']:['missing','invalid','repeat-invalid']){
   if(limited.has(route))assert.ok(++limitedRequests<=8,'Reserve capacity below the shared ten-request window');
   const q=new URLSearchParams(phase==='missing'?{}:{code:'B1_INVALID_NO_PROVIDER_AUTHORIZATION',state,...(route==='shopify'?{shop:'batch1-nonexistent-fixture.myshopify.com',hmac:'invalid'}:{})});
   const response=await fetch(`${origin}/api/auth/${route}/callback?${q}`,{redirect:'error',signal:AbortSignal.timeout(20000)});
   const remaining=response.headers.get('ratelimit-remaining');
   const text=await response.text();
   const authDenied=[400,401,403,404].includes(response.status);
   const popupDenied=response.status===200&&/Authentication (Error|Failed)|Invalid or expired state|invalid or expired/i.test(text)&&!/_auth_success/.test(text);
   const passed=authDenied||popupDenied;
   receipt.requests.push({provider:label,phase,status:response.status,authDenied,popupDenied,passed,remaining,responseSha256:crypto.createHash('sha256').update(text).digest('hex')});
   assert.ok(passed,`${label} ${phase} unexpected result`);
   if(remaining!==null&&Number(remaining)<2)throw Error('STOP_LOW_OAUTH_QUOTA; do not retry before the window resets');
  }
 }
 receipt.result='PASS';
 receipt.limits='Anonymous missing/invalid/repeated-invalid callback denials only. Not valid signed-state replay prevention, authenticated foreign callback acceptance, real provider token renewal, reconnect, or resource-grant revocation.';
}catch(e){receipt.error=String(e.message);process.exitCode=1}finally{
 fs.writeFileSync(path.join(__dirname,'public-oauth-denials-'+receipt.at.replace(/[:.]/g,'-')+'.json'),JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
 console.log(JSON.stringify({result:receipt.result,checks:receipt.requests.length,passed:receipt.requests.filter(r=>r.passed).length,error:receipt.error}));
}})();
