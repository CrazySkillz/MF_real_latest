import { describe, expect, it } from "vitest";
import {
  computeConnectedSheets,
  dedupeSourcesBySpreadsheetAndSheet,
  normalizeSheetNames,
  shouldDeactivateConnection,
  validateSheetNamesExist,
} from "./googleSheetsSelection";

describe("googleSheetsSelection", () => {
  it("normalizes sheet names", () => {
    expect(normalizeSheetNames([" A ", "", null, "B"])).toEqual(["A", "B"]);
    expect(normalizeSheetNames(undefined)).toEqual([]);
  });

  it("computes connected tabs using existing + availableSlots", () => {
    const out = computeConnectedSheets({
      normalizedSheetNames: ["LI_API_Campaign_Daily", "Revenue_Closed_Won", "ROI_ROAS_Calculations"],
      existingSheetNames: ["Revenue_Closed_Won"],
      availableSlots: 1,
    });
    expect(out.connectedSheetNames).toEqual(["LI_API_Campaign_Daily", "Revenue_Closed_Won"]);
    expect(out.sheetsToCreate).toEqual(["LI_API_Campaign_Daily"]);
  });

  it("validates tabs exist in spreadsheet", () => {
    const invalid = validateSheetNamesExist({
      normalizedSheetNames: ["A", "B", "C"],
      spreadsheetTabTitles: ["A", "C"],
    });
    expect(invalid).toEqual(["B"]);
  });

  it("decides deactivation correctly", () => {
    const keepIds = new Set(["id_keep"]);
    const selected = new Set(["LI_API_Campaign_Daily", "Revenue_Closed_Won"]);
    expect(
      shouldDeactivateConnection({
        connectionId: "id_keep",
        sheetName: "LI_API_Campaign_Daily",
        keepIds,
        selectedSheetNames: selected,
      }),
    ).toBe(false);
    expect(
      shouldDeactivateConnection({
        connectionId: "id_keep",
        sheetName: "ROI_ROAS_Calculations",
        keepIds,
        selectedSheetNames: selected,
      }),
    ).toBe(true);
    expect(
      shouldDeactivateConnection({
        connectionId: "id_other",
        sheetName: "Revenue_Closed_Won",
        keepIds,
        selectedSheetNames: selected,
      }),
    ).toBe(true);
  });

  it("dedupes sources by spreadsheetId+sheetName keeping newest", () => {
    const a = { spreadsheetId: "S", sheetName: "Tab", connectedAt: "2025-01-01T00:00:00Z", id: "a" };
    const b = { spreadsheetId: "S", sheetName: "Tab", connectedAt: "2025-01-02T00:00:00Z", id: "b" };
    const out = dedupeSourcesBySpreadsheetAndSheet([a as any, b as any]);
    expect(out).toHaveLength(1);
    expect((out[0] as any).id).toBe("b");
  });
});


