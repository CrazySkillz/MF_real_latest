import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const originalConnection = {
    id: 'connection-1',
    campaignId: 'campaign-1',
    mappingConfig: '{version:original}',
    isActive: true,
  };
  const originalSource = {
    id: 'source-1',
    campaignId: 'campaign-1',
    sourceType: 'hubspot',
    platformContext: 'ga4',
    displayName: 'Original HubSpot',
    mappingConfig: '{version:original}',
    isActive: true,
  };
  const originalRecords = [{
    campaignId: 'campaign-1',
    revenueSourceId: 'source-1',
    date: '2026-07-01',
    revenue: '100.00',
    currency: 'USD',
    sourceType: 'hubspot',
  }];
  const state = {
    connection: { ...originalConnection },
    source: { ...originalSource },
    records: originalRecords.map((record) => ({ ...record })),
    createdSource: null as any,
    failureStage: 'records' as 'source' | 'delete' | 'records' | 'connection' | null,
  };
  const tx = {
    update: vi.fn(() => ({
      set: vi.fn((values: any) => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => {
            const isSourceUpdate = Object.prototype.hasOwnProperty.call(values, 'displayName');
            if (isSourceUpdate) {
              if (state.failureStage === 'source') throw new Error('forced source update failure');
              state.source = { ...state.source, ...values };
              return [{ ...state.source }];
            }
            if (state.failureStage === 'connection') throw new Error('forced connection update failure');
            state.connection = { ...state.connection, ...values };
            return [{ id: state.connection.id }];
          }),
        })),
      })),
    })),
    delete: vi.fn(() => ({
      where: vi.fn(async () => {
        if (state.failureStage === 'delete') throw new Error('forced revenue record delete failure');
        state.records = [];
        return { rowCount: 1 };
      }),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: any) => {
        if (Array.isArray(values)) {
          if (state.failureStage === 'records') {
            return Promise.reject(new Error('forced revenue record insert failure'));
          }
          state.records = values.map((record) => ({ ...record }));
          return Promise.resolve({ rowCount: values.length });
        }
        return {
          returning: vi.fn(async () => {
            if (state.failureStage === 'source') throw new Error('forced source insert failure');
            state.createdSource = { id: 'source-new', ...values };
            return [{ ...state.createdSource }];
          }),
        };
      }),
    })),
  };
  const transaction = vi.fn(async (callback: (transaction: any) => Promise<any>) => {
    const connectionBefore = { ...state.connection };
    const sourceBefore = { ...state.source };
    const recordsBefore = state.records.map((record) => ({ ...record }));
    const createdSourceBefore = state.createdSource;
    try {
      return await callback(tx);
    } catch (error) {
      state.connection = connectionBefore;
      state.source = sourceBefore;
      state.records = recordsBefore;
      state.createdSource = createdSourceBefore;
      throw error;
    }
  });
  return { originalConnection, originalSource, originalRecords, state, tx, db: { transaction } };
});

vi.mock('./db', () => ({ db: mocks.db, pool: null }));

import { DatabaseStorage } from './storage';

const updatedSource = {
  campaignId: 'campaign-1',
  sourceType: 'hubspot',
  platformContext: 'ga4',
  displayName: 'Updated HubSpot',
  mappingConfig: '{version:updated}',
  isActive: true,
} as any;

const updatedRecords = [{
  campaignId: 'campaign-1',
  date: '2026-07-02',
  revenue: '250.00',
  currency: 'USD',
  sourceType: 'hubspot',
}] as any[];

describe('GA4 HubSpot revenue transaction rollback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.state.connection = { ...mocks.originalConnection };
    mocks.state.source = { ...mocks.originalSource };
    mocks.state.records = mocks.originalRecords.map((record) => ({ ...record }));
    mocks.state.createdSource = null;
    mocks.state.failureStage = 'records';
  });

  const replace = (storage: DatabaseStorage, existingSourceId: string | null = 'source-1') =>
    storage.replaceGa4HubspotRevenueSourceWithRecords(
      'campaign-1',
      existingSourceId,
      'connection-1',
      '{version:updated}',
      updatedSource,
      updatedRecords,
    );

  it('commits connection metadata, source metadata, and records together', async () => {
    mocks.state.failureStage = null;
    await expect(replace(new DatabaseStorage())).resolves.toMatchObject({
      id: 'source-1',
      displayName: 'Updated HubSpot',
      mappingConfig: '{version:updated}',
    });

    expect(mocks.state.connection.mappingConfig).toBe('{version:updated}');
    expect(mocks.state.source).toMatchObject(updatedSource);
    expect(mocks.state.records).toEqual([expect.objectContaining({
      campaignId: 'campaign-1',
      revenueSourceId: 'source-1',
      revenue: '250.00',
      sourceType: 'hubspot',
    })]);
  });

  it('retains connection metadata, source metadata, and records when replacement insertion fails', async () => {
    await expect(replace(new DatabaseStorage())).rejects.toThrow('forced revenue record insert failure');

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('rolls the complete replacement back when the connection mapping update fails', async () => {
    mocks.state.failureStage = 'connection';
    await expect(replace(new DatabaseStorage())).rejects.toThrow('forced connection update failure');

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('does not touch records or connection metadata when the source update fails', async () => {
    mocks.state.failureStage = 'source';
    await expect(replace(new DatabaseStorage())).rejects.toThrow('forced source update failure');

    expect(mocks.tx.delete).not.toHaveBeenCalled();
    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('restores source metadata when old-record deletion fails', async () => {
    mocks.state.failureStage = 'delete';
    await expect(replace(new DatabaseStorage())).rejects.toThrow('forced revenue record delete failure');

    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });

  it('does not retain a newly created source when its record insertion fails', async () => {
    await expect(replace(new DatabaseStorage(), null)).rejects.toThrow('forced revenue record insert failure');

    expect(mocks.state.createdSource).toBeNull();
    expect(mocks.state.connection).toEqual(mocks.originalConnection);
    expect(mocks.state.source).toEqual(mocks.originalSource);
    expect(mocks.state.records).toEqual(mocks.originalRecords);
  });
});
