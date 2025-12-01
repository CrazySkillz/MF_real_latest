import { db } from './server/db';
import { kpis, kpiPeriods, notifications } from './shared/schema';
import { eq } from 'drizzle-orm';
import {
  createKPIReminder,
  createKPIAlert,
  createPeriodComplete,
  createTrendAlert
} from './server/kpi-notifications';

/**
 * Test Script for KPI Notifications Feature
 * 
 * This script helps you test the KPI notifications system by:
 * 1. Creating test period snapshots for existing KPIs
 * 2. Generating test notifications
 * 3. Simulating the scheduler behavior
 */

async function testKPINotifications() {
  console.log('='.repeat(60));
  console.log('KPI NOTIFICATIONS TEST MODE');
  console.log('='.repeat(60));
  console.log('');

  try {
    // Step 1: Get all active KPIs
    console.log('📋 Step 1: Fetching active KPIs...');
    const activeKPIs = await db.select()
      .from(kpis)
      .where(eq(kpis.status, 'active'));
    
    console.log(`✓ Found ${activeKPIs.length} active KPIs`);
    
    if (activeKPIs.length === 0) {
      console.log('');
      console.log('⚠️  No active KPIs found!');
      console.log('   Please create a KPI first in the LinkedIn Analytics → KPIs tab');
      console.log('');
      process.exit(0);
    }
    
    console.log('');
    console.log('Active KPIs:');
    activeKPIs.forEach((kpi, index) => {
      console.log(`  ${index + 1}. ${kpi.name} [${kpi.metric}]`);
      console.log(`     Current: ${kpi.currentValue}${kpi.unit}, Target: ${kpi.targetValue}${kpi.unit}`);
      console.log(`     Timeframe: ${kpi.timeframe}, Alerts: ${kpi.alertsEnabled ? 'Enabled' : 'Disabled'}`);
    });
    
    console.log('');
    console.log('='.repeat(60));
    console.log('');

    // Step 2: Create test period snapshots for each KPI
    console.log('📊 Step 2: Creating test period snapshots...');
    
    for (const kpi of activeKPIs) {
      // Create a snapshot based on KPI timeframe
      const today = new Date();
      let periodStart: Date;
      let periodEnd: Date;
      let periodLabel: string;
      
      const timeframe = kpi.timeframe || 'monthly';
      
      if (timeframe === 'daily') {
        // Create "yesterday" snapshot for daily KPIs
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        periodStart = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 0, 0, 0);
        periodEnd = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate(), 23, 59, 59);
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        periodLabel = `${monthNames[yesterday.getMonth()]} ${yesterday.getDate()}, ${yesterday.getFullYear()}`;
      } else if (timeframe === 'weekly') {
        // Create "last week" snapshot for weekly KPIs
        const lastWeek = new Date(today);
        lastWeek.setDate(lastWeek.getDate() - 7);
        
        periodStart = new Date(lastWeek);
        periodStart.setDate(periodStart.getDate() - periodStart.getDay()); // Start of week (Sunday)
        
        periodEnd = new Date(periodStart);
        periodEnd.setDate(periodEnd.getDate() + 6); // End of week (Saturday)
        
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        periodLabel = `Week of ${monthNames[periodStart.getMonth()]} ${periodStart.getDate()}, ${periodStart.getFullYear()}`;
      } else {
        // Create "last month" snapshot for monthly KPIs
        const lastMonth = new Date(today);
        lastMonth.setMonth(lastMonth.getMonth() - 1);
        
        periodStart = new Date(lastMonth.getFullYear(), lastMonth.getMonth(), 1);
        periodEnd = new Date(lastMonth.getFullYear(), lastMonth.getMonth() + 1, 0);
        
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                            'July', 'August', 'September', 'October', 'November', 'December'];
        periodLabel = `${monthNames[lastMonth.getMonth()]} ${lastMonth.getFullYear()}`;
      }
      
      // Simulate previous period performance (slightly different from current)
      const currentValue = parseFloat(kpi.currentValue);
      const targetValue = parseFloat(kpi.targetValue);
      
      // Make previous value 10-20% different from current
      const variation = (Math.random() * 0.2 + 0.1) * (Math.random() > 0.5 ? 1 : -1);
      const previousValue = currentValue * (1 + variation);
      
      const targetAchieved = previousValue >= targetValue;
      const performancePercentage = (previousValue / targetValue) * 100;
      const performanceLevel = performancePercentage >= 100 ? 'excellent' : 
                               performancePercentage >= 90 ? 'good' : 
                               performancePercentage >= 75 ? 'fair' : 'poor';
      
      // Calculate change from an even earlier period (simulated)
      const evenEarlierValue = previousValue * (1 + (Math.random() * 0.15 - 0.075));
      const changeAmount = previousValue - evenEarlierValue;
      const changePercentage = (changeAmount / evenEarlierValue) * 100;
      const trendDirection = changeAmount > 0 ? 'up' : changeAmount < 0 ? 'down' : 'stable';
      
      // Insert period snapshot
      await db.insert(kpiPeriods).values({
        kpiId: kpi.id,
        periodStart,
        periodEnd,
        periodType: timeframe,
        periodLabel,
        finalValue: previousValue.toFixed(2),
        targetValue: targetValue.toFixed(2),
        unit: kpi.unit,
        targetAchieved,
        performancePercentage: performancePercentage.toFixed(2),
        performanceLevel,
        previousPeriodValue: evenEarlierValue.toFixed(2),
        changeAmount: changeAmount.toFixed(2),
        changePercentage: changePercentage.toFixed(2),
        trendDirection,
        notes: 'Test period created by test script'
      });
      
      console.log(`  ✓ Created period snapshot for: ${kpi.name}`);
      console.log(`    Period: ${periodLabel}`);
      console.log(`    Final: ${previousValue.toFixed(2)}${kpi.unit}, Target: ${targetValue}${kpi.unit}`);
      console.log(`    Status: ${targetAchieved ? '✓ Achieved' : '✗ Missed'}`);
      console.log(`    Change: ${trendDirection === 'up' ? '↑' : trendDirection === 'down' ? '↓' : '→'} ${Math.abs(changePercentage).toFixed(1)}%`);
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('');

    // Step 3: Generate test notifications
    console.log('🔔 Step 3: Creating test notifications...');
    console.log('');
    
    for (const kpi of activeKPIs) {
      if (!kpi.alertsEnabled) {
        console.log(`  ⊘ Skipping ${kpi.name} (alerts disabled)`);
        continue;
      }
      
      // Create a reminder notification
      await createKPIReminder(kpi);
      console.log(`  ✓ Created REMINDER notification for: ${kpi.name}`);
      
      // Create a performance alert if below target
      const currentValue = parseFloat(kpi.currentValue);
      const targetValue = parseFloat(kpi.targetValue);
      if (currentValue < targetValue) {
        await createKPIAlert(kpi);
        console.log(`  ✓ Created ALERT notification for: ${kpi.name}`);
      }
      
      // Create a period complete notification
      const latestPeriod = await db.select()
        .from(kpiPeriods)
        .where(eq(kpiPeriods.kpiId, kpi.id))
        .limit(1);
      
      if (latestPeriod[0]) {
        await createPeriodComplete(kpi, {
          periodLabel: latestPeriod[0].periodLabel,
          finalValue: parseFloat(latestPeriod[0].finalValue),
          targetAchieved: latestPeriod[0].targetAchieved,
          changePercentage: latestPeriod[0].changePercentage ? parseFloat(latestPeriod[0].changePercentage) : undefined,
          trendDirection: latestPeriod[0].trendDirection || undefined
        });
        console.log(`  ✓ Created PERIOD COMPLETE notification for: ${kpi.name}`);
      }
      
      console.log('');
    }
    
    console.log('='.repeat(60));
    console.log('');

    // Step 4: Summary
    console.log('✅ TEST MODE COMPLETE!');
    console.log('');
    console.log('What was created:');
    console.log(`  • ${activeKPIs.length} period snapshots (previous month)`);
    console.log(`  • ${activeKPIs.filter(k => k.alertsEnabled).length * 2} notifications (reminder + period complete)`);
    console.log(`  • ${activeKPIs.filter(k => k.alertsEnabled && parseFloat(k.currentValue) < parseFloat(k.targetValue)).length} alert notifications`);
    console.log('');
    console.log('How to test:');
    console.log('  1. Go to LinkedIn Analytics → KPIs tab');
    console.log('  2. You should see "Previous Period" section on KPI cards');
    console.log('  3. Click bell icon (🔔) in left navigation');
    console.log('  4. You should see test notifications');
    console.log('  5. Click [View KPI →] button to navigate to KPI');
    console.log('');
    console.log('To clean up test data:');
    console.log('  • Delete notifications from Notifications page');
    console.log('  • Period snapshots will remain for historical reference');
    console.log('');
    console.log('='.repeat(60));
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

// Run the test
testKPINotifications()
  .then(() => {
    console.log('Test script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Test script failed:', error);
    process.exit(1);
  });

