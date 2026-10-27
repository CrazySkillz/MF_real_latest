// Reapply the real CI classifier to the preserved complete results; no app execution.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { createHash } = require('node:crypto');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const source = ts.createSourceFile('boundary.ts', fs.readFileSync('scripts/ga4-kpi-current-version-test-boundary.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['normalizePath', 'testIdentity', 'repositoryRelativeFile', 'classifyCurrentVersionResults', 'runCurrentVersion'];
const code = ts.transpileModule(names.map(name => {
  const node = source.statements.find(value => ts.isFunctionDeclaration(value) && value.name?.text === name);
  if (!node) throw Error(`Missing classifier function ${name}`);
  return node.getText(source).replace(/^export /, '');
}).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const runs = ['consolidated', 'precision-isolated'];
const testResults = runs.flatMap(name => {
  const result = read(`${name}.json`), errors = read(`${name}-run-errors.json`);
  if (!result.success || result.numFailedTestSuites || result.numPendingTests || result.numTodoTests || errors.reason !== 'passed' || errors.errors.length) throw Error(`Incomplete results: ${name}`);
  const execution = read(`${name}-execution.json`);
  for (const [file, hash] of Object.entries(execution.beforeHashes)) {
    if (file.startsWith('docs/') || file === 'scripts/ga4-kpi-current-version-test-boundary.json') continue;
    if (createHash('sha256').update(fs.readFileSync(file)).digest('hex') !== hash) throw Error(`Source changed since full execution: ${file}`);
  }
  return result.testResults;
});
const assertions = testResults.flatMap(file => file.assertionResults);
if (assertions.length !== 6477 || assertions.some(test => test.status !== 'passed')) throw Error('Full passing result inventory changed');
const report = { testResults, numTotalTests: assertions.length, numPassedTests: assertions.length, numFailedTests: 0, unhandledErrors: [] };
const manifest = JSON.parse(fs.readFileSync('scripts/ga4-kpi-current-version-test-boundary.json', 'utf8'));
const functions = new Function('relative', 'runVitest', 'printFailures', 'console', code + '\nreturn { classifyCurrentVersionResults, runCurrentVersion };')(
  path.relative, () => ({ report, status: 0 }), () => {}, { log() {}, error() {} });
const classification = functions.classifyCurrentVersionResults(report, manifest, process.cwd());
const gateExit = functions.runCurrentVersion(process.cwd(), manifest);
const output = { at: new Date().toISOString(), evidence: 'Preserved 6477 passing results; actual current CI functions; only the manifest identity metadata may differ from executed source hashes',
  total: assertions.length, files: testResults.length, manifestCount: manifest.tests.length,
  currentFailures: classification.currentFailures, missingDeferred: classification.missingDeferred,
  deferredPassed: classification.deferredResults.filter(test => test.status === 'passed').length, gateExit };
if (process.argv.includes('--final')) {
  const focused = read('precommit-ci-tests.json');
  if (gateExit || manifest.tests.length !== 52 || !focused.success || focused.numFailedTests || focused.numPendingTests || focused.numTodoTests) throw Error('Precommit checks failed');
  output.focused = { passed: focused.numPassedTests, files: focused.testResults.length };
  output.identityCorrection = { file: 'server/meta-production-regression.test.ts',
    previous: 'Meta production readiness regression guard keeps the Create Campaign confirm Back button on platform selection instead of re-entering OAuth',
    current: 'Meta production readiness regression guard returns the Create Campaign confirm Back button to the immediately preceding setup step',
    group: 'future-platforms', policyExpanded: false };
  fs.writeFileSync(path.join(__dirname, 'precommit-ci-boundary.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify(output));
