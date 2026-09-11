import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { computeCpa, computeRoiPercent } from "../shared/metric-math";
import { selectMaterializedRevenueTotal } from "./storage";
import { aggregateCsvRevenueRows } from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
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

describe("GA4 Google Sheets revenue downstream propagation", () => {
  it("adds one exact filtered Sheets delta to financials while leaving CPA unchanged", () => {
    const sheet = aggregateCsvRevenueRows([
      { Date: "2026-09-01", Campaign: "Alpha", Revenue: "$100.25" },
      { Date: "2026-09-02", Campaign: "Alpha", Revenue: "49.75" },
      { Date: "2026-09-02", Campaign: "Beta", Revenue: "900" },
    ], {
      revenueColumn: "Revenue",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    });
    const materializedSheetsRevenue = selectMaterializedRevenueTotal(sheet.totalRevenue, sheet.totalRevenue, true);
    const nativeRevenue = 900;
    const spend = 350;
    const conversions = 7;
    const totalRevenue = nativeRevenue + materializedSheetsRevenue;
    const cpaBefore = computeCpa(spend, conversions);
    const cpaAfter = computeCpa(spend, conversions);

    expect(sheet).toMatchObject({ keptRows: 2, totalRevenue: 150, undatedRevenue: 0 });
    expect(materializedSheetsRevenue).toBe(150);
    expect(totalRevenue).toBe(1_050);
    expect(totalRevenue - spend).toBe(700);
    expect(totalRevenue / spend).toBe(3);
    expect(computeRoiPercent(totalRevenue, spend)).toBe(200);
    expect(cpaAfter).toBe(cpaBefore);
    expect(cpaAfter).toBe(50);
  });

  it("materializes the exact foreground source before recompute and response", () => {
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      "// Keep spend totals predictable",
    );
    const replacement = route.indexOf("await storage.replaceRevenueSourceWithRecords(");
    const recompute = route.indexOf("await recomputeCampaignDerivedValues(campaignId, { platformContext });", replacement);
    const response = route.indexOf("return res.json({ success: true", replacement);

    expect(route).toContain("sourceType: 'google_sheets'");
    expect(route).toContain("platformContext: 'ga4'");
    expect(replacement).toBeGreaterThanOrEqual(0);
    expect(recompute).toBeGreaterThan(replacement);
    expect(response).toBeGreaterThan(recompute);
  });

  it("refreshes the same source transactionally without appending attribution detail twice", () => {
    const refresh = sliceBetween(
      scheduler,
      "async function reprocessGoogleSheetsRevenue(",
      "export async function runGoogleSheetsSpendSourceRefreshForValidation",
    );

    expect(refresh).toContain("const sourceId = String(source.id);");
    expect(refresh).toContain('storage.replaceRevenueSourceWithRecords(campaignId, sourceId, "google_sheets", platformContext');
    expect(refresh).toContain('records as any, String(source.mappingConfig || "")');
    expect(refresh).not.toContain("storage.createRevenueSource");
    expect(refresh).not.toContain("storage.deleteRevenueRecordsBySource");
  });

  it("serves totals, breakdown, and source-list amounts from active materialized records", () => {
    const totalMethod = sliceBetween(storage, "async getRevenueTotalForRange(", "async getRevenueBreakdownBySource(");
    const breakdownMethod = sliceBetween(storage, "async getRevenueBreakdownBySource(", "// Google Sheets Connection methods");
    const endpoints = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/revenue-to-date"',
      "// Unified data-sources endpoint",
    );

    for (const method of [totalMethod, breakdownMethod]) {
      expect(method).toContain("eq(revenueRecords.campaignId, campaignId)");
      expect(method).toContain("eq(revenueSources.campaignId, campaignId)");
      expect(method).toContain("eq(revenueSources.isActive, true)");
      expect(method).toContain("selectMaterializedRevenueTotal");
    }
    expect(endpoints).toContain("storage.getRevenueTotalForRange(campaignId, startDate, resolvedEndDate, platformContext)");
    expect(endpoints).toContain("storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, platformContext as any)");
    expect(endpoints).toContain("const hasMaterializedRevenue = totalsBySource.has(sourceId);");
    expect(endpoints).toContain("? hasMaterializedRevenue ? Number(recordTotal.toFixed(2)) : null");
  });

  it("feeds Total Revenue, Profit, ROAS, and ROI but never changes CPA inputs", () => {
    const financials = sliceBetween(
      ga4Page,
      "const importedRevenueForFinancials",
      "// Initial failures render at the affected card/table.",
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

  it("invalidates foreground queries and bounds open-page reads only for active Sheets revenue", () => {
    const invalidation = sliceBetween(revenueModal, "const invalidateAfterRevenueChange", "const resetAll = () =>");
    const polling = sliceBetween(ga4Page, "const hasActiveGa4GoogleSheetsRevenueSource", "const configuredPipelineSourceTypes");

    for (const endpoint of ["/revenue-to-date", "/revenue-sources", "/revenue-breakdown", "/revenue-daily", "/outcome-totals"]) {
      expect(invalidation).toContain(endpoint);
    }
    expect(polling).toContain('toLowerCase() === "google_sheets"');
    expect(polling).toContain('toLowerCase() === "ga4"');
    expect(polling).toContain("? 15 * 1000 : 10 * 60 * 1000");
  });
});
