// Migration runner for Phase 2 daily granularity
// Run with: node run-migration.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to Render database...');
    
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', '0006_add_daily_spend_revenue_granularity.sql');
    console.log('📂 Reading migration:', migrationPath);
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('⚙️  Executing migration (this may take 1-2 minutes)...\n');
    
    // Execute migration
    await pool.query(migrationSQL);
    
    console.log('\n✅ Migration completed successfully!');
    console.log('   - Added source_type columns to spend_records and revenue_records');
    console.log('   - Created performance indexes');
    console.log('   - Backfilled historical data from LinkedIn and GA4');
    
    // Verify
    console.log('\n🔍 Verifying migration...');
    const verify = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM spend_records) as spend_count,
        (SELECT COUNT(*) FROM revenue_records) as revenue_count,
        (SELECT COUNT(*) FROM spend_records WHERE source_type = 'linkedin_api') as linkedin_spend,
        (SELECT COUNT(*) FROM revenue_records WHERE source_type = 'ga4') as ga4_revenue
    `);
    
    console.log('✅ Database updated:');
    console.log('   - Total spend records:', verify.rows[0].spend_count);
    console.log('   - Total revenue records:', verify.rows[0].revenue_count);
    console.log('   - LinkedIn spend records:', verify.rows[0].linkedin_spend);
    console.log('   - GA4 revenue records:', verify.rows[0].ga4_revenue);
    console.log('\n🎉 Daily granularity features are now active!');
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await pool.end();
    console.log('\n🔌 Database connection closed.');
  }
}

runMigration();

