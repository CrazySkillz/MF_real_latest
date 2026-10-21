// Isolated validation: never inherit application credentials or load .env.
const fs = require('node:fs');
const { spawnSync } = require('node:child_process');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) environment[key] = value;
}
Object.assign(environment, { NODE_ENV: 'test', DATABASE_URL: '' });
if (process.argv.includes('--local-pg')) Object.assign(environment, {
  GA4_TEST_DATABASE_URL: 'postgresql://v1_audit@127.0.0.1:55443/ga4_alignment_test',
  NOTIFICATION_TEST_DATABASE_URL: 'postgresql://v1_audit@127.0.0.1:55443/notifications_test',
  V1_BATCH2_TEST_DATABASE_URL: 'postgresql://v1_audit@127.0.0.1:55443/notifications_test',
});
const [label, ...files] = process.argv.slice(2).filter(value => value !== '--local-pg');
if (!/^[a-z0-9-]+$/.test(label || '') || !files.length) throw new Error('Supply a result label and test files');
const directory = 'docs/fixes/v1-batch-3/validation-2026-10-21';
fs.mkdirSync(directory, { recursive: true });
const fd = fs.openSync(`${directory}/${label}.log`, 'w');
const result = spawnSync(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', ...files,
  '--maxWorkers=2', '--reporter=json', `--outputFile=${directory}/${label}.json`],
{ env: environment, stdio: ['ignore', fd, fd], windowsHide: true, timeout: 600000 });
fs.closeSync(fd);
console.log(JSON.stringify({ exitCode: result.status, errorCode: result.error?.code || null,
  log: `${directory}/${label}.log`, results: `${directory}/${label}.json` }));
process.exitCode = result.status ?? 1;
