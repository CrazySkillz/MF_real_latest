# Current-day reporting rollout

This is an opt-in change to the GA4 campaign and its attached revenue/spend sources. `GA4_INCLUDE_CURRENT_DAY=true` enables it. With the setting absent or false, the existing completed-day behavior is retained. Other main platforms keep their existing date policy.

## User behavior

- First import includes the available source data through today in the campaign's reporting timezone.
- Automatic updates retain 08:00, 14:00 and 20:00 in that timezone. The existing initial-import and source-add/edit refresh paths remain.
- Today is provisional: a successful fetch cannot make a source platform's not-yet-processed data available.
- Financial queries include eligible dated source records through today; future dates remain excluded. Manual CSV uploads still require re-upload for changed file contents.
- A successful financial publication contains confirmed revenue and the corresponding saved CRM Pipeline Proxy values. A Closed Won transition moves the amount out of the proxy and into confirmed revenue in that publication. Proxy amounts are never added to confirmed revenue calculations.
- Failed providers or invalid currency, scope, totals or proxy inputs cannot replace the last valid financial publication.
- Source IDs, campaign scope, import start, deduplication and historical PDF artifacts are unchanged. Existing saved snapshots retain their original window mode.
- The UI and newly generated PDFs identify current-day data as provisional. Recorded dates and update timestamps remain the source of the actual reporting boundary.

## Implementation and validation

The existing date utilities expose GA4-specific opt-in wrappers; original completed-day helpers remain available for calendar comparisons and other platforms. The new snapshot window mode is `initial_import_to_latest_available_day`.

The existing financial publication stores whitelisted CRM display fields. Storage checks the CRM mapping fingerprint again inside the guarded publication transaction. The Overview proxy reads that same financial snapshot rather than a newer provider cache.

Tests added for timezone midnight/DST and all three slots; actual GA4 scheduler query boundaries, same-day replacement and day-two advancement; last-good preservation; financial publication of an open-to-won transition and another source; rendered proxy/revenue consistency; and provisional PDF rendering. These controlled tests are separate from hosted provider verification.

Release status: implementation and validation in progress. Enable only on the Render test service after the release checks pass. Live activation requires its own approved release. No new paid services or database schema migration are required.
