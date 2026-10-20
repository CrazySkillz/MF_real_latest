// Generate audit catalogs only; no runtime changes or application imports.
const fs = require('node:fs'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
const inventory = JSON.parse(fs.readFileSync(dir + 'inventory.json', 'utf8'));
const names = [...new Set(inventory.configuration.map(x => x.name))].sort();
const lines = [
  '# Observed configuration catalog', '',
  'Candidate `' + inventory.head + '`. Names and source expressions only; no local/deployed environment values. [Contract review and limitations](CONFIGURATION_AND_RECOVERY.md). All119 observed names are listed; seven test-worker controls and the Vite DEV constant are explicitly distinguished. SDK-owned Clerk settings and build-tool settings outside client/server/shared are listed separately in the contract review.', '',
  '| Name | Boundary | Exact source access |', '|---|---|---|',
];
for (const name of names) {
  const entries = inventory.configuration.filter(x => x.name === name);
  const boundary = name.startsWith('GA4_TEST_') ? 'Isolated test worker only' : name === 'DEV' ? 'Vite compile-time constant' :
    name.startsWith('VITE_') ? 'Build-time browser setting; Clerk also server fallback' : 'Server/runtime configuration; deployed value unverified';
  lines.push(`| ${name} | ${boundary} | ${entries.map(x => `\`${x.file}:${x.line}\``).join(', ')} |`);
}
assert.equal(names.length, 119);
fs.writeFileSync(dir + 'CONFIGURATION_CATALOG.md', lines.join('\n') + '\n');
const failures = JSON.parse(fs.readFileSync(dir + 'test-failures.json','utf8'));
const acceptance = JSON.parse(fs.readFileSync(dir + 'ga4-fixture-acceptance-results.json','utf8'));
assert.equal(acceptance.numFailedTests, 0); assert.equal(acceptance.numPassedTests,108);
const assertions = acceptance.testResults.flatMap(file => file.assertionResults.map(a=>({...a,file:file.name})));
const mapped = failures.filter(f=>f.classification === 'BEHAVIOR_ASSERTION_WITH_INCOMPLETE_FIXTURE').map(f=>{
  const base = f.file.split('/').at(-1).replace('.test.ts','.fixture-acceptance.test.ts');
  const match = assertions.filter(a=>a.file.endsWith(base) && a.fullName === f.name);
  assert.equal(match.length,1, f.id); assert.equal(match[0].status,'passed',f.id);
  return { id:f.id, originalFile:f.file, originalAssertion:f.name, originalStatus:f.status, originalFinding:f.finding,
    rootCause:'Fixture omits getGA4PublicationVersion; six exact write assertions also omit current publicationVersion identity.',
    supplementalStatus:'PASS in audit-only copy with exact metric values and campaign/version guard expectations retained',
    originalSuiteDisposition:'OPEN until agreed test-file correction and complete rerun', evidence:'ga4-fixture-acceptance-results.json' };
});
assert.equal(mapped.length,37);
fs.writeFileSync(dir + 'ga4-failed-test-root-causes.json',JSON.stringify({head:inventory.head,originalFullSuiteUnchanged:true,mapped},null,2)+'\n');
console.log(JSON.stringify({configurationNames:names.length,rootCauseMappings:mapped.length,originalFailuresStillOpen:failures.length}));
