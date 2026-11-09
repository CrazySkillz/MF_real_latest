# Google Ads live release preparation — 9 November 2026

## Scope and release boundary

Prepared from live `bd297fdfe460e92485094a2b22990c6ccca81a7d` with only the three tested commits `b37ca81e`, `85be53c1`, and `168ae54a`. Before this release note, the complete Git tree matches deployed test revision `560b81cab6b847ca6865c9730d117984d6f7f0c9` exactly. The scheduled-refresh correction already in production is retained, including value-based credential comparison and the additional client identity guard.

User-visible changes:

- GA4 Overview → Total Spend → Google Ads can generate a client-specific access email, verify Read only access and use the existing spend import.
- A new Google Ads import starts with no campaigns selected; Import is disabled until the user selects one. Saved edit selections remain selected.
- After a spend save, Overview checks pending publication every five seconds for at most two minutes. Values still wait for verified publication. The prior interval could add up to 60 seconds after server processing completed.

No provider queries, date windows, currency handling, metric formulas, reporting output, refresh hours or existing source selections are changed by these improvements. The additive `0029` migration creates the Ads identity reservation table and a nullable binding column; it performs no backfill, deletion or rewrite of existing client data.

## Existing evidence reused

- Access email implementation: 241 focused tests covering actual route handlers, identity hydration, PostgreSQL ownership/binding transactions, import/refresh and disconnect. Repeated verification safeguard: 10 PostgreSQL tests.
- Selection/publication follow-up: 115 focused tests, including actual wizard/Overview browser flows. Required CI on `168ae54a` passed 7,597 current-version tests, TypeScript and build.
- Hosted test selection proof: no default selection; explicit selection enables import at EUR 4.89; existing source and saved edit selection retained; no page errors or data writes during this browser check.
- Hosted test `560b81ca`: the client-specific Ads connection refreshed successfully on 9 November at 16:38:02 UTC. Spend remained EUR 4.89 with the same source ID before/after. This proves that tested connection's provider access and refresh, not every future client's Google permissions.
- Previously completed scheduled-refresh regression checks and live recovery are recorded separately in `google-ads-scheduled-refresh-2026-11-09.md` and are not repeated for this preparation.

## Live configuration and remaining release steps

Read-only preflight at 17:21:56 UTC confirmed the existing issuer is `mimosaas@mimosaas.iam.gserviceaccount.com`, project `mimosaas`. GA4 automatic access setup is enabled. Ads automatic access setup is disabled. Google Ads API returned `403 SERVICE_DISABLED` for this project.

After the user enabled the API, the 17:24:01 UTC read-only request reached Google Ads and returned `401 NOT_ADS_USER`. This confirms the API is enabled; the issuer itself has no Ads account grant, as expected for an issuer rather than a client's reader. It does not prove the project's production access level or a future client's grant. The user confirmed the project currently has Test access; Explorer or higher is required before enabling new real-account onboarding.

1. Google Ads API is enabled in project `mimosaas`; upgrade its current Test access and confirm Explorer or higher access for real Ads accounts.
2. Require the release commit's `unit-tests` check before merging. This note is release preparation, not a deployment authorization or claim that live activation has completed.
3. When release is authorized, retain the current GA4 issuer JSON and existing Ads credentials/allowlists; enable only `GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED=true`. Do not replace credentials or reconnect existing client sources.
4. Merge/deploy the reviewed application revision; confirm the additive migration and deployed SHA. Coordinate the monitor's live application pins with the exact deployed revision. Its dedicated Ads credential support is already deployed for the test app; do not weaken source-read restrictions or change schedules.
5. Perform a focused live acceptance check using a new explicitly identified test source: generate its production email, obtain Read only access from the Ads administrator, verify, select the intended campaign, import and compare against the same Ads campaign/date/currency. Verify zero default selection, source identity, publication and monitor result. This must not overwrite the existing Batch 1 Provider Check connection.

The live project's Ads permissions and post-deployment acceptance are not yet verified. Existing hosted test evidence does not certify a different Google Cloud project.

## Rollback

Keep the additive database objects. Before any dedicated live Ads connection is created, application rollback to `bd297fdf` and restoration of the matching monitor pins is compatible with the additive schema. After dedicated live connections exist, disabling the new-setup flag stops new setup but deliberately retains their runtime token hydration. Do not roll those connections back to code without binding support; use a reviewed forward correction or a rollback retaining the hydration support. Never substitute the old shared account for a dedicated connection.
