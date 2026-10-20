const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),routes=new Map();
function walk(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='app.get'&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.getText(sf));ts.forEachChild(n,walk)}walk(sf);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function extract(path){let handler;const bindings={app:{get:(...a)=>handler=a.at(-1)},oauthRateLimiter:()=>{},console:{error(){},log(){}}};new Function(...Object.keys(bindings),transpile(routes.get(path)))(...Object.values(bindings));return handler}
const index=ts.createSourceFile('index.ts',fs.readFileSync('server/index.ts','utf8'),ts.ScriptTarget.Latest,true);let policy;
for(const s of index.statements)if(ts.isVariableStatement(s))for(const d of s.declarationList.declarations)if(d.name.getText(index)==='contentSecurityPolicy')policy=new Function('return '+d.initializer.getText(index))();
assert.ok(policy);
(async()=>{
 const {chromium}=require('playwright'),browser=await chromium.launch({headless:true}),results=[];
 try{
  const context=await browser.newContext();await context.route('**/*',r=>r.abort());
  const marker='</script><script>window.__v1OAuthAudit=731</script><script>';
  for(const [provider,field,expected] of [['salesforce','error',731],['salesforce','error_description',731],['linkedin','error_description',731],['meta','error_description',731],['google','error',null]]){
   const path=`/api/auth/${provider}/callback`,query={error:'access_denied',[field]:marker};let html;
   await extract(path)({query},{send:v=>{html=v},status(){return this}});assert.equal(typeof html,'string');
   const page=await context.newPage();await page.setContent('<meta http-equiv="Content-Security-Policy" content="'+policy.replaceAll('"','&quot;')+'">'+html);
   const observed=await page.evaluate(()=>window.__v1OAuthAudit??null);assert.equal(observed,expected);await page.close();
   results.push({case:`${provider} callback ${field} output`,path,queryField:field,markerExecuted:observed===731,expected:expected===731?'Confirmed unescaped error branch before authorization/state verification':'Control: Google error branch uses fixed text'});
  }
  let initializer;function find(n){if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='serializeOAuthPopupJson')initializer=n.initializer.getText(sf);ts.forEachChild(n,find)}find(sf);assert.ok(initializer);
  const serialize=new Function(transpile('return ('+initializer+')'))(),safe=serialize(marker),page=await context.newPage();
  await page.setContent('<meta http-equiv="Content-Security-Policy" content="'+policy.replaceAll('"','&quot;')+'"><script>window.__v1SafePopup='+safe+'</script>');
  assert.equal(await page.evaluate(()=>window.__v1OAuthAudit??null),null);assert.equal(await page.evaluate(()=>window.__v1SafePopup),marker);await page.close();
  results.push({case:'Existing serializeOAuthPopupJson helper preserves string without script execution',markerExecuted:false,roundTripPreserved:true});
 }finally{await browser.close()}
 fs.writeFileSync('docs/audits/v1-2026-10-19/oauth-popup-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current GET callback error handlers and existing popup serializer in local Chromium with current CSP and all browser network blocked. No deployed attack, provider, database or credential access. Middleware not executed; error branches precede state/owner checks.',results},null,2)+'\n');console.log(`${results.length} OAuth popup cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1});
