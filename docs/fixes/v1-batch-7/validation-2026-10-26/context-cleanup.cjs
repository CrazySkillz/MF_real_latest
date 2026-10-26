const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { spawnSync } = require('node:child_process');
(async () => {
  const cluster = path.resolve('audit-temp/v1-batch4-sheets-pg');
  if (cluster.toLowerCase() !== 'c:\\users\\me\\documents\\mf_real_latest\\audit-temp\\v1-batch4-sheets-pg') throw Error('Unexpected audit cluster');
  const client = new Client({ host: '127.0.0.1', port: 55444, database: 'ga4_alignment_test', user: 'v1_audit', password: '', ssl: false, application_name: 'v1_context_cleanup' });
  await client.connect();
  let state;
  try {
    state = (await client.query("SELECT current_setting('data_directory') AS directory, current_setting('listen_addresses') AS listen, (SELECT count(*)::int FROM pg_namespace WHERE nspname LIKE 'v1_report_history_%') AS test_schemas, (SELECT count(*)::int FROM pg_stat_activity WHERE application_name LIKE 'v1_report_history_%') AS test_sessions")).rows[0];
  } finally { await client.end(); }
  if (path.resolve(state.directory).toLowerCase() !== cluster.toLowerCase() || state.listen !== '127.0.0.1' || state.test_schemas || state.test_sessions) throw Error('Audit cleanup boundary failed');
  const executable = 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe';
  const stop = spawnSync(executable, ['-D', cluster, '-m', 'fast', '-w', 'stop'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
  const status = spawnSync(executable, ['-D', cluster, 'status'], { encoding: 'utf8', windowsHide: true, timeout: 10000 });
  const result = { at: new Date().toISOString(), state, stopped: stop.status === 0 && status.status === 3, productionAccessed: false };
  fs.writeFileSync(path.join(__dirname, 'context-cleanup.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
  if (!result.stopped) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
