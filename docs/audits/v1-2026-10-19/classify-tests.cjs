const fs = require('node:fs');
const crypto = require('node:crypto');
const root = 'docs/audits/v1-2026-10-19/';
const j = JSON.parse(fs.readFileSync(root+'tests-controlled.json','utf8'));
const rows = [];
const normalize = s=>s.replace(/\\/g,'/').replace(/^.*?MF_real_latest\//,'');
for(const file of j.testResults) for(const a of file.assertionResults) if(a.status==='failed') {
  const path=normalize(file.name), message=a.failureMessages.join('\n');
  const loc=message.match(new RegExp(path.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+':(\\d+):(\\d+)'));
  const line=loc?Number(loc[1]):null;
  const at=line?fs.readFileSync(path,'utf8').split(/\r?\n/)[line-1]?.trim():'';
  let classification, reason;
  if(path.endsWith('notification-alert-postgres-concurrency.test.ts')) {
    classification='FIXTURE_CONTRACT'; reason='Default 5s timeout masked missing storage.getGA4PublicationVersion mock. Isolated 15s diagnostic exposes TypeError at benchmark-notifications.ts:98. Intended Benchmark contention is not exercised.';
  } else if(/(hubspot|salesforce)-pipeline-automation-ui/.test(path) && /getRevenueSources/.test(message.split('\n')[0])) {
    classification='FIXTURE_CONTRACT'; reason='Fixture campaign is {id: campaign-1} with no status. Current auto-refresh-scheduler.ts:967/1007 filters active campaigns; the fixture is skipped before source lookup. Re-exercise intended stage/provenance behavior with valid campaign fixture.';
  } else if(path.endsWith('ga4-source-lifecycle-recompute-regression.test.ts') && line===115) {
    classification='STRUCTURAL_ASSERTION'; reason='String search finds later recalcCampaignSpend(campaignId) rather than current GA4 branch recalcCampaignSpend(campaignId, refreshWriteInput) at routes-oauth.ts:7166. Current branch recomputes afterward at7167. Intended ordering still needs behavioral coverage for both branches.';
  } else if(!/to contain/.test(message.split('\n')[0]) && /tx\.select is not a function|db\.select is not a function|\.orderBy is not a function|\.for is not a function|db\.selec|tx\.select\(\.\.\.\)\.from\(\.\.\.\)\.where/.test(message)) {
    classification='FIXTURE_CONTRACT'; reason='Mock transaction/query chain cannot execute current storage locking/version path. The intended rollback/delete assertion remains unproved by this failing test.';
  } else if(/getInternalGA4RefreshWriteInput is not defined/.test(message)) {
    classification='FIXTURE_BINDING'; reason='Extracted-handler new Function fixture omits helper imported by runtime routes-oauth.ts:51. This failure does not demonstrate a missing runtime import.';
  } else if(/ga4-(aggregate-saved-overview|kpi-custom|kpi-financial|kpi-real-path|kpi-reporting-window)|shopify-downstream-content|salesforce-pipeline-automation/.test(path) && !/to contain|routeSection|to be greater than|to be less than/.test(message.split('\n')[0])) {
    classification='BEHAVIOR_ASSERTION_WITH_INCOMPLETE_FIXTURE'; reason='Current jobs read GA4 publication version before work (ga4-kpi-benchmark-jobs.ts:264; scheduler.ts:784). These fixture families omit that contract. Repair the fixture then re-evaluate expected output; do not declare runtime behavior correct from this classification.';
  } else if(/routeSection|extractRoute/.test(message.slice(0,1300)) || /expected -1 to be greater|expected .* to be less than -1/.test(message.split('\n')[0])) {
    classification='SOURCE_EXTRACTION'; reason='Source-slicing/order assertion cannot locate its expected boundary. Must map to current AST handler/function and retain the underlying intended safety requirement.';
  } else if(/to contain|to match \/|not to match \/|\.toContain\(|\.toMatch\(/.test(message.split('\n')[0]+' '+at)) {
    classification='STRUCTURAL_ASSERTION'; reason='Assertion compares current source text/shape. A changed string is neither proof of a runtime defect nor permission to waive the intended invariant. Behavioral replacement/confirmation required.';
  } else {
    classification='BEHAVIOR_OR_ORDER_ASSERTION_UNRESOLVED'; reason='Current expected/actual mismatch requires individual fixture and implementation trace. Kept as an open regression gate; no baseline waiver.';
  }
  rows.push({id:'TEST-'+crypto.createHash('sha256').update(path+'\n'+a.fullName).digest('hex').slice(0,10),file:path,line,name:a.fullName,classification,reason,assertion:at,firstFailure:message.split('\n')[0],status:'OPEN',finding:'V1-012'});
}
rows.sort((a,b)=>a.file.localeCompare(b.file)||a.name.localeCompare(b.name));
fs.writeFileSync(root+'test-failures.json',JSON.stringify(rows,null,2)+'\n');
const cell=s=>String(s??'').replace(/\|/g,'\\|').replace(/\r?\n/g,' ').replace(/`/g,"'");
const counts={};for(const r of rows)counts[r.classification]=(counts[r.classification]||0)+1;
let md='# Current automated validation\n\nRevision: `777aae6f6353e998d60b635d3e66b413093117c2`. Runtime/test files were not changed. All failures remain open under V1-012. Categories describe the observed failure mechanism and do not waive the requirement.\n\n';
md+='## Executed checks\n\n| Check | Result / boundary |\n|---|---|\n';
md+='| TypeScript `npm run check` | PASS; [log](typecheck.log). |\n| Production `npm run build` | PASS; [log](build.log). Initial sandbox child-process EPERM was an environment failure; approved repeat succeeded. Largest JS chunks approximately 651KB index, 591KB PDF, 575KB charts before gzip. No realistic load or slow-device claim. |\n';
md+='| First full `npm test` | FAIL: 181 failed, 3093 passed, 697 skipped across 319 files. PowerShell npm wrapper dropped worker/reporter options. Database tests skipped because no isolated URL was set. Also worker teardown timeout and an unhandled test-cleanup error. Raw large log moved to audit-temp/v1-tests-full-2026-10-19.log; not the authoritative controlled result. |\n';
md+='| Full controlled run | FAIL: **3789 passed / 182 failed / 0 skipped, 3971 tests in 319 files (60 failing files)**. Direct Node Vitest CLI, forks, maxWorkers=2; both isolated PostgreSQL databases enabled. [Full JSON](tests-controlled.json). Vitest suite counters include nested describes and must not be called file counts. JSON reporter does not include a separate unhandled-error ledger; exit was 1. |\n';
md+='| PostgreSQL-focused packet | 697 passed / 1 failed / 0 skipped (698). [JSON](tests-postgres.json). Local PostgreSQL 18, 127.0.0.1:55442, ga4_alignment_test and notifications_test; test schemas isolated. Application DATABASE_URL cleared. No application database touched. |\n';
md+='| Benchmark concurrency diagnostic | 1 passed / 1 failed; [JSON](tests-notification-diagnostic.json). Increasing only CLI testTimeout to 15000 reveals missing mock getGA4PublicationVersion; the original 5s fixture polling masked it. This is not a passing Benchmark concurrency proof. |\n';
md+='| Current extracted-handler reproductions | 10 confirmed, [evidence](reproductions.json): unauthorized reads/writes, unsigned conversion/currency/zero, missing inbound signature, mock email, startup fabricated writes, nonexclusive report retry claim. Only fixtures, no live mutations. |\n';
md+='| Client-deletion concurrent insert | Confirmed orphan with successful delete using the exact extracted storage method against disposable PostgreSQL schema; [evidence](client-delete-race.json). No production database. |\n';
md+='| Existing section certification integrity commands | Overview, KPI, Ad Comparison, Insights and Reports all exit0. Current JSON records say UNVERIFIED. These checks prove record consistency, not release acceptance. Logs: gate-overview.log, gate-kpi.log, gate-ad-comparison.log, gate-insights.log, gate-reports.log. |\n';
md+='| Public deployment HTTP/browser | Correct host and SHA; anonymous global data exposed; protected Clients/Campaigns APIs return 401; protected page redirects; signup Sign in link loops. Fresh signed-out Chromium, only read methods permitted. [HTTP](public-smoke.json), [browser](browser-smoke.json). |\n';
md+='| Provider/deployment/destructive/load tests | Not run against production. Remaining gates in [scope matrix](SCOPE_AND_VALUES.md) and [operations](OPERATIONS_AND_TEMPLATE.md). Default Playwright host is stale and shared test campaign is unsafe for destructive tests. |\n';
md+='| npm vulnerability advisory lookup | BLOCKED by automatic approval review; user did not provide informed authorization. No results claimed; no substitute outbound dependency upload attempted. |\n\n';
md+='## Failure classification totals\n\n| Class | Count |\n|---|---|\n';for(const [k,v] of Object.entries(counts))md+=`| ${k} | ${v} |\n`;
md+='\nClassification is provisional where the runtime/fixture root cause is unresolved. Every failure identity and the exact failed assertion line are retained in [test-failures.json](test-failures.json); full expected/actual/stack evidence stays in the controlled result. IDs are hashes of file + full test name and survive reordering.\n\n## All failing assertions\n\n| Stable ID | Test / exact assertion location | Class | First failure |\n|---|---|---|---|\n';
for(const r of rows)md+=`| ${r.id} | [${r.file}${r.line?':'+r.line:''}](../../../${r.file}${r.line?'#L'+r.line:''}) - ${cell(r.name)} | ${r.classification} | ${cell(r.firstFailure)} |\n`;
md+='\n## File coverage (all 319 files)\n\nPass counts only establish each file\'s actual assertions. Source-text checks, fake providers, fixture browsers, and real isolated PostgreSQL tests are different evidence levels. None authenticates a new real customer at the deployed provider.\n\n| File | Pass | Fail | Skip |\n|---|---:|---:|---:|\n';
for(const f of j.testResults) {const p=normalize(f.name);md+=`| [${p}](../../../${p}) | ${f.assertionResults.filter(a=>a.status==='passed').length} | ${f.assertionResults.filter(a=>a.status==='failed').length} | ${f.assertionResults.filter(a=>!['passed','failed'].includes(a.status)).length} |\n`;}
fs.writeFileSync(root+'VALIDATION.md',md);
console.log(JSON.stringify({failures:rows.length,classes:counts,files:j.testResults.length}));
