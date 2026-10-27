// Execute the existing CI classifier with synthetic runner results, no test subprocess.
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const source = ts.createSourceFile('boundary.ts', fs.readFileSync('scripts/ga4-kpi-current-version-test-boundary.ts', 'utf8'), ts.ScriptTarget.Latest, true);
const names = ['normalizePath', 'testIdentity', 'repositoryRelativeFile', 'classifyCurrentVersionResults', 'runCurrentVersion'];
const declarations = names.map(name => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name));
if (declarations.some(value => !value)) throw Error('CI classifier extraction failed');
const code = ts.transpileModule(declarations.map(node => node.getText(source).replace(/^export /, '')).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const manifest = JSON.parse(fs.readFileSync('scripts/ga4-kpi-current-version-test-boundary.json', 'utf8'));
const base = manifest.tests.map(test => ({ name: path.resolve(test.file), status: 'passed', assertionResults: [{ fullName: test.fullName, status: 'passed' }] }));
const cases = [
  { name: 'successful controls', exit: 0, extra: [], expected: 0 },
  { name: 'failed current assertion', exit: 1, extra: [{ name: path.resolve('server/fixture-current.test.ts'), status: 'failed', assertionResults: [{ fullName: 'current assertion', status: 'failed' }] }], expected: 1 },
  { name: 'suite fails before assertions load', exit: 1, extra: [{ name: path.resolve('server/fixture-current.test.ts'), status: 'failed', message: 'fixture import failure', assertionResults: [] }], expected: 1 },
  { name: 'unhandled worker error with passed assertions', exit: 1, extra: [], expected: 1 },
  { name: 'current assertions skipped', exit: 0, extra: [{ name: path.resolve('server/fixture-current.test.ts'), status: 'pending', assertionResults: [{ fullName: 'current skipped assertion', status: 'pending' }] }], expected: 1 },
];
const results = cases.map(test => {
  const testResults = [...base, ...test.extra];
  const assertions = testResults.flatMap(file => file.assertionResults);
  const report = { testResults, numTotalTests: assertions.length, numPassedTests: assertions.filter(item => item.status === 'passed').length, numFailedTests: assertions.filter(item => item.status === 'failed').length };
  const fn = new Function('relative', 'runVitest', 'printFailures', 'console', code + '\nreturn runCurrentVersion;')(path.relative, () => ({ report, status: test.exit }), () => {}, { log() {}, error() {} });
  const actual = fn(process.cwd(), manifest);
  return { name: test.name, expected: test.expected, actual, pass: actual === test.expected };
});
const output = { at: new Date().toISOString(), boundary: 'Actual CI classifier; synthetic Vitest results; no application execution', results };
fs.writeFileSync(path.join(__dirname, 'ci-boundary-diagnosis.json'), JSON.stringify(output, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify(output, null, 2));
