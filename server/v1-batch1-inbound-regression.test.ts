import { readFileSync } from "node:fs";
import { createSign, generateKeyPairSync, createVerify, createPublicKey, createHmac, createHash, timingSafeEqual } from "node:crypto";
import { Readable } from "node:stream";
import { EventEmitter } from "node:events";
import ts from "typescript";
import express from "express";
import multer from "multer";
import { afterEach, describe, expect, it, vi } from "vitest";

const network = vi.hoisted(() => ({ lookup: vi.fn(), request: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: network.lookup }));
vi.mock("node:https", () => ({ request: network.request }));
import { downloadCustomIntegrationReport } from "./services/custom-integration-file-parser";
afterEach(() => { vi.clearAllMocks(); });

function response(statusCode: number, chunks: Buffer[], headers: any = {}) {
  const stream = Readable.from(chunks) as any;
  stream.statusCode = statusCode; stream.headers = headers; return stream;
}
function mockResponse(stream: any) {
  network.request.mockImplementationOnce((url, options, callback) => {
    const req = new EventEmitter() as any;
    req.end = () => callback(stream);
    return req;
  });
}
describe("Batch 1 public report download boundary", () => {
  for (const url of ["http://example.com/a.csv", "https://127.0.0.1/a.csv", "https://169.254.169.254/a.csv", "https://[::1]/a.csv", "https://[::ffff:127.0.0.1]/a.csv", "https://user:password@example.com/a.csv", "https://example.com:8443/a.csv"]) {
    it(`rejects ${url} without dispatch`, async () => {
      await expect(downloadCustomIntegrationReport(url)).rejects.toThrow();
      expect(network.request).not.toHaveBeenCalled();
    });
  }
  it("rejects private and mixed DNS answers before dispatch", async () => {
    network.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(downloadCustomIntegrationReport("https://example.com/a.csv")).rejects.toThrow("public destination");
    expect(network.request).not.toHaveBeenCalled();
  });
  it("pins the validated public IP while preserving the TLS hostname", async () => {
    network.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mockResponse(response(200, [Buffer.from("spend\n12")], { "content-type": "text/csv" }));
    const result = await downloadCustomIntegrationReport("https://example.com/a.csv?secret=fixture");
    expect(result.buffer.toString()).toBe("spend\n12"); expect(result.fileName).toBe("a.csv");
    const [url, options] = network.request.mock.calls[0];
    expect(url.hostname).toBe("example.com");
    const callback = vi.fn(); options.lookup("example.com", {}, callback);
    expect(callback).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    const allAddresses = vi.fn(); options.lookup("example.com", { all: true }, allAddresses);
    expect(allAddresses).toHaveBeenCalledWith(null, [{ address: "93.184.216.34", family: 4 }]);
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
  it("revalidates redirects and blocks internal destinations", async () => {
    network.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mockResponse(response(302, [], { location: "https://127.0.0.1/private" }));
    await expect(downloadCustomIntegrationReport("https://example.com/a.csv")).rejects.toThrow("public destination");
    expect(network.request).toHaveBeenCalledTimes(1);
  });
  it("bounds streamed bodies even without Content-Length", async () => {
    network.lookup.mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
    mockResponse(response(200, [Buffer.alloc(10 * 1024 * 1024), Buffer.alloc(1)]));
    await expect(downloadCustomIntegrationReport("https://example.com/a.csv")).rejects.toThrow("10MB");
  });
});

describe("Batch 1 Mailgun signature gate", () => {
  const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handler = "";
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(source) === "app.post" && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === "/api/mailgun/inbound")
      handler = n.arguments[n.arguments.length - 1].getText(source);
    ts.forEachChild(n, visit);
  }
  visit(source);
  for (const mode of ["valid", "missing", "altered", "expired", "unconfigured"]) it(`${mode} URL-encoded delivery is checked before recipient access`, async () => {
    const lookup = vi.fn(async () => null);
    const code = ts.transpileModule(`const handler = ${handler};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const env: any = {
      process: { env: { MAILGUN_WEBHOOK_SIGNING_KEY: mode === "unconfigured" ? "" : "fixture-signing-key" } },
      createHmac, createHash, timingSafeEqual, Buffer,
      console: { log() {}, error() {} }, storage: { getCustomIntegrationByEmail: lookup },
      require: (name: string) => { if (name === "./utils/email-generator") return { extractEmailAddress: (value: string) => value }; throw new Error("Unexpected provider effect"); },
    };
    const run = new Function(...Object.keys(env), code + "\nreturn handler;")(...Object.values(env));
    const app = express();
    app.post("/", express.urlencoded({ extended: false, limit: "128kb", parameterLimit: 40 }), multer({ storage: multer.memoryStorage() }).any(), run);
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const timestamp = String(Math.floor(Date.now() / 1000) - (mode === "expired" ? 90000 : 0)), token = "a".repeat(50);
      const signature = createHmac("sha256", "fixture-signing-key").update(timestamp + token).digest("hex");
      const body = new URLSearchParams({ timestamp, token, signature: mode === "altered" ? "0".repeat(64) : signature, recipient: "fixture@example.invalid" });
      if (mode === "missing") body.delete("signature");
      const response = await fetch(`http://127.0.0.1:${(server.address() as any).port}/`, { method: "POST", body });
      expect(response.status).toBe(mode === "unconfigured" ? 503 : mode === "valid" ? 404 : 401);
      if (mode === "valid") expect(lookup).toHaveBeenCalledWith("fixture@example.invalid");
      else expect(lookup).not.toHaveBeenCalled();
      await response.text();
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  });
});

describe("Batch 1 SendGrid actual multipart signature stream", () => {
  const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let declaration = "";
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && n.name.getText(source) === "verifySendGridInbound") declaration = `const ${n.getText(source)};`;
    ts.forEachChild(n, visit);
  }
  visit(source);
  const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const publicKey = pair.publicKey.export({ format: "der", type: "spki" }).toString("base64");
  const multipart = Buffer.from('--fixture\r\nContent-Disposition: form-data; name="subject"\r\n\r\nCafé\r\n--fixture\r\nContent-Disposition: form-data; name="attachment1"; filename="data.csv"\r\nContent-Type: text/csv\r\n\r\nspend\n12\r\n--fixture--\r\n', "utf8");
  async function send(mode: "valid" | "missing" | "altered" | "expired" | "unconfigured") {
    const compiled = ts.transpileModule(declaration, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const verify = new Function("process", "createVerify", "createPublicKey", "createHash", "Buffer", compiled + "\nreturn verifySendGridInbound;")(
      { env: { SENDGRID_WEBHOOK_VERIFICATION_KEY: mode === "unconfigured" ? "" : publicKey } }, createVerify, createPublicKey, createHash, Buffer);
    const app = express(), accepted = vi.fn();
    app.post("/", verify, multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } }).any(), (req: any, res) => {
      if (!req.inboundSignatureVerified) return res.status(401).json({ error: "Invalid signature" });
      accepted(req.inboundReceipt); res.json({ subject: req.body.subject, file: req.files[0].buffer.toString() });
    });
    const server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    try {
      const timestamp = String(Math.floor(Date.now() / 1000) - (mode === "expired" ? 90000 : 0));
      const signature = createSign("sha256").update(timestamp).update(multipart).sign(pair.privateKey).toString("base64");
      const headers: Record<string, string> = { "Content-Type": "multipart/form-data; boundary=fixture" };
      if (mode !== "missing") { headers["X-Twilio-Email-Event-Webhook-Timestamp"] = timestamp; headers["X-Twilio-Email-Event-Webhook-Signature"] = signature; }
      const body = mode === "altered" ? Buffer.from(multipart.toString().replace("12", "99")) : multipart;
      const result = await fetch(`http://127.0.0.1:${(server.address() as any).port}/`, { method: "POST", headers, body });
      return { status: result.status, body: await result.json(), accepted };
    } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
  }
  it("accepts a genuine ECDSA signature over timestamp plus exact non-ASCII multipart bytes", async () => {
    const r = await send("valid"); expect(r.status).toBe(200); expect(r.body).toEqual({ subject: "Café", file: "spend\n12" }); expect(r.accepted).toHaveBeenCalledOnce();
  });
  for (const mode of ["missing", "altered", "expired", "unconfigured"] as const) it(`rejects ${mode} before application effects`, async () => {
    const r = await send(mode); expect(r.status).toBe(mode === "unconfigured" ? 503 : 401); expect(r.accepted).not.toHaveBeenCalled();
  });
  it("uses the same replay receipt for differently signed copies of identical wire content", async () => {
    const first = await send("valid"), retry = await send("valid");
    const digest = createHash("sha256").update(multipart).digest("hex");
    expect(first.accepted).toHaveBeenCalledWith(digest);
    expect(retry.accepted).toHaveBeenCalledWith(digest);
  });
});
