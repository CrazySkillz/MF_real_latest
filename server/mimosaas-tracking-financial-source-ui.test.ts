import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf8");
const overview = read("client", "src", "components", "MimosaasTrackingOverview.tsx");
const campaignDetail = read("client", "src", "pages", "campaign-detail.tsx");
const revenueModal = read("client", "src", "components", "AddRevenueWizardModal.tsx");
const spendModal = read("client", "src", "components", "AddSpendWizardModal.tsx");

describe("Mimosaas Tracking financial source UI", () => {
  it("opens only the date-mapped Google Sheets Revenue and Spend flows from the tracker Overview", () => {
    expect(overview).toContain('aria-label="Add Google Sheets Revenue"');
    expect(overview).toContain('aria-label="Add Google Sheets Spend"');
    expect(overview).toContain('platformContext="mimosaas_tracking"');
    expect(overview).toContain('initialStep="sheets_choose"');
    expect(overview).toContain("lockInitialStep");
    expect(campaignDetail).toContain('<MimosaasTrackingOverview campaignId={campaign.id} currency={campaign.currency || "USD"} />');
  });

  it("edits only the exact tracker source returned by the protected source route", () => {
    expect(overview).toContain('aria-label={`Edit Google Sheets ${kind} source ${name}`}');
    expect(overview).toContain("setRevenueSourceToEdit(source)");
    expect(overview).toContain("setSpendSourceToEdit(source)");
    expect(overview).toContain("initialSource={revenueSourceToEdit || undefined}");
    expect(overview).toContain("initialSource={spendSourceToEdit || undefined}");
    expect(overview).not.toContain("DELETE");
  });

  it("passes the selected source ID through the existing scoped Sheets edit requests", () => {
    expect(revenueModal).toContain('{ sourceId: String(initialSource.id) }');
    expect(spendModal).toContain('{ sourceId: String(props.initialSource.id) }');
    expect(revenueModal).toContain('/revenue/sheets/process');
    expect(spendModal).toContain('/spend/sheets/process');
  });

  it("keeps executive values on the immutable snapshot route", () => {
    expect(overview).toContain("/mimosaas-tracking/daily-snapshot");
    expect(overview).toContain("/mimosaas-tracking/financial-sources");
    expect(overview).not.toContain("revenue-to-date");
    expect(overview).not.toContain("spend-to-date");
    expect(overview).not.toContain("all-data-sources");
  });

  it("requires a tracker Revenue date before calling the scoped Sheets process route", () => {
    expect(revenueModal).toContain("'mimosaas_tracking'");
    expect(revenueModal).toContain('platformContext === "mimosaas_tracking"');
    expect(revenueModal).toContain('/mimosaas-tracking/financial-sources`');
    const start = revenueModal.indexOf("const handleSheetsProcess = async () =>");
    const end = revenueModal.indexOf("const title =", start);
    const process = revenueModal.slice(start, end);
    expect(process).toContain('platformContext === "mimosaas_tracking" && !sheetsDateCol');
    expect(process.indexOf('platformContext === "mimosaas_tracking" && !sheetsDateCol')).toBeLessThan(process.indexOf("/revenue/sheets/process"));
    expect(revenueModal).toContain('platformContext !== "mimosaas_tracking" && <SelectItem value={SELECT_NONE}>None</SelectItem>');
    expect(revenueModal).toContain("(platformContext === \"mimosaas_tracking\" && !sheetsDateCol)");
  });

  it("requires a tracker Spend date and does not widen generic financial read routes", () => {
    expect(spendModal).toContain('props.platformContext === "mimosaas_tracking"');
    expect(spendModal).toContain('`/api/campaigns/${props.campaignId}/mimosaas-tracking/financial-sources`');
    expect(spendModal).toContain('source?.platformContext || "").trim().toLowerCase() === "mimosaas_tracking"');
    const start = spendModal.indexOf("const processSheets = async () =>");
    const end = spendModal.indexOf("//", start);
    const process = spendModal.slice(start, end);
    expect(process).toContain("requiresDatedTrackerSheet && !spendDateColumn");
    expect(process.indexOf("requiresDatedTrackerSheet && !spendDateColumn")).toBeLessThan(process.indexOf("/spend/sheets/process"));
    expect(spendModal).toContain("(requiresDatedTrackerSheet && !spendDateColumn)");
  });

  it("preserves the existing GA4 date requirements", () => {
    expect(revenueModal).toContain('platformContext === "ga4"');
    expect(spendModal).toContain('const requiresDatedGa4Csv = props.platformContext === "ga4" && !editingExistingUndatedGa4Csv;');
    expect(spendModal).toContain('"A date column is required for GA4 Overview CSV spend."');
  });
});
