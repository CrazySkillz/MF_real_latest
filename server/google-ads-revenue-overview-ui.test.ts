import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

const readSource = (...parts: string[]) => readFileSync(join(process.cwd(), ...parts), "utf-8");

describe("Google Ads revenue Overview UI", () => {
  it("uses the shared revenue wizard and Google Ads-scoped revenue endpoints", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain('import { AddRevenueWizardModal } from "@/components/AddRevenueWizardModal";');
    expect(page).toContain('import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";');
    expect(page).toContain('revenue-sources?platformContext=google_ads');
    expect(page).toContain('revenue-totals?platformContext=google_ads&dateRange=90days');
    expect(page).toContain('google-ads-campaign-revenue?dateRange=90days');
    expect(page).toContain('await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "revenue-sources", "google_ads"], exact: true });');
    expect(page).toContain('await queryClient.refetchQueries({ queryKey: ["/api/campaigns", campaignId, "google-ads-campaign-revenue", "90days"], exact: true });');
    expect(page).toContain('await queryClient.refetchQueries({ queryKey: [`/api/campaigns/${campaignId}/revenue-totals?platformContext=google_ads&dateRange=90days`], exact: true });');
    expect(page).toContain('platformContext="google_ads"');
    expect(page).toContain('dateRange="90days"');
  });

  it("shows Total Revenue as imported Google Ads attributed revenue and keeps native conversion value separate", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain('Total Revenue');
    expect(page).toContain('const googleAdsAttributedRevenueFromSources = activeGoogleAdsRevenueSources.reduce');
    expect(page).toContain('sum + Number(source?.lastTotalRevenue || 0)');
    expect(page).toContain('googleAdsAttributedRevenueFromSources > 0');
    expect(page).toContain('hasGoogleAdsAttributedRevenue ? fmtCurrency(googleAdsAttributedRevenue) : "Not connected"');
    expect(page).toContain('Imported Google Ads attributed revenue');
    expect(page).toContain('Attributed revenue / spend');
    expect(page).toContain('Attributed revenue ROI');
    expect(page).toContain('Native Conversion Value & Efficiency');
    expect(page).toContain('Conversion Value ROAS');
    expect(page).toContain('Conversion Value ROI');
    expect(page).not.toContain('GA4-attributed revenue is shown separately where matched.');
  });

  it("joins exact per-campaign imported revenue into Ad Comparison without using GA4 revenue columns", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("const googleAdsCampaignRevenueById = useMemo(() =>");
    expect(page).toContain('const id = String(m.googleCampaignId || "").trim();');
    expect(page).toContain("const attributedRevenue = Number(googleAdsCampaignRevenueById.get(String(c.id || \"\")) || 0);");
    expect(page).toContain("Conv Value ROAS");
    expect(page).toContain("Attr. ROAS");
    expect(page).toContain("c.hasAttributedRevenue ? fmtCurrency(c.attributedRevenue)");
    expect(page).not.toContain(">GA4 Revenue</th>");
    expect(page).not.toContain(">GA4 ROAS</th>");
  });

  it("renders a Google Ads Overview campaign breakdown from existing campaign metrics", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain("const overviewCampaignBreakdown = useMemo(() =>");
    expect(page).toContain("Google Ads metrics aggregated by selected Google Ads campaign");
    expect(page).toContain("overviewCampaignBreakdown.map((c: any, idx: number)");
    expect(page).toContain("<th className=\"text-right font-medium px-2 py-2 w-[100px]\">Impressions</th>");
    expect(page).toContain("<th className=\"text-right font-medium px-2 py-2 w-[110px]\">Conv. Value</th>");
    expect(page).toContain("<th className=\"text-right font-medium px-2 py-2 w-[110px]\">Total Revenue</th>");
    expect(page).toContain("c.hasAttributedRevenue ? fmtCurrency(c.attributedRevenue)");
    expect(page).not.toContain("/api/campaigns/${campaignId}/google-ads-overview-campaign-breakdown");
  });

  it("uses saved explicit Google Ads campaign mappings as a campaign revenue fallback", () => {
    const server = readSource("server", "routes-oauth.ts");
    const start = server.indexOf('app.get("/api/campaigns/:id/google-ads-campaign-revenue"');
    const end = server.indexOf("Campaign Outcome Totals", start);
    const route = server.slice(start, end);

    expect(route).toContain('storage.getRevenueSources(campaignId, "google_ads")');
    expect(route).toContain("materializedSourceCampaignPairs");
    expect(route).toContain("campaignValueRevenueTotals");
    expect(route).toContain("mapping?.googleAdsCampaignId || mapping?.linkedinCampaignUrn");
    expect(route).toContain("activeGoogleAdsCampaignIds.has(googleCampaignId)");
    expect(route).toContain('materializedSourceCampaignPairs.has(`${sourceId}:${googleCampaignId}`)');
  });

  it("exposes source provenance plus edit and delete behavior through the guarded source route", () => {
    const page = readSource("client", "src", "pages", "google-ads-analytics.tsx");

    expect(page).toContain('Sources ({activeGoogleAdsRevenueSources.length})');
    expect(page).toContain('setShowRevenueSourcesDialog(true)');
    expect(page).toContain('Google Ads Revenue Sources');
    expect(page).toContain('Sources contributing to Google Ads Total Revenue.');
    expect(page).toContain('openGoogleAdsRevenueModal(source)');
    expect(page).toContain('setDeletingRevenueSourceId(String(source.id))');
    expect(page).toContain('deleteGoogleAdsRevenueSourceMutation');
    expect(page).toContain('revenue-sources/${encodeURIComponent(sourceId)}');
  });
});
