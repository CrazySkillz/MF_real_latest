import { db } from "./server/db";
import { notifications } from "./shared/schema";
import { inArray } from "drizzle-orm";

/**
 * Cleanup script for Option C implementation
 * Removes old notification types (reminder, period-complete, trend-alert)
 * Keeps only performance-alert notifications
 */

async function cleanupOldNotifications() {
  console.log('🧹 Cleaning up old notifications...');
  
  try {
    // Delete all non-performance-alert notifications
    const result = await db.delete(notifications)
      .where(
        inArray(notifications.type, ['reminder', 'period-complete', 'trend-alert'])
      );
    
    console.log(`✅ Deleted old notification types (reminder, period-complete, trend-alert)`);
    
    // Get count of remaining notifications
    const remaining = await db.select().from(notifications);
    console.log(`📊 Remaining notifications: ${remaining.length}`);
    console.log(`   - All should be "alert" or "performance-alert" type`);
    
    if (remaining.length > 0) {
      console.log('\nRemaining notification breakdown:');
      const typeCounts = remaining.reduce((acc: any, n) => {
        acc[n.type] = (acc[n.type] || 0) + 1;
        return acc;
      }, {});
      Object.entries(typeCounts).forEach(([type, count]) => {
        console.log(`   - ${type}: ${count}`);
      });
    }
    
    console.log('\n✨ Cleanup complete! Option C (Hybrid) notifications active.');
    console.log('   Only "below/above target" alerts will be created going forward.');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error cleaning up notifications:', error);
    process.exit(1);
  }
}

cleanupOldNotifications();

