import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

describe("financial import retries in actual CSV wizards with isolated HTTP", () => {
  let bundle: string, browser: Browser;
  beforeAll(async () => {
    const result = await build({ stdin: { contents: `import React,{useState} from 'react';import {createRoot} from 'react-dom/client';
      import {QueryClient,QueryClientProvider} from '@tanstack/react-query';import {Toaster} from './client/src/components/ui/toaster';
      import {AddRevenueWizardModal} from './client/src/components/AddRevenueWizardModal';
      import {AddSpendWizardModal} from './client/src/components/AddSpendWizardModal';
      function Fixture(){const [open,setOpen]=useState(true);const [client]=useState(()=>new QueryClient());const done=()=>{window.savedCount=(window.savedCount||0)+1;};
      return <QueryClientProvider client={client}><button onClick={()=>setOpen(true)}>New import</button>
      {location.search.includes('revenue')?<AddRevenueWizardModal campaignId="a" platformContext="ga4" currency="EUR" open={open} onOpenChange={setOpen} initialStep="csv" onSuccess={done}/>:
      <AddSpendWizardModal campaignId="a" platformContext="ga4" currency="EUR" open={open} onOpenChange={setOpen} initialStep="csv" onProcessed={done}/>}
      <Toaster/></QueryClientProvider>}createRoot(document.getElementById('root')).render(<Fixture/>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic", define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" } });
    bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => browser?.close());
  it.each(["revenue", "spend"] as const)("retains a %s request after response loss and reload, then permits a distinct new import", async kind => {
    const context = await browser.newContext({ viewport: { width: 1400, height: 1100 }, serviceWorkers: "block" });
    const page = await context.newPage(), errors: string[] = [], requestIds: string[] = [], saved = new Set<string>();
    const column = kind === "revenue" ? "Revenue" : "Spend";
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "financial-import-fixture.test") { errors.push("External request blocked"); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      let json: any = { success: true, sources: [], connections: [] };
      if (url.pathname.endsWith("/csv/preview")) json = { success: true, fileName: "fixture.csv", headers: ["Date", column], sampleRows: [{ Date: "2026-09-30", [column]: "250" }], rowCount: 1 };
      else if (url.pathname.endsWith("/csv/process")) {
        const id = request.headers()["x-import-request-id"];
        requestIds.push(id); const alreadySaved = saved.has(id); saved.add(id);
        if (requestIds.length === 1) { await route.abort("failed"); return; } // Server committed; browser never received confirmation.
        json = alreadySaved ? { success: true, alreadySaved: true, sourceId: id } : { success: true, sourceId: id, totalRevenue: 250, spendToDate: 250, keptRows: 1 };
      } else if (request.method() !== "GET") { errors.push(`Unexpected mutation ${url.pathname}`); await route.abort(); return; }
      await route.fulfill({ json });
    });
    const upload = async () => {
      await page.locator('input[type="file"]').first().setInputFiles({ name: "fixture.csv", mimeType: "text/csv", buffer: Buffer.from(`Date,${column}\n2026-09-30,250`) });
      await page.getByRole("button", { name: "Next", exact: true }).click();
      const submit = page.getByRole("button", { name: kind === "revenue" ? "Import revenue" : "Import spend", exact: true });
      if (kind === "spend") {
        await page.getByRole("combobox").first().click();
        await page.getByRole("option", { name: "Spend", exact: true }).click();
      }
      await browserExpect(submit).toBeEnabled();
      return submit;
    };
    try {
      await page.goto(`https://financial-import-fixture.test/?${kind}`);
      await (await upload()).click();
      await browserExpect.poll(() => requestIds.length).toBe(1);
      await browserExpect(page.getByRole("button", { name: kind === "revenue" ? "Import revenue" : "Import spend", exact: true })).toBeEnabled();
      expect(requestIds[0]).toMatch(/^[a-f0-9-]{36}$/);
      await page.reload();
      await (await upload()).click();
      await browserExpect.poll(() => page.evaluate(() => (window as any).savedCount)).toBe(1);
      expect(requestIds).toEqual([requestIds[0], requestIds[0]]); expect(saved.size).toBe(1);
      await browserExpect(page.getByText("Import already saved", { exact: true })).toBeVisible();
      expect(await page.evaluate(key => sessionStorage.getItem(key), `financial-import-request:a:${kind}:csv`)).toBeNull();
      await page.getByRole("button", { name: "New import", exact: true }).click();
      await (await upload()).click();
      await browserExpect.poll(() => page.evaluate(() => (window as any).savedCount)).toBe(2);
      expect(requestIds[2]).not.toBe(requestIds[0]); expect(saved.size).toBe(2); expect(errors).toEqual([]);
    } finally { await context.close(); }
  }, 40_000);
});
