const fs = require('node:fs'), crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const previous = read('docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json');
const result = read(__dirname + '/verified-final.json');
const failures = result.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed').map(test => {
  const prior = previous.failures.find(item => item.name === test.fullName);
  if (!prior) throw new Error('Unclassified new failure: ' + test.fullName);
  return { ...prior, currentError: test.failureMessages[0], presentInPreviousFullSuite: true, waived: false };
}));
if (result.numPendingTests || failures.length !== result.numFailedTests) throw new Error('Skipped tests or unclassified suite failure');
const files = ['server/routes-oauth.ts', 'server/auto-refresh-scheduler.ts', 'server/utils/google-sheets-revenue-amount.ts',
  'server/v1-batch4-sheets-revenue-contract.test.ts', 'server/ga4-auto-refresh-regression.test.ts'];
const manifest = { at: new Date().toISOString(), baseHead: '44132830b668283d37d40cb874687c2c5861ad0e',
  state: 'Uncommitted; not deployed', files: files.map(file => {
    const bytes = fs.readFileSync(file);
    return { file, sha256: crypto.createHash('sha256').update(bytes).digest('hex'),
      lfSha256: crypto.createHash('sha256').update(bytes.toString('utf8').replace(/\r\n/g, '\n')).digest('hex') };
  }) };
const assessment = { at: manifest.at, findings: ['V1-065', 'V1-066', 'V1-067'], status: 'VERIFIED LOCALLY; release acceptance OPEN',
  currentTargetedRun: { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests },
  newRegressionTests: 29, realPostgresHandlerLifecycleTests: 3, newFailingIdentities: [], failures,
  intermediateResults: [
    'before.json: 26 tests, 9 passed and 17 failed, reproducing the three defects and header-normalization mismatch.',
    'headers-after.json: header-specific tests pass; other cases intentionally not selected.',
    'currency-after.json: currency cases pass; the selected singular-filter/malformed-row case still fails before V1-067 correction.',
    'fixes-after.json: 54 passed / 9 recorded failures; all 26 new tests pass.',
    'final.json: initial localhost:55443 fixture lacks the v1_audit role; 63 tests not executed. Not validation evidence for PostgreSQL.',
    'verified.json: fresh localhost:55444 fixture; 397 passed / 10 failed / 0 skipped. One existing scheduler fixture omitted getCampaign, now needed before currency validation. Added the USD campaign stub; original no-write and warning assertions retained.',
    'verified-final.json: 398 passed / 9 recorded failures / 0 skipped; all 29 new tests pass, including real persistence and source/total read reconciliation.',
  ],
  builds: read(__dirname + '/final-build-checks.json'),
  testDatabase: 'Fresh test-only PostgreSQL 18 on 127.0.0.1:55444; random disposable schemas, no production clone used',
  externalAccess: 'Application credentials stripped, DATABASE_URL empty, outbound network blocked; provider/auth boundaries are fixtures',
  limits: ['No authenticated browser or live Google provider check', 'No production mutation, cleanup, migration or configuration change',
    'No current full-suite rerun; the previous 179 whole-suite failures and CI gate remain open',
    'No whole-source certification, historical snapshot repair, rate/quota or broad signed/zero amount policy change'],
};
for (const [name, data] of [['candidate-manifest', manifest], ['assessment', assessment]]) {
  fs.writeFileSync(`${__dirname}/${name}.json`, JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ ...assessment.currentTargetedRun, newFailingIdentities: [], manifestFiles: files.length }));
