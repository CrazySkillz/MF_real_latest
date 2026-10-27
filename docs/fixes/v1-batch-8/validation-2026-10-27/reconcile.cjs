// Reconcile exact assertion identities; never converts failures into passes.
const fs = require('node:fs');
const path = require('node:path');
const root = process.cwd().replaceAll('\\', '/') + '/';
const old = path.resolve(__dirname, '../validation-2026-10-26');
const runs = [path.join(old, 'consolidated.json'), path.join(old, 'precision-isolated.json'),
  ...process.argv.slice(2).map(label => path.join(__dirname, `${label}.json`))];
const files = new Map();
for (const run of runs) for (const file of JSON.parse(fs.readFileSync(run)).testResults) files.set(file.name, file);
const failures = [], counts = {};
for (const file of files.values()) for (const assertion of file.assertionResults) {
  counts[assertion.status] = (counts[assertion.status] || 0) + 1;
  if (assertion.status === 'failed') failures.push({ file: file.name.replaceAll('\\', '/').replace(root, ''),
    name: assertion.fullName, error: assertion.failureMessages[0]?.split('\n').slice(0, 3).join('\n') });
}
console.log(JSON.stringify({ counts, failures }, null, 2));
