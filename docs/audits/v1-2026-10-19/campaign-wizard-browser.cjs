// Local browser + current component bundle. Every request is intercepted; no server,
// external network, real login, provider, DB, seed, email or scheduler is used.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {chromium,expect}=require('@playwright/test');
const esbuild=require('esbuild');
const dir='docs/audits/v1-2026-10-19';
(async()=>{
 const bundle=await esbuild.build({entryPoints:[dir+'/campaign-wizard-fixture.tsx'],bundle:true,write:false,format:'iife',platform:'browser',jsx:'automatic',alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')},define:{'process.env.NODE_ENV':'"production"','import.meta.env.DEV':'false'},plugins:[{name:'fixture-clerk-user-button-only',setup(build){build.onResolve({filter:/^@clerk\/clerk-react$/},()=>({path:'clerk-fixture',namespace:'fixture'}));build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'export const UserButton=()=>null;',loader:'js'}));}}]});
 const js=bundle.outputFiles[0].text,css=fs.readFileSync('dist/public/assets/'+fs.readdirSync('dist/public/assets').find(x=>x.endsWith('.css')),'utf8');
 const browser=await chromium.launch({headless:true}); const results=[];
 const packet=()=>({at:new Date().toISOString(),head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Unchanged Campaigns page and imported controls, real React/query/form/browser execution. UserButton stub, all API replies and storage in memory. Every network request intercepted. No server/provider/database or authenticated end-to-end claim.',bundleSHA256:crypto.createHash('sha256').update(js).digest('hex'),results});
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
    const row={...body,id:'fixture-draft-'+(++serial),createdAt:'2026-10-19T12:00:00Z'};rows.set(row.id,row);
    if(options.delayCreate)await new Promise(resolve=>setTimeout(resolve,options.delayCreate));
    if(options.loseFirstCreate&&serial===1)return route.abort('failed');
    return reply(row);
   }
   const draft=u.pathname.match(/^\/api\/campaigns\/(fixture-draft-\d+)$/);
   if(draft&&method==='PATCH'){Object.assign(rows.get(draft[1]),body);return reply(rows.get(draft[1]));}
   if(draft&&method==='DELETE'){rows.delete(draft[1]);return reply({success:true});}
   if(u.pathname.endsWith('/ga4-service-account/status'))return reply({enabled:true,email:'fixture-service@example.invalid'});
   if(u.pathname.endsWith('/ga4-service-account/connect'))return reply({success:true});
   if(u.pathname.endsWith('/ga4-connection-status'))return reply({connected:true,properties:[{id:'123456789',name:'Fixture GA4 Property',account:'Fixture Account'}]});
   if(u.pathname.endsWith('/ga4-property'))return reply({success:true});
   if(u.pathname.endsWith('/ga4-campaign-values'))return reply({campaigns:[{name:'fixture_utm',users:10}]});
   unknown.push({url:u.href,method});return route.abort();
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  const dialog=page.locator('[data-create-campaign-dialog]');
  const heading=text=>expect(dialog.getByRole('heading',{name:text,exact:true})).toBeVisible();
  async function begin(){await page.goto('https://audit.invalid/campaigns');await expect(page.getByRole('heading',{name:'All Campaigns'})).toBeVisible();await expect(page.getByText('Audit Fixture Client',{exact:true})).toBeVisible();await page.getByRole('button',{name:'New Campaign',exact:true}).click();await heading('Create New Campaign');await page.getByLabel('Campaign Name *',{exact:true}).fill('Original Name');}
  try{await begin();const evidence=await run({page,dialog,heading,calls,rows});assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);results.push({name,passed:true,evidence,calls,remainingRows:[...rows.values()],pageErrors:errors,unhandledRequests:unknown});}
  catch(error){results.push({name,passed:false,error:error.message,body:await page.locator('body').innerText(),calls,pageErrors:errors,unhandledRequests:unknown});fs.writeFileSync(dir+'/campaign-wizard-browser-reproductions.json',JSON.stringify(packet(),null,2)+'\n');throw error;}
  finally{await context.close();}
 }
 try{
  await scenario('Back edits show the new name in confirmation but send only budget and currency',async({page,dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');
   const platformText=await dialog.innerText();assert.match(platformText,/Google Analytics/);assert.doesNotMatch(platformText,/LinkedIn|TikTok|Instagram|Meta Ads/);
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Create New Campaign');
   await page.getByLabel('Campaign Name *',{exact:true}).fill('Changed Name');await page.getByLabel('Label (optional)',{exact:true}).fill('changed-label');await page.getByLabel("Client's Website (optional)",{exact:true}).fill('https://fixture.example.invalid');
   await page.getByTestId('select-create-reporting-time-zone').click();await page.getByRole('option',{name:'Europe/Amsterdam',exact:true}).click();
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');
   const patch=calls.find(c=>c.method==='PATCH');assert.deepEqual(Object.keys(patch.body).sort(),['budget','currency']);assert.equal([...rows.values()][0].name,'Original Name');assert.equal([...rows.values()][0].reportingTimeZone,'UTC');
   await dialog.getByRole('button',{name:'Google Analytics',exact:true}).click();await heading('Connect Google Analytics');
   await dialog.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();await page.getByLabel('GA4 Property ID',{exact:true}).fill('123456789');await dialog.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();await heading('Configure Google Analytics');
   await dialog.getByRole('button',{name:'Connect Property',exact:true}).click();await expect(dialog.getByText('fixture_utm',{exact:true})).toBeVisible();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'Save & Continue',exact:true}).click();await heading('Confirm & Create');
   await expect(dialog.getByText('Changed Name',{exact:true})).toBeVisible();await page.screenshot({path:dir+'/wizard-confirmation-fixture.png'});
   const confirm=await dialog.innerText();await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.getByText('fixture_utm',{exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await expect(dialog.getByRole('button',{name:'Connect Property',exact:true})).toBeVisible();
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Connect Google Analytics');
   await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Select Platform');const ready=await dialog.innerText();assert.match(ready,/Ready/);assert.doesNotMatch(ready,/Connected/);
   return{confirmation:confirm,platformReadyText:ready,patch,persistedFixtureName:[...rows.values()][0].name,positive:'Only GA4 selectable; immediate Back sequence and Ready label observed.'};
  });
  await scenario('Details Cancel after Back leaves the already-created draft without DELETE',async({dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');await dialog.getByRole('button',{name:'Back',exact:true}).click();await heading('Create New Campaign');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await expect(dialog).toHaveCount(0);assert.equal(calls.filter(c=>c.method==='DELETE').length,0);assert.equal(rows.size,1);return{deleteRequests:0,remainingDrafts:1};
  });
  await scenario('Positive control: dialog Close on Platform requests draftCleanup and removes draft',async({dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect.poll(()=>calls.filter(c=>c.method==='DELETE').length).toBe(1);assert.equal(rows.size,0);assert.match(calls.find(c=>c.method==='DELETE').path,/draftCleanup=1/);return{deleteRequests:1,remainingDrafts:0};
  });
  await scenario('Two Next clicks while creation is pending submit two drafts; Close cleans only one',async({dialog,heading,calls,rows})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).dblclick({delay:35});await heading('Select Platform');await expect.poll(()=>calls.filter(c=>c.method==='POST'&&c.path==='/api/campaigns').length).toBe(2);await expect.poll(()=>rows.size).toBe(2);
   await dialog.getByRole('button',{name:'Close',exact:true}).click();await expect.poll(()=>calls.filter(c=>c.method==='DELETE').length).toBe(1);assert.equal(rows.size,1);return{createRequests:2,deleteRequests:1,remainingDrafts:1};
  },{delayCreate:400});
  await scenario('Lost create response leaves draft; retry issues a new POST without recovery identity',async({dialog,heading,calls,rows,page})=>{
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await expect(page.getByText('Failed to fetch',{exact:true})).toBeVisible();await heading('Create New Campaign');
   await dialog.getByRole('button',{name:'Next',exact:true}).click();await heading('Select Platform');assert.equal(calls.filter(c=>c.method==='POST'&&c.path==='/api/campaigns').length,2);assert.equal(rows.size,2);return{createRequests:2,remainingDrafts:2};
  },{loseFirstCreate:true});
  fs.writeFileSync(dir+'/campaign-wizard-browser-reproductions.json',JSON.stringify(packet(),null,2)+'\n');console.log(JSON.stringify({cases:results.length,allAssertionsPassed:true}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e.stack);process.exitCode=1});
