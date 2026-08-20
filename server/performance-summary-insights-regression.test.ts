import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPerformanceRecommendedActions,
  hasOneCompatiblePerformanceScoringTarget,
  resolvePerformanceHealthCoverage,
  resolvePerformanceLiveMetricValue,
  summarizePerformanceTrafficWindow,
  type PerformanceRecommendedActionsInput,
} from "../client/src/lib/performance-recommended-actions";
import { resolveGA4KpiConsumerState } from "../shared/ga4-kpi-consumer-state";

const dailyRows = Array.from({ length: 31 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 19 + index)).toISOString().slice(0, 10);
  return {
    date,
    sessions: index === 0 ? 1_644 : index === 1 ? 317 : 0,
    users: index === 0 ? 1_300 : index === 1 ? 317 : 0,
    conversions: index === 0 ? 209 : index === 1 ? 42 : 0,
    pageviews: index === 0 ? 2_000 : index === 1 ? 500 : 0,
    engagedSessions: index === 0 ? 1_000 : index === 1 ? 217 : 0,
  };
});

const baseInput = (overrides: Partial<PerformanceRecommendedActionsInput> = {}): PerformanceRecommendedActionsInput => ({
  kpis: [],
  benchmarks: [],
  kpiListState: "ready",
  benchmarkListState: "ready",
  trafficState: "ready",
  revenueState: "ready",
  spendState: "ready",
  financialConversionsState: "ready",
  trafficRows: dailyRows,
  dataThroughDate: "2026-08-18",
  financialRevenue: 72_766.69,
  financialSpend: 2_699.75,
  financialConversions: 251,
  ...overrides,
});

describe("Performance Summary Recommended Actions decision engine", () => {
  it("never reports 100% health from only a scored subset of configured metrics", () => {
    const coverage = resolvePerformanceHealthCoverage({
      configuredKpiCount: 11,
      configuredBenchmarkCount: 2,
      scoredKpiCount: 3,
      scoredBenchmarkCount: 1,
      kpisOnTrack: 3,
      benchmarksOnTrack: 1,
    });

    expect(coverage).toEqual({
      configuredMetricCount: 13,
      verifiedMetricCount: 4,
      excludedMetricCount: 9,
      totalOnTrackMetrics: 4,
      healthScore: null,
    });
  });

  it("scores against all configured metrics when every input is verified", () => {
    expect(resolvePerformanceHealthCoverage({
      configuredKpiCount: 11,
      configuredBenchmarkCount: 2,
      scoredKpiCount: 11,
      scoredBenchmarkCount: 2,
      kpisOnTrack: 3,
      benchmarksOnTrack: 1,
    }).healthScore).toBe(31);
  });

  it("uses exactly the 30 completed dates ending at dataThroughDate", () => {
    const window = summarizePerformanceTrafficWindow(dailyRows, "2026-08-18");

    expect(window).toMatchObject({ valid: true, startDate: "2026-07-20", endDate: "2026-08-18" });
    expect(window.totals).toMatchObject({ sessions: 317, conversions: 42, users: 317, pageviews: 500, engagedSessions: 217 });
  });

  it("derives every standard health metric from exact live inputs instead of stored currentValue", () => {
    const trafficTotals = summarizePerformanceTrafficWindow(dailyRows, "2026-08-18").totals;
    const value = (metric: string) => resolvePerformanceLiveMetricValue({
      item: { metric, currentValue: 999_999 },
      trafficTotals,
      financialRevenue: 72_766.69,
      financialSpend: 2_699.75,
      financialConversions: 251,
    });

    expect(value("Total Users")).toBe(317);
    expect(value("Total Sessions")).toBe(317);
    expect(value("Conversions")).toBe(42);
    expect(value("Conversion Rate")).toBe(13.25);
    expect(value("Engagement Rate")).toBe(68.45);
    expect(value("Revenue")).toBe(72_766.69);
    expect(value("ROAS")).toBe(26.95);
    expect(value("ROI")).toBe(2_595.31);
    expect(value("CPA")).toBe(10.76);
  });

  it("does not let a recently updated target row bypass stale source data", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      trafficState: "stale",
      kpis: [{
        metric: "Total Users",
        name: "Total Users",
        currentValue: "317.00",
        targetValue: "820.00",
        trackingPeriod: 30,
        updatedAt: "2026-08-19T16:24:13.097Z",
      }],
    }));

    expect(action).toMatchObject({ type: "info", title: "Recommendation inputs unavailable" });
    expect(action.message).not.toContain("Verified 317 versus the 820 KPI target");
  });

  it("fails closed for the exact production stale-row and newer-target-timestamp failure", () => {
    const staleRows = [
      { date: "2026-08-08", sessions: 100, users: 90, conversions: 10, pageviews: 150, engagedSessions: 70 },
      { date: "2026-08-09", sessions: 100, users: 90, conversions: 10, pageviews: 150, engagedSessions: 70 },
      { date: "2026-08-10", sessions: 117, users: 100, conversions: 22, pageviews: 200, engagedSessions: 77 },
    ];
    const sessionsTarget = {
      metric: "sessions",
      name: "Sessions",
      currentValue: "317",
      targetValue: "950",
      trackingPeriod: 30,
      updatedAt: "2026-08-19T18:06:30.000Z",
    };
    const actions = buildPerformanceRecommendedActions(baseInput({
      trafficRows: staleRows,
      dataThroughDate: "2026-08-18",
      trafficState: "stale",
      kpis: [sessionsTarget],
    }));
    const sessionsState = resolveGA4KpiConsumerState({
      metric: sessionsTarget.metric,
      name: sessionsTarget.name,
      listState: "ready",
      trafficState: "stale",
      revenueState: "ready",
      spendState: "ready",
    });
    const health = resolvePerformanceHealthCoverage({
      configuredKpiCount: 1,
      configuredBenchmarkCount: 0,
      scoredKpiCount: sessionsState.eligible ? 1 : 0,
      scoredBenchmarkCount: 0,
      kpisOnTrack: 0,
      benchmarksOnTrack: 0,
    });

    expect(sessionsState).toMatchObject({ eligible: false, code: "stale" });
    expect(health).toMatchObject({ verifiedMetricCount: 0, excludedMetricCount: 1, healthScore: null });
    expect(actions).toEqual([expect.objectContaining({ type: "info", title: "Recommendation inputs unavailable" })]);
    expect(actions.some((action) => action.title === "Review Sessions" || action.message.includes("Verified 317"))).toBe(false);
  });

  it("excludes duplicate and period-incompatible targets from health scoring", () => {
    const duplicateTargets = [
      { metric: "sessions", targetValue: 950, trackingPeriod: 30 },
      { metric: "sessions", targetValue: 1_000, trackingPeriod: 30 },
    ];
    expect(hasOneCompatiblePerformanceScoringTarget(duplicateTargets[0], duplicateTargets)).toBe(false);
    expect(hasOneCompatiblePerformanceScoringTarget(
      { metric: "roas", targetValue: 25, timeframe: "monthly" },
      [{ metric: "roas", targetValue: 25, timeframe: "monthly" }],
    )).toBe(false);
  });

  it("does not mix setup warnings with an otherwise evaluable recommendation", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [
        { metric: "sessions", name: "Sessions", targetValue: 950, trackingPeriod: 30 },
        { metric: "roas", name: "ROAS", targetValue: 25, timeframe: "monthly" },
      ],
    }));

    expect(actions.map((action) => action.title)).toEqual(["Align target periods"]);
    expect(actions.some((action) => action.message.includes("Verified"))).toBe(false);
  });

  it("fails closed for duplicate targets and incompatible target periods", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [
        { metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30 },
        { metric: "conversion_rate", name: "Conversion Rate", targetValue: 50, trackingPeriod: 30 },
        { metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime" },
        { metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime" },
        { metric: "roas", name: "ROAS", targetValue: 25, timeframe: "monthly" },
        { metric: "roi", name: "ROI", targetValue: 2_000, timeframe: "monthly" },
      ],
      benchmarks: [
        { metric: "conversions", name: "Conversions", benchmarkValue: 299, period: "monthly" },
        { metric: "revenue", name: "Revenue", benchmarkValue: 20_000, period: "monthly" },
      ],
    }));

    expect(actions.map((action) => action.title)).toEqual(["Resolve duplicate targets", "Align target periods"]);
    expect(actions[0].message).toContain("KPI Key Events per Session");
    expect(actions[0].message).toContain("KPI Cost Per Acquisition");
    expect(actions[1].message).toContain("Financial metrics require campaign-to-date");
    expect(actions.some((action) => action.message.includes("Verified"))).toBe(false);
  });

  it("computes Key Events per Session from the exact traffic window, not the outcome aggregate", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30, priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Key Events per Session");
    expect(action.message).toContain("Verified 13.25% versus the 15% KPI target");
    expect(action.message).not.toContain("12.8%");
  });

  it("uses campaign-to-date financial inputs and lower-is-better CPA direction", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime", priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Cost Per Acquisition");
    expect(action.message).toContain("Verified $10.76 versus the $9.00 KPI target");
    expect(action.message).toContain("campaign-to-date financial inputs");
  });

  it("withholds CPA when its to-date conversion input is stale", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      financialConversionsState: "stale",
      kpis: [{ metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime" }],
    }));

    expect(action).toMatchObject({ type: "info", title: "Recommendation inputs unavailable" });
    expect(action.message).not.toContain("Verified $10.76");
  });

  it("does not recommend corrective action when verified ROAS beats a compatible target", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "roas", name: "ROAS", targetValue: 25, timeframe: "campaign-to-date" }],
    }));

    expect(action.type).toBe("success");
    expect(action.title).toBe("ROAS on target");
    expect(action.message).toContain("Verified 26.95x versus the 25x KPI target");
    expect(action.message).toContain("No corrective action");
  });

  it("keeps KPI and Benchmark targets separate instead of treating them as duplicates", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30 }],
      benchmarks: [{ metricName: "Conversion Rate", currentValue: 99, benchmarkValue: 14, period: "30days" }],
    }));

    expect(actions.some((action) => action.title === "Resolve duplicate targets")).toBe(false);
    expect(actions.filter((action) => action.message.includes("Verified 13.25%"))).toHaveLength(2);
  });

  it("withholds every action when retained traffic data is stale", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      trafficState: "stale",
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30 }],
    }));

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({ type: "info", title: "Recommendation inputs unavailable" });
    expect(actions[0].message).toContain("No action is recommended");
  });

  it("wires the page renderer only to the target-backed decision engine", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-performance.tsx"), "utf-8");
    const insights = page.slice(page.indexOf("{/* Insights Tab */}"));

    expect(page).toContain("hasOneCompatiblePerformanceScoringTarget");
    expect(page).not.toContain("resolvePerformanceFreshPersistedMetricValue");
    expect(page).toContain("const recommendedActions = buildPerformanceRecommendedActions({");
    expect(insights).toContain("const recommendedInsights = recommendedActions;");
    expect(insights).not.toContain("buildPerformanceInsights()");
  });
});
