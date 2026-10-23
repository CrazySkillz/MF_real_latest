// Evidence only: no application import, credentials, provider or database access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const git = (...args) => cp.execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const files = [
  'client/src/pages/google-sheets-data.tsx', 'server/routes-oauth.ts', 'server/storage.ts',
  'server/auto-refresh-scheduler.ts', 'server/report-scheduler.ts',
  'server/utils/google-sheets-aggregate-source.ts', 'server/utils/google-sheets-revenue-ranges.ts', 'server/utils/googleSheetsSelection.ts',
  'server/v1-batch4-standalone-sheets-values.test.ts', 'server/v1-batch4-standalone-sheets-refresh.test.ts',
  'server/v1-batch4-standalone-sheets-browser.test.ts', 'server/v1-batch4-standalone-sheets-scope.test.ts',
  'server/ga4-auto-refresh-regression.test.ts', 'server/google-sheets-aggregate-source.test.ts',
  'server/google-sheets-revenue-validation.test.ts', 'server/ga4-refresh-input-invalidation-postgres.test.ts',
];
const final = read('final.json'), boundary = read('final-boundary.json');
const counts = result => ({ total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests });
assert.deepEqual(counts(final), { total: 388, passed: 387, failed: 1, skipped: 0 });
assert.deepEqual(counts(boundary), { total: 129, passed: 129, failed: 0, skipped: 0 });
const build = [...read('final-types-build-checks.json').checks, read('final-build-checks.json').checks.find(c => c.name === 'client-build')];
assert.ok(build.every(c => c.exitCode === 0 && c.error === null));
assert.equal(read('fixture-cleanup.json').result, 'PASS');
const sha = git('rev-parse', 'HEAD');
assert.equal(sha, 'fb1132a256d05a271dcdbb21be863206f933d7b0');
const at = new Date().toISOString();
write('candidate-manifest.json', {
  at, branch: git('branch', '--show-current'), head: sha, remoteTrackingHead: git('rev-parse', 'origin/main'),
  state: 'UNCOMMITTED; NOT PUSHED OR DEPLOYED', hashEncoding: 'SHA-256 of UTF-8 text with CRLF normalized to LF',
  files: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')).digest('hex') })),
  checkpoints: {
    final: '388 tests before only the compile-time tuple annotation and corrected euro fixture literal; all final runtime logic already present.',
    finalBoundary: '129 current-code tests rerun after those two changes; no runtime/test changes afterward.',
    build: 'final-types typecheck/server build and final client build passed; last test-only euro fixture correction changes no production bundle.',
  },
});
const failures = result => result.testResults.flatMap(file => file.assertionResults.filter(a => a.status === 'failed').map(a => ({ file: path.relative(process.cwd(), file.name).replace(/\\/g, '/'), name: a.fullName, firstFailure: a.failureMessages[0]?.split('\n')[0] })));
const classifications = {
  'first-values': 'TEST_HARNESS: AST-extracted PDF function dynamic import had no callback. CommonJS transpilation/createRequire now exercises actual jsPDF bytes for every report type; no fake successful PDF substitute.',
  'values-refresh-browser': 'One real multi-connection false-success was corrected by retaining the failure flag. Other failures were an old incomplete cache fixture, two source-text guards updated to the actual complete-read/metric helpers, and browser formatting expectation (-100%, not -100.0%). Source-preservation assertions and independent behavior tests retained.',
  'combined-local': 'TEST_LOCATOR: ROAS assertion selected the label parent instead of the metric-card parent; corrected locator, no production behavior change.',
  'acceptance-local': 'TEST-2e4c19942f: obsolete literal GA4 breakdown implementation assertion. Replaced with actual exact source resolver cases, including zero/pending bounded values; no GA4 runtime change.',
  'verified': 'TEST-02680176f2 remains OPEN; see required failure disposition.',
  'renewal-before': 'CONFIRMED_CURRENT_GROUP_DEFECT: token-save return could replace the initial identity with a changed spreadsheet/purpose/inactive source, allowing wrong cache publication. Guard now rejects changed source identity before retry/cache write; same-tab token renewal still passes.',
  'final': 'TEST-02680176f2 remains OPEN; all current Sheets correction cases pass.',
};
const failed = failures(final);
assert.equal(failed.length, 1);
assert.ok(failed[0].name.includes('retains last-good rows and refetches'));
write('assessment.json', {
  at, baseHead: sha, implementationState: 'VERIFIED LOCALLY within the five documented correction boundaries; UNCOMMITTED/UNDEPLOYED',
  releaseDecision: 'NO-GO; every required release acceptance remains OPEN', findings: ['V1-051', 'V1-108', 'V1-112', 'V1-113', 'V1-114'],
  findingBoundary: 'V1-108 only included standalone Sheets portion; LinkedIn/Instagram/Meta/TikTok provider functionality remains deferred.',
  tests: { expanded: { file: 'final.json', ...counts(final), files: final.testResults.map(f => ({ file: path.relative(process.cwd(), f.name).replace(/\\/g, '/'), total: f.assertionResults.length, passed: f.assertionResults.filter(a => a.status === 'passed').length, failed: f.assertionResults.filter(a => a.status === 'failed').length })) }, lastBoundary: { file: 'final-boundary.json', ...counts(boundary) } },
  builds: build,
  intermediateResults: Object.entries(classifications).map(([label, classification]) => ({ file: label + '.json', ...counts(read(label + '.json')), failures: failures(read(label + '.json')), classification, waived: false })),
  intermediateCompileFailures: [
    { file: 'candidate-typecheck.log', reason: 'Direct Map iteration conflicted with existing compiler target; use existing Array.from(entries()) pattern, no compiler setting change.' },
    { file: 'final-typecheck.log', reason: 'New token-renewal identity guard indexed a typed connection using generic string; compile-time const tuple resolves the type without changing JavaScript behavior.' },
  ],
  remainingFailure: { ...failed[0], id: 'TEST-02680176f2', finding: 'V1-012', classification: 'STRUCTURAL_ASSERTION / BEHAVIORAL_CONTRACT_UNVERIFIED', status: 'OPEN', waived: false,
    actualCode: 'client/src/pages/ga4-metrics.tsx:2139: focus/reconnect are conditional on Insights/publication availability; interval off for valid Overview publication; background polling false.',
    required: 'Behaviorally verify publication-driven freshness, last-good retention and focus/reconnect fallback before resolving the old polling contract. Unchanged GA4 page/test; no inference that it is harmless or a proven runtime defect.',
    releaseImpact: 'Full-suite/CI verification remains open. This packet cannot certify V1 or close V1-012.' },
  repairedHistoricalFailure: { id: 'TEST-2e4c19942f', status: 'PASS in targeted current packet', reason: 'Behavioral exact source resolver tests replace obsolete literal-source assertion; known zero/pending and positive source allocation boundaries verified.', historicalLedgersRewritten: false },
  contracts: {
    read: 'Exact saved tab; <=50000 grid rows incl header, <=200 columns, <=2000000 grid cells; full-width <=5000-row chunks; 45s overall signal; structural metadata consistency; partial failure never fresh.',
    cache: 'Exact source identity, complete flag/row count, age <25h, active campaign/connection; atomic parent/row guard, reject older read and changed source/token identity. Empty complete read removes old cached rows.',
    calculations: 'Validated unique mappings or unambiguous exact aliases; no implicit Budget-as-Spend; numerator/denominator ratios from same selected rows; unknown/malformed rates unavailable; zero preserved; mapped conversion-value median/latest with exact dates.',
    reportDate: 'Scheduled report uses actual inclusive window and mapped Date or unique exact Date header, valid YYYY-MM-DD; browser report explicitly uses all selected rows, saved dataset for row count.',
    financialState: 'Successful finite scoped reads with record IDs covering active sources; measured zero distinct from missing/failed contribution; zero denominator unavailable; loss retained.',
  },
  provenWithinFixtures: ['Full-width and last-supported-row reads; no partial fresh cache', 'Source ownership/selection, empty no-match and zero preservation', 'Real storage atomic cache update, stale read/source conflict and parent/deactivation/rollback protection', 'Actual handler-to-Summary/options/Insights calculation agreement', 'Actual browser and scheduled PDF values, source/date failures and required-artifact gate', 'Interception-only browser tab switch, mapping open/cancel, zero/loss/failure states and table paging'],
  partiallyReviewed: ['Full Insights/date/diagnostics semantics beyond changed calculations', 'Source-list and all mutation-to-output combinations', 'Existing connection/mapping lifecycle; dialog save transaction not exercised by browser fixture'],
  requiredUnverifiedOrExternal: ['Real customer consent/permissions/quotas/provider-formatted values', 'Deployed changes and natural refresh/restart/reconnect recovery', 'Whole source lifecycle and historical damaged-data inventory', 'Persisted goal/alert propagation V1-122', 'Historical snapshot JSON/PDF parity V1-060', 'Broader currency propagation V1-106 and Pipeline Proxy V1-109', 'Real report delivery/inbox and hosted concurrent-user capacity', 'Whole-suite/CI, release backup/restore/rollback and every remaining V1 gate'],
  deferredPath: 'Separate retained LinkedIn mapping-save conversion read is unchanged; requires LinkedIn connection/import context. No claim that every Sheets-related provider branch is corrected.',
  performance: { shape: '49999 data rows plus header last-row correctness; five concurrent synthetic 2000-row reads; table renders 100 rows per page', evidence: final.testResults.flatMap(f => f.assertionResults).filter(a => a.fullName.includes('keeps the last supported row')).map(a => ({ name: a.fullName, durationMs: a.duration, status: a.status })), limit: 'Local in-memory fixture only; not provider quota, hosted capacity, or full 2-million-cell load acceptance.' },
  cleanup: { file: 'fixture-cleanup.json', cluster: 'audit-temp/v1-batch4-sheets-pg', endpoint: '127.0.0.1:55444', stopObserved: 'pg_ctl -m fast -w stop returned exit code 0 and server stopped on 2026-10-23; no recursive file deletion.' },
  safety: { credentialsLoaded: false, dotenvLoaded: false, productionOrPtomoAccessForCompletionGroup: false, providerCalls: false, emailSent: false, schemaMigration: false, historicalDataCleanup: false, network: 'Node runner blocks non-loopback network; Google responses are fixtures; Playwright routes intercepted.' },
  batch4: { assigned: 24, verifiedLocally: 15, implementationFindingsRemaining: 9, remainingGroups: { customIntegration: ['V1-028','V1-029','V1-031','V1-102','V1-103','V1-111','V1-120'], manualSpendTransfers: ['V1-068','V1-069'] }, releaseAcceptancesOpen: 24 },
  historicalFullSuite: { date: '2026-10-22', total: 4488, passed: 4309, failed: 179, skipped: 0, rerunForThisGroup: false, countAdjustedByInference: false },
});
console.log(JSON.stringify({ recorded: ['candidate-manifest.json', 'assessment.json'], tests: counts(final), boundary: counts(boundary), build: 'PASS', release: 'NO-GO' }));
