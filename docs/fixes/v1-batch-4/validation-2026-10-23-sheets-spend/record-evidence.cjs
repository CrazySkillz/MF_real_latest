// One-off checkpoint writer. Historical evidence is never overwritten.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const baselinePath = 'docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json';
const baseline = read(baselinePath);
const result = read(path.join(__dirname, 'verified.json'));
const failures = [];
for (const suite of result.testResults) for (const test of suite.assertionResults) {
  if (test.status !== 'failed') continue;
  const file = suite.name.replace(/\\/g, '/').split('/MF_real_latest/')[1];
  const previous = baseline.failures.find(f => f.file === file && f.name === test.fullName);
  assert(previous, `Unclassified new failure: ${file} / ${test.fullName}`);
  assert.equal(test.failureMessages[0].split('\n')[0], previous.error.split('\n')[0], `Changed failure boundary: ${previous.id}`);
  failures.push({ ...previous, currentError: test.failureMessages[0], previousCheckpoint: baselinePath,
    currentFailureMatchesPrevious: true, newFailingIdentity: false, waived: false });
}
assert.equal(failures.length, 14);
const added = result.testResults.find(s => s.name.endsWith('/v1-batch4-sheets-spend-contract.test.ts'));
assert.equal(added.assertionResults.length, 37);
assert(added.assertionResults.every(t => t.status === 'passed'));
assert.equal(result.numPendingTests, 0);
const build = read(path.join(__dirname, 'verified-build-checks.json'));
assert(build.checks.every(c => c.exitCode === 0));
assert.equal(read(path.join(__dirname, 'fixture-cleanup.json')).result, 'PASS');
const files = ['server/routes-oauth.ts', 'server/storage.ts', 'server/v1-batch4-sheets-spend-contract.test.ts',
  'server/ga4-financial-source-ownership-postgres.test.ts', 'server/spend-source-additivity.test.ts'];
const at = new Date().toISOString();
const baseHead = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
write('candidate-manifest.json', { at, baseHead, implementation: 'uncommitted and undeployed',
  files: files.map(file => ({ file, sha256: createHash('sha256').update(fs.readFileSync(file)).digest('hex') })) });
write('assessment.json', { at, baseHead, findings: ['V1-041', 'V1-070'], implementation: 'VERIFIED LOCALLY; uncommitted and undeployed', releaseAcceptance: 'OPEN',
  targeted: { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests },
  newTests: 37, newRealPostgresTests: 9, newFailingIdentities: [], failures,
  originalReproduction: { file: 'before-corrected-fixture.json', total: 22, passed: 3, failed: 19 },
  intermediateFailures: [
    { file: 'before.json', classification: 'TEST_PARAMETER_SHAPE', explanation: 'Three array cases were spread by it.each instead of passed as one value. Corrected before-corrected-fixture.json is the valid baseline; these harness errors are not product failures.' },
    { file: 'final-targeted.json', classification: 'TEST_EXECUTION_BUDGET', test: 'keeps actual saved rows and source metadata on rejected edits and scheduler failures, then recovers', durationMs: 5179.8966,
      explanation: 'Repeated AST extraction in a multi-operation test exceeded its five-second budget while builds ran concurrently. Cached immutable extracted code without relaxing assertions or deadlines; final full targeted rerun passes this case and all 37 new tests.' }
  ],
  existingTestUpdates: [
    'The PostgreSQL ownership harness now executes the actual chunk reader and supplies metadata plus chunk responses; original write-ownership and late-change assertions retained.',
    'Two source-text additivity checks follow inspected atomic cleanup/purge instead of requiring unsafe separate delete calls. Real PostgreSQL rollback, race and scope tests independently prove the intended behavior.'
  ],
  boundaries: { provider: 'Controlled responses only; outbound network blocked', database: 'Disposable localhost:55444 fixture, credentials stripped', productionMutations: 0,
    schemaChanges: false, dependencyChanges: false, environmentChanges: false, clientCodeChanges: false,
    maintenanceApiChange: 'cleanup and purge require confirm:true and a fresh GET inspectionToken',
    maintenanceLockImpact: 'Explicit maintenance only: campaign/table lock waits <=3s, SQL statements <=10s; table locks fence legacy child inserts. Hosted contention/load acceptance remains open.' },
  remaining: ['Authenticated browser/provider imports, reconnect/cancel and natural scheduled publication', 'Provider reconciliation and quotas, including concurrent provider edits during chunked reads',
    'Full downstream modal/cards/KPI/Benchmark/Insights/alerts/report acceptance', 'Read-only damaged-data inventory and separately reviewed exact repair scope',
    'Fourteen current classified failures, previous 179 whole-suite failures, CI and all release gates'],
  wholeSuite: 'Not rerun; October 22 full-suite result remains historical supporting evidence, not a fresh full-suite result' });
console.log(JSON.stringify({ targeted: [result.numPassedTests, result.numFailedTests], newTestsPassed: 37, newFailures: 0, files: files.length }));
