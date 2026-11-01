# Production identity cutover preparation

Scope: existing launch gate 1 / V1-013 only. No new audit or functional expansion.
This packet is preparation, not approval or evidence of a completed migration.

## Current state

- The user created the Clerk production instance for `app.mimosaas.app`, selected
  Primary application, and approved the five exact Clerk DNS records. Clerk shows
  Verified and SSL Issued. Public CNAME lookups matched the requested targets.
- The user attached `app.mimosaas.app` to the existing Render service using the
  DNS-only CNAME to `marketforensics.onrender.com`. Render shows Verified. The
  user confirmed the sign-in page loads at the HTTPS app address.
- The website at `www.mimosaas.app` is separate and must be preserved.
- On November 1, the user confirmed creating the ordinary production account at
  `https://accounts.mimosaas.app/sign-up`, following instructions to use the email
  of Promo's original account. The original login method is email/password.
- The user supplied the original account's production ID:
  `user_3LTouyBkb8CfKyfoAk2L4nw7QKN`, after opening the newly created account in
  Clerk. Its intended predecessor is `user_3K7q6o5pF0aykjIQSHy5O7mVi2U`.
  The user also supplied `user_3LTqgGDCOcbqrzLRaynqvRWRtMl` for the separate second
  production login. Its predecessor, read from the exact protected test campaign
  and checked against the earlier SHA-256 receipt, is
  `user_39kDsb8uIT6shhq2vixKnqplwy6`. Preserve its separate `Batch 1 Validation`
  workspace rather than merging it into Promo.
- Render's Clerk keys, application code and database ownership remain unchanged.

## Read-only ownership boundary

[Reader](validation-2026-11-01-clerk-cutover/read-owner-scope.cjs) uses the existing
database target fingerprint, verified TLS, session-default read-only mode and an
explicit repeatable-read READ ONLY transaction. It imports no application code,
fetches no credential values, calls no providers and rolls back the transaction.

[First inventory](validation-2026-11-01-clerk-cutover/owner-scope-2026-10-31T23-03-05-757Z.json)
was observed at November 1 00:03 Europe/Amsterdam (October 31 23:03 UTC):

- Original owner: two clients (`ABN`, `Tracker`), two active campaigns (`Promo`,
  `V1 Batch 5 Test`), four campaign-creation request references and one database
  service-account resource grant. These nine scalar owner references are the
  candidate application scope, not yet an executable migration.
- `Batch 1 Validation` and `Batch 1 Provider Check` belong to the separate second
  owner. None of the 34 unparented historical campaigns belongs to Promo's owner.
- Ownerless generic metrics, integrations and performance rows stay unassigned.
- Two `mimosaas_website_connections.owner_id` references also match the original
  owner. This table has no application implementation/schema here and is excluded;
  changing the app login does not authorize changing the external website.
- Persisted refresh-work scopes contain the original owner. The first receipt
  groups pending work without distinguishing invalidated history; it does not
  establish which pending jobs remain runnable. The reader now distinguishes
  that flag for the next necessary preflight.
- No production ID was supplied for the first read. Its zero destination counts
  are not collision evidence; the reader now emits null when no ID is supplied.

[Destination preflight](validation-2026-11-01-clerk-cutover/owner-scope-2026-10-31T23-08-54-336Z.json)
at November 1 00:08 Europe/Amsterdam binds the user-supplied production ID by
SHA-256 and finds zero existing references to it in the inventoried scalar
identity columns. The original application scope is unchanged. Every pending
work row for the two original campaigns is already invalidated; no running or
non-invalidated unfinished work was observed. Completed and invalidated work
can remain historical. A later write must recheck that condition under the same
campaign locks and abort if new unfinished work appears, rather than silently
stranding it. This read does not independently authenticate the production user;
the account creation and ID are user-confirmed dashboard evidence.

## Traced dependencies and next boundary

`server/routes-oauth.ts` obtains the actor from Clerk and requires exact equality
with campaign `ownerId`; client lists in `server/storage.ts` filter by owner.
The service-account resource check requires matching owner/client/provider/resource
in an environment grant or the database grant. Preserve the exact permission.

`readGA4RefreshWorkScope`, work claim/publication and recovery compare the owner
inside the saved scope to the current campaign owner. Updating only the campaign
owner can strand old pending work. The current preflight finds no such runnable
work. Recheck that exact condition under the existing campaign locks before any
migration; do not rewrite historical completed work or trigger extra imports.
Token encryption uses its configured encryption key, not the Clerk owner ID;
this cutover must preserve that key and the existing encrypted provider tokens.

Both mappings are now bound in the read-only plan and the transfer/rollback has
been rehearsed locally as recorded below. Next: align the enabled provider callback
URLs/origins and inspect the live URL/resource-grant configuration before switching
matching frontend/backend keys and applying the bounded ownership transaction.
No live migration has been executed. Production sign-in, migrated ownership and
affected callback acceptance remain OPEN. The planner enforces a READ ONLY
database session; the operator runner below defaults to read-only checking and
requires an explicit mode, reviewed packet digest and deployed-instance proof
before invoking the tested transfer.

The current route trace identifies these callback paths for the new application
origin; existing provider entries must be retained until cutover succeeds:

- GA4 and Google Sheets: `https://app.mimosaas.app/api/auth/google-sheets/callback`.
- HubSpot: `https://app.mimosaas.app/api/auth/hubspot/callback`.
- Salesforce: `https://app.mimosaas.app/api/auth/salesforce/callback`.
- Shopify: `https://app.mimosaas.app/api/auth/shopify/callback`.

The routes use `APP_BASE_URL` before `RENDER_EXTERNAL_URL`; Shopify also has an
explicit `SHOPIFY_REDIRECT_URI` override. Adding the domain alone does not update
these live environment settings or the providers' private redirect allowlists.
Their current live values remain unverified; configure them as one bounded
cutover prerequisite without repeating unchanged import or calculation tests.

## Two-account preparation and isolated rehearsal

The [two-account plan](validation-2026-11-01-clerk-cutover/ownership-plan-2026-10-31T23-23-51-586Z.json)
was captured November 1 at 00:23 Europe/Amsterdam. Its SHA-256 is
`71375dadd0af0a34307473a22fa712ea20473bc16e34683f1999c5f8fe905c83`.
It contains identifiers and hashes only, no provider credentials. Both production
IDs have zero existing application identity references. Exact transfer scope:

- original account: Tracker and ABN clients; Promo and V1 Batch 5 Test campaigns;
  four campaign-creation requests; one existing GA4 service-account resource grant;
- second account: Batch 1 Validation client, Batch 1 Provider Check campaign and
  one creation request;
- total: 12 owner fields in four tables. Client/campaign IDs, all other fields,
  permission resource IDs, ciphertext, schedules and analytics remain unchanged.

The stricter first preparation correctly stopped on unparented rows: the second
owner also has 15 historical campaigns with NULL client IDs. The
[bounded read-only inventory](validation-2026-11-01-clerk-cutover/owner-scope-2026-10-31T23-23-03-379Z.json)
identifies these old summer/E2E test rows. They join the other 19 unparented
historical campaigns outside this current-client cutover. Their exact IDs and
row hashes are preserved; none is attached to a client, deleted or claimed by a
production login. The two external website references remain untouched too.

[Procedure](validation-2026-11-01-clerk-cutover/ownership-transfer.cjs) is an
operator-only module, not an application route/startup change. Its transaction:

- requires two distinct old/new mappings, the fixed identity-column inventory,
  exact reviewed rows, matching client ownership, unused destinations and no
  unplanned identity references;
- rejects unexpected triggers/rules/RLS, scope drift and any runnable unfinished
  work, including work appearing after planning;
- holds brief write locks on the four ownership tables and work queue while
  rechecking and updating; ordinary reads continue, and lock conflicts abort;
- changes only exact `id + old owner` matches, compares every non-owner field and
  all other rows in those tables, and preserves refresh-work history;
- defaults to ROLLBACK. COMMIT requires successfully saving its reverse plan first;
  disk/mid-transaction failures roll back. An uncertain COMMIT outcome requires a
  read-only owner check before any retry. Reverse transfer uses the same checks;
  subsequent data/work drift is an explicit stop, not an overwrite.

Validation: [14/14 real PostgreSQL tests](validation-2026-10-27-ci-scheduler/clerk-owner-cutover-nov01-fixed.json),
[isolated runner receipt](validation-2026-10-27-ci-scheduler/clerk-owner-cutover-nov01-fixed-execution.json),
TypeScript (`tsc --noEmit`, exit 0), script syntax checks and diff whitespace check.
The tests prove the 12-field forward/reverse transfer, separate client access via
actual storage, unchanged unrelated/financial/token/history rows, rollback by
default, drift/collision/parent/queue failures, receipt-save failure and failure
midway through updates. Actual `DatabaseStorage` creates and claims the next work
under the new owner while denying the old/other owner. The first local run failed
only on a test seed's varchar/text parameter inference; explicit casts fixed that
fixture before the successful run. Both local databases were cleaned and stopped;
no application credentials, providers or production mutations were used.

Only preparation scripts, a local regression test and launch documentation changed.
No runtime code, schema, full-suite rerun, app deployment or production write was
needed for this preparation. Real production account authentication is still
user-confirmed dashboard evidence, not proven by these local tests.

## User-confirmed Render configuration

On November 1 the user reported the following from the existing service:

- `APP_BASE_URL=https://marketforensics.onrender.com/`;
- `SHOPIFY_REDIRECT_URI` absent;
- `SERVICE_ACCOUNT_RESOURCE_GRANTS` absent.

The eventual coordinated switch therefore changes `APP_BASE_URL` to
`https://app.mimosaas.app`. All four traced callback builders derive from this
setting; Shopify needs no extra override. No environment-based resource grants
need an owner-ID update. The existing exact database grant is already included
in the 12-field transfer. No secret values were requested or copied.

Before changing that setting, add the new callback URLs to the existing provider
apps while retaining their old entries. The next manual action requested is the
single shared Google callback: open the existing Web application OAuth client
containing `https://marketforensics.onrender.com/api/auth/google-sheets/callback`,
add `https://app.mimosaas.app/api/auth/google-sheets/callback` under Authorized
redirect URIs, then Save. This covers GA4 and Sheets and creates no new OAuth
client or credentials. Google requires the callback to match a registered URI:
[official web-server OAuth documentation](https://developers.google.com/identity/protocols/oauth2/web-server).
The user replied **saved** to the exact Google addition instructions on November 1.
This is user-confirmed configuration evidence for the shared GA4/Sheets callback;
no consent exchange on the new domain has been claimed yet.

The remaining three callback additions were requested together, all in existing
provider apps while retaining old URLs:

- HubSpot Auth > Redirect URLs > Add redirect URL > Save changes:
  `https://app.mimosaas.app/api/auth/hubspot/callback`.
  [Official settings instructions](https://developers.hubspot.com/docs/apps/legacy-apps/public-apps/overview).
- Salesforce Setup > App Manager > existing connected app > Edit > Callback URL
  on a new line > Save: `https://app.mimosaas.app/api/auth/salesforce/callback`.
  [Official connected-app editing instructions](https://help.salesforce.com/s/articleView?id=xcloud.connected_app_edit_reconfigure.htm&language=en_US&type=5).
- Shopify existing app > Versions > Create a version > Redirect URLs:
  `https://app.mimosaas.app/api/auth/shopify/callback`; preserve current settings
  and release only a version whose sole change is the added callback. If the
  existing app exposes editable Allowed redirection URLs, add/save there instead.
  [Official redirect requirement](https://shopify.dev/docs/apps/build/authentication-authorization/authenticate-standalone-apps)
  and [version configuration/release](https://shopify.dev/docs/apps/build/dev-dashboard/create-apps-using-dev-dashboard).

The user supplied a Shopify screenshot showing both the old onrender callback
and the new `app.mimosaas.app` callback, correctly comma-separated in Allowed
redirection URL(s), then replied **done** to the save/release instruction. Shopify
is therefore recorded as user-confirmed saved. The screenshot alone does not
prove a new-domain OAuth exchange; that remains part of affected cutover checks.

The user subsequently confirmed **Both saved** for HubSpot/Salesforce, then asked
where to add HubSpot's URL and replied **done** to its exact Auth > Redirect URLs
save instructions. Both are now user-confirmed saved; the explicit final HubSpot
confirmation supersedes the earlier uncertainty. All four callback additions are
recorded. No new provider app, token rotation, import or settings unrelated to the
callback was requested. Render URL/Clerk keys and live ownership remain unchanged.

## Production token-origin safeguard (local, deployment pending)

Confirmed cause: `server/index.ts` called `clerkMiddleware()` without
`authorizedParties`. The installed SDK skips its signed `azp` claim comparison
when that option is absent. A locally signed fixture token with the website
origin was accepted by the actual middleware before the change. This demonstrates
the missing validation, not an observed production exploit.

The seven-line startup replacement derives a single allowed HTTPS origin from
`APP_BASE_URL` only when the effective backend publishable key is `pk_live_`.
The existing frontend-key fallback remains. Missing/invalid production base URLs,
credentials in the URL, paths, queries and fragments stop startup rather than
disable the check. Current test-key options remain unchanged. No route access
checks, analytics, sessions, provider credentials or schema are rewritten.

This uses the installed SDK's claim validation, not a new JWT validator or a raw
request-Origin/CORS policy. Its existing behavior for tokens without an `azp`
claim remains; no stronger claim is made. Optional Clerk Frontend API subdomain
allowlisting is not claimed verified. The active server check uses the exact
launch origin and does not authorize the website or the old onrender origin.
[Clerk production guidance](https://clerk.com/docs/guides/development/deployment/production)
and [middleware options](https://clerk.com/docs/reference/express/clerk-middleware).

Validation: [before: 9 expected failures / 3 passing controls](validation-2026-10-27-ci-scheduler/clerk-origin-before-nov01.json);
[after: 60/60 checks across four files](validation-2026-10-27-ci-scheduler/clerk-origin-fixed-nov01.json).
The actual startup fragment and Clerk SDK accept correctly signed app-origin
header/cookie sessions, reject five signed foreign-origin variants plus expired
and altered tokens, retain authenticated cookies on all four callback paths,
and preserve anonymous API denial, public pages and development-key behavior.
The companion checks cover CSP in isolated Chromium, campaign scope and the
ownership transfer/rollback. TypeScript and the server build pass. There were
zero real Clerk/provider calls or personal-browser accesses. Actual provider
code exchange and ordinary production sign-in remain for the coordinated switch.

## Prepared operator runner

[Runner](validation-2026-11-01-clerk-cutover/run-ownership.cjs) reads only the
reviewed folder and validates the packet digest, pinned database fingerprint,
both exact mappings, all three client/campaign IDs and the 3/3/5/1 row counts.
Its default mode is an enforced READ ONLY recheck. Explicit apply additionally
requires the expected deployed Git revision and the compiled live frontend for
`clerk.mimosaas.app`; rollback requires the original compiled development instance.
These anonymous checks do not prove the private backend key or a real session.
The user must set the matching backend key and secret from that same instance.
Before COMMIT the runner writes an exclusive rollback receipt and fsyncs it;
failed/uncertain operations stop and never retry automatically.

[Nine isolated CLI tests pass](validation-2026-10-27-ci-scheduler/clerk-cli-final-nov01.json)
for input/digest/direction/target/account/row boundaries, deployed instance/revision
reads, rejection of external script origins and rollback receipt disk failures.
The refreshed [12-row read-only plan](validation-2026-11-01-clerk-cutover/ownership-plan-2026-11-01T04-30-31-547Z.json)
has SHA-256 `189ee6bbbeb78e1058e3270ebfa8d1e081f994903cb227ddcbb5f4459ebd68c6`.
Running the CLI in its default mode against that packet returned
`PASS_REVIEWED_READ_ONLY_SCOPE`; no production update was attempted.
The public new-domain check still finds the original development Clerk frontend.
