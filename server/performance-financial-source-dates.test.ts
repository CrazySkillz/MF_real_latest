import { describe, expect, it } from "vitest";
import { datedFinancialSourceIds, datedFinancialSourceSetsCompatible } from "../client/src/lib/performance-financial-source-dates";

const source = (id: string, sourceType: string, mappingConfig: object, currency = "USD") => ({
  id, sourceType, mappingConfig: JSON.stringify(mappingConfig), currency, isActive: true, materializedRevenueStatus: "available",
});

describe("Performance Summary dated financial comparisons", () => {
  it("uses dated Spend rows even when a source has no rows by the prior date", () => {
    const active = datedFinancialSourceIds({ success: true, sources: [
      source("csv", "csv", { storedDateColumn: "Date" }),
      source("sheet", "google_sheets", { dateColumn: "Date" }),
    ] }, "spend", "USD");
    expect(active).toEqual(["csv", "sheet"]);
    expect(datedFinancialSourceSetsCompatible(active, ["sheet", "csv"], ["sheet"])).toBe(true);
    expect(datedFinancialSourceSetsCompatible(active, ["sheet", "csv"], [])).toBe(true);
  });

  it("accepts dated Revenue connectors and rejects snapshot-style imports", () => {
    const dated = datedFinancialSourceIds({ success: true, sources: [
      source("crm1", "hubspot", { dateField: "closedate" }),
      source("crm2", "salesforce", { dateField: "CloseDate", dailyMaterialization: "selected_date_field_v1" }),
      source("shop", "shopify", { materializationGranularity: "order", orderDateBasis: "created_at_campaign_reporting_timezone" }),
      source("csv", "csv", { dateColumn: "Date" }),
    ] }, "revenue", "USD");
    expect(dated).toEqual(["crm1", "crm2", "csv", "shop"]);
    expect(datedFinancialSourceIds({ success: true, sources: [source("snapshot", "csv", {})] }, "revenue", "USD")).toBeNull();
    expect(datedFinancialSourceIds({ success: true, sources: [source("snapshot", "google_sheets", {})] }, "spend", "USD")).toBeNull();
  });

  it("fails closed for source, currency, and configuration mismatches", () => {
    const active = ["csv", "sheet"];
    expect(datedFinancialSourceSetsCompatible(active, ["csv"], ["csv"])).toBe(false);
    expect(datedFinancialSourceSetsCompatible(active, ["csv", "sheet"], ["removed"])).toBe(false);
    expect(datedFinancialSourceSetsCompatible(active, ["csv", "sheet"], ["sheet", "sheet"])).toBe(false);
    expect(datedFinancialSourceSetsCompatible(active, ["csv", "sheet"], [""])).toBe(false);
    expect(datedFinancialSourceSetsCompatible(null, ["csv"], ["csv"])).toBe(false);
    expect(datedFinancialSourceIds({ success: true, sources: [source("eur", "csv", { dateColumn: "Date" }, "EUR")] }, "spend", "USD")).toBeNull();
    expect(datedFinancialSourceIds({ success: true, sources: [{ ...source("empty", "csv", { dateColumn: "Date" }), materializedRevenueStatus: "unavailable" }] }, "revenue", "USD")).toBeNull();
    expect(datedFinancialSourceIds({ success: true, sources: [{ ...source("bad", "csv", {}), mappingConfig: "{" }] }, "spend", "USD")).toBeNull();
  });
});
