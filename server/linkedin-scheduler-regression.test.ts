import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("LinkedIn scheduler freshness regression guard", () => {
  it("skips downstream KPI, alert, and snapshot work when LinkedIn data is not refreshed", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "linkedin-scheduler.ts"), "utf-8");
    const refreshStart = scheduler.indexOf("export async function refreshLinkedInDataForCampaign");
    const refreshEnd = scheduler.indexOf("/**\n * Refresh LinkedIn data for all campaigns", refreshStart);
    const refreshFn = scheduler.slice(refreshStart, refreshEnd);

    expect(refreshFn).toContain("Promise<{ refreshed: boolean }>");
    expect(refreshFn).toContain("const campaign = await storage.getCampaign(campaignId)");
    expect(refreshFn).toContain("return { refreshed: false };");
    expect(refreshFn).toContain("const refreshed = isTestMode");
    expect(refreshFn).toContain("Skipping downstream refresh");
    expect(refreshFn.indexOf("if (!refreshed)")).toBeLessThan(refreshFn.indexOf("await refreshKPIsForCampaign(campaignId);"));
    expect(refreshFn).toContain("return { refreshed: true };");

    const routes = readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf-8");
    const routeStart = routes.indexOf('app.post("/api/campaigns/:id/linkedin/refresh"');
    const routeEnd = routes.indexOf("// Manual trigger: refresh GA4 data", routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("const refreshResult = await refreshLinkedInDataForCampaign");
    expect(route).toContain("if (!refreshResult?.refreshed)");
    expect(route.indexOf("if (!refreshResult?.refreshed)")).toBeLessThan(route.indexOf("await recordCampaignMetrics(campaignId);"));
  });

  it("reports failed or skipped source pulls instead of pretending refresh succeeded", () => {
    const scheduler = readFileSync(join(process.cwd(), "server", "linkedin-scheduler.ts"), "utf-8");
    const mockStart = scheduler.indexOf("async function generateMockLinkedInData");
    const realStart = scheduler.indexOf("async function fetchRealLinkedInData");
    const wrapperStart = scheduler.indexOf("export async function refreshLinkedInDataForCampaign");
    const mockFn = scheduler.slice(mockStart, realStart);
    const realFn = scheduler.slice(realStart, wrapperStart);

    expect(mockFn).toContain("): Promise<boolean>");
    expect(mockFn).toContain("No previous import sessions found for test mode campaign");
    expect(mockFn).toContain("return false;");
    expect(mockFn).toContain("return true;");

    expect(realFn).toContain("): Promise<boolean>");
    expect(realFn).toContain("No access token found");
    expect(realFn).toContain("No previous import sessions found");
    expect(realFn).toContain("No matching campaigns found");
    expect(realFn).toContain("return false;");
    expect(realFn).toContain("return true;");
  });
});
