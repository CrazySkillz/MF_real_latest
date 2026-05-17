import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf-8");
}

function readClientSources(dir = join(process.cwd(), "client", "src")): string {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .map((path) => statSync(path).isDirectory() ? readClientSources(path) : readFileSync(path, "utf-8"))
    .join("\n");
}

describe("legacy route reachability inventory", () => {
  it("does not treat legacy LinkedIn report routes as removable while scheduler compatibility still references them", () => {
    const client = readClientSources();
    const scheduler = read("server/report-scheduler.ts");
    const routes = read("server/routes-oauth.ts");

    expect(client).not.toContain("/api/linkedin/reports");
    expect(scheduler).toContain("used by /api/linkedin/reports");
    expect(routes).toContain('app.get("/api/linkedin/reports"');
  });

  it("keeps shared Meta report routes classified as active because Meta and Google Ads pages both call them", () => {
    const metaPage = read("client/src/pages/meta-analytics.tsx");
    const googleAdsPage = read("client/src/pages/google-ads-analytics.tsx");
    const schema = read("shared/schema.ts");
    const metaReportsBlock = schema.slice(
      schema.indexOf('export const metaReports = pgTable("meta_reports"'),
      schema.indexOf("// Meta Daily Metrics", schema.indexOf('export const metaReports = pgTable("meta_reports"'))
    );

    expect(metaPage).toContain("/api/meta/reports");
    expect(googleAdsPage).toContain("/api/meta/reports");
    expect(metaReportsBlock).toContain('export const metaReports = pgTable("meta_reports"');
    expect(metaReportsBlock).not.toContain('platformType: text("platform_type"');
  });

  it("keeps ownerless campaign compatibility centralized and claim-based", () => {
    const routes = read("server/routes-oauth.ts");
    const accessStart = routes.indexOf("const ensureCampaignAccess = async");
    const accessEnd = routes.indexOf("async function requireCampaignAccessParamId", accessStart);
    const access = routes.slice(accessStart, accessEnd);

    expect(access).toContain("Backward compatibility: claim un-owned campaigns");
    expect(access).toContain("await storage.updateCampaign(campaignId, { ownerId: actorId } as any)");
    expect(access.indexOf("if (!ownerId)")).toBeLessThan(access.indexOf("if (ownerId !== actorId)"));
  });

  it("keeps campaign list ownerless compatibility claim-based before returning rows", () => {
    const routes = read("server/routes-oauth.ts");
    const routeStart = routes.indexOf('app.get("/api/campaigns"');
    const routeEnd = routes.indexOf('app.post("/api/campaigns"', routeStart);
    const route = routes.slice(routeStart, routeEnd);

    expect(route).toContain("if (ownerId && ownerId !== actorId) return false");
    expect(route).toContain("claim any un-owned campaigns shown to this session");
    expect(route).toContain("storage.updateCampaign(String(c?.id || \"\"), { ownerId: actorId } as any)");
    expect(route.indexOf("const toClaim")).toBeLessThan(route.indexOf("res.json("));
  });

  it("keeps legacy transfer routes classified as retained compatibility routes with campaign guards", () => {
    const client = readClientSources();
    const routes = read("server/routes-oauth.ts");
    const retainedRoutes = [
      "/api/ga4/transfer-connection",
      "/api/google-sheets/transfer-connection",
      "/api/linkedin/transfer-connection",
      "/api/meta/transfer-connection",
      "/api/custom-integration/transfer",
    ];

    for (const routePath of retainedRoutes) {
      expect(client).not.toContain(routePath);
      expect(routes).toContain(routePath);
    }
    expect(routes).toContain("ensureCampaignAccess(req as any, res as any, fromCampaignId)");
    expect(routes).toContain("ensureCampaignAccess(req as any, res as any, toCampaignId)");
    expect(routes).toContain("fromCampaignId !== 'temp-campaign-setup'");
  });
});
