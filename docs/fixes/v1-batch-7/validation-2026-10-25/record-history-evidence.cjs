// Local evidence only; no application credentials, provider calls or production access.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { Pool } = require('pg');
const assert = require('node:assert/strict');
const root = process.cwd();
const directory = path.relative(root, __dirname).replace(/\\/g, '/');
const read = file => fs.readFileSync(file, 'utf8');
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim();
assert.equal(head, '4cd498cfbcaf3d82af035fa0f6d41ad0b723e062');
const current = JSON.parse(read(`${directory}/history-final.json`));
const baseline = JSON.parse(read(`${directory}/history-baseline-final.json`));
const build = JSON.parse(read(`${directory}/history-final-build-checks.json`));
assert.equal(current.numPassedTests, 412); assert.equal(current.numFailedTests, 0); assert.equal(current.numPendingTests, 0);
assert.equal(baseline.numPassedTests, 18); assert.equal(baseline.numFailedTests, 42); assert.equal(baseline.numPendingTests, 0);
assert.equal(build.checks.length, 2); assert.ok(build.checks.every(check => check.exitCode === 0));
const priorScheduler = execFileSync('git', ['show', `${head}:server/scheduler.ts`], { encoding: 'utf8', windowsHide: true });
assert.equal(priorScheduler.replace(/\r\n/g, '\n'), read('server/scheduler.ts').replace(/\r\n/g, '\n'));
assert.ok(priorScheduler.includes('const latestSession = linkedInConnection && !isProductionTestConnection(linkedInConnection) && !(linkedInConnection as any).spendOnly'));

const doc = 'docs/fixes/v1-batch-7/README.md';
let text = read(doc);
const old = '**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.';
const recorded = '**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.';
for (const id of ['V1-060', 'V1-074', 'V1-119']) {
  const start = text.indexOf(`### ${id}`), next = text.indexOf('\n### V1-', start + 1);
  assert.ok(start > 0);
  const end = next < 0 ? text.length : next;
  const block = text.slice(start, end);
  assert.ok(block.includes(old) || block.includes(recorded), `${id}: unexpected text`);
  text = text.slice(0, start) + block.replace(old, recorded) + text.slice(end);
}
fs.writeFileSync(doc, text);

async function main() {
  const pool = new Pool({ connectionString: 'postgresql://v1_audit@127.0.0.1:55444/ga4_alignment_test', application_name: 'batch7_history_evidence', max: 1 });
  let cleanup;
  try {
    const { rows: [identity] } = await pool.query('SELECT host(inet_server_addr()) AS host, inet_server_port() AS port, current_database() AS database');
    assert.equal(identity.host, '127.0.0.1'); assert.equal(identity.port, 55444); assert.equal(identity.database, 'ga4_alignment_test');
    const { rows } = await pool.query("SELECT nspname FROM pg_namespace WHERE nspname LIKE 'v1_report_history_%'");
    assert.equal(rows.length, 0, 'Disposable schemas must be removed');
    const { rows: [sessions] } = await pool.query("SELECT count(*)::int AS remaining FROM pg_stat_activity WHERE application_name LIKE 'v1_report_history_%'");
    assert.equal(sessions.remaining, 0);
    cleanup = { ...identity, remainingFixtureSchemas: rows.length, remainingFixtureSessions: sessions.remaining };
  } finally { await pool.end(); }
  const files = ['server/routes-oauth.ts', 'server/report-scheduler.ts', 'server/v1-batch7-report-history-postgres.test.ts',
    'server/report-email-regression.test.ts', 'server/custom-report-regression.test.ts', 'server/source-safety-regression.test.ts',
    'docs/fixes/v1-batch-7/README.md', 'docs/fixes/v1-batch-6/README.md', 'docs/V1_RELEASE_READINESS.md', 'docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md',
    ...['history-final.json', 'history-final.log', 'history-baseline-final.json', 'history-baseline-final.log', 'history-final-build-checks.json',
      'history-final-typecheck.log', 'history-final-server-build.log', 'run-tests.cjs', 'run-build-checks.cjs', 'record-history-evidence.cjs'].map(file => `${directory}/${file}`)];
  fs.writeFileSync(`${directory}/history-evidence.json`, JSON.stringify({ at: new Date().toISOString(), baseCommit: head, status: 'uncommitted, undeployed',
    scope: ['V1-060', 'V1-074', 'V1-119'], runtimeFiles: files.slice(0, 2),
    baseline: { passed: 18, failed: 42, skipped: 0 }, current: { passed: 412, failed: 0, skipped: 0 },
    suites: current.testResults.map(result => ({ file: path.relative(root, result.name).replace(/\\/g, '/'), count: result.assertionResults.length, status: result.status })),
    checks: build.checks, staleNeighbor: { file: 'server/scheduler.ts', baselineEqualsCurrent: true, obsoleteAssertion: 'missing existing isProductionTestConnection guard' },
    cleanup, compatibility: 'Old snapshots without original bytes remain metadata-only and return PDF 422; no reconstruction/backfill or deletion.',
    limitations: ['Local actor, PDF-builder and delivery adapters; no real provider/network/email/browser or production schema/data.',
      'Immutable synthetic bytes, not report layout/value completeness.', 'Independent-worker delivery/recovery and remaining 26 Batch 7 findings open.',
      'Batch 6 live Google Ads sign-off postponed by user; no certification.'],
    files: files.map(file => ({ file, sha256: hash(file) })) }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ passed: 412, failed: 0, skipped: 0, baselineReproductions: 42, cleanup, evidence: `${directory}/history-evidence.json` }));
}
main().catch(error => { console.error(error); process.exitCode = 1; });
