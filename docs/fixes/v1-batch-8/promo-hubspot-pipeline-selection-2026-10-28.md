# Promo HubSpot Pipeline Proxy selection — October 28, 2026

## Exact failure and evidence

User observed Expected Revenue `Unavailable` after adding HubSpot to Promo. The source's confirmed Revenue is correctly zero because the selected deal is in the open `Contract Sent` stage.

A campaign-scoped, repeatable-read, read-only production check at 09:59:28 UTC found active GA4 source `d0ee256b-578e-4aa9-9a29-4931e66973b4` under Promo `b74f98af-ede9-47af-9b19-0720ebb4d2c0`. Its saved selection is deal name `yesop_prospecting`, without GA4 campaign mappings. Saved proxy metadata is `current_stage`, EUR 3,200, one matching item of EUR 3,200, no warning, and last update 09:59:08 UTC. Promo's GA4 campaign names are `yesop_brand_search` and `yesop_retargeting`. Evidence: `audit-temp/promo-hubspot-pipeline-readonly-2026-10-28.json`; no credentials were selected or logged.

The value was saved successfully. `GET /api/hubspot/:campaignId/pipeline-proxy?platformContext=ga4` rejected it before examining the valid saved cache because selected CRM names did not match GA4 names. The Overview memo independently applied the same mistaken requirement to the endpoint's source ID. The source was explicitly attached to this app campaign; its CRM selection need not have the same name as a GA4 campaign.

## Localized correction

- `server/routes-oauth.ts`: retain explicit matching first; for an explicit GA4 request, accept the sole configured candidate only when its source and mapping both explicitly specify GA4. This follows the existing Salesforce unambiguous-source pattern. Multiple unmatched candidates still return 404. The existing campaign-access guard, active campaign/context storage query and cache validation remain in place.
- `client/src/pages/ga4-metrics.tsx`: accept the exact endpoint source ID for the same sole, explicitly GA4 HubSpot configuration. Preserve currency, timestamp, warning, current-stage, item totals and failure checks. Salesforce selection is unchanged.
- No provider refresh, save, delete, scheduler, financial calculation, report readiness or database write was changed. There is no damaged value to repair.

## Validation boundary

The new regression executes the real route body with synthetic storage/provider boundaries. Before the correction, positive EUR 3,200 and a valid current-stage zero both returned 404; nine neighboring cases passed. The real-page isolated browser fixture exercises an unmapped HubSpot source's card and source modal, zero, missing currency, recovery and disconnect while preserving confirmed Revenue. Local final results are recorded in the validation receipt files alongside this checkpoint.

- Final route/CRM/report packet: **230 passed, 0 failed, 0 skipped**, `validation-2026-10-27-report-incident/promo-hubspot-scope-final-oct28.json`.
- Rendered-page browser packet: **35 passed**, including the new unmapped-source case, in `promo-hubspot-scope-fixed-oct28.json`. That first combined packet had one pre-existing stale PDF assertion: it expected mapped revenue addition inside rendering, but the unchanged current PDF implementation adds it while constructing `adComparisonChartRows`. The assertion now checks both the existing addition and the rendered rows; the complete corrected file passes in the final packet. No report runtime was edited.
- TypeScript, client production build and server production build pass. The final GA4-only backend fallback guard was rechecked by the final route packet and TypeScript/server build (`promo-hubspot-scope-final-oct28-build-checks.json`); the unchanged client build is recorded in `promo-hubspot-scope-oct28-build-checks.json`.
- Report checks regenerated six existing tracked PDF fixtures; those generated outputs were restored to their pre-test contents. Tests used synthetic HTTP boundaries and no live provider credentials. No production data was changed.

This packet traces the saved source → scoped storage read → API selection/cache → frontend source match → card/source-modal render path. It does not certify all HubSpot add/edit/delete, provider stage transitions, natural scheduler behavior, arbitrary legacy multi-source configurations or the whole Overview. Production reads proved the current saved source; post-deployment UI behavior remains unverified until this correction is deployed.
