# Salesforce Pipeline Proxy display — October 28, 2026

## Root cause and path

Follow-up to the user asking whether Salesforce opportunity stages behave like HubSpot. The Salesforce Pipeline Proxy API already accepts one active source when both its source and mapping explicitly belong to the requested platform context. The Overview's `getPipelineSourceData` still required a GA4-name match for Salesforce; the prior unmapped-source display exception applied only to HubSpot.

Source path reviewed: configured Salesforce source and saved stage metadata → campaign-access-guarded `/api/salesforce/:campaignId/pipeline-proxy?platformContext=ga4` → `getRevenueSources(campaignId, context)` active/context boundary → exact source selection and validated current-stage cache → Overview query → provider source match → combined proxy → card/source modal. The stage remains an open-stage selection saved through the existing Salesforce flow. No new stage mapping, provider fetch, storage write or scheduler behavior was introduced.

The browser baseline reproduced both failures using the real GA4 page and synthetic HTTP boundaries: Salesforce alone displayed `Unavailable` for a valid EUR 7.25 response; with HubSpot EUR 12.75 also configured, the card incorrectly displayed only EUR 12.75 instead of EUR 20.00. Baseline: `validation-2026-10-27-report-incident/salesforce-proxy-before-oct28.json` (two selected failures; other cases intentionally filtered out).

## Localized correction

Only `client/src/pages/ga4-metrics.tsx` runtime code changes:

- Apply the existing sole-source display exception to whichever CRM provider is being resolved: HubSpot or Salesforce. Require the response's exact source ID, a single configured source of that provider and explicit GA4 source/mapping contexts. Existing name matches and multiple-source ambiguity handling remain unchanged.
- If one configured CRM provider has no usable selected source, withhold the combined total rather than silently dropping that provider.
- Retain currency, timestamp, warning, mode and item-sum checks; zero is valid. Pipeline values remain separate from confirmed Revenue, Spend and financial report totals. The rule is shared by all GA4 campaigns and contains no Promo-specific ID.

## Validation and limits

The new Salesforce route fixture executes the actual route and validation declaration, proving its already-correct cached amount and zero behavior, campaign/context isolation, inactive/disabled exclusion, ambiguity rejection and access/context guards without provider access. The rendered-page fixture covers Salesforce alone and both CRMs together, card/source modal, zero, wrong source ID, currency mismatch, absent timestamp, item-sum mismatch, request failure, recovery and disconnect; confirmed Revenue is checked throughout. Existing HubSpot and Salesforce stage/scheduler-selection tests run alongside these checks.

Final local packet: **112 passed, 0 failed, 0 skipped** across seven files, including 37 rendered-page browser cases and nine Salesforce route cases (`validation-2026-10-27-report-incident/salesforce-proxy-fixed-oct28.json`). TypeScript, client production build and server production build all pass (`salesforce-proxy-oct28-build-checks.json` in the same directory). Existing fixture artifacts were preserved. Only the Overview display correction changes runtime behavior; the other changes are regression tests and documentation.

This is a bounded selection/display correction. It does not certify provider write lifecycles, natural scheduler or OAuth behavior, live account data, arbitrary legacy multi-source configurations or the whole Overview. No production data was read or changed for this follow-up. The code remains local until separately committed, pushed and deployed; post-deployment UI confirmation remains outstanding.
