import { describe, expect, it } from "vitest";
import { buildGA4GoogleAdsSpendMaterialization } from "./ga4-google-ads-spend";
import { mapGoogleAdsDailyInsights } from "./googleAdsClient";

describe("GA4 Insights Google Ads spend production materialization", () => {
  const rows = [
    { googleCampaignId: "a", googleCampaignName: "A", date: "2026-08-01", spend: "10.25", impressions: 100, clicks: 5 },
    { googleCampaignId: "a", googleCampaignName: "A", date: "2026-08-02", spend: "0", impressions: 50, clicks: 0 },
    { googleCampaignId: "b", googleCampaignName: "B", date: "2026-08-01", spend: "7.75", impressions: 80, clicks: 4 },
    { googleCampaignId: "outside", googleCampaignName: "Outside", date: "2026-08-01", spend: "999", impressions: 1, clicks: 1 },
  ];

  it("derives totals and dated records from selected provider rows, preserving valid zero", () => {
    const result = buildGA4GoogleAdsSpendMaterialization({
      campaignId: "campaign", currency: "EUR", accountName: "Ads", selectedCampaignIds: ["a", "b"], rows,
      startDate: "2026-08-01", endDate: "2026-08-02", fetchedAt: "2026-08-03T00:00:00.000Z",
    });
    expect(result.amount).toBe(18);
    expect(result.records).toEqual([
      { campaignId: "campaign", date: "2026-08-01", spend: "18.00", currency: "EUR", sourceType: "ad_platforms", subCampaignUrn: null },
      { campaignId: "campaign", date: "2026-08-02", spend: "0.00", currency: "EUR", sourceType: "ad_platforms", subCampaignUrn: null },
    ]);
    expect(result.mappingConfig.selectedCampaignIds).toEqual(["a", "b"]);
    expect(result.mappingConfig.breakdown.map((row) => row.spend)).toEqual([10.25, 7.75]);
  });

  it("converts the actual Google Ads micros response path exactly once", () => {
    const [row] = mapGoogleAdsDailyInsights("campaign", [{
      date: "2026-08-01", campaignId: "123", campaignName: "Paid Search",
      impressions: 100, clicks: 5, costMicros: 12_345_678, conversions: 2,
      conversionsValue: 42.5, ctr: 0.05, averageCpc: 2_469_136,
      averageCpm: 123_456_780, interactionRate: 0.05, videoViews: 0,
      searchImpressionShare: 0.25,
    }]);
    expect(row).toMatchObject({
      campaignId: "campaign", googleCampaignId: "123", date: "2026-08-01",
      spend: "12.35", cpc: "2.47", cpm: "123.46", costPerConversion: "6.17",
      conversionValue: "42.50", ctr: "5.0000", interactionRate: "5.00",
      searchImpressionShare: "25.00",
    });
  });

  it("fails closed for an unavailable selected campaign or invalid provider value", () => {
    expect(() => buildGA4GoogleAdsSpendMaterialization({
      campaignId: "campaign", currency: "EUR", accountName: "Ads", selectedCampaignIds: ["missing"], rows,
      startDate: "2026-08-01", endDate: "2026-08-02", fetchedAt: null,
    })).toThrow("unavailable");
    expect(() => buildGA4GoogleAdsSpendMaterialization({
      campaignId: "campaign", currency: "EUR", accountName: "Ads", selectedCampaignIds: ["a"],
      rows: [{ ...rows[0], spend: -1 }], startDate: "2026-08-01", endDate: "2026-08-02", fetchedAt: null,
    })).toThrow("invalid spend value");
  });

  it("materializes a verified fresh empty provider result as valid zero", () => {
    const result = buildGA4GoogleAdsSpendMaterialization({
      campaignId: "campaign", currency: "EUR", accountName: "Ads", selectedCampaignIds: ["a"], rows: [],
      startDate: "2026-08-01", endDate: "2026-08-02", fetchedAt: "2026-08-03T00:00:00.000Z",
      requireEverySelectedCampaign: false,
    });
    expect(result.amount).toBe(0);
    expect(result.records).toEqual([]);
    expect(result.mappingConfig.selectedCampaignIds).toEqual(["a"]);
  });
});
