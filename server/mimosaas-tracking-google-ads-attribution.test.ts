import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveMimosaasTrackingGclidEvent } from "./mimosaas-tracking-google-ads-attribution";

const context = {
  eventId: "event-1",
  websiteConnectionId: "website-1",
  gclid: "real-click-id",
  eventTime: new Date("2026-10-14T23:30:00.000Z"),
  candidateCampaignIds: ["campaign-1"],
};

const connection = {
  campaignId: "campaign-1",
  method: "oauth",
  spendOnly: false,
  selectedCampaignIds: '["101"]',
  accessToken: "access-token",
  refreshToken: "refresh-token",
  clientId: "client-id",
  clientSecret: "client-secret",
  developerToken: "developer-token",
  customerId: "123456",
  managerAccountId: null,
  expiresAt: new Date("2026-10-16T00:00:00.000Z"),
};

describe("Mimosaas Tracking Google Ads attribution", () => {
  const store = {
    getMimosaasTrackingGclidAttributionContext: vi.fn(),
    getGoogleAdsConnection: vi.fn(),
    updateGoogleAdsConnection: vi.fn(),
    deferMimosaasTrackingGclidAttribution: vi.fn(),
    resolveMimosaasTrackingGclidAttribution: vi.fn(),
  };
  const client = {
    getCustomerAccount: vi.fn(),
    getClickCampaign: vi.fn(),
  };
  const dependencies = {
    now: () => new Date("2026-10-15T10:00:00.000Z"),
    refreshAccessToken: vi.fn(),
    createClient: vi.fn(() => client),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    store.getMimosaasTrackingGclidAttributionContext.mockResolvedValue(context);
    store.getGoogleAdsConnection.mockResolvedValue(connection);
    store.updateGoogleAdsConnection.mockResolvedValue(connection);
    store.deferMimosaasTrackingGclidAttribution.mockResolvedValue({ status: "pending", campaignId: null });
    store.resolveMimosaasTrackingGclidAttribution.mockResolvedValue({ status: "attributed", campaignId: "campaign-1" });
    client.getCustomerAccount.mockResolvedValue({ manager: false, timeZone: "Europe/Amsterdam" });
    client.getClickCampaign.mockResolvedValue({ campaignId: "101" });
  });

  it("uses the Google Ads account date and selected campaign scope before persisting evidence", async () => {
    await expect(resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any))
      .resolves.toMatchObject({ status: "attributed" });

    expect(client.getClickCampaign).toHaveBeenCalledWith("real-click-id", "2026-10-15", ["101"]);
    expect(store.resolveMimosaasTrackingGclidAttribution).toHaveBeenCalledWith(
      "website-1", "event-1", "real-click-id", [{ campaignId: "campaign-1", externalCampaignId: "101" }],
    );
  });

  it("refreshes an expired token before lookup and persists the replacement securely through storage", async () => {
    store.getGoogleAdsConnection.mockResolvedValue({ ...connection, accessToken: "expired", expiresAt: new Date("2026-10-15T09:00:00.000Z") });
    dependencies.refreshAccessToken.mockResolvedValue({ access_token: "fresh", expires_in: 3600 });

    await resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any);

    expect(dependencies.refreshAccessToken).toHaveBeenCalledWith("refresh-token", "client-id", "client-secret");
    expect(store.updateGoogleAdsConnection).toHaveBeenCalledWith("campaign-1", {
      accessToken: "fresh", expiresAt: new Date("2026-10-15T11:00:00.000Z"),
    });
    expect(dependencies.createClient).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "fresh" }));
  });

  it("leaves the event pending when Google Ads has not exposed the click", async () => {
    client.getClickCampaign.mockResolvedValue(null);

    await expect(resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any))
      .resolves.toMatchObject({ status: "pending", attribution: { campaignId: null } });
    expect(store.deferMimosaasTrackingGclidAttribution).toHaveBeenCalledWith("website-1", "event-1", "real-click-id");
    expect(store.resolveMimosaasTrackingGclidAttribution).not.toHaveBeenCalled();
  });

  it("never treats a test-mode Google Ads connection as genuine click proof", async () => {
    store.getGoogleAdsConnection.mockResolvedValue({ ...connection, method: "test_mode" });

    await expect(resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any))
      .resolves.toMatchObject({ status: "pending" });
    expect(dependencies.createClient).not.toHaveBeenCalled();
    expect(store.resolveMimosaasTrackingGclidAttribution).not.toHaveBeenCalled();
    expect(store.deferMimosaasTrackingGclidAttribution).toHaveBeenCalled();
  });

  it("fails the whole event without persisting a partial match when another scoped account fails", async () => {
    store.getMimosaasTrackingGclidAttributionContext.mockResolvedValue({ ...context, candidateCampaignIds: ["campaign-1", "campaign-2"] });
    store.getGoogleAdsConnection
      .mockResolvedValueOnce(connection)
      .mockResolvedValueOnce({ ...connection, campaignId: "campaign-2", customerId: "654321" });
    const secondClient = { getCustomerAccount: vi.fn().mockRejectedValue(new Error("provider unavailable")), getClickCampaign: vi.fn() };
    dependencies.createClient
      .mockReturnValueOnce(client)
      .mockReturnValueOnce(secondClient as any);

    await expect(resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any))
      .rejects.toThrow("provider unavailable");
    expect(store.resolveMimosaasTrackingGclidAttribution).not.toHaveBeenCalled();
  });

  it("passes every proven match to storage so overlapping campaign scopes become a conflict", async () => {
    store.getMimosaasTrackingGclidAttributionContext.mockResolvedValue({ ...context, candidateCampaignIds: ["campaign-1", "campaign-2"] });
    store.getGoogleAdsConnection
      .mockResolvedValueOnce(connection)
      .mockResolvedValueOnce({ ...connection, campaignId: "campaign-2", selectedCampaignIds: '["202"]' });
    const secondClient = {
      getCustomerAccount: vi.fn().mockResolvedValue({ manager: false, timeZone: "UTC" }),
      getClickCampaign: vi.fn().mockResolvedValue({ campaignId: "202" }),
    };
    dependencies.createClient.mockReturnValueOnce(client).mockReturnValueOnce(secondClient as any);
    store.resolveMimosaasTrackingGclidAttribution.mockResolvedValue({ status: "conflict", campaignId: null });

    await expect(resolveMimosaasTrackingGclidEvent("website-1", "event-1", store as any, dependencies as any))
      .resolves.toMatchObject({ status: "conflict" });
    expect(store.resolveMimosaasTrackingGclidAttribution).toHaveBeenCalledWith("website-1", "event-1", "real-click-id", [
      { campaignId: "campaign-1", externalCampaignId: "101" },
      { campaignId: "campaign-2", externalCampaignId: "202" },
    ]);
  });
});
