import { describe, expect, it, vi } from "vitest";
import {
  deriveFinancialDailyComparisonSnapshot,
  resolveFinancialDailyComparisonPrevious,
} from "./utils/financial-daily-comparison";

const campaignId = "campaign-1";
const reportingDate = "2026-09-12";

const dependencies = (overrides: Record<string, unknown> = {}) => ({
  getCampaign: vi.fn().mockResolvedValue({
    id: campaignId,
    currency: "USD",
    reportingTimeZone: "Europe/Amsterdam",
  }),
  getGA4Connections: vi.fn().mockResolvedValue([{
    campaignId,
    propertyId: "properties/123",
    isActive: true,
    isPrimary: true,
    importStartDate: "2026-08-09",
  }]),
  getCampaignMetricTotalsAtDate: vi.fn().mockResolvedValue({
    revenue: 150,
    ga4Revenue: 100,
    spend: 25,
    conversions: 8,
    financialConversions: 5,
    users: 80,
    sessions: 90,
    engagementRate: 75,
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
    totalRevenue: 50,
    currency: "USD",
    sourceIds: ["revenue-1"],
  }),
  getSpendTotalForRange: vi.fn().mockResolvedValue({
    totalSpend: 25,
    currency: "USD",
    sourceIds: ["spend-1"],
  }),
  now: () => new Date("2026-09-20T12:00:00.000Z"),
  ...overrides,
}) as any;

describe("read-only financial daily comparison derivation", () => {
  it("derives the exact cumulative snapshot with financial conversion semantics", async () => {
    const deps = dependencies();

    const result = await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate }, deps);

    expect(deps.getCampaignMetricTotalsAtDate).toHaveBeenCalledWith(campaignId, reportingDate);
    expect(deps.getGA4Connections).toHaveBeenCalledWith(campaignId, { migrateLegacyTokens: false });
    expect(deps.getRevenueTotalForRange).toHaveBeenCalledWith(campaignId, "1900-01-01", reportingDate, "ga4");
    expect(deps.getSpendTotalForRange).toHaveBeenCalledWith(campaignId, "1900-01-01", reportingDate, "ga4");
    expect(result).toMatchObject({
      campaignId,
      snapshotType: "financial_daily",
      reportingDate,
      totalConversions: 5,
      totalSpend: "25.00",
      metrics: {
        financialDaily: {
          version: "financial_daily_snapshot_v1",
          campaignId,
          reportingDate,
          currency: "USD",
          currentValueWindow: {
            startDate: "2026-08-09",
            endDate: reportingDate,
            dataThroughDate: reportingDate,
            reportingTimeZone: "Europe/Amsterdam",
          },
          inputs: {
            spend: { value: "25.00", available: true, sources: ["canonical_spend_sources"] },
            revenue: { value: "150.00", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
            conversions: { value: 5, available: true, sources: ["ga4"] },
          },
        },
      },
    });
  });

  it("prefers an exact stored snapshot without querying live sources", async () => {
    const deps = dependencies();
    const stored = { id: "stored-1" } as any;

    expect(await resolveFinancialDailyComparisonPrevious({ campaignId, reportingDate, storedPrevious: stored }, deps))
      .toBe(stored);
    expect(deps.getCampaign).not.toHaveBeenCalled();
    expect(deps.getCampaignMetricTotalsAtDate).not.toHaveBeenCalled();
  });

  it("preserves source totals with authoritative native zero before campaign start", async () => {
    const deps = dependencies({
      getCampaignMetricTotalsAtDate: vi.fn().mockResolvedValue({
        ...(await dependencies().getCampaignMetricTotalsAtDate()),
        revenue: 60902,
        ga4Revenue: 0,
        spend: 300,
        financialConversions: 0,
        ga4FinancialSource: "pre_campaign_zero",
      }),
      getRevenueTotalForRange: vi.fn().mockResolvedValue({
        totalRevenue: 60902,
        currency: "USD",
        sourceIds: ["revenue-1"],
      }),
      getSpendTotalForRange: vi.fn().mockResolvedValue({
        totalSpend: 300,
        currency: "USD",
        sourceIds: ["spend-1"],
      }),
    });

    const result = await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate: "2026-09-05" }, deps);

    expect((result?.metrics as any)?.financialDaily?.inputs).toMatchObject({
      revenue: { value: "60902.00", available: true },
      spend: { value: "300.00", available: true },
      conversions: { value: 0, available: true },
    });
  });

  it("fails closed outside the import window and on source/currency inconsistencies", async () => {
    const beforeImport = dependencies();
    expect(await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate: "2026-08-08" }, beforeImport)).toBeNull();
    expect(beforeImport.getCampaignMetricTotalsAtDate).not.toHaveBeenCalled();

    const currencyMismatch = dependencies({
      getRevenueTotalForRange: vi.fn().mockResolvedValue({ totalRevenue: 50, currency: "EUR", sourceIds: ["revenue-1"] }),
    });
    expect(await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate }, currencyMismatch)).toBeNull();

    const spendMismatch = dependencies({
      getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 24, currency: "USD", sourceIds: ["spend-1"] }),
    });
    expect(await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate }, spendMismatch)).toBeNull();
  });

  it("rejects rolling financial candidates and converts dependency failures to unavailable", async () => {
    const rolling = dependencies({
      getCampaignMetricTotalsAtDate: vi.fn().mockResolvedValue({
        ...(await dependencies().getCampaignMetricTotalsAtDate()),
        ga4FinancialSource: "rolling_breakdown",
      }),
    });
    expect(await deriveFinancialDailyComparisonSnapshot({ campaignId, reportingDate }, rolling)).toBeNull();

    const failed = dependencies({ getCampaign: vi.fn().mockRejectedValue(new Error("database unavailable")) });
    expect(await resolveFinancialDailyComparisonPrevious({ campaignId, reportingDate }, failed)).toBeNull();
  });
});
