# Overview Users across midnight

## Root cause and scope

On 11 November 2026, a read-only inspection of live Promo found 4,374 native GA4 distinct Users saved for 4 September–9 November. The corresponding daily facts reproduced the displayed 4,375 Sessions and 427 Conversions. After midnight, `GET /api/campaigns/:id/ga4-daily` requested Users through 10 November while displaying the older daily publication. The exact-window guard correctly returned null; the page displayed Unavailable.

The route now requests Users for the latest persisted Overview daily date, only when the saved snapshot ends on that same date. Existing start-date, property, metric and version guards remain. Missing or incompatible data stays unavailable; daily Users are never summed. Requested reporting dates, freshness indicators, refresh schedules, API shape, financial calculations and report generation are unchanged.

Path traced: scoped scheduler publication → daily facts and Overview snapshot → storage reads → ga4-daily overviewTotals.users → GA4 Overview Summary. The scheduler includes zero-valued dates and publishes its daily facts and snapshot together. This is a reader correction, with no persisted-data repair required.

## Validation

- Before the fix, four actual-route midnight cases failed (both reporting modes, nonzero and zero Users).
- After the fix, 143 tests passed across the actual-route parity, distinct Users, saved report publication and Overview reporting-note suites; TypeScript passed.
- Added coverage: before/after midnight, subsequent successful publication, failed refresh crossing midnight, zero Users, missing snapshot/packet/daily rows, wrong start/property and snapshot dates ahead/behind the daily publication. No provider fetch or storage write is introduced.
- Existing report, scope and neighboring calculation checks passed. No source import, historical PDF rewrite or campaign configuration change is required.

Deployment evidence will be recorded separately. This fix is authorized for the Render test app only; live deployment remains outstanding.
