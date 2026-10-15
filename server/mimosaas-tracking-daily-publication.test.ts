import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it, vi } from "vitest";
import {
  isMimosaasTrackingDailyPublicationEnabled,
  publishMimosaasTrackingCompletedDay,
} from "./mimosaas-tracking-daily-publication";
import { buildMimosaasTrackingDailySnapshot } from "./utils/mimosaas-tracking-daily-publication";

const campaignId = "campaign-1";
const reportingDate = "2026-10-14";
const reportingTimeZone = "Europe/Amsterdam";
const metrics = {
  id: "daily-metric-1",
  campaignId,
  reportingDate,
  reportingTimeZone,
  users: 3,
  sessions: 4,
  engagedSessions: 3,
  pageviews: 7,
  conversions: 1,
  createdAt: new Date("2026-10-15T06:00:00.000Z"),
  updatedAt: new Date("2026-10-15T06:00:00.000Z"),
} as any;

const financialSnapshot = (overrides: Record<string, unknown> = {}) => ({
  id: "financial-1",
  campaignId,
  reportingDate,
  snapshotType: "financial_daily",
  metrics: {
    financialDaily: {
      version: "financial_daily_snapshot_v1",
      currency: "EUR",
      currentValueWindow: {
        mode: "initial_import_to_latest_completed_day",
        startDate: reportingDate,
        endDate: reportingDate,
        dataThroughDate: reportingDate,
        reportingTimeZone,
      },
      inputs: {
        revenue: { value: "125.50", available: true, sources: ["revenue-source:revenue-1"] },
        spend: { value: "25.00", available: true, sources: ["spend-source:spend-1"] },
        conversions: { value: 1, available: true, sources: ["mimosaas_tracking"] },
      },
      ...overrides,
    },
  },
} as any);

describe("Mimosaas Tracking daily publication", () => {
  const enabledEnv = {
    MIMOSAAS_TRACKING_ENABLED: "true",
    MIMOSAAS_TRACKING_INGESTION_ENABLED: "true",
    MIMOSAAS_TRACKING_DAILY_AGGREGATION_ENABLED: "true",
    MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED: "true",
  } as NodeJS.ProcessEnv;

  it("requires its own publication flag in addition to every earlier tracker gate", () => {
    expect(isMimosaasTrackingDailyPublicationEnabled({} as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailyPublicationEnabled({
      ...enabledEnv,
      MIMOSAAS_TRACKING_DAILY_PUBLICATION_ENABLED: "false",
    } as NodeJS.ProcessEnv)).toBe(false);
    expect(isMimosaasTrackingDailyPublicationEnabled(enabledEnv)).toBe(true);
  });

  it("performs no storage work while disabled and delegates exact scope when enabled", async () => {
    const store = { publishMimosaasTrackingDailySnapshot: vi.fn().mockResolvedValue({ status: "published", reasons: [] }) };
    const now = new Date("2026-10-15T08:00:00.000Z");

    await expect(publishMimosaasTrackingCompletedDay(
      "owner-1", "client-1", campaignId, reportingDate, store as any, {} as NodeJS.ProcessEnv, now,
    )).resolves.toEqual({ skipped: true, reason: "disabled" });
    expect(store.publishMimosaasTrackingDailySnapshot).not.toHaveBeenCalled();

    await expect(publishMimosaasTrackingCompletedDay(
      "owner-1", "client-1", campaignId, reportingDate, store as any, enabledEnv, now,
    )).resolves.toEqual({ skipped: false, result: { status: "published", reasons: [] } });
    expect(store.publishMimosaasTrackingDailySnapshot).toHaveBeenCalledWith(
      "owner-1", "client-1", campaignId, reportingDate, now,
    );
  });

  it("publishes website metrics with both financial values explicitly unavailable when no sources exist", () => {
    const result = buildMimosaasTrackingDailySnapshot({
      campaignId,
      reportingDate,
      reportingTimeZone,
      currency: "eur",
      metrics,
      revenueSources: [],
      spendSources: [],
      financialSnapshot: null,
    });

    expect(result).toEqual({
      ready: true,
      values: expect.objectContaining({
        engagementRate: "75.0000",
        conversionRate: "25.0000",
        revenue: null,
        spend: null,
        currency: "EUR",
        revenueStatus: "unavailable",
        spendStatus: "unavailable",
        financialSnapshotId: null,
        sourceStates: {
          version: "mimosaas_tracking_publication_sources_v1",
          websiteMetrics: { status: "available", dailyMetricId: "daily-metric-1" },
          revenue: { status: "unavailable", sourceIds: [] },
          spend: { status: "unavailable", sourceIds: [] },
          financialSnapshot: { status: "not_required", id: null },
        },
      }),
    });
  });

  it("publishes only an exact-date tracker-authoritative financial snapshot with the full source set", () => {
    const result = buildMimosaasTrackingDailySnapshot({
      campaignId,
      reportingDate,
      reportingTimeZone,
      currency: "EUR",
      metrics,
      revenueSources: [{ id: "revenue-1", currency: "EUR" }],
      spendSources: [{ id: "spend-1", currency: "EUR" }],
      financialSnapshot: financialSnapshot(),
    });

    expect(result).toEqual({
      ready: true,
      values: expect.objectContaining({
        revenue: "125.50",
        spend: "25.00",
        revenueStatus: "available",
        spendStatus: "available",
        financialSnapshotId: "financial-1",
        sourceStates: expect.objectContaining({
          revenue: { status: "available", sourceIds: ["revenue-1"] },
          spend: { status: "available", sourceIds: ["spend-1"] },
        }),
      }),
    });
  });

  it("keeps the day pending when website metrics or configured financial data is missing", () => {
    const missingMetrics = buildMimosaasTrackingDailySnapshot({
      campaignId, reportingDate, reportingTimeZone, currency: "EUR", metrics: null,
      revenueSources: [], spendSources: [], financialSnapshot: null,
    });
    expect(missingMetrics).toMatchObject({ ready: false, reasons: ["website_metrics_pending"] });

    const missingFinancial = buildMimosaasTrackingDailySnapshot({
      campaignId, reportingDate, reportingTimeZone, currency: "EUR", metrics,
      revenueSources: [{ id: "revenue-1", currency: "EUR" }], spendSources: [], financialSnapshot: null,
    });
    expect(missingFinancial).toMatchObject({
      ready: false,
      reasons: ["financial_snapshot_pending"],
      sourceStates: {
        revenue: { status: "pending", sourceIds: ["revenue-1"] },
      },
    });
  });

  it("rejects GA4 provenance, omitted sources, scope mismatches, and source currency mismatches", () => {
    const build = (snapshot: any, revenueSources = [{ id: "revenue-1", currency: "EUR" }]) =>
      buildMimosaasTrackingDailySnapshot({
        campaignId, reportingDate, reportingTimeZone, currency: "EUR", metrics,
        revenueSources, spendSources: [{ id: "spend-1", currency: "EUR" }], financialSnapshot: snapshot,
      });
    expect(build(financialSnapshot({
      inputs: {
        revenue: { value: "125.50", available: true, sources: ["ga4", "revenue-source:revenue-1"] },
        spend: { value: "25.00", available: true, sources: ["spend-source:spend-1"] },
        conversions: { value: 1, available: true, sources: ["ga4"] },
      },
    }))).toMatchObject({ ready: false, reasons: expect.arrayContaining(["revenue_snapshot_sources_mismatch", "conversion_snapshot_authority_mismatch"]) });
    expect(build(financialSnapshot(), [
      { id: "revenue-1", currency: "EUR" },
      { id: "revenue-2", currency: "EUR" },
    ])).toMatchObject({ ready: false, reasons: expect.arrayContaining(["revenue_snapshot_sources_mismatch"]) });
    expect(build(financialSnapshot({ currency: "USD" }))).toMatchObject({ ready: false, reasons: expect.arrayContaining(["financial_snapshot_scope_mismatch"]) });
    expect(build(financialSnapshot({
      currentValueWindow: {
        mode: "initial_import_to_latest_completed_day",
        startDate: "2026-10-01",
        endDate: reportingDate,
        dataThroughDate: reportingDate,
        reportingTimeZone,
      },
    }))).toMatchObject({ ready: false, reasons: expect.arrayContaining(["financial_snapshot_scope_mismatch"]) });
    expect(build(financialSnapshot(), [{ id: "revenue-1", currency: "USD" }])).toMatchObject({ ready: false, reasons: expect.arrayContaining(["financial_source_currency_mismatch"]) });
  });

  it("uses zero rates for zero sessions and rejects a value that cannot fit the immutable rate column", () => {
    const zero = buildMimosaasTrackingDailySnapshot({
      campaignId, reportingDate, reportingTimeZone, currency: "EUR",
      metrics: { ...metrics, users: 0, sessions: 0, engagedSessions: 0, pageviews: 0, conversions: 0 },
      revenueSources: [], spendSources: [], financialSnapshot: null,
    });
    expect(zero).toMatchObject({ ready: true, values: { engagementRate: "0.0000", conversionRate: "0.0000" } });

    const overflow = buildMimosaasTrackingDailySnapshot({
      campaignId, reportingDate, reportingTimeZone, currency: "EUR",
      metrics: { ...metrics, sessions: 1, engagedSessions: 1, conversions: 10 },
      revenueSources: [], spendSources: [], financialSnapshot: null,
    });
    expect(overflow).toMatchObject({ ready: false, reasons: ["conversion_rate_out_of_range"] });
  });

  it("keeps publication atomic, immutable, scoped, and disconnected from schedulers and UI", () => {
    const storage = readFileSync(join(process.cwd(), "server", "storage.ts"), "utf8");
    const methodStart = storage.indexOf("async publishMimosaasTrackingDailySnapshot(");
    const methodEnd = storage.indexOf("// Metrics methods", methodStart);
    const method = storage.slice(methodStart, methodEnd);
    const index = readFileSync(join(process.cwd(), "server", "index.ts"), "utf8");
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");

    expect(method).toContain("return db.transaction(async (tx: any) =>");
    expect(method).toContain('eq(campaigns.ownerId, ownerId)');
    expect(method).toContain('eq(campaigns.clientId, clientId)');
    expect(method).toContain('eq(campaigns.platform, "mimosaas-tracking")');
    expect(method).toContain('eq(revenueSources.platformContext, "mimosaas_tracking")');
    expect(method).toContain('eq(spendSources.platformContext, "mimosaas_tracking")');
    expect(method).toContain('eq(metricSnapshots.reportingDate, reportingDate)');
    expect(method).toContain("onConflictDoNothing");
    expect(method).toContain('status: "finalized"');
    expect(method).not.toContain("update(mimosaasTrackingDailySnapshots)");
    expect(index).not.toContain("publishMimosaasTrackingCompletedDay");
    expect(routes).not.toContain("publishMimosaasTrackingCompletedDay");
  });
});
