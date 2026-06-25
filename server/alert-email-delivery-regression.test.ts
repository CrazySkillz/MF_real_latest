import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { buildAlertEmailAuditState } from "./utils/alert-email-audit";
import { mapMailgunDeliveryToAlertEmailStatus, waitForMailgunDelivery } from "./utils/mailgun-delivery";

const source = (path: string) => readFileSync(join(process.cwd(), path), "utf-8");

function mockMailgunFetch(items: any[]): typeof fetch {
  return vi.fn(async () => ({
    ok: true,
    json: async () => ({ items }),
    text: async () => "",
  })) as unknown as typeof fetch;
}

describe("alert email delivery status regression guard", () => {
  it("records Mailgun API acceptance as accepted or pending_delivery, not delivered, without event evidence", async () => {
    expect(mapMailgunDeliveryToAlertEmailStatus("not_checked")).toBe("accepted");
    expect(mapMailgunDeliveryToAlertEmailStatus("pending")).toBe("pending_delivery");

    const delivery = await waitForMailgunDelivery("<mailgun-id>", {
      domain: "mg.example.com",
      apiKey: "test-key",
      attempts: 1,
      delayMs: 0,
      fetchImpl: mockMailgunFetch([]),
      sleep: async () => undefined,
    });
    const auditState = buildAlertEmailAuditState({
      success: true,
      deliveryStatus: mapMailgunDeliveryToAlertEmailStatus(delivery.status),
      providerResponseId: "<mailgun-id>",
    });

    expect(delivery.status).toBe("pending");
    expect(auditState.deliveryStatus).toBe("pending_delivery");
    expect(auditState.deliveredAt).toBeUndefined();
  });

  it("maps confirmed Mailgun delivery events to delivered", async () => {
    const delivery = await waitForMailgunDelivery("<mailgun-id>", {
      domain: "mg.example.com",
      apiKey: "test-key",
      attempts: 1,
      delayMs: 0,
      fetchImpl: mockMailgunFetch([{ event: "delivered" }]),
      sleep: async () => undefined,
    });
    const auditState = buildAlertEmailAuditState({
      success: true,
      deliveryStatus: mapMailgunDeliveryToAlertEmailStatus(delivery.status),
      providerResponseId: "<mailgun-id>",
      now: new Date("2026-06-25T00:00:00.000Z"),
    });

    expect(delivery.status).toBe("delivered");
    expect(auditState.deliveryStatus).toBe("delivered");
    expect(auditState.deliveredAt?.toISOString()).toBe("2026-06-25T00:00:00.000Z");
  });

  it("maps Mailgun failed or rejected events to failed", async () => {
    const delivery = await waitForMailgunDelivery("<mailgun-id>", {
      domain: "mg.example.com",
      apiKey: "test-key",
      attempts: 1,
      delayMs: 0,
      fetchImpl: mockMailgunFetch([{ event: "failed", "delivery-status": { message: "mailbox unavailable" } }]),
      sleep: async () => undefined,
    });
    const auditState = buildAlertEmailAuditState({
      success: true,
      deliveryStatus: mapMailgunDeliveryToAlertEmailStatus(delivery.status),
      providerResponseId: "<mailgun-id>",
      error: delivery.error,
      now: new Date("2026-06-25T00:00:00.000Z"),
    });

    expect(delivery.status).toBe("failed");
    expect(delivery.error).toBe("mailbox unavailable");
    expect(auditState.deliveryStatus).toBe("failed");
    expect(auditState.failedAt?.toISOString()).toBe("2026-06-25T00:00:00.000Z");
  });

  it("keeps SMTP success as accepted instead of delivered", () => {
    const auditState = buildAlertEmailAuditState({
      success: true,
      providerResponseId: "smtp-message-id",
    });

    expect(auditState.deliveryStatus).toBe("accepted");
    expect(auditState.deliveredAt).toBeUndefined();
  });

  it("keeps alert status copy and source semantics from claiming delivery without evidence", () => {
    const emailService = source("server/services/email-service.ts");
    const reportScheduler = source("server/report-scheduler.ts");

    expect(emailService).toContain('deliveryStatus: result.success ? "accepted" : undefined,');
    expect(emailService).toContain("void this.confirmMailgunAlertDelivery(options.auditContext, result.id);");
    expect(emailService).toContain('if (ctx?.kind !== "alert" || !auditEventId || !responseId) return;');
    expect(emailService).toContain("mapMailgunDeliveryToAlertEmailStatus(delivery.status)");
    expect(emailService).toContain('if (deliveryStatus === "accepted") return;');
    expect(emailService).not.toMatch(/alert email delivered/i);
    expect(reportScheduler).toContain('import { waitForMailgunDelivery } from "./utils/mailgun-delivery";');
    expect(reportScheduler).toContain("Mailgun accepted the email, but delivery was not confirmed yet");
  });
});
