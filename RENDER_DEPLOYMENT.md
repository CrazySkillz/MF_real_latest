# Deploying PerformanceCore to Render

This guide walks you through deploying PerformanceCore to Render.com.

## Prerequisites

1. A [Render.com](https://render.com) account
2. A GitHub account with this repository
3. Google OAuth credentials (for GA4/Google Sheets integration)
4. Email service credentials (SMTP, SendGrid, or Mailgun)

## Deployment Steps

### Option 1: Deploy via Render Blueprint (Recommended)

1. **Push your code to GitHub** (if not already done)
   ```bash
   git add .
   git commit -m "Add Render configuration"
   git push origin main
   ```

2. **Go to Render Dashboard**
   - Visit https://dashboard.render.com/
   - Click "New +" → "Blueprint"

3. **Connect Repository**
   - Select your GitHub repository
   - Render will automatically detect the `render.yaml` file

4. **Review Services**
   - Web Service: `performancecore` (Node.js app)
   - Database: `performancecore-db` (PostgreSQL)

5. **Set Environment Variables**
   Click on the web service after deployment and add these required variables:

   **Required:**
   - `GOOGLE_CLIENT_ID` - Your Google OAuth client ID
   - `GOOGLE_CLIENT_SECRET` - Your Google OAuth client secret
   - `EMAIL_FROM_ADDRESS` - Email address for sending alerts
   - `SMTP_HOST` - SMTP server (e.g., smtp.gmail.com)
   - `SMTP_USER` - SMTP username
   - `SMTP_PASS` - SMTP password or app-specific password

   **Auto-generated:**
   - `DATABASE_URL` - Automatically set from PostgreSQL database
   - `SESSION_SECRET` - Automatically generated
   - `PORT` - Automatically set by Render

6. **Deploy**
   - Click "Apply" and wait for the deployment to complete
   - The database will be created first, then the web service

### Option 2: Manual Deployment

1. **Create PostgreSQL Database**
   - Go to Render Dashboard → "New +" → "PostgreSQL"
   - Name: `performancecore-db`
   - Plan: Starter (Free) or higher
   - Region: Oregon (or your preferred region)
   - Click "Create Database"

2. **Create Web Service**
   - Go to Render Dashboard → "New +" → "Web Service"
   - Connect your GitHub repository
   - Name: `performancecore`
   - Runtime: Node
   - Region: Oregon (same as database)
   - Branch: `main`
   - Build Command: `npm install && npm run build`
   - Start Command: `npm run start`
   - Plan: Starter (Free) or higher

3. **Configure Environment Variables**
   Add all the environment variables listed in Option 1, Step 5

4. **Deploy**
   - Click "Create Web Service"
   - Wait for the build and deployment to complete

## Post-Deployment Configuration

### 1. Initialize Database Schema

After deployment, you need to push the database schema:

```bash
# Install dependencies locally
npm install

# Set DATABASE_URL to your Render PostgreSQL connection string
export DATABASE_URL="your-render-postgres-url"

# Push schema to database
npm run db:push
```

Or use Render Shell:
- Go to your web service → "Shell" tab
- Run: `npm run db:push`

### 2. Configure Google OAuth Redirect URIs

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project → "APIs & Services" → "Credentials"
3. Edit your OAuth 2.0 Client ID
4. Add these Authorized Redirect URIs:
   ```
   https://your-app-name.onrender.com/api/oauth/google/callback
   https://your-app-name.onrender.com/api/oauth/ga4/callback
   ```

### 3. Configure LinkedIn OAuth (Optional)

If using LinkedIn Ads integration:

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/)
2. Select your app → "Auth" tab
3. Add Redirect URL:
   ```
   https://your-app-name.onrender.com/api/oauth/linkedin/callback
   ```

### 4. Test Your Deployment

1. Visit your Render URL: `https://your-app-name.onrender.com`
2. Create a campaign
3. Test integrations (GA4, Google Sheets, LinkedIn)
4. Verify email notifications work

## Environment Variables Reference

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host/db` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | From Google Cloud Console |
| `EMAIL_FROM_ADDRESS` | Sender email address | `alerts@yourdomain.com` |

### Email Configuration (Choose one provider)

**SMTP (Gmail, Outlook, etc.):**
- `EMAIL_PROVIDER=smtp`
- `SMTP_HOST` (e.g., `smtp.gmail.com`)
- `SMTP_PORT` (usually `587`)
- `SMTP_SECURE=false`
- `SMTP_USER`
- `SMTP_PASS`

**SendGrid:**
- `EMAIL_PROVIDER=sendgrid`
- `SENDGRID_API_KEY`

**Mailgun:**
- `EMAIL_PROVIDER=mailgun`
- `MAILGUN_SMTP_HOST`
- `MAILGUN_SMTP_USER`
- `MAILGUN_SMTP_PASS`

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SNAPSHOT_FREQUENCY` | How often to snapshot metrics | `daily` |
| `SESSION_SECRET` | Session encryption key | Auto-generated |
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Server port | `5000` |

## Monitoring and Logs

### View Logs
- Go to your web service in Render
- Click "Logs" tab
- View real-time application logs

### Health Check
- Render automatically monitors: `/api/health`
- If health check fails, the service will restart

### Database Access
- Go to your database in Render
- Click "Connect" for connection details
- Use psql or any PostgreSQL client

## Troubleshooting

### Build Fails

**Error: "Module not found"**
```bash
# Ensure all dependencies are in package.json
npm install --save missing-package
git commit -am "Add missing dependency"
git push
```

**Error: "TypeScript compilation failed"**
```bash
# Check TypeScript errors locally
npm run check
```

### Database Connection Issues

**Error: "DATABASE_URL not defined"**
- Verify database is linked in render.yaml
- Check environment variables in Render dashboard

**Error: "Database schema not found"**
```bash
# Push schema to database
npm run db:push
```

### OAuth Issues

**Error: "redirect_uri_mismatch"**
- Update OAuth redirect URIs in Google/LinkedIn console
- Use exact Render URL (with https://)

### Email Not Working

**SMTP Authentication Failed**
- For Gmail, use [App Passwords](https://support.google.com/accounts/answer/185833)
- Verify SMTP credentials are correct
- Check SMTP_HOST and SMTP_PORT

## Scaling

### Upgrade Plans
- **Starter ($7/month)**: Good for testing, sleeps after inactivity
- **Standard ($25/month)**: Always on, better performance
- **Pro ($85/month)**: High availability, more resources

### Database Scaling
- Starter: 1GB storage, 97 hours uptime/month (Free)
- Standard: 10GB storage, always on
- Pro: 50GB+ storage, automated backups

### Performance Optimization
- Enable caching for API responses
- Use database indexes (already in schema)
- Consider CDN for static assets

## Backup and Migration

### Database Backups
Render automatically backs up paid PostgreSQL plans. For free tier:
```bash
# Export database
pg_dump $DATABASE_URL > backup.sql

# Import to new database
psql $NEW_DATABASE_URL < backup.sql
```

### Migrate from Replit
1. Export environment variables from Replit
2. Follow deployment steps above
3. Update OAuth redirect URIs
4. Test all integrations

## Support

- **Render Status**: https://status.render.com/
- **Render Docs**: https://render.com/docs
- **Support**: https://render.com/support

## Cost Estimate

**Free Tier:**
- Web Service: Free (sleeps after 15min inactivity)
- PostgreSQL: Free (limited uptime)
- **Total: $0/month**

**Production Ready:**
- Web Service (Standard): $25/month
- PostgreSQL (Standard): $25/month
- **Total: $50/month**

**High Availability:**
- Web Service (Pro): $85/month
- PostgreSQL (Pro): $90/month
- **Total: $175/month**
