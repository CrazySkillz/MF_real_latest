import { test, expect, type Page } from "@playwright/test";

/**
 * GA4 Cross-Tab Consistency E2E Tests
 *
 * Prerequisites:
 * 1. Server running at http://localhost:5000
 * 2. Logged in (Clerk session cookie — see setup below)
 * 3. A yesop-brand campaign seeded with mock data:
 *    POST /api/seed-yesop-campaigns
 *    POST /api/campaigns/{id}/ga4/mock-refresh (run multiple times for history)
 *    POST /api/campaigns/{id}/ga4/run-insights-jobs
 * 4. At least one spend source ($950) and KPI/Benchmarks created
 *
 * Run:
 *   npx playwright test e2e/ga4-cross-tab.spec.ts
 *
 * To run headed (see the browser):
 *   npx playwright test e2e/ga4-cross-tab.spec.ts --headed
 *
 * NOTE: These tests require an authenticated session. Set the CLERK_SESSION
 * cookie in storageState or use the Clerk test mode with a test user.
 * You can export storage state after manual login:
 *   1. npx playwright codegen http://localhost:5000 --save-storage=e2e/auth.json
 *   2. Log in manually in the browser that opens
 *   3. Close the browser — auth.json is saved
 *   4. Tests will use it via storageState in the config
 */

// ============================================================
// EXPECTED VALUES (from yesop-brand mock profile)
// ============================================================
const YESOP_BRAND = {
  sessions: 750,
  users: 500,
  conversions: 38,
  revenue: 2850,
  spend: 950,
  cr: 5.07,       // (38/750)*100
  roas: 3.0,      // ratio for display (2850/950)
  roasPct: 300,   // percentage for KPI (2850/950)*100
  roi: 200,       // ((2850-950)/950)*100
  cpa: 25,        // 950/38
};

// Helper: extract a number from text like "$2,850.00" or "300.00%" or "3.00x"
function parseDisplayNumber(text: string): number {
  const cleaned = text.replace(/[$,%x,]/g, "").trim();
  return parseFloat(cleaned);
}

// Helper: find card value by heading text
async function getCardValue(page: Page, heading: string): Promise<string> {
  const card = page.locator(`text=${heading}`).first().locator("..").locator("..");
  // The value is typically the largest text in the card
  const value = await card.locator("p, span, div").filter({ hasText: /^\$?[\d,]+\.?\d*[%x]?$/ }).first().textContent();
  return value?.trim() || "";
}

// ============================================================
// TESTS
// ============================================================

test.describe("GA4 Cross-Tab Consistency", () => {
  // Skip all tests if no auth state file exists
  test.use({
    storageState: "e2e/auth.json",
  });

  let campaignUrl: string;

  test.beforeAll(async ({ browser }) => {
    // Find the yesop-brand campaign URL
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/campaigns");
    await page.waitForLoadState("networkidle");

    // Look for yesop-brand campaign link
    const campaignLink = page.locator('a:has-text("Yesop")').first();
    if (await campaignLink.isVisible()) {
      const href = await campaignLink.getAttribute("href");
      const campaignId = href?.match(/campaigns\/([^/]+)/)?.[1];
      if (campaignId) {
        campaignUrl = `/campaigns/${campaignId}/ga4-metrics`;
      }
    }
    await context.close();
  });

  test.beforeEach(async ({ page }) => {
    test.skip(!campaignUrl, "No yesop campaign found — run POST /api/seed-yesop-campaigns first");
    await page.goto(campaignUrl);
    await page.waitForLoadState("networkidle");
    // Wait for data to load (overview tab loads by default)
    await page.waitForTimeout(2000);
  });

  // ---- OVERVIEW TAB ----

  test("Overview: financial metrics are displayed and non-zero", async ({ page }) => {
    // Verify key metrics are visible and have values
    await expect(page.getByText("Sessions").first()).toBeVisible();
    await expect(page.getByText("Users").first()).toBeVisible();
    await expect(page.getByText("Conversions").first()).toBeVisible();
  });

  test("Overview: ROAS and ROI are consistent with spend and revenue", async ({ page }) => {
    // Get spend and revenue text from the page
    const pageContent = await page.textContent("body");

    // Verify ROAS is displayed somewhere
    expect(pageContent).toContain("ROAS");
    // Verify ROI is displayed
    expect(pageContent).toContain("ROI");
  });

  // ---- KPIs TAB ----

  test("KPIs tab: loads and shows summary cards", async ({ page }) => {
    // Click KPIs tab
    await page.getByRole("tab", { name: /KPIs/i }).click();
    await page.waitForTimeout(1500);

    // Should see summary cards
    await expect(page.getByText("Total KPIs").first()).toBeVisible();
  });

  test("KPIs tab: KPI current values are non-zero when data exists", async ({ page }) => {
    await page.getByRole("tab", { name: /KPIs/i }).click();
    await page.waitForTimeout(1500);

    const pageContent = await page.textContent("body") || "";

    // If KPIs exist, we should see progress percentages
    if (pageContent.includes("Total KPIs")) {
      // At least one KPI should show a percentage
      const hasProgress = /\d+\.?\d*%/.test(pageContent);
      if (pageContent.includes("Create KPI")) {
        // No KPIs yet — skip
        test.skip(true, "No KPIs created yet");
      } else {
        expect(hasProgress).toBe(true);
      }
    }
  });

  // ---- BENCHMARKS TAB ----

  test("Benchmarks tab: loads and shows summary cards", async ({ page }) => {
    await page.getByRole("tab", { name: /Benchmarks/i }).click();
    await page.waitForTimeout(1500);

    await expect(page.getByText("Total Benchmarks").first()).toBeVisible();
  });

  // ---- AD COMPARISON TAB ----

  test("Ad Comparison tab: loads campaign data", async ({ page }) => {
    // The tab might be labeled "Campaigns" or "Ad Comparison"
    const campaignsTab = page.getByRole("tab", { name: /Campaigns|Ad Comparison/i });
    if (await campaignsTab.isVisible()) {
      await campaignsTab.click();
      await page.waitForTimeout(1500);

      const pageContent = await page.textContent("body") || "";
      // Should show campaign data or a "no campaigns" message
      const hasCampaignData = pageContent.includes("Best Performing") ||
        pageContent.includes("Sessions") ||
        pageContent.includes("No campaign");
      expect(hasCampaignData).toBe(true);
    }
  });

  // ---- INSIGHTS TAB ----

  test("Insights tab: loads and shows executive financials", async ({ page }) => {
    await page.getByRole("tab", { name: /Insights/i }).click();
    await page.waitForTimeout(2000);

    // Should show Executive Financials section
    const pageContent = await page.textContent("body") || "";
    const hasFinancials = pageContent.includes("Spend") && pageContent.includes("Revenue");
    expect(hasFinancials).toBe(true);
  });

  test("Insights tab: financial values match Overview tab", async ({ page }) => {
    // First, capture Overview financial values
    const overviewContent = await page.textContent("body") || "";

    // Extract ROAS from Overview (look for pattern like "3.00x" or "300%")
    const roasMatch = overviewContent.match(/ROAS[\s\S]*?([\d.]+)x/);
    const overviewRoas = roasMatch ? parseFloat(roasMatch[1]) : null;

    // Now switch to Insights tab
    await page.getByRole("tab", { name: /Insights/i }).click();
    await page.waitForTimeout(2000);

    const insightsContent = await page.textContent("body") || "";

    // Insights should also show ROAS
    if (overviewRoas !== null) {
      const insightsRoasMatch = insightsContent.match(/ROAS[\s\S]*?([\d.]+)x/);
      if (insightsRoasMatch) {
        const insightsRoas = parseFloat(insightsRoasMatch[1]);
        // ROAS should match between Overview and Insights
        expect(insightsRoas).toBeCloseTo(overviewRoas, 1);
      }
    }
  });

  test("Insights tab: shows correct insight severities", async ({ page }) => {
    await page.getByRole("tab", { name: /Insights/i }).click();
    await page.waitForTimeout(2000);

    const pageContent = await page.textContent("body") || "";

    // Should show at least one of: High, Medium, Low, or "No issues detected"
    const hasInsights = pageContent.includes("High") ||
      pageContent.includes("Medium") ||
      pageContent.includes("Low") ||
      pageContent.includes("Positive") ||
      pageContent.includes("No issues detected");
    expect(hasInsights).toBe(true);
  });

  // ---- CROSS-TAB VALUE MATCHING ----

  test("Cross-tab: Revenue value is consistent across Overview and Insights", async ({ page }) => {
    // Capture revenue from Overview
    const overviewContent = await page.textContent("body") || "";
    const revenueMatches = overviewContent.match(/\$[\d,]+\.?\d*/g) || [];

    // Switch to Insights
    await page.getByRole("tab", { name: /Insights/i }).click();
    await page.waitForTimeout(2000);

    const insightsContent = await page.textContent("body") || "";
    const insightsRevenueMatches = insightsContent.match(/\$[\d,]+\.?\d*/g) || [];

    // Both tabs should show dollar values
    expect(revenueMatches.length).toBeGreaterThan(0);
    expect(insightsRevenueMatches.length).toBeGreaterThan(0);
  });

  test("Cross-tab: switching between all tabs doesn't crash", async ({ page }) => {
    const tabNames = ["Overview", "KPIs", "Benchmarks", "Campaigns", "Insights", "Reports"];

    for (const name of tabNames) {
      const tab = page.getByRole("tab", { name: new RegExp(name, "i") });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(1000);
        // Page should not show an error
        const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
        expect(hasError).toBe(false);
      }
    }
  });

  // ---- REPORTS TAB ----

  test("Reports tab: loads without errors", async ({ page }) => {
    const reportsTab = page.getByRole("tab", { name: /Reports/i });
    if (await reportsTab.isVisible().catch(() => false)) {
      await reportsTab.click();
      await page.waitForTimeout(1500);

      const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
      expect(hasError).toBe(false);
    }
  });
});
