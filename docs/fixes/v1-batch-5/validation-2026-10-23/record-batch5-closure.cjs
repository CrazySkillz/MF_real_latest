// Local evidence only. No credentials, provider requests or database access.
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const root = path.resolve(__dirname, '../../../..');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const relative = name => path.relative(root, name).replaceAll('\\', '/');
const packets = ['batch5-closure-final.json', 'batch5-closure-financial-consumers.json', 'batch5-closure-preservation-verified.json'];
const current = packets.map(file => ({ file, result: read(file) }));
const suites = new Map();
for (const { file: packet, result } of current) for (const suite of result.testResults) suites.set(relative(suite.name), { packet, suite });
if ([...suites.values()].some(({ suite }) => suite.status !== 'passed' || suite.assertionResults.some(t => t.status !== 'passed'))) throw Error('Current validation is incomplete');
const builds = read('batch5-closure-build-build-checks.json');
if (builds.checks.length !== 3 || builds.checks.some(c => c.exitCode !== 0)) throw Error('Build validation is incomplete');
const finalTypecheck = read('batch5-closure-final-types-build-checks.json');
if (finalTypecheck.checks.some(c => c.exitCode !== 0)) throw Error('Final typecheck is incomplete');
const tests = [...suites.values()].flatMap(({ packet, suite }) => suite.assertionResults.map((test, caseIndex) => ({
  file: relative(suite.name), name: test.fullName, caseIndex, status: test.status, packet,
})));
// Parameterized undefined/null cases can share a formatted title. Preserve their
// per-file case index; latest-result selection above prevents rerun double counts.
if (new Set(tests.map(t => t.file + '\n' + t.caseIndex)).size !== tests.length) throw Error('Duplicate final test identity');
const currentName = name => name
  .replace('excludes Pipeline Proxy from GA4 report artifacts', 'excludes Pipeline Proxy from confirmed GA4 report revenue')
  .replace('keeps a newly added source pending with zero completed-day contribution', 'uses materialized sale dates, not connection dates, for a newly added source')
  .replace('completes its actual post-save recompute after prior GA4 publication', 'starts recovery after saving without synchronously publishing partial KPI values');
const match = (file, name) => tests.find(t => t.file === file && t.name === currentName(name));
const legacyFailures = read('compatibility-failure-reconciliation.json').failures.map(f => {
  const test = match(f.file, f.name);
  if (!test || test.status !== 'passed') throw Error(`Unresolved legacy identity: ${f.id}`);
  return { id: f.id, file: f.file, previousName: f.name, currentName: test.name, status: 'PASSED LOCALLY', packet: test.packet, waived: false };
});
const reproduced = new Map();
for (const packet of ['batch5-closure-baseline-verified.json', 'batch5-closure-combined.json']) {
  for (const suite of read(packet).testResults) for (const test of suite.assertionResults.filter(t => t.status === 'failed')) {
    const file = relative(suite.name), found = match(file, test.fullName);
    if (!found || found.status !== 'passed') throw Error(`Unresolved baseline failure: ${file}: ${test.fullName}`);
    reproduced.set(file + '\n' + test.fullName, { file, previousName: test.fullName, currentName: found.name, status: 'PASSED LOCALLY', packet: found.packet });
  }
}
const tracked = execFileSync('git', ['ls-files', '-z', '--', 'server', 'client/src', 'shared', 'package.json', 'package-lock.json', 'tsconfig.json', 'vitest.config.ts', 'vite.config.ts'], { cwd: root, encoding: 'utf8', windowsHide: true }).split('\0').filter(Boolean);
const manifest = tracked.filter(file => /\.(?:ts|tsx|js|cjs|mjs|json)$/.test(file)).map(file => ({ file,
  sha256: createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex'),
}));
const result = {
  at: new Date().toISOString(), baseHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8', windowsHide: true }).trim(),
  candidate: 'Local working tree; not committed or deployed', findings: ['V1-042', 'V1-043', 'V1-044', 'V1-045', 'V1-083', 'V1-109'],
  localImplementationStatus: 'COMPLETE', releaseAcceptance: 'OPEN; bounded local verification is not whole-app certification',
  totals: { files: new Set(tests.map(t => t.file)).size, tests: tests.length, passed: tests.filter(t => t.status === 'passed').length, failed: 0, skipped: 0 },
  packets: current.map(({ file, result }) => ({ file, total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests })),
  builds, finalTypecheck, legacyFailures, reproducedFailures: [...reproduced.values()], tests, manifest,
  finalAssertionCorrection: 'The combined run passed 1356/1357. The new PostgreSQL test incorrectly expected refresh-audit writes to leave durable-work rows untouched. Existing refresh-state storage intentionally invalidates/requeues this campaign on attempt/failure. Its first focused rerun exposed another fixture expectation: latest source revenue is EUR900 including today\'s EUR100, while the completed-day contribution is EUR800. The final 25/25 focused rerun verifies unchanged revenue/connection rows, unchanged neighboring work, exactly one pending recovery job, retained mapping and both amounts. No runtime code was changed for these test corrections.',
  isolation: { productionWrites: false, providerCalls: false, userBrowserAccess: false, database: '127.0.0.1:55444/ga4_alignment_test; isolated disposable schemas', browserTests: 'Separate synthetic Playwright Chromium sessions; no user profile' },
  runtimeCorrection: { file: 'server/utils/shopify-provider.ts', function: 'fetchShopifyOrderCustomerJourneyUtms',
    cause: 'Omitted/malformed requested GraphQL journey fields were coerced to null/empty attribution and could replace saved revenue with zero.',
    baseline: 'batch5-journey-before.json: 13 reproduced failures, 45 passing controls',
    focused: 'batch5-journey-after.json: 58 passed before four additional controls and PostgreSQL preservation checks in final packet',
    intendedEffect: 'Reject incomplete requested fields before preview/save/refresh replacement; preserve explicit nulls, ready=false, valid UTMs, existing tag/discount attribution and all monetary formulas.',
    providerContract: ['https://shopify.dev/docs/api/admin-graphql/2026-07/objects/CustomerJourneySummary', 'https://shopify.dev/docs/api/admin-graphql/2026-07/objects/CustomerVisit'],
  },
  limits: [
    'This run covers the 59-file Batch 5/direct financial/publication packet, not the entire repository or latest CI.',
    'No new live provider failure, consent/reconnect, refund, deletion, quota or natural native-daily-cycle observation.',
    'Prior exact-campaign f1 deployment observation is historical evidence, not deployment of this Shopify correction.',
    'No populated live saved KPI/Benchmark/scheduled-report configuration exists on the observed test campaign; delivery and whole downstream readiness remain Batch 7/8 acceptance.',
    'Existing damaged attribution cannot be inferred from a zero amount alone. No historical record was rewritten; exact provider reconciliation remains required.',
    'Other reachable platform variants have narrower structural coverage; this packet does not certify non-GA4 financial replacement or the whole app.',
  ],
};
fs.writeFileSync(path.join(__dirname, 'batch5-closure-evidence.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ ...result.totals, legacyFailuresResolved: legacyFailures.length, reproducedFailuresResolved: reproduced.size, sourceHashes: manifest.length }));
