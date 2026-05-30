import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("LinkedIn Connected Platforms add-source flow regression guard", () => {
  it("runs parent invalidation before existing-campaign LinkedIn import redirects", () => {
    const flow = readFileSync(join(process.cwd(), "client", "src", "components", "LinkedInConnectionFlow.tsx"), "utf-8");
    const importStart = flow.indexOf("const handleImportSelectedCampaigns = async");
    const importEnd = flow.indexOf("if (step === 'connected')", importStart);
    const importHandler = flow.slice(importStart, importEnd);

    expect(importHandler).toContain("onImportComplete?.();");
    expect(importHandler).toContain("window.location.href = `/campaigns/${campaignId}/linkedin-analytics?session=${data.sessionId}`");
    expect(importHandler.indexOf("onImportComplete?.();")).toBeLessThan(
      importHandler.indexOf("window.location.href = `/campaigns/${campaignId}/linkedin-analytics?session=${data.sessionId}`"),
    );
  });

  it("invalidates connected-source and Campaign DeepDive consumers after LinkedIn import", () => {
    const page = readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf-8");

    expect(page).toContain("const invalidateLinkedInConnectedPlatformQueries = () => {");
    expect(page).toContain('queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "connected-platforms"] })');
    expect(page).toContain('queryClientHook.invalidateQueries({ queryKey: ["/api/linkedin/check-connection", campaignId] })');
    expect(page).toContain('queryClientHook.invalidateQueries({ queryKey: ["/api/linkedin/import-sessions", campaignId] })');
    expect(page).toContain('queryClientHook.invalidateQueries({ queryKey: ["/api/linkedin/metrics", campaignId] })');
    expect(page).toContain("queryClientHook.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/outcome-totals`], exact: false })");
    expect(page).toContain('queryClientHook.invalidateQueries({ queryKey: ["/api/campaigns", campaignId, "executive-summary"], exact: false })');
    expect(page).toContain("queryClientHook.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/executive-summary`], exact: false })");
    expect(page).toContain("queryClientHook.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/trend-analysis`], exact: false })");
    expect(page).toContain("queryClientHook.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/kpis`], exact: false })");
    expect(page).toContain("queryClientHook.invalidateQueries({ queryKey: [`/api/campaigns/${campaignId}/benchmarks`], exact: false })");
    expect(page).toContain("onImportComplete={() => {");
    expect(page).toContain("invalidateLinkedInConnectedPlatformQueries();");
  });
});
