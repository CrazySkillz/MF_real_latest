import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("campaign Custom Report regression guard", () => {
  it("preserves campaign context from the Campaign DeepDive launcher", () => {
    const campaignDetail = readFileSync(join(process.cwd(), "client/src/pages/campaign-detail.tsx"), "utf-8");

    expect(campaignDetail).toContain('<Link href={`/reports?campaignId=${encodeURIComponent(campaign.id)}`}>');
  });

  it("initializes and persists campaign context without changing the global reports route", () => {
    const reports = readFileSync(join(process.cwd(), "client/src/pages/reports.tsx"), "utf-8");
    const app = readFileSync(join(process.cwd(), "client/src/App.tsx"), "utf-8");

    expect(app).toContain('<Route path="/reports" component={Reports} />');
    expect(reports).toContain('new URLSearchParams(window.location.search).get("campaignId") || ""');
    expect(reports).toContain('const [selectedCampaigns, setSelectedCampaigns] = useState<string[]>(() => campaignContextId ? [campaignContextId] : []);');
    expect(reports).toContain('const activeCampaignId = campaignContextId || selectedCampaigns[0] || "";');
    expect(reports).toContain("campaignId: activeCampaignId || undefined,");
  });
});
