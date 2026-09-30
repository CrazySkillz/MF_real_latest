import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("Campaign Overview navigation UI", () => {
  it("keeps the campaign return link with the client context in the sidebar", () => {
    const sidebar = read("client/src/components/layout/sidebar.tsx");
    const page = read("client/src/pages/campaign-detail.tsx");

    expect(sidebar).toContain("Back to All Campaigns");
    expect(sidebar).toContain("{campaignId && (");
    expect(page).not.toContain("Back to All Campaigns");
  });

  it("renders Campaign Overview as a static heading without Webhooks", () => {
    const page = read("client/src/pages/campaign-detail.tsx");

    expect(page).toContain('<h2 className="text-xl font-semibold text-foreground">Campaign Overview</h2>');
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

  it("shows Talk to Your Data as a disabled Campaign Diagnostics option", () => {
    const page = read("client/src/pages/campaign-detail.tsx");
    const optionStart = page.indexOf("data-talk-to-your-data");
    const option = page.slice(optionStart, page.indexOf("</Button>", optionStart));

    expect(optionStart).toBeGreaterThan(-1);
    expect(option).toContain("disabled");
    expect(option).toContain("Talk to Your Data");
    expect(option).toContain("Ask questions using prompts · Coming soon");
  });

  it("uses the campaign wizard Google Analytics icon for the connected platform", () => {
    const page = read("client/src/pages/campaign-detail.tsx");
    const campaigns = read("client/src/pages/campaigns.tsx");

    expect(campaigns).toContain("icon: SiGoogleanalytics");
    expect(page).toContain('return <SiGoogleanalytics className="w-5 h-5 text-orange-500" />;');
  });
});
