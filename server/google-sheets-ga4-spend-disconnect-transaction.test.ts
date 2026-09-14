import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: 'spend-1', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: 'ga4', mappingConfig: JSON.stringify({ connectionId: 'connection-1' }), isActive: true },
    { id: 'spend-2', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: null, mappingConfig: JSON.stringify({ connectionId: 'revenue-shared-connection' }), isActive: true },
    { id: 'spend-general', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: 'ga4', mappingConfig: JSON.stringify({ connectionId: 'general-purpose-connection' }), isActive: true },
    { id: 'other-scope-spend', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: 'linkedin', mappingConfig: JSON.stringify({ connectionId: 'scope-shared-connection' }), isActive: true },
    { id: 'other-campaign-spend', campaignId: 'campaign-2', sourceType: 'google_sheets', platformContext: 'ga4', mappingConfig: JSON.stringify({ connectionId: 'other-campaign-connection' }), isActive: true },
  ];
  const originalRecords = [
    { campaignId: 'campaign-1', spendSourceId: 'spend-1', spend: '100.00' },
    { campaignId: 'campaign-1', spendSourceId: 'spend-2', spend: '250.00' },
    { campaignId: 'campaign-1', spendSourceId: 'other-scope-spend', spend: '400.00' },
    { campaignId: 'campaign-2', spendSourceId: 'spend-1', spend: '999.00' },
  ];
  const originalRevenueSources = [
    { campaignId: 'campaign-1', sourceType: 'google_sheets', mappingConfig: JSON.stringify({ connectionId: 'revenue-shared-connection' }), isActive: true },
    { campaignId: 'campaign-2', sourceType: 'google_sheets', mappingConfig: JSON.stringify({ connectionId: 'other-campaign-connection' }), isActive: true },
  ];
  const originalConnections = [
    { id: 'connection-1', campaignId: 'campaign-1', purpose: 'spend', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'revenue-shared-connection', campaignId: 'campaign-1', purpose: 'spend', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'scope-shared-connection', campaignId: 'campaign-1', purpose: 'spend', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'orphan-spend-connection', campaignId: 'campaign-1', purpose: 'spend', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'general-purpose-connection', campaignId: 'campaign-1', purpose: 'general', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'main-connection', campaignId: 'campaign-1', purpose: 'general', isPrimary: true, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'other-campaign-connection', campaignId: 'campaign-2', purpose: 'spend', isPrimary: true, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    revenueSources: originalRevenueSources.map((source) => ({ ...source })),
    connections: originalConnections.map((connection) => ({ ...connection })),
    failureStage: null as 'source' | 'records' | 'connection' | null,
    selectCall: 0,
    updateCall: 0,
  };
  const connectionId = (row: any) => {
    try { return String(JSON.parse(String(row?.mappingConfig || '{}'))?.connectionId || ''); } catch { return ''; }
  };
  const tx = {
    select: vi.fn(() => {
      state.selectCall += 1;
      const call = state.selectCall;
      return {
        from: vi.fn(() => ({
          where: vi.fn(async () => {
            if (call === 1) return state.sources.filter((source) => source.campaignId === 'campaign-1' && source.sourceType === 'google_sheets' && source.isActive);
            if (call === 2) return state.revenueSources.filter((source) => source.campaignId === 'campaign-1' && source.sourceType === 'google_sheets' && source.isActive);
            return state.connections.filter((connection) => connection.campaignId === 'campaign-1' && connection.isActive);
          }),
        })),
      };
    }),
    update: vi.fn(() => {
      state.updateCall += 1;
      const call = state.updateCall;
      return {
        set: vi.fn((values: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (call === 1) {
                if (state.failureStage === 'source') throw new Error('forced Spend source deactivation failure');
                const targets = state.sources.filter((source) => source.campaignId === 'campaign-1' && source.sourceType === 'google_sheets' && source.isActive && (source.platformContext === 'ga4' || source.platformContext === null));
                state.sources = state.sources.map((source) => targets.some((target) => target.id === source.id) ? { ...source, ...values } : source);
                return targets.map(({ id }) => ({ id }));
              }
              if (state.failureStage === 'connection') throw new Error('forced Spend connection deactivation failure');
              const sharedSpendIds = new Set(state.sources.filter((source) => source.campaignId === 'campaign-1' && source.isActive).map(connectionId).filter(Boolean));
              const sharedRevenueIds = new Set(state.revenueSources.filter((source) => source.campaignId === 'campaign-1' && source.isActive).map(connectionId).filter(Boolean));
              const targets = state.connections.filter((connection) => connection.campaignId === 'campaign-1' && connection.isActive && connection.purpose === 'spend' && !sharedSpendIds.has(connection.id) && !sharedRevenueIds.has(connection.id));
              state.connections = state.connections.map((connection) => targets.some((target) => target.id === connection.id) ? { ...connection, ...values } : connection);
              return targets.map(({ id }) => ({ id }));
            }),
          })),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'records') throw new Error('forced Spend record delete failure');
        state.records = state.records.filter((record) => record.campaignId !== 'campaign-1' || !['spend-1', 'spend-2', 'spend-general'].includes(record.spendSourceId));
        return { rowCount: 2 };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const snapshot = {
      sources: state.sources.map((source) => ({ ...source })),
      records: state.records.map((record) => ({ ...record })),
      connections: state.connections.map((connection) => ({ ...connection })),
    };
    state.selectCall = 0;
    state.updateCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      state.sources = snapshot.sources;
      state.records = snapshot.records;
      state.connections = snapshot.connections;
      throw error;
    }
  });
  return { originalSources, originalRecords, originalRevenueSources, originalConnections, state, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

describe('GA4 Google Sheets Spend atomic disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.revenueSources = mocks.originalRevenueSources.map((source) => ({ ...source }));
    mocks.state.connections = mocks.originalConnections.map((connection) => ({ ...connection }));
    mocks.state.failureStage = null;
  });

  const disconnect = () => new DatabaseStorage().disconnectGa4GoogleSheetsSpend('campaign-1');

  it('removes every GA4 Sheets Spend source and unused connection while preserving other scopes and Revenue', async () => {
    await expect(disconnect()).resolves.toEqual({ sourceIds: ['spend-1', 'spend-2', 'spend-general'], connectionIds: ['connection-1', 'orphan-spend-connection'] });
    expect(mocks.state.sources.map(({ id, isActive }) => ({ id, isActive }))).toEqual([
      { id: 'spend-1', isActive: false },
      { id: 'spend-2', isActive: false },
      { id: 'spend-general', isActive: false },
      { id: 'other-scope-spend', isActive: true },
      { id: 'other-campaign-spend', isActive: true },
    ]);
    expect(mocks.state.records).toEqual([mocks.originalRecords[2], mocks.originalRecords[3]]);
    expect(mocks.state.connections[0]).toMatchObject({ isActive: false, isPrimary: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null });
    expect(mocks.state.connections[1]).toEqual(mocks.originalConnections[1]);
    expect(mocks.state.connections[2]).toEqual(mocks.originalConnections[2]);
    expect(mocks.state.connections[3]).toMatchObject({ isActive: false, isPrimary: false, columnMappings: null, cachedData: null, lastDataRefreshAt: null });
    expect(mocks.state.connections[4]).toEqual(mocks.originalConnections[4]);
    expect(mocks.state.connections[5]).toEqual(mocks.originalConnections[5]);
    expect(mocks.state.connections[6]).toEqual(mocks.originalConnections[6]);
  });

  it.each([
    ['source', 'forced Spend source deactivation failure'],
    ['records', 'forced Spend record delete failure'],
    ['connection', 'forced Spend connection deactivation failure'],
  ] as const)('rolls back every state change when the %s boundary fails', async (stage, message) => {
    mocks.state.failureStage = stage;
    await expect(disconnect()).rejects.toThrow(message);
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
    expect(mocks.state.connections).toEqual(mocks.originalConnections);
  });
});
