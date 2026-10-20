# Remaining fixture and binding failure diagnoses

Current runtime and original tests are unchanged. [Stable original failure ledger](test-failures.json), [exact additional61-ID mapping](additional-test-root-causes.json). The authoritative full result remains3,789pass/182fail. This packet does not waive failures or relabel the application test suite green.

## Bindings and active campaign fixtures

[Three audit-only copies](binding-fixture-preparation.json) preserve all original assertions. The actual `getInternalGA4RefreshWriteInput` from `server/internal-request-auth.ts` is bound into the extracted published-reader handlers; no security stub replaces it. Its absent scope header legitimately returns the ordinary request options. Both CRM automation fixtures add `status:"active"` to their synthetic intended eligible campaign, satisfying the current exact `filterActiveSchedulerCampaigns` predicate.

[Run](binding-fixture-results.json):36tests,35pass,1fail. All eight original `FIXTURE_BINDING` failures and two original scheduler `FIXTURE_CONTRACT` failures pass. The remaining Salesforce itemization assertion is an original `STRUCTURAL_ASSERTION`, still failing because its expected source string differs. It remains in the84 source-structure/extraction failures; it is not dismissed by successful scheduler cases.

## Transaction fixtures

[Nine audit-only copies](transaction-fixture-preparation.json), [preparer](prepare-transaction-fixture-diagnostics.cjs), [run](transaction-fixture-results.json):54tests,54pass. They cover all50 originally failing assertions in the following nine files:

- CSV Revenue transaction rollback:5.
- Overview Spend transaction replacement:4.
- Revenue source deletion:4.
- Google Ads child Spend disconnect:5.
- Sheets Revenue disconnect:5.
- Sheets Spend disconnect:4.
- KPI persistence/destructive safety:5.
- Benchmark persistence/destructive safety:5.
- Benchmark history idempotency:13.

Current storage1256 first selects/locks parent campaigns; prior mocks omit the new query chain. KPI/Benchmark delete5920/6206 and history6276 first resolve the parent outside the transaction; prior mocks omit `db.select`. Current history also applies publication-version reads. The copies supply those explicit missing operations while keeping original synthetic records, rollback failures, foreign-campaign/sibling preservation, notification boundaries, exact history-scope/date matching and idempotency assertions unchanged.

The added fixtures model **an existing campaign and no durable work table**, an explicit current compatibility branch. They do not manufacture a passing durable lease or publication-version result. The Benchmark-history mock intercepts the publication-table query separately and retains its original advisory-lock contention model. No assertion is removed or weakened. They are diagnostic tests, not real PostgreSQL transaction/lease proofs. The independent real PostgreSQL cases in the main record remain authoritative for their respective boundaries, including the confirmed missing-parent ordinary-write defect.

## Complete disposition of the original mechanism classes

| Original classification | Count | Current disposition |
|---|---:|---|
| BEHAVIOR_ASSERTION_WITH_INCOMPLETE_FIXTURE |37|All37 map to passing audit copies;108 assertions total in [first diagnostic record](GA4_FAILED_TEST_ROOT_CAUSES.md). |
| FIXTURE_BINDING |8|All8 map to passing current-helper copies above. |
| FIXTURE_CONTRACT |53|50 transaction assertions above,2 active-campaign automation assertions above,1 notification PostgreSQL fixture in [validation](VALIDATION.md). Each has a successful bounded diagnostic. |
| STRUCTURAL_ASSERTION |74|All retained, classified individually; require current-path semantic replacement or confirmed runtime repair after agreement. Source-text mismatch alone is neither proof of a product regression nor proof of safety. |
| SOURCE_EXTRACTION |10|All retained; replace stale extraction boundaries with current registered-handler/function extraction and keep intended safety checks. |

Thus98 original failures have successful diagnostic evidence for missing fixture/binding contracts;84 still require source-assertion maintenance or underlying semantic repair. These are **not** “98 fixed tests”: original test files were not edited and the full suite was not rerun after a runtime fix.

Sandbox initially prevented the new test runner's child process (`spawn EPERM`); the same isolated run then completed after automatic approval. Database URLs were cleared; no production/provider/email operation occurred. The diagnostic packet overlaps original and earlier tests and is not counted as new distinct application coverage.
