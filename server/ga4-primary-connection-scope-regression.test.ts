import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

function readRoutesSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "routes-oauth.ts"), "utf8");
}

function readStorageSource(): string {
  return fs.readFileSync(path.join(process.cwd(), "server", "storage.ts"), "utf8");
}

describe("GA4 primary connection campaign scoping", () => {
  it("route proves campaign access before setting a primary GA4 connection", () => {
    const routesSource = readRoutesSource();
    const routeStart = routesSource.indexOf('app.put("/api/campaigns/:id/ga4-connections/:connectionId/primary"');
    const routeEnd = routesSource.indexOf("// New route: Delete GA4 connection", routeStart);
    const route = routesSource.slice(routeStart, routeEnd);

    expect(route).toContain("ensureCampaignAccess");
    expect(route.indexOf("ensureCampaignAccess")).toBeLessThan(route.indexOf("storage.setPrimaryGA4Connection"));
  });

  it("storage proves the target GA4 connection belongs to the campaign before clearing primary flags", () => {
    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async setPrimaryGA4Connection(campaignId: string, connectionId: string)");
    const methodEnd = storageSource.indexOf("async deleteGA4Connection", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);

    expect(method).toContain("const [targetConnection]");
    expect(method).toContain("eq(ga4Connections.id, connectionId)");
    expect(method).toContain("eq(ga4Connections.campaignId, campaignId)");
    expect(method).toContain("eq(ga4Connections.isActive, true)");
    expect(method).toContain("if (!targetConnection) return false");
    expect(method.indexOf("if (!targetConnection) return false")).toBeLessThan(method.indexOf(".set({ isPrimary: false })"));
  });

  it("storage promotes the target GA4 connection using both connection ID and campaign ID", () => {
    const storageSource = readStorageSource();
    const methodStart = storageSource.indexOf("async setPrimaryGA4Connection(campaignId: string, connectionId: string)");
    const methodEnd = storageSource.indexOf("async deleteGA4Connection", methodStart);
    const method = storageSource.slice(methodStart, methodEnd);
    const promoteStart = method.indexOf(".set({ isPrimary: true })");
    const promoteEnd = method.indexOf(".returning()", promoteStart);
    const promote = method.slice(promoteStart, promoteEnd);

    expect(promote).toContain(".where(and(");
    expect(promote).toContain("eq(ga4Connections.id, connectionId)");
    expect(promote).toContain("eq(ga4Connections.campaignId, campaignId)");
  });
});
