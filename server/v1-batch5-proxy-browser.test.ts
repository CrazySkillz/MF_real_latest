import { build } from "esbuild";
import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";

describe("Batch 5 Pipeline Proxy in the rendered Sheets page", () => {
  it("preserves zero, displays failures, and shows exact current source amounts", async () => {
    const bundle = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
        import {TooltipProvider} from './client/src/components/ui/tooltip'; import Page from './client/src/pages/google-sheets-data';
        const client=new QueryClient({defaultOptions:{queries:{retry:false,queryFn:async({queryKey})=>{
          const response=await fetch(queryKey.join('/')); if(!response.ok)throw new Error('fixture query failed');return response.json();}}}});
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><TooltipProvider><Page/></TooltipProvider></QueryClientProvider>);`,
        loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
      plugins: [{ name: "isolate-unrelated-auth-and-setup", setup(builder) {
        builder.onResolve({ filter: /^@\/components\/(layout\/(navigation|sidebar)|GuidedColumnMapping|ColumnMappingInterface|UploadAdditionalDataModal|AddRevenueWizardModal|AddSpendWizardModal)$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => {
          const name = args.path.split('/').at(-1);
          if (name === "GuidedColumnMapping") return { contents: `import React from 'react';export function GuidedColumnMapping(p){return <div><span>Fixture mapping for {p.connectionId}</span><button onClick={p.onCancel}>Cancel mapping</button></div>}`, loader: "tsx", resolveDir: process.cwd() };
          return { contents: `export default function Empty(){return null} export const ${name}=Empty;`, loader: "js" };
        });
      } }],
    });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ serviceWorkers: "block" });
    const page = await context.newPage(); const errors: string[] = [], requests: string[] = [];
    let state = "zero";
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "sheets-fixture.test" || request.method() !== "GET") { errors.push("Blocked external URL or mutation"); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle.outputFiles[0].text }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      let status = 200, data: any = { success: true, sources: [{ id: "hubspot-source", sourceType: "hubspot", isActive: true, mappingConfig: JSON.stringify({ selectedValues: ["selected"], pipelineEnabled: true, pipelineStageId: "open", pipelineStageLabel: "Open", pipelineTotalToDate: 100, pipelineValueRevenueTotals: [{ campaignValue: "old", revenue: 100 }] }) }], sourceIds: ["hubspot-source"], totalRevenue: 0, totalSpend: 0, currency: "USD" };
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Fixture", currency: "USD", platform: "Google Sheets", status: "active" };
      else if (url.pathname.endsWith("google-sheets-connections")) data = { connections: [{ id: "tab-a", spreadsheetId: "book", sheetName: "Main", spreadsheetName: "Fixture", purpose: "general", isActive: true, isPrimary: true }] };
      else if (url.pathname.endsWith("google-sheets-data")) data = { success: true, spreadsheetId: "book", spreadsheetName: "Fixture", sheetName: "Main", headers: ["Campaign Name", "Revenue"], data: [["selected", 0]], totalRows: 2, filteredRows: 1, summary: { metrics: { Revenue: 0 }, detectedColumns: [], categoricalColumns: [] } };
      else if (url.pathname.endsWith("pipeline-proxy")) {
        if (state === "failed" || url.pathname.includes("salesforce")) { status = 503; data = { success: false }; }
        else data = { success: true, sourceId: "hubspot-source", pipelineEnabled: true, mode: "current_stage", currency: "USD", lastUpdatedAt: "2026-10-23T12:00:00Z", totalToDate: state === "zero" ? 0 : 12.75, pipelineValueRevenueTotals: state === "zero" ? [] : [{ campaignValue: "selected", revenue: 12.75 }] };
      } else if (/\/platforms\/google_sheets\//.test(url.pathname)) data = [];
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    try {
      await page.goto("http://sheets-fixture.test/campaigns/a/google-sheets-data?spreadsheetId=book:tab-a");
      const card = page.getByText("Pipeline Proxy", { exact: true }).locator("../..");
      await browserExpect(card).toContainText("$0.00"); await browserExpect(card).not.toContainText("$100.00");
      state = "positive"; await page.reload(); await browserExpect(card).toContainText("$12.75");
      await card.getByRole("button", { name: "Sources (1)", exact: true }).click();
      await browserExpect(page.getByRole("dialog")).toContainText("$12.75"); await browserExpect(page.getByRole("dialog")).toContainText("Last successful update:");
      state = "failed"; await page.reload(); await browserExpect(card).toContainText("Unavailable"); await browserExpect(card).not.toContainText("$100.00");
      await card.getByRole("button", { name: "Sources (1)", exact: true }).click(); await browserExpect(page.getByRole("dialog")).toContainText("Unavailable");
      expect(errors).toEqual([]);
    } finally { await context.close(); await browser.close(); }
  }, 60_000);
});
