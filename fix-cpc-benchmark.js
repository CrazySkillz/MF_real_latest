import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function fixBenchmark() {
  try {
    console.log('\n🔧 Fixing the cpc benchmark...\n');
    
    const result = await pool.query(`
      UPDATE benchmarks
      SET specific_campaign_id = '9f9dfca6-bf5f-4598-85bf-826bdf890428'
      WHERE id = 'b7219882-b322-4d1a-83a8-8abc96a0704a'
      RETURNING name, specific_campaign_id;
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ Fixed:', result.rows[0].name);
      console.log('   New specificCampaignId:', result.rows[0].specific_campaign_id);
    } else {
      console.log('⚠️  Benchmark not found (may have been deleted)');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixBenchmark();

