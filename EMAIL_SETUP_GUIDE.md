# Email Configuration Guide for Automated Reports

Your scheduled reports feature requires email configuration to send automated reports. Follow the steps below based on your preferred email provider.

---

## 🚨 Current Status

The "Send Test Email" button is showing an error because email credentials are not configured on Render yet.

---

## ⚙️ Quick Setup on Render

### **Option 1: Mailgun (Recommended for Production)**

1. **Go to Render Dashboard** → Your Web Service → "Environment"
2. **Add these environment variables:**

```
EMAIL_PROVIDER=mailgun
MAILGUN_SMTP_USER=postmaster@your-domain.mailgun.org
MAILGUN_SMTP_PASS=your-mailgun-password
EMAIL_FROM_ADDRESS=reports@your-domain.com
```

3. **Get Mailgun Credentials:**
   - Sign up at https://mailgun.com
   - Go to Sending → Domain Settings → SMTP credentials
   - Copy the SMTP username and password

4. **Click "Save Changes"** on Render (will auto-redeploy)

---

### **Option 2: SendGrid**

1. **Go to Render Dashboard** → Your Web Service → "Environment"
2. **Add these environment variables:**

```
EMAIL_PROVIDER=sendgrid
SENDGRID_API_KEY=your-sendgrid-api-key
EMAIL_FROM_ADDRESS=reports@your-domain.com
```

3. **Get SendGrid API Key:**
   - Sign up at https://sendgrid.com
   - Go to Settings → API Keys → Create API Key
   - Copy the API key

4. **Click "Save Changes"** on Render

---

### **Option 3: Gmail SMTP (For Testing Only)**

⚠️ **Not recommended for production** - Gmail has strict sending limits (500 emails/day)

1. **Go to Render Dashboard** → Your Web Service → "Environment"
2. **Add these environment variables:**

```
EMAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-gmail@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM_ADDRESS=your-gmail@gmail.com
```

3. **Enable Gmail App Password:**
   - Go to https://myaccount.google.com/apppasswords
   - Generate an App Password
   - Use that as `SMTP_PASS` (not your regular password)

4. **Click "Save Changes"** on Render

---

### **Option 4: Custom SMTP Server**

```
EMAIL_PROVIDER=smtp
SMTP_HOST=your-smtp-host.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-username
SMTP_PASS=your-password
EMAIL_FROM_ADDRESS=reports@your-domain.com
```

---

## ✅ After Configuration

1. **Wait for Render to redeploy** (~2 minutes)
2. **Go to LinkedIn Analytics → Reports tab**
3. **Find your scheduled report**
4. **Click "Send Test Email"**
5. **Check your inbox!** 📧

---

## 🧪 Testing the Configuration

Once configured, you can test in two ways:

### **A. Manual Test Email (Instant)**
- Click "Send Test Email" button on any scheduled report
- Email sent immediately (no waiting for scheduler)

### **B. Automated Scheduler (Daily)**
- Scheduler runs daily at midnight (server time)
- Reports sent automatically based on frequency (daily/weekly/monthly/quarterly)

---

## 📊 Email Report Contents

Automated emails include:

- 📊 **Report Name & Description**
- 🔗 **Link to Dashboard** (interactive report view)
- 📅 **Generation Date & Time**
- 🔁 **Frequency Information** (daily/weekly/monthly/quarterly)
- 💡 **Note about real-time data** in dashboard

---

## 🔍 Troubleshooting

### **"Email service not configured" error:**
- Email environment variables are missing on Render
- Follow setup steps above to add credentials

### **"Failed to send test report email" error:**
- Invalid email credentials (check username/password)
- Email service blocked by firewall
- Check Render logs for detailed error

### **Email sent but not received:**
- Check spam/junk folder
- Verify recipient email address is correct
- For Gmail: check "Promotions" tab
- For corporate emails: check with IT (might be blocked)

### **Check Render Logs:**
```
Render Dashboard → Your Service → Logs
```

Look for:
```
[Report Scheduler] Email provider configured as "mailgun"
[Report Scheduler] Attempting to send test email to: user@example.com
[Report Scheduler] Send result: SUCCESS ✅
```

---

## 🚀 Next Steps

1. **Configure email credentials** on Render (see options above)
2. **Wait for redeploy** to complete
3. **Test the "Send Test Email"** button
4. **Create scheduled reports** and they'll be sent automatically!

---

## 📞 Need Help?

If you encounter issues:

1. Check Render logs for detailed error messages
2. Verify environment variables are set correctly (no typos)
3. Test email credentials with your provider's test tool first
4. Ensure EMAIL_FROM_ADDRESS matches your provider's verified domain

---

**Your scheduled reports will work automatically once email is configured!** ✨

