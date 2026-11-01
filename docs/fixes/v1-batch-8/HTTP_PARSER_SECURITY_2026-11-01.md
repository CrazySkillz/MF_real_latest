# HTTP parser security correction — November 1

Status: local correction validated; deployment verification pending. This closes
only the confirmed HTTP parser defects below, not the entire dependency gate.

## Root causes and traced boundary

1. `server/index.ts` installs Express JSON and URL-encoded parsing before API
   authorization. Express 4.21.2 resolves body-parser 1.20.3, whose compressed-body
   reader can leave a late decoder error unhandled. The isolated actual-startup
   fragment reproduced a process exit for both parser types. The vendor fix is
   body-parser 1.20.9, obtained through the compatible Express 4.22.3 release.
2. Both Multer configurations in `server/routes-oauth.ts` allowed unbounded field
   array indices and nesting. File-size limits do not bound these field names.
   The actual CSV initializer reproduced a synchronous stall in an isolated
   process. Multer 2.5.0 supplies the protections but defaults the new field
   limits to Infinity: upgrading alone reproduced the stall again. Both existing
   configurations now explicitly use maximum index 1000 and nesting depth 10.

Paths: global JSON/form middleware; revenue CSV preview/process via
`uploadRevenueCsv`; spend CSV preview/process via `uploadCsv`; Custom Integration
upload and retained webhook paths via `upload`. Disabled email-import paths
remain disabled. Existing CSV access guards precede upload parsing; the global
JSON/form parser runs before API authorization. Tests never send malformed
requests to production or to an external host.

Browser callers in `AddRevenueWizardModal.tsx`, `AddSpendWizardModal.tsx` and
`custom-integration-analytics.tsx` use flat field names. Mapping content is a JSON
string and remains unaffected by multipart field-name limits. These limits do
not restrict CSV row counts or mapped campaign values inside JSON. Existing
10 MB file limits, file filters, multipart values, guards and handler responses
are retained. New options use object spread because the installed Multer type
declarations do not yet contain them; execution tests exercise the real options.

## Minimal change

- `package.json` / lock: Express 4.21.2 → 4.22.3, Multer 2.0.2 → 2.5.0 and their
  required dependency tree only. No new direct dependency or major-version jump.
- `server/routes-oauth.ts`: limits on the two existing upload configurations.
- `server/request-parser-security.test.ts`: 19 isolated parsing checks.
- `.npmrc`: disables automatic audit uploads during installs, including existing
  CI/Render install commands, preserving the local advisory-review boundary.
- No database/schema, calculations, source mappings, scheduler, provider
  credentials, account ownership, app routing or frontend changes.

## Validation

Evidence directory: `validation-2026-11-01-dependencies/`.

- `parser-before.json`: nine controls pass, both compressed-parser regressions
  fail by child-process exit with the old Express tree.
- `multipart-before.json`: 13 controls pass; old Multer stalls until the bounded
  child timeout. `parser-final.json` records the intermediate upgrade-only
  failure, plus a CSV-test timeout during a concurrent build; neither was hidden
  or treated as a successful validation.
- `parser-configured-final.json`: **127/127 pass**, seven files, with the final
  limits and `--maxWorkers 2`: request parser 19, Clerk origin 12, auth scope 16,
  security headers 18, CSV input contracts 24, Custom Integration import 35 and
  import rate limits 3. Normal data bytes and mapping fields, malformed/oversized
  input rejection, parser exclusions, bounded structured fields and post-request
  health are covered. Actual Clerk SDK checks are separate from the small parser
  fixture's modeled downstream authorization response.
- TypeScript and the final client/server build both pass and are recorded in the
  validation receipt. The first build printed successful outputs but PowerShell
  treated an existing Browserslist stderr warning as failure; the final command
  preserves npm's native exit status explicitly.
- No persistent test rows, production imports, external emails or provider
  refreshes are created by these tests. These checks do not certify every
  application lifecycle or establish actual new-domain provider consent.

## Advisory evidence and remaining scope

The full public OSV npm dataset was downloaded, then matched locally against the
lockfile. No project dependency inventory was submitted to an advisory service.
The dataset receipt retains its URL, timestamp and SHA-256; the 219 MB public ZIP
stays local. Comparison supports SEMVER introduced/fixed/last-affected/limit
intervals and explicit versions, with eight boundary assertions and no unsupported
ranges in this dataset. Name filtering was refreshed after the lockfile changed.

All previous body-parser, qs, path-to-regexp and Multer version matches are absent
from the final lockfile comparison. Other version matches are candidates needing
reachability review, not proven exploits or automatic reasons to upgrade.
The dependency launch gate remains open pending their supported dispositions.

Primary sources:

- [body-parser advisory](https://github.com/expressjs/body-parser/security/advisories/GHSA-27r3-jxmh-p828)
- [Express 4.22.3](https://github.com/expressjs/express/releases/tag/v4.22.3)
- [Multer array-index advisory](https://github.com/expressjs/multer/security/advisories/GHSA-535w-7cp7-47q4)
- [Multer 2.5.0](https://github.com/expressjs/multer/releases/tag/v2.5.0)
- [OSV public data](https://google.github.io/osv.dev/data/)

## Release and rollback boundary

The code and lockfile must ship together. No database migration is involved.
Record hosted CI and anonymous production health/revision checks after release;
do not replay malformed requests against the live app. A prior app revision can
restore the prior runtime behavior with the same database/schema and production
Clerk configuration, but would reintroduce the documented parser exposure.
The independent retained recovery-key check remains unverified and postponed;
this patch neither repeats that prompt nor claims to close the recovery gate.
