# Batch 1: Authorization, ingestion and credential exposure

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 1 status

**October 31 account-session and historical-log close-out:**
[V1-052](ACCOUNT_SESSION_CLOSEOUT_2026-10-31.md) and
[V1-057](HISTORICAL_LOG_DISPOSITION_2026-10-31.md) are CLOSED within their original
security boundaries. Batch 1 is **12 CLOSED / 8 OPEN**. Nine focused tests pass;
the actual Notifications page, navigation bell, late requests and return/reload
were exercised locally, reusing completed real Clerk/Reports checks. The user
confirmed sole Render access, no sharing, no log destination or saved copies.
The six-case separate-process attribution persistence test also passes locally;
remaining deployed attribution acceptance stays explicit. No runtime behavior,
campaign figures, production credentials or refresh schedule changed.

**October 31 historical credential cleanup completed:** [Exact scope and evidence](LEGACY_CIPHERTEXT_DISPOSITION_2026-10-31.md)
record separate approval, 21 restored-copy checks, the 126-record live cleanup and
independent verification. Only the obsolete encrypted credential column changed;
the three current campaigns and their connections remain unchanged. All 361
connection records remain, with zero plaintext rows or public-fallback fields.
The earlier 223-record cleanup is preserved. Actual renewal/reconnect, historical
logs and the shared Batch 8 recovery requirement remain unverified; Batch 1 stays
**10 CLOSED / 10 OPEN**. No runtime deployment or schedule change was needed.

**October 31 conversion/file acceptance completed:** [Live evidence, correction and exact limits](INGESTION_ACCEPTANCE_2026-10-31.md)
close V1-001 and V1-026. Batch 1 is **10 CLOSED / 10 OPEN**. The one-line public
download identifier correction is committed/pushed and verified live in `3c304f97`;
conversion retry/downstream-zero, multipart CSV, public URL import and independent
fixture absence checks pass. The historical missing-parent event is retained
unchanged and unassigned. No existing campaign figure or update schedule changed.
Hosted full-suite status is recorded in the linked evidence. Earlier checkpoints
below keep their original counts and do not supersede this status.

**October 31 transfer/source packet completed:** [Sixteen live checks and verified cleanup](SOURCE_ACCESS_PROCEDURE_2026-10-31.md)
close V1-034's original ownership boundary. Owned LinkedIn edits preserve identity,
foreign edits/transfers are denied, and the actual Reports card is visible to its
owner and hidden from the other account. Five exact temporary records were
verified and removed, with a fresh read-only absence check. Batch 1 is now
**8 CLOSED / 12 OPEN**. V1-054's unavailable legacy Meta positive acceptance and
V1-052's remaining notification/persistent-state checks stay open. No runtime or
refresh-schedule change. The earlier checkpoints below retain their original scope.

**October 31 combined account completion:** [Live results, cleanup and exact limits](ACCOUNT_API_PROCEDURE_2026-10-31.md)
record user-reported `PASS_OWNER`/`PASS_FOREIGN` and the complete `PASS_RECHECK`.
Independent production checks verified the seven synthetic records, rehearsed
deletion with rollback, committed the exact seven deletes and reread their
absence. All original table IDs and protected campaign identities/statuses remain.
V1-002/003/053 are now CLOSED: **7 CLOSED / 13 OPEN** for Batch 1. No runtime code,
provider configuration or refresh schedule changed. Attribution restart and
remaining access/provider/operational acceptance stay open. Reports foreign
absence is confirmed, but the user did not confirm positive owner reappearance;
V1-052 remains open. The corrected test setup and its final-filter regression
are recorded without claiming full deployed Reports acceptance.

**October 31 consolidated close-out:** [One execution ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md)
reconciles all 20 findings and carries forward the completed account checks,
five provider connections/imports, credential cleanup and confirmed revenue-display
fix. V1-027 is CLOSED: six current-code callback browser checks pass and the
configured real OAuth successes meet its remaining gate. At that earlier checkpoint: **4 CLOSED / 16 OPEN**,
with all 20 original corrections implemented. Remaining acceptance is assigned
once to three packages: account/API, connection/ingestion lifecycle, and production
configuration/recovery. Do not repeat completed initial imports or ordinary
sign-out checks. Earlier dated counts below remain historical.

**October 30 report-cache follow-up:** [Exact local correction and limits](REPORT_CACHE_ACCESS_2026-10-30.md)
records a reproduced V1-052 boundary missed by the query-cache-only check:
browser-saved Reports metadata could display before campaign access succeeded.
The five-line guard passes 170/170 focused checks, TypeScript and client/server
builds. It is deployed as `7e413779`; 6,870/6,870 full local tests pass, but the
hosted failure was reproduced as a browser-test timing defect. Test-only correction
`05542b6e` passes 86 focused checks, TypeScript and the complete hosted workflow
(run 41116916268); the healthy application revision remains unchanged.
The user confirmed the
ordinary sign-out/Back-button, second-account isolation and return-to-owner checks;
remaining report-cache and broader acceptance stay open. No production data changed.

**October 30 campaign edit follow-up:** [Bounded HTTP/access evidence](CAMPAIGN_EDIT_ACCESS_2026-10-30.md)
passes 126/126 checks and TypeScript without changing application code. The live
anonymous campaign PATCH denial passes; the user confirmed owner 400 and
second-account 404 for the manual invalid-name check. Valid live edits,
retained child-route and broader acceptance remain open;
this checkpoint does not change finding counts.

**October 30 acceptance progress:** [Current close-out and exact remaining requirements](CLOSEOUT_2026-10-30.md)
records the current security and deployed boundary checks. V1-004, V1-005 and
V1-063 are CLOSED for enforced feature/endpoint exclusions. The user-approved
automatic email-import exclusion is live in `02bb9ad2`: 255 focused checks,
TypeScript and build pass; all four deployed exclusion routes and two neighboring
signed-out guards pass. The complete hosted CI workflow passes on the same commit.
The other 17 findings remain
OPEN. The exact 223-record obsolete credential
cleanup was approved and committed at 10:59 UTC after backup, 14 restored-copy
checks and read-only preflight. Independent verification confirms zero remaining
plaintext candidates and unchanged retained connections. That cleanup changed no
runtime; the later email-import exclusion is the separate deployment above.

**October 27 consolidated status:** [Batches 1–5 checkpoint](../v1-batch-8/BATCHES_1_TO_5_CHECKPOINT.md) accounts for all 74 original findings, the current 6,548/6,548 regression pass, deployed/read-only data checks and remaining live/historical acceptance. Earlier dated counts are historical; release acceptance is not silently closed.

**IMPLEMENTED AND DEPLOYED; RELEASE ACCEPTANCE OPEN.** All 20 code corrections are implemented and locally validated within the stated boundaries. Twelve release findings are closed and eight remain open as detailed in the [October 31 consolidated ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md). Earlier deployment revisions below retain their historical scope.

**Ptomo visual and scheduled-refresh checks: PASSED within their stated boundaries.** The visual check is user-reported. October 21 native/financial publications through October 20 updated at 08:10/08:11 Amsterdam, before Batch 2 deployed at 09:32. The [read-only work record](../v1-batch-2/ptomo-refresh-2026-10-21.json) confirms the exact 08:00 work item completed at 08:11:52.504 on its first attempt without a recorded error. This supersedes the earlier pre-refresh uncertainty. No manual Render setup or repeat freshness wait is required. Other [release acceptance](#remaining-release-acceptance) remains open.

The latest complete test run and remaining shared release gates are maintained in [Batch 8](../v1-batch-8/README.md#latest-validation-and-release-gates). The latest run passes all 114 Batch 1 test-file cases. The prior 141 focused / 34 PostgreSQL follow-up checks and their exact scope remain in [DATABASE_GRANTS.md](DATABASE_GRANTS.md).

## Scope and acceptance

Close anonymous/wrong-owner writes and reads, immutable parent identities, callback encoding, fail-closed signing configuration, signature/replay and bounded URL/file input; remove bearer-token logs, isolate auth caches and prevent legacy migration from overwriting renewed credentials. P0s001/002/054/063/075/123 first, alongside startup fabrication007 in batch2. Confirm every retained route/job and configuration gate. Exposure/damaged-data inventory is read-only before separately targeted cleanup/rotation.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Coordinate with [Batch 2](../v1-batch-2/README.md) for startup/migrations, campaign ownership and customer OAuth. [Batch 4](../v1-batch-4/README.md) owns transfer/import correctness; [Batch 6](../v1-batch-6/README.md) owns deferred-provider isolation; [Batch 7](../v1-batch-7/README.md) owns output/delivery acceptance. [Batch 8](../v1-batch-8/README.md) owns final release gates.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Authorization boundary trace](../../audits/v1-2026-10-19/AUTHORIZATION_BOUNDARY_TRACE.md)
- [OAuth and credential boundaries](../../audits/v1-2026-10-19/OAUTH_AND_CREDENTIAL_BOUNDARIES.md)
- [Shared service-account boundary](../../audits/v1-2026-10-19/SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md)
- [Database-grant follow-up and deployment](DATABASE_GRANTS.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-001](#v1-001) | P0 | CLOSED | CLOSED |
| [V1-002](#v1-002) | P0 | CLOSED | CLOSED |
| [V1-003](#v1-003) | P1 | CLOSED | CLOSED |
| [V1-004](#v1-004) | P1 | CLOSED | CLOSED |
| [V1-005](#v1-005) | P1 | CLOSED | CLOSED |
| [V1-006](#v1-006) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-008](#v1-008) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-026](#v1-026) | P1 | CLOSED | CLOSED |
| [V1-027](#v1-027) | P1 | CLOSED | CLOSED |
| [V1-030](#v1-030) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-034](#v1-034) | P1 | CLOSED | CLOSED |
| [V1-052](#v1-052) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-053](#v1-053) | P1 | CLOSED | CLOSED |
| [V1-054](#v1-054) | P0 | VERIFIED LOCALLY | OPEN |
| [V1-057](#v1-057) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-063](#v1-063) | P0 | CLOSED | CLOSED |
| [V1-075](#v1-075) | P0 | VERIFIED LOCALLY | OPEN |
| [V1-078](#v1-078) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-088](#v1-088) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-123](#v1-123) | P0 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-001

**Severity:** P0. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 31 closure:** [Live sender/retry, stored average and historical disposition](INGESTION_ACCEPTANCE_2026-10-31.md)
complete the original write-security gate. One historical orphan remains retained
and unassigned; no active-campaign currency mismatch exists. Broader provider
analytics and historical repair are not certified by this closure.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed locally):

`POST /api/webhook/conversion/:campaignId`, `server/routes-oauth.ts:34209`: campaign existence is the only access check. Caller-provided values create conversion events and update campaign `conversionValue` without authentication/signature. Fixture reproduces writes for a different owner. Also averages currencies together and rejects numeric zero. No production mutation attempted. Blocks every release containing this route.

**Implemented correction and exact files:** Unauthenticated conversion writes, loose amounts and mixed-currency averaging. The [route](../../../server/routes-oauth.ts) now requires owner or exact current campaign Custom Integration token; validates finite amounts including zero, matching currency and nonfuture dates. [Storage](../../../server/storage.ts) locks/rechecks the parent and token, deduplicates supplied conversion IDs, inserts and computes the same-currency 30-day average transactionally. [WebhookTester](../../../client/src/components/WebhookTester.tsx) explains the sender contract.

**Validation and limits:** Route denial/invalid/zero controls; PostgreSQL concurrent duplicate, currency, average and revoked-token checks. No historical events repaired; downstream analytics acceptance remains separate.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Conversion route/storage: owner or current token, finite values, matching currency, date and atomic average/idempotency. | `c1248a8` | Handler denial/invalid/zero and PostgreSQL retry/currency/revocation controls. See [B1 evidence](README.md). | Deployed sender acceptance; existing event/data inventory. |

### V1-002

**Severity:** P0. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 31 acceptance:** [Combined deployed account checks and exact cleanup](ACCOUNT_API_PROCEDURE_2026-10-31.md)
prove owned insertion/read, ignored supplied owner, actual foreign-row exclusion,
disconnected encrypted/redacted integration and preserved original unowned IDs.
The original six-route exposure is closed; startup seeding and unrelated provider
lifecycles retain their separate finding boundaries.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed anonymous credential read/write path):

`server/routes-oauth.ts:815–840` → `storage.ts:863–913`: Metrics, Performance and Integrations GET/POST lack actor/owner scope. [Exact UI/storage/handler round trip](../../audits/v1-2026-10-19/ENTRY_PAGES_AND_DASHBOARD_VALUES.md) proves the integration form's credential JSON is stored plaintext and returned anonymously; connected=true needs no provider verification. Earlier anonymous deployed GETs returned4/7/5 rows, without inspecting real credentials. P0 elevation reflects synthetic token-disclosure proof, not a claimed production credential compromise.

**Implemented correction and exact files:** Global metrics/performance/integrations exposed shared rows and credentials. Six [routes](../../../server/routes-oauth.ts) authenticate and pass actor ownership; [storage](../../../server/storage.ts) filters reads, fixes ownership on insert, encrypts new generic credentials and redacts responses. Generic integration creation stays `connected:false`; [modal text](../../../client/src/components/modals/integration-modal.tsx) no longer claims verified connection.

**Validation and limits:** Route controls; real PostgreSQL owner separation, encryption/decryption/redaction; migration upgrade/fresh schema. Unowned rows remain unassigned. Internal no-argument storage reads retain compatibility. Startup demo seeding V1-007 remains Batch 2.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Actor-filtered global reads/writes; encrypted/redacted generic credentials; unverified connection state; migration 0022. | `c1248a8` | Real PostgreSQL owner/encryption checks; schema upgrade/reapply/fresh creation. See [B1 evidence](README.md). | Migration 0022 applied/verified on confirmed Render DB; deployed API acceptance and legacy unowned/plaintext inventory remain. |

### V1-003

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 31 acceptance:** [Combined live procedure](ACCOUNT_API_PROCEDURE_2026-10-31.md)
completes Trends foreign denial and owned no-keywords handling without a provider
query. Earlier anonymous denials and owned/foreign retained campaign reads are
carried forward. This closes access protection, not provider-query correctness.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed locally):

`server/routes-oauth.ts:14599,14628`: LinkedIn campaign/revenue GETs expose foreign fixture labels/revenue. [Six additional handler cases](../../audits/v1-2026-10-19/retained-private-read-reproductions.json) confirm anonymous/foreign reads at Google Trends23305 and attribution31437, plus campaign-dependent connection/schema inference and credentialed provider dispatch at platform fields34290. Provider replies/data are synthetic; no live exposure attempted. All retained paths need exact owner guards.

**Implemented correction and exact files:** Retained campaign reads lacked authorization. [LinkedIn campaign/revenue, Trends, campaign attribution and campaign-dependent field-schema routes](../../../server/routes-oauth.ts) now use existing `ensureCampaignAccess`.

**Validation and limits:** Anonymous/foreign denial before effects, owned list response and static-field catalog control. This does not certify provider queries/formulas.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Existing campaign guard on retained LinkedIn, Trends, attribution and campaign-dependent field reads. | `c1248a8` | Anonymous/foreign denial; owned list/static-field controls. See [B1 evidence](README.md). | Deployed auth; provider query behavior remains separate. |

### V1-004

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 30 disposition:** the user explicitly excluded automatic email imports
for this release. `02bb9ad2` blocks all three ingestion POSTs and their dedicated
setup POST before their route handlers, while hiding email-forwarding controls.
All four deployed denials and neighboring signed-out guards pass. Local checks
cover route order, non-interception of supported uploads/webhooks, and UI render
conditions. No existing imported data was removed. [Exact evidence and limits](CLOSEOUT_2026-10-30.md)
close the exclusion, not provider delivery; the acceptance below is mandatory
before re-enablement. Supported file webhook and whitelist paths remain tracked
separately under V1-026/V1-030.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed local signature boundary):

`/api/mailgun/inbound`, routes 33943: even with a signing key, absent timestamp/token/signature skip verification and reach integration lookup. `/api/sendgrid/inbound` at 33809 uses the same conditional pattern; its body parser is also skipped by `index.ts:71` without a multipart parser on the route. No inbound email sent. Full attachment/provenance/replay paths remain unverified.

**Implemented correction and exact files:** Optional/incompatible email verification and non-durable replay protection. [SendGrid](../../../server/routes-oauth.ts) verifies ECDSA over timestamp plus exact raw multipart bytes, with a stable digest of verified body bytes for exact replay identification. Mailgun requires HMAC verification and supports URL-encoded/multipart formats. [Storage](../../../server/storage.ts) claims durable receipts inside metric transactions.

**Validation and limits:** Real loopback HTTP with non-ASCII multipart; valid/absent/altered/expired/unconfigured cases; Mailgun URL-encoded gate; five concurrent database retries and storage-instance/deleted-metric replay. Live retries with regenerated MIME serialization are not certified as the same logical email. Snapshot recovery remains a separate scheduler gate.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Mandatory provider signatures/raw multipart; durable transactional replay receipts; bounded ingestion. | `c1248a8` | Loopback valid/invalid signed delivery; concurrent database/restart-instance/deleted-metric replay. See [B1 evidence](README.md). | Real provider retries/formats, snapshot recovery and deployed configuration. |

### V1-005

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED. Disabled production test-email transport; [October 30 evidence](CLOSEOUT_2026-10-30.md).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed local reproduction):

`POST /api/alerts/test-email`, routes 8698: arbitrary recipient/subject reaches mocked email transport without actor check, production disablement or route limiter. No email sent. Must be guarded or disabled before release.

**Implemented correction and exact files:** Public test-email transport. [Route](../../../server/routes-oauth.ts) returns 404 in production, requires an actor elsewhere and mounts the existing OAuth limiter.

**Validation and limits:** Production and unauthenticated development denial before transport. No real email sent.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Test email denied in production, authenticated and rate-limited elsewhere. | `c1248a8` | Production/development denial before transport. See [B1 evidence](README.md). | Deployed production denial. |

### V1-006

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code):

Attribution routes 30814–31464 expose unauthenticated mutations/reads. `DatabaseStorage` attribution maps are process memory, not durable multi-tenant storage (`storage.ts:692` onward). Some GETs return hard-coded examples. Compatibility surface cannot be treated as production analytics or safely excluded only by navigation.

**Implemented correction and exact files:** Attribution mixed anonymous/global access, sample GET data and process-memory persistence. [Routes](../../../server/routes-oauth.ts) require actor and owned model/journey/campaign parents. [Storage](../../../server/storage.ts) uses existing tables, explicit owners and calculation/deletion transactions. Parent locks prevent overlapping deletion/calculation from recreating orphan results. Campaign touchpoint reads join consistent owner boundaries. Four fabricated GET datasets removed.

**Validation and limits:** Anonymous controls for every attribution route; foreign-parent controls; PostgreSQL owner separation, persistence across storage instances, calculation and three deletion races. Existing formulas, model configuration, pagination, date editing and full downstream acceptance are not certified. No attribution page is registered in current App; retained APIs remain guarded. Lost in-memory history is not fabricated.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Owned attribution APIs and existing-table persistence; sample outputs removed; calculation/deletion parent locks. | `c1248a8` | All anonymous routes, foreign parents, real persistence/calculation/deletion races. See [B1 evidence](README.md). | Deployed ownership/restart; analytics/configuration/downstream acceptance remains open. |

### V1-008

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code, deployed configuration unknown):

`server/utils/tokenVault.ts:25–53,109`: encryption can fall back to a known development secret; the production assertion is used on selected Shopify/Google Ads paths, not uniformly at startup or all GA4/Sheets writes. `server/db.ts:19–21` explicitly sets `rejectUnauthorized:false` for `sslmode=require`. Verify deployed key/TLS configuration and close unsafe configuration paths; no secret values collected.

**Implemented correction and exact files:** Production encryption fallback and unsafe TLS configuration options. [Vault](../../../server/utils/tokenVault.ts) and [startup](../../../server/index.ts) require an explicit production encryption key. [DB](../../../server/db.ts) forces verified TLS and rejects global TLS verification disabling.

**Validation and limits:** Actual vault missing-key/round-trip tests and installed `pg` SSL configuration checks for `disable`, `require` and libpq compatibility. Hosted TLS and existing key compatibility remain external. Baseline nuance below.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Explicit production encryption at vault/startup; verified PostgreSQL TLS configuration. | `c1248a8` | Missing-key/round-trip tests; actual pg configuration in three URL modes. See [B1 evidence](README.md). | Direct verified TLS passed; existing TOKEN_ENCRYPTION_KEY presence is user-reported. Deployed decryption/TLS remain unverified. |

### V1-026

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 31 closure:** [Actual multipart/public-URL imports and guarded cleanup](INGESTION_ACCEPTANCE_2026-10-31.md)
complete the deployed gate. A missing client identifier caused a valid public
host to reject downloads; one request header fixes it in deployed `3c304f97`.
Destination, redirect, byte, deadline and storage security controls remain intact.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated URL-fetch boundary):

`routes-oauth.ts:28246-28369,28372-28524`: bearer-token Custom Integration ingestion accepts arbitrary URL downloads, including loopback, without destination/redirect restrictions, explicit deadline or downloaded-byte limit. Exact fixture proves loopback URL reaches mocked fetch; no actual internal request. Multipart 10MB limit does not bound URL downloads. Logs print the bearer token. Protect request destinations/resources and token secrecy; require current-parent validity through publication.

**Implemented correction and exact files:** Arbitrary/unbounded URL downloads and stale public-ingestion parents. [Existing parser service](../../../server/services/custom-integration-file-parser.ts) enforces public HTTPS/443, no URL credentials, DNS pinning, redirect revalidation, a total deadline and 10 MB cap. [Routes](../../../server/routes-oauth.ts) bound embedded/multipart input and use existing import limiting. [Storage](../../../server/storage.ts) rechecks parent/integration/token/recipient/current sender list through publication.

**Validation and limits:** Private/mixed DNS, IPv4/IPv6/credential URL rejection, both Node lookup callback modes, redirect and streamed-size controls; database missing-parent/revoked-token/removed-sender controls. Real egress/provider attachment acceptance remains external.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Public HTTPS downloads with pinned DNS, validated redirects, deadline/size caps and final parent/token/sender checks. | `c1248a8` | Private/mixed DNS, redirect/stream caps, lookup modes; PostgreSQL stale-parent/token controls. See [B1 evidence](README.md). | Valid deployed provider attachment and egress acceptance. |

### V1-027

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated browser reproductions):

Simulation callback10821 and real Salesforce11506, LinkedIn23517, Meta24073 callback error branches interpolate unescaped input before state/owner checks. Harmless sentinels execute under current CSP in local blocked-network Chromium. Google fixed-error and existing safe serializer controls pass. Encode each HTML/script context or effectively gate removed flows; no deployed exploit sent.

**Implemented correction and exact files:** Untrusted popup content interpolated into HTML/scripts. Four [paths](../../../server/routes-oauth.ts) reuse existing HTML/JSON serializers; simulation state is URL-encoded.

**Validation and limits:** Handler sentinels and actual Chromium callback execution; normal Google callback control. [October 31 closure](CONSOLIDATED_CLOSEOUT_2026-10-31.md#v1-027-closure) combines six current-code Chromium checks with user-reported configured Google/Sheets, HubSpot, Salesforce and Shopify OAuth success and persisted connection/import evidence. Replay/session, renewal and resource-revocation acceptance remains in V1-078/088/123; deferred providers remain deferred.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Existing HTML/script serializers on four vulnerable popup paths. | `c1248a8` | Exact handlers and Chromium sentinel execution with adjacent Google control. See [B1 evidence](README.md). | Successful configured OAuth callbacks. |

### V1-030

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated update reproduction):

`storage.ts:5706-5730` drops `allowedEmailAddresses` when updating an existing Custom Integration, despite guarded connect accepting it. Previously allowed sender remains permitted by token-email whitelist. Preserve exact sender boundary and test save/reload/removed-sender rejection.

**Implemented correction and exact files:** Custom Integration updates ignored edited sender whitelists. [Storage](../../../server/storage.ts) persists explicit lists, clears with `[]`, preserves omission and rechecks current values during public publication.

**Validation and limits:** Real PostgreSQL reload/clear/omission/removed-sender checks. Existing empty-list meaning remains unrestricted senders with otherwise valid delivery credentials.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Explicit Custom Integration whitelist edits persist; publication rechecks current list. | `c1248a8` | PostgreSQL save/reload, clear, omission and removed-sender checks. See [B1 evidence](README.md). | Deployed owner edit and signed sender acceptance. |

### V1-034

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed anonymous temporary-source write):

`POST /api/custom-integration/:campaignId/connect`, routes33729-33780: magic ID `temp-campaign-setup` bypasses actor/campaign guard and writes/returns a shared temporary connection and bearer token. Exact-handler fixture confirms zero guard calls. Transfer34100 also skips ownership for that source. No current frontend use of the magic ID found. Retained shared staging cannot be treated as tenant-safe merely because ordinary IDs are guarded.

**Implemented correction and exact files:** Shared temporary-ID authorization exemptions. [Connect and transfer routes](../../../server/routes-oauth.ts) now guard both parents normally.

**Validation and limits:** Ordinary/magic-ID rejection; existing owned draft architecture retained. Separate transfer-copy defects remain Batch 4.

**October 31 closure:** The [live transfer/source packet](SOURCE_ACCESS_PROCEDURE_2026-10-31.md)
proves successful owned transfer, actual foreign source/destination denial and
both magic-ID parent denials. Prior real owned GA4 draft creation is retained.
The connect endpoint is blocked by the approved automatic-email-import exclusion.
Independent stored-state verification and five-row cleanup/readback pass. This
closes the original authorization defect; it does not certify Batch 4 copy logic.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Remove shared temporary-ID exemptions; guard connect and both transfer parents. | `c1248a8` | Ordinary/magic-ID denial controls. See [B1 evidence](README.md). | Owned draft/transfer acceptance; Batch 4 transfer defects remain. |

### V1-052

**Severity:** P1. **Fix status:** VERIFIED LOCALLY AND DEPLOYED. **Release acceptance:** CLOSED.

Current closure: [account-session evidence and exact limits](ACCOUNT_SESSION_CLOSEOUT_2026-10-31.md).
The checkpoint below remains historical.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: cache behavior proven, live auth transition unverified):

`client/src/App.tsx:175`, `lib/queryClient.ts:58`, `lib/clientContext.tsx:16` retain account-independent query keys with infinite freshness outside auth branches and no clear/reset hook. Exact config/real-library fixture returns prior-owner client data without a new fetch. Actual Clerk account switching/signout/reload is an external browser gate; do not claim live leakage was observed.

**Implemented correction and exact files:** Global query cache and shared client selection crossed identity changes. [App](../../../client/src/App.tsx) creates/key-mounts a cache per actor and cancels/clears the old cache; [query defaults](../../../client/src/lib/queryClient.ts) consume abort signals. Nine former singleton consumers use the mounted provider. [Client context](../../../client/src/lib/clientContext.tsx) persists selection by actor.

**Validation and limits:** Real query-library and Chromium checks: A→B, late old responses, cancellation, sign-out, returning to A and selection. Clerk identity/API replies are fixtures; actual Clerk acceptance remains external.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Per-actor query client; singleton consumers use provider; cancel/clear old cache; per-actor selection. | `c1248a8` | Real query library and Chromium account-switch/late-response/sign-out cases. See [B1 evidence](README.md). | Actual deployed Clerk account switching. |

### V1-053

**Severity:** P1. **Fix status:** CLOSED. **Release acceptance:** CLOSED.

**October 31 acceptance:** [Bounded authenticated live requests](ACCOUNT_API_PROCEDURE_2026-10-31.md)
with and without the caller test flag show all three expected quota limits and
counted requests. The production bypass finding is closed. No saturation test,
distributed-capacity certification or broader quota redesign is inferred.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed limiter bypass):

`server/middleware/rateLimiter.ts:19,39,59` lets caller body.isTestMode=true skip OAuth/LinkedIn/import limits without production restriction. Exact configured skip functions tested; no load traffic sent. Bounded quota/load protections cannot rely on these limiters while this branch is exposed.

**Implemented correction and exact files:** Caller-controlled test flags bypassed production quotas. [Three limiter skip functions](../../../server/middleware/rateLimiter.ts) restrict that flag to `NODE_ENV=test`.

**Validation and limits:** Production/development/test matrix and authenticated internal-refresh control. Thresholds/distributed limits unchanged.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Caller test-flag limiter bypass restricted to NODE_ENV=test. | `c1248a8` | Three limiter functions across environment modes; internal-refresh control. See [B1 evidence](README.md). | Deployed limiter configuration/quotas. |

### V1-054

**Severity:** P0. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed unsafe cross-campaign write arguments):

LinkedIn update28649→storage4445 permits replacement campaignId; legacy Meta KPI26553→storage5312 and Benchmark27630→storage5341 pass raw updates. All authorize only original campaign. Three exact route fixtures pass foreign campaignId to persistence after checking owned parent only. Immutable identity/destination authorization needed; modern shared KPI/Benchmark and Meta report branches have stronger guards and are distinguished in evidence.

**Implemented correction and exact files:** LinkedIn connection and legacy Meta KPI/Benchmark updates could reparent records after checking old ownership. [Routes](../../../server/routes-oauth.ts) strip identities and [storage](../../../server/storage.ts) independently preserves them.

**Validation and limits:** Three exact-handler valid-edit/foreign-parent payload checks and direct real-PostgreSQL updates. Modern branches and existing refresh ownership mechanisms retained.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Three retained route and storage updates preserve record/campaign identities. | `c1248a8` | Exact valid-edit/foreign-parent payloads and real PostgreSQL identity checks. See [B1 evidence](README.md). | Deployed ownership/adjacent update acceptance. |

### V1-057

**Severity:** P1. **Fix status:** VERIFIED LOCALLY AND DEPLOYED. **Release acceptance:** CLOSED.

Current closure: [historical log custody/retention disposition](HISTORICAL_LOG_DISPOSITION_2026-10-31.md).
The checkpoint below remains historical.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed credential logging):

`routes-oauth.ts:14435,28046,28053,28061` logs Custom webhook bearers;27154–27175 logs raw provider errors. [Real Axios/current-client fixture](../../audits/v1-2026-10-19/CONFIGURATION_AND_RECOVERY.md) reproduces synthetic Ads bearer/developer-token headers in console error output; denied/success controls pass. No live credentials copied. Remove credential-bearing logging and separately establish exposure/targeted rotation. Truncation is not redaction.

**Implemented correction and exact files:** Bearer URLs/response bodies and raw provider errors exposed credentials. [HTTP logging](../../../server/index.ts) omits response bodies and redacts capability paths. [Routes](../../../server/routes-oauth.ts) remove Custom bearer/object logs and restrict Ads errors to safe metadata.

**Validation and limits:** HTTP marker tests plus actual Axios/current Ads client and route with synthetic bearer/developer markers: provider failure, denied campaign and success. Historical exposure inventory/rotation not performed.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Remove bearer/body logging; redact capability paths and Ads provider errors. | `c1248a8` | HTTP marker tests and three actual Axios/client/route controls. See [B1 evidence](README.md). | Historical exposure inventory and any separately approved rotation. |

### V1-063

**Severity:** P0. **Fix status:** CLOSED. **Release acceptance:** CLOSED. Production mock-write exclusion; [October 30 evidence](CLOSEOUT_2026-10-30.md). Deferred provider functionality remains uncertified.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conditional unauthorized write):

`routes-oauth.ts:8338,8468` LinkedIn mock routes lack actor/owner checks. Production ALLOW_MOCK_DATA=true permits foreign-campaign overwrites; exact first-handler fixture proves anonymous write, false control rejects. Live flag value remains unverified; configuration-dependent exclusion must be enforced and recorded.

**Implemented correction and exact files:** Production mock writes could be enabled by an environment flag. Both [LinkedIn mock routes](../../../server/routes-oauth.ts) now always deny production and require campaign owner elsewhere.

**Validation and limits:** Production flag and development anonymous denial. Deferred-provider simulation functionality not certified.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Both production mock endpoints always deny; development requires campaign ownership. | `c1248a8` | Production flag and development anonymous denial. See [B1 evidence](README.md). | Deployed production denial; provider functionality deferred. |

### V1-075

**Severity:** P0. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed anonymous financial mutation):

`routes-oauth.ts:6193–6225`: both connector-derived Spend aliases omit actor/campaign checks, overwrite supplied campaign Spend/currency and create an active source without records. Exact registration fixtures with no actor change foreign fixture USD to EUR and Spend to123.00. No current frontend caller found; API reachability remains. Guard both aliases and enforce parent/source/currency/atomic materialization boundaries.

**Implemented correction and exact files:** Two aliases overwrote spend/currency without authorization or dated materialization. [Routes](../../../server/routes-oauth.ts) require owner, matching currency, platform and reconciled dated facts; use existing transactional source replacement plus campaign/GA4 recompute. [Storage](../../../server/storage.ts) rechecks current parent/currency for this source type.

**Validation and limits:** Both aliases' denial/missing-record/positive dispatch checks; PostgreSQL atomic replacement, invalid-record rollback and foreign-source/missing-parent rejection. Full source×mutation×consumer correctness and historical damage remain separate gates.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Both spend aliases guard owner; require reconciled dated/platform/currency facts and existing transaction/recompute paths. | `c1248a8` | Route dispatch/denial; PostgreSQL atomic rollback and foreign-source checks. See [B1 evidence](README.md). | Existing damaged-data inventory; full analytics propagation remains open. |

### V1-078

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conditional production signing weakness):

`routes-oauth.ts:23404–23455,23953–24013`: LinkedIn/Meta state sign/verify use public development fallback when secrets are absent even in production. Exact fixtures accept independently constructed signed states; GA4/Sheets/HubSpot/Ads missing-secret controls reject. Callback campaign-owner checks remain; live secret absence or unauthorized provider connection was not demonstrated. Fail closed for every offered configuration and validate session/replay/denial independently.

**Implemented correction and exact files:** Predictable production signing fallback. Both [LinkedIn/Meta state pairs](../../../server/routes-oauth.ts) use the existing purpose-specific signing helper and reject invalid/future timestamps.

**Validation and limits:** Exact sign/verify: configured success, missing secret, tampering, expiry and rotation; purpose separation. Existing stateless nonce handling is not a single-use state store. Functional providers stay deferred.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | LinkedIn/Meta signing uses existing fail-closed provider-purpose secret helper. | `c1248a8` | Exact sign/verify configured/missing/tampered/expired/rotated cases. See [B1 evidence](README.md). | Configured callback/session acceptance; functional providers deferred. |

### V1-088

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: conditional legacy credential race reproduced):

`storage.ts:3280,3921,3951,4057,4087,4190,4217,4415,4592,5059` lazy plaintext encryption checks only row/campaign identity, allowing an old reader to overwrite a newly saved token. Ten exact-getter interleavings reproduce stale restoration; GA4923–940 compare-and-set control preserves new token. Live legacy-data occurrence unknown. Guard source-specific migration predicates and validate renewal/reconnect/restart without changing unrelated credential contracts.

**Implemented correction and exact files:** Ten lazy-encryption readers could overwrite renewed credentials. [Storage](../../../server/storage.ts) conditions each migration on original identity, absent ciphertext and original plaintext values.

**Validation and limits:** Ten real-PostgreSQL interleavings preserve concurrently renewed encrypted tokens. Getters can return their earlier read snapshot; this correction prevents persisted rollback. Live reconnect/legacy inventory remains external.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Ten lazy credential migrations compare original identity/plaintext and absent ciphertext. | `c1248a8` | Ten real PostgreSQL renewed-token/stale-reader interleavings. See [B1 evidence](README.md). | Live renewal/reconnect and legacy credential inventory. |

### V1-123

**Severity:** P0. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed shared-credential tenant gap):

`routes-oauth.ts:16111,16607,26687` authorizes the destination campaign but binds no customer to the shared service account's provider resource. [Fifteen exact-handler cases](../../audits/v1-2026-10-19/SERVICE_ACCOUNT_CUSTOMER_BOUNDARY.md) show unrelated owners can attach the same permitted GA4 property/Sheets file/Ads customer; Sheets returns metadata and Ads persists fixture facts. Anonymous, foreign-campaign and provider-denial controls pass. Enforce provider-resource/customer grants or restrict the shared paths before multi-tenant V1; no live cross-tenant access claimed.

**Implemented correction and exact files:** Shared service-account resources were not bound to customers. [Storage policy](../../../server/storage.ts) joins consistent campaign/client ownership and checks exact owner/client/provider/resource grants from optional environment configuration or internal operator records. Three [connect routes](../../../server/routes-oauth.ts) check before credential/provider access; GA4 create/update also check. Saved [GA4](../../../server/utils/ga4-service-account.ts), [Sheets](../../../server/utils/google-sheets-service-account.ts) and [Ads](../../../server/utils/google-ads-service-account.ts) hydration checks before cached/new shared-token use. Connect denials return 403.

**Validation and limits:** Fifteen exact-route cases; real-PostgreSQL owner/client/provider/resource/malformed/revocation controls; all three hydration helpers deny revoked grants before token use. Existing provider allowlists remain additional checks. [Database follow-up](DATABASE_GRANTS.md): 34 PostgreSQL checks, 141 focused tests and exact Ptomo database permission applied/verified.

**Recorded implementation checkpoint (October 20; later deployment/current-status evidence above takes precedence):**

| Fix state | Root cause and changed files | Revision | Validation evidence | Remaining release gate |
|---|---|---|---|---|
| VERIFIED LOCALLY (specified boundary) | Owner/client/provider/resource grants on connect and saved shared-credential hydration; GA4 save/update guard. Internal reviewed database grants remove manual Render setup. | `c1248a8`, `4550381b`, `4522f834`; [current hashes](database-grants-candidate.json) | 15 route cases, 34 current PostgreSQL checks, 141 focused tests and three provider hydration revocation controls. Exact Ptomo database permission applied/verified. Current full suite retains the same 182 failures. See [current evidence](DATABASE_GRANTS.md). | Package pushed. Customer Google sign-in default needs no shared grants. Google setting presence user-confirmed; live consent, deployed Ptomo continuity and denial checks remain open. |

<a id="corrections-and-evidence-boundaries"></a>

The former corrections table is consolidated into the individual [findings](#findings) above.

## Historical implementation and deployment evidence

The following records preserve their original checkpoints. Old statements such as "pending", "next check", "unpushed" or "deployment hold" are historical, not current instructions. The [current Batch 1 status](#current-batch-1-status) supersedes them; no manual Render grant entry or repeat morning-refresh wait is required.

### Earlier October 20 status

Authorized by the user on 2026-10-20. Base HEAD: `777aae6f6353e998d60b635d3e66b413093117c2`. Local verification was completed before committing; the later commit/deployment preflight is recorded below. The [audit index](../../V1_RELEASE_READINESS.md) controls finding status and release acceptance. Original audit evidence remains historical; it does not validate the changed code.

Scope: V1-001, 002, 003, 004, 005, 006, 008, 026, 027, 030, 034, 052, 053, 054, 057, 063, 075, 078, 088, 123. Runtime corrections for all 20 are implemented and the specified local checks are complete. **No release closure is claimed; confirmed deployment is recorded below.** Other batches, deferred-provider functionality, real-data cleanup and credential rotation are outside this implementation.

**Current deployment update, 2026-10-20:** the user rejected manual Render grant setup. The same exact owner/client/provider/resource guard now also reads internally stored reviewed grants. Migration 0023 and **one exact Ptomo grant were applied transactionally**, then verified with a fresh read-only connection. No manual Render entry is required for Ptomo or for new customers using Google sign-in. The complete Batch 1 package is committed, pushed and confirmed running on Render as **`4522f83486a28ebbf1fe6152f1053fdc83565223`**. Two health observations returned that revision with HTTP 200/`ok:true`; five protected anonymous GETs returned HTTP 401. This supersedes the earlier environment-only prerequisite and deployment hold below. [Current implementation, validation and deployment evidence](DATABASE_GRANTS.md) distinguish these confirmed boundaries from authenticated Ptomo/application/provider acceptance, which remains outstanding.

During the implementation phase, no production application/database request, real email, provider activation, campaign modification, deployment, commit or push was performed. Ptomo and redundant campaigns were not modified. All test identities, credentials, reports and database rows are synthetic. The later commit/deployment preflight is recorded below.

### October 20 status checkpoint (superseded)

**IMPLEMENTED AND DEPLOYED; LIVE ACCEPTANCE IN PROGRESS.** All 20 Batch 1 code corrections are deployed. The visual check below has passed, but the batch is not closed for release.

| Check | Current result |
|---|---|
| Implementation and deployment | Complete; Render confirmed runtime `4522f83486a28ebbf1fe6152f1053fdc83565223`. Later audit-only commits use `[skip render]`. |
| Focused validation | 141 focused tests and 34 isolated PostgreSQL checks passed; TypeScript and production build passed. |
| Current full suite | 3,907 passed, 182 failed, zero skipped. All 182 failures remain open; no new failure identities or changed first messages. |
| Deployed public checks | Health/revision confirmed; five protected APIs returned HTTP 401 to anonymous requests. |
| Ptomo visual check | Passed, user-reported: Campaign Overview -> Connected Platform -> Google Analytics -> View Detailed Analytics "looks normal". |
| Ptomo scheduled refresh after deployment | **Pending.** The screenshot shows native/financial data through Oct 19, last updated Oct 20 at 20:14/20:15 GMT+2, before the 23:01 deployment. |
| Customer connection setup | Normal new-customer flow uses Google sign-in without per-customer Render entries. Ptomo's exact existing shared permission is stored and verified in the database. Live fresh-customer Google consent remains unverified. |
| Other Batch 1 release acceptance | Still open where identified in the finding rows and [remaining acceptance](#remaining-release-acceptance). One successful Ptomo refresh would not close these other requirements. |

**Next Ptomo check:** after the **October 21, 2026, 08:00 Europe/Amsterdam** scheduled refresh finishes, inspect the same Overview section. Check both **Last successful update** timestamps and both data-through dates; the expected completed-day cutoff for that run is October 20. Retain the screenshot/result in the [live evidence record](DATABASE_GRANTS.md#post-deployment-user-visual-check). The configured schedule is 08:00, 14:00 and 20:00 Amsterdam time. No completion duration is assumed and no manual import or configuration change is needed for this check. If the timestamps do not advance or an error appears, keep acceptance pending and investigate the actual run.

This status supersedes the earlier environment-only deployment holds in the historical chronology below. The overall V1 release decision remains **NO-GO**.

## Deployment prerequisites and changed contracts

Do not deploy this patch alone as a V1 release. The remaining batches and external gates have not passed.

1. **Migration 0022:** [SQL](../../../migrations/0022_v1_entrypoint_ownership.sql) adds five nullable owner columns/indexes and durable inbound receipts in a transaction. Apply before starting this code. Tests cover baseline-schema upgrade/reapply and fresh current schema. The full historical migration/startup catalog remains Batch 2.
2. **Legacy data:** unowned global/attribution rows stay unowned and are not assigned to a guessed customer. Existing plaintext, lost in-memory attribution and possible prior bad conversion/spend data require separate inventories and an exact-boundary cleanup plan.
3. **Encryption:** configure `TOKEN_ENCRYPTION_KEY` or `ENCRYPTION_KEY` with the existing compatible value. If old ciphertext derived from a fallback, prove its derivation/decryptability first. Do not generate a replacement key that strands existing credentials. Recovery must include the compatible key.
4. **TLS:** the deployment runners connected to the confirmed hosted database with certificate verification enabled. Effective TLS configuration inside the Render application process remains unverified. Untrusted certificates and `NODE_TLS_REJECT_UNAUTHORIZED=0` must fail.
5. **Shared credentials:** exact `{ownerId, clientId, provider, resourceId}` authorization is mandatory. Optional `SERVICE_ACCOUNT_RESOURCE_GRANTS` JSON entries remain supported; internal `service_account_resource_grants` rows provide the same permission boundary without Render edits. Neither source automatically trusts saved connections. Missing authorization in both denies access. Provider is `ga4`, `google_sheets` or `google_ads`; use normalized GA4/Ads IDs and exact spreadsheet IDs. Only independently reviewed operator grants may be inserted. Ptomo's single database grant and migration 0023 are applied/verified as recorded in [the follow-up](DATABASE_GRANTS.md). New customer OAuth does not require shared grants. No production identifiers or credentials are committed.
6. **Inbound email:** configure SendGrid's ECDSA public key in `SENDGRID_WEBHOOK_VERIFICATION_KEY` (PEM/base64 SPKI) and/or `MAILGUN_WEBHOOK_SIGNING_KEY` for enabled providers. Missing keys return 503, invalid signatures 401; allowed timestamp difference is 24 hours. SendGrid exact-wire replay digest survives signature variation; logically repeated mail with changed MIME boundaries requires deployed provider testing. Replay tombstones contain fingerprint, campaign/metric IDs and time, not message bodies/credentials, and deliberately survive deletion.
7. **Conversion sender:** use an owner session or current Custom Integration token in `x-campaign-webhook-token`. An external adapter must match this contract; native Shopify/Stripe webhooks are not automatically compatible. Supply finite value, campaign currency, optional nonfuture date and a stable unique `conversionId` for retry protection. Missing IDs retain non-idempotent compatibility. Changed values for an existing ID are rejected. Public delivery rejects drafts; token rotation/deletion revokes access.
8. **Connector-spend aliases:** require explicit `platformContext` and 1–5000 `{date:"YYYY-MM-DD", spend:number|string}` records that reconcile in cents to positive `amount`, in campaign currency. `existingSourceId` replaces the exact matching source; omitted IDs create sources and are not idempotent retries. No current frontend caller exists for these retained helpers. No dates/allocation are invented.
9. **Rollback:** retain additive columns, owned rows and receipt tombstones. Old attribution memory code cannot read newly persisted history; the old artifact also restores original security defects. Prior-image/schema compatibility, restored credentials and restarted worker behavior need the release rollback exercise. Do not drop data as routine rollback.

## Validation

No isolated runner loads `.env`. `DATABASE_URL` is cleared; fixture URLs are restricted to loopback test databases. Vitest uses at most two workers. PostgreSQL runners validate their random schema names before removal. These are correctness/concurrency checks, not a production load test.

The first sandboxed invocation could not spawn the compiler (`EPERM`); this is an execution restriction, not an application test result. The isolated run was repeated with subprocess permission and no database URLs.

| Artifact | Result and scope |
|---|---|
| [access-before.json](access-before.json) | Original focused reproduction: 23 failures/7 passes before implementation, after correcting the response fixture. |
| [current-targeted.json](current-targeted.json) | **137/137 pass, zero skipped** across eight route/security/inbound/service-account and adjacent deletion/publication-browser test files. |
| [postgres-after.json](postgres-after.json), [runner](../../../server/v1-batch1-postgres-regression.cjs) | **23/23 pass** using exact storage methods and real PostgreSQL: migration, isolation, replay, immutable identity, transactions, attribution deletion and ten credential races. CAS cases stub provider hydration; the LinkedIn update case substitutes the outer GA4 wrapper with a real local transaction and does not certify full GA4 publication. |
| [browser-after.json](browser-after.json), [runner](../../../server/v1-batch1-browser-regression.cjs) | **7/7 pass**, actual Chromium/current callback and App code, synthetic identity/API, all external requests blocked. |
| [provider-logs-after.json](provider-logs-after.json), [runner](../../../server/v1-batch1-provider-log-regression.cjs) | **3/3 pass**, actual Axios/client/route, synthetic credentials, no network. |
| [service-accounts-after.json](service-accounts-after.json), [runner](../../../server/v1-batch1-service-account-regression.cjs) | **15/15 pass**, exact connect handlers/actor/resource validation with synthetic grant/provider decisions; policy separately tested in PostgreSQL. |
| [full-suite.json](full-suite.json) | Initial diagnostic: 4,075 tests, 3,195 pass, 183 fail, 697 pending because DB URLs were cleared. **Not accepted as final verification.** |
| [full-suite-checkpoint.json](full-suite-checkpoint.json) | DB-enabled checkpoint: 4,087 tests, 3,905 pass, **182 fail**, zero skipped, 322 files. All failure identities match the original audit's 182 failures; none is dismissed or closed. |
| [full-suite-final.json](full-suite-final.json), [failure reconciliation](failure-reconciliation.json) | **Final: 4,088 tests, 3,906 pass, 182 fail, zero skipped**, 322 files. Every failed assertion retains its stable ID, classification, evidence and OPEN status. |
| [build.log](build.log), [typecheck.log](typecheck.log) | Final production build and TypeScript both exit **0**. |

Existing tests were updated only for changed contracts: `ga4-publication-browser.test.ts` creates its own query client; `campaign-delete-cascade-regression.test.ts` uses the TypeScript AST to enumerate actual campaign columns and explicitly requires receipt retention. Its prior regex misparsed indexed table definitions. No customer-data deletion assertion was silently waived.

Intermediate corrections: browser-fixture classic/automatic JSX mismatch; synthetic numeric defaults; an attribution TypeScript annotation; and a local variable shadow caught by PostgreSQL while validating the parent-lock change. Passing runs follow those corrections. All failure attempts are distinguished from passing evidence.

Two repeated failures have different first-message text: `TEST-d31b4e2918` now first encounters its hard-coded six-recompute count after the connector fix adds a seventh call; its original GA4/manual-branch string-order assertion remains unresolved. `TEST-6d4794df4c` still lacks its source-slice end marker; its character offset changed. These remain OPEN under V1-012, with the intended requirements preserved. Batch 1 independently executes the connector handler and checks both recompute dispatches. Matching a failure ID is not by itself evidence that its cause stayed unchanged.

Commands executed (from repository root; isolated URLs refer to disposable local fixtures):

```powershell
# Complete suite: no application database; all database tests enabled.
$env:DATABASE_URL = ''
$env:GA4_TEST_DATABASE_URL = 'postgresql://v1_audit@127.0.0.1:55443/ga4_alignment_test'
$env:NOTIFICATION_TEST_DATABASE_URL = 'postgresql://v1_audit@127.0.0.1:55443/notifications_test'
node node_modules/vitest/vitest.mjs run --maxWorkers=2 --reporter=json --outputFile=docs/fixes/v1-batch-1/full-suite-final.json

# Separate exact-storage and browser/provider-boundary runners.
$env:V1_BATCH1_TEST_DATABASE_URL = 'postgresql://v1_audit@127.0.0.1:55443/notifications_test'
node server/v1-batch1-postgres-regression.cjs
node server/v1-batch1-browser-regression.cjs
node server/v1-batch1-provider-log-regression.cjs
node server/v1-batch1-service-account-regression.cjs
node node_modules/typescript/bin/tsc --noEmit
npm run build
git diff --check
```

The final diff check uses the repository's normal Windows line-ending settings. An earlier check with an inappropriate `core.autocrlf=false` override treated CRLFs as whitespace changes; the override was removed and files were not normalized.

### Final verification summary

**Batch 1 code implementation and the stated local regression checks are complete. Release acceptance remains OPEN.** The final frozen-code suite ran all 4,088 tests with zero skipped: 3,906 pass and 182 fail. There are no new failing test identities compared with the original audit; the two changed first-failure messages are explained above. **All 182 remain release blockers**, with zero waivers and zero closures. Classification is 10 source-extraction, 74 structural-assertion, 53 fixture-contract, 37 behavior-assertion-with-incomplete-fixture and eight fixture-binding failures. These labels do not prove the underlying application requirement; repair/revalidation remains V1-012.

The 137 targeted checks, 23 PostgreSQL checks, seven browser checks, three provider-log checks and 15 shared-service-account route checks pass. Final TypeScript and production build exit 0; normal `git diff --check` passes. The build retains chunk/import warnings and the suite reports a missing dependency sourcemap; neither is treated as a substitute for performance/dependency acceptance.

[Candidate file hashes](candidate-files.json) identify all 37 implementation/test/migration files at the uncommitted candidate; the reconciliation verified they stayed unchanged during the final run. [Verification manifest](verification.json) records command results and artifact hashes. At final local validation, HEAD was `777aae6f6353e998d60b635d3e66b413093117c2`. The deployed revision/configuration was **not rechecked or changed during Batch 1 implementation**; the index's earlier deployment observation is historical evidence.

The isolated PostgreSQL fixture on `127.0.0.1:55443` was stopped successfully after verification ([stop log](postgres-stop.log)). No live application process or database was stopped.

## Documentation alignment and remaining acceptance

### Commit/deployment preflight — 2026-10-20

The following chronology preserves earlier checkpoints. The [current Batch 1 status](#current-batch-1-status) and [confirmed deployment record](DATABASE_GRANTS.md) supersede its former manual Render prerequisite and push holds.

The user subsequently authorized committing and pushing Batch 1 to trigger Render. Local and remote `main` were both `777aae6f6353e998d60b635d3e66b413093117c2` before this commit. `render.yaml` enables automatic deployment from `main`, but neither its build command nor startup applies migration 0022. This commit packages the verified candidate and its audit evidence; it does not certify V1.

**Implementation commit:** `c1248a875af9c8eea1289a824a0e903e599ab174` (`Harden V1 access, ingestion and credential boundaries (Batch 1)`). The tracked working tree was clean immediately after this commit. A subsequent remote read confirmed `main` still at `777aae6f6353e998d60b635d3e66b413093117c2`; no push or deployment was initiated. This documentation follow-up records the resulting commit and leaves all external acceptance gates open.

A [metadata-only read-only preflight](deployment-preflight.json), using [this runner](deployment-preflight.cjs), initially verified a certificate-checked TLS connection to the repository-configured database and found all five required owner columns and the inbound receipt table absent. At that point its Render binding was unverified and no schema or customer data had been changed. The later confirmation and migration are recorded below.

No Render credential or authenticated browser session was available. The database prerequisite is now satisfied. The user subsequently reported that `TOKEN_ENCRYPTION_KEY` is present and `SERVICE_ACCOUNT_RESOURCE_GRANTS` is absent in Render. The existing key will be preserved unchanged; its contents and deployed decryption have not been inspected. Pushing the auto-deploy branch remains held until the missing Ptomo grant setting is saved. The explicit deployment authorization is retained; additional push permission is not the missing requirement.

The commit includes the 37 candidate implementation/test/migration files and the V1 audit/Batch 1 evidence. Unrelated worktrees, assets, seed logs, temporary files and pre-existing validation scripts are excluded. An offline scan of audit artifacts found no matching configured secret values or private-key/GitHub-token/Google-key/JWT patterns. Original validation results remain historical and unchanged.

Commit packaging preserves evidence bytes with directory-scoped Git attributes; PDF, PNG and database dump fixtures are explicitly binary. The staged implementation/test/migration whitespace check passes. Historical evidence retains one inventory EOF blank line and whitespace emitted in two PostgreSQL logs; these are artifact-format findings, not runtime test failures, and were not rewritten to change historical evidence.

### Confirmed database and migration

The user confirmed that the live Render service uses the repository's `DATABASE_URL`. On 2026-10-20 at 19:38 UTC, the [one-off runner](apply-deployment-migration.cjs) applied the exact hash-checked migration 0022 body in one transaction over verified TLS, with a two-second lock timeout and 15-second statement timeout. It checked five nullable text owner columns, five valid/ready owner indexes, and the receipt table's column/default/primary-key contract before committing. [Execution evidence](deployment-migration.json) records before/after metadata and commit success. No existing customer rows were read, assigned, deleted or rewritten by this migration.

A [fresh read-only connection](deployment-postmigration.json) confirmed all five columns and the receipt table after commit. The [live public health endpoint](deployment-health-after-migration.json) returned HTTP 200, `ok:true`, production mode and the unchanged deployed revision `777aae6f6353e998d60b635d3e66b413093117c2`. This is reachability/revision evidence, not authenticated analytics or whole-app acceptance. The direct hosted-database TLS check passed; TLS/configuration inside the Render process remains unverified. Application rollback should retain these additive schema objects; no destructive schema rollback was performed.

A [Ptomo-only read-only configuration check](deployment-ptomo-configuration.json) found exactly one matching campaign with consistent campaign/client ownership and one active GA4 `service_account` connection. It read no credentials or analytics values and made no provider calls. The exact saved owner/client/property grant is prepared locally in `audit-temp/ptomo-service-account-grants.json`, excluded from Git, for configuration review. This does not independently revalidate Google's permission boundary, and no grant has been applied to Render. No additional supported provider connection was found for Ptomo in the GA4/Sheets/Ads connection tables.

**Current deployment state:** migration applied; Batch 1 implementation committed; push and new Render deployment not initiated. The user reports `TOKEN_ENCRYPTION_KEY` is present and `SERVICE_ACCOUNT_RESOURCE_GRANTS` is absent. The existing key is to remain unchanged. The prepared grant file contains exactly one `ga4` entry with the required owner/client/resource fields and no credential fields; its SHA-256 is `200b7e1555382583204e1ef3b1b2005603849530b8ef327d79d1ce0c9f44b658`. The user has been asked to add the entire JSON array as `SERVICE_ACCOUNT_RESOURCE_GRANTS` and choose **Save only**, leaving activation to the next authorized push/deployment. [Render documents that Save only stores the variable for the next deployment](https://render.com/docs/configure-environment-variables). No secret values were requested. Signature configuration for any enabled inbound-email provider and the remaining deployed acceptance checks are still unverified.

### Onboarding impact clarification

Before the follow-up, campaign creation defaulted to shared service-account access, which requires an approved owner/client/resource entry for each distinct customer configuration. The earlier chat description of a "one-time setup" omitted that scope. The user explicitly required onboarding without per-customer Render edits. **The local correction now defaults campaign creation to the existing customer Google OAuth flow and skips shared-account status requests in OAuth mode: three changed runtime lines in one component.** Customer-owned OAuth does not require shared-resource grant entries. Existing shared-account protections and Ptomo's saved connection remain unchanged.

[Follow-up evidence](ONBOARDING_IMPACT.md) includes the failing before case, **13/13 passing browser/handler checks**, **138/138 focused regressions**, passing TypeScript and production build, and [source hashes](onboarding-candidate.json). The correction is committed as `4550381ba32fc4869b219d2e904fa74b86a083aa`. The original full-suite/PostgreSQL packet remains evidence for the initial Batch 1 version; it was not rerun for this frontend-only correction. All 182 original failures remain open. On 2026-10-20, the user confirmed that both app-wide `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are listed in Render. Their presence is user-reported; values, redirect configuration, live Google consent, full onboarding lifecycle and provider acceptance remain unverified. These settings apply to the application, not individual customers. Ptomo's existing shared connection still needs its single reviewed grant or a separately authorized Google reconnect before deployment. This follow-up remains V1-123 with Batch 2 onboarding acceptance; no new framework, runtime dependency, API contract or source-data change was introduced.

### Remaining release acceptance

The baseline V1-008 source contained `rejectUnauthorized:false`, but installed `pg-connection-string` can override that option when parsing `sslmode=require`. That source line alone did **not** prove deployed certificate verification was disabled. Current tests establish the hardened client configuration for the specified URL modes; hosted behavior remains unknown.

Provider verification follows [SendGrid Inbound Parse security](https://www.twilio.com/docs/sendgrid/for-developers/parsing-email/securing-your-parse-webhooks) and [Mailgun webhook security](https://documentation.mailgun.com/docs/mailgun/user-manual/webhooks/securing-webhooks). Actual provider format/retry acceptance remains external. Outbound email acceptance/delivery belongs to Batch 7.

Required external checks: deployed Clerk owner/foreign-owner/account switching; utility denials/quotas; exact resource grants and revocation in every worker; compatible encryption/TLS; signed valid/invalid/retry email and public attachment acceptance; read-only legacy plaintext, source provenance and log-exposure inventory; migration/restore/rollback; and Ptomo read-only sanity against the final deployed revision. None is completed by mocks.

V1-014's complete analytics lifecycle/downstream matrix, original test failures, transfer/reprocessing defects, snapshot/report recovery and the other seven batches remain release blockers. Batch 1 is not whole-app or future-source certification. Its owner/resource, immutable-parent, signature/replay, transaction, cache and credential-race safeguards are reusable within the existing architecture; each future provider still needs independent permissions, metrics, attribution, dates, pagination and quota validation.

## Historical progress notes moved from the index

These October 20 notes are retained as checkpoints. The current status above and later deployment evidence supersede their next-step instructions.

**Post-deployment Ptomo visual check:** after following Campaign Overview -> Connected Platform -> Google Analytics -> View Detailed Analytics, the user reported **"it looks normal"**. The basic analytics page-load/display check is **PASSED (user-reported)**. [Exact evidence boundary](DATABASE_GRANTS.md#post-deployment-user-visual-check): this does not verify individual values, reporting dates, a new refresh, customer OAuth consent or cross-account isolation. No release finding is closed by this visual check.

**Ptomo freshness follow-up:** the user reported **Oct 20, 2026, 08:14 PM GMT+2** as the GA4 metrics' last successful update. This is before the confirmed Batch 1 deployment at 11:01 PM GMT+2, so a successful refresh with the new runtime remains unverified. The timestamp is not, by itself, a failure. The next live check must follow the deployed **Scheduled refreshes** value shown in Overview. No source or campaign changes were requested for this check.

**Screenshot-confirmed schedule:** the supplied Ptomo image shows **08:00, 14:00, 20:00 Europe/Amsterdam**, native and financial data through **Oct 19**, and respective last successful updates **Oct 20 at 20:14 and 20:15 GMT+2**. The next configured slot after this review is **Oct 21 at 08:00 Amsterdam**. After completion, check the same two publication timestamps and data-through dates. [Evidence and limits](DATABASE_GRANTS.md#post-deployment-user-visual-check) retain post-deployment refresh as pending; no assumed completion duration or readiness claim is made.

**Deployment checkpoint, 2026-10-20:** the complete corrected Batch 1 package was committed and pushed to `origin/main` as **`4522f83486a28ebbf1fe6152f1053fdc83565223`**, independently confirmed by `git ls-remote`. Migration 0023 and the exact Ptomo database grant are applied/verified. The manual Render grant step is removed. [Live health observations](database-grants-live-health.json) confirmed the same runtime SHA with HTTP 200/`ok:true` at 21:01:30 and 21:02:00 UTC. [Five protected anonymous GETs](database-grants-deployed-access.json) subsequently returned HTTP 401. The [deployment record](DATABASE_GRANTS.md) distinguishes the running commit from the later documentation-only `[skip render]` evidence commit. Authenticated Ptomo/provider acceptance remains unverified; the overall decision remains NO-GO.

**Ptomo setup correction, 2026-10-20:** the user rejected the manual Render grant entry. The exact resource guard now also accepts internal operator-reviewed database grants, with no automatic approval of existing connections. Migration 0023 and one exact Ptomo grant were applied and verified through a fresh read-only connection; **no manual Render grant setup is required**. New customer onboarding remains Google OAuth. The current follow-up passes 34 PostgreSQL checks, 141 focused tests, TypeScript and build. The current full suite has **4,089 tests: 3,907 passed, 182 failed, zero skipped**; every failure matches the earlier packet with no new identities or changed first messages. All failures remain open. [Current implementation and evidence](DATABASE_GRANTS.md) supersede the historical environment-only deployment hold below. Commit/push is next; no release item is closed.

**Google configuration update, 2026-10-20:** the user confirmed that both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are listed in Render. App-wide setting presence is therefore user-reported, while secret values, redirect configuration and live Google consent remain unverified. The customer-onboarding correction is committed as `4550381ba32fc4869b219d2e904fa74b86a083aa`; the normal OAuth path requires no per-customer Render grant. Push remains held because the reviewed setting needed to preserve Ptomo's existing shared-account connection has not been confirmed saved. No runtime or production-data change accompanies this status update. See [the current onboarding record](ONBOARDING_IMPACT.md).

**Commit/deployment update, 2026-10-20:** implementation commit `c1248a875af9c8eea1289a824a0e903e599ab174` remains unpushed. The user confirmed Render uses this repository's `DATABASE_URL`. [Migration 0022 was applied and verified](deployment-migration.json), including a [fresh read-only check](deployment-postmigration.json). The [live public health observation](deployment-health-after-migration.json) returned HTTP 200 and revision `777aae6f6353e998d60b635d3e66b413093117c2`. [Ptomo has one active GA4 service-account connection](deployment-ptomo-configuration.json). The user reports `TOKEN_ENCRYPTION_KEY` is present in Render and `SERVICE_ACCOUNT_RESOURCE_GRANTS` is absent. The existing key will remain unchanged. The exact Ptomo grant has been prepared locally; the authorized auto-deploy push is held until that setting is saved. Setting presence is user-reported; secret contents and deployed decryption have not been inspected. See [the deployment record](README.md#confirmed-database-and-migration). **Onboarding correction:** after the user rejected per-customer Render setup, the local candidate now defaults campaign creation to customer Google sign-in and skips shared-account status requests in that mode. The three-line correction passes 13 browser/handler checks, 138 focused tests, TypeScript and build. [Current evidence and limits](ONBOARDING_IMPACT.md) distinguish it from the earlier full-suite packet. Customer OAuth requires no per-customer resource grants; app-wide Google configuration/live consent remain unverified. Existing Ptomo shared access still needs its one reviewed grant or separately authorized reconnect before deployment.

Batch 1 code corrections are IMPLEMENTED; the specified local boundaries are verified. Deployment/configuration/provider acceptance remains outstanding. Its [implementation and validation record](README.md) retains the original failing evidence separately from new regression results. No item is closed for release.

**2026-10-20 Batch 1 handoff:** all 20 code corrections are implemented and committed as `c1248a8`, but remain unpushed and undeployed. Targeted checks **137/137**, PostgreSQL checks **23/23**, browser checks **7/7**, provider-log checks **3/3** and shared-service-account route cases **15/15** pass; TypeScript/build/diff checks pass. The [final full suite](full-suite-final.json) has **4,088 tests: 3,906 pass, 182 fail, zero skipped**. [Every failure is reconciled](failure-reconciliation.json), including two changed assertion messages; none is waived or closed. There are no new failing test identities. This is not a passing release suite. Required migration, configuration, provider, historical-exposure and deployed acceptance remain explicit in each row and the detailed record.
