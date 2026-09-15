# GA4 Overview - Campaign Breakdown Certification - 2026-09-14

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY only for the GA4 Overview `Campaign Breakdown` subsection at deployed application revision `96552fa5757a9fdeeecc6bfc20c89941148c8bd6`.**

Required steps remaining for this exact subsection boundary: **0**.

This replaces the earlier certificate in this file. Later Campaign2 defects invalidated that older evidence and the subsection remained unproven until the fresh validation recorded here passed.

This decision does not certify Summary, Landing Pages, Conversion Events, Reports as a section, report scheduling or delivery, the parent Revenue & Financials section, the whole Overview tab, or any other campaign. Google Ads remains excluded.

## Certified contract

The table has exactly these columns, in this order:

1. Campaign
2. Sessions
3. Users
4. Conversions
5. Conv. Rate
6. Revenue

The certified data path is:

`saved GA4 property and campaign scope -> provider query and exact filtering -> traffic/financial row merge -> exact imported-revenue attribution -> campaign API -> rendered table -> browser PDF and server scheduled-PDF builder consumers`

The certified rules are:

- only exact normalized matches to the saved GA4 campaign values are returned; a campaign such as `yesop_retargeting` cannot match the saved value `yesop_retargeti`;
- GA4 page-location UTM matching uses a full regular-expression boundary ending at `&`, `#`, or the URL end, never substring matching;
- traffic uses the saved initial-import boundary through the latest completed day in the campaign reporting timezone;
- native row revenue uses campaign start through the same latest completed day;
- native row revenue must reconcile to the native GA4 Revenue total for that window or Campaign Breakdown fails closed;
- imported revenue is added only through exact saved campaign mappings;
- unmatched imported revenue remains outside the rows and is never proportionally allocated;
- displayed rows reconcile to Total Revenue only when all imported revenue is exactly mapped;
- Conv. Rate is `Conversions / Sessions * 100`, with zero sessions returning `0%`;
- row Users remain directional GA4 row values and are not forced to equal the separately grained Summary Users card;
- current row order remains Sessions descending;
- cached last-good table data remains visible during a refetch error; a first-load failure with no last-good response shows the unavailable state.

## Confirmed root causes and corrections

Three distinct Campaign Breakdown defects were confirmed rather than inferred:

1. The unavailable-table condition treated every active imported revenue source as if it had to be materialized for Campaign Breakdown. An unrelated or unmatched source could therefore suppress otherwise valid rows. The availability check was narrowed to sources participating in exact saved campaign mappings.
2. The shared GA4 UTM page-location filter used substring matching. The saved value `yesop_retargeti` could therefore also match `yesop_retargeting`. The filter now requires an exact UTM value boundary.
3. The protected native GA4 Revenue total used the exact UTM scope, while Campaign Breakdown row financials unconditionally used GA4 `campaignName`. On Campaign2 this produced `$6,411.30` native GA4 Revenue but only `$4,631.10` across the old rows. Campaign Breakdown now uses per-saved-campaign exact UTM financial queries when the combined exact UTM scope contains financial values. The existing exact `campaignName` compatibility fallback remains only for a combined exact UTM scope with no conversion or revenue values. Row totals must reconcile to the selected combined financial scope or the subsection fails closed with `GA4_OVERVIEW_CAMPAIGN_ATTRIBUTION_UNVERIFIED`.

The corrections preserve the existing response shape and do not allocate, rename, or approximate any value.

## Query, fallback, and isolation evidence

Focused code trace and regression evidence cover:

- explicit saved property and nonempty saved campaign scope before provider access;
- exact campaign filter construction and the negative prefix case `yesop_retargeti` versus `yesop_retargeting`;
- provider dimension candidates and the exact UTM fallback/rebuild path;
- separate traffic and native-revenue windows;
- provider pagination completeness, caller limits, aggregate totals, row merging, ordering, duplicate-normalized scope rejection, and empty responses;
- conversion/revenue metric fallback order and campaign-currency verification;
- fail-closed behavior for incomplete pagination, provider errors without last-good data, unverifiable row/native reconciliation, ambiguous mappings, materialization mismatch, and currency mismatch;
- exact campaign merge keys and rejection of unrelated rows;
- unauthenticated denial and cross-owner/campaign isolation;
- UI last-good behavior and reload, focus/reconnect, and ten-minute automatic refetch configuration.

The deployed happy-path provider response contained two rows, so multi-page, duplicate, empty, and provider-failure branches are established by focused regression tests rather than claimed as live production fault injections.

## Exact deployed Campaign2 reconciliation

The authenticated audit used:

- deployed application revision: `96552fa5757a9fdeeecc6bfc20c89941148c8bd6`
- campaign hash: `d9c8a3b7c4d0`
- client hash: `28653e2984ab`
- owner hash: `1900b95d7361`
- GA4 property: `542352127`
- saved GA4 campaign values: `yesop_retargeti`, `yesop_email_nurture`
- campaign currency: `USD`
- reporting timezone: `Europe/Amsterdam`
- traffic window: `2026-08-09` through `2026-09-14`
- native-revenue window: `2026-09-08` through `2026-09-14`

Exact row values:

| Campaign | Sessions | Users | Conversions | Conv. Rate | Native GA4 | Exact mapped imports | Displayed Revenue |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `yesop_retargeti` | 71 | 71 | 71 | 100% | $6,411.30 | $57,556.90 | $63,968.20 |
| `yesop_email_nurture` | 357 | 358 | 0 | 0% | $0.00 | $100.00 | $100.00 |
| **Rows total** | **428** | **429** | **71** | — | **$6,411.30** | **$57,656.90** | **$64,068.20** |

Revenue reconciliation:

| Value | Amount |
| --- | ---: |
| Native GA4 Revenue | $6,411.30 |
| Imported revenue total | $57,676.90 |
| Imported revenue exactly mapped to rows | $57,656.90 |
| Unmatched imported revenue outside rows | $20.00 |
| Displayed row revenue | $64,068.20 |
| Total Revenue | $64,088.20 |
| Total Revenue minus displayed rows | $20.00 |

The `$20.00` difference is the exact unmatched imported amount. The rows correctly do not claim reconciliation to Total Revenue while that amount remains unmapped.

## Consumer parity and refresh evidence

Authenticated deployed validation proved:

- the campaign API returned the exact property, windows, saved campaign rows, native revenue, and reconciliation above;
- the rendered UI had the exact six columns and values above;
- page reload, focus/visibility, and a ten-minute automatic interval each issued a fresh successful Campaign Breakdown request;
- the browser-generated Overview PDF contained every Campaign Breakdown row and matching values;
- a temporary GA4 Custom Report with only `Overview > Campaign Breakdown` selected created a manual snapshot and downloaded its PDF through the same production `buildGA4ScheduledPdfAttachment` path used by scheduled reports;
- that server-generated PDF contained the exact headers and both rows' Sessions, Users, Conversions, Conv. Rate, and Revenue values;
- the temporary report had scheduling disabled, created no send event, triggered no email, and was deleted with its snapshot;
- final report, snapshot, and send-event counts returned exactly to baseline, and the audited Revenue, Spend, GA4 daily, KPI, and Benchmark state hash was unchanged.

This proves Campaign Breakdown **value parity in the scheduled-PDF builder consumer**. It deliberately does not certify scheduler timing, dispatch, provider acceptance, email delivery, inbox receipt, snapshot immutability, or Reports as a section because those are outside the requested subsection.

## Validation gates

- focused Campaign Breakdown final rerun: **44/44 passed**
- wider adjacent regression packet at the runtime revision: **171/171 passed**
- current-version suite: **1,984 total; 1,943 passed; 41 explicitly deferred; 0 blocking current-version failures**
- TypeScript (`npm run check`): **passed**
- production build (`npm run build`): **passed**
- whitespace validation (`git diff --check`): **passed**
- authenticated deployed API/UI/browser-PDF audit: **passed for every asserted Campaign Breakdown gate before the separately executed server-PDF gate**
- authenticated deployed server scheduled-PDF builder parity: **passed**
- temporary production fixture cleanup: **exact; no report, snapshot, send-event, or protected analytics residue**

The 41 deferred tests are visible future/unconfigured platform boundaries. They include Google Ads and are not counted as passing evidence for this certificate.

## Files changed for this remediation and evidence

Runtime/focused regression changes already deployed across commits `e87bcbe0`, `6ee3078a`, and `96552fa5`:

- `client/src/pages/ga4-metrics.tsx`
- `server/analytics.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/ga4-filter.test.ts`
- `server/ga4-overview-campaign-breakdown-regression.test.ts`
- `server/ga4-overview-initial-import-window-regression.test.ts`

Final evidence and certificate:

- `scripts/ga4-overview-campaign-breakdown-scheduled-pdf-authorized-validation.ts`
- `GA4/OVERVIEW_CAMPAIGN_BREAKDOWN_CERTIFICATION_2026-09-14.md`

`APP_PRODUCTION_READINESS.md` was not modified.

## Protected behavior and explicit exclusions

The Campaign Breakdown row-attribution correction did not change Total Revenue arithmetic or imported-source producer/persistence behavior. The exact UTM matcher is shared by its existing GA4 UTM-scope callers and changed their filter semantics from substring to exact boundary matching, as required by the saved-scope contract. At the deployed Campaign2 boundary, native GA4 Revenue remained `$6,411.30`, imported Revenue remained `$57,676.90`, and Total Revenue remained `$64,088.20`.

No recertification is claimed for:

- Summary, Landing Pages, or Conversion Events;
- Reports as a section or any report lifecycle/delivery behavior;
- Revenue & Financials as a parent section;
- the whole GA4 Overview tab;
- Revenue, Spend, or Performance sections;
- HubSpot, Salesforce, Shopify, Google Sheets, or CSV source families;
- other clients, owners, campaigns, properties, currencies, or future data changes;
- Google Ads.

## Final decision

The GA4 Overview Campaign Breakdown subsection is clean-certified at deployed application revision `96552fa5757a9fdeeecc6bfc20c89941148c8bd6` for the exact saved-scope, query/filter, time-window, row merge, revenue mapping/reconciliation, failure, isolation, UI, browser-PDF, scheduled-PDF builder value-parity, and refresh boundaries documented above.

No broader certification is made.
