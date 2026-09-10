import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalMapping = '{"selectedValues":["Acme","Delta"]}';
  const originalConnection = { id: "connection-1", campaignId: "campaign-1", mappingConfig: originalMapping, isActive: true };
  const originalSource = { id: "source-1", campaignId: "campaign-1", sourceType: "salesforce", platformContext: "ga4", displayName: "Salesforce (Opportunities)", mappingConfig: originalMapping, isActive: true };
  const originalRecords = [{ campaignId: "campaign-1", revenueSourceId: "source-1", date: "2026-09-10", revenue: "250.00", currency: "USD", sourceType: "salesforce" }];
  const state = {
    connection: { ...originalConnection },
    source: { ...originalSource },
    records: originalRecords.map((record) => ({ ...record })),
    failureStage: "source_changed" as "source_changed" | "records" | null,
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (Object.prototype.hasOwnProperty.call(values, "displayName")) {
              if (state.failureStage === "source_changed") return [];
              state.source = { ...state.source, ...values };
              return [{ ...state.source }];
            }
            state.connection = { ...state.connection, ...values };
            return [{ id: state.connection.id }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        state.records = [];
        return { rowCount: 1 };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any[]) => {
        if (state.failureStage === "records") return Promise.reject(new Error("forced Salesforce record insert failure"));
        state.records = values.map((record) => ({ ...record }));
        return Promise.resolve({ rowCount: values.length });
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = {
      connection: { ...state.connection },
      source: { ...state.source },
      records: state.records.map((record) => ({ ...record })),
    };
    try {
      return await callback(tx);
    } catch (error) {
      state.connection = before.connection;
      state.source = before.source;
      state.records = before.records;
      throw error;
    }
  });
  return { originalMapping, originalConnection, originalSource, originalRecords, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

const nextMapping = '{"selectedValues":["Delta"]}';
const replace = () => new DatabaseStorage().replaceGa4SalesforceRevenueSourceWithRecords(
  "campaign-1",
  "source-1",
  "connection-1",
  nextMapping,
  {
    campaignId: "campaign-1",
    sourceType: "salesforce",
    platformContext: "ga4",
    displayName: "Salesforce (Opportunities)",
    mappingConfig: nextMapping,
    isActive: true,
  } as any,
  [{ campaignId: "campaign-1", date: "2026-09-10", revenue: "200.00", currency: "USD", sourceType: "salesforce" }] as any,
  mocks.originalMapping,
);

describe("Salesforce item removal transaction safety", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.connection = { ...mocks.originalConnection };
    mocks.state.source = { ...mocks.originalSource };
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.failureStage = "source_changed";
  });

  it("fails closed before touching records when a concurrent refresh changed the source", async () => {
    await expect(replace()).rejects.toMatchObject({
      code: "SALESFORCE_REVENUE_SOURCE_CHANGED",
      message: "Salesforce revenue source changed. Refresh and try again.",
    });

    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.tx.insert).not.toHaveBeenCalled();
    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("commits the reduced source, connection, and materialized records together", async () => {
    mocks.state.failureStage = null;
    await expect(replace()).resolves.toMatchObject({ id: "source-1", mappingConfig: nextMapping });

    expect(mocks.state.connection.mappingConfig).toBe(nextMapping);
    expect(mocks.state.source.mappingConfig).toBe(nextMapping);
    expect(mocks.state.records).toEqual([expect.objectContaining({
      campaignId: "campaign-1",
      revenueSourceId: "source-1",
      revenue: "200.00",
      sourceType: "salesforce",
    })]);
  });

  it("rolls back source metadata when replacement record insertion fails", async () => {
    mocks.state.failureStage = "records";
    await expect(replace()).rejects.toThrow("forced Salesforce record insert failure");

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
