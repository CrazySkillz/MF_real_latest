# Batch 4: Files, Sheets and Custom Integration

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 4 status

**IN PROGRESS.** Twenty-two corrections are VERIFIED LOCALLY within their stated boundaries: the fifteen earlier corrections plus V1-028/029/031/102/103/111/120 below. The latest five standalone Sheets corrections below are **committed in `5bc33828a6abb738dda75fd09d0196bc82c548e6`**, on base `fb1132a2`; deployed in `221382da` with public checks passed and authenticated/provider acceptance open. Two implementation findings remain: manual Spend / transfer safeguards V1-068/069. The seven Custom Integration corrections below are uncommitted and not deployed. All 24 release acceptances remain OPEN. The deployment includes the earlier selection correction; public checks do not certify source values or full V1 acceptance. No production/Ptomo/provider access or historical-data cleanup was performed for this group.

## Custom Integration correction checkpoint (October 23)

### Pre-deployment compatibility decision (October 23)

**Check COMPLETE; the compatibility hold is CLEARED by the user's explicit acceptance below.** The user confirmed that the old figures in the two identified Mailgun test campaigns are no longer needed and may become unavailable after deployment. This accepts that exact visibility change only; it does not authorize deletion, rewriting or promotion of unverified data. [Recorded decision and validation summary](validation-2026-10-23-custom-integration/compatibility-decision.json). V1-029 remains open for release, and the two remaining implementation items are V1-068/069. No runtime code, production data or schedules were changed during this check; nothing was committed or pushed.

The [production read-only inventory](validation-2026-10-23-custom-integration/predeploy-compatibility.json) and [surviving campaign dependencies](validation-2026-10-23-custom-integration/predeploy-current-dependencies.json) ran at 14:29-14:31 Europe/Amsterdam. The database target hash matches the user-confirmed production database from Batch 3. Both queries used TLS verification, database-enforced READ ONLY transactions, bounded timeouts and ROLLBACK. The public health endpoint still reports healthy runtime `221382da751b453b4d45411df65f15a62750c9b1`; the new guards are not deployed.

| Existing state | Deployment impact / decision |
|---|---|
| Ptomo: zero Custom connections and zero Custom metric rows | No existing Ptomo value depends on the changed Custom validation gate. This does not recertify all Ptomo or GA4 behavior. |
| Two active, owned Custom campaigns hold three metric rows from November 2025; both latest rows have null parser metadata | Their current Custom figures would become unavailable; the user explicitly accepted this after the campaigns were identified by name. Campaign hashes `44eab1005dca...` and `f2187aa9cfed...` are fully recorded in the dependency evidence. Both lack a client, but `ensureCampaignAccess` checks campaign ownership and permits the owner; the active-campaign scheduler also still selects them. Their disposition is explicit user acceptance, not an assumption that they are inaccessible or redundant. |
| Those two campaigns have zero KPIs, Benchmarks, saved reports, report snapshots or enabled report/KPI schedules; they have 5,222 and 5,231 metric snapshots | No saved report is being deleted or directly blocked by this check. The current-value aggregate would stop consuming their old Custom metrics; existing metric history remains stored. Complete historical/current downstream reconciliation remains open under the existing Batch 7 gates. |
| Another surviving Sheets campaign has a Custom connection but zero Custom metrics, one KPI and one enabled report | There is no previously readable Custom metric to suppress for that campaign. Its unrelated KPI/report is not changed or disabled; its full acceptance remains separate. A fourth surviving Custom connection also has no metrics. |
| Global Custom inventory: 20 connections, including 16 without a campaign; 76 metric rows, including 73 without a campaign; zero Custom saved reports/snapshots/goals and zero inbound receipts | These are existing data-quality observations, not cleanup authorization. The ten latest-import campaign keys in the first inventory include orphaned keys; only two surviving campaigns currently hold imports. No record was deleted, rewritten, reassigned or marked validated. |

**Exact code boundary:** `server/storage.ts:hasValidatedCustomIntegrationMetadata/getLatestCustomIntegrationMetrics` selects the newest row by `uploadedAt DESC, id DESC` and rejects metadata without validation version 2. Current owner-guarded `/api/custom-integration/:campaignId/metrics` returns 404, the retained Custom page withholds its metric sections and leaves Upload Report available, and the scheduled Custom PDF builder returns no artifact. The scheduler's required-source-artifact guard prevents a missing Custom PDF from being emailed. Shared aggregate readers in `server/scheduler.ts` and `server/routes-oauth.ts` also stop receiving those unverified metrics. The unused raw/history getters remain unchanged and have no current runtime callers outside storage. These are deliberate accuracy safeguards; the user accepted their effect on the two identified old campaigns. There is no automatic promotion of old values, and the acceptance does not extend to other customers or future imports.

**Recovery and rollback:** the persisted rows contain parsed values and file/email references, not proof that the original bytes pass the corrected parser. Original-file availability and successful reparse remain unverified. The user's acceptance removes original-file recovery as a pre-push requirement for these two old test campaigns only; any future recovery must use the exact original source through the validated import path. Do not synthesize version-2 metadata from old confidence/values. No schema, dependency or environment change is required, but reverting the code would reopen the known unsafe parsing/read paths and is not a certified rollback.

**Local recovery evidence:** [22/22 PostgreSQL checks pass](validation-2026-10-23-custom-integration/compatibility-recovery.json), including a new null-metadata historical-row case: invalid replacement preserves the exact old row; valid publication restores the latest value while preserving all old fields and unrelated campaign data. This proves storage recovery, not successful reparse of the real archived files. [TypeScript, fixture cleanup and candidate comparison](validation-2026-10-23-custom-integration/compatibility-local-checks.json) pass; both local databases have zero fixture schemas, other clients and advisory locks, and the test cluster was stopped. The [current manifest](validation-2026-10-23-custom-integration/compatibility-manifest.json) changes only the recovery test from the previous 11-file candidate; runtime hashes are unchanged. Earlier 87/87 Custom, 268-pass/six-failure expanded and historical whole-suite evidence retains its original scope; no failure was waived and no whole-suite count was inferred.

Commands: `node .../predeploy-compatibility.cjs`, `node .../predeploy-current-dependencies.cjs`, `node .../run-tests.cjs compatibility-recovery server/v1-batch4-custom-storage-postgres.test.ts --local-pg`, and `node .../compatibility-local-checks.cjs`, where `...` is this batch's `validation-2026-10-23-custom-integration` directory. Evidence scripts output counts/hashes, not credentials, raw customer identifiers, email addresses or imported values. The read-only inventory establishes the current deployment impact; it does not close browser/provider, full downstream, operational or release gates.

**Local forward fixes complete for V1-028/029/031/102/103/111/120. Uncommitted on `221382da751b453b4d45411df65f15a62750c9b1`; not deployed.** [Exact 11-file candidate](validation-2026-10-23-custom-integration/candidate-manifest.json), [assessment and every classified failure](validation-2026-10-23-custom-integration/assessment.json). This changes retained Custom Integration code; it does not enable its hidden campaign wizard/card, change GA4/Ptomo, or certify the source or Batch 4 for release.

| Finding | Confirmed root cause and exact corrected path | Local evidence |
|---|---|---|
| V1-028 | `server/services/custom-integration-file-parser.ts` (`parseDelimitedMetrics`, `metricsFromTable`, `applyMetricValues`, `parseMetricNumber`): non-strict capped CSV reads, overwritten duplicate headers, partial numeric parsing and guessed value columns. Complete strict tables now reject overflow, duplicates/competing aliases, missing/invalid values, ambiguous metric/value columns and unsupported precision/ranges before publication. Report-style/headerless formats retain bounded supported parsing. | All 5,000 data rows, rejection at 5,001, malformed/mixed-currency/duplicate inputs, explicit zero, all 28 fields, supported grouped numbers and XLSX duplicates. |
| V1-029 | `server/routes-oauth.ts: normalizeCustomIntegrationMetrics` and all five ingest callers; `server/storage.ts: createCustomIntegrationMetrics/getLatestCustomIntegrationMetrics`; Custom page and `server/report-scheduler.ts: buildCustomIntegrationScheduledPdfAttachment`. Review warnings previously persisted and propagated as validated data. Validation now precedes publication (and manual connection creation); current-version metadata is required at the shared write/read boundary. Late manual writes retain exact integration identity. | Invalid replacement preserves good rows; missing/old/review-required metadata cannot publish or become the latest validated result. Actual PDF builder rejects unvalidated imports. Browser/scheduled output explicitly identifies latest-import/all-history values, without claiming a calendar-window import total. |
| V1-031 | `POST /api/custom-integration/transfer` now calls `server/storage.ts: transferCustomIntegration`. The previous copy/delete sequence destroyed a same-ID source and omitted metadata/timestamps. The transaction locks both owned parents in stable order, rejects same/missing/foreign/deleted/occupied/mismatched-currency destinations, and moves original rows plus replay receipts. Related connect/delete writes use the same parent lock. | Actual PostgreSQL same-ID/owner/destination/currency tests, rollback on final write failure, concurrent transfers, late token writes, replay dedupe, unchanged row IDs/timestamps/parser metadata and neighbor preservation. The special `temp-campaign-setup` metric exclusion remains. Repeating a completed transfer fails safely; it does not duplicate data or falsely return success. |
| V1-102 | `readZipEntries/parseWorksheet` previously inflated arbitrary ZIP entries. Limits now bound compressed input (10 MiB), entries (256), aggregate expanded bytes (10 MiB), rows (5,000 data plus header), columns (200), and cells (1,000,000). Entry boundaries/methods/declared versus actual expanded sizes reject incomplete input; inflate itself is bounded. Existing Custom multer now permits one report, at most 10 MiB, with the existing 40-field/128-KiB-per-field/45-part caps. | Bounded 12-MiB expansion fixture rejected before inflation; excess-entry/input controls; actual Express/multer request accepts one report and rejects a second attachment before the handler. Prior signature/download checks still pass. No exhaustion or production load test was induced. |
| V1-103 | `parseXlsxMetrics` previously selected by ZIP order. It now follows workbook relationships to the sole visible worksheet; missing metadata, multiple visible sheets, external/invalid targets, duplicate cells, formulas/merged cells and invalid shared strings fail closed. | Identical workbook in reversed archive order returns the same visible value (10), never the hidden value (200); ambiguous workbooks and duplicate headers reject. |
| V1-111 | Custom page revenue/spend queries and `buildCustomIntegrationFinancialReportMetrics` replaced failed/malformed totals with usable zero and combined partial spend with imported spend. Success/finite-value/read-error gates now control cards, goal/Insight resolvers and browser/scheduled financial output. A failed current read invalidates stale success; source dialogs disclose unavailable totals. | Actual page query/transformation tests: HTTP/JSON/value failures, stale error flags, partial spend, genuine zero, loss, zero denominators and positive ratios. Actual report helper and generated PDF show unavailable values after failed reads; genuine zero retains ROI -100%. |
| V1-120 | CSV/XLSX aliases and `server/services/pdf-parser.ts` mapped sent to delivered, opens to rate, exits to bounce and new subscribers to net growth. Ambiguous aliases and substring matching are removed; percentage/count/duration semantics are explicit. Distinct users/reach require a single total instead of summing unknown overlap. PDF duplicate/prefix-malformed values reject. | Original ambiguous label controls, PDF controls, all 28 canonical fields/zero states, explicit traffic percentages, non-additive users/reach and integer count constraints. No denominator or historical allocation is invented. |

**Validation:** [Expanded result](validation-2026-10-23-custom-integration/complete.json): **274 tests, 268 passed, six failed, zero skipped**. [Final Custom boundary](validation-2026-10-23-custom-integration/boundary-final.json): **87/87 pass**, including 21 actual PostgreSQL cases, actual page query/transformation execution, a real generated PDF and a real local multipart request. [Final TypeScript/server checks](validation-2026-10-23-custom-integration/boundary-final-build-checks.json) and [client build](validation-2026-10-23-custom-integration/complete-build-checks.json) pass. Commands are preserved in the packet's `run-tests.cjs` / `run-build-checks.cjs`; they strip application credentials, do not load `.env`, and restrict test network access to localhost.

The six failures are **B4-TEST-d6f30a50b0, B4-TEST-1830eb645f, B4-TEST-bd45a0cac4, TEST-1ab264f494, TEST-6f00d61d48 and TEST-c8a51eca27**. They are source-text assertion mismatches in Sheets/Google Ads/manual-Spend tests; their intended behaviors and later unexecuted assertions still require repair/verification under V1-012. None is dismissed as an old baseline or waived. The assessment also records each intermediate fixture, encoding, parameterization, changed-assertion and compile failure and its correction. Historical full-suite counts remain 4,309 pass / 179 fail until another full run; this packet does not certify CI.

**Supported input/compatibility boundary:** CSV/XLSX monetary values are plain amounts in the campaign currency; explicit currency columns/symbols reject instead of conversion. PDF declared currency must match the parent campaign; Custom UI/report currency formatters now use that currency. Custom count storage remains integer-only: unsupported fractional counts reject rather than truncate. GA4's fractional conversions are unchanged. XLSX requires one visible worksheet and explicit values, without formulas or merges. Unknown/ambiguous metrics remain unavailable; unsupported values never become zero. There is no imported reporting-period field: latest validated import values and all-history added financial values are clearly labeled on the page and PDFs; calendar-window Custom import totals are not certified.

**Historical data/recovery:** old rows without `validationVersion=2` remain stored but are excluded from validated reads. An invalid new replacement does not erase a valid current import, and a newer unverified historical row does not silently fall back to older figures. The existing Custom page's Upload Report card remains available with no validated metrics, allowing exact original-source reimport. No historical row was modified/deleted outside disposable fixtures. Original-source inventory and any separately approved cleanup remain required; do not promote old parser confidence alone to proof.

| Lifecycle / downstream | Proven locally | Still open for release |
|---|---|---|
| Manual / token / email / Mailgun / SendGrid ingress | Shared current validation/normalization, write/read gate; exact manual integration identity; bounded input; existing signature/download tests | Live authorized browser uploads and real provider acceptance/retries/attachment layouts |
| Add / reconnect / edit / transfer / disconnect | Parent survival/locking, failed replacement preservation, transfer ownership/rollback/replay, late source-write rejection; same architecture and schemas | Complete deployed lifecycle and historical original-source inventory; broader account/connection acceptance |
| Latest API / page / source modal / totals | Latest-reader excludes unverified rows; query success/error and zero semantics; recovery upload remains on retained route | Authenticated DOM acceptance; full source-edit-to-all-output comparison |
| KPIs / Benchmarks / Insights / diagnostics / snapshots | Latest-reader gate applies to existing readers; page financial resolvers share availability; actual imported metric and report guards | Persisted goals/alerts and full downstream matrix [V1-122](../v1-batch-7/README.md#v1-122); diagnostic windows and historical snapshots remain unverified |
| Browser / scheduled reports | Latest-import versus delivery-window labels, currency formatting, actual scheduled PDF validation/failed-read cases | Browser PDF DOM/download acceptance, real scheduled delivery/inbox and full snapshot parity [V1-060](../v1-batch-7/README.md#v1-060) |
| Deployment / recovery / operations | No schema/dependency/environment changes; old records retained and safe reimport supported | Exact deployed revision/configuration, provider tests, load/backup/rollback/CI. Reverting these guards would restore known unsafe behavior |

[Fixture cleanup](validation-2026-10-23-custom-integration/fixture-cleanup.json) records empty test schemas/connections/locks and cluster shutdown. No production/Ptomo/provider request, email or data mutation occurred. **Next implementation work: V1-068/069 only.** Then required deployed/provider/full Batch 4 acceptance remains; all 24 release acceptances are OPEN. The earlier checkpoints below are historical within their dated scope.

## Standalone Sheets completion deployment verification (October 23)

At 13:05 Europe/Amsterdam (11:05 UTC), three public `/api/health` responses independently confirmed **`221382da751b453b4d45411df65f15a62750c9b1`**, `ok=true` and `nodeEnv=production`. It contains all five Sheets corrections in `5bc33828`. Homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. [Recorded results](deployment-2026-10-23-standalone-sheets-completion/public-verification.json) and [read-only checker](deployment-2026-10-23-standalone-sheets-completion/verify-public.cjs).

The scheduler is healthy and registered with unchanged 08:00/14:00/20:00 Amsterdam slots. The current process started at 12:58 Amsterdam; its next run is 14:00, through October 22, with no completed run in that observation. This proves registration, not successful natural refresh. No new Ptomo refresh wait is required before independent Batch 4 work.

**Passed:** expected live revision, basic readiness, homepage availability, signed-out access denial and scheduler registration. **Still open:** authenticated standalone Sheets UI/provider acceptance using an isolated test campaign, full lifecycle/downstream acceptance, natural refresh and remaining V1 gates. This check made no application mutation, authenticated campaign/Ptomo data read, provider request or manual refresh. Local runtime/test hashes remain unchanged. All 24 Batch 4 release acceptances remain OPEN.

**Corrected validation instructions after current-code trace:** standalone Sheets is not offered in the current customer navigation or campaign wizard. `client/src/pages/campaigns.tsx:183-187,623,1433` filters offered/saved platforms to `google-analytics`; `client/src/pages/campaign-detail.tsx:4977,5651` renders only Google Analytics cards. The later Sheets card JSX is unreachable through that filtered list. `docs/CURRENT_APP_SECTIONS.md` agrees. Earlier instructions asking the user to find a Sheets card or create a separate Sheets campaign through this UI were incorrect. Do not repeat them or enable a platform to make those instructions work.

The standalone route remains registered in `client/src/App.tsx:151`, its guarded GET in `server/routes-oauth.ts:21432`, and existing configured connections can still trigger retained reads at `campaign-detail.tsx:4689`. Hidden navigation is not an access control or agreed exclusion. The 129 final local boundary checks and the wider packet remain supporting evidence for those retained paths; they do not become live-provider acceptance. [Exact navigation boundary](deployment-2026-10-23-standalone-sheets-completion/navigation-boundary.json).

**User action now: none for standalone Sheets.** No browser or native app is connected to this session, and no authorized live standalone Sheets fixture has been established. Required authenticated/provider checks remain OPEN and need an isolated developer-controlled setup or a separately agreed and effectively enforced scope decision. They cannot be certified from a GA4 Revenue/Spend screenshot or satisfied by guessing a UI path. Do not ask the user to repeat Ptomo freshness checks. The subsequent seven Custom Integration corrections are now locally verified above; they did not enable hidden onboarding. Current remaining implementation is V1-068/069. No runtime feature, campaign, spreadsheet, exclusion or release status was changed by this correction.

## Standalone Sheets completion checkpoint (October 23)

**V1-051/108/112/113/114: VERIFIED LOCALLY for the corrections below; release acceptance OPEN.** V1-108's four-provider functional portions remain deferred under the existing scope decision. This completes the five-item implementation group, not whole-source or V1 certification. [Assessment](validation-2026-10-23-standalone-sheets-completion/assessment.json) records candidate hashes, every test failure and remaining boundaries; [candidate manifest](validation-2026-10-23-standalone-sheets-completion/candidate-manifest.json) identifies the originally validated runtime/tests. [Commit verification](validation-2026-10-23-standalone-sheets-completion/commit-checkpoint.json) binds all 16 unchanged runtime/test files to `5bc33828a6abb738dda75fd09d0196bc82c548e6`; dated pre-commit evidence remains unchanged. Public deployment checks pass on `221382da`; authenticated source/provider acceptance remains pending.

| Finding | Confirmed cause and exact changed path | Corrected behavior / local evidence |
|---|---|---|
| V1-051 | Main GET in `server/routes-oauth.ts` and `refreshGoogleSheetsDataForCampaign` in `server/auto-refresh-scheduler.ts` used `A1:Z1000`; old/partial cache could be marked fresh and aggregates ignored selected campaign rows. | Existing range utility now reads the exact tab's complete bounded grid, including columns beyond Z; a failed chunk or changed structure rejects publication. `server/storage.ts:updateGoogleSheetsConnection` atomically checks source identity, active parent and read ordering before replacing cache/freshness. `server/utils/google-sheets-aggregate-source.ts` requires complete fresh cache and applies saved selection before mapped totals. Real PostgreSQL tests cover stale/concurrent reads, reconnect/deactivation, missing parent and rollback; synthetic provider tests cover OAuth, full width, last row, empty results and partial failure. |
| V1-108 | `client/src/pages/google-sheets-data.tsx` and scheduled financial summaries required amounts greater than zero, conflating measured zero with no source. | Source/record coverage, successful reads and finite amounts determine availability. Measured zero remains zero; Revenue 0 / Spend 100 yields ROAS 0 and ROI -100%; zero Spend makes ratios unavailable. Failed/incomplete reads remain unavailable. The existing Spend API adds `configuredSourceIds` only for `google_sheets` so a connected source without records is distinguishable. Rendered-page and real PDF-builder fixtures verify these states. |
| V1-112 | Browser goal/report options consumed raw summed metric cells while Summary used derived values; cached reports independently summed rates and numeric IDs. | Existing `google-sheets-aggregate-source.ts` supplies the summary contract to the GET, cached reports and aggregates. Current browser options consume `summaryValue`, including null. Summary, goal displays, daily Insights and browser/scheduled PDFs retain Spend 190 / Clicks 110 = CPC 1.72727 rather than 10. Identifiers are excluded. Stored goal/alert refresh remains a separate V1-122 gate. |
| V1-113 | `server/report-scheduler.ts:buildGoogleSheetsCachedMetricSummary` ignored saved campaign selection and the declared date window; confirmed financials read 1900-2999. | Resolve one exact campaign-owned active general connection; apply its current saved campaign selection and the report's actual inclusive date window before calculation. Require an explicit mapped Date or unique exact Date header with valid YYYY-MM-DD values. Financial storage reads use the same window. Invalid source/cache/date coverage yields no PDF through the real wrapper, so the existing required-source-artifact gate prevents send/snapshot. Tests use actual PDF bytes without sending email. |
| V1-114 | Header order selected Budget before Spend; ambiguous inputs and unweighted percentage averages produced plausible incorrect results. | Unique recognized input headers or validated explicit mappings determine numerators/denominators. Budget is not implicit Spend; unknown/ambiguous rates are unavailable. Ratios derive from the same selected rows; weighted CTR uses total Clicks / total Impressions. Column order cannot redefine spend. Strict numeric parsing rejects mixed/malformed columns instead of silently publishing partial sums. |

**Files and architecture.** Runtime changes stay in the existing page, centralized routes, storage, scheduler and three existing utility files: `google-sheets-revenue-ranges.ts`, `google-sheets-aggregate-source.ts`, `googleSheetsSelection.ts`. No schema, dependency, framework, source onboarding redesign or schedule change. The larger route diff removes duplicated permissive calculation/read blocks and places the shared contract in the existing aggregate utility. Existing response fields remain present; corrected consumers use nullable `summaryValue`. The raw table renders 100 rows per page while totals retain all selected rows; numeric zero remains visible. Main GET still reads without persisting cache; the existing manual Refresh Now path and scheduled refresh publish it.

**Explicit contracts and limits.** Main analytics accepts at most **50,000 allocated grid rows including the header, 200 columns and 2,000,000 allocated cells**, using full-width 5,000-row chunks and a 45-second overall read deadline. Oversized or incomplete reads fail visibly, preserving saved state. A complete empty read replaces obsolete cached rows. Old caches lacking exact identity/completeness, or caches at least 25 hours old, are not trusted; normal refresh rebuilds them. No historical records are deleted or allocations reconstructed. Metadata is checked before/after reads for structural changes; Google does not provide an atomic multi-request cell snapshot here, so concurrent content edits still need provider acceptance.

Supported ratios: ROAS = Revenue / Spend; ROI = (Revenue - Spend) / Spend x 100; CPC/CPM/CPA/CPL/CAC use Spend divided by Clicks/Impressions/Conversions/Leads/Customers (CPM x 1000); CTR = Clicks / Impressions x 100, bounded to 0-100; the standalone sheet **CVR contract uses Conversions / Clicks x 100**. Denominators must be positive. Other rates/averages require a known contract and otherwise remain unavailable. Mapped conversion value retains the existing median/latest strategy, including zero; latest requires a valid saved date column. Plain/US-style numbers are supported; arbitrary locale formats are rejected, not guessed. Currency labels/normalization across the whole product remain V1-106, not certified by this correction.

**Validation.** The [final expanded packet](validation-2026-10-23-standalone-sheets-completion/final.json) contains **388 tests: 387 passed, one failed, zero skipped**. It includes actual registered handlers, current calculation helpers, one intercepted headless-browser scenario, real generated PDF bytes, 64 actual PostgreSQL lifecycle cases (four new cache-write cases), neighboring Sheets Revenue/Spend checks and auth/report regressions. All five-item correction tests pass. The [last boundary run](validation-2026-10-23-standalone-sheets-completion/final-boundary.json) passes 129/129 after a compile-time-only tuple annotation and correction of a mojibake euro test literal; no runtime logic changed after the expanded packet. [Final typecheck/server build](validation-2026-10-23-standalone-sheets-completion/final-types-build-checks.json) and the [client build](validation-2026-10-23-standalone-sheets-completion/final-build-checks.json) pass. The latter records the preceding tuple-index type error as well; it was corrected, not waived.

**Failure disposition.** The one remaining expanded-packet failure is **TEST-02680176f2 / V1-012**, `server/ga4-overview-campaign-breakdown-regression.test.ts:251`: it requires literal unconditional focus/background polling, while the unchanged GA4 query uses publication-status-dependent refresh and disables background polling. This is a current contract-verification gap, not a waived baseline or a proved runtime failure; a behavioral publication/focus/reconnect check is still required in Batch 8. Neither that GA4 page nor that assertion was changed. TEST-2e4c19942f now passes after replacing its obsolete source-string assertion with actual exact GA4 breakdown-resolver cases, including protected zero/pending values. Historical full-suite counts remain unchanged until a new full run. The assessment classifies every intermediate failure: PDF harness dynamic import, browser expectations/selectors, outdated cache/structural fixtures, real multi-connection false-success and token-renewal/source-change bugs, and compile errors. Both real refresh bugs were corrected and covered, including a pre-fix reproduction of the renewal race; no failure was ignored.

**Load and cleanup boundary.** The last supported data row (49,999 data rows plus header) and five concurrent synthetic 2,000-row reads pass locally. These are bounded correctness/load fixtures, not Render capacity or Google quota certification. [Cleanup](validation-2026-10-23-standalone-sheets-completion/fixture-cleanup.json) confirms both isolated databases at `127.0.0.1:55444` have zero remaining fixture schemas, other clients and advisory locks; the test cluster was stopped. No application credentials or `.env` were loaded, no provider request/email was sent, and no production/Ptomo mutation occurred.

| Lifecycle / downstream boundary | Proven locally | Still required for release |
|---|---|---|
| Create/connect/edit mappings | Existing saved contracts consumed; actual GET rejects wrong/ambiguous mappings and next reads honor changes. Browser mapping-open/cancel and dataset-switch behavior pass. | Real customer consent, provider permissions, actual mapping save/onboarding and full lifecycle acceptance. The browser fixture stubs the mapping dialog body. |
| Reconnect/delete/deactivate/cancel | Exact missing/inactive/child/foreign source rejection; real cache write cannot restore a deleted parent or inactive source. Token renewal cannot relabel an old read as a changed source. | Complete user-facing reconnect/delete/cancellation transactions and provider revocation, beyond these cache-write checks. |
| Manual/scheduled refresh/cache/recovery | Complete publication, empty-sheet replacement, failed chunk/token response, stale-reader rejection and transaction rollback. Manual refresh returns failure when any attempted connection fails. | Natural deployed refresh/restart, real provider latency/quotas and error recovery. |
| Source list/raw table/Summary/aggregate | Existing list identity, scoped reads, zero cells, paging, exact rows and valid/null metric propagation. Aggregate exact-window opt-out preserved. | Whole source-list/provenance and source-mutation-to-every-output matrix, including existing damaged-data inventory. |
| KPIs/Benchmarks/Insights | Current options/displays and browser/scheduled goal PDF values use the same calculated values; daily ratio inputs are reconciled. | Persisted goal values/alert propagation [V1-122](../v1-batch-7/README.md#v1-122), complete Insights/date/diagnostic policies and notifications. |
| Reports/download/send/snapshot | Actual browser and scheduled PDF calculation/scope cases pass; dated scheduled reports reject unprovable coverage. Browser reports explicitly say all selected rows and use their saved dataset for the row count. | Real scheduled send/inbox, full artifact/snapshot parity [V1-060](../v1-batch-7/README.md#v1-060) and broader currency propagation [V1-106](../v1-batch-6/README.md#v1-106). |
| Historical data / rollback | Old incomplete caches are rejected and safely rebuilt by normal refresh; no schema migration. | Inventory any previously damaged values before scoped repair; deployment and compatible rollback checks. Reverting code restores known bad calculations and is not analytics-safe acceptance. |

The retained LinkedIn mapping-save conversion branch still has its separate limited read and attribution assumptions; it requires LinkedIn connection/import state and is not the standalone main GET/cache path corrected here. Provider-functional work for LinkedIn, Instagram, Meta and TikTok remains deferred; shared access/job/isolation obligations remain open. Pipeline Proxy V1-109 is also unchanged.

**Reusable safeguards.** Future sources can reuse exact saved-source ownership, complete-or-failed reads, identity-bound atomic cache publication, selected-row calculation contracts, explicit date/zero/unavailable states and the malformed/partial/concurrent/deleted-source regression cases. The Google grid limits, formatted number/date syntax, clicks-based CVR, cache lifetime and OAuth behavior are source-specific assumptions. Each provider still needs independent permissions, attribution, metrics, dates, pagination and quota validation. No new source or framework was introduced.

**Next at this historical checkpoint:** the seven Custom Integration findings, now locally verified above. Current remaining implementation: V1-068/069. Required deployed/provider acceptance remains separate for all 24 Batch 4 findings. The earlier dated checkpoints below retain their original scope; this checkpoint supersedes their outstanding standalone five-item implementation status only.

## Standalone Sheets selection deployment verification (October 23)

*Historical selection-only checkpoint; the completion checkpoint above supersedes its remaining implementation status. Deployment/acceptance evidence retains its original boundary.*

At 11:09 Europe/Amsterdam (09:09 UTC), three public `/api/health` responses confirmed deployed revision `fb1132a256d05a271dcdbb21be863206f933d7b0`, `ok=true` and `nodeEnv=production`. It contains selection fix `9807a9b9`. Homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. [Recorded results](deployment-2026-10-23-standalone-sheets-selection/public-verification.json) and [read-only checker](deployment-2026-10-23-standalone-sheets-selection/verify-public.cjs).

The scheduler is healthy and registered with unchanged 08:00/14:00/20:00 Amsterdam slots. This process started at 11:06 Amsterdam; its next run is 14:00, through October 22, with no completed run in this process. This is registration evidence, not natural-refresh acceptance. No new refresh wait is required before independent Batch 4 implementation.

**Passed:** deployed revision, basic readiness, homepage availability, signed-out access denial and scheduler registration. **Still open:** authenticated standalone Sheets selection/mapping recovery, provider data, full lifecycle/downstream acceptance and remaining V1 gates. No application mutation, campaign/Ptomo data read, provider call or manual refresh was performed. V1-051 remains IN PROGRESS because complete bounded reads and cache/aggregate publication are still outstanding.

## Standalone Sheets selection checkpoint (October 23)

*Historical selection-only checkpoint; the completion checkpoint above supersedes its remaining implementation status. Deployment/acceptance evidence retains its original boundary.*

**V1-051: IN PROGRESS; selection correction verified locally, committed in `9807a9b9` and deployed in `fb1132a2`; public checks pass, authenticated/provider acceptance remains open.** This is the next bounded Batch 4 correction. The remaining completeness/cache/aggregate boundaries in V1-051 are still open; the number of fully locally verified findings remains ten, with 14 findings requiring further implementation. All 24 release acceptances remain OPEN.

**Root cause and exact path.** `client/src/pages/google-sheets-data.tsx` resolved a missing URL selection to the primary dataset and retained another dataset's placeholder figures during a switch. Its registered `GET /api/campaigns/:id/google-sheets-data` in `server/routes-oauth.ts` independently substituted spreadsheet-only/primary matches when a composite selection failed. Campaign-name substring matching admitted similarly named campaigns; an empty match reverted to every row. Malformed saved mappings fell back to header detection, and a name selection could be paired with an unrelated ID column. The conversion-value branch then independently read/transformed the original unfiltered rows. An actual-handler fixture selecting Alpha (Revenue 10 / Conversions 2) produced campaign conversion value 166.67 from all three campaigns instead of 5.00.

**Small correction, existing architecture.** Explicit dataset selection now requires one active main/general connection in the campaign: missing selections return 404, ambiguous/non-scalar selectors return 400. Omitted selection retains the primary/first default and empty no-connection response. Selected campaign values remain paired with their own validated column; malformed, moved or duplicate mapped selection headers return a recoverable 400. Explicit selected values are not intersected with unrelated connected-platform labels. Legacy campaign-name matching is exact after existing trim/case normalization; no-match remains empty, including platform-only no-match. Numeric identifier zero is preserved. Summary/table rows, categorical breakdowns, Insights inputs and this route's conversion fallbacks/transformations share the same selected row boundary; empty selections do not overwrite campaign conversion values. The page keeps explicit missing/ambiguous selections for the API to reject, does not show another dataset as selected, and retains placeholder figures only for the same dataset. Its error screen reuses the existing Edit Mappings dialog with cancellation.

**Files changed.** Runtime: `server/routes-oauth.ts`, `client/src/pages/google-sheets-data.tsx`. Regression coverage: `server/v1-batch4-standalone-sheets-scope.test.ts`, `server/v1-batch4-standalone-sheets-browser.test.ts`, and two localized assertions in `server/google-sheets-aggregate-source.test.ts`. No schema, storage, scheduler, source onboarding or financial formula changes. Existing middleware remains registered; storage's `getGoogleSheetsConnections(campaignId)` query remains campaign-scoped. No production/Ptomo/provider access, database fixture, persisted-data cleanup or deployment was performed.

[Commit verification](validation-2026-10-23-standalone-sheets-scope/commit-checkpoint.json) binds all five unchanged runtime/test files to `9807a9b9fe0715f73dfea30b699bf43a1f526a90`. The original assessment retains its dated pre-commit state; no runtime checks were repeated for this unchanged commit.

**Validation.** [Assessment and candidate hashes](validation-2026-10-23-standalone-sheets-scope/assessment.json), [initial failing cases](validation-2026-10-23-standalone-sheets-scope/baseline.json), [final results](validation-2026-10-23-standalone-sheets-scope/complete.json), and [build checks](validation-2026-10-23-standalone-sheets-scope/verified-build-checks.json). Final packet: **118 passed, zero failed, zero skipped**: 57 new actual-handler cases, one isolated rendered-page browser scenario, and 60 neighboring assertions. The route uses current AST-extracted handlers/helpers plus actual transformation utilities; Google and storage are fixtures. Both cached/live paths, exact/ambiguous/missing/removed/reconnected selections, mapping edits and malformed columns, zero identifiers, no-match preservation, conversion writes, forced refresh and 403/404/429/500 provider errors are covered. The browser covers the actual page, query/error handling, mapping dialog opening/cancellation and a delayed tab switch without previous-tab figures; the mapping editor body, authentication and provider requests are isolated. It does not validate a real mapping save or Google OAuth. All external browser requests are blocked/fulfilled by fixtures.

The neighboring failure `TEST-6d4794df4c` was an obsolete comment delimiter in the Spend totals source-extraction test, reproduced before this change. Its boundary now uses the next registered route, retaining every platform/source/total assertion; it passes. A stale Summary source-text expectation was updated to the corrected row boundary. The first sandbox test launch failed with child-process `EPERM`; the same isolated runner then executed with child-process permission. The browser initially exposed the real frontend fallback, which was corrected and retested. These are classified evidence, not waived failures. TypeScript and client/server production builds pass. This targeted packet does not replace the October 22 whole-suite result or close V1-012/CI.

**Lifecycle and downstream boundary.**

| Path | Current evidence / remaining gate |
| --- | --- |
| Main dataset add, edit/save mappings | Read contract traced from existing connection/mapping fields; next-read selection changes covered. Save transaction, header preview and full onboarding not recertified. |
| Removed/inactive/child/reconnected dataset | Actual GET rejection and replacement-ID recovery covered with isolated storage fixtures; real delete/reconnect transaction and ownership races remain unverified here. |
| Cached/fresh/forced read | Same selected rows and provider failure rejection covered. The existing `A1:Z1000` limit, cache freshness/completeness and token lifecycle are not fixed by this checkpoint. |
| Summary/table/categorical/Insights | Same scoped input rows proven. Numerical semantics and full Insights correctness remain separate gates. |
| Conversion calculations and campaign write | Cannot escape selected rows; exact fixture writes 5.00 and empty selection preserves the prior value. Cross-platform denominator/formula semantics, save-mappings' separate conversion branch and historical damaged conversion values remain open. |
| KPIs/Benchmarks/browser reports | Current callers use this GET/saved dataset selection; scoped input correction carries through. Ratio/zero/financial propagation and report output parity remain open under V1-108/112/114. |
| Scheduler/cache, aggregate, scheduled report | Independent paths remain uncorrected/unverified under V1-051/113; do not infer safety from this GET correction. |
| Deployed/provider/cleanup | Public revision/health/access checks pass on `fb1132a2` as recorded below. Authenticated source/provider acceptance and cleanup were not run; no existing records rewritten. Inventory exact saved source/configuration before any historical correction; never reconstruct unknown allocations. |

**Documentation contradiction.** The older Google Sheets tracker describes selected-source and downstream normalization as locally covered. The current code and failing fixtures above contradict whole-path safety; its historical milestones do not certify this revision. V1 findings and this bounded checkpoint govern current status.

**Next at this earlier checkpoint (now implemented locally above):** complete V1-051 reads/cache/aggregate and standalone Sheets zero/formula/report corrections. Do not wait for Ptomo's CSV completed-day inclusion to do independent local work. This read-selection fix has no database migration or configuration change; rolling back restores the incorrect fallback behavior and is not an analytics-safe certification. Production/provider acceptance is still required after deployment.

## Retained CSV Revenue deployment verification (October 23)

At 08:48 Europe/Amsterdam (06:48 UTC), three read-only `/api/health` responses independently confirmed `841d560e7b452724129002e9fbec589369297948`, `nodeEnv=production` and successful readiness. This includes V1-072 runtime fix `9d928ecc` and the earlier Batch 4 corrections. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. [Recorded observations](deployment-2026-10-23-retained-csv/public-verification.json) and [read-only checker](deployment-2026-10-23-retained-csv/verify-public.cjs).

The scheduler is healthy and registered with the unchanged 08:00/14:00/20:00 Amsterdam schedule and `runOnStartup=false`. This process started at 08:43, after the morning slot; its next run is October 23 at 14:00 Amsterdam, through October 22. Its idle/no-completed-run status does not establish a missed refresh or describe an earlier process. CSV imports are manual and their UI/API validation does not require waiting for that scheduled run.

**Passed:** exact deployed revision, basic readiness, homepage availability, signed-out campaign-list denial and scheduler registration. **Still open:** authenticated CSV upload/edit UI regression, deployed retained-route failure/rollback checks using isolated fixtures, provider values, natural refresh completion and full source/downstream acceptance. No campaign data, uploads, cleanup, manual refresh, database mutation or provider calls were used. No release gate or finding acceptance is closed by these public checks.

## User-supplied CSV upload screenshots (October 23)

**Partial UI evidence, not completed acceptance.** The screenshots show Total Revenue EUR 72,879.50 and two sources: native GA4 EUR 72,879.50 plus `test_csv.csv` EUR 150.00. The CSV is explicitly pending, with EUR 0.00 included through October 22. The card therefore reconciles to the displayed eligible source values. Current code at `server/routes-oauth.ts:3733` and `server/storage.ts:3340,3412` separately exposes latest imported values and filters completed-day contributions by both source creation time and record date; `client/src/pages/ga4-metrics.tsx:7358,7428` renders that distinction. A new source created after the cutoff can remain pending even when its rows have earlier dates.

The later original-file screenshot shows July 1, 2026 / Alpha / 100, July 2 / Alpha / 50 and July 3 / Beta / 1100. Alpha-only selection totals EUR 150.00; all three rows total EUR 1,250.00. The displayed EUR 150.00 therefore reconciles conditionally to Alpha-only selection, but the saved selection and Date mapping have not been shown or independently read. Campaign identity and the screenshot's exact live revision were not independently captured. Upload/source visibility, invalid-replacement retention and successful valid edit have supporting user evidence as recorded below; completed-day inclusion and corrected non-GA4 route acceptance remain open. This GA4 screenshot does not certify retained non-GA4 paths. No application mutation was performed by the agent while reviewing these screenshots.

**Date/schedule clarification checked against current code:** CSV upload is manual; a scheduled refresh does not reread the user's local file. When Date is mapped, the three dates determine the materialized revenue days, not the configured refresh times. The July dates precede the October 22 cutoff and are not themselves a reason for the pending state. A source created on October 23 is independently excluded by the source-created-through-October-22 rule until the reporting cutoff includes October 23, even when its records are historical. If no Date is mapped, this Revenue route retains its existing completed-day snapshot fallback instead. No mapping or date changes were requested or made.

**Invalid replacement follow-up: user-observed UI check PASSED.** The user screenshots show `abv` in the first Revenue data row and the application's `CSV import failed` error identifying CSV row 2 as an unsupported/ambiguous amount. The subsequent reopened Revenue Sources screenshot still shows `test_csv.csv` and its CSV group at EUR 150.00, with native GA4 EUR 72,879.50 and pending CSV contribution EUR 0.00 through October 22 unchanged. Together these screenshots support visible rejection and retention of the previously displayed source value for this exact test. No database/API capture or reload persistence check was independently performed; this bounded UI pass does not close full V1-072 or Batch 4 acceptance. No further repetition of this same UI check is required absent new changes or contradictory evidence.

**Valid replacement follow-up: user-observed UI check PASSED.** After instructions to change Alpha's 100 to 200, keep its other 50 and save an edit with Alpha only selected, the user supplied a Revenue Sources screenshot showing CSV EUR 250.00 and one visible child entry, named `test_csv.csv.csv`, also at EUR 250.00. That matches the instructed 200 + 50 expectation, with no additional visible CSV source entry. Native GA4 remains EUR 72,879.50 and the CSV contribution through October 22 remains pending at EUR 0.00. The screenshot proves the visible updated value within this manual test; a stable persisted source ID, saved mapping and reload/database persistence were not independently captured. No repeat of this same valid-edit UI check is needed absent new changes or contradictory evidence. Completed-day inclusion, retained non-GA4 route acceptance and full Batch 4 release acceptance remain open.

## Retained CSV Revenue correction checkpoint (October 23)

**V1-072: VERIFIED LOCALLY; release acceptance OPEN.** The correction is committed in `9d928eccc18d74343990f6be35d6ecc9378ab565` on base `eb3fca00`. [Commit verification](validation-2026-10-23-retained-csv/commit-checkpoint.json) confirms all five runtime/test files match the validated candidate. Dated test manifests retain their original pre-commit state. Runtime `841d560e` is independently verified live; the public checks below pass, with authenticated import acceptance still open. This protects the existing shared CSV API; LinkedIn, Instagram, Meta and TikTok provider-functional work remains deferred.

**Confirmed root cause:** `POST /api/campaigns/:id/revenue/csv/preview` and `/process` used the non-strict parser outside GA4. Its limit counted the header and stopped parsing, silently dropping data row 50,000; a physical-line precheck also rejected valid multiline fields. The non-GA4 process branch updated/created a source and deleted its records before validating conversion values or inserting replacement records. Invalid conversion edits returned 400 after data loss, and insert failure could leave partial state. The existing shared wizard sends this context and source ID from `client/src/components/AddRevenueWizardModal.tsx:1507,1604`; retained API accessibility is not evidence of configured provider support.

**Minimal correction:** `server/routes-oauth.ts:4752,4778,5167` now uses the existing complete strict parser for every CSV Revenue context: at most 50,000 data rows; oversized input returns 413 and malformed structure returns 400 before mutation. Preview response shape and the non-GA4 25-row sample remain unchanged. Exact campaign/type/context/active-source checks precede replacement. Empty selected revenue or conversion-value sets reject before writes. Existing daily/snapshot and exact active-campaign attribution records are prepared first, then saved with their source through `server/storage.ts:2999`'s existing transaction. Expected mapping comparison rejects concurrent stale edits with 409; a transaction-held parent lock prevents recreation after campaign deletion. The larger route diff removes the old separate mutations and duplicated record insertion; no new architecture, schema, dependency, schedule or UI was introduced.

**Trace and lifecycle boundary:** File bytes -> complete parser -> selected rows -> retained raw mapping plus existing daily/snapshot and exact-campaign records -> atomic save -> existing recompute call -> wizard invalidation. `getRevenueSources`, `getRevenueTotalForRange` and `getRevenueBreakdownBySource` retain campaign/context/active-source/date filters and aggregate-versus-detail deduplication. The guarded `/revenue-sources` and `/revenue-totals` readers consume those methods. Actual handler-to-PostgreSQL add, re-upload edit, selection-only edit, source/breakdown/total reconciliation, unrelated-campaign retention, rejected edit, insert rollback and concurrent edit/deletion cases pass. Source deletion remains the existing guarded `deleteRevenueSourceWithRecords` path and is not newly certified here. CSV is a manually replaced snapshot, with no provider reconnect or scheduled file reread. Existing scheduler/downstream GA4 regression checks are supporting evidence, not full non-GA4 report/KPI/Benchmark/notification certification.

**Validation:** [29 new tests pass](validation-2026-10-23-retained-csv/verified-route.json), including 12 actual PostgreSQL cases. [Wider packet](validation-2026-10-23-retained-csv/final.json): **534 tests, 516 passed, 18 failed, zero skipped**. [Assessment](validation-2026-10-23-retained-csv/assessment.json) preserves every failed ID, evidence and release impact; all 18 match previously recorded failure boundaries and remain OPEN, with no waiver. Five use incomplete GA4 transaction mocks, one asserts a stale Spend recompute count, two assert stale Google Ads validator/UI strings, and ten are retained-source safety assertions. No new failing identity remains. Two CSV structural assertions were updated after this correction removed the unsafe separate mutations; an adjacent Google Ads assertion now requires atomic replacement. Behavior is independently checked in the new route/database tests.

The first [reproduction](validation-2026-10-23-retained-csv/before.json) records 14 failing defect cases, one passing median case and ten PostgreSQL cases not yet enabled. The final packet enables all PostgreSQL cases. TypeScript initially caught direct Map iteration incompatible with the existing compiler target; the loop now retains the original `Array.from(...entries())` pattern. The 534-test packet precedes only that compatibility change; all 29 new cases were rerun afterward and [TypeScript/server build pass](validation-2026-10-23-retained-csv/verified-build-checks.json). [File hashes](validation-2026-10-23-retained-csv/candidate-manifest.json) distinguish those checkpoints. [Fixture cleanup](validation-2026-10-23-retained-csv/fixture-cleanup.json) found zero remaining schemas, other clients or advisory locks; the isolated localhost cluster was stopped. No production/Ptomo access, provider call or application migration occurred.

**Unvalidated and historical-data boundary:** No deployed/browser acceptance, full provider/source certification, hosted-load result or historical repair is claimed. This does not normalize every retained non-GA4 amount/date/currency variant; their existing formulas and parsing remain subject to their own acceptance. LinkedIn connection/session updates and downstream recompute still occur after the source transaction and their failure recovery is not certified by source/record atomicity. Truncated or previously erased CSV data cannot be reconstructed from missing retained rows: exact original files and a separately reviewed source inventory are required before repair. No automatic cleanup or guessed backfill was added.

**Reusable safeguard:** Complete parsing, validation before mutation, scoped atomic replacement, expected mapping comparison, parent survival and rollback/concurrency regressions reuse existing GA4 patterns. CSV's manual cadence, 50,000-row cap, positive-value handling, date fallback and LinkedIn conversion median are source-specific; future providers still require independent permission, metric, attribution, date, pagination and quota validation.

## Sheets Spend deployment verification (October 23)

At 04:05 Europe/Amsterdam (02:05 UTC), three read-only `/api/health` responses independently confirmed `eb3fca00f62dd8229b12a972956fc06e026281a2`, `nodeEnv=production` and successful readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. The GA4 scheduler is registered and healthy with the existing 08:00/14:00/20:00 Amsterdam configuration and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; it reports no completed natural run since deployment. [Recorded observations](deployment-2026-10-23-sheets-spend/public-verification.json) and [read-only checker](deployment-2026-10-23-sheets-spend/verify-public.cjs).

This proves the deployed revision and listed public checks only. Authenticated imports, real provider values, natural refresh completion, hosted load/recovery and complete source/downstream acceptance remain open. No campaign read/mutation, upload, cleanup, manual refresh or provider failure was triggered. The nine corrections verified at this deployment checkpoint are deployed; the later V1-072 correction above is not included.

## Sheets Spend commit checkpoint (October 23)

The authorized fixes, tests and validation documentation are committed in `b650b63150f2d38522c7f85c1f1fd2bee6d8b610`. [Commit verification](validation-2026-10-23-sheets-spend/commit-checkpoint.json) binds all five runtime/test files to the previously validated candidate. The dated validation manifests retain their original pre-commit state. No schema, dependency or environment-setting change is included. Tests were not repeated because committed content matches the tested files. The subsequent public deployment checks above pass; full release acceptance remains open.

## Sheets Spend correction checkpoint (October 23)

V1-041 and V1-070 now have localized forward corrections on base `e635fe50`. The changes are **committed in `b650b631` and deployed in `eb3fca00`; public deployment checks pass, with source/provider acceptance still open**. All 37 new tests pass, including nine real PostgreSQL cases; required release acceptance remains OPEN. No production/Ptomo reads, imports, refreshes or cleanup were performed.

| Finding | Root cause and correction | Exact changed boundary |
|---|---|---|
| V1-041 | Fixed `A1:ZZ5000` reads silently discarded later rows/columns; permissive parsing accepted partial numbers and converted nonnumeric selections to zero. Preview/process now read exact-tab metadata and reuse the existing complete Revenue chunk reader: full-width 5,000-row chunks, maximum 50,000 grid rows including the header, fail closed above that bound or on any failed chunk. Existing 15-second per-request deadlines cover metadata, values and body reads. Validate header identity, selected amounts, GA4 dates and currency before materialization; preserve explicit zero with its date, reject missing-only selections, reject total overflow. | `server/routes-oauth.ts`: `POST /api/campaigns/:id/spend/sheets/preview`, `/process`, `readGoogleSheetsRevenueChunks`; existing validators in `server/utils/csv.ts`. |
| V1-070 | Duplicate signatures omitted platform/currency and empty arrays hid singular selections. Cleanup did separate unguarded writes; purge separately checked record count before deletion. Inspection now distinguishes exact context, currency, mapping and selected values. Deactivation requires matching nonempty normalized record sets, including campaign/date/currency/attribution; incomplete/conflicting scopes are skipped. Both mutation routes require the current read-only `inspectionToken`. Storage rechecks every inspected source/record inside one transaction and rolls back all removals together. | `server/routes-oauth.ts`: `getGoogleSheetsSpendDuplicateGroups`, guarded duplicate GET, `/cleanup`, `/purge-inactive`; `server/storage.ts`: `getGoogleSheetsSpendCleanupState`, `cleanupGoogleSheetsSpendDuplicates`, optional maintenance lock timeout on the existing refresh-input transaction. |

**Import contract and trace:** `AddSpendWizardModal.tsx` sends the connection, selected columns, currency and singular/array campaign values to the existing preview/process endpoints. Add remains additive; edit/refresh preserve the source ID and saved selection. `reprocessGoogleSheetsSpendWithDetails` already calls that same process endpoint with the expected source mapping and refresh ownership; it reports rejected imports as failures. Complete rows feed the existing source mapping, sample/count provenance and dated/snapshot Spend records, then existing campaign recompute calls. GA4's existing atomic replacement, source ownership, expected mapping and parent/lease guards remain. Chunk token renewal receives the same ownership input; a successful fallback connection repair is retained for subsequent chunk renewal. No scheduler schedule or frontend layout changed.

Selected amounts use the existing CSV financial contract: nonnegative finite numbers, at most two decimals, valid comma grouping, amount/combined total at most 9,999,999,999.99, and `$` only for USD. Locale-ambiguous, exponential, negative and overprecision values are rejected, rather than rounded or guessed. Blank amount cells do not contribute; an entirely blank/unmatched selection cannot overwrite saved data with zero. Explicit numeric zero is accepted and retains its mapped date. Mapped GA4 dates must use the existing deterministic ISO date/timestamp syntax; no-date mapping retains the completed-day snapshot contract. Future-dated rows stay materialized but are excluded from the GA4 completed-day returned total. Preview checks completeness and header identity; it has no selected mapping and does not claim selected-amount validation.

**Cleanup contract and reachability:** The duplicate endpoints remain campaign-access guarded. Repository caller search found no current UI or background caller; no new UI, automatic cleanup or source removal was introduced. GET remains read-only and adds `inspectionToken`, `cleanupEligible` and inactive candidate IDs. POST now requires `confirm:true` plus that token from a fresh inspection. This intentional maintenance-API safety requirement means old confirmation-only requests return 400. A changed inspection returns 409; changes between route validation and storage are independently rejected. Duplicate sources are deactivated, not hard-deleted. Purge retains its explicitly destructive purpose and accepts only inspected inactive, zero-record sources with an exact active scope match; re-inspect after deactivation. Unconfigured/deferred platform scopes are not cleanup candidates. Existing unrelated legacy storage methods were not removed.

The transaction locks the existing campaign and fences writes to the two Spend tables so legacy inserts cannot race the record check. Campaign/table lock waits are bounded to three seconds; maintenance statements have a ten-second timeout. These locks are used only by explicit cleanup/purge, never ordinary preview/save/refresh. They can briefly contend with other Spend writes; hosted-load acceptance remains open. If cleanup commits but the subsequent downstream recompute fails, the error response reports `cleanupApplied:true`; it does not claim the cleanup rolled back.

**Validation and evidence:** See [assessment and each classified failure](validation-2026-10-23-sheets-spend/assessment.json), [validated file hashes](validation-2026-10-23-sheets-spend/candidate-manifest.json), [corrected baseline reproduction](validation-2026-10-23-sheets-spend/before-corrected-fixture.json), [final targeted results](validation-2026-10-23-sheets-spend/verified.json), [TypeScript/server build](validation-2026-10-23-sheets-spend/verified-build-checks.json) and [fixture cleanup](validation-2026-10-23-sheets-spend/fixture-cleanup.json). **Final targeted packet: 544 tests: 530 passed, 14 failed, zero skipped. All 37 new tests pass, including nine actual PostgreSQL cases.** Each failure has the same identity and failure boundary as the previous full checkpoint: eight incomplete transaction fixtures and six structural assertions. They remain open, with exact IDs and release impact in the assessment; no failure is waived. TypeScript and server build pass. The earlier whole-suite 179 failures and CI gate remain open; this is not a new full-suite run. Both disposable local databases have zero remaining fixture schemas, other client connections or advisory locks; the test cluster was stopped.

The baseline reproduction executed actual current handlers/scheduler/helper code: 19 of 22 assertions failed, including 5,001 data rows importing only 4,999, malformed amounts accepted, false-zero writes and cross-platform/currency grouping. An earlier three-case test-parameter mistake is retained in `before.json` and corrected in the named baseline; those harness failures are not product defects. The first final packet exposed a five-second test-budget failure caused by repeatedly extracting the same code from the large route file while compilation ran. Test-only extraction caching removes that redundant work; no assertion or timeout was relaxed. Its failed result remains recorded and is superseded only by the final rerun.

**Lifecycle / downstream evidence and limits:**

| Boundary | Current evidence |
|---|---|
| Add, edit, scheduler reprocess, recovery | Actual registered handlers and scheduler body run against controlled provider responses; actual PostgreSQL replacement/read cases reconcile selected records and source totals. Valid data recovers after invalid refreshes; no partial import replaces last-good data. |
| Completeness / unavailable / zero / currency / dates | Boundary and beyond-ZZ tests, late-chunk failure, stalled metadata/value/body requests, invalid amounts, header collisions, overflow, exact selection, explicit zero and missing selection are exercised. Saved-source metadata and records are compared before/after failures. |
| Ownership / late changes / delete / cleanup | Existing PostgreSQL financial ownership/input-invalidation packet is rerun. New cleanup tests cover denied access, stale tokens, route-to-storage edits, foreign child corruption, multi-source rollback, exact purge, concurrent legacy inserts and bounded busy-campaign waits. Cleanup source-total/breakdown reads reconcile after removal. |
| Source modal / visible totals / full publication | Persisted mapping/provenance and source/breakdown/total reads are checked. Recompute invocation ordering is checked at the handler boundary. Rendered modal/cards, KPI/Benchmark/Insights/alerts/reports and natural deployed publication are not newly certified by these fixtures. |
| Reconnect / cancellation / general deletion | Token repair/renewal and owned late-write guards are checked within fixtures. Real customer OAuth/cancel/reconnect, independent delete/disconnect acceptance and their existing failing tests remain open. |
| Existing damaged records | No data cleanup was executed. Truncated/invalid sources require source-authoritative comparison and exact scoped refresh/re-import after deployment. A successful future refresh may correct records, but historical reports/snapshots are not silently rewritten. Different record sets remain skipped by duplicate cleanup; they require a separate reviewed correction plan. |

**Reusable safeguards:** Read the complete declared source range or fail before replacing data; validate selected raw values before permissive parsing; distinguish measured zero from no selected evidence; carry saved selection, source identity and ownership through refresh and token renewal. Destructive maintenance needs a fresh inspected state, exact record equivalence, atomic changes and insert-race protection. The Sheets grid cap, formatted cells, generated headers, dollar symbol and ISO-date rules are source-specific assumptions. Each future provider still needs independent permissions, metric meaning, attribution, dates, pagination and quota validation. No framework, dependency, schema or environment-setting change was introduced.

## Sheets Revenue deployment verification (October 23)

At 00:32 Europe/Amsterdam (October 22, 22:32 UTC), three read-only `/api/health` responses independently confirmed `e635fe50b6009bd003e8aa2f82d8c3fe84026cc4`, `nodeEnv=production`, and readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. GA4 scheduler registration is healthy with the existing 08:00/14:00/20:00 Amsterdam configuration and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; no natural run has completed since this deployment. [Recorded observations](deployment-2026-10-23-sheets-revenue/public-verification.json) and [read-only checker](deployment-2026-10-23-sheets-revenue/verify-public.cjs).

This proves the deployed revision and listed public checks only. Authenticated imports, real Google values, natural refresh completion, hosted load/recovery and full source/downstream acceptance remain open. No upload, campaign mutation, manual refresh or provider failure was triggered. At this deployment checkpoint, Sheets Spend V1-041/070 was next. Its subsequent local correction checkpoint above now supersedes that implementation status.

## Sheets Revenue commit checkpoint (October 23)

The requested fixes, tests and documentation are committed in `ace32e7bd9521c451fe12ba2a05f1445c0001a63`. [Commit verification](validation-2026-10-23-sheets-revenue/commit-checkpoint.json) confirms all five committed runtime/test files match the validated candidate. No schema, dependency or environment-setting change is included. The dated validation manifests retain their original pre-commit state. The subsequent public deployment checks above pass; required release acceptance remains open.

## Sheets Revenue correction checkpoint (October 23)

The authorized next group, V1-065/066/067, is implemented and verified locally. [Assessment and classified failures](validation-2026-10-23-sheets-revenue/assessment.json), [candidate hashes](validation-2026-10-23-sheets-revenue/candidate-manifest.json), [pre-fix reproductions](validation-2026-10-23-sheets-revenue/before.json), [final targeted result](validation-2026-10-23-sheets-revenue/verified-final.json), [TypeScript/server build](validation-2026-10-23-sheets-revenue/final-build-checks.json) and [fixture cleanup](validation-2026-10-23-sheets-revenue/fixture-cleanup.json).

| Finding | Root cause and smallest correction | Exact changed boundary | Local evidence |
|---|---|---|---|
| V1-065 | Header-keyed row objects silently overwrite repeated names. Preview/save now reject collisions after trimming and generated `Column N` names, before constructing row objects. Refresh uses the same normalization and rejection. | `server/routes-oauth.ts`: Sheets Revenue preview/process; `server/auto-refresh-scheduler.ts`: `reprocessGoogleSheetsRevenue` | Repeated Revenue/Campaign headers, whitespace collisions and generated-name collisions reject. Valid trimmed/generated headers survive preview, save and refresh. Actual PostgreSQL records remain unchanged on invalid edit/refresh. |
| V1-066 | Amount syntax allowed `$`, then parsers stripped it without comparing that symbol to currency. Existing currency resolution/mismatch checks now precede amount validation; the existing selected-row validator rejects `$` for any resolved currency except USD. | Both paths above; `server/utils/google-sheets-revenue-amount.ts`: `findInvalidGoogleSheetsRevenueAmountRows` | EUR-dollar edit/refresh rejects before replacement; plain EUR and dollar USD succeed. Malformed numeric rejection and the configured-currency mismatch response remain intact. No FX conversion or relabelling. |
| V1-067 | Refresh ignored singular `campaignValue`, and its materializer did not normalize stored array values as save/validation did. Refresh now uses normalized non-empty arrays first, otherwise the saved singular value, throughout validation and materialization; a campaign column with no selection fails closed. | `server/auto-refresh-scheduler.ts`: `reprocessGoogleSheetsRevenue`, used by the daily pipeline, Revenue loop and validation entry | Selected 10 stays 10 beside unrelated 90, including singular-only/empty-array fallback, array precedence and whitespace. Invalid unselected rows are excluded. Stable source ID, expected mapping and refresh ownership options remain intact. Actual add/edit/refresh persistence reconciles to source breakdown and total reads. |

**Trace and propagation:** `AddRevenueWizardModal.tsx` opens `/revenue/sheets/preview`, sends mapped columns/currency and both selection forms to `/revenue/sheets/process`, then refreshes source/financial queries. The routes and scheduler fetch exact-tab metadata and existing bounded row ranges; provider, range, token and timeout behavior are unchanged. Normalized rows feed dated or snapshot `revenue_records` and `mappingConfig.campaignValueRevenueTotals`. Existing `replaceRevenueSourceWithRecords` keeps atomic replacement, campaign/type/context/stable-ID checks, expected mapping comparison and surviving-parent/refresh-ownership guards. Storage source-list, breakdown and total consumers retain their contracts. The new PostgreSQL cases execute the actual registered save handler and scheduler body into actual storage, then reconcile the persisted records and source/total reads. Authentication and provider replies are isolated fixtures; the full server middleware/browser/provider journey is not claimed.

**Validation:** 29 new tests pass, including three handler-to-PostgreSQL lifecycle cases. The full targeted packet has **407 tests: 398 passed, nine failed, zero skipped**. Each failure retains its existing stable test ID, classification and release impact in the assessment; none is waived. They are five incomplete disconnect mocks, two Google Ads source-text guards and two downstream source-text guards. Actual persistence/ownership tests provide separate evidence for their tested boundaries, not closure of those failures. The whole 179-failure regression baseline and CI gate remain open; no new whole-suite run is claimed. One neighboring scheduler fixture needed its campaign-currency read stubbed after currency validation moved earlier; its original no-write/warning assertions remain. Initial PostgreSQL setup used an incompatible local fixture and did not execute its database cases; the final packet uses a fresh test-only cluster on `127.0.0.1:55444`. Both fixture databases have zero leftover schemas, connections or advisory locks, and the cluster was stopped. TypeScript and server build pass; no frontend/runtime contract, dependency, schema or environment-setting change was introduced.

**Lifecycle and release limits:** Add, edit, refresh, stable identity, bad-input retention and persisted total/source reads are proven within the fixtures. Existing delete/disconnect, reconnect/OAuth, real scheduled timing, browser flows, quotas and full downstream KPI/Benchmark/Insights/report/alert publication are not newly certified. This corrects the forward path only. A successful future refresh can re-materialize a source with its still-saved exact selection; already-published historical snapshots are not repaired. Duplicate-header or currency-damaged sources require a read-only inventory and source-authoritative correction/re-import plan before cleanup. No production/Ptomo reads or mutations occurred. Existing numeric syntax, positive-row materialization and zero/negative amount policies are otherwise unchanged; these three fixes are not whole-source certification.

**Reusable safeguards:** Validate normalized header identity before object construction, validate currency before permissive numeric parsing, and apply the same saved selection in validation and materialization. Keep atomic stable-source replacement and last-good retention. The sheet's formatted cells, generated column names, USD-only dollar handling and saved singular/array fields are provider/workflow assumptions; future providers still require independent permissions, metric, attribution, date, pagination and quota validation. No new framework was added.

## Deployment verification (October 22)

At 21:53 UTC, three read-only checks independently confirmed live revision `44132830b668283d37d40cb874687c2c5861ad0e`, `nodeEnv=production` and successful readiness. The homepage and `/health` returned 200; signed-out `/api/campaigns` returned 401. The GA4 scheduler is registered with 08:00/14:00/20:00 Europe/Amsterdam and `runOnStartup=false`. Its next run is October 23 at 08:00 Amsterdam, through October 22; no natural run has completed since this deployment. [Recorded public evidence](deployment-2026-10-22/public-verification.json) and [read-only checker](deployment-2026-10-22/verify-public.cjs).

This confirms deployment and the listed public checks only. It does not validate authenticated imports, Google provider values, the next refresh, hosted load or recovery. No campaign mutation, upload, manual refresh, provider failure or cleanup was triggered. All 24 release acceptances remain open. At this October 22 checkpoint, Sheets Revenue V1-065/066/067 was next; the October 23 correction checkpoint above supersedes that implementation status.

## Commit checkpoint (October 22)

The user authorized commit and push. [Commit evidence](validation-2026-10-22/commit-checkpoint.json) verifies all nine committed runtime/test files against the validated manifest. Runtime commit: `c38062825a88c7265f323cb2990f713ddc040e18`. No schema, dependency or environment-setting change is included. Validation was not repeated because committed content matches the tested files. The subsequent deployment checks above confirm the public boundary; required release acceptance remains open. The original dated manifests describe their pre-commit validation state.

## First correction checkpoint — October 22

The user authorized Batch 4 while the deployed Batch 3 revision awaits its first natural refresh. Batch 3's pending October 23 08:00 Amsterdam observation remains separate; these tests do not depend on that run.

| Finding | Confirmed current root cause and correction | Exact changed path | Proven local boundary / remaining limit |
|---|---|---|---|
| V1-040 | Spend used the non-strict parser, counting the header against the row limit and accepting partial numeric strings. Preview/process now use the existing strict parser; validate mapped headers, selected amounts, deterministic dates, currency symbols and combined numeric bounds before replacement. Uploaded preview metadata comes from the file; selection-only edits retain the stored preview. | `server/routes-oauth.ts`: `POST /api/campaigns/:id/spend/csv/preview` and `/process`; existing helpers in `server/utils/csv.ts` | Actual handlers retain all 50,000 data rows; reject row 50,001, duplicate/blank headers, wrong widths, malformed amounts, negative adjustments, EUR-dollar mismatch, invalid/ambiguous dates and overflow without a write. Exact singular/array campaign filters, USD thousands, valid edits, legacy undated edits, retained unmapped preview columns and neighboring Revenue checks pass. No claim of live UI/deployed acceptance or historical repair. |
| V1-071 | GA4 Revenue's validator accepted signed amounts that its positive-only materializer omitted. The validator now rejects negative selected amounts; the response explicitly states that negative CSV adjustments are unsupported. Native GA4 refund handling is unchanged. | `server/utils/csv.ts`: `isSupportedGa4CsvRevenueAmount`; `server/routes-oauth.ts`: Revenue CSV process validation error | `100` plus `-10`, `-$10` or `$-10` rejects before source replacement; positive selected Revenue and an unselected negative row retain the correct result. No silently invented allocation/netting. Existing affected sources require a read-only inventory and targeted re-upload/correction plan. |
| V1-073 | `writeGA4RefreshInputChange` locked campaign rows but ignored a missing result, allowing orphan writes after deletion. It now requires every distinct requested campaign to survive the transaction's parent lock before invoking the writer. Ordinary campaign updates preserve their existing `undefined` result when cancellation/deletion wins; owned-refresh errors remain errors. | `server/storage.ts`: `writeGA4RefreshInputChange`, `updateCampaign`, `updateCampaignWithGA4DailyInvalidation` | Real local PostgreSQL proves rejection with and without the durable-work table, multi-parent all-or-nothing checks, a save waiting behind a committed campaign deletion, no orphan source/record and an unrelated-campaign control. Cancellation/activation races and existing ownership/invalidation/recovery suites pass. No database migration or live orphan cleanup was performed. |
| V1-126 | One IP's shared five-request budget made five office users' previews consume every save allowance. Verified Clerk users now have separate five-preview/five-save budgets per five minutes; anonymous requests retain the shared IP budget. | `server/middleware/rateLimiter.ts`: `importRateLimiter` | Local HTTP tests prove five same-IP users can preview and save, each sixth preview/save is denied with retry information, and submitted user IDs cannot obtain an authenticated budget. Clerk identity is a fixture; live Clerk/proxy behavior, multiple-instance quota sharing and realistic full-import workload remain acceptance checks. |

**Input policy:** GA4 CSV Revenue and CSV Spend reject selected negative adjustments before any mutation. Plain numbers/US-style separators with at most two decimal places are supported; `$` requires USD. Zero rows beside positive rows preserve the correct total. An all-zero/blank selection still rejects under the existing no-positive-rows contract and is not published as an available zero source. The source reference is updated in [GA4 financial sources](../../../GA4/FINANCIAL_SOURCES.md). No other provider's amount policy is changed.

**Validation evidence:** [runner](validation-2026-10-22/run-tests.cjs), [parent defect reproduction](validation-2026-10-22/parent-before.json), [shared safeguard regression result](validation-2026-10-22/foundation-after.json), [CSV defect reproductions](validation-2026-10-22/csv-before.json), [CSV post-fix result](validation-2026-10-22/csv-final.json), [TypeScript/server build](validation-2026-10-22/checkpoint-build-checks.json). The shared-safeguard run passed 344/344 tests. The initial [foundation run](validation-2026-10-22/foundation-before.json) includes a local fixture-database startup failure; it is not counted as parent-defect proof. The subsequent parent reproduction has 57 passes and three confirmed defect failures. CSV reproduction has four controls passing and 20 defect failures. The CSV intermediate run has 72/73 passes: its one failing transaction assertion still expected a direct `db.transaction` call, although the current wrapper owns that transaction. The assertion was corrected to follow the wrapper and parent guard, retaining source/type/campaign and delete/insert ordering checks; actual PostgreSQL tests verify behavior independently.

**Final focused validation:** [357/357 database/lifecycle/import-budget checks](validation-2026-10-22/parent-final.json) and [73/73 CSV checks](validation-2026-10-22/csv-final.json) pass, together 430 tests. [Final TypeScript and server build](validation-2026-10-22/final-build-checks.json) pass. The first full run exposed two real compatibility regressions in ordinary campaign updates after cancellation: the new parent guard threw instead of returning `undefined`. The two update methods now preserve their documented return contract without running a source writer or recreating a campaign. The original cancellation tests were retained unchanged and pass; the missing-parent currency-update path is also checked. This correction required a second full run, rather than dismissing either failure as a baseline.

**Full regression result:** [4,488 tests: 4,309 passed, 179 failed, zero skipped](validation-2026-10-22/full-suite-final.json). [Failure reconciliation](validation-2026-10-22/failure-reconciliation.json) retains every failed identity, classification and release impact: no new failing identity or suite error remains. One previous failure now passes because the obsolete CSV transaction assertion was corrected and behavior independently checked; the other 179 and the separate CI-only gate remain open. The final full run used the [recorded candidate](validation-2026-10-22/candidate-manifest.json). After it, two catch branches were adjusted solely to preserve the pre-existing `CSV_TOO_LARGE` error-code field, and the route test now asserts that field; [all 73 CSV checks passed again](validation-2026-10-22/csv-response-final.json), followed by [TypeScript/server build](validation-2026-10-22/response-contract-build-checks.json). This is a focused follow-up, not a third whole-suite run. [Final candidate hashes](validation-2026-10-22/response-contract-manifest.json) distinguish the two snapshots.

**Fixture cleanup:** [Both local test databases](validation-2026-10-22/fixture-cleanup.json) have zero remaining fixture schemas, other client connections or advisory locks. Tests used only `127.0.0.1:55443`, stripped application credentials and blocked outbound network. The test-only PostgreSQL cluster was stopped after verification. [Documentation checks](validation-2026-10-22/documentation-check.json) validate the two main records, eight batch records and all 130 unique finding IDs. No application migration or production cleanup was executed.

**Limits and remaining work:** These are forward-path corrections, not whole-source certification. No browser test, deployed upload, provider comparison, existing-damaged-import inventory or production cleanup is claimed. Source delete/reconnect/scheduler/report behavior outside the listed tests is not newly certified. All findings retain release acceptance OPEN.

**Reusable safeguards:** Future imports can reuse the existing strict parser, validation-before-replacement sequence, transaction-held parent lock and authenticated workflow budgets. Reuse the boundary, malformed-input, unrelated-campaign, cancellation-race and retry-limit regression cases. The 50,000-row CSV cap, accepted number/date syntax and positive-only import policy are CSV-specific assumptions, not provider guarantees. Every new provider still needs its own permission, metric, attribution, currency, date, pagination and quota validation; no provider or framework was added here.

| Remaining implementation group | Finding IDs |
|---|---|
| Retained manual-Spend and cross-source transfer safeguards | V1-068, V1-069 |

**Remaining implementation work: two findings, V1-068/069, followed by Batch 4 acceptance.** The seven Custom Integration corrections are now locally verified at the checkpoint above; the earlier fifteen corrections retain their stated evidence. These are grouped work boundaries, not an estimate of individual edits, commits or elapsed time. Acceptance includes the required deployed/provider, lifecycle and downstream checks for all 24 Batch 4 findings; local fixes alone do not complete the batch.

**Execution method requested October 23:** finish related fixes within each group with fewer handoffs. Reuse isolated fixtures and traced paths; validate each changed behavior and its neighbors, then run the shared regression/build checks at the coherent group checkpoint. Repeat checks only for subsequent changes, failures or unresolved concerns. Update this record and the finding checklist as each item progresses. Consolidate reviewable commits/deployment checkpoints where dependencies permit; do not require a live refresh wait for independent local work or waive any required acceptance gate. No additional source exclusions or runtime changes accompany this scheduling clarification.

The standalone Sheets implementation group is verified locally and committed in `5bc33828`; deployed in `221382da`; public checks pass and authenticated/provider acceptance remains open. The Custom Integration group is now verified locally and uncommitted. The next implementation group is manual Spend/transfers (V1-068/069). All 24 release acceptances stay OPEN. Four-provider functional work remains deferred; shared retained-route safety remains required. No completion estimate or additional exclusion is inferred.

## Scope and acceptance

Strict complete file/range/column/numeric/currency, metric meaning and worksheet contracts, explicit aggregation/denominators through goals/reports, bounded expanded/aggregate input work, signed-adjustment policy, truthful validation/error/zero publication, exact transfer/cleanup/source provenance, saved selection and dates preserved on refresh/report generation, surviving-parent/atomic replacement. CSV Revenue, CSV Spend, Sheets Revenue, Sheets Spend, standalone Sheets and Custom Integration remain distinct sub-batches with their own acceptance.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) ownership, input and sender safeguards and [Batch 2](../v1-batch-2/README.md) lifecycle contracts. Align source/date/currency behavior with [Batch 3](../v1-batch-3/README.md); validate all [Batch 7](../v1-batch-7/README.md) consumers and [Batch 8](../v1-batch-8/README.md) workload/operational gates.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Custom import contracts and entry points](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md)
- [CSV Revenue and final-write boundary](../../audits/v1-2026-10-19/CSV_REVENUE_AND_PARENT_WRITE_TRACE.md)
- [Standalone Sheets and retained writes](../../audits/v1-2026-10-19/ACCOUNT_SHEETS_AND_RETAINED_WRITES.md)
- [Sheets/Custom value propagation](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md)
- [HTTP/database import workload](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-028](#v1-028) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-029](#v1-029) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-031](#v1-031) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-040](#v1-040) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-041](#v1-041) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-051](#v1-051) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-065](#v1-065) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-066](#v1-066) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-067](#v1-067) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-068](#v1-068) | P1 | OPEN | OPEN |
| [V1-069](#v1-069) | P1 | OPEN | OPEN |
| [V1-070](#v1-070) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-071](#v1-071) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-072](#v1-072) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-073](#v1-073) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-102](#v1-102) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-103](#v1-103) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-108](#v1-108) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-111](#v1-111) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-112](#v1-112) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-113](#v1-113) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-114](#v1-114) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-120](#v1-120) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-126](#v1-126) | P1 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-028

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed parser reproductions):

`services/custom-integration-file-parser.ts:82-105` uses non-strict 5,000-row CSV limit: 5,001 data rows become 4,999, confidence100, reviewfalse. Permissive numeric parsing accepts malformed amounts, sums mixed currency and misreads decimal-comma values. Duplicate CSV/XLSX Spend headers100/7 become14 through overwrite plus repeated header iteration217–229, also confidence100. Schema765 has no currency/report-period contract; UI/report currency formatting uses USD. Exact fixtures recorded. Separate GA4 financial CSV parser is not implicated by these cases.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-029

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed publication and fallback paths):

Custom imports persist and publish review-required metrics; latest-reader storage5780 has no validation-state filter. UI2806 labels Needs review but creates `latest_validated_import` scope; metric resolver still supplies KPI/Benchmark values. Scheduled report575-729 reads same row without validation gate or imported-period filter. Report financial builder498-538 turns failed revenue total read into an available zero when source exists (fixture). Webhook review URL has no registered page. Prevent unvalidated/failed reads from masquerading as validated period values; validate downstream artifacts.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-031

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained API reproduction):

`POST /api/custom-integration/transfer`, routes34100-34206: same source/destination deletes connection and metrics yet returns success; ordinary transfer copies without parser metadata/import timestamp and performs copy/delete nonatomically. Exact fixture confirms destructive same-ID outcome and omitted fields. No current frontend caller found, but route remains registered. Validate distinct owner-bound source/destination, atomic failure/retry and metadata preservation before retaining or excluding it.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-040

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 CSV Spend corruption):

`routes-oauth.ts:6545-6553` accepts up to50,005 approximate lines but non-strict parser stops at50,000 including header. Exact route fixture uploads50,000 data rows and persists49,999 with success. Same route's `aggregateCsvSpendRows` accepts malformed `12oops` as12; Revenue CSV's strict validator is absent. Validate whole-file completeness, amount/header/date/currency contract and source/downstream parity; existing damaged imports need read-only inventory.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-041

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 Sheets Spend corruption):

Routes6765/6905 fetch fixed `A1:ZZ5000` without completeness check; exact processing fixture with5,001 data rows persists4,999 and returns success. Permissive parseNum accepts12oops; entirely nonnumeric selected amounts write measured zero. Fetches lack abort signal. Auto-refresh reuses this route. Independent Revenue chunking safeguards do not cover Spend. Reject partial/invalid data and validate refresh/recovery/source totals.

**Implementation / validation:** Forward correction VERIFIED LOCALLY in the [October 23 Sheets Spend checkpoint](#sheets-spend-correction-checkpoint-october-23). Committed in `b650b631` on base `e635fe50` and deployed in `eb3fca00`; public checks pass, while required source/provider acceptance remains open. See exact changed paths, failing/fixed/neighbor/PostgreSQL checks, intentional maintenance-API change and remaining provider/lifecycle/historical-data gates there. Release acceptance remains OPEN.

### V1-051

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Sheets completeness/scope gap):

Main GET21785/21987 and `auto-refresh-scheduler.ts:813` read A1:Z1000. Exact refresh fixture caches999 rows as fresh without completeness check; page warns but aggregate consumers sum cached rows. Composite lookup can substitute another tab21834 and summary can broaden unmatched campaign to all rows22330. Scope/date/partial-data contracts must be enforced or effectively excluded.

**Implementation / validation:** Complete bounded main-sheet reads, exact fresh cache, atomic identity/order/parent-guarded publication and selected aggregate inputs are VERIFIED LOCALLY. The earlier selection correction is deployed in fb1132a2; the new completeness/cache changes are committed in `5bc33828`, now deployed in `221382da` with public checks passed; authenticated/provider acceptance remains open. See the [October 23 completion checkpoint](#standalone-sheets-completion-checkpoint-october-23) for exact paths, files, tests, limits and remaining acceptance. New changes are committed in `5bc33828`; deployed in `221382da` with public checks passed; release acceptance remains OPEN.

### V1-065

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets header data loss):

`routes-oauth.ts:5609–5620` duplicate headers overwrite earlier values before validation. Exact GA4 Revenue process fixture `[Revenue,Revenue]`/`[100,7]` persists7. Strict CSV Revenue's duplicate-header rejection does not cover Sheets.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-066

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets currency mislabel):

Sheets Revenue amount helper accepts `$`; process1456 strips it while5719–5731 checks only configured currency. Exact EUR fixture persists `$100` as100EUR without conversion. Malformed12oops control correctly rejects; preserve that existing syntax validation.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-067

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed refresh scope expansion):

`auto-refresh-scheduler.ts:587–626` ignores stored singular campaignValue, although Revenue save5442 accepts and preserves it. Exact refresh fixture changes selected10 into all-rows100; array-selection control stays10. Restore exact saved selection across save/preview/refresh and all downstream values; inventory potentially damaged sources separately.

**Implementation / validation:** Forward correction verified locally in the [October 23 Sheets Revenue checkpoint](#sheets-revenue-correction-checkpoint-october-23). Committed in `ace32e7b`, deployed in `e635fe50`; public deployment checks pass, required source/provider acceptance remains open. See the exact root cause, changed paths, failing/fixed/neighbor/persistence tests and remaining lifecycle/provider/historical-data limits there. Release acceptance remains OPEN.

### V1-068

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained manual Spend bypass/failure):

`routes-oauth.ts:5953,6010–6189` accepts caller sourceType; GA4 manual rejection is bypassed with sourceType=csv, persisting100 as CSV without a file. Non-GA4 insert failure is swallowed and returns success. Three exact handler cases include the normal GA4 rejection control. Enforce supported source creation paths and atomic truthful outcomes; do not silently delete existing records.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-069

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained transfer loss):

`routes-oauth.ts:33549,33626,33665`: GA4 and LinkedIn same-campaign transfer deletes newly copied and original connections but reports success. Sheets copy omits tab/purpose/auth-method/service-account/mappings/cache; GA4 forces access_token method. Three exact handler fixtures prove deletion/omissions. No current frontend caller found; retained API remains reachable.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-070

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed cleanup crosses source context):

`routes-oauth.ts:1571–1610,2520` groups Sheets Spend duplicates without platform/currency, reads all contexts and deletes all but earliest. Exact fixture deactivates legitimate LinkedIn EUR source beside GA4 USD using same mapping. Non-atomic delete steps and no expected-state check compound risk. Must prove exact damaged boundary before permitting cleanup; no live cleanup performed.

**Implementation / validation:** Forward correction VERIFIED LOCALLY in the [October 23 Sheets Spend checkpoint](#sheets-spend-correction-checkpoint-october-23). Committed in `b650b631` on base `e635fe50` and deployed in `eb3fca00`; public checks pass, while required source/provider acceptance remains open. See exact changed paths, failing/fixed/neighbor/PostgreSQL checks, intentional maintenance-API change and remaining provider/lifecycle/historical-data gates there. Release acceptance remains OPEN.

### V1-071

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed silent signed-amount omission):

GA4 CSV Revenue amount validator `utils/csv.ts:43` accepts−10 but aggregate105 and route4998 drop it. Exact handler saves100 from selected100/−10 with success. Define imported adjustment policy explicitly; accept/reconcile or reject unsupported amounts before mutation. Raw mapping retains the negative while records do not; every downstream total can therefore diverge from the uploaded file.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-072

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [retained CSV correction checkpoint](#retained-csv-revenue-correction-checkpoint-october-23).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained CSV loss/truncation):

`routes-oauth.ts:4813,5154–5178`: non-GA4 Revenue CSV accepts50,000 rows but saves49,999; LinkedIn conversion-value edit updates source and deletes old records before returning400 for invalid replacement. Both exact-handler fixtures reproduced. Validate before mutation and replace atomically within the existing storage architecture.

### V1-073

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated PostgreSQL parent-write gap):

`storage.ts:1256–1262,2832`: ordinary GA4 input wrapper ignores an empty campaign lock query and commits child writes after parent deletion. Exact methods against isolated schema reproduce zero parents/one source/one record; existing-parent control passes. Current source schema lacks campaign FKs. Durable-table/deployed-schema/other-source variants remain required. Reject vanished parents at final write and verify all caller lifecycles.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.

### V1-102

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed bounded resource-budget gap):

`server/services/custom-integration-file-parser.ts:371–399` synchronously inflates all ZIP entries without expanded/aggregate limits. A14,046-byte fixture expands12,584,919 bytes including unused padding and succeeds; no exhaustion was induced. Mailgun33943 parses arbitrary attachment count before signature; manual upload28186 correctly authorizes first. [Boundary and acceptance](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Protect expanded/cell/attachment work independently of compressed per-file size.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-103

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed XLSX selection ambiguity):

`server/services/custom-integration-file-parser.ts:344–367` selects the first archive worksheet, ignoring workbook visible order/hidden state. Identical worksheets/workbook yield Spend10 versus200 solely from ZIP entry order; hidden200 is accepted with confidence100/reviewfalse. [Actual parser cases](../../audits/v1-2026-10-19/xlsx-boundary-reproductions.json). Define explicit supported worksheet selection and reject ambiguity before downstream publication.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-108

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed measured-zero state loss):

`routes-oauth.ts:25238–25258`, `tiktok-analytics.tsx:839` require positive Revenue for source availability. Exact case with an existing source and measured0 returns null/source-required. [Paid evidence](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Standalone Sheets `google-sheets-data.tsx:979–987,1130,1165` independently shows valid0 Revenue/Spend as Not connected and blocks derived values/options; [four zero/negative cases and positive control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Distinguish zero, absent source and failed read before computing loss/zero ROAS.

**Implementation / validation:** Standalone Sheets measured zero, loss, absent source and failed/incomplete read distinctions are VERIFIED LOCALLY in the page and scheduled PDFs. The four-provider functional portions remain deferred; no claim is made for those providers. See the [October 23 completion checkpoint](#standalone-sheets-completion-checkpoint-october-23) for exact paths, files, tests, limits and remaining acceptance. New changes are committed in `5bc33828`; deployed in `221382da` with public checks passed; release acceptance remains OPEN.

### V1-111

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom financial failure-to-value):

`custom-integration-analytics.tsx:641–672,735–760,3094,3131,3185–3202` converts failed/malformed Revenue totals to0 and derives availability from a separate successful source list. Actual query/transform cases show confirmed Revenue0/Spend100/ROAS0/ROI−100 after a failed Revenue request; failed external Spend can present imported100 as the complete total. [Evidence and zero control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve error/partial/stale state through financial cards and source-backed consumers.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-112

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets ratio-consumer divergence):

`google-sheets-data.tsx:1479–1517` builds KPI/Benchmark options from raw summed metrics, ignoring server summaryValue. Spend190/Clicks110/CPC rows1+9 gives Summary1.72727 but options10 and actual browser PDF$10. Scheduled cached summary `report-scheduler.ts:3474–3522` also sums arbitrary metric/identifier columns. [Exact helpers and rendered artifact](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve one verified aggregation contract through Summary, goals, Insights and every report; server refresh/alert propagation remains open.

**Implementation / validation:** Shared summary values, including unavailable states, now propagate to current goal displays, Insights calculations and actual browser/scheduled PDFs. These corrections are VERIFIED LOCALLY; persisted goal/alert updates remain V1-122 and full artifact parity remains V1-060. See the [October 23 completion checkpoint](#standalone-sheets-completion-checkpoint-october-23) for exact paths, files, tests, limits and remaining acceptance. New changes are committed in `5bc33828`; deployed in `221382da` with public checks passed; release acceptance remains OPEN.

### V1-113

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets scheduled report scope mismatch):

`auto-refresh-scheduler.ts:865–881` caches unfiltered rows; `report-scheduler.ts:3474–3522,3572–3707` selects a connection but ignores its selected campaign values and report date window. Actual PDF labelled campaignA/October2026 printsSpend100 including campaignB/2020Spend90; mappedA amount is10. [PDF, fixture and scope controls](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Enforce saved selection and actual date coverage before generation, send or snapshot; do not silently apply an arbitrary date column.

**Implementation / validation:** Exact saved connection/campaign selection and actual scheduled-report date windows, including confirmed financial reads and no-artifact failure behavior, are VERIFIED LOCALLY. Real scheduled sending/inbox and full snapshot lifecycle remain open. See the [October 23 completion checkpoint](#standalone-sheets-completion-checkpoint-october-23) for exact paths, files, tests, limits and remaining acceptance. New changes are committed in `5bc33828`; deployed in `221382da` with public checks passed; release acceptance remains OPEN.

### V1-114

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets summary formula ambiguity):

`routes-oauth.ts:21722–21781` uses first matching financial header and unweighted rate averages. Actual helper cases choose Budget1000 before actual Spend100 (ROAS0.2 instead of2 for Revenue200), and unequal-impression CTR rows1%/100% produce50.5% instead of count-derived1.9802%. [Exact cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Define explicit metric/denominator mappings, fail closed on ambiguity and preserve bounded/undefined rates; column order must not redefine actual spend.

**Implementation / validation:** Unambiguous mapped/header inputs, denominator-based ratios, weighted CTR, mapped conversion-value strategy and invalid/unavailable handling are VERIFIED LOCALLY. Broader currency propagation remains V1-106; provider/date/metric acceptance is not inferred. See the [October 23 completion checkpoint](#standalone-sheets-completion-checkpoint-october-23) for exact paths, files, tests, limits and remaining acceptance. New changes are committed in `5bc33828`; deployed in `221382da` with public checks passed; release acceptance remains OPEN.

### V1-120

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom metric meaning change):

`server/services/custom-integration-file-parser.ts:28,35–41,217–264` aliases sent→delivered, opens count→open rate, exit rate→bounce rate and new subscribers→list growth. Exact CSV1000/50/20/30 becomes those four fields with confidence100/reviewfalse; client displays opens50 as50.00%. [All28-field evidence and boundaries](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Require supported metric definitions/denominators or reject ambiguous mappings before publication; historical correction needs exact original source evidence.

**Implementation / validation:** The [October 23 Custom checkpoint](#custom-integration-correction-checkpoint-october-23) records the exact root cause/path, changed-file manifest, passing boundary tests, remaining failures, compatibility/recovery behavior and lifecycle/downstream limits. Uncommitted on `221382da`; not deployed. Local forward correction is verified within that boundary; full deployed/provider/historical-data acceptance remains OPEN.

### V1-126

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN. See the [current correction checkpoint](#first-correction-checkpoint--october-22).

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed modest-load onboarding blocker):

`middleware/rateLimiter.ts:44–59` shares five imports/IP/five minutes across preview and save. Revenue wizard1507/1604 needs both; handlers4698/4735 share the bucket. [Actual HTTP/DB five-user fixture](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md): five valid previews succeed, all five saves429/retryAfter300, no sources written. Preserve abuse limits while accommodating authenticated users/workflow; no production traffic used.

**Implementation / validation:** The forward-path correction in `c3806282` is VERIFIED LOCALLY in the [October 22 checkpoint](#first-correction-checkpoint--october-22), including exact paths, reproduction, regression evidence and limitations. Deployed/provider, complete downstream lifecycle and historical-data acceptance remain OPEN.
