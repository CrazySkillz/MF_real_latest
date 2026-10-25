// Stage only the reviewed Batch 6 files and their explicitly selected evidence.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true }).trim();
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const root = 'docs/fixes/v1-batch-6/validation-2026-10-24/';
const evidence = JSON.parse(fs.readFileSync(root + 'consolidated-evidence-oct25.json', 'utf8'));
const documentation = ['docs/V1_RELEASE_READINESS.md', 'docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md', 'docs/fixes/v1-batch-6/README.md'];
const tests = ['server/ga4-recovery-process-postgres.test.ts', 'server/google-ads-report-regression.test.ts',
  'server/google-ads-revenue-csv-flow.test.ts', 'server/google-ads-revenue-platform-context.test.ts',
  'server/google-ads-revenue-scheduler-flow.test.ts', 'server/google-ads-revenue-sheets-flow.test.ts',
  'server/report-email-regression.test.ts', 'server/source-safety-regression.test.ts', 'server/spend-source-transaction.test.ts',
  'server/v1-batch6-google-ads-refresh-postgres.test.ts', 'server/v1-batch6-paid-isolation.test.ts'];
const reviewed = [...documentation, ...tests, ...evidence.runtimeFilesChanged].sort();
assert.equal(git(['rev-parse', 'HEAD']), evidence.baseCommit);
assert.equal(git(['diff', '--cached', '--name-only']), '');
assert.deepEqual(git(['diff', '--name-only']).split(/\r?\n/).sort(), reviewed);
for (const [file, expected] of Object.entries(evidence.fileHashes)) {
  if (!documentation.includes(file)) assert.equal(hash(file), expected, file);
}
git(['diff', '--check']);
const packets = ['source-lifecycle-complete-oct25', 'lifecycle-neighbors-before-oct25',
  'consolidated-recovery-oct25', 'recovery-process-exclusive-oct25', 'recovery-process-fixture-oct25',
  'consolidated-final-oct25', 'consolidated-verified-oct25', 'consolidated-sheets-assertion-oct25',
  'retained-consumers-before-oct25', 'retained-aggregate-before-oct25', 'retained-reprocess-before-oct25', 'retained-legacy-final-before-oct25'];
const artifacts = packets.flatMap(name => [`${name}.json`, `${name}.log`]);
artifacts.push('source-lifecycle-evidence-oct25.json', 'source-lifecycle-final-oct25-build-checks.json',
  'source-lifecycle-final-oct25-typecheck.log', 'refresh-overlap-deployment-oct25.json', 'verify-source-lifecycle-evidence.cjs',
  'consolidated-evidence-oct25.json', 'verify-consolidated-evidence.cjs', 'prepare-consolidated-publication.cjs');
for (const label of ['consolidated-batch6-oct25', 'consolidated-final-oct25', 'consolidated-verified-oct25'])
  artifacts.push(`${label}-build-checks.json`, `${label}-typecheck.log`, `${label}-server-build.log`);
for (const file of artifacts) assert(fs.existsSync(root + file), file);
const publicationFile = root + 'consolidated-publication-oct25.json';
assert(!fs.existsSync(publicationFile), 'Publication checkpoint is immutable');
const staged = [...new Set([...reviewed, ...artifacts.map(file => root + file), publicationFile])].sort();
fs.writeFileSync(publicationFile, JSON.stringify({ at: new Date().toISOString(), baseCommit: evidence.baseCommit,
  validation: 'consolidated-evidence-oct25.json', validationHash: hash(root + 'consolidated-evidence-oct25.json'),
  passed: 848, failed: 0, skipped: 0, files: 37, historicalCharacterization: 18,
  runtimeUnchangedSinceValidation: true, documentationChanges: 'Publication status only; validation-time manifest remains immutable.',
  documentationHashes: Object.fromEntries(documentation.map(file => [file, hash(file)])),
  publicationIntent: 'User-authorized commit/push to main; Render deployment not yet verified.',
  stagedFiles: staged, releaseAcceptance: 'OPEN', wholeApp: 'NO-GO',
}, null, 2) + '\n', { flag: 'wx' });
execFileSync('git', ['add', '-f', '--', ...staged], { windowsHide: true, stdio: 'pipe' });
assert.deepEqual(git(['diff', '--cached', '--name-only']).split(/\r?\n/).sort(), staged);
git(['diff', '--cached', '--check']);
console.log(JSON.stringify({ reviewedFiles: reviewed.length, stagedFiles: staged.length, runtimeFiles: evidence.runtimeFilesChanged.length,
  publication: publicationFile, unrelatedFilesStaged: false }));
