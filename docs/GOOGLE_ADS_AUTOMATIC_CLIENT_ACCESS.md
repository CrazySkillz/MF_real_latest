# Google Ads access emails — test release

Scope: GA4 Overview → Total Spend → Google Ads. This adds an alternative to Google sign-in for the existing Spend-only connection. It does not change campaign selection, date windows, currency, spend aggregation, schedules, formulas or report generation.

## Client flow

1. Enter the 10-digit Google Ads Customer ID.
2. Click **Generate access email**.
3. In Google Ads, an account administrator opens **Admin → Access and security → Users → +**, adds that exact email with **Read only** access.
4. Return and click **Verify connection**. The app verifies the actual customer, currency, timezone and initial API data read before saving the connection.
5. Select campaigns and click **Import spend**, using the existing import path.

Google may require an administrator to use a passkey when granting account access. This method avoids the app's interactive OAuth authorization, but cannot bypass Google's account security requirements.

## Configuration and ownership

- New setup is opt-in: `GOOGLE_ADS_CLIENT_SERVICE_ACCOUNTS_ENABLED=true`.
- Reuses `GA4_CLIENT_SERVICE_ACCOUNT_JSON` as the issuer. Its project must enable the Google Ads API as well as the existing IAM/credentials APIs. Enabling Ads grants Test API access; real Ads accounts require Explorer access or higher on the Google Cloud Google Ads API Overview page. Google sunset developer tokens on September 9, 2026; no developer token is required. Existing optional token handling is preserved.
- Email: `<client-name>-ads-<customer-id>@<issuer-project>.iam.gserviceaccount.com`; client portion normalized and shortened to meet Google's 30-character account ID limit.
- Migration `0029_google_ads_client_service_accounts.sql` adds a reservation table and nullable connection binding; existing records are not rewritten.
- Reservation scope is owner + client + Ads customer. Campaigns belonging to that same client reuse its identity. A name collision with another client fails closed. Limit: 20 reserved Ads customers per client.
- Google identity creation reuses the existing GA4 issuer transport. Description marker, project, email and immutable Google identity must match; foreign/deleted/recreated identities are never adopted.
- Only short-lived Ads tokens are minted. No client keys or access/refresh tokens are saved. Every runtime hydration checks current campaign/client ownership and verified binding before using the token cache.
- Existing OAuth and shared-service-account connections retain their existing paths. Dedicated connections never fall back to the shared account. Disabling new setup does not disable refresh of already verified dedicated connections.
- Connection save rechecks ownership in its transaction. Repeated verification retains existing connection and spend rows. Existing OAuth/shared connections and orphaned active Ads sources cannot be overwritten.
- Existing campaign-scoped disconnect removes connection/facts using the established path. Identity reservations remain to prevent accidental email reuse. Reconnection requires verification again through the provider.

## Validation boundary

New tests execute the actual API handlers, helper code, PostgreSQL storage transactions and the real spend wizard component. Cases cover unauthorized/foreign owners, unprepared identities, account/currency/timezone mismatch, provider denial or partial reads, identity collision/recreation, repeat requests, legacy connections, nullable-column rollout, missing verification and exact selected campaign import payloads.

Related existing GA4 access, Google Ads import/refresh/disconnect and durable-work invalidation tests remain part of the release checks. Synthetic browser/provider tests do not prove real Google Ads access. Hosted acceptance still requires the generated email to be granted access, followed by a successful read and source comparison. Deploy only to the test app for this release.

Monitoring must use the updated credential hydration and permit the exact Ads token request while retaining its read-only provider-query restrictions. No live application deployment or live database migration is part of this release.

Official references: https://developers.google.com/google-ads/api/docs/oauth/service-accounts, https://developers.google.com/google-ads/api/docs/oauth/security-requirements and https://developers.google.com/google-ads/api/docs/api-policy/access-levels.

## Test release evidence — 9 November 2026

- App commit `85be53c117209cbfd0376d006972a9cc91bc8822`: required CI passed 7,596 tests, TypeScript and build. Render test deployment `dep-dbog6ujrjlhs73bbht5g` is serving that commit.
- Local focused validation: 241 tests across access, browser, PostgreSQL, import, refresh and disconnect paths; the final retry safeguard also passed the 10 PostgreSQL binding tests.
- Deployed browser: generated the same access email on retry, no page errors, input stayed fixed while typing. Database confirmed one prepared identity, zero Ads connections and the existing one active spend source retained.
- Real Ads reads using the newly generated identity remain unverified until Google Cloud Explorer access and the Ads administrator's Read only grant are completed. No spend was imported for this hosted preparation check.
- Live application revision remains `673153c98ab4b651e72ad23fe2f1b7ee7f3bce3c`; no live app release or live database migration was performed.

## Spend selection/display follow-up — 9 November 2026

Test application `168ae54ac36342050d9284af67a715c24a23d489` starts new Google Ads imports unselected and checks pending financial publication every 5 seconds for at most 2 minutes after a Spend save. Saved edit selections and existing publication verification remain intact. Observed source save at 14:58:12 UTC completed financial work at 14:58:15 UTC; the previous browser interval could add up to 60 seconds afterward.

The paired monitor changes only the test revision pins. The exact application diff contains no metric calculations, report rendering, provider queries, persistence or scheduled refresh changes; it is equivalent to the existing pinned replay for figure comparisons. Live revision pins, replay hashes, source permissions and monitoring schedules are unchanged. Focused application validation passed 115 tests, including the actual wizard and Overview browser flows.
