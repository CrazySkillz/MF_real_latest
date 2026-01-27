import { db } from "./db";
import { emailService } from "./services/email-service";
import { storage } from "./storage";
import { campaigns, linkedinReports, reportSendEvents, reportSnapshots } from "../shared/schema";
import { and, eq } from "drizzle-orm";
import type { LinkedInReport } from "../shared/schema";

/**
 * Report Scheduler - Automated Email Reports
 * Checks for scheduled reports and sends them via email
 */

interface ReportWithCampaign extends LinkedInReport {
  campaignId?: string | null;
  platformType?: string;
}

function coercePdfBufferFromDoc(doc: any): Buffer | null {
  // Try the most reliable forms across Node runtimes and bundlers.
  try {
    const nb = doc.output("nodebuffer");
    if (nb) {
      const buf = Buffer.isBuffer(nb) ? nb : Buffer.from(nb as any);
      if (buf.length > 100) return buf;
    }
  } catch {
    // fallthrough
  }

  try {
    const ab = doc.output("arraybuffer");
    const byteLen = (ab && (ab.byteLength ?? (ab as any).length)) || 0;
    if (byteLen && byteLen > 100) {
      // Node supports Buffer.from(ArrayBuffer) and Buffer.from(Uint8Array)
      try {
        return Buffer.from(ab as any);
      } catch {
        try {
          return Buffer.from(new Uint8Array(ab));
        } catch {
          // fallthrough
        }
      }
    }
  } catch {
    // fallthrough
  }

  try {
    const dataUri = doc.output("datauristring");
    const base64 = String(dataUri || "").split(",")[1] || "";
    const buf = base64 ? Buffer.from(base64, "base64") : null;
    if (buf && buf.length > 100) return buf;
  } catch {
    // fallthrough
  }

  return null;
}

function formatNumberLike(v: any): string {
  if (v === null || v === undefined) return "";
  const s = String(v).trim();
  if (!s) return "";
  const n = Number(s);
  if (!Number.isFinite(n)) return s;
  // Keep 0-2 decimals, avoid trailing ".00" unless needed.
  const rounded = Math.round(n * 100) / 100;
  const str = String(rounded);
  return str.includes(".") ? str.replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1") : str;
}

function formatWithUnit(value: any, unit: any): string {
  const v = formatNumberLike(value);
  const u = String(unit || "").trim();
  if (!v) return u ? `0${u}` : "0";
  if (!u) return v;
  if (u === "$") return `$${v}`;
  if (u === "%") return `${v}%`;
  return `${v}${u}`;
}

async function buildPdfAttachmentForReport(args: {
  report: any;
  windowStart: string;
  windowEnd: string;
  campaignName: string | null;
  isTest?: boolean;
}): Promise<Buffer | null> {
  const { report, windowStart, windowEnd, campaignName, isTest } = args;
  try {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    let y = 18;
    const left = 14;
    const pageBottom = 285;

    const addLine = (text: string, fontSize = 10) => {
      if (y > pageBottom) {
        doc.addPage();
        y = 18;
      }
      doc.setFontSize(fontSize);
      // Keep to ASCII to avoid font/encoding quirks in jsPDF default fonts.
      const safe = String(text || "").replace(/[^\x20-\x7E]/g, " ");
      doc.text(safe, left, y);
      y += Math.max(6, fontSize + 2);
    };

    const reportName = String(report?.name || "MetricMind Report");
    const reportType = String(report?.reportType || "");

    doc.setFontSize(16);
    doc.text(isTest ? "MetricMind Report (Test Send)" : "MetricMind Report", left, y);
    y += 10;

    addLine(reportName, 12);
    addLine(campaignName ? `Campaign: ${campaignName}` : "Campaign: (platform-level)", 10);
    addLine(`Type: ${reportType || "report"}`, 10);
    addLine(`Window: ${windowStart} to ${windowEnd} (UTC)`, 10);
    addLine(`Generated: ${new Date().toUTCString()}`, 10);
    y += 4;

    const platformType = String((report as any)?.platformType || "linkedin");
    const campaignId = (report as any)?.campaignId ? String((report as any).campaignId) : undefined;

    // Content by report type (start with high-signal types; fall back gracefully).
    if (reportType.toLowerCase() === "kpis") {
      addLine("KPIs", 12);
      y += 2;

      let kpis: any[] = [];
      try {
        kpis = await storage.getPlatformKPIs(platformType, campaignId);
      } catch {
        kpis = [];
      }

      if (!kpis || kpis.length === 0) {
        addLine("No KPIs found for this scope.", 10);
      } else {
        // Simple readable list format (email-friendly PDF).
        for (const kpi of kpis) {
          const name = String(kpi?.name || "KPI");
          const metric = String(kpi?.metricKey || kpi?.metric || "").trim();
          const status = String(kpi?.status || "").trim();
          const cur = formatWithUnit(kpi?.currentValue, kpi?.unit);
          const tgt = formatWithUnit(kpi?.targetValue, kpi?.unit);
          const metricPart = metric ? ` • ${metric}` : "";
          const statusPart = status ? ` • ${status}` : "";
          addLine(`${name}${metricPart}${statusPart}`, 10);
          addLine(`Current: ${cur}   Target: ${tgt}`, 10);
          y += 2;
        }
      }
    } else if (reportType.toLowerCase() === "benchmarks") {
      addLine("Benchmarks", 12);
      y += 2;

      let benchmarks: any[] = [];
      try {
        benchmarks = campaignId
          ? await storage.getCampaignBenchmarks(campaignId)
          : await storage.getPlatformBenchmarks(platformType);
      } catch {
        benchmarks = [];
      }

      if (!benchmarks || benchmarks.length === 0) {
        addLine("No benchmarks found for this scope.", 10);
      } else {
        for (const b of benchmarks) {
          const name = String(b?.name || "Benchmark");
          const metric = String(b?.metric || "").trim();
          const cur = formatWithUnit(b?.currentValue, b?.unit);
          const tgt = formatWithUnit(b?.benchmarkValue, b?.unit);
          const metricPart = metric ? ` • ${metric}` : "";
          addLine(`${name}${metricPart}`, 10);
          addLine(`Current: ${cur}   Benchmark: ${tgt}`, 10);
          y += 2;
        }
      }
    } else {
      // For other types (overview/ads/custom) we still attach a useful cover page.
      addLine("This PDF includes the report header only.", 10);
      addLine("For full interactive content, open the dashboard Reports tab.", 10);
    }

    y += 6;
    doc.setFontSize(9);
    doc.text("Note: For interactive drilldowns, open the dashboard Reports tab.", left, Math.min(y, pageBottom));

    return coercePdfBufferFromDoc(doc);
  } catch (e) {
    console.warn("[Report Scheduler] buildPdfAttachmentForReport failed:", e);
    return null;
  }
}

/**
 * Scheduling helpers (timezone-aware, idempotent).
 */
function getZonedParts(now: Date, timeZone: string): {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
  weekday: number; // 0-6 (Sun-Sat)
  hour: number; // 0-23
  minute: number; // 0-59
  localDate: string; // YYYY-MM-DD
} {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    weekday: "short",
  });
  const parts = dtf.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value;
  const year = parseInt(get("year") || "0", 10);
  const month = parseInt(get("month") || "0", 10);
  const day = parseInt(get("day") || "0", 10);
  const hour = parseInt(get("hour") || "0", 10);
  const minute = parseInt(get("minute") || "0", 10);
  const wd = String(get("weekday") || "").toLowerCase();
  const weekday =
    wd.startsWith("sun") ? 0 :
    wd.startsWith("mon") ? 1 :
    wd.startsWith("tue") ? 2 :
    wd.startsWith("wed") ? 3 :
    wd.startsWith("thu") ? 4 :
    wd.startsWith("fri") ? 5 :
    wd.startsWith("sat") ? 6 : now.getUTCDay();
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return { year, month, day, weekday, hour, minute, localDate: `${year}-${mm}-${dd}` };
}

function parseHHMM(s: any): { hh: number; mm: number } | null {
  const raw = String(s || "").trim();
  const m = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const hh = parseInt(m[1], 10);
  const mm = parseInt(m[2], 10);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;
  if (hh < 0 || hh > 23 || mm < 0 || mm > 59) return null;
  return { hh, mm };
}

function lastDayOfMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function isReportDueNow(report: ReportWithCampaign, now: Date): { due: boolean; scheduledKey?: string; tz?: string; scheduleTime?: string } {
  if (!report.scheduleEnabled || report.status !== "active") return { due: false };
  if (!report.scheduleFrequency) return { due: false };

  const tz = String((report as any).scheduleTimeZone || "UTC").trim() || "UTC";
  const scheduleTime = String(report.scheduleTime || "09:00").trim();
  const hhmm = parseHHMM(scheduleTime) || { hh: 9, mm: 0 };

  const zp = getZonedParts(now, tz);
  if (zp.hour !== hhmm.hh || zp.minute !== hhmm.mm) return { due: false };

  const monthLast = lastDayOfMonth(zp.year, zp.month);
  const dayOfMonth = zp.day;
  const month = zp.month - 1; // 0-11

  let matches = false;
  switch (String(report.scheduleFrequency).toLowerCase()) {
    case "daily":
      matches = true;
      break;
    case "weekly": {
      const target = typeof report.scheduleDayOfWeek === "number" ? report.scheduleDayOfWeek : null;
      matches = target === null ? false : zp.weekday === target;
      break;
    }
    case "monthly": {
      const raw = typeof report.scheduleDayOfMonth === "number" ? report.scheduleDayOfMonth : null;
      if (raw === null) { matches = false; break; }
      const target = raw === 0 ? monthLast : Math.min(Math.max(raw, 1), monthLast);
      matches = dayOfMonth === target;
      break;
    }
    case "quarterly": {
      const quarterTiming = String((report as any).quarterTiming || "end").toLowerCase();
      const isQuarterStartMonth = [0, 3, 6, 9].includes(month);
      const isQuarterEndMonth = [2, 5, 8, 11].includes(month);
      if (quarterTiming === "start") {
        matches = isQuarterStartMonth && dayOfMonth === 1;
      } else {
        // End of quarter month, default to last day unless scheduleDayOfMonth overrides
        if (!isQuarterEndMonth) { matches = false; break; }
        const raw = typeof report.scheduleDayOfMonth === "number" ? report.scheduleDayOfMonth : 0;
        const target = raw === 0 ? monthLast : Math.min(Math.max(raw, 1), monthLast);
        matches = dayOfMonth === target;
      }
      break;
    }
    default:
      matches = false;
  }

  if (!matches) return { due: false };
  const scheduledKey = `${zp.localDate}T${String(hhmm.hh).padStart(2, "0")}:${String(hhmm.mm).padStart(2, "0")}@${tz}`;
  return { due: true, scheduledKey, tz, scheduleTime: `${String(hhmm.hh).padStart(2, "0")}:${String(hhmm.mm).padStart(2, "0")}` };
}

/**
 * Generate report data URL for email link
 */
function getReportViewUrl(report: ReportWithCampaign): string {
  const baseUrl = process.env.APP_URL || 'https://metricmind.app';
  if (report.campaignId) {
    return `${baseUrl}/campaigns/${report.campaignId}/linkedin-analytics?tab=reports`;
  }
  return `${baseUrl}/linkedin-analytics?tab=reports`;
}

/**
 * Send report email
 */
async function sendReportEmail(
  report: ReportWithCampaign,
  recipients: string[],
  meta?: {
    windowStart?: string;
    windowEnd?: string;
    campaignName?: string | null;
    snapshotId?: string;
    attachment?: { filename: string; content: Buffer } | null;
  }
): Promise<boolean> {
  try {
    console.log(`[Report Scheduler] Preparing to send report: ${report.name} to ${recipients.length} recipients`);

    // Get report configuration (optional)
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
    const baseUrl = process.env.APP_URL || 'https://metricmind.app';

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
              <p>Your scheduled MetricMind report is ready.</p>
              
              <div class="report-info">
                <h2>${report.name}</h2>
                ${report.description ? `<p style="color: #6b7280; margin: 10px 0;">${report.description}</p>` : ''}
                
                <div style="margin-top: 20px;">
                  ${meta?.campaignName ? `
                  <div class="info-row">
                    <span class="info-label">Campaign:</span>
                    <span class="info-value">${meta.campaignName}</span>
                  </div>` : ''}
                  <div class="info-row">
                    <span class="info-label">Report Type:</span>
                    <span class="info-value">${reportLabel}</span>
                  </div>
                  ${(meta?.windowStart && meta?.windowEnd) ? `
                  <div class="info-row">
                    <span class="info-label">Window:</span>
                    <span class="info-value">${meta.windowStart} → ${meta.windowEnd} (UTC)</span>
                  </div>` : ''}
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
              <p><strong>MetricMind</strong> – Executive Marketing Analytics</p>
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
      html,
      attachments: meta?.attachment ? [{ filename: meta.attachment.filename, content: meta.attachment.content, contentType: 'application/pdf' }] : undefined,
      auditContext: {
        kind: 'report',
        entityType: 'report',
        entityId: String((report as any)?.id || ''),
        campaignId: String((report as any)?.campaignId || ''),
        campaignName: String(meta?.campaignName || (report as any)?.campaignName || ''),
      }
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
    console.log('[Report Scheduler] Checking for due scheduled reports...');
    const now = new Date();

    // Get all active reports with schedules - try both storage methods
    let allReports: any[] = [];
    
    try {
      // Try LinkedIn-specific reports first
      const linkedInReports = await storage.getLinkedInReports();
      allReports = allReports.concat(linkedInReports);
      console.log(`[Report Scheduler] Found ${linkedInReports.length} LinkedIn reports`);
    } catch (error) {
      console.log('[Report Scheduler] No LinkedIn reports found');
    }
    
    try {
      // Also check platform reports
      const platformReports = await storage.getPlatformReports('linkedin');
      allReports = allReports.concat(platformReports);
      console.log(`[Report Scheduler] Found ${platformReports.length} platform reports`);
    } catch (error) {
      console.log('[Report Scheduler] No platform reports found');
    }
    
    if (allReports.length === 0) {
      console.log('[Report Scheduler] No reports found in either storage');
      return;
    }

    const scheduledReports = allReports.filter(r => r.scheduleEnabled && r.status === 'active');
    
    if (scheduledReports.length === 0) {
      console.log('[Report Scheduler] No scheduled reports found');
      return;
    }

    console.log(`[Report Scheduler] Found ${scheduledReports.length} scheduled reports`);

    for (const report of scheduledReports) {
      const due = isReportDueNow(report, now);
      if (!due.due || !due.scheduledKey) continue;

      // Idempotency: ensure we only send once per scheduled slot.
      const inserted = await db
        .insert(reportSendEvents)
        .values({
          reportId: String((report as any).id),
          scheduledKey: due.scheduledKey,
          timeZone: due.tz || null,
          recipients: (report as any).scheduleRecipients || null,
          status: "pending",
        } as any)
        .onConflictDoNothing()
        .returning()
        .catch(() => []);
      if (!inserted || inserted.length === 0) {
        continue; // already processed
      }

      console.log(`[Report Scheduler] Report "${report.name}" is due now (${due.scheduledKey})`);

        // Get recipients
        const recipients = report.scheduleRecipients || [];
        
        if (!recipients || recipients.length === 0) {
          console.warn(`[Report Scheduler] Report "${report.name}" has no recipients, skipping`);
          continue;
        }

        // Compute report window (align to LinkedIn analytics: last 30 complete UTC days)
        const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
        const start = new Date(end.getTime());
        start.setUTCDate(start.getUTCDate() - 29);
        const windowStart = start.toISOString().slice(0, 10);
        const windowEnd = end.toISOString().slice(0, 10);

        // Snapshot (what was sent)
        let campaignName: string | null = null;
        try {
          if ((report as any).campaignId) {
            const [c] = await db.select().from(campaigns).where(eq(campaigns.id, String((report as any).campaignId)));
            campaignName = (c as any)?.name || null;
          }
        } catch {
          campaignName = null;
        }

        const snapshotPayload = {
          reportId: String((report as any).id),
          reportName: String((report as any).name || ""),
          reportType: String((report as any).reportType || ""),
          platformType: String((report as any).platformType || "linkedin"),
          campaignId: (report as any).campaignId || null,
          campaignName,
          windowStart,
          windowEnd,
          generatedAt: now.toISOString(),
          scheduledKey: due.scheduledKey,
        };

        const [snap] = await db
          .insert(reportSnapshots)
          .values({
            reportId: snapshotPayload.reportId,
            campaignId: snapshotPayload.campaignId,
            platformType: snapshotPayload.platformType,
            reportType: snapshotPayload.reportType,
            windowStart,
            windowEnd,
            snapshotJson: JSON.stringify(snapshotPayload),
            hasEstimated: false,
          } as any)
          .returning()
          .catch(() => []);

        const pdfBuffer = await buildPdfAttachmentForReport({
          report,
          windowStart,
          windowEnd,
          campaignName,
          isTest: false,
        });
        console.log(`[Report Scheduler] PDF attachment bytes: ${pdfBuffer ? pdfBuffer.length : 0}`);

        // Send email (with PDF attachment when possible)
        const sent = await sendReportEmail(report, recipients, {
          windowStart,
          windowEnd,
          campaignName,
          snapshotId: (snap as any)?.id ? String((snap as any).id) : undefined,
          attachment: pdfBuffer ? { filename: `${snapshotPayload.reportName.replace(/\s+/g, "_")}_${windowEnd}.pdf`, content: pdfBuffer } : null,
        });

        await db
          .update(reportSendEvents)
          .set({
            status: sent ? "sent" : "failed",
            error: sent ? null : "Email send failed",
            sentAt: sent ? new Date() : null,
            snapshotId: (snap as any)?.id ? String((snap as any).id) : null,
          } as any)
          .where(and(eq(reportSendEvents.reportId, snapshotPayload.reportId), eq(reportSendEvents.scheduledKey, due.scheduledKey)))
          .catch(() => {});

        if (sent) {
          // Update report book-keeping
          await db
            .update(linkedinReports)
            .set({ lastSentAt: new Date() } as any)
            .where(eq(linkedinReports.id, snapshotPayload.reportId))
            .catch(() => {});
        }

        // Add a small delay between emails to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log('[Report Scheduler] ✅ Due reports check completed');
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
    
    // Check email configuration
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    const hasEmailConfig = 
      (emailProvider === 'mailgun' && process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) ||
      (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) ||
      (emailProvider === 'smtp' && process.env.SMTP_USER && process.env.SMTP_PASS);
    
    if (!hasEmailConfig) {
      console.error(`[Report Scheduler] ❌ Email provider configured as "${emailProvider}" but credentials are missing`);
      console.error('[Report Scheduler] Please configure email environment variables on Render:');
      console.error('  - For Mailgun: MAILGUN_SMTP_USER, MAILGUN_SMTP_PASS');
      console.error('  - For SendGrid: SENDGRID_API_KEY');
      console.error('  - For SMTP: SMTP_USER, SMTP_PASS');
      return false;
    }
    
    // Try both storage methods - LinkedIn-specific first, then platform-generic
    console.log(`[Report Scheduler] Fetching report from storage...`);
    
    let report;
    try {
      // First try LinkedIn-specific reports (used by /api/linkedin/reports)
      report = await storage.getLinkedInReport(reportId);
      console.log(`[Report Scheduler] Found report via getLinkedInReport: ${report ? 'YES' : 'NO'}`);
    } catch (error) {
      console.log(`[Report Scheduler] LinkedIn report fetch failed, trying platform reports...`);
    }
    
    // If not found, try platform reports
    if (!report) {
      const allReports = await storage.getPlatformReports('linkedin');
      report = allReports.find(r => r.id === reportId);
      console.log(`[Report Scheduler] Found report via getPlatformReports: ${report ? 'YES' : 'NO'}`);
    }

    if (!report) {
      console.error(`[Report Scheduler] Report not found in either storage method: ${reportId}`);
      
      // Debug: List all available reports
      try {
        const linkedInReports = await storage.getLinkedInReports();
        const platformReports = await storage.getPlatformReports('linkedin');
        console.log(`[Report Scheduler] DEBUG - Available LinkedIn reports: ${linkedInReports.length}`);
        console.log(`[Report Scheduler] DEBUG - Available platform reports: ${platformReports.length}`);
        if (linkedInReports.length > 0) {
          console.log(`[Report Scheduler] DEBUG - LinkedIn report IDs:`, linkedInReports.map(r => r.id));
        }
        if (platformReports.length > 0) {
          console.log(`[Report Scheduler] DEBUG - Platform report IDs:`, platformReports.map(r => r.id));
        }
      } catch (debugError) {
        console.error(`[Report Scheduler] DEBUG - Error listing reports:`, debugError);
      }
      
      return false;
    }

    console.log(`[Report Scheduler] Found report: ${report.name}`);
    console.log(`[Report Scheduler] Report type: ${report.reportType}`);
    console.log(`[Report Scheduler] Schedule recipients:`, report.scheduleRecipients);

    const recipients = report.scheduleRecipients || [];
    
    if (recipients.length === 0) {
      console.error(`[Report Scheduler] No recipients configured for report: ${reportId}`);
      return false;
    }

    console.log(`[Report Scheduler] Attempting to send test email to: ${recipients.join(', ')}`);

    // Match production behavior: include window + best-effort PDF attachment.
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
    const start = new Date(end.getTime());
    start.setUTCDate(start.getUTCDate() - 29);
    const windowStart = start.toISOString().slice(0, 10);
    const windowEnd = end.toISOString().slice(0, 10);

    // Snapshot meta (optional, best-effort campaign name)
    let campaignName: string | null = null;
    try {
      if ((report as any)?.campaignId) {
        const [c] = await db.select().from(campaigns).where(eq(campaigns.id, String((report as any).campaignId)));
        campaignName = (c as any)?.name || null;
      }
    } catch {
      campaignName = null;
    }

    const pdfBuffer = await buildPdfAttachmentForReport({
      report,
      windowStart,
      windowEnd,
      campaignName,
      isTest: true,
    });
    console.log(`[Report Scheduler] PDF attachment bytes (test): ${pdfBuffer ? pdfBuffer.length : 0}`);

    const safeName = String((report as any)?.name || "MetricMind_Report").replace(/\s+/g, "_");
    const result = await sendReportEmail(report, recipients, {
      windowStart,
      windowEnd,
      campaignName,
      attachment: pdfBuffer ? { filename: `${safeName}_${windowEnd}.pdf`, content: pdfBuffer } : null,
    });
    console.log(`[Report Scheduler] Send result: ${result ? 'SUCCESS ✅' : 'FAILED ❌'}`);
    
    return result;
  } catch (error) {
    console.error('[Report Scheduler] Error sending test report:', error);
    console.error('[Report Scheduler] Error details:', error instanceof Error ? error.message : String(error));
    return false;
  }
}

/**
 * Start the report scheduler - runs daily to check for scheduled reports
 */
export function startReportScheduler(): void {
  console.log('[Report Scheduler] Starting report scheduler...');
  // Production-grade scheduling: check due reports frequently (per-report timezone + HH:MM).
  // We rely on idempotent send-events to prevent duplicate sends.
  const intervalMs = Math.max(15000, parseInt(process.env.REPORT_SCHEDULER_POLL_MS || "60000", 10) || 60000);

  // Optionally run immediately on startup
  if (process.env.RUN_REPORT_SCHEDULER_ON_STARTUP === "true") {
    void checkScheduledReports();
  }

  setInterval(() => {
    void checkScheduledReports();
  }, intervalMs);

  console.log(`[Report Scheduler] ✅ Report scheduler started (poll=${intervalMs}ms)`);
}

