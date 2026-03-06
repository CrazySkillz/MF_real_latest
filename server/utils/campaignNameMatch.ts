/**
 * Campaign Name Matching Utility
 * Matches Google Ads campaign names to GA4 UTM campaign names
 * for cross-platform revenue attribution.
 */

/**
 * Normalize a campaign name for fuzzy matching.
 * Lowercase, replace separators with spaces, strip common suffixes, collapse whitespace.
 */
export function normalizeCampaignName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[_-]/g, ' ')
    .replace(/\b(campaign|ads|ad)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Find the best matching UTM campaign name for a Google Ads campaign.
 * 3-tier lookup:
 *   1. Manual override from campaignUtmMap
 *   2. Exact case-insensitive match
 *   3. Normalized match
 */
export function matchUtmCampaignName(
  googleAdsName: string,
  utmNames: string[],
  manualMap: Record<string, string> = {},
  googleCampaignId?: string
): string | null {
  // Tier 1: manual override
  if (googleCampaignId && manualMap[googleCampaignId]) {
    const manual = manualMap[googleCampaignId];
    if (utmNames.includes(manual)) return manual;
  }

  // Tier 2: exact case-insensitive match
  const lower = googleAdsName.toLowerCase();
  const exact = utmNames.find(u => u.toLowerCase() === lower);
  if (exact) return exact;

  // Tier 3: normalized match
  const normGoogle = normalizeCampaignName(googleAdsName);
  return utmNames.find(u => normalizeCampaignName(u) === normGoogle) ?? null;
}
