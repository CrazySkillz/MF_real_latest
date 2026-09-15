# GA4 Overview - Landing Pages Certification - 2026-09-15

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY only for the GA4 Overview `Landing Pages` empty-state, provenance-invariant, access-isolation, refresh, failure-state, and consumer-mapping boundary documented below. The runtime implementation was introduced at revision `2a6815738e67bf6fa4709b65761cfe946ae29545` and validated at exact deployed evidence revision `48564329b40d88bb0afeeac54d212dadb1191bd0`.**

Required steps remaining for this exact certified boundary: **0**.

The authenticated production provider returned zero valid session-scoped Landing Pages rows. Therefore **populated-row production accuracy is not certified**. A future extension of this certificate requires a suitable real production fixture containing valid `landingPagePlusQueryString` rows and a fresh revision-locked reconciliation.

This decision does not certify Summary, Conversion Events, Reports as a section, Revenue & Financials, Revenue, Spend, Performance, Campaign Breakdown, the whole Overview tab, or any other source or campaign. Google Ads remains excluded.

## Certified visible contract

The Landing Pages table has exactly these columns, in this order:

1. Landing page
2. Source/Medium
3. Sessions
4. Users
5. Conversions
6. Conv. rate

No Revenue column is displayed in the UI, browser PDF, or scheduled-PDF builder.

The certified data path is:

`saved active GA4 property and campaign scope -> GA4 provider requests -> pagination/filter/fallback guards -> campaign-access-guarded API -> rendered Landing Pages table -> browser PDF mapping and scheduled-PDF builder mapping`

## Certified provenance and calculation rules

- Only GA4 rows whose primary dimension is session-scoped `landingPagePlusQueryString`, accompanied by `sessionSource` and `sessionMedium`, can create Landing Pages rows.
- Blank and `(not set)` landing-page values do not create rows.
- Ordinary `pageLocation` rows never create or replace Landing Pages traffic rows and are never relabelled as landing pages.
- A conversion-prioritized `pageLocation + sessionSource + sessionMedium` query may supplement Conversions only on an existing valid session-scoped row.
- Supplementation requires an exact, case-sensitive `Landing page + Source/Medium` key match, including the landing-page query string.
- Supplemental rows cannot change Sessions, Users, Revenue, or row identity and cannot append new rows.
- Campaign-level conversions and imported revenue are never allocated into Landing Pages rows.
- The visible conversion rate is `Conversions / Sessions * 100`; zero Sessions safely produces `0.0%`.
- Fractional GA4 conversion credit is preserved through API parsing and both PDF mappings.
- Row Users remain directional GA4 breakdown values. They can overlap and are not forced to equal Summary Users.
- Primary rows are ordered by Sessions descending with deterministic dimension tie-breakers.

Google's [GA4 Data API schema](https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema) describes `landingPagePlusQueryString` as the first pageview's page path and query string and separately documents `pageLocation`. The provider [`runReport` contract](https://developers.google.com/analytics/devguides/reporting/data/v1/rest/v1beta/properties/runReport) supplies `limit`, `offset`, and `rowCount`, which are used by the completeness guards.

## Saved scope, time boundary, pagination, and isolation

The traced and regression-covered request boundary enforces:

- campaign access before connection or analytics access;
- the active GA4 connection for the requested campaign and exact saved property;
- the saved GA4 campaign filter using exact case-insensitive provider string matching;
- the fixed connection `importStartDate` through the latest completed day in the campaign reporting timezone;
- no rolling display window and no substitution of campaign creation/start date for the Landing Pages import boundary;
- a bounded top-50 primary provider response, with the UI and both PDF consumers using the same first 20 rows;
- deterministic ordering and fail-closed validation when the provider's bounded page is incomplete;
- complete supplemental pagination using `rowCount` and `offset`, with fail-closed guards for missing or changing row counts, empty intermediate pages, overflow, and a 100,000-row safety maximum;
- duplicate primary `Landing page + Source/Medium` keys rejected rather than silently merged;
- unauthenticated, cross-owner/campaign, and wrong-property requests denied;
- query-cache identity including campaign, import-to-date boundary, and selected property, preventing previous data from crossing campaign/property scope.

## Empty, unavailable, failure, and refresh behavior

The exact production fixture returned zero valid session-scoped rows. The deployed validation proved:

- the API returned an empty row array with session-scoped attribution marked unavailable;
- the rendered table showed the correct session-scoped empty-state explanation and rendered no fabricated rows;
- no ordinary page-location traffic was exposed as Landing Pages data;
- initial loading remains distinct from a successful empty response;
- an initial provider failure without last-good data renders unavailable;
- a focus/refetch failure retains last-good data when it exists and displays the stale/unavailable warning;
- page reload issues a fresh successful Landing Pages request;
- focus/visibility issues a fresh Landing Pages request;
- reconnect and ten-minute interval refetch behavior is configured for the same query;
- the browser-PDF preflight accepts valid last-good Landing Pages data but fails closed when Landing Pages is genuinely unavailable.

Provider/authentication failures propagate instead of being converted into fabricated empty or partial rows. Revision-locked validation requests use `readOnly=1`; authentication expiry fails with `TOKEN_EXPIRED` before OAuth refresh or credential persistence can occur.

## Consumer evidence

| Consumer | Evidence and certified limitation |
| --- | --- |
| Campaign API | Exact saved property, campaign, fixed window, read-only response headers, attribution metadata, and empty response were authenticated and reconciled in production. Per-row validity, uniqueness, and ordering guards are regression-covered but received no live rows to evaluate. |
| Rendered UI | Correct empty-state copy, zero fabricated rows, reload, focus/refetch, last-good warning behavior, and isolation were exercised in production. The exact six-column populated-table mapping is covered by focused regression evidence and was not rendered by this zero-row production fixture. |
| Browser PDF | A Landing-Pages-only custom browser PDF was generated and parsed in production; it contained no Revenue column or section. Because the provider returned zero rows, populated browser-PDF value parity is not claimed. |
| Scheduled-PDF builder | The actual builder was executed locally with a controlled session-scoped fixture, including fractional conversions, exact six columns, exact row values, top-20 behavior, safe conversion rate, and no Revenue output. It was not executed against a real populated production fixture. |

This consumer evidence does not certify report creation persistence, report scheduling, scheduler timing, email dispatch, provider acceptance, delivery, inbox receipt, report snapshots, or Reports as a section.

## Exact deployed reconciliation

The authenticated read-only audit used:

- deployed evidence revision: `48564329b40d88bb0afeeac54d212dadb1191bd0`
- runtime implementation revision: `2a6815738e67bf6fa4709b65761cfe946ae29545`
- campaign hash: `fc734ddaf728`
- client hash: `613d89abb175`
- owner hash: `1900b95d7361`
- property hash: `a3d79a4ad228`
- GA4 property: `542352127`
- reporting timezone: `Europe/Amsterdam`
- fixed window: `2026-07-02` through `2026-09-14`
- completed days in window: `75`
- valid provider rows: `0`
- populated-row accuracy proven: `false`
- correct empty state proven: `true`

The audit also proved:

- deployed SHA matched the mandatory full expected SHA;
- unauthenticated access was denied;
- cross-owner/campaign access was denied;
- a different property was denied;
- API and rendered request rows matched exactly;
- reload refetch passed;
- focus/refetch plus cached last-good behavior passed;
- browser PDF generation passed for the empty production result;
- no non-GET application API requests occurred;
- the database audit transaction was read only and rolled back;
- campaign, GA4 connection, daily metrics, GA4 report, snapshot, and send-event fingerprints were unchanged.

The temporary authentication session was revoked after the run.

## Confirmed root causes and corrections

The following root causes were confirmed before editing:

1. The current provider path correctly used `landingPagePlusQueryString`, but an earlier safety correction had removed unsafe page-location traffic fallback and also removed the permitted exact conversion supplementation. The remaining unused mapper stripped query strings, inferred Source/Medium from UTM values, and copied Revenue. It was replaced with a conversion-only, exact-key supplement that cannot create rows.
2. Provider ordering used only Sessions and the conversion supplement had no complete pagination path. Deterministic dimension tie-breakers, row-count validation, full supplemental pagination, and fail-closed incomplete-page guards were added.
3. The frontend disabled focus refresh, had no interval refresh, could retain previous data without verifying campaign/property scope, and disabled the Landing Pages query during validation-read-only mode. The existing query now refetches on focus, reconnect, and a ten-minute interval while keeping placeholder data only for the exact same scope.
4. Browser and scheduled PDFs used 15 rows while the UI used 20, and their shared integer formatter could round fractional conversions. Both Landing Pages PDF mappings now use the same first 20 rows and preserve provider numeric values.
5. Browser-PDF preflight treated any refetch error as total unavailability even when valid last-good Landing Pages data remained. It now distinguishes last-good data from genuine unavailability.
6. The Landing Pages route lacked a strict read-only validation mode and could refresh and persist OAuth credentials. The revision-locked audit mode now fails before token refresh and exposes explicit no-refresh response headers.
7. The GA4 Overview documentation still described ordinary `pageLocation` traffic fallback for Landing Pages. The Landing Pages wording now matches the session-scoped-only implementation without changing Conversion Events documentation or behavior.
8. The first production audit used an invalid synthetic focus probe: TanStack Query listens for `visibilitychange` on `window`, while the harness dispatched a non-bubbling event on `document`. Evidence revision `48564329b40d88bb0afeeac54d212dadb1191bd0` corrects only the audit event target and adds a focused guard; application runtime logic is unchanged from `2a6815738e67bf6fa4709b65761cfe946ae29545`.

## Validation gates

- focused Landing Pages packet: **46/46 passed**
- adjacent GA4 Overview and PDF packet: **170/170 passed**
- current-version suite: **1,996 total; 1,955 passed; 41 explicitly deferred; 0 blocking current-version failures**
- TypeScript (`npm run check`): **passed**
- production build (`npm run build`): **passed; 3,471 modules transformed**
- whitespace validation (`git diff --check`): **passed**
- exact deployed health/SHA check: **passed**
- authenticated revision-locked read-only API/UI/browser-PDF reconciliation: **passed**
- production application persistence fingerprint: **unchanged**
- populated real-provider row reconciliation: **not run because the provider returned zero valid rows; explicitly excluded from this certificate**

The 41 deferred tests remain visible future/unconfigured platform boundaries, including Google Ads. They are not used as passing evidence for this certificate.

## Files changed for this remediation and evidence

Runtime, documentation, and focused tests introduced at `2a6815738e67bf6fa4709b65761cfe946ae29545`:

- `GA4/OVERVIEW.md`
- `client/src/pages/ga4-metrics.tsx`
- `server/analytics.ts`
- `server/routes-oauth.ts`
- `server/ga4-scheduled-report-pdf.ts`
- `server/ga4-filter.test.ts`
- `server/ga4-overview-landing-pages-regression.test.ts`
- `server/ga4-overview-landing-pages-scheduled-pdf.test.ts`
- `scripts/ga4-overview-landing-pages-live-readonly.ts`

Evidence-harness correction at `48564329b40d88bb0afeeac54d212dadb1191bd0`:

- `scripts/ga4-overview-landing-pages-live-readonly.ts`
- `server/ga4-overview-landing-pages-regression.test.ts`

Final certificate:

- `GA4/OVERVIEW_LANDING_PAGES_CERTIFICATION_2026-09-15.md`

`APP_PRODUCTION_READINESS.md` was not modified.

## Protected behavior and explicit exclusions

No final diff changes the certified logic, contracts, tests, or certificates for Revenue, Spend, Performance, Campaign Breakdown, HubSpot, Salesforce, Shopify, Google Sheets, or CSV. Shared-file changes are confined to Landing Pages functions, route blocks, query/render blocks, PDF mapping blocks, and Landing Pages regression cases.

No certification is claimed for:

- populated-row production accuracy;
- Summary or Conversion Events;
- Revenue & Financials, Revenue, Spend, Performance, or Campaign Breakdown;
- Reports as a section or report lifecycle, scheduling, delivery, or snapshots;
- the whole GA4 Overview tab;
- HubSpot, Salesforce, Shopify, Google Sheets, CSV, or any other source family;
- other clients, owners, campaigns, properties, time windows, or future data/code revisions;
- Google Ads.

## Final decision

The GA4 Overview Landing Pages subsection is clean-certified for the exact empty-state, source-provenance guards, saved property/campaign/window scoping, pagination/failure behavior, access isolation, refresh behavior, and consumer mapping documented above at deployed evidence revision `48564329b40d88bb0afeeac54d212dadb1191bd0`.

Because the production provider returned zero valid session-scoped Landing Pages rows, this certificate deliberately makes no populated-row accuracy claim. No broader certification is made.
