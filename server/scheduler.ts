import { storage } from './storage';

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

export async function aggregateCampaignMetrics(campaignId: string): Promise<SnapshotMetrics & { detailedMetrics: any }> {
  // Fetch LinkedIn metrics
  let linkedinMetrics: any = {};
  try {
    const latestSession = await storage.getLatestLinkedInImportSession(campaignId);
    if (latestSession) {
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
  try {
    const customIntegration = await storage.getLatestCustomIntegrationMetrics(campaignId);
    if (customIntegration) {
      customIntegrationData = customIntegration;
    }
  } catch (err) {
    console.log(`No custom integration metrics found for campaign ${campaignId}`);
  }

  // Fetch Meta metrics (sum daily metrics across all dates)
  let metaData = { impressions: 0, clicks: 0, spend: 0, conversions: 0 };
  try {
    const metaConnection = await storage.getMetaConnection(campaignId);
    if (metaConnection) {
      const dailyMetrics = await storage.getMetaDailyMetrics(campaignId, '2000-01-01', '2099-12-31');
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
      const daily = await storage.getGA4DailyMetrics(campaignId, String(ga4Conn.propertyId), '2000-01-01', '2099-12-31');
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

  // Aggregate metrics from ALL connected sources
  // MUST match Performance Summary (campaign-performance.tsx) calculation exactly
  const linkedinClicks = parseNum(linkedinMetrics.clicks);
  const ciClicks = parseNum(customIntegrationData.clicks);
  const metaClicks = metaData.clicks;
  // LinkedIn stores engagement as singular 'engagement' from the API
  const linkedinEngagement = parseNum(linkedinMetrics.engagement);
  const ciEngagements = parseNum(customIntegrationData.engagements);
  const ciSessions = parseNum(customIntegrationData.sessions);

  // Double-counting prevention: GA4 and CI both track website analytics.
  // When GA4 is connected, prefer GA4 for web metrics; otherwise use CI.
  const webPageviews = ga4Connected ? ga4Data.pageviews : parseNum(customIntegrationData.pageviews);
  const webSessions = ga4Connected ? ga4Data.sessions : ciSessions;

  // Advertising metrics: LinkedIn + CI(ads) + Meta — no overlap
  const advertisingImpressions = parseNum(linkedinMetrics.impressions) + parseNum(customIntegrationData.impressions) + metaData.impressions;
  const totalImpressions = advertisingImpressions + webPageviews;
  const advertisingEngagements = linkedinClicks + linkedinEngagement + ciClicks + ciEngagements + metaClicks;
  const totalEngagements = advertisingEngagements + webSessions;
  const totalClicks = linkedinClicks + ciClicks + metaClicks;
  const totalConversions = parseNum(linkedinMetrics.conversions) + parseNum(customIntegrationData.conversions) + metaData.conversions;
  const totalLeads = parseNum(linkedinMetrics.leads) + parseNum(customIntegrationData.leads);
  const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend) + metaData.spend;

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
  };
  
  return {
    totalImpressions: Math.round(totalImpressions),
    totalEngagements: Math.round(totalEngagements),
    totalClicks: Math.round(totalClicks),
    totalConversions: Math.round(totalConversions),
    totalLeads: Math.round(totalLeads),
    totalSpend: parseFloat(totalSpend.toFixed(2)),
    detailedMetrics
  };
}

/**
 * Record current metrics for a single campaign after a platform sync (LinkedIn refresh, CI upload, etc.)
 */
export async function recordCampaignMetrics(campaignId: string): Promise<void> {
  try {
    const metrics = await aggregateCampaignMetrics(campaignId);
    if (metrics.totalImpressions > 0 || metrics.totalClicks > 0 || metrics.totalSpend > 0) {
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
        
        // Only create snapshot if there's actual data
        if (metrics.totalImpressions > 0 || metrics.totalClicks > 0 || metrics.totalSpend > 0) {
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
    
    // Run immediately on startup
    createSnapshotsForAllCampaigns();
    
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
