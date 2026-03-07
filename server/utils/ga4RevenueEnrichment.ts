/**
 * Shared GA4 Revenue Enrichment Utility
 * Generic function that enriches any ad platform's daily metrics with GA4-attributed revenue.
 * Used by Google Ads, Meta, and LinkedIn schedulers.
 */

import { storage } from "../storage";
import { ga4Service } from "../analytics";
import { matchUtmCampaignName } from "./campaignNameMatch";

interface PlatformMetricRow {
  platformCampaignId: string;
  platformCampaignName: string;
  date: string;
  spend: number;
}

interface GA4RevenueUpdate {
  platformCampaignId: string;
  date: string;
  ga4Revenue: string;
  ga4UtmName: string;
}

interface EnrichmentResult {
  enriched: number;
  matched: number;
  unmatched: string[];
}

export async function enrichPlatformWithGA4Revenue(params: {
  campaignId: string;
  campaignUtmMap: string | null;
  platformLabel: string;
  getMetrics: () => Promise<PlatformMetricRow[]>;
  writeUpdates: (updates: GA4RevenueUpdate[]) => Promise<{ updated: number }>;
}): Promise<EnrichmentResult> {
  const { campaignId, campaignUtmMap, platformLabel, getMetrics, writeUpdates } = params;

  // Get campaign record for GA4 filter
  const campaign = await storage.getCampaign(campaignId);
  if (!campaign) return { enriched: 0, matched: 0, unmatched: [] };

  // Check if there's a GA4 connection
  const ga4Connections = await storage.getGA4Connections(campaignId);
  if (!ga4Connections || ga4Connections.length === 0) {
    return { enriched: 0, matched: 0, unmatched: [] };
  }
  const ga4Connection = (ga4Connections as any[]).find((c: any) => c?.isPrimary) || ga4Connections[0];

  // Parse campaign filter
  const rawFilter = (campaign as any).ga4CampaignFilter;
  let campaignFilter: string | string[] | undefined;
  if (rawFilter) {
    const s = String(rawFilter).trim();
    if (s.startsWith('[')) {
      try { campaignFilter = JSON.parse(s); } catch { campaignFilter = s; }
    } else {
      campaignFilter = s;
    }
  }

  // Get GA4 breakdown (per-UTM-campaign revenue)
  let breakdownRows: Array<{ campaign: string; revenue: number }>;
  try {
    const breakdown = await ga4Service.getAcquisitionBreakdown(
      campaignId,
      storage,
      '90daysAgo',
      ga4Connection.propertyId,
      2000,
      campaignFilter
    );
    breakdownRows = (breakdown?.rows || []).map((r: any) => ({
      campaign: String(r.campaign || '(not set)'),
      revenue: Number(r.revenue || 0),
    }));
  } catch (e: any) {
    console.warn(`[${platformLabel} GA4 Enrichment] Failed to get GA4 breakdown for campaign ${campaignId}:`, e.message);
    return { enriched: 0, matched: 0, unmatched: [] };
  }

  // Build map of UTM campaign name → total revenue
  const utmRevenueMap = new Map<string, number>();
  for (const row of breakdownRows) {
    if (row.campaign === '(not set)') continue;
    const existing = utmRevenueMap.get(row.campaign) || 0;
    utmRevenueMap.set(row.campaign, existing + row.revenue);
  }

  if (utmRevenueMap.size === 0) {
    return { enriched: 0, matched: 0, unmatched: [] };
  }

  // Get platform metrics
  const metrics = await getMetrics();
  if (!metrics || metrics.length === 0) {
    return { enriched: 0, matched: 0, unmatched: [] };
  }

  // Parse manual mapping
  const manualMap: Record<string, string> = campaignUtmMap
    ? JSON.parse(campaignUtmMap)
    : {};

  // Group metrics by platform campaign
  const utmNames = Array.from(utmRevenueMap.keys());
  const campaignGroups = new Map<string, { campaignName: string; totalSpend: number; rows: PlatformMetricRow[] }>();
  for (const m of metrics) {
    const group = campaignGroups.get(m.platformCampaignId) || { campaignName: m.platformCampaignName, totalSpend: 0, rows: [] };
    group.totalSpend += m.spend;
    group.rows.push(m);
    campaignGroups.set(m.platformCampaignId, group);
  }

  // Match and distribute revenue
  const updates: GA4RevenueUpdate[] = [];
  const matched: string[] = [];
  const unmatched: string[] = [];

  for (const [pcId, group] of campaignGroups) {
    const utmMatch = matchUtmCampaignName(group.campaignName, utmNames, manualMap, pcId);
    if (!utmMatch) {
      unmatched.push(group.campaignName);
      continue;
    }

    matched.push(group.campaignName);
    const totalGA4Revenue = utmRevenueMap.get(utmMatch) || 0;

    // Distribute revenue across dates by spend weight
    for (const row of group.rows) {
      const revenueShare = group.totalSpend > 0 ? (row.spend / group.totalSpend) * totalGA4Revenue : 0;
      updates.push({
        platformCampaignId: pcId,
        date: row.date,
        ga4Revenue: revenueShare.toFixed(2),
        ga4UtmName: utmMatch,
      });
    }
  }

  // Write updates
  let enriched = 0;
  if (updates.length > 0) {
    const result = await writeUpdates(updates);
    enriched = result.updated;
  }

  console.log(`[${platformLabel} GA4 Enrichment] Campaign ${campaignId}: ${matched.length} matched, ${unmatched.length} unmatched, ${enriched} rows enriched`);
  return { enriched, matched: matched.length, unmatched };
}
