import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const routes = fs.readFileSync(path.resolve(process.cwd(), 'server/routes-oauth.ts'), 'utf8');
const storage = fs.readFileSync(path.resolve(process.cwd(), 'server/storage.ts'), 'utf8');

describe('Shopify OAuth renewal coordination', () => {
  it('serializes both token acquisition and refresh by Shopify store', () => {
    const callback = routes.slice(routes.indexOf('// Shopify OAuth callback'), routes.indexOf('const getShopifyConnectionForCampaign'));
    const refresh = routes.slice(routes.indexOf('const getShopifyConnectionForCampaign'), routes.indexOf('app.post("/api/shopify/connect"'));
    expect(callback).toContain('storage.withShopifyOauthStoreLock(shop');
    expect(callback.indexOf('storage.withShopifyOauthStoreLock(shop')).toBeLessThan(callback.indexOf('admin/oauth/access_token'));
    expect(refresh).toContain('storage.withShopifyOauthStoreLock(conn.shopDomain');
    expect(storage).toContain('pg_advisory_xact_lock(hashtextextended');
    expect(storage).toContain('shopify_oauth:${normalizedShop}');
  });

  it('limits shared credential lookup to campaigns owned by the same user', () => {
    const method = storage.slice(storage.indexOf('async getShopifyConnection(campaignId'), storage.indexOf('async createShopifyConnection'));
    expect(method).toContain('eq(campaigns.ownerId, targetCampaign.ownerId)');
    expect(method).toContain('inArray(shopifyConnections.campaignId, ownerCampaignIds)');
    expect(method).toContain('resolveNewestShopifyOauthCredential(hydrated, peers)');
  });
});
