import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const mocks = vi.hoisted(() => {
  const getDailyMetrics = vi.fn();
  const getCustomerAccount = vi.fn();
  const refreshAccessToken = vi.fn();

  class MockGoogleAdsClient {
    static refreshAccessToken = refreshAccessToken;
    static microsToAmount(micros: number) {
      return micros / 1_000_000;
    }

    getDailyMetrics = getDailyMetrics;
    getCustomerAccount = getCustomerAccount;
  }

  return {
    getDailyMetrics,
    getCustomerAccount,
    refreshAccessToken,
    MockGoogleAdsClient,
    runGA4DailyKPIAndBenchmarkJobs: vi.fn(async () => ({
      campaignsProcessed: 1,
      campaignIdsSkipped: [], campaignIdsFailed: [], kpiIdsSkipped: [], kpiIdsFailed: [],
      benchmarkIdsSkipped: [], benchmarkIdsFailed: [], alertReconciliationFailures: [],
    })),
    storage: {
      getGoogleAdsConnection: vi.fn(),
      getGA4GoogleAdsSpendConnection: vi.fn(),
      getCampaign: vi.fn(),
      updateGoogleAdsConnection: vi.fn(),
      updateGA4GoogleAdsSpendConnection: vi.fn(),
      replaceGoogleAdsDailyMetricsForWindow: vi.fn(),
      replaceGA4GoogleAdsSpendDailyMetricsForWindow: vi.fn(),
      getGoogleAdsDailyMetrics: vi.fn(),
      getGA4GoogleAdsSpendDailyMetrics: vi.fn(),
      getSpendSources: vi.fn(),
      replaceSpendRecordsForSource: vi.fn(),
      getSpendTotalForRange: vi.fn(),
      updateCampaign: vi.fn(),
      invalidateExecutiveSummaryDailySnapshotAlignment: vi.fn(),
      writeWithGA4RefreshOwnership: vi.fn(async (_scope, write) => write({})),
      updateGoogleAdsDailyMetricsGA4Revenue: vi.fn(),
    },
    db: {
      select: vi.fn(() => ({ from: vi.fn(async () => []) })),
    },
  };
});

vi.mock("./storage", () => ({ storage: mocks.storage }));
vi.mock("./db", () => ({ db: mocks.db }));
vi.mock("./googleAdsClient", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./googleAdsClient")>()),
  GoogleAdsClient: mocks.MockGoogleAdsClient,
}));
vi.mock("./ga4-kpi-benchmark-jobs", () => ({
  runGA4DailyKPIAndBenchmarkJobs: mocks.runGA4DailyKPIAndBenchmarkJobs,
}));

import { refreshAllGoogleAdsMetrics, refreshGoogleAdsForCampaign } from "./google-ads-scheduler";
import { googleAdsConnections, ga4GoogleAdsSpendConnections } from "../shared/schema";

describe("Google Ads GA4 Overview spend production path", () => {
  it("creates dedicated storage before the Google Ads scheduler starts", () => {
    const startup = readFileSync("server/index.ts", "utf8");
    const migration = readFileSync("migrations/0017_add_ga4_google_ads_spend_storage.sql", "utf8");
    for (const name of ["ga4_google_ads_spend_connections", "ga4_google_ads_spend_daily_metrics"]) {
      expect(startup).toContain(`CREATE TABLE IF NOT EXISTS ${name}`);
      expect(migration).toContain(`CREATE TABLE IF NOT EXISTS ${name}`);
    }
    for (const name of ["ga4_google_ads_spend_connections_campaign_unique", "ga4_google_ads_spend_daily_metrics_campaign_day_unique"]) {
      expect(startup).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${name}`);
      expect(migration).toContain(`CREATE UNIQUE INDEX IF NOT EXISTS ${name}`);
    }
    expect(startup.indexOf("GA4 Google Ads Spend storage ready")).toBeLessThan(startup.indexOf("startGoogleAdsScheduler();"));
  });

  beforeEach(() => {
    vi.stubEnv("GA4_DAILY_PIPELINE_OWNS_REFRESH", "false");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-06T12:00:00.000Z"));
    vi.clearAllMocks();
    mocks.storage.getCampaign.mockResolvedValue({ id: "campaign-1", ownerId: "owner-1", status: "active", startDate: "2026-07-01", reportingTimeZone: "Europe/Amsterdam", currency: "USD" });
    const savedConnection = async (_id: string, patch: any, options?: any) => ({ ...options?.googleAdsRefresh?.connection, ...patch });
    mocks.storage.updateGoogleAdsConnection.mockImplementation(savedConnection);
    mocks.storage.updateGA4GoogleAdsSpendConnection.mockImplementation(savedConnection);
    mocks.storage.updateCampaign.mockImplementation(async (_id, patch) => ({ id: 'campaign-1', ...patch }));
    mocks.storage.replaceGoogleAdsDailyMetricsForWindow.mockResolvedValue({ replaced: 1 });
    mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow.mockResolvedValue({ replaced: 1 });
    mocks.storage.getGoogleAdsConnection.mockResolvedValue({ method: "oauth", spendOnly: true, customerName: "Account", selectedCampaignIds: JSON.stringify(["google-campaign-1"]), lastRefreshAt: new Date() });
    mocks.storage.getSpendSources.mockResolvedValue([{ id: "source-1", sourceType: "ad_platforms", currency: "USD", isActive: true, mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["google-campaign-1"] }) }]);
    mocks.storage.getGoogleAdsDailyMetrics.mockResolvedValue([{ campaignId: "campaign-1", googleCampaignId: "google-campaign-1", googleCampaignName: "Brand Search", date: "2026-07-01", spend: "123.45" }]);
    mocks.storage.getGA4GoogleAdsSpendDailyMetrics.mockResolvedValue([{ campaignId: "campaign-1", googleCampaignId: "google-campaign-1", googleCampaignName: "Brand Search", date: "2026-07-01", spend: "123.45" }]);
    mocks.storage.getSpendTotalForRange.mockResolvedValue({ totalSpend: 123.45, currency: "USD", sourceIds: ["source-1"] });
    mocks.getCustomerAccount.mockResolvedValue({ manager: false, currencyCode: "USD", timeZone: "Europe/Amsterdam" });
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

  afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

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
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledWith(
      "campaign-1",
      "2026-07-01",
      "2026-08-05",
      [
      expect.objectContaining({
        campaignId: "campaign-1",
        googleCampaignId: "google-campaign-1",
        googleCampaignName: "Brand Search",
        date: "2026-07-01",
        spend: "123.45",
        conversions: "2",
      }),
      ],
      expect.objectContaining({ googleAdsRefresh: expect.objectContaining({ dedicatedSpend: false }) }),
    );
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledWith(
      "campaign-1", "source-1", "ad_platforms", "ga4",
      [expect.objectContaining({ date: "2026-07-01", spend: "123.45", currency: "USD" })],
      expect.any(String), expect.objectContaining({ googleAdsRefresh: expect.any(Object) }),
    );
    expect(mocks.storage.updateGoogleAdsConnection).toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ accessToken: "fresh-token" }), expect.objectContaining({ googleAdsRefresh: expect.any(Object) })
    );
    // Ordinary freshness is committed by the fact replacement transaction (PostgreSQL suite).
    expect(mocks.storage.updateGoogleAdsConnection).not.toHaveBeenCalledWith(
      "campaign-1",
      expect.objectContaining({ lastRefreshAt: expect.any(Date) }), expect.objectContaining({ googleAdsRefresh: expect.any(Object) })
    );
  });

  it.each([false, true])("passes ownership through Google Ads facts, records and cache (dedicated=%s)", async dedicated => {
    const refreshScope = { campaignId: "campaign-1", ownerId: "owner-1", reportingDate: "2026-08-05", work: { id: "work-1", leaseToken: "test-lease" } };
    const connection = { id: "conn-1", campaignId: "campaign-1", method: "oauth", spendOnly: true, accessToken: "fake", customerId: "123", lastRefreshAt: new Date() };
    mocks.storage.getGoogleAdsConnection.mockResolvedValue(connection);
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue(connection);
    await refreshGoogleAdsForCampaign("campaign-1", connection, { ga4SpendConnection: dedicated, deferDownstream: true, refreshScope });
    const facts = dedicated ? mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow : mocks.storage.replaceGoogleAdsDailyMetricsForWindow;
    const metadata = dedicated ? mocks.storage.updateGA4GoogleAdsSpendConnection : mocks.storage.updateGoogleAdsConnection;
    expect(metadata).toHaveBeenCalledWith("campaign-1", { lastRefreshAt: expect.any(Date) }, expect.objectContaining({ refreshScope }));
    expect(facts).toHaveBeenCalledWith("campaign-1", "2026-07-01", "2026-08-05", expect.any(Array), expect.objectContaining({ refreshScope, expectedConnection: connection, expectedSource: { id: "source-1", mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["google-campaign-1"] }) } }));
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledWith("campaign-1", "source-1", "ad_platforms", "ga4", expect.any(Array), expect.any(String), expect.objectContaining({ refreshScope }));
    expect(mocks.storage.updateCampaign).toHaveBeenCalledWith("campaign-1", { spend: "123.45" }, expect.objectContaining({ refreshScope }));
    expect(mocks.runGA4DailyKPIAndBenchmarkJobs).not.toHaveBeenCalled();
    expect(mocks.storage.invalidateExecutiveSummaryDailySnapshotAlignment).not.toHaveBeenCalled();
  });

  it("stops Google Ads after a late provider response loses ownership", async () => {
    const refreshScope = { campaignId: "campaign-1", ownerId: "owner-1", reportingDate: "2026-08-05", work: { id: "work-1", leaseToken: "test-lease" } };
    mocks.storage.replaceGoogleAdsDailyMetricsForWindow.mockRejectedValueOnce(new Error("GA4_REFRESH_WORK_OWNERSHIP_LOST"));
    await expect(refreshGoogleAdsForCampaign("campaign-1", { id: "conn-1", campaignId: "campaign-1", method: "oauth", spendOnly: true, accessToken: "fake", customerId: "123" }, { deferDownstream: true, refreshScope })).rejects.toThrow("GA4_REFRESH_WORK_OWNERSHIP_LOST");
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled(); expect(mocks.storage.updateCampaign).not.toHaveBeenCalled(); expect(mocks.runGA4DailyKPIAndBenchmarkJobs).not.toHaveBeenCalled();
  });

  it.each(['ERR_CANCELED', 'ECONNABORTED', 'ETIMEDOUT'])('retains saved facts after token request %s and recovers on the next run', async code => {
    const connection = { method: 'oauth', spendOnly: true, accessToken: 'fixture-old', refreshToken: 'fixture-refresh',
      clientId: 'fixture-client', clientSecret: 'fixture-secret', customerId: '123' };
    const failure = Object.assign(new Error('fixture request stopped'), { code });
    mocks.refreshAccessToken.mockRejectedValueOnce(failure);
    await expect(refreshGoogleAdsForCampaign('campaign-1', connection)).rejects.toBe(failure);
    expect(mocks.getCustomerAccount).not.toHaveBeenCalled();
    expect(mocks.getDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.updateGoogleAdsConnection).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
    expect(mocks.storage.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.runGA4DailyKPIAndBenchmarkJobs).not.toHaveBeenCalled();
    await refreshGoogleAdsForCampaign('campaign-1', connection);
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledOnce();
  });

  it.each(['metadata', 'metrics'])('retains saved financial facts after a cancelled Google Ads %s read', async phase => {
    const failure = Object.assign(new Error('fixture request stopped'), { code: 'ERR_CANCELED' });
    (phase === 'metadata' ? mocks.getCustomerAccount : mocks.getDailyMetrics).mockRejectedValueOnce(failure);
    await expect(refreshGoogleAdsForCampaign('campaign-1', {
      method: 'oauth', spendOnly: true, accessToken: 'fixture', customerId: '123',
    })).rejects.toBe(failure);
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
    expect(mocks.storage.updateGoogleAdsConnection).not.toHaveBeenCalled();
    expect(mocks.storage.updateCampaign).not.toHaveBeenCalled();
    expect(mocks.runGA4DailyKPIAndBenchmarkJobs).not.toHaveBeenCalled();
  });

  it("rejects a source edit between Google Ads fetch and materialization", async () => {
    const refreshScope = { campaignId: "campaign-1", ownerId: "owner-1", reportingDate: "2026-08-05", work: { id: "work-1", leaseToken: "test-lease" } };
    const source = (await mocks.storage.getSpendSources())[0];
    mocks.storage.getSpendSources.mockResolvedValueOnce([source]).mockResolvedValueOnce([source]).mockResolvedValueOnce([{ ...source, mappingConfig: '{"platform":"google_ads","selectedCampaignIds":["changed"]}' }]);
    await expect(refreshGoogleAdsForCampaign("campaign-1", { id: "conn-1", campaignId: "campaign-1", method: "oauth", spendOnly: true, accessToken: "fake", customerId: "123" }, { deferDownstream: true, refreshScope })).rejects.toThrow("GA4_REFRESH_TARGET_SCOPE_CHANGED");
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled(); expect(mocks.storage.updateCampaign).not.toHaveBeenCalled();
  });

  it("refreshes a hydrated temporary service-account Spend connection through dedicated storage", async () => {
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue({
      method: "service_account",
      spendOnly: true,
      accessToken: "temporary-service-account-token",
      customerId: "123-456-7890",
      customerName: "Spend Account",
      lastRefreshAt: new Date(),
    });
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "service_account",
      spendOnly: true,
      accessToken: "temporary-service-account-token",
      customerId: "123-456-7890",
      customerName: "Spend Account",
    }, { ga4SpendConnection: true });

    expect(mocks.refreshAccessToken).not.toHaveBeenCalled();
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["google-campaign-1"]);
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledOnce();
  });

  it("does not use Google Ads test mode as the spend-only production proof path", async () => {
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "test_mode",
      spendOnly: true,
      accessToken: "test-token",
    });

    expect(mocks.storage.getCampaign).not.toHaveBeenCalled();
    expect(mocks.getDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
  });

  it("fetches only the saved GA4 Spend campaign selection even when the connection has a different selection", async () => {
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "oauth", spendOnly: true, accessToken: "old-token", refreshToken: "refresh-token",
      clientId: "client-id", clientSecret: "client-secret", developerToken: "developer-token",
      customerId: "123-456-7890", selectedCampaignIds: JSON.stringify(["wrong-campaign"]),
    });
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["google-campaign-1"]);
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledOnce();
  });

  it("retains last-good rows when the saved Spend selection is missing or duplicated", async () => {
    const connection = {
      method: "oauth", spendOnly: true, accessToken: "old-token", refreshToken: "refresh-token",
      clientId: "client-id", clientSecret: "client-secret", developerToken: "developer-token",
      customerId: "123-456-7890",
    };
    mocks.storage.getSpendSources.mockResolvedValueOnce([{ id: "source-1", sourceType: "ad_platforms", isActive: true, mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: [] }) }]);
    await expect(refreshGoogleAdsForCampaign("campaign-1", connection)).rejects.toThrow("selected campaign scope is unavailable");
    mocks.storage.getSpendSources.mockResolvedValueOnce([
      { id: "source-1", sourceType: "ad_platforms", isActive: true, mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["google-campaign-1"] }) },
      { id: "source-2", sourceType: "ad_platforms", isActive: true, mappingConfig: JSON.stringify({ platform: "google_ads", selectedCampaignIds: ["google-campaign-1"] }) },
    ]);
    await expect(refreshGoogleAdsForCampaign("campaign-1", connection)).rejects.toThrow("Multiple active GA4 Google Ads spend sources");
    expect(mocks.getDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
  });

  it("fails before provider fetch when a named Google Ads Spend source has no valid platform mapping", async () => {
    mocks.storage.getSpendSources.mockResolvedValue([{ id: "source-1", sourceType: "ad_platforms", displayName: "Google Ads", isActive: true, mappingConfig: "{}" }]);
    await expect(refreshGoogleAdsForCampaign("campaign-1", {
      method: "oauth", spendOnly: true, accessToken: "old-token", customerId: "123-456-7890",
    })).rejects.toThrow("source mapping is unavailable");
    expect(mocks.getDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
  });

  it("still permits the initial account fetch before a GA4 Google Ads Spend source exists", async () => {
    mocks.storage.getSpendSources.mockResolvedValue([]);
    const result = await refreshGoogleAdsForCampaign("campaign-1", {
      method: "oauth", spendOnly: true, accessToken: "old-token", customerId: "123-456-7890",
    });
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), undefined);
    expect(result.spendMaterialization).toEqual({ updated: false, sourceId: null, records: 0, totalSpend: null });
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
  });

  it("keeps the separate Connected Platform selection independent of GA4 Spend sources", async () => {
    await refreshGoogleAdsForCampaign("campaign-1", {
      method: "oauth", spendOnly: false, accessToken: "old-token", customerId: "123-456-7890",
      selectedCampaignIds: JSON.stringify(["connected-campaign"]),
    });
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["connected-campaign"]);
    expect(mocks.storage.getSpendSources).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
  });

  it("refreshes dedicated GA4 Spend facts without reading or replacing main Google Ads facts", async () => {
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue({
      method: "oauth", spendOnly: true, accessToken: "spend-token", refreshToken: "refresh-token",
      clientId: "client-id", clientSecret: "client-secret", customerId: "123-456-7890",
      customerName: "Spend Account", lastRefreshAt: new Date(),
    });
    const result = await refreshGoogleAdsForCampaign("campaign-1", undefined, { ga4SpendConnection: true });
    expect(result.spendMaterialization?.sourceId).toBe("source-1");
    expect(mocks.storage.getGoogleAdsConnection).not.toHaveBeenCalled();
    expect(mocks.storage.getGoogleAdsDailyMetrics).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.updateGoogleAdsConnection).not.toHaveBeenCalled();
    expect(mocks.storage.updateGA4GoogleAdsSpendConnection).toHaveBeenCalledWith("campaign-1", expect.objectContaining({ accessToken: "fresh-token" }), expect.objectContaining({ googleAdsRefresh: expect.objectContaining({ dedicatedSpend: true }) }));
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledOnce();
    expect(mocks.runGA4DailyKPIAndBenchmarkJobs).toHaveBeenCalledOnce();
  });

  it("defers downstream recompute while the ordered GA4 daily pipeline aligns Google Ads Spend", async () => {
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue({
      method: "oauth", spendOnly: true, accessToken: "spend-token", refreshToken: "refresh-token",
      clientId: "client-id", clientSecret: "client-secret", customerId: "123-456-7890",
      customerName: "Spend Account", lastRefreshAt: new Date(),
    });
    const result = await refreshGoogleAdsForCampaign("campaign-1", undefined, {
      ga4SpendConnection: true,
      deferDownstream: true,
    });
    expect(result.spendMaterialization?.updated).toBe(true);
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceSpendRecordsForSource).toHaveBeenCalledOnce();
    expect(mocks.runGA4DailyKPIAndBenchmarkJobs).not.toHaveBeenCalled();
  });

  it("leaves GA4 Spend to its scheduled pipeline while still refreshing the separate Google Ads platform", async () => {
    vi.stubEnv("GA4_DAILY_PIPELINE_OWNS_REFRESH", "true");
    const inventories: unknown[] = [];
    mocks.db.select.mockImplementation(() => ({ from: vi.fn(async (table: unknown) => {
      inventories.push(table);
      return table === googleAdsConnections ? [{ campaignId: "campaign-1", spendOnly: false }, { campaignId: "legacy-spend", spendOnly: true }] : [{ campaignId: "campaign-1" }];
    }) }));
    mocks.storage.getGoogleAdsConnection.mockResolvedValue({ method: "oauth", spendOnly: false, accessToken: "fixture", customerId: "123-456-7890", selectedCampaignIds: '["main-campaign"]' });
    expect(await refreshAllGoogleAdsMetrics()).toEqual({ attempted: 1, succeeded: 1, failedCampaignIds: [] });
    expect(inventories).toEqual([googleAdsConnections]);
    expect(mocks.storage.getGoogleAdsConnection).toHaveBeenCalledTimes(1);
    expect(mocks.storage.getGoogleAdsConnection).toHaveBeenCalledWith("campaign-1");
    expect(mocks.storage.getGA4GoogleAdsSpendConnection).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceSpendRecordsForSource).not.toHaveBeenCalled();
  });

  it("schedules the main platform and dedicated Spend connection separately when GA4 pipeline ownership is disabled", async () => {
    mocks.db.select.mockImplementation(() => ({ from: vi.fn(async (table: unknown) =>
      table === googleAdsConnections ? [{ campaignId: "campaign-1", spendOnly: false }] :
      table === ga4GoogleAdsSpendConnections ? [{ campaignId: "campaign-1" }] : [],
    ) }));
    mocks.storage.getGoogleAdsConnection.mockResolvedValue({
      method: "oauth", spendOnly: false, accessToken: "main-token", customerId: "123-456-7890",
      selectedCampaignIds: JSON.stringify(["main-campaign"]),
    });
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue({
      method: "oauth", spendOnly: true, accessToken: "spend-token", customerId: "123-456-7890",
      lastRefreshAt: new Date(),
    });
    const result = await refreshAllGoogleAdsMetrics();
    expect(result).toEqual({ attempted: 2, succeeded: 2, failedCampaignIds: [] });
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["main-campaign"]);
    expect(mocks.getDailyMetrics).toHaveBeenCalledWith(expect.any(String), expect.any(String), ["google-campaign-1"]);
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).toHaveBeenCalledOnce();
  });

  it("still refreshes the main platform when the dedicated Spend inventory is unavailable", async () => {
    mocks.db.select.mockImplementation(() => ({ from: vi.fn(async (table: unknown) => {
      if (table === googleAdsConnections) return [{ campaignId: "campaign-1", spendOnly: false }];
      throw new Error("Spend table unavailable");
    }) }));
    mocks.storage.getGoogleAdsConnection.mockResolvedValue({
      method: "oauth", spendOnly: false, accessToken: "main-token", customerId: "123-456-7890",
      selectedCampaignIds: JSON.stringify(["main-campaign"]),
    });
    await expect(refreshAllGoogleAdsMetrics()).rejects.toThrow("GA4 Google Ads Spend connection inventory failed");
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).toHaveBeenCalledOnce();
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).not.toHaveBeenCalled();
  });

  it("does not schedule a legacy Spend-only connection twice after dedicated reconnect", async () => {
    mocks.db.select.mockImplementation(() => ({ from: vi.fn(async (table: unknown) =>
      table === googleAdsConnections ? [{ campaignId: "campaign-1", spendOnly: true }] :
      table === ga4GoogleAdsSpendConnections ? [{ campaignId: "campaign-1" }] : [],
    ) }));
    mocks.storage.getGA4GoogleAdsSpendConnection.mockResolvedValue({
      method: "oauth", spendOnly: true, accessToken: "spend-token", customerId: "123-456-7890",
      lastRefreshAt: new Date(),
    });
    const result = await refreshAllGoogleAdsMetrics();
    expect(result).toEqual({ attempted: 1, succeeded: 1, failedCampaignIds: [] });
    expect(mocks.storage.getGoogleAdsConnection).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGoogleAdsDailyMetricsForWindow).not.toHaveBeenCalled();
    expect(mocks.storage.replaceGA4GoogleAdsSpendDailyMetricsForWindow).toHaveBeenCalledOnce();
  });

});
