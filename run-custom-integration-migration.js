import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

async function runMigration() {
  try {
    console.log('🔄 Connecting to database...');
    const client = await pool.connect();
    console.log('✅ Database connected.');

    const migrationSql = `
      ALTER TABLE custom_integrations ALTER COLUMN email DROP NOT NULL;
    `;

    console.log('Executing migration: Make email column nullable in custom_integrations');
    await client.query(migrationSql);
    console.log('✅ Migration successful! Column "email" is now nullable.');

    // Verify the column was altered
    const verifySql = `
      SELECT column_name, is_nullable, data_type
      FROM information_schema.columns
      WHERE table_name = 'custom_integrations' AND column_name = 'email';
    `;
    const result = await client.query(verifySql);
    if (result.rows.length > 0) {
      const col = result.rows[0];
      console.log(`✅ Verified: email column exists`);
      console.log(`   Type: ${col.data_type}`);
      console.log(`   Nullable: ${col.is_nullable}`);
    } else {
      console.error('❌ Verification failed: email column not found after migration.');
    }

    client.release();
  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await pool.end();
  }
}

runMigration();

