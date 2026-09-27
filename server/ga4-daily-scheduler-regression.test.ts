import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, vi } from "vitest";
import { GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION, ga4Service } from "./analytics";
import { backfillMissingGA4OverviewSnapshots, getGA4DailyRecomputeFailure, getGA4DailyRefreshFailure, getGA4DailySchedulerConfig, getNextGA4DailyRunAt, isGA4AlignedRefreshReady, refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { storage } from "./storage";

const schedulerSource = () => readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");
const aggregateSnapshotSchedulerSource = () => readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");
const kpiSchedulerSource = () => readFileSync(join(process.cwd(), "server", "kpi-scheduler.ts"), "utf-8");

describe("GA4 daily scheduler timing", () => {
  afterEach(() => vi.restoreAllMocks());
  it("defaults to a controlled 03:00 UTC daily run with startup disabled", () => {
    expect(getGA4DailySchedulerConfig({} as any)).toEqual({
      reportingTimeZone: "UTC",
      hour: 3,
      minute: 0,
      runOnStartup: false,
    });
  });

  it("uses configured reporting timezone, clamps invalid schedule values, and keeps startup disabled", () => {
    expect(getGA4DailySchedulerConfig({
      GA4_DAILY_REFRESH_TIME_ZONE: "Europe/Amsterdam",
      GA4_DAILY_REFRESH_HOUR: "99",
      GA4_DAILY_REFRESH_MINUTE: "-2",
      GA4_DAILY_REFRESH_RUN_ON_STARTUP: "true",
    } as any)).toEqual({
      reportingTimeZone: "Europe/Amsterdam",
      hour: 23,
      minute: 0,
      runOnStartup: false,
    });
  });

  it("calculates the next Amsterdam 03:00 run across local midnight", () => {
    const config = {
      reportingTimeZone: "Europe/Amsterdam",
      hour: 3,
      minute: 0,
      runOnStartup: false,
    };

    expect(getNextGA4DailyRunAt(new Date("2026-06-20T22:30:00.000Z"), config).toISOString()).toBe("2026-06-21T01:00:00.000Z");
    expect(getNextGA4DailyRunAt(new Date("2026-06-21T02:30:00.000Z"), config).toISOString()).toBe("2026-06-22T01:00:00.000Z");
  });

  it("keeps scheduler logs, startup control, and overlap protection explicit", () => {
    const source = schedulerSource();

    expect(source).toContain("GA4_DAILY_REFRESH_TIME_ZONE");
    expect(source).toContain("GA4_DAILY_REFRESH_HOUR");
    expect(source).toContain("GA4_DAILY_REFRESH_MINUTE");
    expect(source).not.toContain("GA4_DAILY_REFRESH_RUN_ON_STARTUP");
    expect(source).not.toContain('runGA4DailyRefreshPipelineForTrigger("startup")');
    expect(source).toContain('await runPipeline("snapshot_bootstrap", { campaignId, suppressAlerts: true })');
    expect(source).toContain("backfillMissingGA4OverviewSnapshots()");
    expect(source).toContain("type GA4DailyRefreshPipelineOptions");
    expect(source).not.toContain("export async function runGA4DailyRefreshPipeline");
    expect(source).toContain("const campaignId = String(opts.campaignId || \"\").trim();");
    expect(source).toContain("const campaigns = campaignId");
    expect(source).toContain("runGA4DailyKPIAndBenchmarkJobs({ campaignId: processedCampaignId, suppressAlerts: true })");
    expect(source).toContain("[GA4 Daily] KPI/Benchmark recompute result");
    expect(source).toContain("recomputeEvidence[key].push(...recomputeResult[key])");
    expect(source).toContain("lastRecomputeRecordedAt = new Date()");
    expect(source).toContain("kpiIdsUpdated: hashEvidenceIds(recomputeEvidence.kpiIdsUpdated)");
    expect(source).toContain("kpiIdsSkipped: hashEvidenceIds(recomputeEvidence.kpiIdsSkipped)");
    expect(source).toContain("kpiIdsFailed: hashEvidenceIds(recomputeEvidence.kpiIdsFailed)");
    expect(source).toContain("benchmarkIdsUpdated: hashEvidenceIds(recomputeEvidence.benchmarkIdsUpdated)");
    expect(source).toContain("benchmarkIdsSkipped: hashEvidenceIds(recomputeEvidence.benchmarkIdsSkipped)");
    expect(source).toContain("benchmarkIdsFailed: hashEvidenceIds(recomputeEvidence.benchmarkIdsFailed)");
    expect(source).toContain("if (!campaignId && !opts.suppressAlerts) {");
    expect(source).toContain("Next scheduled run at");
    expect(source).toContain("const dataThroughDate = getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt);");
    expect(source).toContain("dataThroughDate=${dataThroughDate}");
    expect(source).toContain("__ga4DailyRefreshInProgress");
    expect(source).toContain("Skipping ${trigger} pipeline (already in progress)");
    expect(source).not.toContain("setInterval(() =>");
    expect(source).toContain('await runDailyAutoRefreshOnce("scheduled", {');
    expect(source.indexOf('await runDailyAutoRefreshOnce("scheduled", {')).toBeLessThan(
      source.indexOf("const refreshResult = await refreshAllGA4DailyMetrics({ campaignId });"),
    );
  });

  it("releases downstream report readiness only for the completed aligned reporting date", () => {
    const state = { reportingDate: "2026-09-26", completedAt: "2026-09-27T03:05:00.000Z" };
    expect(isGA4AlignedRefreshReady(state, "2026-09-26")).toBe(true);
    expect(isGA4AlignedRefreshReady(state, "2026-09-27")).toBe(false);
    expect(isGA4AlignedRefreshReady(null, "2026-09-26")).toBe(false);
  });

  it("publishes GA4 campaign snapshots only inside the ordered daily pipeline", () => {
    const source = schedulerSource();
    const aggregateSource = aggregateSnapshotSchedulerSource();

    expect(source.indexOf("await writeFinancialDailySnapshotIfReady")).toBeLessThan(source.indexOf("await recordCampaignMetrics(processedCampaignId"));
    expect(source.indexOf("await recordCampaignMetrics(processedCampaignId")).toBeLessThan(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl"));
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl")).toBeLessThan(source.indexOf("await checkGA4PerformanceAlertsForCampaign"));
    expect(source.indexOf("await checkGA4PerformanceAlertsForCampaign")).toBeLessThan(source.indexOf("alignedRefreshByCampaign.set"));
    expect(aggregateSource).toContain("if (!opts.allowScheduledGA4)");
    expect(aggregateSource).toContain("snapshot is owned by the ordered GA4 daily pipeline");
    expect(kpiSchedulerSource()).toContain('GA4_DAILY_PIPELINE_OWNS_RECOMPUTE || "true"');
    expect(kpiSchedulerSource()).toContain("Skipping duplicate KPI/Benchmark recompute and alert sweeps because the GA4 daily pipeline owns them");
  });

  it("bootstraps only campaign-scoped Overview snapshots that are missing or out of sync", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([
      { id: "campaign-missing", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-mismatched", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-outdated", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-currency-missing", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-current", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-unscoped", ga4CampaignFilter: null },
    ] as any);
    vi.spyOn(storage, "getGA4Connections").mockImplementation(async (campaignId: string) => [{
      campaignId,
      propertyId: `properties/${campaignId}`,
      importStartDate: "2026-08-01",
      isActive: true,
    }] as any);
    vi.spyOn(storage, "getGA4OverviewSnapshot").mockImplementation(async (campaignId: string) => {
      if (campaignId === "campaign-current") return {
        windowStart: "2026-08-01",
        windowEnd: "2026-08-05",
        campaignBreakdown: { meta: { currencyCode: "USD" } },
        conversionEvents: { version: GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION },
      } as any;
      if (campaignId === "campaign-currency-missing") return {
        windowStart: "2026-08-01",
        windowEnd: "2026-08-05",
        campaignBreakdown: { meta: {} },
        conversionEvents: { version: GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION },
      } as any;
      if (campaignId === "campaign-outdated") return {
        windowStart: "2026-08-01",
        windowEnd: "2026-08-05",
        conversionEvents: { rows: [{ eventName: "purchase", conversions: 145, eventCount: null, users: null }] },
      } as any;
      if (campaignId === "campaign-mismatched") return {
        windowStart: "2026-08-01",
        windowEnd: "2026-08-04",
      } as any;
      return undefined;
    });
    vi.spyOn(storage, "getLatestGA4DailyMetric").mockResolvedValue({ date: "2026-08-05" } as any);
    const runPipeline = vi.fn(async () => undefined);

    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual(["campaign-missing", "campaign-mismatched", "campaign-outdated", "campaign-currency-missing"]);
    expect(runPipeline).toHaveBeenCalledTimes(4);
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-missing",
      suppressAlerts: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-mismatched",
      suppressAlerts: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-outdated",
      suppressAlerts: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-currency-missing",
      suppressAlerts: true,
    });
  });

  it("keeps expected unavailable skips observable without failing the global run", () => {
    const base = {
      campaignsProcessed: 1,
      campaignIdsProcessed: ["campaign-ok"],
      campaignIdsSkipped: ["campaign-unconfigured"],
      campaignIdsFailed: [],
      kpiIdsUpdated: ["kpi-ok"],
      kpiIdsSkipped: ["kpi-unavailable"],
      kpiIdsFailed: [],
      benchmarkIdsUpdated: ["benchmark-ok"],
      benchmarkIdsSkipped: ["benchmark-unavailable"],
      benchmarkIdsFailed: [],
    };

    expect(getGA4DailyRecomputeFailure(base, false)).toBeNull();
    expect(getGA4DailyRecomputeFailure({ ...base, benchmarkIdsFailed: ["benchmark-failed"] }, false)).toContain("1 Benchmark");
    expect(getGA4DailyRecomputeFailure({ ...base, campaignsProcessed: 0 }, true)).toContain("target campaign");
  });

  it("isolates partial refresh failures from successfully refreshed campaign recompute", async () => {
    const source = schedulerSource();
    const finalFailureCheck = "if (refreshFailure || alignedRefreshFailures.length > 0)";
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([
      { id: "campaign-ok" },
      { id: "campaign-failed" },
    ] as any);

    const result = await runGA4DailyKPIAndBenchmarkJobs({
      campaignIds: ["campaign-ok"],
      suppressAlerts: true,
    });

    expect(result.campaignIdsSkipped).toEqual(["campaign-ok"]);
    expect(source).toContain("for (const processedCampaignId of refreshResult.campaignIdsProcessed)");
    expect(source).toContain("alignedRefreshFailures.push({ campaignId: processedCampaignId, stage: \"kpi_benchmark_recompute_failed\" })");
    expect(source.indexOf("const recomputeResult = await runGA4DailyKPIAndBenchmarkJobs")).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source.indexOf('recordFinancialDailySnapshotRefreshEvidence("ga4_daily"')).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl, processedCampaignId)")).toBeGreaterThan(
      source.indexOf("await writeFinancialDailySnapshotIfReady({ campaignId: processedCampaignId, reportingDate })"),
    );
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl, processedCampaignId)")).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source.indexOf("alignedRefreshByCampaign.set(processedCampaignId")).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source).toContain("if (!refreshFailure && alignedRefreshFailures.length === 0) {");
    expect(source).toContain("Skipping global alert sweeps because ${refreshFailure || `${alignedRefreshFailures.length} campaign stage(s) failed`}");
  });

  it("fails a targeted run when its provider refresh failed or was skipped", () => {
    const result = {
      campaignIdsProcessed: ["campaign-ok"],
      campaignIdsSkipped: ["campaign-skipped"],
      campaignIdsFailed: ["campaign-failed"],
      propertyIdsProcessed: ["properties/1"],
      propertyIdsFailed: ["properties/2"],
      rowsUpserted: 1,
      reportingDatesByCampaign: {},
      failureReasonsByCampaign: { "campaign-failed": ["overview_reconciliation:GA4_OVERVIEW_RECONCILIATION_FAILED"] },
    };
    expect(getGA4DailyRefreshFailure(result, "campaign-ok")).toBeNull();
    expect(getGA4DailyRefreshFailure(result, "campaign-failed")).toContain("overview_reconciliation:GA4_OVERVIEW_RECONCILIATION_FAILED");
    expect(getGA4DailyRefreshFailure(result, "campaign-skipped")).toContain("skipped");
    expect(getGA4DailyRefreshFailure(result, "")).toContain("1 campaign");
    expect(getGA4DailyRefreshFailure({ ...result, campaignIdsFailed: [] }, "")).toBeNull();
  });

  it("fetches and persists daily values for the exact saved property and campaign scope", () => {
    const source = schedulerSource();

    expect(source).toContain("const campaignFilter = parseGA4CampaignFilter((c as any)?.ga4CampaignFilter);");
    expect(source).toContain("const reportingWindow = getReportingDateWindow(lookbackDays, (c as any)?.reportingTimeZone, now);");
    expect(source).toContain("for (const connection of activeConnections)");
    expect(source).toContain("connection?.isActive !== false");
    expect(source).toContain("const storageStartDate =");
    expect(source).toMatch(/getTimeSeriesData\([\s\S]*?propertyId,\s*campaignFilter,\s*reportingWindow\.endDate,/);
    expect(source).toContain("getTrendsDailyPresenceWithToken(");
    expect(source).toContain("GA4 reported activity for a date without a complete daily metric row");
    expect(source).toContain("const completeRows = getDateRange(storageStartDate, reportingWindow.endDate)");
    expect(source).toContain("row.date > reportingWindow.endDate");
    expect(source.indexOf("row.date > reportingWindow.endDate")).toBeLessThan(source.indexOf("storage.replaceGA4DailyMetricsWindow("));
    expect(source).toMatch(/replaceGA4DailyMetricsWindow\([\s\S]*?currentCampaignId,[\s\S]*?propertyId,[\s\S]*?storageStartDate,[\s\S]*?reportingWindow\.endDate,[\s\S]*?completeRows as any/);
  });

  it("materializes explicit zero rows for every absent completed date and excludes inactive properties", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", reportingTimeZone: "UTC", currency: "USD" }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([
      { propertyId: "properties/active-1", importStartDate: "2026-08-03", isActive: true },
      { propertyId: "properties/active-2", importStartDate: "2026-08-03", isActive: true },
      { propertyId: "properties/inactive", isActive: false },
    ] as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockImplementation(async (_campaign, _storage, startDate, propertyId, _filter, endDate) => [{
      date: endDate,
      sessions: propertyId === "properties/active-1" ? 1 : 2,
    }]);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockImplementation(async (_campaignId, _propertyId, _startDate, _endDate, rows) => ({ replaced: rows.length }));

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result).toMatchObject({
      campaignIdsProcessed: ["campaign-1"],
      campaignIdsFailed: [],
      propertyIdsProcessed: ["properties/active-1", "properties/active-2"],
      propertyIdsFailed: [],
      rowsUpserted: 6,
    });
    expect(ga4Service.getTimeSeriesData).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace.mock.calls.map((call) => call[1])).toEqual(["properties/active-1", "properties/active-2"]);
    for (const call of replace.mock.calls) {
      expect(call.slice(2, 4)).toEqual(["2026-08-03", "2026-08-05"]);
      expect(call[4].map((row: any) => row.date)).toEqual(["2026-08-03", "2026-08-04", "2026-08-05"]);
      expect(call[4].slice(0, 2)).toEqual([
        expect.objectContaining({ sessions: 0, users: 0, conversions: 0, revenue: 0 }),
        expect.objectContaining({ sessions: 0, users: 0, conversions: 0, revenue: 0 }),
      ]);
    }
  });

  it("preserves last-good storage instead of writing a false zero for provider activity without a complete row", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter" }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{ propertyId: "properties/active", importStartDate: "2026-08-03", isActive: true }] as any);
    vi.spyOn(storage, "getGA4Connection").mockResolvedValue({ propertyId: "properties/active", accessToken: "fresh-token" } as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue([{ date: "2026-08-05", sessions: 1 }] as any);
    vi.spyOn(ga4Service, "getTrendsDailyPresenceWithToken").mockResolvedValue({
      dailyRows: [{ date: "2026-08-05", sessions: 1 }],
      presentDates: ["2026-08-04", "2026-08-05"],
    } as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 3 } as any);

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsFailed).toEqual(["campaign-1"]);
    expect(result.propertyIdsFailed).toEqual(["properties/active"]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("preserves last-good storage when any provider daily value is invalid", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", reportingTimeZone: "UTC", currency: "USD" }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{ propertyId: "properties/active", importStartDate: "2026-08-03", isActive: true }] as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue([{ date: "2026-08-05", sessions: "not-a-number" }] as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 1 } as any);

    const result = await refreshAllGA4DailyMetrics(undefined, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsFailed).toEqual(["campaign-1"]);
    expect(result.propertyIdsFailed).toEqual(["properties/active"]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("publishes all Overview tables atomically with reconciled scheduler facts", async () => {
    const dailyRows = [
      { date: "2026-08-02", sessions: 0, conversions: 0, revenue: 0 },
      { date: "2026-08-03", sessions: 4, conversions: 1, revenue: 10 },
      { date: "2026-08-04", sessions: 6, conversions: 1, revenue: 10 },
      { date: "2026-08-05", sessions: 0, conversions: 0, revenue: 0 },
    ];
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{
      id: "campaign-1", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
    }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{
      propertyId: "properties/active", importStartDate: "2026-08-02", isActive: true,
    }] as any);
    vi.spyOn(storage, "getGA4Connection").mockResolvedValue({
      propertyId: "properties/active", accessToken: "token",
    } as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue(dailyRows as any);
    vi.spyOn(ga4Service, "getTrendsDailyPresenceWithToken").mockResolvedValue({
      dailyRows, presentDates: dailyRows.map((row) => row.date),
    } as any);
    vi.spyOn(storage, "getGA4DailyMetrics").mockResolvedValue([] as any);
    vi.spyOn(ga4Service, "getAcquisitionBreakdown").mockResolvedValue({
      rows: [{ campaign: "saved-filter", sessions: 10, conversions: 2, revenue: 20.02 }],
      totals: { sessions: 10, conversions: 2, revenue: 20.02 },
      meta: { currencyCode: "USD" },
    } as any);
    vi.spyOn(ga4Service, "getLandingPagesReport").mockResolvedValue({ rows: [], totals: {} } as any);
    const conversionEvents = vi.spyOn(ga4Service, "getConversionEventsReport").mockResolvedValue({
      rows: [{ eventName: "purchase", conversions: 2 }], totals: { conversions: 2 },
    } as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 4 } as any);

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsProcessed).toEqual(["campaign-1"]);
    expect(conversionEvents).toHaveBeenCalledWith(
      "campaign-1", storage, "2026-08-02", "properties/active", 50, "saved-filter", "2026-08-05", false,
      { "2026-08-02": 0, "2026-08-03": 1, "2026-08-04": 1, "2026-08-05": 0 },
    );
    expect(replace).toHaveBeenCalledTimes(1);
    expect(replace.mock.calls[0][5]).toMatchObject({
      windowStart: "2026-08-02",
      windowEnd: "2026-08-05",
      campaignBreakdown: { totals: { sessions: 10, conversions: 2, revenue: 20.02 } },
      conversionEvents: { totals: { conversions: 2 } },
    });
  });

  it("keeps the last complete Overview snapshot when the provider report currency is not verified", async () => {
    const dailyRows = [{ date: "2026-08-05", sessions: 4, conversions: 1, revenue: 10 }];
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{
      id: "campaign-1", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
    }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{
      propertyId: "properties/active", importStartDate: "2026-08-05", isActive: true,
    }] as any);
    vi.spyOn(storage, "getGA4Connection").mockResolvedValue({ propertyId: "properties/active", accessToken: "token" } as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue(dailyRows as any);
    vi.spyOn(ga4Service, "getTrendsDailyPresenceWithToken").mockResolvedValue({ dailyRows, presentDates: ["2026-08-05"] } as any);
    vi.spyOn(storage, "getGA4DailyMetrics").mockResolvedValue([] as any);
    vi.spyOn(ga4Service, "getAcquisitionBreakdown").mockResolvedValue({
      totals: { sessions: 4, conversions: 1, revenue: 10 }, rows: [], meta: {},
    } as any);
    vi.spyOn(ga4Service, "getLandingPagesReport").mockResolvedValue({ rows: [], totals: {} } as any);
    vi.spyOn(ga4Service, "getConversionEventsReport").mockResolvedValue({ rows: [], totals: { conversions: 1 } } as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 1 } as any);

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsFailed).toEqual(["campaign-1"]);
    expect(result.failureReasonsByCampaign).toEqual({
      "campaign-1": ["overview_campaign_breakdown:GA4_CURRENCY_UNVERIFIED"],
    });
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps the last complete Overview snapshot when detail totals do not reconcile", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{
      id: "campaign-1", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
    }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{
      propertyId: "properties/active", importStartDate: "2026-08-05", isActive: true,
    }] as any);
    vi.spyOn(storage, "getGA4Connection").mockResolvedValue({ propertyId: "properties/active", accessToken: "token" } as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue([{ date: "2026-08-05", sessions: 4, conversions: 1, revenue: 10 }] as any);
    vi.spyOn(ga4Service, "getTrendsDailyPresenceWithToken").mockResolvedValue({
      dailyRows: [{ date: "2026-08-05", sessions: 4, conversions: 1, revenue: 10 }], presentDates: ["2026-08-05"],
    } as any);
    vi.spyOn(storage, "getGA4DailyMetrics").mockResolvedValue([] as any);
    vi.spyOn(ga4Service, "getAcquisitionBreakdown").mockResolvedValue({ totals: { sessions: 4, conversions: 1, revenue: 10 }, rows: [], meta: { currencyCode: "USD" } } as any);
    vi.spyOn(ga4Service, "getLandingPagesReport").mockResolvedValue({ rows: [], totals: {} } as any);
    vi.spyOn(ga4Service, "getConversionEventsReport").mockResolvedValue({ rows: [], totals: { conversions: 2 } } as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 1 } as any);

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsFailed).toEqual(["campaign-1"]);
    expect(result.failureReasonsByCampaign).toEqual({
      "campaign-1": ["overview_reconciliation:GA4_OVERVIEW_RECONCILIATION_FAILED:event_conversions_unknown_high"],
    });
    expect(replace).not.toHaveBeenCalled();
  });
});
