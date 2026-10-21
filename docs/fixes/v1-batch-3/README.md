# Batch 3: Native GA4 query and financial contracts

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 3 status

**QUEUED.** 10 V1 findings remain open. No implementation or post-fix validation is recorded for this batch. This is the next implementation batch; this documentation reorganization does not start its runtime fixes.

## Scope and acceptance

Exact query/row keys/completeness, provider-quality metadata, attribution/precision, bounded property concurrency and abort behavior; correct source-ID fallback contract; explicit zero/negative/refund and currency-edit history policy; source-aware recovery. Preserve current valid GA4 consumer guards. Reconcile native facts through all displays/artifacts, not just totals.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) security and [Batch 2](../v1-batch-2/README.md) discovery/reconnect/startup contracts. Trace financial inputs from [Batches 4](../v1-batch-4/README.md), [5](../v1-batch-5/README.md) and [6](../v1-batch-6/README.md) through [Batch 7](../v1-batch-7/README.md) goals, diagnostics, alerts and reports. [Batch 8](../v1-batch-8/README.md) retains full acceptance and operations.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [GA4 query and value trace](../../audits/v1-2026-10-19/GA4_QUERY_AND_VALUE_TRACE.md)
- [GA4 precision and provider scope](../../audits/v1-2026-10-19/GA4_PROVIDER_PRECISION_AND_SCOPE.md)
- [Financial contracts](../../audits/v1-2026-10-19/FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md)
- [Campaign currency edit](../../audits/v1-2026-10-19/CAMPAIGN_CURRENCY_EDIT.md)
- [Financial source design](../../../GA4/FINANCIAL_SOURCES.md)
- [Processing/alignment backlog](../../GA4_PROCESSING_AND_ALIGNMENT_BACKLOG.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-011](#v1-011) | P1 | OPEN | OPEN |
| [V1-025](#v1-025) | P1 | OPEN | OPEN |
| [V1-032](#v1-032) | P1 | OPEN | OPEN |
| [V1-033](#v1-033) | P1 | OPEN | OPEN |
| [V1-035](#v1-035) | P1 | OPEN | OPEN |
| [V1-036](#v1-036) | P1 | OPEN | OPEN |
| [V1-079](#v1-079) | P1 | OPEN | OPEN |
| [V1-087](#v1-087) | P1 | OPEN | OPEN |
| [V1-089](#v1-089) | P1 | OPEN | OPEN |
| [V1-090](#v1-090) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-011

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: bounded implementation, required gate open):

Durable ownership/restart recovery in `ga4-daily-scheduler.ts:639–712` rejects active external Revenue/Spend sources and external connections. CRM/Sheets/Ads/Shopify campaigns retain ordinary refresh paths. Native-only P5 acceptance does not prove their cross-worker edits, retry, cancellation and restart safety.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-025

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed timeout gap):

`googleAdsClient.ts:65-136` Axios client and token calls have no explicit request timeout; `utils/salesforce-pagination.ts:33` fetch has no signal/deadline. **Native GA4** `analytics.ts:1392-1604` total/supplemental queries also bypass requestReport and use direct fetch without signal (exact-service fixture). `auto-refresh-scheduler.ts:231` Promise.race stops waiting without cancelling its promise. A local HTTP timeout does not prove provider work stopped. Trace each caller, add bounded cancellation within existing paths and verify no late stale writes.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-032

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 attribution fixture):

`analytics.ts:2361-2449` Insights landing coverage uses CONTAINS for UTM source/medium. `google` matches `google_ads`; exact-service fixture selects60 sessions from40 actual landing sessions. Route13736 and UI2155 use this branch. UI5135-5143 currently withholds channel analysis when totals differ from daily data; this prevents that fixture's wrong summary but leaves incorrect API output and missing Insights. Native Overview scheduler passes this option false. Require exact parameter matching and no-overlap/total reconciliation tests.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-033

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed GA4 completeness gap):

Acquisition `analytics.ts:1839-1883` accepts missing/nonfinite rowCount or rowCount<=first-page size. Exact-service fixture accepts a full bounded page with absent rowCount without another request or incomplete status. Pagination sorts only sessions, with no stable dimension tie-breaker. This is not evidence of an observed truncated Google response; it is a failed completeness guarantee for new/large properties. Validate malformed/full/tied/changed pages through callers and publication.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-035

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed financial contract reproduction):

`storage.ts:3120-3130` retries revenue completeness against all-date `getRevenueBreakdownBySource`, which returns `sourceId`; `utils/revenue-record-total.ts:20-29` recognizes only `revenueSourceId`. A valid source materialized outside the requested completed-day window still throws incomplete. Exact storage/helper fixture confirms mismatch. Fix exact contract and validate dated zero/pending/current-day data through all consumers, without treating missing records as measured zero.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-036

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed code/document contradiction):

`utils/campaign-cumulative-financials.ts:41-126` and shared schema994-1044 reject negative revenue/components, while shared GA4 financial selector accepts them and `GA4/FINANCIAL_SOURCES.md:89` requires valid negative revenue remain authoritative. Outcome route15929 invokes rejecting helper before response/publication. Fixture accepts−10 upstream then throws downstream; zero control passes. Resolve exact negative/refund policy and propagate consistently; do not silently clamp.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-079

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed fractional conversion truncation):

`analytics.ts:106,108,1448,1502,3344,3392`: parseInt discards fractional conversion credit, including campaignName event-scope supplement. Four service/helper cases:0.75→0, integer control preserved. Daily schema is INTEGER; detail paths preserve decimals. Scheduler reconciliation may reject publication, so incorrect saved publication is not inferred. Define and independently validate provider attribution/precision through daily facts, denominators and artifacts.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-087

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed currency-edit propagation defect):

Current Campaigns Edit sends currency415–433; API9167–9172 invalidates daily history for filter/timezone changes but omits currency. Ordinary storage698–708 retains rows, daily response9543–9606 has no currency identity, and Insights Revenue trends use current-currency formatter1502/9636. Fixture USD100 survives EUR edit and formats€100; filter/timezone controls select invalidation. Separate Overview/report currency guards remain. Enforce safe currency-edit/history semantics and test all consumers before release.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-089

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed provider dispatch fan-out):

`analytics.ts:2358` unbounded per-channel Promise.all reaches12 concurrent provider calls for one Insights reader and24 for two in exact-service fixtures. Official Standard GA4 Core limit is10/property; no property queue/quota metadata request found, GA4 HTTP limiter is imported but unmounted. No real quota exhaustion or tester load claimed. Bound shared-property work and validate quota/retry/cancellation/recovery under the agreed load envelope.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-090

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed provider-quality metadata loss):

`analytics.ts:1392–1604,1732–2573,3044–3433` accepts flagged provider totals/acquisition/daily fixtures but drops sampling, other-row, truncation, metric-restriction, threshold and empty-reason metadata. Eight cases prove the service boundary; no flagged full publication or live occurrence claimed. Numeric reconciliation alone cannot recover dropped quality evidence. Define exact availability/provenance handling and validate every affected consumer.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
