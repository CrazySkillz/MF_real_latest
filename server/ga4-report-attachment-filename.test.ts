import { readFileSync } from "node:fs";
import ts from "typescript";
import { describe, expect, it, vi } from "vitest";

const source = ts.createSourceFile("report-scheduler.ts", readFileSync("server/report-scheduler.ts", "utf8"), ts.ScriptTarget.Latest, true);
const declaration = (name: string) => source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === name)!;
const compile = (code: string) => ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
const bytes = Buffer.from("%PDF-1.4\n" + "fixture".repeat(30));

// Execute the actual send-call metadata and email forwarding, without starting a scheduler or using providers/storage.
function metadata(path: string, platformType = "google_analytics", reportType = "insights", generatedAt = "2026-10-26T15:00:00Z") {
  let expression: ts.Expression | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && node.expression.getText(source) === (path === "scheduled" ? "sendReportEmailWithRetry" : "sendReportEmail")) expression = node.arguments[2];
    ts.forEachChild(node, visit);
  };
  visit(declaration(path === "scheduled" ? "checkScheduledReports" : "sendTestReport"));
  expect(expression).toBeDefined();
  const report = { id: "report-fixture", campaignId: "campaign-fixture", name: "GA4 Insights Report", reportType, platformType, scheduleFrequency: "daily" };
  const now = new Date(generatedAt);
  const values = { report, now, snapshotPlatformType: platformType, snapshotPayload: { ...report, reportName: report.name, generatedAt: now.toISOString() },
    safeName: report.name.replace(/\s+/g, "_"), windowStart: "2026-09-26", windowEnd: "2026-10-25", campaignName: "Fixture",
    claimedEvent: { id: "audit-fixture" }, auditEventId: "audit-fixture", pdfBuffer: bytes };
  return { report, meta: new Function(...Object.keys(values), compile(`return (${expression!.getText(source)});`))(...Object.values(values)) };
}

describe.each(["scheduled", "test-send"])("GA4 %s attachment date", path => {
  it.each(["overview", "kpis", "benchmarks", "ads", "insights", "custom"])("uses generation date for %s without changing the cutoff or PDF", type => {
    const { meta } = metadata(path, "google_analytics", type);
    expect(meta.attachment.filename).toBe("GA4_Insights_Report_2026-10-26.pdf");
    expect(meta.attachment.content).toBe(bytes);
    expect(meta.windowStart).toBe("2026-09-26");
    expect(meta.windowEnd).toBe("2026-10-25");
    expect(meta.auditEventId).toBe("audit-fixture");
  });
  it.each([
    ["2026-10-26T23:59:59Z", "2026-10-26"],
    ["2026-10-27T00:00:00Z", "2026-10-27"],
    ["2027-01-01T00:00:00Z", "2027-01-01"],
  ])("follows the browser's UTC generation-date rule at %s", (now, expected) => {
    expect(metadata(path, "google_analytics", "insights", now).meta.attachment.filename).toBe(`GA4_Insights_Report_${expected}.pdf`);
  });
  it.each(["linkedin", "campaign_deepdive", "google_ads", "custom-integration"])("preserves the existing %s filename", platform => {
    expect(metadata(path, platform).meta.attachment.filename).toBe("GA4_Insights_Report_2026-10-25.pdf");
  });
  it("forwards the corrected name, exact bytes and audit identity to the email adapter", async () => {
    const sendEmail = vi.fn().mockResolvedValue(true);
    const send = new Function("emailService", "console", compile(`${declaration("sendReportEmail").getText(source)}\nreturn sendReportEmail;`))({ sendEmail }, { log() {}, error() {} });
    const { report, meta } = metadata(path);
    expect(await send(report, ["fixture@example.invalid"], meta)).toBe(true);
    expect(sendEmail).toHaveBeenCalledTimes(1);
    const message = sendEmail.mock.calls[0][0];
    expect(message.attachments).toEqual([{ filename: "GA4_Insights_Report_2026-10-26.pdf", content: bytes, contentType: "application/pdf" }]);
    expect(message.auditContext).toMatchObject({ auditEventId: "audit-fixture", entityId: report.id, campaignId: report.campaignId });
    expect(await send(report, ["fixture@example.invalid"], { ...meta, attachment: null })).toBe(false);
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });
});
