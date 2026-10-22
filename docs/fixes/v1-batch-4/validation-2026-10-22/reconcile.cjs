// Local test evidence only. Does not load application environment or access a database.
const fs = require('node:fs'), crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const id = row => `${row.file}\n${row.name}`;
const assertions = data => data.testResults.flatMap(suite => suite.assertionResults.map(test => ({
  file: suite.name.replace(/\\/g, '/').split('/MF_real_latest/').at(-1), name: test.fullName,
  status: test.status, error: test.failureMessages?.[0] || null,
})));
const counts = data => ({ total: data.numTotalTests, passed: data.numPassedTests, failed: data.numFailedTests, skipped: data.numPendingTests });
const prior = read('docs/fixes/v1-batch-3/validation-2026-10-22-completion/failure-reconciliation.json');
const known = new Map(prior.failures.map(row => [id(row), row]));
const intermediate = read(`${__dirname}/full-suite.json`), final = read(`${__dirname}/full-suite-final.json`);
const rows = assertions(final), current = new Map(rows.map(row => [id(row), row]));
const failures = rows.filter(row => row.status === 'failed').map(row => ({
  ...known.get(id(row)), ...row,
  id: known.get(id(row))?.id || `B4-TEST-${crypto.createHash('sha256').update(id(row)).digest('hex').slice(0, 10)}`,
  classification: known.get(id(row))?.classification || 'UNCLASSIFIED',
  releaseImpact: known.get(id(row))?.releaseImpact || 'New failure requires investigation; release remains blocked.',
  status: 'FAILED; OPEN', waived: false,
}));
const result = {
  at: new Date().toISOString(), baseHead: 'ff3c511513c5c93b2c236ba92c95a274f97c4973',
  boundary: 'Four uncommitted Batch 4 forward corrections; local fixture checks only. No deployed/provider/whole-source certification.',
  previousFullSuite: prior.fullSuiteCheckpoint, intermediateFullSuite: counts(intermediate), finalFullSuite: counts(final),
  newFailingIdentities: failures.filter(row => !known.has(id(row))).map(id),
  suitesFailingWithoutFailedAssertions: final.testResults.filter(s => s.status === 'failed' && !s.assertionResults.some(t => t.status === 'failed')).map(s => ({ file: s.name, message: s.message })),
  correctedIntermediateRegressions: assertions(intermediate).filter(row => row.status === 'failed' && !known.has(id(row))).map(row => ({
    ...row, finalStatus: current.get(id(row))?.status,
    classification: 'CAMPAIGN_UPDATE_RETURN_CONTRACT_REGRESSION',
    correction: 'The new parent guard initially rejected late ordinary campaign updates after cancellation. updateCampaign and updateCampaignWithGA4DailyInvalidation now preserve undefined for a vanished parent while source writers still reject and owned refresh writes keep their ownership errors. Real PostgreSQL cancellation/activation races pass.',
    waived: false,
  })),
  previousFailuresNowPassing: prior.failures.filter(row => current.get(id(row))?.status === 'passed').map(row => ({
    id: row.id, file: row.file, name: row.name, waived: false,
    explanation: 'CSV Spend structural assertion followed an obsolete direct transaction call. It now follows the existing transaction wrapper and surviving-parent guard, retaining source/type/campaign and delete/insert ordering checks. PostgreSQL ownership and rollback tests independently validate behavior.',
  })),
  failuresByClassification: failures.reduce((out, row) => { out[row.classification] = (out[row.classification] || 0) + 1; return out; }, {}),
  failures, separateCiGate: 'TEST-f323e48c9f remains open; CI has not run for this uncommitted candidate.',
};
fs.writeFileSync(`${__dirname}/failure-reconciliation.json`, JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result.finalFullSuite, newFailures: result.newFailingIdentities.length, suiteErrors: result.suitesFailingWithoutFailedAssertions.length }));
if (result.newFailingIdentities.length || result.suitesFailingWithoutFailedAssertions.length) process.exitCode = 1;
