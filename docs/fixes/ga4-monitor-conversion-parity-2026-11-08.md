# Test release conversion-rate monitoring

Scope: the test app's Overview and Campaign Comparison conversion-rate correction,
including browser and generated PDF output. Live application code is unchanged.

- Test application revision: `b359cd24283f63c789e008a49f9338706537612a`.
- Test current-output expectations use conversions / sessions * 100. Zero sessions
  make the overall rate unavailable. Fractional counts and rates over 100% remain valid.
- Live current-output expectations retain their deployed native session-rate definition.
- Direct provider checks of raw GA4 sessionKeyEventRate remain unchanged.
- Historical PDFs select the formula from their original retained verification
  receipt. Missing markers retain the original definition; originals are not rewritten.
- Browser checks now also assert Comparison's total Conversions and Overall
  Conversion Rate cards alongside the existing individual chart and PDF checks.

The monitor previously replayed one source revision for both apps. During this
split release, build-time preparation applies the exact three-file test-release
patch in an isolated directory. SHA-256 checks bind the base and resulting files
to the app commit; deployed health must report that commit before and after
replay. Unknown revisions, missing files or changed hashes fail closed. No
runtime source downloads, metric mocks, provider refreshes or database writes
are introduced. Live replay continues using the unchanged source tree.

Validation: 143 focused monitor tests pass across five files; TypeScript passes.
Tests include rejecting the old formula for the corrected version, fractional
and repeated conversions, unavailable zero-session summaries, preserving older
PDF definitions, rejecting altered source, and coordinator version selection.
The app's twelve browser timing cases also pass. Required release CI and hosted
deployment/replay evidence are recorded separately with the release receipt.
