import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), getGA4Connection: vi.fn(),
    getRevenueSources: vi.fn(), getSpendSources: vi.fn(), getGA4DailyMetrics: vi.fn(),
    getGA4OverviewSnapshot: vi.fn(), replaceGA4DailyMetricsWindow: vi.fn(),
    getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(), upsertFinancialDailySnapshot: vi.fn(),
    getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
    markExecutiveSummaryDailySnapshotAligned: vi.fn(),
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
}));
vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./analytics", () => ({ ga4Service: mocks.provider, GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION: "test-v1" }));
vi.mock("./db", () => ({ db: null, pool: null }));
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
  getGA4DailySchedulerStatus, runGA4DailyRefreshPipelineForCampaignNow, startGA4DailyScheduler, stopGA4DailyScheduler,
} from "./ga4-daily-scheduler";
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
    financialConversionsAvailable: true, ga4FinancialSource: "provider_to_date",
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
    saved = new Map(); overviews = new Map(); daily = new Map();
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
    mocks.storage.markExecutiveSummaryDailySnapshotAligned.mockResolvedValue(true);
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
