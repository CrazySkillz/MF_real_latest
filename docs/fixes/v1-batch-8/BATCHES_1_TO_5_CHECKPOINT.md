# Batches 1–5: consolidated acceptance checkpoint, October 27

All **74 original findings have recorded forward fixes**. The current complete local regression command passes **6,548/6,548 tests**. This closes the current automated regression failure; it does **not** complete all five batches' production acceptance. The original finding records retain their exact root causes, changed files, negative cases and limitations. No finding is silently certified by this checkpoint.

This is a consolidation of the existing queue, not a new audit or a new set of 74 defects. Read this checkpoint before repeating older pending-test or deployment instructions. Historical failure counts, uncommitted statements and pending deployments in earlier dated packets are not current status.

## Fixed inventory and evidence

| Batch | Original findings | Current implementation status | Remaining acceptance categories |
|---|---:|---|---|
| [1: Authorization and ingestion](../v1-batch-1/README.md) | 20 | Recorded fixes deployed; current regressions pass | Real identities/grants, signed provider ingestion, credential/log history and operational compatibility |
| [2: Startup and campaign lifecycle](../v1-batch-2/README.md) | 14 | Recorded fixes deployed; isolated startup/transaction/browser cases pass | Real customer consent/reconnect, controlled deployed recovery and historical seed disposition |
| [3: Native GA4 contracts](../v1-batch-3/README.md) | 10 | Recorded fixes deployed; recovery, query-quality, precision and concurrency cases pass | Provider reconciliation, hosted quotas/pooling, uncovered downstream/lifecycle acceptance |
| [4: Files, Sheets and Custom](../v1-batch-4/README.md) | 24 | Recorded fixes deployed; current import/storage/browser regressions pass | Each retained source's provider/selection/date/currency and complete lifecycle/downstream evidence; historical provenance |
| [5: CRM and commerce](../v1-batch-5/README.md) | 6 | Recorded fixes deployed; provider-envelope, identity, amount/stage and proxy cases pass | Independent HubSpot/Salesforce/Shopify live configuration, reconciliation, recovery and uncovered downstream evidence |

[Machine-readable inventory](validation-2026-10-27-batches-1-5/finding-inventory.json) enumerates every ID exactly once (20 + 14 + 10 + 24 + 6), preserves its detailed record and fingerprints the tested source. Text matches to finding IDs are only a navigation index; absence or presence of such a match is not a coverage judgment.

## The one current regression correction

Hosted CI on `49202eaf` ran 6,548 cases with one failure. `server/ga4-auto-refresh-regression.test.ts` expected the former inline `getAutoRefreshSchedulerStatus()` expression. The already-deployed health correction captures that result once and returns it using object shorthand. The failing assertion checked obsolete spelling, not incorrect runtime behaviour.

The test now verifies that capture and response field. The actual health-handler regression tests continue to verify healthy/degraded behaviour. No production application file, formula, source mapping, schema, credential, scheduler or report path changes in this packet.

- Before: 26/27 focused checks pass; exact stale assertion fails.
- After: **111/111** focused checks pass across the related scheduler/publication tests.
- Full `npm run test:current-version`: **6,548/6,548**, no blocking or deferred failures.
- Isolated PostgreSQL fixtures are empty afterward, the local instance stops successfully, and tracked-file hashes are unchanged throughout the run.
- [Compact receipt](validation-2026-10-27-batches-1-5/validation-summary.json) binds the full execution/log hashes and tested source manifest. Hosted CI for the new test-only correction remains pending until submission and a completed run; the failed hosted base run is retained in [its receipt](validation-2026-10-27-batches-1-5/hosted-ci.json).

## Current deployed and persisted checks

[Anonymous deployment receipt](validation-2026-10-27-batches-1-5/public-deployment.json), October 27 at 14:43 UTC:

- Render serves `49202eaf`; the Batch 1–5 implementation ancestry is present.
- All five inspected anonymous protected GETs return 401.
- The compiled public Clerk publishable-key mode is **test**. This was previously recorded as Development mode on October 21; it is still an outstanding production-identity configuration gate, not a newly introduced regression. No key or secret is included in the receipt. Switching identity instances requires an owner/account migration decision, not an unreviewed key replacement.

[Production metadata receipt](validation-2026-10-27-batches-1-5/persisted-boundaries-final.json), October 27 at 14:46 UTC, was obtained through verified TLS and an explicitly checked `REPEATABLE READ READ ONLY` transaction, followed by rollback. It imports no application module and performs no provider call, credential decryption or cleanup.

- Required owner columns/tables/precision contracts are present; no invalid/unready indexes were found.
- 36 campaigns: no missing owners, missing non-null client parents or owner/client mismatches.
- 38 inspected active connections with valid campaign parents: encrypted-token fields present, no plaintext-token fields present. This does not prove decryption compatibility or provider renewal.
- All 605 revenue records have a surviving campaign/source, matching source campaign/currency, and the inspected date shape. This does not independently prove the provider amount or sale date.
- No duplicate daily keys in the four inspected daily tables; no orphan GA4 refresh work.
- Earlier user evidence already accepted the ABN native + HubSpot + Salesforce total of **EUR 8,003.96** and separate **EUR 3,200** proxy. That bounded acceptance is not being repeated or expanded to every source/account.

## Existing records: bounded disposition, no silent cleanup

The inventory also finds 3,642,664 spend rows without a matching source (within 3,642,697 total); 2,383,107 lack a campaign. These counts overlap. They are not new writes from this read-only check. Of these, 3,267,568 carry the retired LinkedIn-daily backfill source fingerprint, matching the October 21 inventory. Four unowned demo-fingerprint metrics also match that earlier inventory. Fingerprints do not establish every row's historical origin.

Current spend-total/breakdown readers in `server/storage.ts` require an active, matching campaign/platform source via an inner join. The daily-financial route and trend snapshot use the same source boundary; the trend route's additional read is restricted to IDs from the guarded total reader. The other direct spend reads are scoped source-deletion/count operations. Therefore unmatched legacy rows are excluded from these traced financial readers. The sole runtime caller of `getMetrics` supplies the authenticated owner, excluding the four unowned metrics from that API. These traces do not prove all historical outputs were correct.

Orphan connection metadata remains: 14 GA4, 120 Sheets and one HubSpot row; no orphan Ads/Salesforce/Shopify connections were found. The Sheets token scheduler enumerates surviving active campaigns before their connections. The prior [deletion verification](DEPLOYED_VERIFICATION_997F1C39.md) proves its stated GA4/report boundaries. This checkpoint does **not** certify every possible consumer of the 120 orphan Sheets rows. No connection, event, report, campaign or financial record was changed or deleted. Retention/targeted cleanup remains a separately scoped decision with exact record and dependency proof.

## Remaining work, consolidated once

These are existing acceptance requirements, not evidence of 74 unfixed code defects. The following groups must not be replaced by a passing-suite claim:

1. **Real identity and source access.** Confirm the intended Clerk production instance and safe owner/account mapping; then use ordinary authorized customer identities to verify owner/foreign-owner/account switching and grants/revocation. Verify real GA4/Sheets/CRM/commerce consent, selection and reconnect. Public 401 checks and synthetic identities do not establish this.
2. **Provider-to-output acceptance.** For each retained source, reconcile selected values, permissions, complete pagination, amount/currency/date and genuine zero/unavailable states; cover add/edit/delete/reconnect/refresh/list/totals and KPIs/benchmarks/Insights/reports. Keep GA4 completed-day rules and proxy separation. Preserve existing passed user checks; execute only the missing cells in the batch records. Signed Custom email/attachment/retry acceptance and real hosted quota/load behaviour also require their actual environment. The known HubSpot September 29/30 date question needs the original provider timestamp/timezone; no guessed rewrite is allowed.
3. **Historical and operational disposition.** Resolve legacy plaintext/log-exposure and exact source provenance where not covered by the current aggregates; retain or separately clean exact damaged/orphan records with a proved dependency boundary. Complete the already-required deployed failure/recovery, key compatibility and restore/rollback evidence. Local process/restore tests remain valid evidence within their documented boundary, not live interruption experiments.

Batch 6's postponed real Google Ads acceptance, Batch 7's remaining report/email acceptance and Batch 8's operational gates retain their existing ownership. They are dependencies where applicable, not duplicated new Batch 1–5 implementation tasks. Deferred LinkedIn/Meta/TikTok/Instagram metric functionality is not added to V1 scope.

**Decision:** Batch 1–5 implementation and current local regression verification are complete within the recorded scope. Full production acceptance remains OPEN for the specific missing evidence above. No whole-app production-ready claim is made. The only new code change is the test assertion; there is no new runtime fix requiring a customer re-test.
