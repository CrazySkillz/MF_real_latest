const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
function ast(file){const source=fs.readFileSync(file,'utf8');return ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,file.endsWith('tsx')?ts.ScriptKind.TSX:ts.ScriptKind.TS);}
function variable(file,name){const tree=ast(file);let found;function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(tree)===name)found=n.initializer.getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found,name);return ts.transpileModule('const result='+found,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nreturn result;';}
function route(path){const tree=ast('server/routes-oauth.ts');let found;function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(tree)==='app.post'&&n.arguments[0]?.text===path)found=n.arguments[n.arguments.length-1].getText(tree);ts.forEachChild(n,visit);}visit(tree);assert.ok(found,path);return ts.transpileModule('const result='+found,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText+'\nreturn result;';}
const results=[];
(async()=>{
  const src={id:'meta',label:'Meta',category:'paid_media',connected:true,includedMetrics:['spend','revenue','clicks','impressions','conversions'],metrics:{spend:100,revenue:0,clicks:10,impressions:100,conversions:0}};
  const build=new Function('outcomeTotals','outcomeTotalsFetched',variable('client/src/pages/platform-comparison.tsx','buildPlatformMetrics'))({performanceSummary:{sources:[src]}},true);
  const rows=build();assert.equal(rows[0].roi,0);assert.equal(((0-100)/100)*100,-100);results.push({case:'Retained Platform Comparison reports 0% ROI for verified zero revenue and100 spend',row:rows[0],expectedRoi:-100});
  for(const allow of [false,true]){
    const writes=[];
    const handler=new Function('storage','process',route('/api/campaigns/:id/linkedin-daily/mock'))({upsertLinkedInDailyMetrics:async rows=>{writes.push(...rows);return {upserted:rows.length};}},{env:{NODE_ENV:'production',ALLOW_MOCK_DATA:allow?'true':'false'}});
    const res={statusCode:200,setHeader(){},status(n){this.statusCode=n;return this;},json(body){this.body=body;return this;}};
    await handler({params:{id:'foreign-owner-fixture'},body:{days:2}},res);
    assert.equal(res.statusCode,allow?200:403);assert.equal(writes.length,allow?2:0);
    results.push({case:allow?'Production ALLOW_MOCK_DATA permits anonymous foreign campaign overwrite':'Production mock-disabled control rejects write',status:res.statusCode,writeCount:writes.length,campaignIds:[...new Set(writes.map(x=>x.campaignId))]});
  }
  for(const mode of ['pdf','xlsx','csv']){
    let captured,filename;
    const document={createElement(){return {click(){filename=this.download;}};},body:{appendChild(){},removeChild(){}}};
    const url={createObjectURL(blob){captured=blob;return 'blob:isolated';},revokeObjectURL(){}};
    const download=new Function('campaign','kpis','kpiReportFormat','kpiReportDateRange','format','document','URL','Blob',variable('client/src/pages/kpis.tsx','downloadKPIReport'))({name:'Fixture'},[{name:'A "quoted" KPI',currentValue:'10',targetValue:'5',status:'active'}],mode,'30d',()=> 'fixture-date',document,url,Blob);
    download();const text=await captured.text();assert.equal(captured.type,mode==='pdf'?'text/plain':mode==='xlsx'?'application/json':'text/csv');
    if(mode==='csv')assert.ok(text.includes('"A "quoted" KPI"'));
    results.push({case:`Retained KPI export ${mode}`,filename,mimeType:captured.type,content:text});
  }
  fs.writeFileSync('docs/audits/v1-2026-10-19/retained-ui-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact extracted current UI functions and route; fixture objects, no provider, live browser or database. ALLOW_MOCK_DATA production configuration is not asserted enabled on deployment.',results},null,2)+'\n');
  console.log(`${results.length} retained UI/configuration cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
