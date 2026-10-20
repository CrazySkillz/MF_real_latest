# Shared service-account customer boundary

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. Current code reviewed on 2026-10-20. [Fifteen isolated exact-handler cases](service-account-tenant-reproductions.json), [runner](service-account-tenant-reproductions.cjs). No real credential, provider, customer resource or database was used.

## V1-123: a globally permitted provider resource is not bound to its customer

The three current service-account connection paths authorize the destination campaign, then use an application-wide provider credential. They do not establish that the signed-in customer is entitled to the selected provider resource.

| Path | Actual checks and resulting access |
|---|---|
| `server/routes-oauth.ts:16111–16178`, GA4 service-account connect | Exact campaign owner, 30-day lookback, property present in the global environment allowlist, provider acceptance using the shared service account, no conflicting OAuth connection. Then creates/updates the connection and makes it primary. `server/utils/ga4-service-account.ts:40–75` has a property-ID set, no owner/client-to-property grant. |
| `server/routes-oauth.ts:16607–16685`, Sheets service-account connect | Exact campaign owner, syntactically valid file ID, shared credential configured, no conflicting OAuth connection, provider metadata success. Returns the spreadsheet name and tabs and creates a pending connection. `server/utils/google-sheets-service-account.ts:24–43` has no resource/customer allowlist. Knowing a spreadsheet ID is not a customer authorization check. |
| `server/routes-oauth.ts:26687–26773`, Google Ads service-account connect | Exact campaign owner, customer in the global allowlist, account ID/currency/timezone compatibility and no conflicting connection/source. Reads account/daily facts using the shared credential and persists them for that destination campaign. `server/utils/google-ads-service-account.ts:41–85` has a customer-ID set, no application owner/client grant. |

The actual campaign-access helpers and provider-resource validators execute in the fixtures. For each family, tenant A and unrelated tenant B independently own their destination campaigns; both can attach the same synthetic resource. Sheets returns tenant A's synthetic private resource name/tab to B. Ads stores one synthetic daily row for B. GA4 saves B's connection to the same property. Anonymous, foreign-campaign and provider-permission-denied controls reject without writes. Rate limiters, credential issuance, storage and provider responses are fixtures; no claim is made that live data was accessed by a second user.

This is not a bypass of the existing campaign-owner guard. It is the separate missing provider-resource/customer boundary. Provider authorization proves that the shared service account can access a resource; it does not prove that the signed-in customer may use it.

Severity: **P0 / confirmed isolated authorization gap**, conditional on shared service-account configuration and access by unrelated customers. The business goal includes customer-owned real data and multiple tenants. A private single-operator pilot would be a different supported scope and would require an enforced account-admission boundary; no such live restriction is established here.

## Current reachability, propagation and required acceptance

`client/src/components/IntegratedGA4Auth.tsx` defaults to service-account connection mode; this is not merely a dormant maintenance helper. Ptomo's separately observed connection also uses `service_account`, but that observation does not prove another tenant accessed Ptomo or establish the deployment's complete admission/configuration policy.

Hydration repeats the same global allowlist for GA4/Ads and no resource grant for Sheets. Subsequent native reads and financial imports operate under the saved destination campaign and can therefore feed its UI, goals, diagnostics, snapshots, alerts and reports. The local fixtures prove connection/metadata/Ads materialization boundaries, not all downstream publication.

Before V1:

1. Establish an exact owner/client-to-provider-resource permission boundary for any retained shared service-account path, or effectively restrict those temporary paths and use the customer's own OAuth grant. Preserve current route/storage architecture; this audit does not implement either choice.
2. Cover owner A's resource requested from owner B's valid campaign, same-owner different-client grants, revoked grants, changed resource selection, direct select/update routes, saved credential hydration, refresh jobs and reconnect/restart.
3. Fail before provider dispatch and persistence when customer permission is absent. Retain existing anonymous/foreign-campaign/provider-permission/currency/timezone controls.
4. Verify production account admission and source grants independently. Inventory existing affected connection provenance read-only before any targeted cleanup. Do not delete or rewrite Ptomo or redundant campaigns.

This finding belongs first in the authorization batch. Deferring LinkedIn, Instagram, Meta and TikTok does not remove it.
