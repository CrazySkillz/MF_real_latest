import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  beginFinancialDailySnapshotRefreshObservation,
  getFinancialDailySnapshotObservationStatus,
  recordFinancialDailySnapshotRefreshEvidence,
} from "./utils/financial-daily-snapshot-observation";
import { writeFinancialDailySnapshotIfReady } from "./utils/financial-daily-snapshot-writer";
import { resolveGA4OverviewFinancialRefreshWarning } from "../shared/ga4-financial-source";

const campaignId = "campaign-1";
const reportingDate = "2026-08-21";
const overviewSnapshot = (revenue: unknown = 55966.70) => ({
  campaignId, propertyId: "542352127", windowStart: "2026-07-02", windowEnd: reportingDate,
  campaignBreakdown: { totals: { revenue, conversions: 251 }, meta: { currencyCode: "USD" } },
});

const successfulEvidence = (completedAt = "2026-08-22T22:05:00.000Z") => {
  for (const stage of ["financial_sources", "ga4_daily"] as const) {
    recordFinancialDailySnapshotRefreshEvidence(stage, {
      campaignId,
      reportingDate,
      status: "success",
      completedAt,
      failures: [],
    });
  }
};

const dependencies = (overrides: Record<string, unknown> = {}) => ({
  getCampaign: vi.fn().mockResolvedValue({ id: campaignId, currency: "USD", reportingTimeZone: "Europe/Amsterdam" }),
  getGA4Connections: vi.fn().mockResolvedValue([{
    campaignId,
    propertyId: "542352127",
    isActive: true,
    isPrimary: true,
    importStartDate: "2026-07-02",
  }]),
  getGA4OverviewSnapshot: vi.fn().mockResolvedValue(overviewSnapshot()),
  getCampaignMetricTotals: vi.fn().mockResolvedValue({
    revenue: 72766.69,
    ga4Revenue: 55966.70,
    spend: 2699.75,
    conversions: 251,
    financialConversions: 251,
    users: 0,
    sessions: 0,
    engagementRate: 0,
    revenueBySource: new Map(),
    spendBySource: new Map(),
    revenueAvailable: true,
    spendAvailable: true,
    ga4Available: true,
    ga4RevenueAvailable: true,
    financialConversionsAvailable: true,
    ga4FinancialSource: "provider_to_date",
  }),
  getSpendSources: vi.fn().mockResolvedValue([{
    id: "spend-1",
    isActive: true,
    createdAt: "2026-08-01T00:00:00.000Z",
  }]),
  getRevenueTotalForRange: vi.fn().mockResolvedValue({
    totalRevenue: 16799.99,
    currency: "USD",
    sourceIds: ["revenue-1"],
  }),
  getSpendTotalForRange: vi.fn().mockResolvedValue({
    totalSpend: 2699.75,
    currency: "USD",
    sourceIds: ["spend-1"],
  }),
  upsertFinancialDailySnapshot: vi.fn().mockResolvedValue({ id: "snapshot-1" }),
  now: () => new Date("2026-08-22T12:00:00.000Z"),
  ...overrides,
}) as any;

describe("gated financial daily snapshot writer", () => {
  beforeEach(() => {
    beginFinancialDailySnapshotRefreshObservation("financial_sources");
    beginFinancialDailySnapshotRefreshObservation("ga4_daily");
  });
  it.each(["valid", "wrong total", "wrong currency", "foreign source", "negative", "duplicate"])("keeps Spend provenance with its published total: %s", async condition => {
    successfulEvidence();
    const row = { sourceId: condition === "foreign source" ? "foreign" : "spend-1", currency: condition === "wrong currency" ? "EUR" : "USD",
      spend: condition === "wrong total" ? 1 : condition === "negative" ? -1 : 2699.75 };
    const deps = dependencies({
      getGA4RevenuePublication: vi.fn().mockResolvedValue({ version: 1, reportingDate, sources: { "revenue-1": "hash" }, pendingSourceIds: [] }),
      getRevenueSources: vi.fn().mockResolvedValue([{ id: "revenue-1", sourceType: "csv", currency: "USD", mappingConfig: "{}" }]),
      getRevenueBreakdownBySource: vi.fn().mockResolvedValue([{ sourceId: "revenue-1", revenue: 16799.99, currency: "USD" }]),
      getSpendSources: vi.fn().mockResolvedValue([{ id: "spend-1", sourceType: "google_sheets", displayName: "Costs", currency: "USD", isActive: true,
        mappingConfig: JSON.stringify({ sheetName: "Spend", connectionId: "private", accessToken: "not-for-display" }) }]),
      getSpendBreakdownBySource: vi.fn().mockResolvedValue(condition === "duplicate" ? [row, row] : [row]),
    });
    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    if (condition === "valid") {
      expect(result.status).toBe("written");
      expect(deps.upsertFinancialDailySnapshot.mock.calls[0][0].revenuePublication.display.spendSources).toEqual([
        { sourceId: "spend-1", sourceType: "google_sheets", displayName: "Costs", spend: 2699.75, mappingConfig: { sheetName: "Spend" } },
      ]);
    } else {
      expect(result).toMatchObject({ status: "blocked", reasons: ["spend_publication_mismatch"] });
      expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
    }
  });
  it("saves the exact completed-day revenue breakdown with the financial snapshot", async () => {
    successfulEvidence();
    const receipt = { version: 1, reportingDate, sources: { "revenue-1": "hash-1", "future-source": "hash-2" }, pendingSourceIds: ["future-source"] };
    const deps = dependencies({
      getGA4RevenuePublication: vi.fn().mockResolvedValue(receipt),
      getRevenueSources: vi.fn().mockResolvedValue([
        { id: "revenue-1", sourceType: "google_sheets", displayName: "Revenue", currency: "USD", mappingConfig: JSON.stringify({ sheetName: "Sales", selectedValues: ["brand"], lastTotalRevenue: 99999, connectionId: "private-connection" }) },
        { id: "future-source", sourceType: "csv", displayName: "Future orders", currency: "USD", mappingConfig: "{}" },
      ]),
      getRevenueBreakdownBySource: vi.fn().mockResolvedValue([{ sourceId: "revenue-1", revenue: 16799.99, currency: "USD" }]),
    });
    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    const written = deps.upsertFinancialDailySnapshot.mock.calls[0][0];
    expect(written.revenuePublication.display).toEqual({ nativeRevenue: 55966.70, sources: [
      { sourceId: "revenue-1", sourceType: "google_sheets", displayName: "Revenue", revenue: 16799.99, mappingConfig: { sheetName: "Sales", selectedValues: ["brand"] } },
      { sourceId: "future-source", sourceType: "csv", displayName: "Future orders", revenue: 0, mappingConfig: {} },
    ] });
    expect(deps.getRevenueBreakdownBySource).toHaveBeenCalledWith(campaignId, "1900-01-01", reportingDate, "ga4");
    expect(written.inputs.revenue.value).toBe("72766.69");
    expect(written.revenuePublication.sources).toEqual(receipt.sources);
  });

  it.each(["amount", "currency", "source", "duplicate"])("does not attach a mismatched %s breakdown to a valid total", async mismatch => {
    successfulEvidence();
    const row = { sourceId: mismatch === "source" ? "other" : "revenue-1", revenue: mismatch === "amount" ? 5 : 16799.99, currency: mismatch === "currency" ? "EUR" : "USD" };
    const deps = dependencies({
      getGA4RevenuePublication: vi.fn().mockResolvedValue({ version: 1, reportingDate, sources: { "revenue-1": "hash" }, pendingSourceIds: [] }),
      getRevenueSources: vi.fn().mockResolvedValue([{ id: "revenue-1", sourceType: "csv", displayName: "Orders", currency: "USD", mappingConfig: "{}" }]),
      getRevenueBreakdownBySource: vi.fn().mockResolvedValue(mismatch === "duplicate" ? [row, row] : [row]),
    });
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot.mock.calls[0][0].revenuePublication.display).toBeUndefined();
  });
  it("publishes signed native and imported refunds through the same readiness and ownership gates", async () => {
    successfulEvidence();
    const deps = dependencies();
    const totals = await deps.getCampaignMetricTotals();
    deps.getCampaignMetricTotals.mockResolvedValue({ ...totals, ga4Revenue: -10, revenue: -15 });
    deps.getGA4OverviewSnapshot.mockResolvedValue(overviewSnapshot(-10));
    deps.getRevenueTotalForRange.mockResolvedValue({ totalRevenue: -5, currency: "USD", sourceIds: ["revenue-1"] });
    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({
      inputs: expect.objectContaining({ revenue: { value: "-15.00", available: true, sources: ["ga4", "revenue-source:revenue-1"] } }),
    }));
  });
  it("carries ownership to storage without exposing it in the returned snapshot", async () => {
    successfulEvidence(); const deps = dependencies();
    const refreshScope = { campaignId, ownerId: "owner-1", reportingDate, work: { id: "work", leaseToken: "lease" } };
    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate, refreshScope }, deps);
    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith({ ...result.snapshot, refreshScope });
    expect(result.snapshot).not.toHaveProperty("refreshScope");
  });

  it("retains a complete earlier financial update on source failure and clears the Overview warning after recovery", async () => {
    successfulEvidence("2026-08-22T08:05:00.000Z");
    let recordedAt = "2026-08-22T08:06:00.000Z";
    let saved: any;
    const deps = dependencies({
      upsertFinancialDailySnapshot: vi.fn(async ({ campaignId, reportingDate, ...financialDaily }: any) => {
        saved = { campaignId, reportingDate, recordedAt, metrics: { financialDaily } };
        return saved;
      }),
    });
    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    const morning = JSON.stringify(saved);
    recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
      campaignId, reportingDate, status: "failed", completedAt: "2026-08-22T14:00:00.000Z", failures: ["provider_failed"],
    });
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId, reportingDate, status: "success", completedAt: "2026-08-22T14:05:00.000Z", failures: [],
    });
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("blocked");
    expect(JSON.stringify(saved)).toBe(morning);
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
    const statusInput = {
      campaignId, currency: "USD", selectedPropertyId: "542352127", primaryPropertyId: "542352127",
      daily: { propertyId: "542352127", overviewStartDate: "2026-07-02", latestStoredDailyDate: reportingDate,
        reportingTimeZone: "Europe/Amsterdam", lastUpdated: "2026-08-22T14:05:00.000Z" },
    };
    expect(resolveGA4OverviewFinancialRefreshWarning({ ...statusInput, snapshot: saved })).toBe("earlier_update");
    successfulEvidence();
    recordedAt = "2026-08-22T22:06:00.000Z";
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(resolveGA4OverviewFinancialRefreshWarning({ ...statusInput, snapshot: saved })).toBeNull();
    expect(saved.metrics.financialDaily.inputs).toEqual(JSON.parse(morning).metrics.financialDaily.inputs);
  });

  it("upserts the authoritative cumulative values only after both refresh stages pass", async () => {
    successfulEvidence();
    const deps = dependencies();

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith({
      version: "financial_daily_snapshot_v1",
      publicationVersion: { campaignId, version: null },
      campaignId,
      reportingDate,
      currency: "USD",
      currentValueWindow: {
        mode: "initial_import_to_latest_completed_day",
        startDate: "2026-07-02",
        endDate: reportingDate,
        dataThroughDate: reportingDate,
        reportingTimeZone: "Europe/Amsterdam",
      },
      inputs: {
        spend: { value: "2699.75", available: true, sources: ["canonical_spend_sources"] },
        revenue: { value: "72766.69", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
        conversions: { value: 251, available: true, sources: ["ga4"] },
      },
    });
    expect(getFinancialDailySnapshotObservationStatus()).toMatchObject({
      readyCampaigns: 1,
      writtenCampaigns: 1,
      writeFailedCampaigns: 0,
    });
  });

  it.each([252, 250, 0])("retains the prior snapshot when fresh GA4 conversions change to %s until the saved counts agree", async (financialConversions) => {
    successfulEvidence();
    let saved: unknown;
    const deps = dependencies({
      upsertFinancialDailySnapshot: vi.fn(async (snapshot) => { saved = snapshot; }),
    });
    const totals = await deps.getCampaignMetricTotals();
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    const previous = JSON.stringify(saved);
    deps.getCampaignMetricTotals.mockResolvedValue({ ...totals, financialConversions });

    expect(await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).toEqual({
      status: "blocked", reasons: ["ga4_conversion_total_mismatch"],
    });
    expect(JSON.stringify(saved)).toBe(previous);
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);

    deps.getCampaignMetricTotals.mockResolvedValue({ ...totals, conversions: financialConversions, financialConversions });
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(2);
    expect(saved).toMatchObject({ inputs: { conversions: { available: true, value: financialConversions } } });
  });

  it.each([
    { ga4Available: false },
    { ga4Available: undefined },
    { conversions: undefined },
    { conversions: NaN },
  ])("blocks an unverified saved GA4 count: %j", async (unverified) => {
    successfulEvidence();
    const deps = dependencies();
    deps.getCampaignMetricTotals.mockResolvedValue({ ...(await deps.getCampaignMetricTotals()), ...unverified });

    expect(await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).toEqual({
      status: "blocked", reasons: ["saved_ga4_conversions_unavailable"],
    });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("still blocks unavailable financial conversions even when their numeric placeholder matches", async () => {
    successfulEvidence();
    const deps = dependencies();
    deps.getCampaignMetricTotals.mockResolvedValue({
      ...(await deps.getCampaignMetricTotals()), conversions: 0, financialConversions: 0, financialConversionsAvailable: false,
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("conversions_unavailable");
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("includes every external revenue source when native GA4 revenue is a verified zero", async () => {
    successfulEvidence();
    const deps = dependencies({
      getCampaignMetricTotals: vi.fn().mockResolvedValue({
        revenue: 600,
        ga4Revenue: 0,
        spend: 200,
        conversions: 12,
        financialConversions: 12,
        users: 0,
        sessions: 0,
        engagementRate: 0,
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
        totalRevenue: 600,
        currency: "USD",
        sourceIds: ["revenue-1", "revenue-2"],
      }),
      getSpendTotalForRange: vi.fn().mockResolvedValue({
        totalSpend: 200,
        currency: "USD",
        sourceIds: ["spend-1", "spend-2"],
      }),
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({
      inputs: {
        spend: { value: "200.00", available: true, sources: ["canonical_spend_sources"] },
        revenue: {
          value: "600.00",
          available: true,
          sources: ["ga4", "revenue-source:revenue-1", "revenue-source:revenue-2"],
        },
        conversions: { value: 12, available: true, sources: ["ga4"] },
      },
    }));
  });

  it.each([55966.71, 55966.69, 0, 60000])("retains the prior financial snapshot when GA4 revenue alone changes to %s", async (nativeRevenue) => {
    successfulEvidence();
    let saved: unknown;
    const deps = dependencies({ upsertFinancialDailySnapshot: vi.fn(async (snapshot) => { saved = snapshot; }) });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: '["sale"]' });
    const totals = await deps.getCampaignMetricTotals();
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    const previous = JSON.stringify(saved);
    const revenue = Number((nativeRevenue + 16799.99).toFixed(2));
    deps.getCampaignMetricTotals.mockResolvedValue({ ...totals, ga4Revenue: nativeRevenue, revenue });

    expect(await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).toEqual({
      status: "blocked", reasons: ["ga4_revenue_total_mismatch"],
    });
    expect(JSON.stringify(saved)).toBe(previous);
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);

    deps.getGA4OverviewSnapshot.mockResolvedValue(overviewSnapshot(nativeRevenue));
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(saved).toMatchObject({ inputs: {
      revenue: { available: true, value: revenue.toFixed(2) }, conversions: { available: true, value: 251 },
    } });
    expect(deps.getGA4OverviewSnapshot).toHaveBeenLastCalledWith(campaignId, "542352127");
  });

  it.each([0, 55966.70])("publishes matching aggregate revenue %s with external revenue and unavailable Spend", async (nativeRevenue) => {
    successfulEvidence();
    const deps = dependencies({
      getSpendSources: vi.fn().mockResolvedValue([]),
      getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 0, sourceIds: [] }),
      getGA4OverviewSnapshot: vi.fn().mockResolvedValue(overviewSnapshot(nativeRevenue)),
    });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: "sale" });
    deps.getCampaignMetricTotals.mockResolvedValue({
      ...(await deps.getCampaignMetricTotals()), ga4Revenue: nativeRevenue,
      revenue: Number((nativeRevenue + 16799.99).toFixed(2)), spend: 0,
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    expect(result.status).toBe("written");
    expect(result.snapshot?.inputs).toMatchObject({
      revenue: { available: true, value: (nativeRevenue + 16799.99).toFixed(2), sources: ["ga4", "revenue-source:revenue-1"] },
      spend: { available: false, value: null, sources: [] },
    });
  });

  it("publishes verified zero GA4 Revenue without external Revenue or Spend sources", async () => {
    successfulEvidence();
    const deps = dependencies({
      getSpendSources: vi.fn().mockResolvedValue([]),
      getRevenueTotalForRange: vi.fn().mockResolvedValue({ totalRevenue: 0, sourceIds: [] }),
      getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 0, sourceIds: [] }),
      getGA4OverviewSnapshot: vi.fn().mockResolvedValue(overviewSnapshot(0)),
    });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: "sale" });
    deps.getCampaignMetricTotals.mockResolvedValue({ ...(await deps.getCampaignMetricTotals()), ga4FinancialSource: "persisted_overview", ga4Revenue: 0, revenue: 0, spend: 0 });
    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    expect(result.status).toBe("written");
    expect(result.snapshot?.inputs).toMatchObject({ revenue: { available: true, value: "0.00", sources: ["ga4"] }, spend: { available: false, value: null, sources: [] } });
  });

  it.each([
    ["missing", undefined],
    ["other campaign", { ...overviewSnapshot(), campaignId: "campaign-2" }],
    ["other property", { ...overviewSnapshot(), propertyId: "999" }],
    ["other import start", { ...overviewSnapshot(), windowStart: "2026-07-01" }],
    ["older end", { ...overviewSnapshot(), windowEnd: "2026-08-20" }],
    ["future end", { ...overviewSnapshot(), windowEnd: "2026-08-22" }],
    ["other currency", { ...overviewSnapshot(), campaignBreakdown: { ...overviewSnapshot().campaignBreakdown, meta: { currencyCode: "EUR" } } }],
    ["missing currency", { ...overviewSnapshot(), campaignBreakdown: { totals: { revenue: 55966.70 } } }],
    ["missing revenue", { ...overviewSnapshot(), campaignBreakdown: { totals: {}, meta: { currencyCode: "USD" } } }],
    ["null revenue", overviewSnapshot(null)],
    ["empty revenue", overviewSnapshot("")],
    ["invalid revenue", overviewSnapshot("invalid")],
    ["nonfinite revenue", overviewSnapshot(Infinity)],
  ])("blocks publication with an unverified Overview aggregate: %s", async (_label, snapshot) => {
    successfulEvidence();
    const deps = dependencies({ getGA4OverviewSnapshot: vi.fn().mockResolvedValue(snapshot) });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: "sale" });

    expect(await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).toEqual({
      status: "blocked", reasons: ["saved_ga4_revenue_unavailable"],
    });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("does not publish when reading the saved Overview aggregate fails", async () => {
    successfulEvidence();
    const deps = dependencies({ getGA4OverviewSnapshot: vi.fn().mockRejectedValue(new Error("snapshot read failed")) });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: "sale" });
    await expect(writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).rejects.toThrow("snapshot read failed");
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it.each([undefined, "", "[]", '[" "]'])("preserves the existing unfiltered path for %s", async (ga4CampaignFilter) => {
    successfulEvidence();
    const deps = dependencies({ getGA4OverviewSnapshot: vi.fn().mockResolvedValue(undefined) });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter });
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(deps.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it("preserves the native-only daily fallback when no fresh provider aggregate is selected", async () => {
    successfulEvidence();
    const deps = dependencies({ getRevenueTotalForRange: vi.fn().mockResolvedValue({ totalRevenue: 0, sourceIds: [] }) });
    deps.getCampaign.mockResolvedValue({ ...(await deps.getCampaign()), ga4CampaignFilter: "sale" });
    deps.getCampaignMetricTotals.mockResolvedValue({
      ...(await deps.getCampaignMetricTotals()), ga4FinancialSource: "persisted_daily", ga4Revenue: 55966.68, revenue: 55966.68,
    });
    expect((await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).status).toBe("written");
    expect(deps.getGA4OverviewSnapshot).not.toHaveBeenCalled();
  });

  it("writes GA4 revenue and conversions while preserving unavailable spend when no spend source is configured", async () => {
    successfulEvidence();
    const deps = dependencies({
      getSpendSources: vi.fn().mockResolvedValue([]),
      getRevenueTotalForRange: vi.fn().mockResolvedValue({ totalRevenue: 0, sourceIds: [] }),
      getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 0, sourceIds: [] }),
      getCampaignMetricTotals: vi.fn().mockResolvedValue({
        ...(await dependencies().getCampaignMetricTotals()),
        revenue: 55966.70,
        ga4Revenue: 55966.70,
        spend: 0,
        spendAvailable: true,
      }),
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({
      inputs: expect.objectContaining({
        spend: { value: null, available: false, sources: [] },
        revenue: { value: "55966.70", available: true, sources: ["ga4"] },
      }),
    }));
  });

  it("still blocks unavailable spend when an eligible spend source is configured", async () => {
    successfulEvidence();
    const deps = dependencies({
      getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 0, sourceIds: [] }),
      getCampaignMetricTotals: vi.fn().mockResolvedValue({
        ...(await dependencies().getCampaignMetricTotals()),
        spend: 0,
      }),
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("spend_unavailable");
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("blocks the snapshot when any configured financial source refresh fails", async () => {
    recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
      campaignId,
      reportingDate,
      status: "failed",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: ["1_provider_jobs_failed"],
    });
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId,
      reportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    const deps = dependencies();

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toEqual(expect.arrayContaining([
      "financial_sources_not_successful",
      "financial_sources_has_failures",
    ]));
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("does not write when same-day financial refresh evidence is missing", async () => {
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId,
      reportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    const deps = dependencies();

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result.status).toBe("blocked");
    expect(result.reasons).toContain("financial_sources_not_successful");
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("writes when the later financial refresh supplies the GA4 reporting date", async () => {
    const delayedReportingDate = "2026-08-22";
    recordFinancialDailySnapshotRefreshEvidence("ga4_daily", {
      campaignId,
      reportingDate: delayedReportingDate,
      status: "success",
      completedAt: "2026-08-22T22:05:00.000Z",
      failures: [],
    });
    beginFinancialDailySnapshotRefreshObservation("financial_sources");
    recordFinancialDailySnapshotRefreshEvidence("financial_sources", {
      campaignId,
      reportingDate: delayedReportingDate,
      status: "success",
      completedAt: "2026-08-23T18:41:00.000Z",
      failures: [],
    });
    const deps = dependencies({ now: () => new Date("2026-08-23T18:41:00.000Z") });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate: delayedReportingDate }, deps);

    expect(result.status).toBe("written");
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(1);
  });

  it("rejects a rolling GA4 fallback and leaves storage untouched", async () => {
    successfulEvidence();
    const deps = dependencies();
    deps.getCampaignMetricTotals.mockResolvedValue({
      ...(await deps.getCampaignMetricTotals()),
      ga4FinancialSource: "rolling_breakdown",
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result).toEqual({ status: "blocked", reasons: ["non_cumulative_ga4_financial_source"] });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("blocks incompatible spend currency before the readiness gate", async () => {
    successfulEvidence();
    const deps = dependencies({
      getSpendTotalForRange: vi.fn().mockResolvedValue({
        totalSpend: 2699.75,
        currency: "EUR",
        sourceIds: ["spend-1"],
      }),
    });

    const result = await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(result).toEqual({ status: "blocked", reasons: ["spend_currency_mismatch"] });
    expect(deps.upsertFinancialDailySnapshot).not.toHaveBeenCalled();
  });

  it("records and rethrows a database write failure", async () => {
    successfulEvidence();
    const deps = dependencies({
      upsertFinancialDailySnapshot: vi.fn().mockRejectedValue(new Error("database unavailable")),
    });

    await expect(writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps)).rejects.toThrow("database unavailable");
    expect(getFinancialDailySnapshotObservationStatus()).toMatchObject({
      writtenCampaigns: 0,
      writeFailedCampaigns: 1,
    });
  });

  it("reuses the same reporting-day identity on a same-day rerun", async () => {
    successfulEvidence();
    const deps = dependencies();

    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);

    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledTimes(2);
    expect(deps.upsertFinancialDailySnapshot.mock.calls[0][0]).toEqual(deps.upsertFinancialDailySnapshot.mock.calls[1][0]);
  });
  it("captures the saved revenue inputs before calculation and passes that receipt to guarded publication", async () => {
    successfulEvidence();
    const receipt = { version: 1, reportingDate, sources: { "revenue-1": "before-calculation" }, pendingSourceIds: [] };
    const deps = dependencies({ getGA4RevenuePublication: vi.fn().mockResolvedValue(receipt) });
    await writeFinancialDailySnapshotIfReady({ campaignId, reportingDate }, deps);
    expect(deps.getGA4RevenuePublication).toHaveBeenCalledExactlyOnceWith(campaignId, reportingDate);
    expect(deps.getGA4RevenuePublication.mock.invocationCallOrder[0]).toBeLessThan(deps.getCampaignMetricTotals.mock.invocationCallOrder[0]);
    expect(deps.upsertFinancialDailySnapshot).toHaveBeenCalledWith(expect.objectContaining({ revenuePublication: receipt }));
  });
});

describe("current-day financial publication", () => {
  it("publishes a Closed Won transition and the next day's additional source without a pipeline/revenue gap", async () => {
    vi.stubEnv("GA4_INCLUDE_CURRENT_DAY", "true");
    try {
      let saved: any;
      const publish = async (date: string, won: boolean, secondSource: boolean, failed = false) => {
        beginFinancialDailySnapshotRefreshObservation("financial_sources");
        beginFinancialDailySnapshotRefreshObservation("ga4_daily");
        for (const stage of ["financial_sources", "ga4_daily"] as const) recordFinancialDailySnapshotRefreshEvidence(stage, {
          campaignId, reportingDate: date, status: failed && stage === "financial_sources" ? "failed" : "success",
          completedAt: `${date}T19:01:00.000Z`, failures: failed && stage === "financial_sources" ? ["provider_failed"] : [],
        });
        const crm = { id: "crm-1", sourceType: "hubspot", currency: "USD", mappingConfig: JSON.stringify({
          platformContext: "ga4", pipelineEnabled: true, pipelineStageId: "open", pipelineProxyMode: "current_stage",
          pipelineTotalToDate: won ? 0 : 200, pipelineCurrency: "USD", pipelineLastUpdatedAt: `${date}T19:00:20Z`,
          pipelineValueRevenueTotals: won ? [] : [{ campaignValue: "deal-1", revenue: 200 }],
        }) };
        const imported = (won ? 200 : 0) + (secondSource ? 30 : 0);
        const sources = [crm, ...(secondSource ? [{ id: "sheet-2", sourceType: "google_sheets", currency: "USD", mappingConfig: "{}" }] : [])];
        const deps = dependencies({
          now: () => new Date(`${date}T19:02:00Z`),
          getGA4OverviewSnapshot: vi.fn().mockResolvedValue({ ...overviewSnapshot(100), windowEnd: date }),
          getCampaignMetricTotals: vi.fn().mockResolvedValue({ revenue: 100 + imported, ga4Revenue: 100, spend: 10,
            conversions: 251, financialConversions: 251, ga4Available: true, ga4RevenueAvailable: true, ga4FinancialSource: "saved_overview",
            spendAvailable: true, revenueAvailable: true, financialConversionsAvailable: true }),
          getRevenueTotalForRange: vi.fn().mockImplementation(async (_id, start, end) => {
            expect(start).toBe("1900-01-01"); expect(end).toBe(date);
            return { totalRevenue: imported, currency: "USD", sourceIds: sources.map(source => source.id) };
          }),
          getSpendTotalForRange: vi.fn().mockResolvedValue({ totalSpend: 10, currency: "USD", sourceIds: ["spend-1"] }),
          getRevenueSources: vi.fn().mockResolvedValue(sources),
          getRevenueBreakdownBySource: vi.fn().mockResolvedValue([
            { sourceId: "crm-1", revenue: won ? 200 : 0, currency: "USD" },
            ...(secondSource ? [{ sourceId: "sheet-2", revenue: 30, currency: "USD" }] : []),
          ]),
          getGA4RevenuePublication: vi.fn().mockImplementation(async () => ({ version: 1, reportingDate: date,
            sources: Object.fromEntries(sources.map(source => [source.id, "guarded-input-hash"])), pendingSourceIds: [] })),
          upsertFinancialDailySnapshot: vi.fn().mockImplementation(async (value: any) => { saved = structuredClone(value); }),
        });
        return writeFinancialDailySnapshotIfReady({ campaignId, reportingDate: date }, deps);
      };
      expect((await publish("2026-08-21", false, false)).status).toBe("written");
      expect(Number(saved.inputs.revenue.value)).toBe(100);
      expect(saved.revenuePublication.display.sources[0].mappingConfig.pipelineTotalToDate).toBe(200);
      const lastGood = structuredClone(saved);
      expect((await publish("2026-08-21", true, false, true)).status).toBe("blocked");
      expect(saved).toEqual(lastGood);
      expect((await publish("2026-08-21", true, false)).status).toBe("written");
      expect(Number(saved.inputs.revenue.value)).toBe(300);
      expect(saved.revenuePublication.display.sources[0].mappingConfig.pipelineTotalToDate).toBe(0);
      expect((await publish("2026-08-22", true, true)).status).toBe("written");
      expect(Number(saved.inputs.revenue.value)).toBe(330);
      expect(Number(saved.inputs.spend.value)).toBe(10);
      expect(saved.currentValueWindow).toMatchObject({ mode: "initial_import_to_latest_available_day", endDate: "2026-08-22" });
      expect(saved.revenuePublication.display.sources.map((source: any) => source.sourceId)).toEqual(["crm-1", "sheet-2"]);
    } finally { vi.unstubAllEnvs(); }
  });
});
