// Isolated browser: actual App identity boundary, toast store and Toaster; synthetic Clerk identities.
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const assert = require('node:assert/strict'), ts = require('typescript'), esbuild = require('esbuild');
const { chromium } = require('playwright');
const source = ts.createSourceFile('App.tsx', fs.readFileSync('client/src/App.tsx','utf8'), ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const app = source.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'App').getText(source);
const toastSource = fs.readFileSync('client/src/hooks/use-toast.ts','utf8');
const hasScope = toastSource.includes('setToastScope');
const harness = `
import React,{useEffect,useLayoutEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClientProvider} from '@tanstack/react-query';
import {createAppQueryClient} from './client/src/lib/queryClient';
import {useToast${hasScope ? ',setToastScope' : ''}} from './client/src/hooks/use-toast';
import {Toaster} from './client/src/components/ui/toaster';
import {useAuth,AuthProvider} from '@clerk/clerk-react';
const ErrorBoundary=({children})=>children,TooltipProvider=ErrorBoundary,ClerkLoaded=ErrorBoundary;
const ClerkLoading=()=>null,AuthPage=()=> <div>Signed out</div>,PrivacyPolicy=()=>null,Redirect=()=>null;
const SignedIn=({children})=>useAuth().userId?children:null,SignedOut=({children})=>useAuth().userId?null:children;
const Switch=ErrorBoundary,Route=({path,children})=>path?null:children;
window.savedToasts={};
function ProtectedRouter(){const {userId}=useAuth();const {toast}=useToast();
useEffect(()=>{window.activeToast=toast;window.savedToasts[userId] ||= toast;},[userId,toast]);
return <div id="actor">{userId}</div>}
${app}
function Fixture(){const[userId,setUser]=useState('owner-a');window.switchAccount=setUser;return <AuthProvider value={{userId}}><App/></AuthProvider>}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
const receipt = { at: new Date().toISOString(), checks: [], fixtureIdentities: true, personalBrowserAccess: false, externalRequestsBlocked: true };
let server, browser;
(async()=>{
 const bundle=await esbuild.build({stdin:{contents:harness,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'fixture-auth',setup(build){
  build.onResolve({filter:/^@clerk\/clerk-react$/},()=>({path:'auth',namespace:'fixture'}));
  build.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:'import {createContext,useContext} from "react";const C=createContext({userId:null});export const AuthProvider=C.Provider;export const useAuth=()=>useContext(C);',loader:'js',resolveDir:process.cwd()}));
 }}]});
 server=http.createServer((req,res)=>{res.setHeader('Content-Type',req.url==='/fixture.js'?'application/javascript':'text/html');res.end(req.url==='/fixture.js'?bundle.outputFiles[0].text:'<div id="root"></div><script src="/fixture.js"></script>')});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({headless:true}); const context=await browser.newContext();
 await context.route('**/*',r=>r.request().url().startsWith(origin+'/')?r.continue():r.abort());
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin);await page.waitForFunction(()=>window.activeToast);
 await page.evaluate(()=>window.activeToast({title:'Private report A',description:'Confidential campaign A'}));
 await page.getByText('Private report A',{exact:true}).waitFor();
 receipt.checks.push({name:'Current account toast renders',passed:true});
 await page.evaluate(()=>window.switchAccount('owner-b'));
 await page.waitForFunction(()=>document.querySelector('#actor')?.textContent==='owner-b');
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
 const oldVisible=await page.getByText('Private report A',{exact:true}).isVisible();
 receipt.checks.push({name:'Previous account toast absent after switch',passed:!oldVisible});
 assert.equal(oldVisible,false,'Previous account toast remained visible');
 await page.evaluate(()=>window.activeToast({title:'Current report B'}));
 await page.getByText('Current report B',{exact:true}).waitFor();
 await page.evaluate(()=>window.savedToasts['owner-a']({title:'Late confidential A'}));
 assert.equal(await page.getByText('Late confidential A',{exact:true}).isVisible(),false);
 assert.equal(await page.getByText('Current report B',{exact:true}).isVisible(),true);
 receipt.checks.push({name:'Late previous-account callback neither displays nor replaces current toast',passed:true});
 await page.evaluate(()=>window.switchAccount(null));
 await page.getByText('Signed out',{exact:true}).waitFor();
 assert.equal(await page.getByText('Current report B',{exact:true}).isVisible(),false);
 await page.evaluate(()=>window.savedToasts['owner-b']({title:'Late signed-out B'}));
 assert.equal(await page.getByText('Late signed-out B',{exact:true}).isVisible(),false);
 receipt.checks.push({name:'Sign-out clears visible toast and rejects late callback',passed:true});
 await page.evaluate(()=>window.switchAccount('owner-a'));
 await page.waitForFunction(()=>document.querySelector('#actor')?.textContent==='owner-a');
 await page.evaluate(()=>window.savedToasts['owner-a']({title:'Old session A'}));
 assert.equal(await page.getByText('Old session A',{exact:true}).isVisible(),false);
 await page.evaluate(()=>window.activeToast({title:'Fresh session A'}));
 await page.getByText('Fresh session A',{exact:true}).waitFor();
 receipt.checks.push({name:'Returning account accepts fresh callback but rejects old-session callback',passed:true});
 await page.evaluate(()=>{const t=window.activeToast({title:'Updatable current toast'});t.update({title:'Updated current toast'});window.dismissCurrent=t.dismiss});
 await page.getByText('Updated current toast',{exact:true}).waitFor();await page.evaluate(()=>window.dismissCurrent());
 await page.getByText('Updated current toast',{exact:true}).waitFor({state:'hidden'});
 receipt.checks.push({name:'Current account update and dismissal preserved',passed:true});
 assert.deepEqual(errors,[]);receipt.result='PASS';
})().catch(e=>{receipt.result='FAIL';receipt.error=e.message;process.exitCode=1}).finally(async()=>{
 if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
 const file=process.argv[2];if(file)fs.writeFileSync(path.resolve(file),JSON.stringify(receipt,null,2)+'\n');
 console.log(JSON.stringify(receipt));
});
