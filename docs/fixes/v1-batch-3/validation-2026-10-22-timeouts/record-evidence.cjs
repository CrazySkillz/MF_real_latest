// Reconcile current test evidence without reclassifying or waiving earlier failures.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const write = (name, data) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(data, null, 2) + '\n', { flag: 'wx' });
const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/failure-reconciliation.json', 'utf8'));
const relative = file => file.replaceAll('\\', '/').split('/server/').map((part, i) => i ? 'server/' + part : part).at(-1);
const key = (file, name) => `${file}|${name}`;
const known = new Map(previous.failures.map(f => [key(f.file, f.name), f]));
const full = read('full-suite.json'), focused = read('final-targeted.json');
const totals = r => ({ total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests });
const failures = full.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const file = relative(s.name), prior = known.get(key(file, t.fullName));
  return { ...prior, file, name: t.fullName, error: t.failureMessages.join('\n'), status: 'FAILED; OPEN', waived: false,
    newFailingIdentity: !prior };
}));
const passedKeys = new Set(full.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'passed').map(t => key(relative(s.name), t.fullName))));
const resolved = previous.failures.filter(f => passedKeys.has(key(f.file, f.name))).map(f => ({ id: f.id, file: f.file, name: f.name,
  resolution: 'Corrected the obsolete source assertion to locate the existing ownership-aware credential call, assert that it exists, and retain validation-before-credentials ordering. No validation guard was removed.' }));
const suiteErrors = full.testResults.filter(s => s.status === 'failed' && !s.assertionResults.some(t => t.status === 'failed'));
write('failure-reconciliation.json', { at: new Date().toISOString(), fullSuiteCheckpoint: totals(full), finalTargeted: totals(focused),
  newFailingIdentities: failures.filter(f => f.newFailingIdentity), suitesFailingWithoutFailedAssertions: suiteErrors.map(s => ({ file: relative(s.name), message: s.message })),
  failuresByClassification: failures.reduce((out, f) => { out[f.classification || 'UNCLASSIFIED'] = (out[f.classification || 'UNCLASSIFIED'] || 0) + 1; return out; }, {}),
  resolvedSincePrevious: resolved, failures,
  boundary: 'The full run began before the adjacent HubSpot body guard and six PostgreSQL route-preservation cases were added. The subsequent 591-check packet validates the final changed paths, including all six cases. Do not present these as a second complete full-suite run.' });
const runtime = ['server/analytics.ts', 'server/googleAdsClient.ts', 'server/google-ads-scheduler.ts', 'server/routes-oauth.ts', 'server/utils/salesforce-pagination.ts'];
const tests = ['server/v1-batch3-provider-timeouts.test.ts', 'server/v1-batch3-google-ads-timeouts.test.ts', 'server/google-ads-spend-production-path.test.ts', 'server/ga4-financial-source-ownership-postgres.test.ts', 'server/salesforce-pagination.test.ts'];
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
write('candidate-manifest.json', { at: new Date().toISOString(), baseHead: '6b65d9c40e9a2f49b665b06094732a22e1b9f0c4', state: 'uncommitted',
  files: [...runtime, ...tests].map(file => { const data = fs.readFileSync(file); return { file, sha256: hash(data), lfSha256: hash(data.toString('utf8').replace(/\r\n/g, '\n')) }; }) });
write('assessment.json', { at: new Date().toISOString(), finding: 'V1-025', fixStatus: 'IN PROGRESS', releaseAcceptance: 'OPEN',
  result: 'Bounded diagnostic/provider timeout corrections verified locally; Batch 3 remains incomplete.',
  runtimeFiles: runtime, testFiles: tests,
  reproducedBefore: { diagnosticSalesforceAndSharedHelper: totals(read('before-verified.json')), googleAds: totals(read('ads-before.json')),
    adjacentHubspot: totals(read('adjacent-hubspot-before.json')), initialRunnerFailure: 'before.log: sandbox compiler spawn EPERM; no application assertions ran.' },
  fullSuiteCheckpoint: totals(full), finalTargeted: totals(focused), unresolvedFailures: failures.length,
  newFailingIdentities: failures.filter(f => f.newFailingIdentity).length,
  typecheckAndServerBuild: read('final-build-checks.json'), initialProductionBuilds: read('build-checks.json'),
  remaining: ['V1-011 external-source durable recovery', 'V1-025 retained LinkedIn shared-job cancellation/late writes, remaining nested provider waits, deployed provider acceptance', 'V1-089 shared-property concurrency', 'V1-090 provider quality metadata', 'Full V1 release acceptance and 180 individually recorded test failures'],
  safety: { applicationCredentialsRemoved: true, externalHttpBlockedInTestRunner: true, onlyLocalhostFixtureDatabases: true,
    productionWrites: false, ptomoChanged: false, providerAcceptance: false, uiAcceptance: false, committed: false, pushed: false, deployed: false },
  limits: ['Timeout rejection is not proof of provider-side computation stopping immediately.', 'Per-request provider bounds do not establish every whole-job deadline or cross-worker write fence.',
    'The full-suite checkpoint and final targeted run have different test inventories; do not add their counts or imply full V1 certification.'] });
if (focused.numFailedTests || focused.numPendingTests || failures.some(f => f.newFailingIdentity) || suiteErrors.length) process.exitCode = 1;
console.log(JSON.stringify({ full: totals(full), focused: totals(focused), unresolved: failures.length, newFailures: failures.filter(f => f.newFailingIdentity).length, resolved: resolved.map(f => f.id) }));
