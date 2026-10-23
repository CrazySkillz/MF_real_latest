import { build } from "esbuild";
import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";

describe("standalone Sheets selection recovery in the rendered page", () => {
  it("shows selection errors without other-tab values and opens/cancels the existing mapping dialog", async () => {
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
    let valid = false, releaseSecond: (() => void) | undefined;
    const secondResponse = new Promise<void>(resolve => { releaseSecond = resolve; });
    const connections = [{ id: "tab-a", spreadsheetId: "book", sheetName: "Main", spreadsheetName: "Fixture", purpose: "general", isActive: true, isPrimary: true }];
    page.on("pageerror", error => errors.push(error.message));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "sheets-fixture.test") { errors.push(`Blocked external URL ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle.outputFiles[0].text }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      requests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (request.method() !== "GET") { errors.push("Unexpected mutation"); await route.abort(); return; }
      let data: any = { success: true, sources: [], sourceIds: [], totalRevenue: 0, totalSpend: 0 }; let status = 200;
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Fixture campaign", platform: "Google Sheets", status: "active" };
      else if (url.pathname.endsWith("google-sheets-connections")) data = { connections };
      else if (url.pathname.endsWith("google-sheets-data")) {
        if (valid) {
          const second = url.searchParams.get("spreadsheetId") === "book:tab-b";
          if (second) await secondResponse;
          data = { success: true, spreadsheetId: "book", spreadsheetName: "Fixture", sheetName: second ? "Second" : "Main",
            totalRows: 2, filteredRows: 1, headers: ["Campaign Name", "Revenue"], data: [[second ? "Only Beta" : "Only Alpha", "10"]],
            summary: { metrics: { Revenue: 10 }, detectedColumns: [{ name: "Revenue", index: 1, type: "currency", total: 10, summaryValue: 10, count: 1 }], categoricalColumns: [] }, lastUpdated: "2026-10-23T10:00:00Z" };
        } else if (url.searchParams.get("spreadsheetId") === "book:tab-a") {
          status = 400; data = { success: false, code: "GOOGLE_SHEETS_MAPPING_INVALID", error: "Saved Google Sheets selection is invalid or its columns changed. Review the dataset mappings." };
        } else { status = 404; data = { success: false, error: "Selected Google Sheets dataset is no longer connected. Select a connected tab." }; }
      } else if (/\/platforms\/google_sheets\//.test(url.pathname)) data = [];
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    try {
      await page.goto("http://sheets-fixture.test/campaigns/a/google-sheets-data?spreadsheetId=book:tab-a");
      await browserExpect(page.getByText("Failed to Load Data", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Edit Mappings", exact: true }).click();
      await browserExpect(page.getByRole("dialog")).toBeVisible();
      await browserExpect(page.getByText("Fixture mapping for tab-a", { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Cancel mapping", exact: true }).click();
      await browserExpect(page.getByRole("dialog")).toHaveCount(0);
      await page.goto("http://sheets-fixture.test/campaigns/a/google-sheets-data?spreadsheetId=book:removed");
      await browserExpect(page.getByText("Selected Google Sheets dataset is no longer connected. Select a connected tab.", { exact: true })).toBeVisible();
      await browserExpect(page.getByRole("button", { name: "Edit Mappings", exact: true })).toHaveCount(0);
      await browserExpect(page.getByRole("tab", { name: "Summary", exact: true })).toHaveCount(0);
      expect(requests.some(request => request.includes("spreadsheetId=book%3Aremoved"))).toBe(true);
      valid = true;
      connections.push({ ...connections[0], id: "tab-b", sheetName: "Second", isPrimary: false });
      await page.goto("http://sheets-fixture.test/campaigns/a/google-sheets-data?spreadsheetId=book:tab-a");
      await browserExpect(page.getByText("Only Alpha", { exact: true })).toBeVisible();
      await page.getByRole("combobox").first().click();
      await page.getByRole("option", { name: "Second - Fixture", exact: true }).click();
      await browserExpect(page.getByText("Only Alpha", { exact: true })).toHaveCount(0);
      releaseSecond!();
      await browserExpect(page.getByText("Only Beta", { exact: true })).toBeVisible();
      expect(errors).toEqual([]);
    } finally { releaseSecond?.(); await context.close(); await browser.close(); }
  }, 60_000);
});
