# GA4 Overview Revenue — exact-runtime recertification, 2026-09-17

## Decision and boundary

**CLEAN-CERTIFIED / PRODUCTION_READY for the bounded, existing-source GA4 Overview Revenue display and refresh path below at deployed application commit `5232f8978a4f70e05652d23459aeb9c964e7a83d`.** Required steps remaining for this exact boundary: **0**.

This is a new current-runtime consumer/refresh check, not a replacement for or expansion of any existing source-family certificate. It covers the two audited USD campaigns on GA4 property `542352127`: Campaign2 (`d9c8a3b7c4d0`) with five active imported source families, and the Pipeline-enabled campaign (`fc734ddaf728`) with four HubSpot sources and one CSV source. Other campaigns, source configurations, provider organisations, currencies, source add/edit/delete, independent Google Analytics truth reconciliation, and global scheduler health are excluded. The whole Revenue & Financials section and Overview tab are not certified by this document.

## Exact deployed path and values

The traced path is saved campaign/property and active GA4-context source records → campaign-access-guarded native GA4 to-date and imported revenue endpoints → aggregate-versus-attributed source-grain selection → Total Revenue card, source count, Revenue Sources modal, and confirmed-revenue input to Performance. Pipeline Proxy remains separate from confirmed Revenue. Database reads used read-only transactions and rollback; authenticated browser checks used temporary revoked Clerk sessions and made no application writes.

| Audited campaign | Native GA4 window and amount | Imported source-to-date amount | Rendered Total Revenue |
| --- | --- | ---: | ---: |
| Campaign2 `d9c8a3b7c4d0` | 2026-09-08–2026-09-16; `$8,862.30` | `$57,676.90` | `$66,539.20`, Sources (6) |
| Pipeline campaign `fc734ddaf728` | 2026-06-24–2026-09-16; `$92,389.00` | `$22,700.00` | `$115,089.00`, Sources (6) |

The imported API window was 1900-01-01 through 2026-09-17; the audited active records had no 2026-09-17 amount. Campaign2's five imported economic amounts were CSV `$20.00`, Google Sheets `$54,200.00`, HubSpot `$3,200.00`, Salesforce `$251.00`, and Shopify `$5.90`. Raw HubSpot/Salesforce attribution rows are not added a second time. The Pipeline campaign's four HubSpot sources were `$7,000.00`, `$5,100.00`, `$6,000.00`, and `$4,000.00`, plus CSV `$600.00`; its Pipeline Proxy remained `$0.00`. Database/API source count, active-source/campaign/currency guards, duplicate external keys, orphan records, cross-owner denial, rendered amount, and modal parity passed for the documented boundaries.

## Refresh and negative-state evidence

Render reported the exact commit. The financial scheduler fired at **09:35 UTC** and completed at **09:44:59 UTC**; the GA4 daily scheduler fired at **10:05 UTC** and completed at **10:06:20 UTC**. Both target campaigns' 2026-09-16 GA4 daily rows were updated at 10:05 and their `financial_daily` snapshots were written at 10:06 with available Revenue inputs. The snapshot writer requires successful same-campaign financial-source and GA4-daily evidence. Campaign2 Shopify's saved `lastSyncedAt` advanced to 09:44:04 UTC during the scheduled financial run; the other active automatic-source timestamps also advanced. CSV remains manual. The temporary UTC scheduler settings were financial 09:35 and GA4 10:05; normal-clock timing was not retested here.

On the same application commit, controlled read-only browser checks passed valid-zero Revenue, initial total failure (`Unavailable` and dependent Profit/ratios withheld), detail failure (`Sources unavailable` without replacing a valid total), and failed refetch retaining last-good Revenue with a warning. These are UI/failure-state checks, not mutations of production provider data. The Pipeline campaign's existing Revenue-only audit passed end to end. Campaign2's existing audit passed its Revenue/source checks but then hit a Pipeline-Proxy assertion that assumes a configured Pipeline card; Campaign2 is revenue-only. Independent read-only Campaign2 API-to-card and five-source modal checks passed with zero application writes. The audit script was not changed.

Local evidence on this exact commit: prior focused financial/Insights packet **101 passed**, source-family packet **252 passed**; the current scheduler/snapshot/Spend packet **52 passed**, `npm run check` passed, and `npm run build` passed.

## Exclusions and global failure

The global financial run reported eight provider-job failures plus LinkedIn failure, and the global GA4 run reported 16 campaign failures. The evidence above proves the two named GA4 campaigns completed and wrote gated snapshots; it does **not** prove the other failures are redundant test campaigns or certify global scheduler health. Existing source lifecycle certificates and Insights Executive Financials remain unchanged. No existing certificate, ledger entry, application file, or test was modified for this recertification.
