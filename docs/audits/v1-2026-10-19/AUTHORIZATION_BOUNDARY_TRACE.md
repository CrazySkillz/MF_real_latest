# Authorization boundaries and retained report mutations

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Seventeen exact-helper/handler controls](authorization-reproductions.json) and [runner](authorization-reproductions.cjs). Fake actors/storage, no production mutation or messages. A correct helper does not prove every caller orders it correctly or preserves its authorized scope during a later write.

## Shared controls

Clerk middleware attaches identity (`index.ts:68`). The later `/api` middleware168–194 logs requests/responses and calls next; it does not require authentication. Each endpoint needs its own authorization boundary. React signed-in routing and hidden navigation are not server controls.

`ensureCampaignAccess:3366–3414` rejects anonymous401, missing/ownerless/foreign404 and allows exact owner. Five fixture controls cover those states. Internal calls instead require the process-random token plus exact loopback socket check in `internal-request-auth.ts:11–19`; actual-token controls reject an external address and permit loopback. No token bytes are recorded. Internal access still requires campaign existence but bypasses actor/owner checks; worker eligibility and final durable owner/config checks therefore remain separate requirements.

KPI, Benchmark and platform-report helpers8855–8933 first require actor, load the row, reject absent campaign, then authorize that campaign. Three unscoped-row controls reject404. LinkedIn session helper8824 also requires a surviving connection. Current generic report/target mutations normally preserve identity, but V1-054 proves retained mutation exceptions; V1-073 proves final-write parent disappearance despite an earlier route check.

## Connection status/list response controls

[Seventy-six current-route cases](connection-response-reproductions.json), [runner](connection-response-reproductions.cjs), execute19 exact GET registrations with the actual `getActorId`, `ensureCampaignAccess`, campaign-ID schema and registered ID middleware. For each: configured owner response, anonymous401, foreign-owner404 and missing-parent404. Clerk identity and storage are fixtures; this is handler/middleware composition evidence, not a deployed cookie/session certificate. Denied requests stop before source reads, except Custom Integration by-ID's necessary row-to-campaign lookup; no denied response returns the setup bearer.

| GET family | Exact route lines | Owner response boundary |
|---|---|---|
| GA4 check/list |14297/16018 | Selected public connection fields; no access/refresh/client secret, ciphertext or service-account private key marker. Both respect readOnly1 for legacy migration in the exercised branch. |
| Sheets check/list |18025/17364 | Public spreadsheet/tab/mapping fields; fixture has a saved sheet name, so provider metadata enrichment is not executed. Missing-tab inference/provider refresh remains separately unverified. |
| HubSpot status; Salesforce connection/status |18058/18130/18171 | Public account/organization/mapping fields; configured, unexpired named connections only. Refresh failure, raw provider-error redaction and malicious mapping contents are not certified. |
| Meta two connection aliases; Instagram/TikTok connection |24345/24487/24536/24803 | Public selected account/config/status fields. `selectedCampaignMetadata`/`lastError` content contracts still need provider-origin review; direct secret fields are omitted in these cases. |
| Google Ads; LinkedIn connection |27064/28568 | Public account/method/status fields. Google Ads status does not return currency; current revenue wizard's connection.currency fallback therefore defaults to USD (V1-106), independent of token redaction. |
| Shopify status |35885 | Public shop/auth/window fields; stored authType avoids scope discovery. Date-window helpers are fixture-bound here, not provider validation. |
| GA4/Sheets/Ads service-account status |16101/16599/26677 | Actual public-status helpers return only enabled/email from synthetic private-key configuration. No environment credentials read or outbound token creation. |
| Custom Integration by-ID/campaign |28071/28089 | Current schema740 includes a webhook bearer needed for owner setup; returned only to owner in these cases. Logs exposing this bearer remain V1-057. Initial common fixture mistakenly supplied nonexistent OAuth columns to this table; it was corrected to the declared schema before accepting evidence. No application finding was inferred from those artificial fields. |

These controls reduce19 route-response/guard gaps; they do not prove all349 endpoints, error branches, credential logs, nested provider JSON or cross-worker write behavior. Service-account permission validation remains independent of public-status redaction. Source setup/lifecycle and the current broad privacy/response gate stay open.

## All no-marker endpoint declarations accounted for

The AST inventory has349 endpoint declarations.45 lack its heuristic guard markers; the304 others contain markers, not necessarily a correct guard. Below accounts for all45 without interpreting token absence as automatic vulnerability. Duplicate registrations and aliases are retained. Full per-endpoint payload/child/platform/concurrency negatives remain open; no349-route certificate is claimed.

| Declarations | Count | Actual boundary and disposition |
|---|---:|---|
| `/health`, `/api/health`, `/health/scheduler`, `/api/snapshots/scheduler` | 4 | Public status/liveness/introspection. Snapshot scheduler915 returns running/frequency/nextRun; whole scheduler health can say healthy despite failed work (V1-010). Operational metadata exposure and deployed contents require review, not an assumed tenant-data exploit. |
| GET/POST metrics, performance, integrations | 6 | No actor/owner check; global data reads/writes (V1-002). |
| POST Spend process/connectors and process/ad-platforms | 2 | Shared callback6193 has no authorization. Both exact registration fixtures mutate foreign campaign Spend/currency and create source (V1-075). |
| Alerts check/status; LinkedIn direct-token connect | 3 | Explicit NODE_ENV=production404 before side effects; three fixture controls passed. Nonproduction deployments are not protected by that condition. |
| LinkedIn daily mock and mock-seed | 2 | Production rejection can be overridden by ALLOW_MOCK_DATA; anonymous writes reproduced under that flag (V1-063). |
| Alerts test-email | 1 | No caller/owner gate (V1-005); only fixture transport used. |
| Industry benchmarks list/detail | 2 | Public static reference thresholds, not measured customer facts. Provenance and lack-of-data presentation remain product obligations. |
| Google simulation-auth | 1 | Reflected script injection reproduced in isolated browser (V1-027). |
| Shopify OAuth callback | 1 | Consumes nonce; validates stored campaign/shop/session/TTL11794; required HMAC uses constant-time comparison; production key required. Missing ordinary guard token is not missing callback authentication. Process-local nonce store, provider/reconnect/final-write/restart paths remain separate gates. |
| LinkedIn campaign list/revenue; Google Trends | 3 | Missing campaign owner check in registered handlers (V1-003). |
| Custom webhook/token and inbound-email/token | 2 | Bearer capability resolved to integration; sender filters for email. Token logging, persisted whitelist, parent validity and parser/publication issues remain V1-026/029/030/057. |
| Attribution models/journeys/touchpoints/calculation/channel-performance/campaign read | 14 | Public in-memory family and fabricated examples (V1-006; campaign read also V1-003). No exclusion from API reachability. |
| SendGrid/Mailgun inbound | 2 | Signature/parser verification gaps (V1-004); not treated as ordinary browser-authenticated routes. |
| Conversion webhook | 1 | Unsigned campaign mutation (V1-001). |
| Platform fields | 1 | Public metadata/provider-facing selection handler; V1-003 and provider scope/validation obligations. |

## V1-003 supplemental retained private-read proof

[Six exact-handler cases](retained-private-read-reproductions.json), [runner](retained-private-read-reproductions.cjs), now execute the remaining three handlers with both anonymous and unrelated-owner identities. Every case returned200 and made zero access-guard calls. All identities, records and provider replies are synthetic; no real provider or campaign was queried.

- `server/routes-oauth.ts:23305–23397`, Google Trends: reads the supplied campaign without owner checks, sends its private configured keywords to the provider adapter, and returns keywords/industry. Provider requests were stubbed. No current client caller was found in the tracked client search; the endpoint remains registered.
- `server/routes-oauth.ts:31437–31471`, attribution: returns campaign touchpoints and insights, including fixture event ID/channel/value42, without actor or campaign checks. It does not even load the campaign parent. No current client caller was found in the tracked client search; the registered API still requires protection.
- `server/routes-oauth.ts:34290–34407`, platform fields with `campaignId`: reads that campaign's LinkedIn and Sheets connections, then uses its Sheets credential for two provider schema/header requests and returns a required-field policy influenced by the private sheet. The fixture records the provider URLs but no credential. Current caller: `client/src/components/ColumnMappingInterface.tsx:98`. This is a private connection/schema inference and unauthorized provider-use path, not proof that raw sheet cells or tokens are returned.

The ordinary static field catalog may legitimately be public; the campaign-dependent branch has a different boundary. Required regression checks must distinguish these branches and keep provider dispatch behind exact owner/source validation.

## Additional credential-response and parent controls

Current `server/routes-oauth.ts:9154–9163` checks a nonempty edited Client ID against actor-owned Clients and removes ownerId from campaign updates. `storage.ts:6749–6758` refuses a Client deletion containing foreign-owned campaigns. These are positive code checks; the separate deletion concurrency defect V1-023 remains.

GA4 connection listing `16020–16047` and Google Ads connection status `27064–27080` authorize the campaign and project allowed status/configuration fields; their returned shapes omit credentials. Custom Integration reads `28071–28104` authorize the campaign but intentionally return the full integration object for its bearer-token setup UI. The log exposure in V1-057 remains separate. [Response-field candidates](response-field-candidates.json) are a capped AST search aid, not a complete response/secret audit or evidence that every candidate was reviewed.

## V1-074: retained Meta report mutation results are inaccurate

`PATCH /api/meta/reports/:reportId:27739` authorizes stored campaign and strips parent/platform identity, but returns200 with missing report when `updateMetaReport` returns undefined. `DELETE:27770` ignores false from `deleteMetaReport` and returns success. Exact fixtures simulate a row disappearing after authorization. Storage5370–5381 correctly reports actual updated/deleted rows; the route discards that evidence. Current Meta UI371/389 uses `/api/platforms/meta/reports`, not these legacy endpoints; no current frontend caller for the legacy pair was found. They remain registered API obligations, with bounded assurance severity P2. The legacy send route explicitly returns501 after authorization; it must not be represented as functioning email delivery.

## V1-075: anonymous connector-derived Spend writes

Both registered aliases6223/6225 use `processConnectorDerivedSpend:6193–6220`. It checks only amount>0, reads a supplied campaign ID, overwrites campaign Spend/currency, then creates an active `connector_derived` source. It does not call actor/campaign access, validate source context/currency against campaign, or insert matching spend records. Exact fixtures without any actor change a foreign fixture's USD currency to EUR and Spend to123.00, then create a source under that campaign. Both aliases return200. This is P0 unauthorized business-data mutation, independent of whether the current frontend calls it. No live request was sent. Invalid or missing parent, partial-write failure and downstream invalidation remain required regressions after the authorization fix.

## Additional static screening and limits

### Declaration order and overlapping routes

[Literal-path analysis](route-registration-overlap.json) and [runner](route-registration-overlap.cjs) checked all349 endpoint declarations and found19 potential same-method intersections. All349 literal paths fit the analyzer; this does not cover dynamic registration or prove the whole Express stack. These are classified as follows, rather than treating the last matching declaration as authoritative:

| Intersections | Count | Current-code disposition |
|---|---:|---|
| Notification mark-all-read7608 before `/:id`7723 | 1 | Static action is deliberately registered first; `mark-all-read` resolves as the action, not a notification ID. |
| Literal Meta KPI POST26464/PATCH26509/DELETE26564 before generic platform KPI28780/28857/28968 | 3 | Earlier Meta handlers consume these requests. Later generic identity stripping/guards cannot establish safety of the Meta path. V1-054 covers the retained mutation defect in the earlier handler. |
| Evaluated Benchmark GET27540 before29160, Benchmark POST27568 before29378 | 2 | Earlier handlers explicitly `next()` unless query/body platform is meta/facebook. Both registrations matter. They are intentional dispatch, not automatically dead duplicate routes. |
| Benchmark DELETE27641 before30606 | 1 | Earlier handler loads the Meta row; absent Meta row or its specifically handled missing-table error passes to the generic route. Other read errors return500; found Meta rows use that campaign's guard. Same-ID records across both tables require their own ambiguity/damage check. |
| Other literal/parameter intersections | 12 | The exact pairs and lines are in the JSON. Intersections need a parameter equal to a reserved path word, such as `daily-metrics`, `connection`, `sheets`, `spreadsheets` or `selected-campaigns`. Normal campaign creation uses generated UUIDs, but `campaignIdSchema` only requires a nonempty string; this audit does not declare all historical/custom IDs impossible. No additional authorization bypass is proven from the intersection alone. |

The12 remaining pairs cover LinkedIn insights/daily metrics, Sheets spreadsheet/tab/check-connection, LinkedIn disconnect/reports/connection, Meta connection/reports/selected-campaigns, and LinkedIn daily-metrics versus check-connection/import-sessions/metrics/imports/reports. This accounts for every analyzer result. A helper-extraction test of a later route is not sufficient evidence for a request consumed earlier; the confirmed Meta mutation fixtures target the actual earlier registration. Full request parsing/middleware/parameter and concurrent-child tests remain open for the complete349-route inventory.

Tracked runtime SQL raw fragments in storage787 use fixed optional-table names; storage3756 reconstructs fixed column SQL while values remain parameterized. No input-derived SQL injection is claimed from those occurrences. `main.tsx:46` injects startup error HTML and chart.tsx81 emits configured styles; no user-input exploit chain was proven for them. This screening does not replace response/secret-field, CSRF/origin, file-parser/resource-limit or whole dependency vulnerability review.

The runner initially keyed captured routes in lowercase but looked them up in uppercase. That audit-harness error was corrected; published17 cases passed. It is not a product failure and does not change the182 open full-suite failures.
