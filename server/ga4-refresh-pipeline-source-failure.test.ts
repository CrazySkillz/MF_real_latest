import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), getGA4Connection: vi.fn(),
    getRevenueSources: vi.fn(), getSpendSources: vi.fn(), getGA4DailyMetrics: vi.fn(),
    getGA4OverviewSnapshot: vi.fn(), replaceGA4DailyMetricsWindow: vi.fn(),
    getLatestGA4DailyMetric: vi.fn(), getFinancialDailyComparisonData: vi.fn(), getExecutiveSummaryDailyComparisonData: vi.fn(),
    getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(), upsertFinancialDailySnapshot: vi.fn(),
    getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
    markExecutiveSummaryDailySnapshotAligned: vi.fn(),
    invalidateExecutiveSummaryDailySnapshotAlignment: vi.fn(),
    getScheduledPlatformReports: vi.fn(),
    getPlatformKPIs: vi.fn(), getPlatformBenchmarks: vi.fn(), getCampaignKPIs: vi.fn(), getCampaignBenchmarks: vi.fn(),
    getKPIProgress: vi.fn(), updateKPI: vi.fn(), recordKPIProgress: vi.fn(), updateKPIProgress: vi.fn(),
    getBenchmarkHistory: vi.fn(), updateBenchmark: vi.fn(), recordBenchmarkHistory: vi.fn(),
  },
  provider: {
    getTimeSeriesData: vi.fn(), getTrendsDailyPresenceWithToken: vi.fn(), getAcquisitionBreakdown: vi.fn(),
    getLandingPagesReport: vi.fn(), getConversionEventsReport: vi.fn(),
    getTotalsWithRevenue: vi.fn(),
  },
  totals: vi.fn(), recompute: vi.fn(), aggregate: vi.fn(), executive: vi.fn(),
  kpiAlerts: vi.fn(), benchmarkAlerts: vi.fn(), globalKpiAlerts: vi.fn(), globalBenchmarkAlerts: vi.fn(),
  reportClaim: vi.fn(), reportInsert: vi.fn(), reportSelect: vi.fn(), sendEmail: vi.fn(),
}));
vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./analytics", () => ({ ga4Service: mocks.provider, GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION: "test-v1" }));
vi.mock("./db", () => ({ db: { insert: mocks.reportInsert, select: mocks.reportSelect }, pool: null }));
vi.mock("./services/email-service", () => ({ emailService: { sendEmail: mocks.sendEmail } }));
vi.mock("./linkedin-scheduler", () => ({ refreshAllLinkedInData: vi.fn() }));
vi.mock("./internal-request-auth", () => ({ getInternalAutoRefreshToken: () => "test-token" }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: mocks.recompute }));
vi.mock("./scheduler", () => ({ recordCampaignMetrics: mocks.aggregate }));
vi.mock("./executive-summary-snapshot-scheduler", () => ({ captureExecutiveSummarySnapshot: mocks.executive }));
vi.mock("./kpi-scheduler", () => ({
  checkGA4PerformanceAlertsForCampaign: mocks.kpiAlerts, checkPerformanceAlerts: mocks.globalKpiAlerts,
}));
vi.mock("./benchmark-notifications", () => ({
  checkGA4BenchmarkPerformanceAlertsForCampaign: mocks.benchmarkAlerts, checkBenchmarkPerformanceAlerts: mocks.globalBenchmarkAlerts,
}));
vi.mock("./utils/campaign-current-values", async (importOriginal) => ({
  ...await importOriginal<typeof import("./utils/campaign-current-values")>(), getCampaignMetricTotals: mocks.totals,
}));

import {
  getGA4AlignedRefreshState, getGA4DailySchedulerStatus, runGA4DailyRefreshPipelineForCampaignNow, startGA4DailyScheduler, stopGA4DailyScheduler,
} from "./ga4-daily-scheduler";
import { checkScheduledReports, getScheduledReportAlignedRefreshGate } from "./report-scheduler";
import { getAutoRefreshSchedulerStatus, runDailyAutoRefreshOnce } from "./auto-refresh-scheduler";
import * as financialObservation from "./utils/financial-daily-snapshot-observation";

// Run the real orchestration, source discovery, daily reconciliation, evidence and financial writer.
// Provider/database boundaries and downstream jobs are mocked; this is not live E2E certification.
describe("GA4 ordered refresh source-discovery failures", () => {
  const reportingDate = "2026-10-15";
  let campaigns: any[];
  let saved: Map<string, any>;
  let overviews: Map<string, any>;
  let daily: Map<string, any[]>;
  let markers: Map<string, string>;
  const report = (campaignId: string, platformType = "google_analytics") => ({
    id: `${campaignId}-${platformType}`, campaignId, platformType, name: campaignId,
    scheduleEnabled: true, status: "active", scheduleFrequency: "daily",
    scheduleTime: "08:00", scheduleTimeZone: "Europe/Amsterdam",
  });
  const connection = (id: string) => ({
    id: `${id}-connection`, campaignId: id, propertyId: `${id}-property`, isActive: true, isPrimary: true,
    importStartDate: reportingDate, accessToken: "test-token", method: "access_token",
  });
  const source = (id: string, kind: string) => ({
    id: `${id}-${kind}`, campaignId: id, sourceType: "csv", platformContext: "ga4",
    currency: "EUR", isActive: true, createdAt: "2026-10-01T00:00:00Z",
  });
  const totals = () => ({
    revenue: 800, ga4Revenue: 500, spend: 100, conversions: 25, financialConversions: 25,
    revenueAvailable: true, spendAvailable: true, ga4Available: true, ga4RevenueAvailable: true,
    financialConversionsAvailable: true, ga4FinancialSource: "persisted_overview",
    revenueBySource: new Map(), spendBySource: new Map(), users: 80, sessions: 100, engagementRate: 0.5,
  });
  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-16T06:00:00Z"));
    vi.stubEnv("GA4_DAILY_REFRESH_TIME_ZONE", "Europe/Amsterdam");
    vi.stubEnv("GA4_DAILY_REFRESH_HOURS", "8,14,20");
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "0");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => undefined);
    campaigns = ["campaign-a", "campaign-b"].map((id) => ({
      id, ownerId: `${id}-owner`, clientId: `${id}-client`, status: "active", platform: "ga4",
      ga4CampaignFilter: "autumn", currency: "EUR", reportingTimeZone: "Europe/Amsterdam",
    }));
    saved = new Map(); overviews = new Map(); daily = new Map(); markers = new Map();
    mocks.storage.getCampaign.mockImplementation(async (id) => campaigns.find((c) => c.id === id));
    mocks.storage.getCampaigns.mockImplementation(async () => campaigns);
    mocks.storage.getGA4Connections.mockImplementation(async (id) => [connection(id)]);
    mocks.storage.getGA4Connection.mockImplementation(async (id) => connection(id));
    mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => ctx === "ga4" ? [source(id, "revenue")] : []);
    mocks.storage.getSpendSources.mockImplementation(async (id) => [source(id, "spend")]);
    mocks.storage.getGA4DailyMetrics.mockImplementation(async (id) => daily.get(id) || []);
    mocks.storage.getGA4OverviewSnapshot.mockImplementation(async (id) => overviews.get(id));
    mocks.storage.replaceGA4DailyMetricsWindow.mockImplementation(async (id, propertyId, _start, _end, rows, overview) => {
      daily.set(id, structuredClone(rows));
      overviews.set(id, { campaignId: id, propertyId, ...structuredClone(overview) });
      return { replaced: rows.length };
    });
    mocks.storage.getRevenueTotalForRange.mockImplementation(async (id) => ({ totalRevenue: 300, currency: "EUR", sourceIds: [`${id}-revenue`] }));
    mocks.storage.getSpendTotalForRange.mockImplementation(async (id) => ({ totalSpend: 100, currency: "EUR", sourceIds: [`${id}-spend`] }));
    mocks.storage.getRevenueBreakdownBySource.mockResolvedValue([]); mocks.storage.getSpendBreakdownBySource.mockResolvedValue([]);
    mocks.storage.upsertFinancialDailySnapshot.mockImplementation(async (snapshot) => {
      saved.set(snapshot.campaignId, structuredClone(snapshot));
      return { id: `${snapshot.campaignId}-snapshot` };
    });
    const rows = [{ date: reportingDate, users: 80, sessions: 100, engagedSessions: 50, pageviews: 120, conversions: 25, revenue: 500 }];
    mocks.provider.getTimeSeriesData.mockResolvedValue(rows);
    mocks.provider.getTrendsDailyPresenceWithToken.mockResolvedValue({ dailyRows: rows, presentDates: [reportingDate] });
    mocks.provider.getAcquisitionBreakdown.mockResolvedValue({ totals: { sessions: 100, conversions: 25, revenue: 500 }, meta: { currencyCode: "EUR" } });
    mocks.provider.getLandingPagesReport.mockResolvedValue({ rows: [] });
    mocks.provider.getConversionEventsReport.mockResolvedValue({ version: "test-v1", totals: { conversions: 25 } });
    mocks.totals.mockImplementation(async () => totals());
    mocks.recompute.mockImplementation(async ({ campaignId }) => ({
      campaignsProcessed: 1, campaignIdsProcessed: [campaignId], campaignIdsSkipped: [], campaignIdsFailed: [],
      kpiIdsUpdated: [], kpiIdsSkipped: [], kpiIdsFailed: [], benchmarkIdsUpdated: [], benchmarkIdsSkipped: [], benchmarkIdsFailed: [],
    }));
    mocks.aggregate.mockResolvedValue(true); mocks.executive.mockResolvedValue(true);
    mocks.storage.markExecutiveSummaryDailySnapshotAligned.mockImplementation(async (id, date, completedAt) => {
      markers.set(id, `ga4_aligned_refresh_v1:${date}:${completedAt}`); return true;
    });
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockImplementation(async id => { markers.delete(id); });
    mocks.storage.getExecutiveSummaryDailyComparisonData.mockImplementation(async id => ({ current: { notes: markers.get(id) }, previous: null }));
    mocks.storage.getPlatformKPIs.mockResolvedValue([]); mocks.storage.getPlatformBenchmarks.mockResolvedValue([]);
    mocks.storage.getCampaignKPIs.mockResolvedValue([]); mocks.storage.getCampaignBenchmarks.mockResolvedValue([]);
    mocks.storage.getKPIProgress.mockResolvedValue([]); mocks.storage.getBenchmarkHistory.mockResolvedValue([]);
    mocks.storage.recordKPIProgress.mockResolvedValue({ id: "progress" });
    mocks.storage.recordBenchmarkHistory.mockResolvedValue({ id: "history" });
    mocks.provider.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "EUR", totals: { users: 80, sessions: 100, pageviews: 120, conversions: 25, revenue: 500 } });
    for (const flag of ["__ga4DailyRefreshInProgress", "__autoRefreshInProgress", "__googleSheetsSpendRefreshInProgress", "__salesforcePipelineRefreshInProgress"]) {
      (global as any)[flag] = false;
    }
  });
  afterEach(() => {
    stopGA4DailyScheduler();
    vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals();
  });

  it("publishes matching GA4, external Revenue and Spend using the existing financial contract", async () => {
    expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("completed");
    expect(saved.get("campaign-a")).toMatchObject({
      campaignId: "campaign-a", reportingDate, currency: "EUR",
      inputs: { revenue: { value: "800.00", available: true }, spend: { value: "100.00", available: true }, conversions: { value: 25, available: true } },
    });
    expect(mocks.aggregate).toHaveBeenCalledWith("campaign-a", { allowScheduledGA4: true });
    expect(getAutoRefreshSchedulerStatus().lastRunStatus).toBe("success");
    expect(getGA4DailySchedulerStatus().lastRunStatus).toBe("success");
    expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate);
    expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mock.invocationCallOrder[0]).toBeLessThan(mocks.storage.getRevenueSources.mock.invocationCallOrder[0]);
    expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled(); expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });

  it("does not mark startup recovery complete when the campaign alert stage fails", async () => {
    campaigns = campaigns.slice(0, 1);
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    mocks.storage.getLatestGA4DailyMetric.mockImplementation(async (id) => daily.get(id)?.at(-1));
    mocks.storage.getFinancialDailyComparisonData.mockImplementation(async (id) => ({ current: { metrics: { financialDaily: saved.get(id) } }, previous: null }));
    mocks.storage.getExecutiveSummaryDailyComparisonData.mockResolvedValue({ current: { notes: null }, previous: null });
    mocks.kpiAlerts.mockRejectedValue(new Error("alert check failed"));
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-10-16T18:00:42Z"));
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(0);
    expect(getGA4DailySchedulerStatus()).toMatchObject({ lastRunStatus: "failed", inProgress: false });
    expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toHaveLength(1);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).not.toHaveBeenCalled();
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled(); expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });

  it.each([false, true])("recovers overdue startup publications through the real pipeline (first source fails: %s)", async (failFirst) => {
    const markers = new Map<string, string>();
    mocks.storage.markExecutiveSummaryDailySnapshotAligned.mockImplementation(async (id, date, completedAt) => {
      markers.set(id, `ga4_aligned_refresh_v1:${date}:${completedAt}`); return true;
    });
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockImplementation(async (id) => { markers.delete(id); });
    mocks.storage.getExecutiveSummaryDailyComparisonData.mockImplementation(async (id) => ({ current: { notes: markers.get(id) }, previous: null }));
    mocks.storage.getLatestGA4DailyMetric.mockImplementation(async (id) => daily.get(id)?.at(-1));
    mocks.storage.getFinancialDailyComparisonData.mockImplementation(async (id) => ({ current: { metrics: { financialDaily: saved.get(id) } }, previous: null }));
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    if (!failFirst) vi.setSystemTime(new Date("2026-10-16T18:00:30Z"));
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-b");
    // Seed durable completion from earlier scheduled runs; manual refreshes do not mark report readiness.
    markers.set("campaign-a", `ga4_aligned_refresh_v1:${reportingDate}:2026-10-16T06:00:00Z`);
    markers.set("campaign-b", `ga4_aligned_refresh_v1:${reportingDate}:${failFirst ? "2026-10-16T06:00:00Z" : "2026-10-16T18:00:30Z"}`);
    const prior = structuredClone(saved.get("campaign-a"));
    vi.clearAllMocks();
    if (failFirst) {
      const read = mocks.storage.getRevenueSources.getMockImplementation()!;
      mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => {
        if (id === "campaign-a") throw new Error("campaign-a source lookup failed");
        return read(id, ctx);
      });
    }
    vi.setSystemTime(new Date("2026-10-16T18:00:42Z"));
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(0);

    const recovered = failFirst ? "campaign-b" : "campaign-a";
    expect(getGA4DailySchedulerStatus()).toMatchObject({
      nextRunAt: "2026-10-17T06:00:00.000Z", lastRunTrigger: "snapshot_bootstrap", lastRunStatus: "success", inProgress: false,
    });
    expect(mocks.storage.upsertFinancialDailySnapshot.mock.calls.map(([snapshot]) => snapshot.campaignId)).toEqual([recovered]);
    expect(mocks.recompute.mock.calls.map(([options]) => options.campaignId)).toEqual([recovered]);
    expect(mocks.aggregate).toHaveBeenCalledExactlyOnceWith(recovered, { allowScheduledGA4: true });
    expect(mocks.executive).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:5000", recovered);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate, "2026-10-16T18:00:42.000Z");
    expect(mocks.kpiAlerts).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate);
    expect(mocks.benchmarkAlerts).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate);
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled(); expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
    if (failFirst) {
      expect(saved.get("campaign-a")).toEqual(prior);
      expect(markers.has("campaign-a")).toBe(false);
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toHaveLength(1);
    } else {
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toEqual([]);
      expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate);
      expect(mocks.storage.getRevenueSources.mock.calls.every(([id]) => id === "campaign-a")).toBe(true);
      vi.clearAllMocks();
      stopGA4DailyScheduler(); startGA4DailyScheduler(5000);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
      expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
      expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
    }
  });

  it("does not refresh any source when durable readiness invalidation fails", async () => {
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockRejectedValue(new Error("readiness storage unavailable"));
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("readiness storage unavailable");
    expect(mocks.storage.getRevenueSources).not.toHaveBeenCalled();
    expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
    expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  // Revenue discovery: HubSpot (4 contexts), Salesforce (4), Shopify (5), Sheets (5).
  // Spend discovery: Sheets, LinkedIn, ad platforms. Fail just one lookup, then let later reads recover.
  const discoveries = [
    ...["HubSpot", "Salesforce", "Shopify", "Sheets Revenue"].flatMap((provider, index) => {
      const contexts = index < 2 ? ["ga4", "meta", "google_ads", "google_sheets"] : ["ga4", "linkedin", "meta", "google_ads", "google_sheets"];
      const offset = [0, 4, 8, 13][index];
      return contexts.map((ctx, i) => ({ label: `${provider}/${ctx}`, method: "getRevenueSources" as const, call: offset + i + 1 }));
    }),
    ...["Sheets Spend", "LinkedIn Spend", "Ad platform Spend"].map((label, index) => ({ label, method: "getSpendSources" as const, call: index + 1 })),
  ];
  it.each(discoveries)("retains the prior snapshot after a $label discovery failure and recovers on retry", async ({ method, call }) => {
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    const prior = structuredClone(saved.get("campaign-a"));
    mocks.storage.upsertFinancialDailySnapshot.mockClear(); mocks.aggregate.mockClear();
    const read = mocks.storage[method];
    const original = read.getMockImplementation()!;
    let calls = 0;
    read.mockImplementation(async (...args: any[]) => {
      if (++calls === call) throw new Error("source-list read failed");
      return (original as any)(...args);
    });
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("Aligned GA4 publication failed");
    expect(getAutoRefreshSchedulerStatus().lastRunSummary).toMatchObject({ campaignErrors: 1 });
    expect(getAutoRefreshSchedulerStatus().lastRunStatus).toBe("failed");
    expect(saved.get("campaign-a")).toEqual(prior);
    expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
    expect(daily.get("campaign-a")).toHaveLength(1); // GA4 can refresh; financial publication must remain blocked.
    read.mockImplementation(original);
    expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("completed");
    expect(mocks.storage.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    expect(saved.get("campaign-a")).toEqual(prior);
  });

  it("keeps genuine empty source lists valid with unavailable Spend", async () => {
    mocks.storage.getRevenueSources.mockResolvedValue([]); mocks.storage.getSpendSources.mockResolvedValue([]);
    mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    mocks.totals.mockResolvedValue({ ...totals(), revenue: 500, spend: 0, spendAvailable: false });
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    expect(saved.get("campaign-a").inputs).toMatchObject({ revenue: { value: "500.00", available: true }, spend: { available: false } });
  });

  it.each(["Revenue discovery", "Spend discovery", "Revenue HTTP", "Spend HTTP"])(
    "preserves real KPI/Benchmark current values and history after a failed %s refresh, then updates on recovery",
    async (failure) => {
      const { runGA4DailyKPIAndBenchmarkJobs } = await vi.importActual<typeof import("./ga4-kpi-benchmark-jobs")>("./ga4-kpi-benchmark-jobs");
      mocks.recompute.mockImplementation(runGA4DailyKPIAndBenchmarkJobs);
      const metrics = ["revenue", "roas", "roi", "cpa", "sessions"];
      const kpis = metrics.map((metric) => ({ id: `kpi-${metric}`, campaignId: "campaign-a", platformType: "google_analytics", metric, currentValue: "17" }));
      const benchmarks = metrics.map((metric) => ({ id: `benchmark-${metric}`, campaignId: "campaign-a", platformType: "google_analytics", metric, currentValue: "19", benchmarkValue: "30" }));
      const priorKpis = structuredClone(kpis);
      const priorBenchmarks = structuredClone(benchmarks);
      mocks.storage.getPlatformKPIs.mockResolvedValue(kpis);
      mocks.storage.getPlatformBenchmarks.mockResolvedValue(benchmarks);
      mocks.storage.updateKPI.mockImplementation(async (id, update) => Object.assign(kpis.find((row) => row.id === id)!, update));
      mocks.storage.updateBenchmark.mockImplementation(async (id, update) => Object.assign(benchmarks.find((row) => row.id === id)!, update));
      if (failure === "Revenue discovery") mocks.storage.getRevenueSources.mockRejectedValueOnce(new Error("Revenue list failed"));
      if (failure === "Spend discovery") mocks.storage.getSpendSources.mockRejectedValueOnce(new Error("Spend list failed"));
      if (failure === "Revenue HTTP") mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => ctx === "ga4" ? [{
        ...source(id, "revenue"), sourceType: "hubspot", mappingConfig: JSON.stringify({ selectedValues: ["autumn"], revenueProperty: "amount" }),
      }] : []);
      if (failure === "Spend HTTP") mocks.storage.getSpendSources.mockImplementation(async (id) => [{
        ...source(id, "spend"), sourceType: "google_sheets", mappingConfig: JSON.stringify({ connectionId: "sheet-connection-a", spendColumn: "Spend" }),
      }]);
      if (failure.endsWith("HTTP")) vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 503 }));
      await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("Aligned GA4 publication failed");
      expect(kpis).toEqual(priorKpis);
      expect(benchmarks).toEqual(priorBenchmarks);
      expect(mocks.storage.recordKPIProgress).not.toHaveBeenCalled();
      expect(mocks.storage.updateKPIProgress).not.toHaveBeenCalled();
      expect(mocks.storage.recordBenchmarkHistory).not.toHaveBeenCalled();
      expect(mocks.storage.getCampaignKPIs).not.toHaveBeenCalled();
      expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
      expect(mocks.aggregate).not.toHaveBeenCalled();
      expect(mocks.kpiAlerts).not.toHaveBeenCalled();
      if (failure.endsWith("HTTP")) vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).resolves.toBe("completed");
      expect(Object.fromEntries(kpis.map((row) => [row.metric, row.currentValue]))).toEqual({ revenue: "800", roas: "8", roi: "700", cpa: "4", sessions: "100" });
      expect(benchmarks.map((row) => row.currentValue)).toEqual(kpis.map((row) => row.currentValue));
      expect(mocks.storage.recordKPIProgress).toHaveBeenCalledTimes(5);
      expect(mocks.storage.recordBenchmarkHistory).toHaveBeenCalledTimes(5);
      expect(mocks.storage.getCampaignKPIs).toHaveBeenCalledWith("campaign-a");
      expect(saved.get("campaign-a").inputs.revenue.value).toBe("800.00");
    },
  );

  it.each([
    { label: "missing", change: null },
    { label: "running", change: { status: "running" } },
    { label: "failed", change: { status: "failed" } },
    { label: "failure list", change: { failures: ["source_failed"] } },
    { label: "wrong date", change: { reportingDate: "2026-10-14" } },
    { label: "missing completion", change: { completedAt: null } },
    { label: "invalid completion", change: { completedAt: "invalid" } },
    { label: "previous run", change: { completedAt: "2026-10-16T05:59:59.999Z" } },
  ])("rejects $label financial-refresh evidence before any recomputation", async ({ change }) => {
    vi.spyOn(financialObservation, "getFinancialDailySnapshotRefreshEvidence").mockReturnValue(change === null ? null : {
      campaignId: "campaign-a", reportingDate, status: "success", completedAt: "2026-10-16T06:00:00.000Z", failures: [], ...change,
    } as any);
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("Aligned GA4 publication failed");
    expect(mocks.recompute).not.toHaveBeenCalled();
    expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    expect(mocks.aggregate).not.toHaveBeenCalled();
    expect(getGA4DailySchedulerStatus().lastAlignedRefreshFailures).toEqual([
      { campaignIdHash: expect.any(String), stage: "financial_sources_refresh_failed" },
    ]);
  });

  it("still runs the real KPI/Benchmark job for a campaign without external sources", async () => {
    const { runGA4DailyKPIAndBenchmarkJobs } = await vi.importActual<typeof import("./ga4-kpi-benchmark-jobs")>("./ga4-kpi-benchmark-jobs");
    mocks.recompute.mockImplementation(runGA4DailyKPIAndBenchmarkJobs);
    mocks.storage.getRevenueSources.mockResolvedValue([]); mocks.storage.getSpendSources.mockResolvedValue([]);
    mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "EUR" });
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [], currency: "EUR" });
    mocks.totals.mockResolvedValue({ ...totals(), revenue: 500, spend: 0, spendAvailable: false });
    mocks.storage.getPlatformKPIs.mockResolvedValue([{ id: "native-revenue", metric: "revenue" }]);
    mocks.storage.getPlatformBenchmarks.mockResolvedValue([{ id: "traffic-sessions", metric: "sessions", benchmarkValue: "120" }]);
    mocks.storage.updateKPI.mockResolvedValue({ id: "native-revenue" });
    mocks.storage.updateBenchmark.mockResolvedValue({ id: "traffic-sessions" });
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).resolves.toBe("completed");
    expect(mocks.storage.updateKPI).toHaveBeenCalledWith("native-revenue", { currentValue: "500" });
    expect(mocks.storage.updateBenchmark).toHaveBeenCalledWith("traffic-sessions", { currentValue: "100" });
    expect(saved.get("campaign-a").inputs.spend.available).toBe(false);
  });

  it.each(["success", "HTTP failure", "network failure"].flatMap((result) => [
    { result, kind: "Revenue" }, { result, kind: "Spend" },
  ]))("preserves mapped $kind refresh behavior on $result", async ({ result, kind }) => {
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    const prior = structuredClone(saved.get("campaign-a"));
    mocks.storage.upsertFinancialDailySnapshot.mockClear(); mocks.aggregate.mockClear();
    const mappedSource = kind === "Revenue"
      ? { ...source("campaign-a", "revenue"), sourceType: "hubspot", mappingConfig: JSON.stringify({ selectedValues: ["autumn"], revenueProperty: "amount" }) }
      : { ...source("campaign-a", "spend"), sourceType: "google_sheets", mappingConfig: JSON.stringify({ connectionId: "sheet-connection-a", spendColumn: "Spend" }) };
    if (kind === "Revenue") mocks.storage.getRevenueSources.mockImplementation(async (_id, ctx) => ctx === "ga4" ? [mappedSource] : []);
    else mocks.storage.getSpendSources.mockResolvedValue([mappedSource]);
    const fetchMock = vi.mocked(fetch);
    if (result === "network failure") fetchMock.mockRejectedValueOnce(new Error("network failed"));
    else fetchMock.mockResolvedValueOnce(new Response("{}", { status: result === "success" ? 200 : 503 }));
    if (result === "success") {
      await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).resolves.toBe("completed");
      expect(mocks.storage.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    } else {
      await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("Aligned GA4 publication failed");
      expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
      expect(mocks.aggregate).not.toHaveBeenCalled();
      expect(getAutoRefreshSchedulerStatus().lastRunStatus).toBe("failed");
    }
    expect(saved.get("campaign-a")).toEqual(prior);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(kind === "Revenue" ? "/campaigns/campaign-a/hubspot/save-mappings" : "/campaigns/campaign-a/spend/sheets/process");
    const body = JSON.parse(String(request?.body));
    expect(kind === "Revenue" ? body.sourceId : body.mapping.sourceId).toBe(mappedSource.id);
    if (result !== "success") {
      fetchMock.mockResolvedValueOnce(new Response("{}", { status: 200 }));
      await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).resolves.toBe("completed");
      expect(mocks.storage.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    }
  });

  it("records a discovery failure in the shared non-GA4 refresh without writing downstream values", async () => {
    campaigns[0].platform = "linkedin";
    mocks.storage.getGA4Connections.mockResolvedValue([]);
    mocks.storage.getRevenueSources.mockRejectedValueOnce(new Error("source lookup failed"));
    const summary = await runDailyAutoRefreshOnce("manual", { campaignId: "campaign-a", financialSourcesOnly: true });
    expect(summary).toMatchObject({ campaignsScanned: 1, campaignErrors: 1 });
    expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    expect(mocks.recompute).not.toHaveBeenCalled();
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
  });

  it.each(["provider", "daily storage", "financial storage", "conversion mismatch", "revenue mismatch"])("preserves the prior financial snapshot on %s failure", async (stage) => {
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    const prior = structuredClone(saved.get("campaign-a"));
    mocks.aggregate.mockClear();
    if (stage === "provider") mocks.provider.getTimeSeriesData.mockRejectedValueOnce(new Error("provider failed"));
    if (stage === "daily storage") mocks.storage.replaceGA4DailyMetricsWindow.mockRejectedValueOnce(new Error("daily write failed"));
    if (stage === "financial storage") mocks.storage.upsertFinancialDailySnapshot.mockRejectedValueOnce(new Error("financial write failed"));
    if (stage === "conversion mismatch") mocks.totals.mockResolvedValueOnce({ ...totals(), financialConversions: 26 });
    if (stage === "revenue mismatch") mocks.totals.mockResolvedValueOnce({ ...totals(), ga4Revenue: 501, revenue: 801 });
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow();
    expect(saved.get("campaign-a")).toEqual(prior);
    expect(mocks.aggregate).not.toHaveBeenCalled();
    expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("completed");
  });

  it.each([
    ["financial sources", "campaign-b"], ["GA4", "campaign-b"],
    ["financial sources", "campaign-a"], ["GA4", "campaign-a"],
  ])("publishes and releases the other campaign's reports while %s waits in %s", async (stage, waitingCampaign) => {
    const finishedCampaign = waitingCampaign === "campaign-a" ? "campaign-b" : "campaign-a";
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]); // Skip bootstrap and exercise the scheduled timer.
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    let waiting = false;
    if (stage === "financial sources") {
      const read = mocks.storage.getRevenueSources.getMockImplementation()!;
      mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => {
        if (id === waitingCampaign) { waiting = true; await pending; }
        return read(id, ctx);
      });
    } else {
      const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
      mocks.provider.getTimeSeriesData.mockImplementation(async (...args) => {
        if (args[0] === waitingCampaign) { waiting = true; await pending; }
        return read(...args);
      });
    }
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(waiting).toBe(true);
      expect(saved.get(finishedCampaign)?.inputs.revenue.value).toBe("800.00");
      expect(saved.has(waitingCampaign)).toBe(false);
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith(finishedCampaign, reportingDate, expect.any(String));
      expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
      expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: true, lastRunStatus: "running" });
      for (const platform of ["google_analytics", "campaign_deepdive"]) {
        expect(await getScheduledReportAlignedRefreshGate(report(finishedCampaign, platform))).toEqual({ ready: true });
        expect(await getScheduledReportAlignedRefreshGate(report(waitingCampaign, platform))).toMatchObject({ ready: false });
      }
      expect(await getGA4AlignedRefreshState(finishedCampaign, "2026-10-14")).toBeNull();
      // Exercise the real due-report loop up to its existing idempotency boundary; no PDF/email is sent.
      mocks.storage.getScheduledPlatformReports.mockResolvedValue(campaigns.flatMap(c =>
        ["google_analytics", "campaign_deepdive"].map(platform => report(c.id, platform))));
      mocks.reportInsert.mockReturnValue({ values: mocks.reportClaim });
      mocks.reportClaim.mockReturnValue({ onConflictDoNothing: () => ({ returning: async () => [] }) });
      mocks.reportSelect.mockReturnValue({ from: () => ({ where: () => ({ limit: async () => [{ status: "sent" }] }) }) });
      await checkScheduledReports();
      expect(mocks.reportClaim.mock.calls.map(([value]) => value.reportId)).toEqual([
        `${finishedCampaign}-google_analytics`, `${finishedCampaign}-campaign_deepdive`,
      ]);
      expect(mocks.sendEmail).not.toHaveBeenCalled();
      expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("skipped");
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
    expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: false, lastRunStatus: "success" });
    expect(saved.get(waitingCampaign)?.inputs.revenue.value).toBe("800.00");
    expect(mocks.recompute.mock.calls.map(([options]) => options.campaignId)).toEqual([finishedCampaign, waitingCampaign]);
    expect(mocks.globalKpiAlerts).toHaveBeenCalledTimes(1);
    expect(mocks.globalBenchmarkAlerts).toHaveBeenCalledTimes(1);
  });

  it("blocks old cached markers during initial invalidation and resets readiness for the next run", async () => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    markers.set("campaign-b", `ga4_aligned_refresh_v1:${reportingDate}:2026-10-15T18:01:00Z`);
    expect(await getGA4AlignedRefreshState("campaign-b", reportingDate)).not.toBeNull();
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockImplementationOnce(async () => { await pending; });
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(markers.has("campaign-b")).toBe(true);
      expect(await getGA4AlignedRefreshState("campaign-b")).toBeNull();
      expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toMatchObject({ ready: false });
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
    const nextPending = new Promise<void>(resolve => { release = resolve; });
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockImplementationOnce(async () => { await nextPending; });
    try {
      await vi.advanceTimersByTimeAsync(6 * 60 * 60 * 1000);
      expect(getGA4DailySchedulerStatus().inProgress).toBe(true);
      expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toMatchObject({ ready: false });
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
  });

  it.each(["recompute", "financial", "aggregate", "executive", "KPI alerts", "Benchmark alerts", "marker persistence"])(
    "keeps a campaign's reports blocked until its %s stage finishes", async stage => {
      vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
      mocks.storage.getCampaigns.mockResolvedValueOnce([]);
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      const method = stage === "recompute" ? mocks.recompute : stage === "financial" ? mocks.storage.upsertFinancialDailySnapshot
        : stage === "aggregate" ? mocks.aggregate : stage === "executive" ? mocks.executive
        : stage === "KPI alerts" ? mocks.kpiAlerts : stage === "Benchmark alerts" ? mocks.benchmarkAlerts
        : mocks.storage.markExecutiveSummaryDailySnapshotAligned;
      const run = method.getMockImplementation();
      method.mockImplementation(async (...args) => {
        const id = ["recompute", "financial"].includes(stage) ? args[0].campaignId : stage === "executive" ? args[1] : args[0];
        if (id === "campaign-a") await pending;
        return run?.(...args);
      });
      startGA4DailyScheduler(5000);
      try {
        await vi.advanceTimersByTimeAsync(1000);
        expect(getGA4DailySchedulerStatus().inProgress).toBe(true);
        expect(await getScheduledReportAlignedRefreshGate(report("campaign-a"))).toMatchObject({ ready: false });
        expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
        expect(markers.has("campaign-a")).toBe(false);
      } finally { release(); await vi.advanceTimersByTimeAsync(0); }
      expect(await getScheduledReportAlignedRefreshGate(report("campaign-a"))).toEqual({ ready: true });
    },
  );

  it("still requires a valid persisted marker while an unrelated campaign is refreshing", async () => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
    mocks.provider.getTimeSeriesData.mockImplementation(async (...args) => {
      if (args[0] === "campaign-a") await pending;
      return read(...args);
    });
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      const completedMarker = markers.get("campaign-b")!;
      for (const value of ["", "ga4_aligned_refresh_v1:2026-10-14:2026-10-16T06:00:00Z", `ga4_aligned_refresh_v1:${reportingDate}:invalid`]) {
        markers.set("campaign-b", value);
        expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toMatchObject({ ready: false });
      }
      mocks.storage.getExecutiveSummaryDailyComparisonData.mockRejectedValueOnce(new Error("snapshot read failed"));
      expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: false, reason: "campaign refresh readiness could not be verified" });
      markers.set("campaign-b", completedMarker);
      expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
  });

  it("rejects a persisted marker read that overlaps a newer refresh even after that refresh finishes", async () => {
    let release!: (value: any) => void;
    mocks.storage.getExecutiveSummaryDailyComparisonData.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const read = getGA4AlignedRefreshState("campaign-a", reportingDate);
    try {
      await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
      expect(getGA4DailySchedulerStatus().inProgress).toBe(false);
    } finally {
      release({ current: { notes: `ga4_aligned_refresh_v1:${reportingDate}:2026-10-16T05:00:00Z` }, previous: null });
    }
    expect(await read).toBeNull();
    expect(await getGA4AlignedRefreshState("campaign-a")).toBeNull();
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-a"))).toMatchObject({ ready: false });
  });

  it("allows shared-property campaigns to finish independently while retaining overlap protection", async () => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    mocks.storage.getGA4Connections.mockImplementation(async id => [{ ...connection(id), propertyId: "shared-property" }]);
    mocks.storage.getGA4Connection.mockImplementation(async id => ({ ...connection(id), propertyId: "shared-property" }));
    mocks.storage.getRevenueTotalForRange.mockImplementation(async id => ({ totalRevenue: id === "campaign-a" ? 300 : 700, currency: "EUR", sourceIds: [`${id}-revenue`] }));
    mocks.storage.getSpendTotalForRange.mockImplementation(async id => ({ totalSpend: id === "campaign-a" ? 100 : 200, currency: "EUR", sourceIds: [`${id}-spend`] }));
    mocks.totals.mockImplementation(async id => ({ ...totals(), revenue: id === "campaign-a" ? 800 : 1200, spend: id === "campaign-a" ? 100 : 200 }));
    mocks.storage.getPlatformKPIs.mockImplementation(async (_platform, id) => ["revenue", "cpa"].map(metric => ({ id: `${id}-${metric}`, campaignId: id, metric, currentValue: "17" })));
    mocks.storage.getPlatformBenchmarks.mockImplementation(async (_platform, id) => ["revenue", "cpa"].map(metric => ({ id: `${id}-${metric}`, campaignId: id, metric, benchmarkValue: "100", currentValue: "17" })));
    mocks.storage.updateKPI.mockImplementation(async (id, value) => ({ id, ...value }));
    mocks.storage.updateBenchmark.mockImplementation(async (id, value) => ({ id, ...value }));
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const { runGA4DailyKPIAndBenchmarkJobs: recompute } = await vi.importActual<typeof import("./ga4-kpi-benchmark-jobs")>("./ga4-kpi-benchmark-jobs");
    mocks.recompute.mockImplementation(async options => {
      if (options.campaignId === "campaign-a") await pending;
      return recompute(options);
    });
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(mocks.recompute).toHaveBeenCalledTimes(2);
      expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
      expect(getAutoRefreshSchedulerStatus().inProgress).toBe(true);
      expect(await runDailyAutoRefreshOnce("manual", { campaignId: "campaign-b", financialSourcesOnly: true })).toBeNull();
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, expect.any(String));
      expect(saved.has("campaign-a")).toBe(false);
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
    expect(getGA4DailySchedulerStatus().lastRunStatus).toBe("success");
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => [args[0], args[3]])).toEqual([
      ["campaign-a", "shared-property"], ["campaign-b", "shared-property"],
    ]);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-b", "campaign-a"]);
    expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("financial_sources", "campaign-a")?.status).toBe("success");
    expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("financial_sources", "campaign-b")?.status).toBe("success");
    for (const [id, revenue, spend, cpa] of [["campaign-a", "800", "100", "4"], ["campaign-b", "1200", "200", "8"]]) {
      expect(saved.get(id)?.inputs).toMatchObject({ revenue: { value: `${revenue}.00` }, spend: { value: `${spend}.00` } });
      for (const update of [mocks.storage.updateKPI, mocks.storage.updateBenchmark]) {
        expect(update).toHaveBeenCalledWith(`${id}-revenue`, { currentValue: revenue });
        expect(update).toHaveBeenCalledWith(`${id}-cpa`, { currentValue: cpa });
      }
    }
  });

  it("keeps at most two campaigns running and drains later campaigns while the first is stalled", async () => {
    campaigns.push(...["campaign-c", "campaign-d"].map(id => ({ ...campaigns[1], id, ownerId: id, clientId: id })));
    const releases = new Map<string, () => void>();
    const pending = new Map(campaigns.map(c => [c.id, new Promise<void>(resolve => { releases.set(c.id, resolve); })]));
    let active = 0, maximum = 0;
    const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
    mocks.provider.getTimeSeriesData.mockImplementation(async (...args) => {
      maximum = Math.max(maximum, ++active);
      await pending.get(args[0]);
      active--;
      return read(...args);
    });
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[0])).toEqual(["campaign-a", "campaign-b"]);
      for (const id of ["campaign-b", "campaign-c", "campaign-d"]) {
        releases.get(id)!(); await vi.advanceTimersByTimeAsync(0);
        expect(saved.has(id)).toBe(true);
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledWith(id, reportingDate, expect.any(String));
      }
      expect(saved.has("campaign-a")).toBe(false);
      expect(maximum).toBe(2);
      expect(getAutoRefreshSchedulerStatus().inProgress).toBe(true);
      expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
    } finally { for (const release of releases.values()) release(); await vi.advanceTimersByTimeAsync(0); }
    expect(saved.size).toBe(4);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledTimes(4);
    expect(mocks.globalKpiAlerts).toHaveBeenCalledTimes(1);
    expect(getGA4DailySchedulerStatus().lastRunStatus).toBe("success");
  });

  it.each([[503, 200], [200, 503], [429, 200], [200, 200]])("keeps concurrent source results isolated (first %s, second %s)", async (aStatus, bStatus) => {
    mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => ctx === "ga4" ? [{
      ...source(id, "revenue"), sourceType: "hubspot", mappingConfig: JSON.stringify({ selectedValues: [id], revenueProperty: "amount" }),
    }] : []);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    vi.mocked(fetch).mockImplementation(async (url, request) => {
      const id = String(url).includes("campaign-a") ? "campaign-a" : "campaign-b";
      expect(JSON.parse(request!.body as string)).toMatchObject({ sourceId: `${id}-revenue`, selectedValues: [id], platformContext: "ga4" });
      if (id === "campaign-a") await pending;
      return new Response("{}", { status: id === "campaign-a" ? aStatus : bStatus });
    });
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    startGA4DailyScheduler(5000);
    try {
      await vi.advanceTimersByTimeAsync(1000);
      expect(saved.has("campaign-b")).toBe(bStatus === 200);
      expect(saved.has("campaign-a")).toBe(false);
      expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("financial_sources", "campaign-b")?.status).toBe(bStatus === 200 ? "success" : "failed");
    } finally { release(); await vi.advanceTimersByTimeAsync(0); }
    expect(saved.has("campaign-a")).toBe(aStatus === 200);
    expect(getAutoRefreshSchedulerStatus().lastRunSummary).toMatchObject({
      providerJobsAttempted: 2, providerJobsSucceeded: Number(aStatus === 200) + Number(bStatus === 200), providerJobsRetained: 0,
    });
    expect(getGA4DailySchedulerStatus().lastRunStatus).toBe(aStatus === 200 && bStatus === 200 ? "success" : "failed");
    for (const [id, status] of [["campaign-a", aStatus], ["campaign-b", bStatus]] as const) {
      expect(mocks.recompute.mock.calls.some(([opts]) => opts.campaignId === id)).toBe(status === 200);
      expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("financial_sources", id)?.status).toBe(status === 200 ? "success" : "failed");
    }
  });

  it("waits for active workers before releasing the lock after an unexpected callback failure", async () => {
    campaigns.push({ ...campaigns[1], id: "campaign-c" });
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const completed: string[] = [];
    let settled = false;
    const run = runDailyAutoRefreshOnce("scheduled", {
      financialSourcesOnly: true, deferDownstream: true, campaignConcurrency: 2,
      onCampaignRefreshed: async id => {
        if (id === "campaign-a") throw new Error("unexpected callback failure");
        if (id === "campaign-b") await pending;
        completed.push(id);
      },
    }).then(() => { settled = true; return null; }, error => { settled = true; return error; });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(completed).toEqual(["campaign-c"]);
      expect(settled).toBe(false);
      expect(getAutoRefreshSchedulerStatus().inProgress).toBe(true);
    } finally { release(); }
    expect((await run)?.message).toBe("unexpected callback failure");
    expect(getAutoRefreshSchedulerStatus()).toMatchObject({ inProgress: false, lastRunStatus: "failed" });
  });

  it("keeps manual runs sequential even if concurrent campaign processing is requested", async () => {
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    const callback = vi.fn(async (id: string) => { if (id === "campaign-a") await pending; });
    const run = runDailyAutoRefreshOnce("manual", {
      financialSourcesOnly: true, deferDownstream: true, campaignConcurrency: 2, onCampaignRefreshed: callback,
    });
    try {
      await vi.advanceTimersByTimeAsync(0);
      expect(callback.mock.calls).toEqual([["campaign-a"]]);
      expect(mocks.storage.getRevenueSources.mock.calls.every(([id]) => id === "campaign-a")).toBe(true);
    } finally { release(); }
    await run;
    expect(callback.mock.calls).toEqual([["campaign-a"], ["campaign-b"]]);
  });

  it("refreshes a duplicated campaign only once during a concurrent scheduled run", async () => {
    campaigns.splice(1, 0, { ...campaigns[0] });
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[0]).sort()).toEqual(["campaign-a", "campaign-b"]);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledTimes(2);
    expect(financialObservation.getFinancialDailySnapshotObservationStatus().financialSourceEvidenceCampaigns).toBe(2);
  });

  it.each(["GA4", "recompute", "financial", "aggregate", "executive", "alerts", "readiness", "missing snapshot"])("continues to the next campaign after a %s failure", async stage => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    const method = stage === "GA4" ? mocks.provider.getTimeSeriesData : stage === "recompute" ? mocks.recompute : stage === "financial" ? mocks.storage.upsertFinancialDailySnapshot
      : stage === "aggregate" ? mocks.aggregate : stage === "executive" ? mocks.executive
      : stage === "alerts" ? mocks.kpiAlerts : mocks.storage.markExecutiveSummaryDailySnapshotAligned;
    if (stage === "missing snapshot") method.mockResolvedValueOnce(false);
    else method.mockRejectedValueOnce(new Error(`${stage} failed`));
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: false, lastRunStatus: "failed" });
    expect(saved.get("campaign-b")?.inputs.revenue.value).toBe("800.00");
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledWith("campaign-b", reportingDate, expect.any(String));
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-a"))).toMatchObject({ ready: false });
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
    if (!["readiness", "missing snapshot"].includes(stage)) expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
    expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });

  it("does not import a campaign deleted during its financial-source refresh", async () => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    const read = mocks.storage.getRevenueSources.getMockImplementation()!;
    mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => {
      if (id === "campaign-a") campaigns = campaigns.filter(c => c.id !== id);
      return read(id, ctx);
    });
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(mocks.provider.getTimeSeriesData.mock.calls.map(args => args[0])).toEqual(["campaign-b"]);
    expect(saved.has("campaign-a")).toBe(false);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
  });

  it.each([
    { hour: 8, before: "2026-10-16T05:59:59Z", expected: "2026-10-16T06:00:00.000Z" },
    { hour: 14, before: "2026-10-16T11:59:59Z", expected: "2026-10-16T12:00:00.000Z" },
    { hour: 20, before: "2026-10-16T17:59:59Z", expected: "2026-10-16T18:00:00.000Z" },
  ])("the $hour:00 scheduled run isolates a failed campaign and completes the healthy campaign's downstream stages", async ({ before, expected }) => {
    vi.setSystemTime(new Date(before));
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    const prior = structuredClone(saved.get("campaign-a"));
    mocks.storage.upsertFinancialDailySnapshot.mockClear(); mocks.aggregate.mockClear();
    mocks.executive.mockClear(); // Ignore the successful snapshot used to seed this test's prior state.
    mocks.recompute.mockClear();
    mocks.storage.getCampaigns.mockResolvedValueOnce([]); // No startup bootstrap; exercise the actual scheduled timer.
    const read = mocks.storage.getRevenueSources.getMockImplementation()!;
    mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => {
      if (id === "campaign-a") throw new Error("campaign-a source lookup failed");
      return read(id, ctx);
    });
    startGA4DailyScheduler(5000);
    const nextRunAt = getGA4DailySchedulerStatus().nextRunAt!;
    expect(nextRunAt).toBe(expected);
    await vi.advanceTimersByTimeAsync(Date.parse(nextRunAt) - Date.now());
    expect(getGA4DailySchedulerStatus()).toMatchObject({ lastRunTrigger: "scheduled", lastRunStatus: "failed" });
    expect(saved.get("campaign-a")).toEqual(prior);
    expect(mocks.storage.upsertFinancialDailySnapshot.mock.calls.map(([snapshot]) => snapshot.campaignId)).toEqual(["campaign-b"]);
    expect(mocks.aggregate.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
    expect(mocks.recompute.mock.calls.map(([options]) => options.campaignId)).toEqual(["campaign-b"]);
    expect(mocks.executive).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:5000", "campaign-b");
    expect(mocks.kpiAlerts).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate);
    expect(mocks.benchmarkAlerts).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, expect.any(String));
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
    expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });
});
