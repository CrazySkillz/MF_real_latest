import { build } from "esbuild";
import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";

// Actual page and query cache; synthetic HTTP boundaries only, no live provider or account.
describe("Spend source amounts stay with the published Total Spend", () => {
  it.each([false, true])("retains edits/deletions, handles failed reads, and publishes without a page reload (legacy=%s)", async legacy => {
    const result = await build({
      stdin: { contents: `import React from 'react';import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query';import {TooltipProvider} from './client/src/components/ui/tooltip';
        import {createAppQueryClient} from './client/src/lib/queryClient';import Page from './client/src/pages/ga4-metrics';
        const client=createAppQueryClient();window.fixtureRefetch=()=>client.invalidateQueries();window.fixtureFetching=()=>client.isFetching();
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><TooltipProvider><Page/></TooltipProvider></QueryClientProvider>);`,
        loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
      plugins: [{ name: "isolate-account-and-setup", setup(builder) {
        builder.onResolve({ filter: /^@\/(components\/layout\/(navigation|sidebar)|lib\/clientContext|components\/(GA4ConnectionFlow|AddSpendWizardModal|AddRevenueWizardModal))$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("clientContext")
          ? "export const useClient=()=>({clients:[]});" : args.path.includes("layout/") ? "export default function Stub(){return null}"
          : args.path.endsWith("AddSpendWizardModal") ? "export function AddSpendWizardModal(props){window.fixtureSpendSaved=props.onProcessed;return null}"
          : `export function ${args.path.split("/").at(-1)}(){return null}`, loader: "js" }));
      } }],
    });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 1050 }, serviceWorkers: "block" });
    const page = await context.newPage(); const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const day = "2026-10-17", property = { propertyId: "123", propertyName: "Fixture", isPrimary: true, lookbackDays: 30 };
    let saved: number | null = 20, published: number | null = 20, generation = 1, failed = false, statusReads = 0;
    const row = (amount: number) => ({ sourceId: "spend-a", sourceType: "csv", displayName: "Fixture.csv", spend: amount,
      currency: "EUR", mappingConfig: { dateColumn: "Date", spendColumn: "Cost" } });
    const totals = { sessions: 10, users: 10, conversions: 2, revenue: 100, engagedSessions: 8, engagementRate: 0.8, pageviews: 20 };
    const updatedAt = () => `2026-10-18T12:0${generation}:00.000Z`;
    await page.clock.install({ time: new Date("2026-10-18T12:20:00Z") });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "spend-fixture.test" || request.method() !== "GET") { errors.push(`Unexpected request: ${request.method()} ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: result.outputFiles[0].text }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      let data: any = { success: true }, status = 200;
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Synthetic Spend", status: "active", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["search"]', createdAt: "2026-09-04T00:00:00Z" };
      else if (url.pathname.includes("check-connection") || url.pathname.endsWith("/ga4-connections")) data = { success: true, connected: true, connections: [property] };
      else if (url.searchParams.has("statusOnly")) { statusReads++; data = { success: true, campaignId: "a", propertyId: "123", publicationToken: `p${generation}`, refreshStatus: saved === published ? "current" : "running", nextCheckAt: saved === published ? "2026-10-19T06:00:00Z" : "2026-10-18T12:21:00Z" }; }
      else if (url.pathname.endsWith("/ga4-daily")) data = { success: true, propertyId: "123", startDate: "2026-09-04", overviewStartDate: "2026-09-04", endDate: day, dataThroughDate: day, latestStoredDailyDate: day, historyDataThroughDate: day, reportingTimeZone: "Europe/Amsterdam", lastUpdated: updatedAt(), overviewTotals: totals, data: [{ date: day, ...totals }] };
      else if (url.pathname.endsWith("/financial-daily-snapshot")) data = { success: true, snapshot: { campaignId: "a", reportingDate: day, recordedAt: updatedAt(), metrics: {
        ...(legacy ? {} : { revenuePublication: { version: 1, reportingDate: day, sources: {}, display: { nativeRevenue: 100, sources: [], spendSources: published === null ? [] : [row(published)] } } }),
        financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-09-04", endDate: day, reportingTimeZone: "Europe/Amsterdam" },
          inputs: { revenue: { available: true, value: 100 }, spend: { available: published !== null, value: published }, conversions: { available: true, value: 2 } } },
      } } };
      else if (url.pathname.endsWith("/ga4-to-date")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, currencyCode: "EUR", revenueMetric: "totalRevenue", totals };
      else if (url.pathname.endsWith("/ga4-breakdown")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, totals, rows: [{ campaign: "search", campaignName: "search", ...totals }], meta: { currencyCode: "EUR" } };
      else if (/\/ga4-(conversion-events|landing-pages)$/.test(url.pathname)) data = { success: true, propertyId: "123", rows: [], startDate: "2026-09-04", endDate: day };
      else if (url.pathname.endsWith("/spend-sources")) data = { success: true, completedDayEndDate: day, sources: saved === null ? [] : [{ id: "spend-a", sourceType: "csv", displayName: "Fixture.csv", currency: "EUR", isActive: true, latestTotalSpend: saved, completedDaySpend: saved, mappingConfig: JSON.stringify(row(saved).mappingConfig) }] };
      else if (url.pathname.endsWith("/spend-breakdown")) data = { success: true, endDate: day, sources: saved === null ? [] : [row(saved)] };
      else if (url.pathname.endsWith("/spend-totals")) data = { success: true, endDate: day, spendToDate: saved || 0, totalSpend: saved || 0, sourceIds: saved === null ? [] : ["spend-a"] };
      else if (url.pathname.includes("/platforms/google_analytics/")) data = [];
      else if (url.pathname.includes("revenue")) data = { success: true, sources: [], sourceIds: [], totalRevenue: 0, rows: [], endDate: day };
      if (failed && /\/(spend-sources|spend-breakdown|spend-totals)$/.test(url.pathname)) { status = 503; data = { success: false }; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    try {
      await page.goto("http://spend-fixture.test/campaigns/a/ga4-metrics?tab=overview");
      const card = page.getByText("Total Spend", { exact: true }).locator("../..");
      await browserExpect(card).toContainText("€20.00");
      await card.getByRole("button", { name: "Sources (1)", exact: true }).click();
      const dialog = page.getByRole("dialog");
      await browserExpect(dialog).toContainText("€20.00");
      saved = 40;
      const beforeSave = statusReads;
      await page.evaluate(() => (window as any).fixtureSpendSaved());
      await browserExpect.poll(() => statusReads).toBeGreaterThan(beforeSave);
      await browserExpect(card).toContainText("€20.00");
      await browserExpect(dialog).toContainText("€20.00");
      await browserExpect(dialog).not.toContainText("€40.00");
      published = 40; generation++;
      await page.clock.runFor(5_100);
      await browserExpect(card).toContainText("€40.00");
      await browserExpect(dialog).toContainText("€40.00");
      await browserExpect.poll(() => page.evaluate(() => (window as any).fixtureFetching())).toBe(0);
      const completedReads = statusReads;
      await page.clock.runFor(30_000);
      expect(statusReads).toBe(completedReads);
      failed = true;
      await page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(dialog).toContainText("€40.00");
      failed = false;
      saved = null;
      await page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(card).toContainText("€40.00");
      await browserExpect(dialog).toContainText("€40.00");
      await browserExpect(dialog.getByTitle("Remove spend source")).toBeDisabled();
      published = null; generation++;
      await page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(card).toContainText("Unavailable");
      await browserExpect(dialog).not.toContainText("€40.00");
      saved = 0;
      await page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(card).toContainText("Unavailable");
      await browserExpect(dialog).toContainText("Updating");
      await browserExpect(dialog).not.toContainText("€0.00");
      published = 0; generation++;
      await page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(card).toContainText("€0.00");
      await browserExpect(dialog).toContainText("€0.00");
      await browserExpect(dialog).not.toContainText("Updating");
      expect(errors).toEqual([]);
    } finally { await context.close(); await browser.close(); }
  }, 120_000);
});
