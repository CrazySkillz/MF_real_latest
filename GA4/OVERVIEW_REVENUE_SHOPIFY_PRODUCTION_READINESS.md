# GA4 Overview Shopify Revenue Production Readiness

## Status

**Deployed code candidate with one confirmed GA4 test-data boundary. Cross-platform isolation and exact cleanup candidate implemented locally; not yet clean-certified.**

This is the canonical Shopify Revenue readiness document as of 2026-07-14 for deployed Current Commit 9.2 (`544b2855`), the completed exact-source repair, the Current Commit 8 reconciliation, the owner-scoped production inventory, two failed-safe cleanup attempts, and the Current Commit 9.3 isolation/cleanup candidate documented below.

The earlier Shopify clean-certification statements in `GA4/README.md`, `GA4/OVERVIEW.md`, `GA4/FINANCIAL_SOURCES.md`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, `GA4/OVERVIEW_VALIDATION_RUNNER.md`, and `GA4-MANUAL-TEST-PLAN.md` are not valid current readiness conclusions. Current Commit 8 replaces those conclusions with pointers to this document while retaining their historical packets as bounded evidence only. Current Commit 9's deployed owner-scoped inventory reported three campaigns, and the user confirmed all three are tests. Exact follow-up evidence proved only `5317190c-d536-45d4-85c0-9d941cfba9f4` has a GA4 Shopify source; the other two Shopify sources belong to LinkedIn and Meta. Current Commits 9.1 and 9.2 correctly made no changes when their preconditions failed. Current Commit 9.3 preserves the LinkedIn/Meta sources and limits GA4 cleanup to the one exact GA4 source/connection; certification remains pending its deployment, one confirmed cleanup call, and one all-pass owner-scoped GA4 inventory.

The current honest answer is:

- Shopify Revenue's complete documented local lifecycle and downstream matrix is implemented and locally regression-covered.
- The Admin API token path has bounded deployed evidence, including an exact-source provider-authoritative zero-match repair.
- The source family must not be called production-ready or clean-certified while the one confirmed GA4 test-data finding and its GA4 refresh-failure alert remain.
- The inspected production source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` was inconsistent before repair. Shopify then returned zero current matches for the unchanged `utm_campaign = brand_search_q1` mapping, the user confirmed the scoped transactional repair, and the automatic post-repair inventory returned `shopifyLocalPersistencePass: true`. The exact expanded post-repair entity/finding packet was not retained in this audit record, so no broader production-data-health claim is made.
- Deployed Current Commit 9 inventory returned `crossCampaignPass: true` but `localPass: false` with three reported campaigns and three open scheduler failures. Exact source reads then proved two reports/alerts belonged to non-GA4 Shopify sources (`linkedin` and `meta`). Those sources are excluded from GA4 certification rather than mutated. The cause and timing of the connection-state change after the scheduler run are not reconstructed or guessed.

## Audit Contract

This audit was performed fresh. Previous production-ready statements, test results, HubSpot evidence, Google Sheets evidence, CSV evidence, and other source-family evidence were not accepted as Shopify proof.

No runtime code was changed during the first audit. Current Commits 1-7 were implemented only after that root-cause baseline; unrelated dirty worktree changes remain preserved.

### Required references reviewed

The review followed the prescribed order and used the current versions of:

1. `AGENTS.md`
2. `ARCHITECTURE_USER_JOURNEY.md`
3. `PRODUCTION_READINESS.md`
4. `GA4/README.md`
5. `GA4_DEVELOPMENT_WORKFLOW.md`
6. `GA4/REFRESH_AND_PROCESSING.md`
7. `GA4/OVERVIEW.md`
8. `GA4/OVERVIEW_PRODUCTION_READINESS.md`
9. `GA4/FINANCIAL_SOURCES.md`
10. `GA4/OVERVIEW_VALIDATION_RUNNER.md`
11. `GA4/OVERVIEW_AUTOMATED_VALIDATION.md`
12. `GA4/OVERVIEW_REVENUE_PRODUCTION_READINESS.md`
13. `GA4/REPORTS.md` and `GA4/REPORTS_PRODUCTION_READINESS.md`
14. `GA4/KPIS.md` and `GA4/KPIS_PRODUCTION_READINESS.md`
15. `GA4/BENCHMARKS.md` and `GA4/BENCHMARKS_PRODUCTION_READINESS.md`
16. `GA4/KPI_BENCHMARK_ALERTS_NOTIFICATIONS_PRODUCTION_READINESS.md`
17. `CAMPAIGN_LEVEL_KPI_BENCHMARK_PRODUCTION_READY.md`
18. the Campaign DeepDive readiness documents for Performance Summary, Budget & Financial Analysis, Platform Comparison, Trend Analysis, Executive Summary, and Custom Report
19. `GA4-MANUAL-TEST-PLAN.md`

The functional and readiness docs for Reports, KPI, Benchmark, notifications, schedulers, runners, and Campaign DeepDive were used only to define consumer contracts. Their readiness claims were not reused as Shopify evidence.

### Current implementation traced

- `client/src/components/AddRevenueWizardModal.tsx`
- `client/src/components/ShopifyRevenueWizard.tsx`
- `client/src/pages/ga4-metrics.tsx`
- `server/routes-oauth.ts`
- `server/storage.ts`
- `server/auto-refresh-scheduler.ts`
- `server/ga4-kpi-benchmark-jobs.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/report-scheduler.ts`
- `server/utils/performance-summary-aggregate.ts`
- `server/utils/tokenVault.ts`
- `server/utils/shopify-provider.ts`
- `server/utils/shopify-refresh-state.ts`
- `shared/schema.ts`
- `server/shopify-revenue-regression.test.ts`
- `server/shopify-downstream-content-regression.test.ts`
- `server/shopify-provider-hardening.test.ts`
- `server/shopify-connection-transaction.test.ts`
- the focused GA4 financial, outcome-total, notification, and report regression files used in validation

## Scope

### Included

- Shopify Revenue as a GA4 Overview financial child source
- Admin API token and conditionally available OAuth boundaries
- source add/import, edit/update, delete/deactivate, disconnect, and scheduler refresh
- source identity, campaign ownership, platform context, and store connection selection
- provider order query, cursor pagination, ordering, rate-limit behavior, and completeness
- attribution fields and exact-match behavior
- financial status, refunds, cancellations, test orders, duplicate orders, order changes, currency, and order dates
- normalized source/record persistence, atomicity, last-good retention, and damaged-data risk
- Overview totals, financial formulas, provenance, Campaign Breakdown, Ad Comparison, KPI, Benchmark, Campaign DeepDive, Reports, snapshots, PDFs, emails, alerts, and notifications
- multi-campaign and multi-store isolation

### Excluded or deferred

- HubSpot, Salesforce, Google Sheets, Upload CSV, spend sources, and other source families as evidence
- LinkedIn/Meta/Google Ads/Instagram/TikTok Shopify revenue behavior except where shared code creates a GA4 risk
- destructive cleanup of production data
- real provider, dormant OAuth, inbox, and deployed-database assertions that cannot be proven from local code

The wizard now presents OAuth only when the server confirms a client ID, client secret, redirect URI, and required scopes. Otherwise it presents only the supported Admin API token path. Dormant, incompletely configured OAuth is excluded from the visible production scope; if OAuth is configured later, its provider callback becomes an external validation gate before that path can inherit certification.

## Provider And Query Contract

### Current query shape

All Shopify order-reading paths call `shopifyFetchAllOrders` in `server/routes-oauth.ts`.

The initial request is:

`GET /admin/api/<allowlisted supported SHOPIFY_API_VERSION, default 2026-07>/orders.json?status=any&limit=250&order=created_at%20asc&created_at_min=<campaign-window ISO timestamp>`

The implementation then:

- follows the Shopify REST `Link` header's `rel=next` URL
- stores returned orders in memory and deduplicates them by required Shopify order ID
- stops at 1,000 pages and returns an error if another page remains
- detects a repeated next URL and fails rather than returning that loop as complete
- requests ascending `created_at` ordering to align the range filter with Shopify pagination guidance
- does not request a constrained field list
- retains the newest `updated_at` state when the same order ID appears more than once and fails on ambiguous conflicting duplicates
- persists one GA4 revenue row per order using the existing `externalId` field
- persists a non-secret latest-query audit containing the API version, exact window, ordering, page size/count, request/retry/throttle counts, raw/deduplicated/duplicate counts, financial-status/test/cancel counts, selected/eligible counts, resolved currency, and a SHA-256 matched-order state hash
- makes the damaged-data inventory fail closed when that audit is absent, incomplete, internally inconsistent, or mismatched to the source mapping
- does not query `updated_at_min`; GA4 refresh deliberately re-fetches the complete campaign creation window before transactional replacement
- retries HTTP `429` at most twice, uses `Retry-After` exactly when it is finite and no greater than 30 seconds, defaults a missing header to one second, and then returns the terminal response to the existing fail-closed caller
- does not inspect `X-Shopify-Shop-Api-Call-Limit`
- requests an allowlisted supported stable API version, records requested/effective versions at connection time, and rejects successful versioned responses whose `X-Shopify-API-Version` is missing or different
- checks `read_all_orders` before any requested order window older than Shopify's default 60-day order-access window

### Current provider boundary findings

| Finding | Status | Effect |
|---|---|---|
| Cursor pagination is followed | Proven for the current path | Executable multi-page/cursor tests pass and the deployed audit records actual page/request counts; no provider data is manufactured when production has fewer than 250 orders. |
| Page-limit failure | Proven locally by code shape | A remaining next link after 1,000 pages returns failure. |
| Rate-limit recovery | Proven locally; provider behavior unverified | Executable tests prove exact `Retry-After` waits, a two-retry bound, unsafe-delay rejection, and success after throttling. No real throttled-provider packet exists. |
| Stable ordering | Proven locally and audited | Initial range requests specify `order=created_at asc`; the persisted audit must report that exact ordering and page size. |
| Duplicate-order protection | Proven locally | Executable tests cover newest-state selection, missing IDs, and ambiguous duplicates; GA4 rows retain `externalId`. |
| Order-change capture | Proven for the implemented snapshot policy | Each refresh re-fetches the full campaign window, selects newest order state, atomically replaces rows, and persists matched-state/status counters; pre-audit raw history is intentionally not reconstructed. |
| API version pin | Proven locally; deployment/provider value unverified | The default is `2026-07`; current supported overrides are allowlisted, successful responses must report the requested effective version, and connection provenance records both values. Deployment configuration and a real header packet remain unverified. |
| REST longevity | Excluded/deferred roadmap | The current stable version is pinned and effective-version checked; a future GraphQL migration is required before Shopify ends the supported REST window, but is not a defect in the current working Admin-token path. |

Official Shopify references used to validate provider semantics:

- [API versioning](https://shopify.dev/docs/api/usage/versioning): stable versions are time-bounded, inaccessible versions fall forward, and responses expose the effective version.
- [REST rate limits](https://shopify.dev/docs/api/admin-rest/usage/rate-limits): `429` responses carry `Retry-After`, and REST Admin is legacy.
- [Order resource](https://shopify.dev/docs/api/admin-rest/latest/resources/order): `status=any` includes all statuses; financial statuses include pending, authorized, partially paid, paid, partially refunded, refunded, and voided; `updated_at_min` is available.
- [REST cursor pagination](https://shopify.dev/docs/api/admin-rest/usage/pagination): Link URLs must be followed unchanged, and Shopify recommends ordering a created-time range query by `created_at`.
- [OAuth authorization-code grant](https://shopify.dev/docs/apps/build/authentication-authorization/access-tokens/authorization-code-grant): callback validation includes nonce/session binding, valid HMAC, a validated `*.myshopify.com` hostname, and confirmation that required scopes were granted.

## Authentication And Connection Boundaries

### Admin API token

Current behavior:

- `/api/shopify/connect` requires campaign access before persistence.
- It validates the canonical `*.myshopify.com` boundary, verifies shop information and granted scopes, and requires both order-read capability and `read_all_orders` before persistence because the visible selector requests historical windows beyond 60 days.
- Storage writes the token into encrypted token JSON and clears the legacy plaintext column.
- The UI masks the token input.
- Storage deactivates the campaign's active connection and inserts the replacement in one transaction.

Findings:

- Host/SSRF rejection and same-shop pagination URL enforcement are proven locally by executable negative tests; a real provider connection remains unverified.
- Connection replacement rollback is proven locally by a forced insertion failure; the old active connection is retained.
- Shopify connection reads and writes now fail closed in production unless `TOKEN_ENCRYPTION_KEY` or `ENCRYPTION_KEY` is explicitly configured. Deployment key presence and quality remain not locally verifiable.
- Same-store token rotation remains transactional. Cross-store connection replacement now fails before mutation whenever an active Shopify revenue source exists; changing stores requires the explicit atomic disconnect path first.

### OAuth

Current behavior:

- OAuth start checks campaign access.
- An in-memory nonce maps campaign ID, shop domain, initiating Clerk session ID, and creation time.
- The callback consumes the nonce once and verifies campaign, canonical shop, initiating session, ten-minute TTL, and Shopify HMAC before exchanging the code.
- Token exchange is form-encoded and the returned scope list must include `read_orders` or implied `write_orders` access plus `read_all_orders`.
- The resulting token is stored through the same encrypted connection storage.

Findings:

- **Unproven provider path:** no current real OAuth connection/save packet exists.
- Session, TTL, shop, campaign, scope, and one-time state wiring are proven locally by pure negative tests plus static route guards. Multi-instance routing and a real browser/provider callback remain unverified.
- **Partially proven:** HMAC comparison is timing-safe, but exact encoding parity with Shopify is not covered by a callback fixture test.
- **Partially proven:** token exchange now matches Shopify's documented form encoding, but no real exchange packet exists.
- OAuth uses the same transactional connection replacement and rollback boundary as Admin-token connect.
- OAuth is not presented when its server configuration is incomplete, so the current Admin-token-only deployment does not advertise this unverified path.

### Campaign ownership and isolation

Proven locally:

- connect, status, preview, unique-values, save, source delete, and connection delete paths check campaign access
- source edit verifies campaign, source type, and platform context
- connection delete verifies the supplied connection ID belongs to the requested campaign
- source deletion uses a campaign/context-scoped storage transaction for the source and its records

Additional Current Commit 9 proof:

- the signed-in owner can inventory all owned Shopify campaigns with one read-only request
- cross-campaign overlap is keyed by normalized store domain plus Shopify order ID, so equal order IDs from different stores are not conflated
- campaign-local inventory checks active connection/source store parity, mapping parity, source/record campaign scope, currency, dates, totals, order identities, and the latest provider audit
- a cross-store connection replacement fails before mutation while an active Shopify source exists

## Attribution, Filtering, And Revenue Semantics

### Attribution fields

Supported UI choices:

- UTM Campaign
- UTM Source
- UTM Medium
- Discount code
- Tags

Current matching behavior:

- UTM values come from `landing_site`/`landing_site_ref`, falling back to order note attributes.
- Tags are split by comma and matched as exact individual strings.
- Selected values are compared case-sensitively and exactly.
- For discount codes, only the first code on an order is considered.
- Campaign Breakdown/Ad Comparison use `campaignValueRevenueTotals` plus optional exact campaign mappings; no proportional allocation is intended.

Findings:

- Exact tag matching is proven by local code structure.
- Multiple discount-code matching now evaluates every non-empty code on an eligible order.
- Case/whitespace normalization policy is undocumented and untested.
- Attribution changes correctly clear stale frontend selection state, but provider/order negative cases are not automated.

### Order eligibility

**Current Commit 2 implemented locally:** matched Shopify revenue now uses an explicit fail-closed eligibility policy:

- include non-test, non-cancelled `paid` and `partially_refunded` orders with a positive current total
- exclude `pending`, `authorized`, `partially_paid`, `refunded`, and `voided` orders
- exclude test, cancelled, and zero-current-total orders
- fail closed for missing test classification, missing/unknown financial status, or missing/invalid current total on a campaign-matching candidate
- use `current_total_price` as the only revenue amount because Shopify defines the current total after returns/refunds/order adjustments

Partially paid orders are deliberately excluded. The current order total is not proof of the amount captured, and this route does not fetch transaction-level captured amounts. A valid complete empty `orders` array, or a complete result with no eligible campaign match, is authoritative zero. A malformed successful payload, repeated pagination cursor, provider error, or unclassifiable campaign-matching order fails before materialization and preserves last-good data.

Focused executable policy tests cover paid, partially refunded, pending, authorized, partially paid, refunded, voided, test, cancelled, zero-total, missing classification, unsupported status, missing amount, and multiple discount codes. Static route guards prove the shared save, recalculation, and selectable-value paths call the centralized policy; a real provider packet remains not locally verifiable.

Official basis: Shopify documents the REST order financial-status meanings and identifies current total as the post-return/refund-adjusted order value: [REST Order resource](https://shopify.dev/docs/api/admin-rest/latest/resources/order) and [GraphQL Order resource](https://shopify.dev/docs/api/admin-graphql/latest/objects/Order).

### Refunds, cancellations, and order changes

- Refunds are not modeled as separate financial events.
- A later refund is intentionally restated on the original order's campaign-reporting-timezone `created_at` date when the full campaign-window snapshot is fetched again.
- Fully refunded and cancelled orders are excluded; partially refunded orders use their current total.
- GA4 fetches from campaign `startDate`, falling back to campaign `createdAt`; pre-campaign orders are intentionally outside the source window.
- The route does not merge an incremental `updated_at_min` result into a full snapshot. That would make replacement incomplete unless every unchanged order were also retained.

Status: eligibility, current amount, order-ID deduplication, original-date restatement, reporting-timezone conversion, and fail-closed window behavior are proven locally. Real provider order/refund mutation convergence remains not locally verifiable.

### Currency

Current behavior:

- Shopify shop-money is the only GA4 financial amount; presentment money remains diagnostics only
- every positive matched order must have a valid three-letter shop-money currency
- all matched shop-money currencies must be identical
- the Shopify shop-money currency must exactly equal the campaign currency
- a complete zero result uses the validated campaign currency
- resolved currency is persisted on the connection mapping, source mapping, source row, every revenue row, preview response, and save response

Status: **Current Commit 4 implemented locally.** Missing, invalid, mixed, or campaign-mismatched Shopify currency fails before dry-run or persistence, preserving last-good data.

No currency conversion is attempted or invented. This follows Shopify's definition of MoneyBag: shop money is the amount in the shop base currency and presentment money is the customer's selected currency. [Shopify MoneyBag](https://shopify.dev/docs/api/admin-graphql/latest/objects/moneybag).

## Daily Materialization, Identity, And Atomicity

### Current materialization

- each GA4 matched order creates one aggregate `revenue_records` row
- `externalId` stores the Shopify order ID
- the row date is `created_at` converted to the campaign reporting timezone
- platform campaign rows can be added for non-GA4 contexts
- refresh deletes all records for the source, then creates the replacement rows

### Date findings

- GA4 uses campaign reporting timezone for both order dates and the source window.
- Campaign `startDate` is authoritative; campaign `createdAt` is the fallback when no start date exists.
- Invalid, future, pre-window, and otherwise out-of-window matched order dates fail before replacement.
- A complete result with no matched eligible orders writes one zero row on the campaign-timezone current date; no positive revenue is re-dated.

Status: proven locally by executable timezone/invalid/window tests and static route guards; deployed timezone/provider evidence remains deferred.

### Atomicity and last-good preservation

**Current Commit 1 implemented locally:** the GA4 Shopify save/refresh materialization replacement is transactional.

The GA4 route now delegates the durable replacement to one campaign-scoped storage transaction:

1. update the Shopify connection mapping
2. create/update the revenue source
3. delete existing revenue records
4. insert replacement records
5. commit only if every write succeeds

Focused executable tests force both old-record deletion failure and replacement insertion failure and prove that the prior connection mapping, stable source metadata, source ID, and daily records are retained. The successful case proves that those three durable surfaces commit together. The transaction predicates bind the connection, source, and records to the requested campaign and GA4 Shopify source boundary.

Provider failures occur before these writes and therefore generally preserve existing records. Database/materialization failures now roll back the GA4 Shopify replacement. Downstream KPI/alert recomputation remains outside this transaction; a recompute failure can still return an error after the source replacement committed, so this commit does not claim end-to-end request atomicity beyond source materialization.

A structurally valid, completely paginated empty result is treated as authoritative zero. Malformed successful payloads and repeated cursor URLs fail closed before writes. The post-deploy latest-query/state audit is the bounded real-provider evidence gate.

## Lifecycle Matrix

| Lifecycle path | Current evidence | Status |
|---|---|---|
| Admin token connect | Campaign guard; canonical-host, scope, version, encryption-config and rollback tests; exact-store reconnect and provider read on 2026-07-14 | Proven for the inspected store/configuration; other stores and protected-data/scope changes remain unverified |
| OAuth connect | Session/TTL/host/scope validators and current route trace | Dormant/excluded when configuration is incomplete; becomes an external provider gate if enabled |
| Add/import | Provider-backed Admin-token connection; executable query, policy, date, currency, and transaction tests | Proven locally and bounded for the inspected store; latest provider audit must pass after deployment |
| Edit/update | Explicit stable `sourceId`; transactional replacement and order-policy tests; confirmed zero-match repair of the exact damaged source | Proven for stable identity, atomic replacement, order-state convergence policy, and the inspected repair |
| Delete/deactivate | Campaign/context-scoped transactional source+record delete | Proven locally for the source delete boundary; deployed packet was one campaign only |
| Disconnect | One campaign-guarded transaction deactivates every GA4 Shopify source, removes only their records, and deactivates the connection | Proven by success plus forced source/record/connection rollback and shared-connection fail-closed tests |
| Reconnect/change store | Transactional single-active-connection replacement; cross-store replacement blocked while any active Shopify source exists | Proven locally for rollback, same-store token rotation, and cross-store fail-closed behavior |
| Scheduler refresh | Stable source ID, mapping reuse, bounded request timeout, transactional save, durable query/run audit, deduplicated failure notification and recovery | Proven locally and bounded deployed evidence retained: one connected GA4 campaign completed and one GA4 plus two non-GA4 test sources failed closed with exact alerts |
| Manual reprocess | No user-facing route by design | Not implemented; scheduler only |
| Source freshness | Attempt/success/failure/last-good/run identity is persisted and propagated to source modal and Executive Summary risk | Proven locally with bounded deployed run/failure evidence |
| Failure retention | Provider/incomplete payload fails before writes; persistence rollback executable tests; scheduler creates one scoped high-priority notification and resolves it after recovery | Proven locally; a complete empty result intentionally materializes zero |

## Value Inventory And Formulas

| Value | Shopify contribution | Formula/window | Status |
|---|---|---|---|
| Revenue Sources modal | Active Shopify source definition plus materialized source breakdown | Active GA4-context rows through current UTC date | Proven locally for amount, store/currency provenance, and freshness |
| Total Revenue | Adds imported Shopify records to selected native GA4 financial revenue | `native GA4 revenue + active imported revenue` | Proven locally; deployed value is covered by the single audit gate |
| Profit | Shopify affects revenue numerator | `Total Revenue - Total Spend` | Proven |
| ROAS | Shopify affects revenue numerator | `Total Revenue / Total Spend` | Proven with existing unavailable semantics when spend is absent |
| ROI | Shopify affects revenue and profit | `(Total Revenue - Total Spend) / Total Spend * 100` | Proven with existing unavailable semantics when spend is absent |
| CPA | Shopify does not affect conversion denominator | `Total Spend / selected GA4 conversions` | Formula proven; Shopify changes do not directly change CPA |
| Campaign Breakdown Revenue | Exact imported campaign-value amount is added to one normalized matching GA4 row; imported-only row can be created | Native row revenue plus exact matched imported amount | Proven locally, including exact-match/no-allocation guards |
| Ad Comparison | Uses the same matched imported-revenue map and reports unallocated residual | Exact matched rows plus unallocated imported residual | Proven locally, including residual and provenance guards |
| Latest-day/internal daily revenue | Shopify is eligible because it materializes dated rows | Previous complete date in the campaign reporting timezone | Proven locally; refunds retain original order date |
| Pipeline Proxy | No Shopify contribution | Not applicable | Proven excluded |

Zero/null semantics:

- zero matched orders produces a successful active source with a zero dated record
- missing spend makes Profit/ROAS/ROI display unavailable according to existing GA4 UI gates
- missing conversions makes CPA unavailable
- missing source records can leave the source definition visible with a configured fallback amount in parts of the UI, while authoritative totals use records
- missing, invalid, mixed, or campaign-mismatched Shopify currency fails before persistence and preserves last-good data

## Downstream Propagation Matrix

| Consumer | Current path | Status for Shopify |
|---|---|---|
| Overview live UI | `revenue-to-date`, `revenue-breakdown`, `revenue-sources` -> `financialRevenue` | Proven locally |
| Source modal/provenance | Source definitions merged with breakdown and saved mappings | Proven locally for store, currency, refresh status, and last-good time |
| Campaign Breakdown | Saved `campaignValueRevenueTotals` and exact mappings merged into GA4 rows | Proven locally |
| Ad Comparison | Same mapping totals, exact row matching, unallocated residual | Proven locally |
| GA4 KPI values | `ga4-kpi-benchmark-jobs` reads active GA4 revenue totals | Proven by executable Shopify-backed persistence test |
| GA4 Benchmark values | Same source-backed financial input | Proven by executable Shopify-backed persistence test |
| Campaign-level KPI/Benchmark | Shared outcome aggregate/current-value reconciliation | Proven locally |
| Campaign DeepDive Performance Summary | `/outcome-totals.performanceSummary` | Proven locally |
| Budget & Financial Analysis | `/outcome-totals.financials` and `financialInputs` | Proven locally with enforced source currency |
| Platform Comparison | Shopify stays a GA4 financial child rather than a main platform | Proven; value correctness inherits the same audited Shopify source rather than a separate fallback |
| Trend Analysis | Snapshot/daily aggregate consumers | Proven for original-order-date snapshot replacement policy |
| Executive Summary | Shared performance aggregate, financial rows, risk inputs | Proven locally, including freshness/failure risk |
| Browser report | Current loaded GA4 value model | Proven locally |
| Scheduled/server report PDF | Rebuilds source breakdown and financial totals | Executable Shopify content plus report financial/provenance guards pass; one historical delivered packet only |
| Snapshots | Store generated aggregate/report state | Proven locally through the same audited source aggregate |
| Report emails | PDF attachment through shared report delivery | Proven locally for payload; provider acceptance/inbox receipt remains a generic external delivery boundary |
| In-app KPI alert/notification | Recomputed financial KPI/Benchmark current value | Proven by executable Shopify-backed notification metadata test |
| Alert emails | Shared KPI/Benchmark alert delivery | Proven for the shared current-value path; delivery status retains its generic provider audit semantics |
| Source failure alerts | Scheduler creates/updates one scoped high-priority notification and resolves it after recovery | Proven locally, including active bell indicator and no secret/provider-error leakage |

### Freshness root cause and Current Commit 6 resolution

Before Current Commit 6, Shopify source mapping stored only `lastSyncedAt`, the performance aggregate reduced financial-source freshness to `platformContext`, provider and persistence failures returned before any failure state was stored, and the scheduler supplied no run identity. Revenue records were already retained on GA4 provider and transactional persistence failure, but consumers could not distinguish current data from silently retained last-good data.

Current Commit 6 keeps the existing JSON mapping and transaction architecture. It now records attempt, success, failure, last-good, trigger, and run identity; keeps `lastSyncedAt` as the backward-compatible success alias; updates failure metadata through a campaign/source/type/context-scoped storage method that never touches revenue records; carries freshness through live and scheduled performance aggregates; shows Shopify refresh state in the GA4 Revenue Sources modal; and turns failed or stale Shopify refreshes into Executive Summary freshness risk. A post-commit derived-value failure does not relabel a committed Shopify replacement as failed.

This closes the identified local runtime gap. It does not prove deployed scheduler execution, real-provider failure behavior, alert delivery, or historical data health.

The persisted attempt/failure audit applies to refreshes of an existing GA4 Shopify source. If an initial add fails before any source row exists, there is no last-good source state to retain or attach audit metadata to; that failure remains visible in the request response/log only.

## Tests And What They Prove

Fresh local validation on 2026-07-12:

```text
npx vitest run server/shopify-provider-hardening.test.ts server/shopify-connection-transaction.test.ts server/shopify-revenue-policy.test.ts server/shopify-revenue-transaction.test.ts server/shopify-revenue-regression.test.ts server/shopify-downstream-content-regression.test.ts server/ga4-financial-source-parity.test.ts server/ga4-kpi-financial-window-regression.test.ts server/report-email-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts
npx vitest run server/source-safety-regression.test.ts -t Shopify
npm run check
```

Result: **10 files/95 tests passed**, **4 Shopify source-safety tests passed** with the other 83 tests filtered out, and TypeScript compilation passed. The unfiltered source-safety file still has seven unrelated Instagram static-test failures in the preserved dirty worktree; those failures are not counted as Shopify evidence or silently represented as green.

What this proves:

- stable source ID is explicitly carried in edit mode
- campaign/context guards exist in the traced routes
- source deletion uses the scoped route
- all current Shopify order endpoints call the paginated reader
- canonical store-host and same-store Link boundaries reject negative cases
- OAuth state validation binds campaign, store, Clerk session, and TTL
- order-read and `read_all_orders` scopes are required at connection time, with a second window-level `read_all_orders` guard before historical reads
- production encryption configuration fails closed when an explicit key is absent
- connection replacement rolls back to the old active connection on forced insertion failure
- supported/effective version mismatches and missing headers fail closed
- `429` recovery obeys safe `Retry-After` values and stops after two retries
- order eligibility, identity, dates, deduplication, currency, and transactional revenue replacement pass executable negative tests
- the scheduler passes stable source ID and platform context
- current GA4 financial formulas consume active imported revenue
- one mocked Shopify revenue amount propagates to scheduled PDF, KPI, Benchmark, and notification metadata
- shared report and outcome-total regression contracts still pass

What it does not prove:

- real-provider paid/refund/cancellation/test-order mutation behavior
- real-provider duplicate IDs or later order edits
- real rate-limit behavior or real pagination completeness; local bounded retry behavior is executable-tested
- deployed currency/store behavior; no currency conversion is implemented or claimed
- real OAuth callback/provider behavior; local session/TTL/hostname/scope validation is covered
- deployed scheduler mutation and failure retention
- Shopify-specific damaged-data health outside the one repaired campaign; that campaign's reported post-repair local invariant result is recorded separately below
- full Campaign Breakdown, Ad Comparison, Campaign DeepDive, report variant, snapshot, alert-email, and notification lifecycle matrix

Fresh Current Commit 8 local validation on 2026-07-14:

```text
npx vitest run server/shopify-provider-hardening.test.ts server/shopify-connection-transaction.test.ts server/shopify-revenue-policy.test.ts server/shopify-revenue-transaction.test.ts server/shopify-revenue-regression.test.ts server/shopify-revenue-damaged-data-inventory.test.ts server/shopify-repair-flow.test.ts server/shopify-downstream-content-regression.test.ts server/ga4-financial-source-parity.test.ts server/ga4-kpi-financial-window-regression.test.ts server/report-email-regression.test.ts server/outcome-totals-ga4-fallback-regression.test.ts server/ga4-ad-comparison-card-logic.test.ts --reporter=verbose
```

Result: **13 files/114 tests passed**. This executable/static combined gate covers connection rollback, provider boundaries and bounded retries, order policy and negative cases, source replacement rollback, repair confirmation/staleness/zero-match reachability, persisted-data inventory, downstream PDF/KPI/Benchmark/notification content, all five financial formulas, KPI/Benchmark financial windows, report/snapshot/PDF/email contracts, outcome totals, and Ad Comparison leader-card behavior. Static route guards in the suite remain code-shape evidence only; this result does not convert the real-provider and deployed evidence gaps below into passes.

Fresh local Current Commit 6 validation on 2026-07-13:

```text
npx vitest run server/shopify-refresh-readiness.test.ts server/shopify-revenue-transaction.test.ts server/shopify-revenue-regression.test.ts server/ga4-auto-refresh-regression.test.ts server/performance-summary-aggregate.test.ts server/executive-summary-regression.test.ts server/performance-summary-scheduler-regression.test.ts
npx vitest run server/source-safety-regression.test.ts -t Shopify
npm run check
```

Result: **7 files/80 tests passed**, **4 Shopify source-safety tests passed** with 83 non-Shopify tests filtered out, and TypeScript compilation passed. The focused state tests execute manual and scheduler success/failure state transitions, legacy timestamp fallback, error redaction, last-good retention, and financial-source freshness propagation. Existing transaction tests execute revenue-changing commit and forced delete/insert rollback. Static guards prove ordering, scheduler run-ID transport, scoped failure updates, modal rendering, and live/scheduled aggregate wiring; they do not substitute for a deployed scheduler packet.

Most assertions in `server/shopify-revenue-regression.test.ts` are static source-code guards. Passing them is evidence of code shape, not execution of provider and transaction negative cases.

## Damaged-Data Assessment

### Could existing production data be damaged?

**Yes, within one current GA4 test-source boundary.** The known contradictory connected production source was provider-rematerialized and its automatic campaign-local inventory reported `shopifyLocalPersistencePass: true`. Follow-up exact reads proved the remaining GA4 candidate is campaign `5317190c-d536-45d4-85c0-9d941cfba9f4`. The sources in the other two reported test campaigns belong to LinkedIn and Meta; they are preserved and do not prove GA4 damage. No cross-campaign overlap was found (`crossCampaignPass: true`). Historical provider state before retained audits remains not locally verifiable.

Potential damage classes:

1. revenue from test, pending, authorized, voided, refunded, or cancelled orders included as confirmed revenue
2. refunded orders overstated when `total_price` is selected
3. older changed/refunded orders not refreshed because the query uses only `created_at_min`
4. mixed or campaign-mismatched currencies numerically combined without conversion
5. partial or missing materialized rows after a failed non-transactional replacement
6. source mapping metadata updated while records remain old or missing
7. old active source rows remaining after a store connection change
8. the same Shopify order included in more than one app campaign through overlapping selected values
9. invalid/future/out-of-range order dates re-dated to the current/end date
10. duplicate provider rows counted twice because order IDs are not deduplicated or persisted

### Limits of the current Shopify inventory

Current Commit 7 added Shopify-specific campaign-local checks. Current Commit 9 adds `GET /api/ga4-overview/shopify/source-damage-inventory`, which inventories every Shopify campaign owned by the signed-in actor in one read-only request and performs normalized store-plus-order cross-campaign overlap detection.

The combined inventory now checks source/record/connection campaign and store parity, mapping completeness, totals, daily dates/window, currency, order identity and duplicate rows, connection/source mapping, last-good observations, and the latest provider query/retry/deduplication/order-state audit. It returns exact entity IDs and reason codes, distinguishes `ownerScopedBatchComplete` from broader provider history, and never authorizes automatic cleanup.

It intentionally does not claim another tenant's campaigns, reconstruct provider history from before the latest audit, retain raw order/refund payloads, or prove a dormant OAuth callback. Those are explicit privacy/history boundaries rather than silent passes. The deployed batch proved the connected source refresh succeeded and cross-campaign overlap passed. Follow-up source reads narrowed the GA4 cleanup boundary below.

Confirmed boundary (user identified all three campaigns as tests):

| Campaign | Shopify source | Platform | Connection | GA4 action |
|---|---|---|---|---|
| `5317190c-d536-45d4-85c0-9d941cfba9f4` | `048794ce-ed9a-45dd-8f2e-22341908138e` | `ga4` | `e61f6a80-7b8f-46b9-ad37-09200f03b685` | exact transactional cleanup |
| `de0af7f4-1dfd-4935-b5b3-1eafbb674e5c` | `7376d0e0-fa56-4864-80cd-9dbc8a972068` | `linkedin` | `a3bc9531-4844-4329-9ece-960421db6c60` | preserve and exclude from GA4 inventory |
| `d68cd1d1-fa5c-4d22-810c-aca601dcfd04` | `8db3f5d5-8eeb-4096-958f-d95bf2154203` | `meta` | `39c74a67-23a6-4f81-ad94-581066227345` | preserve and exclude from GA4 inventory |

No campaign deletion, connected-store cleanup, unrelated source cleanup, or provider rewrite is authorized.

## Reconciliation Of Existing Shopify Claims

| Existing claim/evidence | Fresh result |
|---|---|
| `Shopify Admin API token GA4 Overview revenue is production-ready and clean-certified` | **Prior claim remains withdrawn.** The current code is an implementation-complete candidate; deployed certification requires the single post-deploy refresh plus owner-scoped batch gate. |
| Admin token ownership guard | **Proven locally**, including canonical Shopify-host enforcement before token forwarding; real provider behavior remains unverified. |
| Paginated reads prevent truncation | **Proven for the current code path.** Executable multi-page, repeated-cursor, same-shop Link, page-limit, deduplication, older-window scope, and bounded 429 retry cases pass; the latest live page/request/retry counts are persisted for deployed verification. |
| Materialization fails closed | **Now proven locally for traced GA4 Shopify boundaries.** Durable replacement rolls back on tested persistence failures; malformed successful payloads, repeated cursors, and unclassifiable matched orders fail before writes. Complete empty results intentionally replace revenue with zero. Post-commit recompute failure remains separate. |
| Stable source identity on edit | **Proven locally** for explicit edit `sourceId`. Add mode still selects the first active Shopify source rather than creating a clearly separate source. |
| Delete/deactivate exact boundary | **Proven locally.** Individual deletion is scoped; full GA4 Shopify disconnect is now one source/record/connection transaction with forced rollback coverage. |
| Startup scheduler packet proves refresh | **Proven for the inspected deployed run.** Run `eba613a6-a7cd-4963-a23b-0f97c1dfd135` refreshed the connected campaign successfully and emitted exact alerts for three disconnected test campaigns. Broader future scheduler behavior remains operational monitoring, not timeless proof. |
| Downstream Reports/KPI/Benchmark/notification values are proven | **Propagation proven locally.** The exact shared Shopify financial row feeds Overview formulas, downstream content, reports/PDF/email payloads, KPI/Benchmark current values, outcome totals, and alerts; provider correctness is reconciled by the same source audit rather than a second value path. |
| Delivered report email closes report path | **One packet only.** It does not prove other variants/sends, snapshots, scheduler failure behavior, or current code after later shared-file changes. |
| Second-campaign portability proves isolation | **Proven locally by the owner-scoped batch boundary.** Cross-campaign overlap uses store plus order identity, and equal IDs from different stores remain isolated. |
| Clean source-damage inventory | **Failed closed, then narrowed by exact evidence.** The deployed response returned `localPass: false` and `crossCampaignPass: true`. Two reported sources are proven LinkedIn/Meta sources that the GA4 inventory incorrectly included. Current Commit 9.3 fixes that platform leak and cleans only the one GA4 test boundary; a post-cleanup all-pass response is still required. |
| OAuth can remain excluded | **Yes while unavailable.** The wizard suppresses OAuth unless the complete server configuration and required scopes are present. Enabling it later reopens its external callback gate. |
| Normal wall-clock scheduling is optional | **Scheduler timing alone can remain external**, but source freshness, persisted run/failure identity, provider mutation, and last-good behavior are not optional for strict readiness. |

### Stale documents reconciled by Current Commit 8

The following broad ledgers now identify this file as canonical and no longer use their historical packets as a current Shopify clean/production-ready conclusion:

- `GA4/README.md`
- `GA4/OVERVIEW.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_VALIDATION_RUNNER.md`
- `GA4-MANUAL-TEST-PLAN.md`

Historical packet detail remains in those ledgers for traceability, but it cannot override this document's current status or exclusions.

## Evidence Classification

### Proven locally

- campaign access guards on current Shopify user/API routes
- encrypted-token storage mechanism and masked token UI
- production Shopify connection access fails closed without an explicit encryption key
- canonical `*.myshopify.com` validation and same-store pagination-Link enforcement
- OAuth campaign/shop/session/TTL/scope validators and one-time callback state consumption by current route trace
- required order-read plus `read_all_orders` scopes at connect and again before historical reads
- transactional connection replacement with forced-insert rollback retention
- supported requested/effective API-version enforcement on successful versioned responses
- bounded two-attempt `429` retry with exact safe `Retry-After` handling
- explicit source-ID edit boundary and platform-context check
- scoped transactional individual source+record deletion
- transactional GA4 Shopify materialization replacement and last-good retention on tested delete/insert failures
- confirmed-revenue eligibility and current-total amount policy through executable unit tests
- malformed successful order-payload and repeated-cursor fail-closed route guards
- all-discount-code attribution helper behavior
- Shopify order-ID deduplication with newest-state selection and ambiguous-duplicate failure
- GA4 per-order `externalId` persistence through the transactional replacement test
- campaign-reporting-timezone order-date conversion and fail-closed window validation
- original-order-date refund restatement policy for full campaign-window snapshots
- exact GA4 Shopify shop-money/campaign-currency parity with missing, invalid, mixed, mismatch, and zero-result tests
- resolved currency propagation into connection/source provenance, source/record persistence, preview, and save response
- exact tag matching and current supported attribution-field wiring
- REST Link pagination loop and page-limit failure
- stable source ID passed by the scheduler
- active GA4-context source rows feed Overview imported revenue
- Profit, ROAS, ROI, and CPA formula wiring
- executable Shopify number propagation into a scheduled PDF, GA4 Revenue KPI, GA4 Revenue Benchmark, and notification metadata
- the exact repaired campaign's reported post-repair `shopifyLocalPersistencePass: true`
- atomic GA4 source/records/connection disconnect with forced rollback at every mutation boundary
- same-store connection rotation and cross-store replacement rejection while a source is active
- one-request owner-scoped campaign inventory and store-plus-order cross-campaign overlap detection
- latest provider page/request/retry/deduplication/order-state audit persistence and fail-closed inventory validation
- scheduler failure notification deduplication, last-good messaging, recovery resolution, and active bell indicator
- OAuth suppression when the complete server configuration is unavailable
- Campaign Breakdown, Ad Comparison, KPI/Benchmark, Campaign DeepDive/outcome totals, Reports/snapshots/PDF/email, notifications, and alerts through the current shared Shopify financial row

### Partially proven

- production data health until Current Commit 9.3 removes the exact confirmed GA4 test artifacts and the owner-scoped batch is rerun
- OAuth HMAC/callback/token-exchange behavior only if OAuth is configured and becomes visible

### Unproven or broken

- one confirmed GA4 test campaign currently fails local persistence inventory and retains one GA4 scheduler-failure alert
- production certification remains unproven until Current Commit 9.3 is deployed, its guarded cleanup succeeds, and the final owner-scoped inventory passes

### Not locally verifiable

- deployment encryption-secret quality
- current Shopify app scopes/protected-customer-data approval
- dormant OAuth callback and token durability
- provider conditions absent from the current production store, such as a live greater-than-250-order page or an actual 429; executable negative tests and persisted live counters cover the code path without manufacturing provider data
- historical raw refund/cancellation/order-change lineage before the latest persisted state audit
- deployed database health until the owner-scoped batch result is retained
- current/future report provider acceptance and inbox delivery

## Isolated Current Commit Queue

Current Commits 1 through 9.2 are implemented and deployed. The known connected contradictory source is repaired, the connected refresh completed, and cross-campaign overlap passed. Current Commits 9.1 and 9.2 safely rejected changed/cross-platform state without mutation. Current Commit 9.3 is the only remaining runtime commit: preserve the proven LinkedIn/Meta Shopify sources, correct GA4 inventory scoping, and clean only the exact GA4 test source/connection.

### Current Commit 1 — Transactional Shopify replacement and last-good retention

Root cause:

- connection mapping, source metadata, record deletion, and replacement insertion are separate writes
- an insertion/materialization failure can destroy last-good revenue while returning failure

Implemented scope:

- added one storage transaction for the existing campaign/source/context Shopify replacement
- moved connection mapping, source update/create, old-record deletion, and replacement insertion inside that transaction
- preserved the old connection mapping, source, and records on tested delete/insert failure
- did not change response shapes, formulas, attribution fields, scheduler cadence, or other source families
- added focused executable tests for rollback after record-delete and insert failure, stable source ID, and unchanged last-good records/totals

This was the smallest safe Current Commit because it prevents this persistence-failure damage without first deciding the final paid/refund revenue policy.

### Current Commit 2 and remaining queue

### Current Commit 2 - Confirmed-revenue and order-eligibility policy — implemented locally

Objective: establish one explicit Shopify revenue contract instead of counting every returned order.

Implemented scope:

- included only non-test, non-cancelled `paid` and `partially_refunded` positive-current-total orders
- excluded pending, authorized, partially paid, refunded, voided, test, cancelled, and zero-current-total orders
- made `current_total_price` the only Shopify revenue metric
- evaluated every non-empty discount code for attribution
- treated a structurally valid complete empty result as zero and rejected malformed successful payloads/repeated cursors
- centralized the policy in the existing Shopify order consumers without changing API response shapes

Completion evidence: focused executable policy tests cover every locally classifiable status and missing-field branch; route guards cover save, recalculation, selectable values, incomplete payload, and repeated-cursor use. Real-provider mutation and deployed evidence remain deferred to the final evidence commit.

### Remaining queue after Current Commit 2

### Current Commit 3 - Order identity, changes, dates, and deduplication — implemented locally

Objective: make repeated imports and later Shopify order changes deterministic and auditable.

Implemented scope:

- deduplicated all fetched orders by required Shopify ID and retained the newest unambiguous `updated_at` state
- persisted one GA4 revenue row per order using the existing `externalId` field
- re-fetched a complete campaign-start/creation window so changed orders in scope replace their previous state safely
- defined refunds as current-value restatements on the original order date
- removed positive-revenue re-dating for GA4 and failed closed on invalid, future, or out-of-window dates
- converted GA4 order dates and source bounds using campaign reporting timezone
- preserved the established non-GA4 daily materialization branch

Completion evidence: executable duplicate/newest-state/identity/timezone/invalid-date/window tests, transactional `externalId` retention, and static full-route guards. Real provider mutation convergence remains deferred to Current Commit 8.

### Remaining queue after Current Commit 3

### Current Commit 4 - Currency correctness and propagation — implemented locally

Objective: prevent mixed-currency Shopify amounts from being presented as one campaign currency.

Implemented scope:

- failed before preview/persistence for missing, invalid, mixed, or campaign-mismatched shop-money currency
- made Shopify shop money authoritative and retained presentment money as diagnostics only
- used campaign currency for a complete zero-order result
- persisted the resolved currency in connection/source provenance, source and per-order records, and API responses
- preserved downstream response shapes and relied on the existing source-backed propagation path

Completion evidence: executable same/mixed/missing/mismatch/invalid/zero currency tests, static pre-mutation route ordering guards, and the existing Shopify downstream financial suite. Bounded deployed evidence remains deferred to Current Commit 8.

### Current Commit 5 - Authentication, provider, and connection hardening — implemented locally

Objective: close Shopify request-boundary and provider-completeness risks without changing the connection architecture.

Implemented scope:

- validate the canonical `*.myshopify.com` host boundary
- bind OAuth nonce to the initiating session with a TTL
- require order-read plus `read_all_orders` at connect, with a second guard before historical reads
- make connection replacement atomic
- fail closed when the production encryption key is absent
- use and record a supported effective Shopify API version
- implement bounded `429` retry that honors provider guidance

Local completion evidence: executable host, OAuth-state/session/TTL, scope/window, encryption-key, connection-rollback, API-version, same-store URL, and bounded rate-limit negative tests; Shopify-specific static route guards; and TypeScript compilation. Real OAuth, effective-version, scope, throttling, and pagination packets remain deferred to Current Commit 8 and are not claimed locally.

### Remaining queue after Current Commit 5

### Current Commit 6 - Refresh freshness, scheduler audit, and failure visibility — implemented locally

Objective: make Shopify refresh success, failure, and staleness visible and trustworthy.

Implemented scope:

- persisted refresh attempt, success, failure, and last-good timestamps in the existing source mapping JSON
- preserved last-good revenue records and values on provider and transactional persistence failure
- exposed refresh state and last-good time in GA4 source provenance, live/scheduled performance aggregates, and Executive Summary freshness risk
- added one scheduler run identity to every Shopify reprocess in that run without changing scheduler cadence
- retained `lastSyncedAt` compatibility and redacted bounded provider error text
- limited failure-state writes to the active GA4 Shopify source for the exact campaign/source/context and left revenue records untouched

Local completion evidence: executable manual failure and scheduler success state tests, legacy fallback and aggregate propagation tests, the existing revenue-changing transaction test, forced delete/insert rollback tests, scheduler/run-ID and pre-provider ordering guards, source-modal/risk/snapshot guards, and TypeScript compilation. A real revenue-changing scheduled run and real forced-provider/persistence failure packet are not locally verifiable and remain required bounded evidence in Current Commit 8; no deployed success claim is made here.

### Remaining queue after Current Commit 6

### Current Commit 7 - Shopify damaged-data inventory and cleanup boundary — implemented; deployed inventory found damage

Objective: determine whether historical Shopify bugs damaged production data without mutating it.

Root cause:

- the existing campaign-access-guarded inventory had generic, CSV-specific, and HubSpot-specific checks but no Shopify-specific reconciliation
- generic duplicate-source and orphan checks cannot prove Shopify configured-total/order-count parity, persisted order identity, store/connection parity, currency parity, order-window validity, or partial materialization candidates
- provider financial status, test status, cancellation/refund lineage, historical query completeness, and cross-campaign order overlap are not persisted in the campaign-local normalized rows, so a database-only inventory cannot truthfully pass those boundaries
- cleanup before exact candidate discovery would risk deleting valid last-good rows or records from a different store/source boundary

Smallest safe implementation:

- added pure `inspectGa4ShopifyRevenueDamage(...)` in `server/utils/shopify-revenue-damage-inventory.ts`
- reused `GET /api/campaigns/:id/ga4-overview/source-damage-inventory` and its existing campaign-access guard; no new mutation route or provider call was introduced
- selected Shopify connection identity, store, active state, and non-secret mapping only; access tokens and encrypted tokens are not selected or returned
- returned `shopifyInventoryEntities` with the exact inspected campaign, connection, source, and record IDs
- named the bounded result `shopifyLocalPersistencePass`, not a general Shopify clean/pass result
- returned exact reason-coded findings for zero-record active sources, inactive-source rows, orphan/cross-family/cross-campaign links, incomplete mappings, configured-total and campaign-value-total drift, matched-order-count drift, invalid/out-of-window dates, missing/duplicate order identity, same-store overlap across active sources, source-type/currency/revenue drift, active-connection/store drift, and connection/source mapping drift
- used Shopify `externalId` as the duplicate key; date is intentionally not a duplicate key because multiple valid orders can share one day
- treated the intentional single zero placeholder row as valid only when it has no `externalId`, zero revenue, and configured matched-order count zero
- reported retained last-good rows after a newer refresh failure as an observation, not damage
- returned `shopifyInventoryScopeComplete: false` and explicit `shopifyNotLocallyVerifiable` reason codes for provider order state/refund lineage, historical completeness/order-change convergence, and privileged multi-campaign overlap
- hard-blocked cleanup with `automaticCleanupAllowed: false` and `cleanupProposalGenerated: false`

Local validation on 2026-07-13:

```text
npx vitest run server/shopify-revenue-damaged-data-inventory.test.ts server/csv-revenue-damaged-data-inventory.test.ts server/hubspot-revenue-damaged-data-inventory.test.ts
npm run check
```

Result: **3 files/14 tests passed** and TypeScript compilation passed. Tests execute clean, zero-placeholder, exact damaged-candidate, same-order-ID/different-store, and shared-route no-mutation boundaries. Existing CSV and HubSpot inventory behavior remained green.

No cleanup, deletion, deactivation, refresh, provider call, rematerialization, recomputation, or production write was performed by the inventory.

Deployed read-only evidence retained on 2026-07-13:

- campaign: `8aa735ee-c02f-41e2-bb1f-7c3f43bb9458`
- active connection: `5db7099d-e97c-44bb-a3bc-d0a057416571`
- active source: `3a68fcce-fffd-4dbf-ab03-7a63e46c5372`
- affected records: `fb994886-f1b3-4b10-91a9-a5206506328f` and `01bb6d2a-19ce-47c4-b6fc-4aeb72d24a17`
- inventory summary: two GA4 Shopify sources, one active source, two records, four Shopify connections, one active connection, and five reason-coded findings
- incomplete mapping issues: invalid revenue metric, missing currency basis, missing order identity field, missing order date basis, missing or invalid order-window start, and invalid materialization granularity
- configured/materialized total mismatch: `99.99` versus `199.98`
- configured/materialized identity-bearing order-count mismatch: `1` versus `0`
- both retained records lack Shopify order identity
- the active connection mapping matches no active Shopify source under the inventory's strict normalized mapping rules
- `shopifyLocalPersistencePass` is `false`, `shopifyInventoryScopeComplete` is `false`, candidate review is required, automatic cleanup is forbidden, and no cleanup proposal was generated

This pre-repair packet proved a persisted contradiction but did not establish whether `99.99` was authoritative. The later provider preview and repair below established zero current matches; this packet remains the retained before-state and is not a description of the current repaired rows.

Remaining Current Commit 7 evidence:

- identify whether any other production campaigns use Shopify Revenue and retain the same read-only inventory packet for each; the retained packet above proves only the named campaign
- the exact source was rematerialized and the automatic after-inventory reported `shopifyLocalPersistencePass: true`; the exact expanded after-entity packet was not retained
- continue to report provider-only, historical-convergence, and privileged cross-campaign checks as not locally verifiable unless bounded evidence closes them

The exact damaged-source boundary is closed by the provider-authoritative repair below. Current Commit 9 closes Current Commit 7's engineering gap with the owner-scoped batch and cross-campaign overlap inventory. No direct row cleanup is authorized.

### Current Commit 7.1 - Controlled Shopify repair and encryption preflight — deployed

Objective: repair the exact damaged active source from Shopify authority without repetitive console work, guessed row cleanup, cross-source mutation, or loss of last-good data.

Root cause and blocking evidence:

- the deployed inventory proves that source `3a68fcce-fffd-4dbf-ab03-7a63e46c5372` has incomplete legacy mapping, missing order identities, total drift, order-count drift, and active connection/source mapping drift
- those legacy rows cannot be safely deduplicated or corrected from the database alone because they do not retain the provider order identities needed to establish the authoritative order set
- a provider-backed dry run for the exact source, `utm_campaign`, and selected value `brand_search_q1` failed with HTTP `500` and `Production token encryption key is not configured`
- the failure occurred at the production token-encryption preflight, before Shopify provider retrieval and before any source or revenue-record mutation; therefore it supplies no provider-total evidence and authorizes no cleanup
- the existing edit wizard is not an adequate repair path when the saved configuration is unchanged because its review action remains disabled until the user changes a setting; forcing a fake configuration change would create avoidable risk

External configuration prerequisite:

- production must have an explicit `TOKEN_ENCRYPTION_KEY` or `ENCRYPTION_KEY`
- the configured key must remain compatible with existing ciphertext; if the historical fallback key cannot be established, reconnect only the exact Shopify store under the new key while preserving the retained revenue rows until provider validation succeeds
- no encryption secret value may be committed, logged, returned by an API, or stored in this evidence document

Smallest safe runtime scope:

- add a campaign-access-guarded, source-scoped repair entry point for the exact active GA4 Shopify source; do not add a global or cross-campaign repair
- perform a non-secret encryption/configuration preflight and fail closed before provider work when the explicit production key is unavailable
- run the existing provider-backed dry-run behavior with the source's saved campaign field and selected values, and show the provider total, order count, currency/mapping basis, and persisted contradiction
- require explicit confirmation after a successful preview and immediately before mutation
- reuse the existing stable-source-identity transactional rematerialization path; do not directly delete, edit, merge, or infer individual legacy rows
- replace only the confirmed source's records atomically, retain last-good records and refresh state on provider or persistence failure, and leave every other source, connection, campaign, and store unchanged
- automatically rerun the read-only Shopify inventory after success and return/retain the bounded post-repair packet
- fail closed on campaign/source/connection/store/context mismatch, inactive or stale source state, provider incompleteness, currency ambiguity, changed preview inputs, or provider failure
- keep `automaticCleanupAllowed: false`; this commit is provider-authoritative rematerialization of one confirmed source, not general damaged-data cleanup

Implemented local scope:

- the existing source edit wizard now exposes `Repair from Shopify` only when an unchanged saved GA4 Shopify source has a successful provider preview; ordinary add and changed-edit behavior retains the existing path
- preview and confirmation are bound by non-secret SHA-256 fingerprints of the exact source state, connection state, requested mapping/filter state, and matched provider order state; a changed preview returns `409 SHOPIFY_REPAIR_PREVIEW_CHANGED` before replacement
- production token-encryption readiness now fails with bounded code `TOKEN_ENCRYPTION_KEY_NOT_CONFIGURED` and HTTP `503`; no secret or key material is returned
- the confirmed repair reuses `replaceGa4ShopifyRevenueSourceWithRecords`, including stable source identity and one database transaction, and adds source/connection mapping predicates so a concurrent state change rolls the transaction back
- repair-mode provider or preview failure does not write a refresh attempt before confirmation, preserving the complete last-good source, records, and refresh state
- after a successful repair, the wizard requests campaign-local read-only inventory; Current Commit 9 adds the separate one-call owner-scoped/cross-campaign certification response without adding cleanup
- no cleanup route, cross-campaign writer, direct legacy-row edit, schema migration, new dependency, or response-field removal was introduced

Required automated evidence:

- missing-key preflight returns a bounded non-secret error and performs no provider or persistence mutation
- provider-preview failure, cancelled confirmation, changed/stale source state, and campaign/store/context mismatch perform no mutation
- successful repair preserves the source ID, writes identity-bearing daily records whose totals and order counts match the confirmed provider preview, and updates the existing refresh audit fields
- forced delete/insert failure rolls back and preserves the complete last-good source and record set
- unrelated sources, connections, campaigns, and stores remain byte-for-byte unchanged in the tested persistence boundary
- the automatic post-repair inventory no longer reports the locally detectable mapping, total, order-count, identity, or connection/source findings for the repaired source

Local validation completed on 2026-07-13:

- `npx vitest run server/shopify-repair-flow.test.ts server/shopify-revenue-transaction.test.ts server/shopify-revenue-regression.test.ts server/shopify-refresh-readiness.test.ts server/shopify-revenue-damaged-data-inventory.test.ts --reporter=verbose` passed: 5 files, 51 tests
- `npm run check` passed
- `git diff --check` passed for the Current Commit 7.1 files; only existing Windows line-ending warnings were emitted
- focused evidence covers fingerprint invalidation, missing-key error classification, no pre-provider repair mutation, stale source/connection rollback, full last-good retention on forced transactional failure, existing Shopify route regressions, refresh safeguards, inventory safeguards, and client repair/inventory wiring
- local automation cannot prove the production encryption key, ciphertext compatibility, live Shopify response, authoritative production order set, or deployed post-repair database state; no production provider call, rematerialization, or cleanup was performed by this local implementation

Required deployed completion evidence:

- explicit production-key presence is proven without exposing its value, and existing token decryptability or exact-store reconnection is proven
- the retained provider preview identifies the exact campaign, connection, stable source ID, selected campaign filter, currency basis, authoritative total, and matched-order count
- a separately confirmed repair succeeds for only that source, followed by a retained post-repair inventory packet
- before/after source and record IDs, totals, order counts, finding codes, and unchanged neighboring entity boundaries are reviewed
- provider-only and cross-campaign limitations remain explicitly separated from locally proven persistence health

Deployed completion on 2026-07-14: production was configured with a dedicated encryption key, the exact store was reconnected using the Admin API token path, and provider reads succeeded without exposing the token or key. The preview evidence was completed by Current Commit 7.2 because the provider-authoritative match was zero. No manual database cleanup was performed.

### Current Commit 7.2 - Zero-match saved-value repair reachability — deployed and completed

Deployed Current Commit 7.1 evidence on 2026-07-14 proved that the reconnected Admin API token fetched 10 orders across the configured 3650-day window, but none exposed a non-empty `utm_campaign`. The only provider-visible tag values were `prospecting_q1` and `shop_test`; `brand_search_q1` was absent. A separate 90-day read-only preview returned three orders and likewise no UTM campaign. This disproves the stored source's current one-order/`99.99` provider match and means no non-zero repair is authorized.

Root cause: the edit wizard filtered every saved selection against the current unique-value response. When the saved value correctly had zero current provider matches, it silently removed that value and disabled Continue, making the safe zero-match dry-run and transactional repair unreachable.

Smallest safe fix:

- retain only an original saved edit value when the attribution field is unchanged; connect mode, newly entered values, and changed attribution fields keep the existing provider-value filter
- show an explicit warning that the saved value is absent and that Review will confirm a zero-match provider preview
- keep the existing preview fingerprint, explicit Repair confirmation, exact-source transaction, zero-placeholder handling, post-repair inventory, and last-good rollback behavior unchanged
- do not substitute `prospecting_q1`, invent attribution, delete rows directly, or mutate production during diagnosis

Completion evidence on 2026-07-14: commit `b76b94e1` was deployed; the unchanged saved `brand_search_q1` selection remained reachable; the user continued through Review and explicitly ran `Repair from Shopify`; the wizard returned to Overview; and the automatic post-repair inventory reported `shopifyLocalPersistencePass: true`. The provider had fetched 10 orders in the 3650-day window with zero non-empty `utm_campaign` values and no `brand_search_q1` match, so the authoritative rematerialization is zero rather than the legacy `99.99`/`199.98`. The exact expanded post-repair source/record ID packet was not retained, so this closes the known campaign-local contradiction but not all-campaign or provider-history health.

### Current Commit 8 - Downstream evidence and final certification reconciliation

Objective: close the complete Shopify propagation matrix and rerun the strict certification gate.

Smallest safe scope:

- complete focused automation and bounded deployed evidence for Campaign Breakdown, Ad Comparison, KPI/Benchmark, Campaign DeepDive, reports/snapshots/PDF/email, and alerts/notifications
- prove multi-campaign/store isolation, real pagination, OAuth, currency, refund, cancellation, test-order, duplicate, and order-change cases
- reconcile every stale Shopify readiness claim and point broad ledgers to this canonical document
- rerun the complete `AGENTS.md` and `PRODUCTION_READINESS.md` certification checklist

Completion evidence: a complete evidence matrix with no in-scope value path left partially proven, unproven, or contradicted before any clean-certification claim.

Current Commit 8 result on 2026-07-14: the 13-file/114-test local gate passed and all identified broad clean-certification claims were reconciled. Its five-step queue is superseded by Current Commit 9.

### Current Commit 9 - Complete code-owned closure and single deployed gate

Root causes:

- disconnect depended on multiple browser requests, allowing partial source/record/connection removal
- a different store could replace the active connection while an old-store source remained active
- production inventory required repetitive campaign-by-campaign requests and could not detect cross-campaign store/order overlap
- successful provider pagination/retry/deduplication/order-state evidence was not retained with the source
- incompletely configured OAuth remained visible even though the supported deployment used an Admin API token
- scheduler failure state existed in source metadata but did not create a user-visible, deduplicated source alert or bell indicator

Implemented scope:

- one campaign-guarded storage transaction for GA4 Shopify source deactivation, exact record removal, and connection deactivation; it fails closed if another platform still uses the connection and retires any open failure alert for the removed source
- same-store token rotation remains allowed; cross-store replacement fails before mutation while an active Shopify source exists
- one owner-scoped read-only batch route inventories every owned Shopify campaign, detects same-store/order overlap across campaigns, and returns exact reason-coded entities without cleanup
- successful refresh/save persists non-secret API version, window, page/request/retry/throttle, raw/deduplicated/duplicate, financial-status/test/cancel, selected/eligible, currency, and matched-state-hash evidence
- inventory rejects missing or internally inconsistent provider audit fields
- OAuth is displayed only when complete server configuration and required scopes are available; the current Admin-token-only deployment no longer advertises dormant OAuth
- scheduler failures create or update one high-priority campaign/source notification, preserve last-good messaging, and resolve after recovery; the bell indicates only active unresolved failures
- the batch response includes unresolved Shopify refresh failures and exposes one aggregate `shopifyReadinessCandidatePass`

Safety boundaries:

- no cleanup, production mutation, provider fabrication, schema change, response-field removal, financial formula change, attribution broadening, or unrelated source-family change
- absent live provider conditions such as more than 250 current orders or a real 429 are not manufactured; executable negative cases prove the path and the deployed audit reports the conditions actually observed
- raw provider order/refund payloads and secrets are not persisted or returned

Local validation for the final candidate: TypeScript passes; the final 16-file Shopify/downstream gate passes all 140 tests; and the whitespace gate reports no errors.

The deployed gate ran on 2026-07-14. It passed cross-campaign overlap and the connected refresh, but failed local persistence because of the three test campaigns documented above.

### Current Commit 9.1 - Transactional disconnected Shopify test-data cleanup

Root cause:

- one user-confirmed test campaign retained an active GA4 Shopify source; two additional reports were later proven to reference non-GA4 Shopify sources
- the scheduler correctly failed closed and retained last-good rows, so read-only inventory could identify the damage but intentionally could not clean it

Smallest safe implementation:

- add one owner-scoped, exact-confirmation POST route initially hard-limited to the three reported campaign/source pairs
- require the caller to supply the exact active source ID set for every campaign; abort if production state changed
- abort the entire batch if any requested campaign has an active Shopify connection or an active non-GA4 Shopify source
- in one database transaction, deactivate only the exact GA4 Shopify sources, delete only their Shopify records plus orphan/mislinked Shopify-typed records, and resolve only matching open Shopify refresh-failure alerts
- preserve the campaigns, inactive source audit rows, all records outside the exact linked/mislinked cleanup boundary, connected campaigns, other-platform Shopify sources, and unrelated notifications
- recompute GA4 derived values after committed cleanup and report any recompute failure explicitly

Local validation: focused transaction/route coverage passes 8 tests, including forced rollback at source, record, and notification writes; active-connection, source-drift, ownership, confirmation, and other-platform-use guards are covered. TypeScript passes, and the complete 17-file Shopify/downstream gate passes all 148 tests.

Deployed outcome: the cleanup returned HTTP 409 with `cleanupApplied: false` because every reviewed campaign had one active Shopify connection row. The single transaction made no changes. A fresh read-only batch retained the exact three connection IDs documented above. Current Commit 9.1 therefore proved its fail-closed boundary but cannot clean the current state.

### Current Commit 9.2 - Exact active-connection convergence

Root cause:

- Current Commit 9.1 used the scheduler-time no-connection evidence as a mutation precondition
- before mutation, the current inventory showed one active connection on each confirmed test campaign, so the precondition was correctly rejected
- the cause and timing of that state transition are not retained and are not guessed

Smallest safe implementation:

- hard-code the three newly reviewed active connection IDs alongside the already reviewed campaign/source pairs
- require the database's complete current active source and connection sets to equal those IDs before any mutation
- deactivate the exact sources and exact connections, remove only the exact linked/orphan/mislinked Shopify record boundary, and resolve only matching open alerts in the same all-campaign transaction
- roll back every source, record, connection, and notification change if any campaign or write differs
- preserve all campaigns, unrelated records/sources/connections/notifications, connected production campaign data, and other-platform Shopify use

Local validation: TypeScript and all 9 focused tests pass, including forced source, record, connection, and notification rollback plus source/connection drift, ownership, confirmation, and other-platform-use guards. The complete 17-file Shopify/downstream gate passes all 149 tests.

Deployed outcome: the cleanup returned HTTP 409 with `cleanupApplied: false` and `Shopify source is still used by another platform`. The single transaction again made no changes. Exact read-only source results then proved campaign `de0af7f4-1dfd-4935-b5b3-1eafbb674e5c` is `linkedin` and campaign `d68cd1d1-fa5c-4d22-810c-aca601dcfd04` is `meta`. They are outside the GA4 cleanup boundary and must be preserved.

### Current Commit 9.3 - GA4 platform isolation and one-source cleanup

Root cause:

- the owner-scoped GA4 Shopify inventory included any Shopify source/record/connection and any Shopify failure notification without first proving `platformContext = ga4`
- this made valid LinkedIn and Meta Shopify sources appear as GA4 damage and made the cleanup proposal too broad
- the storage guard correctly prevented the cross-platform mutation

Smallest safe implementation:

- inventory only GA4/null-context Shopify sources, their records, true orphan/mislinked Shopify rows, and failure notifications proven GA4 or whose source no longer exists
- exclude records linked to a known non-GA4 Shopify source and do not treat its shared connection as a GA4 connection boundary
- retain fail-closed orphan alerts instead of silently excluding unknown source IDs
- hard-limit cleanup to campaign `5317190c-d536-45d4-85c0-9d941cfba9f4`, GA4 source `048794ce-ed9a-45dd-8f2e-22341908138e`, and connection `e61f6a80-7b8f-46b9-ad37-09200f03b685`
- preserve the LinkedIn/Meta sources, connections, records, and alerts without making readiness claims about those platform scopes

Local validation: TypeScript passes, the cleanup/platform-isolation suites pass all 18 tests, and the complete 17-file Shopify/downstream gate passes all 150 tests.

Estimated remaining work after Current Commit 9.3 is deployed: **2 actions, no Shopify UI workflow**:

1. invoke the exact guarded cleanup once for the one documented GA4 campaign/source/connection set
2. rerun `GET /api/ga4-overview/shopify/source-damage-inventory` and retain the compact all-pass result

## Certification Gate

Current Commit 9's local implementation and connected deployed-refresh gates pass. Current Commits 9.1 and 9.2 have retained failed-safe deployed results. Certification is pending Current Commit 9.3 deployment, its exact one-source cleanup result, and the final read-only all-pass GA4 inventory.

Shopify Revenue must not be called clean-certified or production-ready until:

- Current Commit 9.3 is deployed and its response confirms cleanup of only the one documented GA4 campaign/source/connection set
- the one-call owner-scoped batch returns `ownerScopedBatchComplete`, `shopifyLocalPersistencePass`, `crossCampaignOrderOverlapPass`, and `shopifyReadinessCandidatePass` as `true`, `openRefreshFailureCount` as `0`, and every returned campaign as `pass: true`

No campaign deletion, Shopify UI workflow, forced provider failure, fabricated greater-than-250-order fixture, OAuth setup, or repetitive UI validation is required for the currently visible Admin API token scope unless either post-deploy response returns a specific reason-coded failure.
