import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPerformanceRecommendedActions,
  resolvePerformanceAggregateMetricValue,
  resolvePerformanceHealthCoverage,
  resolvePerformanceLiveMetricValue,
  resolvePerformancePriorityRank,
  summarizePerformanceTrafficWindow,
  type PerformanceRecommendedActionsInput,
} from "../client/src/lib/performance-recommended-actions";
import { resolveGA4KpiConsumerState } from "../shared/ga4-kpi-consumer-state";
import {
  classifyKpiBandWithPolicy,
  computeBenchmarkThresholdResult,
  isLowerIsBetterKpi,
  resolveKpiThresholdPolicy,
} from "../shared/kpi-math";

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
  trafficTotals: { sessions: 317, users: 317, conversions: 42, pageviews: 500, engagedSessions: 217 },
  trafficMetricAvailability: { sessions: true, users: true, conversions: true, pageviews: true, conversion_rate: true, engagement_rate: true },
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

  it("uses the Performance Summary aggregate for Top Priority metrics when available", () => {
    const totals = {
      sessions: { available: true, value: 1_961 },
      users: { available: true, value: 1_963 },
      conversions: { available: true, value: 251 },
      cvr: { available: true, value: 12.8 },
      cpa: { available: true, value: 10.76 },
    };

    expect(resolvePerformanceAggregateMetricValue({ metric: "Total Sessions" }, totals)).toBe(1_961);
    expect(resolvePerformanceAggregateMetricValue({ metric: "Total Users" }, totals)).toBe(1_963);
    expect(resolvePerformanceAggregateMetricValue({ metric: "Conversion Rate" }, totals)).toBe(12.8);
    expect(resolvePerformanceAggregateMetricValue({ metric: "CPA" }, totals)).toBe(10.76);
    expect(resolvePerformanceAggregateMetricValue({ metric: "Engagement Rate" }, totals)).toBeNull();
  });

  it("selects Conversion Rate instead of Sessions from the exact production aggregate", () => {
    const totals = {
      sessions: { available: true, value: 1_961 },
      users: { available: true, value: 1_963 },
      conversions: { available: true, value: 251 },
      cvr: { available: true, value: 12.8 },
      revenue: { available: true, value: 72_766.69 },
      roas: { available: true, value: 26.95 },
      roi: { available: true, value: 2_595.31 },
      cpa: { available: true, value: 10.76 },
    };
    const targets = [
      { metric: "Total Sessions", targetValue: 950 },
      { metric: "Total Users", targetValue: 820 },
      { metric: "Conversion Rate", targetValue: 50 },
      { metric: "CPA", targetValue: 9 },
    ];
    const scored = targets.map((item) => {
      const current = resolvePerformanceAggregateMetricValue(item, totals)!;
      const target = Number(item.targetValue);
      const lowerIsBetter = isLowerIsBetterKpi(item);
      const policy = resolveKpiThresholdPolicy({ ...item, current, target, lowerIsBetter });
      return {
        item,
        current,
        target,
        band: classifyKpiBandWithPolicy({ current, target, lowerIsBetter, policy }),
        severity: Math.abs((current - target) / target),
      };
    });
    const top = scored.filter((row) => row.band === "below").sort((a, b) => b.severity - a.severity)[0];

    expect(scored.find((row) => row.item.metric === "Total Sessions")).toMatchObject({ current: 1_961, target: 950, band: "above" });
    expect(top).toMatchObject({ item: { metric: "Conversion Rate" }, current: 12.8, target: 50, band: "below" });
  });

  it("orders Top Priority by configured priority before target-gap severity", () => {
    const candidates = [
      { priority: "medium", severity: 80, metric: "Sessions" },
      { priority: "critical", severity: 10, metric: "CPA" },
      { priority: "high", severity: 90, metric: "Users" },
    ];
    const sorted = candidates.sort((a, b) =>
      resolvePerformancePriorityRank(a.priority) - resolvePerformancePriorityRank(b.priority)
      || b.severity - a.severity,
    );

    expect(sorted.map((candidate) => candidate.metric)).toEqual(["CPA", "Users", "Sessions"]);
    expect(["critical", "high", "medium", "low"].map(resolvePerformancePriorityRank)).toEqual([1, 2, 3, 4]);
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
    const sessionsTarget = {
      metric: "sessions",
      name: "Sessions",
      currentValue: "317",
      targetValue: "950",
      trackingPeriod: 30,
      updatedAt: "2026-08-19T18:06:30.000Z",
    };
    const actions = buildPerformanceRecommendedActions(baseInput({
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

  it("scores all 13 production target rows from fresh live values", () => {
    const productionKpis = [
      { metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30 },
      { metric: "conversion_rate", name: "Conversion Rate", targetValue: 50, trackingPeriod: 30 },
      { metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime" },
      { metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime" },
      { metric: "engagement_rate", name: "Engagement Rate", targetValue: 89 },
      { metric: "revenue", name: "Revenue", targetValue: 25_000, timeframe: "monthly" },
      { metric: "roas", name: "ROAS", targetValue: 25, timeframe: "monthly" },
      { metric: "roi", name: "ROI", targetValue: 2_000, timeframe: "monthly" },
      { metric: "sessions", name: "Sessions", targetValue: 950, trackingPeriod: 30 },
      { metric: "users", name: "Users", targetValue: 820, trackingPeriod: 30 },
      { metric: "users", name: "Users", targetValue: 550, trackingPeriod: 30 },
    ];
    const productionBenchmarks = [
      { metric: "conversions", name: "Conversions", benchmarkValue: 299, period: "monthly" },
      { metric: "revenue", name: "Revenue", benchmarkValue: 20_000, period: "monthly" },
    ];
    const liveInput = baseInput({
      kpis: productionKpis,
      benchmarks: productionBenchmarks,
      trafficTotals: { sessions: 42, users: 42, conversions: 42, pageviews: Number.NaN, engagedSessions: 42 },
      trafficMetricAvailability: { sessions: true, users: true, conversions: true, pageviews: false, conversion_rate: true, engagement_rate: true },
    });
    const current = (item: any) => resolvePerformanceLiveMetricValue({
      item,
      trafficTotals: liveInput.trafficTotals,
      financialRevenue: liveInput.financialRevenue,
      financialSpend: liveInput.financialSpend,
      financialConversions: liveInput.financialConversions,
    });
    const scoredKpis = productionKpis.map((item) => {
      const value = current(item)!;
      const target = Number(item.targetValue);
      const lowerIsBetter = isLowerIsBetterKpi(item);
      const policy = resolveKpiThresholdPolicy({ ...item, current: value, target, lowerIsBetter });
      return classifyKpiBandWithPolicy({ current: value, target, lowerIsBetter, policy });
    });
    const scoredBenchmarks = productionBenchmarks.map((item) => computeBenchmarkThresholdResult({
      ...item,
      current: current(item)!,
      benchmarkValue: item.benchmarkValue,
    }).status);
    const coverage = resolvePerformanceHealthCoverage({
      configuredKpiCount: productionKpis.length,
      configuredBenchmarkCount: productionBenchmarks.length,
      scoredKpiCount: scoredKpis.length,
      scoredBenchmarkCount: scoredBenchmarks.length,
      kpisOnTrack: scoredKpis.filter((band) => band === "above" || band === "near").length,
      benchmarksOnTrack: scoredBenchmarks.filter((status) => status === "on_track").length,
    });
    const actions = buildPerformanceRecommendedActions(liveInput);

    expect(scoredKpis).toHaveLength(11);
    expect(scoredKpis.filter((band) => band === "above" || band === "near")).toHaveLength(6);
    expect(scoredBenchmarks).toHaveLength(2);
    expect(scoredBenchmarks.filter((status) => status === "on_track")).toHaveLength(1);
    expect(coverage).toEqual({
      configuredMetricCount: 13,
      verifiedMetricCount: 13,
      excludedMetricCount: 0,
      totalOnTrackMetrics: 7,
      healthScore: 54,
    });
    expect(actions.map((action) => action.title)).toEqual(["Review Sessions", "Review Users", "Review Cost Per Acquisition"]);
    expect(actions[0].message).toContain("Verified 42");
    expect(actions[0].message).toContain("950 KPI target");
    expect(actions[1].message).toContain("820 KPI target");
    expect(actions[2].message).toContain("Verified $10.76");
  });

  it("evaluates repeated saved target rows and deduplicates only their action cards", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [
        { metric: "sessions", name: "Sessions", targetValue: 950, trackingPeriod: 30 },
        { metric: "sessions", name: "Sessions", targetValue: 1_000, trackingPeriod: 30 },
      ],
    }));

    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe("Review Sessions");
    expect(actions[0].message).toContain("1,000 KPI target");
    expect(actions[0].message).toContain("Verified 317");
  });

  it("computes Key Events per Session from the exact traffic window, not the outcome aggregate", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", targetValue: 15, trackingPeriod: 30, priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Key Events per Session");
    expect(action.message).toContain("Verified 13.25% from 30 completed reporting days (campaign reporting timezone) versus the 15% KPI target");
    expect(action.message).not.toContain("12.8%");
  });

  it("uses campaign-to-date financial inputs and lower-is-better CPA direction", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "cpa", name: "Cost Per Acquisition", targetValue: 9, timeframe: "lifetime", priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Cost Per Acquisition");
    expect(action.message).toContain("Verified $10.76 from campaign-to-date financial inputs versus the $9.00 KPI target");
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
    expect(action.message).toContain("Verified 26.95x from campaign-to-date financial inputs versus the 25x KPI target");
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

    expect(page).not.toContain("hasOneCompatiblePerformanceScoringTarget");
    expect(page).not.toContain("resolvePerformanceFreshPersistedMetricValue");
    expect(page).not.toContain('action.category === "duplicate-targets"');
    expect(page).not.toContain('action.category === "target-periods"');
    expect(page).toContain("ga4-breakdown?dateRange=30days");
    expect(page).toContain("performance-summary-scoring-read-only");
    expect(page).toContain("const recommendedActions = buildPerformanceRecommendedActions({");
    expect(insights).toContain("const recommendedInsights = recommendedActions;");
    expect(insights).not.toContain("buildPerformanceInsights()");
  });
});
