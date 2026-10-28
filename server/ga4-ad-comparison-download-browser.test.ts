import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { build } from "esbuild";
import ts from "typescript";
import { chromium, expect as browserExpect } from "@playwright/test";
import { describe, expect, it } from "vitest";

// Execute the real API handler for the report's native breakdown, including its snapshot gate.
const routeSource = ts.createSourceFile("routes-oauth.ts", readFileSync("server/routes-oauth.ts", "utf8"), ts.ScriptTarget.Latest, true);
const definitions: Record<string, string> = {};
function visitRoute(node: ts.Node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(routeSource) === "getSynchronizedGA4OverviewSnapshot") definitions.snapshot = node.initializer!.getText(routeSource);
  if (ts.isCallExpression(node) && node.expression.getText(routeSource) === "app.get" && node.arguments[0]?.getText(routeSource) === '"/api/campaigns/:id/ga4-breakdown"') definitions.route = node.arguments.at(-1)!.getText(routeSource);
  ts.forEachChild(node, visitRoute);
}
visitRoute(routeSource);
function compileRoute(name: string, bindings: Record<string, any>) {
  if (!definitions[name]) throw new Error(`Missing production definition: ${name}`);
  return new Function(...Object.keys(bindings), ts.transpileModule(`return (${definitions[name]});`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText)(...Object.values(bindings));
}

// A fresh, isolated browser: all requests are intercepted, no user profile or live services.
describe("Ad Comparison precision through the real Reports page", () => {
  it.each(["channel", "history", "published-sources", "initial-reports", "publication-handoff", "publication-gap", "background-read", "landing-pages", "conversion-events", "report-library", "revenue-pipeline-no-spend", "promo-rounding"])("downloads with %s refresh timing and recovers after core refresh failures", async contextKind => {
    const bundle = await build({
      stdin: { contents: `import React from 'react'; import {createRoot} from 'react-dom/client';
        import {QueryClientProvider} from '@tanstack/react-query';
        import {TooltipProvider} from './client/src/components/ui/tooltip';
        import {Toaster} from './client/src/components/ui/toaster';
        import {createAppQueryClient} from './client/src/lib/queryClient';
        import Page from './client/src/pages/ga4-metrics';
        const client = createAppQueryClient();
        window.fixtureQueries = () => client.getQueryCache().getAll().filter(q => q.state.error).map(q => ({key:q.queryKey,error:String(q.state.error)}));
        window.fixtureWarnings = [];
        new MutationObserver(() => {const warning=document.querySelector('[data-testid="ga4-publication-display-status"]')?.textContent; if(warning?.includes('could not refresh')) window.fixtureWarnings.push(warning);}).observe(document.getElementById('root'), {childList:true,subtree:true,characterData:true});
        window.fixtureRefreshErrors = [];
        const invalidate = client.invalidateQueries.bind(client);
        client.invalidateQueries = (...args) => invalidate(...args).catch(error => {
          window.fixtureRefreshErrors.push({name: error?.constructor?.name, message: error?.message}); throw error;
        });
        window.fixtureStatus = () => client.invalidateQueries({queryKey: ['/api/campaigns','a','ga4-publication-status']});
        window.fixtureFinancial = () => client.invalidateQueries({queryKey: ['/api/campaigns','a','financial-daily-snapshot']});
        createRoot(document.getElementById('root')).render(<QueryClientProvider client={client}><TooltipProvider><Page/><Toaster/></TooltipProvider></QueryClientProvider>);`,
        loader: "tsx", resolveDir: process.cwd() },
      bundle: true, write: false, platform: "browser", format: "iife", jsx: "automatic",
      define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
      plugins: [{ name: "isolate-auth-and-source-setup", setup(builder) {
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
    const errors: string[] = [], requests: string[] = [], downloads: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("download", download => downloads.push(download.suggestedFilename()));
    let generation = 1, failed = "", financialMismatch = false, financialRequests = 0, statusRequests = 0, publicationGap = false;
    let releaseInsights!: () => void;
    const pendingInsights = new Promise<void>(resolve => { releaseInsights = resolve; });
    let holdInsights = true;
    let holdFinancial = false, releaseFinancial!: () => void;
    const pendingFinancial = new Promise<void>(resolve => { releaseFinancial = resolve; });
    const independentKind = ["landing-pages", "conversion-events", "report-library"].includes(contextKind);
    let holdIndependent = false, independentRequests = 0, releaseIndependent!: () => void;
    const pendingIndependent = new Promise<void>(resolve => { releaseIndependent = resolve; });
    const day = "2026-10-25", start = "2026-09-23", updatedAt = "2026-10-26T18:00:00Z";
    const promo = contextKind === "promo-rounding";
    const rows = promo ? [
      { campaign: "yesop_brand_search", sessions: 2394, users: 2395, conversions: 250, revenue: 66625.346347, sessionKeyEventRate: 0.102 },
      { campaign: "yesop_retargeting", sessions: 1039, users: 1039, conversions: 66, revenue: 13808.508329999999, sessionKeyEventRate: 0.059 },
    ] : [
      { campaign: "yesop_prospecting", sessions: 346, users: 344, conversions: 19, revenue: 3400.434193, sessionKeyEventRate: 0.046242774566473986 },
      { campaign: "yesop_paid_social", sessions: 258, users: 258, conversions: 21, revenue: 4253.52214, sessionKeyEventRate: 0.08139534883720931 },
    ];
    const totals = promo
      ? { sessions: 3433, users: 3434, conversions: 316, revenue: 80433.85, pageviews: 5000, engagedSessions: 2482, engagementRate: 2482 / 3433 }
      : { sessions: 604, users: 602, conversions: 40, revenue: 7653.96, pageviews: 1000, engagedSessions: 300, engagementRate: 300 / 604 };
    const financialTotal = promo ? 80683.85 : 8003.96;
    const totalLabel = promo ? "80,683.85" : "8,003.96", nativeLabel = promo ? "80,433.85" : "7,653.96";
    let providerRequests = 0;
    const storage = {
      getGA4Connection: async () => ({ propertyId: "123", importStartDate: start, accessToken: "expired" }),
      getGA4OverviewSnapshot: async () => ({ campaignId: "a", propertyId: "123", windowStart: start, windowEnd: day, updatedAt,
        campaignBreakdown: { rows, totals, meta: { currencyCode: "EUR", revenueMetric: "totalRevenue" } } }),
      getLatestGA4DailyMetric: async () => ({ date: day }),
    };
    const breakdownHandler = compileRoute("route", { storage,
      ensureCampaignAccess: async () => ({ id: "a", currency: "EUR", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: rows.map(row => row.campaign) }),
      parseGA4CampaignFilter: (value: any) => value, isYesopMockProperty: () => false,
      resolveGA4ImportToDateWindow: () => ({ startDate: start, endDate: day, dataThroughDate: day, days: 33, reportingTimeZone: "Europe/Amsterdam" }),
      getSynchronizedGA4OverviewSnapshot: compileRoute("snapshot", { storage }),
      ga4Service: { getAcquisitionBreakdown: async () => { providerRequests++; throw new Error("TOKEN_EXPIRED"); } },
      console: { error: () => {} },
    });
    const sources = promo ? [{ id: "csv", sourceId: "csv", sourceType: "csv", displayName: "CSV", revenue: 250 }] : [
      { id: "hubspot", sourceId: "hubspot", sourceType: "hubspot", displayName: "HubSpot", revenue: 250 },
      { id: "salesforce", sourceId: "salesforce", sourceType: "salesforce", displayName: "Salesforce", revenue: 100 },
    ];
    const pipelineJourney = contextKind === "revenue-pipeline-no-spend";
    await page.clock.install({ time: new Date("2026-10-26T19:00:00Z") });
    await context.route("**/*", async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.hostname !== "ga4-fixture.test" || request.method() !== "GET") {
        errors.push(`Disallowed request: ${request.method()} ${url.hostname}${url.pathname}`); await route.abort(); return;
      }
      if (url.pathname === "/fixture.js") { await route.fulfill({ contentType: "application/javascript", body: bundle.outputFiles[0].text }); return; }
      if (url.pathname.endsWith(".png")) { await route.fulfill({ status: 404, body: "" }); return; }
      if (!url.pathname.startsWith("/api/")) {
        await route.fulfill({ contentType: "text/html", body: '<html><body><div id="root"></div><script src="/fixture.js"></script></body></html>' }); return;
      }
      requests.push(url.pathname + url.search);
      const insightsContext = contextKind === "channel" ? url.searchParams.get("insightsChannelAttribution") === "1"
        : url.pathname.endsWith("/ga4-daily") && url.searchParams.get("days") === "60";
      if (holdInsights && insightsContext) await pendingInsights;
      let data: any = { success: true }, status = 200;
      if (url.pathname.endsWith("/ga4-breakdown") && (url.searchParams.get("adComparisonCampaignBreakdown") === "1"
        || (promo && url.searchParams.get("overviewCampaignBreakdown") === "1"))) {
        await breakdownHandler({ params: { id: "a" }, query: Object.fromEntries(url.searchParams) }, {
          status(code: number) { status = code; return this; }, json(body: any) { data = body; return this; },
        });
        await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) }); return;
      }
      const property = { propertyId: "123", propertyName: "Isolated fixture", isPrimary: true, lookbackDays: 30 };
      if (url.pathname === "/api/campaigns/a") data = { id: "a", name: "Precision regression", currency: "EUR", status: "active", reportingTimeZone: "Europe/Amsterdam", ga4CampaignFilter: JSON.stringify(rows.map(row => row.campaign)), createdAt: `${start}T00:00:00Z` };
      else if (url.pathname.includes("/ga4/check-connection/") || url.pathname.endsWith("/ga4-connections")) data = { success: true, connected: true, connections: [property] };
      else if (url.searchParams.has("statusOnly")) {
        statusRequests++;
        if (contextKind === "publication-handoff" && statusRequests === 2) generation++;
        if (contextKind === "publication-gap" && statusRequests === 2) publicationGap = true;
        data = { success: true, campaignId: "a", propertyId: "123", publicationToken: publicationGap ? null : `p${generation}`, refreshStatus: publicationGap ? "running" : "current",
          nextCheckAt: new Date(Date.now() + (publicationGap ? 60_000 : 6 * 60 * 60_000)).toISOString() };
        if (failed === "status") { status = 503; data = { success: false, error: "fixture status failure" }; }
      } else if (url.pathname.endsWith("/ga4-daily")) {
        data = { success: true, propertyId: "123", startDate: start, overviewStartDate: start, endDate: day, dataThroughDate: day, latestStoredDailyDate: day, historyDataThroughDate: day, reportingTimeZone: "Europe/Amsterdam", lastUpdated: updatedAt, lastCompletedRefreshAt: updatedAt, refreshStatus: "current", refreshIsStale: false, overviewTotals: totals, data: [{ date: day, ...totals }], refreshScheduleHours: [8, 14, 20], refreshScheduleMinute: 0, refreshScheduleTimeZone: "Europe/Amsterdam" };
        if (failed === "daily") { status = 503; data = { success: false, error: "fixture daily failure" }; }
      } else if (url.pathname.endsWith("/financial-daily-snapshot")) data = { success: true, snapshot: { campaignId: "a", reportingDate: day, recordedAt: updatedAt, metrics: { financialDaily: { currency: "EUR", currentValueWindow: { startDate: start, endDate: day, reportingTimeZone: "Europe/Amsterdam" }, inputs: { revenue: { available: true, value: financialTotal + (financialMismatch ? 1 : 0) }, spend: { available: false }, conversions: { available: true, value: totals.conversions } } } } } };
      else if (url.pathname.endsWith("/ga4-breakdown")) data = { success: true, propertyId: "123", startDate: start, endDate: day, lastUpdated: updatedAt, totals, rows, revenueWindow: { source: "ga4", startDate: start, endDate: day }, meta: { currencyCode: "EUR" } };
      else if (url.pathname.endsWith("/ga4-to-date")) data = { success: true, propertyId: "123", startDate: start, endDate: day, currencyCode: "EUR", revenueMetric: "totalRevenue", totals };
      else if (url.pathname.endsWith("/ga4-landing-pages") || url.pathname.endsWith("/ga4-conversion-events")) data = { success: true, propertyId: "123", startDate: start, endDate: day, lastUpdated: updatedAt, rows: [] };
      else if (url.pathname.includes("/platforms/google_analytics/")) data = contextKind === "background-read" && url.pathname.endsWith("/reports")
        ? [{ id: "saved-ads", name: "Saved Ad Comparison", reportType: "ads", createdAt: updatedAt, configuration: JSON.stringify({ sections: { ads: true } }) }]
        : ["landing-pages", "conversion-events"].includes(contextKind) && url.pathname.endsWith("/reports")
          ? [{ id: "saved-overview", name: "Saved Overview", reportType: "overview", createdAt: updatedAt, configuration: JSON.stringify({ sections: { overview: true } }) }] : [];
      else if (url.pathname === "/api/hubspot/a/pipeline-proxy" && pipelineJourney) data = { success: true, sourceId: "hubspot", pipelineEnabled: true, mode: "current_stage", currency: "EUR", lastUpdatedAt: updatedAt, totalToDate: 3200, pipelineStageLabel: "Contract Sent", pipelineValueRevenueTotals: [{ campaignValue: "yesop_prospecting", revenue: 3200 }] };
      else if (url.pathname.endsWith("/revenue-sources")) data = { success: true, sources: sources.map(source => ({ ...source, isActive: true, currency: "EUR", materializedRevenueStatus: "available", lastTotalRevenue: source.revenue, completedDayRevenue: source.revenue, mappingConfig: pipelineJourney && source.id === "hubspot" ? { pipelineEnabled: true, pipelineStageLabel: "Contract Sent", selectedValues: ["yesop_prospecting"] } : null,
        ...(contextKind === "published-sources" ? { publicationStatus: "published", publicationHash: source.id + "-saved" } : {}),
      })) };
      else if (url.pathname.endsWith("/revenue-breakdown")) data = { success: true, sources, endDate: day };
      else if (url.pathname.endsWith("/revenue-to-date")) data = { success: true, totalRevenue: promo ? 250 : 350, sourceIds: sources.map(source => source.id), endDate: day };
      else if (url.pathname.includes("revenue") || url.pathname.includes("spend")) data = { success: true, sources: [], sourceIds: [], totalRevenue: 0, totalSpend: 0, spendToDate: 0, rows: [], endDate: day };
      if (failed === "insights" && insightsContext) { status = 503; data = { success: false, error: "fixture Insights context failure" }; }
      const independentRequest = independentKind && (contextKind === "report-library"
        ? url.pathname.endsWith("/google_analytics/reports") : url.pathname.endsWith(`/ga4-${contextKind}`));
      if (independentRequest) {
        independentRequests++;
        if (holdIndependent) await pendingIndependent;
        if (failed === contextKind) { status = 503; data = { success: false, message: "fixture independent detail failure" }; }
      }
      if (url.pathname.endsWith("/financial-daily-snapshot")) {
        financialRequests++;
        if (holdFinancial) await pendingFinancial;
      }
      if (contextKind === "published-sources") {
        if (url.searchParams.has("statusOnly")) await new Promise(resolve => setTimeout(resolve, 300));
        if (url.pathname.endsWith("/revenue-sources")) await new Promise(resolve => setTimeout(resolve, 600));
        if (url.pathname.endsWith("/financial-daily-snapshot") && financialRequests > 1) await new Promise(resolve => setTimeout(resolve, 900));
      }
      await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(data) });
    });
    const openReport = async () => {
      await page.getByRole("button", { name: "Create Report", exact: true }).click();
      await page.getByRole("dialog").getByText("Ad Comparison", { exact: true }).click();
    };
    const downloadReport = async (saved = false) => {
      const pending = page.waitForEvent("download", { timeout: 20_000 });
      await page.getByRole("button", { name: saved ? "Download" : "Generate & Download Report", exact: true }).click();
      const download = await pending;
      expect(download.suggestedFilename()).toBe(saved ? "Saved_Ad_Comparison_2026-10-26.pdf" : "GA4_Ad_Comparison_Report_2026-10-26.pdf");
      const bytes = readFileSync((await download.path())!);
      expect(bytes.toString("latin1")).toContain(`EUR ${nativeLabel}`);
      expect(bytes.toString("latin1")).toContain(`EUR ${totalLabel}`);
      expect(bytes.toString("latin1")).toContain("EUR 250.00");
      if (!promo) expect(bytes.toString("latin1")).toContain("EUR 100.00");
      if (promo) {
        expect(bytes.toString("latin1")).toContain("EUR 66,625.34");
        expect(bytes.toString("latin1")).toContain("EUR 13,808.51");
        expect(bytes.toString("latin1")).not.toContain("EUR 80,433.86");
      }
      if (pipelineJourney) {
        expect(bytes.toString("latin1")).toContain("CAMPAIGN BREAKDOWN REVENUE");
        expect(bytes.toString("latin1")).not.toContain("EUR 7,653.95");
      }
      const artifact = "docs/fixes/v1-batch-7/validation-2026-10-26/precision2-ui-download.pdf";
      if (!process.env.V1_BATCH7_PRESERVE_ARTIFACTS || !existsSync(artifact)) writeFileSync(artifact, bytes);
      await browserExpect(page.getByRole("dialog")).toHaveCount(0);
    };
    try {
      await page.goto("http://ga4-fixture.test/campaigns/a/ga4-metrics" + (["initial-reports", "publication-handoff", "publication-gap"].includes(contextKind) ? "?tab=reports" : ""));
      if (["initial-reports", "publication-handoff", "publication-gap"].includes(contextKind)) {
        await browserExpect(page.getByRole("heading", { name: "Reports", exact: true })).toBeVisible();
        if (contextKind.startsWith("publication-")) await browserExpect.poll(() => statusRequests).toBeGreaterThanOrEqual(2);
        if (contextKind === "publication-gap") {
          await page.clock.runFor(180_000);
          await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
          expect(await page.evaluate(() => (window as any).fixtureWarnings)).toEqual([]);
          await openReport();
          await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
          await page.getByRole("button", { name: "Cancel", exact: true }).click();
          publicationGap = false; generation++;
          await page.evaluate(() => (window as any).fixtureStatus());
        }
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
        await page.getByRole("tab", { name: "Overview", exact: true }).click();
      }
      await browserExpect(page.getByText("Total Revenue", { exact: true }).locator("../..")).toContainText(`€${totalLabel}`);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      if (promo) {
        await browserExpect(page.getByRole("row").filter({ hasText: "yesop_brand_search" })).toContainText("€66,625.34");
        await browserExpect(page.getByRole("row").filter({ hasText: "yesop_retargeting" })).toContainText("€13,808.51");
        await browserExpect(page.getByText("Total Spend", { exact: true }).locator("../..")).toContainText("Unavailable");
        await browserExpect(page.getByText("Expected Revenue", { exact: true }).locator("../..")).toContainText("Not configured");
      }
      if (pipelineJourney) {
        const revenueCard = page.getByText("Total Revenue", { exact: true }).locator("../..");
        const pipelineCard = page.getByText("Expected Revenue", { exact: true }).locator("../..");
        await browserExpect(pipelineCard).toContainText("€3,200.00");
        await browserExpect(page.getByText("Total Spend", { exact: true }).locator("../..")).toContainText("Unavailable");
        for (const metric of ["ROAS", "ROI", "CPA"]) await browserExpect(page.getByText(metric, { exact: true }).locator("..")).toContainText("Unavailable");
        await browserExpect(page.getByText("Profit", { exact: true })).toHaveCount(0);
        await revenueCard.getByRole("button", { name: "Sources (3)", exact: true }).click();
        for (const amount of ["€7,653.96", "€250.00", "€100.00"]) await browserExpect(page.getByRole("dialog")).toContainText(amount);
        await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
        await pipelineCard.getByRole("button", { name: "Sources (1)", exact: true }).click();
        await browserExpect(page.getByRole("dialog")).toContainText("Contract Sent");
        await browserExpect(page.getByRole("dialog")).toContainText("€3,200.00");
        await page.getByRole("dialog").getByRole("button", { name: "Close", exact: true }).click();
        await browserExpect(revenueCard).toContainText("€8,003.96");
      }
      if (contextKind === "background-read") {
        const revenueCard = page.getByText("Total Revenue", { exact: true }).locator("../..");
        const before = await revenueCard.boundingBox();
        holdFinancial = true;
        const previousReads = financialRequests;
        await page.evaluate(() => { void (window as any).fixtureFinancial(); });
        await browserExpect.poll(() => financialRequests).toBeGreaterThan(previousReads);
        await browserExpect(page.getByText("Updating displayed figures. Some sections may still show the previous update.")).toHaveCount(0);
        expect((await revenueCard.boundingBox())?.y).toBe(before?.y);
        await browserExpect(revenueCard).toContainText("€8,003.96");
        await page.getByRole("tab", { name: "Reports", exact: true }).click();
        await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeDisabled();
        await openReport();
        await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
        expect(downloads).toHaveLength(0);
        holdFinancial = false; releaseFinancial();
        await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeEnabled();
        await page.getByRole("button", { name: "Cancel", exact: true }).click();
        await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeEnabled();
      }
      await page.getByRole("tab", { name: "Campaign Comparison", exact: true }).click();
      await browserExpect(page.getByRole("heading", { name: "Campaign Comparison", exact: true })).toBeVisible();
      await browserExpect(page.getByRole("row").filter({ hasText: "TOTAL" }).last()).toContainText(`€${totalLabel}`);
      if (promo) {
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "Revenue (High to Low)", exact: true }).click();
        await browserExpect(page.getByText("Campaign Breakdown Revenue", { exact: true }).locator("..")).toContainText("€80,433.85");
        await browserExpect(page.getByText("€66,625.34", { exact: false }).first()).toBeVisible();
      }
      if (pipelineJourney) {
        await page.getByRole("combobox").click();
        await page.getByRole("option", { name: "Revenue (High to Low)", exact: true }).click();
        await browserExpect(page.getByText("Campaign Breakdown Revenue", { exact: true }).locator("..")).toContainText("€7,653.96");
        for (const [label, campaign, detail] of [
          ["Most Key Events", "yesop_paid_social", "21 Key Events"],
          ["Highest Conversion Rate", "yesop_paid_social", "8.14%"],
          ["Needs Attention", "yesop_prospecting", "4.62%"],
        ]) {
          const card = page.getByText(label, { exact: true }).locator("../..");
          await browserExpect(card).toContainText(campaign);
          await browserExpect(card).toContainText(detail);
        }
        await browserExpect(page.getByText("€3,200.00", { exact: true })).toHaveCount(0);
      }
      await page.getByRole("tab", { name: "Reports", exact: true }).click();
      await openReport();
      if (contextKind === "publication-handoff") expect(await page.evaluate(() => (window as any).fixtureWarnings)).toEqual([]);
      if (contextKind === "published-sources") {
        await browserExpect.poll(() => financialRequests).toBeGreaterThanOrEqual(3);
        await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
        await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeEnabled();
      }
      await page.getByRole("dialog").getByText("Executive financials, trends, and recommended checks", { exact: true }).click();
      await page.getByRole("button", { name: "Generate & Download Report" }).click();
      await browserExpect(page.getByText(/Insights context is still loading/)).toBeVisible();
      expect(downloads).toHaveLength(0);
      await page.getByRole("dialog").getByText("Ad Comparison", { exact: true }).click();
      await downloadReport();
      holdInsights = false; releaseInsights();
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      failed = "insights"; generation++;
      await page.evaluate(() => (window as any).fixtureStatus());
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      await openReport(); await downloadReport();
      failed = "";
      if (independentKind) {
        holdIndependent = true; generation++;
        const before = independentRequests;
        await page.evaluate(() => (window as any).fixtureStatus());
        await browserExpect.poll(() => independentRequests).toBeGreaterThan(before);
        if (contextKind !== "report-library") await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeDisabled();
        await openReport();
        if (contextKind !== "report-library") {
          await page.getByRole("dialog").getByRole("heading", { name: "Overview", exact: true }).click();
          await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
          await page.getByRole("dialog").getByText("Ad Comparison", { exact: true }).click();
        }
        await downloadReport();
        holdIndependent = false; failed = contextKind; releaseIndependent();
        await browserExpect.poll(async () => (await page.evaluate(() => (window as any).fixtureQueries())).some((query: any) => String(query.error).includes("fixture independent detail failure"))).toBe(true);
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
        if (contextKind !== "report-library") await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeDisabled();
        await openReport();
        if (contextKind !== "report-library") {
          await page.getByRole("dialog").getByRole("heading", { name: "Overview", exact: true }).click();
          await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
          await page.getByRole("dialog").getByText("Ad Comparison", { exact: true }).click();
        }
        await downloadReport();
        failed = "";
        await page.evaluate(() => (window as any).fixtureStatus());
        await browserExpect.poll(async () => (await page.evaluate(() => (window as any).fixtureQueries())).some((query: any) => String(query.error).includes("fixture independent detail failure"))).toBe(false);
        if (contextKind !== "report-library") {
          await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeEnabled();
          await openReport();
          await page.getByRole("dialog").getByRole("heading", { name: "Overview", exact: true }).click();
          await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeEnabled();
          await page.getByRole("button", { name: "Cancel", exact: true }).click();
        }
      }
      for (const failure of ["daily", "status"]) {
        failed = failure; generation++;
        await page.evaluate(() => (window as any).fixtureStatus());
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("could not refresh");
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText(failure === "status" ? "refresh status" : "daily");
        if (contextKind === "initial-reports" && failure === "daily") {
          await page.clock.runFor(180_000);
          await browserExpect(page.getByTestId("ga4-publication-display-status")).toContainText("could not refresh (daily)");
        }
        if (contextKind === "background-read") await browserExpect(page.getByRole("button", { name: "Download", exact: true })).toBeDisabled();
        await openReport();
        const previousDownloads = downloads.length;
        await browserExpect(page.getByRole("button", { name: "Generate & Download Report" })).toBeDisabled();
        await browserExpect(page.getByText("The latest displayed figures are still being checked. Please try the report again once the update finishes.")).toHaveCount(0);
        expect(downloads.length).toBe(previousDownloads);
        failed = "";
        await page.evaluate(() => (window as any).fixtureStatus());
        await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
        await downloadReport();
      }
      financialMismatch = true; generation++;
      const beforeMismatchedRead = financialRequests;
      await page.evaluate(() => (window as any).fixtureStatus());
      await browserExpect.poll(() => financialRequests).toBeGreaterThan(beforeMismatchedRead);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      await openReport();
      const beforeMismatch = downloads.length;
      await page.getByRole("button", { name: "Generate & Download Report" }).click();
      await browserExpect(page.getByText(/waiting for a successful aligned data refresh/)).toBeVisible();
      expect(downloads.length).toBe(beforeMismatch);
      financialMismatch = false; generation++;
      const beforeRecoveredRead = financialRequests;
      await page.evaluate(() => (window as any).fixtureStatus());
      await browserExpect.poll(() => financialRequests).toBeGreaterThan(beforeRecoveredRead);
      await browserExpect(page.getByTestId("ga4-publication-display-status")).toHaveCount(0);
      await downloadReport();
      if (contextKind === "background-read") await downloadReport(true);
      expect(downloads).toHaveLength(contextKind === "background-read" ? 6 : independentKind ? 7 : 5);
      expect(providerRequests).toBe(0);
      expect(errors).toEqual([]);
    } catch (error) {
      throw new Error(`${String(error)}\n${JSON.stringify({ errors, downloads, requests, refreshErrors: await page.evaluate(() => (window as any).fixtureRefreshErrors), pageText: (await page.locator("body").innerText()).slice(-5000) })}`);
    } finally { releaseInsights(); releaseFinancial(); releaseIndependent(); await context.close(); await browser.close(); }
  }, 90_000);
});
