# routes-oauth TypeScript Triage

Generated after the GA4 Stage 3 cleanup pass.

Current baseline:

- `npm run check`: 449 total TypeScript errors
- `server/routes-oauth.ts`: remaining errors are mostly schema/contract drift, possible real logic bugs, and broader storage/interface drift
- Safe type-only cleanup is paused; do not continue patching app code until one of the stages below is selected

## Stage A: Schema And Connection Contract Decisions

These errors touch persisted source/connection object shapes. Do not patch with casual `as any` until the intended schema contract is confirmed.

- `server/routes-oauth.ts(5890)`: `sourceType` on spend records.
  - Risk: financial persistence shape.

- `server/routes-oauth.ts(7624, 7656, 16513, 16518, 26168)`: `conversionValue` on ad connection updates.
  - Risk: ad connection schema/contract drift.

- `server/routes-oauth.ts(23064)`: `lastRefreshAt` on ad connection update.
  - Risk: ad connection schema/contract drift.

- `server/routes-oauth.ts(25772)`: `columnMappings` on Google Sheets connection update.
  - Risk: Google Sheets connection schema/contract drift.

## Stage B: Real Logic Bug Investigation

Inspect before editing. These may indicate broken or incomplete route logic.

- Fixed: `server/routes-oauth.ts(16678-16683)` missing `totalRevenue` / `totalConversions`.
  - Resolution: zero-platform branch now logs the zero-platform condition instead of referencing variables scoped to the one-platform branch.

- Remaining: `server/routes-oauth.ts(23694-23713)`: quality/score values typed as numbers but assigned objects.
  - Risk: possible broken response construction.

- `server/routes-oauth.ts(27053)`: comparison of incompatible literal types.
  - Risk: possible dead/unreachable branch or stale value-source logic.

## Stage C: Storage And Interface Drift Cleanup

Treat this as a broader cleanup stage. Prefer fixing the storage interface contract once, not scattering casts across unrelated routes.

- Benchmark/report methods around `20899-22081`.
- Attribution methods around `22162-22739`.
- Snapshot/comparison methods around `23357-24207`.
- Report/snapshot insertion shape errors around `24663-24997`.
- Query parameter narrowing around `25223-25227`.
- Missing `DetectedColumn` type at `25443`.
- Campaign field drift at `24410`.
- Later benchmark method drift at `27268`.

## Recommended Next Stage

Recommended next stage: Stage C, storage/interface drift cleanup.

Reason:

- It likely fixes many route errors with fewer behavior changes if the methods already exist in `server/storage.ts`.
- It should be handled by validating the storage contract first, then adding missing interface declarations or local aliases in the smallest safe scope.
- Avoid Stage A until the intended persisted schema contract is confirmed.

Start with the benchmark/report method group around `20893-22075`, because those methods are repeated and many likely already exist in `server/storage.ts`.
