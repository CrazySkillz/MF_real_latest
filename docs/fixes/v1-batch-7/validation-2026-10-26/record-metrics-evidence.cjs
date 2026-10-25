const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const packet = name => {
  const result = read(name);
  return { file: name, sha256: hash(path.join(__dirname, name)), total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests, fileCount: result.testResults.length,
    files: result.testResults.map(file => ({ file: path.relative(process.cwd(), file.name).replace(/\\/g, '/'), passed: file.assertionResults.filter(test => test.status === 'passed').length, failed: file.assertionResults.filter(test => test.status === 'failed').length, skipped: file.assertionResults.filter(test => ['pending', 'skipped', 'todo'].includes(test.status)).length })) };
};
const modified = execFileSync('git', ['diff', '--name-only'], { encoding: 'utf8' }).trim().split(/\r?\n/);
const newTests = ['server/v1-batch7-metric-boundaries.test.ts', 'server/v1-batch7-metric-routes.test.ts', 'server/v1-batch7-source-goal-values.test.ts'];
const runtime = modified.filter(file => /^(client|server)\//.test(file) && !file.endsWith('.test.ts'));
const oldRoutes = execFileSync('git', ['show', '1de80e15:server/routes-oauth.ts'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const oldStorage = execFileSync('git', ['show', '1de80e15:server/storage.ts'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
const oldTests = execFileSync('git', ['show', '1de80e15:server/ga4-kpi-report-consumer-regression.test.ts'], { encoding: 'utf8' });
const oldSnapshotRoute = oldRoutes.slice(oldRoutes.indexOf('app.get("/api/report-snapshots/:snapshotId/pdf"'), oldRoutes.indexOf('// Get single benchmark'));
const oldReplacement = oldStorage.slice(oldStorage.indexOf('async replaceGA4DailyMetricsWindow'), oldStorage.indexOf('async getGA4DailyMetrics', oldStorage.indexOf('async replaceGA4DailyMetricsWindow')));
const baseline = packet('metrics-baseline.json');
const consolidated = packet('metrics-verified.json');
const finalContract = packet('metrics-api-contract.json');
const cleanup = read('metrics-cleanup.json');
const finalBuild = read('metrics-api-contract-build-checks.json');
const clientBuild = read('metrics-final-build-checks.json');
if (consolidated.failed || consolidated.skipped || finalContract.failed || finalContract.skipped || !cleanup.stopped || finalBuild.checks.some(row => row.exitCode !== 0) || clientBuild.checks.some(row => row.exitCode !== 0)) throw new Error('Final validation not clean');
const result = {
  at: new Date().toISOString(), baselineRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), workingTreeUncommitted: true,
  findings: ['056', '077', '084', '094', '095', '096', '097', '098', '099', '100', '101', '122'].map(id => `V1-${id}`),
  scope: 'Batch 7 Group 2 local forward-path corrections and current-baseline precision verification. Not production certification.',
  tests: { baseline, consolidated, finalContract, postgres: packet('metrics-http-postgres.json') },
  baselineLimit: 'Only extracted runtime blocks use git show at 1de80e15. Direct imports use working-tree helpers. Initial 84-case reproduction predates later coverage additions; not a whole-revision baseline.',
  finalContractReason: 'After the consolidated pass, preserve the Executive GA4 response field set explicitly; add four missing/failed/zero input controls and rerun the affected four test files. Unchanged PostgreSQL paths retain their passing evidence.',
  validationTypes: ['Extracted actual UI expressions and report branches', 'Actual central alert resolver with controlled storage and current filter/metric helpers', 'Actual Express route registration with controlled providers/storage', 'Compiled production SQL against three real PostgreSQL temporary-table cases', 'Existing neighboring regression guards; some are structural assertions'],
  builds: { finalTypeScriptAndServer: finalBuild, clientAndEarlierBuild: clientBuild, clientUnchangedSinceBuild: true },
  cleanup,
  staleTestEvidenceAtBaseline: { immutableArtifactPresent: oldSnapshotRoute.includes('const immutablePdf = readReportPdfArtifact(payload);'), obsoleteHistoricalPreflightAbsent: !oldSnapshotRoute.includes('preflightGA4ReportKPIConsumers('), oldTestExpectedHistoricalPreflight: oldTests.includes('expect(route).toContain("preflightGA4ReportKPIConsumers(okReport'), scopedTransactionAlreadyPresent: oldReplacement.includes('await transaction(async (tx: any) =>') },
  runtimeFileCount: runtime.length,
  files: [...modified, ...newTests].sort().map(file => ({ file, sha256: hash(file), kind: runtime.includes(file) ? 'runtime' : file.endsWith('.test.ts') ? 'test' : 'documentation' })),
  safety: { productionAccess: false, browserAccess: false, providerAccess: false, actualEmailSent: false, schemaChanges: false, newDependencies: false, productionDataCleanup: false, sourceMutations: false, connectionReadGuard: 'Sheets alert reads disable lazy token migration and runtime credential resolution; default getter behavior tested unchanged', network: 'Test runners strip credentials and permit only loopback; disposable PostgreSQL bound to 127.0.0.1:55444' },
  remaining: ['Nine findings in retained pages/forms/exports and report content/layout/parity groups', 'All 29 Batch 7 release acceptances remain open', 'Batch 6 live Google Ads sign-off postponed', 'No browser or rendered-PDF visual validation', 'No full source mutation/provider/scheduler lifecycle recertification', 'No independent-worker final-read-to-dispatch race proof or real notification/email delivery', 'No production historical-data inventory/repair'],
  intendedEvidenceFiles: ['run-tests.cjs', 'run-build-checks.cjs', 'run-metrics-suite.cjs', 'metrics-test-files.json', 'metrics-cleanup.cjs', 'record-metrics-evidence.cjs', 'metrics-evidence.json', 'metrics-baseline.json', 'metrics-verified.json', 'metrics-api-contract.json', 'metrics-http-postgres.json', 'metrics-cleanup.json', 'metrics-final-build-checks.json', 'metrics-final-typecheck.log', 'metrics-final-client-build.log', 'metrics-final-server-build.log', 'metrics-api-contract-build-checks.json', 'metrics-api-contract-typecheck.log', 'metrics-api-contract-server-build.log', 'metrics-verified-build-checks.json', 'metrics-verified-typecheck.log', 'metrics-verified-server-build.log'],
};
fs.writeFileSync(path.join(__dirname, 'metrics-evidence.json'), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ runtimeFiles: runtime.length, consolidatedPassed: consolidated.passed, finalContractPassed: finalContract.passed, stopped: cleanup.stopped, staleTestEvidenceAtBaseline: result.staleTestEvidenceAtBaseline }));
