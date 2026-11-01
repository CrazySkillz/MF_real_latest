# Dependency exposure — bounded launch review

Status: **COMPLETE for the current deployment's bounded dependency launch gate**,
not a whole-app security clearance or a claim of zero vulnerable package versions. The confirmed HTTP
parser correction is deployed as `6e113a0c`; its dedicated record holds tests
and release evidence. This review does not reopen historical audit items.

## Inventory and method

The public OSV npm dataset was downloaded on November 1 and compared locally to
the exact lockfile. No dependency-inventory upload or npm audit was performed.
The initial comparison found 221 installed-location/advisory matches; the parser
correction leaves 204 raw matches (201 distinct installed-location/advisory pairs).
Duplicate installed locations or affected-range entries can share one advisory.
These are version candidates, not a count of exploitable application defects.

The local `validation-2026-11-01-dependencies/` directory retains the full public
ZIP, its SHA-256 receipt, filtered upstream records, before/after version matches,
offline matcher with eight range-boundary assertions, and source import inventory.
Unsupported advisory ranges: zero. Source import inventory includes retained
helpers and is not itself proof of production reachability. The compact candidate
ledger preserves every remaining match and the scope of its current disposition.

## Supported narrow dispositions

| Package / advisory family | Evidence and current disposition |
| --- | --- |
| body-parser, qs, path-to-regexp, Multer | No remaining matched versions after the targeted update. Multer's index/depth protections additionally require the explicitly configured limits; upgrade-only validation failed and was corrected. See the HTTP parser record. |
| Clerk `GHSA-vqx2-fgx2-5wq9`, `GHSA-w24r-5266-9c3c` | App uses `clerkMiddleware`, signed-token verification and `getAuth(req).userId` plus storage ownership checks. No app `createRouteMatcher`, `createPathMatcher`, `createCheckAuthorization` or combined organization/billing/reverification authorization predicates. Frontend uses `SignedIn`/`SignedOut`. Vendor advisories explicitly distinguish unaffected token authentication from the affected predicates. These reported bypass shapes are outside the traced app authorization path; production origin/account tests remain applicable. |
| proxy-addr `GHSA-jqcg-44mw-7w3h` | `server/index.ts` sets numeric `trust proxy` to 1, not the advisory's incorrectly specified IPv4-mapped IPv6 subnet. This particular subnet-configuration trigger is absent; this is not a new certification of all proxy/rate-limit behavior. |
| Drizzle `GHSA-gpj5-g38j-94v9` | Runtime source and shared schema search finds no `sql.identifier`, `.as()` or `alias()` invocation. Tables/columns in `shared/schema.ts` are static. The advisory's untrusted identifier/alias construction is absent in the traced source; no ORM upgrade or query rewrite is justified by this match alone. |
| protobufjs, @protobufjs/utf8, @grpc/grpc-js | Installed through the unused `@google-analytics/data` → google-gax tree. Runtime-source import inventory has no import of that SDK, grpc or protobuf. Current GA4 `analytics.ts` uses Google REST endpoints; retained `real-ga4-client.ts` uses googleapis REST. No public protobuf/schema loading or gRPC server is introduced by this app. |
| fast-xml-parser, @smithy/config-resolver | Installed through `@types/nodemailer` → AWS SES SDK declarations, not a runtime AWS import. `email-service.ts` uses Mailgun HTTP or configured SMTP transports, not SES/XML. No runtime source imports fast-xml-parser or the AWS SDK. |
| jsPDF advisories and DOMPurify | Current app uses text/vector PDF generation and buffer/data-URI/save output, not the vulnerable new-window overloads, HTML, AcroForm, addJS, XMP or FreeText annotations. Its image calls use the fixed repository JPEG logo, converted to a data URI by the two server logo loaders and the same static browser logo URL. No user-supplied filesystem path, GIF/BMP image or DOMPurify HTML input reaches those methods. This is the reviewed rendering contract; future branding/image/HTML features must reopen this disposition. |
| fflate `GHSA-px8p-9vwx-vf98` | jsPDF's installed Node build calls `zlibSync` for output compression, not the affected ZIP64 `unzipSync`. The app's separate upload parser uses Node zlib, not fflate. |
| jws `GHSA-869p-cjfg-cm3x` | Installed google-auth-library/gtoken call `jws.sign` for service-account assertions; verification uses Node RSA. No app `jws.createVerify` HMAC/header-driven key lookup. App `createVerify` in the SendGrid boundary is Node crypto, not jws. |
| nanoid advisories | Runtime call is `nanoid(32)` for a webhook token; the development template uses the default `nanoid()`. No custom/non-secure generator or caller-controlled size. |
| ws | No runtime application WebSocket constructor/server or ws/Neon import. Database uses pg TCP. Vite's HMR server is development-only; production serves static assets. |
| Vite, Vitest and @vitest/mocker server advisories | The production start script sets NODE_ENV=production; `server/index.ts` calls `setupVite` only in development, otherwise `serveStatic`. CI uses Linux, `vitest run`, node environment and forks, with no Vitest UI/API/browser-mode server. Normal Playwright tests are not Vitest Browser Mode. These development-server attack paths are not production/CI services. |
| @babel/core, @babel/helpers | React's build plugin compiles repository source, not uploaded/customer JavaScript or source maps. No named-capture regex is present in runtime TS/TSX; the generated named-capture replacement helper prerequisite is absent. The app exposes no Babel transform API. |
| esbuild, Rollup | esbuild is used for fixed build commands/local test bundling, not an exposed serve API. Vite's output directory and the two manual chunk aliases are fixed in `vite.config.ts`; customers cannot supply build input names, plugins or output paths. |
| PostCSS, postcss-selector-parser, source-map-js, yaml | The build reads repository CSS/source maps and `postcss.config.js`; YAML is installed through postcss-load-config. No runtime application import or endpoint processes customer CSS, source maps or YAML with these packages. The app's upload parsers are separate. Source maps and selector ASTs from untrusted uploads do not enter this build. |
| brace-expansion, minimatch, picomatch, glob, browserslist | These installed consumers serve repository build/test discovery. Tailwind content globs, build target configuration and inputs are application-owned; no customer glob, browser query/stats or glob CLI command is accepted. CI is not a customer build service. A future customer-configurable build feature would reopen these dispositions. |
| @tootallnate/once | Its installed http-proxy-agent caller waits for `once(socket, 'connect')` without the advisory's AbortSignal option. No direct application import supplies that option. |
| lodash | Only Recharts depends on this package. Its `omit` calls use the fixed keys `width` and `children`; no `unset` or `template` call occurs there. Application `.omit()` calls belong to Zod schemas. No customer-controlled Lodash path or template-import object reaches the affected methods. |
| d3-color | The vulnerable nested copies belong to D3 zoom/transition; there is no application import or customer-supplied color parser. `InteractiveWorldMap.tsx` uses fixed hex color ranges/styles and numeric metrics; the directly resolved d3-color is already 3.1.0. No customer CSS/color configuration enters these calls. |
| form-data | Runtime app callers of Axios send fixed-shape JSON or URLSearchParams, never npm form-data multipart with customer field names/filenames. Other installed references are type declarations. Mailgun attachments use Node's built-in FormData/Blob, not this package. |
| Axios | The only application imports are `googleAdsClient.ts`, `linkedinClient.ts` and `services/meta-graph-api.ts`. Their explicit get/post/create calls use the Node HTTP adapter, fixed HTTPS provider origins, JSON/URLSearchParams and application-built parameter structures. No browser XSRF, fetch adapter, streamed upload/response, FormData-to-JSON, custom URL encoder or user-supplied top-level config is used. Scalar IDs are path/query values, not a forwarded request configuration; protocol-relative initial paths fail Node's URL construction. The remaining read-side prototype conditions require a separate pollution primitive not established in this trace. This is a scoped disposition, not proof that arbitrary same-process prototype pollution or compromised providers are safe. Exact per-advisory reasons are in the ledger. |
| follow-redirects | Only the Axios consumer is present. Google Ads does use custom credential headers, but initial URLs belong to fixed HTTPS providers and no attacker-controlled provider redirect is established. This does not prove that an arbitrary cross-domain redirect would strip every custom header. Reopen if caller-controlled destinations or a provider redirect is introduced. |
| js-cookie | Installed only through `@clerk/shared`. Its cookie helper imports the package, but the installed Clerk React/Express/backend entrypoints and app source do not call/import that helper; the built app assets contain neither the helper nor this package. No customer JSON cookie attributes are passed to it. The hosted Clerk JavaScript service is outside this installed-lockfile disposition; existing production sign-in evidence remains applicable. |
| Nodemailer, supported input/option dispositions | The deployed shared recipient guard accepts plain ASCII email strings, excluding the affected group/comment/quoted/free-text/Unicode-domain inputs. Report arrays are schema-validated strings and alerts use text recipients; SMTP receives normalized text, not nested structured addresses. Explicit message/transport fields exclude raw messages, List headers, DKIM, JSON transport, legacy content resolution, OAuth2 token fetching, custom envelope size and a customer-controlled EHLO name. Attachments remain application-generated buffers. The single operator-configured transport does not expose per-tenant TLS servername settings. Three remaining SMTP conditions are listed below. |

These are condition-specific dispositions, not assertions that those libraries
have no defects. They must be revisited if their inputs, APIs or deployment mode
change. No future/deferred source is enabled by this review.

## Completed bounded gate — November 1

The ledger now holds 204 supported scoped dispositions/mitigations, zero partial
conditions and zero awaiting deployment (201 distinct installed-location/advisory
pairs). These counts describe advisory candidates, not confirmed app defects.

The [shared email recipient correction](EMAIL_RECIPIENT_BOUNDARY_2026-11-01.md)
now has a confirmed before/fixed application boundary and 80 passing local
regressions, TypeScript and build. Deployed `9848ef9c` is healthy; hosted CI and
new-domain public checks pass. Its syntax guard alone does not close every
Nodemailer condition; the separate configuration evidence below closes the final three.

The [request collection correction](REQUEST_COLLECTION_LIMITS_2026-11-01.md)
addresses four existing maximums that Zod v3 did not enforce before typed item
validation. It changes four route-schema expressions, retains the existing limits
and accepted values, and passes 258 focused tests, TypeScript and production build.
Deployed `0a42aac8` passes hosted CI and public new-domain checks. This does not
certify unconstrained collections or independently close the other dependency conditions.

**Manual production configuration evidence:** on November 1, the user answered
"Yes—all three conditions match" after checking Render → marketforensics →
Environment for `MAILGUN_API_KEY` and `MAILGUN_DOMAIN` both present, with
`EMAIL_PROVIDER` either `mailgun` or absent. This records the confirmed condition,
not secret values, an independent dashboard inspection or a new delivery test.

The unchanged deployed `server/services/email-service.ts` selects `mailgun` for
either confirmed provider setting and calls `sendViaMailgunAPI` before SMTP.
The HTTP helper uses built-in fetch/FormData/URLSearchParams. Both HTTP success
and failure return directly; failure does not fall through to SMTP. Constructing
the SMTP transporter does not send a message or start a peer exchange.
Consequently `GHSA-2x7j-588g-ccc2` (valid address-list scaling),
`GHSA-4ffr-jq9g-5ffx` (SMTP AUTH response handling), and `GHSA-4g23-2xm8-66gc`
(SMTP reply reassembly) are not reached in the confirmed deployment.

**Stopping point:** Task 1 has no remaining steps. No code/configuration change,
test email, repeated UI check or dependency upgrade is required for this closure.
This is a configuration-specific disposition, not an SMTP fix. Reassess the three
conditions before enabling SMTP or removing the Mailgun API configuration, and
revisit other dispositions if their relevant inputs/APIs/deployment mode change.

- Package `dev` flags alone are not reachability evidence. Trace build inputs and
  generated-code effects before excluding a tooling advisory.
- Do not introduce blanket upgrades. Add another runtime correction only if an
  enabled path or release process meets the advisory conditions.

The other launch gates remain unchanged: affected new-domain callback acceptance,
the already-postponed retained recovery-key proof, compatible rollback evidence
and consolidated final acceptance. No repeated provider import or new manual
security drill is requested by this document.
