import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { resolveCampaignCumulativeFinancials } from "./utils/campaign-cumulative-financials";

const performanceSummary = {
  campaignId: "campaign-1",
  version: "performance_summary_aggregate_v3",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: "2026-08-21",
    dataThroughDate: "2026-08-21",
    reportingTimeZone: "Europe/Amsterdam",
  },
  totals: {
    spend: { value: 2699.75, available: true, sources: ["canonical_spend_sources"] },
    revenue: { value: 72766.69, available: true, sources: ["ga4", "revenue_hubspot"] },
    conversions: { value: 251, available: true, sources: ["ga4"] },
  },
};

const resolve = (summary: any = performanceSummary) => resolveCampaignCumulativeFinancials({
  campaignId: "campaign-1",
  currency: "USD",
  performanceSummary: summary,
  nativeRevenue: 55966.70,
  importedRevenue: 16799.99,
});

describe("authoritative cumulative campaign financial resolver", () => {
  it("uses one compatible cumulative source for live financials and the future snapshot", () => {
    const result = resolve();

    expect(result.financials).toEqual({
      nativeRevenue: 55966.70,
      importedRevenue: 16799.99,
      totalRevenue: 72766.69,
      spend: 2699.75,
      conversions: 251,
      profit: 70066.94,
      roas: 72766.69 / 2699.75,
      roi: (70066.94 / 2699.75) * 100,
      cpa: 2699.75 / 251,
    });
    expect(result.snapshot).toEqual({
      version: "financial_daily_snapshot_v1",
      campaignId: "campaign-1",
      reportingDate: "2026-08-21",
      currency: "USD",
      currentValueWindow: performanceSummary.currentValueWindow,
      inputs: {
        spend: { value: "2699.75", available: true, sources: ["canonical_spend_sources"] },
        revenue: { value: "72766.69", available: true, sources: ["ga4", "revenue_hubspot"] },
        conversions: { value: 251, available: true, sources: ["ga4"] },
      },
    });
  });

  it("stores unavailable inputs as unavailable instead of retaining stale values", () => {
    const result = resolve({
      ...performanceSummary,
      totals: {
        ...performanceSummary.totals,
        revenue: { value: 72766.69, available: false, sources: [] },
      },
    });

    expect(result.snapshot.inputs.revenue).toEqual({ value: null, available: false, sources: [] });
  });

  it("rejects rolling, mismatched, or internally incompatible inputs", () => {
    expect(() => resolve({ ...performanceSummary, version: "performance_summary_aggregate_v2" })).toThrow(/v3/);
    expect(() => resolve({
      ...performanceSummary,
      currentValueWindow: { ...performanceSummary.currentValueWindow, endDate: "2026-08-20" },
    })).toThrow();
    expect(() => resolve({
      ...performanceSummary,
      totals: {
        ...performanceSummary.totals,
        spend: { value: 2699.75, available: true, sources: [] },
      },
    })).toThrow(/authoritative sources/);
    expect(() => resolveCampaignCumulativeFinancials({
      campaignId: "campaign-1",
      currency: "USD",
      performanceSummary,
      nativeRevenue: 1,
      importedRevenue: 2,
    })).toThrow(/do not match/);
  });

  it("is shared by the read-only Budget API and scheduler-owned gated writer", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");
    const ga4Scheduler = readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");
    const writer = readFileSync(join(process.cwd(), "server", "utils", "financial-daily-snapshot-writer.ts"), "utf-8");

    expect(routes).toContain("resolveCampaignCumulativeFinancials({");
    expect(routes).toContain("performanceSummary,");
    expect(routes).not.toContain(".upsertFinancialDailySnapshot(");
    expect(scheduler).not.toContain("resolveCampaignCumulativeFinancials");
    expect(scheduler).not.toContain(".upsertFinancialDailySnapshot(");
    expect(writer).toContain("resolveCampaignCumulativeFinancials({");
    expect(writer).toContain("upsertFinancialDailySnapshot(cumulative.snapshot)");
    expect(ga4Scheduler).toContain("writeFinancialDailySnapshotIfReady({ campaignId: processedCampaignId, reportingDate })");
  });
});
