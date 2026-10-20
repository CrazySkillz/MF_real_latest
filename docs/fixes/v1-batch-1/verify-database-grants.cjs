// Reconcile the current full suite without overwriting the initial Batch 1 evidence.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const dir = 'docs/fixes/v1-batch-1/';
const read = name => JSON.parse(fs.readFileSync(dir + name, 'utf8'));
const suite = read('database-grants-full-suite.json');
const previous = read('failure-reconciliation.json');
const prior = new Map(previous.failures.map(f => [f.file + '|' + f.name, f]));
const failures = suite.testResults.flatMap(file => file.assertionResults.filter(t => t.status === 'failed').map(t => {
  const relative = path.relative(process.cwd(), file.name).replaceAll('\\','/');
  const matched = prior.get(relative + '|' + t.fullName);
  const firstFailure = t.failureMessages[0]?.split('\n')[0];
  return { ...matched, file: relative, name: t.fullName, firstFailure,
    id: matched?.id || 'NEW-' + crypto.createHash('sha256').update(relative + '|' + t.fullName).digest('hex').slice(0,10),
    status: 'OPEN', matchedInitialBatch1: Boolean(matched), firstMessageChanged: Boolean(matched && firstFailure !== matched.firstFailure),
    currentEvidenceNote: matched?.currentEvidenceNote };
}));
const summary = { at: new Date().toISOString(), baseHead: '2fcee885',
  tests: suite.numTotalTests, passed: suite.numPassedTests, failed: suite.numFailedTests, skipped: suite.numPendingTests,
  files: suite.testResults.length, newFailures: failures.filter(f => !f.matchedInitialBatch1).length,
  changedFirstMessages: failures.filter(f => f.firstMessageChanged).map(f => f.id),
  waived: 0, closed: 0, boundary: 'All prior full-suite failures remain OPEN; unchanged identities do not waive their requirements.', failures };
fs.writeFileSync(dir + 'database-grants-failure-reconciliation.json', JSON.stringify(summary,null,2) + '\n');
assert.equal(summary.skipped, 0); assert.equal(summary.newFailures, 0);
assert.equal(failures.length, suite.numFailedTests); assert.equal(failures.length, previous.failures.length);
for (const row of failures.filter(f => f.firstMessageChanged)) assert.ok(row.currentEvidenceNote, row.id);
const targeted = read('database-grants-targeted.json'), postgres = read('database-grants-postgres.json');
assert.equal(targeted.numPassedTests, 141); assert.equal(targeted.numFailedTests, 0); assert.equal(targeted.numPendingTests, 0);
assert.equal(postgres.results.length, 34); assert.ok(postgres.results.every(r => r.result === 'PASS'));
const files = ['server/storage.ts','shared/schema.ts','server/v1-batch1-postgres-regression.cjs',
  'migrations/0023_service_account_resource_grants.sql',dir + 'apply-reviewed-resource-grant.cjs'];
const candidate = { at: new Date().toISOString(), baseHead: '2fcee885',
  boundary: 'Current storage/schema database-grant follow-up; exact permission only, OAuth independent; all previous source changes remain bound by prior manifests.',
  hashes: Object.fromEntries(files.map(file => [file,crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])) };
fs.writeFileSync(dir + 'database-grants-candidate.json', JSON.stringify(candidate,null,2) + '\n');
console.log(JSON.stringify({ tests: summary.tests, passed: summary.passed, failed: summary.failed, skipped: summary.skipped,
  newFailures: summary.newFailures, changedFirstMessages: summary.changedFirstMessages, targeted: 141, postgres: 34 }));
