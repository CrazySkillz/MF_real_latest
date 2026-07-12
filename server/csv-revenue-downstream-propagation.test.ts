import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";
import { aggregateCsvRevenueRows } from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const ga4Page = readFileSync(join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"), "utf8");
const revenueModal = readFileSync(join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");

const sliceBetween = (source: string, startText: string, endText: string) => {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("GA4 Upload CSV revenue downstream propagation", () => {
  it("adds the exact CSV delta once to financial formulas and leaves CPA unchanged", () => {
    const csv = aggregateCsvRevenueRows([
      { Date: "2026-07-01", Campaign: "Alpha", Revenue: "100.25" },
      { Date: "2026-07-02", Campaign: "Alpha", Revenue: "49.75" },
      { Date: "2026-07-02", Campaign: "Beta", Revenue: "900" },
    ], {
      revenueColumn: "Revenue",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    });
    const nativeRevenue = 1_000;
    const spend = 500;
    const conversions = 10;
    const revenueBefore = nativeRevenue;
    const revenueAfter = nativeRevenue + csv.totalRevenue;
    const cpaBefore = computeCpa(spend, conversions);
    const cpaAfter = computeCpa(spend, conversions);

    expect(csv.totalRevenue).toBe(150);
    expect(revenueAfter).toBe(1_150);
    expect(revenueAfter - spend).toBe(650);
    expect(revenueAfter / spend).toBe(2.3);
    expect(computeRoiPercent(revenueAfter, spend)).toBe(130);
    expect(cpaAfter).toBe(cpaBefore);
    expect(cpaAfter).toBe(50);
    expect(revenueBefore).toBe(1_000);
  });

  it("materializes the validated GA4 CSV source before downstream recomputation", () => {
    const route = sliceBetween(
      routes,
      '"/api/campaigns/:id/revenue/csv/process"',
      'app.post("/api/campaigns/:id/revenue/sheets/preview"',
    );
    const transaction = route.indexOf("await storage.replaceGa4CsvRevenueSourceWithRecords(");
    const recompute = route.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });", transaction);
    const response = route.indexOf("return res.json({", transaction);

    expect(route).toContain('sourceType: "csv"');
    expect(transaction).toBeGreaterThanOrEqual(0);
    expect(recompute).toBeGreaterThan(transaction);
    expect(response).toBeGreaterThan(recompute);
  });

  it("uses one active campaign/GA4 source-backed contract for totals and breakdown", () => {
    const totalMethod = sliceBetween(storage, "async getRevenueTotalForRange(", "async getRevenueBreakdownBySource(");
    const breakdownMethod = sliceBetween(storage, "async getRevenueBreakdownBySource(", "// Google Sheets Connection methods");

    for (const method of [totalMethod, breakdownMethod]) {
      expect(method).toContain("eq(revenueRecords.campaignId, campaignId)");
      expect(method).toContain("eq(revenueSources.isActive, true)");
      expect(method).toContain("eq(revenueSources.platformContext, 'ga4' as any)");
      expect(method).toContain("isNull(revenueSources.platformContext)");
      expect(method).toContain("revenueRecords.revenueSourceId");
    }
    expect(totalMethod).toContain("item.aggregate > 0 ? item.aggregate : item.subCampaign");
    expect(breakdownMethod).toContain("data.aggregate > 0 ? data.aggregate : data.subCampaign");
  });

  it("serves revenue-to-date, breakdown, and source totals from that storage contract", () => {
    const endpoints = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/revenue-to-date"',
      "// Unified data-sources endpoint",
    );

    expect(endpoints).toContain('const startDate = "1900-01-01";');
    expect(endpoints).toContain("storage.getRevenueTotalForRange(campaignId, startDate, endDate, platformContext)");
    expect(endpoints).toContain("storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, platformContext as any)");
    expect(endpoints).toContain('storage.getRevenueBreakdownBySource(campaignId, "1900-01-01", "2999-12-31", platformContext)');
    expect(endpoints).toContain('const recordTotal = totalsBySource.get(String(source?.id || "")) || 0;');
  });

  it("feeds imported CSV revenue into Total Revenue, Profit, ROAS, and ROI but not CPA", () => {
    const financials = sliceBetween(
      ga4Page,
      "const importedRevenueForFinancials",
      "const toRateRatio",
    );
    const cards = sliceBetween(ga4Page, "{/* Total Revenue */}", "{/* Campaign Breakdown */}");

    expect(financials).toContain("const financialRevenue = ga4RevenueForFinancials + importedRevenueForFinancials;");
    expect(financials).toContain("const financialROAS = financialSpend > 0 ? financialRevenue / financialSpend : 0;");
    expect(financials).toContain("const financialROI = computeRoiPercent(financialRevenue, financialSpend);");
    expect(financials).toContain("const financialCPA = computeCpa(financialSpend, financialConversions);");
    expect(cards).toContain("formatMoney(financialRevenue - financialSpend)");
    expect(cards).toContain("financialROAS.toFixed(2)");
    expect(cards).toContain("formatPercentage(financialROI)");
    expect(cards).toContain("formatMoney(Number(financialCPA || 0))");
  });

  it("refreshes every mounted CSV Revenue provenance and Overview query after mutation", () => {
    const invalidation = sliceBetween(
      revenueModal,
      "const invalidateAfterRevenueChange",
      "const resetAll = () =>",
    );

    expect(invalidation).toContain('/revenue-to-date');
    expect(invalidation).toContain('/revenue-sources');
    expect(invalidation).toContain('/revenue-breakdown');
    expect(invalidation).toContain('/revenue-daily');
    expect(invalidation).toContain('ga4-breakdown');
    expect(invalidation).toContain('/outcome-totals');
  });
});
