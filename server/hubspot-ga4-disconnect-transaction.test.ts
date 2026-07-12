import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const originalSources = [
    { id: 'source-1', campaignId: 'campaign-1', sourceType: 'hubspot', platformContext: 'ga4', isActive: true },
    { id: 'source-2', campaignId: 'campaign-1', sourceType: 'hubspot', platformContext: null, isActive: true },
    { id: 'other-provider', campaignId: 'campaign-1', sourceType: 'salesforce', platformContext: 'ga4', isActive: true },
    { id: 'other-campaign', campaignId: 'campaign-2', sourceType: 'hubspot', platformContext: 'ga4', isActive: true },
  ];
  const originalRecords = [
    { campaignId: 'campaign-1', revenueSourceId: 'source-1', revenue: '100.00' },
    { campaignId: 'campaign-1', revenueSourceId: 'source-2', revenue: '250.00' },
    { campaignId: 'campaign-2', revenueSourceId: 'source-1', revenue: '999.00' },
    { campaignId: 'campaign-1', revenueSourceId: 'other-provider', revenue: '400.00' },
  ];
  const originalConnections = [
    { id: 'connection-1', campaignId: 'campaign-1', isActive: true },
    { id: 'connection-2', campaignId: 'campaign-2', isActive: true },
  ];
  const state = {
    sources: originalSources.map((source) => ({ ...source })),
    records: originalRecords.map((record) => ({ ...record })),
    connections: originalConnections.map((connection) => ({ ...connection })),
    failureStage: null as 'source' | 'records' | 'connection' | null,
    selectCall: 0,
    updateCall: 0,
  };
  const tx = {
    select: vi.fn(() => {
      state.selectCall += 1;
      if (state.selectCall === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => state.sources.filter((source) => (
              source.campaignId === 'campaign-1' && source.sourceType === 'hubspot' && source.isActive
            )).map(({ id, platformContext }) => ({ id, platformContext }))),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => state.connections
                .filter((connection) => connection.campaignId === 'campaign-1' && connection.isActive)
                .slice(0, 1)
                .map(({ id }) => ({ id }))),
            })),
          })),
        })),
      };
    }),
    update: vi.fn(() => {
      state.updateCall += 1;
      const updateCall = state.updateCall;
      const hasGa4SourceTargets = state.sources.some((source) => (
        source.campaignId === 'campaign-1'
        && source.sourceType === 'hubspot'
        && source.isActive
        && (source.platformContext === 'ga4' || source.platformContext === null)
      ));
      return {
        set: vi.fn((values: any) => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (updateCall === 1 && hasGa4SourceTargets) {
                if (state.failureStage === 'source') throw new Error('forced source deactivation failure');
                const targets = state.sources.filter((source) => (
                  source.campaignId === 'campaign-1'
                  && source.sourceType === 'hubspot'
                  && source.isActive
                  && (source.platformContext === 'ga4' || source.platformContext === null)
                ));
                state.sources = state.sources.map((source) => (
                  targets.some((target) => target.id === source.id) ? { ...source, ...values } : source
                ));
                return targets.map(({ id }) => ({ id }));
              }
              if (state.failureStage === 'connection') throw new Error('forced connection deactivation failure');
              const connection = state.connections.find((item) => item.id === 'connection-1' && item.isActive);
              if (!connection) return [];
              Object.assign(connection, values);
              return [{ id: connection.id }];
            }),
          })),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'records') throw new Error('forced revenue record delete failure');
        state.records = state.records.filter((record) => (
          record.campaignId !== 'campaign-1'
          || !['source-1', 'source-2'].includes(record.revenueSourceId)
        ));
        return { rowCount: 2 };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const sourcesBefore = state.sources.map((source) => ({ ...source }));
    const recordsBefore = state.records.map((record) => ({ ...record }));
    const connectionsBefore = state.connections.map((connection) => ({ ...connection }));
    state.selectCall = 0;
    state.updateCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      state.sources = sourcesBefore;
      state.records = recordsBefore;
      state.connections = connectionsBefore;
      throw error;
    }
  });
  return { originalSources, originalRecords, originalConnections, state, tx, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

describe('GA4 HubSpot atomic disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.sources = mocks.originalSources.map((source) => ({ ...source }));
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.connections = mocks.originalConnections.map((connection) => ({ ...connection }));
    mocks.state.failureStage = null;
  });

  const disconnect = () => new DatabaseStorage().disconnectGa4HubspotRevenue('campaign-1');

  it('deactivates every GA4 HubSpot source and the connection while isolating other data', async () => {
    await expect(disconnect()).resolves.toEqual({
      sourceIds: ['source-1', 'source-2'],
      connectionId: 'connection-1',
    });
    expect(mocks.state.sources).toEqual([
      { ...mocks.originalSources[0], isActive: false },
      { ...mocks.originalSources[1], isActive: false },
      mocks.originalSources[2],
      mocks.originalSources[3],
    ]);
    expect(mocks.state.records).toEqual([mocks.originalRecords[2], mocks.originalRecords[3]]);
    expect(mocks.state.connections).toEqual([
      { ...mocks.originalConnections[0], isActive: false },
      mocks.originalConnections[1],
    ]);
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

  it('fails closed before mutation when another platform uses the shared connection', async () => {
    mocks.state.sources.push({
      id: 'linkedin-source',
      campaignId: 'campaign-1',
      sourceType: 'hubspot',
      platformContext: 'linkedin',
      isActive: true,
    });
    await expect(disconnect()).rejects.toMatchObject({ code: 'HUBSPOT_CONNECTION_IN_USE' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('retains active sources when no active campaign connection exists', async () => {
    mocks.state.connections[0].isActive = false;
    await expect(disconnect()).rejects.toMatchObject({ code: 'HUBSPOT_CONNECTION_NOT_FOUND' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.state.sources).toEqual(mocks.originalSources);
  });

  it('disconnects an OAuth-only connection without deleting inactive-source records', async () => {
    mocks.state.sources[0].isActive = false;
    mocks.state.sources[1].isActive = false;
    await expect(disconnect()).resolves.toEqual({ sourceIds: [], connectionId: 'connection-1' });
    expect(mocks.state.records).toEqual(mocks.originalRecords);
    expect(mocks.state.connections[0].isActive).toBe(false);
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('keeps the endpoint campaign-guarded and the GA4 UI on the atomic route only', () => {
    const routes = readFileSync('server/routes-oauth.ts', 'utf8');
    const client = readFileSync('client/src/components/AddRevenueWizardModal.tsx', 'utf8');
    const routeStart = routes.search(/app\.delete\('\/api\/campaigns\/:id\/ga4\/hubspot\/disconnect'/);
    const routeEnd = routes.indexOf('// Individual revenue source delete', routeStart);
    const route = routes.slice(routeStart, routeEnd);
    expect(routeStart).toBeGreaterThan(-1);
    expect(route).toContain('ensureCampaignAccess');
    expect(route).toContain('storage.disconnectGa4HubspotRevenue(campaignId)');
    expect(client).toMatch(/platform === 'hubspot' && platformContext === 'ga4'/);
    expect(client).toContain('/ga4/hubspot/disconnect');
  });
});
