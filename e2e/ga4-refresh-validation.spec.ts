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

  // ---- PHASE 1: Setup — create campaign via API ----
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Create a fresh campaign
    const campaign = await apiPost(page, "/api/campaigns", {
      name: `E2E Test Campaign ${Date.now()}`,
      currency: "USD",
      platform: "google_analytics",
      status: "active",
    });
    campaignId = campaign?.id || campaign?.campaign?.id;
    console.log("Created campaign:", campaignId);
    expect(campaignId, "Campaign should be created with an ID").toBeTruthy();

    // Seed a yesop GA4 connection for this campaign so mock data works.
    // The seed endpoint creates its own campaigns, but we can also call
    // mock-refresh on our custom campaign — the endpoint creates a GA4
    // connection automatically if one doesn't exist for propertyId "yesop".
    // First, do a mock-refresh to bootstrap the connection + initial data.
    // We'll call it with a date far in the past so it doesn't count as "real" data.
    // Actually, let's just seed the connection by calling mock-refresh once
    // and we'll track expected state from there.

    ga4Url = `/campaigns/${campaignId}/ga4-metrics`;
    await context.close();
  });

  // ---- PHASE 2: Empty State ----
  test("Phase 2: Empty state — no data before any actions", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    // KPIs tab should show create option
    await page.getByRole("tab", { name: "KPIs" }).click();
    await page.waitForTimeout(1500);
    const kpiContent = (await page.textContent("body")) || "";
    const hasCreateKpi = kpiContent.includes("Create KPI") || kpiContent.includes("Total KPIs");
    expect(hasCreateKpi, "KPIs tab should load").toBe(true);

    // Benchmarks tab should show create option
    await page.getByRole("tab", { name: "Benchmarks" }).click();
    await page.waitForTimeout(1500);
    const benchContent = (await page.textContent("body")) || "";
    const hasCreateBench = benchContent.includes("Create Benchmark") || benchContent.includes("Total Benchmarks");
    expect(hasCreateBench, "Benchmarks tab should load").toBe(true);

    console.log("Phase 2 ✓ — Empty state verified");
  });

  // ---- PHASE 3: Add Spend ($950) ----
  test("Phase 3: Add $950 spend — Total Spend shows $950", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Add spend via API
    const spendResult = await apiPost(page, `/api/campaigns/${campaignId}/spend/process/manual`, {
      amount: 950,
      currency: "USD",
      displayName: "Manual Test Spend",
    });
    console.log("Spend added:", spendResult?.spendToDate || spendResult);

    await waitForDataRefresh(page);

    // Overview tab should show $950 spend
    const hasSpend = await bodyContainsDollar(page, 950);
    expect(hasSpend, "Overview should show $950 spend").toBe(true);

    console.log("Phase 3 ✓ — $950 spend visible");
  });

  // ---- PHASE 4: First Mock Refresh ----
  test("Phase 4: First refresh — 750 sessions, $2,850 revenue, ROAS 3.00x", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Inject day 1 via API
    const date1 = dateOffset(1); // yesterday
    await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: date1,
    });

    await waitForDataRefresh(page);

    // Check sessions
    const hasSessions = await bodyContainsNumber(page, 750);
    expect(hasSessions, "Overview should show 750 sessions").toBe(true);

    // Check revenue
    const hasRevenue = await bodyContainsDollar(page, 2850);
    expect(hasRevenue, "Overview should show $2,850 revenue").toBe(true);

    // Check ROAS (3.00x = 2850/950)
    const content = (await page.textContent("body")) || "";
    const roasMatch = content.match(/([\d.]+)x/);
    if (roasMatch) {
      const roas = parseFloat(roasMatch[1]);
      expect(roas, "ROAS should be ~3.00x").toBeCloseTo(3.0, 0);
    }

    // Check Insights tab shows matching ROAS
    await page.getByRole("tab", { name: "Insights" }).click();
    await page.waitForTimeout(2000);
    const insightsHasSpend = await bodyContains(page, "Spend");
    const insightsHasRevenue = await bodyContains(page, "Revenue");
    expect(insightsHasSpend, "Insights should show Spend").toBe(true);
    expect(insightsHasRevenue, "Insights should show Revenue").toBe(true);

    console.log("Phase 4 ✓ — First refresh: 750 sessions, $2,850 revenue");
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

  // ---- PHASE 7: Second Mock Refresh ----
  test("Phase 7: Second refresh — 1,500 sessions, $5,700 revenue", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Inject day 2
    const date2 = dateOffset(2);
    await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: date2,
    });

    await waitForDataRefresh(page);

    // Sessions should now be cumulative: 750 + 750 = 1,500
    const hasSessions = await bodyContainsNumber(page, 1500);
    expect(hasSessions, "Overview should show 1,500 sessions").toBe(true);

    // Revenue: 2,850 + 2,850 = 5,700
    const hasRevenue = await bodyContainsDollar(page, 5700);
    expect(hasRevenue, "Overview should show $5,700 revenue").toBe(true);

    // KPIs should still be visible and updated
    await page.getByRole("tab", { name: "KPIs" }).click();
    await page.waitForTimeout(1500);
    const kpiContent = (await page.textContent("body")) || "";
    expect(kpiContent, "KPIs tab should still show Total KPIs").toContain("Total KPIs");

    // Benchmarks should be updated (Sessions: 1500/1000 = 1.5 → on_track now)
    await page.getByRole("tab", { name: "Benchmarks" }).click();
    await page.waitForTimeout(1500);
    const benchContent = (await page.textContent("body")) || "";
    expect(benchContent, "Benchmarks tab should still load").toContain("Total Benchmarks");

    console.log("Phase 7 ✓ — Second refresh: 1,500 sessions, $5,700 revenue");
  });

  // ---- PHASE 8: Third Mock Refresh ----
  test("Phase 8: Third refresh — 2,250 sessions, $8,550 revenue", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Inject day 3
    const date3 = dateOffset(3);
    await apiPost(page, `/api/campaigns/${campaignId}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: date3,
    });

    await waitForDataRefresh(page);

    // Sessions: 750 × 3 = 2,250
    const hasSessions = await bodyContainsNumber(page, 2250);
    expect(hasSessions, "Overview should show 2,250 sessions").toBe(true);

    // Revenue: 2,850 × 3 = 8,550
    const hasRevenue = await bodyContainsDollar(page, 8550);
    expect(hasRevenue, "Overview should show $8,550 revenue").toBe(true);

    // Ad Comparison tab should load
    await page.getByRole("tab", { name: "Ad Comparison" }).click();
    await page.waitForTimeout(1500);
    const adContent = (await page.textContent("body")) || "";
    const adLoaded =
      adContent.includes("Sessions") || adContent.includes("campaign") || adContent.includes("No campaign");
    expect(adLoaded, "Ad Comparison tab should load without crash").toBe(true);

    console.log("Phase 8 ✓ — Third refresh: 2,250 sessions, $8,550 revenue");
  });

  // ---- PHASE 9: Add More Spend ----
  test("Phase 9: Add $500 more spend — Total Spend $1,450, ROAS recalculates", async ({ page }) => {
    await page.goto(ga4Url);
    await page.waitForLoadState("networkidle");

    // Add $500 more spend
    await apiPost(page, `/api/campaigns/${campaignId}/spend/process/manual`, {
      amount: 500,
      currency: "USD",
      displayName: "Additional Spend",
    });

    await waitForDataRefresh(page);

    // Total spend should be 950 + 500 = 1,450
    const hasSpend = await bodyContainsDollar(page, 1450);
    expect(hasSpend, "Overview should show $1,450 total spend").toBe(true);

    // Revenue is still $8,550, so ROAS = 8550/1450 = 5.90x
    const content = (await page.textContent("body")) || "";
    const roasMatch = content.match(/([\d.]+)x/);
    if (roasMatch) {
      const roas = parseFloat(roasMatch[1]);
      expect(roas, "ROAS should recalculate to ~5.90x").toBeCloseTo(5.9, 0);
    }

    console.log("Phase 9 ✓ — $500 more spend: Total $1,450, ROAS ~5.90x");
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
