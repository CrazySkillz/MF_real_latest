// Validate and hash the completed local evidence. No application/network access.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto"), assert = require("node:assert/strict");
const dir = "docs/fixes/v1-batch-1/";
const read = name => JSON.parse(fs.readFileSync(dir + name, "utf8"));
const hash = file => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const candidate = read("candidate-files.json"), suite = read("full-suite-final.json"), targeted = read("current-targeted.json"), failures = read("failure-reconciliation.json");
const onboarding = fs.existsSync(dir + "onboarding-candidate.json") ? read("onboarding-candidate.json") : null;
const databaseGrants = fs.existsSync(dir + "database-grants-candidate.json") ? read("database-grants-candidate.json") : null;
const currentHashes = { ...candidate.hashes, ...onboarding?.hashes, ...databaseGrants?.hashes };
for (const [file, expected] of Object.entries(currentHashes)) assert.equal(hash(file), expected, file);
if (onboarding) {
  const current = read("onboarding-targeted.json"), browser = read("onboarding-after.json");
  assert.equal(current.numPassedTests, 138); assert.equal(current.numFailedTests, 0); assert.equal(current.numPendingTests, 0);
  assert.equal(browser.results.length, 13); assert.ok(browser.results.every(row => row.result === "PASS"));
}
if (databaseGrants) {
  const current = read("database-grants-targeted.json"), postgres = read("database-grants-postgres.json"), full = read("database-grants-failure-reconciliation.json");
  assert.equal(current.numPassedTests, 141); assert.equal(current.numFailedTests, 0); assert.equal(current.numPendingTests, 0);
  assert.equal(postgres.results.length, 34); assert.ok(postgres.results.every(row => row.result === "PASS"));
  assert.equal(full.newFailures, 0); assert.equal(full.failed, 182); assert.equal(full.skipped, 0);
}
assert.equal(targeted.numPassedTests, 137); assert.equal(targeted.numFailedTests, 0); assert.equal(targeted.numPendingTests, 0);
assert.equal(suite.numTotalTests, 4088); assert.equal(suite.numPassedTests, 3906); assert.equal(suite.numFailedTests, 182); assert.equal(suite.numPendingTests, 0);
assert.equal(failures.newFailures, 0); assert.equal(failures.failures.length, 182);
assert.ok(failures.failures.every(row => row.status === "OPEN" && row.matchedOriginal));
const original = JSON.parse(fs.readFileSync("docs/audits/v1-2026-10-19/test-failures.json", "utf8"));
const originals = new Map(original.map(row => [row.id, row]));
const changedMessages = failures.failures.filter(row => row.firstFailure !== originals.get(row.id)?.firstFailure);
for (const row of changedMessages) assert.ok(row.currentEvidenceNote, `Changed failure needs review: ${row.id}`);
for (const [file, expected] of [["postgres-after.json", 23], ["browser-after.json", 7]]) {
  const result = read(file); assert.equal(result.results.length, expected); assert.ok(result.results.every(row => row.result === "PASS"));
}
assert.equal(read("service-accounts-after.json").results.length, 15);
const logResults = read("provider-logs-after.json").results;
assert.equal(logResults.length, 3);
assert.ok(logResults.every(row => !row.credentialMarkersInLogs.accessToken && !row.credentialMarkersInLogs.developerToken));
const index = fs.readFileSync("docs/V1_RELEASE_READINESS.md", "utf8");
assert.equal((index.match(/^\| V1-\d{3} \/ B1 \| VERIFIED LOCALLY/gm) || []).length, 20);
assert.equal((index.match(/^\| V1-\d{3} \| P[012] \//gm) || []).length, 130);
assert.ok(!fs.existsSync("C:/Users/me/AppData/Local/Temp/mf-v1-migration-audit-20261020/postmaster.pid"), "Fixture must be stopped");
const artifactFiles = fs.readdirSync(dir).filter(file => file !== "verification.json").map(file => dir + file)
  .filter(file => fs.statSync(file).isFile()).concat(["docs/V1_RELEASE_READINESS.md", "docs/CURRENT_APP_SECTIONS.md", "docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md"]);
const result = {
  at: new Date().toISOString(), baseHead: candidate.head, revision: "Batch 1 and both follow-ups pushed as 4522f83486a28ebbf1fe6152f1053fdc83565223; live activation is separately recorded in DATABASE_GRANTS.md and database-grants-live-health.json",
  scope: { implemented: 20, locallyVerified: "Specified boundaries in README and index, not whole-path or release certification", closedForRelease: 0 },
  commands: [
    { command: "node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=docs/fixes/v1-batch-1/full-suite-final.json", exit: 1, tests: 4088, passed: 3906, failed: 182, skipped: 0 },
    { command: "Vitest eight targeted files listed in current-targeted.json --maxWorkers=2", exit: 0, tests: 137, passed: 137 },
    { command: "node server/v1-batch1-postgres-regression.cjs", exit: 0, checks: 23 },
    { command: "node server/v1-batch1-browser-regression.cjs", exit: 0, checks: 7 },
    { command: "node server/v1-batch1-provider-log-regression.cjs", exit: 0, checks: 3 },
    { command: "node server/v1-batch1-service-account-regression.cjs", exit: 0, checks: 15 },
    { command: "node node_modules/typescript/bin/tsc --noEmit", exit: 0 },
    { command: "npm run build", exit: 0 },
    { command: "git diff --check (repository default line-ending configuration)", exit: 0 },
    { command: "pg_ctl -D isolated mf-v1-migration-audit-20261020 -m fast stop", exit: 0 },
  ],
  commandEvidence: "Exit statuses observed in execution tools; JSON reports/logs linked and hashed. This script validates evidence but does not rerun those commands.",
  failures: { originalMatched: 182, newIdentities: 0, changedFirstMessagesReviewed: changedMessages.map(row => row.id), waived: 0, closed: 0 },
  liveApplicationOrProvidersUsed: false, testDatabaseStopped: true, releaseDecision: "NO-GO",
  candidateHashes: candidate.hashes,
  currentCandidateHashes: currentHashes,
  onboardingFollowup: onboarding ? {
    candidate: "onboarding-candidate.json", runtimeChangedLines: 3,
    validation: { focusedPassed: 138, focusedFailed: 0, focusedSkipped: 0, browserAndHandlerChecksPassed: 13, typecheckExit: 0, buildExit: 0 },
    boundary: "Synthetic identities/providers/storage and loopback Chromium. No live Google consent or database/provider mutation. Initial full-suite/PostgreSQL results above were not rerun for this frontend-only follow-up; all 182 recorded full-suite failures remain open.",
  } : null,
  databaseGrantsFollowup: databaseGrants ? {
    candidate: "database-grants-candidate.json", reconciliation: "database-grants-failure-reconciliation.json",
    validation: { focusedPassed: 141, focusedFailed: 0, postgresChecksPassed: 34, typecheckExit: 0, buildExit: 0 },
    boundary: "Exact storage methods and deployment runner in isolated PostgreSQL; current full suite reconciled separately. Hosted database deployment and live application revision are recorded separately in DATABASE_GRANTS.md. No provider acceptance is inferred.",
  } : null,
  artifactHashes: Object.fromEntries(artifactFiles.sort().map(file => [file, hash(file)])),
};
fs.writeFileSync(dir + "verification.json", JSON.stringify(result, null, 2) + "\n");
for (const file of ["docs/V1_RELEASE_READINESS.md", dir + "README.md", "docs/audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md"]) {
  for (const match of fs.readFileSync(file, "utf8").matchAll(/\]\(([^)]+)\)/g)) {
    const target = match[1].replace(/^<|>$/g, "").split("#")[0].replace(/:\d+$/, "");
    if (!target || /^(https?:|app:)/.test(target)) continue;
    assert.ok(fs.existsSync(path.resolve(path.dirname(file), target)), `${file}: ${target}`);
  }
}
console.log(JSON.stringify({ candidateFiles: Object.keys(currentHashes).length, artifacts: artifactFiles.length, findings: 130, batch1Implemented: 20, fullSuiteFailuresOpen: 182, onboardingFollowup: Boolean(onboarding), links: "PASS", fixture: "STOPPED" }));
