const fs=require('node:fs'),ts=require('typescript'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),vars=new Map();
function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name))vars.set(n.name.text,n.initializer?.getText(sf));ts.forEachChild(n,walk)}walk(sf);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
let now=Date.UTC(2026,9,19,12),results=[];
function fixture(provider,env){const processFixture={env},exports={};new Function('exports','require','process',transpile(fs.readFileSync('server/utils/tokenVault.ts','utf8')))(exports,require,processFixture);
 const names=['getHubSpotOAuthStateSecret','getGoogleAdsOAuthStateSecret',`sign${provider}OAuthState`,`verify${provider}OAuthState`];
 const source=names.map(n=>`const ${n} = ${vars.get(n)};`).join('\n')+`\nreturn {sign:sign${provider}OAuthState,verify:verify${provider}OAuthState};`;
 const bindings={...crypto,Buffer,process:processFixture,Date:{now:()=>now},resolveOAuthStateSigningSecret:exports.resolveOAuthStateSigningSecret,GA4_OAUTH_STATE_TTL_MS:600000,HUBSPOT_OAUTH_STATE_TTL_MS:600000,LINKEDIN_OAUTH_STATE_TTL_MS:600000,META_OAUTH_STATE_TTL_MS:600000,GOOGLE_ADS_OAUTH_STATE_TTL_MS:600000};
 return new Function(...Object.keys(bindings),transpile(source))(...Object.values(bindings));
}
for(const provider of ['GA4','GoogleSheets','HubSpot','LinkedIn','Meta','GoogleAds']){
 const f=fixture(provider,{NODE_ENV:'production',SESSION_SECRET:crypto.randomBytes(32).toString('hex')}),state=f.sign('fixture-campaign'),valid=f.verify(state),repeated=f.verify(state);assert.equal(valid.ok,true);assert.equal(repeated.ok,true);
 const [payload,sig]=state.split('.'),tampered=payload+'.'+(sig[0]==='A'?'B':'A')+sig.slice(1);assert.equal(f.verify(tampered).ok,false);now+=600001;assert.equal(f.verify(state).ok,false);now-=600001;
 results.push({case:`${provider} state controls`,valid:true,tamperRejected:true,expiredRejected:true,repeatedVerifierAcceptance:true,limitation:'Verifier does not consume nonce; repeated verification is not proof of repeated provider code exchange or unauthorized callback write.'});
}
for(const provider of ['GA4','GoogleSheets','HubSpot','GoogleAds']){const f=fixture(provider,{NODE_ENV:'production'});assert.throws(()=>f.sign('fixture-campaign'),/secret is not configured/);results.push({case:`${provider} production missing-secret control`,signingRejected:true})}
for(const [provider,knownFallback] of [['LinkedIn','dev-linkedin-oauth-state-secret'],['Meta','dev-meta-oauth-state-secret']]){
 const f=fixture(provider,{NODE_ENV:'production'}),payload=Buffer.from(JSON.stringify({c:'fixture-campaign',t:now,n:'fixture-nonce',s:1})).toString('base64url'),forged=payload+'.'+crypto.createHmac('sha256',knownFallback).update(payload).digest('base64url');
 const verified=f.verify(forged);assert.equal(verified.ok,true);assert.equal(verified.spendOnly,true);results.push({case:`${provider} production missing-secret accepts publicly derivable state`,forgedStateAccepted:true,spendOnly:true,limitation:'Callback retains campaign-owner check. Live secret configuration and provider exchange not inspected/executed.'});
}
fs.writeFileSync('docs/audits/v1-2026-10-19/oauth-state-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current sign/verify closures and tokenVault secret resolver with synthetic environment, clock and ephemeral fixture keys. No actual environment secret collection, browser, network, DB or provider calls.',results},null,2)+'\n');console.log(`${results.length} OAuth state cases executed`);
