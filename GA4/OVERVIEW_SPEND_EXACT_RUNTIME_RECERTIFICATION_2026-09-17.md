# GA4 Overview Spend — exact-runtime recertification, 2026-09-17

## Decision and boundary

**CLEAN-CERTIFIED / PRODUCTION_READY for the bounded, existing-source GA4 Overview Spend display and refresh path at deployed application commit `5232f8978a4f70e05652d23459aeb9c964e7a83d`.** Required steps remaining for this exact boundary: **0**.

Included: Campaign2 (`d9c8a3b7c4d0`), GA4 property `542352127`, USD, its active Google Sheets and CSV Spend sources, the Total Spend card/source modal, and the Spend input to Performance. Google Ads is **NOT CONFIGURED / EXCLUDED**. Other campaigns, currencies, providers/configurations, production add/edit/delete mutations, independent spreadsheet truth reconciliation, global scheduler health, and the whole Overview tab remain outside this decision. Existing Spend/source certificates are preserved, not rewritten.

## End-to-end evidence

The traced path is saved GA4-context source mapping → normalized dated spend records → campaign-guarded source, breakdown, and to-date APIs → Total Spend card and Spend Sources modal → Performance. The read-only deployed validator passed at the exact commit: Google Sheets `$300.00` + CSV `$38.00` = **`$338.00`**, Sources (2), through the latest completed day **2026-09-16**. Source IDs remained stable; CSV mapping was unchanged; currency, date, active-source, duplicate-source-date, orphan, cross-campaign, unauthenticated, and cross-owner checks passed. Google Ads was not tested or claimed.

The financial timer fired automatically at **09:35 UTC** on this runtime. Campaign2's Google Sheets Spend timestamp advanced; its 2026-09-16 gated `financial_daily` snapshot was written at **10:06:19 UTC** with Spend available at `$338.00` after the GA4 timer. CSV is a manual snapshot source. The temporary UTC timer settings were financial 09:35 and GA4 10:05; normal-clock timing was not retested here. Database validation used a read-only transaction and rollback; browser validation used a temporary revoked session and no application writes.

On the same application commit, controlled browser checks distinguished a legitimate `$0.00` with two active source definitions from missing source detail. When source list/breakdown failed while the to-date endpoint returned `$338.00`, Total Spend showed **Unavailable**, not a false zero, and dependent Performance values were withheld. A failed automatic refetch retained last-good `$338.00` with a warning. These are controlled UI states, not production provider-data mutations.

Local evidence on this exact commit: prior focused financial/Insights packet **101 passed**, Spend packet **21 passed**, source-safety Spend guard subset **4 passed**; the current scheduler/snapshot/Spend packet **52 passed**, `npm run check` passed, and `npm run build` passed.

The global financial scheduler reported eight provider-job failures plus LinkedIn failure on other/unidentified paths. Campaign2's gated snapshot establishes its successful same-campaign financial-source evidence, but the failed campaigns were **not** proven to be redundant tests. No global scheduler claim, existing certificate change, ledger update, code change, or test change is made here.
