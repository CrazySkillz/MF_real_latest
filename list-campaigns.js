// List all campaigns
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function listCampaigns() {
  try {
    const result = await pool.query(`
      SELECT id, name, created_at
      FROM campaigns
      ORDER BY created_at DESC;
    `);
    
    console.log(`\n📋 Found ${result.rows.length} campaigns:\n`);
    
    result.rows.forEach((row, index) => {
      console.log(`${index + 1}. ${row.name}`);
      console.log(`   ID: ${row.id}`);
      console.log(`   Created: ${row.created_at}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

listCampaigns();

