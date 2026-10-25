import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("Google Ads revenue wizard context", () => {
  it("lets the shared revenue wizard carry a Google Ads context without changing GA4 defaults", () => {
    const modal = readSource("client", "src", "components", "AddRevenueWizardModal.tsx");

    expect(modal).toMatch(/type RevenuePlatformContext =[^;]*'google_ads'[^;]*;/);
    expect(modal).toContain("platformContext = 'ga4'");
    expect(modal).toContain("platformContext === 'google_ads' ? 'google_ads_revenue'");
    expect(modal).toContain('platformContext === \'google_ads\' ? "Add Google Ads attributed revenue"');
    expect(modal).toContain("Choose the source that attributes revenue back to Google Ads activity.");
    expect(modal).toContain('`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads`');
    expect(modal).toContain('`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads&dateRange=90days`');
    expect(modal).toContain('queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_ads"]');
    expect(modal).toContain('void queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads&dateRange=90days`], exact: false });');
    expect(modal).toContain('void queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_ads"], exact: false });');
    expect(modal).toContain('void queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-ads-campaign-revenue"], exact: false });');
    expect(modal).toContain("`/api/google-ads/${campaignId}/campaigns`");
    expect(modal).toContain('queryKey: ["/api/platforms/google_ads/kpis", campaignId]');
  });

  it("passes Google Ads through provider wizard prop contracts", () => {
    const hubspot = readSource("client", "src", "components", "HubSpotRevenueWizard.tsx");
    const salesforce = readSource("client", "src", "components", "SalesforceRevenueWizard.tsx");
    const shopify = readSource("client", "src", "components", "ShopifyRevenueWizard.tsx");

    for (const source of [hubspot, salesforce, shopify]) {
      expect(source).toMatch(/platformContext\?:[^;]*"google_ads"[^;]*;/);
    }
  });

  it("allows Google Ads revenue Google Sheets purpose and shared write validation", () => {
    const sheetsAuth = readSource("client", "src", "components", "SimpleGoogleSheetsAuth.tsx");
    const routes = readSource("server", "routes-oauth.ts");

    expect(sheetsAuth).toContain("'google_ads_revenue'");
    expect(sheetsAuth).toMatch(/const isRevenueConnector =[^;]*purpose === 'google_ads_revenue'/);
    expect(routes).toMatch(/purpose === "spend"[^\n]*purpose === "google_ads_revenue"/);
    expect(routes).toContain('signGoogleSheetsOAuthState(String(campaignId), sheetsPurpose)');
    expect(routes).toMatch(/purpose === 'spend'[^\n]*purpose === 'google_ads_revenue'/);
    expect(routes).toMatch(/sheetsPurpose === 'revenue'[^\n]*sheetsPurpose === 'google_ads_revenue'/);
    expect(routes).toMatch(/const zPlatformContext = z.enum\(\[[^\]]*"google_ads"/);
  });
});
