const fs = require('node:fs');
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const environment = {};
for (const [key, value] of Object.entries(process.env)) {
  if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT)$/i.test(key)) environment[key] = value;
}
(async () => {
  const client = new Client({ host: '127.0.0.1', port: 55444, database: 'ga4_alignment_test', user: 'v1_audit', password: '', ssl: false, application_name: 'v1_batch7_cleanup' });
  await client.connect();
  let before;
  try {
    const data = await client.query("SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS listen, (SELECT count(*)::integer FROM pg_stat_activity WHERE application_name = 'v1_batch7_metrics') AS test_sessions, (SELECT count(*)::integer FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname LIKE 'pg_temp_%' AND c.relname IN ('spend_records','revenue_records')) AS test_temp_tables");
    before = data.rows[0];
  } finally { await client.end(); }
  const directory = path.resolve('audit-temp/v1-batch4-sheets-pg');
  if (path.resolve(before.directory).toLowerCase() !== directory.toLowerCase() || before.listen !== '127.0.0.1' || before.test_sessions !== 0 || before.test_temp_tables !== 0) throw new Error('Owned test-instance boundary or cleanup check failed');
  const executable = 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe';
  const stop = spawnSync(executable, ['-D', directory, '-m', 'fast', '-w', 'stop'], { env: environment, encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const status = spawnSync(executable, ['-D', directory, 'status'], { env: environment, encoding: 'utf8', windowsHide: true, timeout: 10000 });
  const result = { at: new Date().toISOString(), before, stopExitCode: stop.status, statusExitCode: status.status, stopped: stop.status === 0 && status.status === 3, productionAccessed: false };
  fs.writeFileSync(path.join(__dirname, 'retained-cleanup.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
  if (!result.stopped) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
