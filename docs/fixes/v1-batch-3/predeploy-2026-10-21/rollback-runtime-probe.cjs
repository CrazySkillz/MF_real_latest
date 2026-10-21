// Execute exact old/current pure calculation bodies. No app, database or network.
const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict'),ts=require('typescript'),{execFileSync}=require('node:child_process');
const baseline='839bf508bffea4742f992616753dc68eabcfab3e',candidate='001ddfa87c445a51e63320cde9737b774aa1af0c';
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const result={at:new Date().toISOString(),baseline,candidate,boundary:'Actual extracted provider merge and actual shared live KPI modules with their shared dependencies; synthetic inputs only. This is a negative rollback check, not full rollback acceptance.',revisions:[]};
for(const rev of [baseline,candidate]){
 const cache=new Map(),hashes={};
 function source(file){const s=execFileSync('git',['show',rev+':'+file],{encoding:'utf8',windowsHide:true});hashes[file]=crypto.createHash('sha256').update(s).digest('hex');return s;}
 function load(file){assert.ok(['shared/metric-math.ts','shared/ga4-kpi-metric-identity.ts','shared/ga4-kpi-live-value.ts'].includes(file));if(cache.has(file))return cache.get(file);const exported={};cache.set(file,exported);new Function('exports','require',compile(source(file)))(exported,name=>load('shared/'+name.replace(/^\.\//,'')+'.ts'));return exported;}
 const text=source('server/analytics.ts'),sf=ts.createSourceFile('analytics.ts',text,99,true);let method;
 function visit(n){if(ts.isMethodDeclaration(n)&&n.name.getText(sf)==='mergeDailyConversionRevenueTotals')method=n.getText(sf);ts.forEachChild(n,visit);}visit(sf);assert.ok(method);
 const merge=new Function(compile('class Probe {'+method+'};return new Probe();'))().mergeDailyConversionRevenueTotals;
 const live=load('shared/ga4-kpi-live-value.ts').resolveGA4KpiLiveValue;
 const observations=[];
 for(const credit of [0,0.75,0.000075,2]){
  const row={dimensionValues:[{value:'20261020'}],metricValues:[{value:String(credit)},{value:'100'}]};
  const providerMerge=merge({rows:[row]},{rows:[]},0,1,0,1).conversions;
  const liveKpi=Number(live({kpi:{metric:'conversions'},breakdownTotals:{conversions:credit}}));
  assert.equal(providerMerge,rev===baseline?Math.trunc(credit):credit);assert.equal(liveKpi,rev===baseline?Math.round(credit):credit);
  observations.push({credit,providerMerge,liveKpi});
 }
 result.revisions.push({revision:rev,sourceSha256:hashes,observations});
}
result.result='PASS: old runtime precision loss reproduced; candidate preserves tested values';
result.rollbackAcceptance='OPEN: startup-only patch is insufficient; retain validated precision read/write/consumer changes in any application rollback.';
fs.writeFileSync('docs/fixes/v1-batch-3/predeploy-2026-10-21/rollback-runtime-probe.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
