import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertProductionTokenEncryptionConfigured } from './utils/tokenVault';
import {
  getShopifyApiVersion,
  normalizeShopifyDomain,
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

  it('requires all-order access for the visible Shopify revenue workflow', () => {
    expect(() => requireShopifyRevenueScopes(['read_orders', 'read_all_orders'])).not.toThrow();
    expect(() => requireShopifyRevenueScopes(['read_orders'])).toThrow('read_all_orders');
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

  it('retries 429 twice using Retry-After and then succeeds', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response('{}', { status: 429, headers: { 'Retry-After': '0.5' } }))
      .mockResolvedValueOnce(new Response('{"shop":{}}', { status: 200, headers: { 'X-Shopify-API-Version': '2026-07' } }));
    const sleep = vi.fn(async () => undefined);

    await expect(shopifyAdminFetch({
      shopDomain: 'store.myshopify.com', accessToken: 'secret', endpoint: '/admin/api/2026-07/shop.json', fetchImpl, sleep,
    })).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[2000], [500]]);
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

  it('fails closed in production without a dedicated encryption key', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TOKEN_ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => assertProductionTokenEncryptionConfigured()).toThrow('not configured');
    process.env.TOKEN_ENCRYPTION_KEY = 'configured-for-test';
    expect(() => assertProductionTokenEncryptionConfigured()).not.toThrow();
  });
});
