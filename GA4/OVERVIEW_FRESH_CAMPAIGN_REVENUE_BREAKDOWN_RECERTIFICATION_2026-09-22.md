# GA4 Overview Fresh-Campaign Revenue and Campaign Breakdown Recertification — 2026-09-22

## Decision

**HISTORICAL RUNTIME EVIDENCE for the exact Campaign3 values documented below at deployed runtime `dda53f441aab938700f808eb6a5d2aedd035f9e6`. The boundary decision in this record is superseded by the current V1 contract.**

Current boundary rule: native GA4 Revenue always uses the saved GA4 initial-import date through the latest completed reporting day. Campaign metadata dates and app creation time are never substituted. Imported Revenue uses all available mapped records.

This record preserves the observed GA4 Overview results for a newly created campaign with a saved GA4 initial-import date:

- native GA4 `Total Revenue` from API through the rendered Overview card and Revenue Sources modal;
- saved GA4 campaign mappings through the Campaign Breakdown API and rendered table;
- Campaign Breakdown reload, focus/visibility refresh, and ten-minute automatic refetch.

It does not independently certify the current boundary implementation; current behavior is controlled by `GA4/FINANCIAL_SOURCES.md` and the implementation aligned in `43c980da`.

## Confirmed root cause and correction

Campaign creation correctly persisted the GA4 initial-import date and selected GA4 campaign values. A former native-revenue branch used app metadata instead of that saved import boundary, which could return no revenue and prevent the expected Campaign Breakdown result from appearing.

The current correction always uses the saved GA4 initial-import date as the native-revenue start. It preserves:

- the established simulated-property behavior;
- existing response shapes, formulas, currency behavior, mappings, ownership guards, and certified imported-source behavior.

If the saved GA4 initial-import date is unavailable, the financial path fails closed rather than substituting campaign metadata or app creation time.

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

The focused regressions recorded here covered the then-current branches, simulated behavior, reporting-day cutoff, downstream KPI real-path parity, and Campaign Breakdown. They are historical evidence only for the current boundary rule.

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

The recorded native Revenue and Campaign Breakdown API/UI/refresh values passed at deployed runtime `dda53f441aab938700f808eb6a5d2aedd035f9e6` for the exact configuration and limits above. The current V1 boundary is the saved GA4 initial-import date through the latest completed reporting day and is not certified by this older runtime record.
