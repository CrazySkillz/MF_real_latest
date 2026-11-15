import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';

const source = readFileSync('server/routes-oauth.ts', 'utf8');
const start = source.indexOf('  // Operator-only credential maintenance.');
const end = source.indexOf('  const salesforceTokenRefreshes =', start);
const compiled = ts.transpileModule(source.slice(start, end), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0';
const connectionId = '23d83e8d-d149-47fa-a6a1-803290f3c188';
const secret = 'ab'.repeat(32);
afterEach(() => vi.unstubAllEnvs());

function setup(overrides: any = {}) {
  vi.stubEnv('HUBSPOT_MONITOR_SECRET', secret);
  let connection: any = { id: connectionId, campaignId, isActive: true, accessToken: 'expired',
    refreshToken: 'refresh-one', clientId: 'oauth-client', clientSecret: 'oauth-secret', expiresAt: new Date(0), ...overrides };
  const campaign = { id: campaignId, status: 'active', revenue: '3450', lastRefresh: 'unchanged' };
  const storage = { getCampaign: vi.fn(async () => campaign), getHubspotConnection: vi.fn(async () => connection),
    updateHubspotConnection: vi.fn(async (id, update, options) => {
      expect(id).toBe(connectionId); expect(options.expectedConnection.id).toBe(connectionId);
      expect(Object.keys(update).sort()).toEqual(['accessToken', 'expiresAt', 'refreshToken']);
      connection = { ...connection, ...update }; return connection;
    }) };
  const request = vi.fn(async (_url?: any, _options?: any) => new Response(JSON.stringify({ access_token: 'renewed', refresh_token: 'refresh-two', expires_in: 1800 })));
  let handler: any;
  new Function('app', 'storage', 'fetch', 'process', 'z', 'timingSafeEqual', compiled)(
    { post: (path: string, fn: any) => { expect(path).toBe('/api/hubspot/:campaignId/monitor/renew-token'); handler = fn; } },
    storage, request, process, z, timingSafeEqual);
  const call = async (key = secret, body: any = { connectionId }, id = campaignId) => {
    const res: any = { code: 200, body: undefined, status(n: number) { this.code = n; return this; },
      json(value: any) { this.body = value; return this; }, setHeader: vi.fn() };
    await handler({ headers: { 'x-hubspot-monitor-key': key }, params: { campaignId: id }, body }, res);
    return res;
  };
  return { call, storage, request, campaign, connection: () => connection };
}

describe('HubSpot monitoring credential-only renewal', () => {
  it('renews expired credentials, persists rotation, and returns no credentials or campaign changes', async () => {
    const s = setup(), before = JSON.stringify(s.campaign);
    const result = await s.call();
    expect(result.code).toBe(200); expect(result.body).toEqual({ status: 'ready' });
    expect(s.request).toHaveBeenCalledTimes(1);
    expect(s.request.mock.calls[0][0]).toBe('https://api.hubapi.com/oauth/v1/token');
    expect(s.connection().refreshToken).toBe('refresh-two');
    expect(s.connection().expiresAt.getTime()).toBeGreaterThan(Date.now() + 1700_000);
    expect(JSON.stringify(s.campaign)).toBe(before);
    await s.call(); expect(s.request).toHaveBeenCalledTimes(1); expect(s.storage.updateHubspotConnection).toHaveBeenCalledTimes(1);
  });
  it('coalesces concurrent renewal requests', async () => {
    const s = setup(); await Promise.all([s.call(), s.call()]);
    expect(s.request).toHaveBeenCalledTimes(1); expect(s.storage.updateHubspotConnection).toHaveBeenCalledTimes(1);
  });
  it.each(['', 'bad', 'cd'.repeat(32)])('rejects invalid operator authentication before storage access: %s', async key => {
    const s = setup(); expect((await s.call(key)).code).toBe(401);
    expect(s.storage.getCampaign).not.toHaveBeenCalled(); expect(s.request).not.toHaveBeenCalled();
  });
  it('fails closed when disabled or when identity is invalid', async () => {
    const s = setup(); vi.stubEnv('HUBSPOT_MONITOR_SECRET', ''); expect((await s.call()).code).toBe(401);
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', secret);
    expect((await s.call(secret, { connectionId, refresh: true })).code).toBe(400);
    expect((await s.call(secret, { connectionId }, 'wrong')).code).toBe(400);
    expect(s.request).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { id: 'another-connection' }, { campaignId: 'another-campaign' }])('rejects inactive or replaced connections', async change => {
    const s = setup(change); expect((await s.call()).code).toBe(409); expect(s.request).not.toHaveBeenCalled();
  });
  it('rejects missing/deleted campaigns', async () => {
    const s = setup(); s.storage.getCampaign.mockResolvedValueOnce(undefined as any);
    expect((await s.call()).code).toBe(409); s.campaign.status = 'deleted';
    expect((await s.call()).code).toBe(409); expect(s.request).not.toHaveBeenCalled();
  });
  it.each([{}, { access_token: 'new', expires_in: 0 }])('does not write invalid provider credentials', async response => {
    const s = setup(); s.request.mockResolvedValueOnce(new Response(JSON.stringify(response)));
    expect((await s.call()).code).toBe(503); expect(s.storage.updateHubspotConnection).not.toHaveBeenCalled();
  });
  it('keeps rejected refresh tokens and storage failures visible without leaking secrets', async () => {
    const s = setup(); s.request.mockResolvedValueOnce(new Response(JSON.stringify({ message: 'sensitive-secret' }), { status: 400 }));
    expect((await s.call()).body).toEqual({ error: 'HubSpot credential renewal unavailable' });
    expect(s.storage.updateHubspotConnection).not.toHaveBeenCalled();
    s.storage.updateHubspotConnection.mockRejectedValueOnce(new Error('database-private-detail'));
    expect((await s.call()).code).toBe(503);
  });
});
