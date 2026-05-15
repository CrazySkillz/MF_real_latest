import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPORT_SCHEDULER_FILE = join(__dirname, "report-scheduler.ts");
const GA4_SCHEDULED_PDF_FILE = join(__dirname, "ga4-scheduled-report-pdf.ts");

function readReportScheduler(): string {
  return readFileSync(REPORT_SCHEDULER_FILE, "utf-8");
}

describe("scheduled report email regression guard", () => {
  it("keeps the scheduled report email body focused on the attached report", () => {
    const source = readReportScheduler();

    expect(source).toContain("Your scheduled MimoSaaS report is ready.");
    expect(source).toContain("Frequency:&nbsp;");
    expect(source).toContain("Report Type:&nbsp;");
    expect(source).toContain("Generated:&nbsp;");
    expect(source).toContain("<strong>MimoSaaS</strong> - Executive Marketing Analytics");
    expect(source).not.toContain("View Report in Dashboard");
    expect(source).not.toContain("<span class=\"info-label\">Window:");
    expect(source).not.toContain("<div class=\"header\">");
    expect(source).not.toContain("Overview Report</h1>");
    expect(source).not.toContain("Daily Report Delivery");
    expect(source).not.toContain("Your scheduled MetricMind report is ready.");
  });

  it("keeps scheduled report emails wired to attach generated PDFs", () => {
    const source = readReportScheduler();

    expect(source).toContain("PDF attachment bytes:");
    expect(source).toContain("attachments: meta?.attachment");
    expect(source).toContain("contentType: 'application/pdf'");
    expect(source).toContain("GA4 PDF builder failed; refusing generic fallback");
    expect(source).toContain("Refusing generic fallback for GA4");
    expect(source).toContain("Refusing to send report");
  });

  it("keeps GA4 scheduled PDFs resilient to optional section query failures", () => {
    const source = readFileSync(GA4_SCHEDULED_PDF_FILE, "utf-8");

    expect(source).toContain("[GA4 Scheduled PDF]");
    expect(source).toContain("using persisted fallback");
    expect(source).toContain('return { rows: [] };');
    expect(source).toContain("return { totals: {} };");
  });

  it("keeps report test-send aligned with Mailgun HTTP API configuration", () => {
    const schedulerSource = readReportScheduler();
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const testSendRoute = routesSource.slice(
      routesSource.indexOf('app.post("/api/platforms/:platformType/reports/:reportId/send-test"'),
      routesSource.indexOf("// Report snapshots (immutable history)")
    );

    expect(schedulerSource).toContain("process.env.MAILGUN_API_KEY && process.env.MAILGUN_DOMAIN");
    expect(schedulerSource).toContain("For Mailgun API: MAILGUN_API_KEY, MAILGUN_DOMAIN");
    expect(testSendRoute).toContain("ensurePlatformReportAccess(req as any, res as any, reportId)");
    expect(testSendRoute).toContain("sendTestReport(reportId)");
    expect(testSendRoute).not.toContain("hasEmailConfig");
    expect(testSendRoute).not.toContain("MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS");
  });

  it("keeps Mailgun report delivery using explicit recipients and text fallback", () => {
    const source = readFileSync(join(process.cwd(), "server", "services", "email-service.ts"), "utf-8");

    expect(source).toContain("normalizeRecipients");
    expect(source).toContain("for (const recipient of recipients) fd.append('to', recipient)");
    expect(source).toContain("for (const recipient of recipients) formData.append('to', recipient)");
    expect(source).toContain("const textBody = options.text || this.stripHtml(options.html)");
  });

  it("does not report Mailgun test-send success until delivery is confirmed", () => {
    const schedulerSource = readReportScheduler();
    const routesSource = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");

    expect(schedulerSource).toContain("waitForMailgunDelivery");
    expect(schedulerSource).toContain('delivery.status !== "delivered"');
    expect(schedulerSource).toContain("Mailgun accepted the email, but delivery was not confirmed yet");
    expect(routesSource).toContain("deliveryStatus: result.deliveryStatus");
    expect(routesSource).not.toContain("Test report email sent successfully! Check your inbox.");
  });
});
