import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginFinancialDailySnapshotRefreshObservation,
  getFinancialDailySnapshotObservationStatus,
  recordFinancialDailySnapshotRefreshEvidence,
} from "./utils/financial-daily-snapshot-observation";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";

const campaignId = "campaign-1";
const reportingDate = "2026-08-21";

const successfulEvidence = () => {
  for (const stage of ["financial_sources", "ga4_daily"] as const) {
    recordFinancialDailySnapshotRefreshEvidence(stage, {
      campaignId,
      reportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
  }
};

const dependencies = (overrides: Record<string, unknown> = {}) => ({
  getCampaign: vi.fn().mockResolvedValue({ id: campaignId, currency: "USD", reportingTimeZone: "Europe/Amsterdam" }),
  getGA4Connections: vi.fn().mockResolvedValue([{
    campaignId,
    propertyId: "542352127",
    isActive: true,
    isPrimary: true,
    importStartDate: "2026-07-02",
  }]),
  getCampaignMetricTotals: vi.fn().mockResolvedValue({
    revenue: 72766.69,
    ga4Revenue: 55966.70,
    spend: 2699.75,
    conversions: 251,
    financialConversions: 251,
    users: 0,
    sessions: 0,
    engagementRate: 0,
    revenueBySource: new Map(),
    spendBySource: new Map(),
    revenueAvailable: true,
    spendAvailable: true,
    ga4Available: true,
    ga4RevenueAvailable: true,
    financialConversionsAvailable: true,
    ga4FinancialSource: "provider_to_date",
  }),
  getRevenueTotalForRange: vi.fn().mockResolvedValue({
    totalRevenue: 16799.99,
    currency: "USD",
    sourceIds: ["revenue-1"],
  }),
  getSpendTotalForRange: vi.fn().mockResolvedValue({
    totalSpend: 2699.75,
    currency: "USD",
    sourceIds: ["spend-1"],
  }),
  upsertFinancialDailySnapshot: vi.fn().mockResolvedValue({ id: "snapshot-1" }),
  now: () => new Date("2026-08-22T12:00:00.000Z"),
  ...overrides,
}) as any;

describe("gated financial daily snapshot writer", () => {
  beforeEach(() => {
    beginFinancialDailySnapshotRefreshObservation("financial_sources");
    beginFinancialDailySnapshotRefreshObservation("ga4_daily");
  });

  it("upserts the authoritative cumulative values only after both refresh stages pass", async () => {
    successfulEvidence();
    const deps = dependencies();

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith({
      version: "financial_daily_snapshot_v1",
      campaignId,
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
        revenue: { value: "72766.69", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
        conversions: { value: 251, available: true, sources: ["ga4"] },
      },
    });
    expect(getFinancialDailySnapshotObservationStatus()).toMatchObject({
      readyCampaigns: 1,
      writtenCampaigns: 1,
      writeFailedCampaigns: 0,
    });
  });

  it("does not write when same-day financial refresh evidence is missing", async () => {
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId,
      reportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    const deps = dependencies();

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("financial_sources_not_successful");
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("writes when the later financial refresh supplies the GA4 reporting date", async () => {
    const delayedReportingDate = "2026-08-22";
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId,
      reportingDate: delayedReportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    beginFinancialDailySnapshotRefreshObservation("financial_sources");
    recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
      campaignId,
      reportingDate: delayedReportingDate,
      status: "success",
      completedAt: "2026-08-23T18:41:00.000Z",
      failures: [],
    });
    const deps = dependencies({ now: () => new Date("2026-08-23T18:41:00.000Z") });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate: delayedReportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects a rolling GA4 fallback and leaves storage untouched", async () => {
    successfulEvidence();
    const deps = dependencies();
    deps.getCampaignMetricTotals.mockResolvedValue({
      ...(await deps.getCampaignMetricTotals()),
      ga4FinancialSource: "rolling_breakdown",
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result).toEqual({ status: "blocked", reasons: ["non_cumulative_ga4_financial_source"] });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("blocks incompatible spend currency before the readiness gate", async () => {
    successfulEvidence();
    const deps = dependencies({
      getSpendTotalForRange: vi.fn().mockResolvedValue({
        totalSpend: 2699.75,
        currency: "EUR",
        sourceIds: ["spend-1"],
      }),
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result).toEqual({ status: "blocked", reasons: ["spend_currency_mismatch"] });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("records and rethrows a database write failure", async () => {
    successfulEvidence();
    const deps = dependencies({
      upsertFinancialDailySnapshot: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).rejects.toThrow("database unavailable");
    expect(getFinancialDailySnapshotObservationStatus()).toMatchObject({
      writtenCampaigns: 0,
      writeFailedCampaigns: 1,
    });
  });

  it("reuses the same reporting-day identity on a same-day rerun", async () => {
    successfulEvidence();
    const deps = dependencies();

    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(2);
    expect(deps.upsertFinancialDailySnapshot.mock.calls[0][0]).toEqual(deps.upsertFinancialDailySnapshot.mock.calls[1][0]);
  });
});
