# V1-057 historical log disposition

**CLOSED for the original credential-logging finding.** No credential rotation,
provider disconnection, hosting change or production-data change was performed.

The defect logged HTTP response bodies/capability URLs and raw Google Ads errors.
The implemented correction in `server/index.ts` and `server/routes-oauth.ts`
removes those outputs. Synthetic bearer/developer-token marker tests cover the
real Axios/client/error branch, denied requests and success. This evidence is
retained in the Batch 1 logging regressions; no live secret was copied to test it.

The [deployment receipt](database-grants-live-health.json) records the corrected
Batch 1 revision `4522f834` running by October 20 at 21:01 UTC, with a second
healthy observation. Later deployed revisions retain that correction.

The user's October 29 Recovery screenshot shows a three-day recovery window and
an offer to upgrade to Pro. Render documents that window as the Hobby workspace
plan, with Pro providing seven days ([backup documentation](https://render.com/docs/postgresql-backups)).
Hobby runtime logs expire after seven days; upgrading cannot recover expired
logs ([log retention documentation](https://render.com/docs/logging)). On that
basis, pre-fix runtime logs from October 20 had aged out by the October 29
screenshot. This is a documented inference from the supplied screen and policy,
not an independent inspection of Render's internal log deletion.

On October 31 the user confirmed:

- No configured default log-stream destination and no downloaded/forwarded logs.
- Only the user has ever had workspace access, without a shared login or other
  members. The [exact custody answers](validation-2026-10-31-final/historical-log-custody-user.json)
  are recorded without credentials or log contents.

Render's [stream configuration](https://render.com/docs/log-streams) allows
different service destinations only on Scale/Enterprise; the supplied Hobby
screen does not support inferring an unseen service override. The user's
statement also covers historical forwarding, not merely today's default field.

Disposition: there is no identified third-party copy or unauthorized recipient
requiring a scoped rotation. Do not rotate shared customer/provider grants merely
to obtain a passing check. This is an exposure/custody disposition, not proof that
old logs never contained credentials, never existed, or could not have been
accessed by the hosting provider. Evidence of unauthorized access or an additional
copy would reopen this finding and require identifying the affected credentials.

The separate 223-plaintext and 126-ciphertext database cleanups do not erase logs
and are not used as evidence of log removal. Key recovery, provider renewal and
other operational findings retain their own acceptance requirements.
