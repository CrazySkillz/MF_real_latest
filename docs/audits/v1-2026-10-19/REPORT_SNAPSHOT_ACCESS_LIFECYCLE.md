# Snapshot access, immutable bytes and report edits

Candidate `777aae6f6353e998d60b635d3e66b413093117c2`. [Twenty current-route cases](report-snapshot-access-reproductions.json), [runner](report-snapshot-access-reproductions.cjs). Both registered snapshot handlers execute actual actor/report/campaign access helpers and actual artifact parsing. Database/storage/Clerk identities are fixture-bound. No network, email, production mutation or real edit journey.

## Proven controls

| Scenario | JSON `/api/report-snapshots/:snapshotId`30404 | PDF `/api/report-snapshots/:snapshotId/pdf`30437 |
|---|---|---|
| Owned existing report/parent; matching campaign/platform/type |200 |200, byte-identical stored artifact |
| Anonymous |401 before database lookup |401 before database lookup |
| Malformed snapshot UUID |400 before database lookup |400 before database lookup |
| Foreign report owner |404 |404 |
| Missing report or campaign |404 |404 |
| Snapshot campaign differs from report |404 |404 |
| Snapshot platform differs from report |404 |404 |
| Stored immutable PDF missing |200 metadata row |422, no regeneration on GA4 immutable path |
| Current report template changes Overview→Insights |200 original snapshot |404 despite unchanged original artifact |

The valid PDF bytes are an existing synthetic Sheets audit artifact placed in a fixture GA4 snapshot solely to verify byte preservation and access gates. This deliberately does **not** certify platform/artifact semantic parity; artifact reader validates format/version/length, not metric meaning. It limits PDF data to25MiB and checks canonical base64, declared byte count and PDF prefix (`utils/report-pdf-artifact.ts`). Full malformed/over-limit allocation behavior was code-read, not exhaustively executed here.

## V1-119: current template identity blocks legitimate old artifacts

Current GA4 Reports edit controls open the same template picker as create (`ga4-metrics.tsx:9252–9280,10709–10786`). Selecting another template updates reportType/configuration; save11347 calls update mutation. `PATCH /api/platforms/:platformType/reports/:reportId`, routes30029–30160, validates allowed types but permits changing an existing GA4 report from Overview to Insights. It preserves campaign/platform identities in schema parsing.

PDF handler30460–30465 compares original snapshot.reportType with the **current mutable report.reportType**. The isolated case changes only current report type; original snapshot owner association, campaign, platform, type and PDF remain intact. JSON200/PDF404 results reproduce historical artifact loss of access. This is a retained API/history path defect, not a claim the current Download button always fails: Reports972, Instagram977 and TikTok704 create a new snapshot immediately before downloading. No current UI caller for the historical snapshot-list GET was found in the client source search. Scheduled snapshots and their audit history still exist and stay in release scope.

Acceptance must define historical report identity/version and access independently of later template edits while retaining owner/campaign/platform validation and rejection of inconsistent/corrupt snapshots. Do not simply remove consistency checks to make the example pass. Test report edit/archive/delete and campaign/client deletion, old and newly generated artifacts, schedule retries and library visibility, including damaged legacy rows. Actual edit→database→download and browser history UI are unverified. No runtime fix was made.

## Other traced boundaries and open work

Modern generic report DELETE30163 checks platform match and the storage deletion result, unlike retained Meta zero-row success V1-074. Modern PATCH pins parent/platform, validates schedule/timezone/type and checks actual updated row; concurrent parent deletion and all configuration variants remain open. Snapshot-list30292 selects the report's newest50 rows; complete row-consistency checks, payload size and historic retention/visibility under tester load remain unverified. A correct direct-download guard does not certify the list or scheduled producer. Non-GA4/Diagnostics historical PDF regeneration remains V1-060.
