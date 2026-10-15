# Mimosaas Tracking: Phase 1 Safety Baseline

Status: Phase 1 complete; Phase 2 schema, persistence, and setup APIs deployed; Phase 3 credentials, ingestion, installation proof, universal browser tracker, protected campaign wizard, and atomic finalization deployed but disabled; automated GTM installation, attribution, daily metric aggregation, exact-date CSV and Google Sheets financial materialization, tracker-scoped Google Sheets setup controls, atomic daily publication, and the campaign-local daily scheduler implemented behind separate disabled flags
Baseline date: 2026-10-15
Last verified production revision: `cf57d398`

## Phase 2 Foundation Status

The isolated tracker schema, migration, immutable raw-event and published-day
contracts, migration-safe campaign/client cleanup, and owner/client/campaign
scoped internal storage methods are implemented in main. Raw-event writes are
idempotent and reject an event ID reused with different immutable data. Active
campaign mappings cannot be duplicated across campaigns on the same website. No
tracker UI, public ingestion, aggregation, scheduler, or GA4 integration is
enabled. Campaign configuration read/create/update and website connection
list/create/update endpoints are ownership-scoped and return 404 unless
`MIMOSAAS_TRACKING_ENABLED=true`. Website writes accept only the URL and
installation method; changes reset verification to pending. Configuration
writes accept only an owned website connection, conversion events, and the
attribution window; changes remain draft. Campaign mapping create/update accepts
only exact `utm_campaign` values, rejects website-wide conflicts, and resets the
configuration to draft in the same database transaction. A separate protected
finalization path is deployed and remains unavailable while the
feature flags are disabled. Migration
`0020_add_mimosaas_tracking_foundation.sql` was applied
to production on 2026-10-14 and verified all 8 tables, 99 required columns, 14
indexes, and 2 immutability triggers.

## Phase 3 Credential Foundation Status

New website connections receive a unique public tracking ID and a random
256-bit secret. Only the secret hash is stored. The plaintext secret is returned
once when the connection is created or its secret is rotated. Rotation keeps an
existing public ID, invalidates the previous secret, and resets installation
verification to pending. Setup responses never expose the stored hash. Migration
`0021_add_mimosaas_tracking_authentication.sql` was applied to production on
2026-10-15 and verified all three credential columns and the unique partial
tracking-ID index. The authenticated raw-event endpoint is deployed behind
the separate `MIMOSAAS_TRACKING_INGESTION_ENABLED` flag, which remains disabled
by default. It enforces exact credentials, website origin, strict non-financial
payloads, event-time bounds, duplicate handling, and rate limiting. A separate
installation-proof endpoint is deployed behind the same flags. It
atomically marks an authenticated same-origin website as verified without
creating a raw analytics event. A universal browser tracker is deployed behind
those flags. Its first proof-only load is excluded from analytics;
later loads send non-financial page-view and visible ten-second engagement
events with stable visitor and 30-minute session identifiers. A protected
campaign-wizard path is deployed: it appears only when both flags
are enabled, requires a verified same-origin installation and exact
`utm_campaign` mapping, and finalizes the configuration and draft campaign in
one scoped transaction. Event attribution processing, daily aggregation,
atomic daily publication, and the campaign-local daily scheduler are
implemented locally behind disabled flags. The Campaign Overview reads only
the latest immutable tracker snapshot; GA4 paths remain separate and unchanged.

Automated Google Tag Manager installation is implemented locally behind the
additional `MIMOSAAS_TRACKING_GTM_ENABLED` flag. It uses short-lived, encrypted
OAuth authorization; lists accessible web containers; recommends only an
exact website-domain match; and creates a dedicated workspace, page-view
trigger, Mimosaas tag, version, and publication. Ambiguous containers require
an explicit choice, and the existing universal installation remains available.
An owner-scoped database claim prevents concurrent requests from publishing
the same installation twice and is released only by the attempt that owns it.
The database stores GTM installation identifiers and publication metadata, not
the plaintext tracking secret or Google access token. The published tag must
still call the existing same-origin installation-proof endpoint before the
campaign can be finalized. The GTM path has not been enabled or validated
against a live Google account. Before enablement, the Tag Manager API and the
dedicated OAuth callback URI must be configured in the Google Cloud project.

Exact `utm_campaign` attribution is implemented locally for stored events.
It resolves only active campaign mappings for the same owner, client, and
website. Events containing `gclid` remain pending so Google Ads keeps priority;
unknown UTM values become Unattributed; duplicate active matches become a
conflict instead of being guessed. Raw events remain immutable, and attribution
is stored in `mimosaas_tracking_attributions`. A bounded recovery worker retries
only unresolved explicit-UTM events without a `gclid`; it is idempotent across
overlapping application instances and continues after individual failures.
Both paths remain disabled with the tracker feature flags. Google Ads `gclid`
attribution is implemented locally behind the additional disabled
`MIMOSAAS_TRACKING_GOOGLE_ADS_ATTRIBUTION_ENABLED` flag. Provider lookups use
one exact account-local day and explicit selected campaign IDs, run outside the
database transaction, and are revalidated against the event, website, campaign,
OAuth connection, and current selection before persistence. Provider failures
write no attribution; unresolved clicks remain pending with database-paced retries;
multiple matches and `gclid`/UTM disagreements become conflicts. This path has
not been enabled or verified against a live Google Ads click. Returning-direct
attribution is implemented locally behind the additional disabled
`MIMOSAAS_TRACKING_RETURNING_DIRECT_ATTRIBUTION_ENABLED` flag. It considers only
untagged visits with an empty or same-site referrer, uses the latest original
UTM or `gclid` proof for the same visitor and website, enforces the required
30-day attribution window, and never renews that window from an
inherited visit. Partial tags and external referrers become Unattributed;
equally recent conflicting proof becomes a conflict; newer unresolved source
evidence keeps the direct event pending. Campaign Overview never reads these
mutable attribution rows directly.

Daily metric aggregation is implemented locally behind the additional disabled
`MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED` flag. It accepts only an active,
owned Mimosaas Tracking campaign and one completed date in that campaign's
reporting timezone. It reads only final exact-campaign attribution rows and
calculates distinct users, distinct sessions, page views, selected conversion
events, and engaged sessions. Engagement requires a ten-second engagement
event, at least two page views, or a conversion in the same campaign-day
session. Pending or damaged attribution causes the campaign-day write to fail
closed. The mutable campaign-day row is written with an idempotent upsert and is
not an executive snapshot. Only the separately gated daily scheduler calls it;
no route or Overview consumer reads it.

Atomic daily publication is implemented locally behind the additional disabled
`MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED` flag. It locks one owned, active
Mimosaas Tracking campaign-day run and writes the immutable daily snapshot plus
the finalized run state in one transaction. It publishes website metrics when
Revenue or Spend is truly absent and records those values as unavailable. If a
financial source is configured, publication requires an exact-date
`financial_daily_snapshot_v1` row whose currency, reporting timezone, tracker
conversion authority, and complete campaign-scoped Revenue and Spend source-ID
sets match. GA4 provenance is rejected. Missing aggregates or financial
readiness leave the day pending, and a finalized day is returned without
rewriting its immutable snapshot. Only the separately gated daily scheduler
publishes this path. Campaign Overview reads the latest immutable result through
the protected snapshot route; no live database execution has been performed.

The daily scheduler is implemented locally behind the additional disabled
`MIMOSAAS_TRACKING_DAILY_SCHEDULER_ENABLED` flag. It evaluates 08:00, 14:00,
and 20:00 in each campaign's own reporting timezone, aggregates before
publication, retries durable pending dates oldest first, stops before a newer
day when an older day remains pending, and skips finalized days. Database run
claims prevent concurrent application instances from processing the same
campaign-day attempt, while failures in one campaign do not stop another.
Campaigns created after the target reporting day are excluded. The existing
GA4 and general auto-refresh schedulers are unchanged. During the same locked
publication transaction, date-mapped tracker CSV sources can produce an
exact-date financial snapshot when every configured CSV source has an explicit
row for that date. The tracker scheduler now refreshes campaign-scoped,
date-mapped Google Sheets Revenue and Spend before aggregation and publication.
The refresh atomically replaces only that source's records, requires campaign
currency, and treats a successful post-cutoff full-sheet refresh with no row for
the target date as a proven zero. Refresh failure, stale evidence, manual,
undated, incomplete, and other provider-backed sources fail closed and keep the
day pending. Campaigns with no configured
Revenue or Spend source can publish website metrics with those values marked
unavailable.

## Purpose

This document records the safety boundary for direct Mimosaas website
tracking. The deployed foundation remains disabled and does not change
production data, current campaign behavior, GA4 imports, financial
calculations, or scheduler behavior.

## Baseline Evidence

All checks below ran from an isolated clean worktree at the exact revision
reported by the production `/api/health` endpoint.

| Check | Result |
| --- | --- |
| TypeScript (`npm run check`) | Pass |
| Production build (`npm run build`) | Pass |
| Focused campaign deletion, GA4 scheduler, snapshot, and Google Ads guards | 65/65 pass |
| Full Vitest suite | 2,236 pass; 116 fail; 2 skipped |
| Current-version boundary | 73 blocking failures; 43 deferred failures |
| GA4 Overview certification gate | Pass: status internally consistent |
| GA4 KPI certification gate | Pass: status internally consistent |
| GA4 Insights certification gate | Pass: status internally consistent |
| GA4 Reports certification gate | Pass: status internally consistent |
| GA4 Ad Comparison certification gate | Fail: required accumulation marker is missing |

The full deployed-revision baseline is already red. Those failures predate
Mimosaas Tracking and must not be attributed to this feature. A later phase
must compare its results with this recorded baseline and must keep the focused
65-test safety set green. Passing certification gates proves internal status
consistency only; it is not a new production-readiness claim.

The focused safety set is:

- `server/campaign-delete-cascade-regression.test.ts`
- `server/campaign-overview-ga4-first-regression.test.ts`
- `server/financial-daily-snapshot-writer.test.ts`
- `server/financial-daily-snapshot-readiness.test.ts`
- `server/financial-daily-snapshot-observation.test.ts`
- `server/financial-daily-snapshot-contract.test.ts`
- `server/ga4-daily-scheduler-regression.test.ts`
- `server/ga4-overview-scheduler-snapshot-regression.test.ts`
- `server/ga4-google-ads-scheduler-regression.test.ts`

## Locked Product Boundary

1. Mimosaas Tracking is a new campaign analytics source in the existing
   campaign creation journey.
2. Existing GA4 campaigns continue to use the existing GA4 data path.
3. Existing campaigns are not migrated or merged with Mimosaas Tracking.
4. GA4 rows and Mimosaas Tracking rows are never combined into one campaign's
   traffic totals.
5. Revenue and Spend keep their existing confirmed financial-source paths.
   Browser-supplied monetary values are not trusted as Revenue.
6. A Shopify connector may continue to supply confirmed order Revenue through
   the existing Shopify financial path. It must not also add the same order
   value through a tracking event.
7. The feature remains hidden and disabled by default until its own release
   gates pass.

## Locked User Journey

1. The marketer creates a campaign and selects **Mimosaas Tracking**.
2. Mimosaas detects the available installation path and shows one recommended
   action:
   - an existing Google Tag Manager container: **Connect with Google**;
   - a supported commerce or website connector: **Connect [platform]**;
   - otherwise: **Install universal tracker**.
3. For Google Tag Manager, the signed-in Google user must already have publish
   permission. Mimosaas creates and publishes only its own tag, then verifies
   receipt of a test event. No Mimosaas administrator is involved.
4. The campaign is created only after the selected tracking installation is
   verified and its campaign mapping is valid.
5. Revenue and Spend sources remain optional setup choices. An absent source
   displays **Unavailable** and does not block website metrics.

Connector-specific installers are separate adapters. They all send the same
event contract into the same ingestion, attribution, aggregation, and
publication path.

## Locked Data Contract

The implementation must add new schema-backed records using the existing
`shared/schema.ts` -> `server/storage.ts` -> `server/routes-oauth.ts` flow:

- client-owned website connection and installation status;
- campaign-owned tracking configuration and exact campaign mappings;
- append-only raw events with a unique event ID;
- durable click-resolution and attribution status;
- daily campaign aggregates;
- durable scheduler run and publication state;
- one immutable published daily snapshot per campaign and reporting date.

Every raw event must retain its client, website, campaign-resolution status,
event time, receive time, anonymous visitor ID, session ID, event name, URL,
referrer, UTM fields, and `gclid` when present. Raw records must be idempotent:
the same event ID cannot be counted twice.

No new code may write to GA4 daily tables or change existing GA4 response
contracts.

## Locked Metric Definitions

- **Users:** distinct first-party anonymous visitor IDs for the reporting day.
- **Sessions:** distinct session IDs; inactivity starts a new session after 30
  minutes.
- **Conversions:** selected conversion events, deduplicated by event ID.
- **Engaged session:** a session with at least 10 seconds of engagement, at
  least two page views, or at least one conversion.
- **Engagement Rate:** engaged sessions divided by Sessions.
- **Conversion Rate:** Conversions divided by Sessions.
- **Revenue, Spend, ROAS, ROI, and CPA:** use the existing confirmed financial
  source rules and calculations. Tracker event payloads cannot create Revenue.

The UI must label these as Mimosaas Tracking metrics. It must not describe them
as GA4 metrics.

## Locked Attribution Order

Each event is counted once:

1. If `gclid` is present, resolve it through the campaign-scoped connected
   Google Ads account and selected campaign IDs.
2. Otherwise, use an exact `utm_campaign` mapping.
3. A returning direct visitor retains the last proven campaign for 30 days.
4. A visitor with no proven campaign is stored as **Unattributed**. Mimosaas
   never guesses a campaign.
5. If `gclid` and `utm_campaign` resolve to different Mimosaas campaigns, mark
   an attribution conflict and exclude the event from campaign totals until
   the mapping is corrected. Do not double count it.

Google Ads click resolution must be added as a new client method. Existing
Google Ads campaign listing, daily metric, Spend, scheduler, and snapshot
methods must not be changed to implement it.

## Locked Daily Publication

1. All boundaries use the campaign reporting timezone.
2. At 08:00 local time, collect the previous local day's website aggregate and
   every configured Revenue and Spend source through that same date.
3. Publish only after every configured source succeeds or is explicitly absent.
4. When a configured source fails, keep the last complete snapshot visible and
   mark the new day pending. Never mix dates in the Overview cards.
5. Retry a pending day at 14:00 and 20:00 local time.
6. Once a day is finalized, later scheduled runs skip it.
7. Store run state in the database so a restart or second application instance
   cannot duplicate or lose the run.
8. If Revenue or Spend has no configured source, publish website metrics and
   display that financial value as **Unavailable** for the same reporting date.

The published snapshot is the only source for Mimosaas Tracking Overview
cards and downstream calculations. Raw or partially aggregated rows must never
be rendered as the current executive result.

The protected `GET /api/campaigns/:id/mimosaas-tracking/daily-snapshot` route
returns only the latest immutable published snapshot for the owned active
Mimosaas Tracking campaign. It does not fall back to GA4, mutable daily
metrics, or incomplete publication runs. Campaign Overview consumes only this
route. Its Revenue and Spend actions open the existing Google Sheets wizards
with a locked tracker context and require an explicit Date column.

## Protected Existing Paths

Later phases must preserve, without widening or reinterpreting them:

- GA4 campaign creation and initial import;
- `server/ga4-daily-scheduler.ts` ordering and ownership;
- GA4 daily storage replacement and Overview snapshot behavior;
- `financial_daily_snapshot_v1` and its GA4 consumers;
- current Revenue, Spend, ROAS, ROI, CPA, and currency rules;
- current Google Ads aggregate metrics and Spend behavior;
- campaign/client ownership checks and campaign deletion cascade;
- GA4 Overview, KPI, Benchmark, Ad Comparison, Insights, and Reports response
  shapes and routes.

## Required Tests Before Enabling the Feature

1. Tenant, client, website, and campaign ownership for every create, read,
   update, delete, ingestion, and scheduler path.
2. Event authentication, replay protection, duplicate event IDs, malformed
   payloads, clock skew, and rate limits.
3. UTM, `gclid`, returning-direct, unattributed, and conflict attribution.
4. Session timeout, unique users, conversions, engagement, timezones, midnight,
   daylight-saving transitions, and late events.
5. Scheduler restart, concurrency, retry, source failure, finalized-day skip,
   and last-complete-snapshot retention.
6. Revenue and Spend absent, zero, unavailable, failed, and successfully
   refreshed states, including derived financial values.
7. Campaign and client deletion with no effect on unrelated tenants or legacy
   GA4 campaigns.
8. Contract guards proving that existing GA4 tables, endpoints, schedulers,
   calculations, and UI response shapes are unchanged.
9. A full mock path through a real test page and the installed tag, followed by
   one live UTM visit and one genuine Google Ads click. A fabricated `gclid`
   cannot be treated as live Google Ads proof.

## Release Rule

Implementation must proceed in small, feature-flagged slices. No UI route,
scheduler, downstream calculation, or production ingestion is enabled until
its complete lifecycle is traced and its targeted regression set passes. The
pre-existing full-suite failures remain explicit blockers for any broad
production-readiness claim.
