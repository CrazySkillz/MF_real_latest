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
    expect(installer).toContain('installationMethod: "universal"');
    expect(installer).toContain('/mimosaas-tracking/websites/${existing.id}/rotate-secret');
    expect(installer).toContain('/api/mimosaas-tracking/tracker.js');
    expect(installer).not.toContain("localStorage");
  });

  it("requires verified installation and exact UTM mapping before atomic finalization", () => {
    expect(campaigns).toContain('Enter the exact value used after utm_campaign=');
    expect(campaigns).toContain('/mimosaas-tracking/mappings`');
    expect(campaigns).toContain('/mimosaas-tracking/finalize`');
    expect(routes).toContain('storage.finalizeMimosaasTrackingCampaign');
    expect(routes).toContain('Finalize Mimosaas Tracking through its verified setup flow.');
  });
});
