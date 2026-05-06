import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const ROUTES_FILE = join(__dirname, "routes-oauth.ts");
const SHOPIFY_WIZARD_FILE = join(__dirname, "..", "client", "src", "components", "ShopifyRevenueWizard.tsx");
const REVENUE_MODAL_FILE = join(__dirname, "..", "client", "src", "components", "AddRevenueWizardModal.tsx");

function read(file: string): string {
  return readFileSync(file, "utf-8");
}

describe("Shopify revenue regression guard", () => {
  it("preserves stable source identity through Shopify revenue edit mode", () => {
    const modal = read(REVENUE_MODAL_FILE);
    const wizard = read(SHOPIFY_WIZARD_FILE);
    const routes = read(ROUTES_FILE);

    expect(modal).toContain("sourceId: initialSource?.id ? String(initialSource.id) : undefined");
    expect(wizard).toContain("initialMappingConfig?.sourceId");
    expect(routes).toContain('sourceId: z.string().trim().optional()');
    expect(routes).toContain('if (requestedSourceId) return String((s as any).id || "") === requestedSourceId;');
  });

  it("does not silently truncate Shopify order pagination", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("const { shopDomain, accessToken, apiVersion, createdAtMin, maxPages = 1000 } = args;");
    expect(routes).toContain("const seenUrls = new Set<string>();");
    expect(routes).toContain("if (nextUrl) {");
    expect(routes).toContain("Shopify orders pagination limit exceeded");
  });

  it("infers missing Shopify auth type without overriding saved auth type", () => {
    const routes = read(ROUTES_FILE);

    expect(routes).toContain("if (connected && !authType) {");
    expect(routes).toContain("/oauth/access_scopes.json");
    expect(routes).toContain('authType = "oauth";');
    expect(routes).toContain('authType = "token";');
  });
});
