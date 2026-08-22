import { readFileSync } from "fs";
import { join } from "path";
import { beforeEach, describe, expect, it } from "vitest";
import {
  beginFinancialDailySnapshotRefreshObservation,
  getFinancialDailySnapshotObservationStatus,
  observeFinancialDailySnapshotReadiness,
  recordFinancialDailySnapshotRefreshEvidence,
} from "./utils/financial-daily-snapshot-observation";

const reportingDate = "2026-08-21";
const snapshot = {
  version: "financial_daily_snapshot_v1",
  campaignId: "campaign-1",
  reportingDate,
  currency: "USD",
  currentValueWindow: {
    mode: "initial_import_to_latest_completed_day",
    startDate: "2026-07-02",
    endDate: reportingDate,
    dataThroughDate: reportingDate,
    reportingTimeZone: "Europe/Amsterdam",
  },
  inputs: {
    spend: { value: "2699.75", available: true, sources: ["canonical_spend_sources"] },
    revenue: { value: "72766.69", available: true, sources: ["ga4", "revenue_hubspot"] },
    conversions: { value: 251, available: true, sources: ["ga4"] },
  },
};

const observe = () => observeFinancialDailySnapshotReadiness({
  campaignId: "campaign-1",
  reportingDate,
  currency: "USD",
  requiredInputs: ["spend", "revenue", "conversions"],
  snapshot,
});

describe("financial daily snapshot observation", () => {
  beforeEach(() => {
    beginFinancialDailySnapshotRefreshObservation("financial_sources");
    beginFinancialDailySnapshotRefreshObservation("ga4_daily");
  });

  it("observes readiness only after both same-day campaign refreshes completed", () => {
    for (const stage of ["financial_sources", "ga4_daily"] as const) {
      recordFinancialDailySnapshotRefreshEvidence(stage, {
        campaignId: "campaign-1",
        reportingDate,
        status: "success",
        completedAt: "2026-08-22T22:05:00.000Z",
        failures: [],
      });
    }

    expect(observe()).toEqual({ ready: true, reasons: [] });
    expect(getFinancialDailySnapshotObservationStatus()).toMatchObject({
      mode: "observation_only",
      snapshotWritesEnabled: false,
      financialSourceEvidenceCampaigns: 1,
      ga4DailyEvidenceCampaigns: 1,
      observedCampaigns: 1,
      readyCampaigns: 1,
      blockedCampaigns: 0,
      blockingReasons: {},
    });
  });

  it("clears stale evidence when either scheduler starts a new run", () => {
    recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
      campaignId: "campaign-1",
      reportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    beginFinancialDailySnapshotRefreshObservation("financial_sources");

    const result = observe();
    expect(result.ready).toBe(false);
    expect(result.reasons).toContain("financial_sources_not_successful");
    expect(result.reasons).toContain("ga4_daily_not_successful");
  });

  it("connects observation without storage or snapshot-writer access", () => {
    const observer = readFileSync(join(process.cwd(), "server", "utils", "financial-daily-snapshot-observation.ts"), "utf-8");
    const autoRefresh = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");
    const ga4Daily = readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf-8");

    expect(observer).toContain("assessFinancialDailySnapshotReadiness");
    expect(observer).not.toContain('from "../storage"');
    expect(observer).not.toContain("upsertFinancialDailySnapshot");
    expect(autoRefresh).toContain('recordFinancialDailySnapshotRefreshEvidence("financial_sources"');
    expect(autoRefresh).toContain("getCampaignAutoRefreshFailures({");
    expect(autoRefresh).not.toContain('status: failure ? "failed" : "success"');
    expect(ga4Daily).toContain('recordFinancialDailySnapshotRefreshEvidence("ga4_daily"');
    expect(routes).toContain("observeFinancialDailySnapshotReadiness({");
    expect(index).toContain("financialDailySnapshot: getFinancialDailySnapshotObservationStatus()");
    expect(autoRefresh).not.toContain("upsertFinancialDailySnapshot");
    expect(ga4Daily).not.toContain("upsertFinancialDailySnapshot");
    expect(routes).not.toContain(".upsertFinancialDailySnapshot(");
  });
});
