import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readClient = (relativePath: string) =>
  readFileSync(join(process.cwd(), "client", "src", ...relativePath.split("/")), "utf-8");
const readServer = (relativePath: string) =>
  readFileSync(join(process.cwd(), "server", ...relativePath.split("/")), "utf-8");

describe("GA4 30-day production scope regression guard", () => {
  it("keeps both GA4 setup flows fixed to 30 days without a non-choice button in the campaign wizard", () => {
    const connectionFlow = readClient("components/GA4ConnectionFlow.tsx");
    const campaignsPage = readClient("pages/campaigns.tsx");

    expect(connectionFlow).toContain("useState<number>(30)");
    expect(connectionFlow).toContain("[30].map((days) =>");
    expect(connectionFlow).not.toContain("[30, 60, 90].map((days) =>");
    expect(connectionFlow).toContain("lookbackDays,");

    expect(campaignsPage).toContain("useState<number>(30)");
    expect(campaignsPage).toContain("setWizardLookbackDays(30)");
    expect(campaignsPage).not.toContain("[30].map((days) =>");
    expect(campaignsPage).not.toContain("[30, 60, 90].map((days) =>");
    expect(campaignsPage).toContain("<Label>Historical data</Label>");
    expect(campaignsPage).not.toContain("<Label>Import historical data</Label>");
    expect(campaignsPage).toContain("Includes the last 30 completed days automatically.");
    expect(campaignsPage).toContain("lookbackDays: wizardLookbackDays");
  });

  it("rejects unsupported persistence requests before provider or storage mutation", () => {
    const routes = readServer("routes-oauth.ts");
    expect(routes).toContain('app.post("/api/campaigns/:id/ga4-property", selectGA4Property)');
    expect(routes).toContain('app.post("/api/ga4/select-property", selectGA4Property)');
    const start = routes.indexOf('const selectGA4Property =');
    const route = routes.slice(start, routes.indexOf('app.post("/api/campaigns/:id/ga4-property"', start));
    expect(route).toContain('error: "UNSUPPORTED_GA4_LOOKBACK"');
    const rejection = route.indexOf('Number(lookbackDays) !== 30');
    expect(rejection).toBeGreaterThan(-1);
    for (const operation of ['storage.getPendingGA4OAuthConnection','storage.getGA4Connections','storage.stageGA4OAuthConnection','storage.commitGA4OAuthConnection']) {
      expect(route.indexOf(operation)).toBeGreaterThan(rejection);
    }

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
