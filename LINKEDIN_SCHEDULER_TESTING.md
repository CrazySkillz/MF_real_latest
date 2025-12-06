# LinkedIn Scheduler Testing Guide

## How to Test the LinkedIn Scheduler in Test Mode

### Option 1: Per-Campaign Test Mode (Recommended for Testing)

**Step 1: Enable Test Mode in UI**
1. Navigate to your campaign
2. Go to LinkedIn Analytics section
3. Look for the "Test Mode" toggle switch
4. Enable test mode
5. Click "Import" to create initial test data
6. The connection will be saved with `method: 'test'`

**Step 2: Verify Test Mode Connection**
- The scheduler automatically detects `connection.method === 'test'`
- It will generate mock data instead of calling LinkedIn API
- No API rate limits or costs

**Step 3: Test the Scheduler**
- The scheduler runs every 4 hours by default
- For faster testing, reduce the interval (see below)

---

### Option 2: Global Test Mode (For Development)

**Step 1: Set Environment Variable**
Add to your `.env` file:
```bash
LINKEDIN_TEST_MODE=true
LINKEDIN_REFRESH_INTERVAL_HOURS=0.1  # 6 minutes for fast testing
```

**Step 2: Restart Server**
- Restart your server to load the new environment variables
- The scheduler will use test mode for ALL campaigns

---

## Fast Testing Configuration

For rapid testing, reduce the refresh interval:

**In `.env` file:**
```bash
# Test mode - 6 minutes (10x per hour for fast testing)
LINKEDIN_TEST_MODE=true
LINKEDIN_REFRESH_INTERVAL_HOURS=0.1

# Or 1 minute for very fast testing
LINKEDIN_REFRESH_INTERVAL_HOURS=0.0167
```

**Note:** After testing, change back to production values:
```bash
LINKEDIN_TEST_MODE=false
LINKEDIN_REFRESH_INTERVAL_HOURS=4  # 6x daily (production)
```

---

## Testing Workflow

### 1. Initial Setup (One-Time)
```
1. Create a test campaign
2. Enable test mode in LinkedIn connection UI
3. Click "Import" to create initial test data
4. Create a KPI with alerts enabled
   - Example: CTR KPI with alertThreshold: 1.8%
   - Set currentValue: 2.1% (above threshold)
```

### 2. Wait for Scheduler to Run
```
- Scheduler runs automatically based on interval
- Check server logs for scheduler activity
- Look for: "[LinkedIn Scheduler] TEST MODE: Generating mock data"
```

### 3. Verify Data Refresh
```
1. Check LinkedIn Analytics page
2. Verify new import session was created
3. Check that metrics have changed (mock data varies)
4. Verify KPIs were updated
```

### 4. Test Alert Triggering
```
1. Create KPI with alertThreshold
2. Set mock data to breach threshold
3. Wait for scheduler to run
4. Check notifications/bell icon
5. Verify alert was sent
```

---

## Checking Scheduler Logs

**Server Console Output:**
```
[LinkedIn Scheduler] Starting LinkedIn data refresh scheduler...
[LinkedIn Scheduler] Refresh interval: 0.1 hours (10x per hour)
[LinkedIn Scheduler] Next refresh: [timestamp]
[LinkedIn Scheduler] ✅ LinkedIn scheduler started successfully

[LinkedIn Scheduler] Starting scheduled LinkedIn data refresh...
[LinkedIn Scheduler] Found 1 LinkedIn connection(s) to refresh
[LinkedIn Scheduler] TEST MODE: Generating mock data for campaign [campaignId]
[LinkedIn Scheduler] ✅ Mock data generated for campaign [campaignId]
[LinkedIn Scheduler] Refreshing KPIs for campaign [campaignId]...
[LinkedIn Scheduler] Checking performance alerts for campaign [campaignId]...
[LinkedIn Scheduler] ✅ Completed refresh for campaign [campaignId]
```

---

## Manual Testing (Trigger Scheduler Immediately)

If you want to test immediately without waiting:

**Option A: Restart Server**
- The scheduler starts on server startup
- First run happens after the interval

**Option B: Call Scheduler Function Directly**
Add a test endpoint (temporary, for testing only):

```typescript
// In server/routes-oauth.ts (temporary for testing)
app.post("/api/test/linkedin-refresh", async (req, res) => {
  try {
    const { refreshAllLinkedInData } = await import('./linkedin-scheduler');
    await refreshAllLinkedInData();
    res.json({ success: true, message: 'LinkedIn refresh triggered' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

Then call: `POST /api/test/linkedin-refresh`

**Option C: Reduce Interval to 1 Minute**
```bash
LINKEDIN_REFRESH_INTERVAL_HOURS=0.0167  # 1 minute
```

---

## Testing Checklist

- [ ] Test mode enabled (UI toggle or env variable)
- [ ] Initial import completed with test data
- [ ] Scheduler started (check logs)
- [ ] New import session created after scheduler run
- [ ] KPIs updated with new values
- [ ] Alerts checked immediately after refresh
- [ ] Notifications sent if threshold breached
- [ ] No LinkedIn API calls made (test mode)
- [ ] Mock data varies between refreshes

---

## Expected Behavior in Test Mode

✅ **What Works:**
- Mock data generation (no API calls)
- KPI value updates
- Alert checking
- Notification creation
- All scheduler functionality

❌ **What Doesn't Happen:**
- No LinkedIn API calls
- No rate limit usage
- No API costs
- No network delays

---

## Troubleshooting

**Scheduler Not Running:**
- Check server logs for startup messages
- Verify `startLinkedInScheduler()` is called in `server/index.ts`
- Check environment variables are loaded

**Test Mode Not Detected:**
- Verify connection has `method: 'test'` in database
- Check `LINKEDIN_TEST_MODE` env variable
- Look for "TEST MODE" in logs

**No Data Generated:**
- Check previous import session exists
- Verify campaigns were selected in initial import
- Check server logs for errors

**Alerts Not Triggering:**
- Verify KPI has `alertsEnabled: true`
- Check `alertThreshold` is set correctly
- Verify mock data breaches threshold
- Check notification logs

---

## Production vs Test Mode Comparison

| Feature | Test Mode | Production Mode |
|---------|-----------|----------------|
| **Data Source** | Mock/Generated | LinkedIn API |
| **API Calls** | None | Real API calls |
| **Rate Limits** | No limits | 500-5,000/day |
| **Refresh Speed** | Instant | Network dependent |
| **Cost** | Free | API usage |
| **Testing** | ✅ Perfect | ⚠️ Limited |

---

## Quick Test Script

1. **Enable Test Mode:**
   ```bash
   # In .env
   LINKEDIN_TEST_MODE=true
   LINKEDIN_REFRESH_INTERVAL_HOURS=0.1  # 6 minutes
   ```

2. **Create Test Campaign:**
   - Use UI to create campaign
   - Enable test mode toggle
   - Import test data

3. **Create Test KPI:**
   - Metric: CTR
   - Target: 2.5%
   - Alert Threshold: 1.8%
   - Alerts Enabled: Yes

4. **Wait for Scheduler:**
   - Check logs every 6 minutes
   - Verify new data generated
   - Check KPI updated
   - Verify alerts checked

5. **Verify Results:**
   - New import session created
   - KPI currentValue updated
   - Notification sent if threshold breached

---

## After Testing

**Reset to Production:**
```bash
# In .env
LINKEDIN_TEST_MODE=false
LINKEDIN_REFRESH_INTERVAL_HOURS=4  # 6x daily
```

**Remove Test Endpoint:**
- Delete the `/api/test/linkedin-refresh` endpoint if you added it

**Clean Up:**
- Remove test campaigns if needed
- Reset test KPIs

---

## Summary

Test mode is fully supported and perfect for:
- ✅ Bug testing
- ✅ Feature development
- ✅ Alert testing
- ✅ KPI refresh testing
- ✅ Notification testing

No API calls, no costs, no rate limits - perfect for development!

