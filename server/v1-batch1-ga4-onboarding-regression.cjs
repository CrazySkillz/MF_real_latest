// Current creation JSX/component, OAuth handlers and access/state helpers. Synthetic
// Clerk identity, provider replies and storage only; no .env, database or live Google.
const fs = require('node:fs'), assert = require('node:assert/strict'), http = require('node:http');
const ts = require('typescript'), esbuild = require('esbuild'), { chromium } = require('playwright');
const crypto = require('node:crypto'), { z } = require('zod');
const results = [], requests = [], calls = [];
const source = ts.createSourceFile('routes.ts', fs.readFileSync('server/routes-oauth.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const routes = new Map(), names = new Map();
function visit(n) {
  if (ts.isVariableDeclaration(n)) names.set(n.name.getText(source), `const ${n.getText(source)};`);
  if (ts.isCallExpression(n) && /^app\.(get|post)$/.test(n.expression.getText(source)) && ts.isStringLiteral(n.arguments[0]))
    routes.set(n.arguments[0].text, n.arguments.at(-1).getText(source));
  ts.forEachChild(n, visit);
}
visit(source);
const compile = text => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const bind = (code, name, env) => new Function(...Object.keys(env), `${compile(code)}\nreturn ${name};`)(...Object.values(env));
const vault = ts.createSourceFile('vault.ts', fs.readFileSync('server/utils/tokenVault.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const signingHelper = vault.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === 'resolveOAuthStateSigningSecret').getText(vault).replace(/^export /, '');
const memory = new Map(), properties = new Map();
const campaigns = new Map(['a', 'b'].map(owner => [`draft-${owner}`, { id: `draft-${owner}`, ownerId: `owner-${owner}`, clientId: `client-${owner}`, status: 'draft' }]));
let providerFailure = false, missingRefresh = false;
const storage = {
  getCampaign: async id => campaigns.get(id),
  getGA4Connections: async id => [...memory.values()].filter(c => c.campaignId === id),
  createGA4Connection: async data => { calls.push({ method: 'create', campaignId: data.campaignId, authMethod: data.method }); const row = { id: `connection-${data.campaignId}`, ...data }; memory.set(row.id, row); return row; },
  assertServiceAccountResourceAccess: async () => { throw new Error('OAuth must not require a shared-account grant'); },
};
const env = {
  storage, z, ...crypto, Buffer, getAuth: req => ({ userId: req.actor }), isInternalAutoRefreshRequest: () => false,
  console: { log() {}, error() {}, warn() {} }, global: {},
  process: { env: { NODE_ENV: 'production', GOOGLE_CLIENT_ID: 'fixture-app-id', GOOGLE_CLIENT_SECRET: 'fixture-secret', GA4_OAUTH_STATE_SECRET: 'fixture-state-key', APP_BASE_URL: 'https://fixture.invalid' } },
  realGA4Client: { storeManualConnection() {} },
  fetch: async (url, options) => {
    assert.ok(url.startsWith('https://oauth2.googleapis.com/') || url.startsWith('https://analyticsadmin.googleapis.com/'));
    if (url.includes('/token')) return { ok: !providerFailure, text: async () => 'fixture denied', json: async () => ({ access_token: 'fixture-token', refresh_token: missingRefresh ? undefined : 'fixture-refresh', expires_in: 3600 }) };
    if (url.endsWith('/accounts')) return { ok: true, json: async () => ({ accounts: [{ name: 'accounts/fixture', displayName: 'Fixture account' }] }) };
    return { ok: true, json: async () => ({ properties: [{ name: 'properties/123456789', displayName: 'Owned fixture property' }] }) };
  },
};
env.resolveOAuthStateSigningSecret = bind(signingHelper, 'resolveOAuthStateSigningSecret', env);
for (const name of ['campaignIdSchema', 'getActorId', 'ensureCampaignAccess', 'GA4_OAUTH_STATE_TTL_MS', 'signGA4OAuthState', 'verifyGA4OAuthState', 'serializeOAuthPopupJson'])
  env[name] = bind(names.get(name), name, env);
const start = bind(`const handler=${routes.get('/api/auth/ga4/connect')};`, 'handler', env);
const callback = bind(`const handler=${routes.get('/api/auth/google-sheets/callback')};`, 'handler', env);
function response() { return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(value) { this.body = value; return this; }, send(value) { this.body = value; return this; } }; }
async function check(name, run) { await run(); results.push({ name, result: 'PASS' }); }
const pageSource = ts.createSourceFile('campaigns.tsx', fs.readFileSync('client/src/pages/campaigns.tsx', 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let creationJsx, loadProperties;
function findPage(n) {
  if (ts.isJsxSelfClosingElement(n) && n.tagName.getText(pageSource) === 'IntegratedGA4Auth') creationJsx = n.getText(pageSource);
  if (ts.isVariableDeclaration(n) && n.name.getText(pageSource) === 'loadWizardGA4Properties') loadProperties = `const ${n.getText(pageSource)};`;
  ts.forEachChild(n, findPage);
}
findPage(pageSource); assert.ok(creationJsx && loadProperties);
const harness = `
import React, {useState} from 'react'; import {createRoot} from 'react-dom/client';
import {IntegratedGA4Auth} from './client/src/components/IntegratedGA4Auth';
window.events=[]; window.popups=[]; window.blockPopup=false;
window.open=(url)=>{ if(window.blockPopup)return null; const popup={url,closed:false,close(){this.closed=true}}; window.popups.push(popup); return popup; };
function Fixture(){
 const params=new URLSearchParams(location.search), draftCampaignId=params.get('campaign')||'draft-a';
 const [mode,setMode]=useState(params.get('mode')); window.setMode=setMode;
 const [wizardStep,setWizardStep]=useState(3), [ga4Properties,setGA4Properties]=useState([]);
 const [selectedGA4Property,setSelectedGA4Property]=useState(''), [ga4ConfigSubStep,setGa4ConfigSubStep]=useState('');
 const [isGA4PropertyLoading,setIsGA4PropertyLoading]=useState(false);
 const [connectedPlatformsInDialog,setConnectedPlatformsInDialog]=useState([]);
 const [wizardPlatformConnected,setWizardPlatformConnected]=useState(false);
 const goToConfirmStep=()=>setWizardStep(5), toast=(event)=>window.events.push(event);
 ${loadProperties}
 return <><div id="probe">{JSON.stringify({wizardStep,ga4Properties,selectedGA4Property,ga4ConfigSubStep,isGA4PropertyLoading})}</div>
 {mode==='service-account'?<IntegratedGA4Auth campaignId={draftCampaignId} connectionMode="service-account" onSuccess={()=>window.events.push({success:true})} onError={error=>window.events.push({error})}/>:${creationJsx}}</>;
}
createRoot(document.getElementById('root')).render(<Fixture/>);
`;
let server, browser;
(async () => {
  for (const actor of ['owner-a', 'owner-b']) await check(`Owned OAuth initiation and fresh credential save for ${actor}, without shared grants`, async () => {
    const campaignId = `draft-${actor.at(-1)}`, res = response();
    await start({ actor, body: { campaignId } }, res); assert.equal(res.statusCode, 200);
    const url = new URL(res.body.authUrl); assert.equal(url.hostname, 'accounts.google.com');
    assert.equal(url.searchParams.get('scope'), 'https://www.googleapis.com/auth/analytics.readonly');
    assert.equal(url.searchParams.get('access_type'), 'offline');
    assert.equal(env.verifyGA4OAuthState(url.searchParams.get('state').slice(4)).campaignId, campaignId);
    const completed = response(); await callback({ actor, query: { state: url.searchParams.get('state'), code: 'fixture-code' } }, completed);
    assert.match(completed.body, /ga4_auth_success/);
    assert.equal(memory.get(`connection-${campaignId}`).method, 'access_token');
    assert.equal(memory.get(`connection-${campaignId}`).refreshToken, 'fixture-refresh');
    properties.set(campaignId, [{ id: '123456789', name: `Owned by ${actor}` }]);
  });
  for (const [actor, expected] of [[null, 401], ['owner-b', 404]]) await check(`OAuth initiation rejects ${actor || 'anonymous'} for draft-a`, async () => {
    const res=response(); await start({ actor, body: { campaignId: 'draft-a' } }, res); assert.equal(res.statusCode, expected); assert.equal(res.body.authUrl, undefined);
  });
  await check('Foreign callback cannot exchange or persist credentials', async () => {
    const before=calls.length, res=response(); await callback({ actor:'owner-b', query:{code:'fixture',state:'ga4:'+env.signGA4OAuthState('draft-a')} },res);
    assert.equal(calls.length,before); assert.doesNotMatch(res.body,/type:'ga4_auth_success'/);
  });
  for (const failure of ['token-denied', 'missing-refresh']) await check(`OAuth ${failure} preserves saved connections`, async () => {
    providerFailure=failure==='token-denied'; missingRefresh=failure==='missing-refresh';
    const before=JSON.stringify([...memory.values()]), res=response();
    await callback({actor:'owner-a',query:{code:'fixture',state:'ga4:'+env.signGA4OAuthState('draft-a')}},res);
    assert.match(res.body,/ga4_auth_error/); assert.equal(JSON.stringify([...memory.values()]),before);
    providerFailure=false; missingRefresh=false;
  });
  const bundle = await esbuild.build({stdin:{contents:harness,loader:'tsx',resolveDir:process.cwd()},bundle:true,write:false,platform:'browser',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  server=http.createServer(async (req,res)=>{
    try {
      const url=new URL(req.url,'http://fixture.invalid');
      if(url.pathname==='/fixture.js'){res.setHeader('Content-Type','application/javascript');return res.end(bundle.outputFiles[0].text);}
      if(!url.pathname.startsWith('/api/')){res.setHeader('Content-Type','text/html');return res.end('<div id="root"></div><script src="/fixture.js"></script>');}
      requests.push({path:url.pathname,method:req.method}); let body=''; for await(const chunk of req)body+=chunk;
      const reply=response(), actor=req.headers['x-fixture-actor']||'owner-a';
      if(url.pathname==='/api/auth/ga4/connect')await start({actor,body:JSON.parse(body)},reply);
      else if(url.pathname.endsWith('/ga4-service-account/status')) reply.body={enabled:true,email:'fixture-reader@example.invalid'};
      else if(url.pathname.endsWith('/ga4-service-account/connect')) reply.body={success:true};
      else if(url.pathname.endsWith('/ga4-connection-status')) reply.body={connected:req.headers['x-fixture-connected']!=='false',properties:properties.get(url.pathname.split('/')[3])||[]};
      else {reply.statusCode=404;reply.body={error:'Unexpected fixture request'};}
      res.statusCode=reply.statusCode;res.setHeader('Content-Type','application/json');res.end(JSON.stringify(reply.body));
    }catch(error){res.statusCode=500;res.end(JSON.stringify({error:error.name}));}
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  browser=await chromium.launch({headless:true}); const origin=`http://127.0.0.1:${server.address().port}`;
  const context=await browser.newContext();
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort());
  const errors=[];context.on('page',page=>page.on('pageerror',error=>errors.push(error.message)));
  async function pageFor(query='',headers={}){const page=await context.newPage();await page.setExtraHTTPHeaders(headers);await page.goto(origin+query);return page;}
  for(const owner of ['a','b'])await check(`Actual creation screen uses customer Google OAuth and loads ${owner}'s properties without shared-account requests`,async()=>{
    const before=requests.length,page=await pageFor(`?campaign=draft-${owner}`,{'x-fixture-actor':`owner-${owner}`});
    await page.getByText('Secure Google Sign-In',{exact:true}).waitFor({timeout:3000});
    await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.popups.length===1);
    assert.equal(new URL(await page.evaluate(()=>window.popups[0].url)).hostname,'accounts.google.com');
    await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:'https://foreign.invalid',data:{type:'ga4_auth_success'}})));
    assert.equal(JSON.parse(await page.locator('#probe').textContent()).wizardStep,3);
    await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,data:{type:'ga4_auth_success'}})));
    await page.waitForFunction(()=>JSON.parse(document.querySelector('#probe').textContent).wizardStep===4);
    const state=JSON.parse(await page.locator('#probe').textContent());assert.equal(state.ga4Properties[0].name,`Owned by owner-${owner}`);
    assert.equal(state.selectedGA4Property,'123456789');assert.equal(state.ga4ConfigSubStep,'property');
    assert.ok(!requests.slice(before).some(r=>r.path.includes('service-account')));await page.close();
  });
  await check('Blocked popup reports failure and permits retry',async()=>{
    const page=await pageFor();await page.evaluate(()=>window.blockPopup=true);
    await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.events.some(e=>e.description?.includes('Popup was blocked')));
    await page.evaluate(()=>window.blockPopup=false);await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.popups.length===1);await page.close();
  });
  await check('Closed incomplete consent stays on authentication step and permits retry',async()=>{
    const page=await pageFor('',{'x-fixture-connected':'false'});await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.popups.length===1);await page.evaluate(()=>window.popups[0].closed=true);
    await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).waitFor();
    assert.equal(JSON.parse(await page.locator('#probe').textContent()).wizardStep,3);await page.close();
  });
  await check('OAuth error stays on authentication step and reports the provider error',async()=>{
    const page=await pageFor();await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.popups.length===1);
    await page.evaluate(()=>window.dispatchEvent(new MessageEvent('message',{origin:location.origin,data:{type:'ga4_auth_error',error:'Fixture consent denied'}})));
    await page.waitForFunction(()=>window.events.some(e=>e.description==='Fixture consent denied'));assert.equal(JSON.parse(await page.locator('#probe').textContent()).wizardStep,3);await page.close();
  });
  await check('Explicit shared-account mode retains its separate setup route',async()=>{
    const page=await pageFor('?mode=service-account');await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.getByLabel('GA4 Property ID').fill('123456789');await page.getByRole('button',{name:'Connect Google Analytics',exact:true}).click();
    await page.waitForFunction(()=>window.events.some(e=>e.success));await page.close();
  });
  assert.deepEqual(errors,[]);
})().catch(error=>{results.push({name:'Run failure',result:'FAIL',error:error.message});process.exitCode=1;}).finally(async()=>{
  if(browser)await browser.close();if(server)await new Promise(resolve=>server.close(resolve));
  const output=`docs/fixes/v1-batch-1/onboarding-${process.argv.includes('--before')?'before':'after'}.json`;
  fs.writeFileSync(output,JSON.stringify({at:new Date().toISOString(),boundary:'Current creation JSX/helper/component and exact OAuth/access/state handlers. Synthetic identity, provider, storage and status replies; local Chromium; external requests blocked. Does not certify provider acceptance, full import, persisted PostgreSQL, reconnect history or discovery pagination.',results},null,2)+'\n');
  console.log(JSON.stringify({passed:results.filter(r=>r.result==='PASS').length,failed:results.filter(r=>r.result==='FAIL').length,output}));
});
