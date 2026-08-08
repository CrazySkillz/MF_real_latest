import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getDailyMetrics = vi.fn();
  const getCustomerAccount = vi.fn();
  const refreshAccessToken = vi.fn();

  class MockGoogleAdsClient {
    static refreshAccessToken = refreshAccessToken;
    static microsToAmount(micros: number) {
      return micros / 1_000_000;
    }

    getDailyMetrics = getDailyMetrics;
    getCustomerAccount = getCustomerAccount;
  }

  return {
    getDailyMetrics,
    getCustomerAccount,
    refreshAccessToken,
    MockGoogleAdsClient,
    storage: {
      getGoogleAdsConnection: vi.fn(),
      getCampaign: vi.fn(),
      updateGoogleAdsConnection: vi.fn(),
      replaceGoogleAdsDailyMetricsForWindow: vi.fn(),
      getGoogleAdsDailyMetrics: vi.fn(),
      getSpendSources: vi.fn(),
      replaceSpendRecordsForSource: vi.fn(),
      getSpendTotalForRange: vi.fn(),
      updateCampaign: vi.fn(),
      updateGoogleAdsDailyMetricsGA4Revenue: vi.fn(),
    },
    db: {
      select: vi.fn(() => ({ from: vi.fn(async () => []) })),
    },
  };
});

vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./googleAdsClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleAdsClient")>()),
  GoogleAdsClient: mocks.MockGoogleAdsClient,
}));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({
  runGA4DailyKPIAndBenchmarkJobs: vi.fn(async () => ({
    campaignsProcessed: 1,
    campaignIdsSkipped: [], campaignIdsFailed: [], kpiIdsSkipped: [], kpiIdsFailed: [],
    benchmarkIdsSkipped: [], benchmarkIdsFailed: [], alertReconciliationFailures: [],
  })),
}));

import { refreshGoogleAdsForCampaign } from "./google-ads-scheduler";

describe("Google Ads GA4 Overview spend production path", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    vi.clearAllMocks();
    mocks.storage.getCampaign.mockResolvedValue({ id: "campaign-1", startDate: "2026-07-01", reportingTimeZone: "Europe/Amsterdam", currency: "USD" });
    mocks.storage.updateGoogleAdsConnection.mockResolvedValue({ id: "conn-1" });
    mocks.storage.replaceGoogleAdsDailyMetricsForWindow.mockResolvedValue({ replaced: 1 });
    mocks.storage.getGoogleAdsConnection.mockResolvedValue({ method: "oauth", spendOnly: true, customerName: "Account", selectedCampaignIds: JSON.stringify(["google-campaign-1"]), lastRefreshAt: new Date() });
    mocks.storage.getSpendSources.mockResolvedValue([{ id: "source-1", sourceType: "ad_platforms", currency: "USD", isActive: true, mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["google-campaign-1"] }) }]);
    mocks.storage.getGoogleAdsDailyMetrics.mockResolvedValue([{ campaignId: "campaign-1", googleCampaignId: "google-campaign-1", googleCampaignName: "Brand Search", date: "2026-07-01", spend: "123.45" }]);
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 123.45, currency: "USD", sourceIds: ["source-1"] });
    mocks.getCustomerAccount.mockResolvedValue({ manager: false, currencyCode: "USD", timeZone: "Europe/Amsterdam" });
    mocks.refreshAccessToken.mockResolvedValue({ access_token: "fresh-token", expires_in: 3600 });
    mocks.getDailyMetrics.mockResolvedValue([
      {
        campaignId: "google-campaign-1",
        campaignName: "Brand Search",
        date: "2026-07-01",
        impressions: 1000,
        clicks: 100,
        costMicros: 123_450_000,
        conversions: 2,
        conversionsValue: 50,
        ctr: 0.1,
        averageCpc: 1_234_500,
        averageCpm: 123_450_000,
        interactionRate: 0.1,
        videoViews: 0,
        searchImpressionShare: 0.8,
      },
    ]);
  });

  afterEach(() => vi.useRealTimers());

  it("refreshes a production spend-only OAuth connection with mocked provider daily metrics", async () => {
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "oauth",
      spendOnly: true,
      accessToken: "old-token",
      refreshToken: "refresh-token",
      clientId: "client-id",
      clientSecret: "client-secret",
      developerToken: "developer-token",
      customerId: "123-456-7890",
      selectedCampaignIds: JSON.stringify(["google-campaign-1"]),
    });

    expect(mocks.storage.getCampaign).toHaveBeenCalledWith("campaign-1");
    expect(mocks.refreshAccessToken).toHaveBeenCalledWith("refresh-token", "client-id", "client-secret");
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["google-campaign-1"]);
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledWith(
      "campaign-1",
      "2026-07-01",
      "2026-08-05",
      [
      expect.objectContaining({
        campaignId: "campaign-1",
        googleCampaignId: "google-campaign-1",
        googleCampaignName: "Brand Search",
        date: "2026-07-01",
        spend: "123.45",
        conversions: "2",
      }),
      ],
    );
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledWith(
      "campaign-1", "source-1", "ad_platforms", "ga4",
      [expect.objectContaining({ date: "2026-07-01", spend: "123.45", currency: "USD" })],
    );
    expect(mocks.storage.updateGoogleAdsConnection).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ accessToken: "fresh-token" })
    );
    expect(mocks.storage.updateGoogleAdsConnection).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ lastRefreshAt: expect.any(Date) })
    );
  });

  it("does not use Google Ads test mode as the spend-only production proof path", async () => {
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "test_mode",
      spendOnly: true,
      accessToken: "test-token",
    });

    expect(mocks.storage.getCampaign).not.toHaveBeenCalled();
    expect(mocks.getDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
  });
});
