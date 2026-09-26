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
  updateGA4ConnectionTokens: vi.fn(),
}));

const ga4ServiceMock = vi.hoisted(() => ({
  getTotalsWithRevenue: vi.fn(),
  getAcquisitionBreakdown: vi.fn(),
  refreshAccessToken: vi.fn(),
}));

vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: ga4ServiceMock }));

import {
  getCampaignMetricTotals,
  getCampaignMetricTotalsAtDate,
  refreshCampaignCurrentValuesForCampaign,
} from "./utils/campaign-current-values";

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

  it("keeps native revenue and conversions on the import window while retaining source-to-date imports", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 500, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 1000, conversions: 40 } });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, sourceIds: ["revenue-1"] });

    await refreshCampaignCurrentValuesForCampaign("campaign-1");

    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-07-01", "2026-08-20");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(2);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(storageMock.getSpendBreakdownBySource).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-20", "ga4");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-07-01", "2026-08-20", [], "USD");
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

  it("uses the requested completed reporting date for every historical input", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-21T12:00:00.000Z"));
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 500, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 1000, conversions: 40 } });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 300, currency: "USD", sourceIds: ["revenue-1"] });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-08-12");

    expect(totals).toMatchObject({ revenue: 1300, ga4Revenue: 1000, financialConversions: 40 });
    expect(storageMock.getGA4Connections).toHaveBeenCalledWith("campaign-1", { migrateLegacyTokens: false });
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith("campaign-1", "properties/123", "2026-07-01", "2026-08-12");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledTimes(2);
    expect(storageMock.getRevenueTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-12", "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenCalledWith("campaign-1", "1900-01-01", "2026-08-12", "ga4");
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-07-01", "2026-08-12", [], "USD");
    expect(ga4ServiceMock.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(await getCampaignMetricTotalsAtDate("campaign-1", "2026-06-30"))
      .toMatchObject({ revenue: 300, ga4Revenue: 0, financialConversions: 0, ga4Available: false, ga4FinancialSource: "pre_campaign_zero" });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
    expect(await getCampaignMetricTotalsAtDate("campaign-1", "2026-02-30")).toBeNull();
  });

  it("ignores the unused campaign start field and uses the GA4 import window", async () => {
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      startDate: "2026-09-08T00:00:00.000Z",
      createdAt: "2026-09-08T10:06:04.469Z",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 5572.8, conversions: 25 }]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 60902, sourceIds: ["revenue-1"] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 300, sourceIds: ["spend-1"] });
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 5572.8, conversions: 25 } });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-09-05");

    expect(totals).toMatchObject({
      revenue: 66474.8,
      ga4Revenue: 5572.8,
      spend: 300,
      financialConversions: 25,
      revenueAvailable: true,
      spendAvailable: true,
      ga4RevenueAvailable: true,
      financialConversionsAvailable: true,
      ga4FinancialSource: "provider_to_date",
    });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-07-01", "2026-09-05", [], "USD");
  });

  it("uses the saved GA4 import start before createdAt when no campaign start is configured", async () => {
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      createdAt: "2026-09-08T10:06:04.469Z",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 5572.8, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 5572.8, conversions: 25 } });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-09-05");

    expect(totals).toMatchObject({ ga4Revenue: 5572.8, financialConversions: 25, ga4FinancialSource: "provider_to_date" });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-07-01", "2026-09-05", [], "USD");
  });

  it("uses an explicit import boundary for an exact historical financial query", async () => {
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      createdAt: "2026-09-08T10:06:04.469Z",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getGA4DailyMetrics.mockResolvedValue([{ revenue: 5572.8, conversions: 25 }]);
    ga4ServiceMock.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 5572.8, conversions: 25 } });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-09-05", "2026-08-09");

    expect(totals).toMatchObject({ ga4Revenue: 5572.8, financialConversions: 25, ga4FinancialSource: "provider_to_date" });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledWith("properties/123", "token", "2026-08-09", "2026-09-05", [], "USD");
  });

  it("refreshes once after a confirmed auth failure and retries the exact financial query", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-09-17T12:00:00.000Z"));
    storageMock.getGA4Connections.mockResolvedValue([{
      id: "connection-1", propertyId: "properties/123", method: "access_token", accessToken: "expired-token",
      refreshToken: "refresh-token", clientId: "client-id", clientSecret: "client-secret", isPrimary: true, importStartDate: "2026-07-01",
    }]);
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue
      .mockRejectedValueOnce(new Error('GA4 API Error: {"error":{"code":401,"status":"UNAUTHENTICATED"}}'))
      .mockResolvedValueOnce({ totals: { revenue: 5572.8, conversions: 25 } });
    ga4ServiceMock.refreshAccessToken.mockResolvedValue({ access_token: "fresh-token", expires_in: 3600 });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-09-05", "2026-08-09");

    expect(totals).toMatchObject({ ga4Revenue: 5572.8, financialConversions: 25, ga4FinancialSource: "provider_to_date" });
    expect(ga4ServiceMock.refreshAccessToken).toHaveBeenCalledWith("refresh-token", "client-id", "client-secret");
    expect(storageMock.updateGA4ConnectionTokens).toHaveBeenCalledWith("connection-1", {
      accessToken: "fresh-token", refreshToken: "refresh-token", expiresAt: new Date("2026-09-17T13:00:00.000Z"),
    });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenNthCalledWith(2, "properties/123", "fresh-token", "2026-08-09", "2026-09-05", [], "USD");
  });

  it("does not refresh the financial query after a non-auth provider failure", async () => {
    storageMock.getGA4Connections.mockResolvedValue([{
      id: "connection-1", propertyId: "properties/123", method: "access_token", accessToken: "token",
      refreshToken: "refresh-token", clientId: "client-id", clientSecret: "client-secret", isPrimary: true, importStartDate: "2026-07-01",
    }]);
    storageMock.getGA4DailyMetrics.mockResolvedValue([]);
    ga4ServiceMock.getTotalsWithRevenue.mockRejectedValue(new Error('GA4 API Error: {"error":{"code":403,"status":"PERMISSION_DENIED"}}'));

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-09-05", "2026-08-09");

    expect(totals).toMatchObject({ ga4RevenueAvailable: false, financialConversionsAvailable: false });
    expect(ga4ServiceMock.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
    expect(ga4ServiceMock.refreshAccessToken).not.toHaveBeenCalled();
    expect(storageMock.updateGA4ConnectionTokens).not.toHaveBeenCalled();
  });

  it("retains exact financials before the GA4 traffic import boundary", async () => {
    storageMock.getCampaign.mockResolvedValue({
      id: "campaign-1",
      createdAt: "2026-09-08T10:06:04.469Z",
      currency: "USD",
      reportingTimeZone: "Europe/Amsterdam",
    });
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 57400, sourceIds: ["revenue-1"] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 300, sourceIds: ["spend-1"] });

    const totals = await getCampaignMetricTotalsAtDate("campaign-1", "2026-06-21");

    expect(totals).toMatchObject({
      revenue: 57400,
      ga4Revenue: 0,
      spend: 300,
      financialConversions: 0,
      ga4Available: false,
      ga4RevenueAvailable: true,
      financialConversionsAvailable: true,
      ga4FinancialSource: "pre_campaign_zero",
    });
    expect(storageMock.getGA4DailyMetrics).not.toHaveBeenCalled();
    expect(ga4ServiceMock.getTotalsWithRevenue).not.toHaveBeenCalled();
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
