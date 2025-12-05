# 🚀 Mailgun HTTP API Setup (Recommended - Bypasses SMTP Firewall Issues)

If you're getting **"Connection timeout"** errors with SMTP, use Mailgun's HTTP API instead. It's more reliable in cloud environments!

---

## **✅ SETUP STEPS:**

### **Step 1: Get Your Mailgun API Key**

1. Go to **Mailgun Dashboard**: https://rapp.mailgun.com
2. Click **Settings** (left sidebar) → **API Keys**
3. You'll see your **Private API Key** (starts with `key-...`)
4. Click **"Copy"** or click the eye icon to reveal it
5. **Copy this key** - you'll need it for Step 3

---

### **Step 2: Get Your Mailgun Domain**

1. Still in Mailgun Dashboard
2. Click **Sending** → **Domains**
3. You'll see your sandbox domain: `sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org`
4. **Copy the full domain name**

---

### **Step 3: Add to Render Environment**

1. Go to **Render Dashboard**: https://dashboard.render.com
2. Click on your **MetricMind** web service
3. Click **"Environment"** tab
4. Add these **4 variables**:

```
EMAIL_PROVIDER=mailgun

MAILGUN_API_KEY=key-1234567890abcdef1234567890abcdef
(paste your Private API Key from Step 1)

MAILGUN_DOMAIN=sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
(paste your domain from Step 2)

MAILGUN_REGION=us
(or "eu" if you're on EU server - check your Mailgun dashboard URL)

EMAIL_FROM_ADDRESS=hello@sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
(same domain as MAILGUN_DOMAIN, with your chosen sender name)
```

5. **Click "Save Changes"**
6. Wait ~2 minutes for redeploy

---

## **🌍 HOW TO KNOW YOUR REGION:**

Check the URL when you're logged into Mailgun:

- **US:** `https://app.mailgun.com/...` → Use `MAILGUN_REGION=us`
- **EU:** `https://app.eu.mailgun.com/...` → Use `MAILGUN_REGION=eu`

---

## **✅ YOUR FINAL CONFIGURATION:**

### **For US Region:**
```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-your-actual-api-key-here
MAILGUN_DOMAIN=sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
MAILGUN_REGION=us
EMAIL_FROM_ADDRESS=hello@sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
```

### **For EU Region:**
```bash
EMAIL_PROVIDER=mailgun
MAILGUN_API_KEY=key-your-actual-api-key-here
MAILGUN_DOMAIN=sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
MAILGUN_REGION=eu
EMAIL_FROM_ADDRESS=hello@sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org
```

---

## **⚡ WHY HTTP API IS BETTER:**

| SMTP | HTTP API |
|------|----------|
| ❌ Blocked by firewalls | ✅ Works through HTTPS (port 443) |
| ❌ Connection timeouts | ✅ No timeout issues |
| ❌ Requires open ports 587/2525 | ✅ Uses standard HTTPS port |
| ⚠️ Can be slow | ✅ Fast and reliable |

---

## **🧪 TESTING:**

After deploying with HTTP API configuration:

1. Go to **LinkedIn Analytics → Reports tab**
2. Find your scheduled report
3. Click **"Send Test Email"**
4. **Check Render logs** - you should see:
   ```
   [Email Service] Using Mailgun HTTP API (bypasses SMTP firewall issues)
   [Email Service] ✅ Email sent via Mailgun HTTP API: <message-id>
   ```
5. **Check your inbox!** 📧

---

## **⚠️ IMPORTANT: Authorized Recipients**

Don't forget to authorize your email in Mailgun:

1. **Mailgun Dashboard** → **Sending** → **Domains**
2. Click your **sandbox domain**
3. Scroll to **"Authorized Recipients"**
4. Add your email address
5. Check inbox and **verify**

---

## **🔧 TROUBLESHOOTING:**

### **"Mailgun API error: 401 Unauthorized"**
- Your API key is incorrect
- Go to Mailgun → Settings → API Keys
- Copy the **Private API Key** (not Public)

### **"Mailgun API error: 400 Bad Request"**
- Domain is incorrect
- Check that MAILGUN_DOMAIN matches exactly what's in Mailgun dashboard
- Don't add `https://` or any prefix

### **"Mailgun API error: 550"**
- Recipient not authorized (sandbox limitation)
- Add recipient to "Authorized Recipients" in Mailgun

---

## **✨ ADVANTAGES OVER SMTP:**

1. **No firewall issues** - Uses HTTPS (port 443) which is never blocked
2. **No connection timeouts** - Direct HTTP requests
3. **Faster** - No SMTP handshake overhead
4. **Better logging** - More detailed error messages
5. **More reliable** - Recommended by Mailgun for production

---

**This is the BEST solution if SMTP keeps timing out!** 🚀📧

