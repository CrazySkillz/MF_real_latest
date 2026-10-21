const fs=require('node:fs'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const d=__dirname,read=f=>JSON.parse(fs.readFileSync(f,'utf8').replace(/^\uFEFF/,''));
const previous=read('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/failure-reconciliation.json');
const prior=new Map(previous.failures.map(f=>[f.file+'|'+f.name,f]));
const initial=read(d+'/fallback-full-suite.json'),final=read(d+'/fallback-full-suitefinal.json');
function assertions(run){return run.testResults.flatMap(s=>{const file='server/'+s.name.replaceAll('\\','/').split('/server/').pop();return s.assertionResults.map(a=>({file,name:a.fullName,status:a.status,error:a.failureMessages?.[0]||''}));});}
const first=assertions(initial),last=assertions(final),lastMap=new Map(last.map(a=>[a.file+'|'+a.name,a]));
const retained=last.filter(a=>a.status==='failed').map(a=>{
 const old=prior.get(a.file+'|'+a.name);return {...a,id:old?.id,classification:old?.classification,releaseImpact:old?.releaseImpact,status:'FAILED; OPEN',waived:false};
});
const newFailures=retained.filter(a=>!a.id);
const initialNew=first.filter(a=>a.status==='failed'&&!prior.has(a.file+'|'+a.name)).map(a=>{
 const category=a.file.includes('conversion-precision')?'Synthetic provider fixture did not intercept legacy direct fetch; eight read requests with literal fixture token/property were rejected 401. Both transports are now mocked; final runner blocks external fetch/HTTP.':
 a.file.includes('financial-daily-snapshot-writer')||a.file.includes('ga4-derived-publication')?'Test exercised a deliberately reverted refund/currency correction; excluded from fallback composition, retained on main. This feature remains a known fallback limitation.':
 a.file.includes('custom-report')||a.file.includes('meta-production')?'Windows checkout CRLF disagreed with LF source-string assertions. Isolated source normalized to Git LF bytes; no semantic change.':
 'Query-key assertions expected the reverted currency fix. Restored the old query-key expectations while retaining precision assertions.';
 return {id:'FALLBACK-TEST-'+crypto.createHash('sha256').update(a.file+'|'+a.name).digest('hex').slice(0,10),file:a.file,name:a.name,classification:category,finalStatus:lastMap.get(a.file+'|'+a.name)?.status||'not part of fallback; nonprecision feature intentionally reverted'};
});
const files=read('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/precision-coverage.json').files;
const coverage=last.filter(a=>files.includes(a.file));
const summary={at:new Date().toISOString(),boundary:'Exact isolated fallback, not the main candidate or whole-app certification. All unresolved tests remain release blockers.',
 initial:{total:initial.numTotalTests,passed:initial.numPassedTests,failed:initial.numFailedTests,pending:initial.numPendingTests},
 final:{total:final.numTotalTests,passed:final.numPassedTests,failed:final.numFailedTests,pending:final.numPendingTests},
 newFailures,initialNew,failures:retained,precisionCoverage:{files,passed:coverage.filter(a=>a.status==='passed').length,failed:coverage.filter(a=>a.status==='failed').length,pending:coverage.filter(a=>!['passed','failed'].includes(a.status)).length},
 suiteErrors:final.testResults.filter(s=>s.status==='failed'&&!s.assertionResults.some(a=>a.status==='failed')).map(s=>({name:s.name,message:s.message})),
 harnessSetupFailure:'The first guarded launch failed before tests ran because Windows backslashes in NODE_OPTIONS were parsed as escapes; forward-slash preload path corrected. Log retained.',
 timestampEvidenceCorrection:'production-preflight.json used the local pg driver Date conversion for timestamp-without-time-zone values. production-before.json preserves raw database timestamp text and records UTC database timezone; earlier numeric/configuration observations are unchanged.'};
fs.writeFileSync(d+'/fallback-final-reconciliation.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({initial:summary.initial,final:summary.final,precisionCoverage:summary.precisionCoverage,newFailures:newFailures.map(a=>({file:a.file,name:a.name,error:a.error.slice(0,200)})),suiteErrors:summary.suiteErrors},null,2));
assert.equal(newFailures.length,0);assert.equal(summary.precisionCoverage.failed,0);assert.equal(summary.precisionCoverage.pending,0);assert.equal(summary.suiteErrors.length,0);assert.equal(final.numPendingTests,0);
