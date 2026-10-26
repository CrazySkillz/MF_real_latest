import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { buildGA4InsightsRollups, buildGA4InsightsHistoryScopeMarker } from "../shared/ga4-insights";
import * as insightsMath from "../shared/ga4-insights";
import { conversionCreditsMatch } from "../shared/metric-math";
import { formatConversionCredit } from "../shared/metric-math";

const hostRequire = createRequire(import.meta.url);
const fixedNow = "2026-10-19T12:00:00.000Z";
const directory = "docs/fixes/v1-batch-7/validation-2026-10-26";
class AuditDate extends Date { constructor(...args: any[]) { super(args.length ? args[0] : fixedNow); } static now() { return Date.parse(fixedNow); } }
let fixture: any;
const methods: Record<string, (...args: any[]) => any> = {
  getCampaign: () => fixture.campaign, getGA4Connections: () => [fixture.connection],
  getGA4DailyMetrics: (_id, _property, start, end) => fixture.rows.filter((r: any) => r.date >= start && r.date <= end),
  getGA4OverviewSnapshot: () => fixture.overview, getLatestFinancialDailySnapshot: () => fixture.financial,
  getPlatformKPIs: () => { if (fixture.failKpis) throw Error("isolated KPI read failure"); return fixture.kpis || []; }, getPlatformBenchmarks: () => { if (fixture.failBenchmarks) throw Error("isolated Benchmark read failure"); return fixture.benchmarks || []; },
  getRevenueSources: () => fixture.revenueSources || [], getSpendSources: () => fixture.spendSources || [],
  getRevenueBreakdownBySource: () => fixture.revenueBreakdown || [], getSpendBreakdownBySource: () => fixture.spendBreakdown || [],
  getKPIProgress: (id) => { expect(fixture.kpis.some((k: any) => k.id === id)).toBe(true); if (fixture.failKpiHistory) throw Error("isolated KPI history failure"); return fixture.progress || []; },
  getBenchmarkHistory: (id) => { expect(fixture.benchmarks.some((b: any) => b.id === id)).toBe(true); if (fixture.failBenchmarkHistory) throw Error("isolated Benchmark history failure"); return fixture.history || []; },
};
const storage = new Proxy({}, { get: (_target, key) => {
  if (!methods[String(key)]) throw Error(`Unexpected storage call: ${String(key)}`);
  return async (...args: any[]) => {
    if (key === "getPlatformKPIs" || key === "getPlatformBenchmarks") expect(args).toEqual(["google_analytics", fixture.campaign.id]);
    return methods[String(key)](...args);
  };
} });
const ga4Service = new Proxy({}, { get: (_target, key) => async (...args: any[]) => {
  if (key === "getAcquisitionBreakdown" && args[8] === true) {
    fixture.channelCalls = [...(fixture.channelCalls || []), args];
    if (fixture.failChannel) throw Error("isolated channel failure");
    return fixture.channels || { rows: [], totals: {}, meta: {} };
  }
  if (fixture.legacyProvider) {
    const outputs: Record<string, any> = { getMetricsWithAutoRefresh: fixture.overview.campaignBreakdown.totals,
      getAcquisitionBreakdown: fixture.overview.campaignBreakdown, getLandingPagesReport: fixture.overview.landingPages,
      getConversionEventsReport: fixture.overview.conversionEvents, getTimeSeriesData: fixture.rows,
      getTotalsWithRevenue: { totals: fixture.overview.campaignBreakdown.totals, revenueMetric: "totalRevenue" } };
    if (String(key) in outputs) return outputs[String(key)];
  }
  throw Error(`Unexpected provider call: ${String(key)}`);
} });
type TextBox = { text: string; x: number; y: number; right: number; page: number };
let boxes: TextBox[] = [];
function CapturedPDF() {
  const doc = new jsPDF(); const text = doc.text.bind(doc);
  doc.text = ((value: any, x: number, y: number, options?: any) => {
    const lines = Array.isArray(value) ? value : [String(value)];
    lines.forEach((line, index) => {
      const width = doc.getTextWidth(line);
      const left = options?.align === "right" ? x - width : options?.align === "center" ? x - width / 2 : x;
      boxes.push({ text: line, x: left, right: left + width, y: y + index * doc.getLineHeight() / doc.internal.scaleFactor, page: doc.getNumberOfPages() });
    });
    return text(value, x, y, options);
  }) as any;
  return doc;
}
const cache = new Map<string, any>();
function load(filename: string): any {
  const file = resolve(filename);
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  const target = file.endsWith("ga4-scheduled-report-pdf.ts");
  let source = target && process.env.V1_BATCH7_BASELINE
    ? execFileSync("git", ["show", "ec358757:server/ga4-scheduled-report-pdf.ts"], { encoding: "utf8" }) : readFileSync(file, "utf8");
  if (target) source += "\nexport { buildGA4ReportPayload, buildInsightsItems };";
  const code = ts.transpileModule(source.replaceAll("import.meta.dirname", JSON.stringify(dirname(file))), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const require = (id: string): any => {
    if (target && id === "./storage") return { storage };
    if (target && id === "./analytics") return { ga4Service };
    if (id === "jspdf") return { jsPDF: CapturedPDF };
    if (id.startsWith(".")) { const path = resolve(dirname(file), id.replace(/\.js$/, ".ts")); return load(existsSync(path) ? path : `${path}.ts`); }
    return hostRequire(id);
  };
  new Function("module", "exports", "require", "Date", code)(module, module.exports, require, AuditDate);
  return module.exports;
}
const pdf = load("server/ga4-scheduled-report-pdf.ts");
const row = (date: string, sessions = 100, conversions = 10, revenue = 100, pageviews = sessions * 2) => ({ date, sessions, users: sessions * 0.8, conversions, revenue, engagedSessions: sessions / 2, pageviews, updatedAt: fixedNow });
const rowsFor = (days: number, recent: (date: string) => any, prior = (date: string) => row(date)) => Array.from({ length: days }, (_, i) => {
  const date = new Date(Date.UTC(2026, 9, 19 - days + i)).toISOString().slice(0, 10);
  return i < days / 2 ? prior(date) : recent(date);
});
function setFixture(rows: any[], long = false) {
  const start = rows[0].date;
  const campaign = { id: "v1-pdf-fixture", name: long ? "International expansion campaign with a deliberately long descriptive title for layout verification" : "Report fixture", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "saved_campaign", startDate: start, createdAt: start };
  const connection = { id: "v1-pdf-connection", campaignId: campaign.id, propertyId: "properties/987654", method: "access_token", accessToken: "fixture-not-a-credential", isPrimary: true, lookbackDays: 30, importStartDate: start };
  const totals = rows.reduce((t, r) => { for (const key of ["sessions", "users", "conversions", "revenue", "engagedSessions", "pageviews"]) t[key] = (t[key] || 0) + r[key]; return t; }, {});
  const campaignRows = [{ campaignName: "saved_campaign", campaign: "saved_campaign", ...totals, sessionKeyEventRate: totals.sessions > 0 ? totals.conversions / totals.sessions : 0 }];
  const overview = { campaignId: campaign.id, propertyId: connection.propertyId, windowStart: start, windowEnd: "2026-10-18", updatedAt: fixedNow,
    campaignBreakdown: { rows: campaignRows, totals, meta: { currencyCode: "EUR", revenueMetric: "totalRevenue" } },
    landingPages: { rows: long ? Array.from({ length: 26 }, (_, i) => ({ landingPage: `/international-products/a-very-long-campaign-specific-landing-page-name-${i + 1}`, source: "long-source-label", medium: "paid-search", sessions: 10, users: 8, conversions: 2.5, revenue: 40, engagedSessions: 7, engagementRate: 0.7 })) : [] },
    conversionEvents: { rows: long ? Array.from({ length: 26 }, (_, i) => ({ eventName: `conversion_event_with_long_descriptive_name_${String(i + 1).padStart(2, "0")}`, conversions: 2.5, eventCount: 20, users: 10 })) : [] } };
  const financial = { campaignId: campaign.id, reportingDate: "2026-10-18", metrics: { financialDaily: { version: "financial_daily_snapshot_v1", currency: "EUR", currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: start, endDate: "2026-10-18", dataThroughDate: "2026-10-18", reportingTimeZone: "Europe/Amsterdam" }, inputs: { spend: { available: false, value: null, sources: [] }, revenue: { available: true, value: String(totals.revenue), sources: ["ga4"] }, conversions: { available: true, value: totals.conversions, sources: ["ga4"] } } } } };
  fixture = { campaign, connection, overview, financial, rows };
}
async function render(file: string, type = "insights", configuration?: string) {
  const report = { id: "v1-render-fixture", campaignId: fixture.campaign.id, platformType: "google_analytics", name: "Isolated Batch 7 fixture", reportType: type, configuration };
  const payload = await pdf.buildGA4ReportPayload(report);
  boxes = [];
  const bytes = await pdf.buildGA4ScheduledPdfAttachment({ report, reportName: report.name, windowStart: fixture.connection.importStartDate, windowEnd: "2026-10-18", campaignName: fixture.campaign.name });
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  if (!process.env.V1_BATCH7_BASELINE && !(process.env.V1_BATCH7_PRESERVE_ARTIFACTS && existsSync(`${directory}/${file}.pdf`))) writeFileSync(`${directory}/${file}.pdf`, bytes);
  return payload;
}

const report = () => ({ campaignId: fixture.campaign.id, reportType: "insights" });
const target = (metric = "sessions", value: any = "1500", overrides: any = {}) => ({ id: "target-1", name: metric, metric, unit: "count", targetValue: value, benchmarkValue: value, currentValue: "999999", priority: "medium", ...overrides });
function spend(value: number) {
  fixture.spendSources = [{ id: "spend", isActive: true, currency: "EUR", sourceType: "csv", displayName: "Spend fixture" }];
  fixture.spendBreakdown = [{ sourceId: "spend", spend: value, sourceType: "csv", displayName: "Spend fixture" }];
  fixture.financial.metrics.financialDaily.inputs.spend = { available: true, value: String(value), sources: ["csv"] };
}
const fresh = () => setFixture(rowsFor(14, date => row(date)));
const titles = (payload: any) => payload.insightsItems.map((item: any) => item.title);
describe("October 26 supplied report cases", () => {
  it("matches the browser's missing-history confidence and recommended check", async () => {
    setFixture(rowsFor(3, date => row(date, 0, 0, 0), date => row(date, 0, 0, 0)));
    const item = (await pdf.buildGA4ReportPayload(report())).insightsItems.find((i: any) => i.title === "Trend signals need more history");
    expect(item.confidence).toBe("High");
    expect(item.recommendation).toBe("Check the daily refresh. Comparisons require recorded data for every day in both windows.");
    expect(item.dataBasis).toBe("GA4 recorded completed daily history; missing dates are unavailable");
    expect(item.description).toContain("3/3 completed days");
    expect(item.description).toContain("0/3 completed days");
  });
  it.each([null, 0, 200])("prints the ROI card without inventing ROI when Spend is %s", async value => {
    fresh(); if (value !== null) spend(value);
    const payload = await render(`live-scheduled-roi-${value === null ? "absent" : value}`);
    const index = boxes.findIndex(box => box.text === "ROI");
    expect(index).toBeGreaterThanOrEqual(0);
    expect(boxes[index + 1].text).toBe(value === 200 ? "600.0%" : "—");
    expect(payload.financialRevenue).toBe(1400);
    expect(payload.financialSpend).toBe(value ?? 0);
  });
  it("still rejects a negative source amount that does not reconcile with the publication", async () => {
    fresh(); spend(-1);
    await expect(pdf.buildGA4ReportPayload(report())).rejects.toThrow("Financial publication changed");
  });
  it("keeps fractional axis ticks distinct on a zero-activity chart", async () => {
    setFixture(rowsFor(3, date => row(date, 0, 0, 0), date => row(date, 0, 0, 0)));
    await render("live-scheduled-zero-trend");
    const ticks = boxes.filter(box => Math.abs(box.right - 28) < 0.01 && /^\d+(\.\d+)?$/.test(box.text)).map(box => box.text);
    expect(ticks).toEqual(["0", "0.3", "0.6", "0.9", "1.2"]);
  });
});
function contextFixture() {
  fresh();
  fixture.kpis = [target("sessions", "2000")]; fixture.benchmarks = [target("users", "2000", { id: "benchmark-1" })];
  const notes = buildGA4InsightsHistoryScopeMarker(fixture.connection.propertyId, ["saved_campaign"], "Europe/Amsterdam", "EUR");
  fixture.progress = [18, 17, 16].map(day => ({ kpiId: "target-1", recordedAt: `2026-10-${day}T00:00:00Z`, value: String(day * 10), notes }));
  fixture.history = [16, 17, 18].map(day => ({ benchmarkId: "benchmark-1", recordedAt: `2026-10-${day}T00:00:00Z`, variance: day - 30, notes }));
  fixture.channels = { rows: fixture.rows.flatMap((r: any) => [
    { date: r.date, source: "search", medium: "paid", sessions: 80, conversions: 6, revenue: 90 },
    { date: r.date, source: "email", medium: "owned", sessions: 20, conversions: 4, revenue: 10 },
  ]), meta: { propertyId: "987654", currencyCode: "EUR" } };
}

describe("Insights report history and channel context", () => {
  it("includes only scoped adjacent history and reconciled channel context, without changing totals", async () => {
    contextFixture(); const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsItems.find((i: any) => i.title === "sessions Below Saved Target").description).toContain("Streak: 3 days. Trending up 12.5% over 30d.");
    expect(payload.insightsItems.find((i: any) => i.title === "users Behind Benchmark").description).toContain("Trend improving. Avg variance -13.0%.");
    expect(titles(payload)).toContain("Top channel: search / paid (80% of sessions)");
    expect(payload.insightsItems.find((i: any) => i.title === "sessions Below Saved Target").recommendation).toContain("search / paid");
    expect(payload.financialRevenue).toBe(1400); expect(payload.platformKPIs[0].currentValue).toBe("1400");
    expect(fixture.channelCalls[0].slice(2)).toEqual(["2026-09-19", fixture.connection.propertyId, 2000, "saved_campaign", "2026-10-18", true, true, "EUR"]);
  });
  it.each(["property", "filter", "timezone", "currency", "unmarked", "future", "wrong-parent"])("withholds %s history without withholding current target evaluation", async kind => {
    contextFixture();
    for (const point of [...fixture.progress, ...fixture.history]) {
      if (kind === "future") point.recordedAt = "2026-10-20T00:00:00Z";
      else if (kind === "wrong-parent") { point.kpiId = "other"; point.benchmarkId = "other"; }
      else point.notes = kind === "unmarked" ? "legacy" : buildGA4InsightsHistoryScopeMarker(kind === "property" ? "other" : "987654", kind === "filter" ? "other" : "saved_campaign", kind === "timezone" ? "UTC" : "Europe/Amsterdam", kind === "currency" ? "USD" : "EUR");
    }
    const payload = await pdf.buildGA4ReportPayload(report());
    const targets = payload.insightsItems.filter((i: any) => i.category === "targets");
    expect(targets).toHaveLength(2); expect(targets.map((i: any) => i.description).join(" ")).not.toMatch(/Streak:|Trending|Trend improving|Avg variance/);
    expect(titles(payload).join(" ")).not.toContain("history is unavailable");
  });
  it("does not turn gaps or duplicate history dates into consecutive days", async () => {
    contextFixture(); fixture.progress[1].recordedAt = fixture.progress[0].recordedAt;
    let payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsItems.find((i: any) => i.title === "sessions Below Saved Target").description).not.toContain("Streak:");
    fixture.progress[1].recordedAt = "2026-10-16T00:00:00Z";
    payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsItems.find((i: any) => i.title === "sessions Below Saved Target").description).not.toContain("Streak:");
  });
  it.each(["KPI", "Benchmark", "KPI and Benchmark"])("discloses failed %s history while preserving current target checks", async label => {
    contextFixture(); fixture.failKpiHistory = label.includes("KPI"); fixture.failBenchmarkHistory = label.includes("Benchmark");
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain(`${label} trend history is unavailable`);
    expect(payload.insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(2);
  });
  it.each(["currency", "property", "date", "sessions", "conversions", "revenue", "failure"])("withholds %s-mismatched channel conclusions", async kind => {
    contextFixture();
    if (kind === "currency") fixture.channels.meta.currencyCode = "USD";
    else if (kind === "property") fixture.channels.meta.propertyId = "other";
    else if (kind === "date") fixture.channels.rows.forEach((r: any) => { r.date = "2026-09-01"; });
    else if (kind === "failure") fixture.failChannel = true;
    else fixture.channels.rows[0][kind] += 1;
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload).some((title: string) => title.startsWith("Top channel:"))).toBe(false);
    expect(payload.insightsItems.filter((i: any) => i.category === "targets").map((i: any) => i.recommendation).join(" ")).not.toContain("search / paid");
    expect(payload.financialRevenue).toBe(1400);
  });
  it("uses campaign creation dates for trends without truncating cumulative target values", async () => {
    contextFixture(); fixture.campaign.createdAt = "2026-10-15T23:30:00Z";
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsRollups.rows.map((r: any) => r.date)).toEqual(["2026-10-16", "2026-10-17", "2026-10-18"]);
    expect(payload.platformKPIs[0].currentValue).toBe("1400"); expect(payload.financialRevenue).toBe(1400);
    expect(titles(payload).some((title: string) => title.startsWith("Top channel:"))).toBe(false);
  });
  it.each([0, -100])("does not name a revenue-leading channel when native revenue is %s per day", async revenue => {
    contextFixture();
    fixture.rows.forEach((r: any) => { r.revenue = revenue; });
    fixture.overview.campaignBreakdown.totals.revenue = revenue * 14;
    fixture.overview.campaignBreakdown.rows[0].revenue = revenue * 14;
    fixture.financial.metrics.financialDaily.inputs.revenue.value = String(revenue * 14);
    fixture.channels.rows.forEach((r: any) => { r.revenue = revenue * (r.source === "search" ? 0.8 : 0.2); });
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsChannelAnalysis.topRevenueChannel).toBeNull();
    expect(payload.insightsChannelAnalysis.topSessionShare).toBe(80);
  });
  it("withholds lowest-converting channel advice for a visible tie", async () => {
    contextFixture(); fixture.kpis = [target("conversions", "200")];
    fixture.channels.rows.forEach((r: any) => { r.conversions = r.source === "search" ? 8 : 2; });
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsChannelAnalysis.lowestCRChannel).toBeNull();
    expect(payload.insightsItems.find((i: any) => i.title === "conversions Below Saved Target").recommendation).not.toContain("lowest conversion rate");
  });
  it("does not request Insights context for Overview, KPI or Benchmark reports", async () => {
    for (const reportType of ["overview", "kpis", "benchmarks"]) {
      contextFixture(); fixture.failKpiHistory = true; fixture.failBenchmarkHistory = true;
      const payload = await pdf.buildGA4ReportPayload({ ...report(), reportType });
      expect(fixture.channelCalls).toBeUndefined(); expect(payload.insightsHistoryFailures || []).toHaveLength(0);
    }
  });
  it.each(["overview", "kpis", "benchmarks", "ads", "insights", "custom"])("renders the actual %s PDF with a mixed-source publication", async reportType => {
    contextFixture(); spend(200);
    fixture.revenueSources = [{ id: "hubspot", sourceType: "hubspot", displayName: "HubSpot", currency: "EUR", isActive: true }];
    fixture.revenueBreakdown = [{ sourceId: "hubspot", sourceType: "hubspot", displayName: "HubSpot", revenue: 250, currency: "EUR" }];
    fixture.financial.metrics.financialDaily.inputs.revenue.value = "1650";
    const configuration = reportType === "custom" ? JSON.stringify({ sections: { insights: true, kpis: true, benchmarks: true }, subsections: { insights: { actions: true }, kpis: { items: true }, benchmarks: { items: true } }, selectedKpiIds: ["target-1"], selectedBenchmarkIds: ["benchmark-1"] }) : undefined;
    const payload = await render(`context-scheduled-${reportType}`, reportType, configuration);
    expect(payload.financialRevenue).toBe(1650); expect(payload.financialSpend).toBe(200);
    expect(payload.financialROAS).toBe(8.25); expect(payload.financialROI).toBe(725);
    expect(payload.campaignBreakdownAgg.reduce((sum: number, r: any) => sum + r.revenue, 0)).toBe(1400);
    expect(boxes.length).toBeGreaterThan(10);
  });
});

describe("Browser Insights and Reports context selection", () => {
  const ast = ts.createSourceFile("ga4-metrics.tsx", readFileSync("client/src/pages/ga4-metrics.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const expressions = new Map<string, string>();
  const visit = (node: ts.Node) => { if (ts.isVariableDeclaration(node) && node.initializer) expressions.set(node.name.getText(ast), node.initializer.getText(ast)); ts.forEachChild(node, visit); }; visit(ast);
  const names = ["insightsChannelBreakdown", "insightsChannelPlaceholder", "channelAnalysis", "insightsChannelBreakdownMatchesDaily", "dataSummaryChannelAnalysis", "recommendationChannelAnalysis"];
  const evaluate = (changes: any = {}) => {
    contextFixture(); const rollups = buildGA4InsightsRollups(fixture.rows, "2026-10-18");
    const breakdown = { ...fixture.channels, startDate: rollups.last30.startDate, endDate: rollups.last30.endDate };
    const env = { ...insightsMath, conversionCreditsMatch, useMemo: (fn: any) => fn(), activeTab: "reports", reportInsightsBreakdown: breakdown,
      ga4Breakdown: { rows: [{ source: "wrong Overview rows", sessions: 9000 }] }, breakdownPlaceholder: false, ga4InsightsTimeSeries: fixture.rows,
      insightsDataSummaryTotals: rollups.last30, ga4InsightsDailyResp: {}, selectedGA4PropertyId: "987654", campaignCurrency: "EUR",
      reportInsightsBreakdownError: false, breakdownError: false, ...changes };
    const code = names.map(name => `const ${name} = ${expressions.get(name)};`).join("\n") + "return recommendationChannelAnalysis;";
    return new Function(...Object.keys(env), ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
  };
  it("uses dated channel data on Reports independently of cumulative Overview rows", () => {
    expect(evaluate().topSessionChannel.label).toBe("search / paid");
    expect(evaluate().topSessionShare).toBe(80);
  });
  it.each(["currency", "property", "window", "sessions", "conversions", "revenue", "failure", "pending"])("withholds %s channel context in the browser", kind => {
    contextFixture(); const breakdown = { ...fixture.channels, startDate: "2026-09-19", endDate: "2026-10-18" };
    if (kind === "currency") breakdown.meta.currencyCode = "USD";
    if (kind === "property") breakdown.meta.propertyId = "other";
    if (kind === "window") breakdown.startDate = "2026-09-20";
    if (["sessions", "conversions", "revenue"].includes(kind)) breakdown.rows[0][kind] += 1;
    expect(evaluate({ reportInsightsBreakdown: kind === "pending" ? undefined : breakdown, reportInsightsBreakdownError: kind === "failure" })).toBeNull();
  });
  it("does not reuse failed cached target history", () => {
    for (const [name, list, queries] of [["kpiAnalyticsById", "platformKPIs", "kpiAnalyticsQueries"], ["benchmarkAnalyticsById", "benchmarks", "benchmarkAnalyticsQueries"]]) {
      const env = { useMemo: (fn: any) => fn(), [list]: [{ id: "target" }], [queries]: [{ isError: true, data: { progress: [1], history: [1] } }] };
      const result = new Function(...Object.keys(env), ts.transpileModule(`return ${expressions.get(name)};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(env));
      expect(result.size).toBe(0);
    }
  });
  it.each([0, -100])("withholds browser revenue-share leadership when native revenue is %s per day", revenue => {
    contextFixture();
    const rows = fixture.rows.map((r: any) => ({ ...r, revenue }));
    const breakdown = { ...fixture.channels, startDate: "2026-09-19", endDate: "2026-10-18", rows: fixture.channels.rows.map((r: any) => ({ ...r, revenue: revenue * (r.source === "search" ? 0.8 : 0.2) })) };
    const analysis = evaluate({ reportInsightsBreakdown: breakdown, ga4InsightsTimeSeries: rows, insightsDataSummaryTotals: buildGA4InsightsRollups(rows, "2026-10-18").last30 });
    expect(analysis.topRevenueChannel).toBeNull(); expect(analysis.topSessionShare).toBe(80);
  });
});
function browserTargetFindings(payload: any) {
  const source = ts.createSourceFile("ga4-metrics.tsx", readFileSync("client/src/pages/ga4-metrics.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const names = new Set(["getKpiEffectiveTarget", "computeKpiProgress", "computeBenchmarkProgress"]);
  const declarations: string[] = [], branches: string[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && names.has(node.name.getText(source))) declarations.push(`const ${node.getText(source)};`);
    if (ts.isForOfStatement(node) && /getFinding(Kpi|Benchmark)ConsumerState/.test(node.getText(source)) && node.getText(source).includes("out.push")) branches.push(node.getText(source));
    ts.forEachChild(node, visit);
  }; visit(source);
  expect(declarations).toHaveLength(3); expect(branches).toHaveLength(3);
  const maths = load("shared/kpi-math.ts"), consumers = load("shared/ga4-kpi-consumer-state.ts"), identities = load("shared/ga4-kpi-metric-identity.ts");
  const out: any[] = [];
  const env = { out, ...maths, ...identities,
    platformKPIs: payload.platformKPIs, benchmarks: payload.benchmarks,
    getFindingKpiConsumerState: () => ({ eligible: true }), getFindingBenchmarkConsumerState: () => ({ eligible: true }),
    getInvalidKpiConfigReason: () => "", getInvalidBenchmarkConfigReason: () => "",
    getKpiInsightPeriodCompatibility: consumers.resolveGA4InsightTargetPeriodCompatibility, getBenchmarkInsightPeriodCompatibility: consumers.resolveGA4InsightTargetPeriodCompatibility,
    getLiveKpiValue: (item: any) => item.currentValue,
    getLiveBenchmarkCurrentValue: (metric: string, name: string) => payload.benchmarks.find((b: any) => b.metric === metric && b.name === name).currentValue,
    getBenchmarkDisplayCurrentValue: (item: any) => item.currentValue,
    insightsAnalyticsHistoryMatchesSelectedProperty: false, findingChannelAnalysis: null,
    stripNumberFormatting: (value: any) => String(value).replace(/,/g, "").trim(),
    formatNumberByUnit: String, formatBenchmarkValue: String, formatPct: String, POSITIVE_KPI_EXCEEDS_PCT: 110 };
  new Function(...Object.keys(env), ts.transpileModule([...declarations, ...branches].join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
  return out.map(item => ({ title: item.title, severity: item.severity === "low" ? item.id.startsWith("positive:") ? "positive" : "info" : item.severity })).sort((a, b) => a.title.localeCompare(b.title));
}

describe("V1-085 non-trend scheduled Insights checks", () => {
  it.each(["insights", "custom"])("fails closed when the %s KPI list cannot be read", async type => {
    fresh(); fixture.failKpis = true;
    await expect(pdf.buildGA4ReportPayload({ ...report(), reportType: type, configuration: JSON.stringify({ sections: { insights: true } }) })).rejects.toThrow("isolated KPI read failure");
  });
  it("does not make an unrelated overview section depend on KPI reads", async () => {
    fresh(); fixture.failKpis = true;
    await expect(pdf.buildGA4ReportPayload({ ...report(), reportType: "custom", configuration: JSON.stringify({ sections: { overview: true }, subsections: { overview: { summary: true } } }) })).resolves.toBeDefined();
  });
  it.each(["low", "medium", "high", "critical"])("uses live cumulative values, absolute targets and %s priority even for a near-target miss", async priority => {
    fresh(); fixture.kpis = [target("sessions", "1401", { priority, timeframe: "daily", trackingPeriod: "weekly" })];
    const payload = await pdf.buildGA4ReportPayload(report());
    const finding = payload.insightsItems.find((item: any) => item.title === "sessions Below Saved Target");
    expect(finding).toBeDefined();
    expect(finding.severity).toBe(priority === "critical" ? "high" : priority === "low" ? "info" : priority);
    expect(finding.description).toContain("1,400"); expect(finding.description).toContain("1,401");
    expect(finding.description).not.toContain("999999");
  });
  it("uses the opposite miss direction for CPA and preserves fractional conversions", async () => {
    fresh(); spend(1400); fixture.kpis = [target("cpa", "5", { unit: "$" }), target("conversions", "140.5", { id: "fractional" })];
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("cpa Above Saved Target");
    expect(payload.insightsItems.find((i: any) => i.title === "conversions Below Saved Target").description).toContain("140.5");
  });
  it.each(["", "invalid", "0", "-1", "Infinity"])("shows invalid target %j as configuration trouble", async value => {
    fresh(); fixture.kpis = [target("sessions", value)]; fixture.benchmarks = [target("users", value)];
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("KPI configuration needs review: sessions");
    expect(titles(payload)).toContain("Benchmark configuration needs review: users");
    expect(payload.insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(0);
  });
  it.each(["conversion_rate", "engagement_rate"])("rejects an impossible %s target", async metric => {
    fresh(); fixture.kpis = [target(metric, "101")];
    expect(titles(await pdf.buildGA4ReportPayload(report()))).toContain(`KPI configuration needs review: ${metric}`);
  });
  it("withholds custom targets whose reporting window is unverified", async () => {
    fresh(); fixture.kpis = [target("__custom__", "200")]; fixture.benchmarks = [target("__custom__", "200", { currentValue: "1" })];
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("Target reporting periods need review");
    expect(payload.insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(0);
  });
  it.each([0, -100])("withholds spend-based conclusions for measured spend %s", async value => {
    fresh(); spend(value); fixture.kpis = [target("roas", "2")]; fixture.benchmarks = [target("roi", "20")];
    if (value < 0) {
      await expect(pdf.buildGA4ReportPayload(report())).rejects.toThrow("Financial publication changed");
      const items = pdf.buildInsightsItems({ insightsRollups: buildGA4InsightsRollups(fixture.rows, "2026-10-18"), financialSpendAvailable: true,
        financialSpend: value, financialRevenue: 1400, financialConversions: 140, breakdownTotals: { sessions: 1400 },
        platformKPIs: fixture.kpis, benchmarks: fixture.benchmarks, formatMoney: String, formatNumber: String });
      expect(titles({ insightsItems: items })).toContain("2 saved target evaluations withheld");
      expect(items.filter((i: any) => i.category === "targets")).toHaveLength(0);
      return;
    }
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("2 saved target evaluations withheld");
    expect(payload.insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(0);
  });
  it("withholds unavailable spend without scoring retained values", async () => {
    fresh(); fixture.kpis = [target("roas", "2")]; fixture.benchmarks = [target("roi", "20")];
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("2 saved target evaluations withheld");
    expect(payload.insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(0);
  });
  it("shows positive targets and Benchmark misses using the same threshold bands", async () => {
    fresh(); fixture.kpis = [target("sessions", "1000")]; fixture.benchmarks = [target("sessions", "2100", { name: "Behind" }), target("sessions", "1500", { name: "Near" })];
    expect(titles(await pdf.buildGA4ReportPayload(report()))).toEqual(expect.arrayContaining(["sessions outperforms target by 40%", "Behind Behind Benchmark", "Near Below Benchmark"]));
  });
  it.each([1750, 1500])("shows negative ROI and below-one ROAS when spend is %s", async amount => {
    fresh(); spend(amount);
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain("ROI is negative to date");
    expect(titles(payload)).toContain("ROAS is below 1.0x to date");
    expect(payload.insightsItems.find((i: any) => i.title === "ROI is negative to date").severity).toBe(amount === 1750 ? "high" : "medium");
  });
  it("distinguishes measured zero spend from a missing spend source", async () => {
    fresh(); spend(0);
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(titles(payload)).toContain(`Revenue exists, but connected-source spend is ${payload.formatMoney(0)}`);
    expect(titles(payload)).not.toContain("Spend is not connected");
  });
  it("renders twelve prioritized findings like the browser summary", async () => {
    fresh(); spend(1400);
    fixture.kpis = Array.from({ length: 12 }, (_, i) => target("sessions", "2000", { id: `k-${i}`, name: `Target ${String(i + 1).padStart(2, "0")}`, priority: i === 11 ? "critical" : "medium" }));
    const payload = await render("insights-targets-current");
    expect(payload.insightsItems[0].title).toBe("Target 12 Below Saved Target");
    const text = boxes.map(b => b.text).join("\n");
    for (let n = 1; n <= 12; n++) expect(text).toContain(`Target ${String(n).padStart(2, "0")} Below Saved Target`);
    for (const box of boxes) { expect(box.right).toBeLessThanOrEqual(195); if (box.y !== 287) expect(box.y).toBeLessThan(280); }
  });
  it.each(["sessions", "users", "pageviews", "conversions", "conversion_rate", "engagement_rate", "revenue", "roi", "roas", "cpa"])("matches the actual browser target rules for %s", async metric => {
    fresh(); spend(1750);
    fixture.kpis = [target(metric, "50"), target(metric, "1", { id: "second", name: "Second", priority: "critical" })];
    fixture.benchmarks = [target(metric, "50")];
    const payload = await pdf.buildGA4ReportPayload(report());
    const actual = payload.insightsItems.filter((item: any) => item.category === "targets" || item.title.includes("outperforms target"))
      .map((item: any) => ({ title: item.title, severity: item.severity })).sort((a: any, b: any) => a.title.localeCompare(b.title));
    expect(actual).toEqual(browserTargetFindings(payload));
  });
  it("wraps long target names without dropping the target-miss wording", async () => {
    fresh(); spend(1400);
    const name = "International lead generation target with a long saved description for the customer acquisition programme in multiple regions";
    fixture.kpis = [target("sessions", "1500", { name })];
    boxes = [];
    await pdf.buildGA4ScheduledPdfAttachment({ report: report(), campaignName: fixture.campaign.name });
    expect(boxes.map(box => box.text).join(" ")).toContain(`${name} Below Saved Target`);
    for (const box of boxes) { expect(box.right).toBeLessThanOrEqual(195); if (box.y !== 287) expect(box.y).toBeLessThan(280); }
  });
  it("reflects added, edited and deleted target rows without retaining old findings", async () => {
    fresh(); fixture.kpis = [target("sessions", "1500")];
    expect(titles(await pdf.buildGA4ReportPayload(report()))).toContain("sessions Below Saved Target");
    fixture.kpis[0].targetValue = "1300";
    expect(titles(await pdf.buildGA4ReportPayload(report()))).not.toContain("sessions Below Saved Target");
    fixture.kpis = [];
    expect((await pdf.buildGA4ReportPayload(report())).insightsItems.filter((i: any) => i.category === "targets")).toHaveLength(0);
  });
  it("evaluates the whole saved target list for custom Insights even without selected KPI cards", async () => {
    fresh(); fixture.kpis = [target("sessions", "1500")];
    const payload = await pdf.buildGA4ReportPayload({ ...report(), reportType: "custom", configuration: JSON.stringify({ sections: { insights: true }, selectedKpiIds: [] }) });
    expect(titles(payload)).toContain("sessions Below Saved Target");
  });
  it("reconciles mixed-source revenue before scoring revenue targets and rejects a changed publication", async () => {
    fresh(); fixture.kpis = [target("revenue", "1600", { unit: "$" })];
    fixture.revenueSources = [{ id: "hubspot", sourceType: "hubspot", displayName: "HubSpot", currency: "EUR", isActive: true }];
    fixture.revenueBreakdown = [{ sourceId: "hubspot", sourceType: "hubspot", revenue: 250 }];
    fixture.financial.metrics.financialDaily.inputs.revenue.value = "1650";
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.platformKPIs[0].currentValue).toBe("1650.00");
    expect(payload.financialRevenue).toBe(1650);
    expect(titles(payload)).not.toContain("revenue Below Saved Target");
    fixture.financial.metrics.financialDaily.inputs.revenue.value = "1400";
    await expect(pdf.buildGA4ReportPayload(report())).rejects.toThrow("Financial publication changed");
  });
  it("does not score stale saved target values through the legacy provider fallback", async () => {
    fresh(); fixture.campaign.ga4CampaignFilter = ""; fixture.legacyProvider = true;
    fixture.kpis = [target("sessions", "1500")]; fixture.benchmarks = [target("users", "2000")];
    const payload = await pdf.buildGA4ReportPayload(report());
    expect(payload.insightsCurrentValuesVerified).toBe(false);
    expect(titles(payload)).toContain("2 saved target evaluations withheld");
    expect(payload.insightsItems.filter((i: any) => i.category === "targets" || i.title.includes("outperforms target"))).toHaveLength(0);
    expect(titles(payload).some((title: string) => title.startsWith("Revenue exists, but connected-source spend"))).toBe(false);
  });
});
