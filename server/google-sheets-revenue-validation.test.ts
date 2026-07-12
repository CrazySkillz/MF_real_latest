import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { aggregateCsvRevenueRows } from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
const revenueModal = readFileSync(join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");

const sheetsRevenueRoute = () => {
  const start = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview Google Sheets revenue deterministic validation", () => {
  it("supports exact filtered dated and snapshot fixtures", () => {
    const rows = [
      { Date: "2026-07-01", Campaign: "Alpha", Revenue: "$100.25" },
      { Date: "2026-07-02", Campaign: "Alpha", Revenue: "49.75" },
      { Date: "2026-07-03", Campaign: "Beta", Revenue: "25" },
    ];
    expect(aggregateCsvRevenueRows(rows, {
      revenueColumn: "Revenue", dateColumn: "Date", campaignColumn: "Campaign", campaignValues: ["Alpha"],
    })).toEqual({
      keptRows: 2,
      totalRevenue: 150,
      dailyRevenue: [
        { date: "2026-07-01", revenue: 100.25 },
        { date: "2026-07-02", revenue: 49.75 },
      ],
      undatedRevenue: 0,
    });
    expect(aggregateCsvRevenueRows(rows, {
      revenueColumn: "Revenue", campaignColumn: "Campaign", campaignValues: ["Alpha"],
    }).totalRevenue).toBe(150);
  });

  it("identifies blank, invalid, and numeric mapped dates across selected positive rows", () => {
    expect(aggregateCsvRevenueRows([
      { Date: "", Revenue: "100" },
      { Date: "not-a-date", Revenue: "200" },
      { Date: "700", Revenue: "300" },
    ], { revenueColumn: "Revenue", dateColumn: "Date" })).toEqual({
      keptRows: 3,
      totalRevenue: 600,
      dailyRevenue: [],
      undatedRevenue: 600,
    });
  });

  it("fails the GA4 foreground path before source mutation", () => {
    const route = sheetsRevenueRoute();
    const validation = route.indexOf("const validation = aggregateCsvRevenueRows(rows");
    const firstMutation = route.indexOf("storage.createRevenueSource");
    expect(route).toContain("if (campaignCol === revenueCol)");
    expect(route).toContain("if (dateCol && (dateCol === revenueCol || dateCol === campaignCol))");
    expect(route).toContain("if (validation.keptRows === 0)");
    expect(route).toContain("if (dateCol && validation.undatedRevenue > 0)");
    expect(validation).toBeGreaterThanOrEqual(0);
    expect(validation).toBeLessThan(firstMutation);
  });

  it("fails the GA4 scheduler path before record deletion", () => {
    const start = scheduler.indexOf("async function reprocessGoogleSheetsRevenue(");
    const end = scheduler.indexOf("export async function runGoogleSheetsSpendSourceRefreshForValidation", start);
    const fn = scheduler.slice(start, end);
    expect(fn).toContain('=== "ga4"');
    expect(fn).toContain("const validation = aggregateCsvRevenueRows(mappedRows.map");
    expect(fn.indexOf("validation.keptRows === 0")).toBeLessThan(fn.indexOf("storage.deleteRevenueRecordsBySource"));
    expect(fn.indexOf("validation.undatedRevenue > 0")).toBeLessThan(fn.indexOf("storage.deleteRevenueRecordsBySource"));
  });

  it("limits only GA4 Google Sheets Date choices and clears stale selections", () => {
    expect(revenueModal).toContain('if (platformContext !== "ga4") return sheetsHeaders;');
    expect(revenueModal).toContain("if (header === sheetsRevenueCol || header === sheetsCampaignCol) return false;");
    expect(revenueModal).toContain("{sheetsDateColumnHeaders.map((h) => (");
    expect(revenueModal).toContain("sheetsDateCol && !sheetsDateColumnHeaders.includes(sheetsDateCol)");
  });
});
