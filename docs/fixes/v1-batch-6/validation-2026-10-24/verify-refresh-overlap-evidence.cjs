// One-off local checkpoint. Does not load application credentials or contact providers.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
const output = path.join(__dirname, 'refresh-overlap-evidence-oct25.json');
if (fs.existsSync(output)) throw Error('Evidence already exists; use a separate checkpoint');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/^\uFEFF/, ''));
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const hash = value => createHash('sha256').update(value).digest('hex');
(async () => {
  const commit = git(['rev-parse', 'HEAD']);
  assert.equal(commit, '3e285b9df14bb8be2a8e4acf79262c684a3e8ae0');
  const runtime = git(['diff', 'HEAD', '--name-only', '--', 'client', 'server', 'shared']).split(/\r?\n/).filter(file => file && !file.endsWith('.test.ts')).sort();
  assert.deepEqual(runtime, ['server/google-ads-scheduler.ts', 'server/storage.ts']);
  const before = read('refresh-overlap-caller-before-oct25.json');
  assert.equal(before.numPassedTests, 57); assert.equal(before.numFailedTests, 6); assert.equal(before.numPendingTests, 0);
  const tests = read('refresh-overlap-final-oct25.json');
  assert.equal(tests.numPassedTests, 232); assert.equal(tests.numFailedTests, 0);
  assert.equal(tests.numPendingTests, 0); assert.equal(tests.testResults.length, 9);
  const build = read('refresh-overlap-oct25-build-checks.json');
  assert.deepEqual(build.checks.map(check => [check.name, check.exitCode]), [['typecheck', 0], ['server-build', 0]]);
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
  const files = [...new Set([...runtime, ...tests.testResults.map(result => path.relative(process.cwd(), result.name).replace(/\\/g, '/')),
    'server/notification-alert-postgres-concurrency.test.ts', 'docs/fixes/v1-batch-6/README.md', 'docs/V1_RELEASE_READINESS.md'])];
  const evidence = {
    at: new Date().toISOString(), baseCommit: commit, runtimeFilesChanged: runtime,
    rootCause: 'Ordinary daily facts committed before a separate lastRefreshAt update, admitting overlapping responses with the same captured freshness marker.',
    correction: 'Atomically replace facts and advance their connection freshness within the existing transaction; update caller expectations only after commit.',
    before: { file: 'refresh-overlap-caller-before-oct25.json', passed: 57, failed: 6, skipped: 0,
      failingCases: before.testResults.flatMap(result => result.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName)),
      runtimeGitBlobHashes: Object.fromEntries(runtime.map(file => [file, hash(execFileSync('git', ['show', `${commit}:${file}`], { windowsHide: true }))])) },
    tests: { file: 'refresh-overlap-final-oct25.json', passed: 232, failed: 0, skipped: 0, newCases: 12,
      files: tests.testResults.map(result => ({ file: path.relative(process.cwd(), result.name).replace(/\\/g, '/'), assertions: result.assertionResults.length, status: result.status })),
      includesHistoricalCharacterizationCases: 1 },
    build, cleanup: { databases, localPostgresStopped: true },
    fileHashes: Object.fromEntries(files.map(file => [file, hash(fs.readFileSync(file))])),
    limits: ['No production occurrence, provider account, user browser, production database or email accessed.',
      'Does not certify every source lifecycle, later-stage concurrent worker, edit-then-restore, restart/retry or retained import.',
      'Historical data, provider completeness, authenticated deployed behavior and every report template remain unverified.',
      'Four earlier goal-neighbor and six source-safety static failures remain open outside this nine-file packet.'],
    status: { committed: false, deployed: false, requiresDeployment: true, batch6ReleaseAcceptancesOpen: 9, wholeAppReleaseDecision: 'NO-GO' },
  };
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: 232, failed: 0, skipped: 0, newCases: 12, databases, localPostgresStopped: true, evidence: output }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
