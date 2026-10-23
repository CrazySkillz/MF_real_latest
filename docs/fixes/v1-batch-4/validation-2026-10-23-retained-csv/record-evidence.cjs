// One-off record writer for this checkpoint; uses saved local reports, never application credentials.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const write = (name, value) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
const current = read('final.json'), route = read('verified-route.json');
const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json', 'utf8'));
const prior = new Map(previous.failures.map(f => [f.name, f]));
const latest = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-4/validation-2026-10-23-sheets-spend/assessment.json', 'utf8'));
for (const f of latest.failures) prior.set(f.name, { ...f, firstFailure: (f.currentError || f.firstFailure).split('\n')[0] });
const failures = current.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const p = prior.get(t.fullName); assert.ok(p, `Unclassified new failure: ${t.fullName}`);
  const first = t.failureMessages[0].split('\n')[0];
  assert.equal(first, p.firstFailure, `Changed failure boundary: ${t.fullName}`);
  return { id: p.id, file: p.file, name: t.fullName, classification: p.classification, reason: p.reason,
    firstFailure: first, releaseImpact: p.releaseImpact || p.reason, status: 'FAILED; OPEN', waived: false,
    presentInPreviousFullSuite: true, currentFailureMatchesPrevious: true };
}));
const counts = r => ({ total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests });
assert.equal(route.numPassedTests, 29); assert.equal(route.numFailedTests, 0); assert.equal(route.numPendingTests, 0);
assert.equal(failures.length, 18);
assert.ok(read('verified-build-checks.json').checks.every(c => c.exitCode === 0));
const files = ['server/routes-oauth.ts', 'server/storage.ts', 'server/v1-batch4-retained-csv-revenue.test.ts',
  'server/google-ads-revenue-csv-flow.test.ts', 'server/csv-revenue-validation.test.ts'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const hashes = files.map(file => ({ file, normalizedSha256: hash(fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n')) }));
write('candidate-manifest.json', { at: new Date().toISOString(), baseHead: 'eb3fca00f62dd8229b12a972956fc06e026281a2',
  state: 'uncommitted; undeployed', files: hashes,
  checkpointNote: '534-test final.json preceded only the Map loop compatibility correction in routes-oauth.ts; verified-route.json reruns all 29 new cases on these final files and verified-build-checks.json passes.',
  routeHashFor534TestCheckpoint: hash(fs.readFileSync(files[0], 'utf8').replace(/\r\n/g, '\n').replace(
    '\n        for (const [key, rev] of Array.from(revenueByDateAndCampaign.entries())) {', '\n        for (const [key, rev] of revenueByDateAndCampaign) {')) });
write('assessment.json', { at: new Date().toISOString(), finding: 'V1-072', implementation: 'VERIFIED LOCALLY; uncommitted and undeployed', releaseAcceptance: 'OPEN',
  targeted: counts(current), newRegression: counts(route), newPostgresTests: 12, failures,
  newFailingIdentities: [], beforeFix: counts(read('before.json')),
  intermediateCorrections: [
    'Two CSV validation source-text assertions required the removed unsafe separate mutations; corrected to check both existing transaction paths and their ordering, with independent route/PostgreSQL behavior tests.',
    'Updated Google Ads source-identity structural check to require atomic replacement rather than separate update/delete/create calls; unrelated Google Ads checks remain failed and classified.',
    'Initial TypeScript check rejected direct Map iteration under the existing compiler target; restored Array.from(map.entries()) as used by the old code. Final build and all 29 new cases pass.'
  ],
  boundaries: { runtime: 'CSV preview/process and the existing non-GA4 CSV source/record transaction only',
    integration: 'Actual registered handler, parser, mapping/attribution helpers and DatabaseStorage against disposable localhost schemas; auth, provider and downstream recompute boundaries are fixtures.',
    notValidated: ['deployed authenticated import/browser', 'provider values and full downstream publication', 'all non-GA4 amount/date/currency variants', 'post-commit LinkedIn connection/session/recompute failure recovery', 'historical damaged CSV recovery', 'hosted load and full application release'] },
  safety: { productionReads: false, productionWrites: false, providerCalls: false, migrations: false, credentialsLoaded: false } });
console.log(JSON.stringify({ targeted: counts(current), newRegression: counts(route), classifiedOpenFailures: failures.length }));
