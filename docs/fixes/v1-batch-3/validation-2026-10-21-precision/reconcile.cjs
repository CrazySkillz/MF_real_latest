// Read-only reconciliation of test results; never loads application configuration.
const fs = require('node:fs'), crypto = require('node:crypto');
const directory = 'docs/fixes/v1-batch-3/validation-2026-10-21-precision';
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const identity = row => `${row.file}\n${row.name}`;
const assertions = data => data.testResults.flatMap(suite => suite.assertionResults.map(test => ({
  file: suite.name.replace(/\\/g, '/').split('/MF_real_latest/').at(-1), name: test.fullName,
  status: test.status, error: test.failureMessages?.[0] || null,
})));
const counts = data => ({ total: data.numTotalTests, passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests });
const prior = read('docs/fixes/v1-batch-3/validation-2026-10-21/failure-reconciliation.json');
const originals = read('docs/audits/v1-2026-10-19/test-failures.json');
const known = new Map(prior.failures.map(row => [identity(row), row]));
const final = read(`${directory}/full-suite-final.json`), intermediate = read(`${directory}/full-suite.json`);
const fullRows = assertions(final);
const followUp = assertions(read(`${directory}/parser-assertion-corrected.json`));
const rerun = new Map(followUp.map(row => [identity(row), row]));
const currentRows = fullRows.map(row => rerun.get(identity(row)) || row);
const current = new Map(currentRows.map(row => [identity(row), row]));
const failures = currentRows.filter(row => row.status === 'failed').map(row => ({
  ...known.get(identity(row)), ...row,
  id: known.get(identity(row))?.id || `B3-TEST-${crypto.createHash('sha256').update(identity(row)).digest('hex').slice(0, 10)}`,
  classification: known.get(identity(row))?.classification || 'UNCLASSIFIED',
  releaseImpact: known.get(identity(row))?.releaseImpact || 'New failure requires investigation; release remains blocked.',
  status: 'FAILED; OPEN', waived: false,
}));
const newInterimFailures = assertions(intermediate).filter(row => row.status === 'failed' && !known.has(identity(row))).map(row => ({
  id: `B3-TEST-${crypto.createHash('sha256').update(identity(row)).digest('hex').slice(0, 10)}`, finding: 'V1-079',
  ...row, classification: row.file === 'server/ga4-overview-performance-readiness.test.ts' ? 'STRUCTURAL_ASSERTION' : 'UNCLASSIFIED',
  explanation: row.file === 'server/ga4-overview-performance-readiness.test.ts'
    ? 'Required the obsolete integer parser. Updated only that assertion to the fractional parser; retained campaign/property/date/currency and authoritative-financial-input checks. Actual service fractional and integer controls pass separately.'
    : 'Requires investigation.',
  fullSuiteStatus: fullRows.find(item => identity(item) === identity(row))?.status,
  currentStatus: current.get(identity(row))?.status || 'NOT_EXECUTED', waived: false,
}));
const output = {
  at: new Date().toISOString(), baseHead: 'aee04e508f0761ac2a9f53724393676a1bda7110',
  boundary: 'Uncommitted partial V1-079 correction; isolated local fixtures only, no CI/deployment/provider certification. Prior runtime fixes preserved.',
  priorFullSuite: prior.finalFullSuite, intermediateFullSuite: counts(intermediate), finalFullSuite: counts(final),
  currentResultsBoundary: 'The full run loaded the old integer-parser source assertion before its edit. Only that test file and the provider precision tests were rerun afterward: 17 passed. Current unresolved failures combine those results; this is not another whole-suite pass. Runtime files were unchanged after the final full-run start.',
  fullSuiteFailureCount: fullRows.filter(row => row.status === 'failed').length,
  currentUnresolvedFailureCount: failures.length,
  targeted: counts(read(`${directory}/precision-final-targeted.json`)),
  correctedParserAssertion: counts(read(`${directory}/parser-assertion-corrected.json`)),
  newFailingIdentities: failures.filter(row => !known.has(identity(row))).map(row => identity(row)),
  failuresByClassification: failures.reduce((result, row) => { result[row.classification] = (result[row.classification] || 0) + 1; return result; }, {}),
  suitesFailingWithoutFailedAssertions: final.testResults.filter(suite => suite.status === 'failed' && !suite.assertionResults.some(test => test.status === 'failed')).map(suite => ({ name: suite.name, message: suite.message })),
  failures,
  originalFindingStatuses: originals.map(row => ({ id: row.id, file: row.file, name: row.name,
    classification: row.classification, currentStatus: current.get(identity(row))?.status || 'NOT_EXECUTED',
    explanation: row.id === 'TEST-f323e48c9f' ? 'CI has not rerun; passing local browser fixtures do not close CI acceptance.' : row.reason,
    waived: false })),
  interimNewFailures: newInterimFailures,
};
fs.writeFileSync(`${directory}/failure-reconciliation.json`, JSON.stringify(output, null, 2) + '\n');
console.log(JSON.stringify({ ...output.finalFullSuite, newFailures: output.newFailingIdentities.length,
  suiteErrors: output.suitesFailingWithoutFailedAssertions.length, classifications: output.failuresByClassification }));
if (output.newFailingIdentities.length || output.suitesFailingWithoutFailedAssertions.length) process.exitCode = 1;
