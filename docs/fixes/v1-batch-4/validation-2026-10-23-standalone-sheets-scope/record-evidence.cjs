const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const baseHead = process.argv[2];
if (!/^[a-f0-9]{40}$/.test(baseHead || '')) throw new Error('Pass the verified git HEAD');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const normalized = file => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
const candidateFiles = ['server/routes-oauth.ts', 'client/src/pages/google-sheets-data.tsx',
  'server/v1-batch4-standalone-sheets-scope.test.ts', 'server/v1-batch4-standalone-sheets-browser.test.ts', 'server/google-sheets-aggregate-source.test.ts'];
const runs = ['baseline', 'fixed', 'final', 'verified', 'browser-recovery', 'complete'].map(label => {
  const result = read(`${label}.json`);
  return { label, total: result.numTotalTests, passed: result.numPassedTests, failed: result.numFailedTests, skipped: result.numPendingTests,
    failures: result.testResults.flatMap(file => file.assertionResults.filter(test => test.status === 'failed').map(test => ({
      file: path.relative(process.cwd(), file.name).replace(/\\/g, '/'), name: test.fullName,
      firstFailure: test.failureMessages[0].split('\n')[0],
      classification: file.name.endsWith('standalone-sheets-browser.test.ts') ? 'Confirmed frontend fallback; fixed and browser-retested'
        : file.name.endsWith('standalone-sheets-scope.test.ts') ? 'Confirmed current route scope/mapping defect; fixed and handler-retested'
          : test.fullName.includes('spend totals') ? 'TEST-6d4794df4c: obsolete comment delimiter; replaced with next registered route, all assertions retained'
            : 'Old source-text assertion for changed row-filter expression; updated alongside behavioral regression tests',
      waived: false,
    }))),
  };
});
const assessment = {
  at: new Date().toISOString(), baseHead,
  state: 'Local working-tree candidate; not committed, pushed or deployed', finding: 'V1-051', fixStatus: 'IN PROGRESS', releaseAcceptance: 'OPEN',
  scope: 'Exact standalone Sheets dataset/campaign read scope, dependent conversion input scope and rendered-page recovery/tab switching',
  candidate: candidateFiles.map(file => ({ file, sha256LF: crypto.createHash('sha256').update(normalized(file)).digest('hex') })),
  runs, builds: read('verified-build-checks.json'),
  execution: {
    initialStartup: 'before.log: sandbox spawn EPERM before any tests; retried with child-process permission using the same isolated runner',
    storage: 'In-memory fixture boundaries, no database startup or connections',
    provider: 'Fetch fixtures only; external process networking blocked by local-network-only.cjs; browser routes locally fulfilled/blocked',
    productionOrPtomoAccess: false, credentialsLoaded: false, schemaOrSchedulerChange: false,
    browserBoundary: 'Actual page/query/selection/error/placeholder code and dialog opening/cancellation; mapping editor body/auth/setup isolated',
  },
  correctedExistingTest: { id: 'TEST-6d4794df4c', finding: 'V1-012', status: 'PASS in current targeted packet only',
    change: 'Source slice ends at next registered spend-to-date route instead of removed comment; retains all scope, eligible-source, totals and provenance assertions' },
  stillOpen: ['V1-051 complete bounded range reads, cache completeness/freshness and aggregate publication',
    'V1-108/112/113/114 zero availability, formulas, goal/report parity and scheduled report scope/date windows',
    'Real save-mappings/delete/reconnect transactions and lifecycle races; separate save-mappings conversion branch',
    'Provider OAuth, token refresh and deployed authenticated acceptance',
    'Historical damaged-data inventory/cleanup, whole-suite and CI certification'],
  historicalFullSuite: { total: 4488, passed: 4309, failed: 179, date: '2026-10-22', supersededByThisTargetedPacket: false },
};
if (runs.at(-1).failed || runs.at(-1).skipped || assessment.builds.checks.some(check => check.exitCode !== 0)) throw new Error('Final validation failed');
fs.writeFileSync(path.join(__dirname, 'assessment.json'), JSON.stringify(assessment, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ tests: runs.at(-1).total, passed: runs.at(-1).passed, candidateFiles: candidateFiles.length, finding: assessment.finding, fixStatus: assessment.fixStatus }));
