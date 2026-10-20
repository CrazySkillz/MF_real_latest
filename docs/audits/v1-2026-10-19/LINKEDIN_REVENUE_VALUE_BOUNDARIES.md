# LinkedIn revenue, modes and attribution boundaries

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Eleven exact cases](linkedin-revenue-boundary-reproductions.json), [runner](linkedin-revenue-boundary-reproductions.cjs), extending [paid-provider review](PAID_MEDIA_TRACE.md). The complete actual `server/utils/linkedin-revenue.ts` is executed with fixture storage and a fixed2026-10-19 clock. Ads-route declarations/maps are separately extracted. No real connection, source, provider, database or email was changed.

## Value and consumer trace

| Value/input | Current boundary | Evidence status |
|---|---|---|
| Native traffic/Spend/session metrics | Session route31847/32345 sums provider metrics then shared LinkedIn math computes CTR/CPC/CPM/CVR/CPA/CPL/ER | Code-read formulas; complete provider grains, duplication, rate/zero flags and precision remain unverified. Existing V1-047/049/082 apply. |
| Imported Revenue | Utility76 reads1900-through-today, LinkedIn context, sums via storage; reports30-completed-UTC-day start/end separately | Fixed-clock case proves query1900-01-01→2026-10-19 versus returned2026-09-19→2026-10-18. Caller32564 comment claims same-window import, contradicting implementation. Extends V1-104; period Spend/session/ads and all-history Revenue cannot be presumed aligned. |
| Connection/session conversionValue | Source presence/mode, positive-amount precedence, connection before session before derived values | V1-115/116 below; successful positive actual Revenue123.45 ignores legacy50 and preserves amount without rounded-CV drift; explicit configured CV50×10 control validly returns500. |
| Shopify per-order fallback | Source mapping lastConversionValue or amount/count, then connection mapping, then assume1 | V1-118; missing count does not justify a per-order amount. The fixture retains actual Revenue1000 while derivedCV becomes1000; not a claim Total Revenue was multiplied in that case. |
| Conversion webhooks | Utility216–232 fetches campaign events in last30 complete UTC days, sums value; positive total outranks all other Revenue | Same-campaign USD100 purchase+EUR200 lead sums300. Currency/type have no guard. Schema751 stores both, storage5782 filters only campaign/dates in memory. This extends V1-001/106's downstream impact; no mixed real events or cross-tenant occurrence asserted. |
| ROI/ROAS/profit/margin/Revenue per lead | Session route32387–32428 uses resolved revenue and session Spend/conversions/leads | Proven helper output propagates into exact formulas by code trace; invalid/missing denominators return0 in several branches. Full UI/report state and positive/negative bounds remain unverified. |
| Campaign rows and estimated Revenue | Page122–141 allocates by conversions, campaign render5323–5411 uses CRM exact value where available and otherwise displays **Est.** | Positive distinction: current campaign row already marks estimated Revenue. Ads UI and PDF separately use `revenueIsEstimated`; do not report all allocations as undisclosed. |
| Ads Revenue | Route32575–32622 apportions cents by conversion share, derives ROI/ROAS and `_computed.revenueIsEstimated` | V1-117: webhook-origin amount loses the estimate flag despite no ad identity join. Page7533/7652–7679 and browser PDF3186/3249 condition estimate text on this flag. |

Current page session query921 polls every5seconds; its response change invalidates KPI and Benchmark queries945–969. The server revenue utility is called by session32381, imported metrics31974, Ads32567, benchmark evaluation29229 and another resolver699. Thus side effects/fallbacks are exercised by reads, not only an explicit source edit. Complete read-only validation behavior and all report/scheduler caller parity remain required.

## V1-115: failed reads trigger destructive self-heal

The utility catches Revenue failure to0 and source-list failure to[]. It subsequently reads connection CV50, interprets no active source/no positive Revenue as proof that CV is stale, and calls `updateLinkedInConnection(campaignId,{conversionValue:null})`. The complete function fixture reproduces exactly one such write while both evidence reads failed. Failures may be transient or path-specific; the observed fixture does not assert a production outage caused a real deletion. A source/status read must not erase configuration based on unavailable evidence. Source absence needs a successful, exact scoped query and concurrency-safe confirmation before any separately approved repair.

## V1-116: zero and legacy mode precedence

`shouldIgnoreStoredConversionValue:117` requires importedRevenueToDate>0. An active CSV actual-revenue source with measured0 therefore fails to disable a legacy connectionCV50 and returns500 for10conversions. A conditional−10 response does the same. With no legacy CV, configured measured0 instead becomes `hasRevenueTracking:false`. Source-free legacy sessionCV50 can still return500 even after the utility clears connectionCV. That latter case proves a damaged legacy-state recovery gap, not every current source-delete route's outcome. Exact source-delete/reconnect writers and persisted damage inventory remain required.

Successful positive amount and explicitly selected conversion-value controls pass; fixes must preserve both supported modes and separate authoritative zero from missing/failed input. Do not resolve the defect by globally disabling conversion values or inventing zero source results.

## V1-117: actual campaign amount is not actual ad attribution

Fixture campaign webhook amount300 and Ads conversions1/3 yield75/225 through the current allocation declarations. The context labels source `webhook_events`; route32575 maps every positive non-derived conversion value to `explicit`. `revenueIsEstimated` is false for both rows. No supplied event identifies either ad, and the code does not join event metadata to Ads. A real aggregate amount may remain authoritative, while sub-entity allocations need accurate provenance/estimate labelling and independent attribution acceptance. Existing conversion-value allocation UI controls do not cover this flag path.

## Remaining gates

Full LinkedIn page/value inventory beyond the listed finance/current-value boundaries, session/import selection and stale errors, all provider permissions/pages/URN keys/quotas, explicit source add/edit/delete/reconnect recovery, zero/refund/currency/window consistency through every current-value/history/notification/report consumer, natural refresh/delivery and legacy damage detection. No LinkedIn certificate or effective exclusion is implied. The retired API version V1-082 independently blocks live-provider acceptance.
