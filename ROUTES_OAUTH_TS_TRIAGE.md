# routes-oauth TypeScript Triage

Generated after the GA4 Stage 3 cleanup pass.

Current baseline:

- `npm run check`: 404 total TypeScript errors
- `server/routes-oauth.ts`: benchmark/report storage-interface drift is fixed; remaining errors are mostly schema/contract drift, possible real logic bugs, and localized type-shape issues
- Safe type-only cleanup is paused; do not continue patching app code until one of the stages below is selected

## Stage A: Schema And Connection Contract Decisions

These errors touch persisted source/connection object shapes. Do not patch with casual `as any` until the intended schema contract is confirmed.

- `server/routes-oauth.ts(5890)`: `sourceType` on spend records.
  - Risk: financial persistence shape.

- `server/routes-oauth.ts(7624, 7656, 16513, 16518, 26162)`: `conversionValue` on ad connection updates.
  - Risk: ad connection schema/contract drift.

- `server/routes-oauth.ts(23058)`: `lastRefreshAt` on ad connection update.
  - Risk: ad connection schema/contract drift.

- `server/routes-oauth.ts(25766)`: `columnMappings` on Google Sheets connection update.
  - Risk: Google Sheets connection schema/contract drift.

## Stage B: Real Logic Bug Investigation

Inspect before editing. These may indicate broken or incomplete route logic.

- Fixed: `server/routes-oauth.ts(16678-16683)` missing `totalRevenue` / `totalConversions`.
  - Resolution: zero-platform branch now logs the zero-platform condition instead of referencing variables scoped to the one-platform branch.

- New candidate: `server/routes-oauth.ts(16287)`: `campaignName` on `matchingInfo`.
  - Risk: response shape may be stale or the declared matching-info type may be too narrow.

- Remaining: `server/routes-oauth.ts(23694-23713)`: quality/score values typed as numbers but assigned objects.
  - Risk: possible broken response construction.

- `server/routes-oauth.ts(24027, 24127)`: `Date` assigned where a string is expected.
  - Risk: report/snapshot payload shape may need exact serialization.

- `server/routes-oauth.ts(24181)`: missing `targetValue` on benchmark row type.
  - Risk: benchmark schema or route expectation drift.

- `server/routes-oauth.ts(24404)`: missing `objective` on campaign row type.
  - Risk: campaign schema or route expectation drift.

- `server/routes-oauth.ts(27047)`: comparison of incompatible literal types.
  - Risk: possible dead/unreachable branch or stale value-source logic.

## Stage C: Storage And Interface Drift Cleanup

Treat this as a broader cleanup stage. Prefer fixing the storage interface contract once, not scattering casts across unrelated routes.

- Fixed: benchmark/report storage method drift around `20899-22081`.
  - Resolution: the exported `storage` instance is now typed as `IStorage`, so routes can use existing interface-declared methods.

- Fixed: attribution/snapshot/comparison storage method drift that was caused by the exported concrete storage union.

- Remaining: report/snapshot insertion shape errors around `24732-24991`.
  - Risk: payload types may not match insert schema, especially numeric/string financial fields.

- Remaining: query parameter narrowing around `25217-25221`.
  - Risk: likely local request-query narrowing.

- Remaining: missing `DetectedColumn` type at `25437`.
  - Risk: likely missing import or stale local type name.

## Recommended Next Stage

Recommended next stage: inspect the next smallest localized Stage C candidate.

Reason:

- The broad storage-method drift is already cleared.
- The safest remaining Stage C target is query parameter narrowing at `server/routes-oauth.ts(25217-25221)`, because it is likely a local type guard with no schema or metric behavior change.
- Avoid Stage A until the intended persisted schema contract is confirmed.

Stop before changing report/snapshot insertion shapes, because those affect analytics/report payload contracts.
