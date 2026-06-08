import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readCampaignsPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf8");
const readCampaignDetailPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf8");

describe("TikTok Create Campaign source-contract regression guard", () => {
  it("exposes TikTok only through the Create Campaign test source contract", () => {
    const source = readCampaignsPage();

    expect(source).toContain('id: "tiktok"');
    expect(source).toContain('name: "TikTok Ads"');
    expect(source).toContain("SIMULATED_TIKTOK_ADVERTISERS");
    expect(source).toContain("SIMULATED_TIKTOK_CAMPAIGNS");
    expect(source).toContain("selectedWizardPlatform === 'tiktok'");
    expect(source).toContain("connectTikTokTestMode");
    expect(source).toContain('apiRequest("POST", `/api/tiktok/${draftCampaignId}/connect-test`');
    expect(source).toContain("selectedCampaignMetadata: SIMULATED_TIKTOK_CAMPAIGNS.filter");
    expect(source).not.toContain("upsertTikTokDailyMetrics");
    expect(source).not.toContain("tiktok-analytics");
  });

  it("blocks finalization unless the TikTok backend source has selected campaigns", () => {
    const source = readCampaignsPage();
    const guardStart = source.indexOf("if (selectedPlatforms.includes('tiktok'))");
    const finalizeStart = source.indexOf("// Finalize: update the already-created campaign", guardStart);
    const guard = source.slice(guardStart, finalizeStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guard).toContain('apiRequest("GET", `/api/tiktok/${draftCampaignId}/connection`)');
    expect(guard).toContain("TikTok connection required");
    expect(guard).toContain("TikTok campaign required");
    expect(guard).toContain("Array.isArray(connection.selectedCampaignIds)");
    expect(guard).toContain("connection.selectedCampaignIds.length === 0");
  });

  it("keeps TikTok campaigns deselected until the user selects them", () => {
    const source = readCampaignsPage();

    expect(source).toContain('const [tiktokSelectedCampaignIds, setTikTokSelectedCampaignIds] = useState("");');
    expect(source).toContain('setTikTokSelectedCampaignIds("");');
    expect(source).toContain("Select all");
    expect(source).toContain("updateTikTokCampaignSelection");
  });

  it("exposes TikTok in Connected Platforms only through the add-source contract", () => {
    const campaignDetail = readCampaignDetailPage();

    expect(campaignDetail).toContain("connectTikTokTestMode");
    expect(campaignDetail).toContain('apiRequest("POST", `/api/tiktok/${campaignId}/connect-test`');
    expect(campaignDetail).toContain('platform: "TikTok Ads"');
    expect(campaignDetail).toContain('analyticsPath: null');
    expect(campaignDetail).toContain('url = `/api/tiktok/${campaignId}/connection`');
    expect(campaignDetail).not.toContain("tiktok-analytics");
  });
});
