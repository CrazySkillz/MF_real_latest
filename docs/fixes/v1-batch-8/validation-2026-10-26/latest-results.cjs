// Preserve each actual run; summarize the latest result for each exact file.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const full = read('consolidated.json'), precision = read('precision-isolated.json');
assert.equal(precision.testResults.length, 1);
assert.ok(precision.testResults[0].name.endsWith('/server/v1-batch3-conversion-postgres.test.ts'));
const replacement = precision.testResults[0];
assert.ok(full.testResults.some(file => file.name === replacement.name));
const files = full.testResults.map(file => file.name === replacement.name ? replacement : file);
const assertions = files.flatMap(file => file.assertionResults);
const statuses = Object.fromEntries(['passed', 'failed', 'pending', 'skipped', 'todo'].map(status => [status, assertions.filter(test => test.status === status).length]));
const result = {
  at: new Date().toISOString(), base: 'ea0b843afbb8946eaaa248ea57786651cd3d457b',
  method: 'Latest per-file result: full run plus the exact precision suite on its required port. Not a single clean full-suite run.',
  runs: ['consolidated.json', 'precision-isolated.json'], files: files.length, total: assertions.length, ...statuses,
  suiteErrors: files.filter(file => file.status === 'failed' && !file.assertionResults.some(test => test.status === 'failed')).map(file => ({ file: file.name, message: file.message })),
  unhandledErrors: [...read('consolidated-run-errors.json').errors, ...read('precision-isolated-run-errors.json').errors],
  cleanup: ['consolidated', 'precision-isolated'].map(label => {
    const run = read(`${label}-execution.json`);
    assert.equal(run.stopped, true); assert.deepEqual(run.changedTrackedFiles, []);
    assert.ok(run.databases.every(db => db.other_sessions === 0 && db.schemas.length === 0 && db.publicTables.length === 0));
    return { label, stopped: run.stopped, changedTrackedFiles: run.changedTrackedFiles, emptyDatabases: true };
  }),
  limits: 'All 123 assertion failures remain open in consolidated-reconciliation.json. No application change or release certification.',
};
fs.writeFileSync(path.join(__dirname, 'latest-results.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(result, null, 2));
