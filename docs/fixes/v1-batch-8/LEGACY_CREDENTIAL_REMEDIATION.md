# Legacy credential remediation boundary, October 27

**Status: read-only inventory complete; migration not implemented or executed.** This is the existing Batch 1 V1-008/V1-088 historical-data acceptance requirement, not a newly introduced runtime change. The current writers encrypt credentials, while the existing readers migrate legacy values when those rows are read. The inventory establishes retained plaintext rows, not when or by which historical code they were written.

[Receipt](validation-2026-10-27-batches-1-5/credential-presence-scoped.json): enforced read-only SQL with verified TLS/target identity; only counts, state and row-ID fingerprints returned. No tokens, secrets, account names or credential hashes returned. All 223 candidate rows have `encrypted_tokens IS NULL`; none is an active connection belonging to a surviving campaign.

| Table | Parent/state | Rows |
|---|---|---:|
| ga4_connections | Missing campaign; active flag true | 4 |
| google_sheets_connections | Surviving campaign; inactive | 70 |
| google_sheets_connections | Missing campaign; inactive | 69 |
| google_sheets_connections | Missing campaign; active flag true | 51 |
| hubspot_connections | Surviving campaign; inactive | 3 |
| salesforce_connections | Surviving campaign; inactive | 13 |
| shopify_connections | Surviving campaign; inactive | 13 |
| **Total** | **Seven exact state/rowset groups** | **223** |

The 132 other rows across the eleven inspected connection tables contain encrypted containers and no inspected plaintext token fields. Both Ads connection tables, Instagram and TikTok are empty. All five generic integration rows have empty credentials. Container presence is not proof of decryption compatibility or provider token validity.

## Prepared migration specification

1. Run in the deployed environment using the **existing production encryption key** and existing `buildEncryptedTokens`/`hydrateDecryptedTokens` format from `server/utils/tokenVault.ts`. Do not substitute a local key or rotate keys. Prove compatibility against an existing encrypted record in memory, without logging or returning values. Maintain a recoverable protected backup under the established backup policy.
2. Dry-run the exact seven groups above again. Match their row-ID fingerprints/counts from the receipt and fail closed if the inventory changed. Candidate predicate: one of the five named tables, encrypted container absent, nonempty access/refresh/client-secret field, and either missing campaign or explicitly inactive connection. No broad provider-table rewrite.
3. Test the maintenance operation first against disposable PostgreSQL: exact value round-trip, nullable/absent fields, all five table shapes, existing ciphertext exclusion, active surviving-connection exclusion, competing reconnect/token renewal, parent activation/creation, forced rollback and untouched neighboring rows/settings.
4. In a bounded transaction, lock/recheck the exact candidate rows and relevant surviving parents; abort on any changed credential/state/identity. Encrypt the same plaintext fields using the existing vault, then clear only those legacy plaintext fields as the current lazy migration does. Preserve IDs, campaign links, active state, selections, mappings, currency, amounts, cache and all timestamps. Do not invoke application getters, provider requests, refresh jobs or recomputation.
5. Before commit, prove each resulting encrypted value round-trips exactly, every non-credential column is unchanged, no non-candidate row changed, and the expected 223 plaintext candidates are gone. On any mismatch, roll back the whole operation. After commit, perform the same count-only inventory and retain redacted receipts.

This specification is reviewable but does not substitute for implementation, isolated validation or production execution. Orphan deletion, financial-record cleanup, credential rotation and historical log review are separate decisions. Encrypting these retained rows would preserve their contents; it would not prove past logs were clean or make an expired provider token valid.
