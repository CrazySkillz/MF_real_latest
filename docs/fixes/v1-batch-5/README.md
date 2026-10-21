# Batch 5: CRM and commerce Revenue

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 5 status

**QUEUED.** 6 V1 findings remain open. No implementation or post-fix validation is recorded for this batch.

## Scope and acceptance

HubSpot/Salesforce/Shopify amount/empty/duplicate/stage contracts; supported API versions, exact permissions, selections, attribution, date/currency and source replacement. Preserve zero/error/freshness through Pipeline Proxy fallback and reconcile it separately from confirmed revenue. Prove each provider independently.

For each included source, cover create/edit/delete/reconnect/refresh/list/totals, negative cases and downstream propagation. Preserve the existing architecture. Historical-data cleanup requires its own read-only inventory and separately reviewed scope. A locally passing fix does not close required deployed/provider acceptance.

## Dependencies

Preserve [Batch 1](../v1-batch-1/README.md) credential/ownership safeguards. Align native and imported financial contracts with [Batch 3](../v1-batch-3/README.md), common source replacement with [Batch 4](../v1-batch-4/README.md), and Pipeline Proxy/financial propagation with [Batch 7](../v1-batch-7/README.md). Provider and release acceptance remains coordinated with [Batch 8](../v1-batch-8/README.md).

## Reference and evidence entry points

These records retain their own dates and verification limits. Use the current fix evidence above and below when it supersedes an original finding.

- [CRM and Shopify trace](../../audits/v1-2026-10-19/CRM_AND_SHOPIFY_TRACE.md)
- [CRM revenue-source pattern](../../../GA4/CRM_REVENUE_SOURCE_PATTERN.md)
- [Provider version support](../../audits/v1-2026-10-19/PROVIDER_VERSION_SUPPORT.md)
- [GA4 Overview/source-dialog inventory](../../audits/v1-2026-10-19/GA4_OVERVIEW_VALUE_INVENTORY.md)

## Finding checklist

| Finding | Severity | Fix status | Release acceptance |
|---|---|---|---|
| [V1-042](#v1-042) | P1 | OPEN | OPEN |
| [V1-043](#v1-043) | P1 | OPEN | OPEN |
| [V1-044](#v1-044) | P1 | OPEN | OPEN |
| [V1-045](#v1-045) | P1 | OPEN | OPEN |
| [V1-083](#v1-083) | P1 | OPEN | OPEN |
| [V1-109](#v1-109) | P1 | OPEN | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-042

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed amount-validation defects):

HubSpot save20245, Salesforce save18830 and Shopify `utils/shopify-revenue.ts:145` remove arbitrary characters before numeric conversion. Exact HubSpot handler and Shopify helper fixtures accept12oops as12; nonnumeric HubSpot becomes measured0 and Shopify becomes excluded zero order. Salesforce code retains same digit-stripping behavior despite non-finite checks. Reject invalid provider values before publication; trace existing corruption separately.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-043

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed incomplete-provider-to-zero contract):

HubSpot search19976/save20235 substitutes missing results with[]; exact handler persists zero for HTTP-success{}. Salesforce `utils/salesforce-pagination.ts:43` accepts{} and ignores totalSize10 versus empty records, confirmed in exact helper fixtures. GA4 save19251 maps empty rows to zero. Incomplete/unavailable response must not overwrite last-good revenue as measured zero.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-044

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed HubSpot duplicate counting):

Save20245 adds each result without deal-ID deduplication. Exact two-page fixture repeats the same10USD deal and persists20USD; cursor changes so pagination guard passes. Query completeness and aggregate/daily self-reconciliation do not detect duplicated provider identity. Require identity/revision policy before financial publication; Salesforce equivalent absence has code evidence, not separate handler fixture.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-045

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed HubSpot revenue-classification gap):

Save20169 accepts explicit stageIds without checking closed-won metadata. Fixture supplies known open-stage metadata and shows that stage queried and10USD materialized as confirmed revenue. Default closed-won derivation does not protect caller override. Keep Pipeline Proxy separate and verify stage semantics for each account.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-083

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: conditional unsupported configuration):

`utils/shopify-provider.ts:5–20` accepts2025-10, officially retired Oct16,2026; default2026-07 remains supported. Response-version guard258–303 rejects provider fall-forward, preserving semantic safety but causing accepted old configuration to fail. Live override unknown. Restrict the final support manifest and validate any version-list change independently.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.

### V1-109

**Severity:** P1. **Fix status:** OPEN. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Pipeline Proxy fallback defects):

`ga4-metrics.tsx:2728–2847,3006,3041–3056` replaces successful current0/empty items with mapping100 and can display old warning-marked mapping100 after a first failed endpoint read without unavailable/last-good state. [GA4 exact cases](../../audits/v1-2026-10-19/GA4_OVERVIEW_VALUE_INVENTORY.md). Custom Integration785–805 and standalone Sheets1063–1092 also display old mapping100 after a failed endpoint read while dropping warning/freshness; their successful-zero controls correctly preserve0. [Independent cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve current zero, verified mode/source/currency/freshness and explicit error state through proxy consumers.

**Implementation / validation:** Queued; no fix or post-fix acceptance is claimed. Confirm the exact current path before editing; then record changed files, implementation revision, failing/fixed/neighbor checks and the remaining deployed/provider gates here.
