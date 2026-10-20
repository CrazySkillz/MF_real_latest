# Current Executive Summary values and distinct API contracts

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Thirteen exact-code boundary cases](executive-boundary-reproductions.json), [runner](executive-boundary-reproductions.cjs), cover aggregate/label/formatting, the current Executive API's GA4 branch and snapshot identity controls. This is a field-level current-code inventory with explicit remaining gates, not a complete browser/provider/report certificate.

## Current journey and input separation

`client/src/pages/executive-summary.tsx:31–80` requests campaign, `/executive-summary`, `/outcome-totals?dateRange=90days&captureExecutiveSnapshot=1&executiveFinancialScope=campaign_to_date`, and exact completed-date `/executive-summary/trajectory`. It polls the first two analytical reads every60seconds; trajectory refetches on mount/focus and date-key changes. The page blocks on initial load and shows Unable to Load when any required query fails. There is no current date selector, direct edit/delete or export action.

Opening this page can create/update a daily Executive snapshot through the outcome GET's `captureExecutiveSnapshot=1`. `routes-oauth.ts:15902–15926` requires refreshed persisted GA4 rows, constructs source/config identities and uses the existing guarded storage upsert; failure is caught and logged. Internal scheduled calls return503 if the requested snapshot was not written. A successful ordinary HTTP read alone does not prove snapshot capture succeeded. This side effect belongs in read/refresh/concurrency inventory.

The current funnel and monetary summary read **outcome totals**, while KPI/Benchmark eligible rows and freshness warnings come from **the separate Executive API**. The page does not blindly display that API's health score, grade, scaling projections, source tables or CEO sentence. `riskInputRows` is constructed but not rendered. The page's current Recommended Actions are its own target-backed Website Outcomes action. These distinctions limit the impact claims below.

## Active value inventory

| Active value | Source, formula, state and current path |
|---|---|
| Completed-day/window description |157–167: aggregate-v3/window and connected GA4 capabilities; valid start<=end produces Through YYYY-MM-DD, otherwise Current view. Current page request is cumulative even though query dateRange says90days. |
| Trajectory/status/detail |278–309,524–544: authoritative GA4 uses exact-date trajectory endpoint; accelerating/stable/declining plus source-specific explanation. Missing Revenue history and incompatible history are distinct; fallback legacy aggregate trajectory only when authoritative GA4 window absent. |
| Risk level/explanation |417–471,546–557: high if negative available ROI or high freshness warning; otherwise medium if any risk factor, else low. Low explicitly qualifies unavailable ROI/ROAS. Risk factors: paid concentration,sufficiently declining trajectory,ROI/ROAS below break-even,KPI below,Benchmark behind and stale-source warnings. These are policy indicators, not a probability estimate. |
| Concentration factor |440–450: connected paid sources with relevant capabilities; largest source Spend divided by paid Spend;>70% or exactly one source triggers risk. Uses maximum share rather than response order. This differs from retained API helper behavior described in the prior diagnostic record. |
| Trend risk factor |437–452: trajectory must be declining and revenue change<-15%; merely no history does not fabricate a decline. Snapshot classification itself uses strict±10% bounds. |
| Executive summary bullets |472–477,563–575: available ROI percent/ROAS ratio, risk level,7day trajectory or explicit unavailable/history message. No health-grade or generated investment projection is rendered here. |
| Funnel top stage |255–268,593–615: first available impressions,else users,else sessions; exact field label/source caption and appropriate question. CTR is compatible clicks/impressions×100 when aggregate supplies it. Users retain intended daily-sum grain; cross-consumer explanation gap inherits V1-096. |
| Funnel middle stage |263–269,623–664: first available clicks,else sessions,else users; source caption; engagement percent when available; CVR numeric value from aggregate. V1-099 incorrect denominator label below. |
| Funnel Conversions |688–694: aggregate conversions displayed via integer formatter; V1-101 truncates valid fractional values. Source availability remains separate. |
| Revenue, Spend |696–714: source-aware available aggregate money, validated campaign currency and2decimals; unavailable stays text. Native/imported authority and dates are upstream gates. |
| ROAS, ROI |717–739: aggregate Revenue/Spend ratio and100×(Revenue−Spend)/Spend,2decimals. ROI color distinguishes unavailable and negative; when Revenue exists but Spend does not, page explicitly explains that ROI/ROAS need Spend. |
| KPI availability/exception summary |370–374,400–402,757–787: finite current and positive target eligibility from server list; zero evaluable rows shows Status Unavailable; nonempty all-on-track list shows No KPI Exceptions among evaluated rows. Server list-load failure versus empty inventory is not preserved as a separate response state (remaining gate). |
| KPI exception name/current/target/status/progress |345–368,789–831: shared lower-is-better/tolerance policy, band, attainment and clamped fill; format by metric/currency/unit; count-like fractional values affected by V1-101. Only below-band rows shown. |
| Benchmark availability/exception summary |375–403,833–862: recomputes shared threshold policy from finite current/positive benchmark; both needs_attention and behind are visible exceptions; only behind raises Benchmark risk, while needs_attention is Monitor. |
| Benchmark row/name/category/current/target/delta |865–902: metric label,category,Yours/Benchmark,shared effective higher/lower-is-better delta, one decimal percent badge/status colors. Currency/ratio/rate/count formatter matches KPI path. |
| Freshness warning/source/message |421–436,912–931: deduplicated severity/source/message,high first. With authoritative GA4, only Google Analytics warnings explicitly marked stale survive; other source warnings retained. Complete warning-generation coverage still requires source-specific validation. |
| Recommended Action/title/evidence/next step |195–253,404–416,934–972: web-source evidence plus a Revenue/Conversion/CVR target exception yields one Website Outcomes investigation action. Evidence lists available Users/Sessions/Conversions/Revenue/CVR; target checks deduplicate/sort; next step describes investigation, not promised revenue improvement. No qualifying evidence yields No Evidence-Backed Actions Available. |
| Currency/number states |13–25,168–194,496–507: missing/invalid currency returns Unavailable; EUR control uses EUR. Numeric available metadata is trusted; coercion can map malformed/null-like payloads to0, so the upstream finite/value contract remains required. Do not infer whole-path input validation from these formatters. |

## Server target and snapshot safeguards

`routes-oauth.ts:33143–33253` selects platform GA4 KPI/Benchmarks when GA4 is connected. `resolveAlertCurrentValueForDecision` is invoked with saved Overview, credential refresh disabled and current traffic freshness required. Ineligible/nonfinite/no-target values are skipped. The page does not substitute aggregate totals for these returned target values. Current storage/query failures are caught into empty lists; the original configured target count and fetch-failure state do not propagate. Those failure/partial-inventory combinations remain unverified for whole-section certification.

`executive-summary-daily-snapshot.ts` binds version,campaign,currency,property,filter,import start,time zone,exact7day separation and sorted source/config signature. Source fingerprint excludes volatile refreshed totals/times but changes on mapped column changes. Executed controls prove unchanged refresh metadata retains identity, changed mapping/currency rejects comparison, compatible120 versus100 gives20%/accelerating, and0 baseline yields Revenue history unavailable. These controls support the reusable contract; they do not prove live schedule capture or backup/restart behavior.

Trajectory route32064–32096 rejects a requested date other than latest completed campaign day. Native-only financial fallback is permitted only when no active imported Revenue sources exist; it separately validates snapshot shape/window and native-only source arrays. Full property/filter compatibility through reconnect and historical fallback, persisted source migration and natural schedule remain explicit gates; no inference from this helper alone.

## V1-099 — funnel CVR label selects a denominator by click availability

**P1; current aggregate and page expression reproduced.** `executive-summary.tsx:269` chooses Click-Through CVR whenever clicks are available; rendered653–656 uses that label with aggregate `cvr`. The aggregate deliberately gives GA4 web conversions/sessions precedence. Mixed fixture: GA4 sessions100/conversions10 plus paid clicks20 gives correct session-based CVR10%, but the current label says click-through. The label's implied calculation would be10/20=50%, which is not this metric. GA4-only and paid-only controls show expected labels/denominators. Trace the aggregate metric's source/definition, not a separate click-availability flag, when fixing the existing render path. A second configured main source remains in scope until safely excluded.

## V1-100 — Executive API's GA4 branch uses a different scope and loses values

**P1; exact current handler branch reproduced; current funnel impact is bounded.** At `routes-oauth.ts:32909–32952`, the first connected property is selected, ignoring `isPrimary`. `storage.getGA4Connections:916–921` orders by connection time, so that can be an older nonprimary property. For the API's default `period=all` (32795–32817), the provider call nevertheless uses30daysAgo. After a successful provider call, native Revenue is set to0 and persisted daily Revenue is skipped; provider pageviews are initialized then daily pageviews are added unconditionally.

The fixture supplies oldest nonprimary and selected-primary connections, provider50pageviews/Revenue300, and overlapping stored10pageviews/Revenue300. Successful call dispatches old-property/30daysAgo, produces60pageviews and Revenue0. Provider-failure control uses the stored10pageviews/Revenue300. This is an input-source contract defect, not an allegation that the current funnel shows0 Revenue: that funnel reads outcome totals separately. The Executive API returns its aggregate/metrics/platforms and is called by current Executive Summary and Reports (`reports.tsx:392–396`), with retained download code at1034. Exact final consumption for each report configuration remains a gate; no blanket PDF impact claim.

Required correction after batch agreement: preserve the selected-property/window/native-financial contracts in the existing route, prevent overlapping pageview addition and test both success/fallback. Do not delete this route as legacy without tracing all callers and persisted report dependencies.

## V1-101 — valid fractional conversions are truncated again at presentation

**P1; current formatters reproduced independently of provider ingestion.** `executive-summary.tsx:185–186,496–505` uses `Math.trunc` for aggregate count fields and target current/target count metrics. A verified numeric0.75 conversion is displayed0 in both headline and KPI formatting; integer3 remains3. These formatters also feed recommendation evidence. This is a second loss boundary beyond GA4 ingestion V1-079, so repairing provider parsing alone cannot fix the display.

Preserve real fractional conversion precision and distinguish count identities that are truly integers. Validate target/progress text, recommendation evidence and report parity from raw fractional provider totals through saved publication. This packet starts at a preserved aggregate and does not claim the existing daily integer schema currently stores0.75 successfully.

## Remaining gates

Current page values are inventoried; exact-source provider reconciliation, every retained/demo/API alternative, stale/partial target inventories, reload/configuration/delete concurrency, natural snapshot schedule and generated Executive PDF remain partial/unverified. Full screenshot/browser tests are not claimed by helper/AST execution. Runtime behavior remains unchanged; findings join the practical fix queue and do not authorize deployment or production cleanup.
