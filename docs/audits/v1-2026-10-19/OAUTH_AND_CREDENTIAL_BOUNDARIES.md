# OAuth output, state and credential boundaries

Revision: `777aae6f6353e998d60b635d3e66b413093117c2`. Current source, synthetic environments and local blocked-network Chromium only. No production payload, provider exchange, customer credentials or secret values were collected.

## Callback output: expanded V1-027

The earlier simulation callback issue also exists on real callback error paths. `server/routes-oauth.ts:11506–11525` directly interpolates Salesforce `error` and `error_description` into HTML; JSON.stringify inside inline script does not escape an HTML closing-script sequence. LinkedIn23517–23540 and Meta24073–24096 interpolate error description into both HTML and a quoted JavaScript string. These branches run before state verification and `ensureCampaignAccess`. A configured provider, valid OAuth state or campaign ID is not needed to reach them. Rate limiting on LinkedIn/Meta does not encode output.

[Six browser cases](oauth-popup-reproductions.json), [runner](oauth-popup-reproductions.cjs), execute exact extracted handlers under the current CSP with all browser network blocked: Salesforce error and description, LinkedIn description and Meta description each execute a harmless sentinel. The Google callback's fixed error text does not execute it. The existing `serializeOAuthPopupJson` helper at81 safely round-trips the same string without execution. Reuse of that helper is possible within the current architecture, but HTML text requires its own correct encoding. Neither a new framework nor a CSP change alone is the identified fix. No change has been made.

The local browser launch initially failed with sandbox `spawn EPERM`; the approved isolated rerun executed all six assertions. This was an environment failure, not a callback failure. Other success/catch branches still require branch-specific output checks: safe serialization in GA4 properties, HubSpot/Salesforce organization names and Ads customer lists does not certify every template. Shopify's normal popup helper is serialized; its outer catch11912 separately uses JSON.stringify. No arbitrary attacker-controlled Shopify catch message was proven in this review, so that path is not counted as a reproduced exploit.

## State signatures and configuration

[Twelve exact-function cases](oauth-state-reproductions.json), [runner](oauth-state-reproductions.cjs), use synthetic production environment objects, an isolated clock and ephemeral fixture keys. The actual machine's secret environment was not inspected.

| Provider / exact path | Current contract and fixture result | Remaining boundary |
|---|---|---|
| GA4 routes16280–16315 | Purpose-derived secret resolver; campaign, timestamp, random nonce; HMAC/timing-safe comparison;10-minute expiry. Valid accepted, tampered/expired rejected. Missing production secret throws. | Stateless verifier accepts repeated state; no initiating-session claim/nonce consumption here. Callback owner check still required. Provider code reuse protection is independent. |
| Google Sheets16317–16350 | Same resolver, own purpose; recognized financial/general purpose values;10-minute expiry. Same controls pass; missing secret throws. | Unrecognized purpose becomes null. Verify selected purpose and callback ownership separately from signature. |
| HubSpot11302–11344 | Purpose-derived secret; finite positive timestamp, campaign;10-minute expiry. Same controls pass; missing secret throws. | Repeated verifier acceptance does not prove repeated provider code exchange. |
| LinkedIn23404–23455 | Specific→SESSION_SECRET→APP_SECRET→known development string, even with NODE_ENV production; campaign/time/nonce/spendOnly. Correct-key controls reject tamper/expiry. | **V1-078:** synthetic production with no secret accepts independently constructed state signed with the public fallback. Callback still checks campaign ownership at23587. Live secret configuration is unknown. |
| Meta23953–24013 | Same fallback pattern with Meta-specific development string; campaign/time/nonce/spendOnly. Correct-key controls reject tamper/expiry. | **V1-078:** same independently constructed-state acceptance in missing-secret production. Callback ownership check24143 remains; no anonymous write is claimed. |
| Google Ads26643–26675 | Specific→SESSION_SECRET→APP_SECRET; explicitly throws in production if absent;10-minute expiry. Same controls pass; missing-secret control rejects. | Uses a distinct resolver rather than the GA4 purpose-derived helper. Callback/provider/configuration checks remain separate. |

All six stateless verifiers accept the same otherwise-valid state twice. Random nonce text alone does not make a state single-use or bind it to an initiating browser session. Their callback owner guards and providers' authorization-code rules reduce other attack paths; those facts must not be collapsed into either a proven replay exploit or a proven full replay defense. Require isolated authenticated callback/replay/session-switch/provider-denial acceptance per source. GA4/Sheets/Meta/Ads timestamp parsing also lacks a future-issued-time bound; only the signing authority can normally produce such a valid signature. No independent exploit of that branch is asserted.

Salesforce instead stores PKCE verifier/nonce/campaign in the process-local map at7245, creates S256 challenge at11419 and consumes the entry at11553 after campaign access. Shopify stores campaign/shop/session/time at7252/11489, consumes the nonce at11792 and validates session/shop/campaign/TTL and HMAC. Both lose pending state on restart and do not share it between replicas. Real restart/replica recovery remains an operational acceptance gate; map-backed safeguards are not durable-work guarantees.

## Credential and log scope

### V1-088: lazy legacy-token migration can undo credential renewal

[Eleven isolated interleavings](token-backfill-reproductions.json), [runner](token-backfill-reproductions.cjs), use the exact storage getter/hydration methods and actual tokenVault encryption with synthetic keys/tokens. A read observes a legacy plaintext row; another operation completes a new encrypted-credential save; the original reader then performs its lazy encryption write. Ten getter paths overwrite the new credential with the old observed credential because their write predicate checks only row ID or campaign ID. No actual provider token, OAuth exchange or production database was accessed.

| Source/getter | Exact lazy-write path in storage.ts | Interleaving result |
|---|---|---|
| Google Sheets list | 3265–3280 | Old token restored; only connection ID checked. |
| HubSpot list/single | 3907–3921 / 3939–3951 | Both restore old token; only connection ID checked. |
| Salesforce list/single | 4043–4057 / 4075–4087 | Both restore old token; only connection ID checked. |
| Shopify list/single | 4180–4190 / 4209–4217 | Both restore old access token; only connection ID checked. Single fixture has non-OAuth mapping, so later same-store sharing logic is outside this case. |
| LinkedIn | 4394–4415 | Old token restored; campaign ID predicate can also reach a replacement connection for that same campaign. |
| Meta | 4581–4592 | Old token restored; campaign ID predicate. |
| Google Ads main | 5047–5059 | Old token restored; campaign ID predicate. Dedicated GA4 Ads Spend storage is separate. |
| GA4 list, positive control | 923–940 | New credential preserved: predicate requires encryptedTokens still null and all observed plaintext fields unchanged. |

These readers are current callers, including all-data-sources3776–3777, Revenue configuration4045–4046, LinkedIn Spend6237/6315, and ordinary provider status/refresh flows. Some owned-refresh variants skip lazy migration when `refreshScope` is supplied; ordinary UI/status/list calls remain reachable. A successful reauthorization/rotation can therefore be undone by a concurrent legacy read, causing subsequent source failures. This is conditional on legacy plaintext data and concurrent credential change; its presence in the live database is unverified. Inspect legacy rows read-only before planning any migration/cleanup.

Acceptance: guard each lazy update against changed row/credential identity using the existing storage pattern, retain new credentials when a stale migration loses the race, and cover same-row renewal, delete/reconnect replacement, multiple readers, errors and process restart per source. The GA4 comparison is a verified reusable safeguard, not proof all credential paths already use it. The query builder is an in-memory predicate model; real PostgreSQL contention/provider renewal still needs validation. The runner's first parse failed because a fixture object brace was missing; corrected final11 cases pass. It is an audit harness error, not a new application test failure.

### Internal GA4 loopback authentication: positive bounded evidence

Current `server/internal-request-auth.ts:4–35` generates a32-byte per-process random secret, requires the actual socket remote address (fallback req.ip only if absent) to be loopback, checks header string/byte lengths and uses timingSafeEqual. Supplied GA4 ownership scope must be authenticated, a string at most2048characters, valid JSON and contain nonempty campaign/owner/date/work-ID/lease-token fields. `ensureCampaignAccess`, `routes-oauth.ts:3366–3406`, still requires an existing campaign for internal requests; ordinary requests require the exact owner. The internal credential intentionally bypasses the ordinary owner comparison; possession and loopback are therefore both required boundaries.

The authoritative [controlled full run](tests-controlled.json) contains **14passed/0failed/0skipped** in `server/ga4-refresh-internal-auth.test.ts`: ordinary no-scope behavior, three loopback forms, malformed/oversize scopes, external address with valid token, and loopback with wrong token. This is existing current-commit test evidence, not a new run. Refresh callers at `auto-refresh-scheduler.ts:191` and the Executive snapshot scheduler use the per-process token. GA4-aware write routes6908/14929/18673/20086/36247 parse the ownership header; Shopify36247/36310 also checks campaign/context/source/config identity before its owned write. Scope parsing alone is not proof of database lease ownership, complete route coverage, deployed proxy topology or cross-process/restart safety; those gates retain their separate evidence and limitations. No secret value was recorded.

### Other credential and log boundaries

`server/utils/tokenVault.ts:28–59` still permits a known encryption fallback (V1-008), independently of the OAuth signing findings. AES-256-GCM has a random12-byte IV/auth tag; decrypt failures return null from `decryptTokens`, so absence/decryption failure can collapse into reconnect behavior. Explicit production-key assertions exist in selected writes; their presence cannot be generalized to every source. Production key/version, rotation/restoration, legacy plaintext columns and service-account handling remain required per-storage-method checks.

The log search distinguished actual credentials from metadata: `analytics.ts:3511` logs campaign/property/token length, not the token itself. Custom Integration logs at14435/28046/28250/28376 contain the bearer token. In addition, the generic API logger `index.ts:168–190` logs the request path, which includes the custom webhook/email bearer token before response truncation. Redacting only named token properties would not close V1-057. Response logging captures the response object then truncates the assembled line to80 characters; this is not a redaction policy. No actual production log content was collected. Campaign request logging9043, provider error bodies and other response fields still need field-level exposure review.

Clerk middleware loads identity; it does not make every API authenticated. No explicit CORS/CSRF middleware or Clerk authorizedParties setting was found in tracked non-test server/client code by the named-symbol search. This absence alone is not proof of a CSRF exploit: deployed cookies, Clerk verification behavior, origins/proxies and browser request constraints require separate testing. Existing owner checks and all no-marker routes are recorded in [the authorization trace](AUTHORIZATION_BOUNDARY_TRACE.md).
