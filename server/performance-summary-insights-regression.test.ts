import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import {
  buildPerformanceRecommendedActions,
  summarizePerformanceTrafficWindow,
  type PerformanceRecommendedActionsInput,
} from "../client/src/lib/performance-recommended-actions";

const dailyRows = Array.from({ length: 31 }, (_, index) => {
  const date = new Date(Date.UTC(2026, 6, 19 + index)).toISOString().slice(0, 10);
  return {
    date,
    sessions: index === 0 ? 1_644 : index === 1 ? 317 : 0,
    users: index === 0 ? 1_300 : index === 1 ? 280 : 0,
    conversions: index === 0 ? 209 : index === 1 ? 42 : 0,
    pageviews: index === 0 ? 2_000 : index === 1 ? 500 : 0,
    engagedSessions: index === 0 ? 1_000 : index === 1 ? 200 : 0,
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
  it("uses exactly the 30 completed dates ending at dataThroughDate", () => {
    const window = summarizePerformanceTrafficWindow(dailyRows, "2026-08-18");

    expect(window).toMatchObject({ valid: true, startDate: "2026-07-20", endDate: "2026-08-18" });
    expect(window.totals).toMatchObject({ sessions: 317, conversions: 42, users: 280, pageviews: 500, engagedSessions: 200 });
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

    expect(page).toContain('import { buildPerformanceRecommendedActions } from "@/lib/performance-recommended-actions";');
    expect(page).toContain("const recommendedActions = buildPerformanceRecommendedActions({");
    expect(insights).toContain("const recommendedInsights = recommendedActions;");
    expect(insights).not.toContain("buildPerformanceInsights()");
  });
});
