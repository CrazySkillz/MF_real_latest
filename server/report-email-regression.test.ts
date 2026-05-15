import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const REPORT_SCHEDULER_FILE = join(__dirname, "report-scheduler.ts");

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
});
