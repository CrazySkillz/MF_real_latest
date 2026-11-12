import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser, type Route } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("Shopify edit previews and confirmation in the actual browser component", () => {
  let bundle: string, browser: Browser;
  beforeAll(async () => {
    const result = await build({ stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
      import {ShopifyRevenueWizard} from './client/src/components/ShopifyRevenueWizard';
      import {Toaster} from './client/src/components/ui/toaster';
      createRoot(document.getElementById('root')).render(<QueryClientProvider client={new QueryClient()}>
      <ShopifyRevenueWizard campaignId="a" platformContext="ga4" mode="edit" sourceId="source-a"
        initialMappingConfig={{campaignField:'tags',selectedValues:['A']}} onSuccess={value=>window.saved=value}/><Toaster/></QueryClientProvider>);`,
      loader: "tsx", resolveDir: process.cwd() }, bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" } });
    bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => browser?.close());
  async function fixture(currency = "EUR") {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, locale: "en-US", serviceWorkers: "block" });
    const page = await context.newPage(), pending: Route[] = [], saves: any[] = [], errors: string[] = [];
    page.setDefaultTimeout(8000); page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const req = route.request(), url = new URL(req.url());
      if (url.hostname !== "shopify-edit-fixture.test") { errors.push("External request blocked"); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<div id="root"></div><script src="/fixture.js"></script>' }); return; }
      let json: any = {};
      if (url.pathname.endsWith("/status")) json = { connected: true, oauthAvailable: true, authType: "oauth", shopName: "Fixture", shopDomain: "fixture.myshopify.com" };
      else if (url.pathname.endsWith("/unique-values")) json = { success: true, values: [{ value: "A", count: 1 }, { value: "B", count: 1 }] };
      else if (url.pathname.endsWith("/shopify/save-mappings")) {
        const body = req.postDataJSON();
        if (body.dryRun) { pending.push(route); return; }
        saves.push(body); json = { success: true, currency, totalRevenue: 200 };
      } else if (req.method() !== "GET") { errors.push(`Unexpected mutation ${url.pathname}`); await route.abort(); return; }
      await route.fulfill({ json });
    });
    await page.goto("https://shopify-edit-fixture.test/");
    const next = () => page.getByRole("button", { name: "Continue", exact: true }).click();
    await browserExpect(page.getByText("Fixture", { exact: true })).toBeVisible();
    await next(); await browserExpect(page.getByRole("button", { name: /^A\s/ })).toBeVisible(); await next(); await next();
    await browserExpect.poll(() => pending.length).toBe(1);
    return { page, pending, saves, errors, next, async chooseB() {
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: "Back", exact: true }).click();
      await page.getByRole("button", { name: /^A\s/ }).click(); await page.getByRole("button", { name: /^B\s/ }).click();
      await next(); await next(); await browserExpect.poll(() => pending.length).toBe(2);
    }, async respond(index: number, failed = false) {
      await pending[index].fulfill({ status: failed ? 503 : 200, json: failed ? { error: "Preview unavailable" } : {
        success: true, currency, totalRevenue: index === 0 ? 100 : 200, totalConversions: 1,
        campaignValueRevenueTotals: [{ campaignValue: index === 0 ? "A" : "B", revenue: index === 0 ? 100 : 200 }],
      } });
    }, close: () => context.close() };
  }
  it.each(["EUR", "USD", "GBP"])("retains the newest preview and confirms the saved %s currency", async currency => {
    const f = await fixture(currency);
    try {
      const update = f.page.getByRole("button", { name: "Update revenue", exact: true });
      await browserExpect(update).toBeDisabled(); await f.chooseB(); await f.respond(1);
      const amount = new Intl.NumberFormat("en-US", { style: "currency", currency }).format(200);
      await browserExpect(f.page.getByText(amount, { exact: true }).first()).toBeVisible(); await f.respond(0);
      await browserExpect(update).toBeEnabled();
      // A browser round trip after the older response lets its state update settle.
      await f.page.evaluate(() => new Promise(requestAnimationFrame));
      await browserExpect(f.page.getByText(amount, { exact: true }).first()).toBeVisible();
      await update.click(); await browserExpect.poll(() => f.saves.length).toBe(1);
      expect(f.saves[0]).toMatchObject({ sourceId: "source-a", selectedValues: ["B"], platformContext: "ga4" });
      await browserExpect(f.page.getByText(`Revenue connected: ${amount}.`, { exact: true })).toBeVisible();
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);
  it("does not let an old successful preview clear a newer failure or enable saving", async () => {
    const f = await fixture();
    try {
      await f.chooseB(); await f.respond(1, true);
      await browserExpect(f.page.getByText("Preview unavailable", { exact: false })).toBeVisible(); await f.respond(0);
      await f.page.evaluate(() => new Promise(requestAnimationFrame));
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeDisabled();
      await browserExpect(f.page.getByText("Preview unavailable", { exact: false })).toBeVisible();
      expect(f.saves).toEqual([]); expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);
  it("ignores an older failure after the current preview succeeds", async () => {
    const f = await fixture();
    try {
      await f.chooseB(); await f.respond(1); await f.respond(0, true);
      await f.page.evaluate(() => new Promise(requestAnimationFrame));
      await browserExpect(f.page.getByRole("button", { name: "Update revenue", exact: true })).toBeEnabled();
      await browserExpect(f.page.getByText("€200.00", { exact: true }).first()).toBeVisible(); expect(f.saves).toEqual([]);
      expect(f.errors).toEqual([]);
    } finally { await f.close(); }
  }, 30_000);
});
