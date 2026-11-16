import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import evidence from "./fixtures/monitor-summary-rates-2026-11-16.json";
import { checkStoredNumbers, type LiveNumberSnapshot } from "./live-number-checks";
import { runLiveNumberMonitor } from "../scripts/check-live-numbers";

const mocks = vi.hoisted(() => ({ read: vi.fn(), query: vi.fn(), end: vi.fn() }));
vi.mock("./db", () => ({ pool: { query: mocks.query, end: mocks.end } }));
vi.mock("./storage", () => ({ storage: { getLiveNumberCheckSnapshot: mocks.read } }));
vi.mock("./live-number-provider-checks", () => ({
  checkGA4ProviderNumbers: async () => [], checkFinancialProviderNumbers: async () => [], checkPipelineProviderNumbers: async () => [],
  renewFinancialMonitorCredentials: async () => false, financialCredentialRenewalPreservesInputs: () => true,
}));
vi.mock("./live-number-report-checks", () => ({ checkSavedReportNumbers: async () => [],
  restoreLegacyReportInputOrder: (s: unknown) => s,
  separateReviewedReportHistory: (_s: unknown, checks: unknown[]) => ({ checks, historicalChecks: [] }),
}));

// The monitor branch has a legacy parser; deployment pins the app's current-day
// parser. Adapt only this enum for unit execution, preserving all captured numbers.
function fixture(index = 0): LiveNumberSnapshot {
  const s: LiveNumberSnapshot = structuredClone(evidence.cases[index].snapshot);
  s.rows.metricSnapshots[0].metrics.executiveSummaryDaily.currentValueWindow.mode = "initial_import_to_latest_completed_day";
  s.comparisonRateDefinition = "ga4_session_key_event_rate";
  s.usersDefinition = "ga4_totalUsers_distinct_v1";
  return s;
}
const now = new Date(evidence.cases[0].now);
const rates = (checks: ReturnType<typeof checkStoredNumbers>) => checks.filter(c => ["Executive Summary", "Performance Summary"].includes(c.section) && c.code === "cvr");
const packet = (s: LiveNumberSnapshot) => s.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta.distinctUsers;
const summary = (s: LiveNumberSnapshot) => s.rows.metricSnapshots[1].metrics;

beforeEach(() => { vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true"); vi.stubEnv("DATABASE_URL", ""); vi.clearAllMocks(); });
afterEach(() => { vi.unstubAllEnvs(); vi.useRealTimers(); });

describe("native GA4 summary Conversion Rate monitoring", () => {
  it.each(evidence.cases.map((f, index) => [f.name, index] as const))("accepts both captured rates for %s", (_name, index) => {
    const s = fixture(index), before = JSON.stringify(s), checks = rates(checkStoredNumbers(s, now));
    expect(checks).toHaveLength(2);
    expect(checks.every(c => c.status === "passed")).toBe(true);
    expect(JSON.stringify(s)).toBe(before);
  });
  it.each([0, 1])("still rejects an incorrect summary rate (%s)", index => {
    const s = fixture();
    const metric = index === 0 ? s.rows.metricSnapshots[0].metrics.executiveSummaryDaily.totals.cvr : summary(s).performanceSummary.totals.cvr;
    metric.value += 1;
    expect(rates(checkStoredNumbers(s, now)).map(c => c.status)).toEqual(index === 0 ? ["difference", "passed"] : ["passed", "difference"]);
  });
  it.each([null, -0.01, 1.01])("does not substitute arithmetic for invalid native evidence (%s)", value => {
    const s = fixture(); packet(s).sessionKeyEventRate = value;
    summary(s).performanceSummaryVerification.distinctUsers.sessionKeyEventRate = value;
    expect(rates(checkStoredNumbers(s, now)).map(c => c.status)).toEqual(["unverified", "unverified"]);
  });
  it("accepts a genuine native zero instead of substituting conversions/sessions", () => {
    const s = fixture(); packet(s).sessionKeyEventRate = 0;
    summary(s).performanceSummaryVerification.distinctUsers.sessionKeyEventRate = 0;
    s.rows.metricSnapshots[0].metrics.executiveSummaryDaily.totals.cvr.value = 0;
    summary(s).performanceSummary.totals.cvr.value = 0;
    expect(rates(checkStoredNumbers(s, now)).map(c => c.status)).toEqual(["passed", "passed"]);
  });
  it.each(["campaignId", "propertyId", "campaignFilter", "currency"])("rejects a Performance Summary %s mismatch", key => {
    const s = fixture(); summary(s).performanceSummaryVerification[key] = "other";
    expect(rates(checkStoredNumbers(s, now))[1].status).toBe("unverified");
  });
  it("uses the Performance Summary's own GA4 window rather than the Overview rate", () => {
    const s = fixture(), v = summary(s).performanceSummaryVerification;
    v.trafficWindow.startDate = "2026-10-01";
    v.distinctUsers.windows = [{ startDate: "2026-10-01", endDate: "2026-11-16", users: 10, sessions: 12, engagedSessions: 6, engagementRate: 0.5, sessionKeyEventRate: 0.25 }];
    summary(s).performanceSummary.totals.cvr.value = 25;
    expect(rates(checkStoredNumbers(s, now)).map(c => c.status)).toEqual(["passed", "passed"]);
    v.distinctUsers.endDate = "2026-11-15";
    expect(rates(checkStoredNumbers(s, now))[1].status).toBe("unverified");
  });
  it("preserves the old Performance Summary definition for legacy deployments", () => {
    const s = fixture(); s.comparisonRateDefinition = "conversions_per_session";
    const t = summary(s).performanceSummary.totals; t.cvr.value = t.conversions.value / t.sessions.value * 100;
    delete summary(s).performanceSummaryVerification;
    expect(rates(checkStoredNumbers(s, now))[1].status).toBe("passed");
  });
  it("passes the configured definition through the real monitor entry point", async () => {
    vi.useFakeTimers(); vi.setSystemTime(now);
    const s = fixture(); delete s.comparisonRateDefinition; delete s.usersDefinition;
    mocks.query.mockResolvedValue({ rows: [{ read_only: "on" }] }); mocks.read.mockResolvedValue(s);
    vi.stubEnv("CVR_TEST_DATABASE", "postgresql://readonly@localhost:5432/isolated");
    const result = await runLiveNumberMonitor({ databaseEnvironmentVariable: "CVR_TEST_DATABASE",
      databaseFingerprint: createHash("sha256").update(JSON.stringify(["localhost", "5432", "/isolated"])).digest("hex"),
      application: { baseUrl: "https://example.invalid", expectedCommit: "a".repeat(40), comparisonRateDefinition: "ga4_session_key_event_rate",
        usersDefinition: "ga4_totalUsers_distinct_v1", reportingMode: "current_day" },
      campaigns: [{ campaignIdHash: "a".repeat(12), reportingTimeZone: "Europe/Amsterdam" }] });
    expect(rates(result[0].checks).map(c => c.status)).toEqual(["passed", "passed"]);
    expect(mocks.read).toHaveBeenCalledTimes(2);
    expect(mocks.query).toHaveBeenCalledTimes(1);
    expect(mocks.query).toHaveBeenCalledWith("SELECT current_setting('default_transaction_read_only') AS read_only");
    expect(mocks.end).toHaveBeenCalledTimes(1);
  });
});
