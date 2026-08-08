import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGoogleAdsConnection: vi.fn(),
  getSpendSources: vi.fn(),
  getGoogleAdsDailyMetrics: vi.fn(),
  replaceSpendRecordsForSource: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  updateCampaign: vi.fn(),
}));
const runJobsMock = vi.hoisted(() => vi.fn());

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./db", () => ({ db: {} }));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({ runGA4DailyKPIAndBenchmarkJobs: runJobsMock }));

import { materializeGA4GoogleAdsSpendForCampaign } from "./google-ads-scheduler";

const successfulRecompute = {
  campaignsProcessed: 1,
  campaignIdsSkipped: [],
  campaignIdsFailed: [],
  kpiIdsSkipped: [],
  kpiIdsFailed: [],
  benchmarkIdsSkipped: [],
  benchmarkIdsFailed: [],
  alertReconciliationFailures: [],
};

describe("GA4 Google Ads scheduler materialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getSpendSources.mockResolvedValue([{
      id: "source-1",
      sourceType: "ad_platforms",
      platformContext: "ga4",
      currency: "USD",
      isActive: true,
      mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["ads-1"] }),
    }]);
    storageMock.getGoogleAdsDailyMetrics.mockResolvedValue([{
      campaignId: "campaign-1",
      googleCampaignId: "ads-1",
      googleCampaignName: "Search",
      date: "2026-08-04",
      spend: "12.34",
    }]);
    storageMock.replaceSpendRecordsForSource.mockResolvedValue(undefined);
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 12.34, currency: "USD", sourceIds: ["source-1"] });
    storageMock.updateCampaign.mockResolvedValue(undefined);
    runJobsMock.mockResolvedValue(successfulRecompute);
  });

  it("uses the actual provider facts, exact selected scope, completed day, and downstream recompute", async () => {
    const campaign = {
      id: "campaign-1",
      currency: "USD",
      startDate: "2026-08-01T00:00:00.000Z",
      reportingTimeZone: "Europe/Amsterdam",
    };
    const connection = {
      campaignId: campaign.id,
      method: "oauth",
      spendOnly: true,
      customerName: "Account",
      selectedCampaignIds: JSON.stringify(["ads-1"]),
      lastRefreshAt: new Date().toISOString(),
    };

    const result = await materializeGA4GoogleAdsSpendForCampaign(campaign.id, campaign, connection);

    expect(result).toEqual({ updated: true, sourceId: "source-1", records: 1, totalSpend: 12.34 });
    expect(storageMock.getGoogleAdsDailyMetrics).toHaveBeenCalledWith(campaign.id, "2026-08-01", "2026-08-05");
    expect(storageMock.replaceSpendRecordsForSource).toHaveBeenCalledWith(
      campaign.id,
      "source-1",
      "ad_platforms",
      "ga4",
      [expect.objectContaining({ date: "2026-08-04", spend: "12.34", currency: "USD" })],
    );
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith(campaign.id, "1900-01-01", "2026-08-05", "ga4");
    expect(storageMock.updateCampaign).toHaveBeenCalledWith(campaign.id, { spend: "12.34" });
    expect(runJobsMock).toHaveBeenCalledWith({ campaignId: campaign.id });
  });

  it("fails before replacement when saved source and OAuth selected campaign scopes differ", async () => {
    const campaign = { id: "campaign-1", currency: "USD", startDate: "2026-08-01", reportingTimeZone: "Europe/Amsterdam" };
    const connection = {
      campaignId: campaign.id,
      method: "oauth",
      spendOnly: true,
      selectedCampaignIds: JSON.stringify(["ads-2"]),
      lastRefreshAt: new Date().toISOString(),
    };

    await expect(materializeGA4GoogleAdsSpendForCampaign(campaign.id, campaign, connection))
      .rejects.toThrow("selected campaign scope mismatch");
    expect(storageMock.replaceSpendRecordsForSource).not.toHaveBeenCalled();
    expect(runJobsMock).not.toHaveBeenCalled();
  });
});
