# Revenue Sources midnight status correction

## Reported behavior and scope

During the disposable **Batch 1 Provider Check** journey, Shopify imported one
`campaign3_eur_test` order for EUR 785.95. The source initially waited for Total
Revenue. Later the card showed EUR 32,099.32, but all three imported sources
displayed `Saved — waiting for Total Revenue to update.`

This incident reopens the source-status display boundary; the earlier bounded
initial-import checks do not certify this transition. Google Sheets acceptance
is paused while this correction is validated. The redundant Shopify revenue
definition screen remains a separate deferred UX item.

## Confirmed cause and persisted evidence

The [enforced read-only observation](validation-2026-10-31/revenue-publication-2026-10-30T23-14-20-812Z.json)
checks only campaign `36631f9f-5f32-4ae6-8d20-d8430abb364c`, with its exact owner
hash and named disposable client verified before reading. It confirms:

- Shopify's normalized order date is **2026-09-28**, amount **EUR 785.95**.
- The completed October 29 financial snapshot contains **EUR 32,099.32**:
  native GA4 **EUR 31,313.37** plus Shopify **EUR 785.95**. HubSpot and Salesforce
  confirmed revenue are both zero; Pipeline Proxy remains separate.
- All three current source input hashes exactly match that snapshot's receipt.
- The snapshot's work item completed on its first attempt, with no recorded
  error. Due-to-completion was approximately 78 seconds. This initial pending
  interval is the existing guarded publication path, not rejection of the order
  because the source was newly connected.

The source endpoint computes its completed-day boundary from the current
campaign-local date. After Amsterdam midnight this became October 30, while the
last published snapshot remained October 29. Both
`storage.getGA4RevenuePublicationStatus` and the page's `getPublicationStatus`
required receipt date equality with the new boundary. They marked unchanged,
already included sources pending solely because the calendar advanced.

## Exact path and smallest correction

`ShopifyRevenueWizard` saves the selected tag through the existing owned
`/api/campaigns/:id/shopify/save-mappings` route. Its existing atomic storage
replacement writes the source, normalized order and durable publication work.
`recomputeCampaignDerivedValues` starts existing owned recovery asynchronously.
The pipeline verifies saved inputs, recomputes dependent values, writes the
financial snapshot with a source-hash receipt, and finishes its work lease.

The card reads `/financial-daily-snapshot` through the stored native date.
`/revenue-sources` reads normalized source totals and publication status. The
page joins definitions to the breakdown and independently requires the displayed
card's receipt to match before clearing a source's pending message.

Only the two erroneous comparisons change:

- **server/storage.ts:** require the receipt date to equal its own saved snapshot
  date and be no later than the requested completed-day boundary. Current source
  input hashes, pending future rows and completed-work checks still apply.
- **client/src/pages/ga4-metrics.tsx:** require the displayed snapshot's receipt
  date to match that snapshot and be no later than the source boundary. Its
  source hash must still match the successful API result.

No amounts, date eligibility, source mapping, import/edit/delete behavior,
provider request, schema, output field, refresh interval, queue, scheduler,
report/KPI/Benchmark calculation, or persisted customer record is changed.
Newly eligible sales and changed sources remain pending until publication;
failed/incomplete work remains failed/pending. The fix does not turn yesterday's
native GA4 snapshot into a new-day publication or certify report readiness.

## Validation

The [before-fix regression run](validation-2026-10-31/midnight-before.json)
reproduces four failures in the unmodified runtime: two real PostgreSQL cases
and two actual-page browser cases. Both browser branches show three false
pending messages after the boundary advances while the card is unchanged.
The mismatched receipt-date rejection already passes.

The [full affected local packet](validation-2026-10-31/midnight-fixed.json)
passes **297 tests, zero failures, zero skips**: source publication against real
local PostgreSQL, actual-page revenue/source/pipeline flows, financial snapshot
writing, saved GA4 input reuse and browser publication refresh. This includes
unchanged sources across midnight, newly eligible sales remaining pending,
receipt-date disagreement, stale card hashes, completed/failed work and no new
idle polling. Disposable test schemas are removed by the suite, and the local
PostgreSQL instance started for this check was stopped afterward.

The [selected report download regression](validation-2026-10-31/midnight-report.json)
also passes (one selected test; eleven unrelated tests excluded by name).
[TypeScript and both production builds](validation-2026-10-31/midnight-build-checks.json)
pass, and the GA4 KPI certification metadata check passes. The test-generated
PDF is restored to its original tracked version; it is not part of this change.

Tests use disposable local schemas, synthetic browser requests and blocked
external networking. No personal browser or authenticated provider account is
operated by the agent.

## Deployment and saved-data verification

Runtime commit `f00ed5dc9ebe24d357d876533db28ac38c106375` was pushed to the
existing `main` branch. Render's public health endpoint reports this exact
commit as healthy, and its compiled GA4 page matches the tested local build
after normalizing asset hashes and the public Clerk key. The exact-commit
[GitHub run 41144399245](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41144399245)
passed certification, the full current-version suite and the retained deferred
regression suite. The [final publication receipt](validation-2026-10-31/publication-2026-10-30T23-36-33-046Z.json)
records those successful steps, healthy exact runtime commit and matching
compiled GA4 page at 23:36 UTC on October 30 (October 31 in Amsterdam).

The [post-deployment read-only comparison](validation-2026-10-31/postdeploy-data-check.json)
confirms the exact observed campaign metadata, source definitions, normalized
records, financial snapshots, refresh-work rows and native Overview totals
are unchanged from the pre-deployment observation. Total Revenue remains
EUR 32,099.32 and all three source hashes still match its completed receipt.
This is a scoped comparison of whitelisted fields, not a global data audit.

The user has been asked to reload the existing test-campaign page once and
confirm the amount and absence of false waiting messages. No live browser
result is assumed while that response is outstanding.

Remaining limits: the initial asynchronous completion duration is retained,
not optimized or promised to be instantaneous. Full provider lifecycles,
natural scheduled publication, downstream report acceptance and the remaining
Batch 1 release gates remain open.
