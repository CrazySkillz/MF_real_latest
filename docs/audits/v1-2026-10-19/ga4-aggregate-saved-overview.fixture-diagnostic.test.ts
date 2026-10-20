// Audit-only copy; production module and original test unchanged. Publication version is a fixture.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMock = vi.hoisted(() => Object.fromEntries([
  "getGA4PublicationVersion", "getCampaign", "getPrimaryGA4Connection", "getGA4Connections", "getGA4Connection", "getGA4DailyMetrics",
  "getGA4OverviewSnapshot", "getLinkedInConnection", "getLatestCustomIntegrationMetrics", "getMetaConnection",
  "getGoogleAdsConnection", "getInstagramConnection", "getTikTokConnection", "getGoogleSheetsConnections",
  "getRevenueSources", "getRevenueTotalForRange", "getSpendTotalForRange", "getRevenueBreakdownBySource",
  "getSpendBreakdownBySource", "createMetricSnapshot",
].map((name) => [name, vi.fn()])));
const provider = vi.hoisted(() => ({ getTotalsWithRevenue: vi.fn(), getAcquisitionBreakdown: vi.fn() }));
const dbMock = vi.hoisted(() => ({ execute: vi.fn() }));
vi.mock("../../../server/storage", () => ({ storage: storageMock }));
vi.mock("../../../server/analytics", () => ({ ga4Service: provider }));
vi.mock("../../../server/db", () => ({ db: dbMock }));

import { aggregateCampaignMetrics, recordCampaignMetrics } from "../../../server/scheduler";

const campaignId = "campaign-1";
const propertyId = "542352127";
const date = "2026-10-16";
const dailyRows = () => [
  { campaignId, propertyId, date: "2026-10-15", sessions: 10, users: 10, pageviews: 20, engagedSessions: 5, engagementRate: 0.5, conversions: 2, revenue: "40.00" },
  { campaignId, propertyId, date, sessions: 20, users: 20, pageviews: 40, engagedSessions: 10, engagementRate: 0.5, conversions: 3, revenue: "60.00" },
];
const overview = () => ({ campaignId, propertyId, windowStart: "2026-10-15", windowEnd: date,
  campaignBreakdown: { totals: { sessions: 30, conversions: 5, revenue: 100.009 }, meta: { currencyCode: "EUR" } },
});
const record = () => recordCampaignMetrics(campaignId, { allowScheduledGA4: true });

describe("ordered GA4 campaign snapshot saved financial inputs", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T08:00:00Z"));
    Object.values(storageMock).forEach((mock) => mock.mockReset());
    Object.values(provider).forEach((mock) => mock.mockReset());
    dbMock.execute.mockReset().mockResolvedValue({ rows: [] });
    for (const method of ["log", "warn", "error"] as const) vi.spyOn(console, method).mockImplementation(() => {});
    storageMock.getGA4PublicationVersion.mockResolvedValue(0);
    storageMock.getCampaign.mockResolvedValue({ id: campaignId, ownerId: "owner-1", status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["sale_a","sale_b"]' });
    const connection = { campaignId, propertyId, isActive: true, isPrimary: true, importStartDate: "2026-10-15", method: "access_token", accessToken: "test-token" };
    storageMock.getPrimaryGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    storageMock.getGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => dailyRows().filter((row) => row.date >= start && row.date <= end));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(overview());
    storageMock.getRevenueTotalForRange.mockImplementation(async (_id, _start, _end, context) => context === "google_ads"
      ? { totalRevenue: 0, sourceIds: [], currency: "EUR" }
      : { totalRevenue: 30, sourceIds: ["revenue-1"], currency: "EUR" });
    storageMock.getSpendTotalForRange.mockResolvedValue({ totalSpend: 20, sourceIds: ["spend-1"], currency: "EUR" });
    storageMock.getRevenueSources.mockResolvedValue([{ id: "revenue-1", sourceType: "csv", platformContext: "ga4", currency: "EUR", isActive: true }]);
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([{ sourceId: "revenue-1", revenue: 30 }]);
    storageMock.getSpendBreakdownBySource.mockResolvedValue([{ sourceId: "spend-1", spend: 20 }]);
    storageMock.getGoogleSheetsConnections.mockResolvedValue([]);
    storageMock.createMetricSnapshot.mockImplementation(async (snapshot) => ({ id: "snapshot-1", ...snapshot }));
    provider.getTotalsWithRevenue.mockResolvedValue({ currencyCode: "EUR", totals: { sessions: 31, users: 31, conversions: 6, revenue: 110 } });
  });
  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  it("records the same GA4 financial inputs as Overview despite a newer provider response", async () => {
    expect(await record()).toBe(true);
    const snapshot = storageMock.createMetricSnapshot.mock.calls[0][0];
    const totals = snapshot.metrics.performanceSummary.totals;
    expect(totals.revenue).toMatchObject({ value: 130.01, available: true });
    expect(totals.roas).toMatchObject({ value: 6.5, available: true });
    expect(totals.roi).toMatchObject({ value: 550.05, available: true });
    expect(totals.cpa).toMatchObject({ value: 4, available: true });
    expect(totals.sessions.value).toBe(30);
    expect(totals.conversions.value).toBe(5);
    expect(snapshot).toMatchObject({ campaignId, snapshotType: "platform_sync", totalSpend: "20.00", totalConversions: 5 });
    expect(snapshot.metrics.ga4).toMatchObject({ sessions: 30, conversions: 5, revenue: 100 });
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    expect(provider.getAcquisitionBreakdown).not.toHaveBeenCalled();
  });

  it.each([
    ["missing", undefined], ["other campaign", { ...overview(), campaignId: "other" }],
    ["other property", { ...overview(), propertyId: "999" }], ["old end", { ...overview(), windowEnd: "2026-10-15" }],
    ["wrong currency", { ...overview(), campaignBreakdown: { ...overview().campaignBreakdown, meta: { currencyCode: "USD" } } }],
    ["different conversions", { ...overview(), campaignBreakdown: { ...overview().campaignBreakdown, totals: { ...overview().campaignBreakdown.totals, conversions: 6 } } }],
  ])("preserves saved history when the Overview input is incompatible: %s", async (_label, saved) => {
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(saved);
    expect(await record()).toBe(false);
    expect(storageMock.createMetricSnapshot).not.toHaveBeenCalled();
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("keeps the default aggregate provider path for existing manual/report callers", async () => {
    const result = await aggregateCampaignMetrics(campaignId, { includeTrendAnalysis: false });
    expect(result.detailedMetrics.performanceSummary.totals.revenue.value).toBe(140);
    expect(result.detailedMetrics.performanceSummary.totals.cpa.value).toBe(3.33);
    expect(provider.getTotalsWithRevenue).toHaveBeenCalled();
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
    expect(storageMock.createMetricSnapshot).not.toHaveBeenCalled();
  });

  it("excludes today's external revenue from the completed-day campaign snapshot", async () => {
    storageMock.getRevenueBreakdownBySource.mockImplementation(async (_id, _start, end) => [
      { sourceId: "revenue-1", revenue: end > date ? 80 : 30 },
    ]);
    expect(await record()).toBe(true);
    expect(storageMock.createMetricSnapshot.mock.calls[0][0].metrics.performanceSummary.totals.revenue.value).toBe(130.01);
  });

  it.each(["getSpendTotalForRange", "getRevenueTotalForRange", "getRevenueSources", "getRevenueBreakdownBySource"])(
    "retains the previous campaign snapshot if the final %s read fails", async (method) => {
      await record();
      const previous = structuredClone(storageMock.createMetricSnapshot.mock.calls[0][0]);
      storageMock[method].mockRejectedValue(new Error("source read failed"));
      expect(await record()).toBe(false);
      expect(storageMock.createMetricSnapshot).toHaveBeenCalledTimes(1);
      expect(storageMock.createMetricSnapshot.mock.calls[0][0]).toEqual(previous);
    },
  );

  it.each(["getCampaign", "getPrimaryGA4Connection", "getGA4DailyMetrics", "getGA4OverviewSnapshot"])(
    "does not publish a snapshot when %s fails", async (method) => {
      storageMock[method].mockRejectedValue(new Error("database read failed"));
      expect(await record()).toBe(false);
      expect(storageMock.createMetricSnapshot).not.toHaveBeenCalled();
      expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
    },
  );

  it.each(["getCampaign", "getPrimaryGA4Connection"])("does not publish after %s becomes missing", async (method) => {
    storageMock[method].mockResolvedValue(undefined);
    expect(await record()).toBe(false);
    expect(storageMock.createMetricSnapshot).not.toHaveBeenCalled();
  });

  it("keeps the previous snapshot on failure and records a later coherent revision", async () => {
    await record();
    const prior = structuredClone(storageMock.createMetricSnapshot.mock.calls[0][0]);
    storageMock.getGA4OverviewSnapshot.mockResolvedValue(undefined);
    expect(await record()).toBe(false);
    expect(storageMock.createMetricSnapshot).toHaveBeenCalledTimes(1);
    expect(storageMock.createMetricSnapshot.mock.calls[0][0]).toEqual(prior);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => dailyRows()
      .map((row) => row.date === date ? { ...row, conversions: 4, revenue: "70.00" } : row)
      .filter((row) => row.date >= start && row.date <= end));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...overview(), campaignBreakdown: {
      ...overview().campaignBreakdown, totals: { sessions: 30, conversions: 6, revenue: 110.009 },
    } });
    expect(await record()).toBe(true);
    expect(storageMock.createMetricSnapshot).toHaveBeenCalledTimes(2);
    expect(storageMock.createMetricSnapshot.mock.calls[1][0].metrics.performanceSummary.totals.revenue.value).toBe(140.01);
    expect(storageMock.createMetricSnapshot.mock.calls[1][0].metrics.performanceSummary.totals.cpa.value).toBe(3.33);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("preserves genuine zero native revenue and unavailable CPA with zero conversions", async () => {
    storageMock.getRevenueSources.mockResolvedValue([]);
    storageMock.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: 0, sourceIds: [], currency: "EUR" });
    storageMock.getRevenueBreakdownBySource.mockResolvedValue([]);
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => dailyRows()
      .map((row) => ({ ...row, revenue: "0.00", conversions: 0 })).filter((row) => row.date >= start && row.date <= end));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...overview(), campaignBreakdown: {
      ...overview().campaignBreakdown, totals: { sessions: 30, conversions: 0, revenue: 0 },
    } });
    expect(await record()).toBe(true);
    const totals = storageMock.createMetricSnapshot.mock.calls[0][0].metrics.performanceSummary.totals;
    expect(totals.revenue).toMatchObject({ value: 0, available: true });
    expect(totals.roas).toMatchObject({ value: 0, available: true });
    expect(totals.cpa.available).toBe(false);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it("keeps financial values cumulative while preserving the existing traffic window", async () => {
    const connection = { ...await storageMock.getPrimaryGA4Connection(campaignId), importStartDate: "2026-07-01" };
    storageMock.getPrimaryGA4Connection.mockResolvedValue(connection);
    storageMock.getGA4Connections.mockResolvedValue([connection]);
    const rows = Array.from({ length: 108 }, (_, index) => ({ ...dailyRows()[0],
      date: new Date(Date.UTC(2026, 6, 1 + index)).toISOString().slice(0, 10), sessions: 1, users: 1, conversions: 1, revenue: "1.00",
    }));
    storageMock.getGA4DailyMetrics.mockImplementation(async (_id, _property, start, end) => rows.filter((row) => row.date >= start && row.date <= end));
    storageMock.getGA4OverviewSnapshot.mockResolvedValue({ ...overview(), windowStart: "2026-07-01", campaignBreakdown: {
      ...overview().campaignBreakdown, totals: { sessions: 108, conversions: 108, revenue: 108.009 },
    } });
    expect(await record()).toBe(true);
    const totals = storageMock.createMetricSnapshot.mock.calls[0][0].metrics.performanceSummary.totals;
    expect(totals.revenue.value).toBe(138.01);
    expect(totals.cpa.value).toBe(0.19);
    expect(totals.sessions.value).toBe(90);
    expect(totals.conversions.value).toBe(90);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });

  it.each(["unfiltered", "simulation"])("preserves the existing %s aggregate path", async (scope) => {
    if (scope === "unfiltered") storageMock.getCampaign.mockResolvedValue({ ...await storageMock.getCampaign(campaignId), ga4CampaignFilter: "" });
    else {
      const connection = { ...await storageMock.getPrimaryGA4Connection(campaignId), propertyId: "yesop" };
      storageMock.getPrimaryGA4Connection.mockResolvedValue(connection);
      storageMock.getGA4Connections.mockResolvedValue([connection]);
      storageMock.getGA4Connection.mockResolvedValue(connection);
    }
    const previousPath = await aggregateCampaignMetrics(campaignId);
    expect(await record()).toBe(true);
    expect(storageMock.createMetricSnapshot.mock.calls[0][0].metrics).toEqual(previousPath.detailedMetrics);
    expect(storageMock.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it("keeps ordinary non-GA4 snapshots working and defers ordinary GA4 calls", async () => {
    expect(await recordCampaignMetrics(campaignId)).toBe(false);
    expect(storageMock.createMetricSnapshot).not.toHaveBeenCalled();
    storageMock.getGA4Connections.mockResolvedValue([]);
    storageMock.getPrimaryGA4Connection.mockResolvedValue(undefined);
    storageMock.getLatestCustomIntegrationMetrics.mockResolvedValue({ sessions: 12, users: 8, conversions: 2, spend: "10.00" });
    const previousPath = await aggregateCampaignMetrics(campaignId);
    expect(await recordCampaignMetrics(campaignId)).toBe(true);
    expect(storageMock.createMetricSnapshot.mock.calls[0][0].metrics).toEqual(previousPath.detailedMetrics);
    expect(provider.getTotalsWithRevenue).not.toHaveBeenCalled();
  });
});
