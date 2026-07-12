import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalSource = {
    id: "source-1",
    campaignId: "campaign-1",
    sourceType: "csv",
    platformContext: "ga4",
    displayName: "Original CSV",
    mappingConfig: '{"version":"original"}',
    isActive: true,
  };
  const originalRecords = [{
    campaignId: "campaign-1",
    revenueSourceId: "source-1",
    date: "2026-07-01",
    revenue: "100.00",
    currency: "USD",
  }];
  const state = {
    source: { ...originalSource },
    records: originalRecords.map((record) => ({ ...record })),
    createdSource: null as any,
    failureStage: "records" as "source" | "delete" | "records",
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (state.failureStage === "source") throw new Error("forced source update failure");
            state.source = { ...state.source, ...values };
            return [{ ...state.source }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === "delete") throw new Error("forced revenue record delete failure");
        state.records = [];
        return { rowCount: 1 };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        if (Array.isArray(values) && state.failureStage === "records") {
          return Promise.reject(new Error("forced revenue record insert failure"));
        }
        return {
          returning: vi.fn(async () => {
            state.createdSource = { id: "source-new", ...values };
            return [{ ...state.createdSource }];
          }),
        };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const sourceBefore = { ...state.source };
    const recordsBefore = state.records.map((record) => ({ ...record }));
    const createdSourceBefore = state.createdSource;
    try {
      return await callback(tx);
    } catch (error) {
      state.source = sourceBefore;
      state.records = recordsBefore;
      state.createdSource = createdSourceBefore;
      throw error;
    }
  });
  return { originalSource, originalRecords, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

describe("GA4 CSV revenue transaction rollback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.source = { ...mocks.originalSource };
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.createdSource = null;
    mocks.state.failureStage = "records";
  });

  it("retains the last valid source metadata and records when replacement insertion fails", async () => {
    const storage = new DatabaseStorage();

    await expect(storage.replaceGa4CsvRevenueSourceWithRecords(
      "campaign-1",
      "source-1",
      {
        campaignId: "campaign-1",
        sourceType: "csv",
        platformContext: "ga4",
        displayName: "Updated CSV",
        mappingConfig: '{"version":"updated"}',
        isActive: true,
      } as any,
      [{
        campaignId: "campaign-1",
        date: "2026-07-02",
        revenue: "250.00",
        currency: "USD",
      } as any],
    )).rejects.toThrow("forced revenue record insert failure");

    expect(mocks.tx.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.delete).toHaveBeenCalledTimes(1);
    expect(mocks.tx.insert).toHaveBeenCalledTimes(1);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("does not retain a newly created source when its record insertion fails", async () => {
    const storage = new DatabaseStorage();

    await expect(storage.replaceGa4CsvRevenueSourceWithRecords(
      "campaign-1",
      null,
      {
        campaignId: "campaign-1",
        sourceType: "csv",
        platformContext: "ga4",
        displayName: "New CSV",
        mappingConfig: '{"version":"new"}',
        isActive: true,
      } as any,
      [{
        campaignId: "campaign-1",
        date: "2026-07-02",
        revenue: "250.00",
        currency: "USD",
      } as any],
    )).rejects.toThrow("forced revenue record insert failure");

    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.insert).toHaveBeenCalledTimes(2);
    expect(mocks.state.createdSource).toBeNull();
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("does not delete records when the source update fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "source";

    await expect(storage.replaceGa4CsvRevenueSourceWithRecords(
      "campaign-1",
      "source-1",
      { ...mocks.originalSource, displayName: "Updated CSV" } as any,
      [{ campaignId: "campaign-1", date: "2026-07-02", revenue: "250.00", currency: "USD" } as any],
    )).rejects.toThrow("forced source update failure");

    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.tx.insert).not.toHaveBeenCalled();
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("restores source metadata when old-record deletion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "delete";

    await expect(storage.replaceGa4CsvRevenueSourceWithRecords(
      "campaign-1",
      "source-1",
      { ...mocks.originalSource, displayName: "Updated CSV" } as any,
      [{ campaignId: "campaign-1", date: "2026-07-02", revenue: "250.00", currency: "USD" } as any],
    )).rejects.toThrow("forced revenue record delete failure");

    expect(mocks.tx.update).toHaveBeenCalledTimes(1);
    expect(mocks.tx.insert).not.toHaveBeenCalled();
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
