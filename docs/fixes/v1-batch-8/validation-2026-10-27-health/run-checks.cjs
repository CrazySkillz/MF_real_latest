const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const label = process.argv[2];
if (!['before', 'after', 'final'].includes(label)) throw new Error('Expected before, after or final');
const env = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) env[key] = value;
}
Object.assign(env, { NODE_ENV: 'test', DATABASE_URL: '', NODE_OPTIONS: `--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replaceAll('\\', '/')}` });
const tests = ['server/v1-batch8-scheduler-health.test.ts'];
if (label !== 'before') tests.push(
  'server/ga4-scheduler-observability-regression.test.ts',
  'server/financial-daily-snapshot-observation.test.ts',
  'server/financial-daily-snapshot-readiness.test.ts',
  'server/v1-batch2-scheduler-startup.test.ts',
  'server/v1-batch8-interval-publication.test.ts',
);
const fd = fs.openSync(`${__dirname}/${label}.log`, 'wx');
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...tests, '--maxWorkers=2', '--reporter=default', '--reporter=json', `--outputFile=${__dirname}/${label}.json`], {
  env, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 120000,
});
fs.closeSync(fd);
const report = JSON.parse(fs.readFileSync(`${__dirname}/${label}.json`, 'utf8'));
const summary = { at: new Date().toISOString(), exitCode: result.status, error: result.error?.code || null,
  tests: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests, skipped: report.numPendingTests,
  failedSuites: report.numFailedTestSuites, success: report.success,
  failures: report.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, error: test.failureMessages[0] }))),
};
fs.writeFileSync(`${__dirname}/${label}-summary.json`, JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...summary, failures: summary.failures.map(failure => failure.name) }));
if (label !== 'before' && (result.status !== 0 || !report.success || report.numPendingTests || report.numPassedTests !== report.numTotalTests)) process.exitCode = 1;
