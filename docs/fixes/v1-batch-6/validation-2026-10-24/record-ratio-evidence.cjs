// Immutable local evidence record; no application imports, credentials or network.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const before = read('ratios-before-oct25.json');
const packet = read('ratios-final-oct25.json');
const previous = read('retained-boundaries-evidence-oct25.json');
const files = new Map(previous.files.map(file => [file.file, file]));
for (const result of packet.testResults) {
  const file = path.relative(process.cwd(), result.name).replace(/\\/g, '/');
  files.set(file, { file, packet: 'ratios-final-oct25',
    passed: result.assertionResults.filter(test => test.status === 'passed').length,
    failed: result.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName),
    skipped: result.assertionResults.filter(test => !['passed', 'failed'].includes(test.status)).length });
}
const latest = [...files.values()].sort((a, b) => a.file.localeCompare(b.file));
const evidence = {
  at: new Date().toISOString(), baseline: '8a9da324343967925aae52ffd114c30447702edc',
  deployment: { userReported: true, publicHealthObserved: { ok: true, commit: '8a9da324343967925aae52ffd114c30447702edc' }, behavioralAcceptance: false },
  scope: 'Local Google Ads page ratio availability, daily Cost/Conversion, exact-only Search Impression Share and dependent chart/table/Insights/live-goal propagation.',
  before: { packet: 'ratios-before-oct25', passed: before.numPassedTests, failed: before.numFailedTests, skipped: before.numPendingTests },
  currentPacket: { packet: 'ratios-final-oct25', files: packet.testResults.length, passed: packet.numPassedTests, failed: packet.numFailedTests, skipped: packet.numPendingTests },
  files: latest,
  latestPerFileTotals: { files: latest.length, passed: latest.reduce((n, f) => n + f.passed, 0), failed: latest.reduce((n, f) => n + f.failed.length, 0), skipped: latest.reduce((n, f) => n + f.skipped, 0) },
  builds: read('ratios-final-oct25-build-checks.json'),
  hashes: ['client/src/pages/google-ads-analytics.tsx', 'server/v1-batch6-google-ads-values.test.ts', 'server/google-ads-revenue-kpi-benchmark-ui.test.ts', 'server/google-ads-scheduler.ts', 'server/storage.ts'].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
  limits: ['Six earlier source-safety static failures remain unresolved; inherited packets are not a fresh full-suite run.',
    'No browser, authenticated provider, production database or historical-data cleanup. Public health is revision evidence only.',
    'Normal Google Ads refresh final-write ownership/connection checks remain open; scheduler review is not scheduler acceptance.',
    'Saved/manual goals, scheduled recomputation, alerts, reports, provider coverage and historical outputs remain unverified.'],
};
fs.writeFileSync(path.join(__dirname, 'ratios-evidence-oct25.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ current: evidence.currentPacket, latest: evidence.latestPerFileTotals }));
