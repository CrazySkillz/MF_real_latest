import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Latest Day Spend regression guard", () => {
  it("GA4 Overview does not render the removed previous-day spend card", () => {
    const clientFile = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf-8"
    );

    expect(clientFile).not.toContain("Latest Day Spend");
    expect(clientFile.includes("spendDailyToday")).toBe(false);
    expect(clientFile).not.toContain("spendDailyYesterday");
    expect(clientFile).not.toContain("const spendDailyResp = spendDailyYesterdayResp;");
  });

  it("spend-daily endpoint defaults to server UTC yesterday and uses strict daily records", () => {
    const routesFile = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf-8"
    );

    expect(routesFile).toContain("const isEligibleForLatestDaySpend = (source: any): boolean => {");
    expect(routesFile).toContain("if (!source) return false;");
    expect(routesFile).toContain("if (cfg?.testMode === true) return false;");
    expect(routesFile).toContain("return true;");
    expect(routesFile).toContain('const date = String(req.query.date || "").trim() || yesterdayUTC();');
    expect(routesFile).toContain('storage.getSpendBreakdownBySource(campaignId, date, date)');
    expect(routesFile).toContain('isEligibleForLatestDaySpend(source)');
  });
});
