# V1-075 non-GA4 connector-spend acceptance follow-up

Status: committed, pushed and deployed as `adc5a6fe`; hosted run passes. Owned live
acceptance is pending at this checkpoint.

Both retained aliases use `processConnectorDerivedSpend` in
`server/routes-oauth.ts`. They validate owner, campaign currency, explicit platform
context, dated nonnegative records and exact cent reconciliation; storage replaces
the source/records transactionally. The handler then recalculates aggregate
campaign spend and previously called the GA4 KPI/Benchmark recompute unconditionally.

That GA4 helper invalidates GA4 report alignment and rejects targets for which
the GA4 job processes zero campaigns. A non-GA4/draft fixture can therefore have
its spend committed successfully and still receive HTTP 500 from the unrelated
GA4 step. The original positive route fixture only exercised `platformContext=ga4`
and supplied a successful recompute mock, missing this boundary.

The first correction calls that recompute only for `platformContext=ga4`.
It retains the aggregate campaign recalculation for every context and changes no
response shape, source aggregation, dated-record materialization, currency or
ownership behavior. The two endpoint registrations still share one handler.

The [before receipt](validation-2026-10-31-final/connector-context-before.json)
records fourteen failing current-handler cases (seven non-GA4 contexts through
both aliases), each receiving 500 after source save when the unrelated GA4
recompute rejects. The [after focused receipt](validation-2026-10-31-final/connector-context-after.json)
passes 129 checks including those cases, preserved GA4 recomputation, both aliases'
anonymous/foreign denials, input validation, and adjacent Batch 1 configuration
and ingestion controls. These handler tests use synthetic storage/provider
boundaries; deployed materialization and downstream acceptance are still open.

The actual PostgreSQL/API rehearsal then exposed the second boundary: the
shared `spend-to-date` handler unconditionally passed the `Spend` label to the
GA4 Insights guard. That label checks both currency and GA4-only source types,
so an explicitly non-GA4 connector source saved successfully but could not be
read back. The existing guard supports currency-only labels. Explicit non-GA4
contexts now use `Spend total`; GA4 and legacy unscoped requests retain the
original `Spend` restriction. Currency checks remain active for every context.
No shared helper signature or source types were broadened.

[Before-readback evidence](validation-2026-10-31-final/connector-readback-before.json)
contains seven rejected valid non-GA4 reads and four currency negatives stopped
at the wrong source-type guard. [After evidence](validation-2026-10-31-final/connector-readback-after.json)
passes the current handlers plus the GA4 Insights source/currency regressions.
The [isolated PostgreSQL rehearsal](validation-2026-10-31-final-api/rehearsal.json)
passes 18 combined API checks and 13 fixture/cleanup checks, with current durable
work and snapshot tables present and no work/snapshots created for the draft.
Typecheck and build pass. The first full-suite attempt omitted test database
variables (5,534 passed, 1,385 skipped and one setup failure); it is not a passing
release gate. A subsequent run was interrupted after discovering the readback
boundary. The corrected full run uses CI's two disposable database URLs.

The completed full local release run passes **6,935/6,935 tests in 399 files,
zero skipped, zero failures**. Typecheck, production build and the CI-required
GA4 KPI certification gate pass. The committed runtime diff is six additions
and two removals in the existing routes file. Tests also include the account
session regression supporting the V1-052 close-out. No source storage,
aggregation, frontend component or refresh interval changed.

Render health identifies the exact pushed revision with HTTP 200 / `ok:true`.
The [public endpoint checks](validation-2026-10-31-final-api/public.json) confirm
anonymous HTTP 401 on both aliases and both spend-read routes. These requests
carry no session or valid financial input and perform no provider operation.

[GitHub run 41204006137](https://github.com/CrazySkillz/MF_real_latest/actions/runs/41204006137)
passes, including certification, the current-version suite and retained deferred
evidence. The [release receipt](validation-2026-10-31-final-api/release.json)
matches the healthy Render commit to that exact successful workflow.

No owned live API packet has been submitted yet. Scoped positive/cleanup results
must be appended before
claiming this follow-up complete. Existing protected campaign figures, connections
and configured schedules have not been changed.

Separate renewal observation (V1-088): ordinary non-worker token updates for
Sheets/HubSpot/Salesforce/Shopify call `writeGA4RefreshInputChange`. That method can
invalidate refresh-work hashes and report alignment even though only credentials
changed. Worker calls carrying `refreshScope` follow a different guarded path.
Do not call the ordinary metadata endpoints a side-effect-free renewal test or
ask the user to run such a bundle until the effect and a safe test boundary are
resolved. This observation is not yet a reproduced/patched renewal regression;
it does not affect the connector-context corrections above.
