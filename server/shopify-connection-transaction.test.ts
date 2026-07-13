import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const original = { id: 'old-connection', campaignId: 'campaign-1', shopDomain: 'old.myshopify.com', isActive: true };
  const state = { connections: [{ ...original }] as any[], failInsert: true };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(async () => {
          state.connections = state.connections.map(connection => ({ ...connection, ...values }));
          return { rowCount: state.connections.length };
        }),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => ({
        returning: vi.fn(async () => {
          if (state.failInsert) throw new Error('forced connection insert failure');
          const created = { id: 'new-connection', ...values };
          state.connections.push(created);
          return [created];
        }),
      })),
    })),
  };
  const transaction = vi.fn(async (callback: (tx: any) => Promise<any>) => {
    const before = state.connections.map(connection => ({ ...connection }));
    try {
      return await callback(tx);
    } catch (error) {
      state.connections = before;
      throw error;
    }
  });
  return { original, state, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

const replace = () => new DatabaseStorage().replaceShopifyConnection({
  campaignId: 'campaign-1',
  shopDomain: 'new.myshopify.com',
  shopName: 'New store',
  accessToken: 'new-token',
  isActive: true,
  mappingConfig: '{"authType":"token"}',
} as any);

describe('Shopify connection replacement transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.connections = [{ ...mocks.original }];
    mocks.state.failInsert = true;
  });

  it('retains the old active connection when replacement insertion fails', async () => {
    await expect(replace()).rejects.toThrow('forced connection insert failure');
    expect(mocks.state.connections).toEqual([mocks.original]);
  });

  it('deactivates the old connection and creates the encrypted replacement together', async () => {
    mocks.state.failInsert = false;
    await expect(replace()).resolves.toMatchObject({
      id: 'new-connection', campaignId: 'campaign-1', shopDomain: 'new.myshopify.com', accessToken: 'new-token', isActive: true,
    });
    expect(mocks.state.connections).toHaveLength(2);
    expect(mocks.state.connections[0]).toMatchObject({ id: 'old-connection', isActive: false });
    expect(mocks.state.connections[1]).toMatchObject({ id: 'new-connection', accessToken: null, isActive: true });
    expect(mocks.state.connections[1].encryptedTokens).toBeTruthy();
  });
});
