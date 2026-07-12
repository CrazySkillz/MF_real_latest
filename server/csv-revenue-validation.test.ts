import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { aggregateCsvRevenueRows, parseCsvText } from "./utils/csv";

const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
const storageSource = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
const revenueModal = readFileSync(join(process.cwd(), "client", "src", "components", "AddRevenueWizardModal.tsx"), "utf8");

const csvRevenueRoute = () => {
  const start = routes.indexOf('"/api/campaigns/:id/revenue/csv/process"');
  const end = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/preview"', start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview Upload CSV revenue deterministic validation", () => {
  it("filters exact campaign values and reconciles valid dated revenue", () => {
    const parsed = parseCsvText([
      "Date,Campaign,Revenue",
      '2026-07-01,Alpha,"$100.25"',
      "2026-07-01,Alpha,49.75",
      "2026-07-02,Beta,25",
    ].join("\n"));

    expect(aggregateCsvRevenueRows(parsed.rows, {
      revenueColumn: "Revenue",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    })).toEqual({
      keptRows: 2,
      totalRevenue: 150,
      dailyRevenue: [{ date: "2026-07-01", revenue: 150 }],
      undatedRevenue: 0,
    });
  });

  it("identifies selected positive rows with blank, invalid, or numeric dates", () => {
    expect(aggregateCsvRevenueRows([
      { Date: "2026-07-01", Campaign: "Alpha", Revenue: "100" },
      { Date: "", Campaign: "Alpha", Revenue: "500" },
      { Date: "not-a-date", Campaign: "Alpha", Revenue: "600" },
      { Date: "700", Campaign: "Alpha", Revenue: "50" },
      { Date: "2026-07-02", Campaign: "Beta", Revenue: "25" },
    ], {
      revenueColumn: "Revenue",
      dateColumn: "Date",
      campaignColumn: "Campaign",
      campaignValues: ["Alpha"],
    })).toEqual({
      keptRows: 4,
      totalRevenue: 1250,
      dailyRevenue: [{ date: "2026-07-01", revenue: 100 }],
      undatedRevenue: 1150,
    });
  });

  it("returns no accepted rows when the selected mapping has no positive revenue", () => {
    expect(aggregateCsvRevenueRows([
      { Date: "", Revenue: "0" },
      { Date: "bad-date", Revenue: "-10" },
      { Date: "2026-07-01", Revenue: "invalid" },
    ], {
      revenueColumn: "Revenue",
      dateColumn: "Date",
    })).toEqual({ keptRows: 0, totalRevenue: 0, dailyRevenue: [], undatedRevenue: 0 });
  });

  it("fails GA4 CSV revenue validation before any source mutation", () => {
    const route = csvRevenueRoute();
    const validationStart = route.indexOf('if (platformContext === "ga4")');
    const transactionMutation = route.indexOf("storage.replaceGa4CsvRevenueSourceWithRecords", validationStart);
    const updateMutation = route.indexOf("storage.updateRevenueSource", validationStart);
    const createMutation = route.indexOf("storage.createRevenueSource", validationStart);
    const firstMutation = Math.min(updateMutation, createMutation);

    expect(route).toContain("if (campaignCol === revenueColumn)");
    expect(route).toContain("if (dateCol && (dateCol === revenueColumn || dateCol === campaignCol))");
    expect(route).toContain("const validation = aggregateCsvRevenueRows(parsedRows");
    expect(route).toContain("if (validation.keptRows === 0)");
    expect(route).toContain("if (dateCol && validation.undatedRevenue > 0)");
    expect(route).toContain("No valid revenue rows found for the selected mapping");
    expect(route).toContain("Selected revenue rows contain blank or invalid dates. Fix those dates or clear the Date mapping before importing.");
    expect(validationStart).toBeGreaterThanOrEqual(0);
    expect(transactionMutation).toBeGreaterThan(validationStart);
    expect(updateMutation).toBeGreaterThan(validationStart);
    expect(createMutation).toBeGreaterThan(validationStart);
    expect(route.indexOf("if (validation.keptRows === 0)")).toBeLessThan(transactionMutation);
    expect(route.indexOf("if (dateCol && validation.undatedRevenue > 0)")).toBeLessThan(transactionMutation);
    expect(transactionMutation).toBeLessThan(firstMutation);
  });

  it("atomically replaces only the campaign-owned GA4 CSV source and its records", () => {
    const route = csvRevenueRoute();
    const methodStart = storageSource.indexOf("async replaceGa4CsvRevenueSourceWithRecords(");
    const methodEnd = storageSource.indexOf("async getRevenueTotalForRange", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);
    const transactionCall = route.indexOf("await storage.replaceGa4CsvRevenueSourceWithRecords(");

    expect(methodStart).toBeGreaterThanOrEqual(0);
    expect(methodEnd).toBeGreaterThan(methodStart);
    expect(method).toContain("if (!records.length) throw new Error");
    expect(method).toContain("return await db.transaction(async (tx: any) => {");
    expect(method).toContain('sourceType: "csv"');
    expect(method).toContain('platformContext: "ga4"');
    expect(method).toContain("eq(revenueSources.campaignId, campaignId)");
    expect(method).toContain('eq(revenueSources.sourceType, "csv")');
    expect(method).toContain("eq(revenueSources.isActive, true)");
    expect(method).toContain('or(eq(revenueSources.platformContext, "ga4" as any), isNull(revenueSources.platformContext))');
    expect(method.indexOf("await tx.delete(revenueRecords)")).toBeLessThan(
      method.indexOf("await tx.insert(revenueRecords)"),
    );
    expect(transactionCall).toBeGreaterThan(route.indexOf('if (platformContext === "ga4")'));
    expect(transactionCall).toBeLessThan(route.indexOf("await recomputeCampaignDerivedValues", transactionCall));
    expect(route.indexOf("return res.json({", transactionCall)).toBeLessThan(
      route.indexOf("let source: any", transactionCall),
    );
  });

  it("limits only GA4 CSV Date choices and clears stale collisions", () => {
    expect(revenueModal).toContain('if (platformContext !== "ga4") return csvHeaders;');
    expect(revenueModal).toContain("if (header === csvRevenueCol || header === csvCampaignCol) return false;");
    expect(revenueModal).toContain("if (isCsvDateLikeHeader(header)) return true;");
    expect(revenueModal).toContain("return nonEmptyValues.every(isCsvDateLikeValue);");
    expect(revenueModal).toContain('if (!raw || /^[+-]?(?:\\d+\\.?\\d*|\\.\\d+)$/.test(raw)) return false;');
    expect(revenueModal).toContain("{csvDateColumnHeaders.map((h) => (");
    expect(revenueModal).toContain("csvDateCol && !csvDateColumnHeaders.includes(csvDateCol)");
  });
});
