# Batch 4: Files, Sheets and Custom Integration

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 4 status

**QUEUED.** 24 V1 findings remain open. No implementation or post-fix validation is recorded for this batch.

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
| [V1-028](#v1-028) | P1 | OPEN | OPEN |
| [V1-029](#v1-029) | P1 | OPEN | OPEN |
| [V1-031](#v1-031) | P1 | OPEN | OPEN |
| [V1-040](#v1-040) | P1 | OPEN | OPEN |
| [V1-041](#v1-041) | P1 | OPEN | OPEN |
| [V1-051](#v1-051) | P1 | OPEN | OPEN |
| [V1-065](#v1-065) | P1 | OPEN | OPEN |
| [V1-066](#v1-066) | P1 | OPEN | OPEN |
| [V1-067](#v1-067) | P1 | OPEN | OPEN |
| [V1-068](#v1-068) | P1 | OPEN | OPEN |
| [V1-069](#v1-069) | P1 | OPEN | OPEN |
| [V1-070](#v1-070) | P1 | OPEN | OPEN |
| [V1-071](#v1-071) | P1 | OPEN | OPEN |
| [V1-072](#v1-072) | P1 | OPEN | OPEN |
| [V1-073](#v1-073) | P1 | OPEN | OPEN |
| [V1-102](#v1-102) | P1 | OPEN | OPEN |
| [V1-103](#v1-103) | P1 | OPEN | OPEN |
| [V1-108](#v1-108) | P1 | OPEN | OPEN |
| [V1-111](#v1-111) | P1 | OPEN | OPEN |
| [V1-112](#v1-112) | P1 | OPEN | OPEN |
| [V1-113](#v1-113) | P1 | OPEN | OPEN |
| [V1-114](#v1-114) | P1 | OPEN | OPEN |
| [V1-120](#v1-120) | P1 | OPEN | OPEN |
| [V1-126](#v1-126) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-028

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed parser reproductions):

`services/custom-integration-file-parser.ts:82-105` uses non-strict 5,000-row CSV limit: 5,001 data rows become 4,999, confidence100, reviewfalse. Permissive numeric parsing accepts malformed amounts, sums mixed currency and misreads decimal-comma values. Duplicate CSV/XLSX Spend headers100/7 become14 through overwrite plus repeated header iteration217–229, also confidence100. Schema765 has no currency/report-period contract; UI/report currency formatting uses USD. Exact fixtures recorded. Separate GA4 financial CSV parser is not implicated by these cases.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-029

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed publication and fallback paths):

Custom imports persist and publish review-required metrics; latest-reader storage5780 has no validation-state filter. UI2806 labels Needs review but creates `latest_validated_import` scope; metric resolver still supplies KPI/Benchmark values. Scheduled report575-729 reads same row without validation gate or imported-period filter. Report financial builder498-538 turns failed revenue total read into an available zero when source exists (fixture). Webhook review URL has no registered page. Prevent unvalidated/failed reads from masquerading as validated period values; validate downstream artifacts.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-031

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained API reproduction):

`POST /api/custom-integration/transfer`, routes34100-34206: same source/destination deletes connection and metrics yet returns success; ordinary transfer copies without parser metadata/import timestamp and performs copy/delete nonatomically. Exact fixture confirms destructive same-ID outcome and omitted fields. No current frontend caller found, but route remains registered. Validate distinct owner-bound source/destination, atomic failure/retry and metadata preservation before retaining or excluding it.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-040

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 CSV Spend corruption):

`routes-oauth.ts:6545-6553` accepts up to50,005 approximate lines but non-strict parser stops at50,000 including header. Exact route fixture uploads50,000 data rows and persists49,999 with success. Same route's `aggregateCsvSpendRows` accepts malformed `12oops` as12; Revenue CSV's strict validator is absent. Validate whole-file completeness, amount/header/date/currency contract and source/downstream parity; existing damaged imports need read-only inventory.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-041

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 Sheets Spend corruption):

Routes6765/6905 fetch fixed `A1:ZZ5000` without completeness check; exact processing fixture with5,001 data rows persists4,999 and returns success. Permissive parseNum accepts12oops; entirely nonnumeric selected amounts write measured zero. Fetches lack abort signal. Auto-refresh reuses this route. Independent Revenue chunking safeguards do not cover Spend. Reject partial/invalid data and validate refresh/recovery/source totals.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-051

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Sheets completeness/scope gap):

Main GET21785/21987 and `auto-refresh-scheduler.ts:813` read A1:Z1000. Exact refresh fixture caches999 rows as fresh without completeness check; page warns but aggregate consumers sum cached rows. Composite lookup can substitute another tab21834 and summary can broaden unmatched campaign to all rows22330. Scope/date/partial-data contracts must be enforced or effectively excluded.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-065

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets header data loss):

`routes-oauth.ts:5609–5620` duplicate headers overwrite earlier values before validation. Exact GA4 Revenue process fixture `[Revenue,Revenue]`/`[100,7]` persists7. Strict CSV Revenue's duplicate-header rejection does not cover Sheets.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-066

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets currency mislabel):

Sheets Revenue amount helper accepts `$`; process1456 strips it while5719–5731 checks only configured currency. Exact EUR fixture persists `$100` as100EUR without conversion. Malformed12oops control correctly rejects; preserve that existing syntax validation.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-067

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed refresh scope expansion):

`auto-refresh-scheduler.ts:587–626` ignores stored singular campaignValue, although Revenue save5442 accepts and preserves it. Exact refresh fixture changes selected10 into all-rows100; array-selection control stays10. Restore exact saved selection across save/preview/refresh and all downstream values; inventory potentially damaged sources separately.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

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

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed cleanup crosses source context):

`routes-oauth.ts:1571–1610,2520` groups Sheets Spend duplicates without platform/currency, reads all contexts and deletes all but earliest. Exact fixture deactivates legitimate LinkedIn EUR source beside GA4 USD using same mapping. Non-atomic delete steps and no expected-state check compound risk. Must prove exact damaged boundary before permitting cleanup; no live cleanup performed.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-071

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed silent signed-amount omission):

GA4 CSV Revenue amount validator `utils/csv.ts:43` accepts−10 but aggregate105 and route4998 drop it. Exact handler saves100 from selected100/−10 with success. Define imported adjustment policy explicitly; accept/reconcile or reject unsupported amounts before mutation. Raw mapping retains the negative while records do not; every downstream total can therefore diverge from the uploaded file.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-072

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained CSV loss/truncation):

`routes-oauth.ts:4813,5154–5178`: non-GA4 Revenue CSV accepts50,000 rows but saves49,999; LinkedIn conversion-value edit updates source and deletes old records before returning400 for invalid replacement. Both exact-handler fixtures reproduced. Validate before mutation and replace atomically within the existing storage architecture.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-073

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed isolated PostgreSQL parent-write gap):

`storage.ts:1256–1262,2832`: ordinary GA4 input wrapper ignores an empty campaign lock query and commits child writes after parent deletion. Exact methods against isolated schema reproduce zero parents/one source/one record; existing-parent control passes. Current source schema lacks campaign FKs. Durable-table/deployed-schema/other-source variants remain required. Reject vanished parents at final write and verify all caller lifecycles.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-102

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed bounded resource-budget gap):

`server/services/custom-integration-file-parser.ts:371–399` synchronously inflates all ZIP entries without expanded/aggregate limits. A14,046-byte fixture expands12,584,919 bytes including unused padding and succeeds; no exhaustion was induced. Mailgun33943 parses arbitrary attachment count before signature; manual upload28186 correctly authorizes first. [Boundary and acceptance](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Protect expanded/cell/attachment work independently of compressed per-file size.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-103

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed XLSX selection ambiguity):

`server/services/custom-integration-file-parser.ts:344–367` selects the first archive worksheet, ignoring workbook visible order/hidden state. Identical worksheets/workbook yield Spend10 versus200 solely from ZIP entry order; hidden200 is accepted with confidence100/reviewfalse. [Actual parser cases](../../audits/v1-2026-10-19/xlsx-boundary-reproductions.json). Define explicit supported worksheet selection and reject ambiguity before downstream publication.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-108

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed measured-zero state loss):

`routes-oauth.ts:25238–25258`, `tiktok-analytics.tsx:839` require positive Revenue for source availability. Exact case with an existing source and measured0 returns null/source-required. [Paid evidence](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Standalone Sheets `google-sheets-data.tsx:979–987,1130,1165` independently shows valid0 Revenue/Spend as Not connected and blocks derived values/options; [four zero/negative cases and positive control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Distinguish zero, absent source and failed read before computing loss/zero ROAS.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-111

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom financial failure-to-value):

`custom-integration-analytics.tsx:641–672,735–760,3094,3131,3185–3202` converts failed/malformed Revenue totals to0 and derives availability from a separate successful source list. Actual query/transform cases show confirmed Revenue0/Spend100/ROAS0/ROI−100 after a failed Revenue request; failed external Spend can present imported100 as the complete total. [Evidence and zero control](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve error/partial/stale state through financial cards and source-backed consumers.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-112

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets ratio-consumer divergence):

`google-sheets-data.tsx:1479–1517` builds KPI/Benchmark options from raw summed metrics, ignoring server summaryValue. Spend190/Clicks110/CPC rows1+9 gives Summary1.72727 but options10 and actual browser PDF$10. Scheduled cached summary `report-scheduler.ts:3474–3522` also sums arbitrary metric/identifier columns. [Exact helpers and rendered artifact](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve one verified aggregation contract through Summary, goals, Insights and every report; server refresh/alert propagation remains open.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-113

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets scheduled report scope mismatch):

`auto-refresh-scheduler.ts:865–881` caches unfiltered rows; `report-scheduler.ts:3474–3522,3572–3707` selects a connection but ignores its selected campaign values and report date window. Actual PDF labelled campaignA/October2026 printsSpend100 including campaignB/2020Spend90; mappedA amount is10. [PDF, fixture and scope controls](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Enforce saved selection and actual date coverage before generation, send or snapshot; do not silently apply an arbitrary date column.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-114

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Sheets summary formula ambiguity):

`routes-oauth.ts:21722–21781` uses first matching financial header and unweighted rate averages. Actual helper cases choose Budget1000 before actual Spend100 (ROAS0.2 instead of2 for Revenue200), and unequal-impression CTR rows1%/100% produce50.5% instead of count-derived1.9802%. [Exact cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Define explicit metric/denominator mappings, fail closed on ambiguity and preserve bounded/undefined rates; column order must not redefine actual spend.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-120

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Custom metric meaning change):

`server/services/custom-integration-file-parser.ts:28,35–41,217–264` aliases sent→delivered, opens count→open rate, exit rate→bounce rate and new subscribers→list growth. Exact CSV1000/50/20/30 becomes those four fields with confidence100/reviewfalse; client displays opens50 as50.00%. [All28-field evidence and boundaries](../../audits/v1-2026-10-19/CUSTOM_IMPORT_AND_PUBLIC_ENTRYPOINTS.md). Require supported metric definitions/denominators or reject ambiguous mappings before publication; historical correction needs exact original source evidence.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-126

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed modest-load onboarding blocker):

`middleware/rateLimiter.ts:44–59` shares five imports/IP/five minutes across preview and save. Revenue wizard1507/1604 needs both; handlers4698/4735 share the bucket. [Actual HTTP/DB five-user fixture](../../audits/v1-2026-10-19/HTTP_DATABASE_PILOT.md): five valid previews succeed, all five saves429/retryAfter300, no sources written. Preserve abuse limits while accommodating authenticated users/workflow; no production traffic used.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
