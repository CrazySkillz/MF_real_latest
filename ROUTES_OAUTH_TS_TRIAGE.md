# routes-oauth TypeScript Triage

Generated after the GA4 Stage 3 cleanup pass.

Current baseline:

- `npm run check`: 455 total TypeScript errors
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

- `server/routes-oauth.ts(16678-16683)`: `totalRevenue` and `totalConversions` are missing variables.
  - Inspection result: inside the auto-conversion-value fallback branch after campaign/platform update logic.
  - Do not cast or suppress; determine whether the branch should use existing calculated totals, transformed row totals, or a different variable name.

- `server/routes-oauth.ts(23698-23719)`: quality/score values typed as numbers but assigned objects.
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

Recommended next stage: Stage B, inspect `totalRevenue` / `totalConversions` root cause without editing first.

Reason:

- It may be an actual runtime bug, not just TypeScript noise.
- It is near active auto-conversion-value logic.
- Suppressing it would hide uncertainty in revenue/conversion calculations.

If Stage B confirms a clear one-line variable-name mistake, fix it as its own commit with `npm run check` and `npm run build`.
