// One-off local audit evidence; no application credentials or provider access.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
const output = path.join(__dirname, 'source-lifecycle-evidence-oct25.json');
if (fs.existsSync(output)) throw Error('Evidence already exists; use a new checkpoint');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/^\uFEFF/, ''));
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
(async () => {
  const commit = git(['rev-parse', 'HEAD']);
  assert.equal(commit, '35c16c1ea9e7513aba07b014677dca28bf0b71a5');
  const changed = git(['diff', 'HEAD', '--name-only', '--', 'client', 'server', 'shared']).split(/\r?\n/).filter(Boolean);
  assert.equal(changed.length, 7); assert(changed.every(file => file.endsWith('.test.ts')));
  const tests = read('source-lifecycle-complete-oct25.json');
  assert.equal(tests.numPassedTests, 480); assert.equal(tests.numFailedTests, 0); assert.equal(tests.numPendingTests, 0);
  assert.equal(tests.testResults.length, 16); assert(tests.testResults.every(file => file.status === 'passed'));
  const build = read('source-lifecycle-final-oct25-build-checks.json');
  assert.deepEqual(build.checks.map(check => [check.name, check.exitCode]), [['typecheck', 0]]);
  const deployed = read('refresh-overlap-deployment-oct25.json');
  assert.equal(deployed.body.commit, commit); assert.equal(deployed.status, 200); assert.equal(deployed.body.ok, true);
  const databases = [];
  for (const database of ['ga4_alignment_test', 'notifications_test']) {
    const client = new Client({ host: '127.0.0.1', port: 55444, user: 'v1_audit', database });
    await client.connect();
    try {
      const identity = (await client.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];
      assert.equal(identity.db, database); assert.equal(identity.host, '127.0.0.1'); assert.equal(identity.port, 55444);
      const schemas = (await client.query("SELECT count(*)::int n FROM pg_namespace WHERE nspname NOT IN ('public','information_schema') AND nspname NOT LIKE 'pg_%'")).rows[0].n;
      const clients = (await client.query("SELECT count(*)::int n FROM pg_stat_activity WHERE pid<>pg_backend_pid() AND backend_type='client backend'")).rows[0].n;
      const locks = (await client.query("SELECT count(*)::int n FROM pg_locks WHERE locktype='advisory'")).rows[0].n;
      assert.equal(schemas, 0); assert.equal(clients, 0); assert.equal(locks, 0);
      databases.push({ database, remainingFixtureSchemas: schemas, otherClientConnections: clients, remainingAdvisoryLocks: locks });
    } finally { await client.end(); }
  }
  const dataDirectory = path.resolve('audit-temp/v1-batch4-sheets-pg');
  assert.equal(dataDirectory, 'C:\\Users\\me\\Documents\\MF_real_latest\\audit-temp\\v1-batch4-sheets-pg');
  const pgCtl = 'C:/Program Files/PostgreSQL/18/bin/pg_ctl.exe';
  execFileSync(pgCtl, ['-D', dataDirectory, '-m', 'fast', '-w', 'stop'], { windowsHide: true, timeout: 30000 });
  assert.equal(spawnSync(pgCtl, ['-D', dataDirectory, 'status'], { windowsHide: true }).status, 3);
  const runtime = ['server/storage.ts', 'server/routes-oauth.ts', 'server/google-ads-scheduler.ts', 'server/auto-refresh-scheduler.ts',
    'server/report-scheduler.ts', 'server/ga4-scheduled-report-pdf.ts', 'shared/schema.ts', 'client/src/pages/google-sheets-data.tsx'];
  const files = [...new Set([...runtime, ...tests.testResults.map(result => path.relative(process.cwd(), result.name).replace(/\\/g, '/')),
    'docs/fixes/v1-batch-6/README.md', 'docs/V1_RELEASE_READINESS.md'])];
  const evidence = {
    at: new Date().toISOString(), baseCommit: commit, deployment: deployed, runtimeFilesChanged: [], testFilesChanged: changed,
    tests: { file: 'source-lifecycle-complete-oct25.json', passed: 480, failed: 0, skipped: 0, newCases: 13, includesHistoricalCharacterizationCases: 1,
      files: tests.testResults.map(result => ({ file: path.relative(process.cwd(), result.name).replace(/\\/g, '/'), assertions: result.assertionResults.length, status: result.status })) },
    build, cleanup: { databases, localPostgresStopped: true },
    fileHashes: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))])),
    limits: ['Public deployment health/revision only; no authenticated provider, browser, production database or email access.',
      'Source mutation tests exercise actual storage and overlapping scheduler callers with deterministic provider adapters, not the full HTTP/OAuth/source-modal journey.',
      'Historical data, every rendered report template, edit-restore, independent-process restarts/retries and natural deployed schedule acceptance remain unverified.',
      'Declared table checks/defaults are included; full production migrations/indexes/catalog are not certified.'],
    status: { testsCommitted: false, runtimeChangeRequiresDeployment: false, batch6ReleaseAcceptancesOpen: 9, wholeAppReleaseDecision: 'NO-GO' },
  };
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: 480, failed: 0, skipped: 0, newCases: 13, runtimeFilesChanged: [], databases, localPostgresStopped: true, evidence: output }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
