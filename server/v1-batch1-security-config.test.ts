import { readFileSync } from "node:fs";
import ts from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptString, decryptString, resolveOAuthStateSigningSecret } from "./utils/tokenVault";
import { createAppQueryClient } from "../client/src/lib/queryClient";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createRequire } from "node:module";

afterEach(() => vi.unstubAllEnvs());
describe("Batch 1 encryption configuration", () => {
  it("fails closed in production despite session or application fallbacks", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", ""); vi.stubEnv("ENCRYPTION_KEY", "");
    vi.stubEnv("SESSION_SECRET", "fixture-session"); vi.stubEnv("APP_SECRET", "fixture-app");
    expect(() => encryptString("fixture-token")).toThrow("not configured");
  });
  it("preserves encryption round trips with an explicit production key", () => {
    vi.stubEnv("NODE_ENV", "production"); vi.stubEnv("TOKEN_ENCRYPTION_KEY", "fixture-explicit-key");
    const encrypted = encryptString("fixture-token");
    expect(decryptString(encrypted)).toBe("fixture-token");
    expect(JSON.stringify(encrypted)).not.toContain("fixture-token");
  });
  it("rejects missing production signing configuration and separates provider purposes", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const key of ["SESSION_SECRET", "TOKEN_ENCRYPTION_KEY", "ENCRYPTION_KEY"]) vi.stubEnv(key, "");
    const input = { purpose: "linkedin", label: "LinkedIn", developmentFallback: "fixture-dev" };
    expect(() => resolveOAuthStateSigningSecret(input)).toThrow("not configured");
    expect(resolveOAuthStateSigningSecret({ ...input, specificSecret: "fixture-secret" }))
      .not.toBe(resolveOAuthStateSigningSecret({ ...input, purpose: "meta", specificSecret: "fixture-secret" }));
  });
});

describe("Batch 1 limiter configuration", () => {
  const code = ts.transpileModule(readFileSync("server/middleware/rateLimiter.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  function load(environment: string, internal: boolean) {
    const exports: any = {};
    new Function("exports", "require", "process", code)(exports, (name: string) =>
      name === "express-rate-limit" ? (options: any) => options : { isInternalAutoRefreshRequest: () => internal },
    { env: { NODE_ENV: environment } });
    return exports;
  }
  for (const name of ["oauthRateLimiter", "linkedInApiRateLimiter", "importRateLimiter"]) {
    it(`${name} ignores caller test flags in production and development`, () => {
      for (const environment of ["production", "development"]) expect(load(environment, false)[name].skip({ body: { isTestMode: true } })).toBe(false);
      expect(load("test", false)[name].skip({ body: { isTestMode: true } })).toBe(true);
    });
  }
  it("retains authenticated internal import refresh bypass", () => {
    expect(load("production", true).importRateLimiter.skip({ body: {} })).toBe(true);
  });
});

describe("Batch 1 account cache isolation", () => {
  it("does not share cached or late in-flight responses across account clients", async () => {
    const a = createAppQueryClient(), b = createAppQueryClient();
    a.setQueryData(["/api/clients"], [{ id: "a" }]);
    expect(b.getQueryData(["/api/clients"])).toBeUndefined();
    let resolve!: (v: string) => void;
    const pending = a.fetchQuery({ queryKey: ["late"], queryFn: () => new Promise<string>(r => { resolve = r; }) }).catch(() => undefined);
    await a.cancelQueries(); a.clear(); resolve("old-owner");
    await pending;
    expect(b.getQueryData(["late"])).toBeUndefined();
    expect(a.getQueryData(["late"])).toBeUndefined();
    a.clear(); b.clear();
  });
});

describe("Batch 1 exact OAuth signing and database TLS configuration", () => {
  const source = ts.createSourceFile("routes.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
  const declarations = new Map<string, string>();
  function visit(n: ts.Node) {
    if (ts.isVariableDeclaration(n) && ts.isIdentifier(n.name)) declarations.set(n.name.text, `const ${n.getText(source)};`);
    ts.forEachChild(n, visit);
  }
  visit(source);
  for (const provider of ["LinkedIn", "Meta"]) it(`${provider} accepts configured state and rejects tampering, expiry and missing production secrets`, () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const key of ["APP_SECRET", "SESSION_SECRET", "TOKEN_ENCRYPTION_KEY", "ENCRYPTION_KEY", "LINKEDIN_OAUTH_STATE_SECRET", "META_OAUTH_STATE_SECRET"]) vi.stubEnv(key, "");
    const prefix = provider.toUpperCase(), sign = `sign${provider}OAuthState`, verify = `verify${provider}OAuthState`;
    const code = ts.transpileModule([`${prefix}_OAUTH_STATE_TTL_MS`, sign, verify].map(n => declarations.get(n)).join("\n"), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
    const [signState, verifyState] = new Function("resolveOAuthStateSigningSecret", "createHmac", "randomBytes", "timingSafeEqual", "process", "Buffer", code + `\nreturn [${sign}, ${verify}];`)(resolveOAuthStateSigningSecret, createHmac, randomBytes, timingSafeEqual, process, Buffer);
    expect(() => signState("campaign-a")).toThrow("not configured");
    expect(() => verifyState("a.b")).toThrow("not configured");
    vi.stubEnv(`${prefix}_OAUTH_STATE_SECRET`, "fixture-signing-key");
    const state = signState("campaign-a", true);
    expect(verifyState(state)).toEqual({ ok: true, campaignId: "campaign-a", spendOnly: true });
    expect(verifyState(state.replace(/^./, state[0] === "a" ? "b" : "a")).ok).toBe(false);
    const originalNow = Date.now();
    const clock = vi.spyOn(Date, "now").mockReturnValue(originalNow + 601000);
    try { expect(verifyState(state).ok).toBe(false); } finally { clock.mockRestore(); }
    vi.stubEnv(`${prefix}_OAUTH_STATE_SECRET`, "rotated-key");
    expect(verifyState(state).ok).toBe(false);
  });
  for (const options of ["sslmode=disable", "sslmode=require", "sslmode=require&uselibpqcompat=true"]) it(`requires verified production TLS despite ${options}`, async () => {
    const require = createRequire(import.meta.url), exports: any = {};
    const code = ts.transpileModule(readFileSync("server/db.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    new Function("exports", "require", "process", code)(exports, (name: string) => name === "@shared/schema" ? {} : name === "drizzle-orm/node-postgres" ? { drizzle: () => ({}) } : require(name),
      { env: { NODE_ENV: "production", DATABASE_URL: `postgresql://fixture@localhost/fixture?${options}` } });
    try {
      const client = new (require("pg").Client)(exports.pool.options);
      expect(client.connectionParameters.ssl).toBeTruthy();
      expect(client.connectionParameters.ssl.rejectUnauthorized).not.toBe(false);
      expect(new URL(exports.pool.options.connectionString).searchParams.get("sslmode")).toBe("verify-full");
    } finally { await exports.pool.end(); }
  });
});

it("logs API metadata without response credentials or capability tokens", () => {
  const source = ts.createSourceFile("index.ts", readFileSync("server/index.ts", "utf8"), ts.ScriptTarget.Latest, true);
  let handler = "";
  function visit(n: ts.Node) {
    if (ts.isCallExpression(n) && n.expression.getText(source) === "app.use" && n.arguments[0]?.getText(source) === "'/api'") handler = n.arguments[1].getText(source);
    ts.forEachChild(n, visit);
  }
  visit(source); expect(handler).not.toBe("");
  const lines: string[] = [];
  const code = ts.transpileModule(`const middleware = ${handler};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const middleware = new Function("log", code + "\nreturn middleware;")((s: string) => lines.push(s));
  for (const path of ["/webhook/custom-integration/SENSITIVE-TOKEN", "/email/inbound/SENSITIVE-TOKEN", "/integrations"]) {
    const listeners: any = {}, response = { statusCode: 200, on: (event: string, fn: any) => listeners[event] = fn, json: vi.fn() };
    middleware({ path, method: "POST" }, response, vi.fn());
    response.json({ credentials: "SENSITIVE-CREDENTIALS" }); listeners.finish();
  }
  expect(lines).toHaveLength(3);
  expect(lines.join("\n")).not.toContain("SENSITIVE");
  expect(lines[0]).toContain("[redacted]");
});
