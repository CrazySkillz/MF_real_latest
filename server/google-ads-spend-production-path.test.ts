import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const getDailyMetrics = vi.fn();
  const refreshAccessToken = vi.fn();

  class MockGoogleAdsClient {
    static refreshAccessToken = refreshAccessToken;
    static microsToAmount(micros: number) {
      return micros / 1_000_000;
    }

    getDailyMetrics = getDailyMetrics;
  }

  return {
    getDailyMetrics,
    refreshAccessToken,
    MockGoogleAdsClient,
    storage: {
      getGoogleAdsConnection: vi.fn(),
      getCampaign: vi.fn(),
      updateGoogleAdsConnection: vi.fn(),
      upsertGoogleAdsDailyMetrics: vi.fn(),
      getGoogleAdsDailyMetrics: vi.fn(),
      updateGoogleAdsDailyMetricsGA4Revenue: vi.fn(),
    },
    db: {
      select: vi.fn(() => ({ from: vi.fn(async () => []) })),
    },
  };
});

vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./googleAdsClient", () => ({ GoogleAdsClient: mocks.MockGoogleAdsClient }));

import { refreshGoogleAdsForCampaign } from "./google-ads-scheduler";

describe("Google Ads GA4 Overview spend production path", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.storage.getCampaign.mockResolvedValue({ id: "campaign-1" });
    mocks.storage.updateGoogleAdsConnection.mockResolvedValue({ id: "conn-1" });
    mocks.storage.upsertGoogleAdsDailyMetrics.mockResolvedValue({ upserted: 1 });
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
    expect(mocks.storage.upsertGoogleAdsDailyMetrics).toHaveBeenCalledWith([
      expect.objectContaining({
        campaignId: "campaign-1",
        googleCampaignId: "google-campaign-1",
        googleCampaignName: "Brand Search",
        date: "2026-07-01",
        spend: "123.45",
        conversions: "2",
      }),
    ]);
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
    expect(mocks.storage.upsertGoogleAdsDailyMetrics).not.toHaveBeenCalled();
  });
});