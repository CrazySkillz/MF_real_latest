import { describe, expect, it } from "vitest";
import { buildGoogleSheetsPlatformSourceForAggregate } from "./utils/google-sheets-aggregate-source";

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
    expect(source.metrics.revenue).toBeUndefined();
    expect(source.excludedMetrics).toContainEqual({
      metric: "revenue",
      reason: "Google Sheets confirmed revenue requires the dedicated revenue source path",
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
});
