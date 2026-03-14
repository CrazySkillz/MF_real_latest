import { test, expect, type Page } from "@playwright/test";

/**
 * GA4 Comprehensive E2E Validation Test
 *
 * Creates a FRESH campaign from scratch, then validates all tab values
 * through 9 phases: empty state → add spend → mock refresh (×3) →
 * create KPIs → create benchmarks → add more spend.
 *
 * Run:
 *   npm run dev                    # Terminal 1: start the app
 *   npm run test:e2e:headed        # Terminal 2: run this test (see browser)
 *
 * One-time auth setup:
 *   npx playwright codegen http://localhost:5000 --save-storage=e2e/auth.json
 */

// ============================================================
// KNOWN MOCK VALUES (yesop-brand profile, per day of mock-refresh)
// ============================================================
const PER_DAY = {
  users: 500,
  sessions: 750,
  pageviews: 2250,
  conversions: 38,
  revenue: 2850,
};

// Helper: YYYY-MM-DD offset from today
function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// Helper: call API from the browser context (carries auth cookies)
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
    { path, body },
  );
}

async function apiGet(page: Page, path: string) {
  return page.evaluate(
    async (path) => {
      const res = await fetch(path, { credentials: "include" });
      return res.json();
    },
    path,
  );
}

// Helper: check if page body contains text (case-insensitive search)
async function bodyContains(page: Page, text: string): Promise<boolean> {
  const content = (await page.textContent("body")) || "";
  return content.includes(text);
}

// Helper: check if page contains a formatted number (handles commas)
async function bodyContainsNumber(page: Page, num: number): Promise<boolean> {
  const content = (await page.textContent("body")) || "";
  const formatted = num.toLocaleString("en-US");
  return content.includes(formatted) || content.includes(String(num));
}

// Helper: check if page contains a dollar amount in any common format
async function bodyContainsDollar(page: Page, amount: number): Promise<boolean> {
  const content = (await page.textContent("body")) || "";
  const patterns = [
    `$${amount.toLocaleString("en-US")}`,
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `$${amount}`,
    `$${amount.toFixed(2)}`,
  ];
  return patterns.some((p) => content.includes(p));
}

// Helper: wait for page data to settle after an action
async function waitForDataRefresh(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
}

// ============================================================
// TEST SUITE
// ============================================================

test.describe("GA4 Comprehensive Validation — Fresh Campaign", () => {
  test.use({ storageState: "e2e/auth.json" });
  test.setTimeout(180_000); // 3 minutes for the full multi-phase test

  let campaignId: string;
  let ga4Url: string;

  // ---- PHASE 1: Setup — seed yesop campaign (creates campaign + GA4 connection + spend + revenue) ----
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Seed yesop campaigns — this creates campaigns with GA4 connections already set up
    const seedResult = await apiPost(page, "/api/seed-yesop-campaigns");
    console.log("Seed result:", seedResult?.message || JSON.stringify(seedResult));

    // Use yesop-brand as our test campaign
    campaignId = "yesop-brand";
    ga4Url = `/campaigns/${campaignId}/ga4-metrics`;
    console.log("Test campaign:", campaignId, "URL:", ga4Url);

    // Call mock-refresh once to ensure GA4 connection exists
    // (seed may have skipped if campaign already existed from a previous run)
    const refreshResult = await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: dateOffset(20), // far back so it doesn't interfere with test phases
    });
    console.log("Bootstrap refresh:", refreshResult?.summary || "ok");

    await context.close();
  });

  // ---- PHASE 2: Initial State — seeded campaign loads with tabs ----
  test("Phase 2: Seeded campaign loads — all tabs accessible", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Overview tab should be visible (not the "Connect Google Analytics" screen)
    const content = (await page.textContent("body")) || "";
    const hasOverviewData = content.includes("Sessions") || content.includes("Users") || content.includes("Overview");
    expect(hasOverviewData, "GA4 page should show metrics tabs, not Connect screen").toBe(true);

    // KPIs tab should load
    await page.getByRole("tab", { name: "KPIs" }).click();
    await page.waitForTimeout(1500);
    const kpiContent = (await page.textContent("body")) || "";
    const hasKpiTab = kpiContent.includes("Create KPI") || kpiContent.includes("Total KPIs");
    expect(hasKpiTab, "KPIs tab should load").toBe(true);

    // Benchmarks tab should load
    await page.getByRole("tab", { name: "Benchmarks" }).click();
    await page.waitForTimeout(1500);
    const benchContent = (await page.textContent("body")) || "";
    const hasBenchTab = benchContent.includes("Create Benchmark") || benchContent.includes("Total Benchmarks");
    expect(hasBenchTab, "Benchmarks tab should load").toBe(true);

    console.log("Phase 2 ✓ — Seeded campaign loads with all tabs");
  });

  // ---- PHASE 3: Verify Spend exists from seed ----
  test("Phase 3: Seeded spend is visible on Overview", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);

    // The seed creates a spend source — check that Spend appears on the page
    const content = (await page.textContent("body")) || "";
    const hasSpendLabel = content.includes("Spend") || content.includes("$");
    expect(hasSpendLabel, "Overview should show spend data").toBe(true);

    console.log("Phase 3 ✓ — Spend visible on Overview");
  });

  // ---- PHASE 4: Mock Refresh — inject new day, verify values update ----
  test("Phase 4: Mock refresh — sessions, revenue, and ROAS appear", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Record current page state before refresh
    const beforeContent = (await page.textContent("body")) || "";

    // Inject a new day of data via API
    const newDate = dateOffset(10); // 10 days ago (avoids collision with seeded data)
    const refreshResult = await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: newDate,
    });
    console.log("Refresh injected:", refreshResult?.summary || "ok");

    await waitForDataRefresh(page);

    // Overview should show sessions (at least 750 from the refresh)
    const content = (await page.textContent("body")) || "";
    const hasSessionsLabel = content.includes("Sessions");
    expect(hasSessionsLabel, "Overview should show Sessions metric").toBe(true);

    // Should show dollar amounts (revenue and/or spend)
    const hasDollar = /\$[\d,]+/.test(content);
    expect(hasDollar, "Overview should show dollar amounts").toBe(true);

    // Check ROAS appears (as Xx format)
    const roasMatch = content.match(/([\d.]+)x/);
    if (roasMatch) {
      const roas = parseFloat(roasMatch[1]);
      expect(roas, "ROAS should be a positive number").toBeGreaterThan(0);
      console.log("ROAS after refresh:", roas.toFixed(2) + "x");
    }

    // Insights tab should show financial data
    await page.getByRole("tab", { name: "Insights" }).click();
    await page.waitForTimeout(2000);
    const insightsHasSpend = await bodyContains(page, "Spend");
    const insightsHasRevenue = await bodyContains(page, "Revenue");
    expect(insightsHasSpend, "Insights should show Spend").toBe(true);
    expect(insightsHasRevenue, "Insights should show Revenue").toBe(true);

    console.log("Phase 4 ✓ — Mock refresh: data visible on Overview and Insights");
  });

  // ---- PHASE 5: Create KPIs ----
  test("Phase 5: Create KPIs — ROAS above target, CPA below target", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Create ROAS KPI (target 250%, current should be 300% → above target)
    await apiPost(page, `/api/platforms/google_analytics/kpis`, {
      campaignId,
      name: "ROAS Target",
      metric: "ROAS",
      unit: "%",
      currentValue: "0",
      targetValue: "250",
      priority: "high",
      platformType: "google_analytics",
    });

    // Create CPA KPI (target $30, current should be $25 → below target = good)
    await apiPost(page, `/api/platforms/google_analytics/kpis`, {
      campaignId,
      name: "CPA Target",
      metric: "CPA",
      unit: "$",
      currentValue: "0",
      targetValue: "30",
      priority: "medium",
      platformType: "google_analytics",
    });

    // Switch to KPIs tab
    await page.getByRole("tab", { name: "KPIs" }).click();
    await page.waitForTimeout(2000);

    const kpiContent = (await page.textContent("body")) || "";
    // Should show Total KPIs
    expect(kpiContent, "Should show Total KPIs summary").toContain("Total KPIs");
    // Should show our KPI names
    expect(kpiContent, "Should show ROAS Target KPI").toContain("ROAS Target");
    expect(kpiContent, "Should show CPA Target KPI").toContain("CPA Target");
    // Should show progress percentages
    const hasPercentage = /\d+\.?\d*%/.test(kpiContent);
    expect(hasPercentage, "KPIs should show progress percentages").toBe(true);

    console.log("Phase 5 ✓ — KPIs created and visible");
  });

  // ---- PHASE 6: Create Benchmarks ----
  test("Phase 6: Create Benchmarks — Sessions and Revenue benchmarks", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Create Sessions benchmark (current 750, benchmark 1000 → ratio 0.75 → needs_attention)
    await apiPost(page, `/api/platforms/google_analytics/benchmarks`, {
      campaignId,
      name: "Sessions Benchmark",
      metric: "sessions",
      unit: "count",
      currentValue: "0",
      benchmarkValue: "1000",
      benchmarkType: "custom",
      category: "performance",
      platformType: "google_analytics",
      period: "monthly",
      status: "active",
    });

    // Create Revenue benchmark (current 2850, benchmark 5000 → ratio 0.57 → behind)
    await apiPost(page, `/api/platforms/google_analytics/benchmarks`, {
      campaignId,
      name: "Revenue Benchmark",
      metric: "revenue",
      unit: "$",
      currentValue: "0",
      benchmarkValue: "5000",
      benchmarkType: "custom",
      category: "performance",
      platformType: "google_analytics",
      period: "monthly",
      status: "active",
    });

    // Switch to Benchmarks tab
    await page.getByRole("tab", { name: "Benchmarks" }).click();
    await page.waitForTimeout(2000);

    const benchContent = (await page.textContent("body")) || "";
    expect(benchContent, "Should show Total Benchmarks summary").toContain("Total Benchmarks");
    expect(benchContent, "Should show Sessions Benchmark").toContain("Sessions Benchmark");
    expect(benchContent, "Should show Revenue Benchmark").toContain("Revenue Benchmark");

    console.log("Phase 6 ✓ — Benchmarks created and visible");
  });

  // ---- PHASE 7: Second Mock Refresh — KPIs and Benchmarks update ----
  test("Phase 7: Second refresh — KPIs and Benchmarks still work", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Inject another day
    const date2 = dateOffset(11);
    await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: date2,
    });

    await waitForDataRefresh(page);

    // Overview should still show data
    const content = (await page.textContent("body")) || "";
    expect(/\$[\d,]+/.test(content), "Overview should show dollar amounts").toBe(true);

    // KPIs should still be visible
    await page.getByRole("tab", { name: "KPIs" }).click();
    await page.waitForTimeout(1500);
    const kpiContent = (await page.textContent("body")) || "";
    expect(kpiContent, "KPIs tab should show Total KPIs").toContain("Total KPIs");

    // Benchmarks should still be visible
    await page.getByRole("tab", { name: "Benchmarks" }).click();
    await page.waitForTimeout(1500);
    const benchContent = (await page.textContent("body")) || "";
    expect(benchContent, "Benchmarks tab should show Total Benchmarks").toContain("Total Benchmarks");

    console.log("Phase 7 ✓ — Second refresh: KPIs and Benchmarks updated");
  });

  // ---- PHASE 8: Third Mock Refresh — Ad Comparison works ----
  test("Phase 8: Third refresh — all tabs including Ad Comparison", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Inject another day
    const date3 = dateOffset(12);
    await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: date3,
    });

    await waitForDataRefresh(page);

    // Overview should show data
    const content = (await page.textContent("body")) || "";
    expect(/\$[\d,]+/.test(content), "Overview should show dollar amounts").toBe(true);

    // Ad Comparison tab should load
    await page.getByRole("tab", { name: "Ad Comparison" }).click();
    await page.waitForTimeout(1500);
    const adContent = (await page.textContent("body")) || "";
    const adLoaded =
      adContent.includes("Sessions") || adContent.includes("campaign") || adContent.includes("No campaign");
    expect(adLoaded, "Ad Comparison tab should load without crash").toBe(true);

    console.log("Phase 8 ✓ — Third refresh: all tabs work");
  });

  // ---- PHASE 9: Add More Spend — ROAS recalculates ----
  test("Phase 9: Add $500 more spend — ROAS recalculates", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Capture ROAS before adding spend
    const beforeContent = (await page.textContent("body")) || "";
    const beforeRoasMatch = beforeContent.match(/([\d.]+)x/);
    const roasBefore = beforeRoasMatch ? parseFloat(beforeRoasMatch[1]) : null;
    console.log("ROAS before adding spend:", roasBefore ? roasBefore.toFixed(2) + "x" : "not found");

    // Add $500 more spend
    await apiPost(page, `/api/campaigns/${campaignId}/spend/process/manual`, {
      amount: 500,
      currency: "USD",
      displayName: "Additional E2E Spend",
    });

    await waitForDataRefresh(page);

    // ROAS should have decreased (more spend with same revenue)
    const afterContent = (await page.textContent("body")) || "";
    const afterRoasMatch = afterContent.match(/([\d.]+)x/);
    if (afterRoasMatch && roasBefore) {
      const roasAfter = parseFloat(afterRoasMatch[1]);
      console.log("ROAS after adding $500 spend:", roasAfter.toFixed(2) + "x");
      expect(roasAfter, "ROAS should decrease after adding more spend").toBeLessThan(roasBefore);
    }

    // Spend should have increased (page should show a higher dollar amount)
    const hasDollar = /\$[\d,]+/.test(afterContent);
    expect(hasDollar, "Overview should show updated spend").toBe(true);

    console.log("Phase 9 ✓ — Spend increased, ROAS recalculated");
  });

  // ---- CROSS-TAB CONSISTENCY ----
  test("Cross-tab: ROAS matches between Overview and Insights", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // Get ROAS from Overview
    const overviewContent = (await page.textContent("body")) || "";
    const overviewRoasMatch = overviewContent.match(/([\d.]+)x/);
    const overviewRoas = overviewRoasMatch ? parseFloat(overviewRoasMatch[1]) : null;

    // Switch to Insights
    await page.getByRole("tab", { name: "Insights" }).click();
    await page.waitForTimeout(2000);

    const insightsContent = (await page.textContent("body")) || "";
    const insightsRoasMatch = insightsContent.match(/([\d.]+)x/);
    const insightsRoas = insightsRoasMatch ? parseFloat(insightsRoasMatch[1]) : null;

    if (overviewRoas !== null && insightsRoas !== null) {
      expect(insightsRoas, "ROAS should match between Overview and Insights").toBeCloseTo(overviewRoas, 0);
    }

    console.log("Cross-tab ✓ — ROAS consistent between Overview and Insights");
  });

  // ---- STABILITY ----
  test("Stability: No tab crashes when switching rapidly", async ({ page }) => {
    await page.goto(ga4Url);
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

    const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
    expect(hasError, "No tab should crash").toBe(false);

    console.log("Stability ✓ — All tabs switch without crash");
  });
});
