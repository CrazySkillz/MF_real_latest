// Evidence only; no application configuration, network or production database.
const fs = require('node:fs'), crypto = require('node:crypto');
const directory = 'docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = row => `${row.file}\n${row.name}`;
const assertions = data => data.testResults.flatMap(suite => suite.assertionResults.map(test => ({
  file: suite.name.replace(/\\/g, '/').split('/MF_real_latest/').at(-1), name: test.fullName,
  status: test.status, error: test.failureMessages?.[0] || null,
})));
const counts = data => ({ total: data.numTotalTests, passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests });
const prior = read('docs/fixes/v1-batch-3/validation-2026-10-21-precision/failure-reconciliation.json');
const known = new Map(prior.failures.map(row => [identity(row), row]));
const full = read(`${directory}/full-suite-final.json`);
const rows = assertions(full), current = new Map(rows.map(row => [identity(row), row]));
const failures = rows.filter(row => row.status === 'failed').map(row => ({
  ...known.get(identity(row)), ...row,
  id: known.get(identity(row))?.id || `B3-TEST-${crypto.createHash('sha256').update(identity(row)).digest('hex').slice(0, 10)}`,
  classification: known.get(identity(row))?.classification || 'UNCLASSIFIED',
  releaseImpact: known.get(identity(row))?.releaseImpact || 'Requires investigation; blocks release.',
  status: 'FAILED; OPEN', waived: false,
}));
const interim = read(`${directory}/new-failures-before.json`).map(row => {
  const precisionString = /ga4-(derived-publication|recovery-process)-postgres/.test(row.file);
  const binding = /findings-verified-zero/.test(row.file);
  const renamed = row.name.replace('keeps KPI progress schema and startup migration at numeric(18,2)', 'keeps KPI progress schema and startup migration precise for fractional observations');
  return { ...row, id: `B3-TEST-${crypto.createHash('sha256').update(identity(row)).digest('hex').slice(0, 10)}`,
    classification: precisionString ? 'FIXTURE_CONTRACT' : binding ? 'FIXTURE_BINDING' : 'STRUCTURAL_ASSERTION',
    explanation: precisionString ? 'Unconstrained NUMERIC still returns strings but no longer pads observed whole values with .00. Updated only observed-value expectations; target/money, ownership, atomicity, identity and recovery checks retained. Fractional PostgreSQL and restart checks added.'
      : binding ? 'Extracted Insights expression needed the actual conversion comparison function and daily-row context. Session mismatch and true conversion mismatch remain rejected.'
      : 'Exact-source assertion required superseded integer/rounding/fixed-scale/formatter code. Updated it to the precision implementation; behavioral provider/storage/formatter/browser/PDF controls accompany the source checks.',
    currentStatus: current.get(identity({ ...row, name: renamed }))?.status || 'NOT_EXECUTED', waived: false };
});
const output = {
  at: new Date().toISOString(), baseHead: 'aee04e508f0761ac2a9f53724393676a1bda7110',
  boundary: 'Uncommitted local candidate; no CI, deployment, provider or historical-repair certification.',
  intermediateFullSuite: counts(read(`${directory}/full-suite.json`)), finalFullSuite: counts(full),
  currentUnresolvedFailureCount: failures.length,
  newFailingIdentities: failures.filter(row => !known.has(identity(row))).map(identity),
  failuresByClassification: failures.reduce((result, row) => { result[row.classification] = (result[row.classification] || 0) + 1; return result; }, {}),
  suitesFailingWithoutFailedAssertions: full.testResults.filter(suite => suite.status === 'failed' && !suite.assertionResults.some(test => test.status === 'failed')).map(suite => ({ name: suite.name, message: suite.message })),
  failures, interimNewFailures: interim,
  originalFindingStatuses: read('docs/audits/v1-2026-10-19/test-failures.json').map(row => ({ id: row.id, file: row.file, name: row.name,
    classification: row.classification, currentStatus: current.get(identity(row))?.status || 'NOT_EXECUTED', waived: false })),
};
fs.writeFileSync(`${directory}/failure-reconciliation.json`, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output.finalFullSuite, newFailures: output.newFailingIdentities.length,
  suiteErrors: output.suitesFailingWithoutFailedAssertions.length, unresolved: failures.length,
  interimNotPassing: interim.filter(row => row.currentStatus !== 'passed').length }));
if (output.newFailingIdentities.length || output.suitesFailingWithoutFailedAssertions.length || interim.some(row => row.currentStatus !== 'passed')) process.exitCode = 1;
