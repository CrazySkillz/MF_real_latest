const fs = require('node:fs');
const { Pool } = require('pg');
(async () => {
  const databases = [];
  for (const name of ['ga4_alignment_test', 'notifications_test']) {
    const pool = new Pool({ connectionString: `postgresql://v1_audit@127.0.0.1:55443/${name}`, max: 1, connectionTimeoutMillis: 5000 });
    try {
      const result = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname NOT LIKE 'pg_%' AND nspname NOT IN ('public','information_schema') ORDER BY nspname");
      const connections = await pool.query("SELECT count(*)::int AS count FROM pg_stat_activity WHERE datname=current_database() AND pid<>pg_backend_pid() AND backend_type='client backend'");
      databases.push({ name, remainingFixtureSchemas: result.rows.map(row => row.nspname), otherClientConnections: connections.rows[0].count });
    } finally { await pool.end(); }
  }
  const data = { at: new Date().toISOString(), databases, isolatedPostgresStopped: false };
  fs.writeFileSync('docs/fixes/v1-batch-3/validation-2026-10-21-goal-precision/cleanup.json', JSON.stringify(data, null, 2) + '\n');
  console.log(JSON.stringify(data));
  if (databases.some(row => row.remainingFixtureSchemas.length || row.otherClientConnections)) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
