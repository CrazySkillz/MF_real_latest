import { describe, expect, it, vi } from "vitest";
import { aggregateMimosaasTrackingCompletedDay, isMimosaasTrackingDailyAggregationEnabled } from "./mimosaas-tracking-daily-aggregation";
import { getReportingDateEndAt, getReportingDateStartAt } from "./utils/reporting-timezone";

describe("Mimosaas Tracking daily aggregation gate", () => {
  const enabledEnv = {
    MIMOSAAS_TRACKING_ENABLED: "true",
    MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
    MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED: "true",
  } as NodeJS.ProcessEnv;

  it("remains disabled unless all three explicit feature flags are enabled", () => {
    expect(isMimosaasTrackingDailyAggregationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailyAggregationEnabled({ MIMOSAAS_TRACKING_ENABLED: "true" } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailyAggregationEnabled({
      MIMOSAAS_TRACKING_ENABLED: "true",
      MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
    } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailyAggregationEnabled(enabledEnv)).toBe(true);
  });

  it("performs no storage work while disabled and delegates exact scope when enabled", async () => {
    const store = { aggregateMimosaasTrackingDailyMetrics: vi.fn().mockResolvedValue({ id: "metric-1" }) };
    const now = new Date("2026-10-15T08:00:00.000Z");

    await expect(aggregateMimosaasTrackingCompletedDay(
      "owner-1", "client-1", "campaign-1", "2026-10-14", store as any, {} as NodeJS.ProcessEnv, now,
    )).resolves.toEqual({ skipped: true, reason: "disabled" });
    expect(store.aggregateMimosaasTrackingDailyMetrics).not.toHaveBeenCalled();

    await expect(aggregateMimosaasTrackingCompletedDay(
      "owner-1", "client-1", "campaign-1", "2026-10-14", store as any, enabledEnv, now,
    )).resolves.toEqual({ skipped: false, metrics: { id: "metric-1" } });
    expect(store.aggregateMimosaasTrackingDailyMetrics).toHaveBeenCalledWith(
      "owner-1", "client-1", "campaign-1", "2026-10-14", now,
    );
  });

  it("uses exact local-day boundaries across Amsterdam daylight-saving changes", () => {
    const springStart = getReportingDateStartAt("2026-03-29", "Europe/Amsterdam");
    const springEnd = getReportingDateEndAt("2026-03-29", "Europe/Amsterdam");
    expect(springStart?.toISOString()).toBe("2026-03-28T23:00:00.000Z");
    expect(springEnd?.toISOString()).toBe("2026-03-29T21:59:59.999Z");

    const autumnStart = getReportingDateStartAt("2026-10-25", "Europe/Amsterdam");
    const autumnEnd = getReportingDateEndAt("2026-10-25", "Europe/Amsterdam");
    expect(autumnStart?.toISOString()).toBe("2026-10-24T22:00:00.000Z");
    expect(autumnEnd?.toISOString()).toBe("2026-10-25T22:59:59.999Z");
  });
});
