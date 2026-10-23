const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Pool } = require('pg');
(async () => {
  const pool = new Pool({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test', max: 1 });
  let schemas, connections, locks;
  try {
    schemas = (await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'transfer_it_%'")).rows;
    connections = (await pool.query("SELECT pid, application_name FROM pg_stat_activity WHERE backend_type='client backend' AND pid<>pg_backend_pid()")).rows;
    locks = (await pool.query("SELECT count(*)::int AS count FROM pg_locks WHERE locktype='advisory'")).rows[0].count;
  } finally { await pool.end(); }
  if (schemas.length || connections.length || locks) throw new Error('Test database is not empty/idle; no shutdown attempted');
  const result = spawnSync('C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe', ['stop', '-D', path.resolve('audit-temp/v1-batch4-sheets-pg'), '-m', 'fast', '-w', '-t', '20'], { windowsHide: true, encoding: 'utf8', timeout: 30000 });
  const evidence = { at: new Date().toISOString(), database: '127.0.0.1:55444/ga4_alignment_test', leftoverSchemas: schemas, otherClientConnections: connections, advisoryLocks: locks, shutdownExitCode: result.status, shutdownOutput: result.stdout, error: result.error?.code || null };
  fs.writeFileSync(path.join(__dirname, 'fixture-cleanup.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(evidence)); process.exitCode = result.status ?? 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
