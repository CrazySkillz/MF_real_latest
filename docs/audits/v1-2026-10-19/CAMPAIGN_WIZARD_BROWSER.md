# Current campaign wizard: browser lifecycle evidence

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`; observed 2026-10-20 local time. [Index](../../V1_RELEASE_READINESS.md). [Runner](campaign-wizard-browser.cjs), [fixture host](campaign-wizard-fixture.tsx), [five results with exact requests](campaign-wizard-browser-reproductions.json), [confirmation screenshot](wizard-confirmation-fixture.png).

## Boundary

Chromium executed the unchanged `client/src/pages/campaigns.tsx`, its imported controls, React Hook Form, query client, ClientProvider, GA4 connector component and styles. Only Clerk's account-menu button was stubbed. All network requests were intercepted and fulfilled from local assets or deterministic in-memory API fixtures; unknown requests failed the test. Each case used a fresh browser context. No account, campaign, database, provider, scheduler or email service was contacted. The five cases passed their assertions and recorded zero page errors/unhandled requests on the final run. This proves the current browser behavior at the mocked HTTP boundary, not live authentication, server persistence or provider acceptance.

The initial harness run completed the first interaction but failed its network whitelist because the navigation logo was not mapped. The local asset was then explicitly mapped; `import.meta.env.DEV` was set false for production bundling. These were harness corrections, not runtime fixes or waived application failures.

## V1-091 — P1: Back edits diverge from saved campaign settings

`campaigns.tsx:494–504` updates local `campaignData` with every submitted field, but the existing-draft branch PATCHes only `budget` and `currency`. The fixture first created **Original Name / UTC**, went Back, changed name, website, label and timezone to **Changed Name / Europe/Amsterdam**, and continued. The exact request contained only the two budget/currency keys. The in-memory persisted row retained Original Name / UTC while the real confirmation screen displayed Changed Name (`1809–1811`; screenshot visually inspected).

The final Create handler at `656–660` sends platform, selected GA4 filter, initial-import flags and status; it does not recover omitted Details edits. The actual server PATCH consumes the provided partial schema (`server/routes-oauth.ts:9137–9167`); `storage.updateCampaign` applies the supplied fields (`server/storage.ts:698–708`). There is no server access to the browser's unsent name, timezone, website or label. Timezone controls completed-day boundaries, making this more than a cosmetic mismatch. Existing active-campaign editing is a separate path.

Release gate: every editable Details field must survive Back → Next → confirmation → activation/reload with the same saved value. Preserve the native import/configuration invalidation contract; separately test timezone, dates, currency, industry and budget changes.

## V1-092 — P1: Details Cancel bypasses draft cleanup

After the first Next creates a draft, Platform → Back returns to Details. Its Cancel callback at `campaigns.tsx:1358–1360` closes and resets state directly. It does not call `handleCreateModalChange`, whose `883–885` branch requests owner-bound `DELETE ?draftCleanup=1`. The browser fixture recorded **zero DELETEs and one remaining draft**. The positive control, Close on Platform, sent exactly one cleanup request and removed the fixture draft.

Ordinary unsubmitted drafts are filtered from campaign listings by `routes-oauth.ts:9000–9014`; only drafts with an initial-import record can be included. Losing the draft ID therefore leaves no ordinary list/resume route in this tested path. Existing connected child rows could also remain if the user returned through the wizard; that propagation has not been executed here and must not be assumed cleaned. Cleanup request failure is separately swallowed at `884–886`; no live occurrence is asserted.

Release gate: all cancel/close/back exit combinations, including response failure and accepted initial import, must preserve or clean exactly the intended draft. Accepted work must retain its existing protection against accidental draft cleanup. Any historical cleanup requires a separate proven owner/draft/work-state boundary.

## V1-093 — P1: initial draft creation can duplicate and loses recovery identity

The initial Details Next button at `1365–1369` has no pending guard; `handleSubmit:516–542` starts another POST whenever the component has not yet received `draftCampaignId`. Two real browser clicks 35ms apart with 400ms response latency sent two POSTs, created two fixture rows and retained only the last draft ID. Close requested cleanup for one row, leaving one.

A separate fixture persisted the first POST but aborted its response. The actual component showed its failure, remained on Details and reset `draftCampaignId` (`543–547`). Retry issued a new POST and created a second fixture row. No recovery/idempotency identity was sent. The actual POST route at `9037–9071` validates owner/client and calls `storage.createCampaign`; that method at `690–695` inserts and returns a new row without an idempotency lookup. This differs from the later accepted initial-import PATCH, which has explicit recovery handling; that later protection does not cover draft creation.

Release gate: repeated/overlapping submissions and lost responses must resolve to the same intended draft, with exact owner/client scope, and retain a safe resume/cancel path. The browser boundary and server implementation are traced; real database contention for initial draft creation has not been separately executed.

## Positive observations and remaining checks

The tested platform screen offered only Google Analytics. After the fixture service-account/property/campaign selection, confirmation Back returned to campaign selection, then property selection, then authentication, then Platform. The ready source label was **Ready**, with no **Connected** label. These narrow positives align with AGENTS.md and do not certify every wizard branch.

Still required: fresh real service-account permission verification, OAuth mode independently, final activation and durable-worker restart, popup denial/replay, all unavailable/empty/failed imports, cancellation at every in-flight boundary, restored browser state, and full source propagation. Existing [onboarding trace](FINANCIAL_CONTRACT_AND_ONBOARDING_TRACE.md) and [scope inventory](SCOPE_AND_VALUES.md) remain applicable. No runtime behavior was changed.
