# Batch 5: CRM and commerce Revenue

[Release index](../../V1_RELEASE_READINESS.md) · [Finding checklist](../../audits/v1-2026-10-19/FIX_QUEUE_ASSIGNMENTS.md)

This is the detailed home for this batch's assigned findings. Read the required repository references first, then the release index, checklist and this record. Documentation records evidence; verify actual current code before changing behavior. Original audit paths and line numbers describe the recorded baseline, not an assertion that the defect remains unchanged.

## Current Batch 5 status

**Provider validation prerequisite, October 23:** the user can sign into all three providers, confirmed HubSpot test deals use EUR and created `V1 Batch 5 Test`. Its native GA4 source displayed EUR 7,653.96 while Total Revenue was unavailable. [V1-011-F1](../v1-batch-3/README.md#initial-financial-publication-follow-up-october-23) proves missing first financial publication and records the localized initial-activation correction. That fix is verified locally and committed in `1f0dfb3d`; deployment verification, exact repair and fresh deployed creation are pending. The new provider campaign has no imported sources in the read-only diagnosis. Pause HubSpot/Salesforce/Shopify acceptance here; none is certified by campaign creation or provider login access. Earlier response-to-render proofs below retain their synthetic-data boundaries.

**All six forward corrections are VERIFIED LOCALLY within the boundaries below, including the compatibility follow-up.** They are committed in **`6f9db9b60d05affb3f80d9885085c71b75d32d3c`**, based on `67279e8e308959dae80e70b7edb1ca9e4ff684fe`, and deployed in **`714689994fc55438b47d5386d1d104057c0c28d3`**. Public revision/health and signed-out proxy-access checks pass; authenticated/provider acceptance remains OPEN. All six release acceptances remain OPEN. The implementation/compatibility packet is **472 tests: 452 passed, 20 classified unresolved failures, zero skipped**. All **139 new Batch 5 checks in that packet pass**, including 17 real PostgreSQL cases and one isolated full-page browser case. TypeScript and server build pass; unchanged client files retain their passing production build. The read-only compatibility check found and prompted a localized Salesforce recovery correction. Actual provider recovery remains unverified. This is not whole-source or whole-app certification.

### Isolated GA4 browser validation October 23

**PASS: ten new GA4 browser cases and 47 neighboring checks, zero failures or skips; final TypeScript check passes.** [Assessment, exact source hashes and limits](validation-2026-10-23/ga4-browser-assessment.json), [GA4 results](validation-2026-10-23/ga4-browser-corrected.json), [neighboring results](validation-2026-10-23/ga4-browser-neighbors.json), [typecheck](validation-2026-10-23/ga4-browser-final-build-checks.json). At that browser-validation checkpoint all 16 files in the earlier compatibility manifest matched and application code was unchanged from deployed `71468999`. The browser test/evidence are now committed in `1f0dfb3d` together with the subsequent initial-publication correction documented above. The earlier 139-check implementation packet and its broader 20 unresolved failures retain their original scope; this narrower run does not replace them.

The new `server/v1-batch5-ga4-browser.test.ts` bundles the actual `client/src/pages/ga4-metrics.tsx` and application query client in Chromium. Synthetic responses show native GA4 revenue plus HubSpot, Salesforce and Shopify revenue in the existing Total Revenue card and source modal. Separate verified proxy responses show the correct combined amount and source details. Complete zero stays zero. A failed response, wrong source ID, wrong currency, missing timestamp or inconsistent item total makes the combined proxy unavailable. A failed refetch does not resurrect cached amounts; a successful retry restores the proxy. Shopify-only configuration does not request CRM proxy APIs. Removing CRM configuration from the synthetic inventory removes its displayed proxy despite cached responses. These are response-to-render checks, not proof that the mocked published totals were calculated correctly by a live backend.

The 47 neighboring checks cover the existing Sheets browser case, GA4 publication/refresh browser case and 45 GA4/Sheets/Custom consumer calculations. Browser requests are intercepted; other hosts, mutations and unmodelled APIs fail the new test. The existing runner removes application credentials and blocks external Node networking. No application server, database or provider connection was used; each context and Chromium close after testing. Ptomo and saved data are unchanged.

Initial failures are retained and classified in the assessment: missing fixture responses for industry benchmarks, diagnostics and geography, then fixture display names inconsistent with the expected labels. Correcting those test inputs produced the passing final run; no application behavior or acceptance assertion was weakened. The single-case diagnostic runs intentionally filtered out nine cases; both final runs have zero skips.

**Still unverified:** authenticated deployed behavior, actual provider permissions/data/currency recovery, OAuth and save/reconnect/cancel/delete actions, natural refresh, downstream parity and historical-data correctness. Setup wizards and unrelated layout/auth components are stubbed; Custom full-page rendering and visual styling are outside this run. Synthetic removal is not a delete-route test. Suitable provider test-account access has not been established. No account setup, new Ptomo connection or screenshot is requested from the user at this checkpoint. All six finding acceptances remain OPEN and V1 remains NO-GO.

### Deployment verification October 23

The user reported deployment. An independent [public check](validation-2026-10-23/deployment-health-2026-10-23.json) at **20:11 Amsterdam time** confirmed HTTP 200, `ok: true`, production mode and exact revision `71468999`. Signed-out requests to the HubSpot and Salesforce Pipeline Proxy APIs both returned **401**, using a nonexistent fixture ID. No authenticated campaign, provider data, credentials or mutation was involved. This supersedes the earlier pending public-deployment status; it does not prove authenticated tenant isolation, actual provider imports or UI values.

**Deployed UI/provider acceptance is still required.** The current `client/src/pages/ga4-metrics.tsx` connects its configured HubSpot/Salesforce queries to the existing Google Analytics Overview Pipeline Proxy card and `Pipeline Proxy Sources` modal. Confirmed provider amounts appear in the `Total Revenue` card and its `Sources` / `Revenue Sources` modal. The later isolated browser checkpoint above proves the specified response-to-render behavior. Actual provider validation must use a connected test campaign and compare the same selected records, currency and applicable date window with those displays. Save/refresh and provider recovery remain required; checking that a page merely looks normal does not prove these contracts. Keep Pipeline Proxy separate from confirmed Total Revenue. The safe provider/authenticated checks described below remain open.

Ptomo's read-only inventory has no active HubSpot, Salesforce or Shopify source/connection. It therefore cannot validate Batch 5's provider paths in its current configuration. No Ptomo edit, extra source connection, screenshot or scheduled-refresh wait is requested for this deployment check. Do not substitute redundant campaign evidence without verifying the exact source and ownership. The 20 broader test failures, all six finding acceptances and the V1 NO-GO remain unchanged.

### Commit checkpoint October 23

The [commit checkpoint](validation-2026-10-23/commit-checkpoint.json) binds all 16 runtime/test files to the validated candidate and records the exact 93-file commit boundary. The [preflight](validation-2026-10-23/commit-preflight.json) verified the unchanged candidate, current remote base, documentation integrity and publication-file secret scan. Related pending Ptomo freshness and Batch 4 public-deployment records are included because the audit index references them; unrelated worktrees, assets, seed logs and scripts remain excluded. No runtime edits, schema changes, production cleanup or new provider calls occurred during commit preparation. Historical pre-commit assessments retain their original dates/status. The deployment and isolated browser checkpoints above own the later validation status. Actual provider recovery and all six acceptance gates remain OPEN.

## Pre-deployment compatibility and recovery checkpoint October 23

The [read-only inventory](validation-2026-10-23/predeploy-compatibility-complete.json) checked the previously verified production database in an enforced `READ ONLY` transaction, ending with `ROLLBACK`. It did not select credentials, load application storage/token helpers, invoke provider APIs or change saved data. Public health independently confirmed live revision `67279e8e`. The [final inventory](validation-2026-10-23/predeploy-compatibility-final.json) binds the corrected candidate and repeats these limits. The first inventory attempt encountered a UUID/text join mismatch in audit SQL; its [failed record](validation-2026-10-23/predeploy-compatibility.json) is retained. Explicit read-only casts fixed that query; no application schema change was needed.

- **Shopify configuration:** the user confirmed `SHOPIFY_API_VERSION` is **not listed** on Render. The application therefore uses its unchanged supported `2026-07` default. This is [user-confirmed configuration evidence](validation-2026-10-23/render-environment-confirmation.json), not independent dashboard inspection or real order-import acceptance. No Render setting needs changing for this check.
- **Existing dependencies:** ten active revenue sources were checked: seven HubSpot, two Salesforce and one Shopify. Each had a present owned parent, parseable mapping and one active provider connection. Current scope includes retained platform contexts; hidden/deferred UI is not treated as proof of inaccessibility. HubSpot legacy `closedwon` selections still require actual account metadata verification at refresh.
- **Ptomo:** one matching campaign, no active HubSpot/Salesforce/Shopify sources or connections. This change has no existing Ptomo CRM/commerce dependency. No production data was changed.
- **V1-109 compatibility finding:** one non-Ptomo GA4 Salesforce source has a positive cached Pipeline Proxy with no `pipelineCurrency`. Hashed source reference: `64da74c2229afb121edb81ec14b9aacdee987f4c452d368b05d26cb894184212`. The initial candidate's API cache guard accepted it while the UI correctly withheld it; the save and on-demand paths also omitted currency when Salesforce rejected `Opportunity.CurrencyIsoCode`. Waiting or reloading alone was not a proven repair. This lowered that recovery path to unproven until the correction and checks below passed.
- **Historical data limits:** one active HubSpot connection has no campaign parent. Normal auto-refresh selection starts from existing active campaigns (`server/auto-refresh-scheduler.ts`, `filterActiveSchedulerCampaigns`), but this inventory does not certify every retained job or callback. Preserve this orphan for the existing historical-data/ownership acceptance gate; no cleanup was attempted. The 281 HubSpot and 182 Salesforce normalized records have no external provider IDs, so stored aggregates cannot prove historical provider identity/deduplication correctness. No revenue record referenced a missing source or a different campaign in the checked families. These facts do not certify old amounts.

**Localized recovery correction (V1-109):** `server/routes-oauth.ts` now rejects an otherwise complete Salesforce cache whose positive amount lacks matching campaign currency. The existing save and on-demand query paths recover missing per-record currency only after a provider query reports the field unavailable and a complete, nonempty result is obtained. They call the existing `detectSalesforceCurrency` helper with a new opt-in `requireSingleCurrency` flag. `server/utils/salesforceCurrency.ts` uses its existing SOAP `getUserInfo` transport and requires a complete response, explicit `organizationMultiCurrency=false` and a valid `orgDefaultCurrencyIsoCode`; it never substitutes a multi-currency user's default or the campaign's display currency. The result must match campaign currency. Missing per-record currency in an otherwise successful currency-bearing response fails closed. Existing valid caches and explicit empty results retain their behavior. A successful recompute clears an old warning. No schema, response field, source ID, attribution filter or date window changed; ordinary currency-discovery callers retain their prior behavior.

**Validation:** [focused results](validation-2026-10-23/currency-recovery-verified.json) **149/149 pass**. The 21 added cases cover exact on-demand recovery/cache decisions, currency mismatch/absence, SOAP failure/multi-currency rejection, valid zero, direct record currency, actual save/storage preservation and unchanged neighboring sources. All seven added PostgreSQL cases pass. An initial fixture lacked the real stage-query helper; two positive cases exposed this. The actual helper and complete stage response are now bound, and negative tests require currency-specific errors. No failed requirement was waived. The [expanded related run](validation-2026-10-23/compatibility-related.json) is **452 passed / 20 failed / zero skipped**; [reconciliation](validation-2026-10-23/compatibility-failure-reconciliation.json) retains every existing failed identity under OPEN V1-012. [Current assessment and 16-file manifest](validation-2026-10-23/compatibility-assessment.json) supersede the earlier candidate manifest; only the centralized routes, currency helper and provider-contract test changed during this follow-up. [TypeScript/server build](validation-2026-10-23/currency-recovery-build-checks.json) pass. Provider transport is a fixture; this is not proof of the live Salesforce organization's currency, permissions or successful recovery.

The [final test-file typecheck](validation-2026-10-23/compatibility-final-build-checks.json) also passes. [Cleanup](validation-2026-10-23/compatibility-cleanup.json) confirms zero Batch 5 fixture schemas, zero other test-database sessions and the localhost cluster stopped.

The implementation gap is corrected locally and committed in `6f9db9b6`. The final inventory intentionally still identifies the stored currency-less cache: it has not been rewritten. After deployment, its normal API/refresh path will attempt verified recovery; if the provider cannot prove the currency, the amount stays unavailable and saved data is retained. Actual provider recovery, all six finding acceptances and the V1 release decision remain OPEN/NO-GO. Public deployment verification subsequently passed as recorded above. The read-only compatibility check itself did not commit, push or deploy code; the later checkpoints supersede its delivery status.

Provider contract: Salesforce's [getUserInfoResult documentation](https://developer.salesforce.com/docs/platform/api/guide/sforce-api-calls-getuserinfo-getuserinforesult.html) distinguishes the single-currency organization's default from the multi-currency user's default. This is why a user-default or campaign-currency guess is not used for recovery.

## Correction checkpoint October 23

The current implementation was traced before editing. Original findings still reproduced: the initial [41-case regression run](validation-2026-10-23/baseline.json) had 33 failures and eight passing controls. No production database, provider account or Ptomo data was read or changed for this implementation.

| Finding | Confirmed root cause and exact corrected path | Local proof and remaining boundary |
|---|---|---|
| V1-042 | `server/routes-oauth.ts` CRM preview/save/Pipeline paths stripped nonnumeric characters; `server/utils/shopify-revenue.ts` did the same for required and optional money. `parseCrmRevenueAmount` now accepts finite numbers/plain decimal strings and rejects malformed values; existing CRM negative-adjustment meaning remains. Shopify retains its nonnegative-money rule. | Actual HubSpot/Salesforce save handlers reject malformed values before replacement; valid zero/fractions retain their values. Shopify required/presentment helper cases pass. Real PostgreSQL CRM rows remain identical on failed input. Shopify handler-to-real-database/provider acceptance is not newly proven. |
| V1-043 | HubSpot `hubspotSearchDeals` accepted missing result envelopes; Salesforce `fetchCompleteSalesforceQuery` accepted missing `done`, `records` or contradictory counts. Existing pagination utilities now verify envelopes, stable counts, terminal completion and nonempty continuation pages. | Complete empty queries publish explicit zero; incomplete responses preserve CRM source, records and connection settings. Existing page, result-limit, repeated-cursor, wrong-host and later-page failure controls pass. All current Salesforce helper callers select `Id`; the stage lookup now requests `Id, MasterLabel`. No query filter/date-window broadening. |
| V1-044 | CRM financial loops added repeated provider IDs. HubSpot's four financial loops now keep query-local identity/count state; Salesforce's complete-query helper validates unique IDs across every page. | Identical or conflicting repeated IDs fail the entire query; no arbitrary winner or summing duplicates. Unique pages retain correct totals. This deliberately requires a complete retry if provider data shifts between pages. Existing persisted duplicates were not rewritten. |
| V1-045 | HubSpot explicit stages bypassed closed-won verification, while labels could override metadata. `deriveDefaultClosedWonStageIds` and HubSpot save now require account stage metadata, verify the selected IDs and verify returned deal stages before publishing confirmed revenue. | Open-stage overrides, misleading labels, missing metadata and metadata request failures fail before writes. Legacy `closedwon`-only selection still resolves to verified custom won stages. Real account stage/permission and transition acceptance remains OPEN. Pipeline stays separate from confirmed revenue. |
| V1-083 | `server/utils/shopify-provider.ts` still allowed retired `2025-10`. It is now rejected at configuration resolution; supported list is `2026-01`, `2026-04`, `2026-07`, with unchanged `2026-07` default and response-version guard. | Retired/default cases and existing provider-hardening tests pass. The user confirmed the Render override is absent in the compatibility checkpoint above; no new provider version was introduced or certified. |
| V1-109 | GA4 merged successful zero/empty endpoint output with stale mapping amounts; Sheets/Custom used mappings after failed reads. HubSpot proxy could return success after recompute failed; both API caches could manufacture zero from missing totals. | Both exact proxy handlers retain valid zero, identity and timestamp, reject incomplete cache, and expose provider failure. GA4/Sheets/Custom consumers require exact active source, current-stage mode, timestamp, currency and reconciled item totals; errors or a missing provider make the combined total unavailable. All 45 actual consumer calculations pass. Full-page Sheets browser proves zero, positive, unavailable and source-modal freshness. The later ten-case GA4 browser checkpoint also passes. Custom full-page browser and deployed/provider acceptance remain OPEN. |

### Initial correction evidence and files

- [Assessment and SHA-256 manifest](validation-2026-10-23/assessment.json): exact eight runtime files and seven test files; uncommitted candidate, test isolation and limits.
- [Final related test results](validation-2026-10-23/final-record.json): **451 total, 431 passed, 20 failed, zero skipped**. All **118 new Batch 5 cases pass**, including ten actual handler/storage PostgreSQL replacement/preservation cases and one actual standalone Sheets page in headless Chromium. Provider transports, account access and currency discovery are explicit fixtures; they are not provider or authentication certification.
- [Failure reconciliation](validation-2026-10-23/failure-reconciliation.json): every failure retains its stable `TEST-*` ID, exact test path, current error, classification and OPEN V1-012 release impact. They cover scheduler fixture/signature expectations, source-extraction assertions, Google Ads Shopify path assertions and downstream KPI/Benchmark propagation. These requirements remain unresolved; prior occurrence does not waive them. The previous whole-suite 179 failures and separate CI gate are not superseded by this narrower run.
- [Production builds](validation-2026-10-23/verified-build-checks.json) and [final test typecheck](validation-2026-10-23/final-tests-build-checks.json) pass. Intermediate failing runs remain in the packet. Provider fixtures were corrected to include real envelope fields/IDs; stage/cache assertions now test the stricter contract. A test-only encoding change was restored. No new failing identity remains.
- [Fixture cleanup](validation-2026-10-23/cleanup.json): no Batch 5 schemas or leftover database clients; isolated localhost cluster stopped. No production cleanup, migrations, schema edits, dependency additions or deployment occurred.

### Lifecycle and downstream boundary

| Path | Current evidence classification |
|---|---|
| CRM add/preview/edit and normalized daily replacement | **Proven locally for the documented contracts.** Actual confirmed-save handlers and helpers; PostgreSQL selected-source zero/fraction replacement, failed-response preservation and unchanged neighboring rows for HubSpot/Salesforce. Source IDs and existing storage transactions remain intact. |
| Scheduler/reprocess | **Partially reviewed.** Existing jobs call the corrected save handlers and existing durable ownership/expected-mapping guards remain. Pagination checks now also cover retained non-GA4 HubSpot financial loops. Natural provider refresh, concurrent mapping changes and real account permissions are not proved by the local fixtures. |
| Pipeline source list/card and zero/error propagation | **Proven locally for tested expressions/API boundaries and the documented GA4/Sheets browser cases.** Config establishes the card, never an available amount. No mapping amount fallback after failed reads. Positive unknown/mismatched currency is unavailable, not silently formatted as campaign currency. Browser responses are synthetic; Custom full-page and deployed/provider proof remain open. |
| Confirmed totals, KPIs, Benchmarks, Insights, alerts and reports | **Partially reviewed.** Same normalized storage/recompute paths and response success shapes; proxy remains separate. Retained regression failures explicitly prevent full downstream certification. No provider-to-export/email parity run was performed. |
| Delete/deactivate/reconnect/cancellation and recovery | **Unchanged, not recertified.** Related ownership/transaction tests are supporting evidence only. This packet does not prove every lifecycle configuration or live OAuth recovery. |
| Prior malformed/duplicate values | **Unreviewed for the new candidate.** No historical data was inferred or corrected. Before cleanup, inventory exact owner/campaign/source/provider record boundaries and retain last-good evidence. |

### Compatibility and release checks still required

The correction intentionally withholds an amount when provenance is incomplete. Older proxy caches lacking a valid timestamp, complete item totals or verified currency can show `Unavailable` until a complete source refresh succeeds and verifies that provenance. The Salesforce missing-currency recovery boundary and its correction are documented above; refresh success must not be assumed. If stage metadata cannot be read, confirmed HubSpot revenue is retained instead of refreshed from guessed stages. Repeated identities or changing counts stop publication and require a complete retry. No source is deleted by these guards.

The read-only configuration review and Shopify override check are complete as recorded above. The six CRM/commerce correction files retain their existing validated implementation; subsequent browser evidence and the separate initial-publication correction are committed in `1f0dfb3d`. On the deployed candidate, independently validate HubSpot, Salesforce and Shopify permissions, complete pagination, real selected values, amount/currency/date parity, create/edit/reconnect, zero/error recovery (including the identified Salesforce source), scheduled refresh, source modal, confirmed totals and downstream outputs. Use isolated fixtures for destructive/failure paths. Do not run an unsafe failure experiment on Ptomo.

The screenshot follow-up for Ptomo's October 23 GA4/financial freshness is already recorded in Batch 3; it does not validate these CRM/commerce paths and need not be repeated for this local implementation step.

### Reusable contracts and documentation alignment

Reuse the existing centralized route -> storage transaction -> schema-backed normalized records -> downstream recompute model. Validate complete provider envelopes, stable provider identity, strict amounts, explicit zero vs unavailable, exact source/platform ownership and last-good preservation before publication. Keep source configuration separate from observed values; a cache is usable only with explicit provenance and freshness. Retain the new provider/API/PostgreSQL/UI regressions as independent contracts when adapting another source.

GA4's imported daily financial records, completed-day totals and separate Pipeline Proxy are application-specific assumptions. HubSpot probability/stage IDs and search cursors, Salesforce `Id`/`done`/query locators and Opportunity currency, and Shopify shop/presentment money plus pinned API versions are provider-specific. They are not generic permission, attribution, date, pagination or quota guarantees for LinkedIn, Instagram, Meta or TikTok. Those providers remain deferred and require independent validation.

Historical manual-test guidance said an active saved CRM source alone could establish the displayed proxy amount. That contradicts the verified failure cases. `GA4/FINANCIAL_SOURCES.md` and the two affected checks in `GA4-MANUAL-TEST-PLAN.md` now distinguish configuration from validated amounts. Other historical certification statements remain bounded history.

Provider references checked October 23: [Shopify version lifecycle](https://shopify.dev/docs/api/usage/versioning) lists `2025-10` as unsupported after October 16; [Salesforce Query response](https://developer.salesforce.com/docs/atlas.en-us.api_rest.meta/api_rest/resources_query.htm) defines the result/count/completion contract; [HubSpot pipeline metadata](https://developers.hubspot.com/docs/api-reference/legacy/crm/pipelines/guide) defines probability `1.0` as won. These public references do not prove live credentials or returned account data.

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
| [V1-042](#v1-042) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-043](#v1-043) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-044](#v1-044) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-045](#v1-045) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-083](#v1-083) | P1 | VERIFIED LOCALLY | OPEN |
| [V1-109](#v1-109) | P1 | VERIFIED LOCALLY | OPEN |

## Findings

Original evidence below is retained verbatim except relative link destinations. For implemented findings, use the correction and current-status sections to distinguish fixed forward paths from remaining release acceptance.

### V1-042

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed amount-validation defects):

HubSpot save20245, Salesforce save18830 and Shopify `utils/shopify-revenue.ts:145` remove arbitrary characters before numeric conversion. Exact HubSpot handler and Shopify helper fixtures accept12oops as12; nonnumeric HubSpot becomes measured0 and Shopify becomes excluded zero order. Salesforce code retains same digit-stripping behavior despite non-finite checks. Reject invalid provider values before publication; trace existing corruption separately.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.

### V1-043

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed incomplete-provider-to-zero contract):

HubSpot search19976/save20235 substitutes missing results with[]; exact handler persists zero for HTTP-success{}. Salesforce `utils/salesforce-pagination.ts:43` accepts{} and ignores totalSize10 versus empty records, confirmed in exact helper fixtures. GA4 save19251 maps empty rows to zero. Incomplete/unavailable response must not overwrite last-good revenue as measured zero.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.

### V1-044

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed HubSpot duplicate counting):

Save20245 adds each result without deal-ID deduplication. Exact two-page fixture repeats the same10USD deal and persists20USD; cursor changes so pagination guard passes. Query completeness and aggregate/daily self-reconciliation do not detect duplicated provider identity. Require identity/revision policy before financial publication; Salesforce equivalent absence has code evidence, not separate handler fixture.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.

### V1-045

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed HubSpot revenue-classification gap):

Save20169 accepts explicit stageIds without checking closed-won metadata. Fixture supplies known open-stage metadata and shows that stage queried and10USD materialized as confirmed revenue. Default closed-won derivation does not protect caller override. Keep Pipeline Proxy separate and verify stage semantics for each account.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.

### V1-083

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: conditional unsupported configuration):

`utils/shopify-provider.ts:5–20` accepts2025-10, officially retired Oct16,2026; default2026-07 remains supported. Response-version guard258–303 rejects provider fall-forward, preserving semantic safety but causing accepted old configuration to fail. Live override unknown. Restrict the final support manifest and validate any version-list change independently.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.

### V1-109

**Severity:** P1. **Fix status:** VERIFIED LOCALLY. **Release acceptance:** OPEN.

**V1 applicability:** V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement.

**Original audit evidence** (baseline `777aae6f`; evidence classification: confirmed Pipeline Proxy fallback defects):

`ga4-metrics.tsx:2728–2847,3006,3041–3056` replaces successful current0/empty items with mapping100 and can display old warning-marked mapping100 after a first failed endpoint read without unavailable/last-good state. [GA4 exact cases](../../audits/v1-2026-10-19/GA4_OVERVIEW_VALUE_INVENTORY.md). Custom Integration785–805 and standalone Sheets1063–1092 also display old mapping100 after a failed endpoint read while dropping warning/freshness; their successful-zero controls correctly preserve0. [Independent cases](../../audits/v1-2026-10-19/SHEETS_CUSTOM_VALUE_PROPAGATION.md). Preserve current zero, verified mode/source/currency/freshness and explicit error state through proxy consumers.

**Implementation / validation:** See the [October 23 correction checkpoint](#correction-checkpoint-october-23), exact path matrix and hashed evidence above. Committed in `6f9db9b6` on `67279e8e`; locally verified forward correction only. See the [commit checkpoint](#commit-checkpoint-october-23). Deployed/provider, full lifecycle/downstream and historical-data acceptance remain OPEN.
