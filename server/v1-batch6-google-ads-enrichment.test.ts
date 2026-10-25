import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixtures = vi.hoisted(() => ({
  getCampaign: vi.fn(), getGA4Connections: vi.fn(), getAcquisitionBreakdown: vi.fn(),
}));
vi.mock('./storage', () => ({ storage: fixtures }));
vi.mock('./analytics', () => ({ ga4Service: fixtures }));
import { enrichPlatformWithGA4Revenue } from './utils/ga4RevenueEnrichment';

beforeEach(() => {
  vi.clearAllMocks();
  fixtures.getCampaign.mockResolvedValue({ id: 'a', ownerId: 'owner-a' });
  fixtures.getGA4Connections.mockResolvedValue([{ propertyId: 'property-a', isPrimary: true }]);
  fixtures.getAcquisitionBreakdown.mockResolvedValue({ rows: [{ campaign: 'launch', revenue: 100 }] });
});

describe('Google Ads campaign-name enrichment exclusion', () => {
  it.each([null, '{"one":"launch","two":"launch"}'])('refuses unverified attribution before reads or writes: %s', campaignUtmMap => {
    const getMetrics = vi.fn(async () => [
      { platformCampaignId: 'one', platformCampaignName: 'launch ads', date: '2026-10-01', spend: 10 },
      { platformCampaignId: 'two', platformCampaignName: 'launch campaign', date: '2026-10-24', spend: 90 },
    ]);
    const writeUpdates = vi.fn(async () => ({ updated: 2 }));
    return expect(enrichPlatformWithGA4Revenue({ campaignId: 'a', campaignUtmMap, platformLabel: 'Google Ads', getMetrics, writeUpdates }))
      .rejects.toThrow('Google Ads GA4 attribution is unavailable').then(() => {
        expect(fixtures.getCampaign).not.toHaveBeenCalled();
        expect(fixtures.getAcquisitionBreakdown).not.toHaveBeenCalled();
        expect(getMetrics).not.toHaveBeenCalled();
        expect(writeUpdates).not.toHaveBeenCalled();
      });
  });
  it('leaves the deferred Meta implementation unchanged, without certifying its allocation', async () => {
    const writeUpdates = vi.fn(async () => ({ updated: 1 }));
    const result = await enrichPlatformWithGA4Revenue({ campaignId: 'a', campaignUtmMap: null, platformLabel: 'Meta',
      getMetrics: async () => [{ platformCampaignId: 'one', platformCampaignName: 'launch', date: '2026-10-01', spend: 10 }], writeUpdates });
    expect(result.enriched).toBe(1);
    expect(writeUpdates).toHaveBeenCalledOnce();
  });
});
