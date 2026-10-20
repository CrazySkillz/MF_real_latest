const fs=require('node:fs'),path=require('node:path'),ts=require('typescript'),assert=require('node:assert/strict');
const dir='docs/audits/v1-2026-10-19',cache=new Map();
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function load(file){file=path.resolve(file);if(cache.has(file))return cache.get(file);const ex={};cache.set(file,ex);new Function('exports','require',compile(fs.readFileSync(file,'utf8')))(ex,id=>{const resolved=id.startsWith('@shared/')?path.resolve('shared',id.slice(8)):id.startsWith('@/')?path.resolve('client/src',id.slice(2)):id.startsWith('.')?path.resolve(path.dirname(file),id):null;return resolved?load(resolved+'.ts'):require(id);});return ex;}
const helper=load('client/src/lib/performance-recommended-actions.ts'),traffic=load('shared/ga4-traffic-window.ts'),period=load('shared/ga4-kpi-consumer-state.ts');
const source=fs.readFileSync('client/src/pages/campaign-performance.tsx','utf8'),sf=ts.createSourceFile('page.tsx',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
const decls=new Map();function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&n.initializer){const name=n.name.text;if(!decls.has(name))decls.set(name,n.initializer.getText(sf));}ts.forEachChild(n,walk);}walk(sf);
const stateNames=['performanceReportingTimeZone','performanceDataThroughDate','trafficInputState','nativeFinancialConversions','nativeRevenue','importedRevenue','hasNativeRevenue','hasImportedRevenue','revenueInputState','financialConversionsInputState','spendSummaryMetric','scoringSpendToDate','spendInputState'];
stateNames.forEach(n=>assert.ok(decls.has(n),n));
const base={demoMode:false,performanceGA4PropertyId:'fixture-property',performanceGA4FinancialEndDate:'2026-10-18',performanceSummary:{currentValueWindow:{dataThroughDate:'2026-10-18',reportingTimeZone:'UTC'},totals:{spend:{available:true,value:100}}},performanceGA4SummaryResponse:{dataThroughDate:'2026-10-18',reportingTimeZone:'UTC',overviewTotals:{users:2,sessions:100,conversions:10,pageviews:150,engagedSessions:50}},performanceGA4RevenueResponse:{native:{endDate:'2026-10-18',revenueMetric:'totalRevenue',totals:{revenue:300,conversions:10}},imported:{endDate:'2026-10-18',totalRevenue:0,sourceIds:[]}},performanceGA4SpendResponse:{endDate:'2026-10-18',spendToDate:100,sourceIds:['fixture-spend']}};
for(const n of ['performanceGA4ConnectionsLoading','performanceSummaryPending','performanceGA4SummaryLoading','performanceGA4SummaryPlaceholder','performanceGA4SummaryError','performanceGA4ConnectionsError','outcomeTotalsError','performanceGA4RevenueLoading','performanceGA4RevenuePlaceholder','performanceGA4RevenueError','performanceGA4SpendLoading','performanceGA4SpendPlaceholder','performanceGA4SpendError'])base[n]=false;
function states(env){return new Function(...Object.keys(env),compile(stateNames.map(n=>'const '+n+'='+decls.get(n)+';').join('\n')+'return {'+stateNames.join(',')+'};'))(...Object.values(env));}
function expr(name,env){return new Function(...Object.keys(env),compile('return ('+decls.get(name)+');'))(...Object.values(env));}
const results=[];
for(const [label,mutation,expected] of [
 ['Fresh aligned inputs',{},['ready','ready','ready','ready']],
 ['GA4 refresh explicitly stale',{performanceGA4SummaryResponse:{...base.performanceGA4SummaryResponse,refreshIsStale:true}},['stale','ready','ready','ready']],
 ['Revenue read error with retained data',{performanceGA4RevenueError:true},['ready','stale','stale','ready']],
 ['Spend read error with retained data',{performanceGA4SpendError:true},['ready','ready','ready','stale']],
 ['Summary transport error with retained data',{performanceGA4SummaryError:true},['stale','unavailable','stale','unavailable']],
]){
 const env={...base,...mutation},s=states(env);assert.deepEqual([s.trafficInputState,s.revenueInputState,s.financialConversionsInputState,s.spendInputState],expected);
 const row={name:'Revenue',metric:'revenue',targetValue:200,unit:'$',priority:'high'};
 const actions=helper.buildPerformanceRecommendedActions({kpis:[row],benchmarks:[],kpiListState:'ready',benchmarkListState:'ready',trafficState:s.trafficInputState,revenueState:s.revenueInputState,spendState:s.spendInputState,financialConversionsState:s.financialConversionsInputState,trafficTotals:env.performanceGA4SummaryResponse.overviewTotals,financialRevenue:300,financialSpend:100,financialConversions:10,currency:'USD'});
 const headline=expr('getGA4TotalRevenueMetric',{...env,...s})();
 if(label==='GA4 refresh explicitly stale'){assert.equal(headline.available,false);assert.equal(actions[0].type,'success');assert.match(actions[0].message,/Verified.*300/);}
 if(label==='Revenue read error with retained data'){assert.equal(actions[0].category,'blocked-targets');assert.equal(headline.available,false);}
 results.push({case:label,states:{traffic:s.trafficInputState,revenue:s.revenueInputState,conversions:s.financialConversionsInputState,spend:s.spendInputState},headline,actions});
}
const totals=traffic.summarizeGA4TrafficRows([{date:'2026-10-17',users:1,sessions:1},{date:'2026-10-18',users:1,sessions:1}]);assert.equal(totals.users,2);
const users=expr('getGA4SummaryMetric',{demoMode:false,trafficInputState:'ready',performanceGA4SummaryResponse:{overviewTotals:totals}})('users',0);assert.equal(users.value,2);
const card=source.slice(source.indexOf('<CardTitle className="text-sm font-medium">Total Users</CardTitle>'),source.indexOf('<CardTitle className="text-sm font-medium">Total Sessions</CardTitle>'));
assert.ok(card.includes('overviewUsers'));assert.ok(!/Tooltip|daily users|same user|deduplicat/i.test(card));
const overview=fs.readFileSync('client/src/pages/ga4-metrics.tsx','utf8');assert.ok(overview.includes('the same user may appear on more than one day'));
results.push({case:'Performance Total Users preserves daily sum without the GA4 Overview grain explanation',dailyUsers:[1,1],summaryTotal:totals.users,metric:users,cardHasGrainExplanation:false,ga4OverviewExplainsGrain:true,limitation:'No claim that these synthetic daily counts represent two distinct people. Deduplication cannot be recovered from aggregate rows.'});
for(const [label,input,expected] of [
 ['No configured targets',{configuredKpiCount:0,configuredBenchmarkCount:0,scoredKpiCount:0,scoredBenchmarkCount:0,kpisOnTrack:0,benchmarksOnTrack:0},null],
 ['One unavailable target suppresses health score',{configuredKpiCount:2,configuredBenchmarkCount:0,scoredKpiCount:1,scoredBenchmarkCount:0,kpisOnTrack:1,benchmarksOnTrack:0},null],
 ['Verified mixed health rounds ratio',{configuredKpiCount:2,configuredBenchmarkCount:1,scoredKpiCount:2,scoredBenchmarkCount:1,kpisOnTrack:1,benchmarksOnTrack:1},67],
]){const value=helper.resolvePerformanceHealthCoverage(input);assert.equal(value.healthScore,expected);results.push({case:label,input,value});}
const absolute=period.resolveGA4InsightTargetPeriodCompatibility({metric:'sessions',timeframe:'weekly',trackingPeriod:7});assert.equal(absolute.comparable,true);results.push({case:'Legacy weekly metadata retains intended absolute target semantics',value:absolute});
fs.writeFileSync(dir+'/performance-boundary-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',boundary:'Exact current page state expressions/card helpers and imported recommendation/health/traffic modules. API payloads are explicit synthetic fixtures; no browser, server, provider, database or report. These cases do not prove upstream publication truth or real occurrence.',results},null,2)+'\n');console.log(JSON.stringify({cases:results.length,allAssertionsPassed:true}));
