const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const transpile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const sf=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true);const routes=new Map();let countLinesSource,parseNumSource;
function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(sf)==='app.post'&&ts.isStringLiteral(n.arguments[0]))routes.set(n.arguments[0].text,n.getText(sf));if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='countLinesUpTo')countLinesSource=n.initializer.getText(sf);if(ts.isVariableDeclaration(n)&&n.name.getText(sf)==='parseNum'&&sf.getLineAndCharacterOfPosition(n.getStart()).line===1455)parseNumSource=n.initializer.getText(sf);ts.forEachChild(n,visit);}visit(sf);assert.ok(parseNumSource);
const ds=ts.createSourceFile('dates.ts',fs.readFileSync('server/utils/data-transformation.ts','utf8'),ts.ScriptTarget.Latest,true);let dateFunction;ds.forEachChild(n=>{if(ts.isFunctionDeclaration(n)&&n.name?.text==='normalizeStrictUtcDateKey')dateFunction=n.getText(ds);});
const de={};new Function('exports',transpile(dateFunction))(de);
const csv={};new Function('exports','require',transpile(fs.readFileSync('server/utils/csv.ts','utf8')))(csv,id=>{assert.equal(id,'./data-transformation');return de;});
const countLinesUpTo=new Function('return '+transpile('const fn='+countLinesSource).replace(/^const fn\s*=\s*/,'').replace(/;\s*$/,''))();
const parseNum=new Function('return '+transpile('const fn='+parseNumSource).replace(/^const fn\s*=\s*/,'').replace(/;\s*$/,''))();
function response(){return{statusCode:200,status(n){this.statusCode=n;return this;},json(v){this.payload=v;return this;}};}
function handler(path,extra){let h;const vars={app:{post:(...args)=>h=args.at(-1)},importRateLimiter:()=>{},requireCampaignAccessParamId:()=>{},uploadCsv:{single:()=>()=>{}},MAX_CSV_ROWS_PROCESS:50000,countLinesUpTo,...csv,parseNum,isSupportedScopedSpendPlatformContext:v=>v==='ga4',getReportingDateWindow:()=>({endDate:'2026-10-18'}),recalcCampaignSpend:async()=>{},recomputeGA4SpendBeforeResponse:async()=>{},console:{error(){}},getInternalGA4RefreshWriteInput:()=>({}),toA1Prefix:name=>`'${name}'!`,...extra};new Function(...Object.keys(vars),transpile(routes.get(path)))(...Object.values(vars));return h;}
(async()=>{
  const results=[];
  for(const [label,csvText,expected] of [['50,000 data rows','date,spend\n'+Array(50000).fill('2026-10-18,1').join('\n'),49999],['malformed amount','date,spend\n2026-10-18,12oops',12]]){
    let persisted;
    const h=handler('/api/campaigns/:id/spend/csv/process',{storage:{getCampaign:async()=>({currency:'USD',reportingTimeZone:'UTC'}),replaceCsvSpendSourceWithRecords:async(_campaign,_existing,_source,records)=>{persisted=records;return{id:'fixture-source'};}}});
    const res=response();await h({params:{id:'fixture'},body:{mapping:JSON.stringify({spendColumn:'spend',dateColumn:'date',platformContext:'ga4',currency:'USD'})},file:{buffer:Buffer.from(csvText)}},res);
    assert.equal(res.payload.success,true);assert.equal(res.payload.spendToDate,expected);
    results.push({case:'GA4 CSV Spend '+label,response:res.payload,persistedRecords:persisted,boundary:'Exact handler and CSV/date helpers; owner middleware, storage and recomputation mocked. No filesystem customer input or DB.'});
  }
  for(const [label,totalRows,amount,expected] of [['bounded sheet omits later rows',5001,'1',4999],['malformed amount accepted',1,'12oops',12],['non-numeric amount becomes measured zero',1,'not available',0]]){
    let persisted,requests=[];
    const h=handler('/api/campaigns/:id/spend/sheets/process',{
      storage:{getCampaign:async()=>({currency:'USD',reportingTimeZone:'UTC'}),getGoogleSheetsConnections:async()=>[{id:'connection-fixture',spreadsheetId:'sheet-fixture',sheetName:'Fixture',accessToken:'fixture'}],getSpendSources:async()=>[],replaceSpendSourceWithRecords:async(_campaign,_existing,_type,_context,_source,records)=>{persisted=records;return{id:'fixture-source'};}},
      fetch:async(url,options)=>{requests.push({url,hasSignal:!!options.signal});const bounded=decodeURIComponent(url).includes('A1:ZZ5000');return{ok:true,json:async()=>({values:[['date','spend'],...Array(Math.min(totalRows,bounded?4999:totalRows)).fill(['2026-10-18',amount])]})};},
    });
    const res=response();await h({params:{id:'fixture'},body:{connectionId:'connection-fixture',platformContext:'ga4',mapping:{spendColumn:'spend',dateColumn:'date',currency:'USD'}}},res);
    assert.equal(res.payload.success,true);assert.equal(res.payload.spendToDate,expected);
    results.push({case:'GA4 Sheets Spend '+label,inputDataRows:totalRows,requests,response:res.payload,persistedRecords:persisted,boundary:'Exact handler and number/date helpers; bounded deterministic sheet fixture follows requested A1 range. No Google/DB call.'});
  }
  fs.writeFileSync('docs/audits/v1-2026-10-19/spend-import-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',results},null,2)+'\n');console.log(`${results.length} Spend import cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
