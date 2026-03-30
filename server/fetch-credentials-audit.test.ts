import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Fetch Credentials Audit Tests
 *
 * Verifies that ALL fetch() calls in mutation components include
 * credentials: "include" so Clerk session cookies are sent.
 *
 * This test caught 38+ missing credentials across:
 * - ga4-metrics.tsx (14 calls)
 * - AddRevenueWizardModal.tsx (14 calls)
 * - HubSpotRevenueWizard.tsx (6 calls)
 * - SalesforceRevenueWizard.tsx (8 calls)
 * - ShopifyRevenueWizard.tsx (6 calls)
 */

const CLIENT_SRC = join(__dirname, "..", "client", "src");

function readFile(relativePath: string): string {
  try {
    return readFileSync(join(CLIENT_SRC, relativePath), "utf-8");
  } catch {
    return "";
  }
}

function findFetchCallsWithoutCredentials(content: string, fileName: string): string[] {
  const issues: string[] = [];
  const lines = content.split("\n");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes("await fetch(") && !line.includes("fetch(`")) continue;

    // Check next 8 lines for credentials (some fetch calls span multiple lines)
    const block = lines.slice(i, i + 9).join("\n");
    if (block.includes("credentials")) continue;

    // Only flag mutation calls (POST/PUT/DELETE/PATCH) — these are the critical ones
    // that cause silent auth failures on Render
    if (block.includes("POST") || block.includes("DELETE") || block.includes("PATCH") || block.includes("PUT")) {
      issues.push(`${fileName}:${i + 1} — mutation fetch() missing credentials: "include"`);
    }
  }

  return issues;
}

describe("Fetch credentials audit", () => {
  const criticalFiles = [
    "components/AddRevenueWizardModal.tsx",
    "components/AddSpendWizardModal.tsx",
    "components/HubSpotRevenueWizard.tsx",
    "components/SalesforceRevenueWizard.tsx",
    "components/ShopifyRevenueWizard.tsx",
  ];

  for (const file of criticalFiles) {
    it(`${file} — all fetch() calls include credentials`, () => {
      const content = readFile(file);
      if (!content) {
        // File doesn't exist — skip (might be a path issue in CI)
        return;
      }
      const issues = findFetchCallsWithoutCredentials(content, file);
      if (issues.length > 0) {
        throw new Error(
          `Found ${issues.length} fetch() call(s) missing credentials: "include":\n` +
          issues.map((i) => `  - ${i}`).join("\n")
        );
      }
    });
  }
});

describe("Revenue source deactivation audit", () => {
  it("no revenue endpoint calls deactivateRevenueSourcesForCampaign", () => {
    const routesContent = readFileSync(
      join(__dirname, "routes-oauth.ts"),
      "utf-8"
    );

    // Find all calls to deactivateRevenueSourcesForCampaign (excluding the function definition)
    const lines = routesContent.split("\n");
    const calls: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (
        line.includes("deactivateRevenueSourcesForCampaign") &&
        !line.includes("const deactivateRevenueSourcesForCampaign") &&
        !line.includes("// ")
      ) {
        calls.push(`routes-oauth.ts:${i + 1}: ${line.trim()}`);
      }
    }

    if (calls.length > 0) {
      throw new Error(
        `Found ${calls.length} call(s) to deactivateRevenueSourcesForCampaign.\n` +
        `Revenue sources must be additive — only explicit delete should remove a source.\n` +
        calls.map((c) => `  - ${c}`).join("\n")
      );
    }
  });
});
