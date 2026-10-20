// Exact current server PDF module, real jsPDF, synthetic saved publications only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),ts=require('typescript');
const dir='docs/audits/v1-2026-10-19',fixedNow='2026-10-19T12:00:00.000Z';
class AuditDate extends Date { constructor(...args){super(...(args.length?args:[fixedNow]));}static now(){return Date.parse(fixedNow);} }
let fixture;const calls=[];
const methods={
 getCampaign:()=>fixture.campaign,getGA4Connections:()=>[fixture.connection],
 getGA4DailyMetrics:(_id,_property,start,end)=>fixture.rows.filter(r=>r.date>=start&&r.date<=end),
 getGA4OverviewSnapshot:()=>fixture.overview,getLatestFinancialDailySnapshot:()=>fixture.financial,
 getPlatformKPIs:()=>[],getPlatformBenchmarks:()=>{if(fixture.failBenchmarks)throw Error('isolated Benchmark read failure');return[];},getRevenueSources:()=>[],getSpendSources:()=>[],
 getRevenueBreakdownBySource:()=>[],getSpendBreakdownBySource:()=>[],
};
const storage=new Proxy({}, {get:(_t,key)=>{assert.ok(methods[key],`Unexpected storage method ${String(key)}`);return async(...args)=>{calls.push({method:key,args});return methods[key](...args);};}});
const ga4Service=new Proxy({}, {get:(_t,key)=>()=>{throw Error(`Unexpected provider call ${String(key)}`);}});
const cache=new Map();
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file).exports;
 const module={exports:{}};cache.set(file,module);let source=fs.readFileSync(file,'utf8');
 if(file.endsWith('ga4-scheduled-report-pdf.ts'))source+='\nexport { buildGA4ReportPayload };';
 const code=ts.transpileModule(source.replaceAll('import.meta.dirname',JSON.stringify(path.dirname(file))),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 const localRequire=id=>{if(file.endsWith('ga4-scheduled-report-pdf.ts')&&id==='./storage')return{storage};if(file.endsWith('ga4-scheduled-report-pdf.ts')&&id==='./analytics')return{ga4Service};
  if(id.startsWith('.')){const target=path.resolve(path.dirname(file),id.replace(/\.js$/,'.ts'));return load(fs.existsSync(target)?target:target+'.ts');}return require(id);};
 new Function('module','exports','require','Date',code)(module,module.exports,localRequire,AuditDate);return module.exports;
}
const pdf=load('server/ga4-scheduled-report-pdf.ts');
const clientAst=ts.createSourceFile('ga4-metrics.tsx',fs.readFileSync('client/src/pages/ga4-metrics.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const thresholds={};let trendBranch;
function visit(n){if(ts.isVariableDeclaration(n)&&/^(ANOMALY_|POSITIVE_)/.test(n.name.getText(clientAst)))thresholds[n.name.getText(clientAst)]=Number(n.initializer.getText(clientAst));
 if(ts.isIfStatement(n)&&n.expression.getText(clientAst)==='sevenDayComparisonReady')trendBranch=n.getText(clientAst);ts.forEachChild(n,visit);}visit(clientAst);assert.ok(trendBranch);
function clientTrendFindings(rows){const out=[],findingRollups=load('shared/ga4-insights.ts').buildGA4InsightsRollups(rows,'2026-10-18');
 const env={out,findingRollups,sevenDayComparisonReady:findingRollups.last7.complete&&findingRollups.prior7.complete,findingChannelAnalysis:null,formatNumber:v=>String(v),formatPct:v=>`${v}%`,formatMoney:v=>`EUR ${v}`,...thresholds};
 const code=ts.transpileModule(trendBranch,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
 new Function(...Object.keys(env),code)(...Object.values(env));return out.map(item=>item.title);
}
function setFixture(name,start,rows,detailRows=false){
 const campaign={id:'v1-pdf-fixture',name,currency:'EUR',reportingTimeZone:'Europe/Amsterdam',ga4CampaignFilter:'saved_campaign',startDate:start,createdAt:start};
 const connection={id:'v1-pdf-connection',campaignId:campaign.id,propertyId:'properties/987654',method:'access_token',accessToken:'fixture-not-a-credential',isPrimary:true,lookbackDays:30,importStartDate:start};
 const totals=rows.reduce((t,r)=>{for(const key of ['sessions','users','conversions','revenue','engagedSessions','pageviews'])t[key]=(t[key]||0)+r[key];return t;},{});
 const campaignRows=[{campaignName:'saved_campaign',campaign:'saved_campaign',...totals,sessionKeyEventRate:totals.sessions>0?totals.conversions/totals.sessions:0}];
 const overview={campaignId:campaign.id,propertyId:connection.propertyId,windowStart:start,windowEnd:'2026-10-18',updatedAt:fixedNow,
  campaignBreakdown:{rows:campaignRows,totals,meta:{currencyCode:'EUR',revenueMetric:'totalRevenue'}},
  landingPages:{rows:detailRows?Array.from({length:26},(_,i)=>({landingPage:`/international-products/a-very-long-campaign-specific-landing-page-name-${i+1}`,sessions:10,users:8,conversions:2.5,revenue:40,engagedSessions:7,engagementRate:0.7})):[]},
  conversionEvents:{rows:detailRows?Array.from({length:26},(_,i)=>({eventName:`conversion_event_with_long_descriptive_name_${String(i+1).padStart(2,'0')}`,conversions:2.5,eventCount:20,users:10})):[]}};
 const financial={campaignId:campaign.id,reportingDate:'2026-10-18',metrics:{financialDaily:{version:'financial_daily_snapshot_v1',currency:'EUR',currentValueWindow:{mode:'initial_import_to_latest_completed_day',startDate:start,endDate:'2026-10-18',dataThroughDate:'2026-10-18',reportingTimeZone:'Europe/Amsterdam'},inputs:{spend:{available:false,value:null,sources:[]},revenue:{available:true,value:String(totals.revenue),sources:['ga4']},conversions:{available:true,value:totals.conversions,sources:['ga4']}}}}};
 fixture={campaign,connection,overview,financial,rows};
}
const row=(date,sessions=100,conversions=10,revenue=100)=>({date,sessions,users:sessions*0.8,conversions,revenue,engagedSessions:sessions/2,pageviews:sessions*2,updatedAt:fixedNow});
async function render(file,type,configuration){const report={id:'v1-render-fixture',campaignId:fixture.campaign.id,platformType:'google_analytics',name:'Isolated V1 audit fixture',reportType:type,configuration};
 const payload=await pdf.buildGA4ReportPayload(report);
 const bytes=await pdf.buildGA4ScheduledPdfAttachment({report,reportName:report.name,windowStart:fixture.connection.importStartDate,windowEnd:'2026-10-18',campaignName:fixture.campaign.name});
 assert.ok(Buffer.isBuffer(bytes));assert.equal(bytes.subarray(0,5).toString(),'%PDF-');fs.writeFileSync(path.join(dir,file),bytes);
 return{payload,result:{file,bytes:bytes.length,days:payload.insightsRollups.availableDays,findings:payload.insightsItems.map(i=>({title:i.title,description:i.description})),storageCalls:calls.splice(0)}};
}
(async()=>{const results=[];
 const longRows=Array.from({length:45},(_,i)=>row(new Date(Date.UTC(2026,8,i+4)).toISOString().slice(0,10)));
 setFixture('International expansion campaign with a deliberately long descriptive title for layout verification', '2026-09-04',longRows,true);
 const detail=await render('pdf-overview-long-fixture.pdf','custom',JSON.stringify({sections:{overview:true},subsections:{overview:{summary:true,landingPages:true,conversionEvents:true}}}));
 results.push({case:'Real PDF saved Overview with long campaign, landing page and event labels',...detail.result});
 const sixRows=Array.from({length:6},(_,i)=>row(`2026-10-${13+i}`,i<3?100:0,i<3?10:0,i<3?100:0));
 setFixture('Six completed days with complete three-day decline','2026-10-13',sixRows);
 const six=await render('pdf-insights-six-days-fixture.pdf','insights');
 assert.equal(six.payload.insightsRollups.deltas.sessions3,-100);assert.deepEqual(six.payload.insightsItems.map(i=>i.title),['No major anomalies detected']);
 const sixClient=clientTrendFindings(sixRows);assert.ok(sixClient.length>0);
 results.push({case:'Full valid six-day publication loses the complete three-day decline in server Insights',sessions3Delta:six.payload.insightsRollups.deltas.sessions3,clientTrendFindings:sixClient,...six.result});
 const rateRows=Array.from({length:14},(_,i)=>row(`2026-10-${String(5+i).padStart(2,'0')}`,i<7?100:200,10,100));
 setFixture('Fourteen completed days with conversion-rate decline','2026-10-05',rateRows);
 const rates=await render('pdf-insights-rate-fixture.pdf','insights');
 assert.equal(rates.payload.insightsRollups.prior7.cr,10);assert.equal(rates.payload.insightsRollups.last7.cr,5);
 assert.deepEqual(rates.payload.insightsItems.map(i=>i.title),['No major anomalies detected']);
 const rateClient=clientTrendFindings(rateRows);assert.ok(rateClient.some(title=>title.startsWith('Conversion rate dropped')));
 results.push({case:'Full valid fourteen-day publication loses conversion-rate decline in server Insights',prior7ConversionRate:10,last7ConversionRate:5,clientTrendFindings:rateClient,...rates.result});
 fixture.failBenchmarks=true;
 await assert.rejects(()=>pdf.buildGA4ReportPayload({campaignId:fixture.campaign.id,reportType:'insights'}),/isolated Benchmark read failure/);
 results.push({case:'Positive control: Insights-only report rejects Benchmark storage failure',rejected:true,storageCalls:calls.splice(0)});
 fs.writeFileSync(path.join(dir,'report-pdf-reproductions.json'),JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',at:new Date().toISOString(),fixedNow,boundary:'Complete current server module and real jsPDF. Extra fixture-only export exposes the unchanged payload builder; import.meta.dirname and Date receive equivalent deterministic host bindings. Storage responses are synthetic coherent saved native and financial publications. Provider calls throw. No DB, email or external network. Rendering is separate; browser report output and real-provider parity remain unverified.',results},null,2)+'\n');
 console.log(`${results.length} report cases executed; three real server PDF fixtures generated`);
})().catch(e=>{console.error(e);process.exitCode=1;});
