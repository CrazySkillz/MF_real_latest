import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getGA4DailyRecomputeFailure, getGA4DailySchedulerConfig, getNextGA4DailyRunAt } from "./ga4-daily-scheduler";

const schedulerSource = () => readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");

describe("GA4 daily scheduler timing", () => {
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
    expect(source).toContain("await runGA4DailyKPIAndBenchmarkJobs(campaignId ? { campaignId, suppressAlerts: true } : undefined);");
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

  it("fetches and persists daily values for the exact saved property and campaign scope", () => {
    const source = schedulerSource();

    expect(source).toContain("const campaignFilter = parseGA4CampaignFilter((c as any)?.ga4CampaignFilter);");
    expect(source).toMatch(/getTimeSeriesData\([\s\S]*?String\(primary\.propertyId\),\s*campaignFilter\s*\)/);
    expect(source).toContain("propertyId: String(primary.propertyId)");
    expect(source).toContain("await storage.upsertGA4DailyMetrics(toUpsert as any);");
  });
});
