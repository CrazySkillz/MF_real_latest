import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readCampaignsPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaigns.tsx"), "utf8");
const readCampaignDetailPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "campaign-detail.tsx"), "utf8");
const readTikTokAnalyticsPage = () => readFileSync(join(process.cwd(), "client", "src", "pages", "tiktok-analytics.tsx"), "utf8");
const readApp = () => readFileSync(join(process.cwd(), "client", "src", "App.tsx"), "utf8");
const readRoutes = () => readFileSync(join(process.cwd(), "server", "routes-oauth.ts"), "utf8");

describe("TikTok Create Campaign source-contract regression guard", () => {
  it("exposes TikTok only through the Create Campaign test source contract", () => {
    const source = readCampaignsPage();

    expect(source).toContain('id: "tiktok"');
    expect(source).toContain('name: "TikTok Ads"');
    expect(source).toContain("SIMULATED_TIKTOK_ADVERTISERS");
    expect(source).toContain("SIMULATED_TIKTOK_CAMPAIGNS");
    expect(source).toContain("selectedWizardPlatform === 'tiktok'");
    expect(source).toContain("connectTikTokTestMode");
    expect(source).toContain('apiRequest("POST", `/api/tiktok/${draftCampaignId}/connect-test`');
    expect(source).toContain("selectedCampaignMetadata: SIMULATED_TIKTOK_CAMPAIGNS.filter");
    expect(source).not.toContain("upsertTikTokDailyMetrics");
    expect(source).not.toContain("tiktok-analytics");
  });

  it("blocks finalization unless the TikTok backend source has selected campaigns", () => {
    const source = readCampaignsPage();
    const guardStart = source.indexOf("if (selectedPlatforms.includes('tiktok'))");
    const finalizeStart = source.indexOf("// Finalize: update the already-created campaign", guardStart);
    const guard = source.slice(guardStart, finalizeStart);

    expect(guardStart).toBeGreaterThanOrEqual(0);
    expect(guard).toContain('apiRequest("GET", `/api/tiktok/${draftCampaignId}/connection`)');
    expect(guard).toContain("TikTok connection required");
    expect(guard).toContain("TikTok campaign required");
    expect(guard).toContain("Array.isArray(connection.selectedCampaignIds)");
    expect(guard).toContain("connection.selectedCampaignIds.length === 0");
  });

  it("keeps TikTok campaigns deselected until the user selects them", () => {
    const source = readCampaignsPage();

    expect(source).toContain('const [tiktokSelectedCampaignIds, setTikTokSelectedCampaignIds] = useState("");');
    expect(source).toContain('setTikTokSelectedCampaignIds("");');
    expect(source).toContain("Select all");
    expect(source).toContain("updateTikTokCampaignSelection");
  });

  it("exposes TikTok in Connected Platforms only through the add-source contract", () => {
    const campaignDetail = readCampaignDetailPage();

    expect(campaignDetail).toContain("connectTikTokTestMode");
    expect(campaignDetail).toContain('apiRequest("POST", `/api/tiktok/${campaignId}/connect-test`');
    expect(campaignDetail).toContain('platform: "TikTok Ads"');
    expect(campaignDetail).toContain("platformStatusMap.get(\"tiktok\")?.analyticsPath");
    expect(campaignDetail).toContain('url = `/api/tiktok/${campaignId}/connection`');
  });

  it("reads TikTok analytics from selected persisted rows only", () => {
    const routes = readRoutes();
    const app = readApp();
    const page = readTikTokAnalyticsPage();
    const dailyRouteStart = routes.indexOf('app.get("/api/tiktok/:campaignId/daily-metrics"');
    const instagramStart = routes.indexOf('app.get("/api/instagram/:campaignId/overview-summary"', dailyRouteStart);
    const dailyRoute = routes.slice(dailyRouteStart, instagramStart);

    expect(routes).toContain('app.get("/api/tiktok/:campaignId/daily-metrics"');
    expect(routes).toContain("ensureCampaignAccess(req as any, res as any, parsedId.data)");
    expect(routes).toContain("storage.getTikTokConnection(parsedId.data)");
    expect(routes).toContain("storage.getTikTokDailyMetrics(parsedId.data, startDate, endDate)");
    expect(routes).toContain("selected.has(String(row.tiktokCampaignId))");
    expect(dailyRoute).not.toContain("upsertTikTokDailyMetrics");
    expect(app).toContain('const TikTokAnalytics = lazy(() => import("@/pages/tiktok-analytics"))');
    expect(app).toContain('<Route path="/campaigns/:id/tiktok-analytics" component={TikTokAnalytics} />');
    expect(page).toContain("TikTok Ads Analytics");
    expect(page).toContain("Revenue / ROI / ROAS");
    expect(page).toContain("Requires TikTok-scoped attributed revenue.");
    expect(page).toContain("No persisted TikTok metric rows exist");
  });

  it("allows explicit test-mode TikTok refresh without hidden analytics seeding", () => {
    const routes = readRoutes();
    const page = readTikTokAnalyticsPage();

    expect(routes).toContain('app.post("/api/tiktok/:campaignId/refresh-test"');
    expect(routes).toContain('String((connection as any).method || "") !== "test_mode"');
    expect(routes).toContain("storage.upsertTikTokDailyMetrics(rows as any)");
    expect(routes).toContain("isSimulated: true");
    expect(routes).toContain('metricAvailability: { revenue: "unavailable_until_tiktok_scoped_attributed_revenue_exists" }');
    expect(page).toContain("Refresh test metrics");
    expect(page).toContain("refreshTestMetrics.mutate()");
  });
});
