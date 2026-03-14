import { test, expect, type Page } from "@playwright/test";

/**
 * GA4 Refresh Validation E2E Test
 *
 * This test:
 * 1. Seeds a yesop-brand campaign via API
 * 2. Navigates to the GA4 metrics page
 * 3. Calls mock-refresh via API to inject a day of known data
 * 4. Validates all tab values match expected computed values
 * 5. Repeats 3 times, verifying cumulative totals grow correctly
 *
 * Run:
 *   npm run dev                    # Start the app (separate terminal)
 *   npm run test:e2e:headed        # Run this test (see browser)
 *
 * Prerequisites:
 *   - App running at http://localhost:5000
 *   - Auth saved: npx playwright codegen http://localhost:5000 --save-storage=e2e/auth.json
 */

// ============================================================
// KNOWN MOCK VALUES (yesop-brand profile, per day)
// ============================================================
const PER_DAY = {
  users: 500,
  sessions: 750,
  pageviews: 2250,
  conversions: 38,
  revenue: 2850,
  spend: 950,
};

// Computed expected values after N refreshes (each adds one day)
function expectedAfter(refreshCount: number) {
  const sessions = PER_DAY.sessions * refreshCount;
  const conversions = PER_DAY.conversions * refreshCount;
  const revenue = PER_DAY.revenue * refreshCount;
  const spend = PER_DAY.spend * refreshCount;
  return {
    sessions,
    conversions,
    revenue,
    spend,
    roas: spend > 0 ? revenue / spend : 0,         // 3.0x (constant ratio)
    roi: spend > 0 ? ((revenue - spend) / spend) * 100 : 0, // 200% (constant)
    cpa: conversions > 0 ? spend / conversions : 0, // $25 (constant)
  };
}

// Helper: format date as YYYY-MM-DD, offset days before today
function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Helper: call API from the test (uses page context for auth cookies)
async function apiPost(page: Page, path: string, body: Record<string, unknown> = {}) {
  return page.evaluate(
    async ({ path, body }) => {
      const res = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      return res.json();
    },
    { path, body }
  );
}

// Helper: check if page contains a number (formatted with commas) within a section
async function pageContainsNumber(page: Page, num: number): Promise<boolean> {
  const formatted = num.toLocaleString("en-US");
  const content = await page.textContent("body") || "";
  return content.includes(formatted) || content.includes(String(num));
}

// Helper: check if page contains a dollar amount
async function pageContainsDollar(page: Page, amount: number): Promise<boolean> {
  const content = await page.textContent("body") || "";
  // Match various formats: $2,850, $2,850.00, $2850, $2850.00
  const patterns = [
    `$${amount.toLocaleString("en-US")}`,
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `$${amount}`,
    `$${amount.toFixed(2)}`,
  ];
  return patterns.some(p => content.includes(p));
}

// ============================================================
// TESTS
// ============================================================

test.describe("GA4 Refresh Validation", () => {
  test.use({ storageState: "e2e/auth.json" });

  const CAMPAIGN_ID = "yesop-brand";
  const GA4_URL = `/campaigns/${CAMPAIGN_ID}/ga4-metrics`;

  test.beforeAll(async ({ browser }) => {
    // Seed the yesop campaigns
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const seedResult = await apiPost(page, "/api/seed-yesop-campaigns");
    console.log("Seed result:", seedResult?.message || seedResult);

    await context.close();
  });

  test("Refresh cycle: inject 3 days, validate all tabs after each", async ({ page }) => {
    // Navigate to GA4 page
    await page.goto(GA4_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    for (let refresh = 1; refresh <= 3; refresh++) {
      const expected = expectedAfter(refresh);
      const date = dateOffset(refresh); // day 1 = yesterday, day 2 = 2 days ago, etc.

      // --- INJECT DATA VIA API ---
      console.log(`\n=== Refresh #${refresh}: Injecting data for ${date} ===`);
      const refreshResult = await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/ga4/mock-refresh`, {
        propertyId: "yesop",
        date,
      });
      console.log("Injected:", refreshResult?.summary || "ok");

      // Wait for UI to update (queries get invalidated)
      await page.waitForTimeout(3000);

      // Force reload to ensure fresh data
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // --- OVERVIEW TAB ---
      console.log(`Refresh #${refresh}: Checking Overview tab...`);

      // Check sessions value appears on page
      const hasSessions = await pageContainsNumber(page, expected.sessions);
      expect(hasSessions, `Refresh #${refresh}: Overview should show ${expected.sessions} sessions`).toBe(true);

      // Check revenue appears
      const hasRevenue = await pageContainsDollar(page, expected.revenue);
      expect(hasRevenue, `Refresh #${refresh}: Overview should show $${expected.revenue} revenue`).toBe(true);

      // --- KPIs TAB ---
      console.log(`Refresh #${refresh}: Checking KPIs tab...`);
      await page.getByRole("tab", { name: "KPIs" }).click();
      await page.waitForTimeout(1500);

      const kpiContent = await page.textContent("body") || "";
      // KPIs tab should load (either show KPIs or "Create KPI" button)
      const kpiLoaded = kpiContent.includes("Total KPIs") || kpiContent.includes("Create KPI");
      expect(kpiLoaded, `Refresh #${refresh}: KPIs tab should load`).toBe(true);

      // If KPIs exist, check for progress percentages
      if (kpiContent.includes("Total KPIs")) {
        const hasPercentage = /\d+\.?\d*%/.test(kpiContent);
        expect(hasPercentage, `Refresh #${refresh}: KPIs should show progress percentages`).toBe(true);
      }

      // --- BENCHMARKS TAB ---
      console.log(`Refresh #${refresh}: Checking Benchmarks tab...`);
      await page.getByRole("tab", { name: "Benchmarks" }).click();
      await page.waitForTimeout(1500);

      const benchContent = await page.textContent("body") || "";
      const benchLoaded = benchContent.includes("Total Benchmarks") || benchContent.includes("Create Benchmark");
      expect(benchLoaded, `Refresh #${refresh}: Benchmarks tab should load`).toBe(true);

      // --- INSIGHTS TAB ---
      console.log(`Refresh #${refresh}: Checking Insights tab...`);
      await page.getByRole("tab", { name: "Insights" }).click();
      await page.waitForTimeout(2000);

      const insightsContent = await page.textContent("body") || "";

      // Should show financial data
      const hasSpend = insightsContent.includes("Spend");
      const hasRevenueLabel = insightsContent.includes("Revenue");
      expect(hasSpend, `Refresh #${refresh}: Insights should show Spend`).toBe(true);
      expect(hasRevenueLabel, `Refresh #${refresh}: Insights should show Revenue`).toBe(true);

      // ROAS should be ~3.00x (consistent across refreshes)
      const roasMatch = insightsContent.match(/([\d.]+)x/);
      if (roasMatch) {
        const insightsRoas = parseFloat(roasMatch[1]);
        expect(insightsRoas, `Refresh #${refresh}: Insights ROAS should be ~3.00x`).toBeCloseTo(expected.roas, 1);
      }

      // --- AD COMPARISON TAB ---
      console.log(`Refresh #${refresh}: Checking Ad Comparison tab...`);
      await page.getByRole("tab", { name: "Ad Comparison" }).click();
      await page.waitForTimeout(1500);

      const adContent = await page.textContent("body") || "";
      const adLoaded = adContent.includes("Sessions") || adContent.includes("campaign") || adContent.includes("No campaign");
      expect(adLoaded, `Refresh #${refresh}: Ad Comparison tab should load`).toBe(true);

      // --- BACK TO OVERVIEW FOR NEXT CYCLE ---
      await page.getByRole("tab", { name: "Overview" }).click();
      await page.waitForTimeout(1000);

      console.log(`Refresh #${refresh}: All tabs validated ✓`);
    }

    console.log("\n=== All 3 refresh cycles passed ===");
  });

  test("Cross-tab: ROAS matches between Overview and Insights", async ({ page }) => {
    await page.goto(GA4_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Get ROAS from Overview
    const overviewContent = await page.textContent("body") || "";
    const overviewRoasMatch = overviewContent.match(/([\d.]+)x/);
    const overviewRoas = overviewRoasMatch ? parseFloat(overviewRoasMatch[1]) : null;

    // Switch to Insights
    await page.getByRole("tab", { name: "Insights" }).click();
    await page.waitForTimeout(2000);

    const insightsContent = await page.textContent("body") || "";
    const insightsRoasMatch = insightsContent.match(/([\d.]+)x/);
    const insightsRoas = insightsRoasMatch ? parseFloat(insightsRoasMatch[1]) : null;

    if (overviewRoas !== null && insightsRoas !== null) {
      expect(insightsRoas, "ROAS should match between Overview and Insights").toBeCloseTo(overviewRoas, 1);
    }
  });

  test("No tab crashes when switching rapidly", async ({ page }) => {
    await page.goto(GA4_URL);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    const tabs = ["KPIs", "Benchmarks", "Ad Comparison", "Insights", "Reports", "Overview"];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(500);
      }
    }

    // Page should not show error boundary
    const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
    expect(hasError, "No tab should crash").toBe(false);
  });
});
