# Finding-by-finding fix queue

The [controlling index](../../V1_RELEASE_READINESS.md) defines the eight practical batches and their acceptance boundaries. This generated assignment includes every stable finding exactly once. Severity is retained separately from V1 applicability; deferred provider findings are not mandatory V1 feature work.

Current counts, implementation state, validation evidence and remaining release gates are maintained in [Fix counts and progress tracking](../../V1_RELEASE_READINESS.md#fix-counts-and-progress-tracking). Update that record with each fix; this assignment table does not establish closure.

Batch 2's 14 code corrections are committed, pushed and deployed as `839bf508`. Database restore/upgrade/rollback rehearsal, live schema/Ptomo preservation and deployed SignUp-to-SignIn navigation pass. Customer/provider acceptance and historical cleanup remain open. The [Batch 2 progress record](../../V1_RELEASE_READINESS.md#fix-counts-and-progress-tracking) contains exact evidence and remaining gates. Batch8 also retains the previously unmapped CI browser failure (`TEST-f323e48c9f`, V1-012), the observed Clerk Development mode (V1-013), and partial dependency-advisory evidence (V1-019). No whole-app release GO is issued.

**October 21 validation update: V1 remains NO-GO.** The full current suite ran 4,154 tests: **3,972 passed, 182 failed, none skipped**. Every failure retains its existing stable ID, classification and release impact in the [latest assessment](../../fixes/v1-batch-2/acceptance-2026-10-21/assessment.json); none is waived and there are no newly failing local test identities. All 114 Batch 1 and 65 Batch 2 test-file cases pass. The additional isolated packet passes 10 PostgreSQL, 8 campaign-wizard, 13 OAuth and 3 connection-flow scenarios. Real customer Google consent and the complete deployed customer lifecycle remain unverified; simulated provider tests do not close those gates. Live health/schema, the five anonymous denial checks, Ptomo preservation and public signup navigation pass; Clerk still visibly reports Development mode. Runtime files and production data were not changed, fixture schemas were removed, and the local test database was stopped. **The next implementation batch is Batch 3; Batches 3-8 and remaining live acceptance must be completed before a release GO.** Finding assignments/counts are unchanged; the 182 test failures are not 182 additional independent code fixes.

**Ptomo freshness checks (October 21): PASSED for Batch 1's 08:00 run and Batch 2's 14:00 run.** The morning native/financial timestamps were 08:10/08:11, before Batch 2 deployed at 09:32. The afternoon screenshots show both advanced to 14:11, still through October 20. Read-only production evidence confirms the exact 14:00 work item completed at 14:12:44.988 Amsterdam on its first attempt without a recorded error, with a matching aligned-publication marker and unchanged campaign/connection configuration. **The page's updating-message check also passed (user-reported):** asked whether it disappears after keeping the page open for a minute, the user confirmed "Yes, it disappears". No further scheduled-refresh wait or message confirmation is required for this particular Ptomo check. Detailed values, other page/actions, live customer Google onboarding/reconnect/cancel and the isolated new-customer lifecycle remain open. The [controlling index](../../V1_RELEASE_READINESS.md#fix-counts-and-progress-tracking) records the screenshots, read-only evidence and precise boundaries; these bounded checks do not close whole release findings.

| Finding | Severity | Primary batch | V1 applicability |
|---|---|---:|---|
| V1-001 | P0 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-002 | P0 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-003 | P1 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-004 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-005 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-006 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-007 | P0 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-008 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-009 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-010 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-011 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-012 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-013 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-014 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-015 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-016 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-017 | P2 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-018 | P2 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-019 | P1 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-020 | P2 | 8 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-021 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-022 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-023 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-024 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-025 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-026 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-027 | P1 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-028 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-029 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-030 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-031 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-032 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-033 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-034 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-035 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-036 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-037 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-038 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-039 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-040 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-041 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-042 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-043 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-044 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-045 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-046 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-047 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-048 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-049 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-050 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-051 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-052 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-053 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-054 | P0 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-055 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-056 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-057 | P1 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-058 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-059 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-060 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-061 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-062 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-063 | P0 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-064 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-065 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-066 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-067 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-068 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-069 | P1 | 4 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-070 | P1 | 4 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-071 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-072 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-073 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-074 | P2 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-075 | P0 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-076 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-077 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-078 | P1 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-079 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-080 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-081 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-082 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-083 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-084 | P2 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-085 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-086 | P2 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-087 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-088 | P1 | 1 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-089 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-090 | P1 | 3 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-091 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-092 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-093 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-094 | P2 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-095 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-096 | P2 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-097 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-098 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-099 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-100 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-101 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-102 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-103 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-104 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-105 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-106 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-107 | P1 | 6 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-108 | P1 | 4 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-109 | P1 | 5 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-110 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-111 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-112 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-113 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-114 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-115 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-116 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-117 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-118 | P1 | 6 | Deferred provider functionality; retained for future enablement, not a V1 provider implementation task |
| V1-119 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-120 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-121 | P1 | 6 | Mixed: V1 shared/access/job/exclusion and included-source portion; deferred provider-specific functionality remains deferred |
| V1-122 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-123 | P0 | 1 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-124 | P1 | 2 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-125 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-126 | P1 | 4 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-127 | P1 | 6 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-128 | P1 | 6 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-129 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |
| V1-130 | P1 | 7 | V1 required if current reachable/offered scope is retained; proposed exclusions require agreement and effective enforcement |

Every implementation batch must preserve existing architecture and add exact root-cause regression coverage. Known persisted damage requires a separate read-only boundary inventory and targeted cleanup proposal. The final candidate needs a fresh full release run; audit copies do not replace repaired authoritative tests.
