import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Campaign Overview navigation UI", () => {
  it("places the active client and campaign context directly below Clients", () => {
    const sidebar = read("client/src/components/layout/sidebar.tsx");
    const page = read("client/src/pages/campaign-detail.tsx");
    const clientsIndex = sidebar.indexOf("<span>Clients</span>");
    const contextIndex = sidebar.indexOf('aria-label="Current client"');
    const notificationsIndex = sidebar.indexOf("<span>Notifications</span>");

    expect(clientsIndex).toBeGreaterThan(-1);
    expect(contextIndex).toBeGreaterThan(clientsIndex);
    expect(notificationsIndex).toBeGreaterThan(contextIndex);
    expect(sidebar).toContain('const clientsNavActive = location === "/" || isCampaignContext;');
    expect(sidebar).toContain('clientsNavActive ? "nav-link-active" : "nav-link-inactive"');
    expect(sidebar).toContain("data-sidebar-current-client");
    expect(sidebar).toContain('campaignId ? "bg-accent text-accent-foreground shadow-sm" : "text-foreground"');
    expect(sidebar).toContain("Back to All Campaigns");
    expect(sidebar).toContain("{campaignId && (");
    expect(page).not.toContain("Back to All Campaigns");
  });

  it("renders Campaign Overview as a static heading without Webhooks", () => {
    const page = read("client/src/pages/campaign-detail.tsx");

    expect(page).toContain('<h2 className="text-2xl font-semibold text-foreground">Campaign Overview</h2>');
    expect(page).toContain('<CardTitle className="flex items-center space-x-2 text-xl">');
    expect(page).not.toContain('<span className="font-medium text-foreground">Client:</span>');
    expect(page).not.toContain('<span className="font-medium text-foreground">Campaign:</span>');
    expect(page).not.toContain("TabsTrigger");
    expect(page).not.toContain("WebhookTester");
    expect(page).not.toContain('value="webhooks"');
  });

  it("uses the Campaign Diagnostics label on user-facing screens", () => {
    const page = read("client/src/pages/campaign-detail.tsx");
    const reports = read("client/src/pages/reports.tsx");

    expect(page).toContain("<span>Campaign Diagnostics</span>");
    expect(reports).toContain("Campaign Diagnostics subsection");
  });

  it("links Talk to Your Data to its campaign-scoped coming-soon page", () => {
    const page = read("client/src/pages/campaign-detail.tsx");
    const app = read("client/src/App.tsx");
    const sidebar = read("client/src/components/layout/sidebar.tsx");
    const talkToYourData = read("client/src/pages/talk-to-your-data.tsx");
    const optionStart = page.indexOf("data-talk-to-your-data");
    const option = page.slice(optionStart, page.indexOf("</Button>", optionStart));

    expect(optionStart).toBeGreaterThan(-1);
    expect(page).toContain('<Link href={`/campaigns/${campaign.id}/talk-to-your-data`}>');
    expect(option).not.toContain("disabled");
    expect(option).toContain("Talk to Your Data");
    expect(option).toContain("Ask questions using prompts · Coming soon");
    expect(app).toContain('<Route path="/campaigns/:id/talk-to-your-data" component={TalkToYourData} />');
    expect(sidebar).toContain("talk-to-your-data");
    expect(talkToYourData).toContain("Chat feature coming soon!");
  });

  it("uses the campaign wizard Google Analytics icon for the connected platform", () => {
    const page = read("client/src/pages/campaign-detail.tsx");
    const campaigns = read("client/src/pages/campaigns.tsx");

    expect(campaigns).toContain("icon: SiGoogleanalytics");
    expect(page).toContain('return <SiGoogleanalytics className="w-5 h-5 text-orange-500" />;');
  });

  it("moves detailed-view campaign context and return navigation into the sidebar", () => {
    const sidebar = read("client/src/components/layout/sidebar.tsx");
    const ga4 = read("client/src/pages/ga4-metrics.tsx");
    const performance = read("client/src/pages/campaign-performance.tsx");
    const reports = read("client/src/pages/reports.tsx");

    expect(sidebar).toContain('(?:ga4-metrics|performance|financial-analysis|trend-analysis|executive-summary|talk-to-your-data)');
    expect(sidebar).toContain('new URLSearchParams(window.location.search).get("campaignId")');
    expect(sidebar).toContain("data-sidebar-campaign-context");
    expect(sidebar).toContain("{campaign.name}");
    expect(sidebar).toContain("Back to Campaign Overview");
    expect(ga4).not.toContain("Back to main Campaign Overview");
    expect(ga4).toContain('<SiGoogleanalytics className="w-8 h-8 text-orange-500" />');
    expect(performance).not.toContain('data-testid="button-back"');
    expect(reports).not.toContain("Back to main Campaign Overview");
    expect(reports).toContain('<h1 className="text-xl font-semibold text-foreground">Reports</h1>');
  });
});
