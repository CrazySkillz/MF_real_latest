const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleAt(file){const e={};new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(e,id=>id.startsWith('.')?moduleAt(path.resolve(path.dirname(file),id)+'.ts'):require(id));return e;}
const tree=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),named=new Map();let handlerText;
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&(!named.has(n.name.text)||(n.name.text==='parseNum'&&tree.getLineAndCharacterOfPosition(n.getStart()).line===1455)))named.set(n.name.text,'const '+n.getText(tree)+';');if(ts.isCallExpression(n)&&n.expression.getText(tree)==='app.post'&&n.arguments[0]?.text==='/api/campaigns/:id/revenue/sheets/process')handlerText=n.arguments[n.arguments.length-1].getText(tree);ts.forEachChild(n,visit);}visit(tree);
function bind(code,names,env){return new Function(...Object.keys(env),compile(code)+'\nreturn {'+names.join(',')+'};')(...Object.values(env));}
const z=require('zod').z;
const schemas=bind(['zSheetsRevenuePlatformContext','zValueSource','zNumberLike','zSelectedValues','zRevenueMapping'].map(x=>named.get(x)).join('\n'),['zSheetsRevenuePlatformContext','zRevenueMapping'],{z,MAX_SELECTED_VALUES:200});
const csv=moduleAt('server/utils/csv.ts'),amounts=moduleAt('server/utils/google-sheets-revenue-amount.ts');
const results=[];
(async()=>{
for(const fixture of [
 {name:'Duplicate revenue headers overwrite first amount',currency:'USD',values:[['Revenue','Revenue'],['100','7']],expected:7},
 {name:'Dollar-prefixed value is relabeled EUR',currency:'EUR',values:[['Revenue'],['$100']],expected:100},
 {name:'Strict malformed amount control rejects input',currency:'USD',values:[['Revenue'],['12oops']],expected:null},
]){
 let persisted;
 const env={z,...schemas,...csv,...amounts,
  ensureCampaignAccess:async()=>true,sendBadRequest:(res,error)=>res.status(400).json({success:false,error}),parseValueSource:()=> 'revenue',inFlightGoogleSheetsRevenueAdds:new Set(),createHash:require('node:crypto').createHash,normalizeOverviewInventoryConfigValue:x=>x,revenuePurposeForPlatformContext:()=> 'revenue',
  storage:{getGoogleSheetsConnections:async()=>[{id:'fixture-connection',spreadsheetId:'fixture-sheet',sheetName:'Fixture',accessToken:'fixture'}],getCampaign:async()=>({currency:fixture.currency,reportingTimeZone:'UTC'}),replaceRevenueSourceWithRecords:async(...args)=>{persisted={source:args[4],records:args[5]};return {id:'fixture-source'};}},
  fetchWithTimeout:async()=>({ok:true}),readGoogleSheetsRevenueChunks:async()=>({success:true,values:fixture.values}),getReportingDateWindow:()=>({endDate:'2026-10-18'}),googleAdsCampaignIdFromValueOrMapping:()=>null,recomputeCampaignDerivedValues:async()=>{},console:{error(){}},
 };
 Object.assign(env,bind(named.get('parseNum'),['parseNum'],env));
 const h=new Function(...Object.keys(env),compile('const handler='+handlerText)+'\nreturn handler;')(...Object.values(env));
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(p){this.payload=p;return this;}};
 await h({params:{id:'fixture'},body:{connectionId:'fixture-connection',platformContext:'ga4',mapping:{revenueColumn:'Revenue',currency:fixture.currency}}},res);
 assert.equal(res.statusCode,fixture.expected===null?400:200,JSON.stringify(res.payload));
 if(fixture.expected!==null){assert.equal(res.payload.totalRevenue,fixture.expected);assert.equal(persisted.records[0].currency,fixture.currency);}else assert.equal(persisted,undefined);
 results.push({case:fixture.name,input:fixture.values,response:res.payload,persisted});
}
fs.writeFileSync('docs/audits/v1-2026-10-19/sheets-revenue-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current GA4 Sheets Revenue handler, Zod mapping, amount and CSV aggregation helpers; deterministic complete-sheet fixture, owner/storage/recompute mocked. No Google request or database mutation.',results},null,2)+'\n');console.log(`${results.length} Sheets Revenue cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
