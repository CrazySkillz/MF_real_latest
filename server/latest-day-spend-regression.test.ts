import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Spend regression guard", () => {
  it("GA4 Overview no longer prefers today's spend over yesterday", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile.includes("spendDailyToday")).toBe(false);
    expect(clientFile).toContain("const spendDailyResp = spendDailyYesterdayResp;");
    expect(clientFile).toContain("Latest Day Spend should use the previous complete day across all spend sources.");
  });

  it("spend-daily endpoint filters out snapshot-style spend sources", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDaySpend = (source: any): boolean => {");
    expect(routesFile).toContain('sourceType === "manual"');
    expect(routesFile).toContain('sourceType === "csv"');
    expect(routesFile).toContain('sourceType === "linkedin_api"');
    expect(routesFile).toContain('sourceType === "connector_derived"');
    expect(routesFile).toContain('sourceType === "google_sheets"');
    expect(routesFile).toContain('return !!String(mapping?.dateColumn || "").trim();');
    expect(routesFile).toContain('storage.getSpendBreakdownBySource(campaignId, date, date)');
    expect(routesFile).toContain('isEligibleForLatestDaySpend(source)');
  });
});
