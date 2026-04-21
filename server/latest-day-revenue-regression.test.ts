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

  it("revenue-daily endpoints use strict daily records rather than source-type exclusions", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDayRevenue = (source: any): boolean => {");
    expect(routesFile).toContain("return !!source;");
    expect(routesFile).toContain('isEligibleForLatestDayRevenue(source)');
    expect(routesFile).toContain('storage.getRevenueBreakdownBySource(campaignId, date, date, "ga4")');
  });

  it("spend-daily endpoints use strict daily records rather than source-type exclusions", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDaySpend = (source: any): boolean => {");
    expect(routesFile).toContain("return !!source;");
    expect(routesFile).toContain('isEligibleForLatestDaySpend(source)');
    expect(routesFile).toContain('storage.getSpendBreakdownBySource(campaignId, date, date)');
  });
});
