import { afterEach, describe, expect, it, vi } from 'vitest';
import { renewHubspotMonitorCredentials, hubspotCredentialRenewalPreservesInputs } from './live-number-provider-checks';
import { readOnlyMonitorFetch, readOnlyMonitorDatabaseUrl } from '../scripts/check-live-numbers';
import { createHash } from 'node:crypto';
const campaignId = 'b74f98af-ede9-47af-9b19-0720ebb4d2c0', connectionId = '23d83e8d-d149-47fa-a6a1-803290f3c188';
const baseUrl = 'https://app.example.test', endpoint = `${baseUrl}/api/hubspot/${campaignId}/monitor/renew-token`;
const fixture = (): any => ({ campaign: { id: campaignId, lastRefresh: 'same' }, rows: {
  revenueSources: [{ id: 'source', campaignId, sourceType: 'hubspot', platformContext: 'ga4', isActive: true, mappingConfig: { connectionId } }],
  hubspotConnections: [{ id: connectionId, campaignId, isActive: true, accessToken: 'expired', expiresAt: new Date(0).toISOString() }],
  revenueRecords: [{ revenue: 3450 }], ga4RefreshWork: [{ id: 'unchanged' }],
} });
afterEach(() => vi.unstubAllEnvs());
describe('HubSpot monitor auth preflight', () => {
  it('renews once for a shared revenue/pipeline connection without mutating its input snapshot', async () => {
    const snapshot = fixture(), before = JSON.stringify(snapshot); snapshot.rows.revenueSources.push({ ...snapshot.rows.revenueSources[0], id: 'second' });
    const unchanged = JSON.stringify(snapshot); vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32));
    const fetcher = vi.fn(async (_url: any, _options: any) => new Response('{"status":"ready"}'));
    expect(await renewHubspotMonitorCredentials(snapshot, baseUrl, fetcher)).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1); expect(String(fetcher.mock.calls[0][0])).toBe(endpoint);
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ connectionId });
    expect(JSON.stringify(snapshot)).toBe(unchanged); expect(before).not.toBe(unchanged);
  });
  it('does not renew valid credentials, inactive sources, or other providers', async () => {
    const fetcher = vi.fn(); const snapshot = fixture(); snapshot.rows.hubspotConnections[0].expiresAt = new Date(Date.now() + 3600_000).toISOString();
    expect(await renewHubspotMonitorCredentials(snapshot, baseUrl, fetcher)).toBe(false);
    snapshot.rows.hubspotConnections[0].expiresAt = new Date(0).toISOString(); snapshot.rows.revenueSources[0].isActive = false;
    expect(await renewHubspotMonitorCredentials(snapshot, baseUrl, fetcher)).toBe(false);
    snapshot.rows.revenueSources[0].isActive = true; snapshot.rows.revenueSources[0].sourceType = 'salesforce';
    expect(await renewHubspotMonitorCredentials(snapshot, baseUrl, fetcher)).toBe(false); expect(fetcher).not.toHaveBeenCalled();
  });
  it('renews tokens close to expiry before starting the financial checks', async () => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32));
    const snapshot = fixture(); snapshot.rows.hubspotConnections[0].expiresAt = new Date(Date.now() + 3 * 60_000).toISOString();
    const request = vi.fn(async () => new Response('{"status":"ready"}'));
    expect(await renewHubspotMonitorCredentials(snapshot, baseUrl, request)).toBe(true); expect(request).toHaveBeenCalledTimes(1);
  });
  it('fails closed on absent credentials, wrong campaign or ambiguous connection', async () => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', ''); const fetcher = vi.fn();
    await expect(renewHubspotMonitorCredentials(fixture(), baseUrl, fetcher)).rejects.toThrow('RENEWAL_UNAVAILABLE');
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32));
    const wrong = fixture(); wrong.rows.hubspotConnections[0].campaignId = 'other';
    await expect(renewHubspotMonitorCredentials(wrong, baseUrl, fetcher)).rejects.toThrow('SCOPE_UNVERIFIED');
    const duplicate = fixture(); duplicate.rows.hubspotConnections.push({ ...duplicate.rows.hubspotConnections[0] });
    await expect(renewHubspotMonitorCredentials(duplicate, baseUrl, fetcher)).rejects.toThrow('SCOPE_UNVERIFIED'); expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([401, 409, 503])('keeps renewal failure %s unverified', async status => {
    vi.stubEnv('HUBSPOT_MONITOR_SECRET', 'ab'.repeat(32));
    await expect(renewHubspotMonitorCredentials(fixture(), baseUrl, vi.fn(async () => new Response('{}', { status })))).rejects.toThrow('RENEWAL_UNAVAILABLE');
  });
  it('accepts only credential changes and detects data/configuration/schedule changes', () => {
    const before = fixture(), after = structuredClone(before); Object.assign(after.rows.hubspotConnections[0], { accessToken: 'new', refreshToken: 'rotated', encryptedTokens: { v: 1 }, expiresAt: 'new' });
    expect(hubspotCredentialRenewalPreservesInputs(before, after)).toBe(true);
    for (const change of [(s: any) => s.rows.revenueRecords[0].revenue++, (s: any) => s.campaign.lastRefresh = 'changed',
      (s: any) => s.rows.hubspotConnections[0].isActive = false, (s: any) => s.rows.revenueSources[0].mappingConfig.connectionId = 'other']) {
      const copy = structuredClone(after); change(copy); expect(hubspotCredentialRenewalPreservesInputs(before, copy)).toBe(false);
    }
  });
  it('allows only the pinned app credential endpoint, preserving provider and database write blocks', async () => {
    const request = vi.fn(async () => new Response('{}')), guarded = readOnlyMonitorFetch(request, baseUrl);
    await guarded(endpoint, { method: 'POST', body: JSON.stringify({ connectionId }) }); expect(request).toHaveBeenCalledTimes(1);
    for (const [url, body] of [[endpoint.replace(baseUrl, 'https://other.test'), { connectionId }],
      [endpoint.replace('renew-token', 'refresh'), { connectionId }], [endpoint, { connectionId, refresh: true }],
      ['https://api.hubapi.com/oauth/v1/token', { grant_type: 'refresh_token' }]]) {
      await expect(guarded(String(url), { method: 'POST', body: JSON.stringify(body) })).rejects.toThrow('BLOCKED');
    }
    await expect(readOnlyMonitorFetch(request)(endpoint, { method: 'POST', body: JSON.stringify({ connectionId }) })).rejects.toThrow('BLOCKED');
    const fingerprint = createHash('sha256').update(JSON.stringify(['db.test', '5432', '/test'])).digest('hex');
    expect(new URL(readOnlyMonitorDatabaseUrl('postgres://u:p@db.test/test', fingerprint)).searchParams.get('options')).toContain('default_transaction_read_only=on');
  });
});
