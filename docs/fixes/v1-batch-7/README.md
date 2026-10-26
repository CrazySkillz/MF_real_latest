# Batch 7: Diagnostics, goals, retained pages, alerts and reports

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 7 status

**Localized supplied-PDF correction, October 26:** [Root causes, fixes and evidence](REPORT_CONTEXT_CHECKPOINT.md#localized-correction-after-the-supplied-pdf-review) pass **505/505 checks in 38 files**, TypeScript and both builds. Missing-Spend notice gating, missing-history metadata, scheduled ROI, axis ticks and browser Trends pagination are corrected in two runtime files (12 added / 5 removed lines). Five synthetic PDFs / 14 pages inspected; historical artifacts and source/scheduler/storage code preserved. Uncommitted/undeployed. The emailed filename suffix was user-added. Release acceptance remains open pending the deployed recheck and previously recorded broader gates.

**Deployed PDF review, October 26:** The user reports `3caf3e9c` deployed and supplies emailed/browser Insights PDFs. [Six-page comparison and exact limits](REPORT_CONTEXT_CHECKPOINT.md#user-supplied-deployed-pdf-comparison--october-26) confirms matching EUR 8,003.96 / 604 sessions / 40 conversions through October 25, but finding/confidence/ROI content and page/axis layout differences remain. The missing-spend finding's historical browser state is unproven. No runtime or production data changed. V1-085/V1-015 and release acceptance stay open; next is the localized report correction/reproduction, not source reconnection.

**Report-context publication packet, October 26:** The user authorized commit/push of the [consolidated fixes and evidence](REPORT_CONTEXT_CHECKPOINT.md). All runtime/test/PDF hashes match the 555-check/build packet. Earlier uncommitted statements record validation time. Deployment and release acceptance remain unverified/open; no counts change.

**Consolidated report context packet, October 26:** [Current evidence and exact limits](REPORT_CONTEXT_CHECKPOINT.md): **555/555 checks in 39 files**, TypeScript and both builds pass. Scoped history, channel reconciliation, direct Reports-tab inputs, campaign-created trend dates and complete finding titles are corrected. All six report types run locally; six generated PDFs retain exact bytes through scheduled/history/download paths. Seven PDFs / 11 pages inspected. Two runtime files change; uncommitted/undeployed. Local pass complete for documented cases; V1-085/V1-015 and release acceptance remain OPEN for the documented live and coverage gates. Earlier narrower checkpoint statements are historical.

**Scheduled Insights target checkpoint, October 26:** [Exact scope, evidence and remaining gates](INSIGHTS_TARGET_CHECKPOINT.md). Saved KPI/Benchmark target checks, missing-input/configuration warnings, financial findings and the twelve-item PDF summary are corrected locally. **266/266 checks in 21 files, zero failed/skipped; TypeScript/server build pass.** One runtime file changes. Uncommitted/undeployed. V1-085 still needs history/channel/negative-state parity; V1-015 still needs complete artifact/source-mix and live delivery evidence. Counts and release gates remain unchanged. The latest “done” confirms only the user's prior-deployment/basic campaign-opening smoke check.

**Retained pages/report publication packet, October 26:** The user authorized committing and pushing the tested corrections and their evidence. All 11 tested source hashes still match the 306-check/final-build packet. Earlier uncommitted statements record validation time. Deployment and UI acceptance remain unverified; V1-015/V1-085 and all release acceptance gates remain OPEN. Detailed KPI/export/report UI validation will be consolidated after the remaining report work; a campaign-opening smoke check alone does not close those gates.

**Retained pages/report checkpoint, October 26:** [Current evidence and exact remaining scope](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records six additional locally verified corrections (V1-061/062/064/086/129/130), partial trend/negative-state correction for V1-085, and a saved-source artifact fixture for V1-015. **306/306 checks in 19 files pass, zero failed/skipped**; the final production build packet is linked there. Twenty-six findings now have local forward-path evidence, V1-125 is locally excluded by user decision, and **two findings remain OPEN: V1-015 and V1-085**. Full non-trend report parity and current browser/scheduled/immutable artifacts plus real delivery are not certified. Changes are uncommitted/undeployed; all 29 release acceptances remain OPEN. The user reported completing the previous client-selection/Campaign Overview smoke check; direct `/dashboard` not-found behavior was not separately confirmed. Earlier checkpoint counts below are historical.

**Dashboard publication packet, October 26:** The user authorized committing and pushing the verified V1-125 page removal and its 23-check/build evidence. Earlier uncommitted statements record validation time. The unfinished Audiences edits are excluded. Deployment and the short client-selection/Campaign Overview/removed-route UI check remain unverified; the eight remaining Batch 7 items and all release acceptances are unchanged.

**Dashboard scope decision, October 26:** The user explicitly requires no separate Dashboard page. V1-125 is now effectively excluded locally: the page, import, route and unused welcome preview are removed; `/clients` selects the exact client and opens All Campaigns. There is no `/dashboard` redirect. **23/23 targeted checks pass**; the same new tests reproduce four expected failures on `fa9fb67a`. [Evidence and build results](validation-2026-10-26/retired-dashboard-evidence.json). Changes are uncommitted/undeployed. No campaign records, server routes, storage, schema, schedulers or calculations were changed. Earlier Audiences edits remain in progress and are not accepted by this packet.

**Remaining work at the Dashboard checkpoint (superseded above):** Twenty findings had local forward-path evidence and V1-125 a user-approved local exclusion. Eight findings remained: V1-061/062/064/129/130 and V1-015/085/086. All 29 release acceptances remained OPEN.

**Group 2 publication packet, October 26:** The user authorized committing and pushing the verified metrics/source-backed-goal changes and their 675-check plus 59-check follow-up evidence. Uncommitted/undeployed statements below describe validation time. This publication does not close live acceptance, the remaining nine implementation findings, or Batch 6's postponed sign-off.

**Current Group 2 checkpoint, October 26:** All twelve metrics/source-backed-goal findings have local forward-path evidence: V1-056/077/084/094/095/096/097/098/099/100/101/122. **675 checks in 40 files pass**, with no failed/skipped checks; TypeScript, client and server builds pass. V1-101 was already corrected at the current baseline and is verified without another precision change. Group 2 is uncommitted and undeployed. Group 1 was committed/pushed as `1de80e15`; its deployment has not been independently verified.

**Remaining work:** Twenty of the 29 original findings now have local forward-path evidence. **Nine findings remain in two implementation groups**: retained pages/forms/exports (V1-061/062/064/125/129/130, six) and report content/layout/parity (V1-015/085/086, three), followed by combined validation. All 29 release acceptances remain OPEN. Batch 6 live sign-off remains postponed. No browser, production records, provider accounts or actual email service were accessed.

Earlier checkpoints below preserve their validation-time state. They are superseded by this checkpoint where they describe current counts or commit state.

**Publication packet, October 26:** The user authorized committing and pushing Group 1 and its 680-check evidence for Render deployment. Statements below saying uncommitted/undeployed record the validation-time state. This publication does not close deployed/provider acceptance or Batch 6's postponed sign-off; 21 Batch 7 implementation findings remain.

**Deployment/UI update, October 25:** The user reports `825972a9` deployed and confirms that no saved reports currently exist. The focused saved-report download check has therefore not been performed; keep it in the combined live validation round. No test report, schedule or email was created, and no browser/provider access was performed. This does not block local work on the remaining findings or close live acceptance.

**Consolidated work, earlier Group 1 checkpoint:** Group 1 (V1-021/022/058/059/110) is now corrected and verified locally as recorded below. Eight original Batch 7 forward defects have local corrections; **21 findings remain in three implementation groups**: metrics and source-backed goals (V1-056/077/084/094/095/096/097/098/099/100/101/122, twelve); retained pages/forms/exports (V1-061/062/064/125/129/130, six); report content/layout/parity (V1-015/085/086, three). A combined regression/live-validation round follows. All 29 release acceptances remain OPEN; Batch 6 sign-off is separately postponed.

**Publication packet, October 25:** The three tested report-history/Meta corrections and their evidence accompany the user-authorized commit and push. Deployment and live acceptance remain unverified. Statements below saying uncommitted describe the validation-time state; the remaining 26 findings and all 29 release acceptances remain OPEN.

**IN PROGRESS, October 25.** The latest combined evidence has **680 passing checks in 32 files**, including 60 new real-PostgreSQL reliability cases. TypeScript and the server build pass. Group 1 is uncommitted and undeployed; the earlier three fixes were pushed in `825972a9` and the user reports deployment. No production records, user browser, provider account or actual email service were accessed during this work.

The user postponed Batch 6 live sign-off after Google account verification blocked login and requested Batch 7 work. Batch 6 is not certified or excluded; live Google Ads validation remains pending. The prior public health observation of `4cd498cf` proves deployment only.

## Metrics and source-backed goals checkpoint, October 26

**Boundary:** Group 2's twelve recorded findings, within the existing UI, centralized routes, storage, shared metric helpers and alert-decision paths. This is local forward-path verification, not whole-section or production certification. [Evidence manifest](validation-2026-10-26/metrics-evidence.json) records revision, hashes, tests, builds and test-database cleanup.

| Finding | Confirmed root cause / traced path | Correction and local evidence |
|---|---|---|
| V1-056 | Retained Trend API summed raw active records across source contexts/grains; its aggregate overwrote native revenue, combined web/paid conversions and chose clicks first. | `routes-oauth.ts` uses canonical eligible source IDs, campaign currency, date bounds and aggregate-row precedence, with a reconciliation guard. `trend-analysis-aggregate.ts` adds imports to native revenue, preserves explicit zero and uses web conversions/sessions when available (including Custom web metrics). Actual HTTP and PostgreSQL query cases cover other campaigns/sources, future dates, aggregate/subcampaign duplicates, aggregate zero, empty source arrays, errors and access denial. |
| V1-077 | Failed daily reads became empty success; the browser padded missing/unrequested dates with zeros, and PDF comparisons sliced rows instead of calendar windows. | Daily read failure now reaches HTTP 500. Trends/findings keep recorded facts only, preserve explicit zeros and require complete adjacent calendar windows. Browser and scheduled PDF calculations use existing calendar helpers. Executed extracted expressions, real route callbacks and neighbors cover failed/empty/zero reads, missing days, unrequested history and complete windows. |
| V1-084 | Two financial finding titles hard-coded `$0`. | Both use existing campaign currency formatting; EUR/USD/JPY title expressions pass. Browser PDF uses these findings. No money calculation changed. |
| V1-094 | Equality fell through to positive return / before period end. | Revenue=Spend is break-even in the client and both report branches; projected exhaustion exactly at period end says on. Negative/equal/positive controls pass without formula changes. |
| V1-095 | Cached native traffic could be stale while related financial recommendation inputs stayed ready. | Performance Summary propagates native stale/unavailable state into native revenue and financial conversions; imported-only revenue and independent spend retain their own state. Exact expressions and scoring neighbors pass. |
| V1-096 | Daily summed GA4 users lacked grain explanation in included downstream consumers. | Performance Summary, Trend and Executive labels/notes plus browser/scheduled report copy identify daily sums. Calculations and persisted data are unchanged. Source inspection and builds cover the copy; visual wrapping in generated reports remains unverified. |
| V1-097 | Trend headline normalized an already-percent engagement rate a second time. | Format the percent directly. 0, 0.5, 1, 1.01 and 50 percent controls pass; fraction-based daily consumers remain unchanged. |
| V1-098 | Zero-session cumulative totals generated a misleading zero ratio. | Trend cumulative helpers/headline/report website summaries and GA4 Overview/browser/scheduled cards withhold undefined ratios while retaining measured zero counts. Zero/positive-denominator helper/report controls pass. Broader report parity remains in V1-085/086. |
| V1-099 | Executive CVR label used the presence of clicks instead of its chosen denominator. | Label follows the aggregate CVR provenance. Mixed web/paid fixture yields 10% session-based CVR; paid-only fixture yields 25% click-through CVR. |
| V1-100 | Executive API selected the first GA4 connection, defaulted all to 30 days, lost native revenue and double-added pageviews. | Primary property and persisted scoped daily facts use the configured initial import through latest completed day, clamped for 7/30/90-day requests. No live-provider total is mixed in. Empty/failed reads leave unavailable fields. Actual branch execution verifies property, window, native revenue, pageviews and errors. Full Executive HTTP/provider parity remains unverified. |
| V1-101 | Original audit recorded fractional conversion truncation in Executive headline/goal formatting. | Current baseline already uses `formatConversionCredit`. Exact current formatter controls preserve 0, 0.75 and 12.25. No new precision implementation was needed. |
| V1-122 | Central alert decisions returned stored Custom/Sheets goal values even when source-backed UI values differed or were unavailable. | Existing resolver reads exact saved integration/tab/column scope, validated Custom imports or complete fresh filtered Sheets cache, and platform financial totals. It rechecks campaign/source identity, preserves manual goals, and blocks missing/stale/failed/mismatched inputs. KPI/Benchmark false-positive/negative/zero/fractional/financial controls pass. Sheets reads explicitly disable token migration and runtime credential resolution; actual storage-method tests prove read-only behavior and unchanged default behavior. |

**Paths and limits:**

| Lifecycle / downstream path | Evidence in this packet | Still unverified |
|---|---|---|
| Source add/edit/delete/refresh | Controlled latest-import/cache replacement, missing/deleted source, changed identity and active-but-unmaterialized finance inputs exercise the resolver. Source mutations/schedulers are not changed. | Full source HTTP/provider mutation lifecycles and natural refresh timing were not re-run by Group 2. |
| Read/list/totals | Real GA4 daily and retained Trend HTTP handlers; compiled production financial SQL runs against disposable PostgreSQL temporary tables. Campaign/source/date and zero/grain boundaries pass. | Canonical storage eligibility totals are controlled in these route tests; this is not a fresh certification of every underlying source storage query. Production history inventory is not performed. |
| Goal/notification/email decisions | Actual central resolver and existing aggregate/filter helpers execute for both goal kinds; caller regression checks cover shared decision usage. Failed source resolution cannot use the stored numeric goal value. | No production notification or real email is created. Real provider freshness, independent-worker races between the final read and dispatch, and delivery acceptance remain open. |
| Display/scoring/reports | Exact UI expressions, cumulative/aggregate helpers, report metric branches and neighboring consumer guards pass. Copy is inspected and compiled. | No browser UI or rendered PDF layout check; full artifact/value parity belongs to V1-015/085/086 and the combined live round. |
| Existing records | No persisted financial/goal records are rewritten by this packet. The new cache-only read avoids connection credential writes/renewal. | No damaged-data boundary is inferred, and no production cleanup/backfill is attempted. |

**Validation:** [Consolidated results](validation-2026-10-26/metrics-verified.json): 675 passed, zero failed/skipped, 40 files. Twelve new route cases include three real-PostgreSQL cases. Final review preserved the Executive GA4 response field set explicitly and added four missing/failed/zero controls; the affected four files then passed [59 focused checks](validation-2026-10-26/metrics-api-contract.json). [Final TypeScript/server build](validation-2026-10-26/metrics-api-contract-build-checks.json) pass; [client production build](validation-2026-10-26/metrics-final-build-checks.json) passed before the last server-only safety/contract changes. Client code was unchanged afterward. The 84-case initial baseline packet records 68 failures and 16 passes against extracted `1de80e15` code; directly imported helpers remained working-tree code, so it is not a whole-revision baseline test.

Initial harness issues (worker permissions, AST branch selection, expected owner-denial status and SQL-array expectations) were corrected. The PostgreSQL run exposed and verified the required typed SQL array binding. Four obsolete assertions in the consolidated pass were aligned with the new daily/Executive contract or the existing immutable historical-PDF contract; the earlier storage transaction assertion was also stale at HEAD. No historical PDF route or publication transaction runtime changed in this group. Intermediate failures are retained as diagnostic evidence, not acceptance.

Twelve runtime files change. There are no new dependencies, schema changes, provider mutations, send actions or production cleanup. Local test credentials are stripped, outbound networking is restricted to loopback, and the owned disposable PostgreSQL instance is stopped after verification. Group 2 is ready for a separately authorized commit/push; the remaining groups and all release gates stay open.

## Reliability checkpoint, October 25

**Scope:** all five findings in Group 1. This is a forward-path implementation checkpoint, not whole-section production certification. [Evidence manifest](validation-2026-10-25/reliability-evidence.json) records exact file hashes, result packets, cleanup checks and limits.

| Finding | Confirmed root cause and traced path | Correction |
|---|---|---|
| V1-021 | `checkScheduledReports`: two workers read the same stale event and both updated it without checking the observed claim. An expired worker could also overwrite the new worker's result. | Retry uses event ID, observed status and creation timestamp as a conditional claim; every preparation write uses that claim. The original PDF and exact audit identity are committed before dispatch. There is one provider dispatch per prepared slot. |
| V1-022 | Scheduled delivery swallowed snapshot insert errors, then independently wrote `sent` and advanced `lastSentAt`. | Confirmed delivery inserts the original snapshot, marks its event sent and advances report bookkeeping in one transaction. Report/event locks serialize finalization; a failed write rolls back all three. Older recovery cannot move `lastSentAt` backwards. |
| V1-058 | Confirmation chose the latest successful audit for a report, potentially belonging to another attempt; missing/failed audit reads and non-Mailgun acceptance could be treated as delivery. | Scheduled and test sends use an exact audit ID. Missing evidence and provider acceptance stay unconfirmed. Poll updates are conditional and use the persisted result, preserving a concurrent confirmed outcome. |
| V1-059 | `pending_delivery` events were excluded from subsequent processing; original attachment bytes existed only in the lost worker's memory. | Existing audit metadata retains the original PDF/identity before dispatch. Each scheduler check reconciles pending events before selecting due reports, including paused schedules. Recovery never rebuilds or resends; current parent/report/campaign/platform and saved event/recipient/artifact identity must agree. |
| V1-110 | Dismissal, resolution, active-alert refresh and supersession replaced whole metadata copied from earlier reads. This erased concurrent history and changed the email episode key. | Existing SQL writes merge against persisted metadata. Resolution preserves the first resolved timestamp/reason. Individual dismiss, clear, legacy hide and KPI/Benchmark deletion preserve concurrent resolution. Unchanged empty/malformed legacy dismissal metadata retains its previous handling. |

**Files changed:** `server/report-scheduler.ts`, `server/services/email-service.ts`, `server/routes-oauth.ts`, `server/storage.ts`, `server/kpi-notifications.ts`, `server/benchmark-notifications.ts`. Existing tables, route shapes, access guards, PDF builders, email body, schedule times and financial calculations remain. No dependencies or schema migration. The prepared artifact uses the existing report audit metadata field. Report audit updates merge that metadata; other email kinds keep their existing behavior.

**Retry behavior is deliberately conservative:** only marked pre-dispatch preparation failures can be retried. An accepted/ambiguous dispatch is never blindly resent, including after a crash between preparation and provider response. A slot without a provider message ID may therefore remain unconfirmed. SMTP/provider acceptance alone does not create a confirmed scheduled snapshot. Legacy pending/failed events without exact original evidence are preserved and not automatically retried or reconstructed. These limits avoid duplicate mail and invented history; they are not claims of eventual delivery.

**Validation:** the [frozen `825972a9` comparison](validation-2026-10-25/reliability-baseline-final.json) records **20 passed / 40 failed / 0 skipped** across the same 60 cases. These are test outcomes, not 40 separate defects; several assertions require the new prepared artifact contract. The latest [60 reliability cases and five immediate-route guards](validation-2026-10-25/reliability-final-supplement.json) pass. Together with the [neighbor packet](validation-2026-10-25/reliability-neighbors-final.json), replacing those two files with their latest results, the current unique total is **680 passed / 0 failed / 0 skipped in 32 files**. [TypeScript and server build](validation-2026-10-25/reliability-final-confirm-build-checks.json) pass. The intermediate neighbor packet's two failures were old signature assertions: all four object-spread update calls already existed at `825972a9`; only their test expectations changed. Manifest records that proof.

The new fixture executes actual extracted scheduler, email audit, retained notification handlers, alert update/resolution and episode functions with real storage SQL. Controlled provider responses and synthetic PDF bytes avoid external effects. PostgreSQL interleavings cover stale pending/failed claims, expired workers, simultaneous recovery, each finalization write failing, restart-style context recreation, paused/edited reports, poll errors, exact message identity, missing/foreign/read-failed/accepted-only audits, missing parents, changed platform, corrupt artifacts and mismatched identities. Notification cases cover both write orders, active refresh/supersession, transactional resolution, item deletion, malformed legacy dismissals, foreign/anonymous access, and clear/rebreach/repeated email claims. Neighbor checks preserve historical downloads/access across ten stored platform identifiers, report publication, source isolation, notification locks and email eligibility/retry behavior.

**Remaining unvalidated:** real provider response/inbox confirmation, actual PDF rendering and values, browser/report UI flows, process-kill and independent-host deployment recovery, production historical inventory and exact remediation for legacy evidence gaps. Tests use contending database connections and restarted function contexts, not real process crashes. No existing production data was rewritten. The current UI has no rendered dismiss/clear controls; those retained endpoints were checked directly, not through invented UI steps. User reports no saved reports, so the combined live report check remains pending. All 29 Batch 7 release acceptances and whole-app NO-GO remain unchanged.

**Cleanup:** the manifest confirms zero owned disposable schemas/sessions in both test databases. [Shutdown evidence](validation-2026-10-25/reliability-cleanup.json) confirms the local PostgreSQL cluster started for this work is stopped; its existing data directory was preserved. No commit or push was performed.

## Report history checkpoint, October 25

**Root causes.** Non-GA4/non-Diagnostics historical PDF downloads rebuilt output from mutable current report/source data, and their producers did not retain original bytes. The reader also compared an immutable snapshot template with the editable current report template. Separately, retained Meta PATCH/DELETE ignored the actual storage mutation result after access checks. [Frozen deployed-baseline tests](validation-2026-10-25/history-baseline-final.json) reproduce these boundaries: 18 passed / 42 failed / 0 skipped at `4cd498cf`. All the same 60 cases pass after correction.

| Finding | Exact changed path | Correction and compatibility |
|---|---|---|
| V1-060 | `routes-oauth.ts` manual snapshot POST/PDF GET; `report-scheduler.ts` scheduled artifact capture | Supported manual snapshots and scheduled PDFs preserve validated original bytes in the existing JSON format. Downloads never rebuild from today's data. Old history without original bytes returns 422; its metadata is preserved. No production backfill or cleanup. |
| V1-119 | `routes-oauth.ts` snapshot PDF identity checks | Current owner/campaign/platform checks remain. Payload report/campaign/platform/template/window must match the immutable row. Later name/template/configuration edits cannot change a valid original PDF. Deleted parents/reports still fail closed; owner-accessible archived history remains readable. |
| V1-074 | `routes-oauth.ts` retained Meta PATCH/DELETE | Return 404 if the actual mutation changed no row. Preserve owned success shapes and foreign/anonymous denial. These legacy endpoints remain registered; current Meta UI uses generic platform report endpoints. |

Only two runtime files change. No schema, dependency, UI layout, financial formula, source import, email body or schedule changes. GA4/Diagnostics artifact semantics are reused. The incomplete generic Ads overview/ads/custom PDF body remains a separate report-content issue; storing bytes does not certify their content.

**Validation.** [Final packet](validation-2026-10-25/history-final.json): **412 passed / 0 failed / 0 skipped across 10 files**. [The new 60-case suite](../../../server/v1-batch7-report-history-postgres.test.ts) covers ten stored platform identifiers, manual/scheduled capture, subsequent edited versions, repeated scheduled-slot suppression, byte equality, missing/invalid artifacts, corrupted identity, owner/anonymous/foreign access, missing parent/report, archives, and Meta disappearance/retry/success outcomes. Neighbors cover source isolation, report access, saved GA4 publication, Campaign Diagnostics report limits/windows, Google Ads reports and artifact validation. [TypeScript/server build](validation-2026-10-25/history-final-build-checks.json) pass. Client code is unchanged.

Tests mount actual extracted HTTP/access callbacks in local Express, execute real `DatabaseStorage` SQL and the actual scheduled checker, and use disposable PostgreSQL tables from shared schema columns/defaults/CHECKs plus the report-slot unique index. Actor, PDF builder and delivery adapters are controlled. Synthetic PDF bytes prove preservation, not rendered values/layout, provider truth, delivery or production migrations. No email was sent.

Initial fixture issues (required Meta fields, a date override changing both sides, and DELETE Content-Length) were corrected before the final baseline/fixed runs. Structural assertions requiring regeneration/template rejection were updated to the immutable contract. One stale LinkedIn assertion was independently compared with unchanged `4cd498cf:server/scheduler.ts` and updated to include its existing production-test guard; that runtime file is unchanged. Intermediate failing packets remain evidence, not acceptance.

**Remaining acceptance.** Browser edit/download, actual template rendering/attachment parity, full source lifecycle propagation, independent-worker races, corrupt snapshot-list rows, production historical inventory, missing-original recovery and natural scheduled delivery remain unverified. Existing absent bytes cannot be reconstructed truthfully from current values. V1-021/022/058/059 are traced but not fixed by this packet. Their claim, confirmed-send persistence, exact-attempt delivery and late-recovery requirements remain open.

### Remaining inventory at the earlier report-history checkpoint

| Work area | Original IDs still OPEN | Current boundary |
|---|---|---|
| Delivery/recovery | V1-021, V1-022, V1-058, V1-059 | Current scheduler/audit code traced; correction and worker/crash/recovery tests remain. |
| Report content/layout | V1-015, V1-085, V1-086 | Browser/scheduled/download value parity, rendered layout and confirmed delivery unverified. |
| Diagnostics/GA4 values | V1-056, V1-077, V1-084, V1-094, V1-095, V1-096, V1-097, V1-098, V1-099, V1-100, V1-101 | Original evidence inventoried; current complete value/fallback/downstream review and fixes remain. |
| Notifications/source-backed goals | V1-110, V1-122 | Original lifecycle evidence read; correction and decision/history/email-episode validation remain. |
| Retained pages | V1-061, V1-062, V1-064, V1-125, V1-129, V1-130 | Functional correction or agreed effective exclusion remains; no new exclusion is assumed. |

This table records the earlier three-fix checkpoint. The current Group 2 status and remaining nine implementation findings are listed above; neither checkpoint is Batch 7 completion or production sign-off.

## Scope and acceptance

Consistent financial/conversion grain and precision, source-specific denominator labels, explicit rate units and correct primary-property/window API contracts; verified daily coverage, source-aware stale propagation and zero/missing/equality states; exact source-backed goal value/state through UI, notification and email decisions; concurrent notification visibility/resolution and email episodes; retry claims, immutable historical identity/artifacts, exact send-attempt confirmation, late delivery recovery without resend; accurate mutation outcomes/export formats/date windows and readable long labels. Compare browser PDFs, scheduled attachment and later snapshot downloads across included sources.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Consume verified native/source contracts from [Batches 3](../v1-batch-3/README.md), [4](../v1-batch-4/README.md), [5](../v1-batch-5/README.md) and [6](../v1-batch-6/README.md). Preserve [Batch 1](../v1-batch-1/README.md) access boundaries and [Batch 2](../v1-batch-2/README.md) parent lifecycle. Coordinate receipt, natural jobs and artifact/recovery acceptance with [Batch 8](../v1-batch-8/README.md).

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [KPI/Benchmark and diagnostic value trace](../../audits/v1-2026-10-19/KPI_AND_DIAGNOSTIC_VALUE_TRACE.md)
- [GA4 Insights calendar/findings](../../audits/v1-2026-10-19/GA4_INSIGHTS_CALENDAR_AND_FINDINGS.md)
- [Notification lifecycle](../../audits/v1-2026-10-19/NOTIFICATION_VISIBILITY_LIFECYCLE.md)
- [Rendered report parity](../../audits/v1-2026-10-19/REPORT_PDF_RENDER_AND_FINDINGS.md)
- [Report snapshot lifecycle](../../audits/v1-2026-10-19/REPORT_SNAPSHOT_ACCESS_LIFECYCLE.md)
- [Other page-specific inventories](../v1-batch-8/README.md#original-audit-evidence-catalog)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-015](#v1-015) | P1 | OPEN | OPEN |
| [V1-021](#v1-021) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-022](#v1-022) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-056](#v1-056) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-058](#v1-058) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-059](#v1-059) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-060](#v1-060) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-061](#v1-061) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-062](#v1-062) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-064](#v1-064) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-074](#v1-074) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-077](#v1-077) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-084](#v1-084) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-085](#v1-085) | P1 | OPEN | OPEN |
| [V1-086](#v1-086) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-094](#v1-094) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-095](#v1-095) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-096](#v1-096) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-097](#v1-097) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-098](#v1-098) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-099](#v1-099) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-100](#v1-100) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-101](#v1-101) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-110](#v1-110) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-119](#v1-119) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-122](#v1-122) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-125](#v1-125) | P1 | OPEN | OPEN |
| [V1-129](#v1-129) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-130](#v1-130) | P1 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-015

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: required artifact/delivery gate):

Browser PDFs, immutable snapshots, scheduled server artifacts and confirmed delivery need current-revision/source-mix parity. Browser `ga4-metrics.tsx:4130` labels source-to-date amounts; scheduled PDF fixtures enforce completed-day amounts. October19 deployed counter had0sent; October20 at09:00 had1 and final16:48 observation has2. Aggregate counters do not identify the artifact/campaign, verify its values or prove delivery. No email was triggered by the audit.

**Implementation / validation:** Synthetic completed-day source amounts and unmapped-campaign behavior are covered in a complete scheduled payload and actual PDF. Current browser/scheduled/immutable artifact parity for all offered report/source mixes and confirmed provider delivery remain OPEN. See the [current checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) for precise evidence and exclusions. No release certification is claimed.
### V1-021

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated reproduction):

`server/report-scheduler.ts:4335-4356,4820`: two workers can both retry a stale pending/failed report slot. Retry update has no compare-and-set owner/lease and does not inspect claimed row count. Exact extracted function with fixture DB lets both invocations pass the claim; stops before any email. This proves nonexclusive claiming, not actual duplicate delivery. Requires an atomic retry claim and multi-worker/expiry/crash regression.

**Implementation / validation:** [Reliability checkpoint](#reliability-checkpoint-october-25): conditional claims and durable preparation pass actual PostgreSQL overlapping-worker and expiry tests. No blind resend of ambiguous attempts. Uncommitted/undeployed; real process-crash/provider acceptance remains OPEN.

### V1-022

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code, deployed occurrence unknown):

`server/report-scheduler.ts:4540-4586`: snapshot insertion after confirmed send catches DB errors as an empty result; send event may still become sent with snapshotId=null and lastSentAt advances. Required immutable sent/downloadable artifact can be absent. Test artifact/audit persistence failures and recovery without resending an already confirmed email.

**Implementation / validation:** [Reliability checkpoint](#reliability-checkpoint-october-25): atomic artifact/event/report finalization and recovery pass injected failures at all three writes. Original bytes are retained without rebuild/resend. Uncommitted/undeployed; production historical inventory and live delivery remain OPEN.

### V1-056

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Trend contract divergence):

`routes-oauth.ts:2966` sums active financial records without canonical currency/context/grain handling. `utils/trend-analysis-aggregate.ts:117-146` uses truthy revenue override, sums web+paid conversions and chooses clicks before sessions. Exact helper fixtures show15/75% versus Performance10/10%, and zero/positive override inconsistency. Current cumulative GA4 UI uses separate verified rows; affected retained API/non-cumulative branch is explicitly distinguished.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-058

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed report confirmation fixtures):

`report-scheduler.ts:80–125` uses latest successful report audit without send-slot/attempt correlation; missing audit/read error/non-Mailgun accepted status all return sent. Four isolated cases prove these helper boundaries. Scheduled delivery/artifact bookkeeping cannot be certified from provider acceptance or another attempt's audit. Test-send non-Mailgun message already distinguishes acceptance and must retain that behavior.

**Implementation / validation:** [Reliability checkpoint](#reliability-checkpoint-october-25): scheduled/test attempts use exact audit IDs; missing, unrelated, unreadable and accepted-only evidence never proves delivery. Concurrent poll outcomes are checked against persisted state. Uncommitted/undeployed; actual provider/inbox confirmation remains OPEN.

### V1-059

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code recovery gap):

`report-scheduler.ts:4334–4340,4528–4536,4570` writes pending_delivery but only pending/failed events become retry candidates. No tracked runtime path reconciles later delivery to this exact event/artifact. Requires late-result recovery without resend and original PDF retention; no live email attempted.

**Implementation / validation:** [Reliability checkpoint](#reliability-checkpoint-october-25): each scheduler check reconciles exact pending artifacts before selecting due reports. Pause/edit/restart-style recovery and missing/changed scope cases pass without resend. Legacy missing evidence stays unconfirmed. Uncommitted/undeployed; natural scheduled recovery remains OPEN.

### V1-060

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained snapshot instability):

`routes-oauth.ts:30488–30500` regenerates non-GA4/non-Diagnostics snapshot PDFs from current report/source data using the historical window. Later import/edit/delete can change a historical download. GA4/Diagnostics return immutable PDF artifacts and are not included in this defect.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-061

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained fabricated UI):

Registered Audiences page `audiences.tsx:17–83,134–135` renders hard-coded audience/conversion/demographic data; Create210 has no persistence handler. Treat as nonfunctional/demo and explicitly gate/label it before inclusion; hidden navigation is insufficient.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
### V1-062

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed comparison value/fallback defects):

`platform-comparison.tsx:221–222,402–411` returns0% ROI for zero revenue/positive spend while footer gives−100%. Failed aggregate fallback306–355 invents Custom Revenue from conversions×AOV(default50), ignoring measured0; native GA4 may disappear. [Full field/fallback inventory and exact cases](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md). Preserve verified source values, availability, windows and zero semantics; modern GA4 Financial Analysis is a separate path.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
### V1-064

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained export defects):

`kpis.tsx:329–400`: PDF choice emits TXT, Excel emits JSON, date filter is cosmetic, CSV fails to escape quotes, and progress ignores metric direction/current availability. Exact export fixtures prove format/quote defects; modern GA4 Reports is separate.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
### V1-074

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained API result mismatch):

Legacy Meta report PATCH27739 returns200 with missing row; DELETE27770 returns success when storage returns false after an authorization/read race. Two exact fixtures reproduced. Current UI uses generic platform report routes, but legacy pair remains registered. Return actual mutation outcome and cover disappearance/retry without removing untraced historical dependencies.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-077

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed unknown history becomes complete zero):

`routes-oauth.ts:9540` catches a failed daily read as empty; `ga4-metrics.tsx:2115–2125` pads from campaign creation beyond the60-day request, ignoring coverage. Three exact-code cases show failure→complete zero, two absent days→−28.57% complete-window decline, and unrequested July→complete zero month. Findings, coverage text, Trends and browser PDF inherit this boundary. Distinguish verified no-activity from failed/unfetched days before downstream comparisons.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-084

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed currency label mismatch in code):

`ga4-metrics.tsx:5516,5527` hard-code `$0` in two financial finding titles while descriptions use campaign-currency formatMoney. Non-dollar campaigns get conflicting currency labels; browser PDF reuses findings. Use the same current currency contract and validate zero-value wording/UI/PDF. No monetary arithmetic error is inferred.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-085

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed real PDF finding mismatch):

`ga4-scheduled-report-pdf.ts:289–451,965–1014` omits current client three-day/rate and other finding rules, then calls no finding stable. Complete six-day100% decline and fourteen-day10%→5% conversion-rate fixtures pass saved-publication guards but render “No major anomalies detected”; exact client trend branch finds both. Required Benchmark read-failure control correctly rejects. Align current live/browser/server findings and negative states before report certification.

**Implementation / validation:** Partial correction only: three-day/seven-day trend parity, missing/zero/negative finance states and removal of the false stable conclusion are covered locally. Full saved-target, financial, channel and negative-state parity remains OPEN. See the [current checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) for precise evidence and exclusions. No release certification is claimed.
### V1-086

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed rendered text overlap):

`ga4-scheduled-report-pdf.ts:1219–1229` unwrapped campaign name overlaps timestamp; table1104–1147 character-count truncation lets long Landing Page text overlap Source/Medium. Three real PDFs/eight pages inspected. Zero off-page characters did not detect overlap. Preserve current layout pattern while testing measured label bounds and page transitions.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
### V1-094

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed equality wording defects):

`client/src/pages/financial-analysis.tsx:757–768,1094`; `server/report-scheduler.ts:2005–2009,2661–2665`. Revenue100/Spend100 gives correct ROI0/ROAS1 but is described as Positive financial return in all three expressions; exhaustion exactly on period end is described as before it. [Exact expressions and controls](../../audits/v1-2026-10-19/FINANCIAL_ANALYSIS_VALUE_INVENTORY.md). Distinguish equality without changing formulas.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-095

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: conditional freshness propagation defect):

`client/src/pages/campaign-performance.tsx:537–578,633–649,1408–1416`: explicit GA4 stale metadata with aligned retained finance withholds the Revenue headline but leaves financial recommendation inputs ready. Exact current expressions/helper call Revenue300 versus target200 verified/on target. [Controls and upstream boundary](../../audits/v1-2026-10-19/PERFORMANCE_SUMMARY_VALUE_INVENTORY.md). Real occurrence and full rendered health remain unverified; preserve source-aware last-good semantics.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-096

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed daily-user grain label gap):

`client/src/pages/campaign-performance.tsx:1471–1479` shows Total Users from daily sums without the explanation present at `ga4-metrics.tsx:6865`. `shared/ga4-traffic-window.ts:14–30` correctly implements the intended daily-sum contract; this is not a calculation-change request. [Helper/card evidence and provider definition](../../audits/v1-2026-10-19/PERFORMANCE_SUMMARY_VALUE_INVENTORY.md). Make grain/window explicit across included consumers.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-097

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed rate display corruption):

`client/src/pages/trend-analysis.tsx:1590` normalizes an already-percent cumulative Engagement Rate using `shared/metric-math.ts:75–79`. Exact current helper/card cases show0.5%→50%,1%→100%; website summary correctly prints0.5%. [Boundary cases and unit trace](../../audits/v1-2026-10-19/TREND_ANALYSIS_VALUE_INVENTORY.md). Preserve fraction-based daily chart consumers; no stored-data corruption inferred.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-098

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed zero-denominator state defect):

`client/src/lib/trend-analysis-cumulative.ts:215–229`, `trend-analysis.tsx:516–520,1589–1590,1957–1960` compute/display0 rates when there are0 sessions; daily chart correctly treats no activity as unavailable. Server Trend website-summary expressions2097/2900 also return0. Current GA4 Overview2387/6898/6423 independently shows0% for valid zero-session totals in its [boundary packet](../../audits/v1-2026-10-19/ga4-overview-boundary-reproductions.json). [Trend cases and propagation limits](../../audits/v1-2026-10-19/TREND_ANALYSIS_VALUE_INVENTORY.md). Preserve measured zero counts while withholding undefined ratios.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-099

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conversion-rate label mismatch):

`client/src/pages/executive-summary.tsx:269,653–656` selects Click-Through CVR whenever paid clicks exist, while aggregate CVR retains GA4 conversions/sessions precedence. Exact mixed-source case:100 sessions,10 conversions,20 paid clicks shows10% labelled click-through. [Separate controls and consumer trace](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Bind label to the actual denominator.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-100

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Executive API scope/value defects):

`server/routes-oauth.ts:32909–32952` picks first rather than primary GA4 connection, defaults all-period provider request to30days, drops native Revenue on success and adds daily pageviews to provider total. Exact branch fixture and failure control reproduce each boundary. [Evidence/consumer limits](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Current page funnel uses separate outcome totals; API/retained report consumption still needs parity checks.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-101

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed downstream conversion truncation):

`client/src/pages/executive-summary.tsx:185–186,496–505` truncates valid0.75 conversions to0 in headline and target formatting. [Exact formatter/control cases](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Independent of upstream V1-079; fixing ingestion alone does not preserve fractional values through executive presentation.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. The current baseline already preserves fractional credits; this packet adds verification, not another precision change.

### V1-110

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained notification race):

`routes-oauth.ts:7646–7720` builds whole dismissal metadata from an earlier read. Two deterministic interleavings with actual `resolveKPIAlerts:344` erase concurrent resolved state; `alert-monitoring.ts:116–142` then selects `active:own` instead of the cleared episode. [Fifteen boundary cases and current UI reachability](../../audits/v1-2026-10-19/NOTIFICATION_VISIBILITY_LIFECYCLE.md). Preserve concurrent resolution/dismissal history and verify email episode claims through rebreach. No current rendered dismiss/read/clear control; retained API remains registered.

**Implementation / validation:** [Reliability checkpoint](#reliability-checkpoint-october-25): persisted metadata merges preserve resolution/dismissal through dismiss, clear, active updates, supersession and item deletion. PostgreSQL tests verify both write orders, stable first resolution time and real email claim deduplication through rebreach. Uncommitted/undeployed; production history/provider acceptance remains OPEN.

### V1-119

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained historical-download invalidation):

`routes-oauth.ts:30460–30465` requires snapshot.reportType equal current report.reportType. Current GA4 edit UI10749–10768 and PATCH30090–30126 permit template changes; fixture changes Overview→Insights while preserving owner/campaign/platform and stored PDF. Old snapshot JSON still returns200, PDF becomes404. [Twenty access/artifact controls and reachability limit](../../audits/v1-2026-10-19/REPORT_SNAPSHOT_ACCESS_LIFECYCLE.md). Define stable historical report identity/version semantics without weakening owner/campaign/platform validation; current immediate-download callers create new snapshots.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-122

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed source-backed alert value inconsistency):

`utils/campaign-current-values.ts:471–477` and `utils/ga4-alert-current-value.ts:121–123` return stored Custom/Sheets goal values without resolving current source scope/data. Current page resolvers use the latest saved-source value instead. [Eighteen KPI/Benchmark decision cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md) show false positive/negative decisions and unavailable-source eligibility; email/notification callers are traced, no message sent. Resolve the exact source-backed current value and state consistently before decisions, preserving intentional manual values.

**Implementation / validation:** [Group 2 checkpoint](#metrics-and-source-backed-goals-checkpoint-october-26) records the exact root cause, traced path, correction and limits. 675 local checks in 40 files and production builds pass. Uncommitted/undeployed; all release acceptance remains OPEN. No production data cleanup or whole-section certification is claimed.

### V1-125

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Dashboard scope/value/action defects; user-approved exclusion on October 26):

`dashboard.tsx:18–87`, `components/dashboard/metrics-cards.tsx:7–48`, `campaign-chart.tsx:7–31`, `campaign-table.tsx:15–43,109–190`: date control unused, chart mixes clients/currencies, table relabels money USD, failed cards show zero; Export/create/quick actions unbound. [Nine baseline fixtures and full field inventory](../../audits/v1-2026-10-19/ENTRY_PAGES_AND_DASHBOARD_VALUES.md). This is historical evidence of the removed page.

**Implementation / validation:** The root cause was a reachable obsolete page registered in `App.tsx`, with an incoming client-selection link despite absent sidebar navigation. The user explicitly requested its removal, superseding the earlier redirect proposal. The final path is Clients -> exact selected client -> `/campaigns`; `/dashboard` reaches the existing not-found fallback after the unchanged auth/client gates. `pages/dashboard.tsx` is deleted and its unused welcome preview removed. Its charts/table/modals cannot mount through a registered page; helper files and guarded APIs are retained to avoid unrelated storage or compatibility changes. No campaign records are removed, including test campaigns. The actual route tree is rendered with real Wouter matching and stub page bodies; both client-selection handlers execute in tests. Baseline: 9 pass / 4 expected failures. Fixed plus neighboring campaign navigation and cascade guards: 23 pass / 0 failed / 0 skipped. Commands and build evidence are in [the validation record](validation-2026-10-26/retired-dashboard-evidence.json). Local page exclusion is verified; deployed/authenticated UI acceptance remains open. This is not certification of the former Dashboard calculations or of unrelated retained pages.

### V1-129

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained KPI workflow contract failures):

`kpis.tsx:42–44,277–295,1025–1081` requires kpiId before submit but never populates it; `platform-kpis.tsx:94–108` omits campaignId required by GET/POST at routes28743/28780. [Exact schema/route cases](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md) reproduce hidden validation failure, empty list and400 creation. Restore current scoped form/API contracts or effectively exclude these accessible pages.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
### V1-130

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained KPI scoring/negative-value defects):

`kpis.tsx:42–44,126–147,921–989` universally scores current/target, despite CPA/CAC presets. Target25/current50 is “Target Achieved”; current10 is40%; negative ROI entry is forbidden and malformed progress yieldsNaN. [Exact controls and lifecycle](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md). Preserve metric direction, units, signed values and unavailable states through card, saved status, report and alert consumers.

**Implementation / validation:** [Retained pages/report checkpoint](RETAINED_PAGES_AND_REPORT_CHECKPOINT.md) records the confirmed root cause, exact path, seven runtime files, baseline/fixed/neighbor evidence and remaining limits. The final combined packet passes 306/306 checks in 19 files. Uncommitted/undeployed; release acceptance remains OPEN. This is local forward-path evidence, not whole-section certification.
