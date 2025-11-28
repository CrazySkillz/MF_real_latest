// Script to fix benchmarks that have campaign NAMES instead of IDs in specific_campaign_id
// Run with: node fix-benchmark-campaign-ids.js

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function fixBenchmarkCampaignIds() {
  try {
    console.log('🔍 Finding benchmarks with campaign names instead of IDs...\n');
    
    // Get all campaign-specific benchmarks
    const benchmarksResult = await pool.query(`
      SELECT id, name, specific_campaign_id, campaign_id
      FROM benchmarks
      WHERE apply_to = 'specific' AND specific_campaign_id IS NOT NULL;
    `);
    
    console.log(`Found ${benchmarksResult.rows.length} campaign-specific benchmarks\n`);
    
    // Get all campaigns to map names to IDs
    const campaignsResult = await pool.query(`
      SELECT id, name FROM campaigns;
    `);
    
    const campaignMap = new Map();
    campaignsResult.rows.forEach(c => {
      campaignMap.set(c.name, c.id);
    });
    
    console.log(`Loaded ${campaignMap.size} campaigns for mapping\n`);
    
    let fixed = 0;
    let skipped = 0;
    
    for (const benchmark of benchmarksResult.rows) {
      const specificCampaignId = benchmark.specific_campaign_id;
      
      // Check if it's already an ID (UUIDs are 36 chars with specific format)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (uuidRegex.test(specificCampaignId)) {
        console.log(`✓ SKIP: "${benchmark.name}" - already has valid UUID: ${specificCampaignId}`);
        skipped++;
        continue;
      }
      
      // It's a name, try to find the ID
      const campaignId = campaignMap.get(specificCampaignId);
      
      if (campaignId) {
        console.log(`🔧 FIX: "${benchmark.name}"`);
        console.log(`   FROM: ${specificCampaignId} (name)`);
        console.log(`   TO:   ${campaignId} (ID)`);
        
        await pool.query(`
          UPDATE benchmarks
          SET specific_campaign_id = $1
          WHERE id = $2;
        `, [campaignId, benchmark.id]);
        
        fixed++;
      } else {
        console.log(`⚠️  WARNING: "${benchmark.name}" - campaign "${specificCampaignId}" not found!`);
        console.log(`   This benchmark will be deleted as the campaign doesn't exist.`);
        
        await pool.query(`
          DELETE FROM benchmarks WHERE id = $1;
        `, [benchmark.id]);
      }
    }
    
    console.log(`\n✅ DONE!`);
    console.log(`   Fixed: ${fixed}`);
    console.log(`   Skipped: ${skipped}`);
    console.log(`   Deleted: ${benchmarksResult.rows.length - fixed - skipped}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

fixBenchmarkCampaignIds();

