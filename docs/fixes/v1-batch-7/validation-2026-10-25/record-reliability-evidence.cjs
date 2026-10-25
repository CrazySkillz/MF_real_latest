// Local evidence only. No application credentials or external services.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const directory = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(directory, name), 'utf8'));
const baseCommit = '825972a9f341d0986bef838dadcbaa540c155272';
const baseline = read('reliability-baseline-final.json');
const latest = new Map();
for (const file of ['reliability-neighbors-final.json', 'reliability-final-supplement.json']) {
  for (const suite of read(file).testResults) latest.set(suite.name, { file, suite });
}
const cases = [...latest.values()].flatMap(({ suite }) => suite.assertionResults);
if (cases.some(test => test.status !== 'passed')) throw Error('A current regression check did not pass');
const runtimeFiles = ['server/report-scheduler.ts', 'server/routes-oauth.ts', 'server/storage.ts',
  'server/kpi-notifications.ts', 'server/benchmark-notifications.ts', 'server/services/email-service.ts'];
const testFiles = ['server/v1-batch7-reliability-postgres.test.ts', 'server/v1-batch7-report-history-postgres.test.ts',
  'server/report-email-regression.test.ts', 'server/notification-visibility-regression.test.ts', 'server/alert-email-immediate-route-regression.test.ts'];
const oldRoutes = execFileSync('git', ['show', `${baseCommit}:server/routes-oauth.ts`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, windowsHide: true });
const currentRoutes = fs.readFileSync('server/routes-oauth.ts', 'utf8');
const oldSignatures = ['const kpi = await storage.updateKPI(kpiId, { ...updateData,',
  'const benchmark = await storage.updateBenchmark(benchmarkId, { ...validatedBenchmark,',
  'const benchmark = await storage.updateBenchmark(benchmarkId, { ...validatedData,',
  'const benchmark = await storage.updateBenchmark(id, { ...validated,'];
if (oldSignatures.some(value => !oldRoutes.includes(value) || !currentRoutes.includes(value))) throw Error('Unproven stale assertion classification');
const builds = read('reliability-final-confirm-build-checks.json');
if (builds.checks.some(check => check.exitCode !== 0)) throw Error('Build check failed');
async function main() {
  const cleanup = [];
  for (const database of ['ga4_alignment_test', 'notifications_test']) {
    const pool = new Pool({ connectionString: `postgresql://v1_audit@127.0.0.1:55444/${database}`, max: 1, application_name: 'reliability_evidence' });
    try {
      const { rows: address } = await pool.query('SELECT host(inet_server_addr()) AS host, inet_server_port() AS port, current_database() AS database');
      if (address[0].host !== '127.0.0.1' || address[0].port !== 55444) throw Error('Not the isolated fixture');
      const { rows: schemas } = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'v1_reliability_%' OR nspname LIKE 'v1_report_history_%' OR nspname LIKE 'notification_it_%'");
      const { rows: sessions } = await pool.query("SELECT application_name FROM pg_stat_activity WHERE application_name LIKE 'v1_reliability_%' OR application_name LIKE 'v1_report_history_%' OR application_name LIKE 'notification_it_%'");
      if (schemas.length || sessions.length) throw Error('Disposable test schemas or sessions remain');
      cleanup.push({ ...address[0], remainingOwnedSchemas: schemas.length, remainingOwnedSessions: sessions.length });
    } finally { await pool.end(); }
  }
  const evidence = { at: new Date().toISOString(), baseCommit, status: 'uncommitted, undeployed',
    scope: ['V1-021','V1-022','V1-058','V1-059','V1-110'],
    baseline: { passed: baseline.numPassedTests, failed: baseline.numFailedTests, skipped: baseline.numPendingTests },
    current: { passed: cases.length, failed: 0, skipped: 0, files: latest.size },
    suites: [...latest.values()].map(({file,suite}) => ({ file: path.relative(process.cwd(), suite.name).replaceAll('\\','/'), count: suite.assertionResults.length, evidence: file })),
    builds, runtimeFiles, testFiles,
    hashes: Object.fromEntries([...runtimeFiles, ...testFiles].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')])),
    staleAssertionProof: { baseCommit, unchangedSignatures: oldSignatures }, cleanup,
    limitations: ['Synthetic PDF content and controlled delivery responses; no actual provider or inbox validation',
      'Concurrent database connections and restarted function contexts; no operating-system kill or separate-host deployment',
      'Legacy attempts without exact original evidence remain unconfirmed; no production cleanup',
      'No browser, production database, provider accounts, actual email or production-data changes',
      'Not whole-app certification; 21 Batch 7 findings and all 29 release acceptances remain open'] };
  fs.writeFileSync(path.join(directory, 'reliability-evidence.json'), JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ current: evidence.current, baseline: evidence.baseline, cleanup }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
