import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const slice = (source: string, start: string, end: string) => source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start) + start.length));

describe("GA4 Insights Google Ads spend production pipeline", () => {
  it("recomputes the browser selection from server-held rows before atomic source replacement", () => {
    const routes = read("server", "routes-oauth.ts");
    const route = slice(routes, 'app.post("/api/campaigns/:id/spend/process/manual"', "const processConnectorDerivedSpend");
    expect(route).toContain("buildGA4GoogleAdsSpendMaterialization");
    expect(route.indexOf("buildGA4GoogleAdsSpendMaterialization")).toBeLessThan(route.indexOf("replaceSpendSourceWithRecords"));
    expect(route).toContain("amount = materialized.amount");
    expect(route).toContain("ga4GoogleAdsSpendRecords = materialized.records");
    expect(route).toContain('const cur = String(platformContext || "").trim().toLowerCase() === "ga4"');
  });

  it("uses one campaign window, exact atomic provider replacement, source currency, valid zero, and stale last-good retention", () => {
    const provider = read("server", "google-ads-scheduler.ts");
    const autoSource = read("server", "auto-refresh-scheduler.ts");
    const auto = slice(autoSource, "// Ad Platform Spend (Google Ads / Meta)", "// Google Sheets (Revenue)");
    const storage = read("server", "storage.ts");
    expect(provider).toContain("campaignStart");
    expect(provider).toContain("replaceGoogleAdsDailyMetricsForWindow");
    expect(provider).toContain("refreshGoogleAdsForCampaign(conn.campaignId, undefined");
    expect(provider).not.toContain("refreshGoogleAdsForCampaign(conn.campaignId, conn,");
    expect(provider).not.toContain("startDate.setDate(startDate.getDate() - 60)");
    expect(auto).toContain("campaignStart");
    expect(auto).toContain("providerFresh");
    expect(auto).toContain('currency: String((src as any)?.currency || (campaign as any)?.currency || "USD")');
    expect(auto).not.toContain("new Date(Date.now() - 90 * 86400000)");
    const replacement = slice(storage, "async replaceGoogleAdsDailyMetricsForWindow", "async updateGoogleAdsDailyMetricsGA4Revenue");
    expect(replacement).toContain("Google Ads replacement row is outside the authorized scope");
    expect(replacement).toContain("db.transaction");
    expect(replacement).toContain("tx.delete(googleAdsDailyMetrics)");
    expect(replacement).toContain("if (metrics.length > 0)");
  });
});
