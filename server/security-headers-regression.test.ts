import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const server = readFileSync("server/index.ts", "utf8");
const page = readFileSync("client/index.html", "utf8");

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
});
