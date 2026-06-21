import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { getLatestCompleteReportingDate, getReportingDateWindow, normalizeReportingTimeZone } from "./utils/reporting-timezone";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("GA4 reporting-day cutoff", () => {
  it("keeps UTC campaigns on the previous UTC date", () => {
    expect(getLatestCompleteReportingDate("UTC", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-19");
  });

  it("uses the campaign timezone around local midnight", () => {
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-20");
  });

  it("handles Amsterdam DST calendar boundaries", () => {
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-03-29T21:30:00.000Z"))).toBe("2026-03-28");
    expect(getLatestCompleteReportingDate("Europe/Amsterdam", new Date("2026-03-29T22:30:00.000Z"))).toBe("2026-03-29");
  });

  it("falls back to UTC for invalid timezone input", () => {
    expect(normalizeReportingTimeZone("not/a-zone")).toBe("UTC");
    expect(getLatestCompleteReportingDate("not/a-zone", new Date("2026-06-20T22:30:00.000Z"))).toBe("2026-06-19");
  });

  it("returns a compatible date window with data-through metadata", () => {
    expect(getReportingDateWindow(7, "Europe/Amsterdam", new Date("2026-06-20T22:30:00.000Z"))).toEqual({
      reportingTimeZone: "Europe/Amsterdam",
      dataThroughDate: "2026-06-20",
      endDate: "2026-06-20",
      startDate: "2026-06-14",
    });
  });

  it("wires the timezone cutoff through the GA4 daily route and Trends UI", () => {
    const routes = read("server", "routes-oauth.ts");
    const page = read("client", "src", "pages", "ga4-metrics.tsx");

    expect(routes).toContain("const reportingWindow = getReportingDateWindow(days, (campaign as any)?.reportingTimeZone);");
    expect(routes).toContain("const { startDate, endDate, dataThroughDate, reportingTimeZone } = reportingWindow;");
    expect(routes).toContain("dataThroughDate,");

    expect(page).toContain("const trendsReportingTimeZone = normalizeClientReportingTimeZone((ga4DailyResp as any)?.reportingTimeZone);");
    expect(page).toContain("const trendsDataThroughDate = String(ga4DailyDataThroughDate || ga4ReportDate || \"\").trim();");
    expect(page).toContain("completed {trendsReportingTimeZone} GA4 daily rows");
  });
});
