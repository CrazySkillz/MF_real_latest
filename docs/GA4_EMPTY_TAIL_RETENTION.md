# GA4 annual refresh: mixed-scope property retention

## Confirmed failure

On 23 November 2026, the live read-only diagnostic for Colombian_Coffee_365
identified `getDistinctUsersWithToken` inside Overview campaign breakdown.
Both the native-period traffic request and the daily Users request covered
20 November 2025 through 23 November 2026. Their filter combined native
`sessionCampaignName` through 20 November with exact campaign URL matching
after that date. GA4 returned sampling plus property truncation at
23 September 2026. The existing empty-tail recovery accepted sampling alone,
so this restriction stopped publication and retained the prior saved data.

## Localized correction

The same recovery also admits property retention, alone or with sampling,
only when every retention boundary is valid and no later than the first
fallback date. It still requires an independent, unrestricted exact-campaign
`eventCount` query proving the entire fallback tail empty. It discards the
restricted response and obtains a fresh native campaign report, preserving
the original history start. It does not shorten annual history to the
retention cutoff, sum daily users, invent rates, or accept restricted data.

Thresholding, other restrictions, unknown or invalid boundaries, a boundary
inside the fallback tail, nonzero or restricted proof, and restricted
replacement reports still fail closed. Original publication dates, comparison
windows, fields, calculations, and campaign filters are preserved.

Only the existing recovery guard in `server/analytics.ts` changes at runtime.
Schedulers, startup behavior, configuration, storage, and publication code do
not change. No persisted data cleanup is needed: failed publication retained
the last successful snapshot.

## Validation boundary

The new retention tests reproduce the actual rejected query shape and metadata;
successful replacement values are explicitly synthetic. They check retained
pre-retention history, non-additive users, native session rates, rolling
windows, strict rejection cases, and unrestricted annual/30-day behavior.
The recorded comparison replay also checks combined retention in later
comparisons without changing its previously recorded exact result.

Local tests do not prove a successful live refresh. Read-only real-provider
verification, deployment, and a successfully completed scheduled publication
must be recorded separately before the hosted incident is considered resolved.
