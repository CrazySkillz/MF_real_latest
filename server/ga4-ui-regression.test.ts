import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = (relativePath: string) =>
  readFileSync(join(process.cwd(), "client", "src", ...relativePath.split("/")), "utf-8");

describe("GA4 UI regression guard", () => {
  it("keeps the GA4 analytics header provenance compact and explicit", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");
    const headerStart = ga4Metrics.indexOf("Back to main Campaign Overview");
    const headerEnd = ga4Metrics.indexOf("Connected Properties Management", headerStart);
    const headerSection = ga4Metrics.slice(headerStart, headerEnd);

    expect(headerStart).toBeGreaterThan(-1);
    expect(headerEnd).toBeGreaterThan(headerStart);
    expect(headerSection).toContain("Google Analytics");
    expect(headerSection).toContain("Client:");
    expect(headerSection).toContain("Campaign:");
    expect(headerSection).toContain("GA4 Property ID:");
    expect(headerSection).toContain("Property Campaigns:");
    expect(headerSection).not.toContain("Last updated:");
  });

  it("keeps revenue and spend source modals scrollable for many entries", () => {
    const ga4Metrics = readClient("pages/ga4-metrics.tsx");

    expect(ga4Metrics).toContain('<DialogTitle className="text-foreground">Revenue Sources</DialogTitle>');
    expect(ga4Metrics).toContain('<DialogTitle className="text-foreground">Spend Sources</DialogTitle>');
    expect(ga4Metrics).toContain('<div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">');
  });

  it("keeps Add Revenue source picker copy aligned with the production wording", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");

    expect(revenueModal).toContain("Import revenue from a connected Google Sheets tab");
    expect(revenueModal).toContain("Import revenue from a CSV. Requires manual re-upload to update.");
    expect(revenueModal).not.toContain("With a date column this behaves like daily history");
    expect(revenueModal).not.toContain("This is a one-time import and does not auto-sync");
  });

  it("keeps Add Spend source picker copy explicit about sync behavior", () => {
    const spendModal = readClient("components/AddSpendWizardModal.tsx");

    expect(spendModal).toContain("Import spend from a connected Google Sheet tab.");
    expect(spendModal).toContain("Import spend from a CSV. Requires manual re-upload to update.");
  });

  it("keeps revenue and spend add-source modals vertically scrollable inside the viewport", () => {
    const revenueModal = readClient("components/AddRevenueWizardModal.tsx");
    const spendModal = readClient("components/AddSpendWizardModal.tsx");

    expect(revenueModal).toContain('h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden');
    expect(revenueModal).toContain("overflow-y-auto");
    expect(spendModal).toContain('h-[95vh] max-h-[95vh] p-0 flex flex-col min-h-0 overflow-hidden');
    expect(spendModal).toContain("overflow-y-auto");
  });
});
