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

  it("locks final creation while the initial GA4 import is running", () => {
    expect(campaignsPage).toContain("const finalizingCampaignRef = useRef(false);");
    expect(campaignsPage).toContain("if (finalizingCampaignRef.current) return;");
    expect(campaignsPage).toContain("finalizingCampaignRef.current = true;");
    expect(campaignsPage).toContain("disabled={isFinalizingCampaign || createCampaignConnectedPlatforms.length === 0}");
    expect(campaignsPage).toContain("{isFinalizingCampaign ? (");
    expect(campaignsPage).toContain("finalizingCampaignRef.current = false;");
  });

  it("marks wizard cancellation as draft-only cleanup", () => {
    const deleteMutation = campaignsPage.slice(
      campaignsPage.indexOf("const deleteCampaignMutation"),
      campaignsPage.indexOf("const handleSubmit"),
    );
    const deleteError = deleteMutation.slice(deleteMutation.indexOf("onError:"));

    expect(campaignsPage).toContain('`/api/campaigns/${draftCampaignId}?draftCleanup=1`');
    expect(deleteError).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] });');
  });
});
