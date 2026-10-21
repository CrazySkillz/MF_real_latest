// Local browser + current component bundle. Every request is intercepted; no server,
// external network, real login, provider, DB, seed, email or scheduler is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');
const esbuild=require('esbuild');
const dir='docs/fixes/v1-batch-2';
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:fs.readFileSync('docs/audits/v1-2026-10-19/campaign-wizard-fixture.tsx','utf8').replace("import { queryClient }","import { createAppQueryClient }").replace("createRoot(document","const queryClient=createAppQueryClient();\ncreateRoot(document"),loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')},define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false'},plugins:[{name:'fixture-clerk-user-button-only',setup(build){build.onResolve({filter:/^@clerk\/clerk-react$/},()=>({path:'clerk-fixture',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const UserButton=()=>null; export const useAuth=()=>({userId:"fixture-owner"});',loader:'js'}));}}]});
 const js=bundle.outputFiles[0].text,css=fs.readFileSync('dist/public/assets/'+fs.readdirSync('dist/public/assets').find(x=>x.endsWith('.css')),'utf8');
 const browser=await chromium.launch({headless:true}); const results=[];
 const packet=()=>({at:new Date().toISOString(),base:'afce1ced',boundary:'Current Batch 2 Campaigns page and imported controls, real React/query/form/browser execution. UserButton stub, all API replies and storage in memory. Every network request intercepted. No server/provider/database or authenticated end-to-end claim.',bundleSHA256:crypto.createHash('sha256').update(js).digest('hex'),results});
 async function scenario(name,run,options={}){
  const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC',serviceWorkers:'block'});
  const calls=[],unknown=[],errors=[],rows=new Map(); let serial=0;
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url()),method=request.method();
   const reply=data=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(data)});
   if(u.origin!=='https://audit.invalid'){unknown.push({url:u.href,method});return route.abort();}
   if(u.pathname==='/campaigns')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><head><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'});
   if(u.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
   if(u.pathname==='/fixture.css')return route.fulfill({contentType:'text/css',body:css});
   if(u.pathname==='/logo_fff8f3_bg_orange_fill.jpg')return route.fulfill({contentType:'image/jpeg',body:fs.readFileSync('client/public/logo_fff8f3_bg_orange_fill.jpg')});
   if(u.pathname==='/favicon.ico')return route.fulfill({status:204,body:''});
   const body=request.postData()?JSON.parse(request.postData()):null; calls.push({method,path:u.pathname+u.search,body});
   if(method==='GET'&&u.pathname==='/api/clients')return reply([{id:'fixture-client',name:'Audit Fixture Client',ownerId:'fixture-owner'}]);
   if(method==='GET'&&u.pathname==='/api/notifications')return reply([]);
   if(method==='GET'&&u.pathname==='/api/campaigns')return reply([]);
   if(method==='POST'&&u.pathname==='/api/campaigns'){
    serial++; const row=rows.get(body.creationRequestId)||{...body,...(options.recoveredStatus?{status:options.recoveredStatus,name:'Previously created'}:{}),id:body.creationRequestId,createdAt:'2026-10-19T12:00:00Z'};rows.set(row.id,row);
    if(options.delayCreate)await new Promise(resolve=>setTimeout(resolve,options.delayCreate));
    if(options.loseFirstCreate&&serial===1)return route.abort('failed');
    return reply(row);
   }
   const draft=u.pathname.match(/^\/api\/campaigns\/([a-f0-9-]+)$/);
   if(draft&&method==='PATCH'){Object.assign(rows.get(draft[1]),body);return reply(rows.get(draft[1]));}
   if(draft&&method==='DELETE'){if(options.failDelete && calls.filter(c=>c.method==='DELETE').length===1)return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'Fixture cleanup unavailable'})});rows.delete(draft[1]);return reply({success:true});}
   if(method==='POST'&&u.pathname==='/api/auth/ga4/connect')return reply({authUrl:'https://audit.invalid/popup'});
   if(u.pathname==='/popup')return route.fulfill({contentType:'text/html',body:'<html><body>Fixture authorization</body></html>'});
   if(u.pathname.endsWith('/ga4-service-account/status'))return reply({enabled:true,email:'fixture-service@example.invalid'});
   if(u.pathname.endsWith('/ga4-service-account/connect'))return reply({success:true});
   if(u.pathname.endsWith('/ga4-connection-status'))return reply({connected:true,pendingConnectionId:'fixture-pending',properties:[{id:'123456789',name:'Fixture GA4 Property',account:'Fixture Account'}]});
   if(u.pathname.endsWith('/ga4-property'))return reply({success:true});
   if(u.pathname.endsWith('/ga4-campaign-values'))return reply({success:true,campaigns:[{name:'fixture_utm',users:10}]});
   unknown.push({url:u.href,method});return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const dialog=page.locator('[data-create-campaign-dialog]');
  const heading=text=>expect(dialog.getByRole('heading',{name:text,exact:true})).toBeVisible();
  async function begin(){await page.goto('https://audit.invalid/campaigns');await expect(page.getByRole('heading',{name:'All Campaigns'})).toBeVisible();await expect(page.getByText('Audit Fixture Client',{exact:true})).toBeVisible();await page.getByRole('button',{name:'New Campaign',exact:true}).click();await heading('Create New Campaign');await page.getByLabel('Campaign Name *',{exact:true}).fill('Original Name');}
  try{await begin();const evidence=await run({page,dialog,heading,calls,rows});assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);results.push({name,passed:true,evidence,calls,remainingRows:[...rows.values()],pageErrors:errors,unhandledRequests:unknown});}
  catch(error){results.push({name,passed:false,error:error.message,body:await page.locator('body').innerText(),calls,pageErrors:errors,unhandledRequests:unknown});fs.writeFileSync(dir+'/wizard-browser-results.json',JSON.stringify(packet(),null,2)+'\n');throw error;}
  finally{await context.close();}
 }
 try{
  await scenario('All Details edits persist after Back; GA4 setup retains immediate Back sequence',async({page,dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click(); await heading('Select Platform');
   const platformText=await dialog.innerText(); assert.doesNotMatch(platformText,/LinkedIn|TikTok|Instagram|Meta Ads/);
   await dialog.getByRole('button',{name:'Back',exact:true}).click(); await heading('Create New Campaign');
   await page.getByLabel('Campaign Name *',{exact:true}).fill('Changed Name');
   await page.getByLabel('Label (optional)',{exact:true}).fill('changed-label');
   await page.getByLabel("Client's Website (optional)",{exact:true}).fill('https://fixture.example.invalid');
   await page.getByLabel('Budget (optional)',{exact:true}).fill('1234.50');await page.getByLabel('Currency',{exact:true}).click();await page.getByRole('option',{name:'EUR - Euro',exact:true}).click();
   await page.getByTestId('select-create-reporting-time-zone').click(); await page.getByRole('option',{name:'Europe/Amsterdam',exact:true}).click();
   await dialog.getByRole('button',{name:'Next',exact:true}).click(); await heading('Select Platform');
   assert.equal(rows.size,1); const saved=[...rows.values()][0]; assert.equal(saved.name,'Changed Name');assert.equal(saved.label,'changed-label');assert.equal(saved.clientWebsite,'https://fixture.example.invalid');assert.equal(saved.reportingTimeZone,'Europe/Amsterdam');assert.equal(saved.budget,'1234.50');assert.equal(saved.currency,'EUR');
   await dialog.getByRole('button',{name:'Google Analytics',exact:true}).click();await heading('Connect Google Analytics');
   await page.evaluate(id=>window.dispatchEvent(new MessageEvent('message',{origin:window.location.origin,data:{type:'ga4_auth_success',campaignId:id,pendingConnectionId:'fixture-pending'}})),saved.id);
   await heading('Configure Google Analytics');await dialog.getByRole('button',{name:'Connect Property',exact:true}).click();
   await expect(dialog.getByText('fixture_utm',{exact:true})).toBeVisible();await dialog.getByRole('checkbox').check();
   await dialog.getByRole('button',{name:'Save & Continue',exact:true}).click();await heading('Confirm & Create');await expect(dialog.getByText('Changed Name',{exact:true})).toBeVisible();
   await page.screenshot({path:dir+'/wizard-confirmation.png'});
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.getByText('fixture_utm',{exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.getByRole('button',{name:'Connect Property',exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Connect Google Analytics');
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Select Platform');assert.match(await dialog.innerText(),/Ready/);
   await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(rows.size,0);
   return {persistedDetails:saved,cleanup:true};
  });
  await scenario('Details Cancel after Back deletes the draft',async({dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Create New Campaign');
   await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(rows.size,0);assert.match(calls.find(c=>c.method==='DELETE').path,/draftCleanup=1/);return {remainingDrafts:0};
  });
  await scenario('Failed cleanup keeps the dialog and draft available for retry',async({dialog,heading,calls,rows,page})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');await dialog.getByRole('button',{name:'Close',exact:true}).click();
   await expect(page.getByText(/Your draft has been kept/)).toBeVisible();await heading('Select Platform');assert.equal(rows.size,1);
   await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(rows.size,0);return{deleteAttempts:2};
  },{failDelete:true});
  await scenario('Rapid Next clicks submit one draft; close while pending cannot discard its identity',async({page,dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).evaluate(el=>{el.click();el.click();});
   await expect.poll(()=>rows.size).toBe(1);await dialog.getByRole('button',{name:'Close',exact:true}).click();
   await heading('Select Platform');assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/campaigns').length,1);
   await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(rows.size,0);return{createRequests:1};
  },{delayCreate:700});
  await scenario('Lost response retry reuses the same request ID and persisted draft',async({dialog,heading,calls,rows,page})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Failed to fetch',{exact:true})).toBeVisible();await heading('Create New Campaign');
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');const posts=calls.filter(c=>c.method==='POST'&&c.path==='/api/campaigns');assert.equal(posts.length,2);assert.equal(posts[0].body.creationRequestId,posts[1].body.creationRequestId);assert.equal(rows.size,1);return{requests:2,drafts:1};
  },{loseFirstCreate:true});
  await scenario('Reload after a lost response retains the recovery identity',async({dialog,heading,calls,rows,page})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Failed to fetch',{exact:true})).toBeVisible();
   await page.reload();await page.getByRole('button',{name:'New Campaign',exact:true}).click();await page.getByLabel('Campaign Name *',{exact:true}).fill('Recovered after reload');
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');assert.equal(rows.size,1);assert.equal([...rows.values()][0].name,'Recovered after reload');return{drafts:1};
  },{loseFirstCreate:true});
  for(const status of ['active','paused'])await scenario(`Recovered ${status} campaign completes without overwriting its Details`,async({dialog,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(calls.filter(c=>c.method==='PATCH').length,0);assert.equal([...rows.values()][0].name,'Previously created');return{status,detailsPreserved:true};
  },{recoveredStatus:status});
  fs.writeFileSync(dir+'/wizard-browser-results.json',JSON.stringify(packet(),null,2)+'\n');console.log(JSON.stringify({cases:results.length,allAssertionsPassed:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
