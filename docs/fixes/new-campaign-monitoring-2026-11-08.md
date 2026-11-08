# New-campaign summary and PDF monitoring

Scope: the 15 unverified assertions from the temporary live onboarding campaign on
8 November. Its source comparison, current summary API values and rendered summary
values had already passed; those checks were not rerun against client data.

Root causes and correction:

- Initial import returns after publishing verified GA4 daily/Overview data. Saved
  Executive and Performance snapshots belong to the subsequent scheduled pipeline.
  The monitor now recognizes their absence only before the first scheduled refresh
  after verified initial completion. It checks campaign ownership, property,
  currency, timezone, selection, receipt dates and the exact published input hash.
  Existing, damaged, overdue or out-of-scope snapshots retain the original checks.
  Current summary API/screen comparisons remain mandatory and unchanged.
- The browser PDF parser used `Trends` as the end of the financial-card block.
  Both Insights and Custom PDFs omit that block when no trend dates are eligible.
  The parser now also recognizes `Data Summary`, so all five financial cards are
  checked even without a trend table.
- Insights history starts on the campaign's creation date, not the initial import
  start date. When creation is after the completed-day cutoff, an omitted table is
  expected. The server check additionally requires the actual zero Days of Data
  card. Both parsers reject fabricated dates; existing eligible history cannot be
  replaced by an empty-history message. Browser dates must match the expected dates.

Only monitor code and tests changed. No application rendering, import, scheduler,
financial calculation, permissions, database or existing PDF records changed.

Validation before deployment:

- 181 focused tests passed across the source/stored, API/report, browser-parser and
  actual-PDF suites, including wrong totals/currency, missing cards, foreign owners,
  changed input hashes, invalidated work, overdue snapshots and lost history.
- The new integration tests generate and parse real Insights and Custom PDF bytes
  using known source inputs, an exact financial publication, no saved Executive or
  Performance snapshots and no post-creation daily history. Missing spend stays
  unavailable. Mutating the revenue output fails the independent comparison.
- Isolated actual React screen/browser-export replay using recorded test inputs and
  a synthetic creation date after the cutoff: 60 affected assertions passed across
  Executive Summary, Performance Summary, Insights PDF and Custom PDF. No live
  service requests or client-data writes. Evidence is in ignored
  `.local-test/new-campaign-browser-result.json` and the two exported-text files.

This closes the identified new-campaign monitor cases. It does not certify unknown
historical inputs, arbitrary future code changes or unavailable source values.
Deployment/hosted execution evidence is recorded separately after release.
