import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { inspectGa4CsvRevenueDamage } from "./utils/csv-revenue-damage-inventory";

const mapping = (rows: any[], overrides: Record<string, any> = {}) => JSON.stringify({
  storedRevenueColumn: "Revenue",
  storedCampaignColumn: "Campaign",
  storedDateColumn: "Date",
  revenueColumn: "Revenue",
  campaignColumn: "Campaign",
  campaignValues: ["Alpha"],
  dateColumn: "Date",
  csvHeaders: ["Date", "Campaign", "Revenue"],
  csvRowCount: rows.length,
  csvStoredRevenueRows: rows,
  ...overrides,
});

describe("CSV Revenue damaged-data inventory", () => {
  it("passes a reconciled active GA4 CSV source without double-counting attributed rows", () => {
    const rows = [
      { dateRaw: "2026-07-01", campaignKey: "Alpha", revenueRaw: "100" },
      { dateRaw: "2026-07-02", campaignKey: "Alpha", revenueRaw: "50" },
    ];
    const result = inspectGa4CsvRevenueDamage([
      { id: "csv-clean", campaignId: "c1", sourceType: "csv", platformContext: "ga4", isActive: true, mappingConfig: mapping(rows) },
    ], [
      { id: "r1", campaignId: "c1", revenueSourceId: "csv-clean", date: "2026-07-01", revenue: "100" },
      { id: "r2", campaignId: "c1", revenueSourceId: "csv-clean", date: "2026-07-02", revenue: "50" },
      { id: "r3", campaignId: "c1", revenueSourceId: "csv-clean", date: "2026-07-01", revenue: "100", subCampaignUrn: "alpha" },
    ]);

    expect(result.pass).toBe(true);
    expect(result.summary).toEqual({ csvSourceCount: 1, activeCsvSourceCount: 1, csvRecordCount: 3, findingCount: 0 });
  });

  it("reports only exact CSV candidates and never proposes cleanup", () => {
    const damagedRows = [
      { dateRaw: "2026-07-01", campaignKey: "Alpha", revenueRaw: "100" },
      { dateRaw: "invalid", campaignKey: "Alpha", revenueRaw: "50" },
    ];
    const sources = [
      { id: "csv-damaged", sourceType: "csv", platformContext: null, isActive: true, mappingConfig: mapping(damagedRows) },
      { id: "csv-zero", sourceType: "csv", platformContext: "ga4", isActive: true, mappingConfig: mapping(damagedRows, { csvHeaders: [], csvRowCount: 9 }) },
      { id: "csv-inactive", sourceType: "csv", platformContext: "ga4", isActive: false, mappingConfig: mapping(damagedRows) },
      { id: "sheet", sourceType: "google_sheets", platformContext: "ga4", isActive: true, mappingConfig: "{}" },
    ];
    const result = inspectGa4CsvRevenueDamage(sources, [
      { id: "r1", revenueSourceId: "csv-damaged", date: "2026-07-01", revenue: "40" },
      { id: "r2", revenueSourceId: "csv-damaged", date: "2026-07-01", revenue: "60" },
      { id: "r3", revenueSourceId: "csv-inactive", date: "2026-07-01", revenue: "25" },
      { id: "r4", revenueSourceId: "missing-csv", sourceType: "csv", date: "2026-07-01", revenue: "10" },
      { id: "r5", revenueSourceId: "sheet", sourceType: "google_sheets", date: "2026-07-01", revenue: "500" },
      { id: "r6", campaignId: "c1", revenueSourceId: "other-csv", date: "2026-07-01", revenue: "20" },
      { id: "r7", revenueSourceId: "sheet", sourceType: "csv", date: "2026-07-02", revenue: "30" },
    ], [
      ...sources,
      { id: "other-csv", campaignId: "c2", sourceType: "csv", platformContext: "ga4", isActive: true },
    ]);

    expect(result.pass).toBe(false);
    expect(result.findings.activeSourcesWithZeroRecords.map((row) => row.sourceId)).toEqual(["csv-zero"]);
    expect(result.findings.inactiveCsvSourceRecordGroups.map((row) => row.sourceId)).toEqual(["csv-inactive"]);
    expect(result.findings.orphanCsvRecordGroups).toEqual([{ sourceId: "missing-csv", recordCount: 1, recordIds: ["r4"] }]);
    expect(result.findings.crossCampaignCsvRecordGroups).toEqual([{ sourceId: "other-csv", recordCount: 1, recordIds: ["r6"] }]);
    expect(result.findings.wrongSourceTypeRecordGroups).toEqual([{ sourceId: "sheet", recordCount: 1, recordIds: ["r7"] }]);
    expect(result.findings.incompleteStoredMappingSources[0]).toMatchObject({
      sourceId: "csv-zero",
      issueCodes: ["missing_headers", "stored_row_count_mismatch"],
    });
    expect(result.findings.storedTotalMismatchSources.map((row) => row.sourceId).sort()).toEqual(["csv-damaged", "csv-zero"]);
    expect(result.findings.datedRevenueLossSources.map((row) => row.sourceId).sort()).toEqual(["csv-damaged", "csv-zero"]);
    expect(result.findings.duplicateRecordGroups).toEqual([{ sourceId: "csv-damaged", grain: "2026-07-01|", recordCount: 2, recordIds: ["r1", "r2"] }]);
  });

  it("excludes non-GA4 CSV and every non-CSV source family", () => {
    const result = inspectGa4CsvRevenueDamage([
      { id: "linkedin-csv", sourceType: "csv", platformContext: "linkedin", isActive: true, mappingConfig: "{}" },
      { id: "sheet", sourceType: "google_sheets", platformContext: "ga4", isActive: true, mappingConfig: "{}" },
    ], []);

    expect(result.pass).toBe(true);
    expect(result.summary.csvSourceCount).toBe(0);
  });

  it("keeps the existing campaign-guarded endpoint read-only and exposes a no-cleanup assessment", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const start = routes.indexOf('app.get("/api/campaigns/:id/ga4-overview/source-damage-inventory"');
    const end = routes.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"', start);
    const route = routes.slice(start, end);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);
    expect(route).toContain("requireCampaignAccessParamId");
    expect(route).toContain("inspectGa4CsvRevenueDamage");
    expect(route).toContain("csvInventoryPass");
    expect(route).toContain("csvCleanupAssessment");
    expect(route).toContain("automaticCleanupAllowed: false");
    expect(route).not.toMatch(/\.(insert|update|delete)\(/);
    expect(route).not.toContain("createRevenue");
    expect(route).not.toContain("deleteRevenue");
  });
});
