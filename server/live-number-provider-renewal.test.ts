import { afterEach, describe, expect, it, vi } from 'vitest';
import { renewFinancialMonitorCredentials, financialCredentialRenewalPreservesInputs, googleMonitorCredential } from './live-number-provider-checks';
import { readOnlyMonitorFetch } from '../scripts/check-live-numbers';
const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0', connectionId = '23d83e8d-d149-47fa-a6a1-803290f3c188';
const baseUrl = 'https://app.example.test';
const fixture = (provider: string): any => ({ campaign: { id: campaignId, lastRefresh: 'same' }, rows: {
  revenueSources: [{ id: 'source', campaignId, sourceType: provider, platformContext: 'ga4', isActive: true, mappingConfig: { connectionId } }],
  [provider + 'Connections']: [{ id: connectionId, campaignId, isActive: true, accessToken: 'expired', expiresAt: new Date(0).toISOString(),
    mappingConfig: JSON.stringify({ authType: 'oauth', accessTokenExpiresAt: new Date(0).toISOString(), grants: ['read_orders'], selection: 'keep' }) }],
  revenueRecords: [{ revenue: 300 }], ga4RefreshWork: [{ id: 'unchanged' }],
} });
afterEach(() => vi.unstubAllEnvs());

describe.each(['salesforce', 'shopify'])('%s monitor credential-only maintenance', provider => {
  it('renews the exact expired connection once, including duplicate source references', async () => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32)); const snapshot = fixture(provider);
    snapshot.rows.revenueSources.push({ ...snapshot.rows.revenueSources[0], id: 'second' }); const before = JSON.stringify(snapshot);
    const request = vi.fn(async (_url: any, _options: any) => new Response('{"status":"ready"}'));
    expect(await renewFinancialMonitorCredentials(snapshot, baseUrl, request)).toBe(true); expect(request).toHaveBeenCalledTimes(1);
    expect(String(request.mock.calls[0][0])).toBe(`${baseUrl}/api/${provider}/${campaignId}/monitor/renew-token`);
    expect(JSON.parse(request.mock.calls[0][1].body)).toEqual({ connectionId }); expect(JSON.stringify(snapshot)).toBe(before);
  });
  it('skips valid or inactive connections and fails closed for wrong campaign/ambiguous identity', async () => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32)); const snapshot = fixture(provider), request = vi.fn();
    const connection = snapshot.rows[provider + 'Connections'][0], future = new Date(Date.now() + 3600000).toISOString();
    connection.expiresAt = future; connection.mappingConfig = JSON.stringify({ authType: 'oauth', accessTokenExpiresAt: future });
    expect(await renewFinancialMonitorCredentials(snapshot, baseUrl, request)).toBe(false);
    connection.campaignId = 'other'; await expect(renewFinancialMonitorCredentials(snapshot, baseUrl, request)).rejects.toThrow('SCOPE_UNVERIFIED');
    connection.campaignId = campaignId; snapshot.rows[provider + 'Connections'].push({ ...connection });
    await expect(renewFinancialMonitorCredentials(snapshot, baseUrl, request)).rejects.toThrow('SCOPE_UNVERIFIED'); expect(request).not.toHaveBeenCalled();
    snapshot.rows.revenueSources[0].isActive = false; expect(await renewFinancialMonitorCredentials(snapshot, baseUrl, request)).toBe(false);
  });
  it.each([401, 409, 503])('reports renewal failure %s without accepting it as verified', async status => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32));
    await expect(renewFinancialMonitorCredentials(fixture(provider), baseUrl, vi.fn(async () => new Response('{}', { status })))).rejects.toThrow('RENEWAL_UNAVAILABLE');
  });
  it('permits only exact pinned credential-maintenance requests', async () => {
    const request = vi.fn(async () => new Response('{}')), guarded = readOnlyMonitorFetch(request, baseUrl);
    const endpoint = `${baseUrl}/api/${provider}/${campaignId}/monitor/renew-token`;
    await guarded(endpoint, { method: 'POST', body: JSON.stringify({ connectionId }) }); expect(request).toHaveBeenCalledTimes(1);
    for (const [url, body] of [[endpoint.replace(baseUrl, 'https://other.test'), { connectionId }], [endpoint.replace('renew-token', 'refresh'), { connectionId }], [endpoint, { connectionId, force: true }]]) {
      await expect(guarded(String(url), { method: 'POST', body: JSON.stringify(body) })).rejects.toThrow('BLOCKED');
    }
  });
});
it('does not renew Shopify manual tokens and does detect its OAuth expiry inside mappingConfig', async () => {
  const snapshot = fixture('shopify'), connection = snapshot.rows.shopifyConnections[0], request = vi.fn(async () => new Response('{"status":"ready"}'));
  vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32)); connection.expiresAt = undefined;
  expect(await renewFinancialMonitorCredentials(snapshot, baseUrl, request)).toBe(true);
  connection.mappingConfig = '{"authType":"token"}'; expect(await renewFinancialMonitorCredentials(snapshot, baseUrl, request)).toBe(false); expect(request).toHaveBeenCalledTimes(1);
});
it('accepts only credential changes, including Shopify expiry fields, preserving every source and publication field', () => {
  const before = fixture('shopify'); Object.assign(before.rows, { salesforceConnections: fixture('salesforce').rows.salesforceConnections });
  const after = structuredClone(before); Object.assign(after.rows.salesforceConnections[0], { accessToken: 'new', refreshToken: 'new', encryptedTokens: { v: 1 }, expiresAt: 'later' });
  const shop = after.rows.shopifyConnections[0]; Object.assign(shop, { accessToken: 'new', refreshToken: 'new', encryptedTokens: { v: 1 } });
  shop.mappingConfig = JSON.stringify({ ...JSON.parse(shop.mappingConfig), accessTokenExpiresAt: 'later', refreshTokenExpiresAt: 'later', tokenUpdatedAt: 'now' });
  expect(financialCredentialRenewalPreservesInputs(before, after)).toBe(true);
  for (const change of [(s: any) => s.rows.revenueRecords[0].revenue++, (s: any) => s.campaign.lastRefresh = 'changed',
    (s: any) => s.rows.salesforceConnections[0].instanceUrl = 'changed', (s: any) => s.rows.shopifyConnections[0].mappingConfig = '{"authType":"token"}',
    (s: any) => s.rows.revenueSources[0].mappingConfig.connectionId = 'other', (s: any) => s.rows.shopifyConnections[0].isActive = false]) {
    const copy = structuredClone(after); change(copy); expect(financialCredentialRenewalPreservesInputs(before, copy)).toBe(false);
  }
});
it.each(['Google Ads', 'Google Sheets'])('%s OAuth expired-token recovery is in memory and fail-closed', async () => {
  const connection = { isActive: true, accessToken: 'expired', expiresAt: new Date(0).toISOString(), refreshToken: 'refresh', clientId: 'client', clientSecret: 'secret' };
  const before = JSON.stringify(connection), request = vi.fn(async () => new Response('{"access_token":"renewed","expires_in":3600}'));
  expect(await googleMonitorCredential(connection, readOnlyMonitorFetch(request))).toBe('renewed'); expect(JSON.stringify(connection)).toBe(before);
  await expect(googleMonitorCredential(connection, vi.fn(async () => new Response('{}', { status: 400 })))).rejects.toThrow('AUTH_UNVERIFIED');
});
