# Test Mailgun webhook with mock PDF data
# This simulates what Mailgun would send when it receives an email with a PDF

$campaignEmail = "temp-1763426057214@sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org"

# Mock PDF content (base64 encoded sample metrics)
$pdfBase64 = "JVBERi0xLjQKJeLjz9MKMyAwIG9iago8PC9UeXBlL1BhZ2UvUGFyZW50IDIgMCBSL1Jlc291cmNlczw8L0ZvbnQ8PC9GMSA1IDAgUj4+Pj4vTWVkaWFCb3hbMCAwIDYxMiA3OTJdL0NvbnRlbnRzIDQgMCBSPj4KZW5kb2JqCjQgMCBvYmoKPDwvTGVuZ3RoIDQ0Pj4Kc3RyZWFtCkJUCi9GMSA0OCBUZgoxMCA3MDAgVGQKKFRlc3QgUmVwb3J0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwvVHlwZS9Gb250L1N1YnR5cGUvVHlwZTEvQmFzZUZvbnQvSGVsdmV0aWNhPj4KZW5kb2JqCjIgMCBvYmoKPDwvVHlwZS9QYWdlcy9LaWRzWzMgMCBSXS9Db3VudCAxPj4KZW5kb2JqCjEgMCBvYmoKPDwvVHlwZS9DYXRhbG9nL1BhZ2VzIDIgMCBSPj4KZW5kb2JqCnhyZWYKMCA2CjAwMDAwMDAwMDAgNjU1MzUgZiAKMDAwMDAwMDI1MiAwMDAwMCBuIAowMDAwMDAwMjAxIDAwMDAwIG4gCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDEyNyAwMDAwMCBuIAowMDAwMDAwMTcxIDAwMDAwIG4gCnRyYWlsZXIKPDwvU2l6ZSA2L1Jvb3QgMSAwIFI+PgpzdGFydHhyZWYKMzAxCiUlRU9GCg=="

# Create the webhook payload (exactly as Mailgun sends it)
$payload = @{
    recipient = $campaignEmail
    sender = "test@example.com"
    from = "Test Sender <test@example.com>"
    subject = "Weekly Performance Report"
    "body-plain" = "Please see attached report"
    "attachment-count" = "1"
    "attachment-1" = $pdfBase64
    timestamp = [int][double]::Parse((Get-Date -UFormat %s))
    token = "test-token-123"
    signature = "test-signature"
} | ConvertTo-Json

Write-Host "Sending mock Mailgun webhook to Render..." -ForegroundColor Cyan
Write-Host "Campaign email: $campaignEmail" -ForegroundColor Yellow

try {
    $response = Invoke-WebRequest `
        -Uri "https://mforensics.onrender.com/api/mailgun/inbound" `
        -Method POST `
        -ContentType "application/x-www-form-urlencoded" `
        -Body @{
            recipient = $campaignEmail
            sender = "test@example.com"
            from = "Test Sender <test@example.com>"
            subject = "Weekly Performance Report"
            "body-plain" = "Please see attached report"
            "attachment-count" = "1"
            "attachment-1" = $pdfBase64
            timestamp = [int][double]::Parse((Get-Date -UFormat %s))
        }
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nNow check:" -ForegroundColor Cyan
    Write-Host "1. Render logs for [Mailgun] entries" -ForegroundColor White
    Write-Host "2. Your campaign's 'View Detailed Analytics' page" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host "`nResponse:" -ForegroundColor Yellow
    Write-Host $_.Exception.Response -ForegroundColor White
}

