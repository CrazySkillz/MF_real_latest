import { afterEach, describe, expect, it, vi } from 'vitest';
import { RealGA4Client } from './real-ga4-client';

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), { status, headers });
describe('V1-038/039 GA4 property discovery', () => {
  it('walks both account and property pages and deduplicates exact property IDs', async () => {
    const calls: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (raw: string) => {
      const u = new URL(raw); calls.push(raw);
      if (u.pathname.endsWith('/accounts')) return u.searchParams.has('pageToken')
        ? json({ accounts:[{name:'accounts/2'}] }) : json({ accounts:[{name:'accounts/1'}],nextPageToken:'account-page-2' });
      if (u.searchParams.get('filter') === 'parent:accounts/2') return json({ properties:[{name:'properties/202'}] });
      return u.searchParams.has('pageToken') ? json({ properties:[{name:'properties/101'},{name:'properties/102'}] })
        : json({ properties:[{name:'properties/101'}],nextPageToken:'property-page-2' });
    }));
    const client = new RealGA4Client();
    const properties = await client.fetchPropertiesFromGoogle('fixture-token');
    expect(properties.map(p => p.id)).toEqual(['101','102','202']);
    expect(calls).toHaveLength(5);
    expect(calls.every(url => new URL(url).searchParams.get('pageSize') === '200')).toBe(true);
  });
  it('returns a real empty account result without mock properties', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({})));
    const client = new RealGA4Client();
    client.storeManualConnection('fixture', {accessToken:'fixture-token',availableProperties:[{id:'stale'}]});
    expect(await client.getProperties('fixture')).toEqual([]);
    client.disconnect('fixture'); expect(await client.getProperties('fixture')).toBeNull();
  });
  it.each([401,403,429,503])('surfaces HTTP %s without returning success/empty/mock', async status => {
    const fetch = vi.fn(async () => json({}, status, {'retry-after':'60'})); vi.stubGlobal('fetch',fetch);
    await expect(new RealGA4Client().fetchPropertiesFromGoogle('fixture')).rejects.toThrow(/GA4_DISCOVERY/);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it('retries a transient request within bounds and continues the same page', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(json({},503,{'retry-after':'0'})).mockResolvedValueOnce(json({accounts:[]}));
    vi.stubGlobal('fetch',fetch);
    expect(await new RealGA4Client().fetchPropertiesFromGoogle('fixture')).toEqual([]);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch.mock.calls[0][0]).toBe(fetch.mock.calls[1][0]);
  });
  it('rejects a repeated token instead of looping or returning a partial list', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({accounts:[],nextPageToken:'same'})));
    await expect(new RealGA4Client().fetchPropertiesFromGoogle('fixture')).rejects.toThrow('PAGINATION_FAILED');
  });
  it('does not publish a first-page result if a later property page fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({accounts:[{name:'accounts/1'}]}))
      .mockResolvedValueOnce(json({properties:[{name:'properties/123'}],nextPageToken:'later'})).mockResolvedValueOnce(json({},403)));
    await expect(new RealGA4Client().fetchPropertiesFromGoogle('fixture')).rejects.toThrow('HTTP 403');
  });
});
