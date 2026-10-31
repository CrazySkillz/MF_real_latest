# Saved-key recovery check: prepared, not requested for immediate execution

**User direction, October 31:** after receiving the prepared command, the user
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
key. Share only the resulting JSON. A success must authenticate all sixteen
fields, with zero failures; an empty container alone cannot establish success.
The actual saved-key result is **unverified; immediate execution is not requested**.
No finding is closed by preparation.

A future pass will establish retrieval and decryption of these archived
credentials outside Render. It will not establish provider validity, key
rotation, recovery of every historical credential, a rebuilt hosted application,
or complete disaster recovery/application rollback. The independently documented
database restore and broader Batch 8 recovery gates retain their own scope.
