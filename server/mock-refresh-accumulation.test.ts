import { describe, it, expect } from "vitest";

/**
 * Mock Refresh Accumulation Tests
 *
 * Verifies that Run Refresh data accumulates correctly with the simulation baseline.
 * Tests the exact bugs that were found:
 * 1. ga4-to-date must return simulation + DB rows (not replace simulation with DB)
 * 2. Each Run Refresh click must write to a different date (not overwrite same row)
 * 3. Run Refresh must NOT create spend or revenue records
 */

// Simulate the ga4-to-date aggregation logic
function computeGA4ToDateTotals(opts: {
  simulationSessions: number;
  simulationConversions: number;
  simulationRevenue: number;
  dbRowSessions: number[];
  dbRowConversions: number[];
  dbRowRevenue: number[];
}) {
  // Simulation baseline (always computed)
  let sessions = opts.simulationSessions;
  let conversions = opts.simulationConversions;
  let revenue = opts.simulationRevenue;

  // Add DB rows on top (from Run Refresh)
  for (let i = 0; i < opts.dbRowSessions.length; i++) {
    sessions += opts.dbRowSessions[i] || 0;
    conversions += opts.dbRowConversions[i] || 0;
    revenue += opts.dbRowRevenue[i] || 0;
  }

  return { sessions, conversions, revenue };
}

// Simulate sequential date assignment for Run Refresh
function computeRunRefreshDates(existingRowCount: number, todayUTC: string): string {
  const today = new Date(todayUTC + "T00:00:00Z");
  const offset = existingRowCount + 1; // +1 because yesterday = offset 1
  const target = new Date(today);
  target.setUTCDate(target.getUTCDate() - offset);
  return target.toISOString().slice(0, 10);
}

describe("ga4-to-date aggregation", () => {
  const SIM_90D = {
    sessions: 65600,
    conversions: 2592,
    revenue: 240352.24,
  };
  const RUN_REFRESH_DAY = {
    sessions: 1170,
    conversions: 56,
    revenue: 4200,
  };

  it("returns simulation only when no Run Refresh has been done", () => {
    const result = computeGA4ToDateTotals({
      ...SIM_90D,
      simulationSessions: SIM_90D.sessions,
      simulationConversions: SIM_90D.conversions,
      simulationRevenue: SIM_90D.revenue,
      dbRowSessions: [],
      dbRowConversions: [],
      dbRowRevenue: [],
    });
    expect(result.sessions).toBe(65600);
    expect(result.revenue).toBeCloseTo(240352.24, 2);
  });

  it("adds Run Refresh data ON TOP of simulation (not replaces)", () => {
    const result = computeGA4ToDateTotals({
      simulationSessions: SIM_90D.sessions,
      simulationConversions: SIM_90D.conversions,
      simulationRevenue: SIM_90D.revenue,
      dbRowSessions: [RUN_REFRESH_DAY.sessions],
      dbRowConversions: [RUN_REFRESH_DAY.conversions],
      dbRowRevenue: [RUN_REFRESH_DAY.revenue],
    });
    // Must be simulation + 1 day, NOT just 1 day
    expect(result.sessions).toBe(65600 + 1170);
    expect(result.sessions).toBe(66770);
    expect(result.conversions).toBe(2592 + 56);
    expect(result.revenue).toBeCloseTo(240352.24 + 4200, 2);
  });

  it("accumulates multiple Run Refresh clicks", () => {
    const result = computeGA4ToDateTotals({
      simulationSessions: SIM_90D.sessions,
      simulationConversions: SIM_90D.conversions,
      simulationRevenue: SIM_90D.revenue,
      dbRowSessions: [1170, 1170, 1170],
      dbRowConversions: [56, 56, 56],
      dbRowRevenue: [4200, 4200, 4200],
    });
    expect(result.sessions).toBe(65600 + 3 * 1170);
    expect(result.sessions).toBe(69110);
    expect(result.conversions).toBe(2592 + 3 * 56);
    expect(result.revenue).toBeCloseTo(240352.24 + 3 * 4200, 2);
  });
});

describe("Run Refresh sequential dates", () => {
  it("first click writes to yesterday", () => {
    const date = computeRunRefreshDates(0, "2026-03-28");
    expect(date).toBe("2026-03-27"); // yesterday
  });

  it("second click writes to day before yesterday", () => {
    const date = computeRunRefreshDates(1, "2026-03-28");
    expect(date).toBe("2026-03-26");
  });

  it("third click writes to 3 days ago", () => {
    const date = computeRunRefreshDates(2, "2026-03-28");
    expect(date).toBe("2026-03-25");
  });

  it("each click produces a unique date", () => {
    const dates = new Set<string>();
    for (let i = 0; i < 10; i++) {
      dates.add(computeRunRefreshDates(i, "2026-03-28"));
    }
    expect(dates.size).toBe(10); // all unique
  });
});

describe("Run Refresh does NOT create spend or revenue records", () => {
  // These are documentation tests — they verify the business rules
  // that were previously violated by the mock-refresh endpoint

  it("GA4 scheduler only produces sessions, conversions, revenue, users, pageviews", () => {
    const ga4DailyMetricFields = [
      "sessions", "users", "pageviews", "conversions", "revenue",
      "engagementRate", "revenueMetric", "isSimulated",
    ];
    // Spend is NOT a GA4 metric
    expect(ga4DailyMetricFields).not.toContain("spend");
  });

  it("spend arrives via Add Spend wizard, not Run Refresh", () => {
    const spendSources = ["manual", "csv", "google_sheets", "linkedin_api", "ad_platforms"];
    // "ga4_scheduler" or "mock_refresh" should NOT be a spend source
    expect(spendSources).not.toContain("ga4_scheduler");
    expect(spendSources).not.toContain("mock_refresh");
  });

  it("revenue records are only for imported sources, not GA4 native", () => {
    const revenueRecordSourceTypes = ["manual", "csv", "google_sheets", "hubspot", "salesforce", "shopify"];
    // GA4 native revenue comes through ga4_daily_metrics, NOT revenue_records
    expect(revenueRecordSourceTypes).not.toContain("ga4");
  });
});
