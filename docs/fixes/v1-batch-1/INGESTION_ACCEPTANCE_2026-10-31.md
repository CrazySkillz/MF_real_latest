# Batch 1 conversion and file-ingestion acceptance

V1-001 and V1-026 are CLOSED within their original authorization, currency,
idempotency and bounded-file-ingestion boundaries. Batch 1 now has **10 CLOSED /
10 OPEN** acceptance findings. This does not certify all analytics consumers,
provider lifecycles or whole-app readiness. The [current ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md)
lists every remaining gate.

## Confirmed failure and correction

The supported CSV attachment succeeded in production. The public-URL attempt
failed and was not counted as a pass. The exact downloader reproduced a rejection
from the public test host: HTTP 402 without a User-Agent, HTTP 200 with the fixed
`MimoSaaS/1.0` identifier. The same synthetic 45-byte CSV was used in both requests.
The host's behavior is a compatibility boundary, not evidence of failed database
publication or incorrect revenue calculations.

Commit `3c304f9723a65e8d9ee8650c74eacf7e03b63d34` adds only that fixed header to
the existing HTTPS request in `server/services/custom-integration-file-parser.ts`.
`server/v1-batch1-inbound-regression.test.ts` exercises a public redirect chain
whose hosts require client identification. No inbound cookie, bearer token or
other caller header is forwarded. Destination validation, DNS pinning, TLS
hostname, redirect checks, deadline, byte limit, parser, storage and scheduler
paths remain in their original locations and retain their contracts.

Trace: token-authenticated `POST /api/webhook/custom-integration/:token` in
`server/routes-oauth.ts` -> existing downloader -> CSV parser -> normalization ->
`storage.createCustomIntegrationMetrics` with current campaign/integration/token
checks -> scoped `recordCampaignMetrics`. The zero-value fixture produced no
metric snapshot; no existing client or campaign was used as the write target.

## Validation and production evidence

- [37 focused regressions](validation-2026-10-31/ingestion-identification.json)
  pass across inbound/download security and security configuration/logging.
  The requested third test-file pattern matched no file and is not counted.
- [TypeScript and server build](validation-2026-10-31/ingestion-identification-build-checks.json)
  both pass. Client code was not changed.
- [19 isolated PostgreSQL checks](validation-2026-10-31-final/ingestion-rehearsal.json)
  exercise current route/storage/CSV bodies, zero conversion, duplicate retry,
  invalid values/token/currency/date, file rejection, downstream reads and exact
  cleanup. Wrong owner/token, nonzero campaign data, unplanned dependents and a
  late-delete fault block or roll back cleanup. Snapshot dispatch is recorded in
  this local harness; actual aggregate execution is not inferred from it.
- [Actual corrected downloader](validation-2026-10-31-final/actual-public-downloader.json)
  retrieves the exact public synthetic CSV with its declared `text/csv` type.
- [Initial live packet](validation-2026-10-31-final/ingestion-2026-10-31T10-13-25-022Z.json)
  records six passing conversion checks and successful CSV multipart publication.
  URL acceptance failed on the old runtime; all five exact rows were removed.
- [Corrected live URL packet](validation-2026-10-31-final/ingestion-2026-10-31T10-26-57-376Z.json)
  confirms HTTP 200, exact campaign scope, four recognized zero metrics, confidence
  100 and no review warnings. Non-HTTPS input and ambiguous CSV return 400 without
  extra publication. All four exact rows were removed after rollback rehearsal.
- [Final live conversion packet](validation-2026-10-31-final/ingestion-2026-10-31T10-29-10-439Z.json)
  confirms numeric zero, identical retry preserving the event ID, wrong-token and
  anonymous 401, currency/future-date 400, one persisted event, total 0 and campaign
  `conversion_value = 0.00`. All four exact rows were removed.
- [Fresh independent readback](validation-2026-10-31-final/ingestion-2026-10-31T10-31-04-944Z.json)
  finds zero fixture rows in clients, campaigns, custom integrations, conversion
  events, imported metrics and metric snapshots. Protected campaign identities,
  ownership, currency and active status are checked independently.
- [Render and hosted CI evidence](validation-2026-10-31-final/deployment-2026-10-31T10-34-43-778Z.json)
  confirms runtime `3c304f97`, production mode, and successful full hosted workflow
  [41192512174](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41192512174),
  including current-version tests, certification check and retained deferred tests.

The first production dry run timed out while hashing snapshot JSON and rolled
back; [independent absence verification](validation-2026-10-31-final/ingestion-2026-10-31T10-13-10-327Z.json)
confirmed nothing was left. The rehearsed guard was narrowed to snapshot IDs
(snapshots are never mutated by this procedure), while all directly mutated table
rows retain full outside-scope hashes. Exact scope inspection rejects any snapshot
or other unplanned child. No timeout/security guard was relaxed.

## Historical conversion disposition

The [enforced read-only inventory](validation-2026-10-31-final/history-2026-10-31T10-25-49-879Z.json)
finds one historical event, `14f133dc-e5c0-49df-9f16-10d786bd0092`, received
December 6, 2025, whose campaign `9f907458-0c1f-461a-ae34-f0a5a85a9798` no longer
exists. There are zero linked currency mismatches and no current connector-derived
spend sources.

Disposition: retain that orphan unchanged and unassigned. It is not evidence of
a valid conversion and is not migrated or attached to an active campaign. Current
conversion writes require an existing owned parent and valid caller/token; event
reads and the atomic average filter the exact campaign ID. The retained LinkedIn
and Meta revenue helpers also pass a specific campaign ID to that reader. Thus
this missing-parent row does not enter any current campaign's totals. There is no
basis to invent an owner or rewrite its value. Permanent removal is a separate
historical-data action, not required to exercise or close the repaired write
boundary. No historical row was deleted by this validation.

## Limits and remaining work

The successful production startup and database writes also provide evidence for
the existing runtime safeguards: `server/index.ts` calls the explicit-key
assertion before creating the app; `server/db.ts` rejects global TLS disabling
and sets `sslmode=verify-full` before constructing the pool. The deployed commit
and production mode are independently reported by health. This is an enforced-
code/runtime evidence chain, not a claim to have read Render's private environment
or inspected every historical TLS session. It avoids asking the user to print or
copy secrets. V1-008 remains OPEN for the separate legacy/recovery limits below.

V1-001 closure covers its original unauthorized-write, numeric-zero, matching-
currency and transactional retry/average defect. It does not certify every
LinkedIn/Meta revenue formula or reclassify the orphan as trustworthy data.
V1-026 closure covers supported CSV multipart and public-URL ingestion plus the
retained destination/size/deadline/parent guards. It does not certify every PDF or
XLSX report layout, email delivery, or provider-account lifecycle. Automatic email
imports remain disabled under the user's existing instruction.

Ten Batch 1 acceptance findings remain: V1-006, 008, 030, 052, 054, 057, 075, 078,
088 and 123. Their exact account/API, provider and operational requirements remain
in the current ledger; this packet does not waive them. Expiry timestamps in the
metadata inventory are not represented as independent renewal/reconnect proof.
Existing successful user checks must not be repeated.
