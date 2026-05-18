import { storage } from './storage';
import { buildPerformanceSummaryAggregate } from './utils/performance-summary-aggregate';

interface SnapshotMetrics {
  totalImpressions: number;
  totalEngagements: number;
  totalClicks: number;
  totalConversions: number;
  totalLeads: number;
  totalSpend: number;
}

const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

const hasSnapshotMetricValue = (metrics: SnapshotMetrics & { detailedMetrics: any }) => {
  const totals = metrics.detailedMetrics?.performanceSummary?.totals || {};
  return metrics.totalImpressions > 0
    || metrics.totalClicks > 0
    || metrics.totalConversions > 0
    || metrics.totalLeads > 0
    || metrics.totalSpend > 0
    || parseNum(totals.sessions?.value) > 0
    || parseNum(totals.users?.value) > 0
    || parseNum(totals.revenue?.value) > 0;
};

export async function aggregateCampaignMetrics(campaignId: string): Promise<SnapshotMetrics & { detailedMetrics: any }> {
  const endDate = new Date().toISOString().slice(0, 10);
  const startDateObj = new Date();
  startDateObj.setDate(startDateObj.getDate() - 90);
  const startDate = startDateObj.toISOString().slice(0, 10);

  // Fetch LinkedIn metrics
  let linkedinMetrics: any = {};
  let linkedinConnected = false;
  let linkedinLastImportedAt: any = null;
  try {
    const latestSession = await storage.getLatestLinkedInImportSession(campaignId);
    if (latestSession) {
      linkedinConnected = true;
      linkedinLastImportedAt = (latestSession as any).uploadedAt || (latestSession as any).createdAt || null;
      const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
      
      metrics.forEach((m: any) => {
        const value = parseFloat(m.metricValue || '0');
        const key = m.metricKey.toLowerCase();
        linkedinMetrics[key] = (linkedinMetrics[key] || 0) + value;
      });
    }
  } catch (err) {
    console.log(`No LinkedIn metrics found for campaign ${campaignId}`);
  }
  
  // Fetch Custom Integration metrics
  let customIntegrationData: any = {};
  let customIntegrationConnected = false;
  try {
    const customIntegration = await storage.getLatestCustomIntegrationMetrics(campaignId);
    if (customIntegration) {
      customIntegrationConnected = true;
      customIntegrationData = customIntegration;
    }
  } catch (err) {
    console.log(`No custom integration metrics found for campaign ${campaignId}`);
  }

  // Fetch Meta metrics (sum daily metrics across all dates)
  let metaData = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
  let metaConnected = false;
  try {
    const metaConnection = await storage.getMetaConnection(campaignId);
    if (metaConnection) {
      metaConnected = true;
      const dailyMetrics = await storage.getMetaDailyMetrics(campaignId, startDate, endDate);
      metaData = {
        impressions: dailyMetrics.reduce((s: number, m: any) => s + (m.impressions || 0), 0),
        clicks: dailyMetrics.reduce((s: number, m: any) => s + (m.clicks || 0), 0),
        spend: dailyMetrics.reduce((s: number, m: any) => s + parseNum(m.spend), 0),
        conversions: dailyMetrics.reduce((s: number, m: any) => s + (m.conversions || 0), 0),
      };
    }
  } catch (err) {
    console.log(`No Meta metrics found for campaign ${campaignId}`);
  }

  // Fetch GA4 metrics (website analytics)
  let ga4Data = { sessions: 0, users: 0, pageviews: 0, conversions: 0, revenue: 0 };
  let ga4Connected = false;
  try {
    const ga4Conn = await storage.getPrimaryGA4Connection(campaignId);
    if (ga4Conn) {
      ga4Connected = true;
      const daily = await storage.getGA4DailyMetrics(campaignId, String(ga4Conn.propertyId), startDate, endDate);
      ga4Data = {
        sessions: daily.reduce((s: number, m: any) => s + (m.sessions || 0), 0),
        users: daily.reduce((s: number, m: any) => s + (m.users || 0), 0),
        pageviews: daily.reduce((s: number, m: any) => s + (m.pageviews || 0), 0),
        conversions: daily.reduce((s: number, m: any) => s + (m.conversions || 0), 0),
        revenue: daily.reduce((s: number, m: any) => s + parseNum(m.revenue), 0),
      };
    }
  } catch (err) {
    console.log(`No GA4 metrics found for campaign ${campaignId}`);
  }

  // Aggregate legacy engagement only for the existing snapshot schema column.
  const linkedinClicks = parseNum(linkedinMetrics.clicks);
  const ciClicks = parseNum(customIntegrationData.clicks);
  const metaClicks = metaData.clicks;
  // LinkedIn stores engagement as singular 'engagement' from the API
  const linkedinEngagement = parseNum(linkedinMetrics.engagement);
  const ciEngagements = parseNum(customIntegrationData.engagements);
  const ciSessions = parseNum(customIntegrationData.sessions);

  // Double-counting prevention: GA4 and CI both track website analytics.
  // When GA4 is connected, prefer GA4 for web metrics; otherwise use CI.
  const webSessions = ga4Connected ? ga4Data.sessions : ciSessions;

  // Advertising metrics: LinkedIn + CI(ads) + Meta — no overlap
  const advertisingEngagements = linkedinClicks + linkedinEngagement + ciClicks + ciEngagements + metaClicks;
  const totalEngagements = advertisingEngagements + webSessions;
  const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend) + metaData.spend;

  let persistedSpend = 0;
  let spendSourceIds: string[] = [];
  try {
    const spendTotals = await storage.getSpendTotalForRange(campaignId, startDate, endDate);
    persistedSpend = parseNum((spendTotals as any)?.totalSpend);
    spendSourceIds = Array.isArray((spendTotals as any)?.sourceIds) ? (spendTotals as any).sourceIds : [];
  } catch {
    // Keep platform spend fallback if persisted spend cannot be resolved.
  }

  const revenueSources: any[] = [];
  let offsiteRevenueTotal = 0;
  try {
    const sources = await storage.getRevenueSources(campaignId, "ga4");
    const breakdown = await storage.getRevenueBreakdownBySource(campaignId, startDate, endDate, "ga4");
    for (const source of sources as any[]) {
      const match = (breakdown as any[]).find((row: any) => String(row?.sourceId) === String(source?.id));
      const lastTotalRevenue = parseNum(match?.revenue);
      revenueSources.push({
        type: String(source?.sourceType || "source"),
        connected: true,
        lastTotalRevenue,
        platformContext: (source as any)?.platformContext || "ga4",
      });
      offsiteRevenueTotal += lastTotalRevenue;
    }
  } catch {
    // Keep GA4 onsite revenue only if external revenue cannot be resolved.
  }

  const performanceSummary = buildPerformanceSummaryAggregate({
    campaignId,
    dateRange: "90days",
    ga4: { connected: ga4Connected, ...ga4Data },
    webAnalytics: {
      connected: ga4Connected || customIntegrationConnected,
      provider: ga4Connected ? "ga4" : customIntegrationConnected ? "custom_integration" : null,
      revenue: ga4Connected ? ga4Data.revenue : parseNum(customIntegrationData.revenue),
      conversions: ga4Connected ? ga4Data.conversions : parseNum(customIntegrationData.conversions),
      sessions: ga4Connected ? ga4Data.sessions : parseNum(customIntegrationData.sessions),
      users: ga4Connected ? ga4Data.users : parseNum(customIntegrationData.users),
    },
    spend: {
      persistedSpend,
      unifiedSpend: persistedSpend > 0 ? persistedSpend : totalSpend,
      spendSource: spendSourceIds.length > 0 ? "persisted_spend_sources" : "platform_spend_fallback",
      sourceIds: spendSourceIds,
    },
    platforms: {
      linkedin: { connected: linkedinConnected, ...linkedinMetrics, lastImportedAt: linkedinLastImportedAt },
      meta: { connected: metaConnected, ...metaData },
      customIntegration: { connected: customIntegrationConnected, ...customIntegrationData },
    },
    revenue: {
      onsiteRevenue: ga4Data.revenue,
      offsiteRevenue: parseFloat(offsiteRevenueTotal.toFixed(2)),
      totalRevenue: parseFloat((ga4Data.revenue + offsiteRevenueTotal).toFixed(2)),
    },
    revenueSources,
  });

  const aggregateValue = (metricName: string) => {
    const metric = (performanceSummary as any)?.totals?.[metricName];
    return metric?.available && metric?.value !== null ? parseNum(metric.value) : 0;
  };

  // Store detailed metrics from all sources for historical tracking
  const detailedMetrics = {
    linkedin: {
      impressions: parseNum(linkedinMetrics.impressions),
      clicks: parseNum(linkedinMetrics.clicks),
      totalEngagements: parseNum(linkedinMetrics.engagement) + parseNum(linkedinMetrics.engagements),
      conversions: parseNum(linkedinMetrics.conversions),
      leads: parseNum(linkedinMetrics.leads),
      costInLocalCurrency: linkedinMetrics.costinlocalcurrency || linkedinMetrics.costInLocalCurrency || '0',
    },
    customIntegration: {
      impressions: parseNum(customIntegrationData.impressions),
      clicks: parseNum(customIntegrationData.clicks),
      engagements: parseNum(customIntegrationData.engagements),
      conversions: parseNum(customIntegrationData.conversions),
      leads: parseNum(customIntegrationData.leads),
      spend: customIntegrationData.spend || '0',
      sessions: parseNum(customIntegrationData.sessions),
      users: parseNum(customIntegrationData.users),
      pageviews: parseNum(customIntegrationData.pageviews),
    },
    meta: {
      impressions: metaData.impressions,
      clicks: metaData.clicks,
      spend: metaData.spend,
      conversions: metaData.conversions,
    },
    ga4: {
      sessions: ga4Data.sessions,
      users: ga4Data.users,
      pageviews: ga4Data.pageviews,
      conversions: ga4Data.conversions,
      revenue: ga4Data.revenue,
    },
    webAnalyticsProvider: ga4Connected ? 'ga4' : 'custom_integration',
    performanceSummary,
  };
  
  return {
    totalImpressions: Math.round(aggregateValue("impressions")),
    totalEngagements: Math.round(totalEngagements),
    totalClicks: Math.round(aggregateValue("clicks")),
    totalConversions: Math.round(aggregateValue("conversions")),
    totalLeads: Math.round(aggregateValue("leads")),
    totalSpend: parseFloat(aggregateValue("spend").toFixed(2)),
    detailedMetrics
  };
}

/**
 * Record current metrics for a single campaign after a platform sync (LinkedIn refresh, CI upload, etc.)
 */
export async function recordCampaignMetrics(campaignId: string): Promise<void> {
  try {
    const metrics = await aggregateCampaignMetrics(campaignId);
    if (hasSnapshotMetricValue(metrics)) {
      await storage.createMetricSnapshot({
        campaignId,
        totalImpressions: metrics.totalImpressions,
        totalEngagements: metrics.totalEngagements,
        totalClicks: metrics.totalClicks,
        totalConversions: metrics.totalConversions,
        totalLeads: metrics.totalLeads,
        totalSpend: metrics.totalSpend.toFixed(2),
        metrics: metrics.detailedMetrics,
        snapshotType: 'platform_sync'
      });
      console.log(`[Metrics] Recorded data point for campaign ${campaignId} after platform sync`);
    }
  } catch (error: any) {
    console.error(`[Metrics] Failed to record data point for campaign ${campaignId}:`, error?.message || error);
  }
}

async function createSnapshotsForAllCampaigns() {
  console.log('=== AUTOMATED SNAPSHOT SCHEDULER RUNNING ===');
  console.log('Timestamp:', new Date().toISOString());
  
  try {
    const campaigns = await storage.getCampaigns();
    console.log(`Found ${campaigns.length} campaigns`);
    
    for (const campaign of campaigns) {
      try {
        const metrics = await aggregateCampaignMetrics(campaign.id);
        
        // Only create snapshot if there's actual aggregate data
        if (hasSnapshotMetricValue(metrics)) {
          const snapshot = await storage.createMetricSnapshot({
            campaignId: campaign.id,
            totalImpressions: metrics.totalImpressions,
            totalEngagements: metrics.totalEngagements,
            totalClicks: metrics.totalClicks,
            totalConversions: metrics.totalConversions,
            totalLeads: metrics.totalLeads,
            totalSpend: metrics.totalSpend.toFixed(2),
            metrics: metrics.detailedMetrics,
            snapshotType: 'automatic'
          });
          
          console.log(`✓ Snapshot created for campaign "${campaign.name}" (${campaign.id})`);
        } else {
          console.log(`⊗ Skipped campaign "${campaign.name}" (${campaign.id}) - no metrics data`);
        }
      } catch (error: any) {
        // Log error but continue with other campaigns
        console.error(`✗ Failed to create snapshot for campaign ${campaign.id}:`, error?.message || error);
      }
    }
    
    console.log('=== AUTOMATED SNAPSHOT SCHEDULER COMPLETED ===\n');
  } catch (error: any) {
    // Handle connection errors gracefully
    if (error?.message?.includes('Connection terminated') || error?.message?.includes('ECONNREFUSED')) {
      console.error('⚠️ Database connection error in scheduler - will retry on next run:', error?.message);
    } else {
      console.error('Automated snapshot scheduler error:', error?.message || error);
    }
  }
}

export class SnapshotScheduler {
  private intervalId: NodeJS.Timeout | null = null;
  private frequency: 'hourly' | 'daily' | 'weekly' = 'daily';
  
  constructor(frequency?: 'hourly' | 'daily' | 'weekly') {
    // Read from environment variable or use provided frequency or default to 'daily'
    const envFrequency = process.env.SNAPSHOT_FREQUENCY as 'hourly' | 'daily' | 'weekly' | undefined;
    this.frequency = envFrequency || frequency || 'daily';
  }
  
  start() {
    if (this.intervalId) {
      console.log('Snapshot scheduler is already running');
      return;
    }
    
    const intervals = {
      hourly: 60 * 60 * 1000,      // 1 hour
      daily: 24 * 60 * 60 * 1000,  // 24 hours
      weekly: 7 * 24 * 60 * 60 * 1000  // 7 days
    };
    
    const interval = intervals[this.frequency];
    
    console.log(`\n🕐 Snapshot Scheduler Started`);
    console.log(`   Frequency: ${this.frequency}`);
    console.log(`   Next run: ${new Date(Date.now() + interval).toLocaleString()}\n`);
    
    // Delay first run to let the HTTP server respond to health checks first
    setTimeout(() => createSnapshotsForAllCampaigns(), 30000);

    // Then schedule regular runs
    this.intervalId = setInterval(() => {
      createSnapshotsForAllCampaigns();
    }, interval);
  }
  
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Snapshot scheduler stopped');
    }
  }
  
  setFrequency(frequency: 'hourly' | 'daily' | 'weekly') {
    this.frequency = frequency;
    if (this.intervalId) {
      this.stop();
      this.start();
    }
  }
  
  getStatus() {
    const intervals = {
      hourly: 60 * 60 * 1000,
      daily: 24 * 60 * 60 * 1000,
      weekly: 7 * 24 * 60 * 60 * 1000
    };
    
    const interval = intervals[this.frequency];
    
    return {
      running: this.intervalId !== null,
      frequency: this.frequency,
      nextRun: this.intervalId ? new Date(Date.now() + interval).toISOString() : null
    };
  }
}

// Export singleton instance
export const snapshotScheduler = new SnapshotScheduler();
