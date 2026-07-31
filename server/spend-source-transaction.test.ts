import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: "source-1", campaignId: "campaign-1", sourceType: "ad_platforms", platformContext: null, isActive: true },
    { id: "source-2", campaignId: "campaign-1", sourceType: "csv", platformContext: "ga4", isActive: true },
  ];
  const originalRecords = [
    { campaignId: "campaign-1", spendSourceId: "source-1", spend: "100.00" },
    { campaignId: "campaign-2", spendSourceId: "source-1", spend: "999.00" },
    { campaignId: "campaign-1", spendSourceId: "source-2", spend: "250.00" },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    failureStage: null as "delete" | "insert" | null,
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            state.sources[0] = { ...state.sources[0], ...values };
            return [{ id: "source-1" }];
          }),
        })),
      })),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: "source-1" }]) })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === "delete") throw new Error("forced spend record delete failure");
        state.records = state.records.filter((record) => (
          record.spendSourceId !== "source-1" || record.campaignId !== "campaign-1"
        ));
        return { rowCount: 1 };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (values: any[]) => {
        if (state.failureStage === "insert") throw new Error("forced spend record insert failure");
        state.records.push(...values);
        return values;
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const sourcesBefore = state.sources.map((source) => ({ ...source }));
    const recordsBefore = state.records.map((record) => ({ ...record }));
    try {
      return await callback(tx);
    } catch (error) {
      state.sources = sourcesBefore;
      state.records = recordsBefore;
      throw error;
    }
  });
  return { originalSources, originalRecords, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

describe("spend source transactions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.failureStage = null;
  });

  it("deactivates the exact source and deletes only its campaign-scoped records", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.deleteSpendSourceWithRecords("campaign-1", "source-1", "ga4")).resolves.toBe(true);
    expect(mocks.state.sources[0].isActive).toBe(false);
    expect(mocks.state.records).toEqual([mocks.originalRecords[1], mocks.originalRecords[2]]);
  });

  it("rolls source deactivation back when record deletion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "delete";
    await expect(storage.deleteSpendSourceWithRecords("campaign-1", "source-1", "ga4"))
      .rejects.toThrow("forced spend record delete failure");
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("atomically replaces only the exact source records without changing source metadata", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.replaceSpendRecordsForSource("campaign-1", "source-1", "ad_platforms", "ga4", [
      { campaignId: "campaign-1", date: "2026-07-31", spend: "125.00", currency: "USD", sourceType: "ad_platforms" },
    ])).resolves.toBeUndefined();
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual([
      mocks.originalRecords[1],
      mocks.originalRecords[2],
      { campaignId: "campaign-1", spendSourceId: "source-1", date: "2026-07-31", spend: "125.00", currency: "USD", sourceType: "ad_platforms" },
    ]);
  });

  it("retains last-good records when replacement insertion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "insert";
    await expect(storage.replaceSpendRecordsForSource("campaign-1", "source-1", "ad_platforms", "ga4", [
      { campaignId: "campaign-1", date: "2026-07-31", spend: "125.00", currency: "USD", sourceType: "ad_platforms" },
    ])).rejects.toThrow("forced spend record insert failure");
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
