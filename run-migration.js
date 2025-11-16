// Quick migration script to add conversion_value column
// Run with: node run-migration.js

import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    
    const result = await pool.query(`
      ALTER TABLE campaigns 
      ADD COLUMN IF NOT EXISTS conversion_value DECIMAL(10, 2);
    `);
    
    console.log('✅ Migration successful! Column "conversion_value" added.');
    
    // Verify
    const verify = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'campaigns' AND column_name = 'conversion_value';
    `);
    
    if (verify.rows.length > 0) {
      console.log('✅ Verified: conversion_value column exists');
      console.log('   Type:', verify.rows[0].data_type);
    } else {
      console.log('⚠️  Warning: Could not verify column');
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();

