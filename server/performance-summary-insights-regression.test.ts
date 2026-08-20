import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPerformanceRecommendedActions,
  resolvePerformanceAggregateMetricValue,
  resolvePerformanceConfiguredMetricValue,
  resolvePerformanceHealthCoverage,
  resolvePerformanceLiveMetricValue,
  resolvePerformancePriorityRank,
  type PerformanceRecommendedActionsInput,
} from "../client/src/lib/performance-recommended-actions";
import { resolveGA4InsightTargetPeriodCompatibility } from "../shared/ga4-kpi-consumer-state";
import {
  classifyKpiBandWithPolicy,
  computeBenchmarkThresholdResult,
  isLowerIsBetterKpi,
  resolveKpiThresholdPolicy,
} from "../shared/kpi-math";

const baseInput = (overrides: Partial<PerformanceRecommendedActionsInput> = {}): PerformanceRecommendedActionsInput => ({
  kpis: [],
  benchmarks: [],
  kpiListState: "ready",
  benchmarkListState: "ready",
  trafficState: "ready",
  revenueState: "ready",
  spendState: "ready",
  financialConversionsState: "ready",
  trafficTotals: { sessions: 1_183, users: 1_184, conversions: 152, pageviews: 1_500, engagedSessions: 809 },
  trafficMetricAvailability: { sessions: true, users: true, conversions: true, pageviews: true, conversion_rate: true, engagement_rate: true },
  financialRevenue: 72_766.69,
  financialSpend: 2_699.75,
  financialConversions: 152,
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

  it("derives every standard health metric from cumulative Overview inputs instead of a rolling window", () => {
    const trafficTotals = baseInput().trafficTotals;
    const value = (metric: string) => resolvePerformanceLiveMetricValue({
      item: { metric, currentValue: 999_999 },
      trafficTotals,
      financialRevenue: 72_766.69,
      financialSpend: 2_699.75,
      financialConversions: 152,
    });

    expect(value("Total Users")).toBe(1_184);
    expect(value("Total Sessions")).toBe(1_183);
    expect(value("Conversions")).toBe(152);
    expect(value("Conversion Rate")).toBe(12.85);
    expect(value("Engagement Rate")).toBe(68.39);
    expect(value("Revenue")).toBe(72_766.69);
    expect(value("ROAS")).toBe(26.95);
    expect(value("ROI")).toBe(2_595.31);
    expect(value("CPA")).toBe(17.76);
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

  it("uses the refreshed KPI current value even when the independent daily-activity freshness flag is stale", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      trafficState: "stale",
      kpis: [{
        metric: "Total Users",
        name: "Total Users",
        currentValue: "1184.00",
        targetValue: "820.00",
        trackingPeriod: 30,
        updatedAt: "2026-08-20T08:18:06.095Z",
      }],
    }));

    expect(action).toMatchObject({ type: "success", title: "Users on target" });
    expect(action.message).toContain("Verified 1,184");
  });

  it("treats a numeric refreshed KPI current value as the Performance Summary source of truth", () => {
    const sessionsTarget = {
      metric: "sessions",
      name: "Sessions",
      currentValue: "1183",
      targetValue: "950",
      trackingPeriod: 30,
      updatedAt: "2026-08-20T08:18:07.767Z",
    };
    const actions = buildPerformanceRecommendedActions(baseInput({
      trafficState: "stale",
      kpis: [sessionsTarget],
    }));
    const health = resolvePerformanceHealthCoverage({
      configuredKpiCount: 1,
      configuredBenchmarkCount: 0,
      scoredKpiCount: resolvePerformanceConfiguredMetricValue(sessionsTarget) === null ? 0 : 1,
      scoredBenchmarkCount: 0,
      kpisOnTrack: 1,
      benchmarksOnTrack: 0,
    });

    expect(resolvePerformanceConfiguredMetricValue(sessionsTarget)).toBe(1_183);
    expect(health).toMatchObject({ verifiedMetricCount: 1, excludedMetricCount: 0, healthScore: 100 });
    expect(actions).toEqual([expect.objectContaining({ type: "success", title: "Sessions on target" })]);
    expect(actions[0].message).toContain("Verified 1,183");
  });

  it("scores every standard target against cumulative Overview values", () => {
    const productionKpis = [
      { metric: "conversion_rate", name: "Conversion Rate", currentValue: 12.85, targetValue: 15, trackingPeriod: 30 },
      { metric: "cpa", name: "Cost Per Acquisition", currentValue: 17.76, targetValue: 9, timeframe: "monthly", trackingPeriod: 30 },
      { metric: "engagement_rate", name: "Engagement Rate", currentValue: 68.39, targetValue: 89, trackingPeriod: 30 },
      { metric: "revenue", name: "Revenue", currentValue: 72_766.69, targetValue: 25_000, timeframe: "monthly" },
      { metric: "roas", name: "ROAS", currentValue: 26.95, targetValue: 25, timeframe: "monthly" },
      { metric: "roi", name: "ROI", currentValue: 2_595.31, targetValue: 2_000, timeframe: "monthly" },
      { metric: "sessions", name: "Sessions", currentValue: 1_183, targetValue: 950, trackingPeriod: 30 },
      { metric: "users", name: "Users", currentValue: 1_184, targetValue: 820, trackingPeriod: 30 },
    ];
    const productionBenchmarks = [
      { metric: "conversions", name: "Conversions", currentValue: 152, benchmarkValue: 299, period: "monthly" },
      { metric: "revenue", name: "Revenue", currentValue: 72_766.69, benchmarkValue: 20_000, period: "monthly" },
    ];
    const compatibleKpis = productionKpis.filter((item) => resolveGA4InsightTargetPeriodCompatibility(item).comparable);
    const compatibleBenchmarks = productionBenchmarks.filter((item) => resolveGA4InsightTargetPeriodCompatibility(item).comparable);
    const liveInput = baseInput({ kpis: compatibleKpis, benchmarks: compatibleBenchmarks });
    const current = (item: any) => resolvePerformanceConfiguredMetricValue(item);
    const scoredKpis = compatibleKpis.map((item) => {
      const value = current(item)!;
      const target = Number(item.targetValue);
      const lowerIsBetter = isLowerIsBetterKpi(item);
      const policy = resolveKpiThresholdPolicy({ ...item, current: value, target, lowerIsBetter });
      return classifyKpiBandWithPolicy({ current: value, target, lowerIsBetter, policy });
    });
    const scoredBenchmarks = compatibleBenchmarks.map((item) => computeBenchmarkThresholdResult({
      ...item,
      current: current(item)!,
      benchmarkValue: item.benchmarkValue,
    }).status);
    const coverage = resolvePerformanceHealthCoverage({
      configuredKpiCount: compatibleKpis.length,
      configuredBenchmarkCount: compatibleBenchmarks.length,
      scoredKpiCount: scoredKpis.length,
      scoredBenchmarkCount: scoredBenchmarks.length,
      kpisOnTrack: scoredKpis.filter((band) => band === "above" || band === "near").length,
      benchmarksOnTrack: scoredBenchmarks.filter((status) => status === "on_track").length,
    });
    const actions = buildPerformanceRecommendedActions(liveInput);

    expect(compatibleKpis).toHaveLength(8);
    expect(scoredKpis).toHaveLength(8);
    expect(scoredKpis.filter((band) => band === "above" || band === "near")).toHaveLength(5);
    expect(scoredBenchmarks).toHaveLength(2);
    expect(scoredBenchmarks.filter((status) => status === "on_track")).toHaveLength(1);
    expect(coverage).toEqual({
      configuredMetricCount: 10,
      verifiedMetricCount: 10,
      excludedMetricCount: 0,
      totalOnTrackMetrics: 6,
      healthScore: 60,
    });
    expect(actions.map((action) => action.title)).toEqual(["Review Cost Per Acquisition", "Review Engagement Rate", "Review Key Events per Session"]);
    expect(actions[0].message).toContain("Verified $17.76");
    expect(actions[1].message).toContain("Verified 68.39%");
    expect(actions[2].message).toContain("Verified 12.85%");
  });

  it("evaluates repeated saved target rows and deduplicates only their action cards", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [
        { metric: "sessions", name: "Sessions", currentValue: 1_183, targetValue: 1_500, trackingPeriod: 30 },
        { metric: "sessions", name: "Sessions", currentValue: 1_183, targetValue: 1_600, trackingPeriod: 30 },
      ],
    }));

    expect(actions).toHaveLength(1);
    expect(actions[0].title).toBe("Review Sessions");
    expect(actions[0].message).toContain("1,600 KPI target");
    expect(actions[0].message).toContain("Verified 1,183");
  });

  it("computes Key Events per Session from the cumulative Overview totals", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", currentValue: 12.85, targetValue: 15, trackingPeriod: 30, priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Key Events per Session");
    expect(action.message).toContain("Verified 12.85% from initial import through latest completed reporting day versus the 15% KPI target");
    expect(action.message).not.toContain("13.25%");
  });

  it("uses campaign-to-date financial inputs and lower-is-better CPA direction", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "cpa", name: "Cost Per Acquisition", currentValue: 17.76, targetValue: 9, timeframe: "lifetime", priority: "high" }],
    }));

    expect(action.type).toBe("warning");
    expect(action.title).toBe("Review Cost Per Acquisition");
    expect(action.message).toContain("Verified $17.76 from campaign-to-date financial inputs versus the $9.00 KPI target");
    expect(action.message).toContain("campaign-to-date financial inputs");
  });

  it("uses the refreshed CPA current value when its independent conversion freshness flag is stale", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      financialConversionsState: "stale",
      kpis: [{ metric: "cpa", name: "Cost Per Acquisition", currentValue: 17.76, targetValue: 9, timeframe: "lifetime" }],
    }));

    expect(action).toMatchObject({ type: "warning", title: "Review Cost Per Acquisition" });
    expect(action.message).toContain("Verified $17.76");
  });

  it("does not recommend corrective action when verified ROAS beats a compatible target", () => {
    const [action] = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "roas", name: "ROAS", currentValue: 26.95, targetValue: 25, timeframe: "campaign-to-date" }],
    }));

    expect(action.type).toBe("success");
    expect(action.title).toBe("ROAS on target");
    expect(action.message).toContain("Verified 26.95x from campaign-to-date financial inputs versus the 25x KPI target");
    expect(action.message).toContain("No corrective action");
  });

  it("keeps KPI and Benchmark targets separate instead of treating them as duplicates", () => {
    const actions = buildPerformanceRecommendedActions(baseInput({
      kpis: [{ metric: "conversion_rate", name: "Conversion Rate", currentValue: 12.85, targetValue: 15, trackingPeriod: 30 }],
      benchmarks: [{ metricName: "Conversion Rate", currentValue: 12.85, benchmarkValue: 14, period: "30days" }],
    }));

    expect(actions.some((action) => action.title === "Resolve duplicate targets")).toBe(false);
    expect(actions.filter((action) => action.message.includes("Verified 12.85%"))).toHaveLength(2);
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
    expect(page).not.toContain("performance-summary-scoring-read-only");
    expect(page).toContain("const liveScoringTrafficTotals = performanceGA4SummaryResponse?.overviewTotals || {};");
    expect(page).toContain("resolvePerformanceConfiguredMetricValue(item) ?? resolvePerformanceLiveMetricValue({");
    expect(page).toContain("const recommendedActions = buildPerformanceRecommendedActions({");
    expect(page).toContain("kpis: effectiveKpis,");
    expect(page).toContain("benchmarks: effectiveBenchmarks,");
    expect(page).toContain("trafficState: trafficInputState");
    expect(page).toContain("trafficTotals: scoringTrafficTotals");
    expect(page).toContain("trafficMetricAvailability: scoringTrafficMetricAvailability");
    expect(insights).toContain("const recommendedInsights = recommendedActions;");
    expect(insights).not.toContain("buildPerformanceInsights()");
  });
});
