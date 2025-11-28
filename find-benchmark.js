import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function findBenchmark() {
  try {
    console.log('\n=== SEARCHING FOR BENCHMARK: newwer ===\n');
    
    const result = await pool.query(`
      SELECT id, name, metric, campaign_id, apply_to, specific_campaign_id, created_at
      FROM benchmarks
      WHERE name ILIKE '%newwer%'
      ORDER BY created_at DESC;
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ Benchmark "newwer" NOT FOUND in database!');
      console.log('\nIt was either:');
      console.log('1. Never created (frontend error)');
      console.log('2. Deleted by the cleanup script');
      console.log('3. Named something different');
    } else {
      result.rows.forEach((row) => {
        console.log('✅ FOUND: ' + row.name);
        console.log('   ID: ' + row.id);
        console.log('   Metric: ' + row.metric);
        console.log('   Campaign ID: ' + row.campaign_id);
        console.log('   Apply To: ' + row.apply_to);
        console.log('   Specific Campaign ID: ' + row.specific_campaign_id);
        console.log('   Created: ' + row.created_at);
        console.log('');
        console.log('🔍 ANALYSIS:');
        if (row.apply_to === 'all') {
          console.log('   This is a GLOBAL benchmark');
          console.log('   It will show on campaign: ' + row.campaign_id);
        } else if (row.specific_campaign_id) {
          console.log('   This is a CAMPAIGN-SPECIFIC benchmark');
          console.log('   It will show on campaign: ' + row.specific_campaign_id);
          console.log('   It will NOT show on campaign: ' + row.campaign_id);
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

findBenchmark();

