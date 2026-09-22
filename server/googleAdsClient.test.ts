import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('axios', () => ({ default: { create: mocks.create, get: mocks.get, post: mocks.post } }));

import { GoogleAdsClient, mapGoogleAdsDailyInsights } from './googleAdsClient';

describe('Google Ads REST SearchStream', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.create.mockImplementation(() => ({ post: mocks.post }));
  });

  const client = () => new GoogleAdsClient({
    accessToken: 'token', developerToken: 'developer-token', customerId: '123-456',
  });

  it('omits the sunset developer-token header when absent and retains it for existing clients', async () => {
    mocks.get.mockResolvedValue({ data: { resourceNames: ['customers/123456'] } });
    mocks.post.mockResolvedValue({ data: [{ results: [{ customer: { id: '123456' } }] }] });
    const spendClient = new GoogleAdsClient({ accessToken: 'token', developerToken: '', customerId: '123-456' });
    await spendClient.getAccessibleCustomers();
    expect(mocks.create.mock.calls[0][0].headers).not.toHaveProperty('developer-token');
    expect(mocks.get.mock.calls[0][1].headers).not.toHaveProperty('developer-token');
    expect(mocks.create.mock.calls[1][0].headers).not.toHaveProperty('developer-token');
    client();
    expect(mocks.create.mock.calls[2][0].headers['developer-token']).toBe('developer-token');
  });

  it('uses a supported API version and reads every customer and campaign batch', async () => {
    mocks.get.mockResolvedValue({ data: { resourceNames: ['customers/123456'] } });
    mocks.post.mockResolvedValueOnce({ data: [
      { results: [] },
      { results: [{ customer: { id: '123456', descriptiveName: 'Account', manager: false, currencyCode: 'EUR', timeZone: 'Europe/Amsterdam' } }] },
    ] }).mockResolvedValueOnce({ data: [
      { results: [{ campaign: { id: '1', name: 'One', status: 'ENABLED', resourceName: 'campaigns/1' } }] },
      { results: [{ campaign: { id: '2', name: 'Two', status: 'PAUSED', resourceName: 'campaigns/2' } }] },
    ] });

    const ads = client();
    expect(await ads.getAccessibleCustomers()).toMatchObject([{ id: '123456', currencyCode: 'EUR' }]);
    expect(await ads.getCampaigns()).toHaveLength(2);
    expect(mocks.get.mock.calls[0][0]).toContain('/v25/customers:listAccessibleCustomers');
    expect(mocks.create.mock.calls[0][0].baseURL).toContain('/v25/customers/123456');
  });

  it('includes daily spend from every stream batch and keeps the selected campaign filter', async () => {
    mocks.post.mockResolvedValue({ data: [
      { results: [{ campaign: { id: '1', name: 'One' }, segments: { date: '2026-09-20' }, metrics: { costMicros: '1250000' } }] },
      { results: [{ campaign: { id: '2', name: 'Two' }, segments: { date: '2026-09-20' }, metrics: { costMicros: '2750000', videoTrueviewViews: '7' } }] },
    ] });

    const rows = await client().getDailyMetrics('2026-09-20', '2026-09-20', ['1', '2']);
    expect(rows.map((row) => [row.campaignId, row.costMicros])).toEqual([['1', 1250000], ['2', 2750000]]);
    expect(rows[1].videoViews).toBe(7);
    expect(mapGoogleAdsDailyInsights('campaign', rows).reduce((sum, row) => sum + Number(row.spend), 0)).toBe(4);
    expect(mocks.post.mock.calls[0][1].query).toContain('AND campaign.id IN (1, 2)');
    expect(mocks.post.mock.calls[0][1].query).toContain('metrics.video_trueview_views');
  });

  it('finds customer currency and timezone after an empty first batch', async () => {
    mocks.post.mockResolvedValue({ data: [
      { results: [] },
      { results: [{ customer: { id: '123456', currencyCode: 'EUR', timeZone: 'Europe/Amsterdam' } }] },
    ] });
    await expect(client().getCustomerAccount()).resolves.toMatchObject({
      id: '123456', currencyCode: 'EUR', timeZone: 'Europe/Amsterdam',
    });
  });

  it('rejects malformed stream batches instead of treating them as zero spend', async () => {
    mocks.post.mockResolvedValue({ data: [{ results: [] }, { results: {} }] });
    await expect(client().getDailyMetrics('2026-09-20', '2026-09-20')).rejects.toThrow('Invalid Google Ads SearchStream batch');
  });
});
