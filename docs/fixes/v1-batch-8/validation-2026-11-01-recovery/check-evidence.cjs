// Read existing receipts/Git objects and one anonymous health URL. No secrets or DB access.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const assert = require('node:assert/strict'), { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000 }).trim();
const read = name => JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
const current = '0a42aac893b56e471246a75f3a4a0a5423e846e3';
const prior = '9848ef9c997f23a3dac558080f41a6c5b09e05f1';
const dir = 'docs/fixes/v1-batch-8/validation-2026-11-01-dependencies/';
const receipt = { at: new Date().toISOString(), runtime: current, prior, databaseAccess: false, secretAccess: false, providerCalls: 0, deployments: 0, liveWrites: 0, restoredDatabaseAgain: false };
(async () => {
  receipt.head = git(['rev-parse', 'HEAD']);
  const laterFiles = git(['diff', '--name-only', current, 'HEAD']).split('\n').filter(Boolean);
  assert.ok(laterFiles.every(file => file.startsWith('docs/')));
  receipt.sinceRuntime = { changedFiles: laterFiles.length, documentationOnly: true };
  assert.equal(git(['diff', '--name-only', 'HEAD', '--', 'server', 'client', 'shared', 'migrations', 'package.json', 'package-lock.json', 'render.yaml']), '');
  const compatibilityPaths = ['server/index.ts', 'server/storage.ts', 'server/utils/tokenVault.ts', 'shared', 'migrations', 'package.json', 'package-lock.json', 'client', 'render.yaml'];
  const currentTree = git(['ls-tree', current, '--', ...compatibilityPaths]);
  assert.equal(git(['ls-tree', prior, '--', ...compatibilityPaths]), currentTree);
  receipt.priorCompatibility = { paths: compatibilityPaths, identicalGitObjects: true, objects: currentTree.split('\n') };
  const changes = git(['diff', '--name-only', prior, current, '--', 'server', 'client', 'shared', 'migrations', 'package.json', 'package-lock.json', 'render.yaml']).split('\n').sort();
  assert.deepEqual(changes, ['server/request-collection-boundary.test.ts', 'server/routes-oauth.ts']);
  receipt.priorRuntimeDifference = changes;
  const validation = read(dir + 'collection-validation-receipt.json');
  assert.equal(validation.runtimeCommit, current); assert.equal(validation.hostedCi, 'PASS');
  assert.equal(validation.focused.passed, 258); assert.equal(validation.focused.failed, 0);
  for (const item of validation.files) {
    const source = fs.readFileSync(path.join(root, item.file));
    assert.equal(crypto.createHash('sha256').update(source).digest('hex'), item.sha256);
  }
  for (const [name, sha] of [['collection-release-ci.json', current], ['email-release-ci.json', prior]]) {
    const ci = read(dir + name); assert.equal(ci.expected, sha); assert.equal(ci.deployed, sha);
    assert.ok(ci.checks.length && ci.checks.every(check => check.conclusion === 'success'));
  }
  receipt.validationReuse = { currentFocused: 258, currentBuildAndTypes: 'PASS', currentAndPriorHostedCi: 'PASS', currentSourceHashesMatch: true };
  const restored = read('docs/fixes/v1-batch-8/validation-2026-10-29-key-backup/render-export-verification-final.json');
  assert.equal(restored.result, 'PASS'); assert.equal(restored.tables.length, 71);
  assert.ok(restored.tables.every(table => table.copyBytesIdentical && table.archiveRows === table.restoredRows));
  const rows = restored.tables.reduce((count, table) => count + table.restoredRows, 0);
  assert.equal(rows, 5903996);
  receipt.restoreReuse = { tables: 71, rows, everyTableMatched: true, archiveSha256: restored.archiveSha256, scope: 'Historical snapshot restored locally; no current live restore or hosted permissions claim' };
  const custody = read('docs/fixes/v1-batch-8/validation-2026-10-29-key-backup/application-key-custody-observation.json');
  assert.equal(custody.independentRecoveryCopyConfirmed, true);
  receipt.savedKey = { custody: 'USER_CONFIRMED', retrievalAndDecryption: 'UNVERIFIED', keyPromptRepeated: false };
  const response = await fetch('https://app.mimosaas.app/api/health', { redirect: 'error', headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  assert.equal(response.status, 200); const health = await response.json();
  assert.equal(health.ok, true); assert.equal(health.commit, current); assert.equal(health.nodeEnv, 'production');
  receipt.publicRuntime = { status: response.status, ok: health.ok, commit: health.commit, nodeEnv: health.nodeEnv };
  receipt.result = 'PASS_REUSED_RESTORE_AND_ROLLBACK_COMPATIBILITY';
  receipt.task3 = 'PARTIAL_SAVED_KEY_UNVERIFIED';
  receipt.hostedRollbackExecuted = false;
})().catch(error => { receipt.result = 'CHECK_REQUIRED'; receipt.errorCode = error.code || error.name; process.exitCode = 1; })
.finally(() => {
  const name = 'evidence-' + receipt.at.replace(/[:.]/g, '-') + '.json';
  fs.writeFileSync(path.join(__dirname, name), JSON.stringify(receipt, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: receipt.result, task3: receipt.task3, filename: name, errorCode: receipt.errorCode }));
});
