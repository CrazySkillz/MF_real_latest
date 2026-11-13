# GA4 campaign-loading timeout: test release

## Scope and failure

Campaign discovery previously required both completed campaign-dimension reports and a full supplemental page-URL scan inside one 120-second deadline. A slow supplemental scan rejected the whole response, even after primary campaign results were available. A synthetic reproduction against the exact prior live analytics source confirmed this boundary. This does not identify Google's underlying latency cause or certify the tester's earlier service-email attempt.

## Localized correction

- Only callers explicitly sending a property ID and `allowPartial=1` opt into recovery. Both GA4 onboarding pickers send this flag and display a clear warning when additional campaigns could not be checked.
- A fully collected, nonempty campaign list permits a supplemental URL scan limited to 10 seconds, still respecting the shared deadline. Supplemental timeout/transient errors return only the completed campaign results and `discoveryComplete: false`.
- Incomplete supplemental pages are discarded rather than merged as trustworthy counts. Primary pagination, source scope, date windows, authentication, permission, data-quality and explicit-selection guards remain intact.
- Empty primary results still require the existing URL fallback. Primary failures, forbidden access, malformed/incomplete responses and caller cancellation remain errors. Other endpoint consumers remain strict by default.
- Diagnostic context includes campaign/property identifiers and the failed phase, never credentials.

Runtime files: `server/analytics.ts`, `server/routes-oauth.ts`, `client/src/pages/campaigns.tsx`, `client/src/components/GA4ConnectionFlow.tsx`. No metric calculations, imports, database schema, refresh jobs or saved campaign data change.

## Validation and boundary

Focused synthetic tests cover the 10-second deadline, expiration of the shared budget, transient failures, rejection of incomplete primary pages, caller cancellation, authentication/permission failures, quality flags, complete and empty results, URL-only discovery, strict legacy callers, API ownership, opt-in scoping and both onboarding consumers. Browser verification covers visible warnings, explicit selection, retry and exact saved campaign names, plus the unchanged service-account flow.

Release checks and hosted test verification are recorded separately in `audit-temp/ga4-discovery-release/`. No tester credentials or GA4 property requests are used. Live deployment and a real retry against the tester's property remain outside this test-only release.
