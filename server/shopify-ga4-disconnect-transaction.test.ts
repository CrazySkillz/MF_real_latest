import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const initial = {
    sourceActive: true,
    sourceContext: 'ga4' as string | null,
    records: ['record-1'],
    connectionActive: true,
  };
  const state = {
    ...initial,
    records: [...initial.records],
    failureStage: null as 'source' | 'records' | 'connection' | null,
    selectCall: 0,
    updateCall: 0,
  };
  const tx = {
    select: vi.fn(() => {
      state.selectCall++;
      if (state.selectCall === 1) {
        return {
          from: vi.fn(() => ({
            where: vi.fn(async () => state.sourceActive
              ? [{ id: 'source-1', platformContext: state.sourceContext }]
              : []),
          })),
        };
      }
      return {
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn(async () => state.connectionActive ? [{ id: 'connection-1' }] : []),
            })),
          })),
        })),
      };
    }),
    update: vi.fn(() => {
      state.updateCall++;
      const updateCall = state.updateCall;
      return {
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => {
              if (updateCall === 1 && state.sourceActive) {
                if (state.failureStage === 'source') throw new Error('forced source failure');
                state.sourceActive = false;
                return [{ id: 'source-1' }];
              }
              if (state.failureStage === 'connection') throw new Error('forced connection failure');
              if (!state.connectionActive) return [];
              state.connectionActive = false;
              return [{ id: 'connection-1' }];
            }),
          })),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'records') throw new Error('forced records failure');
        state.records = [];
        return { rowCount: 1 };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = {
      sourceActive: state.sourceActive,
      sourceContext: state.sourceContext,
      records: [...state.records],
      connectionActive: state.connectionActive,
    };
    state.selectCall = 0;
    state.updateCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      Object.assign(state, before, { records: [...before.records] });
      throw error;
    }
  });
  return { initial, state, tx, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

describe('GA4 Shopify atomic disconnect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.state, {
      sourceActive: mocks.initial.sourceActive,
      sourceContext: mocks.initial.sourceContext,
      records: [...mocks.initial.records],
      connectionActive: mocks.initial.connectionActive,
      failureStage: null,
    });
  });

  const disconnect = () => new DatabaseStorage().disconnectGa4ShopifyRevenue('campaign-1');

  it('deactivates the GA4 source and connection and removes only its records', async () => {
    await expect(disconnect()).resolves.toEqual({
      sourceIds: ['source-1'],
      connectionId: 'connection-1',
    });
    expect(mocks.state).toMatchObject({
      sourceActive: false,
      records: [],
      connectionActive: false,
    });
  });

  it.each([
    ['source', 'forced source failure'],
    ['records', 'forced records failure'],
    ['connection', 'forced connection failure'],
  ] as const)('rolls back source, records, and connection when %s fails', async (stage, message) => {
    mocks.state.failureStage = stage;
    await expect(disconnect()).rejects.toThrow(message);
    expect(mocks.state).toMatchObject({
      sourceActive: true,
      records: ['record-1'],
      connectionActive: true,
    });
  });

  it('fails before mutation when another platform uses the campaign connection', async () => {
    mocks.state.sourceContext = 'linkedin';
    await expect(disconnect()).rejects.toMatchObject({ code: 'SHOPIFY_CONNECTION_IN_USE' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('keeps the source when no active campaign connection exists', async () => {
    mocks.state.connectionActive = false;
    await expect(disconnect()).rejects.toMatchObject({ code: 'SHOPIFY_CONNECTION_NOT_FOUND' });
    expect(mocks.state.sourceActive).toBe(true);
    expect(mocks.state.records).toEqual(['record-1']);
  });

  it('keeps the endpoint campaign-guarded and the GA4 UI on the atomic route', () => {
    const routes = readFileSync('server/routes-oauth.ts', 'utf8');
    const client = readFileSync('client/src/components/AddRevenueWizardModal.tsx', 'utf8');
    const routeStart = routes.search(/app\.delete\('\/api\/campaigns\/:id\/ga4\/shopify\/disconnect'/);
    const routeEnd = routes.indexOf('// Individual revenue source delete', routeStart);
    const route = routes.slice(routeStart, routeEnd);
    expect(routeStart).toBeGreaterThan(-1);
    expect(route).toContain('ensureCampaignAccess');
    expect(route).toContain('storage.disconnectGa4ShopifyRevenue(campaignId)');
    expect(route).toContain('findOpenShopifyRefreshFailureNotification(notificationRows, campaignId, sourceId)');
    expect(route).toContain('resolveShopifyRefreshFailureNotification');
    expect(client).toMatch(/platform === 'shopify' && platformContext === 'ga4'/);
    expect(client).toContain('/ga4/shopify/disconnect');
  });
});
