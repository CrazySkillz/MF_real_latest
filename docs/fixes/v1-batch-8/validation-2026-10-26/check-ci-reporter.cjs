const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(key)) environment[key] = value;
Object.assign(environment, { NODE_ENV: 'test', DATABASE_URL: '', NODE_OPTIONS: `--require=${path.resolve('docs/fixes/v1-batch-3/deployment-2026-10-22/local-network-only.cjs').replace(/\\/g, '/')}` });
const results = [];
for (const mode of ['pass', 'assertion-failure', 'unhandled']) {
  const errorFile = path.join(__dirname, `reporter-${mode}-errors.json`);
  const outputFile = path.join(__dirname, `reporter-${mode}.json`);
  const fd = fs.openSync(path.join(__dirname, `reporter-${mode}.log`), 'wx');
  const run = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', path.join(__dirname, 'ci-reporter.config.ts'), '--maxWorkers=1', '--reporter=json', `--reporter=${path.resolve('scripts/ga4-test-run-errors.cjs')}`, `--outputFile=${outputFile}`],
    { env: { ...environment, CI_RECEIPT_FIXTURE: mode, CURRENT_VERSION_TEST_ERRORS_FILE: errorFile }, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 60000 });
  fs.closeSync(fd);
  const receipt = JSON.parse(fs.readFileSync(errorFile, 'utf8'));
  const report = JSON.parse(fs.readFileSync(outputFile, 'utf8'));
  assert.equal(run.status, mode === 'pass' ? 0 : 1);
  assert.equal(receipt.errors.length, mode === 'unhandled' ? 1 : 0);
  assert.equal(report.numFailedTests, mode === 'assertion-failure' ? 1 : 0);
  if (mode === 'unhandled') assert.match(receipt.errors[0], /CONTROLLED_UNHANDLED_FIXTURE/);
  results.push({ mode, exit: run.status, assertionFailures: report.numFailedTests, receipt, expectedOutcomeVerified: true });
}
fs.writeFileSync(path.join(__dirname, 'reporter-integration.json'), JSON.stringify({ at: new Date().toISOString(), results }, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(results));
