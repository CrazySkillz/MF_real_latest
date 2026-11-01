// Synthetic browser/provider harness; makes no real network requests or database writes.
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict'), crypto = require('node:crypto');
const owner = 'synthetic-owner', origin = 'https://app.mimosaas.app';
const m = { draftId:'draft', clientId:'client', shopifyCampaignId:'existing', ownerSha256:crypto.createHash('sha256').update(owner).digest('hex'), shopDomain:'test.myshopify.com', previousShopifyConnectionId:'old-shop' };
const source = fs.readFileSync(path.join(__dirname,'manual-template.js'),'utf8').replace('/* DOMAIN_SCOPE */ null',JSON.stringify(m));
const flush = async () => { for (let i=0;i<40;i++) await Promise.resolve(); };
async function run(mode) {
  const requests=[], output=[], elements=[], popups=[], events={}, timers=[];
  const saved = new Map([[`campaign-draft-request:${m.clientId}`, mode==='wrong-draft'?'other':m.draftId]]);
  if (mode === 'no-wizard') saved.delete(`campaign-draft-request:${m.clientId}`);
  const clerk = {user:{id:mode==='wrong-owner'?'other':owner}};
  let bc;
  const element = tag => { const e={tag,style:{},children:[],disabled:false,appendChild(child){this.children.push(child);},remove(){this.removed=true;}}; elements.push(e);return e; };
  const window = {Clerk:clerk,addEventListener:(type,fn)=>{events[type]=fn;},removeEventListener:type=>{delete events[type];},open:()=>{if(mode==='popup-blocked')return null;const p={location:{},close(){this.closed=true;}};popups.push(p);return p;}};
  const sessionStorage = {getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)};
  const fetch = async (url,options) => {
    requests.push({url,options});
    assert.equal(options.credentials,'same-origin');assert.equal(options.redirect,'error');
    assert.ok(!/import|process|save-mapping|delete|refresh/.test(url));
    if (options.method==='POST') {
      assert.match(url,/^\/api\/auth\/(hubspot|salesforce|shopify)\/connect$/);
      const provider=url.split('/')[3],body=JSON.parse(options.body);
      assert.equal(body.campaignId,provider==='shopify'?m.shopifyCampaignId:m.draftId);
      assert.deepEqual(Object.keys(body).sort(),provider==='shopify'?['campaignId','shopDomain']:['campaignId']);
      if(provider==='shopify')assert.equal(body.shopDomain,m.shopDomain);
      const hosts={hubspot:'app.hubspot.com',salesforce:'login.salesforce.com',shopify:m.shopDomain};
      const u=new URL(`https://${mode==='wrong-host'?'example.invalid':hosts[provider]}/authorize`);
      u.searchParams.set('redirect_uri',`${mode==='wrong-redirect'?'https://old.invalid':origin}/api/auth/${provider}/callback`);
      u.searchParams.set('state','SENSITIVE_DO_NOT_EMIT');
      return {ok:mode!=='http-fail',json:async()=>({authUrl:u.href})};
    }
    assert.equal(options.method,'GET');assert.equal(options.body,undefined);
    let data;
    if(url==='/api/campaigns/draft') {
      if (mode === 'deleted-draft') return {ok:false,json:async()=>({})};
      data={id:'draft',clientId:mode==='foreign-client'?'other':'client',ownerId:mode==='foreign-draft'?'other':owner,name:'Domain Connection Check',status:mode==='active-draft'?'active':'draft'};
    }
    else if(url==='/api/campaigns/existing')data={id:'existing',clientId:'client',ownerId:owner,name:'Batch 1 Provider Check',status:'active'};
    else if(url===`/api/shopify/existing/status`)data={connected:true,authType:'oauth',shopDomain:mode==='changed-store'?'other.myshopify.com':m.shopDomain};
    else if(['/api/hubspot/draft/status','/api/salesforce/draft/status'].includes(url))data={connected:mode!=='not-saved'};
    else throw Error('UNPLANNED_REQUEST');
    return {ok:true,json:async()=>data};
  };
  const context={window,location:{origin:mode==='wrong-origin'?'https://old.invalid':origin},sessionStorage,document:{createElement:element,body:element('body')},URL,TextEncoder,Uint8Array,Date,AbortSignal,crypto:crypto.webcrypto,console:{log:line=>output.push(JSON.parse(line))},fetch,setTimeout:fn=>{timers.push(fn);return fn;},clearTimeout:()=>{},BroadcastChannel:class{constructor(){bc=this;}close(){this.closed=true;}}};
  await vm.runInNewContext(source,context);
  const buttons=elements.filter(x=>x.tag==='button');
  if(['wrong-origin','wrong-owner','foreign-draft','foreign-client','deleted-draft','active-draft','changed-store'].includes(mode)) {
    assert.equal(output.at(-1).domainAuthorization,'CHECK_REQUIRED');assert.equal(requests.filter(r=>r.options.method==='POST').length,0);
  } else {
    assert.equal(buttons.length,3);assert.deepEqual(buttons.map(x=>x.disabled),[false,true,true]);
    for(const [index,provider] of ['hubspot','salesforce','shopify'].entries()) {
      const started=buttons[index].onclick();
      if(mode==='double-click')await buttons[index].onclick();
      await started;
      if(['popup-blocked','http-fail','wrong-host','wrong-redirect'].includes(mode))break;
      const data={type:`${provider}_auth_success`,...(provider==='shopify'?{shopDomain:m.shopDomain,connectionId:mode==='stale-shopify'?'old-shop':'new-shop'}:{})};
      if(mode==='foreign-event') {
        const count=output.length;
        events.message({origin:'https://foreign.invalid',source:popups.at(-1),data});
        events.message({origin,source:{},data});await flush();assert.equal(output.length,count);
      }
      if(mode==='account-switch')clerk.user.id='other';
      if(mode==='provider-error')data.type=`${provider}_auth_error`;
      if(mode==='timeout'){timers.at(-1)();break;}
      if(provider==='shopify'||provider==='salesforce')bc.onmessage({data});
      else events.message({origin,source:popups.at(-1),data});
      await flush();
      if(['account-switch','provider-error','not-saved'].includes(mode))break;
    }
    const pass=['pass','no-wizard','wrong-draft','foreign-event','double-click'].includes(mode);
    assert.equal(output.at(-1).domainAuthorization,pass?'PASS_NEW_DOMAIN_CALLBACKS':'CHECK_REQUIRED',mode);
    if(pass){assert.equal(output.at(-1).checks.length,3);assert.equal(requests.filter(r=>r.options.method==='POST').length,3);}
    if(['wrong-host','wrong-redirect','http-fail'].includes(mode))assert.equal(popups[0].location.href,undefined);
    if(mode==='pass'){
      window.__mimoDomainCheck.remove();const count=requests.length;
      await vm.runInNewContext(source,context);assert.equal(requests.length,count);assert.equal(output.at(-1).domainAuthorization,'PASS_NEW_DOMAIN_CALLBACKS');
    }
  }
  assert.ok(!JSON.stringify(output).includes('SENSITIVE'));
  return {check:mode,passed:true,requests:requests.length};
}
(async()=>{
  const checks=[];
  const modes = process.argv[2] ? [process.argv[2]] : ['pass','no-wizard','wrong-origin','wrong-owner','wrong-draft','foreign-draft','foreign-client','deleted-draft','active-draft','changed-store','popup-blocked','http-fail','wrong-host','wrong-redirect','foreign-event','double-click','account-switch','provider-error','not-saved','stale-shopify','timeout'];
  for(const mode of modes) checks.push(await run(mode));
  const result={at:new Date().toISOString(),result:'PASS_LOCAL_CHECKER_SAFETY',realProviderCalls:0,databaseWrites:0,checks};
  fs.writeFileSync(path.join(__dirname,'manual-safety.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify({result:result.result,checks:checks.length}));
})().catch(error=>{console.error(error);process.exitCode=1;});
