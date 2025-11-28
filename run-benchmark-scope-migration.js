// Migration script to add applyTo and specificCampaignId columns to benchmarks table
// Run with: node run-benchmark-scope-migration.js

import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migrations', '0002_add_benchmark_scope_fields.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Running migration: 0002_add_benchmark_scope_fields.sql');
    console.log('SQL:', migrationSQL);
    
    // Run the migration
    await pool.query(migrationSQL);
    
    console.log('✅ Migration successful!');
    
    // Verify the columns were added
    const verify = await pool.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'benchmarks' 
        AND column_name IN ('apply_to', 'specific_campaign_id')
      ORDER BY column_name;
    `);
    
    if (verify.rows.length === 2) {
      console.log('✅ Verified: Both columns added successfully');
      verify.rows.forEach(row => {
        console.log(`   - ${row.column_name}: ${row.data_type} (default: ${row.column_default || 'NULL'})`);
      });
    } else {
      console.log('⚠️  Warning: Expected 2 columns, found', verify.rows.length);
      console.log('   Columns found:', verify.rows);
    }
    
    // Check indexes
    const indexes = await pool.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'benchmarks'
        AND (indexname LIKE '%apply_to%' OR indexname LIKE '%specific_campaign%')
      ORDER BY indexname;
    `);
    
    if (indexes.rows.length > 0) {
      console.log('✅ Indexes created:');
      indexes.rows.forEach(row => {
        console.log(`   - ${row.indexname}`);
      });
    } else {
      console.log('⚠️  Warning: No indexes found for new columns');
    }
    
    console.log('\n🎉 Migration complete! Benchmarks can now be scoped to all campaigns or specific campaigns.');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

