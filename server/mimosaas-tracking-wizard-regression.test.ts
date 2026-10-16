import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");
const campaigns = read("client/src/pages/campaigns.tsx");
const installer = read("client/src/components/MimosaasTrackingConnectionFlow.tsx");
const routes = read("server/routes-oauth.ts");

describe("Mimosaas Tracking campaign wizard safety", () => {
  it("keeps the platform hidden until setup and ingestion are both available", () => {
    expect(campaigns).toContain('queryKey: ["/api/mimosaas-tracking/availability"]');
    expect(campaigns).toContain('mimosaasTrackingAvailability?.enabled === true');
    expect(routes).toContain('app.get("/api/mimosaas-tracking/availability", requireMimosaasTrackingIngestionFeature');
  });

  it("preserves one authoritative analytics source and the GA4 finalization branch", () => {
    expect(campaigns).toContain('selectedPlatforms.length !== 1');
    expect(campaigns).toContain('selectedPlatforms[0] === "mimosaas-tracking"');
    expect(campaigns).toContain('await apiRequest("PATCH", `/api/campaigns/${draftCampaignId}`');
    expect(campaigns).toContain('ga4CampaignFilter: ga4CampaignFilterForNewCampaign || null');
  });

  it("requires a campaign website and uses only the scoped installation APIs", () => {
    expect(campaigns).toContain('platform.id === "mimosaas-tracking" && !campaignData?.clientWebsite');
    expect(installer).toContain('prepareCredentials("universal")');
    expect(installer).toContain('/mimosaas-tracking/websites/${existing.id}/rotate-secret');
    expect(installer).toContain('/api/mimosaas-tracking/tracker.js');
    expect(installer).not.toContain("localStorage");
  });

  it("stops on Install until the marketer explicitly accepts an existing verified tracker", () => {
    expect(installer).not.toContain('if (matching?.installationStatus === "verified") notifyVerified(matching);');
    expect(installer).toContain("A verified tracker is already installed on this website");
    expect(installer).toContain("Continue with existing tracker");
    expect(installer).toContain("onClick={() => notifyVerified(connection)}");
  });

  it("offers GTM only as an explicit existing-installation choice and preserves the universal fallback", () => {
    expect(routes).toContain("MIMOSAAS_TRACKING_GTM_ENABLED");
    expect(routes).toContain('/mimosaas-tracking/gtm/availability"');
    expect(routes).toContain('/mimosaas-tracking/gtm/connect"');
    expect(routes).toContain('/mimosaas-tracking/gtm/install"');
    expect(installer).toContain("Choose Google Tag Manager only if it is already installed on this website.");
    expect(installer).toContain("Use Google Tag Manager");
    expect(installer).toContain("Use installation code");
    expect(installer).not.toContain('onClick={gtmAvailable ? startGtmInstallation : prepareUniversalInstallation}');
    expect(installer).toContain('prepareCredentials("universal")');
    expect(installer).toContain('title="Mimosaas automatic website verification"');
    expect(installer).toContain('sandbox="allow-scripts allow-same-origin"');
    expect(installer).toContain("Verifying website automatically");
  });

  it("offers scoped Google Ads attribution with the existing manual campaign-name fallback", () => {
    expect(campaigns).toContain('googleAdsAttributionEnabled?: boolean');
    expect(campaigns).toContain('label: selectedWizardPlatform === \'mimosaas-tracking\' ? "Advertising" : "Configure"');
    expect(campaigns).toContain('purpose="mimosaas_tracking"');
    expect(campaigns).toContain('Other advertising platform');
    expect(campaigns).toContain('Campaign tracking name');
    expect(campaigns).toContain('Example: for ?utm_campaign=summer_sale, enter summer_sale.');
    expect(campaigns).not.toContain('Enter the exact value used after utm_campaign=');
    expect(campaigns).toContain('/mimosaas-tracking/mappings`');
    expect(campaigns).toContain('/mimosaas-tracking/finalize`');
    expect(routes).toContain('storage.finalizeMimosaasTrackingCampaign');
    expect(routes).toContain('isMimosaasGoogleAdsAttributionEnabled()');
    expect(routes).toContain('Finalize Mimosaas Tracking through its verified setup flow.');
  });
});
