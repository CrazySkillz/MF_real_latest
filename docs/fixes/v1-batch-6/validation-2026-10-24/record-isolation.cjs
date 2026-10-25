const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const final = read('isolation-final.json');
const broader = read('isolation-neighbors.json');
const legacy = broader.testResults.find(file => file.name.endsWith('/google-ads-production-regression.test.ts') || file.name.endsWith('\\google-ads-production-regression.test.ts'));
if (!legacy || !final.success) throw Error('Missing final test evidence');
const baseline = read('deployed-google-ads-baseline.json');
const failed = result => result.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => test.fullName)).sort();
if (JSON.stringify(failed({ testResults: [legacy] })) !== JSON.stringify(failed(baseline))) throw Error('Static failures differ from deployed baseline');
const files = [...final.testResults, legacy].map(file => ({ file: path.relative(process.cwd(), file.name).replaceAll('\\', '/'),
  passed: file.assertionResults.filter(test => test.status === 'passed').length,
  failed: file.assertionResults.filter(test => test.status === 'failed').length,
  skipped: file.assertionResults.filter(test => !['passed', 'failed'].includes(test.status)).length }));
const runtime = ['google-ads-scheduler.ts', 'instagram-scheduler.ts', 'linkedin-scheduler.ts', 'meta-scheduler.ts', 'tiktok-scheduler.ts', 'routes-oauth.ts', 'scheduler.ts'];
const inputs = [...runtime.map(name => `server/${name}`), ...files.map(file => file.file), 'shared/schema.ts', 'tsconfig.json', 'package.json', 'package-lock.json'];
const hashes = Object.fromEntries([...new Set(inputs)].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')]));
const typecheck = read('isolation-types-final-build-checks.json');
const build = read('isolation-final-build-checks.json').checks.find(check => check.name === 'server-build');
if (!typecheck.checks.every(check => check.exitCode === 0) || build?.exitCode !== 0) throw Error('Build checks incomplete');
fs.writeFileSync(path.join(__dirname, 'isolation-evidence.json'), JSON.stringify({
  at: new Date().toISOString(), baselineCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8', windowsHide: true }).trim(),
  deployment: { observedAt: '2026-10-24T21:40:28.1664200Z', endpoint: 'https://marketforensics.onrender.com/api/health', ok: true, commit: '2c3097bc13dc5206ae158a5ef505eee2b30d2ba0' },
  scope: 'First Batch 6 dispatch/test-generation/shared-aggregate correction only; partial V1-024/V1-121; no release acceptance or full Batch 6 completion.',
  counts: files.reduce((sum, file) => ({ passed: sum.passed + file.passed, failed: sum.failed + file.failed, skipped: sum.skipped + file.skipped }), { passed: 0, failed: 0, skipped: 0 }),
  files, remainingStaticFailures: failed(baseline), checks: [...typecheck.checks, build], hashes,
  limits: ['Synthetic storage/provider fixtures, no external network or provider credentials.', 'No user browser, production mutation, or production database access.',
    'No historical synthetic-data cleanup; unmarked persisted records require an exact separate inventory.', 'Retained direct reads, financial imports, other downstream consumers and worker recovery remain open.',
    'Seven other included Batch 6 findings uncorrected; four prior static test failures retained.', 'No commit or push performed for this local correction.'],
}, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ files: files.length, targetedPassed: final.numPassedTests, remainingStaticFailures: failed(baseline).length }));
