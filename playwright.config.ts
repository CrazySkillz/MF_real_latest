import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 120_000,
  retries: 0,
  reporter: [
    ["list"],
    ["html", { open: "on-failure", outputFolder: "playwright-report" }],
  ],
  use: {
    baseURL: process.env.BASE_URL || "https://mforensics.onrender.com",
    headless: true,
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { browserName: "chromium" } },
  ],
});
