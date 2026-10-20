const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const source=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true);const routes=new Map();
function visit(n){if(ts.isCallExpression(n)&&/^app\.(get|delete)$/.test(n.expression.getText(source))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.expression.getText(source).slice(4)+' '+n.arguments[0].text,n.getText(source));ts.forEachChild(n,visit);}visit(source);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function handler(method,path,bindings){let result;const app={[method]:(...a)=>result=a.at(-1)};new Function('app',...Object.keys(bindings),transpile(routes.get(method+' '+path)))(app,...Object.values(bindings));return result;}
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},send(v){this.payload=v;return this;},json(v){this.payload=v;return this;}};}
(async()=>{
  const results=[];
  for(const discoveryFails of [false,true]){
    let connections=[{id:'old-fixture',campaignId:'fixture',propertyId:'111',importStartDate:'2020-01-01',isPrimary:true}],calls=[],requests=[];
    const storage={getCampaign:async()=>({id:'fixture',ownerId:'owner-fixture'}),getGA4Connections:async()=>connections.slice(),createGA4Connection:async row=>{const created={id:'new-fixture',...row};connections.push(created);calls.push({method:'create',propertyId:row.propertyId});return created;},setPrimaryGA4Connection:async(_campaign,id)=>{calls.push({method:'promote',id});return true;},deleteGA4Connection:async id=>{calls.push({method:'delete',id});connections=connections.filter(c=>c.id!==id);return true;}};
    const fetch=async(url,opts)=>{
      requests.push({url,hasSignal:!!opts.signal});
      if(url.includes('/token'))return{ok:true,json:async()=>({access_token:'fixture',refresh_token:'fixture-refresh',expires_in:3600})};
      if(url.endsWith('/accounts'))return{ok:!discoveryFails,json:async()=>({accounts:[{name:'accounts/1',displayName:'Fixture account'}],nextPageToken:'fixture-account-page-2'})};
      return{ok:true,json:async()=>({properties:[{name:'properties/222',displayName:'Fixture property'}],nextPageToken:'fixture-property-page-2'})};
    };
    const callback=handler('get','/api/auth/google-sheets/callback',{storage,fetch,verifyGA4OAuthState:()=>({ok:true,campaignId:'fixture'}),getActorId:()=> 'owner-fixture',console:{log(){},error(){}},process:{env:{GOOGLE_CLIENT_ID:'fixture',GOOGLE_CLIENT_SECRET:'fixture',APP_BASE_URL:'https://fixture.invalid'}},global:{},realGA4Client:{storeManualConnection(){}},serializeOAuthPopupJson:JSON.stringify});
    const res=response();await callback({query:{code:'fixture-code',state:'ga4:fixture-state'}},res);
    assert.equal(connections.length,1);assert.equal(connections[0].propertyId,'');assert.ok(calls.some(c=>c.method==='delete'&&c.id==='old-fixture'));assert.match(res.payload,/ga4_auth_success/);assert.ok(requests.every(r=>!r.url.includes('pageToken=')));
    results.push({case:discoveryFails?'OAuth reconnect deletes previous selected connection even when property discovery fails':'OAuth reconnect replaces previous selected connection with unselected pending row; ignores discovery next-page tokens',calls,requests,remaining:connections.map(c=>({id:c.id,propertyId:c.propertyId})),successPopup:true,boundary:'Exact callback with authenticated owner, verified state and fake Google responses. No real token exchange or database.'});
  }
  const clientSource=ts.createSourceFile('client.ts',fs.readFileSync('server/real-ga4-client.ts','utf8'),ts.ScriptTarget.Latest,true);let propertiesMethod;
  function find(n){if(ts.isMethodDeclaration(n)&&n.name.getText(clientSource)==='getProperties')propertiesMethod=n.getText(clientSource);ts.forEachChild(n,find);}find(clientSource);
  const Client=new Function('console',transpile('class Fixture {'+propertiesMethod+'}\nreturn Fixture;'))({error(){}});
  const client=new Client();client.connections=new Map([['fixture',{accessToken:'fixture'}]]);client.oauth2Client={};client.fetchPropertiesFromGoogle=async()=>[];
  const properties=await client.getProperties('fixture');assert.equal(properties[0].id,'123456789');
  let dbReads=0;const status=handler('get','/api/campaigns/:id/ga4-connection-status',{ensureCampaignAccess:async()=>({id:'fixture'}),realGA4Client:{isConnected:()=>true,getConnection:()=>({propertyId:''}),getProperties:async()=>properties},storage:{getGA4Connections:async()=>{dbReads++;return[];}},process:{env:{GOOGLE_CLIENT_ID:'fixture'}},console:{error(){}}});
  const res=response();await status({params:{id:'fixture'}},res);assert.equal(dbReads,0);assert.equal(res.payload.connected,true);assert.equal(res.payload.dataSource,'Real Google Analytics API');
  results.push({case:'Status prioritizes memory and labels fabricated property fallback as real without checking persisted connection',dbReads,response:res.payload,boundary:'Exact getProperties method and status handler; in-memory fixture present, DB empty. Code trace confirms delete route does not clear these maps; no claim of an observed production disconnect.'});
  fs.writeFileSync('docs/audits/v1-2026-10-19/ga4-onboarding-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} GA4 onboarding cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
