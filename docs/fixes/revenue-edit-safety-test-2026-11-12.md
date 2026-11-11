# Revenue edit safety — test release

Scope: three confirmed edit issues in the deployed GA4 Overview flow. No calculation, schema, provider selection, report formula, schedule or live campaign data changes.

## Root causes and corrections

1. HubSpot/Salesforce editors omitted the original source mapping from save requests. The server/storage already supported a conditional mapping update, but normal UI edits did not use it. The parent now passes the exact serialized source mapping separately from the editable/normalized form. GA4 edit saves send it; routes reject a changed source with HTTP409 before provider access. Existing storage conditions also reject changes occurring during provider processing. Missing edit snapshots from the new UI are rejected by existing request validation. Creates, non-GA4 callers and existing scheduler payloads retain their contracts.
2. Shopify preview requests had no response-order or navigation guard. A late response could replace a newer amount or clear a newer failure. A request sequence and effect cleanup now ignore obsolete successes, errors and loading updates. Update also requires a completed valid preview.
3. Shopify's confirmation message hardcoded `$`. It now formats the amount using the save response's currency, with a non-numeric confirmation when that currency is absent. No amount or rounding calculation changed.

## Traced paths

- `ga4-metrics.tsx` source pencil -> `AddRevenueWizardModal.tsx` existing source/config -> CRM wizard -> existing `save-mappings` route -> existing atomic storage replacement -> durable financial publication and existing UI refetch.
- HubSpot/Salesforce scheduled refresh continues sending its saved mapping and source identity; ownership and transaction guards are unchanged.
- Shopify source edit -> Review -> preview-only API -> latest preview state -> existing save API -> currency confirmation. The preview still performs no financial save.
- No repair or cleanup of existing records is requested or performed. No persisted wrong totals were demonstrated by these three findings.

## Validation

- New actual-route prefix tests: stale/fresh mappings, scheduler payload compatibility, authorization, foreign/missing/wrong-type/wrong-platform source, create/legacy compatibility and missing snapshot rejection.
- Actual CRM save functions: original serialized mapping sent with stable source ID and updated selection; failed save does not call success.
- Actual parent/HubSpot browser flow: original pipeline-enabled snapshot remains unchanged while the submitted edit disables Pipeline Proxy.
- Actual Shopify browser: out-of-order successes, obsolete errors, newer preview failure, disabled saving, exact source/selection, EUR/USD/GBP confirmations. All provider HTTP uses isolated fixtures.
- Related existing CRM/Shopify transaction, browser and scheduler regression suites: 142 checks passed locally, no failures/skips.
- Required full release checks and deployed revision verification are recorded in the release receipt after completion; this document alone is not deployment evidence.

## Limits

The test app's real HubSpot/Salesforce connection setup remains outside this change as previously deferred. Browser proofs use actual components and isolated provider responses, not a signed-in hosted CRM save. This release does not certify all Revenue/Spend provider lifecycle paths. Original live code and figures remain unchanged by this test-only release.

## UI validation

On a connected test campaign, open Sources -> pencil. Open the same CRM source in two tabs. Save a selection in the first; saving the older editor must show a settings-changed message without replacing the first save. Close/reopen the older editor before editing again. In Shopify, change selections while returning through Review; only the latest preview may enable Update, and its confirmation must use the source currency. Use test records only.
