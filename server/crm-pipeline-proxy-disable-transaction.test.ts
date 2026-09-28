import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const originalMapping = JSON.stringify({
    platformContext: "ga4",
    selectedValues: ["Acme"],
    campaignValueRevenueTotals: [{ campaignValue: "Acme", revenue: 75 }],
    pipelineEnabled: true,
    pipelineStageLabel: "Prospecting",
    pipelineTotalToDate: 251,
  });
  const originalSource = { id: "source-1", campaignId: "campaign-1", mappingConfig: originalMapping };
  const originalConnection = { id: "connection-1", campaignId: "campaign-1", mappingConfig: originalMapping };
  const originalRecords = [{ campaignId: "campaign-1", revenueSourceId: "source-1", revenue: "75.00" }];
  const state = {
    source: { ...originalSource },
    connection: { ...originalConnection },
    records: originalRecords.map((record) => ({ ...record })),
    updateCall: 0,
    failureStage: null as "source_changed" | "connection_changed" | null,
  };
  const tx = {
    update: vi.fn(() => {
      state.updateCall += 1;
      const updateCall = state.updateCall;
      return {
        set: vi.fn((values: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (updateCall === 1) {
                if (state.failureStage === "source_changed") return [];
                state.source = { ...state.source, ...values };
                return [{ ...state.source }];
              }
              if (state.failureStage === "connection_changed") return [];
              state.connection = { ...state.connection, ...values };
              return [{ id: state.connection.id }];
            }),
          })),
        })),
      };
    }),
    delete: vi.fn(),
    insert: vi.fn(),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = {
      source: { ...state.source },
      connection: { ...state.connection },
      records: state.records.map((record) => ({ ...record })),
    };
    state.updateCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      state.source = before.source;
      state.connection = before.connection;
      state.records = before.records;
      throw error;
    }
  });
  return { originalMapping, originalSource, originalConnection, originalRecords, state, tx, db: { transaction } };
});

vi.mock("./db", () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from "./storage";

describe("GA4 CRM Pipeline Proxy disable transaction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.source = { ...mocks.originalSource };
    mocks.state.connection = { ...mocks.originalConnection };
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.failureStage = null;
  });

  const disable = (sourceType: "salesforce" | "hubspot", nextMapping: string) => (
    new DatabaseStorage().disableGa4CrmPipelineProxy(
      "campaign-1",
      "source-1",
      sourceType,
      nextMapping,
      mocks.originalMapping,
      { connectionId: "connection-1", nextMappingConfig: nextMapping, expectedMappingConfig: mocks.originalMapping },
    )
  );

  it.each(["salesforce", "hubspot"] as const)("disables only %s Pipeline Proxy and preserves confirmed revenue records", async (sourceType) => {
    const nextMapping = JSON.stringify({
      ...JSON.parse(mocks.originalMapping),
      pipelineEnabled: false,
      pipelineStageLabel: null,
      pipelineTotalToDate: 0,
      pipelineValueRevenueTotals: [],
    });

    await expect(disable(sourceType, nextMapping)).resolves.toMatchObject({ id: "source-1", mappingConfig: nextMapping });

    expect(mocks.state.source.mappingConfig).toBe(nextMapping);
    expect(mocks.state.connection.mappingConfig).toBe(nextMapping);
    expect(JSON.parse(mocks.state.source.mappingConfig).campaignValueRevenueTotals).toEqual([{ campaignValue: "Acme", revenue: 75 }]);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.tx.insert).not.toHaveBeenCalled();
  });

  it("fails closed before touching the connection when the exact source changed", async () => {
    mocks.state.failureStage = "source_changed";
    await expect(disable("salesforce", '{"pipelineEnabled":false}')).rejects.toMatchObject({
      code: "CRM_PIPELINE_PROXY_SOURCE_CHANGED",
    });

    expect(mocks.tx.update).toHaveBeenCalledTimes(1);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it("rolls back the source update when the matching CRM connection changed", async () => {
    mocks.state.failureStage = "connection_changed";
    await expect(disable("hubspot", '{"pipelineEnabled":false}')).rejects.toMatchObject({
      code: "CRM_PIPELINE_PROXY_CONNECTION_CHANGED",
    });

    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
