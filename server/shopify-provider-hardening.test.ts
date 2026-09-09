import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionTokenEncryptionConfigured } from './utils/tokenVault';
import {
  fetchShopifyOrderCustomerJourneyUtms,
  getShopifyApiVersion,
  hasShopifyAllOrdersScope,
  isShopifyPartnerDevelopmentStore,
  normalizeShopifyDomain,
  parseShopifyExpiringOfflineToken,
  refreshShopifyOfflineAccessToken,
  requireShopifyOrderScope,
  requireShopifyOrderWindowScopes,
  requireShopifyRevenueScopes,
  shopifyAdminFetch,
  validateShopifyOauthState,
} from './utils/shopify-provider';

describe('Shopify provider hardening', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalTokenKey = process.env.TOKEN_ENCRYPTION_KEY;
  const originalEncryptionKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TOKEN_ENCRYPTION_KEY = originalTokenKey;
    process.env.ENCRYPTION_KEY = originalEncryptionKey;
  });

  it('accepts only a canonical myshopify.com store boundary', () => {
    expect(normalizeShopifyDomain('https://Store-One.myshopify.com/admin')).toBe('store-one.myshopify.com');
    for (const value of [
      'example.com',
      'store.myshopify.com.evil.example',
      'store.myshopify.com@evil.example',
      'store.myshopify.com:443',
      '-store.myshopify.com',
      'myshopify.com',
    ]) expect(normalizeShopifyDomain(value)).toBe('');
  });

  it('rejects retired or malformed API versions', () => {
    expect(getShopifyApiVersion('2026-07')).toBe('2026-07');
    expect(() => getShopifyApiVersion('2024-01')).toThrow('Unsupported Shopify API version');
    expect(() => getShopifyApiVersion('latest')).toThrow('Unsupported Shopify API version');
  });

  it('requires an order-reading grant', () => {
    expect(() => requireShopifyOrderScope(['read_orders'])).not.toThrow();
    expect(() => requireShopifyOrderScope(['write_orders'])).not.toThrow();
    expect(() => requireShopifyOrderScope(['read_customers'])).toThrow('read_orders');
  });

  it('requires all-order access for the Admin-token lifetime revenue workflow', () => {
    expect(() => requireShopifyRevenueScopes(['read_orders', 'read_all_orders'])).not.toThrow();
    expect(() => requireShopifyRevenueScopes(['read_orders'])).toThrow('read_all_orders');
    expect(hasShopifyAllOrdersScope(['READ_ALL_ORDERS'])).toBe(true);
    expect(hasShopifyAllOrdersScope(['read_orders'])).toBe(false);
  });

  it('requires read_all_orders only when the requested window exceeds 60 days', () => {
    const now = Date.parse('2026-07-12T00:00:00Z');
    expect(() => requireShopifyOrderWindowScopes(['read_orders'], '2026-06-01T00:00:00Z', now)).not.toThrow();
    expect(() => requireShopifyOrderWindowScopes(['read_orders'], '2026-04-01T00:00:00Z', now)).toThrow('read_all_orders');
    expect(() => requireShopifyOrderWindowScopes(['read_orders', 'read_all_orders'], '2026-04-01T00:00:00Z', now)).not.toThrow();
  });

  it('binds OAuth state to campaign, store, session, and TTL', () => {
    const stored = { campaignId: 'campaign-1', shopDomain: 'store.myshopify.com', sessionId: 'session-1', createdAt: 1_000 };
    const expected = { campaignId: 'campaign-1', shopDomain: 'store.myshopify.com', sessionId: 'session-1' };
    expect(() => validateShopifyOauthState(stored, expected, 1_500, 1_000)).not.toThrow();
    expect(() => validateShopifyOauthState(stored, { ...expected, sessionId: 'session-2' }, 1_500, 1_000)).toThrow('session mismatch');
    expect(() => validateShopifyOauthState(stored, { ...expected, shopDomain: 'other.myshopify.com' }, 1_500, 1_000)).toThrow('shop mismatch');
    expect(() => validateShopifyOauthState(stored, expected, 2_001, 1_000)).toThrow('Expired');
  });

  it('validates and timestamps Shopify expiring offline tokens', () => {
    expect(parseShopifyExpiringOfflineToken({
      access_token: 'access', refresh_token: 'refresh', scope: 'read_orders', expires_in: 3600, refresh_token_expires_in: 7200,
    }, Date.parse('2026-09-09T10:00:00.000Z'))).toEqual({
      accessToken: 'access',
      refreshToken: 'refresh',
      scope: 'read_orders',
      accessTokenExpiresAt: '2026-09-09T11:00:00.000Z',
      refreshTokenExpiresAt: '2026-09-09T12:00:00.000Z',
    });
    expect(() => parseShopifyExpiringOfflineToken({ access_token: 'access', expires_in: 3600 })).toThrow('incomplete expiring offline token');
  });

  it('uses Shopify refresh-token rotation', async () => {
    const tokenResponse = {
      access_token: 'new-access', refresh_token: 'new-refresh', scope: 'read_orders', expires_in: 3600, refresh_token_expires_in: 7200,
    };
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify(tokenResponse), { status: 200 }));

    await refreshShopifyOfflineAccessToken({
      shopDomain: 'store.myshopify.com', clientId: 'client', clientSecret: 'secret', refreshToken: 'old-refresh', fetchImpl,
    });
    const refreshBody = new URLSearchParams(String((fetchImpl.mock.calls[0][1] as any).body));
    expect(refreshBody.get('grant_type')).toBe('refresh_token');
    expect(refreshBody.get('refresh_token')).toBe('old-refresh');
  });

  it('retries 429 twice using Retry-After and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '0.5' } }))
      .mockResolvedValueOnce(new Response('{"shop":{}}', { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } }));
    const sleep = vi.fn(async () => undefined);
    const onResponse = vi.fn();

    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json', fetchImpl, sleep, onResponse,
    })).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[2000], [500]]);
    expect(onResponse.mock.calls.map(([event]) => event)).toEqual([
      { attempt: 0, status: 429, retryAfterSeconds: 2 },
      { attempt: 1, status: 429, retryAfterSeconds: 0.5 },
      { attempt: 2, status: 200, retryAfterSeconds: null },
    ]);
  });

  it('stops after two 429 retries', async () => {
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '1' } }));
    const sleep = vi.fn(async () => undefined);
    const response = await shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json', fetchImpl, sleep,
    });
    expect(response.status).toBe(429);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('fails closed when a Shopify provider request exceeds its timeout', async () => {
    const fetchImpl = vi.fn((_url: any, init: any) => new Promise<Response>((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true });
    })) as any;
    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json', fetchImpl, requestTimeoutMs: 5,
    })).rejects.toThrow('Shopify API request timed out after 5ms');
  });

  it('fails closed for unsafe retry, version, and pagination boundaries', async () => {
    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json',
      fetchImpl: vi.fn(async () => new Response('{}', { status: 429, headers: { 'Retry-After': '60' } })),
      sleep: vi.fn(async () => undefined),
    })).rejects.toThrow('invalid or unsafe Retry-After');

    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json',
      fetchImpl: vi.fn(async () => new Response('{}', { status: 200, headers: { 'X-Shopify-API-Version': '2026-04' } })),
    })).rejects.toThrow('fall-forward detected');

    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json',
      fetchImpl: vi.fn(async () => new Response('{}', { status: 200 })),
    })).rejects.toThrow('omitted X-Shopify-API-Version');

    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: 'https://evil.example/admin/api/2026-07/orders.json',
      fetchImpl: vi.fn(),
    })).rejects.toThrow('escaped the connected shop boundary');
  });

  it('reads first-visit Customer Journey UTMs for the requested Shopify orders', async () => {
    const orderId = 'gid://shopify/Order/123';
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({
      data: {
        nodes: [{
          id: orderId,
          customerJourneySummary: {
            ready: true,
            firstVisit: {
              landingPage: '/products/example',
              utmParameters: { campaign: 'brand_search_q1', source: 'google', medium: 'cpc' },
            },
          },
        }],
      },
    }), { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } }));

    const result = await fetchShopifyOrderCustomerJourneyUtms({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07', orderIds: [orderId], fetchImpl,
    });

    expect(result.get(orderId)).toEqual({
      ready: true,
      landingSite: '/products/example',
      utm_campaign: 'brand_search_q1',
      utm_source: 'google',
      utm_medium: 'cpc',
    });
    const request = fetchImpl.mock.calls[0];
    expect(request[1]).toEqual(expect.objectContaining({ method: 'POST' }));
    expect(String(request[1]?.body)).toContain('customerJourneySummary');
    expect(String(request[1]?.body)).toContain('firstVisit');
    expect(String(request[1]?.body)).toContain('utmParameters');
  });

  it('batches Customer Journey reads without truncating requested orders', async () => {
    const orderIds = Array.from({ length: 51 }, (_, index) => `gid://shopify/Order/${index + 1}`);
    const fetchImpl = vi.fn(async (_url: any, init: any) => {
      const requestedIds = JSON.parse(String(init.body)).variables.ids;
      return new Response(JSON.stringify({
        data: {
          nodes: requestedIds.map((id: string) => ({ id, customerJourneySummary: null })),
        },
      }), { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } });
    });

    const result = await fetchShopifyOrderCustomerJourneyUtms({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07', orderIds, fetchImpl,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result.size).toBe(51);
  });

  it('fails closed for incomplete or mismatched Customer Journey responses', async () => {
    const orderId = 'gid://shopify/Order/123';
    const responseHeaders = { 'X-Shopify-API-Version': '2026-07' };
    await expect(fetchShopifyOrderCustomerJourneyUtms({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07', orderIds: [orderId],
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ errors: [{ message: 'query failed' }] }), { status: 200, headers: responseHeaders })),
    })).rejects.toThrow('query failed');
    await expect(fetchShopifyOrderCustomerJourneyUtms({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07', orderIds: [orderId],
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({ data: { nodes: [{ id: 'gid://shopify/Order/456' }] } }), { status: 200, headers: responseHeaders })),
    })).rejects.toThrow('order mismatch');
  });

  it('verifies development stores from Shopify plan authority', async () => {
    const fetchImpl = vi.fn(async (_url: any, init: any) => new Response(JSON.stringify({
      data: { shop: { plan: { partnerDevelopment: true } } },
    }), { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } }));
    await expect(isShopifyPartnerDevelopmentStore({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07', fetchImpl,
    })).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(expect.any(URL), expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('partnerDevelopment'),
    }));
  });

  it('keeps normal Shopify stores out of development-store validation mode', async () => {
    await expect(isShopifyPartnerDevelopmentStore({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07',
      fetchImpl: vi.fn(async () => new Response(JSON.stringify({
        data: { shop: { plan: { partnerDevelopment: false } } },
      }), { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } })),
    })).resolves.toBe(false);
  });

  it('fails closed when Shopify omits development-store authority', async () => {
    await expect(isShopifyPartnerDevelopmentStore({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', apiVersion: '2026-07',
      fetchImpl: vi.fn(async () => new Response('{data:{shop:{}}}', {
        status: 200, headers: { 'X-Shopify-API-Version': '2026-07' },
      })),
    })).rejects.toThrow('verification failed');
  });

  it('fails closed in production without a dedicated encryption key', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertProductionTokenEncryptionConfigured()).toThrow('not configured');
    process.env.TOKEN_ENCRYPTION_KEY = 'configured-for-test';
    expect(() => assertProductionTokenEncryptionConfigured()).not.toThrow();
  });
});
