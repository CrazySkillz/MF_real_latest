import { readFileSync } from "node:fs";
import { once } from "node:events";
import express from "express";
import ts from "typescript";
import { chromium } from "@playwright/test";
import { describe, expect, it } from "vitest";

const server = readFileSync("server/index.ts", "utf8");
const page = readFileSync("client/index.html", "utf8");
const headerStart = server.indexOf('app.set("trust proxy", 1);') + 'app.set("trust proxy", 1);'.length;
const headerEnd = server.indexOf("// ----------------------------------------------------------------------------", headerStart);
const headerCode = ts.transpileModule(server.slice(headerStart, headerEnd), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const publishableKey = (host: string, mode = "live") => `pk_${mode}_${Buffer.from(host + "$", "utf8").toString("base64")}`;
function headerFixture(env: Record<string, string> = {}) {
  const app = express();
  app.set("env", "production");
  const policy: string = new Function("app", "process", "Buffer", `${headerCode}\nreturn contentSecurityPolicy;`)(app, { env }, Buffer);
  return { app, policy };
}
const directives = (policy: string) => new Map(policy.split("; ").map(value => {
  const [name, ...sources] = value.split(" "); return [name, sources];
}));

describe("production security headers", () => {
  it("sets the browser protections without breaking Clerk or OAuth popups", () => {
    for (const header of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]) {
      expect(server).toContain(`res.setHeader(\"${header}\"`);
    }

    expect(server).toContain("https://*.clerk.accounts.dev");
    expect(server).toContain("https://*.protect.clerk.com:*");
    expect(server).toContain("https://accounts.google.com");
    expect(server).not.toContain("Cross-Origin-Opener-Policy");
  });

  it("does not load the retired Replit development banner", () => {
    expect(page).not.toContain("replit-dev-banner.js");
  });

  it("allows only the configured custom production Clerk origin in script and connection sources", () => {
    const baseline = directives(headerFixture().policy);
    const actual = directives(headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey("clerk.production.example") }).policy);
    for (const [name, sources] of baseline) {
      expect(actual.get(name)).toEqual(["script-src", "connect-src"].includes(name)
        ? [...sources, "https://clerk.production.example"] : sources);
    }
    expect(actual.size).toBe(baseline.size);
  });

  it("keeps the current development-key policy unchanged and uses the frontend key for browser resources", () => {
    const baseline = headerFixture().policy;
    expect(headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey("fixture.clerk.accounts.dev", "test") }).policy).toBe(baseline);
    expect(headerFixture({ CLERK_PUBLISHABLE_KEY: publishableKey("clerk.other.example") }).policy).toBe(baseline);
    const policy = headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey("clerk.frontend.example"), CLERK_PUBLISHABLE_KEY: publishableKey("clerk.other.example") }).policy;
    expect(policy).toContain("https://clerk.frontend.example");
    expect(policy).not.toContain("clerk.other.example");
  });

  for (const host of ["*.example.com", "clerk.example.com; script-src *", "https://clerk.example.com", "clerk.example.com/path", "clerk.example.com:8443", "clerk.example.com\r\nX-Injected: yes", "clerk.example.com$", "-clerk.example.com", "clerk..example.com", "a".repeat(64) + ".example.com"]) {
    it(`does not broaden policy for malformed configured hostname ${JSON.stringify(host)}`, () => {
      expect(headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey(host) }).policy).toBe(headerFixture().policy);
    });
  }
  for (const key of ["pk_live_%%%", "sk_live_fixture", "pk_live_" + Buffer.from("clerk.example.com").toString("base64")]) {
    it(`does not broaden policy for malformed public key ${key}`, () => {
      expect(headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: key }).policy).toBe(headerFixture().policy);
    });
  }

  it("lets Chromium load a custom production Clerk script and API while blocking an unrelated origin", async () => {
    const { app, policy } = headerFixture({ VITE_CLERK_PUBLISHABLE_KEY: publishableKey("clerk.production.example") });
    app.get("/", (_req, res) => res.type("html").send(`<!doctype html>
      <script src="https://clerk.production.example/clerk.js"></script>
      <script src="https://accounts.google.com/google.js"></script>
      <script src="https://fixture.clerk.accounts.dev/development.js"></script>
      <script src="https://unrelated.example/blocked.js"></script>
      <script>window.cspProbe = Promise.all([
        'https://clerk.production.example/api', 'https://unrelated.example/api',
        'https://accounts.google.com/api'
      ].map(url => fetch(url).then(() => true, () => false)));</script>`));
    const listener = app.listen(0, "127.0.0.1");
    await once(listener, "listening");
    let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext();
      const origin = `http://127.0.0.1:${(listener.address() as { port: number }).port}`;
      await context.route("**/*", route => {
        const url = new URL(route.request().url());
        if (url.origin === origin) return route.continue();
        const names: Record<string, string> = { "/clerk.js": "clerkLoaded", "/google.js": "googleLoaded", "/development.js": "developmentLoaded", "/blocked.js": "unrelatedLoaded" };
        return route.fulfill({ status: 200, headers: { "access-control-allow-origin": "*" },
          contentType: names[url.pathname] ? "application/javascript" : "application/json",
          body: names[url.pathname] ? `window.${names[url.pathname]} = true;` : "{}" });
      });
      const tab = await context.newPage();
      const response = await tab.goto(origin);
      expect(response?.headers()["content-security-policy"]).toBe(policy);
      expect(response?.headers()["x-frame-options"]).toBe("DENY");
      expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
      expect(await tab.evaluate(() => (window as any).cspProbe)).toEqual([true, false, true]);
      expect(await tab.evaluate(() => [(window as any).clerkLoaded, (window as any).googleLoaded, (window as any).developmentLoaded, Boolean((window as any).unrelatedLoaded)])).toEqual([true, true, true, false]);
    } finally {
      await browser?.close(); listener.closeAllConnections();
      await new Promise<void>((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
    }
  }, 30000);
});
