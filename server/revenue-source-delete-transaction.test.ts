import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: "source-1", campaignId: "campaign-1", platformContext: "ga4", isActive: true },
    { id: "source-2", campaignId: "campaign-1", platformContext: "ga4", isActive: true },
  ];
  const originalRecords = [
    { campaignId: "campaign-1", revenueSourceId: "source-1", revenue: "100.00" },
    { campaignId: "campaign-2", revenueSourceId: "source-1", revenue: "999.00" },
    { campaignId: "campaign-1", revenueSourceId: "source-2", revenue: "250.00" },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    failureStage: null as "source" | "records" | null,
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (state.failureStage === "source") throw new Error("forced source deactivation failure");
            state.sources[0] = { ...state.sources[0], ...values };
            return [{ id: "source-1" }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === "records") throw new Error("forced revenue record delete failure");
        state.records = state.records.filter((record) => (
          record.revenueSourceId !== "source-1" || record.campaignId !== "campaign-1"
        ));
        return { rowCount: 1 };
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

describe("revenue source delete transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.failureStage = null;
  });

  it("deactivates the exact source and deletes only its campaign-scoped records", async () => {
    const storage = new DatabaseStorage();
    await expect(storage.deleteRevenueSourceWithRecords("campaign-1", "source-1", "ga4")).resolves.toBe(true);

    expect(mocks.state.sources).toEqual([
      { ...mocks.originalSources[0], isActive: false },
      mocks.originalSources[1],
    ]);
    expect(mocks.state.records).toEqual([
      mocks.originalRecords[1],
      mocks.originalRecords[2],
    ]);
  });

  it("rolls source deactivation back when record deletion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "records";

    await expect(storage.deleteRevenueSourceWithRecords("campaign-1", "source-1", "ga4"))
      .rejects.toThrow("forced revenue record delete failure");
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("does not touch records when source deactivation fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "source";

    await expect(storage.deleteRevenueSourceWithRecords("campaign-1", "source-1", "ga4"))
      .rejects.toThrow("forced source deactivation failure");
    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
