import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Spend regression guard", () => {
  it("GA4 Overview lets the server choose the previous complete day for latest-day spend", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile.includes("spendDailyToday")).toBe(false);
    expect(clientFile).toContain('queryKey: [`/api/campaigns/${campaignId}/spend-daily`, "latest"]');
    expect(clientFile).toContain("fetch(`/api/campaigns/${campaignId}/spend-daily`)");
    expect(clientFile).toContain('throw new Error("Failed to fetch latest-day spend")');
    expect(clientFile).toContain("Latest-day endpoints default to the server's previous complete UTC day.");
    expect(clientFile).not.toContain("spendDailyYesterday");
    expect(clientFile).not.toContain("const spendDailyResp = spendDailyYesterdayResp;");
  });

  it("spend-daily endpoint defaults to server UTC yesterday and uses strict daily records", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDaySpend = (source: any): boolean => {");
    expect(routesFile).toContain("return !!source;");
    expect(routesFile).toContain('const date = String(req.query.date || "").trim() || yesterdayUTC();');
    expect(routesFile).toContain('storage.getSpendBreakdownBySource(campaignId, date, date)');
    expect(routesFile).toContain('isEligibleForLatestDaySpend(source)');
  });
});
