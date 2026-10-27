import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, beforeEach, vi } from "vitest";
import { GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION, ga4Service } from "./analytics";
import { backfillMissingGA4OverviewSnapshots, getGA4AlignedRefreshState, getGA4DailyRecomputeFailure, getGA4DailyRefreshFailure, getGA4DailySchedulerConfig, getNextGA4DailyRunAt, isGA4AlignedRefreshReady, parseGA4AlignedRefreshMarker, refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { storage } from "./storage";

const schedulerSource = () => readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");
const aggregateSnapshotSchedulerSource = () => readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");
const kpiSchedulerSource = () => readFileSync(join(process.cwd(), "server", "kpi-scheduler.ts"), "utf-8");
beforeEach(() => {
  vi.spyOn(storage, "getGA4PublicationVersion").mockResolvedValue(null);
  vi.spyOn(storage, "getCampaign").mockImplementation(async id => (await storage.getCampaigns()).find(campaign => campaign.id === id));
});

describe("GA4 startup recovery after a missed scheduled slot", () => {
  let campaign: any;
  let marker: string | null;
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T18:00:42Z"));
    vi.stubEnv("GA4_DAILY_REFRESH_TIME_ZONE", "Europe/Amsterdam");
    vi.stubEnv("GA4_DAILY_REFRESH_HOURS", "8,14,20");
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "0");
    campaign = { id: "ptomo", ownerId: "owner", clientId: "client", status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: "saved-filter" };
    marker = "ga4_aligned_refresh_v1:2026-10-16:2026-10-17T12:12:40Z";
    vi.spyOn(storage, "getCampaigns").mockImplementation(async () => [campaign]);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{
      id: "connection", campaignId: "ptomo", propertyId: "542352127", importStartDate: "2026-09-04", isActive: true, isPrimary: true,
    }] as any);
    vi.spyOn(storage, "getGA4OverviewSnapshot").mockResolvedValue({
      windowStart: "2026-09-04", windowEnd: "2026-10-16", updatedAt: new Date("2026-10-17T12:10:25Z"),
      campaignBreakdown: { meta: { currencyCode: "EUR" } }, conversionEvents: { version: GA4_CONVERSION_EVENTS_SNAPSHOT_VERSION },
    } as any);
    vi.spyOn(storage, "getLatestGA4DailyMetric").mockResolvedValue({ date: "2026-10-16", updatedAt: new Date("2026-10-17T12:10:25Z") } as any);
    vi.spyOn(storage, "getSpendSources").mockResolvedValue([]);
    vi.spyOn(storage, "getFinancialDailyComparisonData").mockImplementation(async () => ({
      current: { metrics: { financialDaily: {
        currency: "EUR", currentValueWindow: { startDate: "2026-09-04", reportingTimeZone: campaign.reportingTimeZone },
        inputs: { revenue: { available: true, value: "0.00" }, conversions: { available: true, value: 0 }, spend: { available: false } },
      } } }, previous: null,
    } as any));
    vi.spyOn(storage, "getExecutiveSummaryDailyComparisonData").mockImplementation(async () => ({ current: { notes: marker }, previous: null } as any));
  });
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });

  it.each([
    ["missed 20:00 refresh", "ga4_aligned_refresh_v1:2026-10-16:2026-10-17T12:12:40Z"],
    ["interrupted publication", null],
    ["invalid completion time", "ga4_aligned_refresh_v1:2026-10-16:invalid"],
    ["different reporting date", "ga4_aligned_refresh_v1:2026-10-15:2026-10-17T18:00:30Z"],
    ["future completion time", "ga4_aligned_refresh_v1:2026-10-16:2026-10-17T19:00:00Z"],
  ])("recovers %s through the scoped financial and GA4 pipeline", async (_case, notes) => {
    marker = notes;
    const runPipeline = vi.fn(async () => undefined);
    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual(["ptomo"]);
    expect(runPipeline).toHaveBeenCalledExactlyOnceWith("snapshot_bootstrap", {
      campaignId: "ptomo", suppressAlerts: false, refreshFinancialSources: true,
    });
    expect(storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("ptomo", "2026-10-16", "2026-10-16");
  });

  it.each([
    ["already completed 20:00", "2026-10-17T18:15:00Z", "2026-10-16", "2026-10-17T18:12:40Z"],
    ["before 14:00", "2026-10-17T11:59:59Z", "2026-10-16", "2026-10-17T06:12:40Z"],
    ["before 08:00", "2026-10-17T05:59:59Z", "2026-10-15", "2026-10-16T18:12:40Z"],
    ["after midnight", "2026-10-17T22:15:00Z", "2026-10-16", "2026-10-17T18:12:40Z"],
  ])("skips a complete publication %s", async (_case, now, date, completedAt) => {
    vi.setSystemTime(new Date(now)); marker = `ga4_aligned_refresh_v1:${date}:${completedAt}`;
    const runPipeline = vi.fn(async () => undefined);
    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual([]);
    expect(runPipeline).not.toHaveBeenCalled();
  });

  it("recovers a missed evening slot after midnight without treating 08:00 as due", async () => {
    vi.setSystemTime(new Date("2026-10-17T22:15:00Z"));
    const runPipeline = vi.fn(async () => undefined);
    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual(["ptomo"]);
    expect(storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("ptomo", "2026-10-16", "2026-10-16");
  });

  it.each([
    ["2026-10-17T18:29:59Z", "2026-10-17T12:42:00Z", false],
    ["2026-10-17T18:30:42Z", "2026-10-17T12:42:00Z", true],
    ["2026-10-17T18:45:00Z", "2026-10-17T18:42:00Z", false],
  ])("honors the configured minute at %s", async (now, completedAt, overdue) => {
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "30");
    vi.setSystemTime(new Date(now)); marker = `ga4_aligned_refresh_v1:2026-10-16:${completedAt}`;
    const runPipeline = vi.fn(async () => undefined);
    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual(overdue ? ["ptomo"] : []);
  });

  it.each([
    ["2026-03-29T18:00:42Z", "2026-03-28", "2026-03-29T12:12:40Z"],
    ["2026-10-25T19:00:42Z", "2026-10-24", "2026-10-25T13:12:40Z"],
  ])("recovers the local 20:00 slot across daylight saving at %s", async (now, date, completedAt) => {
    vi.setSystemTime(new Date(now)); marker = `ga4_aligned_refresh_v1:${date}:${completedAt}`;
    await expect(backfillMissingGA4OverviewSnapshots(vi.fn(async () => undefined))).resolves.toEqual(["ptomo"]);
    expect(storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("ptomo", date, date);
  });

  it("looks up the campaign's reporting date at the scheduler's due slot", async () => {
    campaign.reportingTimeZone = "Asia/Tokyo";
    marker = "ga4_aligned_refresh_v1:2026-10-17:2026-10-17T18:00:30Z";
    await expect(backfillMissingGA4OverviewSnapshots(vi.fn(async () => undefined))).resolves.toEqual([]);
    expect(storage.getExecutiveSummaryDailyComparisonData).toHaveBeenCalledWith("ptomo", "2026-10-17", "2026-10-17");
  });

  it.each(["draft", "inactive", "archived"])("does not recover a %s campaign", async (status) => {
    campaign.status = status;
    await expect(backfillMissingGA4OverviewSnapshots(vi.fn(async () => undefined))).resolves.toEqual([]);
    expect(storage.getGA4Connections).not.toHaveBeenCalled();
  });

  it("does not recover a campaign without an active connection or selected campaign filter", async () => {
    vi.mocked(storage.getGA4Connections).mockResolvedValue([]);
    await expect(backfillMissingGA4OverviewSnapshots(vi.fn(async () => undefined))).resolves.toEqual([]);
    expect(storage.getExecutiveSummaryDailyComparisonData).not.toHaveBeenCalled();
    campaign.ga4CampaignFilter = null;
    vi.mocked(storage.getGA4Connections).mockClear();
    await expect(backfillMissingGA4OverviewSnapshots(vi.fn(async () => undefined))).resolves.toEqual([]);
    expect(storage.getGA4Connections).not.toHaveBeenCalled();
  });
});

describe("GA4 daily scheduler timing", () => {
  beforeEach(() => vi.spyOn(storage, "getGA4OverviewSnapshot").mockResolvedValue(undefined));
  afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); vi.unstubAllEnvs(); });
  it("defaults to a controlled 03:00 UTC daily run with startup disabled", () => {
    expect(getGA4DailySchedulerConfig({} as any)).toEqual({
      reportingTimeZone: "UTC",
      hour: 3,
      hours: [3],
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
      hours: [23],
      minute: 0,
      runOnStartup: false,
    });
  });

  it("uses sorted unique configured run hours and keeps the legacy hour as the fallback", () => {
    expect(getGA4DailySchedulerConfig({
      GA4_DAILY_REFRESH_TIME_ZONE: "Europe/Amsterdam",
      GA4_DAILY_REFRESH_HOUR: "6",
      GA4_DAILY_REFRESH_HOURS: "20,8,14,14,invalid,24",
      GA4_DAILY_REFRESH_MINUTE: "0",
    } as any)).toEqual({
      reportingTimeZone: "Europe/Amsterdam",
      hour: 8,
      hours: [8, 14, 20],
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

  it("calculates each configured Amsterdam catch-up run and then advances to the next day", () => {
    const config = {
      reportingTimeZone: "Europe/Amsterdam",
      hour: 8,
      hours: [8, 14, 20],
      minute: 0,
      runOnStartup: false,
    };

    expect(getNextGA4DailyRunAt(new Date("2026-06-21T05:30:00.000Z"), config).toISOString()).toBe("2026-06-21T06:00:00.000Z");
    expect(getNextGA4DailyRunAt(new Date("2026-06-21T07:00:00.000Z"), config).toISOString()).toBe("2026-06-21T12:00:00.000Z");
    expect(getNextGA4DailyRunAt(new Date("2026-06-21T13:00:00.000Z"), config).toISOString()).toBe("2026-06-21T18:00:00.000Z");
    expect(getNextGA4DailyRunAt(new Date("2026-06-21T19:00:00.000Z"), config).toISOString()).toBe("2026-06-22T06:00:00.000Z");
  });

  it("keeps scheduler logs, startup control, and overlap protection explicit", () => {
    const source = schedulerSource();

    expect(source).toContain("GA4_DAILY_REFRESH_TIME_ZONE");
    expect(source).toContain("GA4_DAILY_REFRESH_HOUR");
    expect(source).toContain("GA4_DAILY_REFRESH_HOURS");
    expect(source).toContain("GA4_DAILY_REFRESH_MINUTE");
    expect(source).not.toContain("GA4_DAILY_REFRESH_RUN_ON_STARTUP");
    expect(source).not.toContain('runGA4DailyRefreshPipelineForTrigger("startup")');
    expect(source).toContain('await runPipeline("snapshot_bootstrap", {');
    expect(source).toContain("financialBootstrapCampaignIds.has(campaignId) ? { refreshFinancialSources: true } : {}");
    expect(source).toContain("backfillMissingGA4OverviewSnapshots()");
    expect(source).toContain("type GA4DailyRefreshPipelineOptions");
    expect(source).toContain("export async function runGA4DailyRefreshPipelineForCampaignNow");
    expect(source).toContain("const campaignId = String(opts.campaignId || \"\").trim();");
    expect(source).toContain("const campaigns = filterActiveSchedulerCampaigns(");
    expect(source).toContain('opts.includeTargetDraft ? campaignId : ""');
    expect(source).toContain("runGA4DailyKPIAndBenchmarkJobs({ campaignId: processedCampaignId, suppressAlerts: true, useSavedOverview: true, ...writeInputFor(processedCampaignId) })");
    expect(source).toContain("[GA4 Daily] KPI/Benchmark recompute result");
    expect(source).toContain("recomputeEvidence[key].push(...recomputeResult[key])");
    expect(source).toContain("lastRecomputeRecordedAt = new Date()");
    expect(source).toContain("kpiIdsUpdated: hashEvidenceIds(recomputeEvidence.kpiIdsUpdated)");
    expect(source).toContain("kpiIdsSkipped: hashEvidenceIds(recomputeEvidence.kpiIdsSkipped)");
    expect(source).toContain("kpiIdsFailed: hashEvidenceIds(recomputeEvidence.kpiIdsFailed)");
    expect(source).toContain("benchmarkIdsUpdated: hashEvidenceIds(recomputeEvidence.benchmarkIdsUpdated)");
    expect(source).toContain("benchmarkIdsSkipped: hashEvidenceIds(recomputeEvidence.benchmarkIdsSkipped)");
    expect(source).toContain("benchmarkIdsFailed: hashEvidenceIds(recomputeEvidence.benchmarkIdsFailed)");
    expect(source).toContain('if (!opts.suppressAlerts && (!campaignId || trigger === "snapshot_bootstrap" || refreshWriteInput.refreshScope)) {');
    expect(source).toContain("Next scheduled run at");
    expect(source).toContain("const dataThroughDate = getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt);");
    expect(source).toContain("dataThroughDate=${dataThroughDate}");
    expect(source).toContain("__ga4DailyRefreshInProgress");
    expect(source).toContain("Skipping ${trigger} pipeline (already in progress)");
    expect(source).not.toContain("setInterval(() =>");
    expect(source).toContain('["snapshot_bootstrap", "manual"].includes(trigger) && Boolean(campaignId)');
    expect(source).toContain("opts.refreshFinancialSources === true");
    expect(source).toContain('await runDailyAutoRefreshOnce(trigger === "scheduled" ? "scheduled" : "manual", {');
    expect(source).toContain('...(campaignId ? { campaignId } : {})');
    expect(source.indexOf('await runDailyAutoRefreshOnce(trigger === "scheduled" ? "scheduled" : "manual", {')).toBeLessThan(
      source.indexOf("if (!finishEachCampaign) await publishRefresh(savedRevenueRefresh || await refreshAllGA4DailyMetrics({ campaignId, ...refreshWriteInput,"),
    );
  });

  it("releases downstream report readiness only for the completed aligned reporting date", () => {
    const state = { reportingDate: "2026-09-26", completedAt: "2026-09-27T03:05:00.000Z" };
    expect(isGA4AlignedRefreshReady(state, "2026-09-26")).toBe(true);
    expect(isGA4AlignedRefreshReady(state, "2026-09-27")).toBe(false);
    expect(isGA4AlignedRefreshReady(null, "2026-09-26")).toBe(false);
  });

  it("restores exact-date report readiness from the persisted Executive Summary snapshot", async () => {
    const completedAt = "2026-09-27T03:05:00.000Z";
    vi.spyOn(storage, "getExecutiveSummaryDailyComparisonData").mockResolvedValue({
      current: { notes: `ga4_aligned_refresh_v1:2026-09-26:${completedAt}` },
      previous: null,
    } as any);

    expect(parseGA4AlignedRefreshMarker(`ga4_aligned_refresh_v1:2026-09-26:${completedAt}`, "2026-09-26"))
      .toEqual({ reportingDate: "2026-09-26", completedAt });
    expect(parseGA4AlignedRefreshMarker(`ga4_aligned_refresh_v1:2026-09-25:${completedAt}`, "2026-09-26")).toBeNull();
    expect(await getGA4AlignedRefreshState("restart-campaign", "2026-09-26"))
      .toEqual({ reportingDate: "2026-09-26", completedAt });
  });

  it("does not reuse cached readiness after a later attempt invalidates the saved marker", async () => {
    const completedAt = "2026-09-27T03:05:00.000Z";
    const read = vi.spyOn(storage, "getExecutiveSummaryDailyComparisonData")
      .mockResolvedValueOnce({ current: { notes: `ga4_aligned_refresh_v1:2026-09-26:${completedAt}` }, previous: null } as any)
      .mockResolvedValue({ current: { notes: null }, previous: null } as any);
    expect(await getGA4AlignedRefreshState("failed-later-attempt", "2026-09-26")).not.toBeNull();
    expect(await getGA4AlignedRefreshState("failed-later-attempt", "2026-09-26")).toBeNull();
    expect(read).toHaveBeenCalledTimes(2);
  });

  it("publishes GA4 campaign snapshots only inside the ordered daily pipeline", () => {
    const source = schedulerSource();
    const aggregateSource = aggregateSnapshotSchedulerSource();

    expect(source.indexOf("await writeFinancialDailySnapshotIfReady")).toBeLessThan(source.indexOf("await recordCampaignMetrics(processedCampaignId"));
    expect(source.indexOf("await recordCampaignMetrics(processedCampaignId")).toBeLessThan(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl"));
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl")).toBeLessThan(source.indexOf("await checkGA4PerformanceAlertsForCampaign"));
    expect(source.indexOf("await checkGA4PerformanceAlertsForCampaign")).toBeLessThan(source.indexOf("await storage.markExecutiveSummaryDailySnapshotAligned"));
    expect(source.indexOf("await storage.markExecutiveSummaryDailySnapshotAligned")).toBeLessThan(source.indexOf("alignedRefreshByCampaign.set(processedCampaignId"));
    expect(aggregateSource).toContain("if (!opts.allowScheduledGA4)");
    expect(aggregateSource).toContain("snapshot is owned by the ordered GA4 daily pipeline");
    expect(kpiSchedulerSource()).toContain('GA4_DAILY_PIPELINE_OWNS_RECOMPUTE || "true"');
    expect(kpiSchedulerSource()).toContain("Skipping duplicate KPI/Benchmark recompute and alert sweeps because the GA4 daily pipeline owns them");
  });

  it("bootstraps only campaign-scoped daily publications whose Overview or required financial snapshot is incomplete", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T04:00:00Z"));
    vi.stubEnv("GA4_DAILY_REFRESH_TIME_ZONE", "UTC");
    vi.stubEnv("GA4_DAILY_REFRESH_HOURS", "3");
    vi.stubEnv("GA4_DAILY_REFRESH_MINUTE", "0");
    vi.spyOn(storage, "getExecutiveSummaryDailyComparisonData").mockResolvedValue({
      current: { notes: "ga4_aligned_refresh_v1:2026-08-05:2026-08-06T03:15:00Z" }, previous: null,
    } as any);
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([
      { id: "campaign-missing", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-mismatched", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-outdated", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-currency-missing", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-current", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-financial-missing", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-financial-mismatched", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-financial-unavailable", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-no-spend", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-no-spend-financial-missing", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-multi-property", status: "active", currency: "USD", ga4CampaignFilter: "saved-filter" },
      { id: "campaign-unscoped", status: "active", ga4CampaignFilter: null },
    ] as any);
    vi.spyOn(storage, "getGA4Connections").mockImplementation(async (campaignId: string) => campaignId === "campaign-multi-property" ? [{
      campaignId,
      propertyId: "properties/campaign-multi-property-secondary",
      importStartDate: "2026-07-01",
      isActive: true,
      isPrimary: false,
    }, {
      campaignId,
      propertyId: "properties/campaign-multi-property-primary",
      importStartDate: "2026-08-01",
      isActive: true,
      isPrimary: true,
    }] as any : [{
      campaignId,
      propertyId: `properties/${campaignId}`,
      importStartDate: "2026-08-01",
      isActive: true,
      isPrimary: true,
    }] as any);
    vi.spyOn(storage, "getGA4OverviewSnapshot").mockImplementation(async (campaignId: string, propertyId: string) => {
      if (["campaign-current", "campaign-financial-missing", "campaign-financial-mismatched", "campaign-financial-unavailable", "campaign-no-spend", "campaign-no-spend-financial-missing", "campaign-multi-property"].includes(campaignId)) return {
        windowStart: propertyId.endsWith("secondary") ? "2026-07-01" : "2026-08-01",
        windowEnd: propertyId.endsWith("secondary") ? "2026-08-04" : "2026-08-05",
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
    vi.spyOn(storage, "getSpendSources").mockImplementation(async (campaignId: string) =>
      campaignId.startsWith("campaign-no-spend") ? [] : [{ isActive: true, createdAt: "2026-08-01T00:00:00.000Z" }] as any
    );
    vi.spyOn(storage, "getFinancialDailyComparisonData").mockImplementation(async (campaignId: string) => ({
      current: ["campaign-financial-missing", "campaign-no-spend-financial-missing", "campaign-multi-property"].includes(campaignId) ? null : {
        metrics: {
          financialDaily: {
            currency: campaignId === "campaign-financial-mismatched" ? "EUR" : "USD",
            currentValueWindow: { startDate: "2026-08-01", reportingTimeZone: "UTC" },
            inputs: {
              spend: { available: campaignId !== "campaign-financial-unavailable" }, revenue: { available: true }, conversions: { available: true },
            },
          },
        },
      },
      previous: null,
    } as any));
    const runPipeline = vi.fn(async () => undefined);

    await expect(backfillMissingGA4OverviewSnapshots(runPipeline)).resolves.toEqual(["campaign-missing", "campaign-mismatched", "campaign-outdated", "campaign-currency-missing", "campaign-financial-missing", "campaign-financial-mismatched", "campaign-financial-unavailable", "campaign-no-spend-financial-missing", "campaign-multi-property"]);
    expect(runPipeline).toHaveBeenCalledTimes(9);
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
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-financial-missing",
      suppressAlerts: true,
      refreshFinancialSources: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-financial-mismatched",
      suppressAlerts: true,
      refreshFinancialSources: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-financial-unavailable",
      suppressAlerts: true,
      refreshFinancialSources: true,
    });
    expect(runPipeline).not.toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-no-spend",
      suppressAlerts: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-no-spend-financial-missing",
      suppressAlerts: true,
      refreshFinancialSources: true,
    });
    expect(runPipeline).toHaveBeenCalledWith("snapshot_bootstrap", {
      campaignId: "campaign-multi-property",
      suppressAlerts: true,
      refreshFinancialSources: true,
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
      { id: "campaign-ok", status: "active" },
      { id: "campaign-failed", status: "active" },
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
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl, processedCampaignId,")).toBeGreaterThan(
      source.indexOf("await writeFinancialDailySnapshotIfReady({ campaignId: processedCampaignId, reportingDate, ...writeInputFor(processedCampaignId) })"),
    );
    expect(source.indexOf("await captureExecutiveSummarySnapshot(executiveSummarySnapshotBaseUrl, processedCampaignId,")).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source.indexOf("alignedRefreshByCampaign.set(processedCampaignId")).toBeLessThan(
      source.indexOf(finalFailureCheck),
    );
    expect(source).toContain("if (!opts.suppressAlerts && !campaignId && !refreshFailure && alignedRefreshFailures.length === 0) {");
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
    expect(source).toContain("let storageStartDate =");
    expect(source).toMatch(/getTimeSeriesData\([\s\S]*?propertyId,\s*campaignFilter,\s*reportingWindow\.endDate,/);
    expect(source).toContain("getTrendsDailyPresenceWithToken(");
    expect(source).toContain("GA4 reported activity for a date without a complete daily metric row");
    expect(source).toContain("const completeRows = getDateRange(storageStartDate, reportingWindow.endDate)");
    expect(source).toContain("row.date > reportingWindow.endDate");
    expect(source.indexOf("row.date > reportingWindow.endDate")).toBeLessThan(source.indexOf("storage.replaceGA4DailyMetricsWindow("));
    expect(source).toMatch(/replaceGA4DailyMetricsWindow\([\s\S]*?currentCampaignId,[\s\S]*?propertyId,[\s\S]*?storageStartDate,[\s\S]*?reportingWindow\.endDate,[\s\S]*?completeRows as any/);
  });

  it("skips inactive campaigns before reading their GA4 connections", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", status: "inactive" }] as any);
    const getGA4Connections = vi.spyOn(storage, "getGA4Connections").mockResolvedValue([] as any);

    const result = await refreshAllGA4DailyMetrics({}, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsProcessed).toEqual([]);
    expect(result.campaignIdsFailed).toEqual([]);
    expect(getGA4Connections).not.toHaveBeenCalled();
  });

  it("admits only an explicitly targeted draft for its initial GA4 import", async () => {
    vi.spyOn(storage, "getCampaign").mockResolvedValue({ id: "campaign-1", status: "draft" } as any);
    const getGA4Connections = vi.spyOn(storage, "getGA4Connections").mockResolvedValue([] as any);

    const result = await refreshAllGA4DailyMetrics(
      { campaignId: "campaign-1", includeTargetDraft: true },
      new Date("2026-08-06T12:00:00.000Z"),
    );

    expect(result.campaignIdsSkipped).toEqual(["campaign-1"]);
    expect(getGA4Connections).toHaveBeenCalledWith("campaign-1");
  });

  it("materializes explicit zero rows for every absent completed date and excludes inactive properties", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD" }] as any);
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
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter" }] as any);
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
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD" }] as any);
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
      id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
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
      "campaign-1", expect.objectContaining({ getCampaign: expect.any(Function), getGA4Connection: expect.any(Function), updateGA4ConnectionTokens: expect.any(Function) }), "2026-08-02", "properties/active", 50, "saved-filter", "2026-08-05", false,
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
      id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
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
      id: "campaign-1", status: "active", reportingTimeZone: "UTC", currency: "USD", ga4CampaignFilter: "saved-filter",
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
