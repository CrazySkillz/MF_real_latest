// Scope overlay only: preserves every original test result/classification and waives none.
const fs = require('node:fs'), assert = require('node:assert/strict');
const dir = 'docs/audits/v1-2026-10-19/';
const failures = JSON.parse(fs.readFileSync(dir + 'test-failures.json', 'utf8'));
const conditional = new Map([
  ['TEST-1cd5292f9d', 'Instagram-only wizard finalization expects setWizardStep(5); current main-platform whitelist excludes Instagram. Provider-functional expectation deferred, conditional on effective API/job/shared-data exclusion.'],
  ['TEST-38efd9dbb2', 'Instagram card-shell/import-string assertion concerns a card filtered out by the current GA4-only hub. Future provider UI acceptance deferred; direct route/API access remains separately required.'],
]);
const specific = new Map([
  ['TEST-649cf82c47', 'Test requires confirmation Back to jump to step2. Current AGENTS requires the immediately previous step; current isolated GA4 browser evidence proves the previous-step chain. Reconcile the assertion with the current shared wizard contract, not provider exclusion.'],
  ['TEST-c8cd8ff662', 'Failing assertion is shared campaign-query invalidation using draftCampaignId inside an old handler slice. Current finishCampaignCreation(createdId), campaigns.tsx:551-568, awaits those invalidations. Preserve the shared invariant; reconcile extraction/argument identity.'],
  ['TEST-0d82f4fdfd', 'Despite Instagram test name, failed assertion is shared campaign connected-platform query invalidation. Current finishCampaignCreation(createdId) centralizes it. Preserve shared activation/refresh acceptance.'],
  ['TEST-e4a1d5f707', 'Google Ads/shared storage financial context contract remains in scope; mention of LinkedIn does not exclude it.'],
  ['TEST-1ab264f494', 'Shared Meta/Google Ads Spend edit source-identity contract; Google Ads and exact-source mutation boundaries remain in V1.'],
]);
const affected = failures.filter(f => /linkedin|instagram|meta-|tiktok/i.test(f.file) || /\b(?:LinkedIn|Instagram|Meta|TikTok)\b/i.test(f.name));
assert.equal(affected.length, 24);
const affectedIds = new Set(affected.map(f => f.id));
for (const id of [...conditional.keys(), ...specific.keys()]) assert.ok(affectedIds.has(id), id);
const rows = failures.map(f => ({
  id: f.id, file: f.file, line: f.line, name: f.name, originalClassification: f.classification, originalStatus: f.status,
  scopeDisposition: conditional.has(f.id) ? 'DEFERRED_FUNCTIONAL_EXPECTATION_IF_ISOLATED' : affectedIds.has(f.id) ? 'RETAIN_SHARED_OR_REACHABLE_BOUNDARY_GATE' : 'UNCHANGED_V1_REVIEW',
  reason: conditional.get(f.id) || specific.get(f.id) || (affectedIds.has(f.id) ? 'Current assertion covers retained route, simulation, scope, shared financial or aggregate behavior. No waiver inferred from provider name; effective exclusion or exact retained-boundary acceptance remains required.' : 'No scope waiver from the four-provider clarification. Preserve the original failure mechanism and required investigation.'),
  waived: false,
}));
const counts = rows.reduce((sum, row) => { sum[row.scopeDisposition] = (sum[row.scopeDisposition] || 0) + 1; return sum; }, {});
assert.equal(rows.length, 182); assert.equal(rows.filter(r => r.waived).length, 0);
fs.writeFileSync(dir + 'test-failure-scope.json', JSON.stringify({ head: '777aae6f6353e998d60b635d3e66b413093117c2', recordedAt: new Date().toISOString(), counts, affectedAssertionsReviewed: affected.length, totalFailures: rows.length, waivedFailures: 0, boundary: 'Audit scope overlay, not a test run or fix. Two provider-only UI expectations conditionally deferred;22 provider-named assertions retain shared/reachable safety gates. Other158 preserve original classification. Current full suite remains182 failed.', rows }, null, 2) + '\n');
console.log(JSON.stringify({ counts, totalFailures: rows.length, waivedFailures: 0 }));
