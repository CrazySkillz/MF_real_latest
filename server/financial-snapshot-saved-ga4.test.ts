import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => ({
  getGA4PublicationVersion: vi.fn(),
  getCampaign: vi.fn(), getGA4Connections: vi.fn(), getGA4DailyMetrics: vi.fn(), getGA4OverviewSnapshot: vi.fn(),
  getRevenueTotalForRange: vi.fn(), getSpendTotalForRange: vi.fn(),
  getRevenueBreakdownBySource: vi.fn(), getSpendBreakdownBySource: vi.fn(),
  getSpendSources: vi.fn(), upsertFinancialDailySnapshot: vi.fn(),
}));
const provider = vi.hoisted(() => ({ getTotalsWithRevenue: vi.fn(), getAcquisitionBreakdown: vi.fn() }));
vi.mock("./storage", () => ({ storage: storageMock }));
vi.mock("./analytics", () => ({ ga4Service: provider }));

import { getCampaignMetricTotals, getCampaignMetricTotalsAtDate } from "./utils/campaign-current-values";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";
import { beginFinancialDailySnapshotRefreshObservation, recordFinancialDailySnapshotRefreshEvidence } from "./utils/financial-daily-snapshot-observation";

const campaignId = "campaign-1";
const propertyId = "542352127";
const reportingDate = "2026-10-16";
const savedOverview = () => ({
  campaignId, propertyId, windowStart: "2026-10-15", windowEnd: reportingDate,
  campaignBreakdown: { totals: { sessions: 30, conversions: 5, revenue: 100.009 }, meta: { currencyCode: "EUR" } },
});
const dailyRows = () => [
  { campaignId, propertyId, date: "2026-10-15", sessions: 10, users: 10, conversions: 2, revenue: "40.00" },
  { campaignId, propertyId, date: reportingDate, sessions: 20, users: 20, conversions: 3, revenue: "60.00" },
];
const write = () => writeFinancialDailySnapshotIfReady({ campaignId, reportingDate });
const evidence = (stage: "financial_sources" | "ga4_daily", status: "success" | "failed" = "success") => {
  recordFinancialDailySnapshotRefreshEvidence(stage, {
    campaignId, reportingDate, status, completedAt: "2026-10-17T06:05:00.000Z",
    failures: status === "failed" ? ["provider_failed"] : [],
  });
};

describe("financial snapshot reuses the verified GA4 Overview", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T08:00:00.000Z"));
    Object.values(storageMock).forEach((mock) => mock.mockReset());
    Object.values(provider).forEach((mock) => mock.mockReset());
    storageMock.getGA4PublicationVersion.mockResolvedValue(null);
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["sale_a","sale_b"]' });
    storageMock.getGA4Connections.mockResolvedValue([{ campaignId, propertyId, isPrimary: true, isActive: true, importStartDate: "2026-10-15", method: "access_token", accessToken: "test-token" }]);
    storageMock.getGA4DailyMetrics.mockResolvedValue(dailyRows());
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(savedOverview());
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 30, currency: "EUR", sourceIds: ["revenue-1"] });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, currency: "EUR", sourceIds: ["spend-1"] });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([]);
    storageMock.getSpendSources.mockResolvedValue([{ id: "spend-1", isActive: true, createdAt: "2026-10-01T00:00:00Z" }]);
    provider.getTotalsWithRevenue.mockResolvedValue({ totals: { revenue: 110, conversions: 6 } });
    for (const stage of ["financial_sources", "ga4_daily"] as const) {
      beginFinancialDailySnapshotRefreshObservation(stage);
      evidence(stage);
    }
  });
  afterEach(() => vi.useRealTimers());

  it("publishes the saved aggregate despite newer provider figures, retaining aggregate precision and external sources", async () => {
    const result = await write();
    expect(result.status).toBe("written");
    expect(result.snapshot?.inputs).toEqual({
      revenue: { value: "130.01", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
      spend: { value: "20.00", available: true, sources: ["canonical_spend_sources"] },
      conversions: { value: 5, available: true, sources: ["ga4"] },
    });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
    expect(storageMock.getRevenueTotalForRange).toHaveBeenLastCalledWith(campaignId, "1900-01-01", reportingDate, "ga4");
    expect(storageMock.getSpendTotalForRange).toHaveBeenLastCalledWith(campaignId, "1900-01-01", reportingDate, "ga4");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith(campaignId, propertyId, "2026-10-15", reportingDate);
  });

  it("advances when the next verified daily and Overview values advance together", async () => {
    expect((await write()).status).toBe("written");
    storageMock.getGA4DailyMetrics.mockResolvedValue(dailyRows().map((row, i) => i ? { ...row, conversions: 4, revenue: "70.00" } : row));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...savedOverview(), campaignBreakdown: { ...savedOverview().campaignBreakdown, totals: { sessions: 30, conversions: 6, revenue: 110 } } });
    expect((await write()).snapshot?.inputs).toMatchObject({ revenue: { value: "140.00" }, conversions: { value: 6 } });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("selects the active primary property, ignoring another property and an inactive primary", async () => {
    const [primary] = await storageMock.getGA4Connections();
    storageMock.getGA4Connections.mockResolvedValue([
      { ...primary, propertyId: "999", isActive: false },
      { ...primary, propertyId: "888", isPrimary: false }, primary,
    ]);
    expect((await write()).status).toBe("written");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith(campaignId, propertyId, "2026-10-15", reportingDate);
    expect(storageMock.getGA4OverviewSnapshot.mock.calls.every((args) => args[0] === campaignId && args[1] === propertyId)).toBe(true);
  });

  it("retains the full import window even when it is longer than the scheduler lookback", async () => {
    const startDate = "2026-07-01";
    const [primary] = await storageMock.getGA4Connections();
    storageMock.getGA4Connections.mockResolvedValue([{ ...primary, importStartDate: startDate }]);
    const count = (Date.parse(reportingDate) - Date.parse(startDate)) / 86400000 + 1;
    storageMock.getGA4DailyMetrics.mockResolvedValue([
      ...Array.from({ length: count - 2 }, (_, day) => ({
        ...dailyRows()[0], date: new Date(Date.parse(startDate) + day * 86400000).toISOString().slice(0, 10),
        sessions: 0, users: 0, conversions: 0, revenue: "0", updatedAt: "2026-08-01T08:00:00Z",
      })), ...dailyRows(),
    ]);
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...savedOverview(), windowStart: startDate });
    expect((await write()).status).toBe("written");
    expect(storageMock.getGA4DailyMetrics).toHaveBeenCalledWith(campaignId, propertyId, startDate, reportingDate);
  });

  it("supports verified zero GA4 revenue/conversions with external revenue and no Spend source", async () => {
    storageMock.getGA4DailyMetrics.mockResolvedValue(dailyRows().map((row) => ({ ...row, revenue: "0", conversions: 0 })));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...savedOverview(), campaignBreakdown: { ...savedOverview().campaignBreakdown, totals: { sessions: 30, conversions: 0, revenue: 0 } } });
    storageMock.getSpendSources.mockResolvedValue([]);
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 0, sourceIds: [] });
    const result = await write();
    expect(result.status).toBe("written");
    expect(result.snapshot?.inputs).toMatchObject({ revenue: { available: true, value: "30.00" }, conversions: { available: true, value: 0 }, spend: { available: false, value: null } });
  });

  it.each([
    ["missing", undefined],
    ["other campaign", { ...savedOverview(), campaignId: "other" }],
    ["other property", { ...savedOverview(), propertyId: "999" }],
    ["other start", { ...savedOverview(), windowStart: "2026-10-14" }],
    ["older end", { ...savedOverview(), windowEnd: "2026-10-15" }],
    ["future end", { ...savedOverview(), windowEnd: "2026-10-17" }],
    ["other currency", { ...savedOverview(), campaignBreakdown: { ...savedOverview().campaignBreakdown, meta: { currencyCode: "USD" } } }],
    ["missing currency", { ...savedOverview(), campaignBreakdown: { totals: savedOverview().campaignBreakdown.totals } }],
    ...["sessions", "conversions", "revenue"].flatMap((field) => [null, "", NaN, Infinity, -1].map((value) => [
      `invalid ${field}: ${value}`, { ...savedOverview(), campaignBreakdown: { ...savedOverview().campaignBreakdown, totals: { ...savedOverview().campaignBreakdown.totals, [field]: value } } },
    ])),
  ])("retains the last saved financial snapshot for an invalid Overview: %s", async (_label, snapshot) => {
    expect((await write()).status).toBe("written");
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(snapshot);
    expect((await write()).status).toBe("blocked");
    expect(storageMock.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each([
    ["missing rows", []],
    ["missing day", dailyRows().slice(1)],
    ["duplicate day", [dailyRows()[0], dailyRows()[0]]],
    ["other campaign", dailyRows().map((row) => ({ ...row, campaignId: "other" }))],
    ["other property", dailyRows().map((row) => ({ ...row, propertyId: "999" }))],
    ["out of window", dailyRows().map((row) => ({ ...row, date: "2026-10-17" }))],
    ["different sessions", dailyRows().map((row) => ({ ...row, sessions: row.sessions + 1 }))],
    ["different conversions", dailyRows().map((row) => ({ ...row, conversions: row.conversions + 1 }))],
    ["different revenue", dailyRows().map((row) => ({ ...row, revenue: "100" }))],
    ["invalid conversions", dailyRows().map((row) => ({ ...row, conversions: NaN }))],
  ])("blocks inconsistent daily data without a provider fallback: %s", async (_label, rows) => {
    storageMock.getGA4DailyMetrics.mockResolvedValue(rows);
    expect((await write()).status).toBe("blocked");
    expect(storageMock.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["financial_sources", "ga4_daily"] as const)("still retains the previous financial snapshot when %s fails", async (stage) => {
    expect((await write()).status).toBe("written");
    evidence(stage, "failed");
    expect((await write()).status).toBe("blocked");
    expect(storageMock.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
  });

  it.each(["getGA4OverviewSnapshot", "getRevenueTotalForRange", "getSpendTotalForRange"] as const)("does not replace saved financials if %s fails", async (method) => {
    expect((await write()).status).toBe("written");
    storageMock[method].mockRejectedValue(new Error("read failed"));
    await expect(write()).rejects.toThrow("read failed");
    expect(storageMock.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["revenue", "conversions"] as const)("blocks if saved Overview %s advances between the totals read and publication check", async (field) => {
    const newer = { ...savedOverview(), campaignBreakdown: { ...savedOverview().campaignBreakdown,
      totals: { ...savedOverview().campaignBreakdown.totals, [field]: savedOverview().campaignBreakdown.totals[field] + 1 },
    } };
    storageMock.getGA4OverviewSnapshot.mockResolvedValueOnce(savedOverview()).mockResolvedValue(newer);
    expect(await write()).toEqual({ status: "blocked", reasons: [field === "revenue" ? "ga4_revenue_total_mismatch" : "ga4_conversion_total_mismatch"] });
    expect(storageMock.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("still rejects a different Spend currency", async () => {
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, currency: "USD", sourceIds: ["spend-1"] });
    expect(await write()).toEqual({ status: "blocked", reasons: ["spend_currency_mismatch"] });
    expect(storageMock.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("keeps the provider selection for existing callers outside financial snapshot creation", async () => {
    expect(await getCampaignMetricTotals(campaignId, true)).toMatchObject({ ga4Revenue: 110, financialConversions: 6, ga4FinancialSource: "provider_to_date" });
    expect(await getCampaignMetricTotalsAtDate(campaignId, reportingDate)).toMatchObject({ ga4Revenue: 110, financialConversions: 6, ga4FinancialSource: "provider_to_date" });
    expect(provider.getTotalsWithRevenue).toHaveBeenCalledTimes(2);
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it("preserves the unfiltered legacy path and its mismatch guard", async () => {
    storageMock.getCampaign.mockResolvedValue({ ...(await storageMock.getCampaign()), ga4CampaignFilter: "" });
    expect(await write()).toEqual({ status: "blocked", reasons: ["ga4_conversion_total_mismatch"] });
    expect(provider.getTotalsWithRevenue).toHaveBeenCalledTimes(1);
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });
});
