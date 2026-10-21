const fs = require('node:fs'), crypto = require('node:crypto');
const dir = 'docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision';
const read = path => JSON.parse(fs.readFileSync(path, 'utf8'));
const reconciliation = read(`${dir}/failure-reconciliation.json`);
const builds = read(`${dir}/build-checks.json`), startup = read(`${dir}/startup-results.json`);
const reportFollowup = read(`${dir}/report-unit-contract-verified.json`);
const cleanup = read(`${dir}/cleanup.json`), manifest = read(`${dir}/candidate-manifest.json`);
if (reportFollowup.numFailedTests || reportFollowup.numPendingTests || reconciliation.newFailingIdentities.length || reconciliation.suitesFailingWithoutFailedAssertions.length ||
    builds.checks.some(row => row.exitCode !== 0) || startup.results.some(row => row.result !== 'PASS') ||
    !cleanup.isolatedPostgresStopped || cleanup.databases.some(row => row.remainingFixtureSchemas.length || row.otherClientConnections)) throw Error('Current validation incomplete');
for (const row of manifest.files) if (crypto.createHash('sha256').update(fs.readFileSync(row.file)).digest('hex') !== row.sha256) throw Error(`Manifest changed: ${row.file}`);
const result = read(`${dir}/full-suite-final.json`);
const focusedFiles = [
  'v1-batch3-conversion-precision', 'v1-batch3-conversion-postgres', 'v1-batch3-conversion-consumers',
  'ga4-kpi-saved-overview', 'ga4-shared-daily-traffic', 'ga4-publication-browser', 'ga4-browser-report-publication',
  'ga4-report-saved-publication', 'metric-math', 'ga4-derived-publication-postgres', 'ga4-recovery-process-postgres',
  'ga4-snapshot-ownership-postgres', 'financial-daily-comparison', 'campaign-cumulative-financials',
  'campaign-section-ui-parity-scheduled-pdf', 'executive-summary-scheduled-pdf', 'performance-summary-scheduled-pdf',
];
const suites = result.testResults.filter(suite => focusedFiles.includes(suite.name.split(/[\\/]/).at(-1).replace('.test.ts', '')));
if (suites.length !== focusedFiles.length) throw Error('Missing precision coverage');
const tests = suites.flatMap(suite => suite.assertionResults);
if (tests.some(test => test.status !== 'passed')) throw Error('Precision coverage not passing');
const coverage = { from: 'full-suite-final.json', passed: tests.length, failed: 0, skipped: 0, files: focusedFiles.map(name => `server/${name}.test.ts`) };
fs.writeFileSync(`${dir}/precision-coverage.json`, JSON.stringify(coverage, null, 2) + '\n');
const totals = reconciliation.finalFullSuite;
const summary = `${totals.total.toLocaleString('en-US')} tests; ${totals.passed.toLocaleString('en-US')} passed, ${totals.failed} failed, zero skipped`;
const assessment = {
  at: new Date().toISOString(), baseHead: manifest.baseHead, implementation: manifest.implementation,
  finding: 'V1-079', fixStatus: 'VERIFIED LOCALLY', releaseAcceptance: 'OPEN', releaseDecision: 'NO-GO',
  fullSuite: totals, precisionCoverage: coverage, startupScenariosPassed: startup.results.length,
  newUnresolvedTestFailures: reconciliation.newFailingIdentities.length, manifestMatchesCurrentFiles: true,
  proven: ['Fractional provider/daily/snapshot inputs retained', 'Platform and campaign current values, CPA, history and alert observations preserve credit',
    'Observed PostgreSQL fields retain fractions through create/edit/read and restart', 'Tiny conversion values render in actual cards and browser PDF bytes; scheduled builder output retains them',
    'Term-count floating-point comparison accepts representational error and rejects true mismatches', 'Existing ownership, transactional replacement and process recovery checks pass in the precision packet'],
  externallyRequired: ['Exact production migration locks, existing nonfinite data and compatible rollback/restore', 'Live provider attribution and fractional publication reconciliation', 'Read-only historical damage inventory and separately reviewed repair scope', 'CI and all remaining V1 acceptance gates'],
  otherBatch3ImplementationOpen: ['V1-011', 'V1-025 remaining cancellation paths', 'V1-089', 'V1-090'],
  reportFormattingFollowup: { passed: reportFollowup.numPassedTests, failed: 0, skipped: 0, file: 'report-unit-contract-verified.json' },
  resultsBoundary: 'The final full run was followed by the bounded report formatter compatibility check. The only runtime adjustment during that full run preserved the existing shared report count suffix and grouping. The 171-test final report packet and production builds cover the resulting candidate; this is not a further whole-suite run.',
  boundaries: ['No production/Ptomo/provider/email mutation', 'No historical repair', 'No commit/push/deployment', 'Existing full-suite failures retained individually and not waived'],
};
fs.writeFileSync(`${dir}/assessment.json`, JSON.stringify(assessment, null, 2) + '\n');
function paragraph(text, prefix, replacement) {
  const start = text.indexOf(prefix); if (start < 0) throw Error(`Missing paragraph ${prefix}`);
  const end = text.indexOf('\n\n', start); return text.slice(0, start) + replacement + text.slice(end < 0 ? text.length : end);
}
function update(path, transform) { fs.writeFileSync(path, transform(fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n'))); }
update('docs/fixes/v1-batch-3/README.md', text => {
  text = paragraph(text, '**Precision follow-up:**', '**Precision follow-up: V1-079 is VERIFIED LOCALLY for the documented forward paths.** Fractional credit now survives goals, history, snapshots, diagnostics and report rendering. Release acceptance remains OPEN. The [current candidate manifest](validation-2026-10-21-goal-precision/candidate-manifest.json) and [assessment](validation-2026-10-21-goal-precision/assessment.json) supersede earlier hashes; see [V1-079](#v1-079).');
  text = paragraph(text, 'The five remaining implementation paths', 'The four remaining implementation paths are source-aware recovery (V1-011), diagnostic/provider timeout/cancellation and late-write safety (the rest of V1-025), shared-property concurrency (V1-089) and provider-quality metadata (V1-090). V1-079 still requires deployed/provider and historical-data acceptance; do not confuse the locally verified forward correction with whole-source certification.');
  const latest = [
    `**Latest downstream-precision checkpoint: ${summary}.** No newly failing identity. Every unresolved failure retains its original ID/classification in the [reconciliation](validation-2026-10-21-goal-precision/failure-reconciliation.json); none is waived. [Full results](validation-2026-10-21-goal-precision/full-suite-final.json), [assessment](validation-2026-10-21-goal-precision/assessment.json) and [candidate hashes](validation-2026-10-21-goal-precision/candidate-manifest.json) identify this uncommitted candidate.`,
    `The [precision coverage subset](validation-2026-10-21-goal-precision/precision-coverage.json) has **${coverage.passed} passing tests**, extracted from that full run; this is not an additional run. [Startup](validation-2026-10-21-goal-precision/startup-results.json): ${startup.results.length} scenarios pass, including repeated boot after fractional writes. [TypeScript and production builds](validation-2026-10-21-goal-precision/build-checks.json) pass. [Cleanup](validation-2026-10-21-goal-precision/cleanup.json) confirms zero fixture schemas/connections and the stopped local PostgreSQL process.`,
    'The intermediate full run found 36 additional failures: 19 fixed-scale string expectations, 16 obsolete source assertions and one missing extracted-fixture binding. All are individually classified and now pass, with ownership, rollback, stale-work, target, currency and mismatch expectations retained. The rendered-page fixture also needed its goal-list query invalidated after changing fixture data; that corrected browser test passes. The only runtime adjustment during the final full run preserved the shared report formatter\'s existing count suffix and grouping; the subsequent [171-test report packet](validation-2026-10-21-goal-precision/report-unit-contract-verified.json) and final production builds cover that adjustment. This is a bounded follow-up, not another full-suite run. Production, Ptomo and provider accounts were untouched; no commit, push, deployment, email send or historical repair occurred.',
    '### Earlier provider/storage precision checkpoint (superseded)',
  ].join('\n\n');
  text = text.replace('## Current validation boundary\n\n', `## Current validation boundary\n\n${latest}\n\n`);
  text = text.replace('**Latest precision continuation (October 21): V1-079 remains IN PROGRESS.**', '**Earlier precision continuation (October 21): V1-079 was IN PROGRESS at this checkpoint.**');
  text = paragraph(text, '**Next implementation boundaries:**', '**Next implementation boundaries:** Six bounded corrections are verified locally (V1-032/033/035/036/079/087). V1-089 needs shared-property dispatch/cancellation evidence; V1-090 needs provider-quality availability/provenance handling; V1-011 and the rest of V1-025 need source-aware recovery and cancellation through existing services. All Batch 3 release acceptance remains OPEN.');
  text = text.replace('| [V1-079](#v1-079) | P1 | IN PROGRESS | OPEN |', '| [V1-079](#v1-079) | P1 | VERIFIED LOCALLY | OPEN |');
  const a = text.indexOf('### V1-079'), b = text.indexOf('### V1-087', a);
  let section = text.slice(a, b).replace('**Fix status:** IN PROGRESS.', '**Fix status:** VERIFIED LOCALLY.');
  section = section.replace('**Confirmed root causes and current correction (uncommitted):**', '**Earlier provider/storage checkpoint, before the downstream correction above:**');
  section = section.replace("Other providers' daily conversion columns and goal schemas are unchanged.", "Other providers' daily conversion columns are unchanged; the later migration 0026 above widens shared observed goal/history fields.");
  section = section.replace('Arbitrary floating-point reconciliation remains open below.', 'The later correction above adds bounded floating-point reconciliation.');
  section = section.replace('**Still incomplete; required before V1-079 can be locally verified or deployed.** Exact outstanding paths below remain in this finding,', '**Incomplete at this earlier checkpoint; corrected and locally checked in the current packet above.** Wider release acceptance remains open,');
  section = paragraph(section, '**Remaining exact boundaries (confirmed current code):**', '**Earlier remaining boundaries, now corrected in the forward path above:** KPI/Benchmark jobs and live/template helpers; fixed-scale observed goal/history fields; outcome/validation totals; aggregate snapshots; browser/server PDF and diagnostic count formatters; independently summed decimal reconciliation. No persisted customer history or report artifacts were repaired. The retained legacy cleanup tool still must not be used as a fractional-credit repair.');
  return text.slice(0, a) + section + text.slice(b);
});
update('docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md', text => {
  text = text.replace('Batch 3 has five corrections verified locally, with timeout and fractional-conversion findings partially implemented; its candidate is uncommitted and five implementation paths remain. V1-079 now preserves provider/daily/snapshot credit; goal/report rounding and decimal reconciliation remain.', 'Batch 3 has six corrections verified locally, including the V1-079 fractional-conversion forward paths; its candidate is uncommitted. Four implementation paths remain: V1-011, the rest of V1-025, V1-089 and V1-090. Deployed/provider and historical-data acceptance remains OPEN.');
  return text.replace('| [V1-079](../../fixes/v1-batch-3/README.md#v1-079) | P1 | 3 | IN PROGRESS |', '| [V1-079](../../fixes/v1-batch-3/README.md#v1-079) | P1 | 3 | VERIFIED LOCALLY |');
});
const indexSummary = `Latest local full suite: **${summary}**, with **no newly failing identity**. [Current reconciliation](fixes/v1-batch-3/validation-2026-10-21-goal-precision/failure-reconciliation.json) retains every failure and its release impact. The precision coverage subset has ${coverage.passed} passing tests; TypeScript, production builds and ${startup.results.length} isolated startup scenarios pass. No failure is waived. CI and deployed acceptance have not rerun for this candidate. [Batch 8](fixes/v1-batch-8/README.md#latest-validation-and-release-gates) retains those required gates.`;
update('docs/V1_RELEASE_READINESS.md', text => {
  text = text.replace('In progress: five corrections verified locally; timeout and fractional-conversion paths partially implemented; five implementation paths remain; release acceptance OPEN', 'In progress: six corrections verified locally, including fractional conversions; four implementation paths remain; release acceptance OPEN');
  text = text.replace('The latest continuation preserves fractional conversion credit in GA4 reads, daily storage and snapshot columns, with a locally tested migration and finite-value guards. [V1-079](fixes/v1-batch-3/README.md#v1-079) remains IN PROGRESS: goal/report rounding and arbitrary-decimal reconciliation are not complete.', 'The latest continuation preserves fractional conversions through GA4 reads, storage, KPI/Benchmark current values and history, diagnostics, alerts and reports. [V1-079](fixes/v1-batch-3/README.md#v1-079) is VERIFIED LOCALLY for those forward paths, including migrations, restart and decimal reconciliation; deployed/provider and historical-data acceptance remains OPEN.');
  text = text.replace('fixes/v1-batch-3/validation-2026-10-21-precision/candidate-manifest.json', 'fixes/v1-batch-3/validation-2026-10-21-goal-precision/candidate-manifest.json');
  text = text.replace("Batch 3's five bounded corrections", "Batch 3's six bounded corrections");
  return paragraph(text, 'Latest local full suite,', indexSummary);
});
update('docs/fixes/v1-batch-8/README.md', text => paragraph(text, '**Latest Batch 3 precision continuation,', `**Latest Batch 3 downstream-precision checkpoint: V1 remains NO-GO.** ${summary}, with no new failing identity. [Current assessment](../v1-batch-3/validation-2026-10-21-goal-precision/assessment.json) and [failure reconciliation](../v1-batch-3/validation-2026-10-21-goal-precision/failure-reconciliation.json) identify the local candidate. V1-079 forward precision paths are VERIFIED LOCALLY, with ${coverage.passed} passing coverage tests and ${startup.results.length} startup scenarios; production builds pass. All ${totals.failed} full-suite failures remain open. CI, provider semantics, production migrations/compatible rollback, historical damage inventory and other required V1 acceptance remain unverified. No deployment or production mutation occurred. Earlier checkpoints below remain historical evidence.`));
console.log(JSON.stringify({ summary, precisionPassed: coverage.passed, startupPassed: startup.results.length, docsUpdated: 4, release: 'NO-GO' }));
