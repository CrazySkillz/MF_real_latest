import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: 'source-1', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: 'ga4', mappingConfig: JSON.stringify({ connectionId: 'connection-1' }), isActive: true },
    { id: 'source-2', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: null, mappingConfig: JSON.stringify({ connectionId: 'connection-2' }), isActive: true },
    { id: 'shared-source', campaignId: 'campaign-1', sourceType: 'google_sheets', platformContext: 'linkedin', mappingConfig: JSON.stringify({ connectionId: 'shared-connection' }), isActive: true },
    { id: 'other-campaign-source', campaignId: 'campaign-2', sourceType: 'google_sheets', platformContext: 'ga4', mappingConfig: JSON.stringify({ connectionId: 'other-campaign-connection' }), isActive: true },
  ];
  const originalRecords = [
    { campaignId: 'campaign-1', revenueSourceId: 'source-1', revenue: '100.00' },
    { campaignId: 'campaign-1', revenueSourceId: 'source-2', revenue: '250.00' },
    { campaignId: 'campaign-1', revenueSourceId: 'shared-source', revenue: '400.00' },
    { campaignId: 'campaign-2', revenueSourceId: 'source-1', revenue: '999.00' },
  ];
  const originalConnections = [
    { id: 'connection-1', campaignId: 'campaign-1', purpose: 'revenue', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'connection-2', campaignId: 'campaign-1', purpose: 'revenue', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'shared-connection', campaignId: 'campaign-1', purpose: 'linkedin_revenue', isPrimary: false, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'main-connection', campaignId: 'campaign-1', purpose: 'general', isPrimary: true, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
    { id: 'other-campaign-connection', campaignId: 'campaign-2', purpose: 'revenue', isPrimary: true, isActive: true, columnMappings: '[]', cachedData: {}, lastDataRefreshAt: new Date() },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    connections: originalConnections.map((connection) => ({ ...connection })),
    spendSources: [] as Array<{ campaignId: string; mappingConfig: string; isActive: boolean }>,
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
            if (call === 2) return state.spendSources.filter((source) => source.campaignId === 'campaign-1' && source.isActive);
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
                if (state.failureStage === 'source') throw new Error('forced source deactivation failure');
                const targets = state.sources.filter((source) => source.campaignId === 'campaign-1' && source.sourceType === 'google_sheets' && source.isActive && (source.platformContext === 'ga4' || source.platformContext === null));
                state.sources = state.sources.map((source) => targets.some((target) => target.id === source.id) ? { ...source, ...values } : source);
                return targets.map(({ id }) => ({ id }));
              }
              if (state.failureStage === 'connection') throw new Error('forced connection deactivation failure');
              const sharedSpendIds = new Set(state.spendSources.map(connectionId).filter(Boolean));
              const targets = state.connections.filter((connection) => connection.campaignId === 'campaign-1' && connection.isActive && connection.purpose === 'revenue' && !sharedSpendIds.has(connection.id));
              state.connections = state.connections.map((connection) => targets.some((target) => target.id === connection.id) ? { ...connection, ...values } : connection);
              return targets.map(({ id }) => ({ id }));
            }),
          })),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'records') throw new Error('forced revenue record delete failure');
        state.records = state.records.filter((record) => record.campaignId !== 'campaign-1' || !['source-1', 'source-2'].includes(record.revenueSourceId));
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
  return { originalSources, originalRecords, originalConnections, state, tx, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

describe('GA4 Google Sheets atomic disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.connections = mocks.originalConnections.map((connection) => ({ ...connection }));
    mocks.state.spendSources = [];
    mocks.state.failureStage = null;
  });

  const disconnect = () => new DatabaseStorage().disconnectGa4GoogleSheetsRevenue('campaign-1');

  it('removes every GA4 Sheets source and connection while preserving other scopes', async () => {
    await expect(disconnect()).resolves.toEqual({ sourceIds: ['source-1', 'source-2'], connectionIds: ['connection-1', 'connection-2'] });
    expect(mocks.state.sources.map(({ id, isActive }) => ({ id, isActive }))).toEqual([
      { id: 'source-1', isActive: false },
      { id: 'source-2', isActive: false },
      { id: 'shared-source', isActive: true },
      { id: 'other-campaign-source', isActive: true },
    ]);
    expect(mocks.state.records).toEqual([mocks.originalRecords[2], mocks.originalRecords[3]]);
    expect(mocks.state.connections[0].isActive).toBe(false);
    expect(mocks.state.connections[1].isActive).toBe(false);
    expect(mocks.state.connections[2]).toEqual(mocks.originalConnections[2]);
    expect(mocks.state.connections[3]).toEqual(mocks.originalConnections[3]);
    expect(mocks.state.connections[4]).toEqual(mocks.originalConnections[4]);
  });

  it('preserves a connection shared with an active spend source', async () => {
    mocks.state.spendSources = [{ campaignId: 'campaign-1', mappingConfig: JSON.stringify({ connectionId: 'connection-2' }), isActive: true }];
    await expect(disconnect()).resolves.toEqual({ sourceIds: ['source-1', 'source-2'], connectionIds: ['connection-1'] });
    expect(mocks.state.connections[0].isActive).toBe(false);
    expect(mocks.state.connections[1]).toEqual(mocks.originalConnections[1]);
  });

  it.each([
    ['source', 'forced source deactivation failure'],
    ['records', 'forced revenue record delete failure'],
    ['connection', 'forced connection deactivation failure'],
  ] as const)('rolls back every state change when the %s boundary fails', async (stage, message) => {
    mocks.state.failureStage = stage;
    await expect(disconnect()).rejects.toThrow(message);
    expect(mocks.state.sources).toEqual(mocks.originalSources);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
    expect(mocks.state.connections).toEqual(mocks.originalConnections);
  });
});
