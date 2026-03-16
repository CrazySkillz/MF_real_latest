import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: 0,
  // Tests share one campaign (yesop-brand) so they CANNOT run in parallel.
  // To speed up: reduced all waitForTimeout values and timeout from 120s to 60s.
  workers: 1,
  fullyParallel: false,
  reporter: [
    ["list"],
    ["html", { open: "on-failure", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "https://mforensics.onrender.com",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    actionTimeout: 10_000,
    navigationTimeout: 30_000,
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
