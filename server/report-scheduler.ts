import { db } from "./db";
import { emailService } from "./services/email-service";
import { storage } from "./storage";
import type { LinkedInReport } from "../shared/schema";

/**
 * Report Scheduler - Automated Email Reports
 * Checks for scheduled reports and sends them via email
 */

interface ReportWithCampaign extends LinkedInReport {
  campaignId?: string | null;
  platformType?: string;
}

/**
 * Check if today matches the report schedule
 */
function shouldSendReport(report: ReportWithCampaign): boolean {
  if (!report.scheduleEnabled || report.status !== 'active') {
    return false;
  }

  const today = new Date();
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const dayOfMonth = today.getDate();
  const month = today.getMonth();

  switch (report.scheduleFrequency) {
    case 'daily':
      return true;

    case 'weekly':
      const scheduledDay = report.scheduleDayOfWeek || 'monday';
      const dayMap: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6
      };
      return dayOfWeek === dayMap[scheduledDay.toLowerCase()];

    case 'monthly':
      const scheduledDayOfMonth = report.scheduleDayOfMonth || 'first';
      
      if (scheduledDayOfMonth === 'first') {
        return dayOfMonth === 1;
      } else if (scheduledDayOfMonth === 'last') {
        const lastDay = new Date(today.getFullYear(), month + 1, 0).getDate();
        return dayOfMonth === lastDay;
      } else if (scheduledDayOfMonth === 'mid') {
        return dayOfMonth === 15;
      } else {
        // Specific day number (1-31)
        const targetDay = parseInt(scheduledDayOfMonth);
        return dayOfMonth === targetDay;
      }

    case 'quarterly':
      const quarterTiming = report.quarterTiming || 'end';
      const isQuarterEnd = [2, 5, 8, 11].includes(month); // March, June, September, December
      
      if (!isQuarterEnd) return false;

      const lastDayOfMonth = new Date(today.getFullYear(), month + 1, 0).getDate();
      
      if (quarterTiming === 'start') {
        // First day of first month of quarter
        const isQuarterStart = [0, 3, 6, 9].includes(month); // January, April, July, October
        return isQuarterStart && dayOfMonth === 1;
      } else {
        // End of quarter logic
        const scheduledDay = report.scheduleDayOfMonth || 'last';
        
        if (scheduledDay === 'last') {
          return dayOfMonth === lastDayOfMonth;
        } else if (scheduledDay === 'first') {
          return dayOfMonth === 1;
        } else if (scheduledDay === 'mid') {
          return dayOfMonth === 15;
        }
      }
      return false;

    default:
      return false;
  }
}

/**
 * Generate report data URL for email link
 */
function getReportViewUrl(report: ReportWithCampaign): string {
  const baseUrl = process.env.APP_URL || 'https://performancecore.app';
  if (report.campaignId) {
    return `${baseUrl}/campaigns/${report.campaignId}/linkedin-analytics?tab=reports`;
  }
  return `${baseUrl}/linkedin-analytics?tab=reports`;
}

/**
 * Send report email
 */
async function sendReportEmail(report: ReportWithCampaign, recipients: string[]): Promise<boolean> {
  try {
    console.log(`[Report Scheduler] Preparing to send report: ${report.name} to ${recipients.length} recipients`);

    // Get report configuration
    const config = typeof report.configuration === 'string' 
      ? JSON.parse(report.configuration) 
      : report.configuration;

    const reportTypeLabels: Record<string, string> = {
      overview: 'Overview Report',
      kpis: 'KPIs Report',
      benchmarks: 'Benchmarks Report',
      ads: 'Ad Comparison Report',
      custom: 'Custom Report'
    };

    const reportLabel = reportTypeLabels[report.reportType] || 'LinkedIn Analytics Report';
    const viewUrl = getReportViewUrl(report);

    const frequencyLabels: Record<string, string> = {
      daily: 'Daily',
      weekly: 'Weekly',
      monthly: 'Monthly',
      quarterly: 'Quarterly'
    };

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f5f5f5;
            }
            .email-container {
              background-color: white;
              border-radius: 8px;
              overflow: hidden;
              box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            }
            .header {
              background: linear-gradient(135deg, #0077B5 0%, #00A0DC 100%);
              color: white;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .header p {
              margin: 10px 0 0 0;
              font-size: 16px;
              opacity: 0.9;
            }
            .content {
              padding: 40px 30px;
            }
            .report-info {
              background: #f9fafb;
              border-left: 4px solid #0077B5;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .report-info h2 {
              margin: 0 0 15px 0;
              font-size: 20px;
              color: #111827;
            }
            .info-row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .info-row:last-child {
              border-bottom: none;
            }
            .info-label {
              font-weight: 600;
              color: #6b7280;
            }
            .info-value {
              color: #111827;
            }
            .cta-button {
              display: inline-block;
              background: #0077B5;
              color: white;
              padding: 14px 32px;
              text-decoration: none;
              border-radius: 6px;
              font-weight: 600;
              margin: 30px 0;
              text-align: center;
            }
            .cta-button:hover {
              background: #006396;
            }
            .note {
              background: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
              font-size: 14px;
            }
            .footer {
              background: #f9fafb;
              padding: 30px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .footer a {
              color: #0077B5;
              text-decoration: none;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>📊 ${reportLabel}</h1>
              <p>${frequencyLabels[report.scheduleFrequency] || 'Scheduled'} Report Delivery</p>
            </div>
            
            <div class="content">
              <p>Hello,</p>
              
              <p>Your scheduled LinkedIn Analytics report is ready for review.</p>
              
              <div class="report-info">
                <h2>${report.name}</h2>
                ${report.description ? `<p style="color: #6b7280; margin: 10px 0;">${report.description}</p>` : ''}
                
                <div style="margin-top: 20px;">
                  <div class="info-row">
                    <span class="info-label">Report Type:</span>
                    <span class="info-value">${reportLabel}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Frequency:</span>
                    <span class="info-value">${frequencyLabels[report.scheduleFrequency] || report.scheduleFrequency}</span>
                  </div>
                  <div class="info-row">
                    <span class="info-label">Generated:</span>
                    <span class="info-value">${new Date().toLocaleString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                  </div>
                </div>
              </div>
              
              <div style="text-align: center;">
                <a href="${viewUrl}" class="cta-button">View Report in Dashboard →</a>
              </div>
              
              <div class="note">
                <strong>💡 Note:</strong> This report contains real-time data from your LinkedIn campaigns. 
                For the most up-to-date metrics and interactive visualizations, please view the report in your dashboard.
              </div>
              
              <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
                This report was automatically generated based on your schedule settings. 
                You can manage or modify your report schedules in the Reports section of your dashboard.
              </p>
            </div>
            
            <div class="footer">
              <p><strong>PerformanceCore</strong> – Enterprise LinkedIn Analytics</p>
              <p style="margin: 10px 0;">
                <a href="${baseUrl}">Dashboard</a> · 
                <a href="${baseUrl}/linkedin-analytics?tab=reports">Manage Reports</a>
              </p>
              <p style="margin-top: 20px; font-size: 12px;">
                This is an automated email. If you no longer wish to receive these reports, 
                please disable the schedule in your dashboard settings.
              </p>
            </div>
          </div>
        </body>
      </html>
    `;

    const subject = `📊 ${frequencyLabels[report.scheduleFrequency]} Report: ${report.name}`;

    const sent = await emailService.sendEmail({
      to: recipients,
      subject,
      html
    });

    if (sent) {
      console.log(`[Report Scheduler] ✅ Successfully sent report "${report.name}" to ${recipients.length} recipients`);
    } else {
      console.error(`[Report Scheduler] ❌ Failed to send report "${report.name}"`);
    }

    return sent;
  } catch (error) {
    console.error(`[Report Scheduler] Error sending report email:`, error);
    return false;
  }
}

/**
 * Main scheduler function - checks and sends scheduled reports
 */
export async function checkScheduledReports(): Promise<void> {
  try {
    console.log('[Report Scheduler] Checking for scheduled reports...');

    // Get all active reports with schedules
    const allReports = await storage.getPlatformReports('linkedin');
    
    if (!allReports || allReports.length === 0) {
      console.log('[Report Scheduler] No reports found');
      return;
    }

    const scheduledReports = allReports.filter(r => r.scheduleEnabled && r.status === 'active');
    
    if (scheduledReports.length === 0) {
      console.log('[Report Scheduler] No scheduled reports found');
      return;
    }

    console.log(`[Report Scheduler] Found ${scheduledReports.length} scheduled reports`);

    for (const report of scheduledReports) {
      if (shouldSendReport(report)) {
        console.log(`[Report Scheduler] Report "${report.name}" is due today`);

        // Get recipients
        const recipients = report.scheduleRecipients || [];
        
        if (!recipients || recipients.length === 0) {
          console.warn(`[Report Scheduler] Report "${report.name}" has no recipients, skipping`);
          continue;
        }

        // Send email
        await sendReportEmail(report, recipients);

        // Add a small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    console.log('[Report Scheduler] ✅ Scheduled reports check completed');
  } catch (error) {
    console.error('[Report Scheduler] Error in checkScheduledReports:', error);
  }
}

/**
 * For testing - manually trigger a report email
 */
export async function sendTestReport(reportId: string): Promise<boolean> {
  try {
    console.log(`[Report Scheduler] Sending test report: ${reportId}`);
    
    const allReports = await storage.getPlatformReports('linkedin');
    const report = allReports.find(r => r.id === reportId);

    if (!report) {
      console.error(`[Report Scheduler] Report not found: ${reportId}`);
      return false;
    }

    const recipients = report.scheduleRecipients || [];
    
    if (recipients.length === 0) {
      console.error(`[Report Scheduler] No recipients configured for report: ${reportId}`);
      return false;
    }

    return await sendReportEmail(report, recipients);
  } catch (error) {
    console.error('[Report Scheduler] Error sending test report:', error);
    return false;
  }
}

/**
 * Start the report scheduler - runs daily to check for scheduled reports
 */
export function startReportScheduler(): void {
  console.log('[Report Scheduler] Starting report scheduler...');

  // Get configured time from environment or default to 9:00 AM
  const scheduledHour = parseInt(process.env.REPORT_SCHEDULE_HOUR || '9');
  const scheduledMinute = parseInt(process.env.REPORT_SCHEDULE_MINUTE || '0');

  // Run immediately on startup for testing (optional - can be disabled in production)
  if (process.env.RUN_REPORT_SCHEDULER_ON_STARTUP === 'true') {
    checkScheduledReports();
  }

  // Calculate time until next scheduled run
  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(scheduledHour, scheduledMinute, 0, 0);

  // If the scheduled time has already passed today, schedule for tomorrow
  if (nextRun <= now) {
    nextRun.setDate(nextRun.getDate() + 1);
  }

  const timeUntilNextRun = nextRun.getTime() - now.getTime();

  console.log(`[Report Scheduler] Next scheduled check: ${nextRun.toLocaleString()}`);

  setTimeout(() => {
    checkScheduledReports();
    
    // Then run every 24 hours
    setInterval(checkScheduledReports, 24 * 60 * 60 * 1000);
  }, timeUntilNextRun);

  console.log('[Report Scheduler] ✅ Report scheduler started successfully');
}

