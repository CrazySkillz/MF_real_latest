// Local-only browser validation of the real Campaigns page. OAuth and API replies
// are fixtures; database, route and worker behavior have separate regression tests.
import { build } from "esbuild";
import { chromium, expect } from "@playwright/test";
import { createServer } from "node:http";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const result = await build({
  stdin: { contents: `import React from "react";
    import { createRoot } from "react-dom/client";
    import { QueryClientProvider } from "@tanstack/react-query";
    import { queryClient } from "@/lib/queryClient";
    import { ClientProvider } from "@/lib/clientContext";
    import Campaigns from "@/pages/campaigns";
    createRoot(document.getElementById("root")).render(<QueryClientProvider client={queryClient}><ClientProvider><Campaigns /></ClientProvider></QueryClientProvider>);`,
    resolveDir: process.cwd(), loader: "tsx" },
  bundle: true, write: false, format: "esm", jsx: "automatic", logLevel: "silent",
  alias: { "@": path.resolve("client/src"), "@shared": path.resolve("shared"), "@assets": path.resolve("attached_assets") },
  define: { "process.env.NODE_ENV": '"test"', "import.meta.env": "{}" },
  plugins: [{ name: "isolated-layout-and-oauth", setup(builder) {
    builder.onResolve({ filter: /^@\/components\/(layout\/(navigation|sidebar)|IntegratedGA4Auth)$/ }, args => ({ path: args.path, namespace: "fixture" }));
    builder.onLoad({ filter: /.*/, namespace: "fixture" }, args => ({ loader: "tsx", resolveDir: process.cwd(),
      contents: args.path.endsWith("IntegratedGA4Auth")
        ? 'export function IntegratedGA4Auth({onSuccess}) { return <button onClick={onSuccess}>Use fixture Google connection</button>; }'
        : 'export default function Layout() { return null; }' }));
  } }],
});
const bundle = result.outputFiles[0].contents;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/app.js" ? "application/javascript" : "text/html");
  res.end(req.url === "/app.js" ? bundle : '<html><body><div id="root"></div><script type="module" src="/app.js"></script></body></html>');
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: true });
const outcomes = [];
const errors = [];
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on("pageerror", error => errors.push(error.message));
  let campaign, accepted, loseResponse, patches, deletions;
  const reset = (state = "running") => {
    accepted = Boolean(state); loseResponse = false; patches = 0; deletions = 0;
    campaign = { id: "initial-a", ownerId: "owner-a", clientId: "client-a", name: "Initial import test", status: "draft",
      platform: "google-analytics", ga4CampaignFilter: "sale", currency: "EUR", budget: "100", reportingTimeZone: "Europe/Amsterdam",
      initialImport: state ? { state, canRetry: state === "failed", error: state === "failed" ? "daily_series:TOKEN_EXPIRED" : null, dataThroughDate: "2026-10-17" } : null };
  };
  await context.route("**/*", async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin !== origin) return route.abort();
    if (!url.pathname.startsWith("/api/")) return route.continue();
    const respond = (body, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
    if (url.pathname === "/api/clients") return respond([{ id: "client-a", name: "Fixture client" }]);
    if (url.pathname === "/api/campaigns") {
      if (request.method() === "POST") { campaign = { ...campaign, ...request.postDataJSON(), id: "initial-a" }; return respond(campaign, 201); }
      return respond(accepted ? [campaign] : []);
    }
    if (url.pathname.endsWith("/ga4-connection-status")) return respond({ connected: true, properties: [{ id: "123", name: "Fixture property" }] });
    if (url.pathname.endsWith("/ga4-campaign-values")) return respond({ campaigns: [{ name: "sale", users: 10 }] });
    if (url.pathname.includes("/ga4/") || url.pathname.includes("ga4-select-property")) return respond({ success: true });
    if (url.pathname === "/api/campaigns/initial-a") {
      if (request.method() === "DELETE") { deletions++; accepted = false; return respond({ success: true }); }
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        if (body.asyncInitialImport) {
          patches++; accepted = true;
          campaign = { ...campaign, platform: body.platform, ga4CampaignFilter: body.ga4CampaignFilter,
            initialImport: { state: "running", canRetry: false, error: null, dataThroughDate: "2026-10-17" } };
          if (loseResponse) { loseResponse = false; return route.abort(); }
          return respond(campaign, 202);
        }
        campaign = { ...campaign, ...body }; return respond(campaign);
      }
      return respond(campaign);
    }
    return respond({ success: true });
  });
  const dialog = () => page.getByRole("dialog");
  const reopen = async () => {
    await page.goto(`${origin}/campaigns`);
    await page.getByText("Initial import test", { exact: true }).click();
    await expect(dialog()).toBeVisible();
  };

  reset(); await reopen();
  await expect(dialog().getByRole("button", { name: "Import in progress" })).toBeDisabled();
  await expect(dialog().getByRole("button", { name: "Back", exact: true })).toBeDisabled();
  await dialog().getByRole("button", { name: "Close", exact: true }).first().click();
  await expect(dialog()).toHaveCount(0);
  await reopen();
  expect(deletions).toBe(0); expect(patches).toBe(0);
  outcomes.push("Accepted import survives close/reload/reopen without cleanup or duplicate Create");

  reset("failed"); await reopen();
  await expect(dialog().getByText(/Google access expired/)).toBeVisible();
  await dialog().getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog().getByText("Historical data", { exact: true })).toBeVisible();
  await expect(dialog().getByRole("button", { name: "Connect Property", exact: true })).toBeEnabled();
  await dialog().getByRole("button", { name: "Back", exact: true }).click();
  await expect(dialog().getByRole("button", { name: "Use fixture Google connection" })).toBeVisible();
  outcomes.push("Failed reopened setup returns to Configure, then Google connection, without skipping steps");

  reset("failed"); await reopen();
  await dialog().getByRole("button", { name: "Retry import" }).click();
  await expect(dialog().getByRole("button", { name: "Import in progress" })).toBeDisabled();
  expect(patches).toBe(1);
  campaign = { ...campaign, status: "active", initialImport: { ...campaign.initialImport, state: "completed" } };
  await expect(dialog()).toHaveCount(0, { timeout: 8000 });
  await expect(page.locator('[data-campaign-id="initial-a"]')).toBeVisible();
  expect(patches).toBe(1); expect(deletions).toBe(0);
  outcomes.push("Explicit retry activates after status confirmation, with exactly one Create request");

  reset("failed"); loseResponse = true; await reopen();
  await dialog().getByRole("button", { name: "Retry import" }).click();
  await expect(dialog().getByRole("button", { name: "Import in progress" })).toBeDisabled({ timeout: 8000 });
  await dialog().getByRole("button", { name: "Close", exact: true }).first().click();
  await reopen();
  expect(patches).toBe(1); expect(deletions).toBe(0);
  outcomes.push("Lost Create response recovers through status polling and reopening without duplicate import");

  reset(null); await page.goto(`${origin}/campaigns`);
  await page.getByRole("button", { name: "Create Campaign", exact: true }).first().click();
  await dialog().getByLabel("Campaign Name *", { exact: true }).fill("Initial import test");
  await dialog().getByRole("button", { name: /Next/ }).click();
  await dialog().getByRole("button", { name: /Google Analytics/ }).click();
  await dialog().getByRole("button", { name: "Use fixture Google connection" }).click();
  await dialog().getByRole("button", { name: "Connect Property", exact: true }).click();
  await dialog().getByRole("checkbox").first().check();
  await dialog().getByRole("button", { name: "Save & Continue", exact: true }).click();
  await dialog().getByRole("button", { name: "Create Campaign", exact: true }).click();
  await expect(dialog().getByRole("button", { name: "Import in progress" })).toBeDisabled();
  expect(patches).toBe(1); expect(campaign.status).toBe("draft"); expect(campaign.ga4CampaignFilter).toBe("sale");
  outcomes.push("Fresh five-step setup submits the selected GA4 campaign and remains a draft during import");
  expect(errors).toEqual([]);
  await mkdir("audit-temp", { recursive: true });
  await writeFile("audit-temp/p4-initial-ui.json", JSON.stringify({ passed: outcomes, errors }, null, 2));
  console.log(JSON.stringify({ passed: outcomes.length, scenarios: outcomes }));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
