const fs=require('node:fs'),ts=require('typescript'),assert=require('node:assert/strict');
const dir='docs/audits/v1-2026-10-19/',file='client/src/pages/google-ads-analytics.tsx';
const sf=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),99,true),named=new Map();
function walk(n){if(ts.isVariableDeclaration(n)&&ts.isIdentifier(n.name)&&!named.has(n.name.text))named.set(n.name.text,n);ts.forEachChild(n,walk);}walk(sf);
const transpile=code=>ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
function value(name,env={}){return new Function(...Object.keys(env),transpile(`const ${named.get(name).getText(sf)};`)+`\nreturn ${name};`)(...Object.values(env));}
const results=[];
const row=(date)=>({date,impressions:1000,clicks:10,conversions:2,spend:50,conversionValue:100,ctr:1});
const sparse=Array.from({length:14},(_,i)=>row(`2026-09-${String(1+i*2).padStart(2,'0')}`));
const series=value('dailySeries',{chartData:sparse,useMemo:fn=>fn()});
const rollups=value('insightsRollups',{dailySeries:series,useMemo:fn=>fn()});
assert.equal(rollups.availableDays,14);assert.equal(rollups.last7.days,7);
assert.equal(rollups.last7.startDate,'2026-09-15');assert.equal(rollups.last7.endDate,'2026-09-27');
assert.equal(series.rolling7.length,8);
results.push({case:'Fourteen observations over27 calendar dates enable two seven-row comparisons',availableDays:rollups.availableDays,last7:rollups.last7,prior7:rollups.prior7,calendarSpanOfLast7:13});
const complete=Array.from({length:14},(_,i)=>row(`2026-09-${String(1+i).padStart(2,'0')}`));
const completeSeries=value('dailySeries',{chartData:complete,useMemo:fn=>fn()});
const completeRollups=value('insightsRollups',{dailySeries:completeSeries,useMemo:fn=>fn()});
assert.equal(completeRollups.last7.startDate,'2026-09-08');assert.equal(completeRollups.last7.endDate,'2026-09-14');
results.push({case:'Contiguous-date control aligns seven rows with seven calendar dates',last7Start:completeRollups.last7.startDate,last7End:completeRollups.last7.endDate});
const partial=value('insightsRollups',{dailySeries:{daily:[row('2026-09-27')]},useMemo:fn=>fn()});
assert.equal(partial.last7.days,1);assert.equal(partial.deltas.conversions7,100);
results.push({case:'Partial latest period versus absent prior generates100% deltas before narrative volume gates',days:partial.last7.days,priorDays:partial.prior7.days,delta:partial.deltas.conversions7,limit:'This does not prove WoW narratives render; they separately require14 observations.'});
const summary=value('summary',{metrics:[{...row('2026-09-27'),clicks:0,conversions:0,spend:'100',conversionValue:'0',videoViews:0}],useMemo:fn=>fn()});
const lower=value('LOWER_IS_BETTER_METRICS');
const progress=value('computeProgress',{LOWER_IS_BETTER_METRICS:lower});
const live=value('getLiveMetricValue',{summary,hasGoogleAdsAttributedRevenue:false,googleAdsAttributedRevenue:0,googleAdsAttributedProfit:0,googleAdsAttributedRoas:0,googleAdsAttributedRoi:0});
const p=progress(live('cpc'),2,'cpc');
assert.equal(live('cpc'),0);assert.equal(p.pct,Infinity);assert.equal(p.status,'on_track');
results.push({case:'Spend100/no clicks becomes CPC0 and infinite on-track progress',current:live('cpc'),target:2,pct:'Infinity',status:p.status});
const missingFinancial=live('totalRevenue');assert.equal(missingFinancial,0);
results.push({case:'No attributed Revenue source becomes numeric0 for target scoring',current:missingFinancial,availabilityReturned:false});
const invalid=progress(0,0,'cpc');assert.equal(invalid.status,'unknown');
results.push({case:'Zero-target control returns unknown; tracker maps all other non-on-track/non-attention statuses to behind',result:invalid});
const finite=progress(1,2,'cpc');assert.equal(finite.pct,200);assert.equal(finite.status,'on_track');
results.push({case:'Finite cost denominator control produces expected lower-is-better score',result:finite});
const ruleNode=named.get('googleAdsInsights'),rules=[];
function scan(n){
  if(ts.isCallExpression(n)&&n.expression.getText(sf)==='all.push'&&ts.isObjectLiteralExpression(n.arguments[0])){
    const fields=Object.fromEntries(n.arguments[0].properties.filter(ts.isPropertyAssignment).map(p=>[p.name.getText(sf),p.initializer.getText(sf)]));
    const conditions=[];let child=n,parent=n.parent;
    while(parent&&parent!==ruleNode){if(ts.isIfStatement(parent))conditions.unshift(parent.elseStatement===child ? `!(${parent.expression.getText(sf)})` : parent.expression.getText(sf));child=parent;parent=parent.parent;}
    rules.push({line:sf.getLineAndCharacterOfPosition(n.getStart(sf)).line+1,conditions,...fields});
  }
  ts.forEachChild(n,scan);
}
scan(ruleNode);
fs.writeFileSync(dir+'google-ads-insight-rule-catalog.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',file,boundary:'Exact current enclosing branch conditions/output expressions, including else negation. Loop continue/early-return and sibling-flag effects require the complete expression retained here. Source inventory, not rendered/provider narrative certification.',completeExpression:ruleNode.initializer.getText(sf),rules},null,2)+'\n');
fs.writeFileSync(dir+'google-ads-value-reproductions.json',JSON.stringify({head:'777aae6f6353e998d60b635d3e66b413093117c2',at:new Date().toISOString(),boundary:'Exact current page declarations with synthetic metrics and immediate useMemo. No UI framework state, live provider, storage, email or production.',results},null,2)+'\n');
console.log(JSON.stringify({cases:results.length,rules:rules.length}));
for(const r of rules)console.log(JSON.stringify({line:r.line,id:r.id,title:r.title,conditions:r.conditions}));
