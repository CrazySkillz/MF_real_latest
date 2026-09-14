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

  it("labels CSV by file name and Google Sheets by saved sheet name in Spend Sources", () => {
    const overview = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf8",
    );
    const sourceList = sliceBetween(
      overview,
      "{spendDisplaySources.map((s: any) => {",
      "<Dialog open={showPipelineProxySourcesDialog}",
    );

    expect(sourceList).toContain('const primaryLabel = sourceType === "csv" || sourceType === "google_sheets"');
    expect(sourceList).toContain('String(s.displayName || cfg?.displayName || sourceTypeLabel)');
    expect(sourceList).toContain('String(cfg?.sheetName || sourceTypeLabel)');
    expect(sourceList).toContain('{primaryLabel}');
    expect(sourceList).toContain('{detailLabel}');
  });

  it("prevents Spend dialogs from shifting the page during scroll lock", () => {
    const overview = readFileSync(
      join(process.cwd(), "client", "src", "pages", "ga4-metrics.tsx"),
      "utf8",
    );
    const styles = readFileSync(
      join(process.cwd(), "client", "src", "index.css"),
      "utf8",
    );

    expect(modal).toContain("<DialogContent data-add-spend-dialog");
    expect(overview).toContain('<DialogContent data-spend-sources-dialog className="bg-card border-border max-w-lg">');
    for (const marker of ["data-spend-sources-dialog", "data-add-spend-dialog"]) {
      expect(styles).toMatch(new RegExp(
        `body\\[data-scroll-locked\\]:has\\(\\[${marker}\\]\\)\\s*\\{\\s*margin-right:\\s*0\\s*!important;\\s*\\}`,
      ));
    }
  });

  it("hides the Spend sheet-list scrollbar without disabling mouse scrolling", () => {
    const sheetsAuth = readFileSync(
      join(process.cwd(), "client", "src", "components", "SimpleGoogleSheetsAuth.tsx"),
      "utf8",
    );
    const sheetList = sliceBetween(
      sheetsAuth,
      '<div className={`space-y-2 max-h-64 min-h-24 overflow-y-auto',
      "{isLoadingSheets ? (",
    );

    expect(sheetList).toContain('overflow-y-auto');
    expect(sheetList).toContain('${isRevenueConnector ? "scrollbar-hide" : ""}');
    expect(sheetList).toContain('${purpose === "spend" ? "scrollbar-hide" : ""}');
  });

  it("shows a source-backed Connected status and opens the additive Spend sheet picker", () => {
    const statusCheck = sliceBetween(
      modal,
      "setHasGoogleSheetsSpendSource(false);",
      "  }, [props.open, props.campaignId, props.platformContext]);",
    );
    const sheetsCard = sliceBetween(
      modal,
      'className={`${hasGoogleSheetsSpendSource ? "cursor-default"',
      '<CardDescription>Import spend from a connected Google Sheet tab.</CardDescription>',
    );
    const sheetsChooser = sliceBetween(
      modal,
      '{step === "sheets_choose" && (',
      '{step === "csv" && (',
    );

    expect(statusCheck).toContain('/spend-sources${contextQuery}');
    expect(statusCheck).toContain('source?.isActive !== false');
    expect(statusCheck).toContain('source?.sourceType || "").toLowerCase() === "google_sheets"');
    expect(sheetsCard).toContain('<span>Connected</span>');
    expect(sheetsCard).toContain('Add another sheet');
    expect(sheetsCard).toContain('setShowSheetsConnect(true);');
    expect(sheetsCard).toContain('setStep("sheets_choose");');
    expect(sheetsChooser).toContain('selectionMode="append"');
    expect(sheetsChooser).toContain('purpose="spend"');
  });

  it("confirms and campaign-scopes the atomic Google Sheets Spend disconnect", () => {
    const routes = readFileSync(
      join(process.cwd(), "server", "routes-oauth.ts"),
      "utf8",
    );
    const handler = sliceBetween(
      modal,
      "const handleGoogleSheetsSpendDisconnect = async () => {",
      "  const processCsv = async () => {",
    );
    const sheetsCard = sliceBetween(
      modal,
      'className={`${hasGoogleSheetsSpendSource ? "cursor-default"',
      '<CardDescription>Import spend from a connected Google Sheet tab.</CardDescription>',
    );
    const route = sliceBetween(
      routes,
      "app.delete('/api/campaigns/:id/ga4/google-sheets-spend/disconnect'",
      'app.get("/api/campaigns/:id/spend-totals"',
    );

    expect(handler).toContain('/ga4/google-sheets-spend/disconnect');
    expect(handler).toContain('setHasGoogleSheetsSpendSource(false);');
    expect(handler).toContain('props.onProcessed?.();');
    expect(sheetsCard).toContain('aria-label="Disconnect Google Sheets Spend"');
    expect(sheetsCard).toContain('<AlertDialogTitle>Disconnect Google Sheets Spend</AlertDialogTitle>');
    expect(sheetsCard).toContain('Sheet connections used by Revenue or another platform will be preserved.');
    expect(route).toContain('requireCampaignAccessParamId');
    expect(route).toContain('storage.disconnectGa4GoogleSheetsSpend(campaignId)');
    expect(route).toContain('await recalcCampaignSpend(campaignId);');
    expect(route).toContain('await recomputeGA4KPIAndBenchmarkValues(campaignId, "Spend Update");');
  });

  it("shows uploaded CSV status and keeps add/delete behavior additive and exact", () => {
    const statusCheck = sliceBetween(
      modal,
      "setHasGoogleSheetsSpendSource(false);",
      "  }, [props.open, props.campaignId, props.platformContext]);",
    );
    const handler = sliceBetween(
      modal,
      "const handleCsvSpendSourceRemove = async () => {",
      "  const processCsv = async () => {",
    );
    const csvCard = sliceBetween(
      modal,
      'className={`cursor-pointer hover:border-blue-500 transition-colors ${isRemovingCsvSpendSource',
      '<Card className="hidden" onClick={() => setStep("manual")}>',
    );

    expect(statusCheck).toContain("setActiveCsvSpendSources(sources.filter");
    expect(statusCheck).toContain('source?.sourceType || "").toLowerCase() === "csv"');
    expect(csvCard).toContain("<span>Uploaded</span>");
    expect(csvCard).toContain("Add another file");
    expect(csvCard).toContain('setStep("csv");');
    expect(csvCard).toContain("activeCsvSpendSources.length === 1");
    expect(csvCard).toContain('aria-label="Remove CSV Spend source"');
    expect(csvCard).toContain("Open Spend Sources and use the trash icon beside the file you want to remove.");
    expect(csvCard).toContain("Each additional file is a separate source and adds to Total Spend.");
    expect(handler).toContain('cache: "no-store"');
    expect(handler).toContain("currentCsvSources.length !== 1");
    expect(handler).toContain('/spend-sources/${encodeURIComponent(sourceId)}${contextQuery}');
    expect(handler).toContain('method: "DELETE"');
    expect(handler).toContain("props.onProcessed?.();");
  });
});
