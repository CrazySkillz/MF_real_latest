import express from "express";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

const sendEmail = vi.hoisted(() => vi.fn());

vi.mock("./storage", () => ({ storage: {} }));
vi.mock("./db", () => ({ db: null, pool: null }));
vi.mock("@clerk/express", () => ({ getAuth: () => ({ userId: null }) }));
vi.mock("./services/email-service", () => ({ emailService: { sendEmail } }));
vi.mock("./middleware/rateLimiter", () => {
  const pass = (_req: any, _res: any, next: any) => next();
  return {
    oauthRateLimiter: pass,
    linkedInApiRateLimiter: pass,
    googleSheetsRateLimiter: pass,
    ga4RateLimiter: pass,
    importRateLimiter: pass,
    earlyAccessRateLimiter: pass,
  };
});

import { registerRoutes } from "./routes-oauth";

describe("public early access route", () => {
  let server: any;
  let baseUrl = "";

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    server = await registerRoutes(app);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => new Promise<void>((resolve) => server.close(resolve)));

  beforeEach(() => {
    vi.clearAllMocks();
    sendEmail.mockResolvedValue(true);
  });

  const submit = (body: Record<string, unknown>, origin = "https://mimosaas.app") => fetch(`${baseUrl}/api/early-access`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: origin },
    body: JSON.stringify(body),
  });

  it("answers the landing-page preflight with the exact allowed origin", async () => {
    const response = await fetch(`${baseUrl}/api/early-access`, {
      method: "OPTIONS",
      headers: { Origin: "https://mimosaas.app" },
    });
    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("https://mimosaas.app");
    expect(response.headers.get("access-control-allow-methods")).toBe("POST, OPTIONS");
  });

  it("rejects other browser origins before sending", async () => {
    const response = await submit({ email: "person@example.com" }, "https://example.com");
    expect(response.status).toBe(403);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("rejects an invalid email address", async () => {
    const response = await submit({ email: "not-an-email" });
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ success: false, message: "Enter a valid email address." });
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("normalizes the address and sends only to the fixed launch mailbox", async () => {
    const response = await submit({ email: "  Person@Example.COM  ", website: "" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true });
    expect(response.headers.get("access-control-allow-origin")).toBe("https://mimosaas.app");
    expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: "launch@mimosaas.app",
      subject: "New mimosaas early access request",
      text: expect.stringContaining("Email: person@example.com"),
    }));
  });

  it("fails closed when the email provider does not accept the notification", async () => {
    sendEmail.mockResolvedValue(false);
    const response = await submit({ email: "person@example.com" });
    expect(response.status).toBe(502);
    expect(await response.json()).toMatchObject({ success: false });
  });

  it("silently ignores the honeypot without sending", async () => {
    const response = await submit({ email: "bot@example.com", website: "filled-by-bot" });
    expect(response.status).toBe(200);
    expect(sendEmail).not.toHaveBeenCalled();
  });
});
