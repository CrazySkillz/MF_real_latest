import { existsSync, readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";
import { jsPDF } from "jspdf";
import { resolveGA4KpiMetricIdentity } from "../shared/ga4-kpi-metric-identity";
import { formatPct, normalizeRateToPercent, formatConversionCredit } from "../shared/metric-math";
import * as targetMath from "../shared/kpi-math";
import * as insightMath from "../shared/ga4-insights";
import * as comparisonMath from "../shared/ga4-ad-comparison-cards";
import { roundGA4CampaignRevenueForDisplay } from "../shared/ga4-campaign-breakdown";

const page = readFileSync("client/src/pages/ga4-metrics.tsx", "utf8");
const start = page.indexOf("const isGA4OverviewReportDetailBlocked =");
const end = page.indexOf('const { jsPDF } = await import("jspdf");', start);
if (start < 0 || end < start) throw new Error("Browser report preflight not found");
// Run the actual preflight before the PDF dependency is loaded or a file saved.
const preflight = page.slice(start, end) + 'return "ready"; }; return downloadGA4Report;';
function run(overrides: Record<string, any> = {}, configuration?: any, reportType = "custom", body = preflight) {
  const bindings: Record<string, any> = {
    ga4PublicationDisplayPending: false, ga4PublicationDisplayFailed: false,
    ga4InsightsContextFetching: 0, reportInsightsBreakdownError: false,
    ga4ReportForm: {}, normalizeCustomReportConfig: (value: any) => value, resolveGA4KpiMetricIdentity,
    campaignId: "campaign-a", campaign: { reportingTimeZone: "Europe/Amsterdam" }, campaignCurrency: "EUR", selectedGA4PropertyId: "123",
    normalizeClientReportingTimeZone: (value: string) => value,
    platformKPIs: [{ id: "k", metric: "revenue" }], benchmarks: [], revenueDisplaySources: [],
    overviewFinancialSnapshot: { campaignId: "campaign-a", metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-10-15", reportingTimeZone: "Europe/Amsterdam" } } } },
    overviewFinancialRevenueAvailable: true, overviewFinancialConversionsAvailable: true, overviewFinancialSpendAvailable: true,
    overviewFinancialRefreshWarning: null, overviewFinancialReportingDate: "2026-10-16", overviewFinancialRevenue: 130,
    overviewFinancialConversions: 5, overviewFinancialSpend: 20, financialRevenue: 130, financialConversions: 5, financialSpend: 20,
    ga4ToDateResp: { startDate: "2026-10-15", endDate: "2026-10-16" },
    overviewSummaryAvailable: true, financialRevenueAvailable: true, financialSpendAvailable: true,
    importedRevenueError: false, revenueSourcesError: false, revenueBreakdownError: false,
    spendSourcesError: false, spendToDateError: false, spendBreakdownError: false,
    spendSourceDefinitionsKnownEmpty: false, hasSpendSources: true,
    campaignBreakdownUnavailable: false, landingPagesUnavailable: false, conversionEventsUnavailable: false,
    ga4LandingPages: { rows: [] }, ga4ConversionEvents: { rows: [] },
    landingPagesFetching: false, landingPagesError: false, conversionEventsFetching: false, conversionEventsError: false,
    kpiAnalyticsQueries: [], benchmarkAnalyticsQueries: [], reportInsightsBreakdownLoading: false,
    ga4InsightsDailyResp: { reportingTimeZone: "Europe/Amsterdam" }, ga4InsightsDailyError: false, trendsDataThroughDate: "2026-10-16",
    ...overrides,
  };
  const callback = new Function(...Object.keys(bindings), ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
  return callback({ reportType, configuration: configuration || { sections: { kpis: true }, subsections: {}, selectedKpiIds: ["k"], selectedBenchmarkIds: [] } });
}

describe("Browser GA4 report publication gate", () => {
  it.each(["ga4PublicationDisplayPending", "ga4PublicationDisplayFailed"])("withholds a PDF while %s", async state => {
    await expect(run({ [state]: true })).rejects.toThrow("latest displayed figures are still being checked");
  });
  it("accepts aligned figures", async () => { await expect(run()).resolves.toBe("ready"); });
  it("checks saved report configuration with the same detail requirements and retains its malformed-config fallback", () => {
    const body = page.slice(start, page.indexOf("const downloadGA4Report = async", start))
      + "return (opts) => isGA4OverviewReportDetailBlocked(opts.reportType, opts.configuration);";
    const config = JSON.stringify({ sections: { overview: true }, subsections: { overview: { landingPages: true } } });
    expect(run({ landingPagesError: true }, config, "custom", body)).toBe(true);
    expect(run({}, config, "custom", body)).toBe(false);
    expect(run({ landingPagesError: true }, "{invalid", "custom", body)).toBe(false);
    expect(run({ landingPagesError: true }, "{invalid", "overview", body)).toBe(true);
  });
  it.each([
    ["landingPages", { ga4LandingPages: undefined }], ["landingPages", { landingPagesFetching: true }], ["landingPages", { landingPagesError: true }],
    ["conversionEvents", { ga4ConversionEvents: undefined }], ["conversionEvents", { conversionEventsFetching: true }], ["conversionEvents", { conversionEventsError: true }],
  ])("requires %s only when the report includes it: %j", async (section, changes) => {
    const readyAds = { adComparisonBreakdownLoading: false, adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false, breakdownError: false, adComparisonRevenueState: "ready" };
    await expect(run({ ...readyAds, ...changes }, undefined, "ads")).resolves.toBe("ready");
    await expect(run(changes, undefined, "overview")).rejects.toThrow("selected Overview details are not ready");
    const config = { sections: { overview: true }, subsections: { overview: { [String(section)]: true } } };
    await expect(run(changes, config)).rejects.toThrow("selected Overview details are not ready");
    await expect(run(changes, { sections: { overview: true }, subsections: { overview: { summary: true } } })).resolves.toBe("ready");
    await expect(run(changes, { sections: { kpis: true }, subsections: {}, selectedKpiIds: [], selectedBenchmarkIds: [] })).resolves.toBe("ready");
  });
  it.each(["ads", "overview", "kpis", "benchmarks"])("does not block %s on pending or failed Insights-only inputs", async reportType => {
    const changes = { ga4InsightsContextFetching: 1, ga4InsightsDailyError: true, reportInsightsBreakdownError: true,
      adComparisonBreakdownLoading: false, adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false,
      breakdownError: false, adComparisonRevenueState: "ready" };
    await expect(run(changes, undefined, reportType)).resolves.toBe("ready");
    await expect(run({ ...changes, ga4InsightsContextFetching: 0 }, undefined, reportType)).resolves.toBe("ready");
  });
  it("still blocks selected Insights context while pending or failed, including Custom reports", async () => {
    for (const type of ["insights", "custom"]) {
      const config = { sections: { insights: true }, subsections: { insights: { actions: true } } };
      await expect(run({ ga4InsightsContextFetching: 1 }, config, type)).rejects.toThrow("Insights context is still loading");
      await expect(run({ reportInsightsBreakdownError: true }, config, type)).rejects.toThrow("Insights channel data could not refresh");
      await expect(run({ ga4InsightsDailyError: true }, config, type)).rejects.toThrow("completed-day history");
    }
  });
  it.each([
    { financialRevenue: 140 }, { financialConversions: 6 }, { financialSpend: 30 },
    { overviewFinancialSnapshot: null }, { overviewFinancialRefreshWarning: "Retained figures" },
    { overviewFinancialReportingDate: "2026-10-15" }, { campaignCurrency: "USD" },
    { campaign: { reportingTimeZone: "UTC" } }, { overviewFinancialRevenueAvailable: false },
  ])("rejects mixed or unavailable inputs before loading the PDF library: %j", async changes => {
    await expect(run(changes)).rejects.toThrow("successful aligned data refresh");
  });
  it("does not block a nonfinancial custom KPI on an unrelated financial publication", async () => {
    await expect(run({ platformKPIs: [{ id: "k", metric: "sessions" }], overviewFinancialSnapshot: null })).resolves.toBe("ready");
  });
  it("keeps an empty saved KPI selection empty", async () => {
    await expect(run({ overviewFinancialSnapshot: null }, { sections: { kpis: true }, subsections: {}, selectedKpiIds: [], selectedBenchmarkIds: [] })).resolves.toBe("ready");
  });
  it.each(["kpiAnalyticsQueries", "benchmarkAnalyticsQueries", "reportInsightsBreakdownLoading"])("waits for %s before generating Insights actions", async key => {
    const changes = { [key]: key.endsWith("Queries") ? [{ isLoading: true }] : true };
    await expect(run(changes, undefined, "insights")).rejects.toThrow("Insights context is still loading");
    await expect(run(changes, undefined, "overview")).resolves.toBe("ready");
  });
  it.each(["campaignBreakdownUnavailable", "adComparisonBreakdownUnavailable"])("blocks Ad Comparison export when %s includes placeholder data", async key => {
    const ready = { adComparisonBreakdownLoading: false, adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false, breakdownError: false, adComparisonRevenueState: "ready" };
    await expect(run(ready, undefined, "ads")).resolves.toBe("ready");
    await expect(run({ ...ready, [key]: true }, undefined, "ads")).rejects.toThrow("Cannot generate the Ad Comparison report");
  });
});

describe("Browser Overview reports without a Spend source", () => {
  const absentSpend = {
    financialSpendAvailable: false, overviewFinancialSpendAvailable: false,
    financialSpend: 0, overviewFinancialSpend: 0, hasSpendSources: false, spendSourceDefinitionsKnownEmpty: true,
  };
  const customOverview = (selected: string) => ({
    sections: { overview: true },
    subsections: { overview: Object.fromEntries(["summary", "revenue", "spend", "performance", "campaignBreakdown", "landingPages", "conversionEvents"].map(key => [key, key === selected])) },
    selectedKpiIds: [], selectedBenchmarkIds: [],
  });
  it.each(["overview", "spend", "performance"])("allows %s when Spend is confirmed absent", async section => {
    await expect(run(absentSpend, customOverview(section), section === "overview" ? "overview" : "custom")).resolves.toBe("ready");
  });
  it.each([
    ["source lookup failed", { spendSourcesError: true }],
    ["source list not loaded or not empty", { spendSourceDefinitionsKnownEmpty: false }],
    ["source amounts unavailable", { spendSourceDefinitionsKnownEmpty: false, hasSpendSources: true }],
    ["retained source breakdown", { hasSpendSources: true }],
    ["both amount requests failed", { spendToDateError: true, spendBreakdownError: true }],
    ["old published zero Spend source", { overviewFinancialSpendAvailable: true }],
  ])("still blocks %s", async (_name, changes) => {
    await expect(run({ ...absentSpend, ...changes }, undefined, "overview")).rejects.toThrow("unavailable: Spend");
  });
  it("blocks removal of a previously published positive Spend source", async () => {
    await expect(run({ ...absentSpend, overviewFinancialSpendAvailable: true, overviewFinancialSpend: 20 }, undefined, "overview")).rejects.toThrow("successful aligned data refresh");
  });
  it.each([
    ["Summary", { overviewSummaryAvailable: false }], ["Revenue", { revenueSourcesError: true }],
    ["Campaign Breakdown", { campaignBreakdownUnavailable: true }], ["Landing Pages", { landingPagesUnavailable: true }],
    ["Conversion Events", { conversionEventsUnavailable: true }],
  ])("preserves the %s failure guard", async (section, changes) => {
    await expect(run({ ...absentSpend, ...changes }, undefined, "overview")).rejects.toThrow(`unavailable: ${section}.`);
  });
  it("does not require Spend for a custom Summary-only report", async () => {
    await expect(run({ ...absentSpend, spendSourcesError: true }, customOverview("summary"))).resolves.toBe("ready");
  });

  // Execute the complete browser handler with real PDF drawing; intercept only logo loading and file saving.
  const handlerEnd = page.indexOf("const connectedPropertyCount =", end);
  if (handlerEnd < end) throw new Error("Browser report handler end not found");
  const handler = page.slice(start, handlerEnd).replace('const { jsPDF } = await import("jspdf");', "") + "return downloadGA4Report;";
  async function render(changes: Record<string, any>, reportType = "overview", configuration?: any) {
    const doc = new jsPDF();
    const drawn: { text: string; x: number; y: number; width: number; page: number }[] = [];
    const originalText = doc.text.bind(doc);
    const text = vi.spyOn(doc, "text").mockImplementation(((value: string, x: number, y: number, ...args: any[]) => {
      if (typeof value === "string") {
        const width = doc.getTextWidth(value), alignment = args[0]?.align;
        drawn.push({ text: value, x: x - (alignment === "right" ? width : alignment === "center" ? width / 2 : 0), y, width, page: doc.getNumberOfPages() });
      }
      return (originalText as any)(value, x, y, ...args);
    }) as any);
    const save = vi.spyOn(doc, "save").mockReturnValue(doc);
    await run({
      ...absentSpend, jsPDF: function () { return doc; }, loadMimoSaaSReportLogo: async () => null,
      campaign: { name: "Ptomo", currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      ga4Metrics: { propertyId: "123" }, overviewSummaryTotals: { sessions: 2977, users: 2978, conversions: 262 },
      overviewSummaryEngagementRate: 0.724, financialRevenue: 65659.5, overviewFinancialRevenue: 65659.5,
      financialConversions: 262, overviewFinancialConversions: 262, financialROAS: 0,
      ga4HasRevenueMetric: true, ga4RevenueForFinancials: 65659.5, spendDisplaySources: [],
      campaignBreakdownAgg: [], campaignBreakdownMatchedExternalRevenue: new Map(),
      ga4LandingPages: { rows: [] }, ga4ConversionEvents: { rows: [] }, formatPct, normalizeRateToPercent, formatConversionCredit,
      overviewGA4ReportingDate: "2026-10-16", overviewGA4ReportingStartDate: "2026-09-04",
      overviewGA4ReportingTimeZone: "Europe/Amsterdam", overviewGA4UpdatedAt: "Oct 17, 2026, 09:29 PM GMT+2",
      overviewFinancialReportingTimeZone: "Europe/Amsterdam", overviewFinancialUpdatedAt: "Oct 17, 2026, 09:30 PM GMT+2",
      overviewFinancialWindow: { startDate: "2026-09-04" }, overviewRefreshSchedule: "08:00, 14:00, 20:00 (Europe/Amsterdam)",
      formatReportingDateLabel: (value: string) => new Date(`${value}T00:00:00Z`).toLocaleDateString("en-US", { timeZone: "UTC", year: "numeric", month: "short", day: "numeric" }),
      ga4RefreshStatusText: "Imported GA4 data, updated daily", overviewVisibleDataUsingLastGoodData: false,
      pipelineProxyConfigured: false, pipelineProxyLoading: false, pipelineProxyUnavailable: false, hasPipelineProxy: false,
      pipelineProxyData: { success: false, totalToDate: 0 },
      adComparisonNativeRevenue: Number((changes.adComparisonBreakdownAgg || []).reduce((sum: number, row: any) => sum + row.revenue, 0).toFixed(2)),
      adComparisonChartRows: changes.campaignBreakdownAgg || [],
      ...changes,
    }, configuration, reportType, handler);
    expect(save).toHaveBeenCalledOnce();
    expect(doc.output()).toMatch(/^%PDF-/);
    const words = text.mock.calls.map(call => call[0]);
    return Object.assign((label: string) => words[words.indexOf(label.toUpperCase()) + 1], { doc, drawn, words, content: words.flat().join(" ") });
  }
  it("retains full long finding titles in an actual browser Insights PDF", async () => {
    const title = "International expansion campaign sessions from qualified prospects across northern and southern European markets Below Saved Target";
    const result = await render({
      insights: [{ title, severity: "high", category: "targets", description: "Current 1,400 vs target 2,000. Streak: 3 days. Trending up 12.5% over 30d.", recommendation: "Review search / paid, which accounts for 80% of sessions.", dataBasis: "Saved KPI target + current values", confidence: "Medium" }],
      insightsRollups: { availableDays: 14 }, insightsTrendMetric: "sessions", trendsDailyRows: [],
      trendsDataThroughLabel: "Oct 16, 2026", trendsReportingTimeZoneLabel: "Europe/Amsterdam", trendsLastRefreshedLabel: "Oct 17, 2026",
      insightsActionDescription: "Target and channel checks use scoped, completed data.",
      INSIGHT_CATEGORY_GROUPS: [{ key: "targets", label: "Targets off track" }],
    }, "custom", { sections: { insights: true }, subsections: { insights: { actions: true, summaryCards: false, trends: false, dataSummary: false } }, selectedKpiIds: [], selectedBenchmarkIds: [] });
    expect(result.content.replace(/\s+/g, " ")).toContain(title);
    for (const line of result.drawn.filter(line => line.y > 40)) expect(line.x + line.width).toBeLessThanOrEqual(198);
    const artifact = "docs/fixes/v1-batch-7/validation-2026-10-26/context-browser-insights.pdf";
    if (!(process.env.V1_BATCH7_PRESERVE_ARTIFACTS && existsSync(artifact))) writeFileSync(artifact, Buffer.from(result.doc.output("arraybuffer")));
  });
  it("keeps the Trends title with its chart for the supplied three-day/no-spend layout", async () => {
    const rows = ["2026-10-23", "2026-10-24", "2026-10-25"].map(date => ({ date, sessions: 0, conversions: 0, revenue: 0 }));
    const rollups = insightMath.buildGA4InsightsRollups(rows, "2026-10-25");
    const result = await render({ ...insightMath,
      platformKPIs: [], financialRevenue: 8003.96, overviewFinancialRevenue: 8003.96,
      financialConversions: 40, overviewFinancialConversions: 40, ga4RevenueForFinancials: 7653.96,
      insights: [], insightsRollups: rollups, trendsRollups: rollups, trendsDailyRows: rows,
      insightsTrendMetric: "sessions", insightsTrendMode: "daily", trendsDataThroughDate: "2026-10-25",
      executiveFinancialsDescription: "Uses total revenue from GA4 native revenue, Salesforce (Opportunities), HubSpot (Deals); no spend source is connected.",
      trendsDataThroughLabel: "Oct 25, 2026", trendsReportingTimeZoneLabel: "Amsterdam", trendsLastRefreshedLabel: "Oct 26, 2026, 04:38 AM GMT+1",
      spendSourceLabels: [], revenueSourceLabels: ["GA4 native revenue", "Salesforce (Opportunities)", "HubSpot (Deals)"],
      breakdownTotals: { sessions: 604, conversions: 40 }, formatMoney: (value: number) => `EUR ${value.toFixed(2)}`,
      formatNumber: (value: number) => value.toLocaleString("en-US"),
    }, "insights");
    if (!process.env.V1_BATCH7_PRESERVE_ARTIFACTS) writeFileSync("docs/fixes/v1-batch-7/validation-2026-10-26/live-browser-three-day.pdf", Buffer.from(result.doc.output("arraybuffer")));
    expect(result.drawn.find(box => box.text === "Trends")?.page).toBe(result.drawn.find(box => box.text === "Sessions · Daily")?.page);
    expect(result("Revenue")).toBe("EUR 8,003.96");
    expect(result("ROI")).toBe("—");
    for (const box of result.drawn) { expect(box.x + box.width).toBeLessThanOrEqual(198); expect(box.y).toBeLessThanOrEqual(287); }
  });
  it.each(["overview", "kpis", "benchmarks", "ads", "insights", "custom"])("renders actual browser %s content with mixed revenue and verified targets", async type => {
    const target = { id: "k", name: "Revenue goal", metric: "revenue", currentValue: "65659.5", targetValue: "70000", benchmarkValue: "70000", unit: "EUR" };
    const valueBindings = { ...targetMath, getLiveKpiValue: (row: any) => row.currentValue, getLiveBenchmarkCurrentValue: () => target.currentValue, stripNumberFormatting: String };
    const ast = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const names = ["getKpiEffectiveTarget", "computeKpiProgress", "computeBenchmarkProgress"], declarations: string[] = [];
    const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && names.includes(node.name.getText(ast))) declarations.push(`const ${node.getText(ast)};`); ts.forEachChild(node, visit); }; visit(ast);
    const progress = new Function(...Object.keys(valueBindings), ts.transpileModule(declarations.join("\n") + `return { ${names.join(", ")} };`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(valueBindings));
    const nativeRows = [{ name: "saved_campaign", sessions: 2977, users: 2978, conversions: 262, revenue: 65000, conversionRate: 8.8 }];
    const rows = ["2026-10-15", "2026-10-16"].map(date => ({ date, sessions: 100, users: 80, conversions: 10, revenue: 100, pageviews: 200, engagedSessions: 50 }));
    const rollups = insightMath.buildGA4InsightsRollups(rows, "2026-10-16");
    const result = await render({ ...valueBindings, ...progress, ...comparisonMath, ...insightMath,
      platformKPIs: [target], benchmarks: [target], kpiListState: "ready", kpiTracker: { total: 1, above: 0, near: 0, below: 1, scored: 1, avgPct: 93.8 }, benchmarkTracker: { total: 1, onTrack: 0, needsAttention: 1, behind: 0, avgPct: 93.8 },
      getGA4KpiReportingWindowLabel: () => "Initial import through Oct 16, 2026", getKpiConsumerState: () => ({ eligible: true }), getBenchmarkConsumerState: () => ({ eligible: true }),
      getMissingDependenciesForMetric: () => ({ missing: [] }), getBenchmarkDataSufficiency: () => ({ sufficient: true }), getBenchmarkDisplayCurrentValue: () => target.currentValue,
      formatNumberByUnit: (value: string) => Number(value).toLocaleString("en-US"), formatBenchmarkValue: (value: string) => Number(value).toLocaleString("en-US"),
      revenueSourceDisplayLabel: (source: any) => source.displayName || source.sourceType,
      ga4RevenueForFinancials: 65000, revenueDisplaySources: [{ sourceId: "hubspot", sourceType: "hubspot", displayName: "HubSpot", revenue: 659.5 }], sourceRevenueBreakdowns: new Map(),
      campaignBreakdownAgg: nativeRows, adComparisonBreakdownAgg: nativeRows, adComparisonMetric: "sessions", adComparisonBreakdownLoading: false, adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false, adComparisonRevenueState: "ready", materializedRevenueUnavailable: false, breakdownError: false,
      adComparisonRevenueDisplaySources: [{ sourceId: "hubspot", sourceType: "hubspot", displayName: "HubSpot", revenue: 659.5 }], adComparisonSourceRevenueBreakdowns: new Map(),
      insights: [], insightsRollups: rollups, trendsRollups: rollups, trendsDailyRows: rows, insightsTrendMetric: "sessions", insightsTrendMode: "daily", executiveFinancialsDescription: "Native GA4 revenue plus HubSpot revenue.",
      trendsDataThroughLabel: "Oct 16, 2026", trendsReportingTimeZoneLabel: "Europe/Amsterdam", trendsLastRefreshedLabel: "Oct 17, 2026", spendSourceLabels: [], revenueSourceLabels: ["GA4", "HubSpot"], breakdownTotals: { sessions: 2977, conversions: 262 },
      formatMoney: (value: number) => `EUR ${value.toFixed(2)}`, formatNumber: (value: number) => value.toLocaleString("en-US"),
    }, type, { sections: { kpis: true, benchmarks: true }, subsections: { kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["k"], selectedBenchmarkIds: ["k"] });
    if (["kpis", "benchmarks", "custom"].includes(type)) { expect(result.content).toContain("65,659.5"); expect(result.content).toContain("70,000"); }
    if (type === "overview" || type === "insights") expect(result.content).toContain("65,659.50");
    if (type === "ads") { expect(result.content).toContain("65,000.00"); expect(result.content).toContain("659.50"); }
  });
  it.each(["ads", "custom"])("reconciles campaign cents and keeps the exact native total in the %s browser PDF", async type => {
    const rows = [
      { name: "yesop_prospecting", sessions: 346, users: 344, conversions: 19, revenue: 3400.434193, conversionRate: 4.6242774566473986 },
      { name: "yesop_paid_social", sessions: 258, users: 258, conversions: 21, revenue: 4253.52214, conversionRate: 8.139534883720931 },
    ];
    const before = JSON.stringify(rows);
    const result = await render({ ...comparisonMath,
      revenueDisplaySources: [{ sourceId: "hubspot", displayName: "HubSpot", sourceType: "hubspot", revenue: 250 }, { sourceId: "salesforce", displayName: "Salesforce", sourceType: "salesforce", revenue: 100 }],
      sourceRevenueBreakdowns: new Map(), campaignBreakdownAgg: rows.map(row => ({ ...row, revenue: Number(row.revenue.toFixed(2)) })),
      adComparisonChartRows: roundGA4CampaignRevenueForDisplay(rows),
      adComparisonBreakdownAgg: roundGA4CampaignRevenueForDisplay(rows), adComparisonNativeRevenue: 7653.96, adComparisonMetric: "sessions", adComparisonBreakdownLoading: false,
      adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false, adComparisonRevenueState: "ready", breakdownError: false,
    }, type, { sections: { ads: true }, subsections: { ads: { bestWorst: true, topCampaigns: true, allCampaigns: true, revenueBreakdown: true } } });
    expect(result.words[result.words.indexOf("GA4 Revenue (Imported to Date)") + 1]).toBe("EUR 7,653.96");
    expect(result.words[result.words.indexOf("TOTAL") + 1]).toBe("EUR 8,003.96");
    expect(result.words[result.words.indexOf("HubSpot") + 1]).toBe("EUR 250.00");
    expect(result.words[result.words.indexOf("Salesforce") + 1]).toBe("EUR 100.00");
    expect(result.content).toContain("EUR 4,253.52 revenue");
    if (type === "custom") { expect(result.words).toContain("EUR 3,400.44"); expect(result.words).toContain("EUR 4,253.52"); }
    expect(JSON.stringify(rows)).toBe(before);
    const artifact = `docs/fixes/v1-batch-7/validation-2026-10-26/precision2-browser-${type}.pdf`;
    if (!process.env.V1_BATCH7_PRESERVE_ARTIFACTS || !existsSync(artifact)) writeFileSync(artifact, Buffer.from(result.doc.output("arraybuffer")));
  });
  it.each(["overview", "ads", "custom"])("keeps Promo's display cents and unmapped CSV separate in the %s browser PDF", async type => {
    const rows = [
      { name: "yesop_brand_search", sessions: 2394, users: 2395, conversions: 250, revenue: 66625.346347, conversionRate: 10.2 },
      { name: "yesop_retargeting", sessions: 1039, users: 1039, conversions: 66, revenue: 13808.508329999999, conversionRate: 5.9 },
    ];
    const displayed = roundGA4CampaignRevenueForDisplay(rows);
    const result = await render({ ...comparisonMath,
      financialRevenue: 80683.85, overviewFinancialRevenue: 80683.85, ga4RevenueForFinancials: 80433.85,
      revenueSourceDisplayLabel: (source: any) => source.displayName || source.sourceType,
      revenueDisplaySources: [{ sourceId: "csv", displayName: "CSV", sourceType: "csv", revenue: 250 }], sourceRevenueBreakdowns: new Map(),
      campaignBreakdownAgg: rows, adComparisonChartRows: displayed, adComparisonBreakdownAgg: displayed,
      adComparisonNativeRevenue: 80433.85, adComparisonChartRevenue: 80433.85, adComparisonMetric: "revenue", adComparisonBreakdownLoading: false,
      adComparisonBreakdownUnavailable: false, adComparisonBreakdownError: false, adComparisonRevenueState: "ready", breakdownError: false,
    }, type, { adComparisonMetric: "revenue", sections: { overview: true, ads: true }, subsections: { overview: { campaignBreakdown: true }, ads: { bestWorst: true, topCampaigns: true, allCampaigns: true, revenueBreakdown: true } } });
    for (const amount of ["EUR 66,625.34", "EUR 13,808.51"]) expect(result.content).toContain(amount);
    expect(result.content).toContain("EUR 80,683.85");
    expect(result.content).not.toContain("EUR 80,433.86");
    if (type !== "overview") {
      expect(result.content).toContain("EUR 80,433.85");
      expect(result.content).toContain("EUR 250.00");
    }
  });
  it.each(["standard", "custom", "zero", "refund", "long", "multipage"])("matches the live source-only Ad Comparison table in the %s browser PDF", async kind => {
    const sourceNames = ["HubSpot", "Salesforce", "Shopify", "CSV", "Google Sheets"];
    const amounts = kind === "zero" ? [0, 0, 0, 0, 0] : [250, 100, 785.95, kind === "refund" ? -50 : 50, 25];
    const sources = sourceNames.map((name, i) => ({ sourceId: name, displayName: name + (kind === "long" ? " regional confirmed revenue attribution label with complete provenance" : ""), sourceType: name, revenue: amounts[i] }));
    if (kind === "multipage") sources.splice(0, sources.length, ...Array.from({ length: 45 }, (_, i) => ({ sourceId: `source-${i}`, displayName: `${sourceNames[i % 5]} source ${i} regional confirmed revenue attribution label with complete provenance`, sourceType: sourceNames[i % 5], revenue: 1 })));
    const native = kind === "zero" ? 0 : 7653.96;
    const result = await render({ ...comparisonMath,
      ga4RevenueForFinancials: native, revenueDisplaySources: sources,
      sourceRevenueBreakdowns: new Map(sources.map(source => [source.sourceId, [{ campaignValue: "child_should_not_be_repeated", revenue: source.revenue }]])),
      campaignBreakdownAgg: [{ name: "native_campaign", sessions: 100, users: 80, conversions: 2.5, revenue: native, conversionRate: 2.5 }],
      adComparisonBreakdownAgg: [{ name: "native_campaign", sessions: 100, users: 80, conversions: 2.5, revenue: native, conversionRate: 2.5 }],
      adComparisonMetric: "sessions", adComparisonBreakdownLoading: false, adComparisonBreakdownUnavailable: false,
      adComparisonBreakdownError: false, adComparisonRevenueState: "ready", breakdownError: false,
    }, kind === "standard" ? "ads" : "custom", {
      sections: { ads: true }, subsections: { ads: { bestWorst: false, topCampaigns: false, allCampaigns: false, revenueBreakdown: true } },
      selectedKpiIds: [], selectedBenchmarkIds: [],
    });
    const table = result.words.slice(result.words.indexOf("SOURCE"));
    expect(table).toContain("TOTAL");
    expect(table[table.indexOf("TOTAL") + 1]).toBe(kind === "zero" ? "EUR 0.00" : kind === "refund" ? "EUR 8,764.91" : kind === "multipage" ? "EUR 7,698.96" : "EUR 8,864.91");
    expect(table.flat().join(" ")).not.toContain("child_should_not_be_repeated");
    for (const name of sourceNames) expect(table.flat().join(" ")).toContain(kind === "zero" ? "GA4 Revenue" : name);
    if (kind === "zero") expect(table.flat().join(" ")).not.toContain("HubSpot");
    if (kind === "long" || kind === "multipage") {
      expect(table.flat().join(" ")).toContain("complete provenance");
      for (const box of result.drawn) { expect(box.x).toBeGreaterThanOrEqual(12); expect(box.x + box.width).toBeLessThanOrEqual(198); expect(box.y).toBeLessThanOrEqual(287); }
      if (kind === "multipage") expect(result.doc.getNumberOfPages()).toBeGreaterThan(1);
      if (!process.env.V1_BATCH7_PRESERVE_ARTIFACTS) writeFileSync(`docs/fixes/v1-batch-7/validation-2026-10-26/closeout-browser-ads-${kind}.pdf`, Buffer.from(result.doc.output("arraybuffer")));
    }
  });
  it.each([0.75, 0.000075, 2])("prints observed conversion credit %s in a real browser PDF", async conversions => {
    const pdf = await render({ overviewSummaryTotals: { sessions: 2977, users: 2978, conversions },
      financialConversions: conversions, overviewFinancialConversions: conversions });
    expect(pdf("Conversions")).toBe(String(conversions));
    expect(pdf("Sessions")).toBe("2,977");
    expect(pdf.doc.output()).toContain(`(${conversions}) Tj`);
  });
  it("prints the saved reporting window, separate successful times, schedule and provisional explanation", async () => {
    const report = await render({});
    expect(report.content).toContain("Data from Sep 4, 2026 through Oct 16, 2026 (Europe/Amsterdam)");
    expect(report.content).toContain("Last successful update: Oct 17, 2026, 09:29 PM GMT+2");
    expect(report.content).toContain("Last successful update: Oct 17, 2026, 09:30 PM GMT+2");
    expect(report.content).toContain("08:00, 14:00, 20:00 (Europe/Amsterdam)");
    expect(report.content).toContain("today's activity is excluded");
    expect(report.content).toContain("Recent figures are provisional");
    expect(report.content).toContain("Imported Revenue and Spend include eligible source history");
  });
  it.each(["GA4 update is overdue", "Last GA4 refresh failed", "GA4 refresh in progress"])("retains %s alongside saved values", async ga4RefreshStatusText => {
    const report = await render({ ga4RefreshStatusText, overviewVisibleDataUsingLastGoodData: true });
    expect(report.content).toContain(ga4RefreshStatusText);
    expect(report.content).toContain("Some Overview data could not refresh");
    expect(report("Sessions")).toBe("2,977");
  });
  it("keeps empty selected tables visible and identifies unconfigured Pipeline Proxy", async () => {
    const report = await render({});
    expect(report.words).toContain("Campaign Breakdown");
    expect(report.content).toContain("No campaign breakdown data available for this date range.");
    expect(report.words).toContain("Landing Pages");
    expect(report.content).toContain("Data coming soon");
    expect(report.words).toContain("Conversion Events");
    expect(report.content).toContain("No conversion event breakdown available yet for this property/campaign selection.");
    expect(report.words).toContain("Pipeline Proxy");
    expect(report("Expected Revenue")).toBe("Not configured");
  });
  it.each([0, 450])("shows a separate configured Pipeline Proxy of %s without adding it to Revenue", async totalToDate => {
    const report = await render({ pipelineProxyConfigured: true, hasPipelineProxy: true, pipelineProxyData: { success: true, totalToDate } });
    expect(report("Expected Revenue")).toBe(`EUR ${totalToDate.toFixed(2)}`);
    expect(report("Total Revenue")).toBe("EUR 65,659.50");
    expect(report.content).toContain("latest available CRM stage values");
  });
  it.each([{ pipelineProxyLoading: true }, { pipelineProxyUnavailable: true }])("does not print an unverified Pipeline Proxy amount: %j", async changes => {
    const report = await render({ pipelineProxyConfigured: true, hasPipelineProxy: true, pipelineProxyData: { totalToDate: 450 }, ...changes });
    expect(report("Expected Revenue")).toBe("Unavailable");
  });
  it("respects custom Summary selection without unrelated financial metadata or sections", async () => {
    const report = await render({}, "custom", customOverview("summary"));
    expect(report.content).toContain("Data from Sep 4, 2026 through Oct 16, 2026");
    for (const excluded of ["09:30 PM", "Pipeline Proxy", "Landing Pages", "Conversion Events", "Campaign Breakdown"]) expect(report.content).not.toContain(excluded);
  });
  it("wraps the Campaign Breakdown explanation within the page and above its table", async () => {
    const report = await render({ campaignBreakdownAgg: [{ name: "yesop_brand_search", sessions: 2068, users: 2069, conversions: 219, conversionRate: 10.3, revenue: 56998.10 }] });
    const first = report.drawn.findIndex(line => line.text.startsWith("Traffic metrics are cumulative"));
    const header = report.drawn.findIndex((line, index) => index > first && line.text === "CAMPAIGN");
    const note = report.drawn.slice(first, header);
    expect(note.length).toBeGreaterThan(1);
    for (const line of note) {
      expect(line.x + line.width).toBeLessThanOrEqual(194.01);
      expect(line.y).toBeLessThan(report.drawn[header].y);
      expect(line.page).toBe(report.drawn[header].page);
    }
    expect(report.content).toContain("EUR 56,998.10");
  });
  it.each(["overview", "spend", "performance"])("downloads the actual %s PDF with missing Spend marked unavailable", async section => {
    const metric = await render({}, section === "overview" ? "overview" : "custom", customOverview(section));
    if (section !== "performance") expect(metric("Total Spend")).toBe("Unavailable");
    if (section !== "spend") for (const label of ["Profit", "ROAS", "ROI", "CPA"]) expect(metric(label)).toBe("Unavailable");
    if (section === "overview") {
      expect(metric("Sessions")).toBe("2,977");
      expect(metric("Conversions")).toBe("262");
      expect(metric("Total Revenue")).toBe("EUR 65,659.50");
    }
  });
  it.each([0, 1000])("preserves a configured Spend source with amount %s", async spend => {
    const metric = await render({ financialSpendAvailable: true, overviewFinancialSpendAvailable: true,
      financialSpend: spend, overviewFinancialSpend: spend, hasSpendSources: true, spendSourceDefinitionsKnownEmpty: false,
      financialROAS: spend ? 65659.5 / spend : 0 });
    expect(metric("Total Spend")).toBe(spend ? "EUR 1,000.00" : "EUR 0.00");
    expect(metric("Profit")).toBe(spend ? "EUR 64,659.50" : "EUR 65,659.50");
    expect(metric("ROAS")).toBe(spend ? "65.66x" : "—");
    expect(metric("ROI")).toBe(spend ? formatPct(6465.95) : "—");
    expect(metric("CPA")).toBe(spend ? "EUR 3.82" : "—");
  });

  // Derive Revenue availability from the page expressions, rather than forcing a ready flag for zero.
  const revenueNames = ["ga4RevenueMetricName", "ga4FinancialNativeAvailable", "ga4RevenueForFinancials", "ga4HasRevenueMetric",
    "revenueMetricAvailable", "importedRevenueForFinancials", "revenueSourceDefinitionsKnownEmpty", "importedRevenueAvailable",
    "financialRevenueAvailable", "financialRevenue"];
  const revenueExpressions: Record<string, string> = {};
  const ast = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  function visitRevenue(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && revenueNames.includes(node.name.getText(ast))) revenueExpressions[node.name.getText(ast)] = node.initializer!.getText(ast);
    ts.forEachChild(node, visitRevenue);
  }
  visitRevenue(ast);
  function zeroRevenue(changes: Record<string, any> = {}) {
    const args: Record<string, any> = {
      ga4ToDateResp: { revenueMetric: "totalRevenue", startDate: "2026-10-15", endDate: "2026-10-16" },
      ga4FinancialTotalsSource: { revenue: 0, conversions: 262 }, activeRevenueSource: null,
      requiresVerifiedNativeCurrency: false, importedRevenueToDateResp: undefined,
      revenueSourcesResp: { sources: [] }, activeTab: "reports", useMemo: (callback: () => any) => callback(), ...changes,
    };
    const body = revenueNames.map(name => `const ${name} = ${revenueExpressions[name]};`).join("\n") + `return { ${revenueNames.join(",")} };`;
    return { ...args, ...new Function(...Object.keys(args), ts.transpileModule(body, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(args)), overviewFinancialRevenue: 0 };
  }
  it.each(["totalRevenue", "purchaseRevenue"])("accepts zero %s with no external Revenue or Spend source", async revenueMetric => {
    const inputs = zeroRevenue({ ga4ToDateResp: { revenueMetric, startDate: "2026-10-15", endDate: "2026-10-16" } });
    expect(inputs.financialRevenueAvailable).toBe(true);
    const metric = await render(inputs);
    expect(metric("Total Revenue")).toBe("EUR 0.00");
    for (const name of ["Total Spend", "Profit", "ROAS", "ROI", "CPA"]) expect(metric(name)).toBe("Unavailable");
  });
  it("downloads a custom Revenue-only PDF with valid zero revenue", async () => {
    const metric = await render(zeroRevenue(), "custom", customOverview("revenue"));
    expect(metric("Total Revenue")).toBe("EUR 0.00");
  });
  it("keeps zero Revenue with positive Spend distinct from unavailable Revenue", async () => {
    const metric = await render({ ...zeroRevenue(), financialSpendAvailable: true, overviewFinancialSpendAvailable: true,
      financialSpend: 1000, overviewFinancialSpend: 1000, hasSpendSources: true, spendSourceDefinitionsKnownEmpty: false });
    expect(metric("Total Revenue")).toBe("EUR 0.00");
    expect(metric("Profit")).toBe("EUR -1,000.00");
    expect(metric("ROAS")).toBe("0.00x");
    expect(metric("ROI")).toBe(formatPct(-100));
    expect(metric("CPA")).toBe("EUR 3.82");
  });
  it.each([
    { importedRevenueError: true }, { revenueSourcesError: true }, { revenueBreakdownError: true },
    { revenueDisplaySources: [{ revenue: null, materializedRevenueStatus: "unavailable" }] },
  ])("still rejects failed Revenue inputs when the last value is zero: %j", async changes => {
    await expect(run({ ...absentSpend, ...zeroRevenue(), ...changes }, undefined, "overview")).rejects.toThrow("unavailable: Revenue.");
  });
  it("blocks an unknown Revenue source list even when native Revenue is zero", async () => {
    const inputs = zeroRevenue({ revenueSourcesResp: undefined });
    expect(inputs.financialRevenueAvailable).toBe(false);
    await expect(run({ ...absentSpend, ...inputs }, undefined, "overview")).rejects.toThrow("unavailable: Revenue.");
  });
  it("blocks a missing or failed Revenue publication rather than inventing zero", async () => {
    await expect(run({ ...absentSpend, ...zeroRevenue(), overviewFinancialRevenueAvailable: false }, undefined, "overview")).rejects.toThrow("successful aligned data refresh");
  });
});

describe("Insights financial recommendation input states", () => {
  const source = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions: Record<string, string> = {};
  function visit(node: ts.Node) {
    if (ts.isVariableDeclaration(node) && ["revenueKpiInputState", "spendKpiInputState", "combineKpiInputStates"].includes(node.name.getText(source))) expressions[node.name.getText(source)] = node.initializer!.getText(source);
    ts.forEachChild(node, visit);
  }
  visit(source);
  const evaluate = (name: string, changes: Record<string, any> = {}) => {
    const args: Record<string, any> = { nativeRevenueKpiInputState: "ready", importedRevenueKpiInputState: "ready", snapshotRevenueKpiInputState: "ready",
      financialRevenue: 130, overviewFinancialRevenue: 130, spendSourcesError: false, spendSourcesResp: { sources: [{}] },
      financialDailySnapshotResp: { snapshot: {} }, financialDailySnapshotError: false, overviewFinancialRefreshWarning: null,
      overviewFinancialSpendAvailable: true, hasSpendSources: true, financialSpend: 20, overviewFinancialSpend: 20,
      spendSourceDefinitionsKnownEmpty: false, spendBreakdownResp: { totalSpend: 20 }, spendBreakdownError: false, ...changes };
    return new Function(...Object.keys(args), ts.transpileModule(`const combineKpiInputStates = ${expressions.combineKpiInputStates}; return ${expressions[name]};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(args));
  };
  it("keeps revised Revenue out of recommendations until the publication matches", () => {
    expect(evaluate("revenueKpiInputState")).toBe("ready");
    expect(evaluate("revenueKpiInputState", { financialRevenue: 140 })).toBe("stale");
    expect(evaluate("revenueKpiInputState", { snapshotRevenueKpiInputState: "unavailable" })).toBe("unavailable");
  });
  it("distinguishes revised, removed, failed and genuinely absent Spend", () => {
    expect(evaluate("spendKpiInputState")).toBe("ready");
    for (const changes of [{ financialSpend: 30 }, { hasSpendSources: false }, { financialDailySnapshotError: true }]) expect(evaluate("spendKpiInputState", changes)).toBe("stale");
    expect(evaluate("spendKpiInputState", { financialDailySnapshotResp: undefined })).toBe("loading");
    expect(evaluate("spendKpiInputState", { overviewFinancialSpendAvailable: false, hasSpendSources: false, spendSourceDefinitionsKnownEmpty: true })).toBe("ready");
  });
});

describe("Verified missing-spend configuration notice", () => {
  const ast = ts.createSourceFile("ga4-metrics.tsx", page, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let branch = "", dependencyList = "";
  function visit(node: ts.Node) {
    if (ts.isIfStatement(node) && node.thenStatement.getText(ast).includes('id: "financial:spend_missing"')) branch = node.getText(ast);
    if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "insights" && node.initializer && ts.isCallExpression(node.initializer)) dependencyList = node.initializer.arguments[1].getText(ast);
    ts.forEachChild(node, visit);
  }
  visit(ast);
  function findings(changes: Record<string, any> = {}) {
    const args = { revenueKpiInputState: "stale", spendKpiInputState: "ready", revenueMetricAvailable: true, spendMetricAvailable: false,
      spendSourcesError: false, spendSourceDefinitionsKnownEmpty: true, hasSpendSources: false,
      overviewFinancialSpendAvailable: false, snapshotRevenueKpiInputState: "stale", ...changes };
    return new Function(...Object.keys(args), ts.transpileModule(`const out = []; ${branch}; return out;`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(args));
  }
  it.each(["ready", "stale"])("reports verified absence with a %s saved Revenue value", state => {
    expect(findings({ snapshotRevenueKpiInputState: state })).toHaveLength(1);
  });
  it.each([
    { spendSourcesError: true }, { spendSourceDefinitionsKnownEmpty: false }, { hasSpendSources: true },
    { overviewFinancialSpendAvailable: true }, { snapshotRevenueKpiInputState: "loading" }, { snapshotRevenueKpiInputState: "unavailable" },
  ])("does not turn unknown, failed, connected, or mismatched data into missing configuration: %j", changes => {
    expect(findings(changes)).toHaveLength(0);
  });
  it("re-evaluates the notice when its source configuration changes", () => {
    for (const dependency of ["spendSourcesError", "spendSourceDefinitionsKnownEmpty", "hasSpendSources", "overviewFinancialSpendAvailable", "snapshotRevenueKpiInputState"]) expect(dependencyList).toContain(dependency);
  });
});
