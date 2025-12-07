/**
 * Google Sheets Token Refresh Scheduler
 * Proactively refreshes Google Sheets access tokens before they expire
 * Prevents connection interruptions and maintains long-term connections
 */

import { storage } from "./storage";

/**
 * Refresh a Google Sheets access token using the refresh token
 */
async function refreshGoogleSheetsToken(connection: any): Promise<string> {
  if (!connection.refreshToken || !connection.clientId || !connection.clientSecret) {
    throw new Error('Missing refresh token or OAuth credentials for token refresh');
  }

  console.log(`[Token Scheduler] 🔄 Refreshing token for campaign: ${connection.campaignId}`);

  const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: connection.refreshToken,
      client_id: connection.clientId,
      client_secret: connection.clientSecret
    })
  });

  if (!refreshResponse.ok) {
    const errorText = await refreshResponse.text();
    console.error(`[Token Scheduler] ❌ Token refresh failed for campaign ${connection.campaignId}:`, refreshResponse.status, errorText);
    
    // If refresh token is invalid/expired, mark connection as needing reauthorization
    if (refreshResponse.status === 400 && errorText.includes('invalid_grant')) {
      throw new Error('REFRESH_TOKEN_EXPIRED');
    }
    
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const tokens = await refreshResponse.json();
  
  // Update the stored connection with new access token
  const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000));
  const updateData: any = {
    accessToken: tokens.access_token,
    expiresAt: expiresAt
  };
  
  // Some OAuth providers issue new refresh tokens on refresh
  if (tokens.refresh_token) {
    updateData.refreshToken = tokens.refresh_token;
  }
  
  await storage.updateGoogleSheetsConnection(connection.campaignId, updateData);

  console.log(`[Token Scheduler] ✅ Token refreshed successfully for campaign: ${connection.campaignId}`);
  console.log(`[Token Scheduler]    New token expires at: ${expiresAt.toISOString()}`);
  
  return tokens.access_token;
}

/**
 * Check if a token needs proactive refresh (expires within 24 hours)
 */
function shouldRefreshToken(connection: any): boolean {
  if (!connection.expiresAt) {
    // If no expiration date, assume it needs refresh (better safe than sorry)
    return true;
  }
  
  const expiresAt = new Date(connection.expiresAt);
  const now = new Date();
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  
  // Refresh if token expires within 24 hours
  return expiresAt <= twentyFourHoursFromNow;
}

/**
 * Refresh all Google Sheets connections that need token refresh
 */
async function refreshAllGoogleSheetsTokens(): Promise<void> {
  console.log('\n=== GOOGLE SHEETS TOKEN REFRESH SCHEDULER RUNNING ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  
  try {
    // Get all campaigns to check for Google Sheets connections
    const campaigns = await storage.getCampaigns();
    console.log(`[Token Scheduler] Checking ${campaigns.length} campaigns for Google Sheets connections`);
    
    let totalConnections = 0;
    let refreshedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    let expiredCount = 0;
    
    for (const campaign of campaigns) {
      try {
        const connection = await storage.getGoogleSheetsConnection(campaign.id);
        
        if (!connection || !connection.accessToken || !connection.refreshToken) {
          continue; // No connection or missing tokens
        }
        
        totalConnections++;
        
        // Check if token needs refresh
        if (!shouldRefreshToken(connection)) {
          const expiresAt = new Date(connection.expiresAt || 0);
          const hoursUntilExpiry = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60);
          console.log(`[Token Scheduler] ⏭️  Skipping campaign "${campaign.name}" (${campaign.id}) - token expires in ${hoursUntilExpiry.toFixed(1)} hours`);
          skippedCount++;
          continue;
        }
        
        // Token needs refresh - attempt to refresh it
        try {
          await refreshGoogleSheetsToken(connection);
          refreshedCount++;
          console.log(`[Token Scheduler] ✅ Refreshed token for campaign "${campaign.name}" (${campaign.id})`);
        } catch (refreshError: any) {
          if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
            // Refresh token itself has expired - mark for reauthorization
            console.log(`[Token Scheduler] ⚠️  Refresh token expired for campaign "${campaign.name}" (${campaign.id}) - requires reauthorization`);
            expiredCount++;
            
            // Optionally: Mark connection as needing reauthorization (don't delete, let user reconnect)
            // The connection will show as expired in the UI and user can reconnect
          } else {
            console.error(`[Token Scheduler] ❌ Failed to refresh token for campaign "${campaign.name}" (${campaign.id}):`, refreshError.message);
            errorCount++;
          }
        }
      } catch (error: any) {
        console.error(`[Token Scheduler] ❌ Error processing campaign ${campaign.id}:`, error?.message || error);
        errorCount++;
      }
    }
    
    console.log(`[Token Scheduler] Summary:`);
    console.log(`   Total connections found: ${totalConnections}`);
    console.log(`   Tokens refreshed: ${refreshedCount}`);
    console.log(`   Tokens skipped (still valid): ${skippedCount}`);
    console.log(`   Refresh tokens expired: ${expiredCount}`);
    console.log(`   Errors: ${errorCount}`);
    console.log(`=== TOKEN REFRESH SCHEDULER COMPLETE ===\n`);
    
  } catch (error: any) {
    console.error('[Token Scheduler] ❌ Fatal error in token refresh scheduler:', error?.message || error);
  }
}

/**
 * Start the Google Sheets token refresh scheduler
 * Runs daily at 2 AM (low traffic time) to proactively refresh tokens
 */
export function startGoogleSheetsTokenScheduler(): void {
  // Check if scheduler is already running
  if ((global as any).googleSheetsTokenSchedulerInterval) {
    console.log('[Token Scheduler] Scheduler is already running');
    return;
  }
  
  // Get refresh interval from environment variable (default: 24 hours = daily)
  const refreshIntervalHours = parseInt(process.env.GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS || '24', 10);
  const refreshIntervalMs = refreshIntervalHours * 60 * 60 * 1000;
  
  console.log(`\n🔄 Google Sheets Token Refresh Scheduler Started`);
  console.log(`   Refresh interval: ${refreshIntervalHours} hours`);
  console.log(`   Next run: ${new Date(Date.now() + refreshIntervalMs).toLocaleString()}\n`);
  
  // Calculate time until 2 AM (or use current time + interval for first run)
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(2, 0, 0, 0); // 2 AM
  
  // If 2 AM has already passed today, schedule for tomorrow
  if (nextRun.getTime() <= now.getTime()) {
    nextRun.setDate(nextRun.getDate() + 1);
  }
  
  const msUntilNextRun = nextRun.getTime() - now.getTime();
  
  // Run immediately on startup (for testing and immediate refresh of expiring tokens)
  console.log('[Token Scheduler] Running initial token refresh check...');
  refreshAllGoogleSheetsTokens();
  
  // Schedule first run at 2 AM
  setTimeout(() => {
    refreshAllGoogleSheetsTokens();
    
    // Then schedule regular runs every 24 hours
    (global as any).googleSheetsTokenSchedulerInterval = setInterval(() => {
      refreshAllGoogleSheetsTokens();
    }, refreshIntervalMs);
    
    console.log(`[Token Scheduler] Scheduled daily runs at 2 AM`);
  }, msUntilNextRun);
  
  console.log(`[Token Scheduler] First scheduled run: ${nextRun.toLocaleString()}`);
}

/**
 * Stop the Google Sheets token refresh scheduler
 */
export function stopGoogleSheetsTokenScheduler(): void {
  if ((global as any).googleSheetsTokenSchedulerInterval) {
    clearInterval((global as any).googleSheetsTokenSchedulerInterval);
    (global as any).googleSheetsTokenSchedulerInterval = null;
    console.log('[Token Scheduler] Scheduler stopped');
  }
}

