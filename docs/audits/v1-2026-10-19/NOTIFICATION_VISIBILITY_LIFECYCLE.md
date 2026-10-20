# Notification visibility and lifecycle boundaries

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Fifteen executed cases](notification-visibility-reproductions.json), [runner](notification-visibility-reproductions.cjs). Actual registered route handlers, identity/access helpers, KPI resolution function and email episode selector are transpiled from current code. The database is an in-memory predicate evaluator with deterministic interleaving. This proves overwrite behavior, not PostgreSQL lock scheduling, provider delivery or the full browser journey. No runtime changes or real messages.

## Current controls and visible values

`client/src/pages/notifications.tsx:1–718` and `components/layout/navigation.tsx:1–80` were read through the complete render. Bell polls the owner-scoped list every30seconds and indicates visible performance alerts independently of read state. It does not render read/clear/dismiss controls. The page offers Priority, Client, Campaign and Date filters, ten-row pagination, selected-item highlighting, View KPI/Benchmark navigation, and explicit unavailable/verification/empty/missing-selected states. Internal filter values `this-week`/`this-month` correctly render **Last7Days/Last30Days**, not calendar week/month labels. Title, client/campaign labels, priority, current value, threshold and created date are visible. Unit formatter preserves fractional values up to four decimals, formats ISO currency codes and explicit percent/ratio/seconds. Threshold qualifier comes from alertCondition. Created-date display uses browser timezone; cross-timezone/DST acceptance remains unverified.

The declared `deleteNotificationMutation` at77–109 has optimistic removal/rollback/refetch logic but no rendered caller. Searches of current client code found no mark-all-read/clear/read-state request caller. These registered API routes stay in scope; do not give the user invented instructions to find a dismiss button. This aligns with `docs/CURRENT_APP_SECTIONS.md:366` and corrects the earlier audit inventory's UI/API conflation.

The page sequentially requests GA4 reconciliation for each owned GA4 campaign before refreshing the list. An authenticated browser test must isolate these POSTs. List/campaign/reconciliation errors render Notifications unavailable rather than No active alerts. The bell destructures only data, so its initial-error attention state has no distinct error indication; no assertion of an explicit false all-clear message is made. Bell/page consistency under errors, source mutation and multiple concurrent viewers remains a required browser gate.

## API, ownership and history

`GET /api/notifications`, routes7493–7605, joins campaign ownership, excludes missing parents, dismissed/resolved and standalone Shopify refresh failures, validates linked KPI/Benchmark campaign identity, resolves eligible current values, and deduplicates visible performance alerts. Performance value resolution errors propagate to500. The no-DB branch separately filters owned campaigns and uses equivalent breach eligibility, but its non-performance linked-item handling differs; this is not a full branch equivalence certificate. The list has no server limit; page pagination is client-only. Complete mixed-source quantity/performance remains unverified.

Four retained write handlers were executed with actual access helpers:

| Route | Proven boundary | Remaining limit |
|---|---|---|
| PATCH `/api/notifications/mark-all-read`7608 | Actor required; only owned campaign IDs; two owned rows changed, foreign/orphan unchanged; reports rowCount2 | Missing DB, concurrent parent deletion and bad stored identities not run |
| DELETE `/api/notifications/all/clear`7646 | Actor required; foreign/orphan untouched; soft-hide, no row deletion | Second-write failure leaves first hidden and returns500; no transaction; retry/concurrent alert creation end-to-end open |
| DELETE `/api/notifications/:id`7689 | Owner200, anonymous401, foreign/missing parent404 with no denied writes | Whole metadata overwrite race below; affected-row outcome unchecked |
| PATCH `/api/notifications/:id`7723 | Same ownership/denial controls for existing fixture rows | `read` is not schema-validated in handler; database malformed/null input behavior and zero-row race not tested |

Storage `deleteNotification:6712` has an atomic JSONB merge/RETURNING boundary, whereas the route builds metadata from an earlier SELECT. That existing helper is a potential architecture-preserving correction pattern, not permission to implement without the agreed queue. `markAllNotificationsAsRead:6725` is an unscoped storage method, but a runtime caller search found only its interface/declaration. Do not report it as a currently invoked global write or remove it without the dependency review.

## V1-110: resolution lost during dismissal

1. Dismiss or clear-all reads notification metadata `{kpiId:kpi-a}`.
2. Actual `resolveKPIAlerts`, `server/kpi-notifications.ts:344–382`, records `resolved:true`, `resolvedAt`, `resolvedReason:cleared` and resets immediate-alert timing where applicable.
3. Actual email episode selector, `server/services/alert-monitoring.ts:116–142`, now returns the cleared episode.
4. The pending dismissal writes a whole JSON string derived from step1, adding dismissal fields but removing all resolution fields.
5. The same selector returns `active:own`: it deliberately treats dismissed-but-unresolved history as an active episode. `claimAlertEmailWindow:87–113` uses that episode for claim deduplication; retry429–435 compares its token. Thus the lost resolution changes downstream claim identity, not only hidden display metadata.

Both dismiss and clear-all interleavings passed assertions. The record remains hidden, and no email was sent in these fixtures. Actual rebreach delivery suppression/retry outcome depends on prior claims and must be tested before assigning a specific observed customer effect. Benchmark resolution uses the same read/spread/write pattern at `benchmark-notifications.ts:384`; it was code-read but not independently interleaved in this packet. `softHideNotification:7455` also builds from a read snapshot and is called from retained item-delete branches. Do not extend two passing cases into certification of all writers.

Acceptance: preserve simultaneous dismissal/resolution metadata, exact owner/campaign/item scope, and current/history distinctions; prove clear→rebreach and dismissed→rebreach email claims and visible lists with real isolated PostgreSQL. Test linked-item delete, campaign/client delete, error/partial clear/retry, scheduler overlap, notification page/bell refresh and natural delivery separately. Existing [two PostgreSQL creation-contention cases](notification-contention-postgres.json) prove a different insertion boundary and do not close this race. No GO for notifications yet.
