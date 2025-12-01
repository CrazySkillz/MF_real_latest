import { db } from './server/db';
import { sql } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';

async function runMigration() {
  console.log('Running KPI campaign scope migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '0002_add_kpi_campaign_scope.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log('Migration SQL:', migrationSQL);
    
    // Execute the migration
    await db.execute(sql.raw(migrationSQL));
    
    console.log('✅ Migration completed successfully!');
    console.log('Added columns:');
    console.log('  - apply_to (default: all)');
    console.log('  - specific_campaign_id');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

runMigration()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Script failed:', error);
    process.exit(1);
  });

