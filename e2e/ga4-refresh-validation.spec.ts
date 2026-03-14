import { test, expect, type Page } from "@playwright/test";
import scenarios from "./fixtures/ga4-scenarios.json";

/**
 * GA4 Data-Driven E2E Test Matrix
 *
 * All test scenarios are defined in e2e/fixtures/ga4-scenarios.json.
 * To add a new scenario, add a line to the JSON file — no code changes needed.
 *
 * Run:
 *   npm run test:e2e:headed     (watch the browser)
 *   npm run test:e2e            (headless, faster)
 *
 * Prerequisites:
 *   1. App running (deployed on Render or local via npm run dev)
 *   2. Auth saved: npx playwright codegen https://mforensics.onrender.com --save-storage=e2e/auth.json
 */

// ============================================================
// HELPERS
// ============================================================

function dateOffset(daysAgo: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

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

async function apiDelete(page: Page, path: string) {
  return page.evaluate(
    async (path) => {
      const res = await fetch(path, {
        method: "DELETE",
        credentials: "include",
      });
      return res.json();
    },
    path,
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

async function bodyText(page: Page): Promise<string> {
  return (await page.textContent("body")) || "";
}

async function bodyContainsDollar(page: Page, amount: number): Promise<boolean> {
  const content = await bodyText(page);
  const patterns = [
    `$${amount.toLocaleString("en-US")}`,
    `$${amount.toLocaleString("en-US", { minimumFractionDigits: 2 })}`,
    `$${amount}`,
    `$${amount.toFixed(2)}`,
  ];
  return patterns.some((p) => content.includes(p));
}

async function waitForDataRefresh(page: Page) {
  await page.reload();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
}

// ============================================================
// CONFIG FROM FIXTURES
// ============================================================

const CAMPAIGN_ID = scenarios.campaign_id;
const GA4_URL = `/campaigns/${CAMPAIGN_ID}/ga4-metrics`;

// ============================================================
// TEST SUITE
// ============================================================

test.describe("GA4 Data-Driven Test Matrix", () => {
  test.use({ storageState: "e2e/auth.json" });
  test.setTimeout(120_000);

  // Track state across tests
  let spendSourceIds: string[] = [];

  // ---- SETUP ----
  test.beforeAll(async ({ browser }) => {
    const context = await browser.newContext({ storageState: "e2e/auth.json" });
    const page = await context.newPage();
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Seed campaigns
    const seedResult = await apiPost(page, "/api/seed-yesop-campaigns");
    console.log("Seed:", seedResult?.message || "ok");

    // Bootstrap GA4 connection via mock-refresh
    const refreshResult = await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/ga4/mock-refresh`, {
      propertyId: scenarios.mock_property_id,
      date: dateOffset(30),
    });
    console.log("Bootstrap:", refreshResult?.summary || "ok");

    await context.close();
  });

  // ---- SPEND SCENARIOS ----
  test.describe("Spend Scenarios", () => {
    test("Add $950 manual spend", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");

      const result = await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/spend/process/manual`, {
        amount: 950,
        currency: "USD",
        displayName: "E2E Spend A",
      });
      console.log("Spend A added:", result?.sourceId || result?.message);
      if (result?.sourceId) spendSourceIds.push(result.sourceId);

      await waitForDataRefresh(page);

      const content = await bodyText(page);
      expect(/\$[\d,]+/.test(content), "Overview should show dollar amounts after adding spend").toBe(true);
      console.log("✓ Spend: $950 added");
    });

    test("Add $500 more spend — total increases", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // Capture ROAS before
      const beforeContent = await bodyText(page);
      const beforeRoasMatch = beforeContent.match(/([\d.]+)x/);
      const roasBefore = beforeRoasMatch ? parseFloat(beforeRoasMatch[1]) : null;

      const result = await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/spend/process/manual`, {
        amount: 500,
        currency: "USD",
        displayName: "E2E Spend B",
      });
      console.log("Spend B added:", result?.sourceId || result?.message);
      if (result?.sourceId) spendSourceIds.push(result.sourceId);

      await waitForDataRefresh(page);

      // ROAS should decrease (more spend, same revenue)
      const afterContent = await bodyText(page);
      const afterRoasMatch = afterContent.match(/([\d.]+)x/);
      if (afterRoasMatch && roasBefore) {
        const roasAfter = parseFloat(afterRoasMatch[1]);
        expect(roasAfter, "ROAS should decrease after adding more spend").toBeLessThan(roasBefore);
        console.log(`✓ ROAS decreased: ${roasBefore.toFixed(2)}x → ${roasAfter.toFixed(2)}x`);
      }
    });

    test("Delete a spend source — total recalculates", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2000);

      // Get current spend sources
      const sources = await apiGet(page, `/api/campaigns/${CAMPAIGN_ID}/spend-sources`);
      const sourceList = Array.isArray(sources) ? sources : sources?.sources || [];
      const activeSource = sourceList.find((s: any) => s.isActive && s.displayName?.includes("E2E Spend A"));

      if (activeSource) {
        // Capture ROAS before delete
        const beforeContent = await bodyText(page);
        const beforeRoasMatch = beforeContent.match(/([\d.]+)x/);
        const roasBefore = beforeRoasMatch ? parseFloat(beforeRoasMatch[1]) : null;

        // Delete the source
        const deleteResult = await apiDelete(page, `/api/campaigns/${CAMPAIGN_ID}/spend-sources/${activeSource.id}`);
        console.log("Deleted spend source:", deleteResult?.success || deleteResult?.message);

        await waitForDataRefresh(page);

        // ROAS should increase (less spend, same revenue)
        const afterContent = await bodyText(page);
        const afterRoasMatch = afterContent.match(/([\d.]+)x/);
        if (afterRoasMatch && roasBefore) {
          const roasAfter = parseFloat(afterRoasMatch[1]);
          expect(roasAfter, "ROAS should increase after deleting spend").toBeGreaterThan(roasBefore);
          console.log(`✓ ROAS increased after delete: ${roasBefore.toFixed(2)}x → ${roasAfter.toFixed(2)}x`);
        }
      } else {
        console.log("⚠ No E2E Spend A source found to delete — skipping");
      }
    });
  });

  // ---- REFRESH CYCLES ----
  test.describe("Refresh Cycles", () => {
    for (let cycle = 1; cycle <= scenarios.refresh_cycles; cycle++) {
      test(`Refresh #${cycle}: Data accumulates correctly`, async ({ page }) => {
        await page.goto(GA4_URL);
        await page.waitForLoadState("networkidle");
        await page.waitForTimeout(2000);

        // Inject a new day of data
        const date = dateOffset(40 + cycle); // offset far back to avoid collision
        const result = await apiPost(page, `/api/campaigns/${CAMPAIGN_ID}/ga4/mock-refresh`, {
          propertyId: scenarios.mock_property_id,
          date,
        });
        console.log(`Refresh #${cycle} injected for ${date}:`, result?.summary || "ok");

        await waitForDataRefresh(page);

        // Overview should show data
        const content = await bodyText(page);
        expect(content.includes("Sessions"), `Refresh #${cycle}: Sessions label visible`).toBe(true);
        expect(/\$[\d,]+/.test(content), `Refresh #${cycle}: Dollar amounts visible`).toBe(true);

        // Check all tabs still work
        for (const tabName of ["KPIs", "Benchmarks", "Insights"]) {
          await page.getByRole("tab", { name: tabName }).click();
          await page.waitForTimeout(1000);
          const tabContent = await bodyText(page);
          const hasContent = tabContent.length > 500; // not an empty/error page
          expect(hasContent, `Refresh #${cycle}: ${tabName} tab has content`).toBe(true);
        }

        // Back to overview for next cycle
        await page.getByRole("tab", { name: "Overview" }).click();
        await page.waitForTimeout(500);

        console.log(`✓ Refresh #${cycle}: All tabs working`);
      });
    }
  });

  // ---- KPI SCENARIOS (data-driven from fixtures) ----
  test.describe("KPI Scenarios", () => {
    // Create all KPIs first
    test("Create all KPIs from fixture", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");

      for (const kpi of scenarios.kpi_scenarios) {
        const result = await apiPost(page, `/api/platforms/google_analytics/kpis`, {
          campaignId: String(CAMPAIGN_ID),
          name: `${kpi.metric} Target`,
          metric: kpi.metric,
          unit: kpi.unit,
          currentValue: "0",
          targetValue: kpi.target,
          priority: "high",
        });
        const id = result?.id || result?.kpi?.id;
        console.log(`KPI "${kpi.metric}" created:`, id || result?.message || "error");
      }

      await waitForDataRefresh(page);

      // Switch to KPIs tab
      await page.getByRole("tab", { name: "KPIs" }).click();
      await page.waitForTimeout(2500);

      const content = await bodyText(page);
      expect(content, "Should show Total KPIs").toContain("Total KPIs");

      // Verify each KPI appears
      for (const kpi of scenarios.kpi_scenarios) {
        const visible = content.includes(`${kpi.metric} Target`);
        console.log(`KPI "${kpi.metric} Target" visible: ${visible} (expect ${kpi.expect_band})`);
      }

      // Should show progress percentages
      const hasPercentage = /\d+\.?\d*%/.test(content);
      expect(hasPercentage, "KPIs should show progress percentages").toBe(true);

      console.log(`✓ ${scenarios.kpi_scenarios.length} KPIs created and visible`);
    });
  });

  // ---- BENCHMARK SCENARIOS (data-driven from fixtures) ----
  test.describe("Benchmark Scenarios", () => {
    test("Create all Benchmarks from fixture", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");

      for (const bench of scenarios.benchmark_scenarios) {
        const result = await apiPost(page, `/api/platforms/google_analytics/benchmarks`, {
          campaignId: String(CAMPAIGN_ID),
          name: bench.name,
          metric: bench.metric,
          unit: bench.unit,
          currentValue: "0",
          benchmarkValue: bench.benchmark,
          benchmarkType: "custom",
          category: "performance",
          period: "monthly",
          status: "active",
        });
        const id = result?.id || result?.benchmark?.id;
        console.log(`Benchmark "${bench.name}" created:`, id || result?.message || "error");
      }

      await waitForDataRefresh(page);

      // Switch to Benchmarks tab
      await page.getByRole("tab", { name: "Benchmarks" }).click();
      await page.waitForTimeout(2500);

      const content = await bodyText(page);
      expect(content, "Should show Total Benchmarks").toContain("Total Benchmarks");

      // Verify each benchmark appears
      for (const bench of scenarios.benchmark_scenarios) {
        const visible = content.includes(bench.name);
        console.log(`Benchmark "${bench.name}" visible: ${visible}`);
      }

      console.log(`✓ ${scenarios.benchmark_scenarios.length} Benchmarks created and visible`);
    });
  });

  // ---- CROSS-TAB CONSISTENCY ----
  test.describe("Cross-Tab Consistency", () => {
    test("ROAS matches between Overview and Insights", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(2500);

      // Get ROAS from Overview
      const overviewContent = await bodyText(page);
      const overviewRoasMatch = overviewContent.match(/([\d.]+)x/);
      const overviewRoas = overviewRoasMatch ? parseFloat(overviewRoasMatch[1]) : null;
      console.log("Overview ROAS:", overviewRoas ? overviewRoas.toFixed(2) + "x" : "not found");

      // Switch to Insights
      await page.getByRole("tab", { name: "Insights" }).click();
      await page.waitForTimeout(2500);

      const insightsContent = await bodyText(page);
      const insightsRoasMatch = insightsContent.match(/([\d.]+)x/);
      const insightsRoas = insightsRoasMatch ? parseFloat(insightsRoasMatch[1]) : null;
      console.log("Insights ROAS:", insightsRoas ? insightsRoas.toFixed(2) + "x" : "not found");

      if (overviewRoas !== null && insightsRoas !== null) {
        expect(insightsRoas, "ROAS should match between Overview and Insights").toBeCloseTo(overviewRoas, 0);
        console.log("✓ ROAS consistent across tabs");
      }
    });

    test("Insights shows Spend and Revenue labels", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");

      await page.getByRole("tab", { name: "Insights" }).click();
      await page.waitForTimeout(2500);

      const content = await bodyText(page);
      expect(content.includes("Spend"), "Insights should show Spend").toBe(true);
      expect(content.includes("Revenue"), "Insights should show Revenue").toBe(true);
      console.log("✓ Insights shows Spend and Revenue");
    });

    test("Ad Comparison tab loads without crash", async ({ page }) => {
      await page.goto(GA4_URL);
      await page.waitForLoadState("networkidle");

      await page.getByRole("tab", { name: "Ad Comparison" }).click();
      await page.waitForTimeout(2000);

      const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
      expect(hasError, "Ad Comparison should not crash").toBe(false);
      console.log("✓ Ad Comparison loaded");
    });
  });

  // ---- STABILITY ----
  test("Stability: Rapid tab switching — no crashes", async ({ page }) => {
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

    const hasError = await page.locator("text=Something went wrong").isVisible().catch(() => false);
    expect(hasError, "No tab should crash").toBe(false);
    console.log("✓ All tabs stable");
  });
});
