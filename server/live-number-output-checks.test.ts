import { describe, expect, it } from "vitest";
import { checkApplicationOutputs, expectedOutputNumbers } from "./live-number-output-checks";
import { monitorReadQueryAllowed, outputReportReadAllowed } from "../scripts/check-live-number-outputs";
import type { LiveNumberSnapshot } from "./live-number-checks";
import { checkGeneratedReportText } from "./live-number-generated-report-checks";
import { checkApplicationOutputProcess } from "../scripts/check-live-numbers";

const now = new Date("2026-11-05T13:00:00Z");
const fixture = (): LiveNumberSnapshot => ({
  campaign: { id: "a", clientId: "client", ownerId: "owner", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["search"]' },
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

describe("actual application output comparisons", () => {
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

describe("isolated handler SQL barrier", () => {
  it.each(["SELECT * FROM campaigns WHERE id=$1", 'select "campaigns"."id" from "campaigns"', "BEGIN", "set transaction isolation level repeatable read read only", "COMMIT", "ROLLBACK"])("permits required reads/transactions: %s", sql => expect(monitorReadQueryAllowed(sql)).toBe(true));
  it.each(["UPDATE campaigns SET name='bad'", "DELETE FROM campaigns", "INSERT INTO campaigns VALUES (1)", "BEGIN READ WRITE", "SET default_transaction_read_only=off", "SELECT set_config('transaction_read_only','off',false)", "SELECT 1; DELETE FROM campaigns", "SELECT 1 /* hidden */", "RESET ALL", "SELECT 1 -- hidden"])("blocks mutations and guard bypasses: %s", sql => expect(monitorReadQueryAllowed(sql)).toBe(false));
});

describe("output report network boundary", () => {
  const url = new URL("https://analyticsdata.googleapis.com/v1beta/properties/123:runReport");
  const options = { method: "POST", body: JSON.stringify({ currencyCode: "EUR", dateRanges: [{ startDate: "2026-10-06", endDate: "2026-11-04" }] }) };
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
