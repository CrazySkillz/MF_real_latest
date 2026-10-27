# Batch 2: Startup, migrations and account/campaign lifecycle

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 2 status

**October 27 consolidated status:** [Batches 1–5 checkpoint](../v1-batch-8/BATCHES_1_TO_5_CHECKPOINT.md) accounts for all 74 original findings, the current 6,548/6,548 regression pass, deployed/read-only data checks and remaining live/historical acceptance. Earlier dated counts and queued-batch statements are historical; release acceptance is not silently closed.

**Batch 2: COMMITTED, PUSHED AND DEPLOYED; LIVE ACCEPTANCE IN PROGRESS.** Runtime `839bf508bffea4742f992616753dc68eabcfab3e` is confirmed on Render on October21 at09:32 Amsterdam. All14 assigned code corrections are deployed. The production schema and Ptomo preservation checks pass, and the deployed signup existing-account link now reaches Sign In. Broader customer/provider acceptance and historical cleanup remain open; this is not V1 release certification. Batches3-8 remain queued.

## Latest validation and live acceptance

**Isolated onboarding validation: PASSED within its local boundary.** Ten actual PostgreSQL startup/storage scenarios, eight campaign-wizard browser scenarios, thirteen OAuth route/browser scenarios and three GA4 connection-flow browser scenarios passed. Evidence covers reviewed Details persistence, immediate Back navigation, cancellation and cleanup retry, duplicate/lost-response recovery, tenant rejection, encrypted inactive authorization, expiry, same-property reconnect preserving connection/history, changed-property handling and provider-failure fixtures. [Database results](acceptance-2026-10-21/postgres-results.json), [wizard results](acceptance-2026-10-21/completed/wizard-browser-results.json), [OAuth results](acceptance-2026-10-21/completed/onboarding-results.json), [connection results](acceptance-2026-10-21/completed/ga4-flow-browser-results.json). These exercise real components/handlers/storage with synthetic identities and provider responses, not a completed live customer Google journey. Separately, the full-suite files named `postgres` contain 697 passing cases and one still-failing Benchmark notification case, `TEST-be609d6d58` / V1-012; its existing fixture-contract diagnosis and current error are retained in the assessment. The ten passing Batch 2 database scenarios do not close that failure.

**Live recheck and safety boundary:** [health/schema/Ptomo checks](acceptance-2026-10-21/live-deployment-after.json) confirm the same deployed SHA, expected schema, unchanged Ptomo configuration and 401 responses from all five checked anonymous protected APIs. [Public SignUp-to-SignIn navigation](acceptance-2026-10-21/deployed-public-ui.json) passes again. The [current screenshot](acceptance-2026-10-21/deployed-sign-in.png) still displays Clerk `Development mode`, so V1-013 production authentication configuration remains open. No customer account, production test campaign, live Google consent or reconnect was performed. Production access was limited to public reads and Ptomo-scoped read-only SQL; application writes were blocked in the public browser check. All validation fixture schemas were removed and the isolated local PostgreSQL instance was stopped, as recorded in [cleanup evidence](acceptance-2026-10-21/cleanup.json). Initial runner failures were an unsupported Vitest CLI option and sandbox-denied esbuild child processes; the helper invocation/permissions were corrected and affected checks rerun. Initial logs are retained; no application behavior or test assertion was changed. Batches 3-8 and the required live/provider/operational acceptance remain the route to release; another audit restart or another Ptomo freshness wait is not required.

**Ptomo Overview visual check: PASSED for the displayed content (user-supplied screenshots, October 21, after Batch 2 deployment).** Following the requested Ptomo Google Analytics detailed Overview check, the user supplied two screenshots showing Summary and financial cards rendered. GA4 metrics cover September 4 through October 20, with last successful update October 21 at 08:10 Amsterdam; financial figures run through October 20, updated at 08:11. These match the read-only [deployment baseline](deployment-before.json). Both updates precede the 09:32 Batch 2 deployment, so this confirms the displayed saved publications, not a successful refresh under Batch 2.

The screenshots show Sessions 2,977, Users 2,978, Conversions 262, Engagement Rate 72.4%, Conversion Rate 8.8%, Total Revenue EUR 65,659.50 with one source, Total Spend/ROAS/ROI/CPA `Unavailable`, and Expected Revenue `Not configured`. These are observed UI values, not independently reconciled provider totals. In particular, the screenshots do not establish why spend is unavailable or verify source configuration. Evidence is the two images supplied in this conversation; no independent authenticated browser session or new image artifact was created. Other tabs, complete value accuracy and customer onboarding remain unverified by this visual check. The displayed schedule is 08:00/14:00/20:00 Europe/Amsterdam, with today's activity excluded.

**Batch 2 Ptomo scheduled-refresh check: PASSED for the October 21 14:00 run.** The user's afternoon screenshots show both native and financial update times advanced to 14:11 Amsterdam, still through October 20. A subsequent [read-only completion check](ptomo-refresh-2026-10-21.json) at 18:33 Amsterdam independently confirms live runtime `839bf508`, unchanged Ptomo campaign/connection fingerprints, and the exact work item due at 14:00: started 14:10:24, completed 14:12:44.988, one attempt, no recorded error. Native daily/Overview records updated at 14:11:16/17; the financial publication updated at 14:11:55. The executive snapshot's authoritative aligned-completion marker matches the work completion. The date remaining October 20 is consistent with the configured previous-day cutoff. This closes the pending Batch 2 Ptomo scheduled-publication freshness check; it does not certify every metric, other campaigns, provider configurations or all downstream outputs.

**Ptomo page finishes updating: PASSED (user-reported October 21).** The afternoon screenshot captured `Updating displayed figures. Some sections may still show the previous update.` Asked whether it disappears after keeping the page open for a minute, the user confirmed: **"Yes, it disappears"**. Current `client/src/pages/ga4-metrics.tsx:1882-1923,6805-6809` renders that message while publication-query invalidation or matching page requests are pending; it is distinct from the failed-refresh message. `server/routes-oauth.ts:9452-9485` reads the persisted aligned publication/version for the page's status polling. The backend completion above is independently proven; completion of the visible loading state is user-confirmed, without an independently measured duration or browser network trace. Summary/financial values in the afternoon screenshots match the morning screenshots. No runtime changes, manual refresh, provider requests or production writes were performed by this check.

The complete-suite/CI/Clerk/dependency status is maintained in [Batch 8](../v1-batch-8/README.md#latest-validation-and-release-gates). All 65 Batch 2 test-file cases pass in the latest full run; required acceptance below remains open.

**Remaining live acceptance:** Ptomo's displayed Overview, the Batch 2 14:00 scheduled-publication freshness check and disappearance of the page's updating message have passed within the evidence boundaries above. Detailed value reconciliation and other page/action checks remain open. Real customer Google consent/property selection/reconnect/cancel and an isolated new-customer campaign lifecycle also remain required. Public SignUp-to-SignIn navigation is verified; full account access is not. Provider permissions, the complete value matrix, historical cleanup and remaining batches retain their existing open gates. No further scheduled-refresh wait or updating-message confirmation is required for this particular Ptomo check. The whole-app release decision remains **NO-GO**.

Provider contracts used for discovery: [Admin accounts pagination](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/accounts/list), [Admin properties pagination](https://developers.google.com/analytics/devguides/config/admin/v1/rest/v1beta/properties/list), [Data API paging](https://developers.google.com/analytics/devguides/reporting/data/v1/basics). The existing source architecture is preserved. Future providers still require their own permission, pagination, metric, attribution, date and quota validation.

## Scope and acceptance

Stop fabricated startup facts; fail-closed schema readiness, fresh/upgrade constraints and safe migration manifest; exact client-delete concurrency; signup routing; complete Details persistence, draft creation recovery and all exit cleanup; staged reconnect/cancel preserving selected property/history; complete account/property/campaign discovery with truthful errors; no fabricated real-status fallback. Fresh-owner and lost-response/restart tests.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) ownership, credential and grant safeguards. Coordinate discovery/query boundaries with [Batch 3](../v1-batch-3/README.md), source imports with [Batches 4](../v1-batch-4/README.md), [5](../v1-batch-5/README.md) and [6](../v1-batch-6/README.md), and hosted recovery/release validation with [Batch 8](../v1-batch-8/README.md).

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Startup schema and migrations](../../audits/v1-2026-10-19/STARTUP_SCHEMA_AND_MIGRATIONS.md)
- [Campaign wizard browser lifecycle](../../audits/v1-2026-10-19/CAMPAIGN_WIZARD_BROWSER.md)
- [Financial contracts and GA4 onboarding](../../audits/v1-2026-10-19/FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md)
- [Current application journey](../../CURRENT_APP_SECTIONS.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-007](#v1-007) | P0 | VERIFIED LOCALLY | OPEN |
| [V1-009](#v1-009) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-017](#v1-017) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-023](#v1-023) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-037](#v1-037) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-038](#v1-038) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-039](#v1-039) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-076](#v1-076) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-080](#v1-080) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-081](#v1-081) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-091](#v1-091) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-092](#v1-092) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-093](#v1-093) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-124](#v1-124) | P1 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-007

**Severity:** P0. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code, persisted impact unknown):

`server/index.ts:84–165,1196`: on empty `metrics`, startup inserts demo metrics and then updates **all** campaigns with zero/null impressions and clicks with fabricated spend/revenue/conversions and `status='active'`. No owner/demo/environment restriction. This can activate drafts or paused zero-traffic campaigns and feed their schedulers. No database seed executed by this audit. Existing affected rows require a separate read-only damage inventory, never a blanket rewrite.

**Implemented correction and exact files:** `server/index.ts`: removed `seedDashboardData` and its startup invocation, including the unrestricted update that fabricated campaign values/status.

**Validation and remaining release boundary:** Actual startup callback against isolated PostgreSQL leaves empty analytics tables empty and preserves historical fixture values/status/currency. The restored-data inventory identifies four unowned demo-fingerprint metric rows; the global campaign seed references absent production columns. Exact historical write provenance and the targeted cleanup decision remain open; no cleanup was performed.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-009

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code):

`server/index.ts:254–270`: HTTP listener and `/health` become ready before delayed migrations; migration failures are logged and startup can continue. `render.yaml` uses `/health`. Liveness does not prove required schema or schedulers. Fresh install, upgrade, concurrent boot, failed migration and rollback remain required isolated/deployed gates.

**Implemented correction and exact files:** `server/index.ts`: HTTP remains 503 until schema work and worker registration succeed; initialization errors exit rather than declaring readiness. Existing inline migrations run in one transaction with a database advisory lock; only reviewed additive files 0022-0024 are included.

**Validation and remaining release boundary:** Fresh, repeat, concurrent, missing/incomplete schema, duplicate facts, rollback and worker-registration failure scenarios pass. Workers/providers are stubbed in the startup harness. The production-backup clone rehearsal passes; deployed revision/readiness and the exact live schema are now verified. Controlled deployed failure/recovery acceptance remains a separate operations gate.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-017

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed browser and code):

`/sign-up` renders “Sign in” linking back to `/sign-up`; `client/src/App.tsx:74` passes the wrong `signInUrl`. Existing-account recovery from signup loops. Deployed DOM evidence saved.

**Implemented correction and exact files:** `client/src/App.tsx` / `AuthPage`: SignUp's existing-account link targets `/sign-in`, correcting the `/sign-up` loop.

**Validation and remaining release boundary:** Current route-prop regression and actual deployed SignUp -> SignIn navigation pass. Full customer account access remains tracked separately under V1-013.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-023

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated PostgreSQL reproduction):

`storage.ts:6742` lists client campaigns before entering the deletion transaction; `routes-oauth.ts:9061-9073` client validation and campaign insert are separate, with no client FK in `shared/schema.ts:27` or tracked migrations found. Concurrent creation between enumeration and transaction survives successful client deletion as an orphan. Exact method reproduced against disposable schema; production data not inspected. Preserve campaign/owner boundary and coordinate creation/deletion in existing storage pattern.

**Implemented correction and exact files:** `server/storage.ts`: client ownership lookup, child enumeration and deletion now occur under the same parent-row lock/transaction. Campaign creation locks the owned parent. `shared/schema.ts` and migration0024 add the client FK.

**Validation and remaining release boundary:** Real PostgreSQL create-first/delete-first races, foreign-owner rejection, child failure rollback and unrelated-client preservation pass. Existing orphan rows are preserved by the upgrade FK's `NOT VALID`; new writes are enforced. No live orphan cleanup.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-037

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed reconnect/cancellation reproduction):

OAuth callback11090-11110 creates empty-property replacement, promotes it and deletes all old connections/snapshots before property selection, including when discovery failed. UI Cancel561 only resets local state. Reselecting same prior property now assigns fresh30-day import start because pending row has empty propertyId (route16181). Exact callback fixtures prove premature deletion; actual provider/browser recovery remains required. Stage/commit renewal safely within current flow and preserve prior scope/history.

**Implemented correction and exact files:** Primary and retained GA4 callbacks now stage encrypted **inactive** authorization. Both property selectors use the same handler in `server/routes-oauth.ts`; `server/storage.ts` commits only the confirmed property atomically. Same-property reconnect preserves connection ID/import start/snapshot; changing property clears only the replaced property's Overview snapshot and retains daily history. `GA4ConnectionFlow.tsx` explicitly cancels the exact pending authorization.

**Validation and remaining release boundary:** Actual storage PostgreSQL tests cover stage, cancellation, restart, expiry, superseded authorization, tenant boundary and history preservation. Actual route and browser fixtures cover provider rejection and cancellation failure/retry. Pending consent lasts30minutes and is excluded from active-source reads/jobs; a later authorization replaces abandoned pending rows. Live Google reconsent remains external.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-038

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed discovery pagination gap):

Primary GA4 callback11046, status12936 and real-ga4-client265 ignore accounts/properties nextPageToken. Exact callback fixture supplies both tokens and confirms no pagination. A new customer's later-page property cannot appear in selector. Independently verify full account/property discovery, permissions, bounded retries and quotas; do not certify only small tester accounts.

**Implemented correction and exact files:** `server/real-ga4-client.ts::fetchPropertiesFromGoogle`: walks every account/property page, deduplicates exact property IDs, validates responses/tokens, and bounds requests/retries. Callbacks/status/selectors share that implementation.

**Validation and remaining release boundary:** Multi-page, duplicate, repeated-token, later-page error, 401/403/429/503 and transient-retry fixtures pass. Limits are200pages/60seconds with explicit failure, never silent partial success.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-039

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed status/fallback reproduction):

`real-ga4-client.ts:198-258` supplies fabricated properties when live discovery empty/fails; status12891 reports those as Real Google Analytics API and connected without consulting DB. Delete16075/storage1166 do not clear corresponding process maps. Exact method/handler fixture confirms fabricated choices and zero DB reads with empty persisted fixture. Current callback populates this cache and current connection flow reads it. Remove false-real fallback and prove disconnect/restart/cache reconciliation.

**Implemented correction and exact files:** `ga4-connection-status` reads persisted pending/active rows before any cache. Absence and disconnect clear all campaign process caches. Real property discovery no longer invents fallback properties. The retained OAuth callback also requires real durable credentials and persists pending authorization.

**Validation and remaining release boundary:** Database-absence/stale-cache, genuine empty result, provider failure, guarded active-token renewal and no-mock discovery tests pass. Existing temporary Ptomo service-account access is retained; new customers use Google sign-in without per-customer Render settings.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-076

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 selection incompleteness/failure concealment):

`analytics.ts:2576–2766` ignores campaign-discovery rowCount after200, and seven429 failures return an ordinary empty list; route13308 labels success. Two exact-service cases. `GA4ConnectionFlow.tsx:382–475` offers manual entry only for an empty list, so missing names cannot be added to a populated truncated list there. Separate from property pagination; verify complete/truthful discovery, failure state and selection in initial setup and reconnect.

**Implemented correction and exact files:** `server/analytics.ts::getCampaignValues`: deterministic dimension paging follows `rowCount`/offset and rejects incomplete or changing result sets. Bounded retries/timeouts replace swallowed quota/server errors. Both selectors show failures and permit exact manual UTM names alongside discovered values.

**Validation and remaining release boundary:** 451-choice fixture, paginated URL fallback, missing/duplicate pages, changed counts, oversized results, auth renewal followed by quota failure, and actual manual-entry browser checks pass. Bounds are200report pages in total,40000rows per dimension and120seconds, with at most3 attempts per page; exceeding them reports failure. If every discovery dimension is unsupported, the result is unavailable rather than empty. Existing dimension priority/merge semantics and picker date window are preserved; this is not analytics formula certification.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-080

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed schema/migration reproducibility failure):

Generated62-table schema plus two startup passes leave four daily upserts failing42P10; historical repository-configured DB has those indexes. Running all27 retained migration files twice additionally reproduces0003:47 failing42704: GIN index over current TEXT notifications.metadata.52/54 file executions succeed; two concurrent startup callbacks complete on the fixture schema. [Exact results and caller limits](../../audits/v1-2026-10-19/STARTUP_SCHEMA_AND_MIGRATIONS.md). These are fresh/upgrade reproducibility defects, not proven missing live indexes or a live0003 outage. No blind cleanup/constraint changes.

**Implemented correction and exact files:** `shared/schema.ts`, migration0024 and generated `migrations/v1-bootstrap.sql`: four daily upsert business-key indexes plus a complete empty-database baseline. Migration0003 now accepts existing TEXT notification metadata and creates GIN only for existing JSONB.

**Validation and remaining release boundary:** Four actual upsert methods accept replay without duplicate facts; fresh/historical schema and invalid duplicate-history rollback pass. `scripts/generate-v1-bootstrap.cjs --check` checks87statements against the current shared schema. Read-only production inventory confirms zero duplicate daily keys and the production-backup clone upgrade passes; no automatic deduplication.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-081

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained migration replay/currency hazard):

`migrations/0006_add_daily_spend_revenue_granularity.sql` duplicates synthetic financial rows on rerun and relabels EUR campaign values USD. Real isolated fixture yields Revenue200 from100 and Spend40 from20 after two runs. Not called by current startup; active-source readers may exclude these orphans. Exclude unsafe historical backfill from deployment/restore recipes and inventory any prior damage separately.

**Implemented correction and exact files:** Migration0006's replayable synthetic USD revenue/spend inserts are retired. Historical cleanup/backfill files are excluded from the startup manifest.

**Validation and remaining release boundary:** Replaying0006 twice against historical EUR fixtures creates no financial rows. The restored-data inventory identifies 3,267,568 unmatched retired-backfill spend rows, none for Ptomo. Historical provenance/cleanup remains open; no values or currency were rewritten.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-091

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: browser-confirmed draft edit divergence):

`campaigns.tsx:494–504,656–660,1809–1811`: Back edits update confirmation state but PATCH only budget/currency; changed name/timezone/website/label are unsent. Current browser shows Changed Name while fixture persistence retains Original Name/UTC. [Exact requests and boundary](../../audits/v1-2026-10-19/CAMPAIGN_WIZARD_BROWSER.md). Preserve every editable field through activation/reload.

**Implemented correction and exact files:** `client/src/pages/campaigns.tsx`: Back/Next persists all reviewed Details, including name, website, label, budget, currency and reporting timezone.

**Validation and remaining release boundary:** Real component/browser fixture checks the persisted values and confirmation, with immediate Back sequence preserved. API contracts remain in the existing PATCH route.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-092

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: browser-confirmed cancellation leak):

`campaigns.tsx:1358–1360` Details Cancel bypasses `883–885` cleanup after Back; fixture records zero DELETEs and one hidden draft. Platform Close is a passing cleanup control. Actual list `routes-oauth.ts:9000–9014` hides ordinary unsubmitted drafts. Cover every exit and retain accepted-import protection; historical cleanup requires a separate exact boundary.

**Implemented correction and exact files:** All wizard exits await scoped cleanup and retain the dialog/identity on failure. `cancelCampaignCreation` records cancellation under the owned client/request lock and rejects active/accepted-import deletion.

**Validation and remaining release boundary:** Details Cancel, dialog Close, failure/retry and close-during-save browser scenarios pass. Actual PostgreSQL proves cancellation-first and create-first races cannot leave/recreate a draft, and active/accepted-import protection remains enforced.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-093

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: browser-confirmed duplicate draft requests):

`campaigns.tsx:516–547,1365–1369` permits overlapping initial POSTs and loses identity after an accepted request's response fails; two fixtures produce two drafts and only one cleanup target. Actual POST9037/storage690 have no idempotency lookup. Later async-import recovery does not cover this earlier stage. Prove duplicate/lost-response recovery at owner/client scope.

**Implemented correction and exact files:** UI submission lock plus a tab-persisted UUID; `campaign_creation_requests` stores owner/client/request identity independently of the draft. POST replay returns the original campaign; cancelled/deleted requests cannot recreate it. The table is necessary to remember cancellation after deletion, and cascades only with its owning client.

**Validation and remaining release boundary:** Concurrent POST/replay/restart, lost-response retry/reload, foreign-owner/client isolation, retirement and delayed-creation cancellation tests pass. No new package/framework. Requests without the optional creation identity retain the existing API contract.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

### V1-124

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed scheduler configuration/repeated-start hazards):

`google-ads-scheduler.ts:398–410`, `google-sheets-token-scheduler.ts:168–207`, `scheduler.ts:862–900`: invalid hour/frequency settings normalize to1ms intervals; duplicate Ads starts and Sheets starts before delayed handle installation register duplicate work. [18 current-function cases plus Node controls](../../audits/v1-2026-10-19/CONFIGURATION_AND_RECOVERY.md). Defaults/snapshot repeated-start controls pass. Validate settings and reserve handles in existing starts; deployed occurrence unknown.

**Implemented correction and exact files:** Existing Ads/Sheets/snapshot schedulers reject invalid intervals/frequencies, prevent repeated timer registration and cancel delayed startup timers on stop.

**Validation and remaining release boundary:** Actual timer implementations exercised with invalid/overflow/fractional values, defaults, repeated start, stop and restart. Does not certify distributed worker ownership; that remains in the existing operations queue.

**Implementation revision:** `839bf508bffea4742f992616753dc68eabcfab3e`. Latest batch validation is linked above; this finding remains open for release.

## Implementation validation history

These are recorded checkpoints; the latest validation above supersedes earlier suite counts and deployment prerequisites. Raw evidence is unchanged.

Detailed local evidence: [verification summary](verification-summary.json), [PostgreSQL scenarios](postgres-results.json), [wizard browser](wizard-browser-results.json), [Google onboarding](onboarding-results.json), [GA4 connection browser](ga4-flow-browser-results.json), [GA4 route/provider tests](ga4-focused-results.json). These execute current implementations with isolated identities, database schemas and provider responses; they do not claim a live customer Google session or live import.

Validation history is retained: the initial full run skipped697 opt-in PostgreSQL cases; the next enabled run executed4136tests:3954passed,182failed,0skipped. Every one of those182 failures matches an existing open audit failure, with no waiver. Five additional failures in the initial run asserted the replaced implementation (pre-transaction deletion checks, destructive reconnect ordering, inline selector handlers, old cleanup variable); their assertions were updated and the intended behavior is covered by executable database/route/browser tests. The initial migration rollback check exposed nested BEGIN/COMMIT in historical additive files; removing those wrappers inside the outer transaction fixed it, and rollback was rerun successfully. Final runtime verification: the [full candidate suite](candidate-suite.json) executed4154tests:3971passed,183failed,0skipped. Of those,182 match the still-open audit failures. The remaining failure was a state-signing fixture that depended on the removed demo OAuth URL when Google was unconfigured; the fixture now supplies a synthetic configured provider URL, and its [focused rerun](oauth-state-fixture-final.json) passes. The [whole affected-file rerun](oauth-fixture-file-rerun.json) executes52tests:37pass,15existing audit failures,0skipped; the signing case passes. This leaves182 open audit failures and0 newly unresolved failures. The full-suite JSON is preserved as emitted; it is not rewritten to report a green run.

The [failure reconciliation](failure-reconciliation.json) retains every failed test's stable identifier, exact test path, associated finding, classification, current error and release impact. No existing failure is waived as old/redundant. [Final targeted/neighbor checks](focused-final.json):143passed; the added all-unsupported-dimensions negative case also passes in the candidate suite. [TypeScript](typecheck-candidate.log) and [production build](build-candidate.log) exit0. Build output retains existing bundle-size/Browserslist/dynamic-import warnings; Vitest reports the existing node-cron missing-sourcemap warning. These are not claimed fixed by Batch 2.

Final fixture totals:10 actual PostgreSQL scenarios,8 wizard browser scenarios,3 GA4 connection browser scenarios and13 onboarding route/browser scenarios pass. All Batch 2 scratch schemas were removed and the isolated PostgreSQL process was stopped. [Candidate file hashes](candidate-files.json) bind the validated code/tests/migrations to the Batch 2 change set committed as `839bf508`. Those hashes match the files after final review. No remaining Batch 2 implementation failure is being reclassified as an external provider gate; the remaining gates below genuinely require deployed configuration, real provider access or historical-data evidence.

**Batch 2 database deployment safety check: PASSED within the boundaries below (October 21).** The [read-only production inventory](deployment-preflight.json) verifies TLS, the user-confirmed Render database, zero duplicate keys for all four daily tables, no orphaned non-null client links and no campaign/client owner mismatches. The 34 historical campaigns without a client remain untouched; the nullable FK preserves them. The three retained startup data-cleanup statements matched zero rows at preflight. At that pre-deployment checkpoint, HEAD and remote main were `afce1ced06c8ecfcf2178be4a33a9c0148214dc6`, and live health reported `4522f83486a28ebbf1fe6152f1053fdc83565223`; these are historical revisions, superseded by the deployed Batch 2 revision above. All 35 candidate code/test/migration hashes matched. No runtime changes were made during this check.

The [encrypted backup and restore](backup-restore-results.json) passed. A complete logical backup was read from production and restored to an isolated local database. The [actual startup rehearsal](production-clone-results.json) checks all 70 existing tables / 5,909,012 rows: initial upgrade, repeat upgrade, injected migration failure with rollback and successful retry, and previous-runtime startup with only synthetic seeding removed. Every existing table retains its row count and both full-row multiset fingerprints in every comparison. The new request table, five expected unique indexes and campaign-client FK are present. Initial/repeat schema execution took 1440ms / 214ms locally; these are not Render latency or live-load guarantees. Provider calls and actual workers were not started. Production runs PostgreSQL17.9; the local restore runs PostgreSQL18. The SQL/data rehearsal does not certify managed-service restore permissions, point-in-time recovery, retention, live lock contention or the whole application.

**Historical data finding, not an automatic cleanup:** the [local restored-data inventory](historical-data-inventory.json) found 3,267,568 USD spend rows with the retired `linkedin_daily_metrics` source identifier, all without a matching source and none belonging to Ptomo. Four unowned metric rows exactly match the old demo fingerprints. These are bounded historical cleanup candidates; the precise write history and every downstream consumer remain unproven. Current `getSpendTotalForRange` and `getSpendBreakdownBySource` require a matching active source and therefore exclude these unmatched records. No records were deleted, merged or relabelled. V1-007/V1-081 remain open for the separately reviewed historical-data decision. A specific design/code contradiction is now established: the removed global campaign seed UPDATE references `conversions`, `revenue` and `health`, which are absent from the current production campaigns table; that statement cannot successfully run against this schema. This narrows the current evidence and is not proof that older database revisions were never affected.

**Rollback boundary:** preserve the additive schema. A locally generated rollback source based on `afce1ced`, with only `seedDashboardData` and its invocation removed, passes the startup/data-preservation rehearsal; its SHA256 is in the clone result. Do not deploy the unmodified old runtime and reintroduce seeding. This is startup/schema compatibility evidence, not a completed application rollback deployment. The encrypted backup and DPAPI-protected key remain in the user-only, Git-ignored `audit-temp/v1-batch2-predeploy-private` directory. Decryption depends on this Windows account; full hosted backup/restore and rollback operational acceptance remains Batch8.

**Render timing configuration check: PASSED (user-confirmed October 21).** The user confirmed that `GOOGLE_ADS_REFRESH_INTERVAL_HOURS`, `GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS` and `SNAPSHOT_FREQUENCY` are absent on Render. The existing defaults apply: Ads every4hours, Sheets tokens every24hours after its initial timed start, and daily snapshots. No settings were added or changed. The Batch 2 database/configuration preflight is complete; commit/push and live acceptance are tracked separately.

Preflight harness failures are retained and classified: the first aggregate query assumed a legacy campaign column absent from production (42703), the first libpq backup could not verify TLS with its system-root selection, the first clone guard compared an IPv4 address including its /32 suffix, and the rollback-source builder initially matched both the enclosing startup try-block and the immediate seed try-block. The corrected checks use schema-aware inventory, the same public CA roots as the verified Node connection (TLS verification remains enabled), PostgreSQL's host() address representation, and the exact direct seed invocation. All affected steps were corrected and rerun; the three successful clone scenarios were retained when only the rollback builder changed, with all 35 candidate hashes rechecked. No application behavior was changed to make the checks pass.

**Deployed Batch 2 evidence:** [live health/schema/Ptomo check](deployment-after.json), [anonymous browser navigation](deployed-public-ui.json), [Sign In screenshot](deployed-sign-in.png), and [deployment observations](deployment-status.json). Render reports the exact runtime commit above. The request table, five named indexes and client foreign key exist in the live database. Five protected APIs reject anonymous reads with401. Ptomo's campaign and connection configuration fingerprints match the pre-deployment baseline: one active GA4 connection and its exact service-account grant remain, with47daily rows and native/financial publications through October20. These checks used read-only SQL and public GETs; they did not edit Ptomo, trigger a provider refresh, or submit a customer form.
