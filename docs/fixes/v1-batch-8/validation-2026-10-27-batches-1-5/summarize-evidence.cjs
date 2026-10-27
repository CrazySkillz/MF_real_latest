// Produce a compact receipt without copying logs, credentials or database rows.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const read = file => JSON.parse(fs.readFileSync(path.join(__dirname, file), 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname, file))).digest('hex');
const executionFile = '../validation-2026-10-27-ci-scheduler/batches15-final-execution.json';
const logFile = '../validation-2026-10-27-ci-scheduler/batches15-final-tests.log';
const execution = read(executionFile), inventory = read('finding-inventory.json');
const log = fs.readFileSync(path.join(__dirname, logFile), 'utf8');
if (!log.includes('Total 6548; passed 6548; failed 0.') || execution.checks.some(check => check.exitCode !== 0) || execution.changedTrackedFiles.length) throw new Error('Incomplete or changed validation run');
const focused = read('../validation-2026-10-27-report-incident/batches15-health-after.json');
if (focused.numFailedTests || focused.numPassedTests !== 111) throw new Error('Focused validation mismatch');
const result = {
  at: new Date().toISOString(), baseHead: execution.head,
  change: 'One outdated scheduler source-text assertion corrected; no application runtime change',
  findings: inventory.counts, totalFindings: inventory.findings.length,
  currentVersion: { total: 6548, passed: 6548, failed: 0, checks: execution.checks, changedTrackedFiles: execution.changedTrackedFiles, databasesAfter: execution.databases },
  focused: { total: focused.numTotalTests, passed: focused.numPassedTests, failed: focused.numFailedTests },
  inputs: [executionFile, logFile, 'finding-inventory.json', 'public-deployment.json', 'persisted-boundaries-final.json', 'hosted-ci.json'].map(file => ({ file, sha256: sha256(file) })),
  sourceManifestDigest: crypto.createHash('sha256').update(JSON.stringify(inventory.sourceManifest)).digest('hex'),
  limit: 'Execution proves the cases run. It does not close untested lifecycle, historical provenance, authenticated provider or release acceptance.'
};
fs.writeFileSync(path.join(__dirname, 'validation-summary.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ total: result.currentVersion.total, failed: 0, focused: result.focused.passed, totalFindings: result.totalFindings, changedTrackedFiles: result.currentVersion.changedTrackedFiles }));
