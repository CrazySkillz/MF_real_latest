# Batch 6: Deferred-source isolation and included Ads

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 6 status

**QUEUED.** 9 V1 findings remain open; 10 provider-functional findings are deferred. No implementation or post-fix validation is recorded for this batch.

## Scope and acceptance

For LinkedIn/Instagram/Meta/TikTok, verify access/job/simulation/shared-data isolation; defer provider-functional repair and provider acceptance until future enablement. Retain evidence and severity without treating an unconfigured provider as a tested V1 feature. Google Ads and any actually offered child-source paths retain their own selection, currency/window/ratio, permission and failure requirements unless separately excluded. See the scope amendment for mixed and deferred findings.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) shared access/signing/mock protections and [Batch 2](../v1-batch-2/README.md) worker startup controls. Included Google Ads financial contracts intersect [Batch 3](../v1-batch-3/README.md) and downstream [Batch 7](../v1-batch-7/README.md); [Batch 8](../v1-batch-8/README.md) must verify effective exclusions. Functional deferral never removes shared safety obligations.

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [Deferred providers and Ptomo scope](../../audits/v1-2026-10-19/UNCONFIGURED_SOURCES_AND_PTOMO.md)
- [Paid-media trace](../../audits/v1-2026-10-19/PAID_MEDIA_TRACE.md)
- [Retained paid-source values](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md)
- [Included Google Ads values and Insights](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-024](#v1-024) | P1 | OPEN | OPEN |
| [V1-046](#v1-046) | P1 | OPEN | OPEN |
| [V1-047](#v1-047) | P1 | DEFERRED | DEFERRED |
| [V1-048](#v1-048) | P1 | DEFERRED | DEFERRED |
| [V1-049](#v1-049) | P1 | DEFERRED | DEFERRED |
| [V1-050](#v1-050) | P1 | DEFERRED | DEFERRED |
| [V1-055](#v1-055) | P1 | OPEN | OPEN |
| [V1-082](#v1-082) | P1 | DEFERRED | DEFERRED |
| [V1-104](#v1-104) | P1 | OPEN | OPEN |
| [V1-105](#v1-105) | P1 | DEFERRED | DEFERRED |
| [V1-106](#v1-106) | P1 | OPEN | OPEN |
| [V1-107](#v1-107) | P1 | OPEN | OPEN |
| [V1-115](#v1-115) | P1 | DEFERRED | DEFERRED |
| [V1-116](#v1-116) | P1 | DEFERRED | DEFERRED |
| [V1-117](#v1-117) | P1 | DEFERRED | DEFERRED |
| [V1-118](#v1-118) | P1 | DEFERRED | DEFERRED |
| [V1-121](#v1-121) | P1 | OPEN | OPEN |
| [V1-127](#v1-127) | P1 | OPEN | OPEN |
| [V1-128](#v1-128) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-024

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: code and isolated dispatch evidence, live configuration unknown):

Instagram18/TikTok70 and LinkedIn672/Ads347 refresh wrappers lack owner/active-status eligibility; Meta303 omits parent lookup. All connection IDs are scheduled by dedicated jobs. Four wrapper fixtures prove Meta dispatch without parent and LinkedIn/Ads dispatch for paused ownerless parents; LinkedIn missing-parent control rejects. These prove dispatch, not DB persistence. TikTok live refresh is deferred while test-mode scheduled writes simulated USD. Require fail-closed eligibility/simulation gating and actual recovery tests.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-046

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed attribution duplication):

`server/utils/ga4RevenueEnrichment.ts:119-147` applies a whole90-day GA4 revenue pool independently to every normalized name match and allocates it by platform spend dates. Exact fixture turns100 into200 for two matched campaigns. Current retained LinkedIn/Google Ads consumers show ga4Revenue/ROAS. Failed/empty enrichment also leaves old values. Exact source/date/unique allocation needed, or effective exclusion.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-047

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed paid-media pagination gap):

`server/services/meta-graph-api.ts:205,267,387,431,456` reads one page and ignores paging.next. Exact campaign/placement fixtures prove one request despite next link. LinkedIn client84-276 similarly lacks iteration in current code. Selected-source discovery and metrics can be partial; independent provider completeness tests required.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-048

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Meta failure/freshness corruption):

`server/meta-scheduler.ts:233-294` catches selected-campaign request failures then updates lastRefreshAt. Exact fixture proves all requests fail yet freshness advances. Wrapper303 then runs KPI/alerts. `meta-graph-api.ts:590` also substitutes zero insights for failed batch requests, separately reproduced. Preserve last-good state with failure/partial freshness; do not publish failed requests as measured zero.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-049

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed LinkedIn refresh duplication/fabrication):

`server/linkedin-scheduler.ts:419` uses Set of newly created objects, so each prior metric repeats a campaign; exact fixture one campaign/two metrics writes four metrics and two creative rows. Creative revenue632 defaults conversionValue150 when absent, also reproduced. Substring identity and missing queried metric fallbacks are additional traced risks. Requires exact campaign identity, no invented revenue, coherent session publication and damage inventory.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-050

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conflicting conversion contracts):

`server/services/meta-graph-api.ts:405-412` sums purchase/lead/conversion action labels, while aggregate513/550 selects first matching label. Exact Instagram-placement fixture produces9 from three labels of3. Whether labels overlap needs provider validation; current code lacks a verified non-overlapping conversion contract. This blocks treating Meta/Instagram values as certified or reusing the definition for future sources.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-055

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained Spend scope/currency defect):

Ad-platform import27325 reads all Google Ads/Meta/LinkedIn daily rows without selected-ID eligibility, labels sources/recordsUSD and updates campaign total from defaultGA4 scope. Exact EUR campaign fixture imports selected10+unselected90 as100USD. Delete/insert is non-atomic. Dedicated GA4 Ads Spend safeguards do not cover this route.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-082

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: code plus official provider support evidence):

`linkedinClient.ts:47` pins202405, officially sunset May15,2025. Real refresh and Spend discovery/process6243/6321 use it, so GA4 child-source configurations also need review. No live provider request performed. Migrate with source-specific permission/query/metric/attribution/pagination tests or effectively restrict affected supported scope.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-104

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained financial-window mismatch):

Instagram374–382, Google Ads499–508 and Meta658–668 page expressions prefer all-history source totals over bounded Revenue, then divide by period Spend. Three cases900 all-history/100 bounded/100 Spend yield ROAS9. TikTok API25234 separately reads1900-through-today Revenue beside30-day Spend. [Exact boundaries](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Match and label numerator/denominator dates through every consumer.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-105

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed DB failure-to-empty analytics):

`routes-oauth.ts:25370,25212` catches Instagram/TikTok daily DB errors as[]; two actual-handler cases return200/success/empty rows, hiding failures from page error controls. Instagram overview25294 has the same catch. [Evidence](../../audits/v1-2026-10-19/retained-value-boundary-reproductions.json). Preserve failure/stale/empty distinctions; no claim that empty Instagram overview renders measured-zero cards.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-106

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed conditional currency fallback and labels):

`routes-oauth.ts:3679–3735` hides breakdown currency errors behind mapping totals; fixture USD100/EUR200 then sums300 in Instagram. Monetary formatters Google Ads699/Meta622/TikTok104/Instagram70 hardcode dollars despite available source currency. [Exact cases and limits](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Preserve currency identity/validation through source lists, totals and presentation; live mixed-source occurrence unknown.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-107

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed retained ratio aggregation defects):

`google-ads-analytics.tsx:492,532,536` averages row rates; same-day fixture CTR50.5% conflicts with count-derived1.9802%. Search share also lacks its eligible denominator, and provider306 loses below10% bound semantics. [Fixture/provider contract](../../audits/v1-2026-10-19/RETAINED_PAID_VALUE_BOUNDARIES.md). Use verified aggregate grains and preserve censoring; do not reconstruct provider eligibility from rounded shares.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-115

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed read-failure-triggered source mutation):

`server/utils/linkedin-revenue.ts:74–89,125–135` converts failed Revenue/source reads to0/[] and treats them as proof of a stale connection conversionValue. Complete actual helper fixture then calls `updateLinkedInConnection(campaignId,{conversionValue:null})`. [Evidence/current callers](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Never derive destructive self-heal from failed reads; prove exact stale-data boundary independently and preserve valid configuration.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-116

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed LinkedIn zero/legacy precedence defect):

`linkedin-revenue.ts:117–118,191–210,234–266` ignores stored conversionValue only when imported Revenue is positive. Active actual-revenue source measured0 plus legacy CV50/10conversions returns500; source-free legacy session CV can still supply500 after connection self-heal. [Zero/negative/positive/explicit-mode cases](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Preserve current source/mode identity and valid zero; complete source-delete/reconnect/damaged-session propagation before release.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-117

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed undisclosed ad revenue allocation):

`routes-oauth.ts:32575–32622` maps webhook-origin Revenue to explicit conversion-value status, then allocates total by ad conversion shares. Exact expressions yield75/225 from campaign-level300 with no ad attribution and `revenueIsEstimated:false`. [Evidence and visible/PDF flag consumers](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Preserve attribution provenance and explicit estimates; campaign actual amounts do not prove actual ad attribution.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-118

**Severity:** P1. **Fix status:** DEFERRED. **Release acceptance:** DEFERRED.

**V1 applicability:** Deferred provider functionality; retained for future enablement, not a V1 provider implementation task.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed invented Shopify denominator in LinkedIn):

`linkedin-revenue.ts:180–185` assumes one order when Shopify Revenue exists but count/AOV metadata is absent. Complete helper returns conversionValue1000 from Revenue1000 without an order-count source. [Exact case](../../audits/v1-2026-10-19/LINKEDIN_REVENUE_VALUE_BOUNDARIES.md). Keep total Revenue authoritative while making unsupported per-order value unavailable; exact legacy repair requires real count/provenance.

**Implementation / validation:** Provider-functional implementation and acceptance are deferred. Preserve this finding for independent validation before future enablement.

### V1-121

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed incomplete production exclusion):

`routes-oauth.ts:24438,24581,24851` lets an authenticated campaign owner create Meta/Instagram/TikTok simulated connections without provider credentials or a production/mock gate. Actual Instagram handler writes simulated metrics; Meta dispatches its generator30 times; actual TikTok refresh materializes simulated rows. [Fourteen owner/negative/no-connection cases and shared-consumer trace](../../audits/v1-2026-10-19/UNCONFIGURED_SOURCES_AND_PTOMO.md). Effective API/job/simulation exclusion remains required for V1; this is not a requirement to implement deferred providers. No live contamination claimed.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-127

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Ads calendar/coverage mismatch):

`google-ads-analytics.tsx:593–690`: rolling7/30 and prior-period comparisons count observed rows, not calendar days;14 rows enable WoW even across27 dates. [Exact sparse/contiguous/partial controls and22-rule trace](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md). Preserve provider coverage and align windows through charts, reliability, Insights and reports; no live sparse-property claim.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-128

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Ads missing-input goal scoring):

`google-ads-analytics.tsx:487–491,776–843`: no clicks/conversions becomes zero cost; target/current produces Infinity/on_track, capped200% in trackers. Absent imported Revenue returns numeric0; unknown target statuses count behind. [Exact cases and downstream limits](../../audits/v1-2026-10-19/GOOGLE_ADS_CURRENT_VALUES.md). Source/denominator availability and finite scoring must survive goals, Insights, reports and alert resolver acceptance.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
