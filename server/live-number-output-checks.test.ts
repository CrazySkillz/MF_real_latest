import { describe, expect, it, vi } from "vitest";
import { checkApplicationOutputs, checkFinancialComparisonOutputs, monitorComparisonWindows, expectedOutputNumbers, expectedTargetNumbers } from "./live-number-output-checks";
import { monitorReadQueryAllowed, outputReportReadAllowed, outputReportAuthorization, createOutputReportReader } from "../scripts/check-live-number-outputs";
import type { LiveNumberSnapshot } from "./live-number-checks";
import { checkConfiguredReportText, checkDiagnosticReportText, checkGeneratedReportText, checkReportDetailText } from "./live-number-generated-report-checks";
import { checkApplicationOutputProcess } from "../scripts/check-live-number-run";

const now = new Date("2026-11-05T13:00:00Z");
const fixture = (): LiveNumberSnapshot => ({
  campaign: { id: "a", clientId: "client", ownerId: "owner", createdAt: "2026-11-04T00:00:00Z", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["search"]' },
  rows: {
    ga4Connections: [{ id: "connection", campaignId: "a", isActive: true, isPrimary: true, propertyId: "123", importStartDate: "2026-11-04" }],
    ga4OverviewSnapshots: [{ campaignId: "a", propertyId: "123", windowStart: "2026-11-04", windowEnd: "2026-11-04",
      campaignBreakdown: { meta: { propertyId: "123", currencyCode: "EUR" }, totals: { users: 8, sessions: 20, conversions: 1.5, revenue: 100, engagedSessions: 10, engagementRate: 0.5 }, rows: [] } }],
    ga4DailyMetrics: [{ campaignId: "a", propertyId: "123", date: "2026-11-04", users: 10, sessions: 20, conversions: 1.5, revenue: "100", engagedSessions: 10, pageviews: 30, engagementRate: "0.5" }],
    spendSources: [{ id: "spend", campaignId: "a", isActive: true, currency: "EUR" }],
    spendRecords: [{ spendSourceId: "spend", campaignId: "a", currency: "EUR", date: "2026-11-04", spend: "40" }],
    revenueSources: [], revenueRecords: [], kpis: [], benchmarks: [], metricSnapshots: [], linkedinReports: [],
  },
});
const summary = () => ({ campaignId: "a", sources: [{ id: "ga4", connected: true }], currentValueWindow: { startDate: "2026-11-04", endDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" },
  totals: Object.fromEntries(Object.entries({ users: 10, sessions: 20, conversions: 1.5, revenue: 100, spend: 40, roas: 2.5, roi: 150, cpa: 26.67, cvr: 7.5 })
    .map(([key, value]) => [key, { value, available: true }])) });
const sectionChecks = (section: string, outputs: any, snapshot = fixture()) => checkApplicationOutputs(snapshot, outputs, now).filter(check => check.section === section);

describe("remaining live monitor selections", () => {
  it("keeps exact days separate from calendar-month clamping, including leap years", () => {
    expect(monitorComparisonWindows("2024-03-31").find(item => item.key === "comparisonMonth")?.date).toBe("2024-02-29");
    expect(monitorComparisonWindows("2026-03-31").find(item => item.key === "comparisonMonth")?.date).toBe("2026-02-28");
    expect(monitorComparisonWindows("2026-03-31").find(item => item.key === "comparison30d")?.date).toBe("2026-03-01");
    expect(monitorComparisonWindows("2026-11-04").map(item => item.key)).toEqual(["comparison1d", "comparison7d", "comparison14d", "comparison30d", "comparison90d", "comparisonMonth"]);
    expect(() => monitorComparisonWindows("2026-02-30")).toThrow();
  });
  const financial = (date: string, revenue = 0, spend = 0, conversions = 0) => ({ id: date, campaignId: "a", snapshotType: "financial_daily", reportingDate: date,
    metrics: { financialDaily: { version: "financial_daily_snapshot_v1", currency: "EUR", currentValueWindow: {
      mode: "initial_import_to_latest_completed_day", startDate: date < "2026-11-04" ? "1900-01-01" : "2026-11-04", endDate: date, dataThroughDate: date, reportingTimeZone: "Europe/Amsterdam" },
    inputs: { revenue: { value: revenue, available: true, sources: ["ga4"] }, spend: { value: spend, available: true, sources: ["canonical_spend_sources"] }, conversions: { value: conversions, available: true, sources: ["ga4"] } } } } });
  it("checks stored propagation and independently summed exact-date fallback inputs", () => {
    const snapshot = fixture(), current = financial("2026-11-04", 100, 40, 1.5), previous = financial("2026-11-03");
    previous.metrics.financialDaily.inputs.spend = { value: null as any, available: false, sources: [] };
    snapshot.rows.metricSnapshots = [current];
    const outputs = { comparison1d: { current: structuredClone(current), previous, comparisonDate: "2026-11-03" } };
    const checks = () => checkFinancialComparisonOutputs(snapshot, outputs, now).filter(check => check.section.endsWith("comparison1d"));
    expect(checks().every(check => check.status === "passed")).toBe(true);
    previous.metrics.financialDaily.inputs.revenue.value = 10;
    expect(checks()).toContainEqual(expect.objectContaining({ code: "previous_revenue", status: "difference" }));
    outputs.comparison1d.current.metrics.financialDaily.currency = "USD";
    expect(checks()).toContainEqual(expect.objectContaining({ code: "current_SCOPE", status: "difference" }));
    previous.campaignId = "other";
    expect(checks()).toContainEqual(expect.objectContaining({ code: "previous_SCOPE", status: "difference" }));
  });
  it("never passes missing responses, incomplete history or duplicate saved snapshots", () => {
    const snapshot = fixture();
    expect(checkFinancialComparisonOutputs(snapshot, {}, now).every(check => check.status === "unverified")).toBe(true);
    snapshot.rows.metricSnapshots = [financial("2026-11-04"), financial("2026-11-04")];
    expect(checkFinancialComparisonOutputs(snapshot, { comparison1d: { comparisonDate: "2026-11-03", current: financial("2026-11-04") } }, now))
      .toContainEqual(expect.objectContaining({ code: "current_DUPLICATE_SNAPSHOTS", status: "unverified" }));
    snapshot.rows.metricSnapshots = []; snapshot.rows.ga4DailyMetrics = [];
    expect(checkFinancialComparisonOutputs(snapshot, { comparison1d: { comparisonDate: "2026-11-03", current: financial("2026-11-04") } }, now))
      .toContainEqual(expect.objectContaining({ code: "current_DATED_INPUTS_UNVERIFIED", status: "unverified" }));
  });
  it("preserves historical currency while verifying that the display rejects incompatible history", () => {
    const snapshot = fixture(), current = financial("2026-11-04", 100, 40, 1.5), previous = financial("2026-11-03");
    previous.metrics.financialDaily.currency = "USD";
    snapshot.rows.metricSnapshots = [current, previous];
    const checks = checkFinancialComparisonOutputs(snapshot, { comparison1d: { current, previous, comparisonDate: "2026-11-03" } }, now)
      .filter(check => check.section.endsWith("comparison1d"));
    expect(checks.every(check => check.status === "passed")).toBe(true);
    expect(checks).toContainEqual(expect.objectContaining({ code: "previous_DISPLAY_COMPATIBILITY", status: "passed" }));
  });
  it("distinguishes a recorded zero spend from having no dated spend record", () => {
    const snapshot = fixture(), current = financial("2026-11-04", 100, 40, 1.5), previous = financial("2026-11-03");
    snapshot.rows.metricSnapshots = [current];
    snapshot.rows.spendRecords.push({ ...snapshot.rows.spendRecords[0], date: "2026-11-03", spend: "0" });
    const outputs = { comparison1d: { current, previous, comparisonDate: "2026-11-03" } };
    expect(checkFinancialComparisonOutputs(snapshot, outputs, now).filter(check => check.section.endsWith("comparison1d")).every(check => check.status === "passed")).toBe(true);
    previous.metrics.financialDaily.inputs.spend.available = false;
    expect(checkFinancialComparisonOutputs(snapshot, outputs, now)).toContainEqual(expect.objectContaining({ code: "previous_spend_AVAILABILITY", status: "difference" }));
  });
  const custom = (configuration: any) => ({ id: "report-a", campaignId: "a", platformType: "google_analytics", reportType: "custom", configuration });
  const summaryText = "Performance Overview\nSummary\nSESSIONS\n20\nUSERS\n10\nCONVERSIONS\n1.5\nENGAGEMENT RATE\n50.0%\nCONV. RATE\n7.5%";
  it("checks summary-only custom reports without requiring unselected financial cards", () => {
    const report = custom({ sections: { overview: true }, subsections: { overview: { summary: true } } });
    const checks = checkConfiguredReportText(fixture(), summaryText, report, now);
    expect(checks).toHaveLength(5); expect(checks.every(check => check.status === "passed")).toBe(true);
    expect(checkConfiguredReportText(fixture(), summaryText.replace("20", "21"), report, now)).toContainEqual(expect.objectContaining({ code: "SESSIONS", status: "difference" }));
  });
  it("uses only explicitly selected target IDs and rejects missing or duplicate selections", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k1", platformType: "google_analytics", name: "Sessions", currentValue: "20", targetValue: "30" },
      { id: "k2", platformType: "google_analytics", name: "Revenue", currentValue: "100", targetValue: "200" }];
    const report = custom({ sections: { kpis: true }, subsections: { kpis: { items: true } }, selectedKpiIds: ["k1"] });
    expect(checkConfiguredReportText(snapshot, "Key Performance Indicators\nSessions 20 30", report, now).every(check => check.status === "passed")).toBe(true);
    report.configuration.selectedKpiIds.push("unknown");
    expect(checkConfiguredReportText(snapshot, "Sessions 20 30", report, now)).toContainEqual(expect.objectContaining({ code: "kpis_SELECTION_UNVERIFIED", status: "unverified" }));
    report.configuration.selectedKpiIds = ["k1", "k1"];
    expect(checkConfiguredReportText(snapshot, "Sessions 20 30", report, now)).toContainEqual(expect.objectContaining({ code: "kpis_SELECTION_UNVERIFIED", status: "unverified" }));
  });
  it("checks selected missing-spend cards instead of dropping their availability check", () => {
    const snapshot = fixture(); snapshot.rows.spendSources = []; snapshot.rows.spendRecords = [];
    const report = custom({ sections: { overview: true }, subsections: { overview: { spend: true } } });
    expect(checkConfiguredReportText(snapshot, "TOTAL SPEND\nUnavailable", report, now)).toEqual([
      expect.objectContaining({ code: "TOTAL_SPEND_UNAVAILABLE", status: "passed" }),
    ]);
    expect(checkConfiguredReportText(snapshot, "TOTAL SPEND\nEUR 0.00", report, now).every(check => check.status === "passed")).toBe(false);
  });
  it("fails closed on foreign reports, invalid JSON and unknown selected content", () => {
    expect(checkConfiguredReportText(fixture(), "", { ...custom({}), campaignId: "other" }, now)[0].status).toBe("difference");
    expect(checkConfiguredReportText(fixture(), "", custom("{"), now)[0].code).toBe("REPORT_CONFIGURATION_UNVERIFIED");
    expect(checkConfiguredReportText(fixture(), summaryText, custom({ sections: { futureMetric: true } }), now))
      .toContainEqual(expect.objectContaining({ code: "REPORT_SELECTION_SCHEMA_UNVERIFIED", status: "unverified" }));
  });
  it.each(["users", "conversions", "revenue", "conversionRate"])("checks Comparison chart totals and values for %s", metric => {
    const snapshot = fixture(); snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows = [{ campaign: "search", sessions: 20, users: 8, conversions: 1.5, revenue: 100, sessionKeyEventRate: 0.05 }];
    const labels: any = { users: ["Users", "TOTAL USERS", "8"], conversions: ["Conversions", "TOTAL CONVERSIONS", "1.5"], revenue: ["Revenue", "CAMPAIGN BREAKDOWN REVENUE", "EUR 100.00"], conversionRate: ["Conversion Rate", "OVERALL CONVERSION RATE", "5%"] };
    const [label, total, value] = labels[metric];
    const text = `Top Campaigns by ${label}\n${value}\nsearch\n${total}\n${value}\nCAMPAIGNS COMPARED\n1`;
    const report = custom({ sections: { ads: true }, subsections: { ads: { topCampaigns: true } }, adComparisonMetric: metric });
    expect(checkConfiguredReportText(snapshot, text, report, now).every(check => check.status === "passed")).toBe(true);
    expect(checkConfiguredReportText(snapshot, text.replace(value + "\nsearch", "999\nsearch"), report, now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_CHART_VALUE", status: "difference" }));
  });
  it.each([0, 1.5, 25])("rejects the old rate in corrected Comparison PDFs with %s conversions", conversions => {
    const snapshot = fixture(); snapshot.comparisonRateDefinition = "conversions_per_session";
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows = [{ campaign: "search", sessions: 20, users: 8, conversions, revenue: 100, sessionKeyEventRate: 0.05 }];
    const value = `${conversions / 20 * 100}%`;
    const text = `Top Campaigns by Conversion Rate\n${value}\nsearch\nOVERALL CONVERSION RATE\n${value}\nCAMPAIGNS COMPARED\n1`;
    const report = custom({ sections: { ads: true }, subsections: { ads: { topCampaigns: true } }, adComparisonMetric: "conversionRate" });
    expect(checkConfiguredReportText(snapshot, text, report, now).every(check => check.status === "passed")).toBe(true);
    expect(checkConfiguredReportText(snapshot, text.replaceAll(value, "5%"), report, now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_SELECTED_TOTAL", status: "difference" }));
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows[0].sessions = 0;
    const unavailable = text.replace(value + "\nsearch", "0%\nsearch").replace("RATE\n" + value, "RATE\nUnavailable");
    expect(checkConfiguredReportText(snapshot, unavailable, report, now).every(check => check.status === "passed")).toBe(true);
  });
  it("checks native All Campaigns ordering and cent allocation independently of imported revenue", () => {
    const snapshot = fixture(); snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows = [
      { campaign: "a", sessions: 20, users: 8, conversions: 0.1, revenue: 1.0049, sessionKeyEventRate: 0.05 },
      { campaign: "b", sessions: 30, users: 9, conversions: 1.5, revenue: 1.0051, sessionKeyEventRate: 0.05 },
    ];
    const report = custom({ sections: { ads: true }, subsections: { ads: { allCampaigns: true } } });
    const text = "All Campaigns\n1 b 30 9 1.5 EUR 1.01 5%\n2 a 20 8 0.1 EUR 1.00 0.50%";
    expect(checkConfiguredReportText(snapshot, text, report, now).every(check => check.status === "passed")).toBe(true);
    expect(checkConfiguredReportText(snapshot, text.replace("EUR 1.01", "EUR 1.00"), report, now)).toContainEqual(expect.objectContaining({ code: "ALL_CAMPAIGNS_3", status: "difference" }));
  });
});

describe("actual application output comparisons", () => {
  it("checks Pipeline Proxy selected-source identity and values without mixing confirmed revenue", () => {
    const snapshot = fixture(), cfg = { pipelineEnabled: true, pipelineProxyMode: "current_stage", pipelineLastUpdatedAt: "2026-11-05T13:00:00Z", pipelineTotalToDate: 12.5, pipelineValueRevenueTotals: [{ campaignValue: "search", revenue: 12.5 }] };
    snapshot.rows.revenueSources = [{ id: "crm", campaignId: "a", sourceType: "hubspot", platformContext: "ga4", isActive: true, currency: "EUR", mappingConfig: cfg }];
    const actual = { sourceId: "crm", success: true, pipelineEnabled: true, mode: "current_stage", lastUpdatedAt: cfg.pipelineLastUpdatedAt, currency: "EUR", totalToDate: 12.5, pipelineValueRevenueTotals: cfg.pipelineValueRevenueTotals };
    expect(sectionChecks("Pipeline Proxy / hubspot response", { hubspotPipeline: actual }, snapshot).every(check => check.status === "passed")).toBe(true);
    actual.totalToDate = 100;
    expect(sectionChecks("Pipeline Proxy / hubspot response", { hubspotPipeline: actual }, snapshot)).toContainEqual(expect.objectContaining({ code: "EXPECTED_REVENUE", status: "difference" }));
    actual.sourceId = "another";
    expect(sectionChecks("Pipeline Proxy / hubspot response", { hubspotPipeline: actual }, snapshot)).toContainEqual(expect.objectContaining({ code: "PIPELINE_SOURCE_UNVERIFIED", status: "unverified" }));
    expect(sectionChecks("Pipeline Proxy / hubspot response", {}, snapshot)).toContainEqual(expect.objectContaining({ code: "PIPELINE_SOURCE_UNVERIFIED", status: "unverified" }));
  });
  it("keeps whole-window unique users separate from daily summed users", () => {
    const expected = expectedOutputNumbers(fixture(), now);
    expect(expected.totals.users).toBe(10);
    const native = { propertyId: "123", startDate: "2026-11-04", endDate: "2026-11-04", totals: fixture().rows.ga4OverviewSnapshots[0].campaignBreakdown.totals };
    expect(sectionChecks("native response", { native }).every(check => check.status === "passed")).toBe(true);
    native.totals.users = 10;
    expect(sectionChecks("native response", { native })).toContainEqual(expect.objectContaining({ code: "users", status: "difference" }));
  });
  it("detects bad returned Overview values even when stored values are correct", () => {
    const daily = { propertyId: "123", overviewStartDate: "2026-11-04", endDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam",
      overviewTotals: { users: 10, sessions: 20, conversions: 1.5, revenue: 100, engagedSessions: 10, pageviews: 30, engagementRate: 0.5 } };
    expect(sectionChecks("Overview response", { daily }).every(check => check.status === "passed")).toBe(true);
    daily.overviewTotals.conversions = 2;
    expect(sectionChecks("Overview response", { daily })).toContainEqual(expect.objectContaining({ code: "conversions", status: "difference" }));
    daily.propertyId = "456";
    expect(sectionChecks("Overview response", { daily })).toContainEqual(expect.objectContaining({ code: "DATE_PROPERTY_TIMEZONE", status: "difference" }));
  });
  it("detects missing, extra and duplicate source rows independently of the total", () => {
    const spendBreakdown = { totalSpend: 40, sources: [{ sourceId: "spend", spend: 40, currency: "EUR" }] };
    expect(sectionChecks("spend source list", { spendBreakdown }).every(check => check.status === "passed")).toBe(true);
    spendBreakdown.sources.push({ ...spendBreakdown.sources[0] });
    expect(sectionChecks("spend source list", { spendBreakdown })).toContainEqual(expect.objectContaining({ code: "ROW_IDENTITIES", status: "difference" }));
  });
  it("checks dates and currency even when a financial total matches", () => {
    const spend = { spendToDate: 40, startDate: "1900-01-01", endDate: "2026-11-04", currency: "USD" };
    expect(sectionChecks("spend response", { spend })).toContainEqual(expect.objectContaining({ code: "SOURCE_TO_DATE_WINDOW", status: "difference" }));
  });
  it("detects changed KPI targets and cross-campaign returned rows", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k", campaignId: "a", platformType: "google_analytics", currentValue: "20", targetValue: "30" }];
    const kpis = [{ ...snapshot.rows.kpis[0], campaignId: "b", targetValue: "40" }];
    const checks = sectionChecks("kpis response", { kpis }, snapshot);
    expect(checks).toContainEqual(expect.objectContaining({ code: "targetValue", status: "difference" }));
    expect(checks).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_BOUNDARY", status: "difference" }));
  });
  it("checks actual Performance and Executive aggregate values independently", () => {
    const outcome = { performanceSummary: summary() }, executive = { performanceSummary: summary() };
    for (const section of ["Performance Summary response", "Executive Summary response"]) expect(sectionChecks(section, { outcome, executive }).every(check => check.status === "passed")).toBe(true);
    executive.performanceSummary.totals.roas.value = 2.49;
    expect(sectionChecks("Executive Summary response", { executive })).toContainEqual(expect.objectContaining({ code: "roas", status: "difference" }));
    outcome.performanceSummary.currentValueWindow.endDate = "2026-11-03";
    expect(sectionChecks("Performance Summary response", { outcome })).toContainEqual(expect.objectContaining({ code: "SOURCE_WINDOW", status: "difference" }));
  });
  it("rejects hidden availability and unsupported additional platforms", () => {
    const outcome = { performanceSummary: summary() };
    outcome.performanceSummary.totals.spend.available = false;
    expect(sectionChecks("Performance Summary response", { outcome })).toContainEqual(expect.objectContaining({ code: "spend_AVAILABLE", status: "difference" }));
    outcome.performanceSummary.sources.push({ id: "linkedin", connected: true });
    expect(sectionChecks("Performance Summary response", { outcome })).toContainEqual(expect.objectContaining({ code: "ADDITIONAL_PLATFORM_OUTPUT_UNVERIFIED", status: "unverified" }));
  });
  it("uses the Executive screen's outcome window and checks missing-value display guards", () => {
    const snapshot = fixture(); snapshot.rows.spendSources = []; snapshot.rows.spendRecords = [];
    const current = summary();
    for (const metric of ["spend", "roas", "roi", "cpa"]) current.totals[metric] = { value: null as any, available: false };
    const legacy: any = structuredClone(current); delete legacy.currentValueWindow;
    const outputs = { outcome: { performanceSummary: current }, executive: { performanceSummary: legacy, metrics: { totalSpend: 0, roas: 0, roi: 0, cpa: 0 } } };
    expect(sectionChecks("Executive Summary response", outputs, snapshot).every(check => check.status === "passed")).toBe(true);
    const guards = () => sectionChecks("Executive metric response", outputs, snapshot).filter(check => check.code.endsWith("DISPLAY_GUARD"));
    expect(guards()).toHaveLength(4); expect(guards().every(check => check.status === "passed")).toBe(true);
    current.totals.spend.available = true;
    expect(guards()).toContainEqual(expect.objectContaining({ code: "totalSpend_UNAVAILABLE_DISPLAY_GUARD", status: "difference" }));
    delete (current as any).currentValueWindow;
    expect(sectionChecks("Executive Summary response", outputs, snapshot)).toContainEqual(expect.objectContaining({ code: "SOURCE_WINDOW_UNVERIFIED", status: "unverified" }));
  });
  it("does not call missing responses or invalid campaign scope a pass", () => {
    expect(checkApplicationOutputs(fixture(), {}, now).every(check => check.status === "unverified")).toBe(true);
    const snapshot = fixture(); delete snapshot.campaign.ownerId;
    expect(checkApplicationOutputs(snapshot, { outcome: { performanceSummary: summary() } }, now)).toEqual([{ section: "Application outputs", code: "OUTPUT_SCOPE_UNVERIFIED", status: "unverified" }]);
  });
  it("detects a corrupted daily Trend ratio", () => {
    const trend = { trendAnalysis: { dailyTotals: [{ date: "2026-11-04", metrics: { spend: 40, revenue: 100, conversions: 1.5, sessions: 20, roas: 2.5, roi: 150, cpa: 26.67, cvr: 7.5 } }] } };
    expect(sectionChecks("Trend daily ratio response", { trend }).every(check => check.status === "passed")).toBe(true);
    trend.trendAnalysis.dailyTotals[0].metrics.cpa = 40;
    expect(sectionChecks("Trend daily ratio response", { trend })).toContainEqual(expect.objectContaining({ code: "cpa", status: "difference" }));
  });
  it.each(["missing", "native zero", "imported zero", "inactive source", "foreign campaign", "wrong currency"])("checks daily Trend revenue availability independently (%s)", condition => {
    const snapshot = fixture(), date = "2026-09-25", measured = condition === "native zero" || condition === "imported zero";
    if (condition === "native zero") snapshot.rows.ga4DailyMetrics.push({ ...snapshot.rows.ga4DailyMetrics[0], date, revenue: "0" });
    if (condition !== "missing" && condition !== "native zero") {
      snapshot.rows.revenueSources = [{ id: "revenue", campaignId: "a", isActive: condition !== "inactive source", currency: "EUR", platformContext: "ga4" }];
      snapshot.rows.revenueRecords = [{ revenueSourceId: "revenue", campaignId: condition === "foreign campaign" ? "other" : "a", currency: condition === "wrong currency" ? "USD" : "EUR", date, revenue: "0" }];
    }
    const metrics: any = { spend: 4.89, revenue: 0, roas: measured ? 0 : null, roi: measured ? -100 : null, cpa: null, cvr: null };
    const trend = { trendAnalysis: { startDate: date, dailyTotals: [{ date, metrics }] } };
    const ratios = () => sectionChecks("Trend daily ratio response", { trend }, snapshot).filter(check => /^(roas|roi)/.test(check.code));
    expect(ratios()).toHaveLength(2); expect(ratios().every(check => check.status === "passed")).toBe(true);
    metrics.roas = measured ? null : 0; metrics.roi = measured ? null : -100;
    expect(ratios().every(check => check.status === "passed")).toBe(false);
    delete metrics.roas; delete metrics.roi;
    expect(ratios().every(check => check.status === "passed")).toBe(false);
  });
  it("checks notification numbers, live threshold, breach and destination", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k", name: "Sessions", campaignId: "a", platformType: "google_analytics", metric: "sessions",
      applyTo: "all", alertsEnabled: true, alertThreshold: "30", alertCondition: "below" }];
    const meta = { kpiId: "k", itemName: "Sessions", platformType: "google_analytics", currentValue: 20, thresholdValue: 30, alertCondition: "below", actionUrl: "/campaigns/a/ga4-metrics?tab=kpis&highlight=k" };
    const notifications = [{ id: "n", campaignId: "a", type: "performance-alert", metadata: meta }];
    expect(sectionChecks("Notification response", { notifications }, snapshot).every(check => check.status === "passed")).toBe(true);
    meta.currentValue = 200; meta.actionUrl = "/campaigns/b/ga4-metrics?highlight=k";
    const checks = sectionChecks("Notification response", { notifications }, snapshot);
    expect(checks).toContainEqual(expect.objectContaining({ code: "CURRENT_VALUE", status: "difference" }));
    expect(checks).toContainEqual(expect.objectContaining({ code: "TARGET_AND_LINK", status: "difference" }));
  });
  it("checks the configured budget-period spend, not lifetime spend", () => {
    const snapshot = fixture(); snapshot.campaign.pacingStartDate = "2026-11-04"; snapshot.campaign.pacingEndDate = "2026-11-20";
    snapshot.rows.spendRecords.push({ ...snapshot.rows.spendRecords[0], date: "2026-11-03", spend: "60" });
    const outcome = { campaignId: "a", budgetPacing: { campaignId: "a", currency: "EUR", periodStartDate: "2026-11-04", periodEndDate: "2026-11-20", dataThroughDate: "2026-11-04", spend: { available: true, value: 40 } } };
    expect(sectionChecks("Budget period response", { outcome }, snapshot).every(check => check.status === "passed")).toBe(true);
    outcome.budgetPacing.spend.value = 100;
    expect(sectionChecks("Budget period response", { outcome }, snapshot)).toContainEqual(expect.objectContaining({ code: "PERIOD_SPEND", status: "difference" }));
  });
  it.each([[110, "stable"], [111, "accelerating"], [89, "declining"]])("checks Executive trajectory arithmetic and boundary at revenue %s", (revenue, trajectory) => {
    const snapshot = fixture(); snapshot.rows.ga4Connections[0].importStartDate = "2026-10-01";
    snapshot.rows.ga4OverviewSnapshots[0].windowStart = "2026-10-01";
    snapshot.rows.metricSnapshots = ["2026-10-28", "2026-11-04"].map((reportingDate, index) => ({ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate,
      metrics: { executiveSummaryDaily: { version: "executive_summary_daily_snapshot_v2", currency: "EUR", ga4PropertyId: "123", ga4CampaignFilter: '["search"]',
        sourceSignature: ["ga4"], performanceSummaryVersion: "performance_summary_aggregate_v3",
        currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-01", endDate: reportingDate, reportingTimeZone: "Europe/Amsterdam" },
        totals: { revenue: { available: true, value: index ? revenue : 100 } } } } }));
    const outputs = { trajectory: { reportingDate: "2026-11-04", comparisonDate: "2026-10-28", available: true, reason: null, trajectory, trendPercentage: Number(revenue) - 100 } };
    expect(sectionChecks("Executive trajectory response", outputs, snapshot).every(check => check.status === "passed")).toBe(true);
    outputs.trajectory.trendPercentage = 999;
    expect(sectionChecks("Executive trajectory response", outputs, snapshot)).toContainEqual(expect.objectContaining({ code: "REVENUE_CHANGE_PERCENT", status: "difference" }));
    snapshot.rows.metricSnapshots[0].metrics.executiveSummaryDaily.currency = "USD";
    expect(sectionChecks("Executive trajectory response", outputs, snapshot)).toContainEqual(expect.objectContaining({ code: "INCOMPATIBLE_HISTORY_UNAVAILABLE", status: "difference" }));
  });
  it("checks Executive target values, bands, attainment and missing rows independently", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k", name: "Sessions", metric: "sessions", platformType: "google_analytics", applyTo: "all", targetValue: "25", unit: "count" }];
    const executive = { kpiProgress: [{ kpiId: "k", current: 20, target: 25, status: "below", pctComplete: 80 }], benchmarkComparison: [] };
    expect(sectionChecks("Executive kpis response", { executive }, snapshot).every(check => check.status === "passed")).toBe(true);
    executive.kpiProgress[0].status = "above";
    expect(sectionChecks("Executive kpis response", { executive }, snapshot)).toContainEqual(expect.objectContaining({ code: "TARGET_STATUS", status: "difference" }));
    executive.kpiProgress = [];
    expect(sectionChecks("Executive kpis response", { executive }, snapshot)).toContainEqual(expect.objectContaining({ code: "TARGET_COUNT", status: "difference" }));
  });
  it("reconstructs changed-source trajectory from complete dated revenue and rejects incomplete history", () => {
    const snapshot = fixture(); snapshot.rows.ga4Connections[0].importStartDate = "2026-10-28";
    snapshot.rows.ga4OverviewSnapshots[0].windowStart = "2026-10-28";
    snapshot.rows.ga4DailyMetrics = Array.from({ length: 8 }, (_, index) => ({ ...snapshot.rows.ga4DailyMetrics[0], date: new Date(Date.parse("2026-10-28") + index * 86400000).toISOString().slice(0, 10), revenue: "10" }));
    snapshot.rows.metricSnapshots = ["2026-10-28", "2026-11-04"].map((reportingDate, index) => ({ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate,
      metrics: { executiveSummaryDaily: { version: "executive_summary_daily_snapshot_v2", currency: "EUR", ga4PropertyId: "123", ga4CampaignFilter: '["search"]',
        sourceSignature: index ? ["ga4:web_analytics:revenue", "spend_source:new"] : ["ga4:web_analytics:revenue"], performanceSummaryVersion: "performance_summary_aggregate_v3",
        currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-28", endDate: reportingDate, reportingTimeZone: "Europe/Amsterdam" },
        totals: { revenue: { available: true, value: index ? 80 : 999 } } } } }));
    const trajectory = { reportingDate: "2026-11-04", comparisonDate: "2026-10-28", available: true, reason: null, trajectory: "accelerating", trendPercentage: 700, source: "dated_revenue_history" };
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot).every(check => check.status === "passed")).toBe(true);
    trajectory.trendPercentage = 699;
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot)).toContainEqual(expect.objectContaining({ code: "REVENUE_CHANGE_PERCENT", status: "difference" }));
    snapshot.rows.ga4DailyMetrics.pop();
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot)).toContainEqual(expect.objectContaining({ code: "CHANGED_SOURCE_HISTORY_UNVERIFIED", status: "unverified" }));
  });
  it("verifies the GA4-only trajectory fallback without inventing an old Executive snapshot", () => {
    const snapshot = fixture(); snapshot.rows.ga4Connections[0].importStartDate = "2026-10-28";
    snapshot.rows.ga4OverviewSnapshots[0].windowStart = "2026-10-28";
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.totals.revenue = 80;
    snapshot.rows.ga4DailyMetrics = Array.from({ length: 8 }, (_, index) => ({ ...snapshot.rows.ga4DailyMetrics[0], date: new Date(Date.parse("2026-10-28") + index * 86400000).toISOString().slice(0, 10), revenue: "10" }));
    snapshot.rows.metricSnapshots = [{ campaignId: "a", snapshotType: "executive_summary_daily", reportingDate: "2026-11-04", metrics: { executiveSummaryDaily: {
      currency: "EUR", ga4PropertyId: "123", ga4CampaignFilter: '["search"]', sourceSignature: ["ga4:web_analytics:revenue"],
      currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-10-28", endDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" }, totals: { revenue: { available: true, value: 80, sources: ["ga4"] } },
    } } }];
    const trajectory = { reportingDate: "2026-11-04", comparisonDate: "2026-10-28", available: true, reason: null, trajectory: "accelerating", trendPercentage: 700, source: "financial_daily_fallback" };
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot).every(check => check.status === "passed")).toBe(true);
    trajectory.trendPercentage = 699;
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot)).toContainEqual(expect.objectContaining({ code: "FALLBACK_REVENUE_CHANGE_PERCENT", status: "difference" }));
    snapshot.rows.ga4DailyMetrics.pop();
    expect(sectionChecks("Executive trajectory response", { trajectory }, snapshot)).toContainEqual(expect.objectContaining({ code: "FALLBACK_HISTORY_UNVERIFIED", status: "unverified" }));
  });
});

describe("current generated PDF values", () => {
  const text = "GA4 Overview Report\nSummary\nSESSIONS\n20\nUSERS\n10\nCONVERSIONS\n1.5\nENGAGEMENT RATE\n50%\nCONV. RATE\n7.5%\nRevenue & Financial\nTOTAL REVENUE\nEUR 100.00\nTOTAL SPEND\nEUR 40.00\nPROFIT\nEUR 60.00\nROAS\n2.50x\nROI\n150%\nCPA\nEUR 26.67\n";
  it("checks actual PDF text against the captured source window", () => {
    expect(checkGeneratedReportText(fixture(), text, "overview", now).every(check => check.status === "passed")).toBe(true);
  });
  it("detects altered PDF values and fails closed on ambiguous or missing labels", () => {
    expect(checkGeneratedReportText(fixture(), text.replace("2.50x", "2.49x"), "overview", now)).toContainEqual(expect.objectContaining({ code: "ROAS", status: "difference" }));
    expect(checkGeneratedReportText(fixture(), text + "ROAS\n2.50x", "overview", now)).toContainEqual(expect.objectContaining({ code: "ROAS", status: "unverified" }));
  });
  it("does not match a different currency or invent a historical source basis", () => {
    expect(checkGeneratedReportText(fixture(), text.replaceAll("EUR", "USD"), "overview", now)).toContainEqual(expect.objectContaining({ code: "TOTAL_REVENUE", status: "unverified" }));
  });
  it("checks KPI table propagation including fractional credits and target values", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k", name: "Conversion credit", platformType: "google_analytics", currentValue: "1.5", targetValue: "10" }];
    expect(checkGeneratedReportText(snapshot, "Key Performance Indicators\nKPI CURRENT TARGET\nConversion credit 1.5 10", "kpis", now)[0].status).toBe("passed");
    expect(checkGeneratedReportText(snapshot, "Key Performance Indicators\nKPI CURRENT TARGET\nConversion credit 2 10", "kpis", now)[0].status).toBe("unverified");
  });
});

describe("Diagnostic PDF core numeric cards", () => {
  const bodies: Record<string, string> = {
    "performance-summary": "Key Outcomes\nTOTAL USERS\n10\nTOTAL SESSIONS\n20\nTOTAL CONVERSIONS\n1.5\nTOTAL REVENUE\n€100.00\nTOTAL SPEND\n€40.00\nCampaign Health",
    "financial-analysis": "Financial Position\nTOTAL SPEND\n€40.00\nTOTAL REVENUE\n€100.00\nPROFIT\n€60.00\nROAS\n2.50x\nROI\n150.0%\nCOST PER ACQUISITION\n€26.67\nCONVERSION RATE\n7.5%\nBudget & Pacing\nCAMPAIGN BUDGET\nUnavailable\nBUDGET USED\nUnavailable\nREMAINING BUDGET\nUnavailable\nBUDGET UTILIZATION\nUnavailable\nDAILY BURN RATE\nUnavailable\nTARGET DAILY SPEND\nUnavailable\nPACING STATUS\nUnavailable\nBUDGET PERIOD START\nUnavailable\nBUDGET PERIOD END\nUnavailable\nAllocation & Sources",
    "trend-analysis": "Current Decision Metrics\nREVENUE\n€100.00\nSPEND\n€40.00\nROAS\n2.5x\nROI\n150.0%\nCONVERSIONS\n1.5\nCOST PER ACQUISITION\n€26.67\nSESSIONS\n20\nUSERS\n10\nCONVERSION RATE\n7.5%\nENGAGEMENT RATE\n50.0%\nCampaign Performance Trend",
    "executive-summary": "Marketing Funnel Performance\nUSERS\n10\nSESSIONS\n20\nCONVERSIONS\n1.5\nREVENUE\n€100.00\nSPEND\n€40.00\nCONVERSION RATE\n7.5%\nROAS\n2.5x\nROI\n150.0%\nKPI Exceptions",
  };
  it.each(Object.keys(bodies))("checks %s against independent inputs and catches altered revenue", type => {
    const checks = checkDiagnosticReportText(fixture(), bodies[type], type, now);
    expect(checks.length).toBeGreaterThanOrEqual(5); expect(checks.every(check => check.status === "passed")).toBe(true);
    expect(checkDiagnosticReportText(fixture(), bodies[type].replace("€100.00", "€101.00"), type, now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "difference" }));
  });
  it("rejects a different currency, ambiguous labels and missing section boundaries", () => {
    const text = bodies["financial-analysis"];
    expect(checkDiagnosticReportText(fixture(), text.replace("€100.00", "$100.00"), "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "REVENUE", status: "unverified" }));
    expect(checkDiagnosticReportText(fixture(), text.replace("ROAS\n", "ROAS\n2.50x\nROAS\n"), "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "ROAS", status: "unverified" }));
    expect(checkDiagnosticReportText(fixture(), text.replace("Budget & Pacing", ""), "financial-analysis", now)[0].status).toBe("unverified");
  });
  it("accepts omitted unavailable Trend cards but rejects a fabricated available value", () => {
    const snapshot = fixture(); snapshot.rows.spendSources = []; snapshot.rows.spendRecords = [];
    const text = bodies["trend-analysis"].replace("SPEND\n€40.00\nROAS\n2.5x\nROI\n150.0%\n", "").replace("COST PER ACQUISITION\n€26.67\n", "");
    expect(checkDiagnosticReportText(snapshot, text, "trend-analysis", now).every(check => check.status === "passed")).toBe(true);
    expect(checkDiagnosticReportText(snapshot, text.replace("REVENUE", "SPEND\n€0.00\nREVENUE"), "trend-analysis", now)).toContainEqual(expect.objectContaining({ code: "SPEND_AVAILABILITY", status: "difference" }));
  });
  it.each(["performance-summary", "executive-summary"])("flags missing spend displayed as zero in %s", type => {
    const snapshot = fixture(); snapshot.rows.spendSources = []; snapshot.rows.spendRecords = [];
    expect(checkDiagnosticReportText(snapshot, bodies[type].replace("€40.00", "€0.00"), type, now)).toContainEqual(expect.objectContaining({ code: "SPEND_AVAILABILITY", status: "difference" }));
    expect(checkDiagnosticReportText(fixture(), bodies[type].replace("€100.00", "Unavailable"), type, now)).toContainEqual(expect.objectContaining({ code: "REVENUE_AVAILABILITY", status: "difference" }));
  });
  it("parses negative money without losing its sign", () => {
    const snapshot = fixture(); snapshot.rows.spendRecords[0].spend = "140";
    const text = bodies["financial-analysis"].replace("€60.00", "-€40.00");
    expect(checkDiagnosticReportText(snapshot, text, "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "PROFIT", status: "passed" }));
  });
  it("checks budget-period pacing including the inclusive day count", () => {
    const snapshot = fixture(); Object.assign(snapshot.campaign, { budget: "500", pacingStartDate: "2026-11-04", pacingEndDate: "2026-11-13" });
    const values: Record<string, string> = { "CAMPAIGN BUDGET": "€500.00", "BUDGET USED": "€40.00", "REMAINING BUDGET": "€460.00", "BUDGET UTILIZATION": "8.0%", "DAILY BURN RATE": "€40.00", "TARGET DAILY SPEND": "€50.00", "PACING STATUS": "20.0% Under", "BUDGET PERIOD START": "2026-11-04", "BUDGET PERIOD END": "2026-11-13" };
    let text = bodies["financial-analysis"];
    for (const [label, value] of Object.entries(values)) text = text.replace(label + "\nUnavailable", label + "\n" + value);
    expect(checkDiagnosticReportText(snapshot, text, "financial-analysis", now).every(check => check.status === "passed")).toBe(true);
    expect(checkDiagnosticReportText(snapshot, text.replace("20.0% Under", "On Track"), "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "PACING_STATUS", status: "difference" }));
    snapshot.rows.spendRecords.push({ ...snapshot.rows.spendRecords[0], date: "2026-11-03", spend: "100" });
    expect(expectedOutputNumbers(snapshot, now).pacing.periodSpend).toBe(40);
  });
});

describe("actual report detail values", () => {
  it("never rounds tiny nonzero conversion credits into a passing zero", () => {
    const snapshot = fixture(); snapshot.rows.ga4DailyMetrics[0].conversions = 0.000000000001;
    snapshot.rows.ga4OverviewSnapshots[0].conversionEvents = { rows: [{ eventName: "purchase", conversions: 0.000000000001, eventCount: 1, users: 1 }] };
    expect(checkGeneratedReportText(snapshot, "Summary\nCONVERSIONS\n0\nRevenue & Financial", "overview", now)).toContainEqual(expect.objectContaining({ code: "CONVERSIONS", status: "difference" }));
    expect(checkDiagnosticReportText(snapshot, "Key Outcomes\nTOTAL CONVERSIONS\n0\nCampaign Health", "performance-summary", now)).toContainEqual(expect.objectContaining({ code: "CONVERSIONS", status: "difference" }));
    expect(checkReportDetailText(snapshot, "purchase 0 1 1", "overview", now)).toContainEqual(expect.objectContaining({ code: "CONVERSION_EVENT_0", status: "difference" }));
    expect(checkReportDetailText(snapshot, "purchase 0.000000000001 1 1", "overview", now)).toContainEqual(expect.objectContaining({ code: "CONVERSION_EVENT_0", status: "passed" }));
  });
  it("detects incorrect Comparison leaders and chart values independently of its total", () => {
    const snapshot = fixture();
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows = [
      { campaign: "a", sessions: 100, users: 99, conversions: 10.125, revenue: 200, sessionKeyEventRate: 0.1 },
      { campaign: "b", sessions: 50, users: 45, conversions: 5, revenue: 100, sessionKeyEventRate: 0.2 },
    ];
    const text = "MOST KEY EVENTS\na\n10.125 Key Events - 10.00% CR\nHIGHEST CONVERSION RATE\nb\n20.00% CR - EUR 100.00 revenue\nNEEDS ATTENTION\na\n10.00% CR - 100 sessions\nTop Campaigns by Sessions\n100\na\n50\nb\nTOTAL SESSIONS\n150\nCAMPAIGNS COMPARED\n2";
    expect(checkReportDetailText(snapshot, text, "ads", now).every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(snapshot, text.replace("MOST KEY EVENTS\na", "MOST KEY EVENTS\nb"), "ads", now)).toContainEqual(expect.objectContaining({ code: "KEY_EVENT_LEADER", status: "difference" }));
    expect(checkReportDetailText(snapshot, text.replace("50\nb", "51\nb"), "ads", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_CHART_VALUE", status: "difference" }));
    expect(checkReportDetailText(snapshot, text.replace("COMPARED\n2", "COMPARED\n20"), "ads", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_COUNT", status: "difference" }));
    expect(checkReportDetailText(snapshot, text.replace("50\nb", "50\nbother"), "ads", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_CHART_VALUE", status: "difference" }));
  });
  it("keeps a negative revenue benchmark's visual progress at zero", () => {
    const snapshot = fixture(); snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.totals.revenue = -50;
    snapshot.rows.benchmarks = [{ id: "b", name: "Revenue", metric: "revenue", unit: "EUR", applyTo: "all", platformType: "google_analytics", benchmarkValue: "100" }];
    expect(expectedTargetNumbers(snapshot, now)[0]).toMatchObject({ verified: true, current: -50, benchmarkStatus: "behind", attainment: 0 });
  });
  it("checks campaign allocation, weighted rates and cent ties without allocating unrelated revenue", () => {
    const snapshot = fixture();
    snapshot.rows.ga4OverviewSnapshots[0].campaignBreakdown.rows = [
      { campaign: "a", sessions: 10, users: 9, conversions: 2, revenue: 1.005, sessionKeyEventRate: 0.1 },
      { campaign: "b", sessions: 30, users: 20, conversions: 3, revenue: 1.005, sessionKeyEventRate: 0.2 },
    ];
    snapshot.rows.revenueSources = [{ id: "extra", campaignId: "a", isActive: true, currency: "EUR", mappingConfig: {} }];
    snapshot.rows.revenueRecords = [{ revenueSourceId: "extra", campaignId: "a", currency: "EUR", date: "2026-11-04", revenue: "50" }];
    const text = "a 10 9 2 10.0% EUR 1.01\nb 30 20 3 20.0% EUR 1.00";
    const checks = checkReportDetailText(snapshot, text, "overview", now).filter(check => check.code.startsWith("CAMPAIGN"));
    expect(checks).toHaveLength(10);
    expect(checks.every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(snapshot, text.replace("10.0%", "20.0%"), "overview", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_BREAKDOWN_3", status: "difference" }));
    snapshot.rows.revenueSources[0].mappingConfig = { campaignMappings: [{ crmValue: "x", linkedinCampaignName: "a" }, { crmValue: "x", linkedinCampaignName: "b" }], campaignValueRevenueTotals: [{ campaignValue: "x", revenue: 50 }] };
    expect(checkReportDetailText(snapshot, text, "overview", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_REVENUE_ALLOCATION_UNVERIFIED", status: "unverified" }));
  });
  it("checks fractional event counts, missing values and substituted rows", () => {
    const snapshot = fixture(); snapshot.rows.ga4OverviewSnapshots[0].conversionEvents = { rows: [{ eventName: "purchase", conversions: 1.5, eventCount: 3, users: null }] };
    const text = "Conversion Events\nEVENT CONVERSIONS EVENT COUNT USERS\npurchase 1.5 3 Unavailable";
    expect(checkReportDetailText(snapshot, text, "overview", now).filter(check => check.code.startsWith("CONVERSION_EVENT")).every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(snapshot, text.replace("1.5", "2"), "overview", now)).toContainEqual(expect.objectContaining({ code: "CONVERSION_EVENT_0", status: "difference" }));
    expect(checkReportDetailText(snapshot, text.replace("purchase", "other"), "overview", now)).toContainEqual(expect.objectContaining({ status: "unverified" }));
  });
  it("checks Insights summary and every dated table row", () => {
    const text = "Trend Table\nDATE SESSIONS REVENUE CONVERSIONS\n2026-11-04 20 EUR 100.00 1.5\nData Summary\nSessions 20 Current GA4 total\nUsers 10 Sum of daily users\nConversions 1.5\nRevenue EUR 100.00 Total across revenue sources\nWhat to investigate next";
    expect(checkReportDetailText(fixture(), text, "insights", now).every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(fixture(), text.replace("2026-11-04", "2026-11-03"), "insights", now)).toContainEqual(expect.objectContaining({ code: "INSIGHTS_TREND_DATES", status: "difference" }));
    expect(checkReportDetailText(fixture(), text.replace("Users 10", "Users 11"), "insights", now)).toContainEqual(expect.objectContaining({ code: "SUMMARY_users_0", status: "difference" }));
    const snapshot = fixture();
    snapshot.rows.ga4DailyMetrics.push({ ...snapshot.rows.ga4DailyMetrics[0], date: "2026-11-03" });
    expect(checkReportDetailText(snapshot, text, "insights", now).every(check => check.status === "passed")).toBe(true);
    snapshot.campaign.createdAt = "2026-11-04T23:30:00Z"; // November 5 in Amsterdam.
    expect(checkReportDetailText(snapshot, text, "insights", now)).toContainEqual(expect.objectContaining({ code: "INSIGHTS_TREND_DATES", status: "difference" }));
  });
  it("verifies the server PDF's zero eligible trend days without accepting lost or fabricated history", () => {
    const snapshot = fixture(); snapshot.campaign.createdAt = "2026-11-05T12:00:00Z";
    const text = "DAYS OF DATA\n0\nData Summary\nSessions 20 Current GA4 total\nUsers 10 Sum of daily users\nConversions 1.5\nRevenue EUR 100.00 Total across revenue sources\nWhat to investigate next";
    expect(checkReportDetailText(snapshot, text, "insights", now).every(c => c.status === "passed")).toBe(true);
    for (const altered of [text.replace("DAYS OF DATA\n0", "DAYS OF DATA\n1"), text + "\n2026-11-04 20 EUR 100.00 1.5"]) {
      expect(checkReportDetailText(snapshot, altered, "insights", now)).toContainEqual(expect.objectContaining({ code: "INSIGHTS_TREND_DATES", status: "unverified" }));
    }
    snapshot.campaign.createdAt = "2026-11-04";
    expect(checkReportDetailText(snapshot, text, "insights", now)).toContainEqual(expect.objectContaining({ code: "INSIGHTS_TREND_DATES", status: "unverified" }));
  });
  it("checks the separate Trend website table", () => {
    const text = "Website Engagement & Conversion Summary\nSESSIONS\n20\nENGAGED SESSIONS\n10\nCONVERSIONS\n1.5\nENGAGEMENT RATE\n50.0%\nCONVERSIONS PER 100 SESSIONS\n7.5\nExecutive Recommendations";
    expect(checkReportDetailText(fixture(), text, "trend-analysis", now).every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(fixture(), text.replace("50.0%", "75.0%"), "trend-analysis", now)).toContainEqual(expect.objectContaining({ code: "WEBSITE_ENGAGEMENT_RATE_0", status: "difference" }));
  });
  it("checks individual spend-source amounts even when the headline total is unchanged", () => {
    const snapshot = fixture(); snapshot.rows.spendSources[0].displayName = "CSV spend";
    expect(checkReportDetailText(snapshot, "Spend Sources\nCSV spend €40.00", "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "SPEND_SOURCE_AMOUNT", status: "passed" }));
    expect(checkReportDetailText(snapshot, "Spend Sources\nCSV spend €41.00", "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "SPEND_SOURCE_AMOUNT", status: "difference" }));
    snapshot.rows.spendRecords[0].spend = "-40";
    expect(checkReportDetailText(snapshot, "Spend Sources\nCSV spend -€40.00", "financial-analysis", now)).toContainEqual(expect.objectContaining({ code: "SPEND_SOURCE_AMOUNT", status: "passed" }));
  });
  it("checks health and target exceptions instead of trusting their displayed labels", () => {
    const snapshot = fixture(); snapshot.rows.kpis = [{ id: "k", name: "Sessions", metric: "sessions", platformType: "google_analytics", applyTo: "all", targetValue: "25", unit: "count" }];
    const performance = "Campaign Health\n0% - Critical; 0 of 1 configured metrics on track.\nTop Priority Action";
    expect(checkReportDetailText(snapshot, performance, "performance-summary", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_HEALTH", status: "passed" }));
    expect(checkReportDetailText(snapshot, performance.replace("0% - Critical", "100% - Excellent"), "performance-summary", now)).toContainEqual(expect.objectContaining({ code: "CAMPAIGN_HEALTH", status: "difference" }));
    const executive = "KPI Exceptions\nSessions Below Target\nCurrent 20; Target 25; 80.0%\nBenchmark Exceptions\nBenchmark Status Unavailable:\nRisk Assessment";
    expect(checkReportDetailText(snapshot, executive, "executive-summary", now).every(check => check.status === "passed")).toBe(true);
    expect(checkReportDetailText(snapshot, executive.replace("Below Target", "On Track"), "executive-summary", now)).toContainEqual(expect.objectContaining({ code: "KPI_EXCEPTION_STATUS", status: "difference" }));
    expect(checkReportDetailText(snapshot, executive.replace("Current 20", "Current 21"), "executive-summary", now)).toContainEqual(expect.objectContaining({ code: "KPI_EXCEPTION_VALUES", status: "difference" }));
  });
});

describe("isolated handler SQL barrier", () => {
  it("allows only the three existing bounded publication-read timeouts", () => {
    for (const sql of ["SET LOCAL lock_timeout = '10s'", "SET LOCAL statement_timeout = '30s'", "SET LOCAL idle_in_transaction_session_timeout = '30s'"]) expect(monitorReadQueryAllowed(sql)).toBe(true);
    for (const sql of ["SET LOCAL statement_timeout = '0'", "SET LOCAL transaction_read_only = off", "SET LOCAL lock_timeout = '10s'; DELETE FROM campaigns", "SET LOCAL statement_timeout = '60s'"]) expect(monitorReadQueryAllowed(sql)).toBe(false);
  });
  it.each(["SELECT * FROM campaigns WHERE id=$1", 'select "campaigns"."id" from "campaigns"', "BEGIN", "set transaction isolation level repeatable read read only", "COMMIT", "ROLLBACK"])("permits required reads/transactions: %s", sql => expect(monitorReadQueryAllowed(sql)).toBe(true));
  it.each(["UPDATE campaigns SET name='bad'", "DELETE FROM campaigns", "INSERT INTO campaigns VALUES (1)", "BEGIN READ WRITE", "SET default_transaction_read_only=off", "SELECT set_config('transaction_read_only','off',false)", "SELECT 1; DELETE FROM campaigns", "SELECT 1 /* hidden */", "RESET ALL", "SELECT 1 -- hidden"])("blocks mutations and guard bypasses: %s", sql => expect(monitorReadQueryAllowed(sql)).toBe(false));
});

describe("output report network boundary", () => {
  it("changes only authorization on the already scoped provider read", () => {
    const input = { method: "POST", body: '{"currencyCode":"EUR","dateRanges":[]}', headers: { Authorization: "Bearer old", "Content-Type": "application/json" } };
    const result = outputReportAuthorization(input, "fresh");
    expect(result.body).toBe(input.body); expect(result.method).toBe(input.method);
    expect(new Headers(result.headers).get("Authorization")).toBe("Bearer fresh");
    expect(new Headers(result.headers).get("Content-Type")).toBe("application/json");
    expect(input.headers.Authorization).toBe("Bearer old");
    expect(() => outputReportAuthorization(input, "")).toThrow("OUTPUT_REPORT_CREDENTIAL_UNAVAILABLE");
  });
  const url = new URL("https://analyticsdata.googleapis.com/v1beta/properties/123:runReport");
  const options = { method: "POST", body: JSON.stringify({ currencyCode: "EUR", dateRanges: [{ startDate: "2026-10-06", endDate: "2026-11-04" }] }) };
  it("reuses identical reads with independently consumable responses while retaining the sixty-query ceiling", async () => {
    const request = vi.fn(async () => new Response('{"value":123}'));
    const denied = () => { throw new Error("BLOCKED"); };
    const read = createOutputReportReader("123", "EUR", "fresh", request, denied);
    const responses = await Promise.all(Array.from({ length: 80 }, () => read(url, options)));
    expect(await Promise.all(responses.map(response => response.json()))).toEqual(Array.from({ length: 80 }, () => ({ value: 123 })));
    expect(request).toHaveBeenCalledTimes(1);
    for (let offset = 1; offset < 60; offset++) await read(url, { ...options, body: JSON.stringify({ ...JSON.parse(options.body), offset }) });
    expect(request).toHaveBeenCalledTimes(60);
    await expect(read(url, { ...options, body: JSON.stringify({ ...JSON.parse(options.body), offset: 60 }) })).rejects.toThrow("BLOCKED");
    expect(await (await read(url, options)).json()).toEqual({ value: 123 });
    expect(request).toHaveBeenCalledTimes(60);
    await expect(read(url, { ...options, body: options.body.replace("EUR", "USD") })).rejects.toThrow("BLOCKED");
    await expect(read(new URL(url.href.replace("123", "456")), options)).rejects.toThrow("BLOCKED");
    await expect(read(url, { ...options, method: "DELETE" })).rejects.toThrow("BLOCKED");
    await expect(read(new Request(url, options))).rejects.toThrow("BLOCKED");
  });
  it("does not turn provider errors into successful data or share responses between runs", async () => {
    const request = vi.fn(async () => new Response("unavailable", { status: 503 }));
    const denied = () => { throw new Error("BLOCKED"); };
    for (let run = 0; run < 2; run++) {
      const read = createOutputReportReader("123", "EUR", "fresh", request, denied);
      expect((await read(url, options)).status).toBe(503);
      expect((await read(url, options)).ok).toBe(false);
    }
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("allows only the selected property's currency-qualified fixed-date report read", () => expect(outputReportReadAllowed(url, options, "123", "EUR")).toBe(true));
  it("blocks another property, currency, operation, relative window and credential renewal", () => {
    expect(outputReportReadAllowed(url, options, "456", "EUR")).toBe(false);
    expect(outputReportReadAllowed(url, options, "123", "USD")).toBe(false);
    expect(outputReportReadAllowed(new URL("https://analyticsdata.googleapis.com/v1beta/properties/123:delete"), options, "123", "EUR")).toBe(false);
    expect(outputReportReadAllowed(url, { ...options, body: options.body.replace("2026-10-06", "30daysAgo") }, "123", "EUR")).toBe(false);
    expect(outputReportReadAllowed(new URL("https://oauth2.googleapis.com/token"), options, "123", "EUR")).toBe(false);
  });
  it("does not replay or claim coverage without a pinned deployed app", async () => {
    expect(await checkApplicationOutputProcess("a".repeat(12), "b".repeat(64), "c".repeat(64)))
      .toEqual([{ section: "Application outputs", code: "DEPLOYED_APPLICATION_REVISION_UNVERIFIED", status: "unverified" }]);
  });
});
