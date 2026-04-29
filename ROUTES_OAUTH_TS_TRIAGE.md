# routes-oauth TypeScript Triage

Generated after the GA4 Stage 3 cleanup pass.

Current baseline:

- `npm run check`: 471 total TypeScript errors
- `server/routes-oauth.ts`: still has mixed route errors across GA4, ad platforms, Google Sheets, reports, benchmarks, attribution, and legacy storage interfaces
- Safe rule: fix only one clearly type-only group at a time, then run `npm run check`, `npm run build`, and commit only `server/routes-oauth.ts`

## Safe Type-Only Candidates

These can likely be fixed with local casts or local type aliases if inspection confirms the runtime behavior already exists.

- `server/routes-oauth.ts(16784)`: missing declaration for `google-trends-api`.
  - Type-only fix candidate: add a local declaration file or module declaration.
  - Risk: low if no import/runtime path changes are made.

- `server/routes-oauth.ts(18020, 18263, 18301, 18342, 18383, 18424, 18465, 18502, 18539, 18614)`: `string | null` passed where `string` is required.
  - Type-only fix candidate: inspect each call and narrow/guard existing values.
  - Risk: low only if existing null handling is preserved.

- `server/routes-oauth.ts(19813)`: `validatedEmailAddresses` possibly undefined.
  - Type-only fix candidate: default to an empty array if existing behavior already treats missing recipients as empty.
  - Risk: low after inspection.

- `server/routes-oauth.ts(19907)`: dynamic key indexing into uploaded metric row.
  - Type-only fix candidate: cast the row to `Record<string, any>` at the local lookup.
  - Risk: low if no field names are changed.

- `server/routes-oauth.ts(25984)`: `Set<string>` iterator/downlevel error.
  - Type-only fix candidate: replace direct iteration/spread with `Array.from(...)`.
  - Risk: low.

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

- `server/routes-oauth.ts(17284)`: `accessToken` on `never`.
  - Risk: incorrect narrowing or unreachable branch.

- `server/routes-oauth.ts(17807)`: overload mismatch.
  - Risk: unknown until inspected.

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

1. Fix `server/routes-oauth.ts(25984)` if inspection confirms it is only a `Set<string>` iterator/downlevel error.
2. Run `npm run check` and confirm the count drops from 471.
3. Run `npm run build`.
4. Commit only `server/routes-oauth.ts`.

If that error is not isolated, fix `google-trends-api` typing instead as a standalone declaration-only change.
