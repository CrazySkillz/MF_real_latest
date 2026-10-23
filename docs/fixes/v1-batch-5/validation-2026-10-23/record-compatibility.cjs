const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const previous = read('assessment.json'), ledger = read('failure-reconciliation.json');
const final = read('compatibility-related.json'), focused = read('currency-recovery-verified.json');
const summary = r => ({ total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests });
assert.equal(focused.numFailedTests, 0); assert.equal(focused.numPendingTests, 0); assert.equal(final.numPendingTests, 0);
const failures = final.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const old = ledger.failures.find(f => f.name === t.fullName); assert.ok(old, `Unclassified failure: ${t.fullName}`);
  return { ...old, currentFile: path.relative(process.cwd(), s.name).replace(/\\/g, '/'), currentError: t.failureMessages.join('\n') };
}));
assert.equal(failures.length, final.numFailedTests);
const newCases = final.testResults.filter(s => s.name.includes('v1-batch5-')).flatMap(s => s.assertionResults);
assert.ok(newCases.every(t => t.status === 'passed'));
const files = [...previous.manifest.map(f => f.file), 'server/utils/salesforceCurrency.ts'];
const assessment = {
  at: new Date().toISOString(), baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidate: 'UNCOMMITTED working tree; not deployed',
  supersedesCandidateManifest: 'assessment.json', findings: previous.findings, fixStatus: 'VERIFIED LOCALLY within documented boundaries', releaseAcceptance: 'OPEN', releaseDecision: 'NO-GO',
  final: summary(final), focused: summary(focused),
  newBatch5Checks: { total: newCases.length, passed: newCases.length, failed: 0, skipped: 0, realPostgres: newCases.filter(t => t.ancestorTitles.includes('Batch 5 real PostgreSQL preservation and replacement')).length, fullPageBrowser: 1 },
  builds: read('currency-recovery-build-checks.json'), unchangedClientBuild: 'verified-build-checks.json',
  changedSincePriorManifest: files.filter(file => previous.manifest.find(f => f.file === file)?.sha256 !== crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')),
  manifest: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
  scope: 'V1-109 Salesforce missing-currency cache recovery; exact save and on-demand routes; additive opt-in single-currency SOAP verification in existing helper; no schema or response-shape changes',
  isolation: previous.isolation, productionWrites: false, providerCalls: false,
  readOnlyProductionInventory: 'predeploy-compatibility-complete.json', renderEnvironmentEvidence: 'render-environment-confirmation.json',
  intermediateFailure: { file: 'currency-recovery.json', classification: 'Two positive tests exposed missing actual stage-helper binding in the fixture; no runtime failure was hidden. Bound the actual helper and supplied complete stage metadata. Negative database assertions now require a currency-related error.', corrected: true },
  limits: ['Actual Salesforce single/multi-currency configuration and provider recovery remain unverified; failed verification retains stored data and displays unavailable.', 'One orphan HubSpot connection and aggregate CRM records without provider IDs were inventoried, not cleaned or certified.', ...previous.limits.filter(v => !v.includes('No historical corrupted-data inventory'))],
  next: 'Review current diff and commit/push candidate; after deployment verify exact revision, provider recovery and required release gates. No release GO.'
};
assert.ok(assessment.builds.checks.every(c => c.exitCode === 0));
write('compatibility-assessment.json', assessment);
write('compatibility-failure-reconciliation.json', { at: assessment.at, final: assessment.final, newFailingIdentities: [], failures, previousWholeSuite: ledger.previousWholeSuite, separateCiGate: ledger.separateCiGate });
console.log(JSON.stringify({ final: assessment.final, newBatch5Checks: assessment.newBatch5Checks, changedSincePriorManifest: assessment.changedSincePriorManifest }));
