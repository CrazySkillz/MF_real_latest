// One-shot evidence writer. Does not run the application, load .env or contact providers.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const read = name => JSON.parse(fs.readFileSync(path.join(__dirname, name), 'utf8'));
const write = (name, value) => {
  const target = path.join(__dirname, name);
  // Resume a partially written packet only if its existing evidence is identical.
  if (fs.existsSync(target)) {
    if (JSON.stringify({ ...read(name), at: undefined }) !== JSON.stringify({ ...value, at: undefined })) throw new Error(`Evidence changed: ${name}`);
    return;
  }
  fs.writeFileSync(target, JSON.stringify(value, null, 2) + '\n', { flag: 'wx' });
};
const previous = JSON.parse(fs.readFileSync('docs/fixes/v1-batch-3/validation-2026-10-22-timeouts/failure-reconciliation.json', 'utf8'));
const relative = file => file.replaceAll('\\', '/').replace(/^.*\/server\//, 'server/');
const identity = (file, name) => `${file}|${name}`;
const known = new Map(previous.failures.map(f => [identity(f.file, f.name), f]));
const full = read('full-suite-final.json');
const totals = r => ({ total: r.numTotalTests, passed: r.numPassedTests, failed: r.numFailedTests, skipped: r.numPendingTests });
const failures = full.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const file = relative(s.name), prior = known.get(identity(file, t.fullName));
  return { ...prior, file, name: t.fullName, error: t.failureMessages.join('\n'), status: 'FAILED; OPEN', waived: false, newFailingIdentity: !prior };
}));
const suiteErrors = full.testResults.filter(s => s.status === 'failed' && !s.assertionResults.some(t => t.status === 'failed'));
if (failures.some(f => f.newFailingIdentity) || suiteErrors.length || full.numPendingTests) throw new Error('Unreconciled final failure or skipped test');
const beforeFinal = read('full-suite.json');
const passed = new Set(full.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'passed').map(t => identity(relative(s.name), t.fullName))));
const correctedIntermediateFailures = beforeFinal.testResults.flatMap(s => s.assertionResults.filter(t => t.status === 'failed').map(t => {
  const file = relative(s.name), key = identity(file, t.fullName);
  if (known.has(key)) return null;
  return { file, name: t.fullName, passedInFinal: passed.has(key), classification: file.includes('financial-refresh-integration') ? 'EXPECTED_FAILURE_PROPAGATION_CHANGED' : 'INCOMPLETE_HTTP_FIXTURE',
    correction: file.includes('financial-refresh-integration')
      ? 'Owned discovery errors now reject instead of returning a partial-success summary. The assertion still requires no fallback connection or provider request.'
      : 'Failure mocks omitted Response.status. Added the actual 400/401/403/429 status; the quota case also supplies Retry-After=60 and requires one request plus the bounded transient error. Existing auth, attribution, metric fallback and saved-value assertions remain.' };
})).filter(Boolean);
if (correctedIntermediateFailures.some(f => !f.passedInFinal)) throw new Error('Intermediate regression remains unresolved');
write('failure-reconciliation.json', { at: new Date().toISOString(), fullSuiteCheckpoint: totals(full), intermediateFullSuite: totals(beforeFinal),
  newFailingIdentities: [], suitesFailingWithoutFailedAssertions: [], correctedIntermediateFailures,
  resolvedSincePrevious: previous.failures.filter(f => passed.has(identity(f.file, f.name))).map(f => ({ id: f.id, file: f.file, name: f.name })),
  failuresByClassification: failures.reduce((out, f) => { out[f.classification || 'UNCLASSIFIED'] = (out[f.classification || 'UNCLASSIFIED'] || 0) + 1; return out; }, {}),
  failures, boundary: 'Final full suite ran after all runtime and test edits. No remaining failure is waived. Separate CI-only failure TEST-f323e48c9f remains open under V1-012/Batch 8.' });
const extraTests = ['server/v1-batch3-provider-timeouts.test.ts', 'server/v1-batch3-google-ads-timeouts.test.ts',
  'server/v1-batch3-shared-cancellation.test.ts', 'server/v1-batch3-ga4-quality-concurrency.test.ts', 'server/v1-batch3-property-requests-postgres.test.ts'];
const files = [...new Set([...execFileSync('git', ['diff', '--name-only', '--', 'server/'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split(/\r?\n/), ...extraTests])].sort();
const hash = data => crypto.createHash('sha256').update(data).digest('hex');
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
write('candidate-manifest.json', { at: new Date().toISOString(), baseHead: head, state: 'uncommitted; not pushed or deployed',
  files: files.map(file => { const data = fs.readFileSync(file); return { file, sha256: hash(data), lfSha256: hash(data.toString('utf8').replace(/\r\n/g, '\n')) }; }) });
const focusedFiles = files.filter(file => file.endsWith('.test.ts'));
const changedTests = full.testResults.filter(s => focusedFiles.includes(relative(s.name)));
const checks = changedTests.flatMap(s => s.assertionResults);
write('assessment.json', { at: new Date().toISOString(), baseHead: head,
  findings: ['V1-011', 'V1-025', 'V1-089', 'V1-090'], fixStatus: 'VERIFIED LOCALLY', releaseAcceptance: 'OPEN',
  result: 'All four remaining Batch 3 corrections implemented and verified within the documented local boundaries. All ten Batch 3 release acceptances and V1 NO-GO remain open.',
  runtimeFiles: files.filter(file => !file.endsWith('.test.ts') && !file.includes('/test-support/')),
  testFiles: focusedFiles, processWorker: 'server/test-support/ga4-recovery-process-worker.ts',
  reproducedBefore: Object.fromEntries(['cancellation-before', 'quality-concurrency-before', 'recovery-before', 'financial-reply-before'].map(label => [label, totals(read(`${label}.json`))])),
  focusedCheckpoint: totals(read('final-targeted.json')), processRecoveryCheckpoint: totals(read('process-recovery.json')),
  finalFullSuite: totals(full), changedTestFilesInFinalSuite: { files: changedTests.length, total: checks.length, passed: checks.filter(t => t.status === 'passed').length, failed: checks.filter(t => t.status === 'failed').length, skipped: checks.filter(t => t.status === 'pending').length },
  unresolvedFailures: failures.length, newFailingIdentities: 0, typecheckAndServerBuild: read('final-build-checks.json'),
  clientBuild: 'No client source edits; passing production client build retained in ../validation-2026-10-22-timeouts/build-checks.json.',
  intermediateDiagnostics: [
    'cancellation-after: one obsolete exact-source assertion updated to require the callback and forwarded signal; behavior tests retained.',
    'quality-concurrency-first: six metadata errors were retried through acquisition dimension fallback; propagation corrected and all flags now fail closed.',
    'recovery-first: one actual regression serialized native campaigns; restored two-worker processing. Three fixtures corrected for consistent daily totals, supported-source eligibility and actual source-add invalidation.',
    'final-focused: three extracted nested Sheets helpers retained CRLF blank lines; normalized extraction only, retaining timeout/body/caller-cancellation assertions.',
    'first-build-checks: corrected Set iteration for project target and pg query_timeout config typing; final TypeScript passes.',
    'full-suite intermediate: 11 additional failures corrected as individually listed in failure-reconciliation.json; no safety assertions skipped.'
  ],
  localProof: [
    'Scheduled/manual/recovery dispatch uses existing durable leases for integrated GA4 financial sources; no duplicate ordinary refresh. Exact mapping/credential/source generation checks remain in storage transactions.',
    'Real process termination at financial, derived and completion boundaries replays one exact CSV record and preserves the other campaign; provider-specific route and PostgreSQL fences tested separately.',
    'LinkedIn shared timeout propagates cancellation and waits for already-started writes to settle; no later stage/write starts after cancellation. Deferred provider functionality remains deferred.',
    'Three nested Sheets helpers and retry request retain deadlines through body parsing and caller cancellation.',
    'One property admits at most five requests through complete response bodies. Twenty-five callers, five Insights readers/60 channel requests, queued aborts, distinct properties, database loss and six separate workers exercised.',
    'Transaction advisory locks pin checked-out database connections until completion, including transaction-pooled deployments; actual hosted pooler behavior remains a deployment check.',
    'Six provider quality flags fail closed across twelve current report methods. Flagged native refresh stages preserve previous published data and skip downstream snapshots/goals/alerts; unflagged zero remains zero.'
  ],
  remaining: ['Commit/review and deploy this candidate, then verify the deployed revision/configuration.',
    'Actual provider permissions, quotas, quality flags, reconnect/retry/recovery and full customer UI/output acceptance; new candidate has no live acceptance evidence.',
    'Inventory existing provider-flagged historical values before any targeted correction; metadata was previously discarded and cannot be reconstructed by guessing.',
    '180 individually recorded local failures, separate CI-only failure, Batches 4-8 and all whole-app release gates.'],
  safety: { applicationCredentialsRemoved: true, externalHttpBlockedInTestRunner: true, onlyLocalhostFixtureDatabases: true, productionQueries: false, productionWrites: false, ptomoChanged: false,
    providerAcceptance: false, uiAcceptance: false, migrationsAdded: false, committed: false, pushed: false, deployed: false },
  limits: ['A provider may continue server-side computation after the local request is aborted.',
    'An already-started retained LinkedIn database write may finish before cancellation settles; this patch prevents detached continuation, not transactional rollback of that deferred provider job.',
    'The five-slot limit covers updated app workers sharing this database; older deployed workers and other applications using the property are outside the guard.',
    'Provider quality flags are conservatively unavailable; threshold/other-row metadata does not prove every returned value is incorrect.',
    'Initial-import eligibility remains native-only. No deferred platform was enabled, no historical data was rewritten, and no whole-source or V1 certification is claimed.'] });
console.log(JSON.stringify({ full: totals(full), unresolved: failures.length, newFailures: 0, correctedIntermediateFailures: correctedIntermediateFailures.length, candidateFiles: files.length }));
