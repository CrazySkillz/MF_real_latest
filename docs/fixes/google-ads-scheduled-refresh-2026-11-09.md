# Google Ads scheduled refresh credential comparison

## Confirmed cause and scope

Batch 1 Provider Check (campaign hash `156b23ba019e`, client Batch 1 Validation) failed its 9 November 08:00 and 14:00 Europe/Amsterdam refreshes. Both logs report `GA4_REFRESH_TARGET_SCOPE_CHANGED` at Google Ads spend replacement. The persisted generic `owned_pipeline:GA4_PROVIDER_REQUEST_FAILED` code does not mean Google rejected access.

Trace: GA4 scheduled work/ownership claim → financial-source refresh → `refreshGoogleAdsForCampaign` → provider read → daily-fact replacement in `server/storage.ts` → selected-source materialization → GA4/downstream publication. The replacement guard compared JSONB `encryptedTokens` by object identity. Separate PostgreSQL reads create different objects with identical contents; even the service-account token envelope triggers the false mismatch. Existing token-renewal guards already compare these envelopes by content.

## Localized correction

Use the existing `isDeepStrictEqual` helper for `encryptedTokens` in the dedicated and retained legacy Google Ads daily replacement guards. All other campaign, source, customer, method, ownership, lease and mapping checks remain unchanged. No formulas, provider queries, schedules, response contracts, schema or stored settings change.

## Evidence and limits

- Four real-PostgreSQL cases reproduced the exact failure before the correction: service account and OAuth, dedicated and legacy storage.
- The corrected path passes 540 focused tests across financial ownership, Google Ads production refresh, ordered pipeline and failure handling. New assertions cover identical separately read token envelopes, exact €4.89 facts, changed credentials/customer/manager/method, cross-campaign writes and expired leases. Existing tests cover changed source mappings, rollback, provider failures and downstream ordering.
- The failure occurs before daily-fact replacement commits. Last-good Ads facts were preserved. Existing failed-work audit rows must remain intact; use the existing owner-guarded campaign run-now path for recovery after deployment, rather than editing historical completion records.
- Hosted recovery and monitoring verification are pending until deployment. This fix does not recertify unrelated sections or sources.
