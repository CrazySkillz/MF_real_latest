// Current handler/helper execution with fixture-only storage; no app database or provider.
const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleAt(file){const e={};new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(e,id=>id.startsWith('.')?moduleAt(path.resolve(path.dirname(file),id)+'.ts'):require(id));return e;}
const tree=ts.createSourceFile('routes.ts',fs.readFileSync('server/routes-oauth.ts','utf8'),ts.ScriptTarget.Latest,true),named=new Map();let handlerText;
function visit(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&(!named.has(n.name.text)||(n.name.text==='parseNum'&&tree.getLineAndCharacterOfPosition(n.getStart()).line===1455)))named.set(n.name.text,'const '+n.getText(tree)+';');if(ts.isCallExpression(n)&&n.expression.getText(tree)==='app.post'&&n.arguments[0]?.text==='/api/campaigns/:id/revenue/csv/process')handlerText=n.arguments[n.arguments.length-1].getText(tree);ts.forEachChild(n,visit);}visit(tree);
function bind(names,env){return new Function(...Object.keys(env),compile(names.map(x=>named.get(x)).join('\n'))+'\nreturn {'+names.join(',')+'};')(...Object.values(env));}
const helpers=bind(['zCsvRevenuePlatformContext','zValueSource','zRevenueMapping','sendBadRequest','parseCsvRevenuePlatformContext','parseValueSource','parseNum'],{z:require('zod').z});
const csv=moduleAt('server/utils/csv.ts'),results=[];
(async()=>{
for(const fixture of [
 {name:'GA4 accepted negative adjustment is silently omitted',context:'ga4',currency:'USD',csv:'Revenue\n100\n-10',mapping:{revenueColumn:'Revenue'},status:200,total:100},
 {name:'GA4 duplicate header control rejects before mutation',context:'ga4',currency:'USD',csv:'Revenue,Revenue\n100,7',mapping:{revenueColumn:'Revenue'},status:400},
 {name:'GA4 dollar-in-EUR control rejects before mutation',context:'ga4',currency:'EUR',csv:'Revenue\n$100',mapping:{revenueColumn:'Revenue'},status:400},
 {name:'GA4 exact selected campaign control excludes other row',context:'ga4',currency:'USD',csv:'Campaign,Revenue\nselected,100\nother,900',mapping:{revenueColumn:'Revenue',campaignColumn:'Campaign',campaignValues:['selected']},status:200,total:100},
 {name:'LinkedIn invalid conversion-value edit deletes old materialization before returning400',context:'linkedin',currency:'USD',csv:'Value\n0',mapping:{sourceId:'source-fixture',conversionValueColumn:'Value',valueSource:'conversion_value'},status:400,destructive:true},
 {name:'Non-GA4 Revenue CSV silently truncates 50000 data rows',context:'linkedin',currency:'USD',csv:'Revenue\n'+Array(50000).fill('1').join('\n'),mapping:{revenueColumn:'Revenue'},status:200,total:49999},
]){
 let records=[{revenue:'55.00'}],events=[];
 const storage={getCampaign:async()=>({currency:fixture.currency,reportingTimeZone:'UTC'}),getRevenueSource:async()=>({id:'source-fixture',sourceType:'csv',platformContext:fixture.context,mappingConfig:'{}'}),
  replaceGa4CsvRevenueSourceWithRecords:async(id,sourceId,source,rows)=>{records=rows;events.push('atomic_replace_called');return{id:sourceId||'new-fixture'};},
  updateRevenueSource:async(id,source)=>{events.push('source_updated');return{id,...source};},createRevenueSource:async()=>{events.push('source_created');return{id:'new-fixture'};},
  deleteRevenueRecordsBySource:async()=>{events.push('old_records_deleted');records=[];},createRevenueRecords:async rows=>{events.push('records_inserted');records=rows;},updateLinkedInConnection:async()=>{},
 };
 const env={...csv,...helpers,storage,Buffer,MAX_CSV_ROWS_PROCESS:50000,inFlightGa4CsvRevenueAdds:new Set(),createHash:require('node:crypto').createHash,normalizeOverviewInventoryConfigValue:x=>x,countLinesUpTo:(s,max)=>Math.min(s.split('\n').length,max+1),
  googleAdsCampaignIdFromValueOrMapping:()=>null,getReportingDateWindow:()=>({endDate:'2026-10-18'}),yesterdayUTC:()=> '2026-10-18',recomputeCampaignDerivedValues:async()=>{},clearLatestLinkedInImportSessionConversionValue:async()=>{},console:{error(){}},
 };
 const handler=new Function(...Object.keys(env),compile('const handler='+handlerText)+'\nreturn handler;')(...Object.values(env));
 const res={statusCode:200,status(n){this.statusCode=n;return this;},json(p){this.payload=p;return this;}};
 await handler({params:{id:'fixture'},_campaign:{currency:fixture.currency},body:{platformContext:fixture.context,mapping:JSON.stringify({...fixture.mapping,currency:fixture.currency})},file:{buffer:Buffer.from(fixture.csv),originalname:'fixture.csv'}},res);
 assert.equal(res.statusCode,fixture.status,JSON.stringify(res.payload));
 if(fixture.total!==undefined)assert.equal(res.payload.totalRevenue,fixture.total);
 if(fixture.destructive){assert.deepEqual(events,['source_updated','old_records_deleted']);assert.equal(records.length,0);}else if(fixture.status===400)assert.equal(events.length,0);
 results.push({case:fixture.name,response:res.payload,status:res.statusCode,events,persistedCount:records.length,persistedSum:records.reduce((n,r)=>n+Number(r.revenue),0)});
}
fs.writeFileSync('docs/audits/v1-2026-10-19/csv-revenue-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current process handler, CSV helpers, mapping/amount/platform validation. Auth middleware, aggregate recomputation and database writes replaced with isolated fixture spies. No live records changed.',results},null,2)+'\n');console.log(`${results.length} CSV Revenue cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
