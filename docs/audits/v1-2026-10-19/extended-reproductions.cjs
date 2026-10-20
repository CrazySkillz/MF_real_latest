const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const out='docs/audits/v1-2026-10-19/';
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true);
const routes=new Map();
function visit(n){if(ts.isCallExpression(n)&&/^app\.(get|post)$/.test(n.expression.getText(sf))&&ts.isStringLiteral(n.arguments[0]))routes.set(n.expression.getText(sf).slice(4)+' '+n.arguments[0].text,n.getText(sf));ts.forEachChild(n,visit)}visit(sf);
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function extract(method,path,bindings={}){let h;const app={get:(...a)=>h=a.at(-1),post:(...a)=>h=a.at(-1)};const vars={app,...bindings};new Function(...Object.keys(vars),transpile(routes.get(method+' '+path)))(...Object.values(vars));return h}
function response(){return{statusCode:200,payload:null,status(n){this.statusCode=n;return this},send(v){this.payload=v;return this},json(v){this.payload=v;return this},setHeader(){}}}
function moduleFrom(path,mocks){const exports={};new Function('exports','require',transpile(fs.readFileSync(path,'utf8')))(exports,id=>{if(id in mocks)return mocks[id];return require(id)});return exports}
(async()=>{
 const results=[];
 let res=response();
 const scriptMarker='</script><script>window.__v1AuditMarker=731</script><script>';
 const simulation=extract('get','/api/auth/google/simulation-auth',{console:{error(){}}});
 await simulation({query:{state:scriptMarker}},res);
 assert.ok(res.payload.includes(scriptMarker));
 const {chromium}=require('playwright');const browser=await chromium.launch({headless:true});
 try{
  const context=await browser.newContext();await context.route('**/*',r=>r.abort());const page=await context.newPage();
  const index=ts.createSourceFile('index.ts',fs.readFileSync('server/index.ts','utf8'),ts.ScriptTarget.Latest,true);let policy;
  for(const n of index.statements)if(ts.isVariableStatement(n))for(const d of n.declarationList.declarations)if(d.name.getText(index)==='contentSecurityPolicy')policy=new Function('return '+d.initializer.getText(index))();
  await page.setContent('<meta http-equiv="Content-Security-Policy" content="'+policy.replaceAll('"','&quot;')+'">'+res.payload);
  const marker=await page.evaluate(()=>window.__v1AuditMarker);assert.equal(marker,731);
  results.push({case:'Simulation OAuth state executes inserted script under current CSP',route:'GET /api/auth/google/simulation-auth',marker,boundary:'Exact extracted HTML handler, local about:blank Chromium; all browser network blocked. No deployed attack.'});
 }finally{await browser.close()}
 let requested=[];let writes=[];
 const handler=extract('post','/api/webhook/custom-integration/:token',{
  upload:{single:()=>()=>{}},console:{log(){},warn(){},error(){}},
  storage:{getCustomIntegrationByToken:async()=>({id:'fixture',campaignId:'deleted-campaign-fixture'}),createCustomIntegrationMetrics:async row=>{writes.push(row);return{id:'metrics-fixture'}}},
  fetch:async(url,opts)=>{requested.push({url,optionsProvided:opts!==undefined});return{ok:true,arrayBuffer:async()=>Buffer.from('spend\n1'),headers:{get:()=> 'text/csv'}}},
  parseCustomIntegrationFile:async()=>({spend:1,_confidence:20,_requiresReview:true}),
  normalizeCustomIntegrationMetrics:x=>({spend:String(x.spend)}),
  require:id=>{assert.equal(id,'./scheduler.js');return{recordCampaignMetrics:async()=>false}},
  supportedCustomIntegrationFileDescription:()=> 'CSV',
 });
 res=response();await handler({params:{token:'fixture-token'},body:{fileUrl:'http://127.0.0.1:5000/fixture.csv'}},res);
 assert.equal(requested.length,1);assert.equal(requested[0].optionsProvided,false);assert.equal(writes.length,1);assert.equal(res.payload.success,true);
 results.push({case:'Token-authenticated custom webhook accepts loopback URL and persists review-required data without parent check',requested,writes,response:res.payload,boundary:'Fetch/storage/parser/recording are mocked; no HTTP/database/email. Parser review flag deliberately supplied to exercise exact handler branch.'});
 const csv=moduleFrom('server/utils/csv.ts',{'./data-transformation':{normalizeStrictUtcDateKey(){throw new Error('Date helper must not be called in parser fixtures')}}});
 const parser=moduleFrom('server/services/custom-integration-file-parser.ts',{'../utils/csv':csv,'./pdf-parser':{parsePDFMetrics(){throw new Error('PDF must not be called')}}});
 const oversized=await parser.parseCustomIntegrationFile(Buffer.from('spend\n'+Array(5001).fill('1').join('\n')),'fixture.csv','text/csv');
 assert.equal(oversized.spend,4999);assert.equal(oversized._confidence,100);assert.equal(oversized._requiresReview,false);
 results.push({case:'Custom CSV silently truncates 5001 data rows to 4999 and claims full confidence',inputRows:5001,expectedSpend:5001,actual:oversized,note:'Non-strict parser limit includes the header; first diagnostic expected5000 and exposed actual4999. Runtime code unchanged.'});
 for(const [label,input,expected] of [['malformed amount','spend\n12oops',12],['mixed currency','spend\n$10\n€20',30],['European decimal','spend\n"1.234,56"',1.23456]]){
  const parsed=await parser.parseCustomIntegrationFile(Buffer.from(input),'fixture.csv','text/csv');
  assert.ok(Math.abs(parsed.spend-expected)<0.01);results.push({case:'Custom CSV '+label,parsed});
 }
 const normal=await parser.parseCustomIntegrationFile(Buffer.from('spend,clicks,impressions\n0,0,0'),'fixture.csv','text/csv');assert.equal(normal.spend,0);results.push({case:'Control: zero metrics preserved by parser',parsed:normal});
 fs.writeFileSync(out+'extended-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} additional isolated cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1});
