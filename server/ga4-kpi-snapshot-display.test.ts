import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";
import { resolveGA4OverviewFinancialRefreshWarning } from "../shared/ga4-financial-source";
import { resolveGA4KpiLiveValue } from "../shared/ga4-kpi-live-value";
import { getGA4KpiMetricDependencies } from "../shared/ga4-kpi-metric-identity";
import { resolveGA4KpiConsumerState } from "../shared/ga4-kpi-consumer-state";
import { resolveKpiDataSufficiency, resolveBenchmarkDataSufficiency } from "../shared/kpi-math";
import { resolveGA4InsightsCampaignToDateSufficiencyReason } from "../shared/ga4-insights";

const source = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const file = ts.createSourceFile("ga4-metrics.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const component = file.statements.find((node): node is ts.FunctionDeclaration =>
  ts.isFunctionDeclaration(node) && node.name?.text === "GA4Metrics")!;
const declarations = component.body!.statements.flatMap((statement) =>
  ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []);
const declaration = (name: string) => declarations.find((node) => node.name.getText(file) === name);
const compile = (text: string) => ts.transpileModule(text, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const reportingHelpers = file.statements.flatMap((statement) =>
  ts.isVariableStatement(statement) ? [...statement.declarationList.declarations] : []).filter((node) =>
  ["DEFAULT_GA4_TRENDS_REPORTING_TIME_ZONE", "normalizeClientReportingTimeZone", "formatReportingTimestampLabel"].includes(node.name.getText(file)));

const fixture = (): Record<string, any> => ({
  campaignId: "campaign-a", campaignCurrency: "EUR", selectedGA4PropertyId: "123", primaryGA4PropertyId: "123",
  ga4ConnectionUsable: true, ga4DailyPlaceholder: false, ga4ConnectionError: false, ga4Error: false,
  ga4DailyResp: {
    propertyId: "123", overviewStartDate: "2026-09-01", latestStoredDailyDate: "2026-10-15",
    reportingTimeZone: "Europe/Amsterdam", lastUpdated: "2026-10-16T12:05:00.000Z",
  },
  financialDailySnapshotLoading: false, financialDailySnapshotError: false,
  financialDailySnapshotResp: { success: true, snapshot: {
    campaignId: "campaign-a", reportingDate: "2026-10-15", recordedAt: "2026-10-16T06:06:00.000Z",
    metrics: { financialDaily: {
      currency: "EUR",
      currentValueWindow: { startDate: "2026-09-01", endDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" },
      inputs: {
        revenue: { available: true, value: "1000.00" }, spend: { available: true, value: "200.00" },
        conversions: { available: true, value: 10 },
      },
    } },
  } },
  // Separate requests have newer values, even though financial publication failed.
  financialRevenue: 9000, financialSpend: 600, financialConversions: 30, financialROI: 1400, financialCPA: 20,
  breakdownTotals: { sessions: 300, users: 240, conversions: 30, pageviews: 600 }, overviewEngagementRate: 75,
  kpiListState: "ready", benchmarkListState: "ready", kpiTrafficInputState: "ready", trafficKpiInputState: "ready",
  revenueKpiInputState: "ready", spendKpiInputState: "ready", financialConversionsKpiInputState: "ready",
  schedulerSynchronizedTrafficState: "ready", schedulerSynchronizedConversionsState: "ready",
  ga4NoCompletedWindow: false, activeRevenueSource: { id: "source-a" }, spendMetricAvailable: true,
  ga4RevenueWindowState: { missingRevenueDependency: false },
});

// Execute the actual page declarations with mocked query results; no copied value/state logic.
function page(input = fixture()) {
  const bindings = {
    ...input, computeCpa, computeRoiPercent, resolveGA4OverviewFinancialRefreshWarning, resolveGA4KpiLiveValue,
    getGA4KpiMetricDependencies, resolveGA4KpiConsumerState, resolveKpiDataSufficiency,
    resolveBenchmarkDataSufficiency, resolveGA4InsightsCampaignToDateSufficiencyReason,
  };
  const overview = declarations.filter((node) => /^overviewFinancial/.test(node.name.getText(file)));
  const snapshotStates = declarations.filter((node) => /^(getFinancialSnapshotKpiInputState|snapshot.*KpiInputState)$/.test(node.name.getText(file)));
  const functions = ["getMissingDependenciesForMetric", "getLiveKpiValue", "getLiveBenchmarkCurrentValue",
    "getKpiDataSufficiency", "getBenchmarkDataSufficiency", "getKpiConsumerState", "getBenchmarkConsumerState",
    "getFindingKpiConsumerState", "getFindingBenchmarkConsumerState"];
  const body = [...reportingHelpers, ...overview, ...snapshotStates, ...functions.map((name) => declaration(name)!)].map((node) => `const ${node.getText(file)};`).join("\n");
  const exports = [...functions, ...overview.map((node) => node.name.getText(file)), ...snapshotStates.map((node) => node.name.getText(file))];
  return new Function(...Object.keys(bindings), compile(`${body}\nreturn { ${exports.join(", ")} };`))(...Object.values(bindings));
}

describe.each(["Kpi", "Benchmark"])("GA4 %s saved financial display", (kind) => {
  const state = (p: any, metric: string) => p[`get${kind}ConsumerState`]({ metric });
  const value = (p: any, metric: string) => Number(kind === "Kpi" ? p.getLiveKpiValue({ metric }) : p.getLiveBenchmarkCurrentValue(metric));

  it("retains Overview's financial inputs after a failed publication, without mixing newer CPA conversions", () => {
    const input = fixture();
    input.financialCPA = 600 / 60;
    input.financialConversions = 60;
    const p = page(input);
    for (const [metric, expected] of [["revenue", 1000], ["roas", 5], ["roi", 400], ["cpa", 20]] as const) {
      expect(value(p, metric)).toBe(expected);
      expect(state(p, metric)).toMatchObject({ code: "stale", eligible: false });
      expect(p[`getFinding${kind}ConsumerState`]({ metric }).eligible).toBe(false);
    }
    expect(value(p, "sessions")).toBe(300);
    expect(value(p, "conversions")).toBe(30);
    expect(state(p, "sessions").eligible).toBe(true);
  });

  it("uses the next successfully published values and restores scoring", () => {
    const input = fixture();
    const snapshot = input.financialDailySnapshotResp.snapshot;
    snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    snapshot.metrics.financialDaily.inputs.revenue.value = "1800.00";
    snapshot.metrics.financialDaily.inputs.spend.value = "300.00";
    snapshot.metrics.financialDaily.inputs.conversions.value = 20;
    const p = page(input);
    for (const [metric, expected] of [["totalRevenue", 1800], ["ROAS", 6], ["ROI", 500], ["CPA", 15]] as const) {
      expect(value(p, metric)).toBe(expected);
      expect(state(p, metric).eligible).toBe(true);
    }
  });

  it("keeps native-only Revenue valid with no external Revenue or Spend source", () => {
    const input = fixture();
    input.activeRevenueSource = null;
    input.spendMetricAvailable = false;
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.spend = { available: false, value: null };
    const p = page(input);
    expect(value(p, "revenue")).toBe(1000);
    expect(state(p, "revenue").eligible).toBe(true);
    for (const metric of ["roas", "roi", "cpa"]) expect(state(p, metric).eligible).toBe(false);
  });

  it.each(["spend", "conversions"])("uses saved %s for denominator sufficiency even when a live request has positive values", (field) => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs[field].value = 0;
    const p = page(input);
    expect(state(p, "cpa").code).toBe("insufficient_data");
    if (field === "spend") expect(state(p, "roas").code).toBe("insufficient_data");
  });

  it("preserves valid zero revenue and custom values", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.revenue.value = "0.00";
    const p = page(input);
    expect(value(p, "revenue")).toBe(0);
    expect(value(p, "roi")).toBe(-100);
    expect(state(p, "revenue").eligible).toBe(true);
    expect(state(p, "__custom__").eligible).toBe(true);
    expect(p.getLiveKpiValue({ metric: "__custom__", currentValue: "123.45" })).toBe("123.45");
    expect(p.getLiveBenchmarkCurrentValue("__custom__", "Custom", "123.45")).toBe(123.45);
  });

  it.each(["missing", "read_failure", "revenue_unavailable", "currency", "campaign", "property", "window"])("does not score unverified financial inputs: %s", (failure) => {
    const input = fixture();
    const snapshot = input.financialDailySnapshotResp.snapshot;
    if (failure === "missing") input.financialDailySnapshotResp.snapshot = null;
    if (failure === "read_failure") { input.financialDailySnapshotResp = undefined; input.financialDailySnapshotError = true; }
    if (failure === "revenue_unavailable") snapshot.metrics.financialDaily.inputs.revenue.available = false;
    if (failure === "currency") snapshot.metrics.financialDaily.currency = "USD";
    if (failure === "campaign") snapshot.campaignId = "campaign-b";
    if (failure === "property") { input.selectedGA4PropertyId = "456"; input.ga4DailyResp.propertyId = "456"; }
    if (failure === "window") snapshot.metrics.financialDaily.currentValueWindow.startDate = "2026-09-02";
    const p = page(input);
    expect(state(p, "revenue")).toMatchObject({ code: "unavailable", eligible: false });
    expect(state(p, "sessions").eligible).toBe(true);
  });

  it("retains cached snapshot values but excludes them from scoring after a snapshot request fails", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
    input.financialDailySnapshotError = true;
    expect(value(page(input), "revenue")).toBe(1000);
    expect(state(page(input), "revenue").code).toBe("stale");
  });

  it("keeps the saved editor value when the financial snapshot is missing, without scoring it", () => {
    const input = fixture();
    input.financialDailySnapshotResp.snapshot = null;
    const p = page(input);
    expect(p.getLiveKpiValue({ metric: "revenue", currentValue: "725.50" })).toBe("725.50");
    expect(p.getLiveBenchmarkCurrentValue("revenue", "Revenue", "725.50")).toBe(725.5);
    expect(state(p, "revenue").eligible).toBe(false);
  });

  it("does not use a previous property's placeholder while the selected daily data loads", () => {
    const input = fixture();
    input.ga4DailyPlaceholder = true;
    input.kpiTrafficInputState = "loading";
    expect(state(page(input), "revenue").code).toBe("loading");
  });
});

it.each(["overview", "kpis", "benchmarks", "insights", "reports"])("loads the saved financial update on direct entry to %s", (activeTab) => {
  const query = declarations.find((node) => node.name.getText(file).includes("financialDailySnapshotResp"))!;
  const options = (query.initializer as ts.CallExpression).arguments[0].getText(file);
  const result = new Function("activeTab", "campaignId", "ga4OverviewExpectedEndDate", "campaignCurrency", compile(`return (${options});`))(activeTab, "campaign-a", "2026-10-15", "EUR");
  expect(result.enabled).toBe(true);
  expect(result.queryKey).toEqual(["/api/campaigns", "campaign-a", "financial-daily-snapshot", "2026-10-15", "EUR"]);
});

it.each(["kpiTracker", "benchmarkTracker"])("updates %s scoring when only the saved financial response changes", (name) => {
  const input = fixture();
  const item = { metric: "revenue", currentValue: "50", targetValue: "2000", benchmarkValue: "2000" };
  const rows = [item];
  const evaluated: number[] = [];
  let previousDeps: unknown[] | undefined;
  let cached: any;
  const useMemo = (callback: () => unknown, deps: unknown[]) => {
    if (!previousDeps || deps.some((dep, index) => !Object.is(dep, previousDeps![index]))) cached = callback();
    previousDeps = deps;
    return cached;
  };
  const render = () => {
    const p = page(input);
    const bindings = {
      ...input, ...p, useMemo, platformKPIs: rows, benchmarks: rows, ga4Metrics: null, dailySummedTotals: null,
      financialROAS: 15, revenueMetricAvailable: true,
      stripNumberFormatting: (value: string) => value.replace(/,/g, ""),
      // Classification math is covered separately; exercise the actual memo and eligibility loop here.
      computeKpiProgress: () => { evaluated.push(Number(p.getLiveKpiValue(item))); return { band: "near", fillPct: 50 }; },
      computeBenchmarkProgress: () => { evaluated.push(p.getLiveBenchmarkCurrentValue("revenue")); return { status: "on_track", pct: 50 }; },
      formatKpiTolerancePolicyLabel: () => "test tolerance", summarizeKpiToleranceLabels: () => "test tolerance",
    };
    return new Function(...Object.keys(bindings), compile(`return (${declaration(name)!.initializer!.getText(file)});`))(...Object.values(bindings));
  };
  expect(render()).toMatchObject({ stale: 1, scored: 0 });
  expect(evaluated).toEqual([]);
  input.financialDailySnapshotResp.snapshot.recordedAt = "2026-10-16T12:06:00.000Z";
  expect(render()).toMatchObject({ stale: 0, scored: 1 });
  expect(evaluated).toEqual([1000]);
  input.financialDailySnapshotResp.snapshot.metrics.financialDaily.inputs.revenue.value = "1800.00";
  expect(render().scored).toBe(1);
  expect(evaluated).toEqual([1000, 1800]);
});
