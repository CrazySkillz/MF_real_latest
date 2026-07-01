import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getGA4DailySchedulerConfig, getNextGA4DailyRunAt } from "./ga4-daily-scheduler";

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
    expect(source).toContain("if (!campaignId && !opts.suppressAlerts) {");
    expect(source).toContain("Next scheduled run at");
    expect(source).toContain("const dataThroughDate = getLatestCompleteReportingDate(config.reportingTimeZone, nextRunAt);");
    expect(source).toContain("dataThroughDate=${dataThroughDate}");
    expect(source).toContain("__ga4DailyRefreshInProgress");
    expect(source).toContain("Skipping ${trigger} pipeline (already in progress)");
    expect(source).not.toContain("setInterval(() =>");
  });
});
