// Compare exact assertion identities; historical labels are evidence, not waived failures.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = row => `${row.file}\n${row.name}`;
const label = process.argv[2] || 'baseline';
if (!/^[a-z0-9-]+$/.test(label)) throw Error('Invalid label');
const prior = read('docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json');
const known = new Map(prior.failures.map(row => [identity(row), row]));
const current = read(path.join(__dirname, `${label}.json`));
const assertions = current.testResults.flatMap(suite => suite.assertionResults.map(test => ({
  file: path.relative(process.cwd(), suite.name).replace(/\\/g, '/'), name: test.fullName,
  status: test.status, error: test.failureMessages?.[0] || null,
})));
const observed = new Map(assertions.map(row => [identity(row), row]));
const failures = assertions.filter(row => row.status === 'failed').map(row => ({
  ...row, id: known.get(identity(row))?.id || `B8-TEST-${crypto.createHash('sha256').update(identity(row)).digest('hex').slice(0, 10)}`,
  previousClassification: known.get(identity(row))?.classification || null,
  previouslyFailed: known.has(identity(row)), status: 'OPEN', waived: false,
}));
const result = {
  at: new Date().toISOString(), base: 'ea0b843afbb8946eaaa248ea57786651cd3d457b', label,
  counts: { total: current.numTotalTests, passed: current.numPassedTests, failed: current.numFailedTests, skipped: current.numPendingTests, todo: current.numTodoTests, files: current.testResults.length },
  failures,
  files: [...new Set(failures.map(row => row.file))].map(file => ({ file, failed: failures.filter(row => row.file === file).length, previous: failures.filter(row => row.file === file && row.previouslyFailed).length })),
  newFailingIdentities: failures.filter(row => !row.previouslyFailed).map(row => ({ id: row.id, file: row.file, name: row.name, error: row.error })),
  previousFailuresNowPassing: prior.failures.filter(row => observed.get(identity(row))?.status === 'passed').map(row => ({ id: row.id, file: row.file, name: row.name })),
  previousFailuresNotObserved: prior.failures.filter(row => !observed.has(identity(row))).map(row => ({ id: row.id, file: row.file, name: row.name })),
  suiteErrors: current.testResults.filter(suite => suite.status === 'failed' && !suite.assertionResults.some(test => test.status === 'failed')).map(suite => ({ file: path.relative(process.cwd(), suite.name).replace(/\\/g, '/'), message: suite.message })),
  limits: 'Unclassified failures remain open. An old classification is not a current root-cause proof. Local fixture execution is not hosted CI, deployed/provider, inbox, capacity or recovery certification.',
};
fs.writeFileSync(path.join(__dirname, `${label}-reconciliation.json`), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result.counts, newFailures: result.newFailingIdentities.length, oldNowPassing: result.previousFailuresNowPassing.length, oldNotObserved: result.previousFailuresNotObserved.length, suiteErrors: result.suiteErrors.length, files: result.files }, null, 2));
