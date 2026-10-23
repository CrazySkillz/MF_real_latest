const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const dir = __dirname;
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const result = read(path.join(dir, 'verified.json'));
const prior = [
  ...read('docs/fixes/v1-batch-4/validation-2026-10-22/failure-reconciliation.json').failures,
  ...read('docs/fixes/v1-batch-4/validation-2026-10-23-custom-integration/assessment.json').failures,
];
const reasons = {
  'feeds GA4 Overview financial values from source-backed spend totals into Profit, ROAS, ROI, and CPA': 'Source assertion cannot find its expected inline Profit expression inside the selected UI slice. That GA4 display path was not changed here; its calculation/render contract still requires behavioral reconciliation.',
  'renders the Instagram Connected Platforms card shell with guarded analytics exposure': 'Source assertion expects an exact icon import declaration; the current import differs. This does not establish card exposure or isolation behavior. Deferred provider functionality and required shared exposure safeguards must remain distinguished.',
  'keeps Create Campaign Instagram finalization gated by selected test-mode source scope': 'Wizard assertion expects literal setWizardStep(5); the retained flow no longer contains that exact statement. Actual draft finalization and deferred-provider exclusion remain separate acceptance checks.',
  'allows Instagram as a validated financial platform context without adding refresh behavior': 'Exact z.enum list assertion differs from current shared context definitions. Current Manual Spend context and source identity pass actual-handler tests; other financial routes remain unverified by this failed assertion.',
  'allows Instagram revenue wizards to map only persisted selected Instagram campaigns': 'Expected platformLabel ternary is absent from the current revenue wizard. This failed source assertion does not validate revenue selection boundaries; no revenue code changed here.',
  'preserves Instagram platform context on shared revenue source edits': 'Expected direct updateRevenueSource call differs from the current atomic CSV Revenue replacement path. Preserve independent shared-route scope tests and reconcile this contract under V1-012.',
  'resolves Instagram Overview revenue only from Instagram-scoped revenue sources': 'Exact RevenuePlatformContext type declaration assertion differs from the current declaration. Runtime revenue isolation is not certified by this result.',
  'Google Sheets main platform feeds Campaign DeepDive aggregate without raw sheet revenue/spend rows': 'Expected single-name import differs from the combined import containing buildGoogleSheetsPlatformSourceForAggregate. Remaining assertions did not execute; scoped aggregate behavior still needs acceptance.',
  'Google Sheets KPIs use source-backed mapped metrics without blocking explicit sheet financial columns': 'Expected inline /roas|return on/i test is absent after shared metric resolution changes. Later assertions did not execute; goal/financial correctness is not waived.',
  'Google Sheets Reports follow the GA4 Reports template with source-backed output guards': 'Expected inline source platform-context expression is absent from the selected current helper. Later assertions did not execute; report financial scope remains an acceptance requirement.',
  'Google Ads disconnect route is campaign-scoped and fails closed when no row is deleted': 'Expected direct deleteGoogleAdsDailyMetrics call differs from current storage cleanup. Exact disconnect atomicity and boundary behavior remain open; this fix does not change disconnect.',
  'Google Ads scheduler fails closed before refreshing missing campaigns or spend-only test-mode connections': 'Assertion expects a bare return; current scheduler returns a structured non-refreshed outcome. Later assertions did not execute; scheduler acceptance is not waived.',
};
const failures = result.testResults.flatMap(suite => suite.assertionResults.filter(t => t.status === 'failed').map(test => {
  const file = path.relative(process.cwd(), suite.name).replace(/\\/g, '/');
  const name = test.fullName;
  const old = prior.find(p => p.file === file && p.name === name);
  if (!reasons[test.title]) throw new Error(`Unclassified failure: ${test.title}`);
  return { id: old?.id || `B4-TEST-${crypto.createHash('sha256').update(`${file}\n${name}`).digest('hex').slice(0, 10)}`, file, name,
    classification: 'SOURCE_ASSERTION_MISMATCH', reason: reasons[test.title], firstFailure: test.failureMessages[0].split('\n')[0],
    finding: 'V1-012', status: 'FAILED; OPEN', waived: false,
    releaseImpact: 'Whole-suite/CI gate remains blocked. Map the test to current behavior and execute every intended assertion before acceptance.' };
}));
const files = ['server/routes-oauth.ts', 'client/src/components/AddSpendWizardModal.tsx', 'server/v1-batch4-manual-spend.test.ts',
  'server/ga4-google-ads-spend-pipeline-regression.test.ts', 'server/ga4-source-lifecycle-recompute-regression.test.ts',
  'server/google-ads-spend-lifecycle-downstream.test.ts', 'server/instagram-connected-platforms-regression.test.ts', 'server/source-safety-regression.test.ts'];
const manual = result.testResults.find(r => r.name.endsWith('v1-batch4-manual-spend.test.ts'));
const assessment = {
  at: new Date().toISOString(), baseHead: '2af808b148537ce755b2566586c1a69f199cc86c', scope: ['V1-068'], state: 'Uncommitted local correction; release acceptance OPEN; V1 NO-GO',
  finalManualBoundary: { total: manual.assertionResults.length, passed: manual.assertionResults.filter(t => t.status === 'passed').length, failed: 0, skipped: 0, realPostgresCases: 9, actualFormHandlerCases: 5 },
  expanded: { total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests }, failures,
  intermediate: [
    { packet: 'baseline.log', classification: 'ENVIRONMENT', detail: 'Sandbox blocked esbuild child process (spawn EPERM); no test executed. Retried with approved local execution.' },
    { packet: 'baseline-executed.json', classification: 'PRE_FIX_REPRODUCTION', detail: '50 cases:19 pass/31 fail. 30 failing assertions expose old-route contracts; one Google Ads fixture used googleAdsCampaignId instead of googleCampaignId and was corrected without changing materialization logic.' },
    { packet: 'corrected.json', detail: '50/50 route cases pass after runtime correction and fixture field repair.' },
    { packet: 'database-and-neighbors.json', detail: '246:228 pass/18 fail/0 skip. All 59 Manual Spend route/PostgreSQL cases passed. Related source-assertion expectations were reconciled with actual currency, canonical context, atomic persistence, source-name and scoped recompute paths; unrelated failures retained.' },
    { packet: 'final-packet.json', detail: '255:242 pass/13 fail/0 skip. All 68 Manual Spend checks passed. Remaining recompute assertion found a later no-options Sheets call before an earlier refreshWriteInput call; assertion now accepts the existing optional argument without changing runtime.' },
  ],
  safeguards: { productionAccess: false, ptomoMutation: false, providerCalls: false, schemasChanged: false, dependenciesAdded: false, credentialsRemovedFromTestEnvironment: true, networkRestrictedToLocalhost: true },
  validation: { builds: 'candidate-build-checks.json', finalTypecheck: 'final-build-checks.json', fixtureCleanup: 'fixture-cleanup.json' },
  limits: ['No authenticated deployed/browser/provider validation performed. Actual form handlers were executed without a browser.', 'GA4 Manual Spend remains blocked; explicit Google Ads uses existing server-side materialization.', 'Retained non-GA4 ad-platform/demo behavior is compatibility coverage, not independent provider certification.', 'Source and records are atomic; subsequent totals refresh is separate and returns explicit 503/spendSaved when it fails.', 'No historical sources were inspected, relabelled, deleted or repaired. Old disguised/invalid rows need separately bounded review.', 'Historical full-suite 179-failure count is unchanged; this targeted packet cannot replace a full-suite/CI result.'],
};
for (const [name, value] of Object.entries({ 'assessment.json': assessment, 'candidate-manifest.json': { at: assessment.at, baseHead: assessment.baseHead, files: files.map(file => ({ file, sha256: crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex') })) } })) {
  fs.writeFileSync(path.join(dir, name), JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
}
console.log(JSON.stringify({ manual: assessment.finalManualBoundary, expanded: assessment.expanded, classifiedFailures: failures.length }));
