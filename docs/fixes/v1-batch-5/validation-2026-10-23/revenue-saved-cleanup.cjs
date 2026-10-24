const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { execFileSync, spawnSync } = require('node:child_process');
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test', max: 1, connectionTimeoutMillis: 5000 });
  const result = { at: new Date().toISOString(), host: '127.0.0.1', port: 55444, database: 'ga4_alignment_test', productionAccess: false };
  try {
    result.remainingTestSchemas = (await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'ga4_revenue_publication_it_%' OR nspname LIKE 'ga4_input_it_%' OR nspname LIKE 'ga4_source_it_%' OR nspname LIKE 'ga4_derived_it_%' OR nspname LIKE 'batch5_%'")).rows;
    result.remainingOtherClientSessions = (await pool.query("SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n;
    result.otherClientLocks = (await pool.query("SELECT count(*)::int AS n FROM pg_locks l JOIN pg_stat_activity a ON a.pid=l.pid WHERE a.datname=current_database() AND a.pid<>pg_backend_pid() AND a.backend_type='client backend'")).rows[0].n;
    assert.equal(result.remainingTestSchemas.length, 0);
    assert.equal(result.remainingOtherClientSessions, 0);
    assert.equal(result.otherClientLocks, 0);
  } finally { await pool.end(); }
  const pgCtl = 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe';
  const data = 'C:/Users/me/Documents/MF_real_latest/audit-temp/v1-batch4-sheets-pg';
  execFileSync(pgCtl, ['-D', data, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000 });
  result.fixtureClusterStopped = spawnSync(pgCtl, ['-D', data, 'status'], { windowsHide: true, timeout: 10000 }).status === 3;
  assert.equal(result.fixtureClusterStopped, true);
  fs.writeFileSync(path.join(__dirname, 'revenue-saved-cleanup.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(result));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
