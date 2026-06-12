import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildGoogleSheetsPlatformSourceForAggregate } from "./utils/google-sheets-aggregate-source";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("Google Sheets aggregate source adapter", () => {
  it("builds one main Google Sheets source from active general connections only", () => {
    const source = buildGoogleSheetsPlatformSourceForAggregate(
      { platform: "Meta, Google Sheets" },
      [
        {
          id: "main-sheet",
          spreadsheetId: "sheet-main",
          spreadsheetName: "Main Sheet",
          sheetName: "Performance",
          purpose: "general",
          isActive: true,
          columnMappings: JSON.stringify([
            { targetFieldId: "clicks", sourceColumnIndex: 1 },
            { targetFieldId: "conversions", sourceColumnIndex: 2 },
            { targetFieldId: "revenue", sourceColumnIndex: 3 },
          ]),
          cachedData: {
            rows: [
              ["Campaign A", "10", "2", "1000"],
              ["Campaign B", "5", "3", "500"],
            ],
          },
          lastDataRefreshAt: "2026-06-01T12:00:00.000Z",
        },
        {
          id: "child-sheet",
          spreadsheetId: "sheet-child",
          spreadsheetName: "Child Revenue Sheet",
          purpose: "meta_revenue",
          isActive: true,
          columnMappings: JSON.stringify([{ targetFieldId: "clicks", sourceColumnIndex: 1 }]),
          cachedData: { rows: [["Campaign A", "999"]] },
        },
      ],
    ) as any;

    expect(source).toBeTruthy();
    expect(source.id).toBe("google_sheets");
    expect(source.label).toBe("Google Sheets");
    expect(source.category).toBe("custom");
    expect(source.freshness.connectionIds).toEqual(["main-sheet"]);
    expect(source.includedMetrics).toEqual(["clicks", "conversions"]);
    expect(source.metrics.clicks).toBe(15);
    expect(source.metrics.conversions).toBe(5);
    expect(source.metrics.revenue).toBeNull();
    expect(source.excludedMetrics).toContainEqual({
      metric: "revenue",
      reason: "Google Sheets confirmed revenue requires an active google_sheets-scoped revenue source",
    });
  });

  it("does not build a source when Google Sheets is only a child financial source", () => {
    const source = buildGoogleSheetsPlatformSourceForAggregate(
      { platform: "Meta" },
      [
        {
          id: "child-sheet",
          spreadsheetId: "sheet-child",
          purpose: "meta_revenue",
          isActive: true,
          cachedData: { rows: [["Campaign A", "999"]] },
        },
      ],
    );

    expect(source).toBeNull();
  });

  it("renders Google Sheets financial cards from scoped confirmed sources and CRM Pipeline Proxy only", () => {
    const page = readSource("client", "src", "pages", "google-sheets-data.tsx");

    expect(page).toContain("renderGoogleSheetsFinancialCards");
    expect(page).toContain("Total Revenue");
    expect(page).toContain("Pipeline Proxy");
    expect(page).toContain("ROAS");
    expect(page).toContain("ROI");
    expect(page).toContain("/spend-totals?platformContext=google_sheets&dateRange=all");
    expect(page).toContain("/pipeline-proxy?platformContext=google_sheets");
    expect(page).toContain("Open CRM value only. Not counted in Total Revenue, ROI, or ROAS.");
    expect(page).toContain("Requires confirmed revenue and spend");
  });

  it("filters Google Sheets spend totals by google_sheets platformContext for derived financial cards", () => {
    const routes = readSource("server", "routes-oauth.ts");
    const spendTotalsRoute = sliceBetween(
      routes,
      'app.get("/api/campaigns/:id/spend-totals"',
      '// Spend-to-date (campaign lifetime)'
    );

    expect(spendTotalsRoute).toContain('platformContext === "google_sheets"');
    expect(spendTotalsRoute).toContain('String(source?.platformContext || "").trim().toLowerCase() === "google_sheets"');
    expect(spendTotalsRoute).toContain("eligibleSourceIds.has");
    expect(spendTotalsRoute).toContain("totalSpend: Number(totalSpend.toFixed(2))");
  });
});
