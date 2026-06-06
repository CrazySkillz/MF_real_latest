import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Instagram Create Campaign flow regression guard", () => {
  it("connects Instagram only through the test source-contract route", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf-8");

    expect(page).toContain('id: "instagram"');
    expect(page).toContain('name: "Instagram Ads"');
    expect(page).toContain("const isComingSoon = ['twitter'].includes(platform.id);");
    expect(page).toContain("selectedWizardPlatform === 'instagram'");
    expect(page).toContain("connectInstagramTestMode");
    expect(page).toContain('useState("ig_test_1, ig_test_2, ig_test_3")');
    expect(page).toContain('setInstagramSelectedCampaignIds("ig_test_1, ig_test_2, ig_test_3")');
    expect(page).toContain("selectedCampaignIds.length === 0");
    expect(page).toContain("`/api/instagram/${draftCampaignId}/connect-test`");
    expect(page).toContain("selectedPlatforms.includes('instagram')");
    expect(page).toContain("`/api/instagram/${draftCampaignId}/connection`");
    expect(page).toContain("!connection.connected || !Array.isArray(connection.selectedCampaignIds) || connection.selectedCampaignIds.length === 0");
    expect(page.indexOf("`/api/instagram/${draftCampaignId}/connection`")).toBeLessThan(page.indexOf("`/api/campaigns/${draftCampaignId}`"));
    expect(page).toContain('queryKey: ["/api/campaigns", draftCampaignId, "connected-platforms"]');
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/outcome-totals`");
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/executive-summary`");
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/trend-analysis`");
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/kpis`");
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/benchmarks`");
    expect(page).toContain("`/api/campaigns/${draftCampaignId}/all-data-sources`");
    expect(page).not.toContain("/api/instagram/oauth");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
    expect(page).not.toContain("instagram-analytics");
  });
});
