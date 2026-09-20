import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildExecutiveSummaryDailySnapshotInput,
  buildExecutiveSummaryFinancialSourceIdentity,
  evaluateExecutiveSummaryTrajectory,
} from "./utils/executive-summary-daily-snapshot";

const summary = (endDate: string, revenue: number) => ({
  version: "performance_summary_aggregate_v3",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate,
    dataThroughDate: endDate,
    reportingTimeZone: "Europe/Amsterdam",
  },
  sources: [
    { id: "ga4", category: "web_analytics", connected: true, includedMetrics: ["users", "sessions", "conversions", "revenue"] },
    { id: "revenue_source", category: "financial", connected: true, includedMetrics: ["revenue"] },
  ],
  totals: Object.fromEntries(["users", "sessions", "conversions", "revenue", "spend", "cvr", "cpa", "roas", "roi"]
    .map((name) => [name, { value: name === "revenue" ? revenue : 1, available: true, sources: [name === "revenue" ? "revenue_source" : "ga4"] }])),
});

const source = (selectedValue: string, lastRefreshSuccessAt = "2026-09-19T22:00:00.000Z") => ({
  id: "source-1",
  sourceType: "google_sheets",
  platformContext: "ga4",
  currency: "USD",
  mappingConfig: JSON.stringify({
    selectedValues: [selectedValue],
    campaignColumn: "Campaign",
    revenueColumn: "Revenue",
    lastRefreshSuccessAt,
    sheetSampleRows: [{ Campaign: selectedValue, Revenue: 100 }],
  }),
});

const snapshot = (endDate: string, revenue: number, selectedValue: string) => buildExecutiveSummaryDailySnapshotInput({
  campaignId: "campaign-1",
  currency: "USD",
  ga4PropertyId: "542352127",
  ga4CampaignFilter: "spring_campaign",
  performanceSummary: summary(endDate, revenue),
  financialSourceIdentities: { revenue: [buildExecutiveSummaryFinancialSourceIdentity(source(selectedValue))], spend: [] },
});

const row = (value: ReturnType<typeof snapshot>): any => {
  const { campaignId, reportingDate, ...executiveSummaryDaily } = value;
  return { campaignId, reportingDate, snapshotType: "executive_summary_daily", metrics: { executiveSummaryDaily } };
};

describe("Executive Summary snapshot configuration identity", () => {
  it("ignores refresh-only metadata but changes when source mapping changes", () => {
    const initial = buildExecutiveSummaryFinancialSourceIdentity(source("Spring"));
    const refreshed = buildExecutiveSummaryFinancialSourceIdentity(source("Spring", "2026-09-20T22:00:00.000Z"));
    const remapped = buildExecutiveSummaryFinancialSourceIdentity(source("Autumn"));

    expect(refreshed).toEqual(initial);
    expect(remapped.configurationFingerprint).not.toBe(initial.configurationFingerprint);
  });

  it("fails closed across an in-place remap while preserving compatible comparisons", () => {
    const current = snapshot("2026-09-19", 120, "Spring");
    const compatible = snapshot("2026-09-12", 100, "Spring");
    const remapped = snapshot("2026-09-12", 100, "Autumn");

    expect(evaluateExecutiveSummaryTrajectory(row(current), row(compatible))).toMatchObject({ available: true, trajectory: "accelerating" });
    expect(evaluateExecutiveSummaryTrajectory(row(current), row(remapped))).toMatchObject({ available: false, reason: "incompatible_history" });
    expect(current.sourceSignature.join("|")).not.toContain("Spring");
  });

  it("wires persisted source definitions into snapshot identity", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
    expect(routes).toContain("new Map(financialRevenueSourceDefinitions.map");
    expect(routes).toContain("new Map(financialSpendSourceDefinitions.map");
    expect(routes).toContain("buildExecutiveSummaryFinancialSourceIdentity(executiveRevenueSourceDefinitions.get");
    expect(routes).toContain("buildExecutiveSummaryFinancialSourceIdentity(executiveSpendSourceDefinitions.get");
  });
});
