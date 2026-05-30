import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("LinkedIn Create Campaign flow regression guard", () => {
  it("requires LinkedIn import completion before draft campaign activation", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf-8");
    const start = page.indexOf("const handleConnectorsComplete = async");
    const end = page.indexOf("const handleBackToForm", start);
    const handler = page.slice(start, end);

    expect(handler).toContain("selectedPlatforms.includes('linkedin') && !linkedInImportComplete");
    expect(handler).toContain("LinkedIn import incomplete");
    expect(handler).toContain("Finish importing selected LinkedIn campaigns before creating this campaign.");
    expect(handler).toContain('status: "active"');
  });

  it("refreshes LinkedIn source and aggregate queries after campaign activation", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf-8");
    const start = page.indexOf("const handleConnectorsComplete = async");
    const end = page.indexOf("const handleBackToForm", start);
    const handler = page.slice(start, end);

    expect(handler).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns"] })');
    expect(handler).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns", draftCampaignId] })');
    expect(handler).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns", draftCampaignId, "connected-platforms"] })');
    expect(handler).toContain("queryClient.invalidateQueries({ queryKey: [`/api/campaigns/${draftCampaignId}/outcome-totals`], exact: false })");
    expect(handler).toContain('queryClient.invalidateQueries({ queryKey: ["/api/campaigns", draftCampaignId, "executive-summary"] })');
    expect(handler).toContain('queryClient.invalidateQueries({ queryKey: ["/api/linkedin/imports"], exact: false })');
  });
});
