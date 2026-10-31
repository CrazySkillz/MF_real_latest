# Historical ciphertext disposition, October 31

Status: **approved live retirement completed and independently verified** at
11:55 UTC on October 31. Only the 126 approved `encrypted_tokens` fields changed.
This addresses the remaining historical ciphertext in V1-008/V1-088. It does not
close either entire finding. The consolidated count was 10 CLOSED / 10 OPEN at
that cleanup checkpoint; later independent closures are tracked in the
[current ledger](CONSOLIDATED_CLOSEOUT_2026-10-31.md).

## Root cause and current scope

The existing read-only Render check reported 218 credential fields that could
not authenticate with the current application key. The current bounded read
authenticates exactly those 218 fields with the former **public development
fallback**, using the existing hash-pinned vault implementation in an isolated
development environment. No private application key, provider request, app
startup or database write was used. This establishes the encryption-key cause;
it does not establish whether any credential remains valid at its provider or
whether anyone previously accessed it.

The fields occupy 126 historical connection records: 71 have no campaign, and
55 have a campaign whose client is absent. Some orphan campaigns/connections
retain active flags; orphan classification alone is not proof that every job
skips them. All three current campaigns have valid matching owners/clients and
are explicitly excluded: Promo, V1 Batch 5 Test and Batch 1 Provider Check.

| Store | Exact records | Public-fallback fields |
| --- | ---: | ---: |
| GA4 | 21 | 59 |
| Google Sheets | 19 | 57 |
| HubSpot | 7 | 21 |
| Salesforce | 2 | 4 |
| Shopify | 3 | 3 |
| LinkedIn | 70 | 70 |
| Meta | 4 | 4 |
| Total | 126 | 218 |

The pre-cleanup eleven-store inventory contained 361 records, 138 encrypted containers and
**zero nonempty plaintext credential rows**. The earlier approved 223-record
plaintext cleanup remains intact. Thirty fields in protected current containers
do not authenticate with the public fallback; this diagnostic does not classify
them as corrupt or prove private-key decryption. Prior deployed-key and real
provider evidence retain their separately documented scope. One empty protected
GA4 service-account container is left unchanged.

## Exact approved change and guards

The committed change set only `encrypted_tokens = NULL` on these 126 exact historical IDs. It retained every
record, parent ID, mapping, amount, timestamp and active flag. Do not change any
source belonging to the three protected campaigns, rotate the application key,
revoke shared provider grants, alter schedules, deploy code or change hosting.

The runner pins the production database fingerprint, deployed commit, encrypted
backup digest, tested implementation digests and exact candidate row sets. It
requires all populated fields in each candidate to authenticate with the public
fallback, zero nonempty legacy plaintext, and an absent campaign or client. Mixed
key containers and valid-client campaigns are rejected. Any candidate value,
parent, owner, schema or reviewed trigger mismatch aborts rather than broadening
the selection. It rechecks under short-lived parent/connection locks and uses one
transaction. It compares all captured rows before/after, permitting only the
specified column to change, and saves an authenticated encrypted before-proof
before COMMIT. Independent readback follows. An ambiguous commit is reported as
unknown and must not be automatically retried.

The earlier approval covered **223 plaintext records**. The user separately
approved this exact scope with “Approve the 126-record cleanup”; the
[approval record](validation-2026-10-31-final/legacy-cipher-approval.json) preserves
that boundary. The execution repeated the exact candidate/parent comparisons
under lock rather than relying on the earlier preflight.

Final execution review found that starting REPEATABLE READ before acquiring the
locks could retain an earlier parent snapshot. The execution wrapper now uses
explicit READ COMMITTED, matching the local rehearsal, while holding the parent
and connection locks throughout all checks and updates. An additional regression
commits a parent change after the initial metadata read but before those locks;
the cleanup correctly aborts. This is a maintenance-wrapper correction only.

## Evidence and validation

- [Read-only classification](validation-2026-10-31-final/legacy-cipher-2026-10-31T11-28-31-918Z.json): all 218 fields and 126 records; historical group identities match the earlier inventory. Seven local diagnostic controls passed.
- [Encrypted capture](validation-2026-10-31-final/legacy-cipher-capture-2026-10-31T11-35-40-204Z.json): database-enforced READ ONLY, verified TLS, 433 exact parent/connection/audit rows across ten tables. AES-GCM archive authenticated after writing; protected by the existing Windows-user-only directory and backup-only DPAPI key, excluded from Git. Backup SHA-256 `1286fbb9f69b1fd121762dd8c60572bc53a21bcc25f3ff0d72c94767b1369e25`.
- [Isolated restored-copy rehearsal](validation-2026-10-31-final/legacy-cipher-retirement-local.json): **20 checks passed** against the existing reviewed 71-table schema, with all captured rows restored field-exact. Exact 126-column cleanup, preservation of other captured values, all three protected campaigns, rollback after a partial write, changed ciphertext/plaintext/active flag/parent/trigger, concurrent writers, row identity drift, mixed keys, unsupported formats and independent committed-result verification are covered. The other 61 local stores stayed empty; this is not a restore or certification of their production data.
- [Live preflight](validation-2026-10-31-final/legacy-cipher-retirement-preflight-2026-10-31T11-39-18-612Z.json): PASS, READ ONLY, exact unchanged candidates and parents, deployed `3c304f9723a65e8d9ee8650c74eacf7e03b63d34`. No writes attempted.
- [Local-copy cleanup](validation-2026-10-31-final/legacy-cipher-local-cleanup.json): stopped cluster and temporary password removed after exact path/reparse/port checks; encrypted archive and key preserved.
- [Final rehearsal](validation-2026-10-31-final/legacy-cipher-retirement-local-race.json): all **21 checks pass**, including the newly identified pre-lock parent race. This supersedes the earlier 20-check source digest for execution. An initial race-test attempt rejected the parent change correctly but its exact error-message comparison did not account for Node's appended diff; that assertion was corrected and the complete rehearsal passed on a fresh copy. The failed receipt is retained.
- [Live execution](validation-2026-10-31-final/legacy-cipher-retirement-live.json): PASS, commit acknowledged, exactly 126 rows changed, independent readback successful, no public-fallback candidates remain. All other fields in the ten captured parent/connection/audit tables compare equal, including all three protected campaigns and their sources. Encrypted before-proof SHA-256 `abfcdb6820fd4e4d65dc82edee20dd4b3e923c3babd3a2c32ce360f85e3f18d1`.
- [Fresh eleven-store inventory](validation-2026-10-31-final/legacy-cipher-2026-10-31T11-55-48-731Z.json): all 361 records remain; zero plaintext credential rows, zero public-fallback fields, zero malformed containers/fields, and twelve retained encrypted containers containing the same thirty other-key fields and one empty service-account container. The three protected campaigns have valid matching parents/owners. Public health returned HTTP 200 / `ok:true` on the unchanged deployed revision after the commit.
- [Final local-copy removal](validation-2026-10-31-final/legacy-cipher-local-cleanup-race.json): both subsequent stopped rehearsal clusters and temporary passwords removed; backup, before-proof and DPAPI key remain private and Git-ignored.

The first capture attempt was blocked by child-process sandbox permissions; the
read-only retry completed. The first local test run stopped at invalid SQL in its
trigger-rename negative test. That test-only syntax was corrected, the stopped
copy removed, and all 20 checks rerun on a fresh isolated copy. Neither incident
changed production or application code. Failed receipts remain dated evidence.

Implementation is confined to the explicit maintenance files in
`validation-2026-10-31-final`: `read-legacy-cipher-scope.cjs`,
`legacy-cipher-retirement.cjs`, `capture-legacy-cipher-retirement.cjs`,
`verify-legacy-cipher-retirement.cjs`, `run-legacy-cipher-retirement.cjs` and
`cleanup-local-legacy-cipher.ps1`. They are not connected to app startup or jobs.

## Remaining limits

Live retirement and its post-commit readback are complete. Historical hosting or
provider logs, protected older backups, grant validity/revocation, actual current
credential renewal/reconnect and independent recovery are not certified by this
packet. Cleanup does not erase credentials from historical backups or logs.
Independent recovery remains recorded under Batch 8 V1-016; no paid database is
required or authorized by this work.
