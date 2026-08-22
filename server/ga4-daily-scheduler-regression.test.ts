import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { afterEach, vi } from "vitest";
import { ga4Service } from "./analytics";
import { getGA4DailyRecomputeFailure, getGA4DailyRefreshFailure, getGA4DailySchedulerConfig, getNextGA4DailyRunAt, refreshAllGA4DailyMetrics } from "./ga4-daily-scheduler";
import { runGA4DailyKPIAndBenchmarkJobs } from "./ga4-kpi-benchmark-jobs";
import { storage } from "./storage";

const schedulerSource = () => readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");

describe("GA4 daily scheduler timing", () => {
  afterEach(() => vi.restoreAllMocks());
  it("defaults to a controlled 03:00 UTC daily run with startup enabled", () => {
    expect(getGA4DailySchedulerConfig({} as any)).toEqual({
      reportingTimeZone: "UTC",
      hour: 3,
      minute: 0,
      runOnStartup: true,
    });
  });

  it("uses configured reporting timezone and clamps invalid schedule values", () => {
    expect(getGA4DailySchedulerConfig({
      GA4_DAILY_REFRESH_TIME_ZONE: "Europe/Amsterdam",
      GA4_DAILY_REFRESH_HOUR: "99",
      GA4_DAILY_REFRESH_MINUTE: "-2",
      GA4_DAILY_REFRESH_RUN_ON_STARTUP: "false",
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
      runOnStartup: true,
    };

    expect(getNextGA4DailyRunAt(new Date("2026-06-20T22:30:00.000Z"), config).toISOString()).toBe("2026-06-21T01:00:00.000Z");
    expect(getNextGA4DailyRunAt(new Date("2026-06-21T02:30:00.000Z"), config).toISOString()).toBe("2026-06-22T01:00:00.000Z");
  });

  it("keeps scheduler logs, startup control, and overlap protection explicit", () => {
    const source = schedulerSource();

    expect(source).toContain("GA4_DAILY_REFRESH_TIME_ZONE");
    expect(source).toContain("GA4_DAILY_REFRESH_HOUR");
    expect(source).toContain("GA4_DAILY_REFRESH_MINUTE");
    expect(source).toContain("GA4_DAILY_REFRESH_RUN_ON_STARTUP");
    expect(source).toContain("type GA4DailyRefreshPipelineOptions");
    expect(source).toContain("export async function runGA4DailyRefreshPipeline(opts: GA4DailyRefreshPipelineOptions = {})");
    expect(source).toContain("const campaignId = String(opts.campaignId || \"\").trim();");
    expect(source).toContain("const campaigns = campaignId");
    expect(source).toMatch(/runGA4DailyKPIAndBenchmarkJobs\(campaignId\s*\? \{ campaignId, suppressAlerts: true \}/);
    expect(source).toContain("[GA4 Daily] KPI/Benchmark recompute result");
    expect(source).toContain("kpiIdsUpdated: recomputeResult.kpiIdsUpdated");
    expect(source).toContain("kpiIdsSkipped: recomputeResult.kpiIdsSkipped");
    expect(source).toContain("kpiIdsFailed: recomputeResult.kpiIdsFailed");
    expect(source).toContain("lastRecomputeRecordedAt = new Date()");
    expect(source).toContain("kpiIdsUpdated: hashEvidenceIds(recomputeResult.kpiIdsUpdated)");
    expect(source).toContain("kpiIdsSkipped: hashEvidenceIds(recomputeResult.kpiIdsSkipped)");
    expect(source).toContain("kpiIdsFailed: hashEvidenceIds(recomputeResult.kpiIdsFailed)");
    expect(source).toContain("benchmarkIdsUpdated: hashEvidenceIds(recomputeResult.benchmarkIdsUpdated)");
    expect(source).toContain("benchmarkIdsSkipped: hashEvidenceIds(recomputeResult.benchmarkIdsSkipped)");
    expect(source).toContain("benchmarkIdsFailed: hashEvidenceIds(recomputeResult.benchmarkIdsFailed)");
    expect(source).toContain("if (!campaignId && !opts.suppressAlerts) {");
    expect(source).toContain("Next scheduled run at");
    expect(source).toContain("const dataThroughDate = getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt);");
    expect(source).toContain("dataThroughDate=${dataThroughDate}");
    expect(source).toContain("__ga4DailyRefreshInProgress");
    expect(source).toContain("Skipping ${trigger} pipeline (already in progress)");
    expect(source).not.toContain("setInterval(() =>");
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
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([
      { id: "campaign-ok" },
      { id: "campaign-failed" },
    ] as any);

    const result = await runGA4DailyKPIAndBenchmarkJobs({
      campaignIds: ["campaign-ok"],
      suppressAlerts: true,
    });

    expect(result.campaignIdsSkipped).toEqual(["campaign-ok"]);
    expect(source).toContain("campaignIds: refreshResult.campaignIdsProcessed");
    expect(source.indexOf("const recomputeResult = await runGA4DailyKPIAndBenchmarkJobs")).toBeLessThan(
      source.indexOf("if (refreshFailure) throw new Error(refreshFailure);"),
    );
    expect(source.indexOf('recordFinancialDailySnapshotRefreshEvidence("ga4_daily"')).toBeLessThan(
      source.indexOf("if (refreshFailure) throw new Error(refreshFailure);"),
    );
  });

  it("fails a targeted run when its provider refresh failed or was skipped", () => {
    const result = {
      campaignIdsProcessed: ["campaign-ok"],
      campaignIdsSkipped: ["campaign-skipped"],
      campaignIdsFailed: ["campaign-failed"],
      propertyIdsProcessed: ["properties/1"],
      propertyIdsFailed: ["properties/2"],
      rowsUpserted: 1,
    };
    expect(getGA4DailyRefreshFailure(result, "campaign-ok")).toBeNull();
    expect(getGA4DailyRefreshFailure(result, "campaign-failed")).toContain("failed");
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
    expect(source).toMatch(/getTimeSeriesData\([\s\S]*?String\(connection\.propertyId\),\s*campaignFilter,\s*reportingWindow\.endDate,\s*\)/);
    expect(source).toContain("row.date > reportingWindow.endDate");
    expect(source.indexOf("row.date > reportingWindow.endDate")).toBeLessThan(source.indexOf("storage.replaceGA4DailyMetricsWindow("));
    expect(source).toContain("propertyId: String(connection.propertyId)");
    expect(source).toMatch(/replaceGA4DailyMetricsWindow\([\s\S]*?currentCampaignId,[\s\S]*?String\(connection\.propertyId\),[\s\S]*?reportingWindow\.startDate,[\s\S]*?reportingWindow\.endDate,[\s\S]*?toUpsert as any/);
  });

  it("executes the production refresh path for every active property and excludes inactive properties", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", reportingTimeZone: "UTC", ga4CampaignFilter: "saved-filter" }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([
      { propertyId: "properties/active-1", isActive: true },
      { propertyId: "properties/active-2", isActive: true },
      { propertyId: "properties/inactive", isActive: false },
    ] as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockImplementation(async (_campaign, _storage, startDate, propertyId, _filter, endDate) => [{
      date: endDate,
      sessions: propertyId === "properties/active-1" ? 1 : 2,
    }]);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 1 } as any);

    const result = await refreshAllGA4DailyMetrics();

    expect(result).toMatchObject({
      campaignIdsProcessed: ["campaign-1"],
      campaignIdsFailed: [],
      propertyIdsProcessed: ["properties/active-1", "properties/active-2"],
      propertyIdsFailed: [],
      rowsUpserted: 2,
    });
    expect(ga4Service.getTimeSeriesData).toHaveBeenCalledTimes(2);
    expect(replace).toHaveBeenCalledTimes(2);
    expect(replace.mock.calls.map((call) => call[1])).toEqual(["properties/active-1", "properties/active-2"]);
  });

  it("preserves last-good storage when any provider daily value is invalid", async () => {
    vi.spyOn(storage, "getCampaigns").mockResolvedValue([{ id: "campaign-1", reportingTimeZone: "UTC" }] as any);
    vi.spyOn(storage, "getGA4Connections").mockResolvedValue([{ propertyId: "properties/active", isActive: true }] as any);
    vi.spyOn(ga4Service, "getTimeSeriesData").mockResolvedValue([{ date: "2026-08-05", sessions: "not-a-number" }] as any);
    const replace = vi.spyOn(storage, "replaceGA4DailyMetricsWindow").mockResolvedValue({ replaced: 1 } as any);

    const result = await refreshAllGA4DailyMetrics(undefined, new Date("2026-08-06T12:00:00.000Z"));

    expect(result.campaignIdsFailed).toEqual(["campaign-1"]);
    expect(result.propertyIdsFailed).toEqual(["properties/active"]);
    expect(replace).not.toHaveBeenCalled();
  });
});
