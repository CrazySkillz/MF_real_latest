import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
const require = createRequire(import.meta.url);
const fs = require('node:fs');
const { readPacket, publicMode, saveReceipt, main } = require('../docs/fixes/v1-batch-8/validation-2026-11-01-clerk-cutover/run-ownership.cjs');
const target = '073e11d852157bd3f4d53e8321ad28bc5564ff639fd4da814bf15f53575024e0';
const filename = 'ownership-plan-2026-11-01T00-00-00-000Z.json';
const commit = 'a'.repeat(40);
const hash = (text: string) => createHash('sha256').update(text).digest('hex');
function packet() {
  return { targetSha256: target, plan: { mappings: [
    { from: 'user_3K7q6o5pF0aykjIQSHy5O7mVi2U', to: 'user_3LTouyBkb8CfKyfoAk2L4nw7QKN' },
    { from: 'user_39kDsb8uIT6shhq2vixKnqplwy6', to: 'user_3LTqgGDCOcbqrzLRaynqvRWRtMl' },
  ], rows: {
    clients: ['4d8d826b-bb16-41b7-97a4-6de8fa20fe9c', '861d3921-1903-491c-8ec3-57c0f6d05e92', 'e3ec20ad-89ea-450d-8caf-8c0ab7abd220'].map(id => ({ id })),
    campaigns: ['36493a43-accd-4360-8ff2-de62f5a19b6e', '36631f9f-5f32-4ae6-8d20-d8430abb364c', 'b74f98af-ede9-47af-9b19-0720ebb4d2c0'].map(id => ({ id })),
    campaign_creation_requests: Array.from({ length: 5 }, (_, id) => ({ id })),
    service_account_resource_grants: [{ id: 'fixture-grant' }],
  } } };
}
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
describe('operator ownership CLI boundaries', () => {
  it('requires a reviewed file and digest before reading any environment or opening a connection', async () => {
    const read = vi.spyOn(fs, 'readFileSync').mockImplementation(() => { throw Error('Unexpected file read'); });
    await expect(main([])).rejects.toThrow('Packet filename');
    expect(() => readPacket('../ownership-plan-2026.json', 'a'.repeat(64), 'check')).toThrow();
    expect(() => readPacket(filename, 'a'.repeat(64), 'force')).toThrow('Unknown mode');
    expect(read).not.toHaveBeenCalled();
  });
  it('accepts only the exact reviewed forward identities and row boundary', () => {
    const data = packet(), text = JSON.stringify(data);
    vi.spyOn(fs, 'readFileSync').mockReturnValue(text);
    expect(readPacket(filename, hash(text), 'check')).toEqual(data.plan);
    expect(readPacket(filename, hash(text), 'apply')).toEqual(data.plan);
    expect(() => readPacket(filename, 'b'.repeat(64), 'apply')).toThrow('digest changed');
    expect(() => readPacket(filename, hash(text), 'rollback')).toThrow('Wrong direction');
  });
  for (const mutation of ['target', 'account', 'campaign', 'extra row']) it(`refuses an altered ${mutation} even with a recalculated digest`, () => {
    const data = packet();
    if (mutation === 'target') data.targetSha256 = 'wrong';
    if (mutation === 'account') data.plan.mappings[1].to = data.plan.mappings[0].to;
    if (mutation === 'campaign') data.plan.rows.campaigns[0].id = 'unreviewed';
    if (mutation === 'extra row') data.plan.rows.campaign_creation_requests.push({ id: 10 });
    const text = JSON.stringify(data); vi.spyOn(fs, 'readFileSync').mockReturnValue(text);
    expect(() => readPacket(filename, hash(text), 'apply')).toThrow();
  });
  it('checks the deployed revision and compiled frontend instance through anonymous same-origin reads', async () => {
    const key = `pk_live_${Buffer.from('clerk.mimosaas.app$').toString('base64')}`;
    const fetch = vi.fn(async (url: URL) => ({ status: 200, text: async () => url.pathname === '/api/health'
      ? JSON.stringify({ ok: true, commit }) : url.pathname === '/' ? '<script src="/assets/index-fixture.js"></script>' : `const key="${key}";` }));
    vi.stubGlobal('fetch', fetch);
    expect(await publicMode(commit)).toEqual({ mode: 'live', host: 'clerk.mimosaas.app$' });
    expect(fetch.mock.calls.every(([url]) => url.origin === 'https://app.mimosaas.app')).toBe(true);
    await expect(publicMode('b'.repeat(40))).rejects.toThrow('Unexpected deployed revision');
  });
  it('refuses a script asset on a different origin', async () => {
    const fetch = vi.fn(async (url: URL) => ({ status: 200, text: async () => url.pathname === '/api/health'
      ? JSON.stringify({ ok: true, commit }) : '<script src="https://unrelated.example/assets/index-x.js"></script>' }));
    vi.stubGlobal('fetch', fetch);
    await expect(publicMode(commit)).rejects.toThrow();
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it('closes the exclusive rollback file and propagates fsync failure before commit can happen', () => {
    const open = vi.spyOn(fs, 'openSync').mockReturnValue(123);
    const write = vi.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    vi.spyOn(fs, 'fsyncSync').mockImplementation(() => { throw Error('disk failure'); });
    const close = vi.spyOn(fs, 'closeSync').mockImplementation(() => {});
    expect(() => saveReceipt({ at: '2026-11-01T00:00:00.000Z', rollbackPlan: {} })).toThrow('disk failure');
    expect(open).toHaveBeenCalledWith(expect.stringContaining('ownership-rollback-'), 'wx', 0o600);
    expect(write).toHaveBeenCalledWith(123, expect.stringContaining('"commitAttemptPending": true'));
    expect(close).toHaveBeenCalledWith(123);
  });
});
