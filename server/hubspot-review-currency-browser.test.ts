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
        const savedMapping={campaignProperty:'dealname',selectedValues:['yesop_prospecting'],revenueProperty:'amount',revenueClassification:'offsite_not_in_ga4',pipelineEnabled:true,pipelineStageId:'contractsent',pipelineStageLabel:'Contract Sent',dateField:'closedate',lastTotalRevenue:75,pipelineTotalToDate:3200};
        const initialSource=cfg.edit ? {id:'source-a',sourceType:'hubspot',revenue:75,materializedRevenueStatus:'available',mappingConfig:JSON.stringify(savedMapping)} : undefined;
        function App(){const [open,setOpen]=React.useState(true);return <QueryClientProvider client={createAppQueryClient()}>
          {cfg.direct ? <HubSpotRevenueWizard campaignId="a" currency={cfg.currency} platformContext="ga4" mode={cfg.edit ? "edit" : "connect"} sourceId={cfg.edit ? "source-a" : undefined} initialMappingConfig={cfg.edit ? savedMapping : null}/>
          : <AddRevenueWizardModal open={open} onOpenChange={setOpen} campaignId="a" currency={cfg.currency} dateRange="30days" initialStep="hubspot" initialSource={initialSource}/>}<Toaster/>
        </QueryClientProvider>}
        createRoot(document.getElementById('root')).render(<App/>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
    });
    bundle = result.outputFiles[0].text;
    browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(currency: string, totalRevenue: number, options: { direct?: boolean; failSave?: boolean; edit?: boolean; revenueOnly?: boolean; connected?: boolean;
    previews?: Array<{ status?: number; data?: any; raw?: string; abort?: boolean; wait?: Promise<void> }> } = {}) {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, locale: "en-US", serviceWorkers: "block" });
    const page = await context.newPage();
    page.setDefaultTimeout(8000);
    const errors: string[] = [], posts: any[] = [], completedPreviews: any[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname !== "hubspot-currency-fixture.test") { errors.push(`Blocked host: ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (url.pathname === "/") {
        await route.fulfill({ contentType: "text/html", body: `<html><body><div id="root"></div><script>window.fixture=${JSON.stringify({ currency, direct: options.direct, edit: options.edit })}</script><script src="/fixture.js"></script></body></html>` }); return;
      }
      let data: any; let status = 200;
      if (req.method() === "POST" && url.pathname === "/api/campaigns/a/hubspot/save-mappings") {
        const body = req.postDataJSON(); posts.push(body);
        const preview = body.previewOnly ? options.previews?.[posts.filter(item => item.previewOnly).length - 1] : undefined;
        if (preview?.wait) await preview.wait;
        if (preview?.abort) { await route.abort("failed"); return; }
        if (preview?.raw !== undefined) { await route.fulfill({ status: preview.status || 200, contentType: "application/json", body: preview.raw }); return; }
        if (preview?.data !== undefined) { status = preview.status || 200; data = preview.data; }
        else if (!body.previewOnly && options.failSave) { status = 400; data = { error: "Currency mismatch: fixture rejected" }; }
        else data = { success: true, previewOnly: body.previewOnly === true, totalRevenue, currency, pipelinePreviewTotal: 3200,
          dealBreakdown: totalRevenue ? [{ id: "won-1", name: "Fixture won deal", campaignValue: "yesop_prospecting", amount: totalRevenue, date: "2026-10-22" }] : [], dealBreakdownTotal: totalRevenue ? 1 : 0 };
      } else if (req.method() !== "GET") { errors.push(`Unmodelled mutation: ${req.method()} ${url.pathname}`); await route.abort(); return; }
      else if (url.pathname === "/api/hubspot/a/status") data = { connected: options.connected !== false, portalId: "fixture", portalName: "Isolated fixture" };
      else if (/^\/api\/(salesforce|shopify)\/a\/status$/.test(url.pathname)) data = { connected: false };
      else if (url.pathname === "/api/campaigns/a/all-data-sources") data = { sources: [] };
      else if (url.pathname === "/api/campaigns/a/google-sheets-connections") data = { connections: [] };
      else if (url.pathname === "/api/campaigns/a/ga4-campaign-values") data = { campaigns: [{ id: "yesop_prospecting", name: "yesop_prospecting" }] };
      else if (url.pathname === "/api/hubspot/a/deals/properties") data = { properties: [{ name: "dealname", label: "Deal Name", type: "string", fieldType: "text" }, { name: "amount", label: "Amount", type: "number", fieldType: "number" }] };
      else if (url.pathname === "/api/hubspot/a/deals/pipelines") data = { pipelines: [{ id: "sales", label: "B2B SaaS", stages: [{ id: "contractsent", label: "Contract Sent" }] }] };
      else if (url.pathname === "/api/hubspot/a/deals/unique-values") data = { values: [{ value: "yesop_prospecting", count: 2 }] };
      else { errors.push(`Unmodelled API: ${url.pathname}`); status = 501; data = {}; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
      if (req.method() === "POST" && req.postDataJSON()?.previewOnly) completedPreviews.push(req.postDataJSON());
    });
    await page.goto("http://hubspot-currency-fixture.test/");
    const next = page.getByRole("button", { name: "Continue", exact: true });
    if (options.revenueOnly) await page.getByRole("radio", { name: /^Total Revenue only/ }).check();
    await next.click();
    if (!options.edit) {
      await page.getByRole("combobox").click();
      await page.getByRole("option", { name: "Deal Name (dealname)", exact: true }).click();
    }
    await next.click();
    if (!options.revenueOnly) {
      if (!options.edit) {
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: /B2B SaaS.*Contract Sent/ }).click();
      }
      await next.click();
    }
    await page.getByRole("checkbox").check();
    await next.click();
    await next.click();
    await browserExpect(page.getByText("Review Settings", { exact: true })).toBeVisible();
    if (options.connected !== false) await expect.poll(() => posts.some(body => body.previewOnly)).toBe(true);
    return { page, posts, completedPreviews, errors, close: async () => { await context.close(); expect(errors, JSON.stringify(errors)).toEqual([]); } };
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

  it("shows a failed preview and retries without saving until the preview succeeds", async () => {
    const f = await fixture("EUR", 0, { direct: true, previews: [{ status: 422, data: { error: "HubSpot currency could not be verified." } }] });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("HubSpot currency could not be verified.");
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeDisabled();
      expect(f.posts.every(body => body.previewOnly === true)).toBe(true);
      await f.page.getByRole("button", { name: "Retry preview", exact: true }).click();
      await browserExpect(f.page.getByRole("alert")).toHaveCount(0);
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€0.00");
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeEnabled();
      expect(f.posts).toHaveLength(2);
      expect(f.posts[1]).toEqual(f.posts[0]);
      await f.page.getByRole("button", { name: "Import revenue", exact: true }).click();
      await browserExpect(f.page.getByText("Revenue connected: €0.00.", { exact: true })).toBeVisible();
      expect(f.posts.filter(body => !body.previewOnly)).toHaveLength(1);
    } finally { await f.close(); }
  }, 30_000);

  it("blocks import while the current preview is pending", async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const f = await fixture("EUR", 125.75, { previews: [{ wait }] });
    try {
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeDisabled();
      expect(f.posts.every(body => body.previewOnly === true)).toBe(true);
      release();
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeEnabled();
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€125.75");
    } finally { release(); await f.close(); }
  }, 30_000);

  it.each([
    { name: "signed out", status: 401, data: { error: "Sign in to continue." } },
    { name: "forbidden", status: 403, data: { error: "HubSpot access denied." } },
    { name: "rate limited", status: 429, data: { error: "Too many requests. Please retry later." } },
    { name: "provider failure", status: 502, data: { error: "HubSpot could not complete the request." } },
    { name: "network failure", abort: true },
    { name: "invalid JSON", raw: "not-json" },
    { name: "missing totals", data: { success: true, previewOnly: true } },
    { name: "missing proxy", data: { success: true, previewOnly: true, totalRevenue: 0 } },
    { name: "disguised total", data: { success: true, previewOnly: true, totalRevenue: "125oops", pipelinePreviewTotal: 3200 } },
  ])("keeps $name unavailable and prevents import", async preview => {
    const f = await fixture("EUR", 125.75, { previews: [preview] });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("Could not load the HubSpot revenue preview.");
      if (preview.status) await browserExpect(f.page.getByRole("alert")).toContainText(preview.data!.error!);
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeDisabled();
      await browserExpect(f.page.getByRole("button", { name: "Retry preview", exact: true })).toBeVisible();
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).not.toContainText("€0.00");
      expect(f.posts).toHaveLength(1);
      expect(f.posts[0].previewOnly).toBe(true);
    } finally { await f.close(); }
  }, 30_000);

  it("keeps saved edit amounts visible, identifies them as saved, and preserves the no-change guard after retry", async () => {
    const f = await fixture("EUR", 75, { edit: true, previews: [{ status: 503, data: { error: "HubSpot temporarily unavailable." } }] });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("Any saved amounts shown are from the previous import.");
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€75.00");
      await browserExpect(f.page.getByText("Pipeline proxy", { exact: true }).locator("..")).toContainText("€3,200.00");
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeDisabled();
      await f.page.getByRole("button", { name: "Retry preview", exact: true }).click();
      await browserExpect(f.page.getByRole("alert")).toHaveCount(0);
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeDisabled();
      expect(f.posts).toHaveLength(2);
      expect(f.posts.every(body => body.previewOnly)).toBe(true);
    } finally { await f.close(); }
  }, 30_000);

  it("retries the changed edit mapping and saves only its existing source", async () => {
    const f = await fixture("EUR", 125.75, { direct: true, edit: true, previews: [{ status: 503, data: { error: "First preview failed." } }, { status: 503, data: { error: "Changed preview failed." } }] });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("First preview failed.");
      await f.page.getByRole("button", { name: "Back", exact: true }).last().click();
      await f.page.getByRole("combobox").last().click();
      await f.page.getByRole("option", { name: /^Created Date/ }).click();
      await f.page.getByRole("button", { name: "Continue", exact: true }).click();
      await browserExpect(f.page.getByRole("alert")).toContainText("Changed preview failed.");
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeDisabled();
      await f.page.getByRole("button", { name: "Retry preview", exact: true }).click();
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeEnabled();
      expect(f.posts).toHaveLength(3);
      expect(f.posts[1]).toEqual(f.posts[2]);
      expect(f.posts[2]).toMatchObject({ dateField: "createdate", selectedValues: ["yesop_prospecting"], pipelineStageId: "contractsent" });
      await f.page.getByRole("button", { name: "Update revenue", exact: true }).click();
      await browserExpect(f.page.getByText("Revenue connected: €125.75.", { exact: true })).toBeVisible();
      expect(f.posts.filter(body => !body.previewOnly)).toEqual([expect.objectContaining({ sourceId: "source-a", dateField: "createdate" })]);
    } finally { await f.close(); }
  }, 30_000);

  it("ignores a delayed old preview after Back and a new date selection", async () => {
    let release!: () => void;
    const wait = new Promise<void>(resolve => { release = resolve; });
    const f = await fixture("EUR", 125.75, { previews: [{ wait, data: { success: true, previewOnly: true, totalRevenue: 999, pipelinePreviewTotal: 999 } }] });
    try {
      await f.page.getByRole("button", { name: "Back", exact: true }).last().click();
      await f.page.getByRole("combobox").last().click();
      await f.page.getByRole("option", { name: /^Created Date/ }).click();
      await f.page.getByRole("button", { name: "Continue", exact: true }).click();
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€125.75");
      // Abort cleanup prevents the old request from reaching the UI; allow its fixture handler to finish.
      release();
      await expect.poll(() => f.completedPreviews.some(body => body.dateField === "closedate")).toBe(true);
      await f.page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€125.75");
      await browserExpect(f.page.getByRole("alert")).toHaveCount(0);
      expect(f.posts).toHaveLength(2);
      expect(f.posts.map(body => body.dateField)).toEqual(["closedate", "createdate"]);
    } finally { release(); await f.close(); }
  }, 30_000);

  it("retries revenue-only previews without requiring a pipeline amount", async () => {
    const f = await fixture("EUR", 0, { revenueOnly: true, previews: [{ status: 503, data: { error: "Try again." } }, { data: { success: true, previewOnly: true, totalRevenue: 0, pipelinePreviewTotal: null, dealBreakdown: [], dealBreakdownTotal: 0 } }] });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("Try again.");
      await f.page.getByRole("button", { name: "Retry preview", exact: true }).click();
      await browserExpect(f.page.getByRole("button", { name: "Import revenue", exact: true })).toBeEnabled();
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€0.00");
      await browserExpect(f.page.getByText("Pipeline proxy", { exact: true })).toHaveCount(0);
      expect(f.posts.every(body => body.previewOnly === true && body.pipelineEnabled === false && body.pipelineStageId === null)).toBe(true);
    } finally { await f.close(); }
  }, 30_000);

  it("preserves disconnected edit settings and requires reconnection before import", async () => {
    const f = await fixture("EUR", 75, { direct: true, edit: true, connected: false });
    try {
      await browserExpect(f.page.getByRole("alert")).toContainText("Go back to check your HubSpot connection and selected fields");
      await browserExpect(f.page.getByText("Total Revenue (to date)", { exact: true }).locator("..")).toContainText("€75.00");
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeDisabled();
      await f.page.getByRole("button", { name: "Retry preview", exact: true }).click();
      await browserExpect(f.page.getByRole("alert")).toBeVisible();
      expect(f.posts).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);

});
