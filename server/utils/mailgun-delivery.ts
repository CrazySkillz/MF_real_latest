import type { AlertEmailDeliveryStatus } from "./alert-email-audit";

export type MailgunDeliveryStatus = "delivered" | "failed" | "pending" | "not_checked";

export type MailgunDeliveryResult = {
  status: MailgunDeliveryStatus;
  error?: string;
};

type MailgunDeliveryOptions = {
  domain?: string;
  apiKey?: string;
  region?: string;
  attempts?: number;
  delayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
};

export function mapMailgunDeliveryToAlertEmailStatus(status: unknown): AlertEmailDeliveryStatus {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "delivered") return "delivered";
  if (normalized === "failed") return "failed";
  if (normalized === "pending") return "pending_delivery";
  return "accepted";
}

export async function waitForMailgunDelivery(
  providerResponseId: string,
  options: MailgunDeliveryOptions = {},
): Promise<MailgunDeliveryResult> {
  const domain = options.domain ?? process.env.MAILGUN_DOMAIN;
  const apiKey = options.apiKey ?? process.env.MAILGUN_API_KEY;
  if (!domain || !apiKey || !providerResponseId) return { status: "not_checked" };

  const region = options.region ?? process.env.MAILGUN_REGION ?? "us";
  const baseUrl = region === "eu" ? "https://api.eu.mailgun.net/v3" : "https://api.mailgun.net/v3";
  const messageIds = Array.from(new Set([providerResponseId, providerResponseId.replace(/^<|>$/g, "")].filter(Boolean)));
  const attempts = Math.max(1, Math.trunc(Number(options.attempts ?? 4)));
  const delayMs = Math.max(0, Math.trunc(Number(options.delayMs ?? 2500)));
  const fetchImpl = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise((resolve) => setTimeout(resolve, ms)));

  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0 && delayMs > 0) await sleep(delayMs);
    for (const messageId of messageIds) {
      const params = new URLSearchParams();
      params.set("message-id", messageId);
      params.set("limit", "10");
      const response = await fetchImpl(`${baseUrl}/${domain}/events?${params.toString()}`, {
        headers: { Authorization: `Basic ${Buffer.from(`api:${apiKey}`).toString("base64")}` },
      });
      if (!response.ok) return { status: "not_checked", error: await response.text().catch(() => "") };
      const data = await response.json().catch(() => ({}));
      const items = Array.isArray((data as any)?.items) ? (data as any).items : [];
      const delivered = items.find((item: any) => String(item?.event || "").toLowerCase() === "delivered");
      if (delivered) return { status: "delivered" };
      const failed = items.find((item: any) => ["failed", "rejected"].includes(String(item?.event || "").toLowerCase()));
      if (failed) {
        return {
          status: "failed",
          error: String(failed?.["delivery-status"]?.message || failed?.reason || failed?.event || "Mailgun delivery failed"),
        };
      }
    }
  }

  return { status: "pending" };
}
