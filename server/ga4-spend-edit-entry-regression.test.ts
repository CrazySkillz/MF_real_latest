import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const modal = readFileSync(
  join(process.cwd(), "client", "src", "components", "AddSpendWizardModal.tsx"),
  "utf8",
);

const sliceBetween = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  expect(startIndex).toBeGreaterThan(-1);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
};

describe("GA4 Spend source edit entry", () => {
  it("opens Google Sheets and CSV edits at the first source-specific stage", () => {
    const synchronousEntry = sliceBetween(
      modal,
      "const targetStep: Step = (() => {",
      "    })();",
    );
    expect(synchronousEntry).toContain('if (st === "google_sheets") return "sheets_choose";');
    expect(synchronousEntry).toContain('if (st === "csv") return "csv";');
    expect(synchronousEntry).not.toContain('if (st === "google_sheets") return "sheets_map";');
    expect(synchronousEntry).not.toContain('if (st === "csv") return "csv_map";');

    const sheetsPrefill = sliceBetween(
      modal,
      'if (sourceType === "google_sheets") {',
      'if (sourceType === "csv") {',
    );
    const csvPrefill = sliceBetween(
      modal,
      'if (sourceType === "csv") {',
      'if (sourceType === "linkedin_api") {',
    );
    expect(sheetsPrefill).toContain('setStep("sheets_choose");');
    expect(sheetsPrefill).not.toContain('setStep("sheets_map");');
    expect(csvPrefill).toContain('setStep("csv");');
    expect(csvPrefill).not.toContain('setStep("csv_map");');
  });

  it("keeps first-stage cancel and retained CSV continuation safe in edit mode", () => {
    const sheetsChooser = sliceBetween(
      modal,
      '{step === "sheets_choose" && (',
      '{step === "csv" && (',
    );
    const csvUpload = sliceBetween(
      modal,
      '{step === "csv" && (',
      '{step === "paste" && (',
    );

    expect(sheetsChooser).toContain('onClick={() => isEditing ? props.onOpenChange(false) : setStep("select")}');
    expect(csvUpload).toContain('onClick={() => isEditing ? props.onOpenChange(false) : setStep("select")}');
    expect(csvUpload).toContain('isEditing && csvPreview?.success && canRecalculateCsvEditWithoutReupload');
    expect(csvUpload).toContain('setStep("csv_map");');
  });
});
