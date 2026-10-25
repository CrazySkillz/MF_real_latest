// One-off local evidence/cleanup checkpoint. Never reads application credentials.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync, spawnSync } = require('node:child_process');
const { Client } = require('pg');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const output = path.join(__dirname, 'consolidated-evidence-oct25.json');
assert(!fs.existsSync(output), 'Evidence is immutable; use a new checkpoint');
(async () => {
  const baseCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
  assert.equal(baseCommit, '35c16c1ea9e7513aba07b014677dca28bf0b71a5');
  const packets = ['consolidated-recovery-oct25.json', 'recovery-process-fixture-oct25.json',
    'consolidated-verified-oct25.json', 'consolidated-sheets-assertion-oct25.json'];
  const latest = new Map();
  for (const packet of packets) for (const result of read(packet).testResults) {
    const file = path.relative(process.cwd(), result.name).replace(/\\/g, '/');
    latest.set(file, { file, packet, status: result.status, checks: result.assertionResults.length,
      failed: result.assertionResults.filter(test => test.status === 'failed').length,
      skipped: result.assertionResults.filter(test => test.status !== 'passed' && test.status !== 'failed').length });
  }
  const files = [...latest.values()].sort((a, b) => a.file.localeCompare(b.file));
  assert.equal(files.length, 37);
  assert(files.every(file => file.status === 'passed' && file.failed === 0 && file.skipped === 0));
  const total = files.reduce((sum, file) => sum + file.checks, 0);
  assert.equal(total, 848);
  assert.equal(latest.get('server/v1-batch6-google-ads-saved-consumers.test.ts').checks, 17);
  const build = read('consolidated-verified-oct25-build-checks.json');
  assert.deepEqual(build.checks.map(check => [check.name, check.exitCode]), [['typecheck', 0], ['server-build', 0]]);
  const runtime = ['server/auto-refresh-scheduler.ts', 'server/linkedin-scheduler.ts', 'server/meta-scheduler.ts',
    'server/report-scheduler.ts', 'server/routes-oauth.ts', 'server/utils/kpi-refresh.ts'];
  const changed = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8', windowsHide: true }).trim().split(/\r?\n/);
  assert.deepEqual(changed.filter(file => !file.endsWith('.md') && !file.endsWith('.test.ts')).sort(), [...runtime].sort());
  execFileSync('git', ['diff', '--check'], { windowsHide: true, stdio: 'pipe' });
  const databases = [];
  for (const database of ['ga4_alignment_test', 'notifications_test']) {
    const client = new Client({ host: '127.0.0.1', port: 55444, user: 'v1_audit', database });
    await client.connect();
    try {
      const identity = (await client.query('SELECT current_database() db,host(inet_server_addr()) host,inet_server_port() port')).rows[0];
      assert.deepEqual(identity, { db: database, host: '127.0.0.1', port: 55444 });
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
  const dependencies = ['server/storage.ts', 'shared/schema.ts', 'server/google-ads-scheduler.ts', 'server/googleAdsClient.ts',
    'server/scheduler.ts', 'server/utils/ga4-alert-current-value.ts', 'server/utils/ga4RevenueEnrichment.ts',
    'server/ga4-daily-scheduler.ts', 'server/ga4-kpi-benchmark-jobs.ts', 'server/test-support/ga4-recovery-process-worker.ts',
    'client/src/pages/google-ads-analytics.tsx', 'client/src/components/AddRevenueWizardModal.tsx',
    'client/src/components/SimpleGoogleSheetsAuth.tsx', 'docs/fixes/v1-batch-6/README.md', 'docs/V1_RELEASE_READINESS.md',
    'docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md'];
  const hashed = [...new Set([...runtime, ...files.map(file => file.file), ...dependencies])];
  const evidence = { at: new Date().toISOString(), baseCommit, runtimeFilesChanged: runtime,
    tests: { passed: total, failed: 0, skipped: 0, files: files.length, historicalCharacterization: 18,
      currentBehaviorChecks: 830, addedIsolationCases: 49, results: files }, build,
    cleanup: { databases, localPostgresStopped: true },
    reproductionPackets: ['retained-consumers-before-oct25.json', 'retained-aggregate-before-oct25.json',
      'retained-reprocess-before-oct25.json', 'retained-legacy-final-before-oct25.json'],
    fixtureFailures: ['Four stale CSV/Sheets contract assertions resolved without runtime import changes.',
      'Three ordinary process-recovery fixtures queued newer revenue work; seed corrected, production job ordering unchanged.',
      'Two successive TypeScript Set inference errors corrected; final typecheck/build pass.'],
    fileHashes: Object.fromEntries(hashed.map(file => [file, hash(file)])),
    packetHashes: Object.fromEntries([...packets, 'consolidated-verified-oct25-build-checks.json'].map(file => [file, hash(path.join(__dirname, file))])),
    status: { localForwardCorrectionPass: 'finished', committed: false, deployed: false, batch6ReleaseAcceptancesOpen: 9, wholeApp: 'NO-GO' },
    limits: ['No browser, authenticated provider, production database, email or production-data mutation.',
      'Local corrected boundaries only; complete source certification, independent retained-route races, edit-restore and natural jobs remain unverified.',
      'Historical data/artifacts require separate evidence; no cleanup or provenance guessing.',
      'Google Ads KPI/Benchmark report values covered; complete report artifacts and immutable history remain Batch 7/8 dependencies.',
      'PostgreSQL fixtures exercise actual storage and workers with deterministic provider inputs, not full production migrations or provider coverage.'] };
  fs.writeFileSync(output, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: total, failed: 0, skipped: 0, files: files.length, hashes: hashed.length,
    localPostgresStopped: true, evidence: output }));
})().catch(error => { console.error(error.message); process.exitCode = 1; });
