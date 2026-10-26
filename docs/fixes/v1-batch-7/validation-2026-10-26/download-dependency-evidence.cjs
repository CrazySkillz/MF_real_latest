const fs = require('node:fs'), crypto = require('node:crypto'), assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const dir = __dirname, sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const latest = new Map();
for (const result of ['download-dependency-final.json', 'download-dependency-browser-final.json']) {
  for (const file of JSON.parse(fs.readFileSync(`${dir}/${result}`)).testResults) latest.set(file.name, { ...file, evidence: result });
}
const tests = {};
let passed = 0;
for (const result of latest.values()) {
  const file = result.name.replaceAll('\\', '/').split('/MF_real_latest/')[1];
  assert(result.assertionResults.length > 0);
  assert(result.assertionResults.every(test => test.status === 'passed'), file);
  passed += result.assertionResults.length;
  tests[file] = { passed: result.assertionResults.length, sha256: sha(fs.readFileSync(file)), evidence: result.evidence };
}
const builds = JSON.parse(fs.readFileSync(`${dir}/download-dependency-final-build-checks.json`));
assert(builds.checks.every(check => check.exitCode === 0));
const protectedFiles = ['server/routes-oauth.ts', 'server/storage.ts', 'shared/schema.ts', 'server/report-scheduler.ts', 'server/ga4-daily-scheduler.ts', 'server/ga4-scheduled-report-pdf.ts', 'client/src/pages/ga4-ad-comparison.tsx'];
assert.equal(git(['diff', 'HEAD', '--name-only', '--', ...protectedFiles]).trim(), '');
assert.equal(git(['diff', 'HEAD', '--name-only', '--', '*.pdf', '*.png']).trim(), '');
const runtimeFile = 'client/src/pages/ga4-metrics.tsx';
const evidence = {
  base: git(['rev-parse', 'HEAD']).trim(), stateAtValidation: 'local; deployment acceptance pending',
  rootCause: 'Shared publication wait/error included unrelated Insights history and channel requests before report-specific preflight.',
  baseline: 'download-dependency-baseline.json', runtime: { [runtimeFile]: sha(fs.readFileSync(runtimeFile)) },
  unchangedFiles: Object.fromEntries(protectedFiles.map(file => [file, sha(fs.readFileSync(file))])),
  passed, failed: 0, skipped: 0, files: latest.size, tests, builds,
  browser: { personalBrowserAccess: false, normalPageMode: true, allRequestsIntercepted: true, downloadsPerContextCase: 5,
    cases: ['pending/failed channel context', 'pending/failed 60-day history', 'selected Insights pending blocked', 'core daily/status failures blocked then recover', 'financial mismatch blocked then recovers'],
    expectedNative: 7653.96, expectedTotal: 8003.96 },
  historicalTrackedArtifactsUnchanged: true,
  limits: ['Exact production pending/failed request was not observed.', 'First consolidated run had one 10-second download-event timeout; latest browser rerun uses 20 seconds and passes both cases.', 'Deployment and natural emailed artifact acceptance remain pending; no full production-readiness claim.'],
};
fs.writeFileSync(`${dir}/download-dependency-validation.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed, files: latest.size, builds: builds.checks.length, preserved: true }));
