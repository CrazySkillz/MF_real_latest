import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildPerformanceSummaryAggregate } from "./utils/performance-summary-aggregate";
import {
  getShopifyRevenueRefreshFreshness,
  markShopifyRevenueRefreshAttempt,
  markShopifyRevenueRefreshFailure,
  markShopifyRevenueRefreshSuccess,
} from "./utils/shopify-refresh-state";

const read = (file: string) => readFileSync(join(__dirname, file), "utf8").replace(/\r\n/g, "\n");

describe("Shopify refresh state", () => {
  const previous = {
    provider: "shopify",
    lastTotalRevenue: 125,
    lastMatchedOrderCount: 2,
    lastSyncedAt: "2026-07-10T03:00:00.000Z",
  };

  it("records a manual attempt and failure without replacing last-good values", () => {
    const event = { attemptAt: "2026-07-13T10:00:00.000Z", at: "2026-07-13T10:00:00.000Z", runId: "manual-1", trigger: "manual" as const };
    const attempted = markShopifyRevenueRefreshAttempt(previous, event);
    const failed = markShopifyRevenueRefreshFailure(attempted, { ...event, at: "2026-07-13T10:00:01.000Z" }, new Error("Bearer secret-token failed"));

    expect(failed).toMatchObject({
      refreshStatus: "failed",
      lastRefreshAttemptAt: event.attemptAt,
      lastRefreshFailureAt: "2026-07-13T10:00:01.000Z",
      lastRefreshRunId: "manual-1",
      lastRefreshTrigger: "manual",
      lastTotalRevenue: 125,
      lastMatchedOrderCount: 2,
      lastSyncedAt: previous.lastSyncedAt,
    });
    expect(failed.lastRefreshError).toContain("[redacted]");
    expect(failed.lastRefreshError).not.toContain("secret-token");
  });

  it("records scheduler success as the new last-good state while retaining failure history", () => {
    const event = { attemptAt: "2026-07-13T03:00:00.000Z", at: "2026-07-13T03:00:02.000Z", runId: "scheduler-1", trigger: "scheduler" as const };
    const success = markShopifyRevenueRefreshSuccess(
      { provider: "shopify", lastTotalRevenue: 175, lastMatchedOrderCount: 3 },
      { ...previous, lastRefreshFailureAt: "2026-07-12T03:00:00.000Z" },
      event,
    );

    expect(success).toMatchObject({
      refreshStatus: "success",
      lastRefreshAttemptAt: event.attemptAt,
      lastRefreshSuccessAt: event.at,
      lastGoodAt: event.at,
      lastRefreshFailureAt: "2026-07-12T03:00:00.000Z",
      lastRefreshRunId: "scheduler-1",
      lastRefreshTrigger: "scheduler",
      lastTotalRevenue: 175,
      lastSyncedAt: event.at,
      lastRefreshError: null,
    });
  });

  it("records manual success with the manual run identity", () => {
    const event = { attemptAt: "2026-07-13T11:00:00.000Z", at: "2026-07-13T11:00:02.000Z", runId: "manual-2", trigger: "manual" as const };
    const success = markShopifyRevenueRefreshSuccess({ ...previous, lastTotalRevenue: 150 }, previous, event);

    expect(success).toMatchObject({
      refreshStatus: "success",
      lastRefreshRunId: "manual-2",
      lastRefreshTrigger: "manual",
      lastGoodAt: event.at,
      lastTotalRevenue: 150,
    });
  });

  it("records scheduler failure without changing the retained last-good amount or timestamp", () => {
    const event = { attemptAt: "2026-07-13T03:00:00.000Z", at: "2026-07-13T03:00:03.000Z", runId: "scheduler-2", trigger: "scheduler" as const };
    const failed = markShopifyRevenueRefreshFailure(markShopifyRevenueRefreshAttempt(previous, event), event, new Error("provider unavailable"));

    expect(failed).toMatchObject({
      refreshStatus: "failed",
      lastRefreshRunId: "scheduler-2",
      lastRefreshTrigger: "scheduler",
      lastTotalRevenue: previous.lastTotalRevenue,
      lastSyncedAt: previous.lastSyncedAt,
    });
  });

  it("normalizes legacy lastSyncedAt into additive freshness provenance", () => {
    expect(getShopifyRevenueRefreshFreshness(previous)).toMatchObject({
      provider: "shopify",
      lastRefreshSuccessAt: previous.lastSyncedAt,
      lastGoodAt: previous.lastSyncedAt,
    });
  });

  it("carries Shopify freshness through the financial-source aggregate", () => {
    const aggregate = buildPerformanceSummaryAggregate({
      campaignId: "campaign-1",
      dateRange: "all",
      revenue: { totalRevenue: 175 },
      revenueSources: [{
        type: "shopify",
        connected: true,
        lastTotalRevenue: 175,
        platformContext: "ga4",
        freshness: { provider: "shopify", refreshStatus: "failed", lastGoodAt: previous.lastSyncedAt, lastRefreshRunId: "scheduler-1" },
      }],
    });

    expect(aggregate.sources.find((source) => source.id === "revenue_shopify")?.freshness).toEqual({
      provider: "shopify",
      refreshStatus: "failed",
      lastGoodAt: previous.lastSyncedAt,
      lastRefreshRunId: "scheduler-1",
      platformContext: "ga4",
    });
  });
});

describe("Shopify refresh lifecycle wiring", () => {
  it("audits before provider fetch, records rollback-safe failure, and does not relabel post-commit failures", () => {
    const routes = read("routes-oauth.ts");
    const start = routes.indexOf('app.post("/api/campaigns/:id/shopify/save-mappings"');
    const end = routes.indexOf('app.post("/api/campaigns/:id/chat"', start);
    const saveRoute = routes.slice(start, end);

    expect(saveRoute.indexOf("markShopifyRevenueRefreshAttempt")).toBeLessThan(saveRoute.indexOf("shopifyFetchAllOrders"));
    expect(saveRoute).toContain("await storage.updateGa4ShopifyRevenueSourceRefreshState");
    expect(saveRoute).toContain("await persistRefreshFailure(e);");
    expect(saveRoute).toContain("await persistRefreshFailure(error);");
    expect(saveRoute.indexOf("refreshCommitted = true;")).toBeLessThan(saveRoute.indexOf("await recomputeCampaignDerivedValues"));
  });

  it("keeps failure metadata campaign/source/type/context scoped and revenue-record neutral", () => {
    const storage = read("storage.ts");
    const start = storage.indexOf("async updateGa4ShopifyRevenueSourceRefreshState");
    const end = storage.indexOf("async getRevenueTotalForRange", start);
    const update = storage.slice(start, end);

    expect(update).toContain("eq(revenueSources.campaignId, campaignId)");
    expect(update).toContain("eq(revenueSources.sourceType, 'shopify')");
    expect(update).toContain("eq(revenueSources.isActive, true)");
    expect(update).toContain("eq(revenueSources.platformContext, 'ga4' as any)");
    expect(update).toContain("'lastRefreshRunId' = ${expectedRunId}");
    expect(update).not.toContain("revenueRecords");
  });

  it("passes one scheduler run identity into every Shopify reprocess without changing cadence", () => {
    const scheduler = read("auto-refresh-scheduler.ts");
    expect(scheduler).toContain("const refreshRunId = randomUUID();");
    expect(scheduler).toContain("refreshRunId } : {}");
    expect(scheduler).toContain("if (shopCfg) shopCfg.refreshRunId = refreshRunId;");
    expect(scheduler).toContain("setTimeout(() => {");
    expect(scheduler).toContain("runDailyAutoRefreshOnce()");
  });

  it("exposes Shopify freshness in provenance, DeepDive risk, and scheduled aggregates", () => {
    const routes = read("routes-oauth.ts");
    const aggregate = read("utils/performance-summary-aggregate.ts");
    const snapshots = read("scheduler.ts");
    const ga4Page = read("../client/src/pages/ga4-metrics.tsx");

    expect(routes).toContain("getShopifyRevenueSourceFreshness(source)");
    expect(routes).toContain('message: "Shopify Revenue refresh failed; retained last-good revenue may be stale"');
    expect(routes).toContain('message: "Shopify Revenue freshness is unavailable; current revenue cannot be dated"');
    expect(aggregate).toContain("{ ...source.freshness");
    expect(snapshots).toContain("getShopifyRevenueRefreshFreshness(sourceMapping)");
    expect(ga4Page).toContain('cfg?.refreshStatus === "failed"');
    expect(ga4Page).toContain("Last refreshed");
  });
});
