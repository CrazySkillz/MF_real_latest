// Read-only source/document checks; writes only this packet's new receipt.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process'), { createHash } = require('node:crypto');
const root = process.cwd(), directory = __dirname;
const read = file => JSON.parse(fs.readFileSync(path.join(directory, file), 'utf8'));
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function run(exe, args) {
  const result = spawnSync(exe, args, { cwd: root, windowsHide: true, encoding: 'utf8' });
  assert.equal(result.status, 0, `${exe} ${args.join(' ')}: ${result.error?.message || result.stderr}`);
  return result.stdout.trim();
}
const head = run('git', ['rev-parse', 'HEAD']);
assert.equal(head, 'ea0b843afbb8946eaaa248ea57786651cd3d457b');
const changed = run('git', ['diff', '--name-only', 'HEAD']).split(/\r?\n/).filter(Boolean);
const allowed = ['docs/V1_RELEASE_READINESS.md', 'docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md',
  'docs/fixes/v1-batch-7/README.md', 'docs/fixes/v1-batch-7/REPORT_CLOSEOUT_CHECKPOINT.md',
  'docs/fixes/v1-batch-7/REPORT_DOWNLOAD_DEPENDENCY_INCIDENT.md', 'docs/fixes/v1-batch-8/README.md',
  'scripts/ga4-kpi-current-version-test-boundary.ts', 'server/financial-snapshot-saved-ga4.test.ts', 'server/v1-batch7-retained-values.test.ts'];
assert.deepEqual([...changed].sort(), [...allowed].sort());
run('git', ['diff', '--check']);
const docs = JSON.parse(run(process.execPath, ['docs/audits/v1-2026-10-19/check-audit-record.cjs', '--docs-only']));
const before = read('consolidated-execution.json').beforeHashes;
const executionChangedAfterRun = Object.entries(before).filter(([file, value]) => fs.existsSync(file) && hash(file) !== value).map(([file]) => file);
assert.ok(executionChangedAfterRun.every(file => file.startsWith('docs/')), 'Validated application/test source changed after full run');
const files = [...allowed, 'scripts/ga4-test-run-errors.cjs', 'server/v1-batch8-ci-completion.test.ts', 'docs/fixes/v1-batch-8/LOCAL_RELEASE_CHECKPOINT.md'];
const testHashes = Object.fromEntries(files.filter(file => !file.startsWith('docs/')).map(file => [file, hash(file)]));
const documentHashes = Object.fromEntries(files.filter(file => file.startsWith('docs/')).map(file => [file, hash(file)]));
const receipt = { at: new Date().toISOString(), head, status: 'IN PROGRESS / NO-GO',
  applicationRuntimeChanged: false, productionDataChanged: false, committed: false, pushed: false,
  changedTrackedFiles: changed, testHashes, documentHashes, executionChangedAfterRun,
  latestTests: read('latest-results.json'), reportNeighbors: { files: 46, passed: 710 },
  docs, builds: read('baseline-build-checks.json'), finalTypecheck: read('final-build-checks.json'),
  limits: '123 unresolved assertions; recorded scheduler failures; hosted CI, authenticated/provider, complete semantic/downstream, operational and advisory gates remain open. Natural report email and postponed Google Ads are separate pending acceptances.',
};
fs.writeFileSync(path.join(directory, 'final-checkpoint.json'), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ status: receipt.status, changedTrackedFiles: changed, latestTests: { total: receipt.latestTests.total, passed: receipt.latestTests.passed, failed: receipt.latestTests.failed }, docs: docs.checks, runtimeChanged: false, committed: false }, null, 2));
