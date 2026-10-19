import { build } from "esbuild";
import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";

describe("GA4 publication in the rendered page", () => {
  it("updates an open page after completion, retains failed data, and pauses hidden polling", async () => {
    const bundle = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider, focusManager} from '@tanstack/react-query';
        import {TooltipProvider} from './client/src/components/ui/tooltip';
        import {queryClient} from './client/src/lib/queryClient'; import Page from './client/src/pages/ga4-metrics';
        window.testFocus = value => focusManager.setFocused(value);
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={queryClient}><TooltipProvider><Page /></TooltipProvider></QueryClientProvider>);`,
        loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
      plugins: [{ name: "isolate-unrelated-auth-and-setup", setup(builder) {
        builder.onResolve({ filter: /^@\/(components\/layout\/(navigation|sidebar)|lib\/clientContext|components\/(GA4ConnectionFlow|AddSpendWizardModal|AddRevenueWizardModal))$/ }, args => ({ path: args.path, namespace: "fixture" }));
        builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ contents: args.path.endsWith("clientContext")
          ? "export const useClient = () => ({clients: []});"
          : args.path.includes("layout/") ? "export default function Stub(){return null}"
          : `export function ${args.path.split("/").at(-1)}(){return null}`, loader: "js" }));
      } }],
    });
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({ viewport: { width: 1400, height: 1050 }, serviceWorkers: "block" });
    const page = await context.newPage();
    const errors: string[] = []; const requests: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    let generation = 1; let failDaily = false; let failStatus = false; let incomplete = false;
    let day = "2026-10-17";
    const updatedAt = () => `${day === "2026-10-17" ? "2026-10-18" : "2026-10-19"}T${generation === 1 ? "06" : "12"}:06:00.000Z`;
    const totals = () => ({ sessions: generation === 1 ? 2977 : 3100, users: generation === 1 ? 2978 : 3101, conversions: generation === 1 ? 262 : 275, revenue: generation === 1 ? 65659.50 : 68000, engagedSessions: 2200, engagementRate: 0.724, pageviews: 4100 });
    let releaseFinancial: (() => void) | undefined;
    let waitFinancial: Promise<void> | undefined;
    await page.clock.install({ time: new Date("2026-10-18T12:20:00Z") });
    await context.route("**/*", async route => {
      const request = route.request(); const url = new URL(request.url());
      if (url.hostname !== "ga4-fixture.test") { errors.push(`Unexpected host: ${url.hostname}`); await route.abort(); return; }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle.outputFiles[0].text }); return; }
      if (!url.pathname.startsWith("/api/")) { await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return; }
      requests.push(`${request.method()} ${url.pathname}${url.search}`);
      if (request.method() !== "GET") { errors.push(`Unexpected mutation: ${request.method()} ${url.pathname}`); await route.abort(); return; }
      let data: any = { success: true }; let status = 200;
      const property = { propertyId: "123", propertyName: "Local fixture", isPrimary: true, lookbackDays: 30 };
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Local GA4", currency: "EUR", status: "active", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: '["search"]', createdAt: "2026-09-04T00:00:00Z" };
      else if (url.pathname.startsWith("/api/ga4/check-connection/") || url.pathname.endsWith("/ga4-connections")) data = { success: true, connected: true, connections: [property] };
      else if (url.searchParams.has("statusOnly")) {
        data = { success: !failStatus, campaignId: "a", propertyId: "123", publicationToken: incomplete ? null : `p${generation}`, refreshStatus: incomplete ? "running" : "current" };
        if (failStatus) status = 503;
      } else if (url.pathname.endsWith("/ga4-daily")) {
        data = { success: !failDaily, propertyId: "123", startDate: "2026-09-18", overviewStartDate: "2026-09-04", endDate: day, dataThroughDate: day, latestStoredDailyDate: day, historyDataThroughDate: day, reportingTimeZone: "Europe/Amsterdam", lastUpdated: updatedAt(), lastCompletedRefreshAt: updatedAt(), refreshStatus: "current", refreshIsStale: false, overviewTotals: totals(), data: [{ date: day, ...totals() }], refreshScheduleHours: [8, 14, 20], refreshScheduleMinute: 0, refreshScheduleTimeZone: "Europe/Amsterdam" };
        if (failDaily) status = 503;
      } else if (url.pathname.endsWith("/financial-daily-snapshot")) {
        if (waitFinancial) await waitFinancial;
        data = { success: true, snapshot: { campaignId: "a", reportingDate: day, recordedAt: updatedAt(), metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: "2026-09-04", endDate: day, reportingTimeZone: "Europe/Amsterdam" }, inputs: { revenue: { available: true, value: totals().revenue }, spend: { available: false }, conversions: { available: true, value: totals().conversions } } } } } };
      } else if (url.pathname.endsWith("/ga4-breakdown")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, lastUpdated: updatedAt(), totals: totals(), rows: [{ campaign: "search", campaignName: "search", ...totals(), sessionKeyEventRate: 0.088 }], revenueWindow: { source: "ga4", startDate: "2026-09-04", endDate: day }, meta: { currencyCode: "EUR" } };
      else if (url.pathname.endsWith("/ga4-to-date")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, currencyCode: "EUR", revenueMetric: "totalRevenue", totals: totals() };
      else if (url.pathname.endsWith("/ga4-conversion-events")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, lastUpdated: updatedAt(), rows: [{ eventName: "purchase", conversions: totals().conversions, eventCount: totals().conversions, users: 250 }] };
      else if (url.pathname.endsWith("/ga4-landing-pages")) data = { success: true, propertyId: "123", startDate: "2026-09-04", endDate: day, lastUpdated: updatedAt(), rows: [] };
      else if (url.pathname.endsWith("/platforms/google_analytics/kpis")) data = [{ id: "k-a", name: "Sessions target", metric: "sessions", currentValue: String(totals().sessions), targetValue: "4000", unit: "number", platform: "google_analytics", campaignId: "a", timeframe: "campaign-to-date", alertsEnabled: false }];
      else if (url.pathname.endsWith("/platforms/google_analytics/benchmarks")) data = [{ id: "b-a", name: "Sessions comparison", metric: "sessions", currentValue: String(totals().sessions), benchmarkValue: "4000", unit: "number", platform: "google_analytics", campaignId: "a", benchmarkType: "custom", alertsEnabled: false }];
      else if (url.pathname.includes("/platforms/google_analytics/")) data = [];
      else if (url.pathname.includes("revenue") || url.pathname.includes("spend")) data = { success: true, sources: [], sourceIds: [], totalRevenue: 0, totalSpend: 0, spendToDate: 0, rows: [], endDate: day };
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    try {
      await page.goto("http://ga4-fixture.test/campaigns/a/ga4-metrics?readOnly=1");
      await browserExpect(page.getByText("2,977", { exact: true }).first()).toBeVisible();
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      const dailyRequests = () => requests.filter(value => value.includes("/ga4-daily?") && !value.includes("statusOnly")).length;
      const initialDailyRequests = dailyRequests();
      await page.clock.runFor(60_000);
      expect(dailyRequests()).toBe(initialDailyRequests);

      // Partial work is observed without loading its candidate metrics.
      incomplete = true; generation = 2;
      await page.clock.runFor(30_000);
      await browserExpect(page.getByTestId("ga4-refresh-status")).toHaveText("GA4 refresh in progress");
      await browserExpect(page.getByText("2,977", { exact: true }).first()).toBeVisible();
      expect(dailyRequests()).toBe(initialDailyRequests);

      incomplete = false; waitFinancial = new Promise(resolve => { releaseFinancial = resolve; });
      await page.clock.runFor(30_000);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("Updating displayed figures");
      await browserExpect(page.getByText("€65,659.50", { exact: true }).first()).toBeVisible();
      releaseFinancial!(); waitFinancial = undefined;
      await browserExpect(page.getByText("3,100", { exact: true }).first()).toBeVisible();
      await browserExpect(page.getByText("€68,000.00", { exact: true }).first()).toBeVisible();
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);

      // Failed metric reads retain data and remain visibly unverified until retry.
      generation = 3; failDaily = true;
      await page.clock.runFor(30_000);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("could not refresh");
      await browserExpect(page.getByText("3,100", { exact: true }).first()).toBeVisible();
      failDaily = false;
      await page.clock.runFor(30_000);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);

      await page.getByRole("tab", { name: "KPIs", exact: true }).click();
      await browserExpect(page.locator("#ga4-kpi-k-a")).toContainText("3,100");
      await page.getByRole("tab", { name: "Benchmarks", exact: true }).click();
      await browserExpect(page.locator("#ga4-benchmark-b-a")).toContainText("3,100");
      await page.getByRole("tab", { name: "Overview", exact: true }).click();

      // A new reporting date keeps the prior financial card visible while its
      // new-date query runs; the existing warning identifies the older date.
      generation = 4; day = "2026-10-18";
      waitFinancial = new Promise(resolve => { releaseFinancial = resolve; });
      await page.clock.runFor(30_000);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("Updating displayed figures");
      await browserExpect(page.getByText("€68,000.00", { exact: true }).first()).toBeVisible();
      releaseFinancial!(); waitFinancial = undefined;
      await browserExpect(page.getByTestId("ga4-overview-reporting-dates")).toContainText("Oct 18, 2026");
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);

      const beforeHidden = requests.length;
      await page.evaluate(() => (window as any).testFocus(false));
      await page.clock.runFor(600_000);
      expect(requests.length).toBe(beforeHidden);
      failStatus = true;
      await page.evaluate(() => (window as any).testFocus(true));
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("could not refresh");
      await browserExpect(page.getByText("3,100", { exact: true }).first()).toBeVisible();
      expect(errors).toEqual([]);
    } catch (error) {
      console.error({ browserErrors: errors, requests, pageText: (await page.locator("body").innerText()).slice(0, 4000) });
      throw error;
    } finally { releaseFinancial?.(); await context.close(); await browser.close(); }
  }, 90_000);
});
