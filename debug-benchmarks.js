// Debug script to check what benchmarks are actually in the database
// Run with: node debug-benchmarks.js

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function debugBenchmarks() {
  try {
    console.log('🔍 Querying all benchmarks...\n');
    
    const result = await pool.query(`
      SELECT 
        id,
        campaign_id,
        name,
        metric,
        apply_to,
        specific_campaign_id,
        platform_type,
        created_at
      FROM benchmarks
      ORDER BY created_at DESC
      LIMIT 20;
    `);
    
    console.log(`Found ${result.rows.length} benchmarks:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Metric: ${row.metric}`);
      console.log(`   Campaign ID: ${row.campaign_id}`);
      console.log(`   Apply To: ${row.apply_to}`);
      console.log(`   Specific Campaign ID: ${row.specific_campaign_id}`);
      console.log(`   Platform: ${row.platform_type}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
    // Check for campaign-specific benchmarks
    const specificBenchmarks = result.rows.filter(r => r.apply_to === 'specific' || r.specific_campaign_id);
    console.log(`\n📊 Campaign-specific benchmarks: ${specificBenchmarks.length}`);
    specificBenchmarks.forEach(b => {
      console.log(`   - ${b.name} → Campaign: ${b.specific_campaign_id}`);
    });
    
    // Check for global benchmarks
    const globalBenchmarks = result.rows.filter(r => r.apply_to === 'all' || !r.specific_campaign_id);
    console.log(`\n🌍 Global benchmarks: ${globalBenchmarks.length}`);
    globalBenchmarks.forEach(b => {
      console.log(`   - ${b.name} → Campaign: ${b.campaign_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    await pool.end();
  }
}

debugBenchmarks();

