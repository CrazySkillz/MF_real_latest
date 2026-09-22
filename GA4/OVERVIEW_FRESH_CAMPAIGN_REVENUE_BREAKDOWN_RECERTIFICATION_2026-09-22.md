# GA4 Overview Fresh-Campaign Revenue and Campaign Breakdown Recertification — 2026-09-22

## Decision

**CLEAN-CERTIFIED / PRODUCTION_READY for the exact fresh-campaign portability boundary documented below at deployed runtime `dda53f441aab938700f808eb6a5d2aedd035f9e6`.**

Required steps remaining within this exact boundary: **0**.

This supplemental decision recertifies only the affected GA4 Overview paths for a newly created campaign that has a saved GA4 initial-import date but no explicit campaign start date:

- native GA4 `Total Revenue` from API through the rendered Overview card and Revenue Sources modal;
- saved GA4 campaign mappings through the Campaign Breakdown API and rendered table;
- Campaign Breakdown reload, focus/visibility refresh, and ten-minute automatic refetch.

It preserves, and does not broaden or replace, the existing Revenue source-family certificates or the existing Campaign Breakdown certificate.

## Confirmed root cause and correction

Campaign creation correctly persisted the GA4 initial-import date and selected GA4 campaign values. The affected native-revenue path nevertheless fell back to the campaign creation timestamp when the optional campaign start date was absent. A newly created campaign therefore queried native revenue from its creation date instead of its saved GA4 import boundary, which could return no revenue and prevent the expected Campaign Breakdown result from appearing.

The correction uses the saved GA4 initial-import date as the native-revenue start only when no explicit campaign start date exists. It preserves:

- explicit campaign start-date precedence;
- the established simulated-property behavior;
- the legacy connection fallback when neither saved date is available;
- existing response shapes, formulas, currency behavior, mappings, ownership guards, and certified imported-source behavior.

## Exact deployed evidence

The production health endpoint reported the exact deployed runtime `dda53f441aab938700f808eb6a5d2aedd035f9e6`.

The authenticated, read-only validation used:

- campaign hash: `6caf32c94dbe`;
- client hash: `28653e2984ab`;
- owner hash: `1900b95d7361`;
- GA4 property: `542352127`;
- campaign currency: `EUR`;
- native window: `2026-08-23` through `2026-09-21`;
- saved campaign values: `yesop_brand_search`, `yesop_paid_social`.

### Revenue result

- native GA4 revenue: `€35,533.83`;
- active imported revenue: `€0.00`;
- rendered Total Revenue: `€35,533.83`;
- rendered source count: `1`;
- Revenue Sources modal parity: passed;
- Pipeline Proxy: correctly rendered `Not configured` because no CRM pipeline source is configured;
- unauthenticated and cross-owner access: denied;
- source/database integrity checks: no orphan, duplicate-key, cross-campaign, count, total, or currency mismatch.

### Campaign Breakdown result

| Campaign | Sessions | Users | Conversions | Conv. Rate | Revenue |
| --- | ---: | ---: | ---: | ---: | ---: |
| `yesop_brand_search` | 1,370 | 1,367 | 137 | 10% | `€35,533.83` |
| `yesop_paid_social` | 762 | 762 | 0 | 0% | `€0.00` |

The API and rendered UI matched. The exact saved campaign mappings were present, native row revenue reconciled to `€35,533.83`, and no imported revenue required allocation. Page reload, focus/visibility refresh, and the ten-minute automatic interval each returned HTTP `200`.

The user separately confirmed that the corrected Revenue and Campaign Breakdown values were visible in the deployed UI.

## Local validation

- focused affected and adjacent regression packet: **143/143 passed**;
- TypeScript validation: **passed**;
- production build: **passed**;
- deployed Revenue API/UI/modal audit: **passed**;
- deployed Campaign Breakdown API/UI/refresh audit: **passed**;
- validation transactions: read-only and rolled back.

The focused regressions cover the new-campaign no-start-date path, explicit start-date precedence, simulated behavior, reporting-day cutoff, downstream KPI real-path parity, and the existing Campaign Breakdown initial-import contract.

## Preserved certifications and exclusions

No certification claim is added for:

- Campaign3 imported revenue sources, because none are configured;
- Pipeline Proxy behavior, because no HubSpot or Salesforce pipeline source is configured;
- Campaign3 browser PDF or scheduled-PDF parity;
- Reports, scheduling, provider delivery, or email receipt;
- Summary, Spend, Performance, Landing Pages, Conversion Events, or the whole Overview tab;
- other campaigns, properties, currencies, owners, clients, configurations, or future runtimes;
- Google Ads or other unconfigured platforms;
- global scheduler health or whole-application production readiness.

The existing Campaign Breakdown certificate retains its separate Campaign2 browser-PDF and scheduled-PDF evidence. Those consumers were not changed by the runtime correction, but they were deliberately not claimed as newly exercised for Campaign3.

The repository-wide test suite is not represented as globally green; unrelated unconfigured-platform and stale certification-manifest failures remain outside this bounded decision.

## Final decision

The repaired fresh-campaign native Revenue and Campaign Breakdown API/UI/refresh paths are clean-certified at deployed runtime `dda53f441aab938700f808eb6a5d2aedd035f9e6` for the exact configuration and limits above. Existing certified sections and source contracts remain unchanged.
