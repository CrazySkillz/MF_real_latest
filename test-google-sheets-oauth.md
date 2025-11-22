# Google Sheets OAuth Debugging Guide

## Quick Test

### 1. Check if OAuth endpoint is accessible
```bash
# Replace with your Render URL
curl https://your-app.onrender.com/api/auth/google-sheets/connect \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"campaignId": "test-campaign-id"}'
```

**Expected Response:**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/v2/auth?client_id=...",
  "message": "Google Sheets OAuth flow initiated"
}
```

**If you get an error:** The OAuth credentials are not being read correctly.

### 2. Check Render Logs
1. Go to Render Dashboard → Your Service → Logs
2. Look for:
   ```
   [Google Sheets OAuth] Starting flow for campaign...
   [Google Sheets OAuth] Using redirect URI: ...
   ```

### 3. Common Issues & Fixes

#### Issue: "Request had invalid authentication credentials"
**Cause:** OAuth credentials are invalid or expired

**Fix:**
1. Go to Google Cloud Console
2. Generate new OAuth credentials
3. Update `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in Render
4. **Manual Deploy with cache clear**

#### Issue: "redirect_uri_mismatch"
**Cause:** The redirect URI in your code doesn't match Google Cloud Console

**Fix:**
1. Check Render logs for the actual redirect URI being used
2. Add that exact URI to Google Cloud Console:
   - Go to APIs & Services → Credentials
   - Click your OAuth client
   - Add to "Authorized redirect URIs"

#### Issue: Connection works but then fails
**Cause:** Token refresh is failing

**Fix:**
1. Delete the existing Google Sheets connection
2. Reconnect with fresh OAuth flow
3. Make sure `access_type=offline` is in the OAuth URL (it should be)

### 4. Force Fresh OAuth Flow

If reconnecting doesn't work:

1. **Clear browser cache** for your app domain
2. **Revoke app access** in Google:
   - Go to: https://myaccount.google.com/permissions
   - Find your app
   - Click "Remove access"
3. **Try connecting again** - this will force a fresh OAuth consent

### 5. Environment Variable Check

Make sure in Render:
```
GOOGLE_CLIENT_ID=xxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxxx
```

**Important:** After changing env vars:
- Click "Manual Deploy"
- Select "Clear build cache & deploy"

### 6. Check Google Cloud Console Settings

1. **OAuth Consent Screen:**
   - Status should be "In production" or "Testing"
   - Add your test email to test users if in testing mode

2. **Enabled APIs:**
   - ✅ Google Sheets API
   - ✅ Google Drive API

3. **OAuth Client:**
   - Type: Web application
   - Authorized redirect URIs must include your Render callback URL

## Still Not Working?

If none of the above works, the issue might be:

1. **Google Cloud Project Suspended:** Check for any warnings in Google Cloud Console
2. **Domain Verification Required:** Some Google APIs require domain verification
3. **API Quotas Exceeded:** Check quota usage in Google Cloud Console

## Testing Without OAuth (Temporary)

If you need to test other features while debugging OAuth:
- Use **Custom Integration** (PDF import) instead
- This doesn't require OAuth and should work immediately

