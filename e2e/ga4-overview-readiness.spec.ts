import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";

const campaignId = process.env.GA4_OVERVIEW_CAMPAIGN_ID || "8aa735ee-c02f-41e2-bb1f-7c3f43bb9458";
const propertyId = process.env.GA4_OVERVIEW_PROPERTY_ID || "542352127";
const storageStatePath = process.env.GA4_E2E_STORAGE_STATE || "e2e/auth.json";
const reportId = process.env.GA4_OVERVIEW_REPORT_ID || "";

test.describe("GA4 Overview automated readiness pack", () => {
  test("deployed/logged-in Overview endpoints pass the automated pack", async ({ browser }) => {
    test.skip(!existsSync(storageStatePath), `Missing ${storageStatePath}. Save a logged-in Playwright storage state before running deployed automation.`);

    const context = await browser.newContext({ storageState: storageStatePath });
    const page = await context.newPage();

    await page.goto(`/campaigns/${campaignId}/ga4-metrics`);
    await page.waitForLoadState("networkidle");

    const overview = await page.evaluate(async ({ campaignId, propertyId }) => {
      await import("/ga4-overview-validation-runner.js?v=2026-07-03.2");
      return await (window as any).GA4OverviewValidation.overviewPack({ campaignId, propertyId });
    }, { campaignId, propertyId });

    expect(overview.overallPass, JSON.stringify(overview, null, 2)).toBe(true);

    if (reportId) {
      const report = await page.evaluate(async ({ campaignId, reportId }) => {
        return await (window as any).GA4OverviewValidation.reportPack({ campaignId, reportId, createSnapshot: true });
      }, { campaignId, reportId });
      expect(report.overallPass, JSON.stringify(report, null, 2)).toBe(true);
    }

    await context.close();
  });
});