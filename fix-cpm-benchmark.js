import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function fixBenchmark() {
  try {
    console.log('\n🔧 Fixing the cpm benchmark...\n');
    
    const result = await pool.query(`
      UPDATE benchmarks
      SET 
        specific_campaign_id = $1,
        linkedin_campaign_name = $2
      WHERE id = $3
      RETURNING name, specific_campaign_id, linkedin_campaign_name;
    `, ['9f9dfca6-bf5f-4598-85bf-826bdf890428', 'Lead Generation - Tech Professionals', 'd9a04982-624d-4c43-a74d-b36d4ba614b3']);
    
    if (result.rows.length > 0) {
      console.log('✅ Fixed:', result.rows[0].name);
      console.log('   specificCampaignId:', result.rows[0].specific_campaign_id);
      console.log('   linkedInCampaignName:', result.rows[0].linkedin_campaign_name);
    } else {
      console.log('⚠️  Benchmark not found');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

fixBenchmark();

