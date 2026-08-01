import { beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getCampaign: vi.fn(),
  getGA4Connections: vi.fn(),
  getGA4DailyMetrics: vi.fn(),
  getRevenueTotalForRange: vi.fn(),
  getSpendTotalForRange: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(),
  getSpendBreakdownBySource: vi.fn(),
  getCampaignKPIs: vi.fn(),
  getCampaignBenchmarks: vi.fn(),
  updateKPI: vi.fn(),
  updateBenchmark: vi.fn(),
}));

const ga4ServiceMock = vi.hoisted(() => ({
  getTotalsWithRevenue: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));

import { getCampaignMetricTotals, refreshCampaignCurrentValuesForCampaign } from "./utils/campaign-current-values";

describe("campaign current-value financial source contract", () => {
  beforeEach(() => {
    for (const value of Object.values(storageMock)) value.mockReset();
    for (const value of Object.values(ga4ServiceMock)) value.mockReset();
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", startDate: "2026-07-01T00:00:00.000Z" });
    storageMock.getGA4Connections.mockResolvedValue([{
      id: "connection-1",
      propertyId: "properties/123",
      method: "access_token",
      accessToken: "token",
      isPrimary: true,
      lookbackDays: 30,
    }]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0 });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 100 });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    storageMock.getCampaignKPIs.mockResolvedValue([{
      id: "campaign-revenue",
      campaignId: "campaign-1",
      platformType: "campaign",
      currentValue: "777",
      calculationConfig: JSON.stringify({ metric: "revenue", inputs: { revenue: ["total_revenue"] } }),
    }]);
    storageMock.getCampaignBenchmarks.mockResolvedValue([]);
  });

  it("preserves last-good campaign values when every native candidate is unavailable", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error("provider unavailable"));
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("breakdown unavailable"));

    const totals = await getCampaignMetricTotals("campaign-1", true);
    expect(totals).toMatchObject({ ga4RevenueAvailable: false, financialConversionsAvailable: false });
    await refreshCampaignCurrentValuesForCampaign("campaign-1");
    expect(storageMock.updateKPI).not.toHaveBeenCalled();
  });

  it("keeps provider zero authoritative over higher persisted totals and does not query breakdown", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 500, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 0, conversions: 0 } });

    const totals = await getCampaignMetricTotals("campaign-1", true);
    expect(totals).toMatchObject({ ga4Revenue: 0, financialConversions: 0, ga4RevenueAvailable: true });
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });
});
