import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  getGA4KpiReportingWindowLabel,
  resolveGA4KpiConsumerState,
  resolveGA4InsightTargetPeriodCompatibility,
  type GA4KpiInputState,
} from "../shared/ga4-kpi-consumer-state";

const readyInputs = {
  listState: "ready" as const,
  trafficState: "ready" as GA4KpiInputState,
  revenueState: "ready" as GA4KpiInputState,
  spendState: "ready" as GA4KpiInputState,
};

describe("GA4 KPI Commit 7 UI/browser state contract", () => {
  it("distinguishes list loading, failure, and retained-list staleness from a verified list", () => {
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", listState: "loading" }).code).toBe("loading");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", listState: "failed" }).code).toBe("failed");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", listState: "stale" })).toMatchObject({
      code: "stale",
      eligible: false,
    });
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions" })).toMatchObject({ code: "verified", eligible: true });
  });

  it("fails closed for required source loading, unavailable, stale, blocked, and insufficient states", () => {
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", trafficState: "loading" }).code).toBe("loading");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", trafficState: "unavailable" }).code).toBe("unavailable");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "sessions", trafficState: "stale" })).toMatchObject({ code: "stale", eligible: false });
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "Revenue", missingDependencies: ["Revenue"] }).code).toBe("blocked");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "Conversion Rate", sufficiencyReason: "Sessions are required." }).code).toBe("insufficient_data");
  });

  it("applies metric-specific dependencies without broadening unrelated failures", () => {
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "Sessions", revenueState: "unavailable", spendState: "unavailable" }).eligible).toBe(true);
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "Revenue", spendState: "unavailable" }).eligible).toBe(true);
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "ROAS", spendState: "unavailable" }).code).toBe("unavailable");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "CPA", trafficState: "stale" }).code).toBe("stale");
    expect(resolveGA4KpiConsumerState({ ...readyInputs, metric: "__custom__", trafficState: "unavailable", revenueState: "unavailable", spendState: "unavailable" }).eligible).toBe(true);
  });

  it("states the exact standard reporting windows, including legacy aliases", () => {
    expect(getGA4KpiReportingWindowLabel("totalSessions")).toBe("Initial import through latest completed reporting day");
    expect(getGA4KpiReportingWindowLabel("Engagement Rate")).toBe("Initial import through latest completed reporting day");
    expect(getGA4KpiReportingWindowLabel("totalRevenue")).toBe("Campaign-to-date financial inputs");
    expect(getGA4KpiReportingWindowLabel("ROAS")).toBe("Campaign-to-date financial inputs");
    expect(getGA4KpiReportingWindowLabel("__custom__")).toBe("Saved custom value (no standard GA4 reporting window)");
  });

  it("treats standard KPI and Benchmark goals as absolute targets against their authoritative current values", () => {
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "sessions", timeframe: "monthly", trackingPeriod: 30,
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "sessions", timeframe: "quarterly", trackingPeriod: 90,
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "revenue", timeframe: "monthly",
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "revenue", timeframe: "campaign-to-date",
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "sessions", period: "monthly",
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "sessions", period: "rolling-30-days",
    }).comparable).toBe(true);
    expect(resolveGA4InsightTargetPeriodCompatibility({
      metric: "__custom__", timeframe: "monthly", trackingPeriod: 30,
    }).comparable).toBe(false);
  });


  it("wires the actual KPI cards, tracker, Insights, breach pulse, and browser PDF through the shared state", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf8");
    const tracker = page.slice(page.indexOf("const kpiTracker = useMemo"), page.indexOf("const benchmarkTracker = useMemo"));
    const insights = page.slice(page.indexOf("const insights = useMemo"), page.indexOf("// Collect GA4 campaign names"));
    const pdf = page.slice(page.indexOf("// ========== KPIs =========="), page.indexOf("// ========== BENCHMARKS =========="));
    const cards = page.slice(page.indexOf('<TabsContent value="kpis"'), page.indexOf('<TabsContent value="benchmarks"'));

    expect(page).toContain("const overviewTotalsSource = overviewSummarySource ?? (hasDailyOverviewResponse ? dailySummedTotals : null);");
    expect(page).toContain("isError: kpisError");
    expect(page).toContain('kpiListState === "failed"');
    expect(page).toContain("This is not being presented as a verified empty state.");
    expect(tracker).toContain("const consumerState = getKpiConsumerState(kpi);");
    expect(tracker).toContain("if (!consumerState.eligible) continue;");
    expect(insights).toContain("if (!getKpiConsumerState(k).eligible) continue;");
    expect(insights).toContain("No KPI or Benchmark performance conclusion is generated from these values.");
    expect(insights).toContain("if (!getKpiInsightPeriodCompatibility(k).comparable) continue;");
    expect(insights).toContain("if (!getBenchmarkInsightPeriodCompatibility(b).comparable) continue;");
    expect(insights).toContain("Target reporting periods need review");
    expect(pdf).toContain("const consumerState = getKpiConsumerState(k);");
    expect(pdf).toContain("Last-good value (not verified)");
    expect(pdf).toContain('getGA4KpiReportingWindowLabel("sessions")');
    expect(pdf).toContain('getGA4KpiReportingWindowLabel("revenue")');
    expect(pdf).not.toContain("Traffic/rate: 30 completed reporting days in campaign timezone. Financial: campaign-to-date.");
    expect(pdf).toContain('kpiTracker.scored > 0 ? `${Number(kpiTracker.avgPct || 0).toFixed(1)}%` : "—"');
    expect(cards).toContain("kpi.alertsEnabled && consumerState.eligible");
    expect(cards).toContain('const hasAlertThreshold = kpi.alertThreshold !== null && typeof kpi.alertThreshold !== "undefined"');
    expect(cards).toContain("Window: {getGA4KpiReportingWindowLabel(kpi?.metric, kpi?.name)}");
    expect(cards).toContain('kpiTracker.scored > 0 ? `${kpiTracker.avgPct.toFixed(1)}%` : "—"');
  });
});
