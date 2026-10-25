# Batch 7: Diagnostics, goals, retained pages, alerts and reports

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 7 status

**Publication packet, October 25:** The three tested report-history/Meta corrections and their evidence accompany the user-authorized commit and push. Deployment and live acceptance remain unverified. Statements below saying uncommitted describe the validation-time state; the remaining 26 findings and all 29 release acceptances remain OPEN.

**IN PROGRESS, October 25.** Three original forward defects (V1-060, V1-074, V1-119) are corrected and verified locally. **412 checks pass in 10 files**, with TypeScript and the server build passing. Changes are uncommitted and undeployed. The other 26 findings and all 29 release acceptances remain OPEN. No production records, user browser, provider account or email service were accessed.

The user postponed Batch 6 live sign-off after Google account verification blocked login and requested Batch 7 work. Batch 6 is not certified or excluded; live Google Ads validation remains pending. The prior public health observation of `4cd498cf` proves deployment only.

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

### Complete remaining Batch 7 inventory

| Work area | Original IDs still OPEN | Current boundary |
|---|---|---|
| Delivery/recovery | V1-021, V1-022, V1-058, V1-059 | Current scheduler/audit code traced; correction and worker/crash/recovery tests remain. |
| Report content/layout | V1-015, V1-085, V1-086 | Browser/scheduled/download value parity, rendered layout and confirmed delivery unverified. |
| Diagnostics/GA4 values | V1-056, V1-077, V1-084, V1-094, V1-095, V1-096, V1-097, V1-098, V1-099, V1-100, V1-101 | Original evidence inventoried; current complete value/fallback/downstream review and fixes remain. |
| Notifications/source-backed goals | V1-110, V1-122 | Original lifecycle evidence read; correction and decision/history/email-episode validation remain. |
| Retained pages | V1-061, V1-062, V1-064, V1-125, V1-129, V1-130 | Functional correction or agreed effective exclusion remains; no new exclusion is assumed. |

This is three locally verified forward corrections, not Batch 7 completion or production sign-off.

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
| [V1-021](#v1-021) | P1 | OPEN | OPEN |
| [V1-022](#v1-022) | P1 | OPEN | OPEN |
| [V1-056](#v1-056) | P1 | OPEN | OPEN |
| [V1-058](#v1-058) | P1 | OPEN | OPEN |
| [V1-059](#v1-059) | P1 | OPEN | OPEN |
| [V1-060](#v1-060) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-061](#v1-061) | P1 | OPEN | OPEN |
| [V1-062](#v1-062) | P1 | OPEN | OPEN |
| [V1-064](#v1-064) | P1 | OPEN | OPEN |
| [V1-074](#v1-074) | P2 | VERIFIED LOCALLY | OPEN |
| [V1-077](#v1-077) | P1 | OPEN | OPEN |
| [V1-084](#v1-084) | P2 | OPEN | OPEN |
| [V1-085](#v1-085) | P1 | OPEN | OPEN |
| [V1-086](#v1-086) | P2 | OPEN | OPEN |
| [V1-094](#v1-094) | P2 | OPEN | OPEN |
| [V1-095](#v1-095) | P1 | OPEN | OPEN |
| [V1-096](#v1-096) | P2 | OPEN | OPEN |
| [V1-097](#v1-097) | P1 | OPEN | OPEN |
| [V1-098](#v1-098) | P1 | OPEN | OPEN |
| [V1-099](#v1-099) | P1 | OPEN | OPEN |
| [V1-100](#v1-100) | P1 | OPEN | OPEN |
| [V1-101](#v1-101) | P1 | OPEN | OPEN |
| [V1-110](#v1-110) | P1 | OPEN | OPEN |
| [V1-119](#v1-119) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-122](#v1-122) | P1 | OPEN | OPEN |
| [V1-125](#v1-125) | P1 | OPEN | OPEN |
| [V1-129](#v1-129) | P1 | OPEN | OPEN |
| [V1-130](#v1-130) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-015

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: required artifact/delivery gate):

Browser PDFs, immutable snapshots, scheduled server artifacts and confirmed delivery need current-revision/source-mix parity. Browser `ga4-metrics.tsx:4130` labels source-to-date amounts; scheduled PDF fixtures enforce completed-day amounts. October19 deployed counter had0sent; October20 at09:00 had1 and final16:48 observation has2. Aggregate counters do not identify the artifact/campaign, verify its values or prove delivery. No email was triggered by the audit.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-021

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated reproduction):

`server/report-scheduler.ts:4335-4356,4820`: two workers can both retry a stale pending/failed report slot. Retry update has no compare-and-set owner/lease and does not inspect claimed row count. Exact extracted function with fixture DB lets both invocations pass the claim; stops before any email. This proves nonexclusive claiming, not actual duplicate delivery. Requires an atomic retry claim and multi-worker/expiry/crash regression.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-022

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code, deployed occurrence unknown):

`server/report-scheduler.ts:4540-4586`: snapshot insertion after confirmed send catches DB errors as an empty result; send event may still become sent with snapshotId=null and lastSentAt advances. Required immutable sent/downloadable artifact can be absent. Test artifact/audit persistence failures and recovery without resending an already confirmed email.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-056

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Trend contract divergence):

`routes-oauth.ts:2966` sums active financial records without canonical currency/context/grain handling. `utils/trend-analysis-aggregate.ts:117-146` uses truthy revenue override, sums web+paid conversions and chooses clicks before sessions. Exact helper fixtures show15/75% versus Performance10/10%, and zero/positive override inconsistency. Current cumulative GA4 UI uses separate verified rows; affected retained API/non-cumulative branch is explicitly distinguished.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-058

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed report confirmation fixtures):

`report-scheduler.ts:80–125` uses latest successful report audit without send-slot/attempt correlation; missing audit/read error/non-Mailgun accepted status all return sent. Four isolated cases prove these helper boundaries. Scheduled delivery/artifact bookkeeping cannot be certified from provider acceptance or another attempt's audit. Test-send non-Mailgun message already distinguishes acceptance and must retain that behavior.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-059

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code recovery gap):

`report-scheduler.ts:4334–4340,4528–4536,4570` writes pending_delivery but only pending/failed events become retry candidates. No tracked runtime path reconciles later delivery to this exact event/artifact. Requires late-result recovery without resend and original PDF retention; no live email attempted.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-060

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained snapshot instability):

`routes-oauth.ts:30488–30500` regenerates non-GA4/non-Diagnostics snapshot PDFs from current report/source data using the historical window. Later import/edit/delete can change a historical download. GA4/Diagnostics return immutable PDF artifacts and are not included in this defect.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-061

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained fabricated UI):

Registered Audiences page `audiences.tsx:17–83,134–135` renders hard-coded audience/conversion/demographic data; Create210 has no persistence handler. Treat as nonfunctional/demo and explicitly gate/label it before inclusion; hidden navigation is insufficient.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-062

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed comparison value/fallback defects):

`platform-comparison.tsx:221–222,402–411` returns0% ROI for zero revenue/positive spend while footer gives−100%. Failed aggregate fallback306–355 invents Custom Revenue from conversions×AOV(default50), ignoring measured0; native GA4 may disappear. [Full field/fallback inventory and exact cases](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md). Preserve verified source values, availability, windows and zero semantics; modern GA4 Financial Analysis is a separate path.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-064

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained export defects):

`kpis.tsx:329–400`: PDF choice emits TXT, Excel emits JSON, date filter is cosmetic, CSV fails to escape quotes, and progress ignores metric direction/current availability. Exact export fixtures prove format/quote defects; modern GA4 Reports is separate.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-074

**Severity:** P2. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained API result mismatch):

Legacy Meta report PATCH27739 returns200 with missing row; DELETE27770 returns success when storage returns false after an authorization/read race. Two exact fixtures reproduced. Current UI uses generic platform report routes, but legacy pair remains registered. Return actual mutation outcome and cover disappearance/retry without removing untraced historical dependencies.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-077

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed unknown history becomes complete zero):

`routes-oauth.ts:9540` catches a failed daily read as empty; `ga4-metrics.tsx:2115–2125` pads from campaign creation beyond the60-day request, ignoring coverage. Three exact-code cases show failure→complete zero, two absent days→−28.57% complete-window decline, and unrequested July→complete zero month. Findings, coverage text, Trends and browser PDF inherit this boundary. Distinguish verified no-activity from failed/unfetched days before downstream comparisons.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-084

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed currency label mismatch in code):

`ga4-metrics.tsx:5516,5527` hard-code `$0` in two financial finding titles while descriptions use campaign-currency formatMoney. Non-dollar campaigns get conflicting currency labels; browser PDF reuses findings. Use the same current currency contract and validate zero-value wording/UI/PDF. No monetary arithmetic error is inferred.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-085

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed real PDF finding mismatch):

`ga4-scheduled-report-pdf.ts:289–451,965–1014` omits current client three-day/rate and other finding rules, then calls no finding stable. Complete six-day100% decline and fourteen-day10%→5% conversion-rate fixtures pass saved-publication guards but render “No major anomalies detected”; exact client trend branch finds both. Required Benchmark read-failure control correctly rejects. Align current live/browser/server findings and negative states before report certification.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-086

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed rendered text overlap):

`ga4-scheduled-report-pdf.ts:1219–1229` unwrapped campaign name overlaps timestamp; table1104–1147 character-count truncation lets long Landing Page text overlap Source/Medium. Three real PDFs/eight pages inspected. Zero off-page characters did not detect overlap. Preserve current layout pattern while testing measured label bounds and page transitions.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-094

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed equality wording defects):

`client/src/pages/financial-analysis.tsx:757–768,1094`; `server/report-scheduler.ts:2005–2009,2661–2665`. Revenue100/Spend100 gives correct ROI0/ROAS1 but is described as Positive financial return in all three expressions; exhaustion exactly on period end is described as before it. [Exact expressions and controls](../../audits/v1-2026-10-19/FINANCIAL_ANALYSIS_VALUE_INVENTORY.md). Distinguish equality without changing formulas.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-095

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: conditional freshness propagation defect):

`client/src/pages/campaign-performance.tsx:537–578,633–649,1408–1416`: explicit GA4 stale metadata with aligned retained finance withholds the Revenue headline but leaves financial recommendation inputs ready. Exact current expressions/helper call Revenue300 versus target200 verified/on target. [Controls and upstream boundary](../../audits/v1-2026-10-19/PERFORMANCE_SUMMARY_VALUE_INVENTORY.md). Real occurrence and full rendered health remain unverified; preserve source-aware last-good semantics.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-096

**Severity:** P2. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed daily-user grain label gap):

`client/src/pages/campaign-performance.tsx:1471–1479` shows Total Users from daily sums without the explanation present at `ga4-metrics.tsx:6865`. `shared/ga4-traffic-window.ts:14–30` correctly implements the intended daily-sum contract; this is not a calculation-change request. [Helper/card evidence and provider definition](../../audits/v1-2026-10-19/PERFORMANCE_SUMMARY_VALUE_INVENTORY.md). Make grain/window explicit across included consumers.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-097

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed rate display corruption):

`client/src/pages/trend-analysis.tsx:1590` normalizes an already-percent cumulative Engagement Rate using `shared/metric-math.ts:75–79`. Exact current helper/card cases show0.5%→50%,1%→100%; website summary correctly prints0.5%. [Boundary cases and unit trace](../../audits/v1-2026-10-19/TREND_ANALYSIS_VALUE_INVENTORY.md). Preserve fraction-based daily chart consumers; no stored-data corruption inferred.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-098

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed zero-denominator state defect):

`client/src/lib/trend-analysis-cumulative.ts:215–229`, `trend-analysis.tsx:516–520,1589–1590,1957–1960` compute/display0 rates when there are0 sessions; daily chart correctly treats no activity as unavailable. Server Trend website-summary expressions2097/2900 also return0. Current GA4 Overview2387/6898/6423 independently shows0% for valid zero-session totals in its [boundary packet](../../audits/v1-2026-10-19/ga4-overview-boundary-reproductions.json). [Trend cases and propagation limits](../../audits/v1-2026-10-19/TREND_ANALYSIS_VALUE_INVENTORY.md). Preserve measured zero counts while withholding undefined ratios.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-099

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conversion-rate label mismatch):

`client/src/pages/executive-summary.tsx:269,653–656` selects Click-Through CVR whenever paid clicks exist, while aggregate CVR retains GA4 conversions/sessions precedence. Exact mixed-source case:100 sessions,10 conversions,20 paid clicks shows10% labelled click-through. [Separate controls and consumer trace](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Bind label to the actual denominator.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-100

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Executive API scope/value defects):

`server/routes-oauth.ts:32909–32952` picks first rather than primary GA4 connection, defaults all-period provider request to30days, drops native Revenue on success and adds daily pageviews to provider total. Exact branch fixture and failure control reproduce each boundary. [Evidence/consumer limits](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Current page funnel uses separate outcome totals; API/retained report consumption still needs parity checks.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-101

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed downstream conversion truncation):

`client/src/pages/executive-summary.tsx:185–186,496–505` truncates valid0.75 conversions to0 in headline and target formatting. [Exact formatter/control cases](../../audits/v1-2026-10-19/EXECUTIVE_SUMMARY_VALUE_INVENTORY.md). Independent of upstream V1-079; fixing ingestion alone does not preserve fractional values through executive presentation.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-110

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained notification race):

`routes-oauth.ts:7646–7720` builds whole dismissal metadata from an earlier read. Two deterministic interleavings with actual `resolveKPIAlerts:344` erase concurrent resolved state; `alert-monitoring.ts:116–142` then selects `active:own` instead of the cleared episode. [Fifteen boundary cases and current UI reachability](../../audits/v1-2026-10-19/NOTIFICATION_VISIBILITY_LIFECYCLE.md). Preserve concurrent resolution/dismissal history and verify email episode claims through rebreach. No current rendered dismiss/read/clear control; retained API remains registered.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-119

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained historical-download invalidation):

`routes-oauth.ts:30460–30465` requires snapshot.reportType equal current report.reportType. Current GA4 edit UI10749–10768 and PATCH30090–30126 permit template changes; fixture changes Overview→Insights while preserving owner/campaign/platform and stored PDF. Old snapshot JSON still returns200, PDF becomes404. [Twenty access/artifact controls and reachability limit](../../audits/v1-2026-10-19/REPORT_SNAPSHOT_ACCESS_LIFECYCLE.md). Define stable historical report identity/version semantics without weakening owner/campaign/platform validation; current immediate-download callers create new snapshots.

**Implementation / validation:** [October 25 report-history checkpoint](#report-history-checkpoint-october-25) records the root cause, localized correction and 60 actual HTTP/storage/scheduled-checker cases, plus 352 neighboring checks. The forward correction is VERIFIED LOCALLY; deployment, provider/artifact parity, historical inventory and the explicitly listed lifecycle gaps remain unverified. No production data repair or full-section certification.

### V1-122

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed source-backed alert value inconsistency):

`utils/campaign-current-values.ts:471–477` and `utils/ga4-alert-current-value.ts:121–123` return stored Custom/Sheets goal values without resolving current source scope/data. Current page resolvers use the latest saved-source value instead. [Eighteen KPI/Benchmark decision cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md) show false positive/negative decisions and unavailable-source eligibility; email/notification callers are traced, no message sent. Resolve the exact source-backed current value and state consistently before decisions, preserving intentional manual values.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-125

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Dashboard scope/value/action defects):

`dashboard.tsx:18–87`, `components/dashboard/metrics-cards.tsx:7–48`, `campaign-chart.tsx:7–31`, `campaign-table.tsx:15–43,109–190`: date control unused, chart mixes clients/currencies, table relabels money USD, failed cards show zero; Export/create/quick actions unbound. [Nine current-path fixtures and full field inventory](../../audits/v1-2026-10-19/ENTRY_PAGES_AND_DASHBOARD_VALUES.md). Exclude effectively or independently correct after scope agreement; `/clients` still links here.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-129

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained KPI workflow contract failures):

`kpis.tsx:42–44,277–295,1025–1081` requires kpiId before submit but never populates it; `platform-kpis.tsx:94–108` omits campaignId required by GET/POST at routes28743/28780. [Exact schema/route cases](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md) reproduce hidden validation failure, empty list and400 creation. Restore current scoped form/API contracts or effectively exclude these accessible pages.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-130

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained KPI scoring/negative-value defects):

`kpis.tsx:42–44,126–147,921–989` universally scores current/target, despite CPA/CAC presets. Target25/current50 is “Target Achieved”; current10 is40%; negative ROI entry is forbidden and malformed progress yieldsNaN. [Exact controls and lifecycle](../../audits/v1-2026-10-19/RETAINED_COMPARISON_AUDIENCE_KPI_VALUES.md). Preserve metric direction, units, signed values and unavailable states through card, saved status, report and alert consumers.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
