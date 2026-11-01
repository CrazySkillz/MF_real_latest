# Saved-key recovery check: passed November 1

**Final actual result:** [PASS_SAVED_KEY_RECOVERY](validation-2026-10-31-remaining/saved-key-recovery-2026-11-01T12-51-54-212Z.json)
at 12:51:54 UTC: **16/16 encrypted fields authenticated, zero failures**, across
seven archived containers (one intentionally empty). The user retrieved the
saved key and pasted it using right-click at the hidden prompt. The archive and
token-vault hashes match the pinned values. No secret was emitted or saved, and
no database, provider, application startup or live write was involved.
The minimum Task 3 saved-copy dependency is complete; no repeat prompt is needed.
The earlier failures and helper correction are retained below as the diagnostic
record. Broader disaster-recovery limits remain unchanged.

**Current user direction, November 1:** after the remaining Task 3 boundary was
explained, the user explicitly requested proceeding with that next step. The
earlier postponement below is superseded for this one offline saved-copy check.
The existing archive reader and pinned token-vault module are unchanged. A fresh
[offline preflight](validation-2026-10-31-remaining/backup-key-preflight-2026-11-01T12-29-36-335Z.json)
authenticates the known archive hash and finds the expected seven containers /
sixteen encrypted fields. It reads no key and makes no database/provider request.
The absolute wrapper command was copied to the clipboard for the user to run in
PowerShell and enter the saved recovery key at the hidden local prompt. The agent
can read the saved redacted receipt; the user need not copy JSON. Results are below;
do not count the preflight or synthetic tests as a real-key pass.

**November 1 actual input result:** the user reported no visible JSON. The
agent read the new redacted
[local result file](validation-2026-10-31-remaining/saved-key-recovery-2026-11-01T12-32-12-718Z.json):
`KEY_NOT_VERIFIED`, zero authenticated fields and sixteen failed fields, with
the expected archive and vault hashes. It accessed no database or provider and
changed neither source backup nor key. The user confirmed entering only the
saved `TOKEN_ENCRYPTION_KEY` value. This is an actual unsuccessful verification,
distinct from the October 31 synthetic wrong-key rehearsal below; it does not
prove a live-app failure or establish the cause.

Fresh verifier controls passed for base64, hex and text synthetic keys, without
reading a real key or changing ciphertext. The earlier October 29 Render scope
receipt proved decryption of the retained matching-owner credential fields.
The user privately compared the saved copy with Render's current
`TOKEN_ENCRYPTION_KEY`: it matches except for surrounding double quotes in the
saved copy. A retry without quotes still produced
[zero authenticated fields](validation-2026-10-31-remaining/saved-key-recovery-2026-11-01T12-42-25-900Z.json).
Quotes therefore do not establish the cause. No key value, clipboard content or
private secret store was read by the agent. No key rotation, replacement,
reconnect or application change is justified by these failed local results.

**Local result display correction:** the wrapper launched Node with no console
window and did not capture/forward its stdout; the user twice saw no JSON even
though receipts were saved. Three wrapper lines now capture stdout asynchronously
and write it through the parent PowerShell output. The actual decryption and
archive selection are unchanged. On failure only, the verifier adds four boolean
paste-format indicators (control characters, variable assignment, copied command,
outer quotes). It never prints the input, its length or a key fingerprint and
does not normalize input to force a pass.

[Eleven synthetic helper checks](validation-2026-10-31-remaining/helper-output-controls.json)
exercise the real Windows PowerShell wrapper for correct/wrong base64, hex and
text keys, assert that the parent receives exactly the saved redacted result,
and verify the four paste-format indicators. The first sandboxed control could
not spawn PowerShell and stopped; the authorized local run passed. No actual key,
backup, database or provider was used in these controls.

The [diagnostic retry](validation-2026-10-31-remaining/saved-key-recovery-2026-11-01T12-50-09-819Z.json)
still authenticates 0/16 fields, but now identifies control characters in the
hidden input. Assignment/command/outer-quote flags are false. This establishes
an input-format problem; it does not prove a bad saved key or corrupt archive.
The prompt/instructions now specify right-click Paste instead of Ctrl+V. That
retry passed all sixteen fields. This confirms the saved copy is usable and
that the observed input-format failure was resolved; it does not establish the
exact bytes of the earlier input, which were neither logged nor retained.

**Earlier user direction, October 31:** after receiving the prepared command, the user
questioned its necessity and instructed us not to spend time on unnecessary
tasks. The assistant told the user **not to run it now**. Do not repeat this
request or present it as a prerequisite to continuing Batch 1 code/security work.
Actual key retrieval remains unverified, recorded under Batch 8 V1-016 with the
existing V1-008 dependency. It is not waived or marked successful.

This is one bounded part of V1-008 / Batch 8 V1-016. The user already saved the
application encryption key and downloaded the Render export. Do not repeat those
custody questions, request the key in chat or require another database purchase.

The [local PowerShell wrapper](validation-2026-10-31-remaining/check-saved-key.ps1)
prompts with `Read-Host -AsSecureString`. It passes UTF-8 bytes through the local
Node process's stdin, clears its byte buffer and BSTR, and disposes the secure
input. The key is not placed in arguments, environment variables, a file, chat
or command history. Plaintext necessarily exists briefly in process memory for
decryption; no guarantee against operating-system memory inspection is implied.

The [offline verifier](validation-2026-10-31-remaining/verify-saved-key.cjs)
loads only the pinned current token-vault module with an isolated in-memory
production environment. The child [archive reader](validation-2026-10-31-remaining/read-backup-key-containers.py)
streams the existing archive; it extracts no files and sends only selected
ciphertext to the verifier through a local pipe. It validates archive/schema
hashes, exact protected campaign identities and campaign/client owner consistency.
No `.env`, database, provider, application startup or live data is accessed.

The existing October 29 export SHA-256 is
`aeadd0ca9ff0caaa81960c00f5a81aa8739671e8f72f8ea74f3d6bc2ca8a3ae9`.
The [successful preflight](validation-2026-10-31-remaining/backup-key-preflight-2026-10-31T16-11-37-185Z.json)
finds **seven retained containers, sixteen encrypted fields and one empty
service-account container**, without reading the saved key. The original
download is unchanged. The initial sandboxed attempt could not complete the
child-process check and wrote `LOCAL_KEY_CHECK_FAILED`; the authorized local
retry passed. That preparation result is not a failed real-key attempt.

[Sixteen synthetic checks](validation-2026-10-31-remaining/saved-key-rehearsal.json)
verify base64, hex and text keys, wrong keys, corrupt tags, empty-key/all-empty
refusal, malformed containers and unchanged ciphertext. The initial wrong-key
fixture appended text after base64 padding, which the existing decoder ignores;
it was corrected to mutate actual key bytes. No runtime vault behavior changed.
The PowerShell wrapper was tested on this machine; its pipe uses `BaseStream`
because this Windows PowerShell version lacks `StandardInputEncoding`.

The [16-field failure at 16:13 UTC](validation-2026-10-31-remaining/saved-key-recovery-2026-10-31T16-13-09-585Z.json)
is **an intentional wrapper rehearsal using `B1_SYNTHETIC_KEY_NOT_PRODUCTION`**,
supplied by a local mock `Read-Host`. It proves that the wrong key does not pass
against the actual archive, and emits no credentials. It is not the user's key
and not evidence that the real saved key fails.

The prepared user command is:

```powershell
& '.\docs\fixes\v1-batch-1\validation-2026-10-31-remaining\check-saved-key.ps1'
```

Run from the repository root. At the hidden prompt, retrieve the existing saved
key. Reply Done; the agent can read the saved redacted result. A success must authenticate all sixteen
fields, with zero failures; an empty container alone cannot establish success.
The actual saved-key result is **PASS_SAVED_KEY_RECOVERY** as recorded above.
The pass, rather than preparation or synthetic tests, closes this bounded check.

This pass establishes retrieval and decryption of these archived
credentials outside Render. It does not establish provider validity, key
rotation, recovery of every historical credential, a rebuilt hosted application,
or complete disaster recovery/application rollback. The independently documented
database restore and broader Batch 8 recovery gates retain their own scope.
