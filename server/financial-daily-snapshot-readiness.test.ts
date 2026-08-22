import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";
import { assessFinancialDailySnapshotReadiness, type FinancialDailyRefreshEvidence } from "./utils/financial-daily-snapshot-readiness";

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

const successfulRefresh: FinancialDailyRefreshEvidence = {
  campaignId: "campaign-1",
  reportingDate,
  status: "success",
  completedAt: "2026-08-22T22:05:00.000Z",
  failures: [],
};

const assess = (overrides: Record<string, unknown> = {}) => assessFinancialDailySnapshotReadiness({
  campaignId: "campaign-1",
  reportingDate,
  currency: "USD",
  requiredInputs: ["spend", "revenue", "conversions"],
  financialSourcesRefresh: successfulRefresh,
  ga4DailyRefresh: successfulRefresh,
  snapshot,
  ...overrides,
} as any);

describe("financial daily snapshot readiness", () => {
  it("allows only same-campaign, same-day, successful authoritative inputs", () => {
    expect(assess()).toEqual({ ready: true, reasons: [] });
  });

  it("fails closed when either refresh stage is incomplete or failed", () => {
    expect(assess({
      financialSourcesRefresh: { ...successfulRefresh, status: "failed", failures: ["shopify_refresh_failed"] },
      ga4DailyRefresh: { ...successfulRefresh, status: "running", completedAt: null },
    })).toEqual({
      ready: false,
      reasons: [
        "financial_sources_not_successful",
        "financial_sources_has_failures",
        "ga4_daily_not_successful",
        "ga4_daily_completion_missing",
      ],
    });
  });

  it("rejects cross-day, cross-campaign, rolling, and currency-mismatched candidates", () => {
    expect(assess({
      snapshot: {
        ...snapshot,
        currentValueWindow: { ...snapshot.currentValueWindow, mode: "rolling_90_days" },
      },
    })).toEqual({ ready: false, reasons: ["invalid_snapshot_contract"] });

    const result = assess({
      currency: "EUR",
      ga4DailyRefresh: { ...successfulRefresh, campaignId: "campaign-2", reportingDate: "2026-08-20" },
    });

    expect(result.ready).toBe(false);
    expect(result.reasons).toEqual([
      "snapshot_currency_mismatch",
      "ga4_daily_campaign_mismatch",
      "ga4_daily_reporting_date_mismatch",
    ]);
  });

  it("blocks configured inputs that remain unavailable without inventing zero", () => {
    const result = assess({
      snapshot: {
        ...snapshot,
        inputs: {
          ...snapshot.inputs,
          revenue: { value: null, available: false, sources: [] },
        },
      },
    });

    expect(result).toEqual({ ready: false, reasons: ["revenue_unavailable"] });
    expect(assess({
      requiredInputs: ["spend", "conversions"],
      snapshot: {
        ...snapshot,
        inputs: {
          ...snapshot.inputs,
          revenue: { value: null, available: false, sources: [] },
        },
      },
    })).toEqual({ ready: true, reasons: [] });
  });

  it("requires refresh completion after the reporting day closed in the campaign timezone", () => {
    expect(assess({
      ga4DailyRefresh: { ...successfulRefresh, completedAt: "2026-08-21T10:00:00.000Z" },
    })).toEqual({ ready: false, reasons: ["ga4_daily_completed_before_reporting_day_closed"] });

    expect(assess({
      snapshot: {
        ...snapshot,
        currentValueWindow: { ...snapshot.currentValueWindow, reportingTimeZone: "Invalid/Timezone" },
      },
    })).toEqual({ ready: false, reasons: ["invalid_snapshot_reporting_time_zone"] });
  });

  it("has no storage, scheduler, or snapshot-writer side effects", () => {
    const gate = readFileSync(join(process.cwd(), "server", "utils", "financial-daily-snapshot-readiness.ts"), "utf-8");
    const scheduler = readFileSync(join(process.cwd(), "server", "scheduler.ts"), "utf-8");
    const ga4Scheduler = readFileSync(join(process.cwd(), "server", "ga4-daily-scheduler.ts"), "utf-8");
    const autoRefresh = readFileSync(join(process.cwd(), "server", "auto-refresh-scheduler.ts"), "utf-8");

    expect(gate).not.toContain('from "../storage"');
    expect(gate).not.toContain("upsertFinancialDailySnapshot");
    expect(scheduler).not.toContain("assessFinancialDailySnapshotReadiness");
    expect(ga4Scheduler).not.toContain("assessFinancialDailySnapshotReadiness");
    expect(autoRefresh).not.toContain("assessFinancialDailySnapshotReadiness");
  });
});
