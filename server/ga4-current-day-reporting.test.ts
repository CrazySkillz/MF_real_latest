import { afterEach, describe, expect, it, vi } from "vitest";
import { getGA4ReportingDateWindow, getGA4ReportingWindowMode, getGA4ExpectedScheduledRefreshAt,
  getLatestGA4ReportingDate, getReportingDateWindow, getReportingComparisonBoundary,
  getExpectedScheduledRefreshAt, resolveGA4ImportToDateWindow } from "./utils/reporting-timezone";
import { publishedGA4PipelineData, ga4ProvisionalNotice } from "../shared/ga4-financial-source";

afterEach(() => vi.unstubAllEnvs());
const zone = "Europe/Amsterdam";
const schedule = { reportingTimeZone: zone, hour: 8, hours: [8, 14, 20], minute: 0 };

describe("opt-in current-day GA4 reporting", () => {
  it("preserves completed-day behavior by default and for unrelated platforms", () => {
    const now = new Date("2026-11-09T19:00:00Z");
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "false");
    expect(getGA4ReportingDateWindow(30, zone, now)).toEqual(getReportingDateWindow(30, zone, now));
    expect(getGA4ExpectedScheduledRefreshAt("2026-11-08", schedule, now)).toEqual(getExpectedScheduledRefreshAt("2026-11-08", schedule, now));
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    expect(getReportingDateWindow(1, zone, now).endDate).toBe("2026-11-08");
    expect(getGA4ReportingWindowMode()).toBe("initial_import_to_latest_available_day");
  });

  it.each([8, 14, 20])("includes Monday at the %s:00 run without moving that slot", hour => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    const now = new Date(`2026-11-09T${String(hour - 1).padStart(2, "0")}:01:00Z`);
    expect(getGA4ReportingDateWindow(30, zone, now)).toMatchObject({ startDate: "2026-10-11", endDate: "2026-11-09", dataThroughDate: "2026-11-09" });
    expect(getGA4ExpectedScheduledRefreshAt("2026-11-09", schedule, now)?.toISOString()).toBe(`2026-11-09T${String(hour - 1).padStart(2, "0")}:00:00.000Z`);
    expect(resolveGA4ImportToDateWindow("2026-10-10", zone, now)?.startDate).toBe("2026-10-10");
  });

  it("handles midnight and day-two without shifting historical comparison dates", () => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    expect(getLatestGA4ReportingDate(zone, new Date("2026-11-09T22:59:59Z"))).toBe("2026-11-09");
    const tuesday = new Date("2026-11-09T23:00:00Z");
    expect(getLatestGA4ReportingDate(zone, tuesday)).toBe("2026-11-10");
    expect(getReportingComparisonBoundary("yesterday", zone, tuesday).comparisonDate).toBe("2026-11-09");
    expect(getGA4ExpectedScheduledRefreshAt("2026-11-10", schedule, tuesday)?.toISOString()).toBe("2026-11-10T07:00:00.000Z");
    expect(resolveGA4ImportToDateWindow("2026-11-11", zone, tuesday)).toBeNull();
  });

  it.each([
    ["2026-03-29T06:01:00Z", "2026-03-29T06:00:00.000Z"],
    ["2026-10-25T07:01:00Z", "2026-10-25T07:00:00.000Z"],
  ])("keeps 08:00 local across daylight-saving changes: %s", (now, expected) => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    const date = getLatestGA4ReportingDate(zone, new Date(now));
    expect(getGA4ExpectedScheduledRefreshAt(date, schedule, new Date(now))?.toISOString()).toBe(expected);
  });
});

describe("published CRM pipeline", () => {
  const source = { sourceId: "crm-1", sourceType: "hubspot", mappingConfig: {
    pipelineEnabled: true, pipelineStageId: "open", pipelineProxyMode: "current_stage",
    pipelineTotalToDate: 120, pipelineCurrency: "EUR", pipelineLastUpdatedAt: "2026-11-09T13:01:00Z",
    pipelineValueRevenueTotals: [{ campaignValue: "selected-deal", revenue: 120 }],
  } };
  it("uses the saved open-stage value, and accepts a successful zero after Closed Won", () => {
    expect(publishedGA4PipelineData(source, "EUR")).toMatchObject({ success: true, totalToDate: 120 });
    const closed = { ...source, mappingConfig: { ...source.mappingConfig, pipelineTotalToDate: 0, pipelineValueRevenueTotals: [], pipelineLastUpdatedAt: "2026-11-09T19:01:00Z" } };
    expect(publishedGA4PipelineData(closed, "EUR")).toMatchObject({ success: true, totalToDate: 0 });
    expect(source.mappingConfig.pipelineTotalToDate).toBe(120);
  });
  it.each([
    { pipelineCurrency: "USD" }, { pipelineWarning: "provider failed" }, { pipelineTotalToDate: 121 },
    { pipelineLastUpdatedAt: null }, { pipelineValueRevenueTotals: [{ revenue: "120" }] },
    { pipelineStageId: null }, { pipelineTotalToDate: -1 },
  ])("fails closed for invalid saved pipeline inputs: %j", change => {
    expect(publishedGA4PipelineData({ ...source, mappingConfig: { ...source.mappingConfig, ...change } }, "EUR"))
      .toMatchObject({ success: false, totalToDate: null });
  });
  it("leaves an unconfigured proxy separate and labels provisional data only for the new mode", () => {
    expect(publishedGA4PipelineData({ ...source, mappingConfig: { pipelineEnabled: false } }, "EUR")).toBeNull();
    expect(ga4ProvisionalNotice("initial_import_to_latest_completed_day")).toBe("");
    expect(ga4ProvisionalNotice("initial_import_to_latest_available_day")).toContain("provisional");
  });
});
