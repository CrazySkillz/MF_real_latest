import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real source modal and HubSpot wizard; all HTTP responses are isolated fixtures.
describe("HubSpot review currency browser regression", () => {
  let bundle: string;
  let browser: Browser;
  beforeAll(async () => {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query';
        import {createAppQueryClient} from './client/src/lib/queryClient';
        import {AddRevenueWizardModal} from './client/src/components/AddRevenueWizardModal';
        import {HubSpotRevenueWizard} from './client/src/components/HubSpotRevenueWizard';
        import {Toaster} from './client/src/components/ui/toaster';
        const cfg=window.fixture;
        function App(){const [open,setOpen]=React.useState(true);return <QueryClientProvider client={createAppQueryClient()}>
          {cfg.direct ? <HubSpotRevenueWizard campaignId="a" currency={cfg.currency} platformContext="ga4"/>
          : <AddRevenueWizardModal open={open} onOpenChange={setOpen} campaignId="a" currency={cfg.currency} dateRange="30days" initialStep="hubspot"/>}<Toaster/>
        </QueryClientProvider>}
        createRoot(document.getElementById('root')).render(<App/>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
    });
    bundle = result.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(currency: string, totalRevenue: number, options: { direct?: boolean; failSave?: boolean } = {}) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, locale: "en-US", serviceWorkers: "block" });
    const page = await context.newPage();
    const errors: string[] = [], posts: any[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname !== "hubspot-currency-fixture.test") { errors.push(`Blocked host: ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: `<html><body><div id="root"></div><script>window.fixture=${JSON.stringify({ currency, direct: options.direct })}</script><script src="/fixture.js"></script></body></html>` }); return;
      }
      let data: any; let status = 200;
      if (req.method() === "POST" && url.pathname === "/api/campaigns/a/hubspot/save-mappings") {
        const body = req.postDataJSON(); posts.push(body);
        if (!body.previewOnly && options.failSave) { status = 400; data = { error: "Currency mismatch: fixture rejected" }; }
        else data = { success: true, previewOnly: body.previewOnly === true, totalRevenue, currency, pipelinePreviewTotal: 3200,
          dealBreakdown: totalRevenue ? [{ id: "won-1", name: "Fixture won deal", campaignValue: "yesop_prospecting", amount: totalRevenue, date: "2026-10-22" }] : [], dealBreakdownTotal: totalRevenue ? 1 : 0 };
      } else if (req.method() !== "GET") { errors.push(`Unmodelled mutation: ${req.method()} ${url.pathname}`); await route.abort(); return; }
      else if (url.pathname === "/api/hubspot/a/status") data = { connected: true, portalId: "fixture", portalName: "Isolated fixture" };
      else if (/^\/api\/(salesforce|shopify)\/a\/status$/.test(url.pathname)) data = { connected: false };
      else if (url.pathname === "/api/campaigns/a/all-data-sources") data = { sources: [] };
      else if (url.pathname === "/api/campaigns/a/google-sheets-connections") data = { connections: [] };
      else if (url.pathname === "/api/campaigns/a/ga4-campaign-values") data = { campaigns: [{ id: "yesop_prospecting", name: "yesop_prospecting" }] };
      else if (url.pathname === "/api/hubspot/a/deals/properties") data = { properties: [{ name: "dealname", label: "Deal Name", type: "string", fieldType: "text" }, { name: "amount", label: "Amount", type: "number", fieldType: "number" }] };
      else if (url.pathname === "/api/hubspot/a/deals/pipelines") data = { pipelines: [{ id: "sales", label: "B2B SaaS", stages: [{ id: "contractsent", label: "Contract Sent" }] }] };
      else if (url.pathname === "/api/hubspot/a/deals/unique-values") data = { values: [{ value: "yesop_prospecting", count: 2 }] };
      else { errors.push(`Unmodelled API: ${url.pathname}`); status = 501; data = {}; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto("http://hubspot-currency-fixture.test/");
    const next = page.getByRole("button", { name: "Continue", exact: true });
    await next.click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: "Deal Name (dealname)", exact: true }).click();
    await next.click();
    await page.getByRole("combobox").click();
    await page.getByRole("option", { name: /B2B SaaS.*Contract Sent/ }).click();
    await next.click();
    await page.getByRole("checkbox").check();
    await next.click();
    await next.click();
    await browserExpect(page.getByText("Review Settings", { exact: true })).toBeVisible();
    await expect.poll(() => posts.some(body => body.previewOnly)).toBe(true);
    return { page, posts, errors, close: async () => { await context.close(); expect(errors, JSON.stringify(errors)).toEqual([]); } };
  }

  it.each([
    ["EUR", 0, "€0.00", "€3,200.00"],
    ["EUR", 125.75, "€125.75", "€3,200.00"],
    ["USD", 125.75, "$125.75", "$3,200.00"],
    ["GBP", 125.75, "£125.75", "£3,200.00"],
  ])("uses %s for the actual modal's revenue, pipeline and deal amounts (%s)", async (currency, total, revenueText, pipelineText) => {
    const f = await fixture(String(currency), Number(total));
    try {
      await browserExpect(f.page.getByText(`Currency: ${currency}`, { exact: false })).toBeVisible();
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText(String(revenueText));
      await browserExpect(f.page.getByText("Pipeline proxy", { exact: true }).locator("..")).toContainText(String(pipelineText));
      if (total) await browserExpect(f.page.getByText("Fixture won deal", { exact: true }).locator("../..")).toContainText(String(revenueText));
      expect(f.posts.every(body => body.previewOnly === true)).toBe(true);
      expect(f.posts[0]).toMatchObject({ campaignProperty: "dealname", selectedValues: ["yesop_prospecting"], revenueProperty: "amount", pipelineStageId: "contractsent", dateField: "closedate", platformContext: "ga4" });
    } finally { await f.close(); }
  }, 30_000);

  it("keeps EUR in the save confirmation and completion screen without changing submitted mappings", async () => {
    const f = await fixture("EUR", 125.75, { direct: true });
    try {
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€125.75");
      await f.page.getByRole("button", { name: "Import revenue", exact: true }).click();
      await browserExpect(f.page.getByText("Revenue connected: €125.75.", { exact: true })).toBeVisible();
      await browserExpect(f.page.getByText("Revenue connected:", { exact: false }).filter({ has: f.page.locator("strong") })).toContainText("€125.75");
      const saved = f.posts.find(body => !body.previewOnly);
      expect(saved).toMatchObject({ selectedValues: ["yesop_prospecting"], pipelineStageId: "contractsent", revenueProperty: "amount" });
      expect(saved).not.toHaveProperty("currency");
      expect(saved).not.toHaveProperty("totalRevenue");
    } finally { await f.close(); }
  }, 30_000);

  it("retains the review and shows the existing server rejection when saving fails", async () => {
    const f = await fixture("EUR", 0, { failSave: true });
    try {
      await f.page.getByRole("button", { name: "Import revenue", exact: true }).click();
      await browserExpect(f.page.getByText("Currency mismatch: fixture rejected", { exact: true })).toBeVisible();
      await browserExpect(f.page.getByText("Review Settings", { exact: true })).toBeVisible();
      await browserExpect(f.page.getByText("HubSpot Mappings Saved", { exact: true })).toHaveCount(0);
    } finally { await f.close(); }
  }, 30_000);
});
