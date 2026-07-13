# GA4 Overview Shopify Revenue Production Readiness

## Status

**Not production-ready. Not clean-certified.**

This is the canonical Shopify Revenue readiness document as of 2026-07-12 for `58e604fb` plus the local Current Commit 5 changes documented below.

The earlier Shopify clean-certification statements in `GA4/README.md`, `GA4/OVERVIEW.md`, `GA4/FINANCIAL_SOURCES.md`, `GA4/OVERVIEW_PRODUCTION_READINESS.md`, `GA4/OVERVIEW_VALIDATION_RUNNER.md`, and `GA4-MANUAL-TEST-PLAN.md` are not valid current readiness conclusions. They are retained as historical leads and bounded evidence packets only. Current Commits 1-5 close specific local correctness, atomicity, currency, authentication, and provider guards, but freshness, disconnect/store parity, deployed-data health, real-provider, and downstream evidence gaps still block certification.

The current honest answer is:

- Shopify Revenue has useful local lifecycle and downstream wiring.
- The Admin API token happy path has bounded historical deployed evidence.
- The source family does not satisfy `AGENTS.md` and `PRODUCTION_READINESS.md` for strict clean certification.
- Existing production Shopify revenue may be overstated, mislabeled by currency, silently stale, or partially damaged. A Shopify-specific read-only inventory is required before any cleanup.

## Audit Contract

This audit was performed fresh. Previous production-ready statements, test results, HubSpot evidence, Google Sheets evidence, CSV evidence, and other source-family evidence were not accepted as Shopify proof.

No runtime code was changed during the first audit. Current Commits 1-5 were implemented only after that root-cause baseline; unrelated dirty worktree changes remain preserved.

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
- `shared/schema.ts`
- `server/shopify-revenue-regression.test.ts`
- `server/shopify-downstream-content-regression.test.ts`
- `server/shopify-provider-hardening.test.ts`
- `server/shopify-connection-transaction.test.ts`
- the focused GA4 financial, outcome-total, notification, and report regression files used in validation

## Scope

### Included

- Shopify Revenue as a GA4 Overview financial child source
- Admin API token and visible OAuth boundaries
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
- real provider, OAuth, inbox, and deployed-database assertions that cannot be proven from local code

OAuth cannot be ignored when assessing the visible product: the wizard presents `OAuth (recommended)`. It is therefore a current visible path that remains unproven and blocking for whole-source readiness, even though a narrower Admin-token-only certification could exclude it after the other blockers are fixed.

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
- does not query `updated_at_min`; GA4 refresh deliberately re-fetches the complete campaign creation window before transactional replacement
- retries HTTP `429` at most twice, uses `Retry-After` exactly when it is finite and no greater than 30 seconds, defaults a missing header to one second, and then returns the terminal response to the existing fail-closed caller
- does not inspect `X-Shopify-Shop-Api-Call-Limit`
- requests an allowlisted supported stable API version, records requested/effective versions at connection time, and rejects successful versioned responses whose `X-Shopify-API-Version` is missing or different
- checks `read_all_orders` before any requested order window older than Shopify's default 60-day order-access window

### Current provider boundary findings

| Finding | Status | Effect |
|---|---|---|
| Cursor pagination is followed | Partially proven | Static local coverage proves the loop exists; no real >250 matching-order packet proves provider completeness. |
| Page-limit failure | Proven locally by code shape | A remaining next link after 1,000 pages returns failure. |
| Rate-limit recovery | Proven locally; provider behavior unverified | Executable tests prove exact `Retry-After` waits, a two-retry bound, unsafe-delay rejection, and success after throttling. No real throttled-provider packet exists. |
| Stable ordering | Proven locally by code shape | Initial range requests specify `order=created_at asc`; real multi-page evidence remains deferred. |
| Duplicate-order protection | Proven locally | Executable tests cover newest-state selection, missing IDs, and ambiguous duplicates; GA4 rows retain `externalId`. |
| Order-change capture | Partially proven | Each refresh re-fetches the full campaign-start/creation window and therefore sees current state for orders created in that window. Real refund/order mutation convergence remains not locally verifiable. |
| API version pin | Proven locally; deployment/provider value unverified | The default is `2026-07`; current supported overrides are allowlisted, successful responses must report the requested effective version, and connection provenance records both values. Deployment configuration and a real header packet remain unverified. |
| REST longevity | Partially proven only | Shopify documents REST Admin as legacy; no migration or compatibility gate exists. |

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
- The active revenue source is not automatically deactivated when the connection is replaced. Until a new mapping save succeeds, old Shopify revenue can remain active while the active connection points to another store.

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

### Campaign ownership and isolation

Proven locally:

- connect, status, preview, unique-values, save, source delete, and connection delete paths check campaign access
- source edit verifies campaign, source type, and platform context
- connection delete verifies the supplied connection ID belongs to the requested campaign
- source deletion uses a campaign/context-scoped storage transaction for the source and its records

Partially proven:

- two historical deployed campaigns had distinct source IDs
- source IDs and stored rows are campaign-scoped

Unproven or unsafe:

- the same Shopify order/value can be selected into multiple MimoSaaS campaigns; there is no cross-campaign order-identity inventory or overlap warning
- one campaign supports only one active Shopify connection, while old active source records can outlive a store change
- no Shopify-specific inventory proves connection domain, source mapping domain, and materialized records all belong to the same store

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

A structurally valid, completely paginated empty result is treated as authoritative zero. Malformed successful payloads and repeated cursor URLs now fail closed before writes. Provider mutation and incomplete-field behavior still require real-provider evidence.

## Lifecycle Matrix

| Lifecycle path | Current evidence | Status |
|---|---|---|
| Admin token connect | Campaign guard; canonical-host, scope, version, encryption-config and rollback tests; historical one-store packet | Partially proven; local boundaries pass, while current deployment key/provider behavior remains unverified |
| OAuth connect | Session/TTL/host/scope validators and current route trace | Partially proven locally; real browser/provider callback, HMAC fixture, and multi-instance behavior remain unverified |
| Add/import | Historical `$99.99` packet; executable order-policy tests; current static route tests | Partially proven; local eligibility policy is covered but real-provider and remaining date/currency cases are not |
| Edit/update | Explicit stable `sourceId`; transactional replacement and order-policy tests; historical `$99.99 -> $199.98` packet | Partially proven; source retention and eligibility are proven locally, while changed-order/date semantics remain incomplete |
| Delete/deactivate | Campaign/context-scoped transactional source+record delete | Proven locally for the source delete boundary; deployed packet was one campaign only |
| Disconnect | UI deletes matching active sources one by one, then deletes connection | Not atomic across multiple sources and connection; partial disconnect is possible |
| Reconnect/change store | Transactional single-active-connection replacement with rollback test | Connection replacement is proven locally; old source/new connection mismatch can still exist until a new mapping save succeeds |
| Scheduler refresh | Stable source ID, mapping reuse, bounded internal request timeout, stale-ID skip; same transactional GA4 save route | Partially proven; no revenue-changing Shopify provider packet and no event audit |
| Manual reprocess | No user-facing route by design | Not implemented; scheduler only |
| Source freshness | `lastSyncedAt` saved after success | Partially persisted, not surfaced or propagated adequately |
| Failure retention | Provider/incomplete payload fails before writes; persistence rollback executable tests | Proven locally for traced provider-shape/persistence failure boundaries; a complete empty result intentionally materializes zero |

## Value Inventory And Formulas

| Value | Shopify contribution | Formula/window | Status |
|---|---|---|---|
| Revenue Sources modal | Active Shopify source definition plus materialized source breakdown | Active GA4-context rows through current UTC date | Proven locally for display wiring; underlying amount not certified |
| Total Revenue | Adds imported Shopify records to selected native GA4 financial revenue | `native GA4 revenue + active imported revenue` | Propagation proven; Shopify input correctness blocked |
| Profit | Shopify affects revenue numerator | `Total Revenue - Total Spend` | Formula proven; result inherits Shopify blockers |
| ROAS | Shopify affects revenue numerator | `Total Revenue / Total Spend` | Formula proven; result inherits Shopify/currency/window blockers |
| ROI | Shopify affects revenue and profit | `(Total Revenue - Total Spend) / Total Spend * 100` | Formula proven; result inherits Shopify/currency/window blockers |
| CPA | Shopify does not affect conversion denominator | `Total Spend / selected GA4 conversions` | Formula proven; Shopify changes do not directly change CPA |
| Campaign Breakdown Revenue | Exact imported campaign-value amount is added to one normalized matching GA4 row; imported-only row can be created | Native row revenue plus exact matched imported amount | Partially proven; mapping variants/collisions/case policy incomplete |
| Ad Comparison | Uses the same matched imported-revenue map and reports unallocated residual | Exact matched rows plus unallocated imported residual | Partially proven locally; no fresh Shopify-specific negative packet |
| Latest-day/internal daily revenue | Shopify is eligible because it materializes dated rows | Previous complete UTC date | Partially proven; date/timezone/refund semantics blocked |
| Pipeline Proxy | No Shopify contribution | Not applicable | Proven excluded |

Zero/null semantics:

- zero matched orders produces a successful active source with a zero dated record
- missing spend makes Profit/ROAS/ROI display unavailable according to existing GA4 UI gates
- missing conversions makes CPA unavailable
- missing source records can leave the source definition visible with a configured fallback amount in parts of the UI, while authoritative totals use records
- mixed currency can produce a null source currency while retaining a summed number

## Downstream Propagation Matrix

| Consumer | Current path | Status for Shopify |
|---|---|---|
| Overview live UI | `revenue-to-date`, `revenue-breakdown`, `revenue-sources` -> `financialRevenue` | Wiring proven; value correctness blocked upstream |
| Source modal/provenance | Source definitions merged with breakdown and saved mappings | Partially proven; store/currency/freshness provenance incomplete |
| Campaign Breakdown | Saved `campaignValueRevenueTotals` and exact mappings merged into GA4 rows | Partially proven |
| Ad Comparison | Same mapping totals, exact row matching, unallocated residual | Partially proven |
| GA4 KPI values | `ga4-kpi-benchmark-jobs` reads active GA4 revenue totals | Narrow local Shopify Revenue row proven |
| GA4 Benchmark values | Same source-backed financial input | Narrow local Shopify Revenue row proven |
| Campaign-level KPI/Benchmark | Shared outcome aggregate/current-value reconciliation | Partially proven by shared wiring; no Shopify lifecycle matrix |
| Campaign DeepDive Performance Summary | `/outcome-totals.performanceSummary` | Partially proven; inherits source correctness/currency gaps |
| Budget & Financial Analysis | `/outcome-totals.financials` and `financialInputs` | Partially proven; source rows present, currency not enforced |
| Platform Comparison | Shopify stays a GA4 financial child rather than a main platform | Architecture proven; value correctness inherited |
| Trend Analysis | Snapshot/daily aggregate consumers | Unproven for Shopify refund/order-change history |
| Executive Summary | Shared performance aggregate, financial rows, risk inputs | Partially proven; Shopify freshness is not supplied |
| Browser report | Current loaded GA4 value model | Partially proven |
| Scheduled/server report PDF | Rebuilds source breakdown and financial totals | One narrow local content test and one historical delivered packet |
| Snapshots | Store generated aggregate/report state | Partially proven; snapshots can preserve wrong Shopify input |
| Report emails | PDF attachment through shared report delivery | One historical delivered Shopify report packet only |
| In-app KPI alert/notification | Recomputed financial KPI/Benchmark current value | Narrow Revenue notification test proven |
| Alert emails | Shared KPI/Benchmark alert delivery | Unproven for a fresh Shopify mutation/failure packet |
| Source failure alerts | Scheduler logging only | Not implemented; users can receive no Shopify-specific stale/failure notification |

### Freshness gap

Shopify source mapping stores `lastSyncedAt`, but the performance aggregate creates financial source freshness with only `platformContext`. Shopify `lastSyncedAt`, provider failure state, and scheduler run identity are not carried into Campaign DeepDive data-freshness risk. The scheduler has no persisted Shopify run/failure audit. A successful no-change source timestamp cannot prove which scheduler invocation produced it.

This blocks strict source-freshness, Executive Summary risk, and scheduler certification.

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
- Shopify-specific damaged-data health
- full Campaign Breakdown, Ad Comparison, Campaign DeepDive, report variant, snapshot, alert-email, and notification lifecycle matrix

Most assertions in `server/shopify-revenue-regression.test.ts` are static source-code guards. Passing them is evidence of code shape, not execution of provider and transaction negative cases.

## Damaged-Data Assessment

### Could existing production data be damaged?

**Yes.** Current local code cannot prove that existing Shopify financial rows are clean.

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

### Why the prior inventory is insufficient

The existing `ga4-overview/source-damage-inventory` route has generic checks for orphan rows, inactive-source rows, duplicate source signatures, and unexpected platform contexts. It has dedicated deep checks for CSV and HubSpot, but no Shopify-specific inventory.

It does not prove:

- order IDs or duplicate orders
- order status/test/cancel/refund eligibility
- source total versus order-level recomputation
- source/record/connection store-domain parity
- source/campaign currency parity
- order-date validity and reporting timezone
- connection mapping versus source mapping parity
- partial replacement or last-good state
- overlapping order attribution across campaigns

Therefore the historical `inventory clean` packets do not establish Shopify data health. Cleanup is not authorized. The next inventory must be read-only and return exact candidate source/record/connection IDs and reason codes before any mutation is proposed.

## Reconciliation Of Existing Shopify Claims

| Existing claim/evidence | Fresh result |
|---|---|
| `Shopify Admin API token GA4 Overview revenue is production-ready and clean-certified` | **Contradicted.** Eligibility, identity/date, currency, connection replacement, and API-version ingress are now locally guarded, but disconnect atomicity/store parity, freshness, deployed evidence, and damaged-data scope remain unresolved. |
| Admin token ownership guard | **Proven locally**, including canonical Shopify-host enforcement before token forwarding; real provider behavior remains unverified. |
| Paginated reads prevent truncation | **Partially proven.** Cursor loop, stable initial ordering, same-shop Link enforcement, deduplication, page-limit failure, older-window scope enforcement, and bounded 429 retry exist; real >250 evidence remains absent. |
| Materialization fails closed | **Now proven locally for traced GA4 Shopify boundaries.** Durable replacement rolls back on tested persistence failures; malformed successful payloads, repeated cursors, and unclassifiable matched orders fail before writes. Complete empty results intentionally replace revenue with zero. Post-commit recompute failure remains separate. |
| Stable source identity on edit | **Proven locally** for explicit edit `sourceId`. Add mode still selects the first active Shopify source rather than creating a clearly separate source. |
| Delete/deactivate exact boundary | **Proven locally** for individual source+record deletion. Full disconnect is multi-step and non-atomic. |
| Startup scheduler packet proves refresh | **Bounded evidence only.** It proved a no-change pass and no duplicate for one source; it did not prove revenue mutation, failure retention, order changes, or normal schedule timing. |
| Downstream Reports/KPI/Benchmark/notification values are proven | **Narrow propagation proof only.** Correct propagation of a mocked number does not prove the Shopify number is correct. |
| Delivered report email closes report path | **One packet only.** It does not prove other variants/sends, snapshots, scheduler failure behavior, or current code after later shared-file changes. |
| Second-campaign portability proves isolation | **Partial.** Distinct source IDs were observed, but overlapping Shopify order attribution and store/source domain parity were not checked. |
| Clean source-damage inventory | **Insufficient.** The route has no Shopify-specific order/status/currency/connection/atomicity checks. |
| OAuth can remain excluded | **Not for whole visible-source readiness.** OAuth is displayed as recommended. Its confirmed host/session/TTL/scope/transaction gaps are fixed locally, but callback/HMAC/provider evidence remains incomplete. |
| Normal wall-clock scheduling is optional | **Scheduler timing alone can remain external**, but source freshness, persisted run/failure identity, provider mutation, and last-good behavior are not optional for strict readiness. |

### Stale documents requiring later reconciliation

After runtime blockers are fixed and the certification audit is rerun, these files must stop repeating the old clean claim and point to this document:

- `GA4/README.md`
- `GA4/OVERVIEW.md`
- `GA4/FINANCIAL_SOURCES.md`
- `GA4/OVERVIEW_PRODUCTION_READINESS.md`
- `GA4/OVERVIEW_VALIDATION_RUNNER.md`
- `GA4-MANUAL-TEST-PLAN.md`

This first audit creates the canonical correction without editing those already-dirty or broad historical ledgers.

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
- narrow Shopify number propagation into a scheduled PDF, GA4 Revenue KPI, GA4 Revenue Benchmark, and notification metadata

### Partially proven

- Admin token add/edit/delete happy path
- OAuth HMAC/callback/token-exchange behavior pending real provider and callback-fixture evidence
- source modal and mapped-campaign provenance
- Campaign Breakdown and Ad Comparison exact mapping
- scheduler refresh/no-duplicate behavior
- Reports/snapshots/PDF/email propagation
- KPI/Benchmark/campaign-level consumer propagation
- Campaign DeepDive/outcome totals
- two-campaign source-ID isolation

### Unproven or broken

- transaction-level confirmation beyond Shopify financial status and real-provider policy behavior
- real-provider older order/refund mutation convergence
- atomic disconnect across sources and connection; old-source/new-store parity after reconnect
- real OAuth/provider behavior and exact HMAC callback-fixture parity
- real rate-limit and pagination completeness
- Shopify freshness/risk propagation and scheduler auditability
- multi-store/source parity and overlapping cross-campaign order attribution
- Shopify-specific production-data inventory and cleanup boundary
- complete downstream negative-case matrix

### Not locally verifiable

- deployment encryption-secret quality
- current Shopify app scopes/protected-customer-data approval
- real OAuth callback and token durability
- real >250 matching-order pagination
- live provider rate-limit behavior
- live refunds/order mutations and scheduler convergence
- deployed database damage extent
- current/future report provider acceptance and inbox delivery

## Isolated Current Commit Queue

Current Commits 1 through 4 are implemented in the working tree. Shopify remains uncertified because the remaining queue is unresolved.

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

### Current Commit 6 - Refresh freshness, scheduler audit, and failure visibility

Objective: make Shopify refresh success, failure, and staleness visible and trustworthy.

Smallest safe scope:

- persist refresh attempt, success, failure, and last-good timestamps
- preserve last-good values on provider and persistence failure
- expose freshness in source provenance and Campaign DeepDive risk/freshness surfaces
- add scheduler run identity and failure observability without changing cadence

Completion evidence: manual and scheduler success/failure tests, one revenue-changing scheduler packet, and one forced-failure packet proving retention and freshness state.

### Current Commit 7 - Shopify damaged-data inventory and cleanup boundary

Objective: determine whether historical Shopify bugs damaged production data without mutating it.

Smallest safe scope:

- add a Shopify-specific read-only inventory
- report exact campaign, connection, source, and record IDs with reason codes
- run it for every in-scope production campaign
- produce a separate cleanup proposal only for proven candidates

Completion evidence: retained inventory output, reviewed candidate boundaries, and explicit confirmation that no cleanup occurred during inventory.

### Current Commit 8 - Downstream evidence and final certification reconciliation

Objective: close the complete Shopify propagation matrix and rerun the strict certification gate.

Smallest safe scope:

- complete focused automation and bounded deployed evidence for Campaign Breakdown, Ad Comparison, KPI/Benchmark, Campaign DeepDive, reports/snapshots/PDF/email, and alerts/notifications
- prove multi-campaign/store isolation, real pagination, OAuth, currency, refund, cancellation, test-order, duplicate, and order-change cases
- reconcile every stale Shopify readiness claim and point broad ledgers to this canonical document
- rerun the complete `AGENTS.md` and `PRODUCTION_READINESS.md` certification checklist

Completion evidence: a complete evidence matrix with no in-scope value path left partially proven, unproven, or contradicted before any clean-certification claim.

Estimated remaining work: **3 engineering/evidence steps** after Current Commit 5. Some steps can contain multiple focused commits if a root cause cannot be safely combined.

## Certification Gate

Certification fails.

Shopify Revenue must not be called clean-certified or production-ready until:

- every confirmed blocker above is fixed
- the Shopify-specific lifecycle, provider, currency, date, order-state, atomicity, freshness, downstream, isolation, and damaged-data matrices pass
- local tests cover negative cases rather than only source-code strings and a happy-path mocked amount
- required deployed/provider evidence is attached to the current implementation
- all stale Shopify claims are reconciled to this canonical document

Passing the existing 61-test focused packet does not change this result because those tests do not cover the blocking paths.
