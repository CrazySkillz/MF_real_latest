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

  it("starts new Shopify revenue connections from a clean OAuth-first state", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('if (mode !== "edit") return "";');
    expect(wizard).toContain("const fetchStatus = async (applyExistingConnection = true) =>");
    expect(wizard).toContain('await fetchStatus(mode === "edit");');
    expect(wizard).toContain('setConnectMethod("oauth");');
    expect(wizard).not.toContain("Shopify doesn’t store LinkedIn campaign ids directly by default");
  });

  it("keeps users in OAuth when Shopify OAuth redirect is not configured", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('json?.code === "SHOPIFY_OAUTH_REDIRECT_NOT_CONFIGURED"');
    expect(wizard).toContain("Shopify OAuth setup is incomplete");
    expect(wizard).toContain("Configure the Shopify app callback URL before connecting with OAuth.");
  });

  it("does not switch Shopify OAuth users to token mode when order reads are blocked", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('json?.code === "SHOPIFY_PROTECTED_CUSTOMER_DATA_APPROVAL_REQUIRED"');
    expect(wizard).toContain("Shopify connected, but this OAuth app is not approved for protected customer data needed to read orders.");
    expect(wizard).not.toContain('if (connectMethod !== "token") setConnectMethod("token");');
  });

  it("uses clickable Shopify value rows as the crosswalk source of truth", () => {
    const wizard = read(SHOPIFY_WIZARD_FILE);

    expect(wizard).toContain('role="button"');
    expect(wizard).toContain('(step === "crosswalk" && selectedValues.length === 0)');
    expect(wizard).not.toContain("Map each Shopify value to a LinkedIn campaign. Unmapped values will be skipped.");
    expect(wizard).not.toContain('value={existing?.linkedinCampaignUrn || "__none__"}');
  });
});
