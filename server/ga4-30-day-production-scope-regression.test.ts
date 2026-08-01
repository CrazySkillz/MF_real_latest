import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = (relativePath: string) =>
  readFileSync(join(process.cwd(), "client", "src", ...relativePath.split("/")), "utf-8");
const readServer = (relativePath: string) =>
  readFileSync(join(process.cwd(), "server", ...relativePath.split("/")), "utf-8");

describe("GA4 30-day production scope regression guard", () => {
  it("exposes only the 30-day saved window in both GA4 setup flows", () => {
    const connectionFlow = readClient("components/GA4ConnectionFlow.tsx");
    const campaignsPage = readClient("pages/campaigns.tsx");

    expect(connectionFlow).toContain("useState<number>(30)");
    expect(connectionFlow).toContain("[30].map((days) =>");
    expect(connectionFlow).not.toContain("[30, 60, 90].map((days) =>");
    expect(connectionFlow).toContain("lookbackDays,");

    expect(campaignsPage).toContain("useState<number>(30)");
    expect(campaignsPage).toContain("setWizardLookbackDays(30)");
    expect(campaignsPage).toContain("[30].map((days) =>");
    expect(campaignsPage).not.toContain("[30, 60, 90].map((days) =>");
    expect(campaignsPage).toContain("lookbackDays: wizardLookbackDays");
  });

  it("rejects unsupported persistence requests before provider or storage mutation", () => {
    const routes = readServer("routes-oauth.ts");
    const integratedStart = routes.indexOf('app.post("/api/campaigns/:id/ga4-property"');
    const integratedEnd = routes.indexOf('app.get("/api/campaigns/:id/ga4-timeseries"', integratedStart);
    const oauthStart = routes.indexOf('app.post("/api/ga4/select-property"');
    const oauthEnd = routes.indexOf("// Transfer GA4 connection", oauthStart);
    const integratedRoute = routes.slice(integratedStart, integratedEnd);
    const oauthRoute = routes.slice(oauthStart, oauthEnd);

    expect(integratedStart).toBeGreaterThan(-1);
    expect(oauthStart).toBeGreaterThan(-1);
    for (const route of [integratedRoute, oauthRoute]) {
      expect(route).toContain("Number(rawLookback) !== 30");
      expect(route).toContain('error: "UNSUPPORTED_GA4_LOOKBACK"');
      expect(route).not.toContain("[30, 60, 90].includes(Number(rawLookback))");
    }

    const integratedRejection = integratedRoute.indexOf("Number(rawLookback) !== 30");
    expect(integratedRejection).toBeLessThan(integratedRoute.indexOf("realGA4Client.setPropertyId"));
    expect(integratedRejection).toBeLessThan(integratedRoute.indexOf("storage.getGA4Connections"));
    expect(integratedRejection).toBeLessThan(integratedRoute.indexOf("storage.updateGA4Connection"));

    const oauthRejection = oauthRoute.indexOf("Number(rawLookback) !== 30");
    expect(oauthRejection).toBeLessThan(oauthRoute.indexOf("storage.getGA4Connections"));
    expect(oauthRejection).toBeLessThan(oauthRoute.indexOf("storage.updateGA4Connection"));
    expect(oauthRejection).toBeLessThan(oauthRoute.indexOf("realGA4Connections.set"));
  });

  it("keeps 30-day connections usable and fails closed for saved non-30 connections", () => {
    const routes = readServer("routes-oauth.ts");
    const metrics = readClient("pages/ga4-metrics.tsx");
    const checkStart = routes.indexOf('app.get("/api/ga4/check-connection/:campaignId"');
    const checkEnd = routes.indexOf("// Connected platforms summary for campaign detail page", checkStart);
    const listStart = routes.indexOf('app.get("/api/campaigns/:id/ga4-connections"');
    const listEnd = routes.indexOf('app.put("/api/campaigns/:id/ga4-connections/:connectionId/primary"', listStart);
    const checkRoute = routes.slice(checkStart, checkEnd);
    const listRoute = routes.slice(listStart, listEnd);

    for (const route of [checkRoute, listRoute]) {
      expect(route).toContain("Number(connection?.lookbackDays) === 30");
      expect(route).toContain("unsupportedLookbackConnectionCount");
      expect(route).not.toContain("[30, 60, 90].includes(Number(conn.lookbackDays))");
    }
    expect(checkRoute).toContain("unsupportedLookback: true");
    expect(checkRoute).toContain("connected: false");
    expect(metrics).toContain("Number(property?.lookbackDays) === 30");
    expect(metrics).toContain("const GA4_DAILY_LOOKBACK_DAYS = 30;");
  });
});
