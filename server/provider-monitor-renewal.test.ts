import { readFileSync } from 'node:fs';
import { timingSafeEqual } from 'node:crypto';
import ts from 'typescript';
import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { refreshShopifyOfflineAccessToken, requireShopifyOrderScope } from './utils/shopify-provider';

const source = readFileSync('server/routes-oauth.ts', 'utf8');
const sf = source.slice(source.indexOf('  const salesforceTokenRefreshes ='), source.indexOf('  async function getSalesforceAccessTokenForCampaign'));
const shop = source.slice(source.indexOf('  const getShopifyConnectionForCampaign ='), source.indexOf('  const getShopifyConnectionOrderAccess ='));
const compiled = ts.transpileModule(sf + shop, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0', connectionId = '23d83e8d-d149-47fa-a6a1-803290f3c188';
const secret = 'ab'.repeat(32);
afterEach(() => vi.unstubAllEnvs());

function setup(provider: 'salesforce' | 'shopify', overrides: any = {}) {
  vi.stubEnv('HUBSPOT_MONITOR_SECRET', secret); vi.stubEnv('SHOPIFY_CLIENT_ID', 'client'); vi.stubEnv('SHOPIFY_CLIENT_SECRET', 'secret');
  let connection: any = { id: connectionId, campaignId, isActive: true, accessToken: 'expired', refreshToken: 'old-refresh',
    clientId: 'client', clientSecret: 'secret', expiresAt: new Date(0), instanceUrl: 'https://example.my.salesforce.com', shopDomain: 'example.myshopify.com',
    mappingConfig: JSON.stringify({ authType: 'oauth', grantedScopes: 'read_orders', grantedScopesList: ['read_orders'],
      accessTokenExpiresAt: new Date(0).toISOString(), refreshTokenExpiresAt: new Date(Date.now() + 86400000).toISOString(), selectedCampaign: 'keep' }), ...overrides };
  const campaign = { id: campaignId, status: 'active', revenue: '300', lastRefresh: 'unchanged' };
  const get = vi.fn(async () => connection), update = vi.fn(async (id, changes, options) => {
    expect(id).toBe(connectionId); expect(options.expectedConnection.id).toBe(connectionId);
    connection = { ...connection, ...changes }; return connection;
  });
  let locked: Promise<any> = Promise.resolve();
  const storage = { getCampaign: vi.fn(async () => campaign), getSalesforceConnection: get, getShopifyConnection: get,
    updateSalesforceConnection: update, updateShopifyConnection: update,
    withShopifyOauthStoreLock: vi.fn((_domain, fn) => { const work = locked.then(fn); locked = work.catch(() => {}); return work; }) };
  const response = { access_token: 'renewed', refresh_token: 'rotated', expires_in: 3600, refresh_token_expires_in: 86400,
    scope: 'read_orders', instance_url: connection.instanceUrl };
  const request = vi.fn(async (_url?: any, _options?: any) => new Response(JSON.stringify(response)));
  const routes = new Map<string, any>();
  const helpers = new Function('app', 'storage', 'fetch', 'process', 'z', 'timingSafeEqual', 'refreshShopifyOfflineAccessToken', 'requireShopifyOrderScope', 'console',
    compiled + '; return { refreshSalesforceToken, getShopifyConnectionForCampaign };')(
    { post: (path: string, fn: any) => routes.set(path, fn) }, storage, request, process, z, timingSafeEqual,
    (args: any) => refreshShopifyOfflineAccessToken({ ...args, fetchImpl: request as any }), requireShopifyOrderScope, { log: vi.fn(), error: vi.fn() });
  const call = async (key = secret, body: any = { connectionId }, id = campaignId) => {
    const res: any = { code: 200, body: undefined, status(n: number) { this.code = n; return this; }, json(value: any) { this.body = value; return this; }, setHeader: vi.fn() };
    await routes.get(`/api/${provider}/:campaignId/monitor/renew-token`)({ headers: { 'x-hubspot-monitor-key': key }, params: { campaignId: id }, body }, res); return res;
  };
  return { call, storage, get, update, request, response, campaign, helpers, connection: () => connection };
}

describe.each(['salesforce', 'shopify'] as const)('%s monitor credential renewal', provider => {
  it('renews once, persists rotation, preserves campaign and source settings, then skips valid credentials', async () => {
    const s = setup(provider), before = JSON.stringify(s.campaign), config = JSON.parse(s.connection().mappingConfig);
    const result = await s.call(); expect(result.code).toBe(200); expect(result.body).toEqual({ status: 'ready' });
    expect(s.connection().accessToken).toBe('renewed'); expect(s.connection().refreshToken).toBe('rotated');
    expect(JSON.stringify(s.campaign)).toBe(before); expect(JSON.parse(s.connection().mappingConfig).selectedCampaign).toBe(config.selectedCampaign);
    expect(s.request).toHaveBeenCalledTimes(1); await s.call(); expect(s.request).toHaveBeenCalledTimes(1); expect(s.update).toHaveBeenCalledTimes(1);
    expect(Object.keys(s.update.mock.calls[0][1]).sort()).toEqual(provider === 'salesforce' ? ['accessToken', 'expiresAt', 'refreshToken'] : ['accessToken', 'mappingConfig', 'refreshToken']);
  });
  it('serializes concurrent renewal requests', async () => { const s = setup(provider); await Promise.all([s.call(), s.call()]); expect(s.request).toHaveBeenCalledTimes(1); });
  it.each(['', 'bad', 'cd'.repeat(32)])('denies wrong operator authentication before database access (%s)', async key => {
    const s = setup(provider); expect((await s.call(key)).code).toBe(401); expect(s.storage.getCampaign).not.toHaveBeenCalled(); expect(s.request).not.toHaveBeenCalled();
  });
  it('rejects disabled configuration and malformed/extra identities', async () => {
    const s = setup(provider); vi.stubEnv('HUBSPOT_MONITOR_SECRET', ''); expect((await s.call()).code).toBe(401);
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', secret); expect((await s.call(secret, { connectionId, refresh: true })).code).toBe(400);
    expect((await s.call(secret, { connectionId }, 'other')).code).toBe(400); expect(s.request).not.toHaveBeenCalled();
  });
  it.each([{ isActive: false }, { id: 'other' }, { campaignId: 'other' }])('rejects inactive or mismatched connections', async override => {
    const s = setup(provider, override); expect((await s.call()).code).toBe(409); expect(s.request).not.toHaveBeenCalled();
  });
  it('rejects missing/deleted campaigns', async () => {
    const s = setup(provider); s.storage.getCampaign.mockResolvedValueOnce(undefined as any); expect((await s.call()).code).toBe(409);
    s.campaign.status = 'deleted'; expect((await s.call()).code).toBe(409); expect(s.request).not.toHaveBeenCalled();
  });
  it('rejects reconnection during the helper reload', async () => {
    const s = setup(provider); s.get.mockResolvedValueOnce(s.connection()).mockResolvedValueOnce({ ...s.connection(), id: 'replaced' });
    expect((await s.call()).code).toBe(503); expect(s.request).not.toHaveBeenCalled();
  });
  it('does not hide provider or persistence failures', async () => {
    const s = setup(provider); s.request.mockResolvedValueOnce(new Response('{}', { status: 400 })); expect((await s.call()).code).toBe(503); expect(s.update).not.toHaveBeenCalled();
    s.update.mockRejectedValueOnce(new Error('write failed')); expect((await s.call()).code).toBe(503);
  });
});

it('keeps Shopify non-expiring/manual token connections unchanged', async () => {
  const s = setup('shopify', { mappingConfig: JSON.stringify({ authType: 'token' }) }); expect((await s.call()).code).toBe(200); expect(s.request).not.toHaveBeenCalled(); expect(s.update).not.toHaveBeenCalled();
});
it('preserves Shopify scope metadata in monitor mode; ordinary renewal retains its existing behavior', async () => {
  const s = setup('shopify'), before = JSON.parse(s.connection().mappingConfig); s.response.scope = 'read_orders,read_products';
  expect((await s.call()).code).toBe(200); const after = JSON.parse(s.connection().mappingConfig);
  expect(after.grantedScopes).toBe(before.grantedScopes); expect(after.grantedScopesList).toEqual(before.grantedScopesList);
  const ordinary = setup('shopify'); ordinary.response.scope = 'read_orders,read_products';
  await ordinary.helpers.getShopifyConnectionForCampaign(campaignId); expect(JSON.parse(ordinary.connection().mappingConfig).grantedScopes).toBe('read_orders,read_products');
});
it('preserves Salesforce host in monitor mode, keeps rotated credentials, and reports a host change', async () => {
  const s = setup('salesforce'), host = s.connection().instanceUrl; s.response.instance_url = 'https://new.my.salesforce.com';
  expect((await s.call()).code).toBe(503); expect(s.connection().instanceUrl).toBe(host); expect(s.connection().refreshToken).toBe('rotated');
  const ordinary = setup('salesforce'); ordinary.response.instance_url = 'https://new.my.salesforce.com';
  await ordinary.helpers.refreshSalesforceToken(ordinary.connection()); expect(ordinary.connection().instanceUrl).toBe(ordinary.response.instance_url);
});
