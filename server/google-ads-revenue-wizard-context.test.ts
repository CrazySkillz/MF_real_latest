import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("Google Ads revenue wizard context", () => {
  it("lets the shared revenue wizard carry a Google Ads context without changing GA4 defaults", () => {
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");

    expect(modal).toContain("type RevenuePlatformContext = 'ga4' | 'linkedin' | 'meta' | 'google_ads';");
    expect(modal).toContain("platformContext = 'ga4'");
    expect(modal).toContain("platformContext === 'google_ads' ? 'google_ads_revenue' : 'revenue'");
    expect(modal).toContain('platformContext === \'google_ads\' ? "Add Google Ads attributed revenue"');
    expect(modal).toContain("Choose the source that attributes revenue back to Google Ads activity.");
    expect(modal).toContain('`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads`');
    expect(modal).toContain('`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads&dateRange=90days`');
    expect(modal).toContain('queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_ads"]');
    expect(modal).toContain('void queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads&dateRange=90days`], exact: false });');
    expect(modal).toContain('void queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_ads"], exact: false });');
    expect(modal).toContain('queryKey: ["/api/platforms/google_ads/kpis", campaignId]');
  });

  it("passes Google Ads through provider wizard prop contracts", () => {
    const hubspot = readSource("client", "src", "components", "HubSpotRevenueWizard.tsx");
    const salesforce = readSource("client", "src", "components", "SalesforceRevenueWizard.tsx");
    const shopify = readSource("client", "src", "components", "ShopifyRevenueWizard.tsx");

    for (const source of [hubspot, salesforce, shopify]) {
      expect(source).toContain('platformContext?: "ga4" | "linkedin" | "meta" | "google_ads";');
    }
  });

  it("allows Google Ads revenue Google Sheets purpose without opening revenue import write validation", () => {
    const sheetsAuth = readSource("client", "src", "components", "SimpleGoogleSheetsAuth.tsx");
    const routes = readSource("server", "routes-oauth.ts");

    expect(sheetsAuth).toContain("'google_ads_revenue'");
    expect(sheetsAuth).toContain("purpose === 'revenue' || purpose === 'linkedin_revenue' || purpose === 'google_ads_revenue'");
    expect(routes).toContain('purpose === "spend" || purpose === "revenue" || purpose === "general" || purpose === "linkedin_revenue" || purpose === "google_ads_revenue"');
    expect(routes).toContain("sheetsPurpose === 'spend' || sheetsPurpose === 'revenue' || sheetsPurpose === 'general' || sheetsPurpose === 'linkedin_revenue' || sheetsPurpose === 'google_ads_revenue'");
    expect(routes).toContain("purpose === 'spend' || purpose === 'revenue' || purpose === 'general' || purpose === 'linkedin_revenue' || purpose === 'google_ads_revenue'");
    expect(routes).toContain("sheetsPurpose === 'revenue' || sheetsPurpose === 'linkedin_revenue' || sheetsPurpose === 'google_ads_revenue'");
    expect(routes).toContain('const zPlatformContext = z.enum(["ga4", "linkedin", "meta"]);');
  });
});
