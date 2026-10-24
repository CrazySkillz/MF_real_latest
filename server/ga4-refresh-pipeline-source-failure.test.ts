import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  storage: {
    writeWithGA4RefreshOwnership: vi.fn(),
    getGA4PublicationVersion: vi.fn(), isGA4NativeRecoveryEligible: vi.fn(), retireGA4RefreshWork: vi.fn(), getRecoverableGA4RefreshWork: vi.fn(),
    getCampaign: vi.fn(), getCampaigns: vi.fn(), getGA4Connections: vi.fn(), getGA4Connection: vi.fn(), updateGA4ConnectionTokens: vi.fn(),
    getRevenueSources: vi.fn(), getSpendSources: vi.fn(), getGA4DailyMetrics: vi.fn(),
    getGA4OverviewSnapshot: vi.fn(), replaceGA4DailyMetricsWindow: vi.fn(),
    getLatestGA4DailyMetric: vi.fn(), getFinancialDailyComparisonData: vi.fn(), getExecutiveSummaryDailyComparisonData: vi.fn(),
    getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(), upsertFinancialDailySnapshot: vi.fn(), getGA4RevenuePublication: vi.fn(),
    getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
    markExecutiveSummaryDailySnapshotAligned: vi.fn(),
    invalidateExecutiveSummaryDailySnapshotAlignment: vi.fn(),
    ensureGA4RefreshWork: vi.fn(), claimGA4RefreshWork: vi.fn(), updateGA4RefreshWorkLease: vi.fn(),
    getGA4InitialImportWork: vi.fn(),
    getScheduledPlatformReports: vi.fn(),
    getPlatformKPIs: vi.fn(), getPlatformBenchmarks: vi.fn(), getCampaignKPIs: vi.fn(), getCampaignBenchmarks: vi.fn(),
    getKPIProgress: vi.fn(), updateKPI: vi.fn(), recordKPIProgress: vi.fn(), updateKPIProgress: vi.fn(),
    getBenchmarkHistory: vi.fn(), updateBenchmark: vi.fn(), recordBenchmarkHistory: vi.fn(),
  },
  provider: {
    withAbortSignal: vi.fn(), getTimeSeriesData: vi.fn(), getTrendsDailyPresenceWithToken: vi.fn(), getAcquisitionBreakdown: vi.fn(),
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
  backfillMissingGA4OverviewSnapshots, getGA4AlignedRefreshState, getGA4DailySchedulerStatus, runGA4DailyRefreshPipelineForCampaignNow, startGA4DailyScheduler, stopGA4DailyScheduler,
  refreshAllGA4DailyMetrics,
  runGA4DailyRefreshPipelineForTrigger,
  recoverInterruptedGA4Refreshes,
} from "./ga4-daily-scheduler";
import { checkScheduledReports, getScheduledReportAlignedRefreshGate } from "./report-scheduler";
import { getAutoRefreshSchedulerStatus, runDailyAutoRefreshOnce } from "./auto-refresh-scheduler";
import * as financialObservation from "./utils/financial-daily-snapshot-observation";

// Run the real orchestration, source discovery, daily reconciliation, evidence and financial writer.
// Provider/database boundaries and downstream jobs are mocked; this is not live E2E certification.
describe("GA4 ordered refresh source-discovery failures", () => {
  const ordinary = (campaignId: string) => ({ publicationVersion: { campaignId, version: null } });
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
    mocks.storage.getGA4PublicationVersion.mockResolvedValue(null);
    mocks.storage.getGA4RevenuePublication.mockImplementation(async (_campaignId, reportingDate) => ({ version: 1, reportingDate, sources: {}, pendingSourceIds: [] }));
    mocks.storage.writeWithGA4RefreshOwnership.mockResolvedValue(undefined);
    mocks.storage.isGA4NativeRecoveryEligible.mockResolvedValue(false);
    mocks.storage.retireGA4RefreshWork.mockResolvedValue(undefined);
    mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue([]);
    mocks.provider.withAbortSignal.mockImplementation(() => mocks.provider);
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

  it("captures ordinary publication after financial-source edits and before native computation", async () => {
    let version = "before-sources";
    mocks.storage.getGA4PublicationVersion.mockImplementation(async () => version);
    mocks.storage.getRevenueSources.mockImplementation(async (id, ctx) => {
      if (ctx === "ga4") version = "after-sources";
      return ctx === "ga4" ? [source(id, "revenue")] : [];
    });
    await runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", { campaignId: "campaign-a", refreshFinancialSources: true });
    expect(mocks.aggregate).toHaveBeenCalledWith("campaign-a", { allowScheduledGA4: true,
      publicationVersion: { campaignId: "campaign-a", version: "after-sources" } });
  });
  it("passes the captured ordinary version and credentials through automatic renewal", async () => {
    mocks.storage.getGA4PublicationVersion.mockResolvedValue("saved-generation");
    const rows = await mocks.provider.getTimeSeriesData();
    mocks.provider.getTimeSeriesData.mockImplementationOnce(async (id, dependency) => {
      const current = await dependency.getGA4Connection(id);
      await dependency.updateGA4ConnectionTokens(current.id, { accessToken: "renewed" });
      return rows;
    });
    await runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", { campaignId: "campaign-a", refreshFinancialSources: true });
    expect(mocks.storage.updateGA4ConnectionTokens).toHaveBeenCalledWith("campaign-a-connection", { accessToken: "renewed" }, {
      publicationVersion: { campaignId: "campaign-a", version: "saved-generation" }, expectedConnection: connection("campaign-a"),
    });
  });
  describe("automatic durable ownership integration", () => {
    let live: boolean;
    const options = () => ({ campaignId: "campaign-a", refreshFinancialSources: true, workDueAt: new Date(Date.now() - 1000) });
    const scope = { campaignId: "campaign-a", ownerId: "campaign-a-owner", reportingDate,
      work: { id: "work-a", leaseToken: "owner-token" } };
    beforeEach(async () => {
      live = true;
      mocks.storage.isGA4NativeRecoveryEligible.mockResolvedValue(true);
      mocks.storage.getCampaigns.mockResolvedValueOnce([]);
      startGA4DailyScheduler(5000);
      await vi.advanceTimersByTimeAsync(0);
      mocks.storage.getRevenueSources.mockResolvedValue([]); mocks.storage.getSpendSources.mockResolvedValue([]);
      mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, currency: "EUR", sourceIds: [] });
      mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, currency: "EUR", sourceIds: [] });
      mocks.totals.mockImplementation(async () => ({ ...totals(), revenue: 500, spend: 0, spendAvailable: false }));
      mocks.storage.ensureGA4RefreshWork.mockImplementation(async (_id, _owner, _due, _date, options) => ({ id: "work-a", status: "pending",
        scope: { kind: options?.revenueChange ? "revenue_change" : "scheduled" }, suppressAlerts: options?.suppressAlerts === true }));
      mocks.storage.claimGA4RefreshWork.mockResolvedValue({ id: "work-a", leaseToken: "owner-token" });
      mocks.storage.updateGA4RefreshWorkLease.mockImplementation(async (_id, _owner, _work, _token, action, _ms, completedAt) => {
        if (!live) return undefined;
        if (action === "complete") markers.set("campaign-a", `ga4_aligned_refresh_v1:${reportingDate}:${completedAt}`);
        return { id: "work-a", status: action === "complete" ? "completed" : "running" };
      });
    });
    it("carries one claimed token through all saves, alerts and atomic completion", async () => {
      await runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options());
      expect(mocks.storage.claimGA4RefreshWork).toHaveBeenCalledExactlyOnceWith("campaign-a", "campaign-a-owner", "work-a", 120_000);
      expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls[0][5].refreshScope.work).toEqual(scope.work);
      expect(mocks.recompute).toHaveBeenCalledWith(expect.objectContaining({ refreshScope: scope }));
      expect(mocks.storage.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({ refreshScope: scope }));
      expect(mocks.aggregate).toHaveBeenCalledWith("campaign-a", { allowScheduledGA4: true, refreshScope: scope });
      expect(mocks.executive).toHaveBeenCalledWith("http://127.0.0.1:5000", "campaign-a", { refreshScope: scope, signal: expect.any(AbortSignal) });
      expect(mocks.kpiAlerts).toHaveBeenCalledWith("campaign-a", reportingDate, { refreshScope: scope });
      expect(mocks.benchmarkAlerts).toHaveBeenCalledWith("campaign-a", reportingDate, { refreshScope: scope });
      expect(mocks.storage.updateGA4RefreshWorkLease).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", "work-a", "owner-token", "complete", 120_000, expect.any(String));
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).not.toHaveBeenCalled();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "release")).toBe(false);
      expect(await getGA4AlignedRefreshState("campaign-a", reportingDate)).not.toBeNull();
    });
    it('replays saved financial sources under the same owner before native and downstream publication', async () => {
      mocks.storage.getRevenueSources.mockImplementation(async (id, context) => !context || context === 'ga4' ? [source(id, 'revenue')] : []);
      mocks.storage.getSpendSources.mockResolvedValue([source('campaign-a', 'spend')]);
      mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, currency: 'EUR', sourceIds: ['campaign-a-revenue'] });
      mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100, currency: 'EUR', sourceIds: ['campaign-a-spend'] });
      mocks.totals.mockImplementation(async () => totals());
      await runGA4DailyRefreshPipelineForTrigger('recovery', options());
      expect(mocks.storage.writeWithGA4RefreshOwnership).toHaveBeenCalledWith(scope, expect.any(Function));
      expect(mocks.recompute).toHaveBeenCalledWith(expect.objectContaining({ refreshScope: scope }));
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === 'complete')).toBe(true);
    });
    it('does not publish incomplete financial refreshes or manufacture successful source evidence', async () => {
      mocks.storage.getRevenueSources.mockResolvedValue([{ ...source('campaign-a', 'revenue'), sourceType: 'hubspot', mappingConfig: '{}' }]);
      await expect(runGA4DailyRefreshPipelineForTrigger('recovery', options())).rejects.toThrow();
      expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
      expect(mocks.recompute).not.toHaveBeenCalled();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === 'complete')).toBe(false);
    });
    describe("accepted draft initial imports", () => {
      const initialOptions = () => ({ ...options(), initialImportWorkId: "work-a" });
      beforeEach(() => {
        campaigns[0].status = "draft";
        mocks.storage.isGA4NativeRecoveryEligible.mockResolvedValue(false);
        mocks.storage.getGA4InitialImportWork.mockResolvedValue({ id: "work-a", campaignId: "campaign-a", dueAt: options().workDueAt,
          reportingDate, status: "pending", suppressAlerts: true, scope: { kind: "initial_import", campaign: { ownerId: "campaign-a-owner" } } });
      });
      it("imports only the accepted draft and completes through atomic activation without downstream alert/report publication", async () => {
        await runGA4DailyRefreshPipelineForTrigger("recovery", initialOptions());
        expect(mocks.storage.getGA4InitialImportWork).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", "work-a");
        expect(mocks.storage.ensureGA4RefreshWork).not.toHaveBeenCalled();
        expect(mocks.storage.replaceGA4DailyMetricsWindow).toHaveBeenCalledTimes(1);
        expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls[0][5].refreshScope.work).toEqual(scope.work);
        expect(mocks.storage.updateGA4RefreshWorkLease).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", "work-a", "owner-token", "complete_initial_import");
        expect(mocks.recompute).not.toHaveBeenCalled(); expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.executive).not.toHaveBeenCalled();
      });
      it.each(["pending", "running"])("discovers %s initial work after midnight using its original reporting window", async status => {
        const work = { ...await mocks.storage.getGA4InitialImportWork(), status };
        mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue([work]);
        vi.setSystemTime(new Date("2026-10-17T06:00:00Z"));
        await recoverInterruptedGA4Refreshes();
        expect(mocks.provider.getTimeSeriesData.mock.calls[0][5]).toBe(reportingDate);
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete_initial_import")).toBe(true);
      });
      it.each(["TOKEN_EXPIRED", "GA4_TRANSIENT_ERROR"])("preserves the draft and classifies %s for retry", async message => {
        mocks.provider.getTimeSeriesData.mockRejectedValue(new Error(message));
        await expect(runGA4DailyRefreshPipelineForTrigger("recovery", initialOptions())).rejects.toThrow(message);
        expect(mocks.storage.updateGA4RefreshWorkLease).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", "work-a", "owner-token", "release", 120_000, undefined,
          expect.objectContaining({ retryable: message === "GA4_TRANSIENT_ERROR" }));
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete_initial_import")).toBe(false);
        expect(campaigns[0].status).toBe("draft");
      });
      it("refuses activation after one selected property fails", async () => {
        mocks.storage.getGA4Connections.mockResolvedValue([connection("campaign-a"), { ...connection("campaign-a"), id: "second", propertyId: "second-property" }]);
        mocks.provider.getTimeSeriesData.mockRejectedValueOnce(new Error("TOKEN_EXPIRED"));
        await expect(runGA4DailyRefreshPipelineForTrigger("recovery", initialOptions())).rejects.toThrow("TOKEN_EXPIRED");
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete_initial_import")).toBe(false);
      });
      it("does not touch the provider when the saved initial request is missing", async () => {
        mocks.storage.getGA4InitialImportWork.mockResolvedValue(undefined);
        await expect(runGA4DailyRefreshPipelineForTrigger("recovery", initialOptions())).rejects.toThrow("OWNERSHIP_LOST");
        expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
      });
      it("leaves persisted work queued while another pipeline is running", async () => {
        (global as any).__ga4DailyRefreshInProgress = true;
        await recoverInterruptedGA4Refreshes();
        expect(mocks.storage.claimGA4RefreshWork).not.toHaveBeenCalled();
      });
    });
    it("automatically claims a native campaign in the scheduled pipeline", async () => {
      campaigns.splice(1);
      await runGA4DailyRefreshPipelineForTrigger("scheduled");
      expect(mocks.storage.ensureGA4RefreshWork).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", new Date("2026-10-16T06:00:00Z"), reportingDate, { suppressAlerts: false });
      expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(1);
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(true);
      expect(getGA4DailySchedulerStatus().inProgress).toBe(false);
    });
    it("keeps scheduled native recovery at two concurrent campaigns", async () => {
      campaigns.push({ ...campaigns[0], id: "campaign-c", ownerId: "campaign-c-owner" });
      let active = 0, maximum = 0;
      let release!: () => void;
      const gate = new Promise<void>(resolve => { release = resolve; });
      const rows = await mocks.provider.getTimeSeriesData(); mocks.provider.getTimeSeriesData.mockClear();
      mocks.provider.getTimeSeriesData.mockImplementation(async () => {
        active++; maximum = Math.max(maximum, active); await gate; active--; return rows;
      });
      const running = runGA4DailyRefreshPipelineForTrigger("scheduled");
      await vi.advanceTimersByTimeAsync(0);
      expect(maximum).toBe(2); expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
      release(); await running;
      expect(maximum).toBe(2); expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(3);
    });
    it.each(["pending", "running"])("resumes discovered %s work with its original due slot", async status => {
      // A restarted server has no financial-source observations from the former process.
      financialObservation.beginFinancialDailySnapshotRefreshObservation("financial_sources");
      const dueAt = new Date(Date.now() - 60_000);
      mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue([{ id: "work-a", campaignId: "campaign-a", status,
        dueAt, reportingDate, scope: { campaign: { ownerId: "campaign-a-owner" } }, suppressAlerts: false }]);
      await recoverInterruptedGA4Refreshes();
      expect(mocks.storage.ensureGA4RefreshWork).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", dueAt, reportingDate, { suppressAlerts: false });
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(true);
    });
    it("runs a saved revenue change through the existing coordinated pipeline for only the requested campaign", async () => {
      const dueAt = new Date(Date.now() - 60_000);
      mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue(["campaign-b", "campaign-a"].map(campaignId => ({ id: `work-${campaignId}`, campaignId,
        dueAt, reportingDate, scope: { kind: "revenue_change", campaign: { ownerId: `${campaignId}-owner` } }, suppressAlerts: false })));
      await recoverInterruptedGA4Refreshes("campaign-a");
      expect(mocks.storage.ensureGA4RefreshWork).toHaveBeenCalledExactlyOnceWith("campaign-a", "campaign-a-owner", dueAt, reportingDate, { suppressAlerts: false, revenueChange: true });
      expect(mocks.recompute).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "campaign-a", refreshScope: scope }));
      expect(mocks.storage.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({ campaignId: "campaign-a", revenuePublication: { version: 1, reportingDate, sources: {}, pendingSourceIds: [] } }));
      expect(mocks.aggregate).toHaveBeenCalledWith("campaign-a", expect.objectContaining({ refreshScope: scope }));
      expect(mocks.executive).toHaveBeenCalledTimes(1);
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(true);
    });
    it("retargets unfinished revenue work after midnight without publishing the old cutoff", async () => {
      mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue([{ id: "work-a", campaignId: "campaign-a", dueAt: new Date(Date.now() - 60_000),
        reportingDate: "2026-10-14", scope: { kind: "revenue_change", campaign: { ownerId: "campaign-a-owner" } } }]);
      await recoverInterruptedGA4Refreshes();
      expect(mocks.storage.ensureGA4RefreshWork).toHaveBeenCalledWith("campaign-a", "campaign-a-owner", expect.any(Date), reportingDate, { revenueChange: true });
      expect(mocks.storage.claimGA4RefreshWork).not.toHaveBeenCalled();
      expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    });
    describe("revenue publication from verified saved inputs", () => {
      const revenueOptions = () => ({ ...options(), revenueChange: true });
      const seedSavedInputs = async () => {
        await refreshAllGA4DailyMetrics({ campaignId: "campaign-a" });
        overviews.get("campaign-a").updatedAt = new Date("2026-10-16T05:59:00Z");
        const actual = await vi.importActual<typeof import("./utils/campaign-current-values")>("./utils/campaign-current-values");
        mocks.totals.mockImplementation(actual.getCampaignMetricTotals);
        mocks.storage.getRevenueSources.mockResolvedValue([source("campaign-a", "revenue")]);
        mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 100, currency: "EUR", sourceIds: ["campaign-a-revenue"] });
        for (const mock of Object.values(mocks.provider)) mock.mockClear();
        mocks.storage.replaceGA4DailyMetricsWindow.mockClear();
      };
      const expectNoProviderRefresh = () => {
        for (const [name, mock] of Object.entries(mocks.provider)) {
          if (name !== "withAbortSignal") expect(mock, name).not.toHaveBeenCalled();
        }
        expect(fetch).not.toHaveBeenCalled();
        expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
      };
      it("publishes saved revenue with the real saved-total selector, preserving native timestamps and all downstream gates", async () => {
        await seedSavedInputs();
        const nativeBefore = structuredClone(overviews.get("campaign-a"));
        await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
        expectNoProviderRefresh();
        expect(saved.get("campaign-a").inputs.revenue.value).toBe("600.00");
        expect(overviews.get("campaign-a")).toEqual(nativeBefore);
        expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("ga4_daily", "campaign-a"))
          .toMatchObject({ basis: "saved_inputs", completedAt: "2026-10-16T05:59:00.000Z", status: "success" });
        expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("financial_sources", "campaign-a"))
          .toMatchObject({ basis: "saved_inputs", status: "success" });
        expect(mocks.recompute).toHaveBeenCalledExactlyOnceWith({ campaignId: "campaign-a", suppressAlerts: true, useSavedOverview: true, refreshScope: scope });
        expect(mocks.aggregate).toHaveBeenCalledExactlyOnceWith("campaign-a", { allowScheduledGA4: true, refreshScope: scope });
        expect(mocks.executive).toHaveBeenCalledTimes(1);
        expect(mocks.kpiAlerts).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate, { refreshScope: scope });
        expect(mocks.benchmarkAlerts).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate, { refreshScope: scope });
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(true);
      });
      it.each(["missing overview", "old window", "wrong campaign", "wrong property", "wrong currency", "missing history", "changed scope", "old timestamp", "future timestamp", "missing daily row", "simulated row", "invalid daily value", "wrong daily campaign", "multiple connections"])(
        "falls back to the existing full refresh for %s", async fault => {
          await seedSavedInputs();
          const overview = overviews.get("campaign-a");
          if (fault === "missing overview") overviews.delete("campaign-a");
          if (fault === "old window") overview.windowEnd = "2026-10-14";
          if (fault === "wrong campaign") overview.campaignId = "campaign-b";
          if (fault === "wrong property") overview.propertyId = "other-property";
          if (fault === "wrong currency") overview.campaignBreakdown.meta.currencyCode = "USD";
          if (fault === "missing history") delete overview.campaignBreakdown.meta.dailyHistoryRefresh;
          if (fault === "changed scope") overview.campaignBreakdown.meta.dailyHistoryRefresh.scope = "prior-selection";
          if (fault === "old timestamp") overview.updatedAt = new Date("2026-10-15T05:59:00Z");
          if (fault === "future timestamp") overview.updatedAt = new Date("2026-10-17T05:59:00Z");
          if (fault === "missing daily row") daily.set("campaign-a", []);
          if (fault === "simulated row") daily.get("campaign-a")![0].isSimulated = true;
          if (fault === "invalid daily value") daily.get("campaign-a")![0].conversions = "bad";
          if (fault === "wrong daily campaign") daily.get("campaign-a")![0].campaignId = "campaign-b";
          if (fault === "multiple connections") mocks.storage.getGA4Connections.mockResolvedValue([connection("campaign-a"), { ...connection("campaign-a"), id: "second" }]);
          await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
          expect(mocks.provider.getTimeSeriesData).toHaveBeenCalled();
          expect(mocks.storage.replaceGA4DailyMetricsWindow).toHaveBeenCalled();
          expect(saved.get("campaign-a").inputs.revenue.value).toBe("600.00");
          expect(financialObservation.getFinancialDailySnapshotRefreshEvidence("ga4_daily", "campaign-a")?.basis).toBeUndefined();
        },
      );
      it.each(["scheduled", "manual"])("keeps %s refreshes on the provider path even with reusable inputs", async trigger => {
        await seedSavedInputs();
        await runGA4DailyRefreshPipelineForTrigger(trigger, options());
        expect(mocks.provider.getTimeSeriesData).toHaveBeenCalled();
      });
      it.each(["hubspot", "salesforce", "shopify", "google_sheets", "csv", "manual", "custom"])(
        "reuses normalized %s revenue without reprocessing the source", async sourceType => {
          await seedSavedInputs();
          mocks.storage.getRevenueSources.mockResolvedValue([{ ...source("campaign-a", "revenue"), sourceType }]);
          await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
          expectNoProviderRefresh();
          expect(saved.get("campaign-a").inputs.revenue.value).toBe("600.00");
        },
      );
      it.each([0, 250])("recomputes from the full saved amount after removal/edit to EUR %s", async amount => {
        await seedSavedInputs();
        mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: amount, currency: "EUR", sourceIds: amount ? ["campaign-a-revenue"] : [] });
        if (!amount) mocks.storage.getRevenueSources.mockResolvedValue([]);
        await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
        expectNoProviderRefresh();
        expect(saved.get("campaign-a").inputs.revenue.value).toBe((500 + amount).toFixed(2));
      });
      it("does not let a caller label ordinary work as a revenue change", async () => {
        await seedSavedInputs();
        mocks.storage.ensureGA4RefreshWork.mockResolvedValue({ id: "work-a", status: "pending", scope: { kind: "scheduled" } });
        await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
        expect(mocks.provider.getTimeSeriesData).toHaveBeenCalled();
      });
      it.each(["getRevenueTotalForRange", "getSpendTotalForRange", "getRevenueBreakdownBySource", "getSpendBreakdownBySource"] as const)(
        "does not reuse saved inputs when %s fails", async method => {
          await seedSavedInputs();
          mocks.storage[method].mockRejectedValueOnce(new Error("unverified source records"));
          await runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions());
          expect(mocks.provider.getTimeSeriesData).toHaveBeenCalled();
        },
      );
      it.each(["KPI", "financial receipt", "aggregate", "executive", "alerts"])("retains pending work when the saved-input %s stage fails", async stage => {
        await seedSavedInputs();
        if (stage === "KPI") mocks.recompute.mockRejectedValue(new Error("KPI recompute failed"));
        if (stage === "financial receipt") mocks.storage.upsertFinancialDailySnapshot.mockRejectedValue(new Error("GA4_REFRESH_PUBLICATION_CHANGED"));
        if (stage === "aggregate") mocks.aggregate.mockResolvedValue(false);
        if (stage === "executive") mocks.executive.mockResolvedValue(false);
        if (stage === "alerts") mocks.kpiAlerts.mockRejectedValue(new Error("alert decision failed"));
        await expect(runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions())).rejects.toThrow();
        expectNoProviderRefresh();
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(false);
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "release")).toBe(true);
      });
      it("rejects ownership loss during saved-input validation before recomputing or publishing", async () => {
        await seedSavedInputs();
        mocks.storage.getGA4OverviewSnapshot.mockImplementation(async id => { live = false; return overviews.get(id); });
        await expect(runGA4DailyRefreshPipelineForTrigger("recovery", revenueOptions())).rejects.toThrow("OWNERSHIP_LOST");
        expectNoProviderRefresh();
        expect(mocks.recompute).not.toHaveBeenCalled();
        expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
      });
    });
    it.each(["__autoRefreshInProgress", "__googleSheetsSpendRefreshInProgress", "__salesforcePipelineRefreshInProgress"])("leaves queued work for the next poll while %s is busy", async flag => {
      (global as any)[flag] = true;
      try { await recoverInterruptedGA4Refreshes("campaign-a"); expect(mocks.storage.getRecoverableGA4RefreshWork).not.toHaveBeenCalled(); }
      finally { (global as any)[flag] = false; }
    });
    it.each(["owner", "date", "missing", "unsupported"])("rejects a discovered work item with changed %s", async mismatch => {
      mocks.storage.getRecoverableGA4RefreshWork.mockResolvedValue([{ id: "work-a", campaignId: "campaign-a", dueAt: new Date(Date.now() - 60_000),
        reportingDate: mismatch === "date" ? "2026-10-14" : reportingDate, scope: { campaign: { ownerId: mismatch === "owner" ? "other-owner" : "campaign-a-owner" } } }]);
      if (mismatch === "missing") campaigns.splice(0);
      if (mismatch === "unsupported") mocks.storage.isGA4NativeRecoveryEligible.mockResolvedValue(false);
      await recoverInterruptedGA4Refreshes();
      expect(mocks.storage.claimGA4RefreshWork).not.toHaveBeenCalled();
      expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
    });
    it.each([["temporary", true], ["expired credentials", false]] as const)("persists correct retry classification for %s", async (kind, retryable) => {
      mocks.provider.getTimeSeriesData.mockRejectedValueOnce(kind === "temporary"
        ? Object.assign(new Error("Temporary unavailable"), { code: "GA4_TRANSIENT_ERROR" }) : new Error("TOKEN_EXPIRED"));
      await expect(runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options())).rejects.toThrow();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.find(call => call[4] === "release")?.[7]).toMatchObject({ retryable });
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    });
    it("preserves manual suppression and completes without declaring report readiness", async () => {
      await runGA4DailyRefreshPipelineForTrigger("manual", { ...options(), suppressAlerts: true });
      expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(false);
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete_without_alerts")).toBe(true);
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "release")).toBe(false);
    });
    it.each(['getTimeSeriesData', 'getAcquisitionBreakdown', 'getLandingPagesReport', 'getConversionEventsReport'] as const)(
      'retains saved figures and blocks all derived publication when %s reports a quality restriction', async method => {
        await runGA4DailyRefreshPipelineForTrigger('snapshot_bootstrap', options());
        const previous = structuredClone({ daily: [...daily], overviews: [...overviews], financial: [...saved] });
        vi.clearAllMocks();
        mocks.provider[method].mockRejectedValue(Object.assign(new Error('GA4_DATA_QUALITY_UNAVAILABLE: sampling'), { code: 'GA4_DATA_QUALITY_UNAVAILABLE' }));
        await expect(runGA4DailyRefreshPipelineForTrigger('snapshot_bootstrap', options())).rejects.toThrow('GA4_DATA_QUALITY_UNAVAILABLE');
        expect({ daily: [...daily], overviews: [...overviews], financial: [...saved] }).toEqual(previous);
        expect(mocks.recompute).not.toHaveBeenCalled(); expect(mocks.aggregate).not.toHaveBeenCalled(); expect(mocks.executive).not.toHaveBeenCalled();
        expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
        expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === 'complete')).toBe(false);
      });
    it("carries the owning claim into native credential renewal without read-side backfills", async () => {
      const rows = await mocks.provider.getTimeSeriesData();
      mocks.provider.getTimeSeriesData.mockImplementationOnce(async (_id, providerStorage) => {
        await providerStorage.updateGA4ConnectionTokens("campaign-a-connection", { accessToken: "renewed" });
        return rows;
      });
      await runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options());
      expect(mocks.storage.updateGA4ConnectionTokens).toHaveBeenCalledExactlyOnceWith("campaign-a-connection", { accessToken: "renewed" }, { refreshScope: scope });
      expect(mocks.storage.getGA4Connections).toHaveBeenCalledWith("campaign-a", { migrateLegacyTokens: false });
      const dependency = mocks.provider.getTimeSeriesData.mock.calls.at(-1)![1];
      for (const method of [mocks.provider.getAcquisitionBreakdown, mocks.provider.getLandingPagesReport, mocks.provider.getConversionEventsReport]) {
        expect(method.mock.calls[0][1]).toBe(dependency);
      }
    });
    it.each(["claim", "completed", "source", "source-read", "no-filter"])("does not touch saved data after %s rejection", async mode => {
      if (mode === "claim") mocks.storage.claimGA4RefreshWork.mockResolvedValue(undefined);
      if (mode === "completed") mocks.storage.ensureGA4RefreshWork.mockResolvedValue({ id: "work-a", status: "completed" });
      if (mode === "source") mocks.storage.isGA4NativeRecoveryEligible.mockResolvedValue(false);
      if (mode === "source-read") mocks.storage.getSpendSources.mockRejectedValue(new Error("read failed"));
      if (mode === "no-filter") campaigns[0].ga4CampaignFilter = "";
      const result = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options());
      if (mode === "completed") await result; else await expect(result).rejects.toThrow();
      expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
      expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).not.toHaveBeenCalled();
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    });
    it.each(["recompute", "financial", "aggregate", "executive", "kpi-alert", "benchmark-alert"])("stops downstream publication after ownership loss during %s", async stage => {
      const method = ({ recompute: mocks.recompute, financial: mocks.storage.upsertFinancialDailySnapshot,
        aggregate: mocks.aggregate, executive: mocks.executive, "kpi-alert": mocks.kpiAlerts, "benchmark-alert": mocks.benchmarkAlerts })[stage]!;
      const original = method.getMockImplementation();
      method.mockImplementationOnce(async (...args) => { const result = await original?.(...args); live = false; return result; });
      await expect(runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options())).rejects.toThrow();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(false);
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).not.toHaveBeenCalled();
      expect(await getGA4AlignedRefreshState("campaign-a", reportingDate)).toBeNull();
    });
    it("renews while a provider read waits and stops its timer when the run ends", async () => {
      let release!: (value: any) => void;
      const rows = await mocks.provider.getTimeSeriesData();
      mocks.provider.getTimeSeriesData.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
      const pending = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options());
      await vi.advanceTimersByTimeAsync(30_000);
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.filter(call => call[4] === "renew").length).toBeGreaterThan(1);
      release(rows); await pending;
      const count = mocks.storage.updateGA4RefreshWorkLease.mock.calls.length;
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mocks.storage.updateGA4RefreshWorkLease).toHaveBeenCalledTimes(count);
    });
    it.each(["stop", "lease-loss", "deadline"])("ends a stuck owned run on %s without waiting for the provider reply", async mode => {
      mocks.provider.getTimeSeriesData.mockImplementationOnce(() => new Promise(() => {}));
      const outcome = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options()).then(() => null, error => error);
      await vi.advanceTimersByTimeAsync(0);
      const signal = mocks.provider.withAbortSignal.mock.calls[0][0] as AbortSignal;
      expect(signal.aborted).toBe(false);
      if (mode === "stop") stopGA4DailyScheduler();
      if (mode === "lease-loss") { live = false; await vi.advanceTimersByTimeAsync(30_000); }
      if (mode === "deadline") await vi.advanceTimersByTimeAsync(900_000);
      expect(await outcome).toBeInstanceOf(Error); expect(signal.aborted).toBe(true);
      expect(getGA4DailySchedulerStatus().inProgress).toBe(false);
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(false);
    });
    it("bounds cleanup even when a database renewal and release never settle", async () => {
      mocks.provider.getTimeSeriesData.mockImplementationOnce(() => new Promise(() => {}));
      const outcome = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options()).catch(error => error);
      await vi.advanceTimersByTimeAsync(0);
      mocks.storage.updateGA4RefreshWorkLease.mockImplementation(() => new Promise(() => {}));
      await vi.advanceTimersByTimeAsync(30_000); stopGA4DailyScheduler();
      await vi.advanceTimersByTimeAsync(24_000);
      expect(await outcome).toBeInstanceOf(Error);
      expect(getGA4DailySchedulerStatus().inProgress).toBe(false);
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
    });
    it("retains the ordinary caller when durable recovery is explicitly disabled", async () => {
      vi.stubEnv("GA4_DURABLE_RECOVERY_ENABLED", "false");
      await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
      expect(mocks.storage.ensureGA4RefreshWork).not.toHaveBeenCalled();
      expect(mocks.storage.claimGA4RefreshWork).not.toHaveBeenCalled();
    });
    it.each(["stop", "lease-loss", "deadline", "next-day", "source-added"])("discards a late provider response after %s", async mode => {
      let release!: (value: any) => void;
      const rows = await mocks.provider.getTimeSeriesData();
      mocks.provider.getTimeSeriesData.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
      const outcome = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options()).then(() => null, error => error);
      await vi.advanceTimersByTimeAsync(0);
      if (mode === "stop") stopGA4DailyScheduler();
      if (mode === "lease-loss") { live = false; await vi.advanceTimersByTimeAsync(30_000); }
      if (mode === "deadline") await vi.advanceTimersByTimeAsync(900_000);
      if (mode === "next-day") vi.setSystemTime(new Date("2026-10-17T06:00:00Z"));
      if (mode === "source-added") {
        mocks.storage.getRevenueSources.mockResolvedValue([source("campaign-a", "revenue")]);
        live = false; // Real ordinary source saves invalidate the persisted lease; PostgreSQL coverage verifies this.
      }
      release(rows);
      expect(await outcome).toBeInstanceOf(Error);
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
      expect(mocks.recompute).not.toHaveBeenCalled(); expect(mocks.executive).not.toHaveBeenCalled();
      expect(mocks.storage.updateGA4RefreshWorkLease.mock.calls.some(call => call[4] === "complete")).toBe(false);
    });
    it("does not clear a replacement run's busy flag or status when the stopped run returns", async () => {
      const rows = await mocks.provider.getTimeSeriesData();
      let releaseOld!: (value: any) => void, releaseNew!: (value: any) => void;
      mocks.provider.getTimeSeriesData.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }))
        .mockImplementationOnce(() => new Promise(resolve => { releaseNew = resolve; }));
      const old = runGA4DailyRefreshPipelineForTrigger("snapshot_bootstrap", options()).catch(error => error);
      await vi.advanceTimersByTimeAsync(0);
      stopGA4DailyScheduler();
      const replacement = runGA4DailyRefreshPipelineForCampaignNow("campaign-b");
      await vi.advanceTimersByTimeAsync(0);
      releaseOld(rows); expect(await old).toBeInstanceOf(Error);
      expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: true, lastRunStatus: "running", lastRunTrigger: "manual" });
      releaseNew(rows); await replacement;
      expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: false, lastRunStatus: "success" });
      expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls.map(call => call[0])).toEqual(["campaign-b"]);
    });
  });

  it("publishes matching GA4, external Revenue and Spend using the existing financial contract", async () => {
    expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("completed");
    expect(saved.get("campaign-a")).toMatchObject({
      campaignId: "campaign-a", reportingDate, currency: "EUR",
      inputs: { revenue: { value: "800.00", available: true }, spend: { value: "100.00", available: true }, conversions: { value: 25, available: true } },
    });
    expect(mocks.aggregate).toHaveBeenCalledWith("campaign-a", { allowScheduledGA4: true, ...ordinary("campaign-a") });
    expect(getAutoRefreshSchedulerStatus().lastRunStatus).toBe("success");
    expect(getGA4DailySchedulerStatus().lastRunStatus).toBe("success");
    expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate, ordinary("campaign-a"));
    expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mock.invocationCallOrder[0]).toBeLessThan(mocks.storage.getRevenueSources.mock.invocationCallOrder[0]);
    expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled(); expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });
  it("reports a failed connection/token lookup instead of treating it as an absent connection", async () => {
    await refreshAllGA4DailyMetrics(); const before = structuredClone(overviews.get("campaign-a"));
    mocks.storage.getGA4Connections.mockImplementation(async id => {
      if (id === "campaign-a") throw new DOMException("Token lookup timed out", "TimeoutError");
      return [connection(id)];
    });
    const result = await refreshAllGA4DailyMetrics();
    expect(result.campaignIdsFailed).toEqual(["campaign-a"]);
    expect(result.campaignIdsSkipped).not.toContain("campaign-a");
    expect(result.campaignIdsProcessed).toEqual(["campaign-b"]);
    expect(overviews.get("campaign-a")).toEqual(before);
  });
  it("classifies an exhausted temporary provider failure without publishing a replacement", async () => {
    await refreshAllGA4DailyMetrics(); const before = structuredClone(overviews.get("campaign-a"));
    mocks.provider.getTimeSeriesData.mockRejectedValue(Object.assign(new Error("Temporary failure"), { code: "GA4_TRANSIENT_ERROR" }));
    const result = await refreshAllGA4DailyMetrics({ campaignId: "campaign-a" });
    expect(result.failureReasonsByCampaign?.["campaign-a"]).toEqual(["daily_series:GA4_TRANSIENT_ERROR"]);
    expect(result.campaignIdsFailed).toEqual(["campaign-a"]);
    expect(overviews.get("campaign-a")).toEqual(before);
  });

  it("rebuilds a missing first financial publication for an already-active native-only campaign", async () => {
    campaigns = campaigns.slice(0, 1);
    mocks.storage.getRevenueSources.mockResolvedValue([]); mocks.storage.getSpendSources.mockResolvedValue([]);
    mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    mocks.totals.mockImplementation(async () => ({ ...totals(), revenue: 500, spend: 0 }));
    await refreshAllGA4DailyMetrics({ campaignId: "campaign-a" });
    expect(saved.has("campaign-a")).toBe(false);
    mocks.storage.getLatestGA4DailyMetric.mockImplementation(async id => daily.get(id)?.at(-1));
    mocks.storage.getFinancialDailyComparisonData.mockImplementation(async id => ({ current: saved.has(id) ? { metrics: { financialDaily: saved.get(id) } } : null, previous: null }));
    expect(await backfillMissingGA4OverviewSnapshots()).toEqual(["campaign-a"]);
    expect(saved.get("campaign-a")).toMatchObject({ campaignId: "campaign-a", reportingDate, currency: "EUR", inputs: {
      revenue: { available: true, value: "500.00", sources: ["ga4"] }, spend: { available: false, value: null },
    } });
    expect(saved.has("campaign-b")).toBe(false);
    expect(campaigns[0].status).toBe("active");
  });
  it.each(["getGA4Connections", "getGA4OverviewSnapshot", "getFinancialDailyComparisonData"] as const)("isolates a startup %s failure and repairs the next campaign", async method => {
    mocks.storage.getRevenueSources.mockResolvedValue([]); mocks.storage.getSpendSources.mockResolvedValue([]);
    mocks.storage.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [] });
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    mocks.totals.mockImplementation(async () => ({ ...totals(), revenue: 500, spend: 0 }));
    await refreshAllGA4DailyMetrics();
    const original = structuredClone(overviews.get("campaign-a"));
    mocks.storage.getLatestGA4DailyMetric.mockImplementation(async id => daily.get(id)?.at(-1));
    mocks.storage.getFinancialDailyComparisonData.mockResolvedValue({ current: null, previous: null });
    const lookup = mocks.storage[method].getMockImplementation()!;
    mocks.storage[method].mockImplementation(async (...args: any[]) => {
      if (args[0] === "campaign-a") throw new Error("SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED");
      return lookup(...args);
    });
    expect(await backfillMissingGA4OverviewSnapshots()).toEqual(["campaign-b"]);
    expect(saved.get("campaign-b")).toMatchObject({ inputs: {
      revenue: { available: true, value: "500.00" }, spend: { available: false, value: null },
    } });
    expect(saved.has("campaign-a")).toBe(false);
    expect(overviews.get("campaign-a")).toEqual(original);
    expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toEqual([
      { campaignIdHash: expect.stringMatching(/^[a-f0-9]{12}$/), reason: "discovery: SERVICE_ACCOUNT_RESOURCE_NOT_GRANTED" },
    ]);
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
    expect(mocks.aggregate).toHaveBeenCalledExactlyOnceWith(recovered, { allowScheduledGA4: true, ...ordinary(recovered) });
    expect(mocks.executive).toHaveBeenCalledExactlyOnceWith("http://127.0.0.1:5000", recovered);
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate, "2026-10-16T18:00:42.000Z", ordinary(recovered));
    expect(mocks.kpiAlerts).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate, ordinary(recovered));
    expect(mocks.benchmarkAlerts).toHaveBeenCalledExactlyOnceWith(recovered, reportingDate, ordinary(recovered));
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled(); expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
    if (failFirst) {
      expect(saved.get("campaign-a")).toEqual(prior);
      expect(markers.has("campaign-a")).toBe(false);
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toHaveLength(1);
    } else {
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toEqual([]);
      expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).toHaveBeenCalledExactlyOnceWith("campaign-a", reportingDate, ordinary("campaign-a"));
      expect(mocks.storage.getRevenueSources.mock.calls.every(([id]) => id === "campaign-a")).toBe(true);
      vi.clearAllMocks();
      stopGA4DailyScheduler(); startGA4DailyScheduler(5000);
      await vi.advanceTimersByTimeAsync(0);
      expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
      expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
      expect(mocks.kpiAlerts).not.toHaveBeenCalled(); expect(mocks.benchmarkAlerts).not.toHaveBeenCalled();
    }
  });

  it.each([6, 12, 18].flatMap(hour => [false, true].map(fails => [hour, fails] as const)))(
    "keeps the %s:00 UTC slot pending while startup recovery runs (recovery fails: %s)", async (hour, fails) => {
      const due = new Date(`2026-10-16T${String(hour).padStart(2, "0")}:00:00Z`);
      vi.setSystemTime(new Date(due.getTime() - 1000));
      const scheduledRuns = getGA4DailySchedulerStatus().totalScheduledRuns;
      const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      mocks.provider.getTimeSeriesData.mockImplementationOnce(async (...args) => {
        await pending;
        if (fails) throw new Error("startup provider failure");
        return read(...args);
      });
      startGA4DailyScheduler(5000);
      try {
        await vi.advanceTimersByTimeAsync(1000);
        await vi.advanceTimersByTimeAsync(120000);
        expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(1);
        expect(mocks.storage.replaceGA4DailyMetricsWindow).not.toHaveBeenCalled();
        expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).not.toHaveBeenCalled();
        expect(getGA4DailySchedulerStatus()).toMatchObject({
          inProgress: true, lastRunStatus: "running", nextRunAt: due.toISOString(),
          totalScheduledRuns: scheduledRuns,
        });
        expect(vi.getTimerCount()).toBe(2);
      } finally { release(); await vi.advanceTimersByTimeAsync(0); }
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toHaveLength(fails ? 1 : 0);
      vi.clearAllMocks();
      await vi.advanceTimersByTimeAsync(59999);
      expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(getGA4DailySchedulerStatus()).toMatchObject({
        inProgress: false, lastRunTrigger: "scheduled", lastRunStatus: "success",
        totalScheduledRuns: scheduledRuns + 1,
        nextRunAt: hour === 18 ? "2026-10-17T06:00:00.000Z" : `2026-10-16T${hour + 6}:00:00.000Z`,
      });
      expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls.map(([id]) => id).sort()).toEqual(["campaign-a", "campaign-b"]);
      for (const { id } of campaigns) {
        expect(saved.get(id)).toMatchObject({
          campaignId: id, reportingDate, currency: "EUR",
          inputs: { revenue: { value: "800.00" }, spend: { value: "100.00" }, conversions: { value: 25 } },
        });
        expect(await getScheduledReportAlignedRefreshGate(report(id))).toEqual({ ready: true });
      }
      await vi.advanceTimersByTimeAsync(60000);
      expect(getGA4DailySchedulerStatus().totalScheduledRuns).toBe(scheduledRuns + 1);
      expect(vi.getTimerCount()).toBe(2);
    },
  );

  it.each(["deleted", "paused", "inactive", "draft", "stop", "restart", "provider failure"])(
    "rechecks campaign eligibility and respects shutdown/failure after deferral: %s", async change => {
      vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
      mocks.storage.getCampaigns.mockResolvedValueOnce([]); // Exercise overlap with a targeted manual refresh.
      startGA4DailyScheduler(5000);
      await vi.advanceTimersByTimeAsync(0);
      const scheduledRuns = getGA4DailySchedulerStatus().totalScheduledRuns;
      const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
      let release!: () => void;
      const pending = new Promise<void>(resolve => { release = resolve; });
      mocks.provider.getTimeSeriesData.mockImplementationOnce(async (...args) => { await pending; return read(...args); });
      const manual = runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
      try {
        await vi.advanceTimersByTimeAsync(1000);
        expect(getGA4DailySchedulerStatus().nextRunAt).toBe("2026-10-16T06:00:00.000Z");
        expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(1);
      } finally { release(); await manual; }
      vi.clearAllMocks();
      const previous = structuredClone(saved.get("campaign-a"));
      if (change === "deleted") campaigns = campaigns.filter(c => c.id !== "campaign-a");
      else if (["paused", "inactive", "draft"].includes(change)) campaigns[0].status = change;
      else if (change === "stop") stopGA4DailyScheduler();
      else if (change === "restart") { stopGA4DailyScheduler(); startGA4DailyScheduler(5000); }
      else mocks.provider.getTimeSeriesData.mockRejectedValueOnce(new Error("TOKEN_EXPIRED"));
      await vi.advanceTimersByTimeAsync(60000);
      if (change === "stop") {
        expect(getGA4DailySchedulerStatus()).toMatchObject({ timerScheduled: false, nextRunAt: null, totalScheduledRuns: scheduledRuns });
        expect(mocks.storage.getCampaigns).not.toHaveBeenCalled();
        expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
        expect(vi.getTimerCount()).toBe(0);
      } else if (change === "restart") {
        expect(getGA4DailySchedulerStatus()).toMatchObject({
          lastRunTrigger: "snapshot_bootstrap", lastRunStatus: "success", nextRunAt: "2026-10-16T12:00:00.000Z",
          totalScheduledRuns: scheduledRuns,
        });
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-a", "campaign-b"]);
        expect(vi.getTimerCount()).toBe(2);
      } else {
        expect(getGA4DailySchedulerStatus()).toMatchObject({
          inProgress: false, lastRunStatus: change === "provider failure" ? "failed" : "success",
          totalScheduledRuns: scheduledRuns + 1, nextRunAt: "2026-10-16T12:00:00.000Z",
        });
        expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
        expect(saved.get("campaign-a")).toEqual(previous);
        if (change !== "provider failure") expect(mocks.storage.getRevenueSources.mock.calls.every(([id]) => id === "campaign-b")).toBe(true);
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
      }
      await vi.advanceTimersByTimeAsync(60000);
      expect(getGA4DailySchedulerStatus().totalScheduledRuns).toBe(scheduledRuns + (["stop", "restart"].includes(change) ? 0 : 1));
    },
  );

  it.each(["during", "after"].flatMap(timing => [false, true].map(fails => [timing, fails] as const)))(
    "rechecks startup candidates when discovery finishes %s another run (provider fails: %s)", async (timing, fails) => {
      vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
      mocks.storage.getLatestGA4DailyMetric.mockImplementation(async id => daily.get(id)?.at(-1));
      mocks.storage.getFinancialDailyComparisonData.mockImplementation(async id => ({ current: { metrics: { financialDaily: saved.get(id) } }, previous: null }));
      let discover!: () => void, finish!: () => void;
      const discoveryPending = new Promise<void>(resolve => { discover = resolve; });
      const providerPending = new Promise<void>(resolve => { finish = resolve; });
      mocks.storage.getGA4Connections.mockImplementationOnce(async id => { await discoveryPending; return [connection(id)]; });
      const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
      mocks.provider.getTimeSeriesData.mockImplementationOnce(async (...args) => {
        await providerPending;
        if (fails) throw new Error("TOKEN_EXPIRED");
        return read(...args);
      });
      startGA4DailyScheduler(5000);
      let completedOther: any;
      try {
        await vi.advanceTimersByTimeAsync(1000);
        expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
        expect(saved.has("campaign-a")).toBe(false);
        completedOther = structuredClone(saved.get("campaign-b"));
        expect(completedOther).toBeDefined();
        if (timing === "during") {
          discover();
          await vi.advanceTimersByTimeAsync(3000);
          expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
          expect(getGA4DailySchedulerStatus().lastRunStatus).toBe("running");
        }
        finish(); await vi.advanceTimersByTimeAsync(0);
        if (timing === "after") discover();
        await vi.advanceTimersByTimeAsync(1000);
        expect(mocks.provider.getTimeSeriesData.mock.calls.map(([id]) => id).sort()).toEqual(
          fails ? ["campaign-a", "campaign-a", "campaign-b"] : ["campaign-a", "campaign-b"],
        );
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id).sort()).toEqual(["campaign-a", "campaign-b"]);
        expect(saved.get("campaign-b")).toEqual(completedOther);
        for (const { id } of campaigns) {
          expect(saved.get(id)).toMatchObject({ campaignId: id, reportingDate, inputs: { revenue: { value: "800.00" }, spend: { value: "100.00" } } });
          expect(await getScheduledReportAlignedRefreshGate(report(id))).toEqual({ ready: true });
        }
        expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: false, nextRunAt: "2026-10-16T12:00:00.000Z" });
        expect(vi.getTimerCount()).toBe(2);
      } finally { discover(); finish(); await vi.advanceTimersByTimeAsync(1000); }
    },
  );

  it.each(["deleted", "paused", "disconnected"])("rechecks %s campaigns after waiting for an ongoing refresh", async change => {
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    mocks.storage.getLatestGA4DailyMetric.mockImplementation(async id => daily.get(id)?.at(-1));
    mocks.storage.getFinancialDailyComparisonData.mockImplementation(async id => ({ current: { metrics: { financialDaily: saved.get(id) } }, previous: null }));
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    mocks.provider.getTimeSeriesData.mockImplementationOnce(async () => { await pending; throw new Error("interrupted provider"); });
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(1000);
    const recovery = backfillMissingGA4OverviewSnapshots();
    try {
      await vi.advanceTimersByTimeAsync(2000);
      expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
      if (change === "deleted") campaigns = campaigns.filter(c => c.id !== "campaign-a");
      else if (change === "paused") campaigns[0].status = "paused";
      else mocks.storage.getGA4Connections.mockImplementation(async id => id === "campaign-a" ? [] : [connection(id)]);
      finish(); await vi.advanceTimersByTimeAsync(1000);
      expect(await recovery).toEqual([]);
      expect(mocks.provider.getTimeSeriesData).toHaveBeenCalledTimes(2);
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
      expect(vi.getTimerCount()).toBe(2);
    } finally { finish(); await vi.advanceTimersByTimeAsync(1000); await recovery; }
  });

  it.each(["waiting", "discovering"])("cancels old startup recovery on scheduler stop while %s", async phase => {
    const run = vi.fn(async () => undefined);
    let release!: () => void;
    const pending = new Promise<void>(resolve => { release = resolve; });
    if (phase === "waiting") (global as any).__ga4DailyRefreshInProgress = true;
    else mocks.storage.getCampaigns.mockImplementationOnce(async () => { await pending; return campaigns; });
    const recovery = backfillMissingGA4OverviewSnapshots(run);
    try {
      await vi.advanceTimersByTimeAsync(2000);
      expect(run).not.toHaveBeenCalled();
      stopGA4DailyScheduler();
      release(); await vi.advanceTimersByTimeAsync(1000);
      expect(await recovery).toEqual([]);
      expect(run).not.toHaveBeenCalled();
      expect(vi.getTimerCount()).toBe(0);
    } finally { (global as any).__ga4DailyRefreshInProgress = false; release(); await vi.advanceTimersByTimeAsync(1000); await recovery; }
  });

  it("retains recovery failure evidence and does not retry an attempted campaign after a later overlap", async () => {
    let finish!: () => void;
    const pending = new Promise<void>(resolve => { finish = resolve; });
    const read = mocks.provider.getTimeSeriesData.getMockImplementation()!;
    mocks.provider.getTimeSeriesData.mockImplementationOnce(async (...args) => { await pending; return read(...args); });
    let concurrent: Promise<unknown> | undefined;
    const run = vi.fn(async (_trigger, opts) => {
      if (opts.campaignId === "campaign-a") {
        concurrent = runGA4DailyRefreshPipelineForCampaignNow("campaign-b");
        throw new Error("recovery source failure");
      }
    });
    const recovery = backfillMissingGA4OverviewSnapshots(run);
    try {
      await vi.advanceTimersByTimeAsync(2000);
      expect(run.mock.calls.map(([, opts]) => opts.campaignId)).toEqual(["campaign-a"]);
      finish(); await concurrent; await vi.advanceTimersByTimeAsync(1000);
      expect(await recovery).toEqual(["campaign-a", "campaign-b"]);
      expect(run.mock.calls.map(([, opts]) => opts.campaignId)).toEqual(["campaign-a", "campaign-b"]);
      expect(getGA4DailySchedulerStatus().lastSnapshotBootstrapFailures).toEqual([
        { campaignIdHash: expect.any(String), reason: "recovery source failure" },
      ]);
    } finally { finish(); await concurrent; await vi.advanceTimersByTimeAsync(1000); await recovery; }
  });

  it("does not refresh any source when durable readiness invalidation fails", async () => {
    mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment.mockRejectedValue(new Error("readiness storage unavailable"));
    await expect(runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).rejects.toThrow("readiness storage unavailable");
    expect(mocks.storage.getRevenueSources).not.toHaveBeenCalled();
    expect(mocks.provider.getTimeSeriesData).not.toHaveBeenCalled();
    expect(mocks.storage.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it.each(["headers", "body"])("retains the saved publication, releases the worker and recovers after a native GA4 %s timeout", async phase => {
    await runGA4DailyRefreshPipelineForCampaignNow("campaign-a");
    const previous = { financial: structuredClone(saved.get("campaign-a")), overview: structuredClone(overviews.get("campaign-a")), daily: structuredClone(daily.get("campaign-a")) };
    vi.clearAllMocks();
    vi.setSystemTime(new Date("2026-10-16T05:59:59Z"));
    mocks.storage.getCampaigns.mockResolvedValueOnce([]);
    vi.spyOn(AbortSignal, "timeout").mockImplementation(ms => {
      const controller = new AbortController();
      setTimeout(() => controller.abort(new DOMException("The operation was aborted due to timeout", "TimeoutError")), ms);
      return controller.signal;
    });
    const original = mocks.provider.getTimeSeriesData.getMockImplementation()!;
    const { ga4Service: actual } = await vi.importActual<typeof import("./analytics")>("./analytics");
    mocks.provider.getTimeSeriesData.mockImplementation(async (...args) => args[0] === "campaign-a"
      ? (actual.getTimeSeriesData as any)(...args) : original(...args));
    let cancelled = false, finishLate!: (value: any) => void;
    vi.mocked(fetch).mockImplementation(async (_url, init) => {
      const signal = init!.signal!;
      expect(signal).toBeInstanceOf(AbortSignal);
      const pending = () => new Promise<any>((resolve, reject) => {
        finishLate = resolve;
        signal.addEventListener("abort", () => { cancelled = true; reject(phase === "headers" ? signal.reason : new DOMException("The operation was aborted", "AbortError")); }, { once: true });
      });
      return phase === "headers" ? pending() : { ok: true, json: pending } as any;
    });
    startGA4DailyScheduler(5000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-b"))).toEqual({ ready: true });
    await vi.advanceTimersByTimeAsync(119999);
    expect(getGA4DailySchedulerStatus().inProgress).toBe(true);
    await vi.advanceTimersByTimeAsync(1);
    expect(cancelled).toBe(true);
    expect(getGA4DailySchedulerStatus()).toMatchObject({ inProgress: false, lastRunStatus: "failed" });
    expect(getAutoRefreshSchedulerStatus().inProgress).toBe(false);
    expect(mocks.storage.replaceGA4DailyMetricsWindow.mock.calls.map(([id]) => id)).toEqual(["campaign-b"]);
    expect(mocks.recompute.mock.calls.map(([opts]) => opts.campaignId)).toEqual(["campaign-b"]);
    expect(await getScheduledReportAlignedRefreshGate(report("campaign-a"))).toMatchObject({ ready: false });
    finishLate({ rows: [] });
    await vi.advanceTimersByTimeAsync(0);
    expect(saved.get("campaign-a")).toEqual(previous.financial);
    expect(overviews.get("campaign-a")).toEqual(previous.overview);
    expect(daily.get("campaign-a")).toEqual(previous.daily);
    expect(fetch).toHaveBeenCalledTimes(1);
    mocks.provider.getTimeSeriesData.mockImplementation(original);
    expect(await runGA4DailyRefreshPipelineForCampaignNow("campaign-a")).toBe("completed");
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
    expect(mocks.storage.updateKPI).toHaveBeenCalledWith("native-revenue", { currentValue: "500", ...ordinary("campaign-a") });
    expect(mocks.storage.updateBenchmark).toHaveBeenCalledWith("traffic-sessions", { currentValue: "100", ...ordinary("campaign-a") });
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
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith(finishedCampaign, reportingDate, expect.any(String), ordinary(finishedCampaign));
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
      expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, expect.any(String), ordinary("campaign-b"));
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
        expect(update).toHaveBeenCalledWith(`${id}-revenue`, { currentValue: revenue, ...ordinary(id) });
        expect(update).toHaveBeenCalledWith(`${id}-cpa`, { currentValue: cpa, ...ordinary(id) });
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
        expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledWith(id, reportingDate, expect.any(String), ordinary(id));
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
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledWith("campaign-b", reportingDate, expect.any(String), ordinary("campaign-b"));
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
    expect(mocks.kpiAlerts).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, ordinary("campaign-b"));
    expect(mocks.benchmarkAlerts).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, ordinary("campaign-b"));
    expect(mocks.storage.markExecutiveSummaryDailySnapshotAligned).toHaveBeenCalledExactlyOnceWith("campaign-b", reportingDate, expect.any(String), ordinary("campaign-b"));
    expect(mocks.globalKpiAlerts).not.toHaveBeenCalled();
    expect(mocks.globalBenchmarkAlerts).not.toHaveBeenCalled();
  });
});
