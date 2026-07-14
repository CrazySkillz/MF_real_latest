import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const original = {
    connections: [] as any[],
    sources: [
      { id: 'shop-active', sourceType: 'shopify', platformContext: 'ga4', isActive: true },
      { id: 'shop-inactive', sourceType: 'shopify', platformContext: 'ga4', isActive: false },
      { id: 'csv-source', sourceType: 'csv', platformContext: 'ga4', isActive: true },
    ],
    records: [
      { id: 'active-row', revenueSourceId: 'shop-active', sourceType: 'shopify' },
      { id: 'inactive-row', revenueSourceId: 'shop-inactive', sourceType: 'shopify' },
      { id: 'mislinked-row', revenueSourceId: 'csv-source', sourceType: 'shopify' },
      { id: 'csv-row', revenueSourceId: 'csv-source', sourceType: 'csv' },
    ],
    notifications: [
      { id: 'failure', campaignId: 'campaign-1', read: false, metadata: JSON.stringify({ kind: 'shopify_revenue_refresh_failure', sourceId: 'shop-active' }) },
      { id: 'other', campaignId: 'campaign-1', read: false, metadata: JSON.stringify({ kind: 'other' }) },
    ],
  };
  const state = {
    connections: [] as any[],
    sources: [] as any[],
    records: [] as any[],
    notifications: [] as any[],
    selectCall: 0,
    updateCall: 0,
    failureStage: null as 'source' | 'records' | 'notification' | null,
  };
  const tx = {
    select: vi.fn(() => {
      state.selectCall++;
      const rows = state.selectCall === 1
        ? state.connections
        : state.selectCall === 2
          ? state.sources
          : state.selectCall === 3
            ? state.records
            : state.notifications;
      return { from: vi.fn(() => ({ where: vi.fn(async () => rows.map((row) => ({ ...row }))) })) };
    }),
    update: vi.fn(() => {
      state.updateCall++;
      const updateCall = state.updateCall;
      return {
        set: vi.fn((values: any) => ({
          where: vi.fn(() => {
            if (updateCall === 1) {
              return {
                returning: vi.fn(async () => {
                  if (state.failureStage === 'source') throw new Error('forced source cleanup failure');
                  const active = state.sources.filter((source) => source.id === 'shop-active' && source.isActive);
                  state.sources = state.sources.map((source) => source.id === 'shop-active' ? { ...source, ...values } : source);
                  return active.map(({ id }) => ({ id }));
                }),
              };
            }
            return Promise.resolve().then(() => {
              if (state.failureStage === 'notification') throw new Error('forced notification cleanup failure');
              state.notifications = state.notifications.map((notification) => (
                notification.id === 'failure' ? { ...notification, ...values } : notification
              ));
              return { rowCount: 1 };
            });
          }),
        })),
      };
    }),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'records') throw new Error('forced record cleanup failure');
        state.records = state.records.filter((record) => record.id === 'csv-row');
        return { rowCount: 3 };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const before = JSON.parse(JSON.stringify({
      connections: state.connections,
      sources: state.sources,
      records: state.records,
      notifications: state.notifications,
    }));
    state.selectCall = 0;
    state.updateCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      Object.assign(state, before);
      throw error;
    }
  });
  return { original, state, tx, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

describe('disconnected GA4 Shopify test-data cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.assign(mocks.state, JSON.parse(JSON.stringify(mocks.original)), {
      selectCall: 0,
      updateCall: 0,
      failureStage: null,
    });
  });

  const cleanup = (expectedActiveSourceIds = ['shop-active']) =>
    new DatabaseStorage().cleanupDisconnectedGa4ShopifyRevenue([{
      campaignId: 'campaign-1',
      expectedActiveSourceIds,
    }]);

  it('deactivates exact GA4 Shopify sources, removes only Shopify artifacts, and resolves their alert', async () => {
    const result = await cleanup();
    expect(result).toEqual([{
      campaignId: 'campaign-1',
      deactivatedSourceIds: ['shop-active'],
      deletedRecordIds: ['active-row', 'inactive-row', 'mislinked-row'],
      resolvedNotificationIds: ['failure'],
    }]);
    expect(mocks.state.sources.find((source) => source.id === 'shop-active')?.isActive).toBe(false);
    expect(mocks.state.sources.find((source) => source.id === 'csv-source')?.isActive).toBe(true);
    expect(mocks.state.records).toEqual([{ id: 'csv-row', revenueSourceId: 'csv-source', sourceType: 'csv' }]);
    expect(JSON.parse(mocks.state.notifications.find((row) => row.id === 'failure')!.metadata)).toMatchObject({
      resolutionReason: 'disconnected_shopify_test_data_removed',
    });
    expect(mocks.state.notifications.find((row) => row.id === 'other')?.read).toBe(false);
  });

  it.each([
    ['source', 'forced source cleanup failure'],
    ['records', 'forced record cleanup failure'],
    ['notification', 'forced notification cleanup failure'],
  ] as const)('rolls back all cleanup mutations when %s fails', async (stage, message) => {
    mocks.state.failureStage = stage;
    await expect(cleanup()).rejects.toThrow(message);
    expect(mocks.state.sources).toEqual(mocks.original.sources);
    expect(mocks.state.records).toEqual(mocks.original.records);
    expect(mocks.state.notifications).toEqual(mocks.original.notifications);
  });

  it('fails before mutation when a Shopify connection is active', async () => {
    mocks.state.connections = [{ id: 'connection-1' }];
    await expect(cleanup()).rejects.toMatchObject({ code: 'SHOPIFY_CONNECTION_ACTIVE' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('fails before mutation when the reviewed active source boundary changed', async () => {
    await expect(cleanup(['different-source'])).rejects.toMatchObject({ code: 'SHOPIFY_CLEANUP_SOURCE_MISMATCH' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('fails before mutation when another platform still has an active Shopify source', async () => {
    mocks.state.sources.push({ id: 'linkedin-shopify', sourceType: 'shopify', platformContext: 'linkedin', isActive: true });
    await expect(cleanup()).rejects.toMatchObject({ code: 'SHOPIFY_SOURCE_IN_USE' });
    expect(mocks.tx.update).not.toHaveBeenCalled();
    expect(mocks.tx.delete).not.toHaveBeenCalled();
  });

  it('keeps the production route owner-scoped, exact-source confirmed, and recomputed', () => {
    const routes = readFileSync('server/routes-oauth.ts', 'utf8');
    const start = routes.indexOf('app.post("/api/ga4-overview/shopify/disconnected-test-data/cleanup"');
    const end = routes.indexOf('app.get("/api/campaigns/:id/spend-sources/google-sheets-duplicates"', start);
    const route = routes.slice(start, end);
    expect(start).toBeGreaterThan(-1);
    expect(route).toContain('REMOVE_DISCONNECTED_SHOPIFY_TEST_DATA');
    expect(route).toContain('5317190c-d536-45d4-85c0-9d941cfba9f4');
    expect(route).toContain('7376d0e0-fa56-4864-80cd-9dbc8a972068');
    expect(route).toContain('Cleanup is limited to the exact reviewed disconnected Shopify test-data batch');
    expect(route).toContain('String(campaign?.ownerId || "").trim() === actorId');
    expect(route).toContain('cleanupDisconnectedGa4ShopifyRevenue(requests)');
    expect(route).toContain('recomputeCampaignDerivedValues');
    expect(route).toContain('postCleanupInventoryRequired: true');
  });
});
