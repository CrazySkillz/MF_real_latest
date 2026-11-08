# Obsolete campaign cleanup — November 5, 2026

## Result and exact scope

At the owner's explicit request, five redundant production campaigns and their
campaign-scoped child records were deleted in one transaction at
**17:21:39 Amsterdam (16:21:39 UTC)**. No application code, schema, environment,
monitor configuration or provider account was changed. No deploy or forced
refresh was performed.

| Campaign | ID |
| --- | --- |
| ga4_brand | `247d8ebf-9554-45b9-8a50-482ec25da5a7` |
| ga_rev | `ca8c0771-aa45-481d-a0b9-c384e92a333d` |
| new_brand | `e8aae103-8561-4e93-b349-f2447c08f678` |
| testeds | `8ef1907a-8b63-49d0-b213-09fbed7427b2` |
| yesy | `2f9717f3-5187-407b-a1b9-59d7774472c8` |

All five had `client_id=null`, the same verified owner, and no saved GA4
credentials. The UI's campaign list filters to existing owned clients, explaining
why the owner could not find them. Their old active connections were still
scheduler candidates; the [earlier investigation](ga4-live-refresh-investigation-2026-11-05.md)
traced their missing-token failures.

## Backup, rehearsal and execution evidence

- Private backup: `C:\Users\me\Documents\MarketForensics-backups\2026-11-05-obsolete-campaigns`.
  Access is restricted to the Windows owner and SYSTEM. The backup contains
  **207,894 records across 15 tables**, compressed NDJSON, SHA256 checksums,
  schema-only SQL, scope manifest and recovery notes. Secrets were not printed.
- An isolated local PostgreSQL restore matched every backed-up row hash.
  Rehearsal used the existing `server/storage.ts:deleteCampaignChildren` helper
  from live revision `706a7bac`, with an explicit transaction connection.
  All expected deletions succeeded; unrelated control rows in all 15 affected
  tables, 32 other campaign roots, an additional synthetic campaign and all
  three client records were preserved. The temporary restore database was then
  removed and the local PostgreSQL instance started for this work was stopped.
- Existing campaign-delete/lifecycle regression tests passed: **9 tests in
  2 files**. Local maintenance-check corrections were exercised in rehearsal;
  no production application fix was needed.
- Immediately before deletion, all 61 direct/indirect inventory groups matched
  the backup, including hashes of nonempty groups. Names, IDs, owner, creation
  time, active status and missing client were checked under locked parent rows.
  Linked source/report references and the GA4 lifecycle trigger were checked.
- The live transaction reused the same storage helper. Every DELETE/UPDATE
  returned affected IDs; any ID outside the backup allowlist, unexpected table,
  repeated mutation or count mismatch would roll back the transaction.
  Exactly **207,894 records in 15 tables** were deleted. Audit/tombstone tables
  were retained; the existing trigger added five explained GA4 disconnect events.
- Fresh read-only verification found every backed-up ID absent from all 15
  deleted tables and no remaining target data across 51 directly scoped tables,
  except the five retained deletion audit events. The other **32 campaign rows**
  and all **three client rows** matched within the cleanup transaction.
- Independent before/after fingerprints matched in **27 data sets** covering
  settings, daily metrics, Overview/metric snapshots, financial sources/records
  and refresh work for the three currently monitored live campaigns.
- Both live and test health checks passed after cleanup. Live remains `706a7bac`,
  test remains `5ed8e816`; their next scheduled Amsterdam slot remains 20:00.
  The existing hosted monitor passed both apps at 16:20 UTC, before the cleanup
  committed. No post-cleanup scheduled run or future provider outcome is claimed.

## Recovery and limits

The backup folder retains the deletion receipt, fresh verification, successful
restore/rehearsal receipts, protected-campaign comparisons and maintenance scripts.
`RECOVERY.txt` describes isolated restoration. The schema dump contains clean
statements and must only be restored into a new empty isolated database; it must
not overwrite production or the existing test database. Any future production
recovery needs a separately scoped merge and ownership/conflict checks.

This closes the five named obsolete campaigns' disposition. It is not a general
historical-data purge, a full production point-in-time restore drill or a new
whole-platform accuracy certification. Other campaigns and provider data were
not deleted. No pending application deployment was created by this task.
