import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import {
  findInvalidGoogleSheetsRevenueAmountRows,
  isSupportedGoogleSheetsRevenueAmount,
} from "./utils/google-sheets-revenue-amount";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");

describe("GA4 Google Sheets revenue amount validation", () => {
  it("accepts blank, numeric, plain decimal, dollar, and valid US-grouped amounts", () => {
    for (const value of [null, undefined, "", "  ", 1234.56, "1234", "1234.56", ".50", "$1,234.56", "-$100", "$-100"]) {
      expect(isSupportedGoogleSheetsRevenueAmount(value), String(value)).toBe(true);
    }
  });

  it("rejects ambiguous locale, space-grouped, and partial numeric text", () => {
    for (const value of ["1.234,56", "1 234.56", "12,34", "100 USD", "USD 100", "100abc", "100%", "1e3", "€100"]) {
      expect(isSupportedGoogleSheetsRevenueAmount(value), value).toBe(false);
    }
  });

  it("checks only the exact selected campaign rows and reports sheet row numbers", () => {
    expect(findInvalidGoogleSheetsRevenueAmountRows([
      { Campaign: "Alpha", Revenue: "25.50" },
      { Campaign: "Beta", Revenue: "1.234,56" },
      { Campaign: "Alpha", Revenue: "100 USD" },
      { Campaign: "Gamma", Revenue: "1 234.56" },
    ], {
      revenueColumn: "Revenue",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha", "Gamma"],
    })).toEqual([4, 5]);
  });

  it("guards foreground and scheduler mutation paths before permissive parsing", () => {
    const routeStart = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"');
    const routeEnd = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/preview"', routeStart);
    const route = routes.slice(routeStart, routeEnd);
    const schedulerStart = scheduler.indexOf("async function reprocessGoogleSheetsRevenue(");
    const schedulerEnd = scheduler.indexOf("export async function runGoogleSheetsSpendSourceRefreshForValidation", schedulerStart);
    const refresh = scheduler.slice(schedulerStart, schedulerEnd);

    for (const content of [route, refresh]) {
      const validationIndex = content.indexOf("findInvalidGoogleSheetsRevenueAmountRows(");
      expect(validationIndex).toBeGreaterThan(-1);
      expect(validationIndex).toBeLessThan(content.indexOf("aggregateCsvRevenueRows("));
      expect(validationIndex).toBeLessThan(content.indexOf("replaceRevenueSourceWithRecords("));
    }
    expect(route).toContain("Selected revenue rows contain unsupported amount formatting.");
    expect(refresh).toContain("preserving last-good data");
  });
});
