import { beforeEach, describe, expect, it, vi } from "vitest";

const { storageMock } = vi.hoisted(() => ({
  storageMock: {
    getCampaign: vi.fn(),
    getRevenueTotalForRange: vi.fn(),
    getRevenueSources: vi.fn(),
    getLinkedInConnection: vi.fn(),
    updateLinkedInConnection: vi.fn(),
    getConversionEvents: vi.fn(),
    getShopifyConnection: vi.fn(),
  },
}));

vi.mock("./storage", () => ({ storage: storageMock }));

import { resolveLinkedInRevenueContext } from "./utils/linkedin-revenue";

describe("LinkedIn revenue isolation", () => {
  const campaignId = "linkedin-campaign";

  beforeEach(() => {
    vi.clearAllMocks();
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, createdAt: "2026-01-01" });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0 });
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getLinkedInConnection.mockResolvedValue({ conversionValue: null });
    storageMock.updateLinkedInConnection.mockResolvedValue(undefined);
    storageMock.getConversionEvents.mockResolvedValue([]);
    storageMock.getShopifyConnection.mockResolvedValue(null);
  });

  it("keeps LinkedIn revenue unavailable when no LinkedIn-scoped revenue source exists", async () => {
    const context = await resolveLinkedInRevenueContext({ campaignId, conversionsTotal: 10 });

    expect(context.hasRevenueTracking).toBe(false);
    expect(context.totalRevenue).toBe(0);
    expect(context.conversionValue).toBe(0);
    expect(context.conversionValueSource).toBe("none");
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith(campaignId, "1900-01-01", expect.any(String), "linkedin");
  });

  it("does not let GA4 revenue unlock LinkedIn revenue metrics", async () => {
    storageMock.getRevenueTotalForRange.mockImplementation(async (_campaignId, _start, _end, platformContext) => ({
      totalRevenue: platformContext === "ga4" ? 5000 : 0,
    }));

    const context = await resolveLinkedInRevenueContext({ campaignId, conversionsTotal: 10 });

    expect(context.hasRevenueTracking).toBe(false);
    expect(context.totalRevenue).toBe(0);
    expect(storageMock.getRevenueTotalForRange.mock.calls.some((call: any[]) => call[3] === "ga4")).toBe(false);
  });

  it("enables LinkedIn revenue when a LinkedIn-scoped revenue source has imported revenue", async () => {
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 2000 });
    storageMock.getRevenueSources.mockResolvedValue([
      { id: "linkedin-revenue-source", isActive: true, platformContext: "linkedin", mappingConfig: JSON.stringify({ mode: "revenue_to_date" }) },
    ]);

    const context = await resolveLinkedInRevenueContext({ campaignId, conversionsTotal: 10 });

    expect(context.hasRevenueTracking).toBe(true);
    expect(context.totalRevenue).toBe(2000);
    expect(context.importedRevenueToDate).toBe(2000);
    expect(context.conversionValue).toBe(200);
    expect(context.conversionValueSource).toBe("derived");
  });

  it("clears stale LinkedIn conversion values after the final LinkedIn revenue source is removed", async () => {
    storageMock.getLinkedInConnection.mockResolvedValue({ conversionValue: "75" });

    const context = await resolveLinkedInRevenueContext({ campaignId, conversionsTotal: 10 });

    expect(context.hasRevenueTracking).toBe(false);
    expect(context.totalRevenue).toBe(0);
    expect(context.conversionValue).toBe(0);
    expect(storageMock.updateLinkedInConnection).toHaveBeenCalledWith(campaignId, { conversionValue: null });
  });
});
