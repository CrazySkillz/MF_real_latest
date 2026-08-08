import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { assertGa4RevenueCurrencyIntegrity, selectRevenueRecordTotal } from "./utils/revenue-record-total";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

const sliceBetween = (value: string, startNeedle: string, endNeedle: string) => {
  const start = value.indexOf(startNeedle);
  const end = value.indexOf(endNeedle, start);
  expect(start).toBeGreaterThan(-1);
  expect(end).toBeGreaterThan(start);
  return value.slice(start, end);
};

describe("GA4 Overview revenue currency and total integrity", () => {
  it("uses aggregate-record presence rather than a positive amount to select the authoritative grain", () => {
    expect(selectRevenueRecordTotal({ aggregate: 0, attributed: 25, hasAggregate: true })).toBe(0);
    expect(selectRevenueRecordTotal({ aggregate: -10, attributed: 25, hasAggregate: true })).toBe(-10);
    expect(selectRevenueRecordTotal({ aggregate: 0, attributed: 25, hasAggregate: false })).toBe(25);
  });

  it("fails mismatched persisted currencies without invalidating matching legacy HubSpot rows", () => {
    expect(() => assertGa4RevenueCurrencyIntegrity([
      { currency: "EUR", sourceCurrency: "EUR", sourceType: "csv", mappingConfig: "{}" },
    ], "USD")).toThrow("does not match");
    expect(assertGa4RevenueCurrencyIntegrity([
      { currency: "USD", sourceCurrency: "USD", sourceType: "shopify", revenue: "0.00", mappingConfig: "{}" },
      { currency: "USD", sourceCurrency: "USD", sourceType: "hubspot", revenue: "5100.00", mappingConfig: "{}" },
      { currency: "usd", sourceCurrency: "USD", sourceType: "csv", revenue: "600.00", mappingConfig: "{}" },
    ], "usd")).toBe("USD");
    expect(source("server/storage.ts").match(/assertGa4RevenueCurrencyIntegrity\(/g)?.length).toBe(2);
  });

  it("fails GA4 CSV and Google Sheets revenue imports when a supplied currency differs from the campaign", () => {
    const routes = source("server/routes-oauth.ts");
    const csvRoute = sliceBetween(routes, '"/api/campaigns/:id/revenue/csv/process"', 'app.post("/api/campaigns/:id/revenue/sheets/preview"');
    const sheetsRoute = sliceBetween(routes, 'app.post("/api/campaigns/:id/revenue/sheets/process"', "const deactivateSpendSourcesForCampaign");

    for (const route of [csvRoute, sheetsRoute]) {
      expect(route).toContain('code: "REVENUE_CURRENCY_MISMATCH"');
      expect(route).toContain("requestedCurrency !== campaignCurrency");
      expect(route).toContain('const currency = platformContext === "ga4" ? campaignCurrency : requestedCurrency;');
    }
  });

  it("fails GA4 HubSpot revenue when provider currency is missing or differs from the campaign", () => {
    const routes = source("server/routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.post("/api/campaigns/:id/hubspot/save-mappings"',
      "// Helper function to refresh Google Sheets access token with robust error handling",
    );

    expect(route).toContain("HUBSPOT_REVENUE_CURRENCY_UNAVAILABLE");
    expect(route).toContain("HUBSPOT_REVENUE_CURRENCY_MISMATCH");
    expect(route).toContain("hubspotRevenueCurrency !== campaignCurrency");
    expect(route).toContain("currency: hubspotRevenueCurrency || campaignCurrency,");
  });

  it("keeps the damage inventory read-only while flagging campaign-currency and HubSpot provenance candidates", () => {
    const analytics = source("server/analytics.ts");
    const page = source("client/src/pages/ga4-metrics.tsx");
    const scheduledReport = source("server/ga4-scheduled-report-pdf.ts");
    expect(analytics).toContain("currencyCode: string,");
    expect(analytics).toContain("const responseCurrencyCode = verifyResponseCurrency(json);");
    expect(page).toContain("const requiresVerifiedNativeCurrency = hasImportedRevenueSource && !!selectedGA4PropertyId;");
    expect(scheduledReport).toContain("const ga4FinancialCandidates = hasImportedRevenueSource");

    const routes = source("server/routes-oauth.ts");
    const route = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"',
      'app.get("/api/ga4-overview/shopify/source-damage-inventory"',
    );

    expect(route).toContain("activeRevenueCurrencyMismatchGroups");
    expect(route).toContain("!source.mapping.currency");
    expect(route).toContain("automaticCleanupAllowed: false");
    expect(route).not.toContain("deleteRevenueRecordsBySource");
  });
});
