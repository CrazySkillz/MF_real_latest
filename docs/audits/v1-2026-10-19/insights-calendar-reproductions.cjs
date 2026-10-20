const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(file){const e={};new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(e,id=>id.startsWith('.')?load(path.resolve(path.dirname(file),id)+'.ts'):require(id));return e;}
const insight=load('shared/ga4-insights.ts'),traffic=load('shared/ga4-traffic-window.ts');
const page=ts.createSourceFile('page.tsx',fs.readFileSync('client/src/pages/ga4-metrics.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let deriveText;
function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(page)==='trendsDailyRows')deriveText=n.initializer.arguments[0].getText(page);ts.forEachChild(n,visit);}visit(page);assert.ok(deriveText);
function derive(rows,start,cutoff){return new Function('ga4InsightsTimeSeries','trendsCampaignStartDate','trendsDataThroughDate','addGA4InsightsDateDays',compile('const derive='+deriveText)+'\nreturn derive();')(rows,start,cutoff,insight.addGA4InsightsDateDays);}
const routeText=fs.readFileSync('server/routes-oauth.ts','utf8'),routes=ts.createSourceFile('routes.ts',routeText,ts.ScriptTarget.Latest,true);let routeBody;
function visitRoute(n){if(ts.isCallExpression(n)&&n.expression.getText(routes)==='app.get'&&n.arguments[0]?.text==='/api/campaigns/:id/ga4-daily')routeBody=n.arguments.at(-1).body;ts.forEachChild(n,visitRoute);}visitRoute(routes);
const statements=routeBody.statements.find(ts.isTryStatement).tryBlock.statements;
const named=name=>statements.find(n=>ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>d.name.getText(routes)===name));
const start=named('providerRefreshWarning').getStart(routes),last=statements.at(-1);assert.ok(last.getText(routes).startsWith('res.json('));
const segment=routeText.slice(start,last.end);
const row=date=>({date,sessions:100,users:80,conversions:10,revenue:100,pageviews:200,engagedSessions:50,engagementRate:0.5,updatedAt:'2026-10-19T03:00:00Z'});
const results=[];
(async()=>{
 let readCount=0;const res={json(p){this.payload=p;}};
 const env={storage:{getGA4DailyMetrics:async()=>{readCount++;if(readCount===1)throw Error('isolated first-query failure');return[row('2026-10-18')];}},campaignId:'fixture',campaign:{id:'fixture'},selectedConnection:{propertyId:'123',importStartDate:'2026-08-01'},startDate:'2026-08-20',endDate:'2026-10-18',dataThroughDate:'2026-10-18',reportingTimeZone:'UTC',days:60,readOnly:true,res,
  GA4_OVERVIEW_LEGACY_IMPORT_START_DATE:'2026-08-01',summarizeGA4TrafficRows:traffic.summarizeGA4TrafficRows,addDerivedEngagedSessions:traffic.addDerivedGA4EngagedSessions,
  buildFreshness:()=>({refreshIsStale:true}),getGA4DailyRefreshAttempt:()=>null,getLatestCompleteReportingDate:()=>{throw Error('Unexpected nonempty-first-read branch');},
 };
 const code=named('getLatestStoredDailyDate').getText(routes)+'\n'+named('addDateOnlyDays').getText(routes)+'\nconst run=async()=>{'+segment+'};';
 await new Function(...Object.keys(env),compile(code)+'\nreturn run();')(...Object.values(env));
 assert.equal(readCount,2);assert.equal(res.payload.success,true);assert.equal(res.payload.data.length,0);assert.equal(res.payload.schedulerCoverageComplete,false);assert.equal(res.payload.overviewTotals.sessions,100);
 const failedRows=derive(res.payload.data,'2026-10-01',res.payload.historyDataThroughDate||res.payload.dataThroughDate),failedRollups=insight.buildGA4InsightsRollups(failedRows,'2026-10-18');assert.equal(failedRows.length,18);assert.equal(failedRollups.last7.complete,true);assert.equal(failedRollups.last7.sessions,0);
 results.push({case:'First daily-window read fails but route returns success and client creates complete zero windows',readCount,api:{success:res.payload.success,dataRows:res.payload.data.length,schedulerCoverageComplete:res.payload.schedulerCoverageComplete,overviewSessions:res.payload.overviewTotals.sessions},client:{rows:failedRows.length,last7Sessions:failedRollups.last7.sessions,last7Complete:failedRollups.last7.complete}});
 const gapRows=Array.from({length:12},(_,i)=>row(insight.addGA4InsightsDateDays('2026-10-05',i))),filled=derive(gapRows,'2026-10-05','2026-10-18'),rollups=insight.buildGA4InsightsRollups(filled,'2026-10-18');
 assert.equal(rollups.last7.complete,true);assert.equal(rollups.prior7.complete,true);assert.equal(rollups.last7.sessions,500);assert.equal(rollups.prior7.sessions,700);assert.ok(rollups.deltas.sessions7 < -20);
 results.push({case:'Missing two dates become zero and a complete seven-day decline signal',inputRows:gapRows.length,filledRows:filled.length,last7:rollups.last7.sessions,prior7:rollups.prior7.sessions,deltaPct:rollups.deltas.sessions7,complete:rollups.last7.complete&&rollups.prior7.complete});
 const windowRows=Array.from({length:60},(_,i)=>row(insight.addGA4InsightsDateDays('2026-08-20',i))),history=derive(windowRows,'2026-01-01','2026-10-18'),monthly=insight.buildGA4InsightsMonthlySeries(history,'2026-10-18','sessions');
 const july=monthly.find(r=>r.month==='2026-07'),august=monthly.find(r=>r.month==='2026-08');assert.equal(july.value,0);assert.equal(july.partial,false);assert.equal(august.value,1200);assert.equal(august.partial,false);
 results.push({case:'Sixty-day response padded back to campaign creation creates apparently complete older zero months',responseWindow:{start:'2026-08-20',end:'2026-10-18',rows:60},campaignCreated:'2026-01-01',filledRows:history.length,july,august});
 fs.writeFileSync('docs/audits/v1-2026-10-19/insights-calendar-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact final real-data daily-handler block, exact client calendar derivation and shared rollup/monthly helpers. Storage and freshness-metadata decoration are fixtures; normal auth/provider selection and full React render not executed. No DB/provider/network mutation.',results},null,2)+'\n');console.log(`${results.length} Insights calendar cases executed`);
})().catch(e=>{console.error(e);process.exitCode=1;});
