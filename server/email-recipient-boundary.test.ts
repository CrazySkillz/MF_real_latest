import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const smtp = vi.hoisted(() => ({ sendMail: vi.fn() }));
vi.mock("nodemailer", () => ({ default: { createTransport: vi.fn(() => smtp) } }));
vi.mock("./db", () => ({ db: null }));
import { emailService } from "./services/email-service";

const service = emailService as any;
const attachment = { filename: "report.pdf", content: Buffer.from("unchanged PDF bytes"), contentType: "application/pdf" };
const message = { subject: "Scheduled report", html: "Report attached", text: "Report attached", attachments: [attachment], auditContext: { kind: "report" as const, auditEventId: "fixture-audit" } };

beforeEach(() => {
  vi.stubEnv("EMAIL_PROVIDER", "smtp");
  vi.stubEnv("EMAIL_FROM_ADDRESS", "reports@example.test");
  smtp.sendMail.mockReset().mockResolvedValue({ messageId: "fixture-message" });
  vi.spyOn(service, "logEmailAuditEvent").mockResolvedValue(undefined);
  vi.spyOn(console, "log").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Unexpected network request")));
});

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe("email service recipient boundary", () => {
  it.each([
    "not-an-email",
    "Team: person@example.test;",
    "Person <person@example.test>",
    "person@example.test (comment)",
    "person@example.test\r\nBcc: second@example.test",
    ["valid@example.test", "invalid"],
    [["first@example.test", "second@example.test"]],
  ].map(to => ({ to })))("rejects unsupported recipient syntax before SMTP: $to", async ({ to }) => {
    expect(await emailService.sendEmail({ ...message, to: to as any })).toBe(false);
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(service.logEmailAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      success: false, error: "Invalid email recipient", options: expect.objectContaining({ auditContext: message.auditContext }),
    }));
  });

  it.each(["person@example.test", "first.last+reports@sub.example.test", "o'neil@example.test", "UPPER@example.test", "user@xn--bcher-kva.test"])("preserves a valid address: %s", async (to) => {
    expect(await emailService.sendEmail({ ...message, to })).toBe(true);
    expect(smtp.sendMail).toHaveBeenCalledWith({ from: "reports@example.test", to, subject: message.subject, html: message.html, text: message.text, attachments: [attachment] });
    expect(service.logEmailAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ success: true, provider: "smtp", providerResponseId: "fixture-message" }));
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each([" first@example.test, second@example.test ", [" first@example.test ", "second@example.test"]].map(to => ({ to })))("preserves normalized multiple recipients: $to", async ({ to }) => {
    expect(await emailService.sendEmail({ ...message, to })).toBe(true);
    expect(smtp.sendMail).toHaveBeenCalledWith(expect.objectContaining({ to: "first@example.test, second@example.test" }));
  });

  it("keeps an empty list unsent", async () => {
    expect(await emailService.sendEmail({ ...message, to: [] })).toBe(false);
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("keeps SMTP failure and retry audit handling", async () => {
    smtp.sendMail.mockRejectedValue(new Error("fixture transport failure"));
    expect(await emailService.sendEmail({ ...message, to: "person@example.test" })).toBe(false);
    expect(service.logEmailAuditEvent).toHaveBeenCalledWith(expect.objectContaining({ success: false, error: "fixture transport failure" }));
  });

  it.each([false, true])("checks recipients before Mailgun, with attachments=%s", async (withAttachments) => {
    vi.stubEnv("EMAIL_PROVIDER", "mailgun");
    vi.stubEnv("MAILGUN_API_KEY", "fixture-not-a-real-key");
    vi.stubEnv("MAILGUN_DOMAIN", "example.test");
    const send = vi.spyOn(service, "sendViaMailgunAPI").mockResolvedValue({ success: true, id: "fixture-accepted", region: "eu" });
    expect(await emailService.sendEmail({ ...message, to: "Group: person@example.test;", attachments: withAttachments ? [attachment] : undefined })).toBe(false);
    expect(send).not.toHaveBeenCalled();
    expect(await emailService.sendEmail({ ...message, to: "person@example.test", attachments: withAttachments ? [attachment] : undefined })).toBe(true);
    expect(send).toHaveBeenCalledOnce();
    expect(send.mock.calls[0][1]).toEqual({ ...message, to: "person@example.test", attachments: withAttachments ? [attachment] : undefined });
    expect(service.logEmailAuditEvent).toHaveBeenLastCalledWith(expect.objectContaining({ success: true, deliveryStatus: "accepted", providerResponseId: "fixture-accepted" }));
    expect(smtp.sendMail).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  });
});
