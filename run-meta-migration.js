import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://mf_db_pjsn_user:zSdfB0AuPeDicWXzjfIaaii01cKrel8C@dpg-d4b0ndre5dus73f77obg-a.oregon-postgres.render.com/mf_db_pjsn',
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connected.');

    const migrationSql = `
      -- Create meta_connections table for Meta/Facebook Ads integration
      CREATE TABLE IF NOT EXISTS meta_connections (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        campaign_id TEXT NOT NULL,
        ad_account_id TEXT NOT NULL,
        ad_account_name TEXT,
        access_token TEXT,
        refresh_token TEXT,
        method TEXT NOT NULL,
        expires_at TIMESTAMP,
        connected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );

      -- Create index for faster lookups by campaign_id
      CREATE INDEX IF NOT EXISTS idx_meta_connections_campaign_id ON meta_connections(campaign_id);
    `;

    console.log('Executing migration...');
    await client.query(migrationSql);
    console.log('✅ Migration successful! Table "meta_connections" created.');

    // Verify the table was created
    const verifySql = `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'meta_connections'
      ORDER BY ordinal_position;
    `;
    const result = await client.query(verifySql);
    if (result.rows.length > 0) {
      console.log(`✅ Verified: meta_connections table exists with ${result.rows.length} columns:`);
      result.rows.forEach(col => {
        console.log(`   - ${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.error('❌ Verification failed: meta_connections table not found after migration.');
    }

    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();

