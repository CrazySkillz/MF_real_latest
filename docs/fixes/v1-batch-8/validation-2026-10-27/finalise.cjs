// Bind each historical failure to an executed assertion, with explicit rename receipts.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const root = process.cwd().replaceAll('\\', '/') + '/';
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name)));
const old = read('../validation-2026-10-26/consolidated-reconciliation.json');
const runs = ['consolidated', 'precision-isolated'];
const files = new Map();
const errors = [];
for (const run of runs) {
  const result = read(`${run}.json`), receipt = read(`${run}-run-errors.json`);
  if (receipt.reason !== 'passed' || receipt.errors.length || !result.success || result.numFailedTestSuites || result.numPendingTests || result.numTodoTests) throw Error(`Incomplete run: ${run}`);
  for (const file of result.testResults) {
    const name = file.name.replaceAll('\\', '/').replace(root, '');
    if (files.has(name)) throw Error(`Duplicate suite: ${name}`);
    files.set(name, file);
  }
  const execution = read(`${run}-execution.json`);
  if (!execution.stopped || execution.changedTrackedFiles.length || execution.databases.some(db => db.schemas.length || db.publicTables.length || db.other_sessions)) throw Error(`Unsafe execution: ${run}`);
  if (execution.checks.some(check => check.exitCode !== 0 || check.error)) throw Error(`Failed execution: ${run}`);
  for (const [file, hash] of Object.entries(execution.beforeHashes)) {
    if (!file.startsWith('docs/') && createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash) throw Error(`Source changed after execution: ${file}`);
  }
  errors.push({ run, receipt });
}
const renames = {
  'B8-TEST-9450c2ea5e': 'dates saved GA4 source truth to its latest row within the selected completed window',
  'TEST-02680176f2': 'retains last-good rows with publication updates and fallback focus, reconnect, and interval refresh',
  'TEST-0619d2cd62': 'uses publication updates and fallback polling without cross-scope placeholder data',
  'TEST-8eb70be184': 'uses publication updates and fallback polling without cross-scope placeholder data',
  'B8-TEST-715d26a372': 'keeps GA4 aggregate and automatic financial snapshots scoped through the shared writer',
  'B8-TEST-b5540ff620': 'keeps unavailable automatic Sheets goals out of Google Ads reads and preserves their saved value',
  'TEST-38efd9dbb2': 'retains the guarded Instagram card definition while the GA4-first list excludes it',
  'TEST-649cf82c47': 'returns the Create Campaign confirm Back button to the immediately preceding setup step',
  'B8-TEST-01ddf9e593': "requires materialization regardless of connection date without changing another platform's completeness policy",
};
const causes = {
  'alert-disabled-save-latency-regression': 'Notification metadata is now a SQL merge preserving resolved history, not a JSON string. Compile the merge and assert its guard and patch.',
  'ga4-alert-publication-retention': 'Notification metadata is now a SQL merge preserving resolved history, not a JSON string. Compile the merge and assert its guard and patch.',
  'csv-revenue-transaction': 'Rollback fixture lacked the campaign lock query before the intended failure stage.',
  'ga4-overview-spend-transaction': 'Replacement fixture lacked campaign lock and optional publication-table discovery.',
  'revenue-source-delete-transaction': 'Delete fixture lacked campaign lock, required publication table discovery and empty work reads; source/record rollback and conflict checks retained.',
  'google-sheets-ga4-disconnect-transaction': 'Ordinal query fixture counted the added campaign lock as a source read; dispatch lock/work reads by table while retaining source mutation checks.',
  'google-sheets-ga4-spend-disconnect-transaction': 'Ordinal query fixture counted the added campaign lock as a source read; dispatch the lock separately and model optional publication-table discovery.',
  'ga4-kpi-persistence-destructive-safety': 'Delete now reads its parent before the transaction and locks the campaign. Fixture lacked both query shapes.',
  'ga4-benchmark-persistence-destructive-safety': 'Delete now reads its parent before the transaction and locks the campaign. Fixture lacked both query shapes.',
  'ga4-benchmark-history-idempotency': 'History writer now checks the current Benchmark before its existing transaction; mock lacked that read.',
  'ga4-published-reader': 'Extracted route lacked the imported getInternalGA4RefreshWriteInput binding.',
  'ga4-kpi-custom-preservation-regression': 'Job fixture lacked the publication-version read and expected pre-version write arguments.',
  'ga4-refresh-pipeline-source-failure': 'Report dispatcher now awaits pending-delivery rows before checking scheduled reports; mock supported only a chained limit query.',
  'google-ads-goal-values': 'Sheets has its own automatic resolver; absent source facts preserve the saved value with unavailable eligibility rather than identity passthrough. No Ads reads asserted.',
  'v1-batch3-revenue-contracts': 'Expectation used the superseded connection-date eligibility rule; current sale-date contract requires materialization irrespective of connection date.',
  'v1-batch3-shared-cancellation': 'Cancellation fixture campaign lacked owner and active status, so the current fail-closed guard stopped before cancellation stages.',
  'v1-batch3-provider-timeouts': 'Salesforce page lacked totalSize; HubSpot extraction lacked its validator; Sheets retries now use the same complete-reader timeout helper. Cancellation behavior is executed.',
  'v1-batch4-sheets-revenue-contract': 'Isolated PostgreSQL schema omitted ga4_refresh_work, now required for atomic revenue publication; actual handler/storage lifecycle tests retained.',
  'csv-revenue-certification': 'CSV strict parsing now applies to all supported contexts, not only GA4; parse-before-write guard retained.',
  'csv-revenue-downstream-propagation': 'Source-display expression gained a Google Ads materialization branch; GA4 fallback contract unchanged.',
  'hubspot-stale-revenue-authority': 'Source-display expression gained a Google Ads materialization branch; GA4 fallback contract unchanged.',
  'executive-summary-freshness-regression': 'Summary now dates scoped saved daily facts, not an assumed latest day from a live rolling fetch; assert current bounded read and actual saved date.',
  'financial-daily-snapshot-observation': 'Snapshot writer now receives publication ownership input.',
  'ga4-auto-refresh-regression': 'Equivalent 15-second polling uses numeric separators; pending/failed refresh branches retain their existing checks.',
  'google-sheets-revenue-downstream-propagation': 'Refresh now passes nullable saved mapping and ownership; equivalent polling literal uses numeric separators.',
  'ga4-benchmark-regression': 'Benchmark updates preserve fractional values and pass publication ownership instead of rounding before storage.',
  'ga4-benchmark-safety-regression': 'Extraction used obsolete const-loop spelling; alert resolution now carries the transaction. Ownerless guards retained.',
  'ga4-kpi-regression': 'Alert reconciliation now selects and writes under a scoped transaction; enabled/disabled alert assertions retained.',
  'ga4-daily-scheduler-regression': 'Saved revenue refresh can reuse native facts; recovery window start is mutable. Ordering and complete-window checks retained.',
  'ga4-scheduler-observability-regression': 'Recompute and scoped alert publication now receive the current ownership input.',
  'ga4-overview-campaign-breakdown-regression': 'Publication coordinator owns normal updates; Insights or unavailable coordinator uses focus/reconnect/interval fallback. Retained-row checks preserved.',
  'ga4-overview-conversion-events-regression': 'Publication coordinator owns normal updates; unavailable coordinator uses focus/reconnect/interval fallback. Cross-scope placeholders remain forbidden.',
  'ga4-overview-landing-pages-regression': 'Publication coordinator owns normal updates; unavailable coordinator uses focus/reconnect/interval fallback. Cross-scope placeholders remain forbidden.',
  'ga4-overview-initial-import-window-regression': 'OAuth persistence moved to the existing atomic storage commit; assert preserved same-property import start and fixed supported lookback there.',
  'ga4-overview-scheduler-snapshot-regression': 'Atomic daily/Overview write now selects the ownership-aware transaction wrapper; both writes remain inside one transaction.',
  'ga4-spend-scope-regression': 'Automatic financial snapshots use the shared GA4-scoped writer instead of the former inline unscoped total read.',
  'hubspot-revenue-ga4-overview-regression': 'Scheduled dispatch now prepares audit state before sending; scheduled/test GA4 filenames use generation date. PDF construction and revenue separation assertions retained.',
  'latest-day-revenue-regression': 'Source refresh signatures now carry ownership, closed-won verification is stricter, and source pending state follows sale-date materialization rather than connection date.',
  'instagram-connected-platforms-regression': 'Retained code assertions predated GA4-first visibility, additional financial contexts, atomic CSV replacement, and wizard back-step handling. Two CRLF extraction bounds captured unrelated routes; normalized only those sources and asserted endpoints.',
  'instagram-create-campaign-flow-regression': 'Shared finalization query invalidations moved to finishCampaignCreation(createdId); assert its caller and every existing invalidation.',
  'linkedin-create-campaign-flow-regression': 'Shared finalization query invalidations moved to finishCampaignCreation(createdId); assert its caller and every existing invalidation.',
  'linkedin-disconnect-regression': 'Multiline assertion assumed LF in a CRLF file; whitespace-tolerant match retains the active reconnect guards.',
  'meta-production-regression': 'Shared mapping now also supports GA4; confirmation Back must return to the actual previous step, as required by AGENTS.md.',
  'tiktok-create-campaign-regression': 'Shared mapping labels gained GA4, report selection is deduplicated centrally, and Sheets selection also handles custom imports. Retained exact TikTok scope checks unchanged.',
};
const failures = old.failures.map(prior => {
  const file = files.get(prior.file);
  const assertion = renames[prior.id]
    ? file?.assertionResults.find(a => a.title === renames[prior.id])
    : file?.assertionResults.find(a => a.fullName === prior.name);
  const rootCause = causes[path.basename(prior.file, '.test.ts')];
  if (!assertion || assertion.status !== 'passed' || !rootCause) throw Error(`Unresolved identity or missing cause: ${prior.id} ${prior.file}`);
  return { ...prior, status: 'VERIFIED_LOCALLY', waived: false, rootCause, currentName: assertion.fullName,
    renamed: assertion.fullName !== prior.name, result: 'passed', evidence: 'consolidated.json' };
});
const counts = {};
for (const file of files.values()) for (const assertion of file.assertionResults) counts[assertion.status] = (counts[assertion.status] || 0) + 1;
if (Object.keys(counts).some(status => status !== 'passed')) throw Error('Full results are not clean');
const git = spawnSync('git', ['-c', 'core.safecrlf=false', 'diff', '--name-only'], { encoding: 'utf8', windowsHide: true });
if (git.status !== 0) throw Error(`Cannot inventory changes: ${git.error?.code || git.status}`);
const changed = git.stdout.trim().split(/\r?\n/).filter(Boolean);
const unexpectedRuntimeChanges = changed.filter(file => /^(client|shared|server)\//.test(file) && !file.endsWith('.test.ts'));
if (unexpectedRuntimeChanges.length) throw Error(`Unexpected runtime changes: ${unexpectedRuntimeChanges}`);
const previous = read('../validation-2026-10-26/final-checkpoint.json');
for (const file of ['scripts/ga4-test-run-errors.cjs', 'server/v1-batch8-ci-completion.test.ts']) {
  if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== previous.testHashes[file]) throw Error(`CI safeguard changed: ${file}`);
  changed.push(file);
}
const reportNeighbors = read('../validation-2026-10-26/report-neighbor-verification.json').checks.map(prior => {
  const file = files.get(prior.file);
  if (!file?.assertionResults.length || file.assertionResults.some(a => a.status !== 'passed')) throw Error(`Report regression: ${prior.file}`);
  return { file: prior.file, passed: file.assertionResults.length };
});
const output = { at: new Date().toISOString(), method: 'Full suite excluding only the fixed-port precision fixture, plus that fixture on its required port; no skipped assertions or waived failures.',
  runs, files: files.size, counts, errors, historicalFailures: failures.length, renamedAssertions: failures.filter(f => f.renamed).length,
  applicationRuntimeChanged: false, reportNeighbors, filesChanged: changed.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })), failures };
if (!process.argv.includes('--check-only')) fs.writeFileSync(path.join(__dirname, 'final-reconciliation.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: output.files, counts, historicalFailures: failures.length, renamedAssertions: output.renamedAssertions, applicationRuntimeChanged: false }));
