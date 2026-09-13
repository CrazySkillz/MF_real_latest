import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: "csv-1", campaignId: "campaign-1", sourceType: "csv", platformContext: "ga4", displayName: "CSV original", isActive: true },
    { id: "sheets-1", campaignId: "campaign-1", sourceType: "google_sheets", platformContext: "ga4", displayName: "Sheets original", isActive: true },
  ];
  const originalRecords = [
    { campaignId: "campaign-1", spendSourceId: "csv-1", spend: "100.00" },
    { campaignId: "campaign-2", spendSourceId: "csv-1", spend: "999.00" },
    { campaignId: "campaign-1", spendSourceId: "sheets-1", spend: "250.00" },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    targetSourceId: "",
    failureStage: null as "source" | "delete" | "records" | null,
  };

  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (state.failureStage === "source") throw new Error("forced spend source update failure");
            const source = state.sources.find((candidate) =>
              candidate.campaignId === "campaign-1" && candidate.sourceType === String(values.sourceType),
            );
            if (!source) return [];
            state.targetSourceId = source.id;
            Object.assign(source, values);
            return [{ ...source }];
          }),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        if (Array.isArray(values)) {
          if (state.failureStage === "records") return Promise.reject(new Error("forced spend record insert failure"));
          state.records.push(...values.map((record) => ({ ...record })));
          return Promise.resolve(values);
        }
        return {
          returning: vi.fn(async () => {
            if (state.failureStage === "source") throw new Error("forced spend source insert failure");
            const source = { id: `new-${state.sources.length + 1}`, ...values };
            state.sources.push(source);
            state.targetSourceId = source.id;
            return [{ ...source }];
          }),
        };
      }),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === "delete") throw new Error("forced spend record delete failure");
        state.records = state.records.filter((record) =>
          record.campaignId !== "campaign-1" || record.spendSourceId !== state.targetSourceId,
        );
        return { rowCount: 1 };
      }),
    })),
  };

  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const sourcesBefore = state.sources.map((source) => ({ ...source }));
    const recordsBefore = state.records.map((record) => ({ ...record }));
    const targetBefore = state.targetSourceId;
    try {
      return await callback(tx);
    } catch (error) {
      state.sources = sourcesBefore;
      state.records = recordsBefore;
      state.targetSourceId = targetBefore;
      throw error;
    }
  });

  return { originalSources, originalRecords, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

describe("GA4 Overview Spend atomic replacement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.targetSourceId = "";
    mocks.state.failureStage = null;
  });

  it("edits CSV in place and replaces only same-campaign records", async () => {
    const storage = new DatabaseStorage();
    const source = await storage.replaceCsvSpendSourceWithRecords(
      "campaign-1",
      "csv-1",
      { campaignId: "campaign-1", sourceType: "csv", platformContext: "ga4", displayName: "CSV updated", currency: "USD" } as any,
      [{ campaignId: "campaign-1", date: "2026-09-01", spend: "150.00", currency: "USD", sourceType: "csv" } as any],
    );

    expect(source.id).toBe("csv-1");
    expect(mocks.state.sources).toHaveLength(2);
    expect(mocks.state.records).toEqual([
      mocks.originalRecords[1],
      mocks.originalRecords[2],
      { campaignId: "campaign-1", spendSourceId: "csv-1", date: "2026-09-01", spend: "150.00", currency: "USD", sourceType: "csv" },
    ]);
  });

  it("rolls CSV metadata and last-good records back when insertion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "records";

    await expect(storage.replaceCsvSpendSourceWithRecords(
      "campaign-1",
      "csv-1",
      { campaignId: "campaign-1", sourceType: "csv", platformContext: "ga4", displayName: "CSV failed", currency: "USD" } as any,
      [{ campaignId: "campaign-1", date: "2026-09-01", spend: "150.00", currency: "USD", sourceType: "csv" } as any],
    )).rejects.toThrow("forced spend record insert failure");

    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("edits Google Sheets in place and rolls last-good data back on insertion failure", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "records";

    await expect(storage.replaceSpendSourceWithRecords(
      "campaign-1",
      "sheets-1",
      "google_sheets",
      "ga4",
      { campaignId: "campaign-1", sourceType: "google_sheets", platformContext: "ga4", displayName: "Sheets updated", currency: "USD" } as any,
      [{ campaignId: "campaign-1", date: "2026-09-01", spend: "300.00", currency: "USD", sourceType: "google_sheets" } as any],
    )).rejects.toThrow("forced spend record insert failure");

    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("does not retain a newly added Google Sheets source when record insertion fails", async () => {
    const storage = new DatabaseStorage();
    mocks.state.failureStage = "records";

    await expect(storage.replaceSpendSourceWithRecords(
      "campaign-1",
      null,
      "google_sheets",
      "ga4",
      { campaignId: "campaign-1", sourceType: "google_sheets", platformContext: "ga4", displayName: "Sheets new", currency: "USD" } as any,
      [{ campaignId: "campaign-1", date: "2026-09-01", spend: "300.00", currency: "USD", sourceType: "google_sheets" } as any],
    )).rejects.toThrow("forced spend record insert failure");

    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
