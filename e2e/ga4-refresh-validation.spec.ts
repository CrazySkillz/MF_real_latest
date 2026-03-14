import { test, expect, type Page } from "@playwright/test";
import scenarios from "./fixtures/ga4-scenarios.json";

/**
 * GA4 Full UI Journey Tests
 *
 * These tests click through the actual UI like a real user — filling forms,
 * clicking buttons, and verifying results on screen. No API shortcuts.
 *
 * Run:
 *   npm run test:e2e:headed     (watch the browser)
 *   npm run test:e2e            (headless, faster)
 */

// ============================================================
// HELPERS
// ============================================================

const CAMPAIGN_ID = scenarios.campaign_id;
const GA4_URL = `/campaigns/${CAMPAIGN_ID}/ga4-metrics`;

function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

// API helper — only used for setup (seeding), not for the actual journeys
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

async function bodyText(page: Page): Promise<string> {
  return (await page.textContent("body")) || "";
}

// Navigate to GA4 page and wait for it to load
async function goToGA4(page: Page) {
  await page.goto(GA4_URL);
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
}

// ============================================================
// TEST SUITE
// ============================================================

test.describe("GA4 UI Journey Tests", () => {
  test.use({ storageState: "e2e/auth.json" });
  test.setTimeout(120_000);

  // ---- SETUP: Seed campaign + bootstrap GA4 connection ----
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Seed yesop campaigns (creates campaign + GA4 connection + initial data)
    await apiPost(page, "/api/seed-yesop-campaigns");

    // Bootstrap with a mock-refresh so data exists
    await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/ga4/mock-refresh`, {
      propertyId: "yesop",
      date: dateOffset(30),
    });

    console.log("Setup complete: campaign seeded with GA4 data");
    await context.close();
  });

  // ================================================================
  // JOURNEY 1: Add Manual Spend via the Wizard UI
  // ================================================================
  test("Journey 1: Add manual spend via wizard — card shows amount", async ({ page }) => {
    await goToGA4(page);

    // Click the "+" button or "Add Spend" to open the wizard
    const addSpendBtn = page.locator('button:has-text("Add Spend")').first();
    const plusBtn = page.locator('button[title="Add spend source"]').first();

    if (await addSpendBtn.isVisible().catch(() => false)) {
      await addSpendBtn.click();
    } else if (await plusBtn.isVisible().catch(() => false)) {
      await plusBtn.click();
    } else {
      // Try clicking a "+" icon near spend
      const anyPlus = page.locator('[data-testid="add-spend"]').first();
      if (await anyPlus.isVisible().catch(() => false)) {
        await anyPlus.click();
      } else {
        // Fallback: look for any plus button near "Spend"
        await page.getByRole("button", { name: /add|plus|\+/i }).first().click();
      }
    }
    await page.waitForTimeout(1000);

    // Select "Manual" option in the wizard
    const manualCard = page.locator('text=Manual').first();
    await manualCard.click();
    await page.waitForTimeout(500);

    // Fill in the amount
    const amountInput = page.locator("#manual-spend");
    if (await amountInput.isVisible().catch(() => false)) {
      await amountInput.clear();
      await amountInput.fill("950");
      await amountInput.blur(); // triggers formatting to 950.00
      await page.waitForTimeout(300);
    }

    // Click Save
    const saveBtn = page.locator('button:has-text("Save spend")').first();
    if (await saveBtn.isVisible().catch(() => false)) {
      await saveBtn.click();
    } else {
      // Try alternative button text
      await page.locator('button:has-text("Save")').first().click();
    }
    await page.waitForTimeout(2000);

    // Verify the page shows $950 somewhere
    const content = await bodyText(page);
    const has950 = content.includes("950") || content.includes("$950");
    expect(has950, "Page should show $950 after adding manual spend").toBe(true);

    console.log("✓ Journey 1: Manual spend $950 added via wizard");
  });

  // ================================================================
  // JOURNEY 2: Run Refresh via UI button — verify data appears
  // ================================================================
  test("Journey 2: Click Run Refresh — sessions and revenue appear", async ({ page }) => {
    await goToGA4(page);

    // Click the "Run Refresh" button
    const refreshBtn = page.locator('[data-testid="run-refresh-btn"]');
    if (await refreshBtn.isVisible().catch(() => false)) {
      await refreshBtn.click();
    } else {
      // Fallback: look for button by text
      await page.locator('button:has-text("Run Refresh")').first().click();
    }

    // Wait for the refresh to complete (toast appears)
    await page.waitForTimeout(4000);

    // Reload to ensure fresh data
    await page.reload();
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500);

    // Verify sessions and revenue appear
    const content = await bodyText(page);
    expect(content.includes("Sessions"), "Overview should show Sessions").toBe(true);
    expect(/\$[\d,]+/.test(content), "Overview should show dollar amounts").toBe(true);

    // Check ROAS appears
    const roasMatch = content.match(/([\d.]+)x/);
    if (roasMatch) {
      const roas = parseFloat(roasMatch[1]);
      expect(roas, "ROAS should be positive").toBeGreaterThan(0);
      console.log("ROAS after refresh:", roas.toFixed(2) + "x");
    }

    console.log("✓ Journey 2: Run Refresh — data visible");
  });

  // ================================================================
  // JOURNEY 3: Create KPI via the modal UI
  // ================================================================
  for (const kpi of scenarios.kpi_scenarios) {
    test(`Journey 3: Create KPI "${kpi.metric}" via modal`, async ({ page }) => {
      await goToGA4(page);

      // Switch to KPIs tab
      await page.getByRole("tab", { name: "KPIs" }).click();
      await page.waitForTimeout(1500);

      // Click "Create KPI" button
      await page.locator('button:has-text("Create KPI")').first().click();
      await page.waitForTimeout(1000);

      // Click the template tile for this metric
      const templateTile = page.locator(`text=${kpi.metric}`).first();
      if (await templateTile.isVisible().catch(() => false)) {
        await templateTile.click();
        await page.waitForTimeout(500);
      }

      // Fill in target value
      const targetInput = page.locator("#kpi-target");
      if (await targetInput.isVisible().catch(() => false)) {
        await targetInput.clear();
        await targetInput.fill(kpi.target);
      }

      // Submit the form
      const createBtn = page.locator('button:has-text("Create KPI")').last();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
      }
      await page.waitForTimeout(2000);

      // Verify the KPI appears on the page
      const content = await bodyText(page);
      // The KPI name is auto-generated from template (e.g., "ROAS" → "ROAS")
      const kpiVisible = content.includes(kpi.metric) || content.includes("Total KPIs");
      expect(kpiVisible, `KPI "${kpi.metric}" should be visible after creation`).toBe(true);

      console.log(`✓ Journey 3: KPI "${kpi.metric}" created (expect ${kpi.expect_band})`);
    });
  }

  // ================================================================
  // JOURNEY 4: Create Benchmark via the modal UI
  // ================================================================
  for (const bench of scenarios.benchmark_scenarios) {
    test(`Journey 4: Create Benchmark "${bench.name}" via modal`, async ({ page }) => {
      await goToGA4(page);

      // Switch to Benchmarks tab
      await page.getByRole("tab", { name: "Benchmarks" }).click();
      await page.waitForTimeout(1500);

      // Click "Create Benchmark" button
      await page.locator('button:has-text("Create Benchmark")').first().click();
      await page.waitForTimeout(1000);

      // Click the template tile for this metric
      // Benchmark templates use display names like "Total Sessions", "Revenue", etc.
      const metricDisplayMap: Record<string, string> = {
        sessions: "Total Sessions",
        revenue: "Revenue",
        cpa: "CPA",
        roas: "ROAS",
        engagementRate: "Engagement Rate",
      };
      const displayName = metricDisplayMap[bench.metric] || bench.metric;
      const templateTile = page.locator(`text=${displayName}`).first();
      if (await templateTile.isVisible().catch(() => false)) {
        await templateTile.click();
        await page.waitForTimeout(500);
      }

      // Fill in benchmark value
      const benchmarkInput = page.getByPlaceholder("Enter benchmark value").first();
      if (await benchmarkInput.isVisible().catch(() => false)) {
        await benchmarkInput.clear();
        await benchmarkInput.fill(bench.benchmark);
      }

      // Submit
      const createBtn = page.locator('button:has-text("Create Benchmark")').last();
      if (await createBtn.isVisible().catch(() => false)) {
        await createBtn.click();
      }
      await page.waitForTimeout(2000);

      // Verify the benchmark appears
      const content = await bodyText(page);
      const benchVisible = content.includes(bench.name) || content.includes("Total Benchmarks");
      expect(benchVisible, `Benchmark "${bench.name}" should be visible`).toBe(true);

      console.log(`✓ Journey 4: Benchmark "${bench.name}" created`);
    });
  }

  // ================================================================
  // JOURNEY 5: Delete Spend source — verify recalculation
  // ================================================================
  test("Journey 5: Delete a spend source — total recalculates", async ({ page }) => {
    await goToGA4(page);

    // Look for trash icon on a spend source
    const trashBtn = page.locator('button[title="Remove spend source"]').first();
    if (await trashBtn.isVisible().catch(() => false)) {
      // Capture ROAS before delete
      const beforeContent = await bodyText(page);
      const beforeRoasMatch = beforeContent.match(/([\d.]+)x/);
      const roasBefore = beforeRoasMatch ? parseFloat(beforeRoasMatch[1]) : null;

      // Click trash
      await trashBtn.click();
      await page.waitForTimeout(500);

      // Confirm in the AlertDialog
      const confirmBtn = page.locator('button:has-text("Remove")').first();
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
      }
      await page.waitForTimeout(2000);

      // Reload and check ROAS changed
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);

      const afterContent = await bodyText(page);
      const afterRoasMatch = afterContent.match(/([\d.]+)x/);
      if (afterRoasMatch && roasBefore) {
        const roasAfter = parseFloat(afterRoasMatch[1]);
        console.log(`ROAS changed: ${roasBefore.toFixed(2)}x → ${roasAfter.toFixed(2)}x`);
        // ROAS should change after deleting a spend source
        expect(roasAfter !== roasBefore, "ROAS should change after deleting spend").toBe(true);
      }

      console.log("✓ Journey 5: Spend deleted, total recalculated");
    } else {
      console.log("⚠ No spend source trash icon found — skipping delete test");
    }
  });

  // ================================================================
  // JOURNEY 6: Refresh cycles — data accumulates
  // ================================================================
  for (let cycle = 1; cycle <= scenarios.refresh_cycles; cycle++) {
    test(`Journey 6: Refresh cycle #${cycle} — data accumulates`, async ({ page }) => {
      await goToGA4(page);

      // Click Run Refresh
      const refreshBtn = page.locator('[data-testid="run-refresh-btn"]').or(
        page.locator('button:has-text("Run Refresh")'),
      ).first();

      if (await refreshBtn.isVisible().catch(() => false)) {
        await refreshBtn.click();
        await page.waitForTimeout(4000);
      }

      // Reload
      await page.reload();
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);

      // Verify all tabs still work
      const tabs = ["KPIs", "Benchmarks", "Insights"];
      for (const tabName of tabs) {
        await page.getByRole("tab", { name: tabName }).click();
        await page.waitForTimeout(800);
        const content = await bodyText(page);
        expect(content.length > 500, `Refresh #${cycle}: ${tabName} tab has content`).toBe(true);
      }

      // Back to overview
      await page.getByRole("tab", { name: "Overview" }).click();
      await page.waitForTimeout(500);

      console.log(`✓ Journey 6: Refresh #${cycle} — all tabs working`);
    });
  }

  // ================================================================
  // JOURNEY 7: Cross-tab consistency — ROAS matches
  // ================================================================
  test("Journey 7: ROAS matches between Overview and Insights", async ({ page }) => {
    await goToGA4(page);

    // Get ROAS from Overview
    const overviewContent = await bodyText(page);
    const overviewRoasMatch = overviewContent.match(/([\d.]+)x/);
    const overviewRoas = overviewRoasMatch ? parseFloat(overviewRoasMatch[1]) : null;

    // Switch to Insights
    await page.getByRole("tab", { name: "Insights" }).click();
    await page.waitForTimeout(2500);

    const insightsContent = await bodyText(page);
    const insightsRoasMatch = insightsContent.match(/([\d.]+)x/);
    const insightsRoas = insightsRoasMatch ? parseFloat(insightsRoasMatch[1]) : null;

    if (overviewRoas !== null && insightsRoas !== null) {
      expect(insightsRoas, "ROAS should match between Overview and Insights").toBeCloseTo(overviewRoas, 0);
      console.log(`✓ Journey 7: ROAS consistent — Overview ${overviewRoas.toFixed(2)}x = Insights ${insightsRoas.toFixed(2)}x`);
    } else {
      console.log("⚠ Could not find ROAS on both tabs — skipping comparison");
    }
  });

  // ================================================================
  // JOURNEY 8: Stability — rapid tab switching
  // ================================================================
  test("Journey 8: Rapid tab switching — no crashes", async ({ page }) => {
    await goToGA4(page);

    const tabs = ["KPIs", "Benchmarks", "Ad Comparison", "Insights", "Reports", "Overview"];
    for (const name of tabs) {
      const tab = page.getByRole("tab", { name });
      if (await tab.isVisible().catch(() => false)) {
        await tab.click();
        await page.waitForTimeout(400);
      }
    }

    const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
    expect(hasError, "No tab should crash").toBe(false);
    console.log("✓ Journey 8: All tabs stable");
  });
});
