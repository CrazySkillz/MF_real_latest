# V1-052 account-session acceptance

**CLOSED for the original cross-account query cache, client selection and saved
Reports visibility defect.** This closes one security finding, not all account,
notification delivery, provider, or analytics functionality.

The original shared QueryClient survived identity changes. Current `App` creates
a QueryClient per Clerk actor, key-mounts its subtree, and cancels/clears the
previous client. Query fetches consume the abort signal. Client selection uses
`selectedClientId:<actor>` and validates it against the actor's fetched clients.
The later saved-Reports defect was corrected by checking successfully fetched
campaign access before reading or rendering local report metadata.

## Evidence combined without repeating the user's tests

- The user confirmed actual Clerk sign-out, Back, second-account isolation and
  return to Promo. The ordinary Clients transition does not need repeating.
- The [source-access packet](SOURCE_ACCESS_PROCEDURE_2026-10-31.md) subsequently
  proved the actual Reports component displayed the owner's exact fixture and
  hid it from the foreign account. Its persisted scope and cleanup were verified.
  The first packet's unconfirmed owner reappearance is not represented as passed;
  the second packet plus local return/reload coverage supplies the applicable
  positive/negative evidence.
- [New browser regression](../../../server/v1-batch1-notification-session-browser.cjs)
  uses the exact current App cache boundary and real Notifications, Navigation,
  Sidebar, ClientProvider and query defaults. Synthetic API replies/Clerk identity
  isolate the test; all non-loopback requests are blocked.
- Four grouped browser cases prove owner alert/bell rendering, account switch
  clearing cards/bell/filter state, per-actor selection restoration, cancellation
  and late stale-response rejection, sign-out hiding, return and full-page reload.
  Mutation observations detect foreign notification cards between assertions.
- [Focused run](validation-2026-10-31-final/session-focused.json): nine tests pass,
  including the new four-case browser test, existing six-case toast browser test,
  and seven saved-Reports guard tests. The [browser receipt](validation-2026-10-31-final/notification-session-browser.json)
  pins the six actual component/query files. An initial fixture looked for a
  nonexistent search input; it was corrected to the actual priority dropdown,
  without modifying the application or weakening the account assertions.

## Persistent-state inventory for the original boundary

The `client/src` localStorage/sessionStorage inventory was traced:

| State | Current boundary |
| --- | --- |
| Selected client | Actor-keyed, validated against fetched owned client collection; old global key ignored. Real component switch/return/reload tested. |
| Saved report metadata | Campaign access must succeed before reading; final display also rejects absent/mismatched access. Real owner/foreign Reports checks and local pending/denied/storage-event cases pass. |
| Campaign dashboard previous snapshot | Campaign-ID keyed; loading/missing campaign returns before snapshot access in `campaign-detail.tsx`. Per-actor query cache prevents stale campaign data passing that gate. |
| Campaign draft request ID | Client-ID keyed; selected client is actor-scoped. Actual draft/transfer owner boundaries are independently covered by the completed source-access packet. |
| Shopify shop-domain preference | Campaign-ID keyed, restored only in edit mode; wizard is within the campaign-gated analytics/setup flow. Server connection/status accesses remain campaign guarded. It is a preference, not a grant. |
| Sheets tab selection | Campaign/purpose/spreadsheet keyed; mapping fallback requires a new connection result and original campaign scope. Provider connection/select requests use campaign access checks. |
| Platform Comparison selected tab | Campaign-ID keyed and limited to four tab names; contains no campaign data or credentials. |
| Legacy `ga4_token_info` / GA4 session keys | `ga4-client.ts` is referenced only by `TokenExpiryWarning`; that component has no current registered/importing caller. Not used as an authentication source by current campaign pages. No legacy values were erased from the user's browser. |

This inventory does not claim that someone with direct access to the same browser
profile cannot inspect its local storage. Current UI/API account isolation is the
finding's boundary. Notification scheduling, dismiss/recreation semantics and
cross-source analytics remain covered by their own findings.

Only regression files and evidence changed in this close-out. Runtime components,
figures, refresh intervals, production accounts and stored customer data did not.
