# Campaign currency edit and native daily history

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. V1-087, P1. [Three cases](campaign-currency-reproductions.json) and [runner](campaign-currency-reproductions.cjs) execute current route/storage-write/response/formatting code with isolated storage and actor fixtures. No live campaign was edited.

## Confirmed boundary

1. Campaigns -> Edit exposes Currency (`client/src/pages/campaigns.tsx:2136–2141`). The update mutation415–433 sends currency and invalidates campaign queries. This is a current UI path, not merely a retained API.
2. `PATCH /api/campaigns/:id`, `routes-oauth.ts:9137–9231`, checks the existing campaign owner and strips client-supplied `ownerId`. Its `ga4DailyScopeChanged:9167–9172` tests campaign-filter and timezone changes, but omits currency.
3. A currency-only update therefore calls `storage.updateCampaign:698–708`, not `updateCampaignWithGA4DailyInvalidation:711–721`. Ordinary input-change bookkeeping1256–1277 invalidates work ownership/completion notes, but retains daily rows and Overview rows. The explicit invalidation method deletes the campaign's daily/Overview rows. A work-marker invalidation is not a monetary-history invalidation.
4. `ga4_daily_metrics`, schema151–167, stores revenue without currency. The real read-only daily response at routes9536–9606 reads campaign/property/date rows and returns the old revenue without a currency identity/check. It does not require matching saved Overview currency before returning these daily values.
5. GA4 Insights accepts daily success/property identity (`ga4-metrics.tsx:1969–1987`), preserves daily revenue2100–2125, permits the Revenue trend9509, and renders its chart when history exists9530. Money formatting1502–1515/9634–9638 uses the **current** campaign currency. The chart guard is not the separate financial-publication guard.

The fixture changes an active campaign from USD to EUR. The route succeeds through the ordinary update, retains a native revenue100 row, and the daily response succeeds without currency identity. The actual client formatter displays `€100.00`. No conversion or fresh EUR native publication occurred. Filter-change and timezone-change controls instead select the explicit daily invalidation path.

## Impact and boundaries

This proves a lifecycle/propagation defect: old monetary history can be relabelled during the interval before a successful refresh after a supported currency edit. A query refetch cannot repair it because the underlying daily response still returns the retained numbers. If refresh fails, elapsed time alone cannot establish recovery.

The saved Overview/report financial checks can reject a publication whose currency no longer matches. Their protection is not generalized to the daily Insights chart. No claim is made here that every financial card, KPI, Benchmark, alert or scheduled report incorrectly accepts the old currency; each consumer's state remains separate. Browser report generation has additional input gates and was not executed in this currency scenario. Complete source-currency migration policy and existing affected-record inventory remain required.

Acceptance: agree and enforce currency-edit semantics within the existing campaign/source/publication flow; preserve exact source currency, block mislabelled monetary reads, and recompute only from verified provider/file inputs. Cover successful refresh, provider failure, restart, retained history, all consumers and other-campaign isolation. Do not invent exchange rates or silently rewrite existing monetary records.

The fixture uses the actual shared campaign schema, route, ordinary storage write callback, final daily response block and client formatter. Owner lookup, transaction ownership wrapper, freshness decoration and the control deletion method are fixtures; the current deletion statements719–720 were separately inspected. Full React rendering and live provider conversion were not exercised. The first harness run omitted `parseGA4CampaignFilter`; binding the actual helper corrected that harness error. All three final cases pass, independently of the182 unresolved full-suite failures.
