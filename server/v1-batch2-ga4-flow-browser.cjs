const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const esbuild=require('esbuild'),{chromium,expect}=require('@playwright/test');
const dir='docs/fixes/v1-batch-2',results=[];
(async()=>{
 const code=`import React from 'react';import{createRoot}from'react-dom/client';import{QueryClientProvider}from'@tanstack/react-query';import{createAppQueryClient}from'./client/src/lib/queryClient';import{GA4ConnectionFlow}from'./client/src/components/GA4ConnectionFlow';import{Toaster}from'./client/src/components/ui/toaster';createRoot(document.getElementById('root')).render(<QueryClientProvider client={createAppQueryClient()}><GA4ConnectionFlow campaignId="campaign"/><Toaster/></QueryClientProvider>);`;
 const bundle=await esbuild.build({stdin:{contents:code,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,jsx:'automatic',alias:{'@':path.resolve('client/src')},define:{'process.env.NODE_ENV':'"production"'}});
 const browser=await chromium.launch({headless:true});
 async function scenario(name,run,options={}){
  const context=await browser.newContext({serviceWorkers:'block'}),calls=[],errors=[],unknown=[];let deletes=0;
  await context.route('**/*',async route=>{
   const r=route.request(),u=new URL(r.url()),body=r.postData()?JSON.parse(r.postData()):undefined;
   const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
   if(u.origin!=='https://fixture.invalid'){unknown.push(u.href);return route.abort();}
   if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script src="/fixture.js"></script>'});
   if(u.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:bundle.outputFiles[0].text});
   calls.push({path:u.pathname,method:r.method(),body});
   if(u.pathname==='/api/campaigns/campaign'&&r.method()==='GET')return reply({ga4CampaignFilter:null});
   if(u.pathname.endsWith('ga4-connection-status'))return reply({connected:true,pending:true,pendingConnectionId:'pending',propertyId:'',properties:[{id:'123',name:'Fixture property'}]});
   if(u.pathname.endsWith('/ga4-oauth-pending/pending'))return reply({success:++deletes>1},deletes===1&&options.failCancel?503:200);
   if(u.pathname==='/api/ga4/select-property')return reply({success:true});
   if(u.pathname.endsWith('ga4-campaign-values'))return options.quota?reply({success:false,error:'quota'},429):reply({success:true,campaigns:[{name:'discovered',users:2}]});
   if(u.pathname==='/api/campaigns/campaign'&&r.method()==='PATCH')return reply(body);
   unknown.push(u.pathname);return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  try{await page.goto('https://fixture.invalid/');await expect(page.getByRole('button',{name:'Connect Property',exact:true})).toBeVisible();await run({page,calls});assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);results.push({name,result:'PASS',calls});}
  catch(error){results.push({name,result:'FAIL',error:error.message,errors,unknown,body:await page.locator('body').innerText()});throw error;}
  finally{await context.close();}
 }
 try{
  await scenario('Failed cancellation retains selection; retry deletes the exact pending authorization',async({page,calls})=>{
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByText('Cancellation failed',{exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Connect Property',exact:true})).toBeVisible();
   await page.getByRole('button',{name:'Cancel',exact:true}).click();await expect(page.getByRole('button',{name:'Connect with Google',exact:true})).toBeVisible();assert.equal(calls.filter(c=>c.method==='DELETE').length,2);
  },{failCancel:true});
  await scenario('Confirmed property passes its pending ID and supports manual names beside discovery',async({page,calls})=>{
   await page.getByRole('button',{name:'Connect Property',exact:true}).click();await expect(page.getByText('discovered',{exact:true})).toBeVisible();
   await page.getByPlaceholder('e.g., brand_awareness').fill('fresh_manual');await page.getByRole('button',{name:'Add',exact:true}).click();await page.getByRole('button',{name:'Import metrics',exact:true}).click();
   await expect.poll(()=>calls.some(c=>c.method==='PATCH')).toBe(true);assert.equal(calls.find(c=>c.path==='/api/ga4/select-property').body.pendingConnectionId,'pending');assert.equal(calls.find(c=>c.method==='PATCH').body.ga4CampaignFilter,'fresh_manual');
  });
  await scenario('Quota failure is visible and does not claim no campaigns; explicit manual entry remains usable',async({page,calls})=>{
   await page.getByRole('button',{name:'Connect Property',exact:true}).click();await expect(page.getByRole('alert').filter({hasText:'Google Analytics could not load'})).toBeVisible();assert.doesNotMatch(await page.locator('body').innerText(),/No UTM campaigns found/);
   await page.getByPlaceholder('e.g., brand_awareness').fill('known_exact');await page.getByRole('button',{name:'Add',exact:true}).click();await page.getByRole('button',{name:'Import metrics',exact:true}).click();await expect.poll(()=>calls.some(c=>c.method==='PATCH')).toBe(true);
  },{quota:true});
 }finally{await browser.close();fs.writeFileSync(dir+'/ga4-flow-browser-results.json',JSON.stringify({at:new Date().toISOString(),boundary:'Actual GA4ConnectionFlow and controls; intercepted fixture API, no provider or production access',results},null,2)+'\n');}
 console.log(JSON.stringify({cases:results.length,passed:true}));
})().catch(e=>{console.error(e);process.exitCode=1});
