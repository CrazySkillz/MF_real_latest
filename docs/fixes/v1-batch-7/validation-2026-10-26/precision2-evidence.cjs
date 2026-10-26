// Record current local evidence; no credentials, application startup or network.
const fs = require('node:fs');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const assert = require('node:assert/strict');
const dir = __dirname;
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8', windowsHide: true });
const results = JSON.parse(fs.readFileSync(`${dir}/precision2-final.json`));
const builds = JSON.parse(fs.readFileSync(`${dir}/precision2-final-build-checks.json`));
assert.equal(results.success, true);
assert.equal(results.numFailedTests, 0);
assert.equal(results.numPendingTests, 0);
assert(builds.checks.every(check => check.exitCode === 0));
const runtimeFiles = ['client/src/pages/ga4-metrics.tsx', 'client/src/pages/ga4-ad-comparison.tsx', 'server/ga4-scheduled-report-pdf.ts'];
const unchanged = ['server/routes-oauth.ts', 'server/storage.ts', 'shared/schema.ts', 'server/report-scheduler.ts', 'server/ga4-daily-scheduler.ts', 'server/ga4-kpi-benchmark-jobs.ts', 'server/services/email-service.ts', 'client/src/index.css'];
assert.equal(git(['diff', 'HEAD', '--name-only', '--', ...unchanged]).trim(), '');
assert.equal(git(['diff', 'HEAD', '--name-only', '--', '*.pdf', '*.png']).trim(), '');
const protectedBlocks = [
  ['client/src/pages/ga4-metrics.tsx', 'const ga4PublicationScope =', 'const deriveBenchmarkCategoryFromMetric ='],
  ['client/src/pages/ga4-metrics.tsx', 'const adComparisonBreakdownAgg =', '}, [adComparisonBreakdown, adComparisonBreakdownPlaceholder, importedGA4CampaignNames]);'],
  ['server/ga4-scheduled-report-pdf.ts', 'const adComparisonBreakdownAgg =', '.sort((a, b) => b.sessions - a.sessions);'],
].map(([file, start, end]) => {
  const extract = text => {
    const begin = text.indexOf(start), finish = text.indexOf(end, begin);
    assert(begin >= 0 && finish > begin);
    return text.slice(begin, finish + end.length).replace(/\r\n/g, '\n');
  };
  const current = extract(fs.readFileSync(file, 'utf8'));
  assert.equal(current, extract(git(['show', `HEAD:${file}`])));
  return { file, start, sha256: hash(current), unchanged: true };
});
const tests = Object.fromEntries(results.testResults.map(result => {
  const file = result.name.replaceAll('\\', '/').split('/MF_real_latest/')[1];
  return [file, { sha256: hash(fs.readFileSync(file)), passed: result.assertionResults.filter(a => a.status === 'passed').length }];
}));
const evidence = {
  base: git(['rev-parse', 'HEAD']).trim(), state: 'uncommitted; undeployed',
  rootCause: 'Source total summed individually rounded campaign amounts instead of rounding their raw selected sum once.',
  arithmetic: { raw: [3400.434193, 4253.52214], native: 7653.96, hubspot: 250, salesforce: 100, total: 8003.96 },
  runtimeFiles: Object.fromEntries(runtimeFiles.map(file => [file, hash(fs.readFileSync(file))])),
  unchangedFromBase: Object.fromEntries(unchanged.map(file => [file, hash(fs.readFileSync(file))])),
  protectedBlocks, historicalTrackedPdfPngUnchanged: true,
  passed: results.numPassedTests, failed: results.numFailedTests, skipped: results.numPendingTests, files: results.testResults.length, tests, builds,
  artifacts: JSON.parse(fs.readFileSync(`${dir}/precision2-render.json`)),
  downloadCoverage: ['real page initial PDF', 'failed daily refresh blocks then recovers', 'failed status refresh blocks then recovers', 'mismatched financial publication blocks then recovers'],
  limits: ['All new browser requests mocked in a fresh headless context; no personal browser or production access.', 'Historic production failed request remains unidentified; rollback download recovery confirmed by user.', 'New deployed download and natural emailed attachment not verified.', 'No production-readiness claim for the entire Reports subsystem or application.'],
};
fs.writeFileSync(`${dir}/precision2-validation.json`, JSON.stringify(evidence, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ passed: evidence.passed, files: evidence.files, buildsPassed: builds.checks.length, artifacts: evidence.artifacts.artifacts.length, preserved: true }));
