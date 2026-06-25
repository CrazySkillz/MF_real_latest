import nodemailer from 'nodemailer';
import { db } from "../db";
import { campaigns, clients, emailAlertEvents } from "../../shared/schema.js";
import { eq } from "drizzle-orm";
import { buildAlertEmailAuditState } from "../utils/alert-email-audit";

interface EmailAuditContext {
  kind: 'alert' | 'report' | 'test' | 'generic';
  entityType?: 'kpi' | 'benchmark' | 'report' | 'test' | string;
  entityId?: string;
  auditEventId?: string;
  dedupeKey?: string;
  campaignId?: string;
  campaignName?: string;
  deliveryStatus?: unknown;
  attemptCount?: number;
  nextAttemptAt?: Date;
}

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Array<{
    filename: string;
    content: Buffer;
    contentType?: string;
  }>;
  auditContext?: EmailAuditContext;
}

interface AlertEmailData {
  type: 'kpi' | 'benchmark';
  name: string;
  currentValue: number;
  thresholdValue: number;
  condition: 'below' | 'above' | 'equals';
  targetValue?: number;
  unit?: string;
  campaignName?: string;
}

class EmailService {
  private isIsoCurrencyCode(unit: string): boolean {
    return /^[A-Z]{3}$/.test(String(unit || "").trim());
  }

  private formatPct(value: number): string {
    const rounded = Math.round(value * 10) / 10;
    if (rounded === Math.floor(rounded)) return `${Math.round(rounded)}%`;
    return `${rounded.toFixed(1)}%`;
  }

  private formatAlertDisplayValue(value: number | undefined, unit: unknown): string {
    const num = Number(value);
    if (!Number.isFinite(num)) return String(value ?? "");
    const normalizedUnit = String(unit || "").trim();

    switch (normalizedUnit) {
      case "%":
        return this.formatPct(num);
      case "$":
        return `$${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      case "ratio":
        return `${num.toFixed(2)}x`;
      case "seconds":
        return `${num.toFixed(1)}s`;
      case "count":
        return num.toLocaleString();
      default:
        if (this.isIsoCurrencyCode(normalizedUnit)) {
          try {
            return new Intl.NumberFormat("en-US", {
              style: "currency",
              currency: normalizedUnit,
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            }).format(num);
          } catch {
            return num.toLocaleString();
          }
        }
        return num.toLocaleString();
    }
  }

  private buildAlertSummary(data: AlertEmailData): string {
    return `Current value: ${this.formatAlertDisplayValue(data.currentValue, data.unit)}`;
  }

  private transporter: any;

  constructor() {
    this.initializeTransporter();
  }

  private getConfiguredProvider(): string {
    const autoProvider =
      (process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) || (process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS)
        ? 'mailgun'
        : (process.env.SENDGRID_API_KEY ? 'sendgrid' : 'smtp');
    return (process.env.EMAIL_PROVIDER || autoProvider || 'smtp').trim().toLowerCase();
  }

  private initializeTransporter() {
    // Auto-detect provider if EMAIL_PROVIDER isn't explicitly set (prevents "configured but not used" confusion).
    const emailProvider = this.getConfiguredProvider();
    
    console.log(`[Email Service] Initializing with provider: ${emailProvider}`);
    
    switch (emailProvider.toLowerCase()) {
      case 'sendgrid':
        this.transporter = nodemailer.createTransport({
          host: 'smtp.sendgrid.net',
          port: 587,
          secure: false,
          auth: {
            user: 'apikey',
            pass: process.env.SENDGRID_API_KEY || process.env.EMAIL_SERVICE_API_KEY,
          },
        });
        break;
      
      case 'mailgun':
        const smtpHost = process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org';
        const smtpPort = parseInt(process.env.MAILGUN_SMTP_PORT || '587');
        const smtpUser = process.env.MAILGUN_SMTP_USER;
        
        console.log(`[Email Service] Mailgun SMTP Config:`);
        console.log(`  Host: ${smtpHost}`);
        console.log(`  Port: ${smtpPort}`);
        console.log(`  User: ${smtpUser ? smtpUser.substring(0, 20) + '...' : 'NOT SET'}`);
        console.log(`  Pass: ${process.env.MAILGUN_SMTP_PASS ? '***SET***' : 'NOT SET'}`);
        
        this.transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: false,
          auth: {
            user: smtpUser,
            pass: process.env.MAILGUN_SMTP_PASS || process.env.EMAIL_SERVICE_API_KEY,
          },
          connectionTimeout: 10000, // 10 seconds
          greetingTimeout: 10000,
          socketTimeout: 10000,
        });
        break;
      
      case 'smtp':
      default:
        this.transporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST || 'smtp.gmail.com',
          port: parseInt(process.env.SMTP_PORT || '587'),
          secure: process.env.SMTP_SECURE === 'true',
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS || process.env.EMAIL_SERVICE_API_KEY,
          },
        });
        break;
    }
  }

  async sendEmail(options: EmailOptions): Promise<boolean> {
    const from = process.env.EMAIL_FROM_ADDRESS || 'alerts@metricmind.app';
    const recipients = this.normalizeRecipients(options.to);
    const toText = recipients.join(', ');
    if (recipients.length === 0) {
      console.error('[Email Service] No valid recipients provided');
      return false;
    }
    const attachmentSummary = Array.isArray(options.attachments)
      ? options.attachments.map(a => `${a.filename}(${a.content?.length || 0}b)`).join(", ")
      : "";
    console.log(`[Email Service] Attachments: ${Array.isArray(options.attachments) ? options.attachments.length : 0}${attachmentSummary ? ` → ${attachmentSummary}` : ""}`);

    // Try Mailgun HTTP API first if configured (more reliable than SMTP)
    const emailProvider = this.getConfiguredProvider();
    if (emailProvider === 'mailgun' && process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN) {
      console.log('[Email Service] Using Mailgun HTTP API');
      const result = await this.sendViaMailgunAPI(from, options);
      await this.logEmailAuditEvent({
        options,
        provider: 'mailgun-api',
        toText,
        success: result.success,
        error: result.error,
        providerResponseId: result.id,
      });
      return result.success;
    }

    // Fall back to SMTP
    console.log('[Email Service] Using SMTP transport');
    const mailOptions: any = {
      from,
      to: toText,
      subject: options.subject,
      html: options.html,
      text: options.text || this.stripHtml(options.html),
    };
    if (Array.isArray(options.attachments) && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map((a) => ({
        filename: a.filename,
        content: a.content,
        contentType: a.contentType,
      }));
    }

    try {
      const info = await this.transporter.sendMail(mailOptions);
      const provider = emailProvider === 'sendgrid'
        ? 'sendgrid-smtp'
        : emailProvider === 'mailgun'
          ? 'mailgun-smtp'
          : 'smtp';

      console.log(`[Email Service] ✅ Email sent successfully to ${mailOptions.to}`);
      await this.logEmailAuditEvent({
        options,
        provider,
        toText,
        success: true,
        providerResponseId: (info && (info.messageId || info.response)) ? String(info.messageId || info.response) : undefined,
      });
      return true;
    } catch (error: any) {
      console.error('[Email Service] ❌ Error sending email:', error);
      await this.logEmailAuditEvent({
        options,
        provider: 'smtp',
        toText,
        success: false,
        error: error?.message || String(error),
      });
      return false;
    }
  }

  private async sendViaMailgunAPI(from: string, options: EmailOptions): Promise<{ success: boolean; id?: string; error?: string }> {
    try {
      const domain = process.env.MAILGUN_DOMAIN;
      const apiKey = process.env.MAILGUN_API_KEY;
      const region = process.env.MAILGUN_REGION || 'us'; // 'us' or 'eu'
      const baseUrl = region === 'eu' 
        ? 'https://api.eu.mailgun.net/v3'
        : 'https://api.mailgun.net/v3';

      const recipients = this.normalizeRecipients(options.to);
      const textBody = options.text || this.stripHtml(options.html);

      // If attachments exist, use multipart/form-data (Mailgun requires multipart for attachments).
      if (Array.isArray(options.attachments) && options.attachments.length > 0) {
        console.log(`[Email Service] Mailgun API: sending multipart with ${options.attachments.length} attachment(s)`);
        const fd = new FormData();
        fd.append('from', from);
        for (const recipient of recipients) fd.append('to', recipient);
        fd.append('subject', options.subject);
        fd.append('html', options.html);
        fd.append('text', textBody);
        fd.append('o:tracking', 'no');
        fd.append('o:tracking-clicks', 'no');
        fd.append('o:tracking-opens', 'no');

        for (const att of options.attachments) {
          const type = att.contentType || 'application/octet-stream';
          const blob = new Blob([att.content], { type });
          console.log(`[Email Service] Mailgun API attachment: ${att.filename} bytes=${att.content?.length || 0} type=${type}`);
          fd.append('attachment', blob, att.filename);
        }

        const response = await fetch(`${baseUrl}/${domain}/messages`, {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          },
          body: fd as any
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Email Service] Mailgun HTTP API error:', response.status, errorText);
          return { success: false, error: errorText };
        }

        const result = await response.json();
        console.log(`[Email Service] ✅ Email sent via Mailgun HTTP API:`, result.id);
        return { success: true, id: result?.id ? String(result.id) : undefined };
      }

      // No attachments: use x-www-form-urlencoded (simple + reliable).
      const formData = new URLSearchParams();
      formData.append('from', from);
      for (const recipient of recipients) formData.append('to', recipient);
      formData.append('subject', options.subject);
      formData.append('html', options.html);
      formData.append('text', textBody);
      formData.append('o:tracking', 'no');
      formData.append('o:tracking-clicks', 'no');
      formData.append('o:tracking-opens', 'no');

      const response = await fetch(`${baseUrl}/${domain}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`api:${apiKey}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: formData.toString()
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[Email Service] Mailgun HTTP API error:', response.status, errorText);
        return { success: false, error: errorText };
      }

      const result = await response.json();
      console.log(`[Email Service] ✅ Email sent via Mailgun HTTP API:`, result.id);
      return { success: true, id: result?.id ? String(result.id) : undefined };
    } catch (error) {
      console.error('[Email Service] ❌ Mailgun HTTP API error:', error);
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  }

  async sendAlertEmail(
    recipients: string | string[],
    data: AlertEmailData,
    auditContext?: Pick<EmailAuditContext, "entityId" | "auditEventId" | "dedupeKey" | "campaignId" | "campaignName" | "deliveryStatus" | "attemptCount" | "nextAttemptAt">,
  ): Promise<boolean> {
    const conditionText = {
      below: 'fallen below',
      above: 'exceeded',
      equals: 'reached',
    }[data.condition];

    const subject = `⚠️ Alert: ${data.name} has ${conditionText} threshold`;
    const summaryLine = this.buildAlertSummary(data);
    let clientName = "";
    let campaignName = data.campaignName || auditContext?.campaignName || "";
    if (db && auditContext?.campaignId) {
      try {
        const rows = await db
          .select({ clientName: clients.name, campaignName: campaigns.name })
          .from(campaigns)
          .leftJoin(clients, eq(campaigns.clientId, clients.id))
          .where(eq(campaigns.id, auditContext.campaignId))
          .limit(1);
        clientName = String(rows?.[0]?.clientName || "");
        campaignName = campaignName || String(rows?.[0]?.campaignName || "");
      } catch {
        clientName = "";
      }
    }
    const alertTypeLabel = data.type === "kpi" ? "KPI" : "Benchmark";
    
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
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 8px;
            }
            .alert-box {
              background: white;
              border-left: 4px solid #ef4444;
              padding: 20px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .metric-row {
              display: flex;
              justify-content: space-between;
              padding: 10px 0;
              border-bottom: 1px solid #e5e7eb;
            }
            .metric-label {
              font-weight: 600;
              color: #6b7280;
            }
            .metric-value {
              font-weight: 700;
              color: #111827;
            }
            .footer {
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="content">
            <p>You're receiving this alert because a ${data.type.toUpperCase()} has ${conditionText} its configured threshold.</p>
            
            <div class="alert-box">
              <h2 style="margin-top: 0; color: #ef4444;">${data.name}</h2>
              
              ${clientName ? `<p><strong>Client:</strong> ${clientName}</p>` : ''}
              ${campaignName ? `<p><strong>Campaign:</strong> ${campaignName}</p>` : ''}
              <p>${summaryLine}</p>
              <p>Alert threshold value: ${this.formatAlertDisplayValue(data.thresholdValue, data.unit)}</p>
            </div>
            
            <p style="margin-top: 20px;">
              <strong>Action Required:</strong> Review this ${alertTypeLabel} in your MimoSaaS dashboard
              and take appropriate action to address the issue.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated alert from MimoSaaS</p>
            <p>To manage your alert settings, log in to your dashboard</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipients,
      subject,
      html,
      auditContext: {
        kind: 'alert',
        entityType: data.type,
        entityId: auditContext?.entityId,
        auditEventId: auditContext?.auditEventId,
        dedupeKey: auditContext?.dedupeKey,
        campaignId: auditContext?.campaignId,
        campaignName: auditContext?.campaignName,
        deliveryStatus: auditContext?.deliveryStatus,
        attemptCount: auditContext?.attemptCount,
        nextAttemptAt: auditContext?.nextAttemptAt,
      }
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  private normalizeRecipients(to: string | string[]): string[] {
    const raw = Array.isArray(to) ? to : String(to || '').split(',');
    return raw.map((item) => String(item || '').trim()).filter(Boolean);
  }

  private async logEmailAuditEvent(args: {
    options: EmailOptions;
    provider: string;
    toText: string;
    success: boolean;
    error?: string;
    providerResponseId?: string;
  }): Promise<void> {
    try {
      if (!db) return;

      const ctx = args.options.auditContext;
      const metadata = JSON.stringify({
        providerResponseId: args.providerResponseId,
      });
      const auditState = buildAlertEmailAuditState({
        dedupeKey: ctx?.dedupeKey,
        deliveryStatus: ctx?.deliveryStatus,
        providerResponseId: args.providerResponseId,
        attemptCount: ctx?.attemptCount,
        success: args.success,
        error: args.error,
        nextAttemptAt: ctx?.nextAttemptAt,
      });
      const auditValues = {
        kind: ctx?.kind || 'generic',
        entityType: ctx?.entityType,
        entityId: ctx?.entityId,
        dedupeKey: auditState.dedupeKey,
        campaignId: ctx?.campaignId,
        campaignName: ctx?.campaignName,
        to: args.toText,
        subject: args.options.subject,
        provider: args.provider,
        success: args.success,
        deliveryStatus: auditState.deliveryStatus,
        providerResponseId: auditState.providerResponseId,
        attemptCount: auditState.attemptCount,
        lastAttemptAt: auditState.lastAttemptAt,
        nextAttemptAt: auditState.nextAttemptAt,
        deliveredAt: auditState.deliveredAt,
        failedAt: auditState.failedAt,
        error: args.error,
        metadata,
      };

      const auditEventId = String(ctx?.auditEventId || "").trim();
      if (auditEventId) {
        await db.update(emailAlertEvents)
          .set(auditValues as any)
          .where(eq(emailAlertEvents.id, auditEventId));
        return;
      }

      await db.insert(emailAlertEvents).values(auditValues as any);
    } catch (e: any) {
      // Never block email sending on audit logging
      console.warn('[Email Service] Audit log insert failed:', e?.message || e);
    }
  }
}

export const emailService = new EmailService();
