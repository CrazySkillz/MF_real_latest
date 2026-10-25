import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { deriveExactCumulativeGA4Traffic } from "../client/src/lib/trend-analysis-cumulative";
import { formatPct, normalizeRateToPercent } from "../shared/metric-math";
import { formatConversionCredit } from "../shared/metric-math";
import { buildGA4InsightsRollups, addGA4InsightsDateDays } from "../shared/ga4-insights";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";
import { buildTrendAnalysisAggregate } from "./utils/trend-analysis-aggregate";
import { summarizeGA4TrafficRows } from "../shared/ga4-traffic-window";
import { getGA4KPIReportingWindow } from "./ga4-kpi-benchmark-jobs";

const read = (file: string) => process.env.V1_BATCH7_BASELINE
  ? execFileSync("git", ["show", `1de80e15:${file}`], { encoding: "utf8" }) : readFileSync(file, "utf8");
const ast = (file: string) => ts.createSourceFile(file, read(file), ts.ScriptTarget.Latest, true, file.endsWith("tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
const find = (source: ts.SourceFile, predicate: (node: ts.Node) => boolean) => {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { if (predicate(node)) nodes.push(node); ts.forEachChild(node, visit); };
  visit(source); return nodes;
};
const evaluate = (code: string, env: Record<string, any> = {}) => new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
const binding = (file: string, name: string, env: Record<string, any> = {}) => {
  const source = ast(file);
  const node = find(source, n => (ts.isVariableDeclaration(n) && n.name.getText(source) === name) || (ts.isFunctionDeclaration(n) && n.name?.text === name))[0];
  if (!node) throw new Error(`Missing ${name}`);
  return evaluate(ts.isVariableDeclaration(node) ? `return (${node.initializer!.getText(source)});` : `${node.getText(source).replace(/^export /, "")}; return ${name};`, env);
};
const ga4Page = "client/src/pages/ga4-metrics.tsx";
const executive = "client/src/pages/executive-summary.tsx";
const report = "server/report-scheduler.ts";
const trend = "client/src/pages/trend-analysis.tsx";
const performance = "client/src/pages/campaign-performance.tsx";
const daily = (date: string, sessions = 10) => ({ date, sessions, users: sessions, conversions: 1, revenue: 20, pageviews: sessions, engagedSessions: 0, engagementRate: 0 });

describe("Batch 7 metric display and data-state boundaries", () => {
  it.each(["EUR", "USD", "JPY"])("V1-084 financial finding titles use %s", currency => {
    const source = ast(ga4Page);
    const titles = find(source, n => ts.isPropertyAssignment(n) && n.name.getText(source) === "title" && /connected-source (revenue|spend) is/.test(n.getText(source)));
    expect(titles).toHaveLength(2);
    const zero = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(0);
    for (const node of titles) expect(evaluate(`return (${(node as ts.PropertyAssignment).initializer.getText(source)});`, { formatMoney: () => zero })).toContain(zero);
  });
  it.each([-1, 0, 1])("V1-094 client and both report branches classify ROI %s", roi => {
    const source = ast("client/src/pages/financial-analysis.tsx");
    const node = find(source, n => ts.isIfStatement(n) && n.expression.getText(source) === "financialRoasMetric.available && financialRoiMetric.available")[0];
    const actions: any[] = [];
    evaluate(node.getText(source), { executiveFinancialActions: actions, financialRoasMetric: { available: true, value: 1 + roi / 100 }, financialRoiMetric: { available: true, value: roi }, formatPercentage: (v: number) => `${v.toFixed(2)}%` });
    const title = roi < 0 ? "Return below break-even" : roi === 0 ? "Financial return at break-even" : "Positive financial return";
    expect(actions[0].title).toBe(title);
    const pdf = ast(report);
    const branches = find(pdf, n => ts.isVariableDeclaration(n) && n.name.getText(pdf) === "returnAction");
    expect(branches).toHaveLength(2);
    for (const branch of branches) expect(evaluate(`return (${(branch as ts.VariableDeclaration).initializer!.getText(pdf)});`, { metricAvailable: () => true, metricNumber: (key: string) => key === "roi" ? roi : 1 + roi / 100 }).title).toBe(title);
  });
  it.each([-1, 0, 1])("V1-094 projection equality %s preserves date direction", offset => {
    const source = ast("client/src/pages/financial-analysis.tsx");
    const branches = find(source, n => ts.isConditionalExpression(n) && n.condition.getText(source) === "projectedEndDateOrdinal > pacingCalendar.endDateOrdinal");
    expect(branches).toHaveLength(2);
    for (const node of branches) expect(evaluate(`return (${node.getText(source)});`, { projectedEndDateOrdinal: 100 + offset, pacingCalendar: { endDateOrdinal: 100 } })).toBe(offset < 0 ? "before" : offset === 0 ? "on" : "after");
  });
  it.each([0, 0.5, 1, 1.01, 50])("V1-097 already-percent engagement %s is formatted once", rate => {
    const source = ast(trend);
    const card = find(source, n => ts.isObjectLiteralExpression(n) && n.getText(source).startsWith("{ label: 'Engagement Rate', value: authoritativeHeadlineCurrent"))[0] as ts.ObjectLiteralExpression;
    const value = card.properties.find(n => ts.isPropertyAssignment(n) && n.name.getText(source) === "value") as ts.PropertyAssignment;
    expect(evaluate(`return (${value.initializer.getText(source)});`, { authoritativeHeadlineCurrent: { engagementRate: rate }, formatPct, normalizeRateToPercent })).toBe(formatPct(rate));
    expect(normalizeRateToPercent(0.005)).toBe(0.5);
  });
  it.each([0, 100])("V1-098 zero sessions withhold ratios; measured zero conversions remain zero (sessions %s)", sessions => {
    const response = { success: true, propertyId: "p", startDate: "2026-10-17", endDate: "2026-10-18", dataThroughDate: "2026-10-18", overviewStartDate: "2026-10-01", overviewTotals: { users: sessions, sessions, conversions: 0, engagedSessions: 0 }, data: [daily("2026-10-17", 0), daily("2026-10-18", 0)].map(row => ({ ...row, conversions: 0 })) };
    const result = deriveExactCumulativeGA4Traffic(response, "2026-10-16");
    expect(result?.current.cvr).toBe(sessions ? 0 : null);
    expect(result?.previous.engagementRate).toBe(sessions ? 0 : null);
    expect(result?.current.sessions).toBe(sessions);
  });
  it.each([true, false])("V1-099 CVR label follows its actual denominator (web %s)", web => {
    const summary = buildPerformanceSummaryAggregate({ campaignId: "c", dateRange: "all", webAnalytics: web ? { connected: true, provider: "ga4", sessions: 100, conversions: 10, users: 80 } : undefined, platforms: { linkedin: { connected: true, clicks: 20, conversions: 5, impressions: 100 } } } as any);
    expect(binding(executive, "conversionRateLabel", { performanceSummary: summary, aggregateMetricAvailable: (key: string) => summary.totals[key]?.available })).toBe(web ? "Conversion Rate" : "Click-Through CVR");
    expect(summary.totals.cvr.value).toBe(web ? 10 : 25);
  });
  it.each([0, 0.75, 12.25])("V1-101 current Executive formatter preserves %s conversion credits", value => {
    const format = binding(executive, "formatAggregateInteger", { aggregateMetricAvailable: () => true, aggregateMetricValue: () => value, formatConversionCredit });
    expect(format("conversions")).toBe(formatConversionCredit(value));
    expect(binding(executive, "formatKpiValue", { formatConversionCredit })("conversions", value, "count")).toBe(formatConversionCredit(value));
  });
  it.each(["revenueInputState", "financialConversionsInputState"])("V1-095 %s withholds stale native GA4 inputs", name => {
    const env: any = { demoMode: false, performanceGA4PropertyId: "p", performanceDataThroughDate: "2026-10-23", performanceGA4FinancialEndDate: "2026-10-23", trafficInputState: "stale", hasNativeRevenue: true, hasImportedRevenue: false, nativeRevenue: 300, importedRevenue: 0, nativeFinancialConversions: 20, performanceGA4SummaryResponse: { refreshIsStale: true }, performanceGA4RevenueResponse: { native: { endDate: "2026-10-23" }, imported: { endDate: "2026-10-23" } } };
    for (const key of ["performanceGA4ConnectionsLoading", "performanceSummaryPending", "performanceGA4SummaryLoading", "performanceGA4SummaryPlaceholder", "performanceGA4RevenueLoading", "performanceGA4RevenuePlaceholder", "performanceGA4RevenueError", "performanceGA4ConnectionsError", "performanceGA4SummaryError"]) env[key] = false;
    expect(binding(performance, name, env)).toBe("stale");
    env.trafficInputState = "ready"; expect(binding(performance, name, env)).toBe("ready");
    if (name === "revenueInputState") { env.trafficInputState = "stale"; env.hasNativeRevenue = false; env.hasImportedRevenue = true; expect(binding(performance, name, env)).toBe("ready"); }
  });
  it("V1-077 missing/unrequested dates do not manufacture complete comparisons", () => {
    const rows = Array.from({ length: 14 }, (_, i) => daily(addGA4InsightsDateDays("2026-10-05", i)!));
    const build = (data: any[]) => binding(ga4Page, "trendsDailyRows", { useMemo: (fn: any) => fn(), ga4InsightsTimeSeries: data, trendsCampaignStartDate: "2026-07-01", trendsDataThroughDate: "2026-10-18", addGA4InsightsDateDays });
    expect(build([])).toEqual([]);
    const missing = build(rows.filter(row => !["2026-10-13", "2026-10-14"].includes(row.date)));
    expect(missing).toHaveLength(12);
    expect(buildGA4InsightsRollups(missing, "2026-10-18").last7.complete).toBe(false);
    const measured = build(rows.map(row => row.date === "2026-10-13" ? daily(row.date, 0) : row));
    expect(buildGA4InsightsRollups(measured, "2026-10-18").last7.complete).toBe(true);
    expect(measured).toHaveLength(14);
  });
  it.each([["all", "2000-01-01", "2026-09-01", 20], ["7d", "2026-10-17", "2026-10-17", 10], ["30d", "2026-09-24", "2026-09-24", 10], ["90d", "2026-07-26", "2026-09-01", 20]])("V1-100 Executive %s uses primary-property saved facts once", async (period, start, expectedStart, sessions) => {
    const source = ast("server/routes-oauth.ts");
    const block = find(source, n => ts.isTryStatement(n) && /^\{\s*const ga4Connections =/.test(n.tryBlock.getText(source)) && n.tryBlock.getText(source).includes("activeGA4Connection"))[0] as ts.TryStatement;
    expect(block).toBeTruthy();
    const calls: any[] = [];
    const result = await evaluate(`return (async () => { let ga4Metrics: any = {}; let ga4LastUpdate = null; let hasGA4Connection = false; ${block.getText(source)} return {ga4Metrics, ga4LastUpdate}; })();`, { id: "c", periodParam: period, startDate: start, endDate: "2026-10-24", campaign: { reportingTimeZone: "Europe/Amsterdam" }, now: new Date("2026-10-24T14:00:00Z"), getGA4KPIReportingWindow, summarizeGA4TrafficRows, parseNum: Number, storage: { getGA4Connections: async () => [{ propertyId: "old" }, { propertyId: "primary", isPrimary: true, importStartDate: "2026-09-01" }], getGA4DailyMetrics: async (...args: any[]) => { calls.push(args); return [daily("2026-09-02"), daily("2026-10-23")]; } }, ga4Service: { getMetricsWithAutoRefresh: () => { throw Error("Provider must not run during this read"); } } });
    expect(calls).toEqual([["c", "primary", expectedStart, "2026-10-23"]]);
    expect(result.ga4Metrics).toMatchObject({ sessions, pageviews: sessions, revenue: Number(sessions) * 2 });
    expect(Object.keys(result.ga4Metrics).sort()).toEqual(["bounceRate", "conversions", "pageviews", "revenue", "sessions", "users"]);
  });
  it.each(["empty", "read-failure", "missing-source", "recorded-zero"])("V1-100 Executive %s preserves unavailable versus zero", async mode => {
    const source = ast("server/routes-oauth.ts");
    const block = find(source, n => ts.isTryStatement(n) && /^\{\s*const ga4Connections =/.test(n.tryBlock.getText(source)) && n.tryBlock.getText(source).includes("activeGA4Connection"))[0] as ts.TryStatement;
    const initial = find(block.parent as ts.SourceFile, n => ts.isVariableDeclaration(n) && n.name.getText(source) === "ga4Metrics")[0] as ts.VariableDeclaration;
    const result = await evaluate(`return (async () => { let ga4Metrics = ${initial.initializer!.getText(source)}; let ga4LastUpdate = null; let hasGA4Connection = false; ${block.getText(source)} return ga4Metrics; })();`, { id: "c", periodParam: "all", startDate: "2000-01-01", endDate: "2026-10-24", campaign: { reportingTimeZone: "Europe/Amsterdam" }, now: new Date("2026-10-24T14:00:00Z"), getGA4KPIReportingWindow, summarizeGA4TrafficRows, console: { log: () => undefined }, storage: { getGA4Connections: async () => mode === "missing-source" ? [] : [{ propertyId: "primary", isPrimary: true, importStartDate: "2026-09-01" }], getGA4DailyMetrics: async () => { if (mode === "read-failure") throw new Error("fixture read failure"); return mode === "recorded-zero" ? [{ ...daily("2026-10-23", 0), conversions: 0, revenue: 0 }] : []; } } });
    expect(result).toEqual({ sessions: mode === "recorded-zero" ? 0 : null, conversions: mode === "recorded-zero" ? 0 : null, pageviews: mode === "recorded-zero" ? 0 : null, users: mode === "recorded-zero" ? 0 : null, revenue: mode === "recorded-zero" ? 0 : null, bounceRate: null });
  });
  it.each([0, 100])("V1-098 report headline ratios preserve unavailable versus zero (%s sessions)", sessions => {
    const values = { users: 0, sessions, conversions: 0, engagedSessions: 0 };
    for (const [name, variable] of [["trendCurrentMetric", "performancePageTrafficTotals"], ["trendPreviousMetric", "trendPreviousTrafficTotals"]]) {
      const metric = binding(report, name, { [variable]: values });
      expect(metric("cvr")).toBe(sessions ? 0 : null);
      expect(metric("engagementRate")).toBe(sessions ? 0 : null);
    }
  });
  it("V1-077 scheduled report comparisons require calendar coverage", () => {
    const build = binding("server/ga4-scheduled-report-pdf.ts", "buildTrendRollups", { buildGA4InsightsRollups });
    const data = Array.from({ length: 16 }, (_, i) => daily(addGA4InsightsDateDays("2026-10-03", i)!));
    expect(build(data, "2026-10-18").last7.complete).toBe(true);
    expect(build(data.filter(row => row.date !== "2026-10-13"), "2026-10-18").last7.complete).toBe(false);
    expect(build(data, "2026-10-20").last7.complete).toBe(false);
  });
  it.each([0, 50])("V1-056 retained Trend preserves native revenue and canonical imported %s", revenue => {
    const source = (id: string, category: any, metrics: any) => ({ id, label: id, category, connected: true, capabilities: Object.keys(metrics), includedMetrics: Object.keys(metrics), excludedMetrics: [], dailyRows: [{ date: "2026-10-23", metrics }] });
    const aggregate = buildTrendAnalysisAggregate({ campaignId: "c", dateRange: "7days", startDate: "2026-10-17", endDate: "2026-10-23", sources: [source("ga4", "web_analytics", { sessions: 100, conversions: 10, revenue: 200 }), source("ads", "paid_media", { clicks: 20, conversions: 5, spend: 100 })], financialDailyRows: [{ date: "2026-10-23", spend: 0, revenue }] });
    expect(aggregate.dailyTotals[0].metrics).toMatchObject({ conversions: 10, cvr: 10, spend: 0, revenue: 200 + revenue, cpc: 0 });
    expect(aggregate.metrics.conversions.sources).toEqual(["ga4"]);
    expect(aggregate.metrics.revenue.sources).toContain("canonical_revenue_sources");
  });
});
