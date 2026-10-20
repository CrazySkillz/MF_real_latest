// User-requested safe browser test: signed-out surfaces only, no form submission.
const fs=require('node:fs');
const {chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();
  const blocked=[];const errors=[];const results=[];
  await context.route('**/*',async route=>{
   if(!['GET','HEAD','OPTIONS'].includes(route.request().method())) {blocked.push({method:route.request().method(),host:new URL(route.request().url()).hostname});await route.abort();}
   else await route.continue();
  });
  const page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  for(const path of ['/sign-in','/sign-up','/privacy','/campaigns']) {
   await page.goto('https://marketforensics.onrender.com'+path,{waitUntil:'domcontentloaded',timeout:60000});
   await page.locator('body').waitFor();
   await page.waitForTimeout(3000);
   results.push({path,finalUrl:page.url(),text:(await page.locator('body').innerText()).slice(0,6000),links:await page.locator('a').evaluateAll(as=>as.map(a=>({text:a.textContent,url:a.href}))),errors:[...errors]});
  }
  fs.writeFileSync('docs/audits/v1-2026-10-19/browser-smoke.json',JSON.stringify({at:new Date().toISOString(),boundary:'Fresh signed-out context. All non-read requests blocked. No authentication, campaign data, form submission, provider connection or email.',results,blocked},null,2)+'\n');
  console.log(results.map(r=>({path:r.path,finalUrl:r.finalUrl,text:r.text.slice(0,220),errors:r.errors})));
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
