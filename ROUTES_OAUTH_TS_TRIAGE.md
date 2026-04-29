# routes-oauth TypeScript Triage

Generated after the GA4 Stage 3 cleanup pass.

Current baseline:

- `npm run check`: 467 total TypeScript errors
- `server/routes-oauth.ts`: still has mixed route errors across GA4, ad platforms, Google Sheets, reports, benchmarks, attribution, and legacy storage interfaces
- Safe rule: fix only one clearly type-only group at a time, then run `npm run check`, `npm run build`, and commit only `server/routes-oauth.ts`

## Safe Type-Only Candidates

These can likely be fixed with local casts or local type aliases if inspection confirms the runtime behavior already exists.

- `server/routes-oauth.ts(18020, 18263, 18301, 18342, 18383, 18424, 18465, 18502, 18539, 18614)`: `string | null` passed where `string` is required.
  - Type-only fix candidate: inspect each call and narrow/guard existing values.
  - Risk: low only if existing null handling is preserved.

- `server/routes-oauth.ts(17284)`: `accessToken` on `never`.
  - Type-only fix candidate: inspect the branch; if the narrowed value is intentionally dynamic, use a local cast.
  - Risk: low only if no branch condition changes are needed.

- `server/routes-oauth.ts(17807)`: overload mismatch.
  - Type-only fix candidate: inspect each call and narrow/guard existing values.
  - Risk: unknown until inspected.

## Needs Schema Or Interface Decision

Do not patch these with casual `as any` unless the product/schema contract is confirmed.

- `server/routes-oauth.ts(5890)`: `sourceType` on spend records.
  - Risk: financial persistence shape.

- `server/routes-oauth.ts(7624, 7656, 16513, 16518, 26166)`: `conversionValue` on ad connection updates.
  - Risk: connection schema/contract drift.

- `server/routes-oauth.ts(23062)`: `lastRefreshAt` on ad connection update.
  - Risk: connection schema/contract drift.

- `server/routes-oauth.ts(25770)`: `columnMappings` on Google Sheets connection update.
  - Risk: connection schema/contract drift.

## Possible Real Logic Bugs

Inspect before editing. These may indicate broken or incomplete route logic.

- `server/routes-oauth.ts(16678-16683)`: `totalRevenue` and `totalConversions` are missing variables.
  - Risk: real logic bug, not just typing.
  - Inspection result: this is inside the auto-conversion-value fallback branch after campaign/platform update logic.
  - Do not cast or suppress; determine whether the branch should use existing calculated totals, transformed row totals, or a different variable name.

- `server/routes-oauth.ts(23698-23717)`: quality/score values typed as numbers but assigned objects.
  - Risk: possible broken response construction.

- `server/routes-oauth.ts(27051)`: comparison of incompatible literal types.
  - Risk: possible dead/unreachable branch or stale value-source logic.

## Broader Legacy Storage Drift

Treat as a separate cleanup stage, not part of the GA4 critical cleanup unless a specific route is actively needed.

- Benchmark/report methods around `20897-22079`.
- Attribution methods around `22160-22737`.
- Snapshot/comparison methods around `23355-24205`.
- Later benchmark method drift at `27266`.

## Recommended Next Code Fix

Next safest code fix:

1. Inspect `server/routes-oauth.ts(17284)` and fix only if it is a local narrowing issue.
2. Otherwise inspect the `string | null` errors around `18020-18614` and fix only with local guards/defaults.
3. Do not fix `totalRevenue/totalConversions` as a type-only cleanup; handle it as a separate root-cause bug.
