import { db } from './server/db';
import { benchmarks, campaigns as campaignsTable } from './shared/schema';
import { eq, and, or } from 'drizzle-orm';

async function cleanupRevenueBenchmarks() {
  console.log('🧹 Cleaning up ROI/ROAS benchmarks from campaigns without conversion value...\n');

  try {
    // Get all campaigns
    const allCampaigns = await db.select().from(campaignsTable);
    
    console.log(`Found ${allCampaigns.length} campaigns\n`);

    let totalDeleted = 0;

    for (const campaign of allCampaigns) {
      // Check if campaign has conversion value
      const hasConversionValue = campaign.conversionValue !== null && campaign.conversionValue !== undefined;
      
      if (!hasConversionValue) {
        console.log(`📋 Campaign: ${campaign.name} (${campaign.id})`);
        console.log(`   Conversion Value: ${campaign.conversionValue} (NULL - should not have ROI/ROAS benchmarks)`);
        
        // Find ROI/ROAS benchmarks for this campaign
        const revenueBenchmarks = await db
          .select()
          .from(benchmarks)
          .where(eq(benchmarks.campaignId, campaign.id));
        
        // Filter to only ROI/ROAS
        const toDelete = revenueBenchmarks.filter(b => 
          b.metric && ['roi', 'roas'].includes(b.metric.toLowerCase())
        );
        
        if (toDelete.length > 0) {
          console.log(`   ❌ Found ${toDelete.length} revenue benchmarks to delete:`);
          for (const benchmark of toDelete) {
            console.log(`      - ${benchmark.name} (${benchmark.metric})`);
            await db.delete(benchmarks).where(eq(benchmarks.id, benchmark.id));
            totalDeleted++;
          }
        } else {
          console.log(`   ✅ No revenue benchmarks found (already clean)`);
        }
        console.log('');
      } else {
        console.log(`✅ Campaign: ${campaign.name} - Has conversion value ($${campaign.conversionValue}), keeping all benchmarks\n`);
      }
    }

    console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} revenue benchmarks from campaigns without conversion value.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    process.exit(1);
  }
}

cleanupRevenueBenchmarks();

