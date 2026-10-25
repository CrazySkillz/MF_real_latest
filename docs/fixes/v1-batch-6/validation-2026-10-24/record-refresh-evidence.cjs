// Local evidence only; no application imports, credentials or external access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const previous = read('ratios-evidence-oct25.json');
const files = new Map(previous.files.map(file => [file.file, file]));
const packets = ['refresh-guards-pg-final-oct25', 'refresh-guards-neighbors-final-oct25', 'refresh-guards-source-safety-oct25'];
const runs = packets.map(packet => {
  const result = read(`${packet}.json`);
  for (const item of result.testResults) {
    const file = path.relative(process.cwd(), item.name).replace(/\\/g, '/');
    files.set(file, { file, packet, passed: item.assertionResults.filter(test => test.status === 'passed').length,
      failed: item.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName),
      skipped: item.assertionResults.filter(test => !['passed', 'failed'].includes(test.status)).length });
  }
  return { packet, files: result.testResults.length, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests };
});
const latest = [...files.values()].sort((a, b) => a.file.localeCompare(b.file));
const evidence = {
  at: new Date().toISOString(), baseline: previous.baseline,
  scope: 'Ordinary Google Ads main/legacy Spend and dedicated GA4 Spend refresh writes recheck current campaign, connection and source inputs under transaction locks.',
  deployment: previous.deployment,
  runs, files: latest,
  latestPerFileTotals: { files: latest.length, passed: latest.reduce((n, f) => n + f.passed, 0), failed: latest.reduce((n, f) => n + f.failed.length, 0), skipped: latest.reduce((n, f) => n + f.skipped, 0) },
  builds: read('refresh-guards-final-oct25-build-checks.json'),
  hashes: ['server/google-ads-scheduler.ts', 'server/storage.ts', 'server/v1-batch6-google-ads-refresh-postgres.test.ts', 'server/google-ads-spend-production-path.test.ts', 'server/ga4-google-ads-scheduler-regression.test.ts', 'client/src/pages/google-ads-analytics.tsx', 'server/v1-batch6-google-ads-values.test.ts'].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
  cleanup: { remainingOwnedSchemas: 0, postgresFixture: '127.0.0.1:55444/ga4_alignment_test', stopped: true },
  limits: ['Synthetic provider responses; no user browser, authenticated provider, production data or historical cleanup.',
    'Ordinary checks compare current input values under locks, not an input revision or job lease. Edit-then-restore and overlapping response ordering are not certified.',
    'The separate retained spend-import route, every deferred-provider writer/retry/restart, scheduled goal/alert/report propagation and historical data remain open.',
    'No live provider deployment acceptance; whole-app and Batch 6 readiness remain open.'],
};
fs.writeFileSync(path.join(__dirname, 'refresh-guards-evidence-oct25.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ runs, latest: evidence.latestPerFileTotals }));
