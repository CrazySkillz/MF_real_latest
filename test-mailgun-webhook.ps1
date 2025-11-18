# Test Mailgun webhook with mock PDF data
# This simulates what Mailgun would send when it receives an email with a PDF

$campaignEmail = "mailgun-test-campaign@sandbox43db1805452144a196b3959d1b81ae5f.mailgun.org"

# Create a simple test PDF with metrics text
$pdfContent = @"
%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 200 >>
stream
BT
/F1 24 Tf
50 700 Td
(Marketing Campaign Report) Tj
0 -40 Td
(Impressions: 125000) Tj
0 -30 Td
(Clicks: 8500) Tj
0 -30 Td
(Conversions: 450) Tj
0 -30 Td
(Spend: $12500) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000214 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
465
%%EOF
"@

# Save as temporary PDF file
$tempPdfPath = Join-Path $env:TEMP "test-report.pdf"
$pdfContent | Out-File -FilePath $tempPdfPath -Encoding ASCII -NoNewline

Write-Host "Sending mock Mailgun webhook to Render..." -ForegroundColor Cyan
Write-Host "Campaign email: $campaignEmail" -ForegroundColor Yellow

try {
    # Create multipart/form-data boundary
    $boundary = [System.Guid]::NewGuid().ToString()
    
    # Build multipart body
    $LF = "`r`n"
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"recipient`"",
        "",
        $campaignEmail,
        "--$boundary",
        "Content-Disposition: form-data; name=`"sender`"",
        "",
        "test@example.com",
        "--$boundary",
        "Content-Disposition: form-data; name=`"from`"",
        "",
        "Test Sender <test@example.com>",
        "--$boundary",
        "Content-Disposition: form-data; name=`"subject`"",
        "",
        "Weekly Performance Report",
        "--$boundary",
        "Content-Disposition: form-data; name=`"body-plain`"",
        "",
        "Please see attached report",
        "--$boundary",
        "Content-Disposition: form-data; name=`"attachment-1`"; filename=`"test-report.pdf`"",
        "Content-Type: application/pdf",
        "",
        [System.IO.File]::ReadAllText($tempPdfPath),
        "--$boundary--"
    )
    
    $body = $bodyLines -join $LF
    
    $response = Invoke-WebRequest `
        -Uri "https://mforensics.onrender.com/api/mailgun/inbound" `
        -Method POST `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $body
    
    Write-Host "`n✅ SUCCESS!" -ForegroundColor Green
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "`nNow check:" -ForegroundColor Cyan
    Write-Host "1. Render logs for [Mailgun] entries" -ForegroundColor White
    Write-Host "2. Your campaign's 'View Detailed Analytics' page" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ ERROR!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "`nResponse body:" -ForegroundColor Yellow
        Write-Host $responseBody -ForegroundColor White
    }
} finally {
    # Clean up temp file
    if (Test-Path $tempPdfPath) {
        Remove-Item $tempPdfPath -Force
    }
}
