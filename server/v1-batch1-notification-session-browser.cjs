// Local, isolated browser only. Real App cache boundary, Notifications, Navigation,
// Sidebar and ClientProvider; synthetic identity and API replies, no .env or providers.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), http = require('node:http');
const ts = require('typescript'), esbuild = require('esbuild');
const { chromium } = require('playwright');
const appText = fs.readFileSync('client/src/App.tsx', 'utf8');
const source = ts.createSourceFile('App.tsx', appText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const app = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'App').getText(source);
const harness = `
import React, {useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider,useQueryClient} from '@tanstack/react-query';
import {createAppQueryClient} from './client/src/lib/queryClient';
import {ClientProvider,useClient} from './client/src/lib/clientContext';
import Notifications from './client/src/pages/notifications';
import {useAuth,AuthProvider} from '@clerk/clerk-react';
const ErrorBoundary=({children})=>children, TooltipProvider=ErrorBoundary, ClerkLoaded=ErrorBoundary;
const Toaster=()=>null, ClerkLoading=()=>null, AuthPage=()=> <div>Signed out</div>, PrivacyPolicy=()=>null, Redirect=()=>null;
const SignedIn=({children})=>useAuth().userId?children:null, SignedOut=({children})=>useAuth().userId?null:children;
const Switch=ErrorBoundary, Route=({path,children})=>path?null:children;
window.caches={};window.requests=[];window.pending=[];window.violations=[];
function Probe(){
 const {userId}=useAuth(),client=useQueryClient(),ctx=useClient();
 useLayoutEffect(()=>{window.renderedOwner=userId;window.caches[userId]=client;window.selectClient=ctx.setSelectedClientId});
 return <output id='scope'>{JSON.stringify({userId,selected:ctx.selectedClientId,clients:ctx.clients.map(x=>x.id)})}</output>
}
function ProtectedRouter(){return <ClientProvider><Probe/><Notifications/></ClientProvider>}
${app}
window.fetch=(url,options={})=>new Promise((resolve,reject)=>{
 const owner=window.currentOwner, request={owner,url:String(url),aborted:false};window.requests.push(request);
 const campaign={id:owner+'-campaign',ownerId:owner,clientId:owner+'-1',name:owner+' campaign',platform:'custom'};
 let data;
 if(url==='/api/clients')data=[{id:owner+'-1',name:owner+' client'},{id:owner+'-2',name:owner+' other client'}];
 else if(url==='/api/campaigns')data=[campaign];
 else if(url==='/api/notifications')data=owner==='b'?[]:[{id:owner+'-alert',campaignId:campaign.id,campaignName:campaign.name,title:owner+' PRIVATE ALERT',message:owner+' message',type:'performance-alert',priority:'high',createdAt:'2026-10-31T10:00:00Z',metadata:JSON.stringify({kpiId:owner+'-kpi',currentValue:1,targetValue:2})}];
 else {reject(Error('Unexpected fixture request'));return;}
 const finish=()=>resolve(new Response(JSON.stringify(data),{status:200,headers:{'Content-Type':'application/json'}}));
 if(options.signal)options.signal.addEventListener('abort',()=>{request.aborted=true;},{once:true});
 if(window.holdNotifications&&url==='/api/notifications')window.pending.push(finish);else finish();
});
function Fixture(){
 const [userId,setUser]=useState(sessionStorage.getItem('fixture-actor')||'a');window.currentOwner=userId;
 window.switchAccount=id=>{sessionStorage.setItem('fixture-actor',id||'');setUser(id)};
 return <AuthProvider value={{userId}}><App/></AuthProvider>
}
new MutationObserver(()=>{
 const owner=window.renderedOwner;
 for(const card of document.querySelectorAll('[data-testid^="notification-"]')){
  const id=card.getAttribute('data-testid');if(id==='notification-breach-indicator')continue;
  if(owner&&!id.startsWith('notification-'+owner+'-'))window.violations.push({owner,id});
 }
}).observe(document.getElementById('root'),{subtree:true,childList:true,characterData:true});
localStorage.setItem('selectedClientId','unscoped-foreign-client');
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
async function main() {
  const receipt = {at:new Date().toISOString(),boundary:'Local Chromium with actual app components; synthetic Clerk identities and API data. No production requests or credentials.',checks:[],sourceSha256:{}};
  for(const file of ['client/src/App.tsx','client/src/pages/notifications.tsx','client/src/components/layout/navigation.tsx','client/src/components/layout/sidebar.tsx','client/src/lib/clientContext.tsx','client/src/lib/queryClient.ts']) receipt.sourceSha256[file]=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  const bundle=await esbuild.build({stdin:{contents:harness,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',jsx:'automatic',alias:{'@':path.resolve('client/src'),'@shared':path.resolve('shared')},define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-auth',setup(build){
    build.onResolve({filter:/^@clerk\/clerk-react$/},()=>({path:'auth',namespace:'fixture'}));
    build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import {createContext,useContext} from "react";const C=createContext({userId:null});export const AuthProvider=C.Provider;export const useAuth=()=>useContext(C);export const UserButton=()=>null;',loader:'js',resolveDir:process.cwd()}));
  }}]});
  const server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>')});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try {
    browser=await chromium.launch({headless:true});const context=await browser.newContext(),origin=`http://127.0.0.1:${server.address().port}`;
    await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
    const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
    const check=async(name,fn)=>{await fn();receipt.checks.push({name,result:'PASS'})};
    await page.goto(origin+'/notifications');
    await check('Owner A actual notification card and bell, actor-specific client selection',async()=>{
      await page.getByTestId('notification-a-alert').waitFor();assert.equal(await page.getByTestId('notification-breach-indicator').count(),1);
      await page.evaluate(()=>window.selectClient('a-2'));await page.waitForFunction(()=>document.querySelector('#scope')?.textContent.includes('a-2'));
    });
    await check('Switch to B clears A cards, attention indicator and filter state',async()=>{
      await page.getByTestId('select-priority-filter').click();await page.getByRole('option',{name:'High',exact:true}).click();
      await page.evaluate(()=>window.switchAccount('b'));await page.getByText('No active alerts found',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('notification-a-alert').count(),0);assert.equal(await page.getByTestId('notification-breach-indicator').count(),0);
      assert.equal(await page.getByTestId('select-priority-filter').textContent(),'All Priorities');
      assert.ok((await page.locator('#scope').textContent()).includes('b-1'));
    });
    await check('Owner A selection and notification return; stale prior cache cannot populate B',async()=>{
      await page.evaluate(()=>window.switchAccount('a'));await page.getByTestId('notification-a-alert').waitFor();
      assert.ok((await page.locator('#scope').textContent()).includes('a-2'));
      await page.evaluate(()=>{window.holdNotifications=true;void window.caches.a.refetchQueries({queryKey:['/api/notifications'],exact:true})});
      await page.waitForFunction(()=>window.pending.length>0);await page.evaluate(()=>{window.holdNotifications=false;window.switchAccount('b')});
      await page.getByText('No active alerts found',{exact:true}).waitFor();
      await page.evaluate(()=>{window.pending.splice(0).forEach(f=>f());window.caches.a.setQueryData(['/api/notifications'],[{id:'a-late',title:'a PRIVATE LATE'}])});
      await page.waitForTimeout(100);assert.equal(await page.getByTestId('notification-breach-indicator').count(),0);
      assert.equal(await page.getByTestId('notification-a-alert').count(),0);
      assert.ok(await page.evaluate(()=>window.requests.some(r=>r.owner==='a'&&r.url==='/api/notifications'&&r.aborted)));
    });
    await check('Sign-out hides notification data; return and reload restore only selected actor',async()=>{
      await page.evaluate(()=>window.switchAccount(null));await page.getByText('Signed out',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('notifications-active-alerts-list').count(),0);
      await page.evaluate(()=>window.switchAccount('a'));await page.getByTestId('notification-a-alert').waitFor();
      assert.deepEqual(await page.evaluate(()=>window.violations),[]);
      await page.reload();await page.getByTestId('notification-a-alert').waitFor();assert.ok((await page.locator('#scope').textContent()).includes('a-2'));
      await page.evaluate(()=>window.switchAccount('b'));await page.getByText('No active alerts found',{exact:true}).waitFor();await page.reload();await page.getByText('No active alerts found',{exact:true}).waitFor();
      assert.equal(await page.getByTestId('notification-breach-indicator').count(),0);
    });
    assert.deepEqual(errors,[]);assert.deepEqual(await page.evaluate(()=>window.violations),[]);receipt.result='PASS';
  } catch(error){receipt.result='FAIL';receipt.error=error.message;throw error}
  finally{await browser?.close();await new Promise(resolve=>server.close(resolve));if(process.argv.includes('--receipt'))fs.writeFileSync('docs/fixes/v1-batch-1/validation-2026-10-31-final/notification-session-browser.json',JSON.stringify(receipt,null,2)+'\n')}
  console.log(JSON.stringify({result:receipt.result,checks:receipt.checks.length}));
}
main().catch(e=>{console.error(e.message);process.exitCode=1});
