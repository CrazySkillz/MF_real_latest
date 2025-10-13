# LinkedIn OAuth Production Validation Guide

## Prerequisites

### 1. Create LinkedIn App (Developer Portal)
1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click "Create App"
3. Fill in required details:
   - **App name**: PerformanceCore Analytics
   - **LinkedIn Page**: Your company page
   - **App logo**: Your logo
   - **Legal agreement**: Accept terms

### 2. Configure OAuth Settings
In your LinkedIn app settings:

1. **Products** tab:
   - Request access to "Marketing Developer Platform"
   - Request access to "Advertising API"
   
2. **Auth** tab - Add OAuth 2.0 settings:
   - **Authorized redirect URLs**: 
     - Development: `https://[your-replit-url].replit.dev/oauth-callback.html`
     - Production: `https://[your-domain].com/oauth-callback.html`
   
3. **Required OAuth Scopes**:
   - `r_ads_reporting` - Read advertising campaign analytics
   - `rw_ads` - Read/write advertising campaigns
   - `r_organization_admin` - Read organization data

4. Copy credentials:
   - **Client ID** - Save this
   - **Client Secret** - Save this (shown only once!)

---

## Validation Steps

### Step 1: Set Up Credentials

#### Option A: Environment Variables (Recommended for Production)
```bash
# In Replit Secrets (Tools > Secrets)
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
```

#### Option B: Manual Entry (Testing)
- Leave environment variables empty
- Enter credentials in the UI when prompted during connection

### Step 2: Test OAuth Flow

1. **Create a test campaign** in your app
2. **Connect LinkedIn** from campaign page
3. **Turn OFF "Test Mode"** toggle
4. **Enter credentials** (if not using env vars)
5. **Click "Connect with LinkedIn"**
6. **Authorize** in popup window
7. **Select ad account** from your real accounts
8. **Choose campaigns** to import

### Step 3: Validate Data Import

Expected behavior:
- ✅ Popup opens to LinkedIn authorization
- ✅ After authorization, popup closes automatically  
- ✅ Your real ad accounts appear in dropdown
- ✅ Selecting account shows your real campaigns
- ✅ Campaign data includes actual metrics (impressions, clicks, spend, etc.)
- ✅ 18 metrics are available for selection
- ✅ Import creates performance data in analytics dashboard

### Step 4: Test Production Deployment

When publishing to production:

1. **Update LinkedIn App** redirect URLs:
   ```
   https://[your-custom-domain].com/oauth-callback.html
   https://[your-custom-domain].replit.app/oauth-callback.html
   ```

2. **Set production secrets** in Replit:
   - Use the same Client ID/Secret
   - Or create separate production app for isolation

3. **Test full flow** on production URL

---

## Troubleshooting

### Issue: "Popup Blocked"
**Solution**: Allow popups for your domain in browser settings

### Issue: "Redirect URI mismatch"
**Solution**: Ensure LinkedIn app has exact callback URL:
- Check protocol (https://)
- Check subdomain
- Check path (/oauth-callback.html)
- No trailing slashes

### Issue: "Invalid client credentials"
**Solution**: 
- Verify Client ID and Secret are correct
- Ensure app has "Marketing Developer Platform" access
- Check if app is in Development vs Production mode

### Issue: "Insufficient permissions"
**Solution**: Verify these scopes in LinkedIn app:
- r_ads_reporting
- rw_ads  
- r_organization_admin

### Issue: "No ad accounts found"
**Solution**:
- Ensure user has access to LinkedIn ad accounts
- User must be admin/analyst on ad accounts
- Ad accounts must be in ACTIVE status

---

## Security Best Practices

### For Production:
1. ✅ **Use environment variables** for credentials (never commit to code)
2. ✅ **Restrict redirect URIs** to your domains only
3. ✅ **Token storage**: Currently stores in-memory (consider DB for persistence)
4. ✅ **Token refresh**: Implement refresh token flow for long-lived sessions
5. ✅ **HTTPS only**: All OAuth flows must use HTTPS
6. ✅ **State parameter**: Already implemented for CSRF protection

### Current Flow:
```
User → Connect LinkedIn → Popup Authorization → 
Exchange Code for Token → Fetch Ad Accounts → 
Select Account → Fetch Campaigns → Import Data
```

---

## API Rate Limits

LinkedIn Marketing API limits:
- **Rate limit**: 100 requests per day per user (Development)
- **Rate limit**: Higher limits in Production (apply for access)
- **Batch requests**: Use to optimize API calls
- **Caching**: Consider caching campaign data

---

## Testing Checklist

- [ ] LinkedIn app created and configured
- [ ] OAuth redirect URLs added
- [ ] Required API products enabled
- [ ] Client ID and Secret obtained
- [ ] Environment variables set (or manual entry ready)
- [ ] Test mode OFF
- [ ] OAuth popup opens successfully
- [ ] Authorization completes
- [ ] Real ad accounts display
- [ ] Real campaigns display  
- [ ] Metrics import correctly
- [ ] Data appears in analytics dashboard
- [ ] Production URL tested (when deployed)

---

## Next Steps for Enterprise Scale

1. **Token Persistence**: Store access/refresh tokens in database
2. **Token Refresh**: Implement automatic token refresh flow
3. **Multi-Account**: Support multiple LinkedIn connections per user
4. **Webhook Integration**: Real-time campaign updates via LinkedIn webhooks
5. **Role-Based Access**: Map LinkedIn account permissions to app roles
6. **Audit Logging**: Track OAuth connections and API usage
