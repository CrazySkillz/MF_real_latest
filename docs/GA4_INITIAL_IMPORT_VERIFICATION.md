# First-import source comparison

Scope: automatic GA4 comparison for newly created campaigns. This does not certify other sections or historical reports.

## Trigger and boundaries

`GA4_INITIAL_IMPORT_VERIFICATION_ENABLED=true` enables the check. Roll out to the test app first; absent/false preserves the existing path. No database migration is required.

The durable initial-import job imports the selected properties, then compares their saved daily and Overview inputs against fresh read-only GA4 queries before the existing atomic campaign activation. It uses the accepted job's reporting date, saved initial import date, campaign currency, exact selected campaign names and each property. Crossing midnight does not change that accepted window.

The comparison implementation is extracted from the existing independent monitor's GA4 comparison. Neither the verifier nor its provider facade offers a token-update, source-write or metric-write operation. OAuth renewal remains the import's existing responsibility; dedicated account tokens use the existing ownership-checked credential reader.

Checked values:

- Every imported date: sessions, daily users, page views, conversions, revenue, engaged sessions and engagement rate.
- Campaign Breakdown totals and rows: sessions, users, conversions, revenue, engaged sessions and native session key-event rate. Existing daily/Overview reconciliation and displayed-rate formulas remain unchanged.
- Landing Pages: exact page/source/medium rows, sessions, users and conversions.
- Conversion Events: exact event names, conversions, event count and users where GA4 supplies those fields.

Missing dates, duplicate keys, changed property/currency/report definitions, failed provider queries and numeric differences cannot produce a passing receipt. Intentional unavailable fields remain null and are listed separately from verified values. Matching empty reports prove only the absence of returned rows, not unavailable numeric values. Revenue comparisons preserve the monitor's two-decimal display rule; fractional conversions use the existing precision-aware comparison.

## Durability and failures

The successful receipt is stored under `ga4_refresh_work.scope.initialImportVerification`. It contains property/connection identifiers, dates, checked time, input fingerprint, comparison count and unavailable-field codes. It contains no credentials or raw provider rows.

Storage checks exact campaign ownership, current work lease and every selected connection. It re-reads the persisted numbers under the existing campaign transaction and refuses a receipt if they changed. Activation requires the current lease's verification receipt when the flag is enabled. Republishing data removes an earlier verification receipt; takeover/retry leases cannot reuse it. No imported figures are rewritten by receipt storage.

A comparison difference or provider failure leaves the campaign in its existing draft/import state, uses the existing bounded retry/backoff mechanism and records a scheduler failure for the existing health monitor. After retries are exhausted, Confirm shows an explicit verification failure and the existing Retry action. This is not a new email channel or a change to ongoing 08:00/14:00/20:00 refreshes. A retry performs the existing idempotent initial import again before comparing it.

Existing active campaigns are not reimported or backfilled by enabling this flag. Current scheduled monitoring continues separately. No broader 'verified' badge is added to dashboards or reports.

## Evidence

- `server/ga4-source-verification.test.ts`: matching data, individual metric mismatches, Overview details, null-versus-zero, provider failures, missing/duplicate rows, currency/property/date/owner boundaries, multiple properties and lease loss.
- `server/ga4-refresh-pipeline-source-failure.test.ts`: verification precedes activation; differences/unavailable data remain retryable drafts; surrounding ordinary scheduler behavior.
- `server/ga4-initial-import-postgres.test.ts`: required receipt, exact owner/property coverage, immutable numeric inputs, stale input rejection, republish invalidation and changed lease rejection, alongside existing process-restart tests.

Hosted acceptance must be recorded for the deployed test revision. Synthetic tests do not establish a successful real GA4 import; a previous manual comparison does not establish this new automatic trigger.
