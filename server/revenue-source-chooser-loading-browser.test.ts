import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Real chooser/toasts; synthetic HTTP only. No app server, database or provider access.
describe("Revenue source chooser background discovery", () => {
  let bundle: string, browser: Browser;
  beforeAll(async () => {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query';
        import {createAppQueryClient} from './client/src/lib/queryClient';
        import {AddRevenueWizardModal} from './client/src/components/AddRevenueWizardModal';
        import {Toaster} from './client/src/components/ui/toaster';
        const client=createAppQueryClient();
        window.open=()=>({closed:false});
        function App(){const [open,setOpen]=React.useState(true); return <QueryClientProvider client={client}>
          <button onClick={()=>setOpen(true)}>Open chooser</button>
          <AddRevenueWizardModal open={open} onOpenChange={setOpen} campaignId="a" currency="EUR" dateRange="30days"/>
          <Toaster/>
        </QueryClientProvider>}
        createRoot(document.getElementById('root')).render(<App/>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": '{"VITE_ENABLE_SALESFORCE_REVENUE_SOURCE":"true"}' },
    });
    bundle = result.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(options: { failed?: boolean; sources?: any[]; connected?: boolean; slowStatus?: boolean } = {}) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(5000);
    const errors: string[] = [], posts: any[] = [];
    let release!: () => void, inventoryRequests = 0;
    const pending = new Promise<void>(resolve => { release = resolve; });
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname !== "revenue-chooser-fixture.test") { errors.push(`Blocked host: ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: '<html><head><style>.invisible{visibility:hidden}.pointer-events-none{pointer-events:none}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return;
      }
      let data: any, status = 200;
      if (req.method() === "POST" && /^\/api\/auth\/(hubspot|salesforce)\/connect$/.test(url.pathname)) {
        posts.push({ path: url.pathname, body: req.postDataJSON() });
        data = { authUrl: "http://revenue-chooser-fixture.test/oauth" };
      } else if (req.method() !== "GET") { errors.push(`Unmodelled mutation: ${req.method()} ${url.pathname}`); await route.abort(); return; }
      else if (url.pathname === "/api/campaigns/a/all-data-sources") {
        inventoryRequests++;
        if (!options.slowStatus) await pending;
        status = options.failed ? 503 : 200;
        data = options.failed ? { success: false } : { success: true, revenueSources: options.sources || [] };
      } else if (/^\/api\/(hubspot|salesforce|shopify)\/a\/status$/.test(url.pathname)) {
        if (options.slowStatus && url.pathname.includes("shopify")) await pending;
        data = { connected: options.connected === true, orgId: options.connected ? "fixture-org" : null,
          orgName: options.connected ? "Fixture organization" : null, oauthAvailable: true };
      } else if (url.pathname === "/api/campaigns/a/google-sheets-connections") data = { connections: [] };
      else if (url.pathname === "/api/campaigns/a/ga4-campaign-values") data = { campaigns: [] };
      else if (url.pathname === "/api/hubspot/a/deals/properties") data = { properties: [] };
      else if (url.pathname === "/api/hubspot/a/deals/pipelines") data = { pipelines: [] };
      else if (url.pathname === "/api/salesforce/a/opportunities/fields") data = { fields: [] };
      else { errors.push(`Unmodelled API: ${url.pathname}`); status = 501; data = {}; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto("http://revenue-chooser-fixture.test/");
    await expect.poll(() => inventoryRequests).toBe(1);
    const card = (provider: string) => page.getByText(`${provider} (${provider === "Shopify" ? "Ecommerce" : "CRM"})`, { exact: false }).locator("../..");
    return { page, card, posts, release, inventoryRequests: () => inventoryRequests,
      close: async () => { release(); await context.close(); expect(errors, JSON.stringify(errors)).toEqual([]); } };
  }

  it.each(["HubSpot", "Salesforce"])("does not report a failure when %s is clicked before source discovery finishes", async provider => {
    const f = await fixture();
    try {
      const card = f.card(provider);
      await card.dispatchEvent("click");
      await browserExpect(f.page.getByText(`${provider} sources unavailable`, { exact: true })).toHaveCount(0);
      await browserExpect(card).toHaveAttribute("aria-disabled", "true");
      await browserExpect(card.getByText("Not connected", { exact: true })).toBeHidden();
      expect(f.posts).toEqual([]);
      f.release();
      await browserExpect(card).toHaveAttribute("aria-disabled", "false");
      await browserExpect(card.getByText("Not connected", { exact: true })).toBeVisible();
      await card.click();
      await expect.poll(() => f.posts.length).toBe(1);
      expect(f.posts[0]).toEqual({ path: `/api/auth/${provider.toLowerCase()}/connect`, body: { campaignId: "a" } });
    } finally { await f.close(); }
  }, 30_000);

  it("waits silently for outstanding connection status and keeps CSV usable", async () => {
    const f = await fixture({ slowStatus: true });
    try {
      for (const provider of ["HubSpot", "Salesforce", "Shopify"]) {
        await browserExpect(f.card(provider)).toHaveAttribute("aria-disabled", "true");
        await f.card(provider).dispatchEvent("click");
      }
      await browserExpect(f.page.getByText(/sources unavailable/)).toHaveCount(0);
      await f.page.getByText("Upload CSV", { exact: true }).click();
      await browserExpect(f.page.getByText("Upload CSV", { exact: true })).toBeVisible();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);

  it.each(["HubSpot", "Salesforce"])("opens an already-authorized %s setup without another OAuth request", async provider => {
    const f = await fixture({ connected: true });
    try {
      f.release();
      await browserExpect(f.card(provider)).toHaveAttribute("aria-disabled", "false");
      await f.card(provider).click();
      await browserExpect(f.page.getByText(`What should ${provider} provide?`, { exact: true })).toBeVisible();
      expect(f.posts).toEqual([]);
      await browserExpect(f.page.getByText(/sources unavailable/)).toHaveCount(0);
    } finally { await f.close(); }
  }, 30_000);

  it("opens Shopify's existing connection form after discovery finishes", async () => {
    const f = await fixture();
    try {
      f.release();
      await browserExpect(f.card("Shopify")).toHaveAttribute("aria-disabled", "false");
      await f.card("Shopify").click();
      await browserExpect(f.page.getByPlaceholder("your-store.myshopify.com")).toBeVisible();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);

  it.each(["HubSpot", "Salesforce"])("preserves %s duplicate-source protection after the delayed response", async provider => {
    const f = await fixture({ connected: true, sources: [{ id: "existing", sourceType: provider.toLowerCase(), platformContext: "ga4", isActive: true }] });
    try {
      f.release();
      await browserExpect(f.card(provider)).toContainText("Already added.");
      await f.card(provider).dispatchEvent("click");
      expect(f.posts).toEqual([]);
      await browserExpect(f.page.getByText("Add revenue source", { exact: true })).toBeVisible();
      await f.page.getByRole("button", { name: "Close", exact: true }).click();
      await f.page.getByRole("button", { name: "Open chooser", exact: true }).click();
      await expect.poll(f.inventoryRequests).toBe(2);
      await browserExpect(f.card(provider)).toContainText("Already added.");
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);

  it.each(["HubSpot", "Salesforce"])("still blocks %s setup after a genuine source-list failure", async provider => {
    const f = await fixture({ failed: true });
    try {
      f.release();
      await browserExpect(f.card(provider)).toHaveAttribute("aria-disabled", "false");
      await f.card(provider).click();
      await browserExpect(f.page.getByText(`${provider} sources unavailable`, { exact: true })).toBeVisible();
      await browserExpect(f.page.getByText("Revenue sources could not be loaded. Close and reopen this dialog to retry.", { exact: true })).toBeVisible();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);
});
