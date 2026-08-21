import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
    storageMock.getCampaign.mockResolvedValue({ id: "campaign-1", startDate: "2026-05-20T00:00:00.000Z", currency: "USD", reportingTimeZone: "Europe/Amsterdam" });
    storageMock.getGA4Connections.mockResolvedValue([{
      id: "connection-1",
      propertyId: "properties/123",
      method: "access_token",
      accessToken: "token",
      isPrimary: true,
      lookbackDays: 30,
      importStartDate: "2026-07-01",
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

  afterEach(() => vi.useRealTimers());

  it("keeps native revenue and conversions campaign-to-date while retaining source-to-date imports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 500, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 1000, conversions: 40 } });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, sourceIds: ["revenue-1"] });

    await refreshCampaignCurrentValuesForCampaign("campaign-1");

    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-07-01", "2026-08-20");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-05-20", "2026-08-20");
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(storageMock.getSpendBreakdownBySource).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-05-20", "2026-08-20", [], "USD");
    expect(storageMock.updateKPI).toHaveBeenCalledWith("campaign-revenue", { currentValue: "1300" });
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

  it("uses persisted fallback only when it will not be combined with an imported source", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 500, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error("provider unavailable"));
    ga4ServiceMock.getAcquisitionBreakdown.mockRejectedValue(new Error("breakdown unavailable"));

    const nativeOnly = await getCampaignMetricTotals("campaign-1", true);
    expect(nativeOnly).toMatchObject({ ga4Revenue: 500, ga4RevenueAvailable: true });

    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: ["shopify-zero"] });
    const combined = await getCampaignMetricTotals("campaign-1", true);
    expect(combined).toMatchObject({ ga4RevenueAvailable: false, revenueAvailable: false });
  });
});
