import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Instagram Connected Platforms regression guard", () => {
  it("surfaces Instagram status only from the persisted source contract", () => {
    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.get("/api/campaigns/:id/connected-platforms"');
    const routeEnd = routes.indexOf("// Get list of LinkedIn campaigns", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("storage.getInstagramConnection(campaignId)");
    expect(route).toContain("instagramSelectedCampaignIds");
    expect(route).toContain("instagramSelectedCampaignIds.length > 0");
    expect(route).toContain('id: "instagram"');
    expect(route).toContain('name: "Instagram Ads"');
    expect(route).toContain("connected: instagramConnected");
    expect(route).toContain("analyticsPath: null");
    expect(route).toContain("sourceContractVersion: instagramConnection?.sourceContractVersion");
    expect(route).not.toContain("/instagram-analytics");
    expect(route).not.toContain("upsertInstagramDailyMetrics");
    expect(route).not.toContain("refreshInstagram");
  });

  it("renders the Instagram Connected Platforms card shell without analytics exposure", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain('import { SiGoogle, SiFacebook, SiInstagram');
    expect(page).toContain('const isInstagramConnected = platformStatusMap.get("instagram")?.connected === true;');
    expect(page).toContain('platform: "Instagram Ads"');
    expect(page).toContain("connected: isInstagramConnected");
    expect(page).toContain("analyticsPath: null");
    expect(page).toContain('case "Instagram Ads":');
    expect(page).toContain("p === 'Instagram Ads'");
    expect(page).toContain("`/api/instagram/${campaignId}/connection`");
    expect(page).not.toContain("/campaigns/${campaign?.id}/instagram");
    expect(page).not.toContain("InstagramConnectionFlow");
  });

  it("connects Instagram from Connected Platforms only through the test source-contract route", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain("connectInstagramTestMode");
    expect(page).toContain("invalidateInstagramConnectedPlatformQueries");
    expect(page).toContain("selectedCampaignIds.length === 0");
    expect(page).toContain('title: "Instagram campaign required"');
    expect(page).toContain('title: "Connection Failed"');
    expect(page).toContain("`/api/instagram/${campaignId}/connect-test`");
    expect(page).toContain('platform.platform === "Instagram Ads" ?');
    expect(page).toContain("Connect Instagram Test Account");
    expect(page).toContain('queryKey: ["/api/campaigns", campaignId, "connected-platforms"]');
    expect(page).toContain("`/api/instagram/${campaignId}/connection`");
    expect(page).toContain("`/api/campaigns/${campaignId}/outcome-totals`");
    expect(page).toContain("`/api/campaigns/${campaignId}/executive-summary`");
    expect(page).toContain("`/api/campaigns/${campaignId}/trend-analysis`");
    expect(page).toContain("`/api/campaigns/${campaignId}/kpis`");
    expect(page).toContain("`/api/campaigns/${campaignId}/benchmarks`");
    expect(page).toContain("`/api/campaigns/${campaignId}/all-data-sources`");
    expect(page).not.toContain("/api/instagram/oauth");
    expect(page).not.toContain("refreshInstagram");
    expect(page).not.toContain("upsertInstagramDailyMetrics");
  });
});
