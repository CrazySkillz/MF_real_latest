import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const original = { id: 'old-connection', campaignId: 'campaign-1', shopDomain: 'old.myshopify.com', isActive: true };
  const state = { connections: [{ ...original }] as any[], activeSources: [] as any[], failInsert: true, selectCall: 0 };
  const tx = {
    select: vi.fn(() => {
      state.selectCall++;
      const rows = state.selectCall === 1
        ? state.activeSources.map(({ id }) => ({ id }))
        : state.connections.filter((connection) => connection.isActive).map(({ shopDomain }) => ({ shopDomain }));
      return { from: vi.fn(() => ({ where: vi.fn(async () => rows) })) };
    }),
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
    state.selectCall = 0;
    try {
      return await callback(tx);
    } catch (error) {
      state.connections = before;
      throw error;
    }
  });
  const db = {
    transaction,
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => state.connections) })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            state.connections = state.connections.map(connection => ({ ...connection, ...values }));
            return state.connections;
          }),
        })),
      })),
    })),
  };
  return { original, state, tx, db };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

const replace = (shopDomain = 'new.myshopify.com', refreshToken?: string) => new DatabaseStorage().replaceShopifyConnection({
  campaignId: 'campaign-1',
  shopDomain,
  shopName: 'New store',
  accessToken: 'new-token',
  ...(refreshToken ? { refreshToken } : {}),
  isActive: true,
  mappingConfig: '{"authType":"token"}',
} as any);

describe('Shopify connection replacement transaction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.connections = [{ ...mocks.original }];
    mocks.state.activeSources = [];
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

  it('rejects a cross-store replacement while an active Shopify source exists', async () => {
    mocks.state.activeSources = [{ id: 'source-1' }];
    await expect(replace()).rejects.toMatchObject({ code: 'SHOPIFY_ACTIVE_SOURCE_STORE_CHANGE' });
    expect(mocks.state.connections).toEqual([mocks.original]);
    expect(mocks.tx.update).not.toHaveBeenCalled();
  });

  it('allows same-store token rotation while an active Shopify source exists', async () => {
    mocks.state.activeSources = [{ id: 'source-1' }];
    mocks.state.failInsert = false;
    await expect(replace('OLD.MYSHOPIFY.COM')).resolves.toMatchObject({ id: 'new-connection' });
    expect(mocks.state.connections[0].isActive).toBe(false);
    expect(mocks.state.connections[1].isActive).toBe(true);
  });

  it('encrypts an OAuth refresh token without adding an undeclared plaintext column', async () => {
    mocks.state.failInsert = false;
    await expect(replace('new.myshopify.com', 'new-refresh-token')).resolves.toMatchObject({
      accessToken: 'new-token', refreshToken: 'new-refresh-token',
    });
    expect(mocks.state.connections[1].refreshToken).toBeUndefined();
    expect(mocks.state.connections[1].encryptedTokens?.refreshToken).toBeTruthy();
  });

  it('rotates the OAuth access and refresh token together', async () => {
    mocks.state.failInsert = false;
    const created = await replace('new.myshopify.com', 'old-refresh-token');
    mocks.state.connections = [mocks.state.connections[1]];

    await expect(new DatabaseStorage().updateShopifyConnection(created.id, {
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
      mappingConfig: '{"authType":"oauth","accessTokenExpiresAt":"2026-09-10T00:00:00.000Z"}',
    } as any)).resolves.toMatchObject({
      accessToken: 'rotated-access-token',
      refreshToken: 'rotated-refresh-token',
    });
    expect(mocks.state.connections[0].accessToken).toBeNull();
    expect(mocks.state.connections[0].refreshToken).toBeUndefined();
    expect(mocks.state.connections[0].encryptedTokens?.accessToken).toBeTruthy();
    expect(mocks.state.connections[0].encryptedTokens?.refreshToken).toBeTruthy();
  });
});
