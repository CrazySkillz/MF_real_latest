const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function moduleAt(file){const e={};new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(e,id=>id.startsWith('.')?moduleAt(path.resolve(path.dirname(file),id)+'.ts'):require(id));return e;}
const tree=ts.createSourceFile('scheduler.ts',fs.readFileSync('server/auto-refresh-scheduler.ts','utf8'),ts.ScriptTarget.Latest,true);
const fn=tree.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name?.text==='reprocessGoogleSheetsRevenue');assert.ok(fn);
const results=[];
(async()=>{
 for(const selected of [{campaignValue:'selected'},{campaignValues:['selected']}]){
  let persisted;
  const mapping={connectionId:'connection',revenueColumn:'Revenue',campaignColumn:'Campaign',platformContext:'ga4',currency:'USD',...selected};
  const source={id:'source',campaignId:'fixture',sourceType:'google_sheets',platformContext:'ga4',mappingConfig:JSON.stringify(mapping)};
  const env={...moduleAt('server/utils/csv.ts'),...moduleAt('server/utils/google-sheets-revenue-amount.ts'),...moduleAt('server/utils/google-sheets-revenue-ranges.ts'),isSourceOutsideCampaign:(s,c)=>s.campaignId!==c,getLatestCompleteReportingDate:()=> '2026-10-18',
   storage:{getGoogleSheetsConnections:async()=>[{id:'connection',spreadsheetId:'sheet',sheetName:'Fixture',accessToken:'fixture'}],getCampaign:async()=>({currency:'USD'}),replaceRevenueSourceWithRecords:async(...args)=>{persisted=args[5];}},
   fetch:async url=>({ok:true,status:200,json:async()=>url.includes('/values/')?{values:[['Campaign','Revenue'],['selected','10'],['unselected','90']]}:{sheets:[{properties:{title:'Fixture',index:0,gridProperties:{rowCount:3}}}]}}),console:{log(){},warn(){},error(){}}
  };
  const refresh=new Function(...Object.keys(env),compile(fn.getText(tree))+'\nreturn reprocessGoogleSheetsRevenue;')(...Object.values(env));
  const ok=await refresh('fixture',source,mapping);assert.equal(ok,true);
  const total=persisted.reduce((sum,r)=>sum+Number(r.revenue),0);assert.equal(total,selected.campaignValue?100:10);
  results.push({case:selected.campaignValue?'Stored singular campaignValue is ignored during refresh':'Array campaignValues control preserves selected scope',mapping,total,persisted});
 }
 fs.writeFileSync('docs/audits/v1-2026-10-19/sheets-refresh-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact scheduled refresh function and parsing/range helpers; two-row Google response and storage fixtures. Save route accepts and preserves singular campaignValue; no provider/database mutation.',results},null,2)+'\n');console.log(`${results.length} Sheets refresh cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
