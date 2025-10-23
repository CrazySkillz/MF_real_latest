import { storage } from './storage';

interface SnapshotMetrics {
  totalImpressions: number;
  totalEngagements: number;
  totalClicks: number;
  totalConversions: number;
  totalSpend: number;
}

const parseNum = (val: any): number => {
  if (val === null || val === undefined || val === '') return 0;
  const num = typeof val === 'string' ? parseFloat(val) : Number(val);
  return isNaN(num) || !isFinite(num) ? 0 : num;
};

async function aggregateCampaignMetrics(campaignId: string): Promise<SnapshotMetrics> {
  // Fetch LinkedIn metrics
  let linkedinMetrics: any = {};
  try {
    const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
    if (sessions && sessions.length > 0) {
      const latestSession = sessions.sort((a: any, b: any) => 
        new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      )[0];
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
  
  // Aggregate metrics from all sources
  const totalImpressions = parseNum(linkedinMetrics.impressions) + parseNum(customIntegrationData.impressions);
  const totalEngagements = parseNum(linkedinMetrics.engagements) + parseNum(customIntegrationData.engagements);
  const totalClicks = parseNum(linkedinMetrics.clicks) + parseNum(customIntegrationData.clicks);
  const totalConversions = parseNum(linkedinMetrics.conversions) + parseNum(customIntegrationData.conversions);
  const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend);
  
  return {
    totalImpressions: Math.round(totalImpressions),
    totalEngagements: Math.round(totalEngagements),
    totalClicks: Math.round(totalClicks),
    totalConversions: Math.round(totalConversions),
    totalSpend: parseFloat(totalSpend.toFixed(2))
  };
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
            totalSpend: metrics.totalSpend.toFixed(2),
            snapshotType: 'automatic'
          });
          
          console.log(`✓ Snapshot created for campaign "${campaign.name}" (${campaign.id})`);
        } else {
          console.log(`⊗ Skipped campaign "${campaign.name}" (${campaign.id}) - no metrics data`);
        }
      } catch (error) {
        console.error(`✗ Failed to create snapshot for campaign ${campaign.id}:`, error);
      }
    }
    
    console.log('=== AUTOMATED SNAPSHOT SCHEDULER COMPLETED ===\n');
  } catch (error) {
    console.error('Automated snapshot scheduler error:', error);
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
