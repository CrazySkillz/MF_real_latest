// Anonymous UI only: existing-account navigation; no sign-up/sign-in submission.
const fs=require('node:fs'),assert=require('node:assert/strict'),{chromium}=require('playwright');
const expected=process.argv[2];assert.match(expected||'',/^[a-f0-9]{40}$/);
const result={at:new Date().toISOString(),expectedCommit:expected,boundary:'Anonymous deployed Clerk form navigation only; no customer account/session creation or form submission.'};let browser;
(async()=>{
 const r=await fetch('https://marketforensics.onrender.com/api/health',{signal:AbortSignal.timeout(20000)}),h=await r.json();assert.equal(h.commit,expected);assert.equal(h.ok,true);
 browser=await chromium.launch({headless:true});const context=await browser.newContext(),page=await context.newPage();result.appWritesBlocked=0;
 await page.route('https://marketforensics.onrender.com/api/**',route=>{if(!['GET','HEAD','OPTIONS'].includes(route.request().method())){result.appWritesBlocked++;return route.abort();}return route.continue();});
 await page.goto('https://marketforensics.onrender.com/sign-up',{waitUntil:'domcontentloaded',timeout:60000});
 const link=page.getByRole('link',{name:'Sign in',exact:true});await link.waitFor({state:'visible',timeout:60000});
 const target=await link.getAttribute('href');assert.equal(new URL(target,page.url()).pathname,'/sign-in');result.signInLinkPath='/sign-in';
 await link.click();await page.waitForURL(u=>u.pathname==='/sign-in',{timeout:30000});
 await page.getByRole('link',{name:'Sign up',exact:true}).waitFor({state:'visible',timeout:30000});result.finalPath=new URL(page.url()).pathname;result.result='PASS';
 await page.screenshot({path:'docs/fixes/v1-batch-2/deployed-sign-in.png',fullPage:true});
})().catch(e=>{result.result='FAIL';result.error={code:e.code||e.name,message:String(e.message).slice(0,300)};process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();fs.writeFileSync('docs/fixes/v1-batch-2/deployed-public-ui.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));});
