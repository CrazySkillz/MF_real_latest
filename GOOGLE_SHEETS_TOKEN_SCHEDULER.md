# Google Sheets Token Refresh Scheduler

## Overview

The Google Sheets Token Refresh Scheduler is a background job that proactively refreshes Google Sheets access tokens before they expire, ensuring connections remain active and users never experience interruptions.

## How It Works

### Automatic Token Refresh

1. **Runs Daily at 2 AM** (low traffic time)
2. **Checks All Connections**: Scans all campaigns for Google Sheets connections
3. **Proactive Refresh**: Refreshes tokens that expire within 24 hours
4. **Prevents Expiration**: Keeps connections active even with infrequent use

### Token Refresh Logic

**When a token is refreshed:**
- Token expires within 24 hours → Refresh proactively
- Token expires in > 24 hours → Skip (still valid)
- Refresh token expired → Mark for reauthorization (don't delete)

**Benefits:**
- Prevents access token expiration errors
- Keeps refresh tokens active (prevents 6-month inactivity expiration)
- Maintains long-term connections
- Zero user intervention required

## Configuration

### Environment Variables

```bash
# Optional: Set custom refresh interval (default: 24 hours)
GOOGLE_SHEETS_TOKEN_REFRESH_INTERVAL_HOURS=24
```

### Schedule

- **First Run**: Immediately on server startup (for immediate refresh of expiring tokens)
- **Daily Runs**: Every 24 hours at 2 AM
- **Configurable**: Can be adjusted via environment variable

## User Experience

### Before (Without Scheduler)

```
User opens platform after 6 months
→ Tries to view Google Sheets data
→ Error: "Connection expired"
→ Must manually reconnect
→ Frustrating experience
```

### After (With Scheduler)

```
User opens platform after 6 months
→ Tries to view Google Sheets data
→ Data loads immediately
→ Token was refreshed automatically
→ Seamless experience
```

## Technical Details

### Scheduler Flow

```
1. Scheduler starts on server startup
2. Runs initial check immediately
3. Schedules daily runs at 2 AM
4. For each campaign:
   a. Check if Google Sheets connection exists
   b. Check if token expires within 24 hours
   c. If yes, refresh token proactively
   d. Update connection in database
5. Log summary of actions
```

### Error Handling

**Refresh Token Expired:**
- Logs warning
- Marks connection as needing reauthorization
- Doesn't delete connection (user can reconnect easily)
- UI will show expiration message

**Other Errors:**
- Logs error but continues with other connections
- Doesn't crash scheduler
- Retries on next run

## Logging

The scheduler provides detailed logging:

```
=== GOOGLE SHEETS TOKEN REFRESH SCHEDULER RUNNING ===
Timestamp: 2025-01-15T02:00:00.000Z
[Token Scheduler] Checking 10 campaigns for Google Sheets connections
[Token Scheduler] ✅ Refreshed token for campaign "test022" (abc123)
[Token Scheduler] ⏭️  Skipping campaign "campaign2" (def456) - token expires in 48.5 hours
[Token Scheduler] Summary:
   Total connections found: 5
   Tokens refreshed: 2
   Tokens skipped (still valid): 3
   Refresh tokens expired: 0
   Errors: 0
=== TOKEN REFRESH SCHEDULER COMPLETE ===
```

## Benefits

1. **Zero Interruption**: Users never see expiration errors
2. **Long-Term Connections**: Prevents refresh token expiration (6-month rule)
3. **Professional Experience**: Enterprise-grade reliability
4. **Automatic Maintenance**: No manual intervention required
5. **Proactive**: Refreshes before expiration, not after

## Monitoring

Check server logs for scheduler activity:
- Look for `[Token Scheduler]` log entries
- Monitor refresh success/failure rates
- Check for expired refresh tokens (requires reauthorization)

## Future Enhancements

Potential improvements:
- Email notifications when refresh token expires
- Dashboard showing token health
- Configurable refresh window (currently 24 hours)
- Metrics tracking (refresh success rate, etc.)

