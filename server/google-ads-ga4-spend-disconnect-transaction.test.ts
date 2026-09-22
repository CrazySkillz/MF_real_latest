import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ga4GoogleAdsSpendConnections,
  ga4GoogleAdsSpendDailyMetrics,
  googleAdsConnections,
  googleAdsDailyMetrics,
  spendRecords,
  spendSources,
} from "@shared/schema";

const mocks = vi.hoisted(() => {
  const original = {
    sources: [
      { id: "google-source", campaignId: "campaign-1", sourceType: "ad_platforms", platformContext: "ga4", displayName: "Google Ads", mappingConfig: JSON.stringify({ platform: "google_ads" }), isActive: true },
      { id: "meta-source", campaignId: "campaign-1", sourceType: "ad_platforms", platformContext: "ga4", displayName: "Meta Ads", mappingConfig: JSON.stringify({ platform: "meta" }), isActive: true },
      { id: "other-google-source", campaignId: "campaign-2", sourceType: "ad_platforms", platformContext: "ga4", displayName: "Google Ads", mappingConfig: JSON.stringify({ platform: "google_ads" }), isActive: true },
    ],
    records: [
      { campaignId: "campaign-1", spendSourceId: "google-source" },
      { campaignId: "campaign-1", spendSourceId: "meta-source" },
      { campaignId: "campaign-2", spendSourceId: "other-google-source" },
    ],
    dedicatedConnections: [{ id: "spend-connection", campaignId: "campaign-1" }, { id: "other-spend-connection", campaignId: "campaign-2" }],
    dedicatedDaily: [{ campaignId: "campaign-1" }, { campaignId: "campaign-2" }],
    mainConnections: [{ id: "main-connection", campaignId: "campaign-1", spendOnly: false }],
    mainDaily: [{ campaignId: "campaign-1" }],
  };
  const state = {
    sources: [] as any[], records: [] as any[], dedicatedConnections: [] as any[], dedicatedDaily: [] as any[],
    mainConnections: [] as any[], mainDaily: [] as any[], failDedicatedConnectionDelete: false,
  };
  const reset = () => {
    state.sources = original.sources.map((row) => ({ ...row }));
    state.records = original.records.map((row) => ({ ...row }));
    state.dedicatedConnections = original.dedicatedConnections.map((row) => ({ ...row }));
    state.dedicatedDaily = original.dedicatedDaily.map((row) => ({ ...row }));
    state.mainConnections = original.mainConnections.map((row) => ({ ...row }));
    state.mainDaily = original.mainDaily.map((row) => ({ ...row }));
    state.failDedicatedConnectionDelete = false;
  };
  reset();

  const tx = {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => ({
        where: vi.fn(async () => {
          if (table === spendSources) return state.sources.filter((row) => row.campaignId === "campaign-1" && row.sourceType === "ad_platforms" && row.isActive && (row.platformContext === "ga4" || row.platformContext == null));
          if (table === ga4GoogleAdsSpendConnections) return state.dedicatedConnections.filter((row) => row.campaignId === "campaign-1");
          if (table === googleAdsConnections) return state.mainConnections.filter((row) => row.campaignId === "campaign-1" && row.spendOnly === true);
          return [];
        }),
      })),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (table !== spendSources) return [];
            const targets = state.sources.filter((row) => row.id === "google-source" && row.campaignId === "campaign-1" && row.isActive);
            state.sources = state.sources.map((row) => targets.some((target) => target.id === row.id) ? { ...row, ...values } : row);
            return targets.map(({ id }) => ({ id }));
          }),
        })),
      })),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        if (table === spendRecords) {
          state.records = state.records.filter((row) => row.campaignId !== "campaign-1" || row.spendSourceId !== "google-source");
          return Promise.resolve({ rowCount: 1 });
        }
        if (table === ga4GoogleAdsSpendDailyMetrics) {
          state.dedicatedDaily = state.dedicatedDaily.filter((row) => row.campaignId !== "campaign-1");
          return Promise.resolve({ rowCount: 1 });
        }
        if (table === googleAdsDailyMetrics) {
          state.mainDaily = state.mainDaily.filter((row) => row.campaignId !== "campaign-1");
          return Promise.resolve({ rowCount: 1 });
        }
        return {
          returning: vi.fn(async () => {
            if (table === ga4GoogleAdsSpendConnections) {
              if (state.failDedicatedConnectionDelete) throw new Error("forced connection delete failure");
              const targets = state.dedicatedConnections.filter((row) => row.campaignId === "campaign-1");
              state.dedicatedConnections = state.dedicatedConnections.filter((row) => row.campaignId !== "campaign-1");
              return targets.map(({ id }) => ({ id }));
            }
            const targets = state.mainConnections.filter((row) => row.campaignId === "campaign-1" && row.spendOnly === true);
            state.mainConnections = state.mainConnections.filter((row) => row.campaignId !== "campaign-1" || row.spendOnly !== true);
            return targets.map(({ id }) => ({ id }));
          }),
        };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const snapshot = JSON.parse(JSON.stringify(state));
    try { return await callback(tx); }
    catch (error) { Object.assign(state, snapshot); throw error; }
  });
  return { original, state, reset, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

describe("GA4 Google Ads Spend disconnect transaction", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.reset(); });

  it("removes only the GA4 Spend source, rows, and dedicated connection", async () => {
    await expect(new DatabaseStorage().disconnectGa4GoogleAdsSpend("campaign-1"))
      .resolves.toEqual({ sourceIds: ["google-source"], connectionRemoved: true });
    expect(mocks.state.sources.find((row) => row.id === "google-source")?.isActive).toBe(false);
    expect(mocks.state.sources.find((row) => row.id === "meta-source")?.isActive).toBe(true);
    expect(mocks.state.sources.find((row) => row.id === "other-google-source")?.isActive).toBe(true);
    expect(mocks.state.records).toEqual([mocks.original.records[1], mocks.original.records[2]]);
    expect(mocks.state.dedicatedConnections).toEqual([mocks.original.dedicatedConnections[1]]);
    expect(mocks.state.dedicatedDaily).toEqual([mocks.original.dedicatedDaily[1]]);
    expect(mocks.state.mainConnections).toEqual(mocks.original.mainConnections);
    expect(mocks.state.mainDaily).toEqual(mocks.original.mainDaily);
  });

  it("rolls back source and daily-row removal if connection deletion fails", async () => {
    mocks.state.failDedicatedConnectionDelete = true;
    await expect(new DatabaseStorage().disconnectGa4GoogleAdsSpend("campaign-1")).rejects.toThrow("forced connection delete failure");
    expect(mocks.state.sources).toEqual(mocks.original.sources);
    expect(mocks.state.records).toEqual(mocks.original.records);
    expect(mocks.state.dedicatedConnections).toEqual(mocks.original.dedicatedConnections);
    expect(mocks.state.dedicatedDaily).toEqual(mocks.original.dedicatedDaily);
    expect(mocks.state.mainConnections).toEqual(mocks.original.mainConnections);
  });

  it("disconnects a saved Spend-only OAuth connection before a source exists", async () => {
    mocks.state.sources = mocks.state.sources.filter((row) => row.id !== "google-source");
    mocks.state.records = mocks.state.records.filter((row) => row.spendSourceId !== "google-source");
    await expect(new DatabaseStorage().disconnectGa4GoogleAdsSpend("campaign-1"))
      .resolves.toEqual({ sourceIds: [], connectionRemoved: true });
    expect(mocks.state.dedicatedConnections).toEqual([mocks.original.dedicatedConnections[1]]);
    expect(mocks.state.mainConnections).toEqual(mocks.original.mainConnections);
  });

  it("clears dedicated daily rows when a disconnected source has already lost its connection", async () => {
    mocks.state.dedicatedConnections = mocks.state.dedicatedConnections.filter((row) => row.campaignId !== "campaign-1");
    await expect(new DatabaseStorage().disconnectGa4GoogleAdsSpend("campaign-1"))
      .resolves.toEqual({ sourceIds: ["google-source"], connectionRemoved: false });
    expect(mocks.state.dedicatedDaily).toEqual([mocks.original.dedicatedDaily[1]]);
    expect(mocks.state.mainConnections).toEqual(mocks.original.mainConnections);
    expect(mocks.state.mainDaily).toEqual(mocks.original.mainDaily);
  });

  it("removes a legacy Spend-only connection without touching another campaign", async () => {
    mocks.state.sources = mocks.state.sources.filter((row) => row.id !== "google-source");
    mocks.state.records = mocks.state.records.filter((row) => row.spendSourceId !== "google-source");
    mocks.state.dedicatedConnections = mocks.state.dedicatedConnections.filter((row) => row.campaignId !== "campaign-1");
    mocks.state.dedicatedDaily = mocks.state.dedicatedDaily.filter((row) => row.campaignId !== "campaign-1");
    mocks.state.mainConnections = [
      { id: "legacy-spend", campaignId: "campaign-1", spendOnly: true },
      { id: "other-main", campaignId: "campaign-2", spendOnly: false },
    ];
    mocks.state.mainDaily = [{ campaignId: "campaign-1" }, { campaignId: "campaign-2" }];
    await expect(new DatabaseStorage().disconnectGa4GoogleAdsSpend("campaign-1"))
      .resolves.toEqual({ sourceIds: [], connectionRemoved: true });
    expect(mocks.state.mainConnections).toEqual([{ id: "other-main", campaignId: "campaign-2", spendOnly: false }]);
    expect(mocks.state.mainDaily).toEqual([{ campaignId: "campaign-2" }]);
  });
});
