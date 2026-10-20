// Documentation-only reconciliation. Never connects to a database/provider.
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict"), crypto = require("node:crypto");
const dir = "docs/fixes/v1-batch-1/";
const rows = [
  ["001", "Conversion route/storage: owner or current token, finite values, matching currency, date and atomic average/idempotency.", "Handler denial/invalid/zero and PostgreSQL retry/currency/revocation controls.", "Deployed sender acceptance; existing event/data inventory."],
  ["002", "Actor-filtered global reads/writes; encrypted/redacted generic credentials; unverified connection state; migration 0022.", "Real PostgreSQL owner/encryption checks; schema upgrade/reapply/fresh creation.", "Apply migration; legacy unowned/plaintext inventory."],
  ["003", "Existing campaign guard on retained LinkedIn, Trends, attribution and campaign-dependent field reads.", "Anonymous/foreign denial; owned list/static-field controls.", "Deployed auth; provider query behavior remains separate."],
  ["004", "Mandatory provider signatures/raw multipart; durable transactional replay receipts; bounded ingestion.", "Loopback valid/invalid signed delivery; concurrent database/restart-instance/deleted-metric replay.", "Real provider retries/formats, snapshot recovery and deployed configuration."],
  ["005", "Test email denied in production, authenticated and rate-limited elsewhere.", "Production/development denial before transport.", "Deployed production denial."],
  ["006", "Owned attribution APIs and existing-table persistence; sample outputs removed; calculation/deletion parent locks.", "All anonymous routes, foreign parents, real persistence/calculation/deletion races.", "Deployed ownership/restart; analytics/configuration/downstream acceptance remains open."],
  ["008", "Explicit production encryption at vault/startup; verified PostgreSQL TLS configuration.", "Missing-key/round-trip tests; actual pg configuration in three URL modes.", "Compatible existing key and hosted TLS handshake."],
  ["026", "Public HTTPS downloads with pinned DNS, validated redirects, deadline/size caps and final parent/token/sender checks.", "Private/mixed DNS, redirect/stream caps, lookup modes; PostgreSQL stale-parent/token controls.", "Valid deployed provider attachment and egress acceptance."],
  ["027", "Existing HTML/script serializers on four vulnerable popup paths.", "Exact handlers and Chromium sentinel execution with adjacent Google control.", "Successful configured OAuth callbacks."],
  ["030", "Explicit Custom Integration whitelist edits persist; publication rechecks current list.", "PostgreSQL save/reload, clear, omission and removed-sender checks.", "Deployed owner edit and signed sender acceptance."],
  ["034", "Remove shared temporary-ID exemptions; guard connect and both transfer parents.", "Ordinary/magic-ID denial controls.", "Owned draft/transfer acceptance; Batch 4 transfer defects remain."],
  ["052", "Per-actor query client; singleton consumers use provider; cancel/clear old cache; per-actor selection.", "Real query library and Chromium account-switch/late-response/sign-out cases.", "Actual deployed Clerk account switching."],
  ["053", "Caller test-flag limiter bypass restricted to NODE_ENV=test.", "Three limiter functions across environment modes; internal-refresh control.", "Deployed limiter configuration/quotas."],
  ["054", "Three retained route and storage updates preserve record/campaign identities.", "Exact valid-edit/foreign-parent payloads and real PostgreSQL identity checks.", "Deployed ownership/adjacent update acceptance."],
  ["057", "Remove bearer/body logging; redact capability paths and Ads provider errors.", "HTTP marker tests and three actual Axios/client/route controls.", "Historical exposure inventory and any separately approved rotation."],
  ["063", "Both production mock endpoints always deny; development requires campaign ownership.", "Production flag and development anonymous denial.", "Deployed production denial; provider functionality deferred."],
  ["075", "Both spend aliases guard owner; require reconciled dated/platform/currency facts and existing transaction/recompute paths.", "Route dispatch/denial; PostgreSQL atomic rollback and foreign-source checks.", "Existing damaged-data inventory; full analytics propagation remains open."],
  ["078", "LinkedIn/Meta signing uses existing fail-closed provider-purpose secret helper.", "Exact sign/verify configured/missing/tampered/expired/rotated cases.", "Configured callback/session acceptance; functional providers deferred."],
  ["088", "Ten lazy credential migrations compare original identity/plaintext and absent ciphertext.", "Ten real PostgreSQL renewed-token/stale-reader interleavings.", "Live renewal/reconnect and legacy credential inventory."],
  ["123", "Owner/client/provider/resource grants on connect and saved shared-credential hydration; GA4 save/update guard.", "15 route cases, PostgreSQL policy and three provider hydration revocation controls.", "Configure exact verified Ptomo grant; validate all deployed workers and customer denial."],
];
const indexPath = "docs/V1_RELEASE_READINESS.md";
let index = fs.readFileSync(indexPath, "utf8");
for (const [id, change, evidence, remaining] of rows) {
  const pattern = new RegExp(`^\\| V1-${id} / B1 \\|.*$`, "m");
  assert.ok(pattern.test(index), id);
  index = index.replace(pattern, `| V1-${id} / B1 | VERIFIED LOCALLY (specified boundary) | ${change} | Uncommitted | ${evidence} See [B1 evidence](fixes/v1-batch-1/README.md). | ${remaining} |`);
}
index = index.replace("Batch 1's20 items are in progress; no item is closed for release.", "Batch 1's 20 code corrections are implemented and locally checked; final verification is recorded below. No item is closed for release.");
index = index.replace("Batch 1 is IN PROGRESS.", "Batch 1 code corrections are IMPLEMENTED; the specified local boundaries are verified. Deployment/configuration/provider acceptance remains outstanding.");
index = index.replace("Batch 1 implementation and validation are authorized and in progress in the existing architecture.", "Batch 1 implementation follows the existing architecture; its exact validation and external acceptance limits are recorded above.");
fs.writeFileSync(indexPath, index);

if (fs.existsSync(dir + "full-suite-final.json")) {
  const report = JSON.parse(fs.readFileSync(dir + "full-suite-final.json", "utf8"));
  const ledger = JSON.parse(fs.readFileSync("docs/audits/v1-2026-10-19/test-failures.json", "utf8"));
  const original = new Map(ledger.map(f => [f.file + "|" + f.name, f]));
  const failures = report.testResults.flatMap(file => file.assertionResults.filter(t => t.status === "failed").map(t => {
    const relative = path.relative(process.cwd(), file.name).replaceAll("\\", "/"), previous = original.get(relative + "|" + t.fullName);
    const note = previous?.id === "TEST-d31b4e2918"
      ? "The first failing assertion now expects six recompute calls but there are seven after the corrected connector handler. The original brittle GA4/manual-branch string-order assertion is still unresolved. Both remain V1-012; Batch 1 separately executes the connector handler and asserts both recompute dispatches."
      : previous?.id === "TEST-6d4794df4c"
        ? "The source-slice end marker remains missing; only the character offset changed as the storage file grew."
        : undefined;
    return { id: previous?.id || "NEW-" + crypto.createHash("sha256").update(relative + "|" + t.fullName).digest("hex").slice(0, 10),
      file: relative, name: t.fullName, status: "OPEN", finding: previous?.finding || "BATCH1-REGRESSION",
      classification: previous?.classification || "UNCLASSIFIED_NEW_FAILURE", reason: previous?.reason || "Requires investigation",
      firstFailure: t.failureMessages[0]?.split("\n")[0], matchedOriginal: !!previous, currentEvidenceNote: note };
  }));
  const candidate = JSON.parse(fs.readFileSync(dir + "candidate-files.json", "utf8"));
  for (const [file, expected] of Object.entries(candidate.hashes))
    assert.equal(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), expected, `Candidate changed: ${file}`);
  const summary = { at: new Date().toISOString(), base: candidate.head,
    revision: "uncommitted Batch 1", tests: report.numTotalTests, passed: report.numPassedTests, failed: report.numFailedTests,
    skipped: report.numPendingTests, files: report.testResults.length, newFailures: failures.filter(f => !f.matchedOriginal).length,
    waived: 0, closed: 0, boundary: "All failures retained OPEN. Matching original failures does not make the suite pass or waive their requirements.",
    failures };
  fs.writeFileSync(dir + "failure-reconciliation.json", JSON.stringify(summary, null, 2) + "\n");
  assert.equal(summary.skipped, 0, "Required database suites must run");
  assert.equal(summary.newFailures, 0, "New failures require investigation");
  assert.equal(failures.length, report.numFailedTests);
  console.log(JSON.stringify({ tests: summary.tests, passed: summary.passed, failed: summary.failed, skipped: summary.skipped, newFailures: summary.newFailures }));
} else console.log("Progress updated; final suite not yet available.");
