const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const here = __dirname;
const read = name => JSON.parse(fs.readFileSync(path.join(here, name), 'utf8'));
const final = read('final-record.json');
const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json', 'utf8'));
const failures = final.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const old = previous.failures.find(f => f.name === t.fullName);
  if (!old) throw Error(`Unclassified new failure: ${t.fullName}`);
  return { ...old, currentFile: path.relative(process.cwd(), s.name).replace(/\\/g, '/'), currentError: t.failureMessages.join('\n'),
    currentClassification: old.classification, status: 'FAILED; OPEN', finding: 'V1-012',
    disposition: 'Required release gate remains open. Prior occurrence is supporting history, not permission to ignore the failed requirement.' };
}));
const summary = r => ({ total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests });
const newCases = final.testResults.filter(s => s.name.includes('v1-batch5-')).flatMap(s => s.assertionResults);
if (newCases.some(t => t.status !== 'passed') || final.numPendingTests) throw Error('New Batch 5 tests must all pass without skips');
const suiteErrors = final.testResults.filter(s => s.status === 'failed' && !s.assertionResults.some(t => t.status === 'failed'));
if (suiteErrors.length) throw Error('Suite failure without assertion');
const runtimeFiles = ['server/routes-oauth.ts', 'server/utils/hubspot-pagination.ts', 'server/utils/salesforce-pagination.ts', 'server/utils/shopify-provider.ts', 'server/utils/shopify-revenue.ts', 'client/src/pages/ga4-metrics.tsx', 'client/src/pages/google-sheets-data.tsx', 'client/src/pages/custom-integration-analytics.tsx'];
const tests = ['server/v1-batch5-provider-contract.test.ts', 'server/v1-batch5-proxy-consumers.test.ts', 'server/v1-batch5-proxy-browser.test.ts', 'server/hubspot-pagination.test.ts', 'server/hubspot-pipeline-automation-ui.test.ts', 'server/salesforce-pagination.test.ts', 'server/salesforce-pipeline-automation-ui.test.ts'];
const assessment = {
  at: new Date().toISOString(), baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), candidate: 'UNCOMMITTED working tree; no Batch 5 deployment',
  findings: ['V1-042', 'V1-043', 'V1-044', 'V1-045', 'V1-083', 'V1-109'], fixStatus: 'VERIFIED LOCALLY within documented boundaries', releaseAcceptance: 'OPEN', releaseDecision: 'NO-GO',
  baseline: summary(read('baseline.json')), final: summary(final), newBatch5Checks: { total: newCases.length, passed: newCases.length, failed: 0, skipped: 0, realPostgres: 10, fullPageBrowser: 1 },
  builds: read('verified-build-checks.json'), finalTestTypecheck: read('final-tests-build-checks.json'),
  failureLedger: 'failure-reconciliation.json', noProductionOrProviderMutation: true,
  isolation: 'Environment allowlist removes application credentials; local-network-only preload; disposable schema on 127.0.0.1:55444/ga4_alignment_test; browser intercepts every request and blocks external hosts/mutations.',
  limits: ['No authenticated deployed/provider acceptance', 'No full-app re-certification or repeated full suite', 'No historical corrupted-data inventory/cleanup', 'Currency fallback, OAuth scope and quotas need each provider/account validation', 'GA4/Custom proxy computations tested; full-page browser case is standalone Sheets only', 'CRM route owner/token/currency-discovery boundaries use explicit fixtures; real PostgreSQL replacement exercised for HubSpot and Salesforce, not Shopify'],
  manifest: [...runtimeFiles, ...tests].map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })),
};
fs.writeFileSync(path.join(here, 'assessment.json'), JSON.stringify(assessment, null, 2) + '\n');
fs.writeFileSync(path.join(here, 'failure-reconciliation.json'), JSON.stringify({ at: assessment.at, baseHead: assessment.baseHead, final: assessment.final, newFailingIdentities: [], suitesFailingWithoutFailedAssertions: [], failures,
  intermediateCorrections: ['Seven pagination/stage assertions or provider fixtures updated to the verified contract; two cached-zero assertions updated to reconciliation guard; proxy fixture bound to actual Salesforce validators; test-only UTF-8 literal restored. Earlier failing runs retained.'],
  previousWholeSuite: previous.finalFullSuite, separateCiGate: previous.separateCiGate }, null, 2) + '\n');
console.log(JSON.stringify({ final: assessment.final, newBatch5Checks: assessment.newBatch5Checks, unresolvedFailures: failures.length }));
