import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const originalConnection = { id: 'connection-1', campaignId: 'campaign-1', mappingConfig: 'original', isActive: true };
  const originalSource = { id: 'source-1', campaignId: 'campaign-1', sourceType: 'shopify', platformContext: 'ga4', displayName: 'Original Shopify', mappingConfig: 'original', isActive: true };
  const originalRecords = [{ campaignId: 'campaign-1', revenueSourceId: 'source-1', date: '2026-07-01', revenue: '100.00', currency: 'USD', sourceType: 'shopify' }];
  const state = {
    connection: { ...originalConnection },
    source: { ...originalSource },
    records: originalRecords.map(record => ({ ...record })),
    failureStage: 'records' as 'delete' | 'records' | null,
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            if (Object.prototype.hasOwnProperty.call(values, 'displayName')) {
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
        if (state.failureStage === 'delete') throw new Error('forced record delete failure');
        state.records = [];
        return { rowCount: 1 };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        if (Array.isArray(values)) {
          if (state.failureStage === 'records') return Promise.reject(new Error('forced record insert failure'));
          state.records = values.map(record => ({ ...record }));
          return Promise.resolve({ rowCount: values.length });
        }
        return { returning: vi.fn(async () => [{ id: 'source-new', ...values }]) };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
    const before = {
      connection: { ...state.connection },
      source: { ...state.source },
      records: state.records.map(record => ({ ...record })),
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
  return { originalConnection, originalSource, originalRecords, state, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

const replace = () => new DatabaseStorage().replaceGa4ShopifyRevenueSourceWithRecords(
  'campaign-1',
  'source-1',
  'connection-1',
  'updated',
  {
    campaignId: 'campaign-1',
    sourceType: 'shopify',
    platformContext: 'ga4',
    displayName: 'Updated Shopify',
    mappingConfig: 'updated',
    isActive: true,
  } as any,
  [{ campaignId: 'campaign-1', date: '2026-07-02', revenue: '250.00', currency: 'USD', sourceType: 'shopify' }] as any,
);

describe('GA4 Shopify revenue transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.connection = { ...mocks.originalConnection };
    mocks.state.source = { ...mocks.originalSource };
    mocks.state.records = mocks.originalRecords.map(record => ({ ...record }));
    mocks.state.failureStage = 'records';
  });

  it('retains the complete last-good state when replacement insertion fails', async () => {
    await expect(replace()).rejects.toThrow('forced record insert failure');

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('retains the complete last-good state when old-record deletion fails', async () => {
    mocks.state.failureStage = 'delete';
    await expect(replace()).rejects.toThrow('forced record delete failure');

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('commits connection metadata, source metadata, and records together', async () => {
    mocks.state.failureStage = null;
    await expect(replace()).resolves.toMatchObject({ id: 'source-1', displayName: 'Updated Shopify' });

    expect(mocks.state.connection.mappingConfig).toBe('updated');
    expect(mocks.state.source).toMatchObject({ displayName: 'Updated Shopify', mappingConfig: 'updated' });
    expect(mocks.state.records).toEqual([expect.objectContaining({
      campaignId: 'campaign-1',
      revenueSourceId: 'source-1',
      revenue: '250.00',
      sourceType: 'shopify',
    })]);
  });
});
