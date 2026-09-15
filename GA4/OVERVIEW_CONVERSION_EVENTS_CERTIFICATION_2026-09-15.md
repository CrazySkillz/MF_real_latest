# GA4 Overview Conversion Events Certification — 2026-09-15

## Decision

**Status: PRODUCTION_READY for GA4 Overview → Conversion Events only, at deployed runtime `176d02ef00a65091917136f1ed2bd8c7cc817fcb` and the exact boundary recorded below.**

This decision does not certify GA4 Overview as a whole. Landing Pages remains pending as requested. Campaign Breakdown and every other previously certified section retain their own evidence and were not re-certified here. Google Ads is excluded.

The first deployed candidate, `4b5f14af895451c26827be2a19452d0c10626825`, was not certified: its authenticated read-only audit failed because GA4 omitted protobuf-default `rowCount: 0` on a valid empty primary-attribution response. The affected path was immediately treated as unproven. Follow-up runtime `176d02ef00a65091917136f1ed2bd8c7cc817fcb` accepts only GA4's header-complete canonical empty response as zero rows and continues to fail closed for missing row count on noncanonical/nonempty responses. All local and deployed gates were rerun after that correction.

## Certified Boundary

- Surface: GA4 campaign analytics → Overview → Conversion Events.
- Provider: GA4 Data API `runReport` for the exact saved GA4 property and campaign values.
- API: `GET /api/campaigns/:id/ga4-conversion-events?window=import-to-date&propertyId=...&limit=50`.
- UI: the four-column Conversion Events table.
- Browser PDF: custom Overview report with Conversion Events selected.
- Scheduled/server PDF composition: exact provider arguments, four-column values, first-25 row limit, and selected-input failure behavior under the focused local fixture.
- Date boundary: saved `importStartDate` through the latest completed day in the campaign reporting timezone.

Report creation, persistence, snapshots, scheduling, email delivery, and report-library lifecycle behavior remain governed by the separate Reports readiness record and are not certified by this document.

## Exact Production Fixture

The final authenticated audit ran against hashed campaign/client/owner/property identifiers and recorded:

- reporting timezone: `Europe/Amsterdam`;
- start date: `2026-07-02`;
- data-through/end date: `2026-09-14`;
- inclusive boundary reported by the application: 75 days;
- provider rows returned by the scoped API: 1;
- event: `purchase`;
- Conversions: 295;
- Event Count: 295;
- Users: 295.

The production fixture was populated, so production populated-row behavior is proven. The successful empty state and fractional-conversion display are covered by focused local tests rather than this particular production dataset.

## Provider Contract Proven

1. The provider method requires an explicit property ID and retrieves the active connection by exact campaign/property scope.
2. The returned connection property is normalized and compared with the requested property; mismatch fails as no connection.
3. A nonempty saved campaign filter is mandatory. Missing scope fails closed instead of broadening to property-wide data.
4. The primary request uses `sessionCampaignName` with exact, case-insensitive matching for every saved campaign value.
5. Only when the complete primary result has no positive conversion rows does the method try `firstUserCampaignName`, then `firstUserManualCampaignName`, using the same exact saved values.
6. Attribution models are not merged, maximum values are not selected, and fallback request failures are not swallowed.
7. `pageLocation` is not used to create or supplement Conversion Events rows.
8. Provider requests use `eventName` with `conversions`, `eventCount`, `totalUsers`, and the existing native revenue metric retained in the API contract; Revenue is not exposed in the table or PDFs.
9. Conversions are parsed as finite nonnegative numbers and retain fractional GA4 attribution credit. Event Count and Users must be finite nonnegative integers. Unsafe values fail closed.
10. Provider pages are requested with deterministic `Conversions DESC, Event ASC` ordering and offsets until the complete provider row count is retrieved.
11. Missing/changing counts, empty intermediate pages, overflow, more than 100,000 provider rows, malformed JSON, and duplicate exact event names fail closed.
12. GA4's header-complete canonical empty response may omit protobuf-default `rowCount: 0`; that exact shape is accepted as zero rows. An otherwise missing row count remains an error.

## Zero-Conversion Decision

The documented ambiguity is resolved as follows:

- Conversion Events displays only native GA4 event rows with `Conversions > 0`.
- Zero-conversion rows, including ordinary `page_view` traffic, are deliberately excluded.
- A successful empty result means the complete primary and both fixed-order exact fallback queries contained no positive conversion rows.
- Campaign-level conversions, imported revenue, page-location traffic, and inferred allocations are never used to manufacture an event row.

This is different from table grains such as Landing Pages where a provider-native zero conversion value can remain meaningful. That Landing Pages behavior is outside this certification.

## API And Ownership Contract Proven

- `ensureCampaignAccess` executes before campaign data is returned.
- Missing authentication and foreign ownership fail without exposing campaign data; the deployed cross-owner request returned the non-enumerating denial.
- The route requires an explicit property and a nonempty saved campaign scope.
- Import-to-date requests resolve the saved connection's `importStartDate` and the latest completed campaign-reporting-timezone day.
- The exact start/end values are passed to the provider method and returned in the response.
- Read-only validation returns `Cache-Control: no-store`, `X-GA4-Validation-Read-Only: 1`, and `X-GA4-Credential-Refresh-Allowed: 0`.
- An authentication failure in read-only mode returns `TOKEN_EXPIRED` without refreshing or persisting credentials.
- Unauthenticated, cross-owner, and different-property deployed requests were all denied.

## UI, Refresh, Failure, And Last-Good Contract Proven

- The query key contains campaign ID, fixed window, and selected property.
- Placeholder data is reused only when campaign, window, and property are unchanged.
- Conversion Events refetches on initial load, browser focus, reconnect, and every 10 minutes while the page remains open.
- Read-only page validation includes `readOnly=1` in the Conversion Events request.
- Initial loading, successful empty, initial unavailable, and cached last-good states are distinct.
- A deployed injected focus-refetch failure retained the last successful row and produced the page-level partial-refresh warning.
- Removing the injected failure and reloading returned exact row parity with the initial successful API response.
- Browser PDF preflight rejects an initially unavailable Conversion Events input but permits valid cached last-good data.

## UI And PDF Parity Proven

The UI, browser PDF, and scheduled/server PDF use the same columns:

1. Event
2. Conversions
3. Event Count
4. Users

Revenue is absent from all three surfaces. Each renderer uses the same first 25 API rows. Conversion formatting preserves fractional credit; Event Count and Users use integer formatting.

The deployed browser PDF contained the same `purchase`, 295 Conversions, 295 Event Count, and 295 Users values as the authenticated API and rendered UI. The scheduled/server PDF fixture separately proved exact provider arguments, first-25 behavior, fractional `2.5` rendering, Revenue exclusion, and fail-closed behavior when selected Conversion Events input is unavailable. An actual production scheduled-report job was not executed, so scheduling/delivery lifecycle behavior is not claimed here.

## Validation Evidence

Final corrected-candidate results:

- focused Conversion Events/provider/API/PDF plus adjacent GA4 filter packet: 4 files, 55 tests passed, 0 failed;
- protected adjacent packet run earlier in the same change: 9 files, 171 tests passed, 0 failed;
- current-version boundary: 2,017 total tests, 1,976 passed, 41 repository-classified deferred failures, 0 blocking current-version failures;
- TypeScript: `npm run check` passed;
- production build: `npm run build` passed;
- staged/diff whitespace validation: passed;
- deployed health: HTTP 200 at exact SHA `176d02ef00a65091917136f1ed2bd8c7cc817fcb`;
- authenticated deployed read-only audit: passed;
- API/UI/browser-PDF value parity: passed;
- focus refetch, cached last-good, and reload parity: passed;
- application persistence fingerprint before/after: unchanged;
- database validation transaction: read only and rolled back;
- temporary authentication session: revoked by the audit cleanup path.

The 41 visible deferred failures are not counted as passes. They belong to repository-deferred work outside this Conversion Events boundary, including the explicitly excluded Google Ads work.

## Evidence Limits

Proven in production for the exact fixture and runtime:

- exact campaign/property/date scope;
- populated provider/API/UI/browser-PDF values;
- zero-conversion exclusion;
- access isolation;
- focus/reload behavior and cached last-good preservation;
- mutation-free validation.

Proven by focused deterministic local tests, not observed in the one-row production fixture:

- multi-page provider pagination and changing/incomplete page failures;
- duplicate event rejection;
- malformed and unsafe numeric response rejection;
- fractional conversion credit through API/UI/PDF formatting;
- successful zero-row state;
- ordered progression through both first-user fallback dimensions;
- scheduled/server PDF output and selected-input failure behavior.

Not claimed:

- Landing Pages readiness;
- overall GA4 Overview readiness;
- Google Ads behavior;
- report scheduling, snapshots, email delivery, inbox receipt, or report-library lifecycle;
- behavior for a different deployed SHA, property configuration, campaign filter, timezone, or future provider schema.

## User UI Follow-Up

On 2026-09-15, the user supplied a deployed UI screenshot showing the expected cumulative scope label and exactly the four certified columns. The visible positive row was `purchase` with 48 Conversions, 48 Event Count, and 48 Users; no Revenue column or zero-conversion row was displayed. The user accepted closing Conversion Events under this existing exact certification boundary and deferred an independent Google Analytics Explore reconciliation of that separate 48-value observation.

The screenshot is recorded as a visual UI smoke check only. It does not replace the authenticated provider/API/UI/PDF evidence above and does not promote 48 to a separately provider-reconciled value.

## Repository Actions

- Implementation commit: `4b5f14af895451c26827be2a19452d0c10626825`.
- Canonical-empty follow-up commit and certified runtime: `176d02ef00a65091917136f1ed2bd8c7cc817fcb`.
- The GA4 current-status and testing documentation was subsequently aligned with this certificate. The app-wide master ledger `APP_PRODUCTION_READINESS.md` was not modified.
- No production application data was rewritten or cleaned up.
