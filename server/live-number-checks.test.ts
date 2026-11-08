import { describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { checkStoredNumbers, compareNumber, resolveMonitorScope, snapshotFingerprint, summarizeNumberChecks, type LiveNumberSnapshot } from "./live-number-checks";
import { checkFinancialProviderNumbers, checkPipelineProviderNumbers, compareProviderRows, googleMonitorCredential, monitorCredential, readFinancialSourceValues } from "./live-number-provider-checks";
import { liveNumberCheckIsDue, liveNumberConfigSchema, readOnlyMonitorDatabaseUrl, readOnlyMonitorFetch } from "../scripts/check-live-numbers";
import * as insightCalculations from "../shared/ga4-insights";
import * as kpiCalculations from "../shared/ga4-kpi-live-value";
import * as alertCalculations from "./utils/alert-decision";
import * as trendCalculations from "../client/src/lib/trend-analysis-cumulative";
import { attachReportVerification, createReportPdfArtifact } from "./utils/report-pdf-artifact";
import { ga4VerificationInputHash } from "./ga4-source-verification";

const now = new Date("2026-11-05T13:30:00Z");

describe("read-only Pipeline Proxy source reconciliation", () => {
  const setup = (provider = "hubspot") => {
    const snapshot = fixture();
    snapshot.rows[provider === "hubspot" ? "hubspotConnections" : "salesforceConnections"] = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", instanceUrl: "https://tenant.my.salesforce.com" }];
    const cfg = { pipelineEnabled: true, pipelineProxyMode: "current_stage", pipelineStageId: "open", pipelineStageName: "Open", pipelineLastUpdatedAt: "2026-11-05T13:00:00Z",
      pipelineTotalToDate: 12.5, pipelineCurrency: "EUR", pipelineValueRevenueTotals: [{ campaignValue: "selected", revenue: 12.5 }], selectedValues: ["selected"],
      campaignProperty: "campaign", revenueProperty: "amount", campaignField: "Campaign__c", revenueField: "Amount" };
    snapshot.rows.revenueSources = [{ id: "pipeline-source", campaignId: "campaign-a", sourceType: provider, isActive: true, platformContext: "ga4", currency: "EUR", mappingConfig: cfg }];
    return { snapshot, cfg };
  };
  it("checks the selected current stage separately from confirmed revenue", async () => {
    const { snapshot, cfg } = setup();
    const request = vi.fn(async () => new Response(JSON.stringify({ total: 1, results: [{ id: "deal", properties: { campaign: "selected", dealstage: "open", amount: "12.50", deal_currency_code: "EUR" } }] })));
    expect((await checkPipelineProviderNumbers(snapshot, request)).every(check => check.status === "passed")).toBe(true);
    const body = JSON.parse((request.mock.calls[0] as any)[1].body);
    expect(body.filterGroups[0].filters).toEqual([{ propertyName: "campaign", operator: "IN", values: ["selected"] }, { propertyName: "dealstage", operator: "IN", values: ["open"] }]);
    cfg.pipelineTotalToDate = 20;
    expect(await checkPipelineProviderNumbers(snapshot, request)).toContainEqual(expect.objectContaining({ code: "CURRENT_STAGE_TOTAL", status: "difference" }));
    expect(request.mock.calls.every(call => (call as any)[0] === "https://api.hubapi.com/crm/v3/objects/deals/search")).toBe(true);
  });
  it.each(["stage", "currency", "campaign", "duplicate", "incomplete"])("rejects %s provider evidence", async problem => {
    const { snapshot } = setup();
    const deal = { id: "deal", properties: { campaign: problem === "campaign" ? "other" : "selected", dealstage: problem === "stage" ? "won" : "open", amount: "12.50", deal_currency_code: problem === "currency" ? "USD" : "EUR" } };
    const request = vi.fn(async () => new Response(JSON.stringify({ total: problem === "incomplete" || problem === "duplicate" ? 2 : 1, results: problem === "duplicate" ? [deal, deal] : [deal] })));
    expect((await checkPipelineProviderNumbers(snapshot, request)).some(check => check.status === "unverified")).toBe(true);
  });
  it("scopes Salesforce reads and rejects invalid fields before sending", async () => {
    const { snapshot, cfg } = setup("salesforce");
    const request = vi.fn(async () => new Response(JSON.stringify({ totalSize: 1, done: true, records: [{ Id: "opp", Campaign__c: "selected", StageName: "Open", Amount: 12.5, CurrencyIsoCode: "EUR" }] })));
    expect((await checkPipelineProviderNumbers(snapshot, request)).every(check => check.status === "passed")).toBe(true);
    expect(new URL((request.mock.calls[0] as any)[0]).searchParams.get("q")).toContain("StageName = 'Open' AND Campaign__c IN ('selected')");
    cfg.campaignField = "Id FROM User";
    expect(await checkPipelineProviderNumbers(snapshot, request)).toContainEqual(expect.objectContaining({ code: "PIPELINE_MAPPING_UNVERIFIED", status: "unverified" }));
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("requires proven single currency for a Salesforce pipeline fallback (multi=%s)", async multi => {
    const { snapshot } = setup("salesforce");
    const raw = vi.fn(async (url: any) => {
      if (String(url).includes("/Soap/")) return new Response(`<getUserInfoResponse><result><organizationMultiCurrency>${multi}</organizationMultiCurrency><orgDefaultCurrencyIsoCode>EUR</orgDefaultCurrencyIsoCode></result></getUserInfoResponse>`);
      if (new URL(url).searchParams.get("q")?.includes("CurrencyIsoCode")) return new Response(JSON.stringify([{ errorCode: "INVALID_FIELD", message: "No such column 'CurrencyIsoCode' on entity Opportunity" }]), { status: 400 });
      return new Response(JSON.stringify({ records: [{ Id: "opp", Campaign__c: "selected", StageName: "Open", Amount: 12.5 }], totalSize: 1, done: true }));
    });
    const checks = await checkPipelineProviderNumbers(snapshot, readOnlyMonitorFetch(raw));
    expect(checks.every(check => check.status === "passed")).toBe(!multi);
    expect(raw).toHaveBeenCalledTimes(multi ? 2 : 3);
  });
  it("never treats a Salesforce permissions error as missing currency metadata", async () => {
    const { snapshot } = setup("salesforce");
    const request = vi.fn(async () => new Response(JSON.stringify([{ errorCode: "INSUFFICIENT_ACCESS", message: "private provider detail" }]), { status: 403 }));
    const checks = await checkPipelineProviderNumbers(snapshot, request);
    expect(checks.every(check => check.status === "unverified")).toBe(true);
    expect(JSON.stringify(checks)).not.toContain("private provider detail");
    expect(request).toHaveBeenCalledTimes(1);
  });
});

const fixture = (): LiveNumberSnapshot => {
  const snapshot: LiveNumberSnapshot = {
  campaign: { id: "campaign-a", ownerId: "owner-a", clientId: "client-a", status: "active", currency: "EUR",
    reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["campaign-utm"]' },
  rows: {
    ga4Connections: [{ id: "connection-a", campaignId: "campaign-a", propertyId: "123", isActive: true, isPrimary: true, importStartDate: "2026-11-03" }],
    ga4OverviewSnapshots: [{ campaignId: "campaign-a", propertyId: "123", windowStart: "2026-11-03", windowEnd: "2026-11-04",
      campaignBreakdown: { meta: { propertyId: "123", currencyCode: "EUR" }, totals: { sessions: 20, users: 12, conversions: 1.5, revenue: 100 },
        rows: [{ campaign: "campaign-utm" }] } }],
    ga4DailyMetrics: ["2026-11-03", "2026-11-04"].map(date => ({ id: date, campaignId: "campaign-a", propertyId: "123", date,
      sessions: 10, users: 8, pageviews: 15, conversions: 0.75, revenue: "50.00", engagedSessions: 5, isSimulated: false })),
    revenueSources: [], revenueRecords: [], spendSources: [{ id: "spend-a", campaignId: "campaign-a", sourceType: "csv", currency: "EUR", isActive: true,
      mappingConfig: JSON.stringify({ spendColumn: "Amount", dateColumn: "Date", storedDateColumn: "Date", csvRowCount: 1,
        csvStoredSpendRows: [{ spendRaw: "100", dateRaw: "2026-11-04" }] }) }],
    spendRecords: [{ id: "record-a", campaignId: "campaign-a", spendSourceId: "spend-a", spend: "100.00", currency: "EUR", date: "2026-11-04" }],
    kpis: [{ id: "kpi-a", campaignId: "campaign-a", platformType: "google_analytics", applyTo: "all", metric: "Total Sessions", currentValue: "20" }],
    benchmarks: [{ id: "benchmark-a", campaignId: "campaign-a", platformType: "google_analytics", applyTo: "all", metric: "conversions", currentValue: "1.5" }],
    metricSnapshots: [{ id: "financial-a", campaignId: "campaign-a", snapshotType: "financial_daily", reportingDate: "2026-11-04", metrics: { financialDaily: {
      version: "financial_daily_snapshot_v1", campaignId: "campaign-a", reportingDate: "2026-11-04", currency: "EUR",
      currentValueWindow: { mode: "initial_import_to_latest_completed_day", startDate: "2026-11-03", endDate: "2026-11-04", dataThroughDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" },
      inputs: { revenue: { available: true, value: "100.00", sources: ["ga4"] }, spend: { available: true, value: "100.00", sources: ["spend-a"] },
        conversions: { available: true, value: 1.5, sources: ["ga4"] } },
    } } }], reportSnapshots: [], linkedinReports: [], ga4RefreshWork: [],
  },
};
  const totals = Object.fromEntries(Object.entries({ users: 16, sessions: 20, conversions: 1.5, revenue: 100, spend: 100,
    cvr: 7.5, cpa: 66.67, roas: 1, roi: 0 }).map(([key, value]) => [key, { value, available: true, sources: ["ga4"] }]));
  const window = snapshot.rows.metricSnapshots[0].metrics.financialDaily.currentValueWindow;
  snapshot.rows.metricSnapshots.push({ id: "executive-a", campaignId: "campaign-a", snapshotType: "executive_summary_daily", reportingDate: "2026-11-04", metrics: { executiveSummaryDaily: {
    version: "executive_summary_daily_snapshot_v2", currency: "EUR", ga4PropertyId: "123", ga4CampaignFilter: '["campaign-utm"]',
    performanceSummaryVersion: "performance_summary_aggregate_v3", currentValueWindow: window, sourceSignature: ["ga4"], totals,
  } } });
  snapshot.rows.metricSnapshots.push({ id: "sync-a", campaignId: "campaign-a", snapshotType: "platform_sync", recordedAt: now,
    metrics: { performanceSummary: { currentValueWindow: window, totals } } });
  return snapshot;
};

describe("live-number comparisons", () => {
  it.each(["valid", "overdue", "hash", "owner", "property", "invalidated", "old", "refresh", "damaged", "missing"])("allows absent new-campaign summaries only with exact pre-schedule evidence: %s", problem => {
    const snapshot = fixture(); snapshot.campaign.createdAt = "2026-11-05T13:05:00Z";
    snapshot.rows.metricSnapshots = [];
    const proof = { connectionId: "connection-a", propertyId: "123", startDate: "2026-11-03", endDate: "2026-11-04", comparedValues: 20,
      checkedAt: "2026-11-05T13:10:00Z", inputHash: ga4VerificationInputHash(snapshot.rows.ga4OverviewSnapshots[0], snapshot.rows.ga4DailyMetrics) };
    const work = { campaignId: snapshot.campaign.id, status: "completed", completedAt: "2026-11-05T13:10:01Z", reportingDate: "2026-11-04", scopeHash: "valid",
      scope: { kind: "initial_import", campaign: { ...snapshot.campaign }, initialImportVerification: { version: 1, properties: [proof] } } };
    snapshot.rows.ga4RefreshWork = [work];
    if (problem === "hash") proof.inputHash = "wrong";
    if (problem === "owner") work.scope.campaign.ownerId = "foreign";
    if (problem === "property") proof.propertyId = "456";
    if (problem === "invalidated") work.scopeHash = "invalidated:old";
    if (problem === "old") work.completedAt = "2026-11-05T12:00:00Z";
    if (problem === "refresh") snapshot.rows.ga4RefreshWork.push({ scope: {}, startedAt: now });
    if (problem === "damaged") snapshot.rows.metricSnapshots.push({ snapshotType: "executive_summary_daily" }, { snapshotType: "platform_sync" });
    if (problem === "missing") snapshot.rows.ga4RefreshWork = [];
    const checks = checkStoredNumbers(snapshot, problem === "overdue" ? new Date("2026-11-05T19:00:00Z") : now)
      .filter(c => ["Executive Summary", "Performance Summary"].includes(c.section));
    expect(checks).toHaveLength(2);
    expect(checks.every(c => c.status === (problem === "valid" ? "passed" : "unverified"))).toBe(true);
    if (problem === "valid") expect(checks.every(c => c.code === "FIRST_SCHEDULED_SNAPSHOT_NOT_YET_DUE")).toBe(true);
  });
  it("verifies a saved report after its definition is retired, while preserving legacy and altered-input findings", () => {
    const snapshot = fixture(), pdf = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(128, 65)]);
    const report = { id: "retired-report", campaignId: snapshot.campaign.id, platformType: "google_analytics", reportType: "overview", configuration: {} };
    const window = { startDate: "2026-11-03", endDate: "2026-11-04" };
    const artifact = createReportPdfArtifact(attachReportVerification(Buffer.from(pdf), { report, reportWindow: window,
      scope: { campaignId: snapshot.campaign.id, currency: "EUR", reportingTimeZone: "Europe/Amsterdam" },
      financial: {}, summary: {}, trafficWindow: window, sourceSettings: { revenue: [], spend: [] } })!);
    const payload = { reportId: report.id, campaignId: report.campaignId, platformType: report.platformType, reportType: report.reportType,
      windowStart: window.startDate, windowEnd: window.endDate, pdfArtifact: artifact };
    const row = { id: "saved-report", ...payload, snapshotJson: JSON.stringify(payload) }; snapshot.rows.reportSnapshots = [row];
    expect(checkStoredNumbers(snapshot, now).filter(c => c.section === "Reports").map(c => c.status)).toEqual(["passed", "passed"]);
    artifact!.verification!.inputs.scope.currency = "USD"; row.snapshotJson = JSON.stringify(payload);
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: "SAVED_ARTIFACT_INVALID", status: "difference" }));
    row.snapshotJson = JSON.stringify({ ...payload, pdfArtifact: createReportPdfArtifact(pdf) });
    expect(checkStoredNumbers(snapshot, now).filter(c => c.section === "Reports" && c.status === "unverified").map(c => c.code))
      .toEqual(["REPORT_DEFINITION_RETIRED", "HISTORICAL_SOURCE_SETTINGS_NOT_RECORDED"]);
  });
  it("verifies saved summary inputs in their actual window without changing its calculations", () => {
    const snapshot = fixture(), sync = snapshot.rows.metricSnapshots.find(r => r.snapshotType === "platform_sync")!;
    delete sync.metrics.performanceSummary.currentValueWindow;
    sync.metrics.performanceSummaryVerification = { version: 1, campaignId: snapshot.campaign.id, propertyId: "123", currency: "EUR",
      campaignFilter: snapshot.campaign.ga4CampaignFilter, trafficWindow: { startDate: "2026-08-06", endDate: "2026-11-05" },
      nativeFinancialWindow: { startDate: "2026-11-03", endDate: "2026-11-04", reportingTimeZone: "Europe/Amsterdam" },
      importedFinancialWindow: { startDate: "1900-01-01", endDate: "2026-11-04" }, trafficRows: snapshot.rows.ga4DailyMetrics,
      nativeRevenue: 100, revenueSources: [], spend: 100, spendSourceIds: ["spend-a"], fallbackSpend: 0,
      financialConversions: { value: 2, available: true } };
    sync.metrics.performanceSummary.totals.cpa = { value: 50, available: true };
    expect(checkStoredNumbers(snapshot, now).filter(c => c.section === "Performance Summary" && c.status !== "passed")).toEqual([]);
    sync.metrics.performanceSummaryVerification.trafficRows = [{ date: "2026-11-04", sessions: 999, users: 16, conversions: 1.5 }];
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: "SAVED_INPUT_sessions", status: "difference" }));
    sync.metrics.performanceSummaryVerification.campaignId = "other";
    expect(checkStoredNumbers(snapshot, now)).toContainEqual(expect.objectContaining({ code: "SAVED_INPUT_SCOPE", status: "unverified" }));
  });
  it("checks fractional credits and daily summed users without equating them to unique window users", () => {
    const before = fixture(), fingerprint = snapshotFingerprint(before);
    const checks = checkStoredNumbers(before, now);
    expect(checks.length).toBeGreaterThan(10);
    expect(checks.filter(check => check.status !== "passed")).toEqual([]);
    expect(snapshotFingerprint(before)).toBe(fingerprint);
  });
  it.each([null, undefined, "", " ", NaN, Infinity, true, "2EUR"])("does not turn unavailable input %s into zero", value => {
    expect(compareNumber("test", "count", value, 0).status).toBe("unverified");
  });
  it("does not use a percentage tolerance for money or small conversion credits", () => {
    expect(compareNumber("test", "revenue", 100000, 100000.01, { decimals: 2 }).status).toBe("difference");
    expect(compareNumber("test", "revenue", 1e13, 1e13 + 0.01, { decimals: 2 }).status).toBe("difference");
    expect(compareNumber("test", "revenue", 1e15, 1e15, { decimals: 2 }).status).toBe("unverified");
    expect(compareNumber("test", "conversions", 1e-12, 0, { conversions: true }).status).toBe("difference");
  });
  it.each([
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].propertyId = "999"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].campaignId = "other"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].campaignBreakdown.meta.currencyCode = "USD"; },
    (s: LiveNumberSnapshot) => { s.campaign.reportingTimeZone = "Invalid/Timezone"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4OverviewSnapshots[0].windowEnd = "2026-11-03"; },
    (s: LiveNumberSnapshot) => { s.rows.ga4Connections.push({ ...s.rows.ga4Connections[0], id: "second", propertyId: "456" }); },
    (s: LiveNumberSnapshot) => { s.campaign.ga4CampaignFilter = ""; },
  ])("rejects ambiguous/wrong semantic scope", change => {
    const s = fixture(); change(s);
    expect(() => resolveMonitorScope(s, now)).toThrow();
    expect(checkStoredNumbers(s, now)[0].status).toBe("unverified");
  });
  it("flags missing days and duplicated zero-activity dates", () => {
    const s = fixture(); s.rows.ga4DailyMetrics[1] = { ...s.rows.ga4DailyMetrics[0] };
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "DAILY_DATE_COVERAGE", status: "difference" }));
  });
  it("finds a KPI and financial snapshot propagation error", () => {
    const s = fixture(); s.rows.kpis[0].currentValue = "999";
    s.rows.metricSnapshots[0].metrics.financialDaily.inputs.revenue.value = "101.00";
    const checks = checkStoredNumbers(s, now);
    expect(checks).toContainEqual(expect.objectContaining({ section: "kpis", status: "difference" }));
    expect(checks).toContainEqual(expect.objectContaining({ section: "Budget & Financial Analysis / Executive Summary", code: "revenue", status: "difference" }));
  });
  it("detects a corrupted Insights rollup rather than trusting the shared calculation", () => {
    const implementation = insightCalculations.buildGA4InsightsRollups;
    const spy = vi.spyOn(insightCalculations, "buildGA4InsightsRollups").mockImplementation((...args) => {
      const result = implementation(...args); result.last3.sessions += 1; return result;
    });
    try {
      expect(checkStoredNumbers(fixture(), now)).toContainEqual(expect.objectContaining({ section: "Insights calculations", code: "last3_sessions", status: "difference" }));
    } finally { spy.mockRestore(); }
  });
  it("detects a missing month in the actual Insights series", () => {
    const spy = vi.spyOn(insightCalculations, "buildGA4InsightsMonthlySeries").mockReturnValue([]);
    try {
      expect(checkStoredNumbers(fixture(), now)).toContainEqual(expect.objectContaining({ code: "sessions_MONTH_COVERAGE", status: "difference" }));
    } finally { spy.mockRestore(); }
  });
  it("detects incorrect card/PDF calculation even when the saved KPI value is correct", () => {
    const spy = vi.spyOn(kpiCalculations, "resolveGA4KpiLiveValue").mockReturnValue("999");
    try {
      expect(checkStoredNumbers(fixture(), now)).toContainEqual(expect.objectContaining({ section: "kpis / PDF calculations", code: "CALCULATED_sessions", status: "difference" }));
    } finally { spy.mockRestore(); }
  });
  it("does not treat a partial calendar window as a complete Insights period", () => {
    expect(checkStoredNumbers(fixture(), now)).toContainEqual(expect.objectContaining({ code: "last7_CALENDAR_SCOPE", status: "passed" }));
    const s = fixture(); s.rows.ga4DailyMetrics.pop();
    expect(checkStoredNumbers(s, now).some(check => check.section === "Insights calculations")).toBe(false);
  });
  it("checks configured budget dates across the daylight-saving boundary", () => {
    const s = fixture(); s.campaign.pacingStartDate = "2026-10-24"; s.campaign.pacingEndDate = "2026-11-10";
    expect(checkStoredNumbers(s, now).filter(check => check.section === "Budget & Financial Analysis calculations")).toEqual([
      expect.objectContaining({ code: "BUDGET_PERIOD_DAYS", status: "passed" }), expect.objectContaining({ code: "BUDGET_ELAPSED_DAYS", status: "passed" }),
    ]);
  });
  it("detects an incorrect Trend financial ratio from the displayed-value helper", () => {
    const implementation = trendCalculations.deriveTrendFinancialRatios;
    const spy = vi.spyOn(trendCalculations, "deriveTrendFinancialRatios").mockImplementation(input => ({ ...implementation(input), roas: 9 }));
    try {
      expect(checkStoredNumbers(fixture(), now)).toContainEqual(expect.objectContaining({ section: "Trend Analysis calculations", code: "roas", status: "difference" }));
    } finally { spy.mockRestore(); }
  });
  it("checks thresholds and catches an alert decision that ignores unavailable data", () => {
    const s = fixture(); Object.assign(s.rows.kpis[0], { alertsEnabled: true, alertThreshold: "10", alertCondition: "above", targetValue: "40" });
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "THRESHOLD_COMPARISON", status: "passed" }));
    const spy = vi.spyOn(alertCalculations, "isAlertDecisionBreached").mockReturnValue(true);
    try {
      expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "UNAVAILABLE_INPUT_BLOCKED", status: "difference" }));
    } finally { spy.mockRestore(); }
  });
  it("catches a one-cent ROAS display difference at the half-cent boundary", () => {
    expect(compareNumber("Performance Summary", "roas", 28501.5 / 100, 285.01, { decimals: 2 }).status).toBe("difference");
    expect(compareNumber("Performance Summary", "roas", 28501.5 / 100, 285.02, { decimals: 2 }).status).toBe("passed");
  });
  it("checks Performance Summary inputs only when its full reporting window matches", () => {
    const s = fixture(), summary = s.rows.metricSnapshots[2].metrics.performanceSummary;
    summary.totals = structuredClone(summary.totals);
    summary.totals.sessions.value = 21;
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ section: "Performance Summary", code: "INPUT_sessions", status: "difference" }));
    summary.currentValueWindow = { ...summary.currentValueWindow, startDate: "2026-11-01" };
    const checks = checkStoredNumbers(s, now);
    expect(checks).toContainEqual(expect.objectContaining({ section: "Performance Summary", code: "SAVED_SOURCE_WINDOW_UNVERIFIED", status: "unverified" }));
    expect(checks.some(check => check.code === "INPUT_sessions")).toBe(false);
  });
  it("does not double count aggregate and attributed revenue grains", () => {
    const s = fixture(); s.rows.spendRecords.push({ ...s.rows.spendRecords[0], id: "attributed", subCampaignUrn: "sub-a" });
    expect(checkStoredNumbers(s, now).filter(c => c.status !== "passed")).toEqual([]);
  });
  it("flags duplicate materialized grains rather than silently summing them", () => {
    const s = fixture(); s.rows.spendRecords.push({ ...s.rows.spendRecords[0], id: "duplicate" });
    expect(checkStoredNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "DUPLICATE_MATERIALIZED_GRAIN", status: "difference" }));
  });
  it("does not reuse a prior result after source edits, deletion or a concurrent refresh", () => {
    const s = fixture(), before = snapshotFingerprint(s); s.rows.spendSources[0].isActive = false;
    expect(snapshotFingerprint(s)).not.toBe(before);
    expect(summarizeNumberChecks("aaaaaaaaaaaa", checkStoredNumbers(fixture(), now), false).status).toBe("unverified");
  });
  it("cannot pass an empty check list or any unverified check", () => {
    expect(summarizeNumberChecks("aaaaaaaaaaaa", [], true).status).toBe("unverified");
    expect(summarizeNumberChecks("aaaaaaaaaaaa", [{ section: "test", code: "AUTH_FAILED", status: "unverified" }], true).status).toBe("unverified");
  });
  it("compares rows by complete dimensional keys, independent of order", () => {
    const rows = [{ date: "2026-11-03", revenue: 1 }, { date: "2026-11-04", revenue: 2 }];
    expect(compareProviderRows("test", rows, [...rows].reverse(), ["date"], ["revenue"]).every(c => c.status === "passed")).toBe(true);
    expect(compareProviderRows("test", rows, [rows[0]], ["date"], ["revenue"])).toContainEqual(expect.objectContaining({ code: "SOURCE_ROW_DIFFERENCE" }));
    expect(compareProviderRows("test", rows, [rows[0], rows[0]], ["date"], ["revenue"])[0].status).toBe("unverified");
  });
});

describe("source reads", () => {
  it("compares the complete saved CSV, not preview rows, and performs no requests", async () => {
    const s = fixture(), request = vi.fn();
    expect((await checkFinancialProviderNumbers(s, now, request as any)).every(c => c.status === "passed")).toBe(true);
    expect(request).not.toHaveBeenCalled();
    s.rows.spendRecords[0].spend = "200";
    expect(await checkFinancialProviderNumbers(s, now, request as any)).toContainEqual(expect.objectContaining({ code: "SOURCE_value", status: "difference" }));
  });
  it("rejects truncated CSV history and unsupported providers explicitly", async () => {
    const s = fixture(), config = JSON.parse(s.rows.spendSources[0].mappingConfig); config.csvRowCount = 2;
    s.rows.spendSources[0].mappingConfig = JSON.stringify(config);
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "CSV_ORIGINAL_ROWS_UNVERIFIED", status: "unverified" }));
    s.rows.spendSources[0].sourceType = "unknown";
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "PROVIDER_ADAPTER_NOT_VERIFIED" }));
  });
  it("does not hide a source amount rounding difference before comparison", async () => {
    const s = fixture(), config = JSON.parse(s.rows.spendSources[0].mappingConfig);
    config.csvStoredSpendRows[0].spendRaw = "100.005";
    s.rows.spendSources[0].mappingConfig = JSON.stringify(config);
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "SOURCE_value", status: "difference" }));
    s.rows.spendRecords[0].spend = "100.01";
    expect((await checkFinancialProviderNumbers(s, now)).every(check => check.status === "passed")).toBe(true);
  });
  it.each(["storedSpendColumn", "storedDateColumn", "storedCampaignColumn"])("rejects a CSV whose %s disagrees with the selected mapping", async key => {
    const s = fixture(), config = JSON.parse(s.rows.spendSources[0].mappingConfig);
    config[key] = "different original column";
    s.rows.spendSources[0].mappingConfig = JSON.stringify(config);
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "CSV_ORIGINAL_MAPPING_UNVERIFIED", status: "unverified" }));
  });
  it("does not invent a campaign column when the original CSV explicitly had none", async () => {
    const s = fixture(), config = JSON.parse(s.rows.spendSources[0].mappingConfig);
    s.rows.spendSources[0].mappingConfig = JSON.stringify({ ...config, storedCampaignColumn: null, campaignColumn: "New column", campaignValues: ["selected"] });
    expect(await checkFinancialProviderNumbers(s, now)).toContainEqual(expect.objectContaining({ code: "CSV_ORIGINAL_MAPPING_UNVERIFIED", status: "unverified" }));
  });
  it("never renews expired credentials or falls back from failed decryption to plaintext", () => {
    expect(() => monitorCredential({ accessToken: "private", expiresAt: "2000-01-01" })).toThrow("PROVIDER_CREDENTIAL_UNAVAILABLE");
    expect(() => monitorCredential({ accessToken: "private", encryptedTokens: { v: 1, accessToken: {} } })).toThrow("PROVIDER_CREDENTIAL_UNAVAILABLE");
  });
  it("obtains Google read access in memory without changing the saved credential", async () => {
    const connection = { isActive: true, accessToken: "old", expiresAt: "2000-01-01", refreshToken: "refresh", clientId: "client", clientSecret: "secret" };
    const before = JSON.stringify(connection);
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ access_token: "new", expires_in: 3600 })));
    expect(await googleMonitorCredential(connection, request)).toBe("new");
    expect(JSON.stringify(connection)).toBe(before);
    expect(request.mock.calls[0][0]).toBe("https://oauth2.googleapis.com/token");
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ redirect: "error", method: "POST" }));
  });
  it("checks a Sheets mapping using only GET and rejects mismatched tabs", async () => {
    const s = fixture(), source = { id: "sheet-a", campaignId: "campaign-a", sourceType: "google_sheets", currency: "EUR", mappingConfig: JSON.stringify({
      spreadsheetId: "sheet-id", sheetName: "Revenue", revenueColumn: "Amount", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["selected"],
    }) };
    s.rows.googleSheetsConnections = [{ id: "connection", isActive: true, campaignId: "campaign-a", spreadsheetId: "sheet-id", sheetName: "Revenue", accessToken: "private" }];
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ values: [["Amount", "Date", "Campaign"], ["50", "2026-11-04", "selected"], ["9000", "2026-11-04", "other"]] })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual([{ date: "2026-11-04", value: 50 }]);
    expect(request.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "GET", redirect: "error" }));
    s.rows.googleSheetsConnections[0].sheetName = "Other";
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("SHEET_SCOPE_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it("treats HTTP failure as unverified, not a zero matching empty records", async () => {
    const s = fixture(); s.rows.revenueSources = [{ id: "sheet-a", campaignId: "campaign-a", isActive: true, sourceType: "google_sheets", currency: "EUR",
      mappingConfig: JSON.stringify({ spreadsheetId: "sheet-id", sheetName: "Revenue", revenueColumn: "Amount", dateColumn: "Date" }) }];
    s.rows.googleSheetsConnections = [{ isActive: true, campaignId: "campaign-a", spreadsheetId: "sheet-id", sheetName: "Revenue", accessToken: "private" }];
    const request = vi.fn().mockResolvedValue(new Response("secret body", { status: 429 }));
    const checks = await checkFinancialProviderNumbers(s, now, request);
    expect(checks).toContainEqual(expect.objectContaining({ code: "PROVIDER_REQUEST_FAILED", status: "unverified" }));
    expect(JSON.stringify(checks)).not.toContain("secret");
  });
  it("reads scoped HubSpot deals, rejects duplicate pages and never requests a connection refresh", async () => {
    const s = fixture(); s.rows.hubspotConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private" }];
    const source = { campaignId: "campaign-a", currency: "EUR", sourceType: "hubspot", mappingConfig: JSON.stringify({ dailyMaterialization: "selected_date_field_v1",
      lastSyncedAt: "2026-11-05T13:00:00Z", days: 30, selectedValues: ["selected"], stageIds: ["won"], dateField: "closedate", campaignProperty: "campaign", revenueProperty: "amount" }) };
    const row = { id: "deal-a", properties: { closedate: "2026-11-04", campaign: "selected", amount: "12.50", dealstage: "won", deal_currency_code: "EUR" } };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [row], total: 1 })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 12.5 }] });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request.mock.calls[0][0]).toBe("https://api.hubapi.com/crm/v3/objects/deals/search");
    expect(JSON.parse(request.mock.calls[0][1].body).filterGroups[0].filters).toContainEqual({ propertyName: "campaign", operator: "IN", values: ["selected"] });
    request.mockResolvedValue(new Response(JSON.stringify({ results: [row, row], total: 2 })));
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow();
  });
  it("reads scoped Salesforce opportunity dates/currencies and rejects hostile fields before requesting", async () => {
    const s = fixture(); s.rows.salesforceConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", instanceUrl: "https://tenant.my.salesforce.com" }];
    const mapping = { dailyMaterialization: "selected_date_field_v1", lastSyncedAt: "2026-11-05T13:00:00Z", days: 30,
      selectedValues: ["selected"], dateField: "CloseDate", campaignField: "Campaign__c", revenueField: "Amount" };
    const source = { campaignId: "campaign-a", currency: "EUR", sourceType: "salesforce", mappingConfig: JSON.stringify(mapping) };
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ records: [{ Id: "opp-a", Campaign__c: "selected", CloseDate: "2026-11-04", Amount: 20, CurrencyIsoCode: "EUR" }], done: true, totalSize: 1 })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 20 }] });
    expect(new URL(request.mock.calls[0][0]).searchParams.get("q")).toContain("Campaign__c IN ('selected')");
    source.mappingConfig = JSON.stringify({ ...mapping, campaignField: "Id FROM User" });
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("CRM_MAPPING_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each(["EUR", "USD", ""])("verifies HubSpot account currency %s when a deal omits its currency", async currency => {
    const s = fixture(); s.rows.hubspotConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private" }];
    const source = { campaignId: "campaign-a", sourceType: "hubspot", currency: "EUR", mappingConfig: JSON.stringify({
      dailyMaterialization: "selected_date_field_v1", lastSyncedAt: "2026-11-05T13:00:00Z", days: 30, selectedValues: ["selected"],
      stageIds: ["won"], dateField: "closedate", campaignProperty: "campaign", revenueProperty: "amount" }) };
    const request = vi.fn(async (url: any) => new Response(JSON.stringify(String(url).endsWith("/details") ? { companyCurrency: currency }
      : { results: [{ id: "deal", properties: { campaign: "selected", dealstage: "won", closedate: "2026-11-04", amount: "12.50" } }], total: 1 })));
    if (currency === "EUR") expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 12.5 }] });
    else await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("CRM_RESPONSE_SCOPE_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(2);
  });
  it("checks intentionally empty CRM imports, but never gives an undated nonzero import the same exception", async () => {
    const s = fixture(); s.rows.hubspotConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private" }];
    const mapping = { mode: "revenue_to_date", lastTotalRevenue: 0, dailyMaterialization: null, valueSource: "revenue",
      lastSyncedAt: "2026-11-05T13:00:00Z", days: 30, selectedValues: ["selected"], stageIds: ["won"],
      dateField: "closedate", campaignProperty: "campaign", revenueProperty: "amount" };
    const source = { id: "empty", isActive: true, campaignId: "campaign-a", sourceType: "hubspot", currency: "EUR", mappingConfig: JSON.stringify(mapping) };
    s.rows.revenueSources = [source];
    s.rows.revenueRecords = [{ revenueSourceId: "empty", campaignId: "campaign-a", currency: "EUR", date: "2026-11-04", revenue: 0 }];
    const request = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [], total: 0 })));
    expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [] });
    s.rows.revenueRecords[0].revenue = 10;
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("CRM_SAVED_QUERY_WINDOW_UNVERIFIED");
    s.rows.revenueRecords[0].revenue = 0;
    source.mappingConfig = JSON.stringify({ ...mapping, valueSource: "conversion_value" });
    await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("SOURCE_CURRENCY_OR_DEFINITION_UNVERIFIED");
    expect(request).toHaveBeenCalledTimes(1);
  });
  it.each([false, true])("verifies Salesforce's single-currency flag instead of assuming its default (multi=%s)", async multi => {
    const s = fixture(); s.rows.salesforceConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", instanceUrl: "https://tenant.my.salesforce.com" }];
    const source = { campaignId: "campaign-a", sourceType: "salesforce", currency: "EUR", mappingConfig: JSON.stringify({
      dailyMaterialization: "selected_date_field_v1", lastSyncedAt: "2026-11-05T13:00:00Z", days: 30, selectedValues: ["selected"],
      dateField: "CloseDate", campaignField: "Campaign__c", revenueField: "Amount" }) };
    const raw = vi.fn(async (url: any) => {
      if (String(url).includes("/Soap/")) return new Response(`<getUserInfoResponse><result><organizationMultiCurrency>${multi}</organizationMultiCurrency><orgDefaultCurrencyIsoCode>EUR</orgDefaultCurrencyIsoCode></result></getUserInfoResponse>`);
      if (new URL(url).searchParams.get("q")?.includes("CurrencyIsoCode")) return new Response(JSON.stringify([{ errorCode: "INVALID_FIELD", message: "No such column 'CurrencyIsoCode' on entity Opportunity" }]), { status: 400 });
      return new Response(JSON.stringify({ records: [{ Id: "opp", Campaign__c: "selected", CloseDate: "2026-11-04", Amount: 20 }], totalSize: 1, done: true }));
    });
    const request = readOnlyMonitorFetch(raw);
    if (multi) await expect(readFinancialSourceValues(s, source, "revenue", request)).rejects.toThrow("SALESFORCE_ACCOUNT_CURRENCY_UNVERIFIED");
    else expect(await readFinancialSourceValues(s, source, "revenue", request)).toEqual({ startDate: "2026-10-07", values: [{ date: "2026-11-04", value: 20 }] });
    expect(raw).toHaveBeenCalledTimes(multi ? 2 : 3);
  });
  it("reads only selected paid Shopify orders and preserves separate order identities on one date", async () => {
    const s = fixture(); s.rows.shopifyConnections = [{ campaignId: "campaign-a", isActive: true, accessToken: "private", shopDomain: "test-store.myshopify.com" }];
    const source = { campaignId: "campaign-a", sourceType: "shopify", currency: "EUR", mappingConfig: JSON.stringify({ orderWindowStart: "2026-11-01T00:00:00Z",
      revenueMetric: "current_total_price", orderDateBasis: "created_at_campaign_reporting_timezone", currencyBasis: "shop_money_campaign_parity", selectedValues: ["selected"], campaignField: "tags" }) };
    const request = vi.fn(async (url: any) => String(url).includes("access_scopes") ? new Response(JSON.stringify({ access_scopes: [{ handle: "read_orders" }, { handle: "read_all_orders" }] }))
      : new Response(JSON.stringify({ orders: [{ id: 1, tags: "selected", test: false, financial_status: "paid", current_total_price: "10.00", currency: "EUR", created_at: "2026-11-04T10:00:00Z" },
        { id: 2, tags: "other", test: false, financial_status: "paid", current_total_price: "500.00", currency: "EUR", created_at: "2026-11-04T10:00:00Z" }] }), { headers: { "X-Shopify-API-Version": "2026-07" } }));
    expect(await readFinancialSourceValues(s, source, "revenue", request as any)).toEqual([{ date: "2026-11-04", value: 10 }]);
    expect(request).toHaveBeenCalledTimes(2);
  });
});

describe("operator safety", () => {
  it("permits only bounded read-only GA4 impersonation and never account creation or broader credentials", async () => {
    const raw = vi.fn(async () => new Response("{}")), request = readOnlyMonitorFetch(raw);
    const url = "https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/111:generateAccessToken";
    const body = { scope: ["https://www.googleapis.com/auth/analytics.readonly"], lifetime: "3600s" };
    await request(url, { method: "POST", body: JSON.stringify(body) });
    expect(raw).toHaveBeenCalledTimes(1); raw.mockClear();
    for (const payload of [{ ...body, scope: ["https://www.googleapis.com/auth/cloud-platform"] }, { ...body, delegates: ["another-account"] },
      { ...body, lifetime: "7200s" }, { ...body, scope: [...body.scope, "extra"] }]) {
      await expect(request(url, { method: "POST", body: JSON.stringify(payload) })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    }
    for (const target of [url.replace("111", "client@project.iam.gserviceaccount.com"), "https://iam.googleapis.com/v1/projects/project/serviceAccounts"]) {
      await expect(request(target, { method: "POST", body: JSON.stringify(body) })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    }
    expect(raw).not.toHaveBeenCalled();
  });
  it("blocks SOAP mutations before making a network request", async () => {
    const raw = vi.fn();
    await expect(readOnlyMonitorFetch(raw)("https://tenant.my.salesforce.com/services/Soap/u/59.0", { method: "POST", body: '<env:Body><create /></env:Body>' })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    expect(raw).not.toHaveBeenCalled();
  });
  it("blocks provider mutations and unknown hosts before sending credentials, and refuses redirects", async () => {
    const request = vi.fn().mockResolvedValue(new Response("{}"));
    const safe = readOnlyMonitorFetch(request);
    await expect(safe("https://api.hubapi.com/crm/v3/objects/deals", { method: "POST", body: "{}" })).rejects.toThrow("MONITOR_PROVIDER_WRITE_OR_HOST_BLOCKED");
    await expect(safe("https://example.com/token", { method: "POST" })).rejects.toThrow();
    await expect(safe("https://store.myshopify.com/admin/api/2026-07/graphql.json", { method: "POST", body: JSON.stringify({ query: "mutation { orderDelete { id } }" }) })).rejects.toThrow();
    expect(request).not.toHaveBeenCalled();
    await safe("https://analyticsdata.googleapis.com/v1beta/properties/123:runReport", { method: "POST", body: "{}" });
    expect(request.mock.calls[0][1].redirect).toBe("error");
  });
  it("uses each campaign's local schedule, including daylight saving time, and only one ten-minute slot", () => {
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-07-05T12:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:30:00Z"))).toBe(false);
    expect(liveNumberCheckIsDue("America/New_York", new Date("2026-11-05T13:20:00Z"))).toBe(true);
    expect(liveNumberCheckIsDue("Europe/Amsterdam", new Date("2026-11-05T13:19:59Z"))).toBe(false);
  });
  it("pins the exact database and forces read-only sessions, replacing unsafe options", () => {
    const fingerprint = createHash("sha256").update(JSON.stringify(["db.example.com", "5432", "/app_test"])).digest("hex");
    const result = new URL(readOnlyMonitorDatabaseUrl("postgresql://user:password@db.example.com/app_test?options=-c%20default_transaction_read_only=off", fingerprint));
    expect(result.searchParams.get("options")).toContain("default_transaction_read_only=on");
    expect(() => readOnlyMonitorDatabaseUrl("postgresql://user:password@db.example.com/app_live", fingerprint)).toThrow("MONITOR_DATABASE_IDENTITY_MISMATCH");
  });
  it("rejects empty or duplicate campaign configurations", () => {
    const config = { databaseEnvironmentVariable: "MONITOR_DB", databaseFingerprint: "0".repeat(64), campaigns: [] };
    expect(liveNumberConfigSchema.safeParse(config).success).toBe(false);
    const campaign = { campaignIdHash: "a".repeat(12), reportingTimeZone: "Europe/Amsterdam" };
    expect(liveNumberConfigSchema.safeParse({ ...config, campaigns: [campaign] }).success).toBe(true);
    expect(liveNumberConfigSchema.safeParse({ ...config, campaigns: [campaign, campaign] }).success).toBe(false);
  });
  it("requires exact unique artifact hashes for optional historical reviews", () => {
    const review = { snapshotHash: "a".repeat(12), payloadSha256: "b".repeat(64), replacementHash: "c".repeat(12), replacementPdfSha256: "d".repeat(64) };
    const parse = (historicalReports: any[]) => liveNumberConfigSchema.safeParse({ databaseEnvironmentVariable: "MONITOR_DB", databaseFingerprint: "0".repeat(64),
      campaigns: [{ campaignIdHash: "e".repeat(12), reportingTimeZone: "Europe/Amsterdam", historicalReports }] }).success;
    expect(parse([review])).toBe(true);
    expect(parse([review, review])).toBe(false);
    expect(parse([{ ...review, payloadSha256: "*" }])).toBe(false);
    expect(parse([{ ...review, ignoreAllFailures: true }])).toBe(false);
  });
});
