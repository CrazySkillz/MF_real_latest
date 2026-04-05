import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Revenue regression guard", () => {
  it("GA4 Overview uses the previous day for latest-day revenue", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).toContain("const revenueDailyDate = spendDailyYesterday;");
    expect(clientFile).toContain("const ga4LatestDayRevenue = useMemo(() => {");
    expect(clientFile).toContain("Latest Day Revenue should use the previous complete day across GA4 native + imported revenue sources.");
    expect(clientFile).not.toContain("const revenueDailyDate = ga4ReportDate || spendDailyYesterday;");
  });

  it("revenue-daily endpoints filter out snapshot-style revenue sources", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDayRevenue = (source: any): boolean => {");
    expect(routesFile).toContain('sourceType === "manual"');
    expect(routesFile).toContain('sourceType === "hubspot"');
    expect(routesFile).toContain('sourceType === "csv" || sourceType === "google_sheets"');
    expect(routesFile).toContain('return !!String(mapping?.dateColumn || "").trim();');
    expect(routesFile).toContain('isEligibleForLatestDayRevenue(source)');
    expect(routesFile).toContain('storage.getRevenueBreakdownBySource(campaignId, date, date, "ga4")');
    expect(routesFile).toContain('storage.getRevenueBreakdownBySource(campaignId, date, date, platformContext as any)');
  });
});
