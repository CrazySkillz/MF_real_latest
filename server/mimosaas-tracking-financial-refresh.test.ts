import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import { refreshMimosaasTrackingGoogleSheetsFinancialSources } from "./mimosaas-tracking-financial-refresh";

describe("Mimosaas Tracking financial provider refresh", () => {
  it("refreshes only tracker-scoped Google Sheets sources by exact campaign and source ID", async () => {
    const store = {
      getRevenueSources: vi.fn().mockResolvedValue([
        { id: "revenue-sheet", sourceType: "google_sheets" },
        { id: "revenue-shopify", sourceType: "shopify" },
      ]),
      getSpendSources: vi.fn().mockResolvedValue([{ id: "spend-sheet", sourceType: "google_sheets" }]),
    };
    const adapters = {
      revenue: vi.fn().mockResolvedValue({ success: true }),
      spend: vi.fn().mockResolvedValue({ success: true }),
    };

    await expect(refreshMimosaasTrackingGoogleSheetsFinancialSources(
      "campaign-1", "2026-10-14", store as any, adapters,
    )).resolves.toEqual({ attempted: 2, succeeded: 2, failures: [] });
    expect(store.getRevenueSources).toHaveBeenCalledWith("campaign-1", "mimosaas_tracking");
    expect(store.getSpendSources).toHaveBeenCalledWith("campaign-1", "mimosaas_tracking");
    expect(adapters.revenue).toHaveBeenCalledWith("campaign-1", "revenue-sheet");
    expect(adapters.spend).toHaveBeenCalledWith("campaign-1", "spend-sheet");
  });

  it("records each failed source while continuing the remaining campaign-scoped jobs", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const store = {
      getRevenueSources: vi.fn().mockResolvedValue([{ id: "revenue-sheet", sourceType: "google_sheets" }]),
      getSpendSources: vi.fn().mockResolvedValue([{ id: "spend-sheet", sourceType: "google_sheets" }]),
    };
    const adapters = {
      revenue: vi.fn().mockResolvedValue({ success: false, reason: "reprocess_failed" }),
      spend: vi.fn().mockResolvedValue({ success: true }),
    };

    await expect(refreshMimosaasTrackingGoogleSheetsFinancialSources(
      "campaign-1", "2026-10-14", store as any, adapters,
    )).resolves.toEqual({
      attempted: 2,
      succeeded: 1,
      failures: ["revenue:revenue-sheet:reprocess_failed"],
    });
    expect(adapters.spend).toHaveBeenCalledTimes(1);
  });

  it("keeps tracker Google Sheets replacement exact, atomic, and separate from GA4 recompute", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const scheduler = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf8");
    const revenueStart = routes.indexOf('app.post("/api/campaigns/:id/revenue/sheets/process"');
    const revenueEnd = routes.indexOf("const spendSourceMatchesPlatformContext", revenueStart);
    const spendStart = routes.indexOf('app.post("/api/campaigns/:id/spend/sheets/process"');
    const spendEnd = routes.indexOf("// Salesforce PKCE support", spendStart);
    const revenueRoute = routes.slice(revenueStart, revenueEnd);
    const spendRoute = routes.slice(spendStart, spendEnd);

    expect(revenueRoute).toContain('platformContext === "mimosaas_tracking" && !dateCol');
    expect(revenueRoute).toContain('replaceRevenueSourceWithRecords(campaignId, existingSourceId, "google_sheets", "mimosaas_tracking"');
    expect(revenueRoute).toContain('existingSourceId ? String(existingSheetsSource?.mappingConfig || "") : undefined');
    expect(revenueRoute).toContain('res.status(e?.code === "REVENUE_SOURCE_CHANGED" ? 409 : 500)');
    expect(revenueRoute).toContain('allowNegative: platformContext !== "mimosaas_tracking"');
    expect(spendRoute).toContain('requestedPlatformContext !== "mimosaas_tracking"');
    expect(spendRoute).toContain('platformContext === "mimosaas_tracking" && !dateCol');
    expect(spendRoute).toContain('replaceSpendSourceWithRecords(campaignId, existingSourceId, "google_sheets", "mimosaas_tracking"');
    expect(spendRoute).toContain('existingSourceId ? String(existingSheetsSpendSource?.mappingConfig || "") : undefined');
    expect(spendRoute).toContain('res.status(e?.code === "SPEND_SOURCE_CHANGED" ? 409 : 500)');
    expect(spendRoute).toContain("allowNegative: false");
    expect(storage).toContain("if (expectedSourceMappingConfig) error.code = 'SPEND_SOURCE_CHANGED'");
    expect(scheduler).toContain('const validationContexts = [...refreshableRevenueContexts, "mimosaas_tracking"] as const');
    expect(scheduler).toContain('platformContext: ctx');
  });
});
