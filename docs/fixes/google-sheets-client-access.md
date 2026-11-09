# Google Sheets client access emails

Scope: add client/file-specific service-account access to the existing Sheets chooser, initially on the Render test app only. Existing OAuth and shared-service-account connections, source mappings, date/currency handling and calculations retain their existing paths.

The user pastes a Sheet URL, generates an email, shares that Sheet with the email as Viewer, connects, then selects tabs and maps Revenue or Spend. No default tab selection or per-client Render permission entry is introduced.

The identity is reserved by owner, client and exact spreadsheet ID. Its email includes a short digest because Google Sheet IDs exceed the service-account name limit. Google identity descriptions and immutable IDs are checked before impersonation. Only short-lived, read-only Sheets tokens are issued; tokens/keys are not stored in connection rows. Retired reservations stay reserved after client deletion, as in the existing GA4/Ads pattern; joins to the current client and campaign make them inaccessible.

Migration `0030_google_sheets_client_service_accounts.sql` is additive. `GOOGLE_SHEETS_CLIENT_SERVICE_ACCOUNTS_ENABLED=true` enables new setup, using the existing `GA4_CLIENT_SERVICE_ACCOUNT_JSON` issuer. Disabling new setup preserves refreshes for previously verified identities. Existing financial sources are not rewritten.

Paths traced: prepare/connect → campaign-scoped binding reservation → verified pending connection → selected tabs → existing Revenue/Spend mapping routes → normalized records → existing financial publication. Runtime credentials resolve through storage for previews, imports and automatic refreshes. File-specific credentials cannot fall back to another file during tab discovery/selection. Connection writes recheck client, owner, file and verification within their transactions. Existing campaign transfer is restricted to the same owner/client and two matching drafts. Existing source/campaign deletion removes or deactivates connections; retained binding reservations cannot be adopted by another client.

Local evidence:
- Dedicated identity tests: 25 passed, including isolated token caches, Google identity mismatch/revocation and name collisions.
- Actual HTTP handlers: 18 passed, including unauthenticated/foreign owners, wrong files, failed reads and OAuth/shared-connection preservation.
- PostgreSQL identity tests: 7 passed, including pending→selected persistence, concurrent reservation, transaction guards and idempotent migration.
- Existing selected-row Revenue/Spend and refresh invalidation tests: 144 passed against the isolated local database. These include edit/refresh failures retaining last-good values.
- Neighboring GA4/Ads access handlers: 43 passed. Existing shared Sheets tests: 8 passed.

Hosted acceptance is pending: compare both imported source amounts with explicitly selected rows from the user's test Sheet, execute the existing refresh path after a controlled edit, check stable source IDs/no duplicates and client separation, and inspect the rendered chooser. No live release is authorized by this test-only task.
