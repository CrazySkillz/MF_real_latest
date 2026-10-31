# Provider reload and shared-resource permission acceptance

October 31, 2026. **V1-123 is CLOSED within its original shared-credential
customer-boundary scope. Batch 1: 16 CLOSED / 4 OPEN.** All twenty original
corrections are implemented. V1-008, V1-054, V1-078 and V1-088 retain their
documented outstanding acceptance. This is not whole-app release certification.

## Live provider reload and renewal

The user ran the [checked manual procedure](validation-2026-10-31-remaining/manual-provider-reload.js)
in the second account against Batch 1 Provider Check. The [supplied result](validation-2026-10-31-remaining/user-provider-reload.json)
records two successful metadata reads for each of GA4, Sheets, HubSpot,
Salesforce and Shopify, from 15:48:43 to 15:49:05 UTC. These endpoints may renew
credentials normally; they do not perform imports or change mappings/schedules.

The initial checker incorrectly required `success:true` from the Sheets list
endpoint, which returns `{spreadsheets}`. The [failed checker receipt](validation-2026-10-31-remaining/user-provider-reload-checker-failure.json)
is retained. Only that diagnostic assertion was corrected; no app change was
needed. [Nine safety cases](validation-2026-10-31-remaining/provider-reload-safety.json)
cover the corrected response contract and stop conditions.

Independent read-only receipts [before](validation-2026-10-31-remaining/provider-publication-2026-10-31T15-42-19-933Z.json)
and [after](validation-2026-10-31-remaining/provider-publication-2026-10-31T15-49-53-808Z.json)
retain the same five active encrypted connection identities with no plaintext
credential fields. GA4, HubSpot and Salesforce expiry advances coincide with
their successful requests; the route paths obtain credentials through their
normal refresh/exchange logic. This supplies actual successful renewal evidence
without capturing or printing tokens. Sheets' earlier natural expiry advancement
is retained from the credential-publication packet; this packet confirms its
subsequent usable connection. Shopify reads succeed, but its renewal is not
inferred from an absent `expires_at` column.

The selected source-value metadata, scheduled work metadata and publication
timestamps compare identically before/after. This is not a full JSON/hash
comparison of every mapping, snapshot payload or another campaign. Reconnect,
provider-global revocation and full analytics lifecycle certification remain
separate. No new polling or schedule change was introduced.

## V1-123: exact boundary and evidence

The original defect allowed an owner to attach another customer's resource
using the app's shared Google service account. The existing correction checks
exact campaign/client ownership and owner/client/provider/resource grants before
shared token use. No runtime code changed for this acceptance packet.

Evidence is combined, not represented as a single end-to-end provider test:

- Prior real GA4/Sheets customer consent/imports and the reviewed Promo shared
  grant's scheduled continuity remain valid; do not repeat them.
- [Twenty-one checks](validation-2026-10-31-remaining/grant-production-2026-10-31T15-45-50-358Z.json)
  executed the current release's actual storage policy and three hydration
  functions against the production PostgreSQL grant table, using new temporary
  scopes inside a transaction that was rolled back. Exact grant acceptance,
  wrong-owner/resource denial, revocation before cached/new token use and a new
  policy instance all pass. Allowlists and token issuance were synthetic; this
  was not a live worker or provider execution. Other connections never saw the
  rows. No existing grant was edited, no provider was contacted, and zero rows
  were committed. The local rehearsal also proves rollback after injected failure.
- The [user's deployed HTTP result](validation-2026-10-31-remaining/user-resource-denial.json)
  confirms GA4 and Sheets reject otherwise available resources for a new client
  without a grant. The actual second-account session and existing resources were
  used. No shared provider authorization was revoked. Google Ads functional
  acceptance remains postponed; its exact route/policy/hydration controls are
  covered by the existing tests and new transaction checks, not a claimed live
  Ads connection.
- [Sixteen preparation checks](validation-2026-10-31-remaining/grant-browser-rehearsal.json)
  cover wrong origin/account/target, failure/timeout/quota stop, unexpected
  callback success and exact cleanup guards.

### Worker and storage propagation trace

At released `5f0ffe96`, `storage.getGA4Connections`, `getGA4Connection` and
`getPrimaryGA4Connection` hydrate through the same permission check. The daily
scheduler's discovery and provider-storage reads use those methods; a rejected
lookup records a failure and skips the campaign. Existing current-suite startup
failure coverage preserves the prior publication and allows the next campaign.

Sheets getters hydrate through `hydrateGoogleSheetsConnectionForRead`. On a
service-account denial it returns the same metadata with access/refresh/client
credentials cleared. Revenue/spend reprocessing then has no usable credentials;
the token scheduler skips missing tokens. It cannot fall back to a shared token.
The `resolveRuntimeCredentials:false` call sites are saved-data/identity reads,
not provider calls: GA4 creation/activation guards and Sheets cached alert-value
verification. They do not obtain new provider access.

The Google Ads shared connect route persists a dedicated GA4 spend connection.
`getGA4GoogleAdsSpendConnection` invokes its grant-checked hydrator; the dedicated
spend scheduler uses that getter before provider access and after refresh. The
ordinary Google Ads OAuth getter is a separate path, not the shared connect
route's destination. Current provider helpers perform the grant check before
their cached service-account token helper. Revocation prevents the next
hydration; it does not cancel an already executing provider request or erase
previously imported analytics.

This closes the original connect/credential-hydration tenant boundary using
deployed denials, real database policy/revocation checks, traced current callers
and existing worker failure regressions. A real production worker was not made
to fail by revoking a protected customer's grant. No whole-scheduler readiness
claim is made.

## Fresh valid-state session denials and cleanup

The same user-operated packet generated fresh signed states for GA4, Sheets,
HubSpot, LinkedIn and Meta without opening provider windows. Each callback was
then requested with `credentials:omit` and a synthetic non-provider code. All
five rejected the missing session: Google error popups returned 200 with the
expected error and no success event; the other three returned 401. States,
URLs, cookies and tokens were not printed. This narrows V1-078's remaining gate
to replay/provider acceptance; it does not prove consumed authorization-code
replay rejection. Stateless signed states are not a single-use state store.

The exact fixture run was `aff80984-46a4-4216-8668-5c69c75e51b7`: one zero-value
draft and its new client. All campaign/client dependent tables were checked
before deletion. [Dry cleanup](validation-2026-10-31-remaining/grant-browser-dry-cleanup-2026-10-31T16-02-44-221Z.json),
[two-row commit](validation-2026-10-31-remaining/grant-browser-cleanup-2026-10-31T16-03-38-795Z.json)
and [fresh READ ONLY absence verification](validation-2026-10-31-remaining/grant-browser-verify-2026-10-31T16-04-46-600Z.json)
all pass. No connection or source had been attached. Promo, V1 Batch 5 Test,
Batch 1 Provider Check and their existing grants were outside the deletion scope.

## Remaining acceptance

- V1-008: independent saved-key recovery, shared with Batch 8 V1-016; custody and
  local database restore are already recorded. No paid database is authorized.
- V1-054: positive deployed legacy Meta edit unavailable because both legacy
  tables are absent. Retained handler/storage tests pass; do not create obsolete
  tables to manufacture acceptance.
- V1-078: valid authorization-code replay acceptance; the fresh-state anonymous
  checks above must not be repeated or described as code-replay proof.
- V1-088: reconnect and the remaining provider-specific renewal/restart evidence.
  Do not repeat completed first imports or the ten successful reload reads.
  A Shopify reconnect may rotate a token shared across campaigns; disposable
  app-campaign scope alone is not proof that reconnecting a shared store is safe.

Existing hosted/current-version runtime validation remains 6,959 passing tests
for `5f0ffe96`. This packet changes audit procedures and evidence only; it does
not require another runtime deployment or full-suite rerun.
