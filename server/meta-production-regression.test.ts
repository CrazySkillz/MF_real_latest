import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const read = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

const sliceBetween = (source: string, startNeedle: string, endNeedle: string) => {
  const start = source.indexOf(startNeedle);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = source.indexOf(endNeedle, start);
  expect(end).toBeGreaterThan(start);
  return source.slice(start, end);
};

describe("Meta production readiness regression guard", () => {
  it("keeps Meta test-mode setup from finalizing without an explicit campaign selection", () => {
    const flow = read("client", "src", "components", "SimpleMetaAuth.tsx");

    expect(flow).toContain("deferSeedUntilSelection: true");
    expect(flow).toContain("selected: selectedCampaignIds.has(String(c.id))");
    expect(flow).toContain("if (selectedIds.length === 0) throw new Error('Select at least one Meta campaign')");
    expect(flow).toContain("disabled={selectedCount === 0 || savingSelection}");
    expect(flow).toContain("Meta cannot be finalized until at least one campaign is available and selected.");
    expect(flow).not.toContain("Skip (import all)");
    expect(flow).not.toContain("Campaign selection available later.");
  });

  it("lists Meta test-mode campaigns from the same mock IDs used by the scheduler", () => {
    const routes = read("server", "routes-oauth.ts");
    const scheduler = read("server", "meta-scheduler.ts");
    const campaignsRoute = sliceBetween(
      routes,
      'app.get("/api/meta/:campaignId/campaigns"',
      'app.get("/api/meta/:campaignId/insights/daily"'
    );

    expect(scheduler).toContain("export const META_MOCK_CAMPAIGNS = [");
    expect(campaignsRoute).toContain('String((connection as any).method || "") === "test_mode"');
    expect(campaignsRoute).toContain("const { META_MOCK_CAMPAIGNS } = await import('./meta-scheduler');");
    expect(campaignsRoute).toContain("const campaigns = META_MOCK_CAMPAIGNS.map((campaign) => ({");
    expect(campaignsRoute.indexOf("META_MOCK_CAMPAIGNS")).toBeLessThan(campaignsRoute.indexOf("MetaGraphAPIClient"));
  });

  it("seeds Meta test-mode daily rows only after selected campaign IDs are saved by the setup UI", () => {
    const routes = read("server", "routes-oauth.ts");
    const testConnectRoute = sliceBetween(
      routes,
      'app.post("/api/meta/:campaignId/connect-test"',
      'app.get("/api/meta/:campaignId/connection"'
    );
    const selectedCampaignRoute = sliceBetween(
      routes,
      'app.patch("/api/meta/:campaignId/selected-campaigns"',
      'app.get("/api/campaigns/:id/benchmarks/evaluated"'
    );

    expect(testConnectRoute).toContain("const deferSeedUntilSelection = !!(req.body as any)?.deferSeedUntilSelection;");
    expect(testConnectRoute).toContain("if (!deferSeedUntilSelection)");
    expect(selectedCampaignRoute).toContain("if (selectedCampaignIds.length === 0) return res.status(400)");
    expect(selectedCampaignRoute).toContain("await storage.updateMetaConnection(campaignId");
    expect(selectedCampaignRoute).toContain('if (String(connection.method || "") === "test_mode")');
    expect(selectedCampaignRoute).toContain("const nextConnection = { ...connection, selectedCampaignIds: JSON.stringify(selectedCampaignIds) };");
    expect(selectedCampaignRoute).toContain("await generateMockMetaData(campaignId, nextConnection, { advanceDay: true });");
    expect(selectedCampaignRoute.indexOf("storage.updateMetaConnection")).toBeLessThan(selectedCampaignRoute.indexOf("generateMockMetaData"));
  });
});
