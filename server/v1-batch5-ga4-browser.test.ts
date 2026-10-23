import { build } from "esbuild";
import { chromium, expect as browserExpect, type Browser } from "@playwright/test";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// Actual GA4 page/query client, synthetic HTTP boundaries, no live accounts or writes.
describe("Batch 5 GA4 Revenue and Pipeline Proxy browser acceptance", () => {
  let bundle: string; let browser: Browser;
  beforeAll(async () => {
    const result = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query'; import {TooltipProvider} from './client/src/components/ui/tooltip';
        import {createAppQueryClient} from './client/src/lib/queryClient'; import Page from './client/src/pages/ga4-metrics';
        const client=createAppQueryClient(); window.fixtureRefetch=()=>client.invalidateQueries();
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><TooltipProvider><Page/></TooltipProvider></QueryClientProvider>);`, loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
      plugins: [{ name: "isolate-unrelated-auth-and-setup", setup(builder) {
        builder.onResolve({ filter: /^@\/(components\/layout\/(navigation|sidebar)|lib\/clientContext|components\/(GA4ConnectionFlow|AddSpendWizardModal|AddRevenueWizardModal))$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("clientContext")
          ? "export const useClient=()=>({clients:[]});" : args.path.includes("layout/") ? "export default function Stub(){return null}"
          : `export function ${args.path.split('/').at(-1)}(){return null}`, loader: "js" }));
      } }],
    });
    bundle = result.outputFiles[0].text; browser = await chromium.launch({ headless: true });
  }, 60_000);
  afterAll(async () => { await browser?.close(); });

  async function fixture(options: { state?: string; providers?: string[] } = {}) {
    let state = options.state ?? "positive"; let providers = options.providers ?? ["hubspot", "salesforce", "shopify"];
    const context = await browser.newContext({ viewport: { width: 1400, height: 1000 }, serviceWorkers: "block", timezoneId: "Europe/Amsterdam", locale: "en-US" });
    const page = await context.newPage(); const errors: string[] = [], requests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.clock.install({ time: new Date("2026-10-23T18:00:00Z") });
    const confirmed: Record<string, number> = { hubspot: 25, salesforce: 30, shopify: 45 };
    const updatedAt = "2026-10-23T12:10:00Z", day = "2026-10-22";
    const totals = { sessions: 100, users: 90, conversions: 2.75, revenue: 100, engagedSessions: 70, engagementRate: 0.7, pageviews: 120 };
    const selected = "fixture-selected";
    const sources = () => providers.map(provider => ({ id: `${provider}-source`, sourceType: provider, platformContext: "ga4", isActive: true,
      displayName: provider === "hubspot" ? "HubSpot" : provider === "salesforce" ? "Salesforce" : "Shopify", currency: "EUR", lastTotalRevenue: confirmed[provider], completedDayRevenue: confirmed[provider], materializedRevenueStatus: "available",
      mappingConfig: JSON.stringify({ selectedValues: [selected], campaignProperty: "campaign", campaignField: "Campaign__c", pipelineEnabled: provider !== "shopify", pipelineStageId: "open", pipelineStageName: "Open", pipelineStageLabel: "Open",
        pipelineTotalToDate: 999, pipelineCurrency: "EUR", pipelineValueRevenueTotals: [{ campaignValue: "old-cache", revenue: 999 }], campaignValueRevenueTotals: [{ campaignValue: selected, revenue: confirmed[provider] }] }) }));
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "batch5-ga4-fixture.test" || request.method() !== "GET") { errors.push(`Blocked host or mutation: ${request.method()} ${url.hostname}${url.pathname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      requests.push(url.pathname + url.search);
      const property = { propertyId: "123", propertyName: "Synthetic fixture", isPrimary: true, lookbackDays: 30 };
      const imported = providers.reduce((sum, provider) => sum + confirmed[provider], 0);
      let data: any; let status = 200;
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Isolated Batch 5 fixture", currency: "EUR", status: "active", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: JSON.stringify([selected]), createdAt: "2026-09-04T00:00:00Z" };
      else if (url.pathname.startsWith("/api/ga4/check-connection/") || url.pathname.endsWith("/ga4-connections")) data = { success: true, connected: true, connections: [property] };
      else if (url.searchParams.has("statusOnly")) data = { success: true, campaignId: "a", propertyId: "123", publicationToken: "fixture-publication", refreshStatus: "current" };
      else if (url.pathname.endsWith("/ga4-daily")) data = { success: true, propertyId: "123", startDate: "2026-09-04", overviewStartDate: "2026-09-04", endDate: day, dataThroughDate: day, latestStoredDailyDate: day, historyDataThroughDate: day, reportingTimeZone: "Europe/Amsterdam", lastUpdated: updatedAt, lastCompletedRefreshAt: updatedAt, refreshStatus: "current", refreshIsStale: false, overviewTotals: totals, data: [{ date: day, ...totals }], refreshScheduleHours: [8,14,20], refreshScheduleMinute: 0, refreshScheduleTimeZone: "Europe/Amsterdam" };
      else if (url.pathname.endsWith("/financial-daily-snapshot")) data = { success: true, snapshot: { campaignId: "a", reportingDate: day, recordedAt: updatedAt, metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-09-04", endDate: day, reportingTimeZone: "Europe/Amsterdam" }, inputs: { revenue: { available: true, value: 100 + imported }, spend: { available: false }, conversions: { available: true, value: 2.75 } } } } } };
      else if (url.pathname.endsWith("/ga4-breakdown")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, lastUpdated: updatedAt, totals, rows: [{ campaign: selected, campaignName: selected, ...totals }], revenueWindow: { source: "ga4", startDate: "2026-09-04", endDate: day }, meta: { currencyCode: "EUR" } };
      else if (url.pathname.endsWith("/ga4-to-date")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, currencyCode: "EUR", revenueMetric: "totalRevenue", totals };
      else if (/\/ga4-(conversion-events|landing-pages)$/.test(url.pathname)) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, lastUpdated: updatedAt, rows: [] };
      else if (url.pathname === "/api/industry-benchmarks") data = { industries: [] };
      else if (/\/ga4-(diagnostics|geographic)$/.test(url.pathname)) data = { success: true, propertyId: "123", rows: [] };
      else if (url.pathname.includes("/platforms/google_analytics/")) data = [];
      else if (url.pathname.endsWith("/revenue-sources")) data = { success: true, sources: sources(), completedDayEndDate: day };
      else if (url.pathname.endsWith("/revenue-breakdown")) data = { success: true, sources: sources().map(s => ({ sourceId: s.id, sourceType: s.sourceType, displayName: s.displayName, revenue: s.lastTotalRevenue })), endDate: day };
      else if (url.pathname.endsWith("/revenue-to-date")) data = { success: true, totalRevenue: imported, sourceIds: sources().map(s => s.id), endDate: day, currency: "EUR" };
      else if (url.pathname.endsWith("/pipeline-proxy")) {
        const provider = url.pathname.split('/')[2]; const amount = state === "zero" ? 0 : provider === "hubspot" ? 12.75 : 7.25;
        if (provider === "salesforce" && state === "failed") { status = 503; data = { success: false, error: "Isolated provider failure" }; }
        else data = { success: true, sourceId: state === "wrong-source" && provider === "salesforce" ? "other-source" : `${provider}-source`, pipelineEnabled: true, mode: "current_stage", pipelineStageLabel: "Open", currency: state === "wrong-currency" && provider === "salesforce" ? "USD" : "EUR", lastUpdatedAt: state === "missing-time" && provider === "salesforce" ? null : updatedAt, totalToDate: amount,
          pipelineValueRevenueTotals: amount === 0 ? [] : [{ campaignValue: selected, revenue: state === "incomplete-items" && provider === "salesforce" ? 1 : amount }] };
      } else if (url.pathname.includes("spend") || url.pathname.endsWith("/revenue-daily")) data = { success: true, sources: [], sourceIds: [], totalSpend: 0, spendToDate: 0, rows: [], endDate: day };
      else { errors.push(`Unmodelled API: ${url.pathname}${url.search}`); status = 501; data = { success: false }; }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto("http://batch5-ga4-fixture.test/campaigns/a/ga4-metrics");
    const revenue = page.getByText("Total Revenue", { exact: true }).locator("../..");
    const pipeline = page.getByText("Expected Revenue", { exact: true }).locator("../..");
    return { page, revenue, pipeline, requests, errors, setState: (value: string) => { state = value; }, setProviders: (value: string[]) => { providers = value; }, close: async () => { await context.close(); expect(errors, JSON.stringify(errors)).toEqual([]); } };
  }

  it("renders provider revenue/itemization and keeps pipeline separate", async () => {
    const f = await fixture();
    try {
      await browserExpect(f.revenue).toContainText("€200.00"); await browserExpect(f.pipeline).toContainText("€20.00");
      await f.revenue.getByRole("button", { name: "Sources (4)", exact: true }).click();
      const dialog = f.page.getByRole("dialog"); await browserExpect(dialog).toContainText("Revenue Sources");
      for (const amount of ["€100.00", "€25.00", "€30.00", "€45.00"]) await browserExpect(dialog).toContainText(amount);
      for (const provider of ["HubSpot", "Salesforce", "Shopify"]) await browserExpect(dialog).toContainText(provider);
      await browserExpect(dialog).not.toContainText("€999.00"); await browserExpect(dialog).not.toContainText("€20.00");
      await f.page.keyboard.press("Escape"); await f.pipeline.getByRole("button", { name: "Sources (2)", exact: true }).click();
      await browserExpect(dialog).toContainText("€12.75"); await browserExpect(dialog).toContainText("€7.25");
      await browserExpect(dialog).toContainText("Last successful update:"); await browserExpect(dialog).toContainText("fixture-selected"); await browserExpect(dialog).not.toContainText("old-cache");
    } finally { await f.close(); }
  }, 30_000);
  it("shows current zero without resurrecting saved mapping amounts", async () => {
    const f = await fixture({ state: "zero" });
    try { await browserExpect(f.pipeline).toContainText("€0.00"); await browserExpect(f.pipeline).not.toContainText("€999.00"); await browserExpect(f.pipeline.getByRole("button", { name: /^Sources/ })).toHaveCount(0); await browserExpect(f.revenue).toContainText("€200.00"); } finally { await f.close(); }
  }, 30_000);
  it.each(["failed", "wrong-source", "wrong-currency", "missing-time", "incomplete-items"])("withholds the combined proxy for %s", async state => {
    const f = await fixture({ state });
    try { await browserExpect(f.pipeline).toContainText("Unavailable"); await browserExpect(f.pipeline).not.toContainText("€12.75"); await browserExpect(f.pipeline).not.toContainText("€999.00"); await browserExpect(f.revenue).toContainText("€200.00"); } finally { await f.close(); }
  }, 30_000);
  it("withholds cached proxy after failure and recovers on a successful refetch", async () => {
    const f = await fixture();
    try {
      await browserExpect(f.pipeline).toContainText("€20.00"); f.setState("failed"); await f.page.evaluate(() => (window as any).fixtureRefetch());
      await browserExpect(f.pipeline).toContainText("Unavailable"); await browserExpect(f.revenue).toContainText("€200.00");
      f.setState("positive"); await f.page.evaluate(() => (window as any).fixtureRefetch()); await browserExpect(f.pipeline).toContainText("€20.00");
    } finally { await f.close(); }
  }, 30_000);
  it("does not configure CRM proxy or request CRM APIs for Shopify-only revenue", async () => {
    const f = await fixture({ providers: ["shopify"] });
    try { await browserExpect(f.revenue).toContainText("€145.00"); await browserExpect(f.pipeline).toContainText("Not configured"); expect(f.requests.some(path => path.includes("pipeline-proxy"))).toBe(false); } finally { await f.close(); }
  }, 30_000);
  it("removes disconnected CRM configuration without reusing cached endpoint amounts", async () => {
    const f = await fixture();
    try { await browserExpect(f.pipeline).toContainText("€20.00"); f.setProviders(["shopify"]); await f.page.evaluate(() => (window as any).fixtureRefetch()); await browserExpect(f.pipeline).toContainText("Not configured"); await browserExpect(f.revenue).toContainText("€145.00"); } finally { await f.close(); }
  }, 30_000);
});
