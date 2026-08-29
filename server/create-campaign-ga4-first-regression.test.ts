import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

const campaignsPage = readFileSync(
  join(process.cwd(), "client", "src", "pages", "campaigns.tsx"),
  "utf-8",
);

describe("GA4-first Create Campaign wizard", () => {
  it("allows only Google Analytics and excludes every other platform from finalization", () => {
    const selectionStep = campaignsPage.slice(
      campaignsPage.indexOf("/* Step 2: Select Platform */"),
      campaignsPage.indexOf("/* Step 3: Authenticate */"),
    );

    expect(campaignsPage).toContain('const GA4_FIRST_CREATE_CAMPAIGN_PLATFORM_IDS = new Set(["google-analytics"]);');
    expect(selectionStep).toContain("{createCampaignPlatforms.map((platform) => {");
    expect(selectionStep).not.toContain("{platforms.map((platform) => {");
    expect(campaignsPage).toContain("selectedPlatforms = selectedPlatforms.filter(isCreateCampaignPlatformEnabled);");
    expect(campaignsPage).toContain('platform: selectedPlatforms.join(", "),');
    expect(campaignsPage).toContain("handleConnectorsComplete(createCampaignConnectedPlatforms)");
  });
});
