import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Endpoint Auth & OAuth Audit Tests
 *
 * Guardrail tests that scan source code to catch common integration bugs:
 * 1. Missing ensureCampaignAccess on CRM/platform endpoints
 * 2. Missing refresh_token in OAuth scopes
 * 3. Silent catch blocks in token refresh helpers
 *
 * These run in <1s and prevent regressions when adding new endpoints or platforms.
 */

const ROUTES_FILE = join(__dirname, "routes-oauth.ts");

function readRoutes(): string {
  return readFileSync(ROUTES_FILE, "utf-8");
}

// ---------------------------------------------------------------------------
// 1) Auth guard audit — every /api/salesforce, /api/hubspot, /api/shopify
//    endpoint that uses :campaignId must call ensureCampaignAccess
// ---------------------------------------------------------------------------
describe("Endpoint auth guard audit", () => {
  // Patterns for CRM endpoints that take a campaignId param
  // Excludes OAuth connect/callback routes (those don't use campaignId from URL)
  const CRM_ENDPOINT_PATTERN =
    /app\.(get|post|put|patch|delete)\(\s*["'`]\/api\/(salesforce|hubspot|shopify)\/:campaignId/g;

  it("all Salesforce :campaignId endpoints have ensureCampaignAccess", () => {
    const content = readRoutes();
    const lines = content.split("\n");
    const missing: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        !line.match(
          /app\.(get|post|put|patch|delete)\(\s*["'`]\/api\/salesforce\/:campaignId/
        )
      )
        continue;

      // Check next 10 lines for ensureCampaignAccess
      const block = lines.slice(i, i + 12).join("\n");
      if (!block.includes("ensureCampaignAccess")) {
        const route = line.trim().slice(0, 100);
        missing.push(`routes-oauth.ts:${i + 1} — ${route}`);
      }
    }

    expect(missing, `Salesforce endpoints missing auth:\n${missing.join("\n")}`).toHaveLength(0);
  });

  it("all HubSpot :campaignId endpoints have ensureCampaignAccess", () => {
    const content = readRoutes();
    const lines = content.split("\n");
    const missing: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        !line.match(
          /app\.(get|post|put|patch|delete)\(\s*["'`]\/api\/hubspot\/:campaignId/
        )
      )
        continue;

      const block = lines.slice(i, i + 12).join("\n");
      if (!block.includes("ensureCampaignAccess")) {
        const route = line.trim().slice(0, 100);
        missing.push(`routes-oauth.ts:${i + 1} — ${route}`);
      }
    }

    expect(missing, `HubSpot endpoints missing auth:\n${missing.join("\n")}`).toHaveLength(0);
  });

  it("all Shopify :campaignId endpoints have ensureCampaignAccess", () => {
    const content = readRoutes();
    const lines = content.split("\n");
    const missing: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        !line.match(
          /app\.(get|post|put|patch|delete)\(\s*["'`]\/api\/shopify\/:campaignId/
        )
      )
        continue;

      const block = lines.slice(i, i + 12).join("\n");
      if (!block.includes("ensureCampaignAccess")) {
        const route = line.trim().slice(0, 100);
        missing.push(`routes-oauth.ts:${i + 1} — ${route}`);
      }
    }

    expect(missing, `Shopify endpoints missing auth:\n${missing.join("\n")}`).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// 2) OAuth scope audit — refresh_token must be in default scopes
// ---------------------------------------------------------------------------
describe("OAuth scope audit", () => {
  it("Salesforce default scope includes refresh_token", () => {
    const content = readRoutes();
    // Find the line that sets the default Salesforce scope
    const match = content.match(
      /SALESFORCE_OAUTH_SCOPE.*\|\|.*['"]([^'"]+)['"]\)/
    );
    expect(match, "Could not find Salesforce default scope in routes-oauth.ts").toBeTruthy();
    const defaultScope = match![1];
    expect(
      defaultScope,
      `Salesforce default scope "${defaultScope}" must include refresh_token for token renewal`
    ).toContain("refresh_token");
  });
});

// ---------------------------------------------------------------------------
// 3) Token refresh error handling — no silent catch blocks
// ---------------------------------------------------------------------------
describe("Token refresh error handling audit", () => {
  it("getSalesforceAccessTokenForCampaign does not silently catch errors", () => {
    const content = readRoutes();
    // Extract the function body
    const fnStart = content.indexOf("async function getSalesforceAccessTokenForCampaign");
    expect(fnStart, "Could not find getSalesforceAccessTokenForCampaign").toBeGreaterThan(-1);

    // Get ~30 lines of the function
    const fnBlock = content.slice(fnStart, fnStart + 1200);

    // Should NOT have a catch block that ignores errors
    const hasSilentCatch =
      fnBlock.includes("catch {\n") &&
      (fnBlock.includes("// ignore") || fnBlock.includes("// try existing"));
    expect(
      hasSilentCatch,
      "getSalesforceAccessTokenForCampaign silently catches token refresh errors — expired tokens will be used"
    ).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 4) Client-side encodeURIComponent misuse audit
// ---------------------------------------------------------------------------
describe("Client fetch call audit", () => {
  const CLIENT_SRC = join(__dirname, "..", "client", "src");

  it("no encodeURIComponent calls have object arguments", () => {
    const files = [
      "components/SalesforceRevenueWizard.tsx",
      "components/HubSpotRevenueWizard.tsx",
      "components/ShopifyRevenueWizard.tsx",
    ];
    const issues: string[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(join(CLIENT_SRC, file), "utf-8");
      } catch {
        continue;
      }
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        // Match encodeURIComponent(something, {something})
        if (lines[i].match(/encodeURIComponent\([^)]+,\s*\{/)) {
          issues.push(`${file}:${i + 1} — encodeURIComponent called with object argument`);
        }
      }
    }

    expect(issues, `encodeURIComponent misuse:\n${issues.join("\n")}`).toHaveLength(0);
  });

  it("no duplicate credentials properties in fetch options", () => {
    const files = [
      "components/SalesforceRevenueWizard.tsx",
      "components/HubSpotRevenueWizard.tsx",
      "components/AddRevenueWizardModal.tsx",
      "components/AddSpendWizardModal.tsx",
    ];
    const issues: string[] = [];

    for (const file of files) {
      let content: string;
      try {
        content = readFileSync(join(CLIENT_SRC, file), "utf-8");
      } catch {
        continue;
      }
      // Find fetch blocks by matching braces — a fetch call is `fetch(url, { ... })`
      // We look for the opening `{` after fetch and count until the matching `}`
      const lines = content.split("\n");
      for (let i = 0; i < lines.length; i++) {
        if (!lines[i].includes("await fetch(") && !lines[i].includes("fetch(`")) continue;

        // Extract just THIS fetch's options block (stop at first `});` or next fetch)
        let block = "";
        let braceDepth = 0;
        let inOptions = false;
        for (let j = i; j < Math.min(i + 15, lines.length); j++) {
          const l = lines[j];
          block += l + "\n";
          for (const ch of l) {
            if (ch === "{") { braceDepth++; inOptions = true; }
            if (ch === "}") braceDepth--;
          }
          if (inOptions && braceDepth <= 0) break;
        }
        const credentialMatches = block.match(/credentials:\s*["']include["']/g);
        if (credentialMatches && credentialMatches.length > 1) {
          issues.push(`${file}:${i + 1} — duplicate credentials property in fetch()`);
        }
      }
    }

    expect(issues, `Duplicate credentials:\n${issues.join("\n")}`).toHaveLength(0);
  });
});
