// Local compile and fixture-cleanup checks only. Never load application credentials.
const fs = require('node:fs'), assert = require('node:assert/strict'), crypto = require('node:crypto');
const { spawnSync } = require('node:child_process'), { Client } = require('pg');
const dir = __dirname;
const result = { at: new Date().toISOString(), databases: [] };
(async () => {
  const tests = JSON.parse(fs.readFileSync(dir + '/compatibility-recovery.json', 'utf8'));
  result.tests = { total: tests.numTotalTests, passed: tests.numPassedTests, failed: tests.numFailedTests, skipped: tests.numPendingTests };
  assert.equal(result.tests.total, 22); assert.equal(result.tests.passed, 22); assert.equal(result.tests.skipped, 0);
  const env = {};
  for (const [key,value] of Object.entries(process.env)) if (/^(PATH|SYSTEMROOT|WINDIR|TEMP|TMP|USERPROFILE|LOCALAPPDATA|APPDATA|COMSPEC|PATHEXT|NUMBER_OF_PROCESSORS)$/i.test(key)) env[key] = value;
  Object.assign(env, { NODE_ENV: 'test', DATABASE_URL: '' });
  const fd = fs.openSync(dir + '/compatibility-typecheck.log', 'wx');
  const check = spawnSync(process.execPath, ['node_modules/typescript/bin/tsc','--noEmit'], { env, windowsHide: true, stdio: ['ignore',fd,fd], timeout: 120000 });
  fs.closeSync(fd); result.typecheck = { exitCode: check.status, error: check.error?.code || null }; assert.equal(check.status, 0);
  for (const database of ['ga4_alignment_test','notifications_test']) {
    const c = new Client({ host: '127.0.0.1', port: 55444, user: 'v1_audit', database, connectionTimeoutMillis: 5000, statement_timeout: 5000 });
    await c.connect();
    try {
      const identity = (await c.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];
      assert.equal(identity.db, database); assert.equal(identity.host, '127.0.0.1'); assert.equal(identity.port, 55444);
      const schemas = (await c.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'")).rows[0].n;
      const clients = (await c.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n;
      const locks = (await c.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory'")).rows[0].n;
      assert.equal(schemas, 0); assert.equal(clients, 0); assert.equal(locks, 0);
      result.databases.push({ database, remainingFixtureSchemas: schemas, otherClientConnections: clients, remainingAdvisoryLocks: locks });
    } finally { await c.end(); }
  }
  const previous = JSON.parse(fs.readFileSync(dir + '/candidate-manifest.json', 'utf8'));
  const files = previous.files.map(f => ({ file: f.file, lfSha256: crypto.createHash('sha256').update(fs.readFileSync(f.file,'utf8').replace(/\r\n/g,'\n')).digest('hex') }));
  result.changedSincePriorCandidate = files.filter(f => previous.files.find(p => p.file === f.file).lfSha256 !== f.lfSha256).map(f => f.file);
  assert.deepEqual(result.changedSincePriorCandidate, ['server/v1-batch4-custom-storage-postgres.test.ts']);
  fs.writeFileSync(dir + '/compatibility-manifest.json', JSON.stringify({ at: new Date().toISOString(), baseHead: previous.baseHead,
    state: 'UNCOMMITTED; not deployed', runtimeUnchanged: true, files },null,2)+'\n', { flag: 'wx' });
  result.result = 'PASS';
})().catch(error => { result.result = 'FAIL'; result.error = { name: error.name, code: error.code }; process.exitCode = 1;
}).finally(() => { result.completedAt = new Date().toISOString(); fs.writeFileSync(dir + '/compatibility-local-checks.json', JSON.stringify(result,null,2)+'\n',{flag:'wx'}); console.log(JSON.stringify(result,null,2)); });
