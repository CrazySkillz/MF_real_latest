import nodemailer from 'nodemailer';

interface EmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
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
  private transporter: any;

  constructor() {
    this.initializeTransporter();
  }

  private initializeTransporter() {
    const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
    
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
        this.transporter = nodemailer.createTransport({
          host: process.env.MAILGUN_SMTP_HOST || 'smtp.mailgun.org',
          port: 587,
          secure: false,
          auth: {
            user: process.env.MAILGUN_SMTP_USER,
            pass: process.env.MAILGUN_SMTP_PASS || process.env.EMAIL_SERVICE_API_KEY,
          },
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
    try {
      const from = process.env.EMAIL_FROM_ADDRESS || 'alerts@performancecore.app';
      
      const mailOptions = {
        from,
        to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
        subject: options.subject,
        html: options.html,
        text: options.text || this.stripHtml(options.html),
      };

      await this.transporter.sendMail(mailOptions);
      console.log(`Email sent successfully to ${mailOptions.to}`);
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      return false;
    }
  }

  async sendAlertEmail(recipients: string | string[], data: AlertEmailData): Promise<boolean> {
    const conditionText = {
      below: 'fallen below',
      above: 'exceeded',
      equals: 'reached',
    }[data.condition];

    const subject = `⚠️ Alert: ${data.name} has ${conditionText} threshold`;
    
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
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px;
              border-radius: 8px 8px 0 0;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
            }
            .content {
              background: #f9fafb;
              padding: 30px;
              border-radius: 0 0 8px 8px;
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
          <div class="header">
            <h1>📊 Performance Alert</h1>
          </div>
          <div class="content">
            <p>You're receiving this alert because a ${data.type.toUpperCase()} has ${conditionText} its configured threshold.</p>
            
            <div class="alert-box">
              <h2 style="margin-top: 0; color: #ef4444;">${data.name}</h2>
              
              <div class="metric-row">
                <span class="metric-label">Current Value:</span>
                <span class="metric-value">${data.currentValue}${data.unit || ''}</span>
              </div>
              
              <div class="metric-row">
                <span class="metric-label">Alert Threshold:</span>
                <span class="metric-value">${data.thresholdValue}${data.unit || ''}</span>
              </div>
              
              ${data.targetValue ? `
              <div class="metric-row">
                <span class="metric-label">Target Value:</span>
                <span class="metric-value">${data.targetValue}${data.unit || ''}</span>
              </div>
              ` : ''}
              
              ${data.campaignName ? `
              <div class="metric-row">
                <span class="metric-label">Campaign:</span>
                <span class="metric-value">${data.campaignName}</span>
              </div>
              ` : ''}
            </div>
            
            <p style="margin-top: 20px;">
              <strong>Action Required:</strong> Review this ${data.type} in your PerformanceCore dashboard 
              and take appropriate action to address the issue.
            </p>
          </div>
          
          <div class="footer">
            <p>This is an automated alert from PerformanceCore</p>
            <p>To manage your alert settings, log in to your dashboard</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: recipients,
      subject,
      html,
    });
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }
}

export const emailService = new EmailService();
