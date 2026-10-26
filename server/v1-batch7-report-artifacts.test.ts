import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { jsPDF } from "jspdf";
import { buildGA4InsightsRollups } from "../shared/ga4-insights";
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
  getPlatformKPIs: () => [], getPlatformBenchmarks: () => { if (fixture.failBenchmarks) throw Error("isolated Benchmark read failure"); return []; },
  getRevenueSources: () => fixture.revenueSources || [], getSpendSources: () => [],
  getRevenueBreakdownBySource: () => fixture.revenueBreakdown || [], getSpendBreakdownBySource: () => [],
};
const storage = new Proxy({}, { get: (_target, key) => {
  if (!methods[String(key)]) throw Error(`Unexpected storage call: ${String(key)}`);
  return async (...args: any[]) => methods[String(key)](...args);
} });
const ga4Service = new Proxy({}, { get: (_target, key) => () => { throw Error(`Unexpected provider call: ${String(key)}`); } });
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
    ? execFileSync("git", ["show", "eacb62fa:server/ga4-scheduled-report-pdf.ts"], { encoding: "utf8" }) : readFileSync(file, "utf8");
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
  if (!process.env.V1_BATCH7_BASELINE && !process.env.V1_BATCH7_PRESERVE_ARTIFACTS) writeFileSync(`${directory}/${file}.pdf`, bytes);
  return payload;
}
function clientTrendTitles(rows: any[]) {
  const source = ts.createSourceFile("ga4-metrics.tsx", readFileSync("client/src/pages/ga4-metrics.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const thresholds: Record<string, number> = {}; let branch = "";
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && /^(ANOMALY_|POSITIVE_)/.test(node.name.getText(source))) thresholds[node.name.getText(source)] = Number(node.initializer!.getText(source));
    if (ts.isIfStatement(node) && node.expression.getText(source) === "sevenDayComparisonReady") branch = node.getText(source);
    ts.forEachChild(node, visit);
  }; visit(source);
  const out: any[] = [], findingRollups = buildGA4InsightsRollups(rows, "2026-10-18");
  const env = { out, findingRollups, sevenDayComparisonReady: findingRollups.last7.complete && findingRollups.prior7.complete, findingChannelAnalysis: null,
    formatNumber: String, formatPct: (v: number) => `${v}%`, formatMoney: (v: number) => `EUR ${v}`, formatConversionCredit, hasNativeAndImportedRevenue: false,
    ga4InsightsDailyResp: {}, historyCoverageLabel: "completed", historyRowsLabel: "missing days are unavailable", ...thresholds };
  new Function(...Object.keys(env), ts.transpileModule(branch, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(...Object.values(env));
  return out.map(item => item.title).sort();
}

describe("V1-085 scheduled findings and current browser trend rules", () => {
  it("separates missing spend, measured zero revenue and signed financial values", () => {
    const payload = { insightsRollups: buildGA4InsightsRollups(rowsFor(14, date => row(date)), "2026-10-18"), formatMoney: (v: number) => `EUR ${v}`, formatNumber: String, financialSpend: 100 };
    const missing = pdf.buildInsightsItems({ ...payload, financialSpendAvailable: false, financialRevenue: 100 });
    expect(missing.some((item: any) => item.title === "Spend is not connected")).toBe(true);
    const negative = pdf.buildInsightsItems({ ...payload, financialSpendAvailable: true, financialRevenue: -25 });
    expect(negative.some((item: any) => item.title === "Connected-source revenue is negative" && item.description.includes("EUR -25"))).toBe(true);
    expect(negative.some((item: any) => item.title === "Spend without revenue")).toBe(false);
    const zero = pdf.buildInsightsItems({ ...payload, financialSpendAvailable: true, financialRevenue: 0 });
    expect(zero.some((item: any) => item.title === "Spend without revenue")).toBe(true);
  });
  it.each([
    ["six-day decline", rowsFor(6, date => row(date, 0, 0, 0))],
    ["fourteen-day rate decline", rowsFor(14, date => row(date, 200, 10, 100))],
    ["seven-day volume decline", rowsFor(14, date => row(date, 40, 4, 30))],
    ["three-day rate/depth decline", rowsFor(6, date => row(date, 100, 5, 100, 100))],
    ["seven-day positive volumes", rowsFor(14, date => row(date, 200, 20, 200))],
    ["three-day correlated volume decline", rowsFor(6, date => row(date, 20, 2, 20))],
    ["three-day positive volume", rowsFor(6, date => row(date, 150, 15, 150))],
    ["recorded zero history", rowsFor(14, date => row(date, 0, 0, 0), date => row(date, 0, 0, 0))],
  ])("matches browser trend titles for %s", async (_name, rows) => {
    setFixture(rows as any[]);
    const payload = await pdf.buildGA4ReportPayload({ campaignId: fixture.campaign.id, reportType: "insights" });
    expect(payload.insightsItems.filter((item: any) => item.category === "trends").map((item: any) => item.title).sort()).toEqual(clientTrendTitles(rows as any[]));
    expect(payload.insightsItems.some((item: any) => /stable|No major anomalies/i.test(`${item.title} ${item.description}`))).toBe(false);
  });
  it("renders both reproduced declines into actual PDF bytes", async () => {
    setFixture(rowsFor(6, date => row(date, 0, 0, 0)));
    await render("retained-insights-six-days");
    expect(boxes.some(b => b.text.includes("Conversion rate dropped"))).toBe(true);
    setFixture(rowsFor(14, date => row(date, 200, 10, 100)));
    await render("retained-insights-rate");
    expect(boxes.some(b => b.text.includes("Conversion rate dropped 50.0%"))).toBe(true);
  });
  it("rejects unavailable Benchmark reads and financial publication mismatch", async () => {
    setFixture(rowsFor(14, date => row(date)));
    fixture.failBenchmarks = true;
    await expect(pdf.buildGA4ReportPayload({ campaignId: fixture.campaign.id, reportType: "insights" })).rejects.toThrow("isolated Benchmark read failure");
    fixture.failBenchmarks = false;
    fixture.financial.metrics.financialDaily.inputs.revenue.value = "999";
    await expect(pdf.buildGA4ReportPayload({ campaignId: fixture.campaign.id, reportType: "insights" })).rejects.toThrow("Financial publication changed");
  });
  it("rejects gapped saved publications and never labels an incomplete trend stable", async () => {
    const rows = rowsFor(14, date => row(date)).filter(r => r.date !== "2026-10-17");
    setFixture(rows);
    await expect(pdf.buildGA4ReportPayload({ campaignId: fixture.campaign.id, reportType: "insights" })).rejects.toThrow("Daily publication changed");
    const items = pdf.buildInsightsItems({ insightsRollups: buildGA4InsightsRollups(rows, "2026-10-18"), formatMoney: String, formatNumber: String });
    expect(items.map((item: any) => item.title)).toEqual(["Trend signals need more history"]);
  });
});

describe("V1-086 real scheduled PDF text bounds", () => {
  it("keeps long campaign and adjacent table cells separate across page breaks", async () => {
    setFixture(rowsFor(30, date => row(date)), true);
    await render("retained-overview-layout", "custom", JSON.stringify({ sections: { overview: true }, subsections: { overview: { summary: true, landingPages: true, conversionEvents: true } } }));
    const campaign = boxes.find(b => b.text.startsWith("Campaign:"))!;
    expect(campaign.right).toBeLessThanOrEqual(103);
    const detailRows = boxes.filter(b => b.text.startsWith("/international") || b.text.startsWith("conversion_event"));
    expect(detailRows.length).toBeGreaterThan(20);
    expect(new Set(boxes.map(b => b.page)).size).toBeGreaterThan(1);
    for (const first of detailRows) {
      const following = boxes.filter(b => b.page === first.page && b.y === first.y && b.x > first.x).sort((a, b) => a.x - b.x);
      expect(following.length).toBeGreaterThan(0);
      expect(first.right).toBeLessThan(following[0].x);
      for (const cell of [first, ...following]) { expect(cell.x).toBeGreaterThanOrEqual(16); expect(cell.right).toBeLessThanOrEqual(194); }
    }
  });
});

describe("V1-015 saved source amounts in the scheduled artifact", () => {
  it.each(["standard", "custom", "zero", "refund", "long", "multipage"])("matches the live source-only Ad Comparison table in the %s scheduled PDF", async kind => {
    const day = (date: string) => row(date, 100, 2.5, kind === "zero" ? 0 : 500);
    setFixture(rowsFor(14, day, day));
    const names = ["HubSpot", "Salesforce", "Shopify", "CSV", "Google Sheets"];
    const types = ["hubspot", "salesforce", "shopify", "csv", "google_sheets"];
    const amounts = kind === "zero" ? [0, 0, 0, 0, 0] : [250, 100, 785.95, kind === "refund" ? -50 : 50, 25];
    fixture.revenueSources = names.map((name, i) => ({ id: name, sourceType: types[i], displayName: name + (kind === "long" ? " regional confirmed revenue attribution label with complete provenance" : ""), currency: "EUR", isActive: true, mappingConfig: { campaignValueRevenueTotals: [{ campaignValue: "child_should_not_be_repeated", revenue: amounts[i] }] } }));
    if (kind === "multipage") fixture.revenueSources = Array.from({ length: 45 }, (_, i) => ({ id: `source-${i}`, sourceType: types[i % 5], displayName: `${names[i % 5]} source ${i} regional confirmed revenue attribution label with complete provenance`, currency: "EUR", isActive: true, mappingConfig: null }));
    fixture.revenueBreakdown = fixture.revenueSources.map((source: any, i: number) => ({ sourceId: source.id, sourceType: source.sourceType, displayName: source.displayName, revenue: kind === "multipage" ? 1 : amounts[i] }));
    fixture.financial.metrics.financialDaily.inputs.revenue.value = kind === "zero" ? "0" : kind === "refund" ? "8110.95" : kind === "multipage" ? "7045" : "8210.95";
    const report = { campaignId: fixture.campaign.id, reportType: kind === "standard" ? "ads" : "custom", configuration: JSON.stringify({ sections: { ads: true }, subsections: { ads: { bestWorst: false, topCampaigns: false, allCampaigns: false, revenueBreakdown: true } } }) };
    const payload = await pdf.buildGA4ReportPayload(report);
    expect(payload.adComparisonBreakdownAgg.reduce((sum: number, item: any) => sum + item.revenue, 0)).toBe(kind === "zero" ? 0 : 7000);
    expect(payload.campaignBreakdownMatchedExternalRevenue.size).toBe(0);
    boxes = [];
    const bytes = await pdf.buildGA4ScheduledPdfAttachment({ report, campaignName: fixture.campaign.name });
    const text = boxes.map(box => box.text);
    expect(text).toContain("TOTAL");
    expect(text[text.indexOf("TOTAL") + 1]).toBe(kind === "zero" ? "EUR 0.00" : kind === "refund" ? "EUR 8,110.95" : kind === "multipage" ? "EUR 7,045.00" : "EUR 8,210.95");
    expect(text.join(" ")).not.toContain("child_should_not_be_repeated");
    if (kind === "zero") expect(text.join(" ")).not.toContain("HubSpot");
    if (kind === "long" || kind === "multipage") {
      expect(text.join(" ")).toContain("complete provenance");
      for (const box of boxes) { expect(box.x).toBeGreaterThanOrEqual(12); expect(box.right).toBeLessThanOrEqual(198); expect(box.y).toBeLessThanOrEqual(287); }
      if (kind === "multipage") expect(new Set(boxes.map(box => box.page)).size).toBeGreaterThan(1);
      writeFileSync(`${directory}/closeout-scheduled-ads-${kind}.pdf`, bytes);
    }
  });
  it("adds EUR 250 and 100 to native revenue without allocating unmapped sales to campaign rows", async () => {
    setFixture(rowsFor(14, date => row(date, 100, 2.5, 500), date => row(date, 100, 2.5, 500)));
    fixture.revenueSources = [
      { id: "hubspot", sourceType: "hubspot", displayName: "HubSpot", currency: "EUR", isActive: true, mappingConfig: null },
      { id: "salesforce", sourceType: "salesforce", displayName: "Salesforce", currency: "EUR", isActive: true, mappingConfig: null },
    ];
    fixture.revenueBreakdown = [
      { sourceId: "hubspot", sourceType: "hubspot", displayName: "HubSpot", revenue: 250 },
      { sourceId: "salesforce", sourceType: "salesforce", displayName: "Salesforce", revenue: 100 },
    ];
    fixture.financial.metrics.financialDaily.inputs.revenue.value = "7350";
    const report = { campaignId: fixture.campaign.id, reportType: "custom", configuration: JSON.stringify({ sections: { overview: true }, subsections: { overview: { revenue: true, campaignBreakdown: true } } }) };
    const payload = await pdf.buildGA4ReportPayload(report);
    expect(payload.ga4RevenueForFinancials).toBe(7000);
    expect(payload.financialRevenue).toBe(7350);
    expect(payload.campaignBreakdownAgg.reduce((sum: number, item: any) => sum + item.revenue, 0)).toBe(7000);
    expect(payload.campaignBreakdownMatchedExternalRevenue.size).toBe(0);
    boxes = [];
    await pdf.buildGA4ScheduledPdfAttachment({ report, campaignName: fixture.campaign.name });
    const text = boxes.map(box => box.text).join("\n");
    for (const amount of ["7,350.00", "7,000.00", "250.00", "100.00"]) expect(text).toContain(amount);
    fixture.revenueSources[0].currency = "USD";
    await expect(pdf.buildGA4ReportPayload(report)).rejects.toThrow("Financial publication changed");
  });
});
