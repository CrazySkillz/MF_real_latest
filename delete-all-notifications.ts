import { db } from "./server/db";
import { notifications } from "./shared/schema";

/**
 * Delete ALL notifications from the database
 * Gives a clean slate for Option C implementation
 */

async function deleteAllNotifications() {
  console.log('🗑️  Deleting ALL notifications...');
  
  try {
    // Count before deletion
    const before = await db.select().from(notifications);
    console.log(`📊 Current notifications: ${before.length}`);
    
    // Delete all notifications
    await db.delete(notifications);
    
    // Count after deletion
    const after = await db.select().from(notifications);
    console.log(`\n✅ Deleted ${before.length} notifications`);
    console.log(`📊 Remaining notifications: ${after.length}`);
    
    console.log('\n✨ All notifications cleared!');
    console.log('   Bell icon will show: 🔔 0');
    console.log('   Fresh start for Option C (Hybrid) notification system.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error deleting notifications:', error);
    process.exit(1);
  }
}

deleteAllNotifications();

