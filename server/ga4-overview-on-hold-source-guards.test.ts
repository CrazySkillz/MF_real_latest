import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const routes = read("server", "routes-oauth.ts");
const revenueModal = read("client", "src", "components", "AddRevenueWizardModal.tsx");
const spendModal = read("client", "src", "components", "AddSpendWizardModal.tsx");
const dataSourcesTab = read("client", "src", "components", "DataSourcesTab.tsx");

const routeSlice = (startMarker: string, endMarker: string) => {
  const start = routes.indexOf(startMarker);
  const end = routes.indexOf(endMarker, start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  return routes.slice(start, end);
};

describe("GA4 Overview source availability guards", () => {
  it("offers Google Sheets revenue and spend choices in GA4", () => {
    expect(revenueModal).not.toContain('{platformContext !== "ga4" && (');
    expect(spendModal).not.toContain('{props.platformContext !== "ga4" && (');
    expect(dataSourcesTab).toContain('platformContext="ga4"');
    expect(revenueModal).toContain('Import revenue from a connected Google Sheets tab');
    expect(spendModal).toContain('Import spend from a connected Google Sheet tab.');
    expect(revenueModal).toContain('if (type === "google_sheets")');
    expect(spendModal).toContain('if (st === "google_sheets") return "sheets_map";');
  });

  it("allows scoped new GA4 Google Sheets creation while preserving required platform context", () => {
    const revenueRoute = routeSlice(
      'app.post("/api/campaigns/:id/revenue/sheets/process"',
      "const spendSourceMatchesPlatformContext",
    );
    const spendRoute = routeSlice(
      'app.post("/api/campaigns/:id/spend/sheets/process"',
      "// Salesforce PKCE support",
    );

    expect(revenueRoute).not.toContain("temporarily unavailable for GA4 Overview");
    expect(revenueRoute).toContain("replaceRevenueSourceWithRecords(campaignId, existingSourceId, 'google_sheets', 'ga4'");
    expect(spendRoute).not.toContain("temporarily unavailable for GA4 Overview");
    expect(spendRoute).toContain("!requestedPlatformContext && !mapping?.sourceId");
    expect(spendRoute).toContain("replaceSpendSourceWithRecords(campaignId, existingSourceId, 'google_sheets', 'ga4'");
  });

  it("requires a date for new GA4 CSV spend in both UI and API while retaining source-ID edits", () => {
    const csvRoute = routeSlice(
      'app.post("/api/campaigns/:id/spend/csv/process"',
      'app.post("/api/campaigns/:id/spend/sheets/preview"',
    );

    expect(spendModal).toContain('const editingExistingUndatedGa4Csv = isEditing');
    expect(spendModal).toContain('const requiresDatedGa4Csv = props.platformContext === "ga4" && !editingExistingUndatedGa4Csv;');
    expect(spendModal).toContain('requiresDatedGa4Csv && !spendDateColumn');
    expect(spendModal).toContain('"Date column (required)"');
    expect(csvRoute).toContain('platformContext === "ga4" && !mapping?.dateColumn');
    expect(csvRoute).toContain("!requestedPlatformContext && !mapping?.sourceId");
    expect(csvRoute).toContain("const isExistingUndatedGa4Csv = !!existingSource");
    expect(csvRoute.indexOf('platformContext === "ga4" && !mapping?.dateColumn')).toBeLessThan(
      csvRoute.indexOf("const file = (req as any).file"),
    );
  });
});
