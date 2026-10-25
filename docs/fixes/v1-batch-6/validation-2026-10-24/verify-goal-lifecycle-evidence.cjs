// One-off checkpoint: local test databases and public evidence only; no .env.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
const output = path.join(__dirname, 'goal-lifecycle-evidence-oct25.json');
if (fs.existsSync(output)) throw Error('Evidence already exists; use a separate checkpoint');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8').replace(/^\uFEFF/, ''));
const runtime = ['client/src/pages/google-ads-analytics.tsx',
  'client/src/pages/google-ads-analytics/GoogleAdsKpiModal.tsx',
  'client/src/pages/google-ads-analytics/GoogleAdsBenchmarkModal.tsx',
  'server/utils/ga4-alert-current-value.ts', 'server/routes-oauth.ts', 'server/storage.ts', 'server/report-scheduler.ts'];
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
(async () => {
  const commit = git(['rev-parse', 'HEAD']);
  assert.equal(commit, '3e285b9df14bb8be2a8e4acf79262c684a3e8ae0');
  assert.equal(git(['diff', 'HEAD', '--', ...runtime]), '');
  const tests = read('goal-lifecycle-complete-oct25.json');
  assert.equal(tests.numPassedTests, 266); assert.equal(tests.numFailedTests, 0);
  assert.equal(tests.numPendingTests, 0); assert.equal(tests.testResults.length, 7);
  const types = read('goal-lifecycle-complete-oct25-build-checks.json');
  assert.equal(types.checks.length, 1); assert.equal(types.checks[0].name, 'typecheck'); assert.equal(types.checks[0].exitCode, 0);
  const deployment = read('goal-values-deployment-oct25.json');
  assert.equal(deployment.status, 200); assert.equal(deployment.body.commit, commit); assert.equal(deployment.body.ok, true);
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
  const stopped = spawnSync(pgCtl, ['-D', dataDirectory, 'status'], { windowsHide: true, encoding: 'utf8' });
  assert.equal(stopped.status, 3);
  const files = [...runtime, 'server/google-ads-goal-lifecycle-postgres.test.ts', 'server/notification-alert-postgres-concurrency.test.ts',
    'docs/fixes/v1-batch-6/README.md', 'docs/V1_RELEASE_READINESS.md'];
  const evidence = {
    at: new Date().toISOString(), commit, applicationCodeUnchanged: true,
    deployment: { file: 'goal-values-deployment-oct25.json', verified: 'public revision and health only' },
    tests: { file: 'goal-lifecycle-complete-oct25.json', passed: 266, failed: 0, skipped: 0,
      files: tests.testResults.map(result => ({ file: path.relative(process.cwd(), result.name).replace(/\\/g, '/'), assertions: result.assertionResults.length, status: result.status })) },
    typecheck: types, cleanup: { databases, localPostgresStopped: true },
    fileHashes: Object.fromEntries(files.map(file => [file, createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
    scope: 'Actual extracted HTTP handlers/helpers, schemas, storage SQL, goal resolver and actual scheduled decision-to-notification functions; isolated local fixtures.',
    limits: ['No authenticated deployed UI/API, real Clerk middleware, provider or production database acceptance.',
      'No production migrations/catalog, full source lifecycle, independent-worker delete race, timer/restart or email delivery acceptance.',
      'All report templates/rendered layout, historical data/snapshots and full Batch 6 release acceptance remain open.',
      'The four earlier goal-neighbor and six source-safety static failures remain open outside this seven-file packet.'],
    status: { testChangesCommitted: false, newRuntimeDeploymentRequired: false, batch6ReleaseAcceptancesOpen: 9, wholeAppReleaseDecision: 'NO-GO' },
  };
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: 266, failed: 0, skipped: 0, databases, localPostgresStopped: true, evidence: output }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
