import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { inspectGa4GoogleSheetsRevenueDamage } from "./utils/google-sheets-revenue-damage-inventory";

const cleanMapping = (overrides: Record<string, any> = {}) => JSON.stringify({
  connectionId: "conn-1",
  spreadsheetId: "spreadsheet-1",
  sheetName: "Revenue",
  revenueColumn: "Revenue",
  campaignColumn: "Campaign",
  campaignValues: ["Alpha"],
  dateColumn: "Date",
  currency: "USD",
  campaignValueRevenueTotals: [{ campaignValue: "Alpha", revenue: 150 }],
  allocationMethod: "ga4_campaign_exact_match_v1",
  lastSyncedAt: "2026-09-11T10:00:00.000Z",
  ...overrides,
});

const cleanInput = () => ({
  campaigns: [{ id: "campaign-1", currency: "USD" }],
  connections: [{
    id: "conn-1", campaignId: "campaign-1", spreadsheetId: "spreadsheet-1", sheetName: "Revenue",
    purpose: "revenue", isActive: true, hasAccessToken: true, hasRefreshToken: true, hasClientId: true, hasClientSecret: true,
  }],
  sources: [{
    id: "source-1", campaignId: "campaign-1", sourceType: "google_sheets", platformContext: "ga4",
    displayName: "Google Sheets revenue", currency: "USD", mappingConfig: cleanMapping(), isActive: true,
  }],
  records: [
    { id: "record-1", campaignId: "campaign-1", revenueSourceId: "source-1", date: "2026-09-10", revenue: "100", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
    { id: "record-2", campaignId: "campaign-1", revenueSourceId: "source-1", date: "2026-09-11", revenue: "50", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
  ],
});

describe("Google Sheets Revenue damaged-data inventory", () => {
  it("passes exact local persistence while retaining provider-only limitations", () => {
    const result = inspectGa4GoogleSheetsRevenueDamage(cleanInput());
    expect(result.pass).toBe(true);
    expect(result.scopeComplete).toBe(false);
    expect(result.summary).toEqual({
      ga4GoogleSheetsSourceCount: 1,
      activeGa4GoogleSheetsSourceCount: 1,
      referencedConnectionCount: 1,
      googleSheetsRecordCount: 2,
      findingCount: 0,
    });
    expect(result.notLocallyVerifiable).toContain("the latest provider read was complete and matched the persisted materialization");
  });

  it("reports mapping, connection, currency, attribution, and sync mismatches without inventing repairs", () => {
    const input = cleanInput();
    input.connections[0] = {
      ...input.connections[0], campaignId: "campaign-2", spreadsheetId: "spreadsheet-2", sheetName: "Other",
      isActive: false, hasAccessToken: false, hasRefreshToken: false, hasClientId: false, hasClientSecret: false,
    };
    input.sources[0] = {
      ...input.sources[0], currency: "EUR", mappingConfig: cleanMapping({
        campaignValues: [],
        campaignValueRevenueTotals: [{ campaignValue: "Beta", revenue: 10 }],
        allocationMethod: null,
        lastSyncedAt: "2026-09-10T00:00:00.000Z",
      }),
    };
    input.records[0] = { ...input.records[0], currency: "EUR" };

    const result = inspectGa4GoogleSheetsRevenueDamage(input);
    expect(result.pass).toBe(false);
    expect(result.findings.incompleteMappingSources[0].issueCodes).toContain("missing_campaign_values");
    expect(result.findings.crossCampaignConnectionSources).toHaveLength(1);
    expect(result.findings.inactiveConnectionSources).toHaveLength(1);
    expect(result.findings.connectionMetadataSources[0].issueCodes).toContain("missing_credential_material");
    expect(result.findings.connectionMetadataSources[0].issueCodes).toContain("missing_refresh_credential_material");
    expect(result.findings.connectionIdentityMismatchSources[0].issueCodes).toEqual(["spreadsheet_id_mismatch", "sheet_name_mismatch"]);
    expect(result.findings.sourceCurrencyMismatchGroups).toHaveLength(1);
    expect(result.findings.campaignValueTotalMismatchSources).toHaveLength(1);
    expect(result.findings.lastSyncedAtMismatchSources).toHaveLength(1);
  });

  it("reports exact record/link defects and excludes non-GA4 Google Sheets sources", () => {
    const input = cleanInput();
    input.sources.push(
      { id: "inactive", campaignId: "campaign-1", sourceType: "google_sheets", platformContext: null, currency: "USD", mappingConfig: cleanMapping(), isActive: false },
      { id: "other", campaignId: "campaign-1", sourceType: "csv", platformContext: "ga4", currency: "USD", isActive: true },
      { id: "linkedin", campaignId: "campaign-1", sourceType: "google_sheets", platformContext: "linkedin", currency: "USD", isActive: true },
    );
    input.records.push(
      { id: "duplicate", campaignId: "campaign-1", revenueSourceId: "source-1", date: "2026-09-10", revenue: "5", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "bad-date", campaignId: "campaign-1", revenueSourceId: "source-1", date: "2026-02-30", revenue: "0", currency: "USD", sourceType: "csv", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "cross-campaign", campaignId: "campaign-2", revenueSourceId: "source-1", date: "2026-09-09", revenue: "1", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "inactive-record", campaignId: "campaign-1", revenueSourceId: "inactive", date: "2026-09-09", revenue: "1", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "orphan", campaignId: "campaign-1", revenueSourceId: "missing", date: "2026-09-09", revenue: "1", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "wrong-source", campaignId: "campaign-1", revenueSourceId: "other", date: "2026-09-09", revenue: "1", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
      { id: "excluded", campaignId: "campaign-1", revenueSourceId: "linkedin", date: "2026-09-09", revenue: "1", currency: "USD", sourceType: "google_sheets", createdAt: "2026-09-11T10:00:10.000Z" },
    );

    const result = inspectGa4GoogleSheetsRevenueDamage(input);
    expect(result.summary.ga4GoogleSheetsSourceCount).toBe(2);
    expect(result.findings.inactiveSourceRecordGroups.map((row) => row.sourceId)).toEqual(["inactive"]);
    expect(result.findings.orphanGoogleSheetsRecordGroups[0].recordIds).toEqual(["orphan"]);
    expect(result.findings.crossCampaignRecordGroups[0].recordIds).toEqual(["cross-campaign"]);
    expect(result.findings.wrongSourceTypeRecordGroups).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceId: "source-1", recordIds: ["bad-date"] }),
      expect.objectContaining({ sourceId: "other", recordIds: ["wrong-source"] }),
    ]));
    expect(result.findings.invalidRecordDateGroups[0].recordIds).toEqual(["bad-date"]);
    expect(result.findings.invalidRecordRevenueGroups[0].recordIds).toEqual(["bad-date"]);
    expect(result.findings.duplicateRecordGroups[0].grain).toBe("2026-09-10|");
  });

  it("reports a missing campaign without assuming a currency", () => {
    const input = cleanInput();
    input.campaigns = [];

    const result = inspectGa4GoogleSheetsRevenueDamage(input);
    expect(result.findings.missingCampaignSources).toHaveLength(1);
    expect(result.findings.sourceCurrencyMismatchGroups).toHaveLength(0);
  });

  it("keeps the executable inventory in an explicit read-only transaction", () => {
    const script = readFileSync(join(process.cwd(), "scripts", "google-sheets-revenue-inventory-readonly.ts"), "utf8");
    expect(script).toContain('client.query("BEGIN TRANSACTION READ ONLY")');
    expect(script).toContain('client.query("ROLLBACK")');
    expect(script).toContain("automaticCleanupAllowed: false");
    expect(script).toContain("cleanupProposalGenerated: false");
    expect(script).not.toMatch(/client\.query\([`'"]\s*(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/i);
  });
});
