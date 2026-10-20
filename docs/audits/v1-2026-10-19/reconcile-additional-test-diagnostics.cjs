const fs = require('node:fs'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
const failures = JSON.parse(fs.readFileSync(dir + 'test-failures.json', 'utf8'));
const packets = [
  ['binding-fixture-results.json', '.binding-diagnostic.test.ts'],
  ['transaction-fixture-results.json', '.transaction-diagnostic.test.ts'],
];
const mapped = [];
for (const [file, suffix] of packets) {
  const packet = JSON.parse(fs.readFileSync(dir + file, 'utf8'));
  for (const testFile of packet.testResults) {
    const original = 'server/' + testFile.name.split('/').at(-1).replace(suffix, '.test.ts');
    for (const a of testFile.assertionResults) {
      const f = failures.find(f => f.file === original && f.name === a.fullName);
      if (!f) continue;
      mapped.push({ id: f.id, originalFile: original, originalAssertion: f.name, classification: f.classification,
        supplementalStatus: a.status, evidence: file, originalSuiteStatus: f.status,
        boundary: file.startsWith('transaction') ? 'Synthetic existing parent; durable work table absent; original rollback/idempotency/child-isolation assertions unchanged'
          : 'Actual missing security helper bound; scheduler fixture campaign active; original assertions unchanged' });
    }
  }
}
const passed = mapped.filter(x => x.supplementalStatus === 'passed');
assert.equal(passed.length, 60);
assert.equal(mapped.filter(x => x.supplementalStatus === 'failed').length, 1);
assert.equal(new Set(mapped.map(x => x.id)).size, mapped.length);
fs.writeFileSync(dir + 'additional-test-root-causes.json', JSON.stringify({ at: new Date().toISOString(),
  originalFullSuiteUnchanged: true, originalFailuresDiagnosedPassing: passed.length, mapped }, null, 2) + '\n');
console.log(JSON.stringify({ originalFailuresPassingInCopies: passed.length, structuralFailureRetained: 1 }));
