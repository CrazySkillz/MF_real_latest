import { chromium } from "playwright";
import { pool } from "../server/db";

const base = "https://marketforensics.onrender.com";
const expectedSha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const secret = String(process.env.CLERK_SECRET_KEY || "");
const check = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
if (!pool || !secret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY required");

const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let sessionId = "";
let tokenId = "";
let deniedWrites = 0;
let interceptedReconciliations = 0;
let notificationMode: "fixtures" | "empty" | "error" = "fixtures";
const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

try {
  const healthResponse = await fetch(`${base}/api/health`);
  const health: any = await healthResponse.json();
  check(healthResponse.ok && health.commit === expectedSha && health.nodeEnv === "production", "Render runtime changed");
  const owner = await client.query(`SELECT owner_id FROM campaigns WHERE id = $1 AND name = 'Campaign2'`, [campaignId]);
  check(owner.rowCount === 1 && owner.rows[0].owner_id, "Campaign2 owner changed");
  const campaigns = await client.query(`SELECT id, name, client_id FROM campaigns WHERE owner_id = $1 ORDER BY name`, [owner.rows[0].owner_id]);
  const clientCampaigns = campaigns.rows.filter((row: any) => row.client_id);
  const first = clientCampaigns[0];
  const second = clientCampaigns.find((row: any) => row.client_id !== first?.client_id);
  check(first && second, "Owner needs campaigns in two clients for UI validation");
  const now = Date.now();
  const fixtures = Array.from({ length: 12 }, (_, i) => {
    const campaign = i % 2 === 0 ? first : second;
    const itemId = `benchmark-fixture-${i}`;
    return {
      id: `fixture-${i}`, title: `Fixture alert ${i}`, message: `Current value: ${i}. Alert threshold value: 5`,
      type: "performance-alert", priority: i % 3 === 0 ? "high" : "low",
      campaignId: campaign.id, campaignName: campaign.name, read: false,
      createdAt: new Date(now - (i < 6 ? 0 : i < 9 ? 86400000 : 10 * 86400000)).toISOString(),
      metadata: JSON.stringify({ benchmarkId: itemId, alertType: "benchmark-alert", currentValue: String(i),
        thresholdValue: "5", unit: "count", actionUrl: `/campaigns/${campaign.id}/ga4-metrics?tab=benchmarks&highlight=${itemId}` }),
    };
  });

  const signInResponse = await clerkPost("/sign_in_tokens", { user_id: owner.rows[0].owner_id, expires_in_seconds: 600 });
  const signIn: any = await signInResponse.json().catch(() => ({}));
  check(signInResponse.ok && signIn.token && signIn.id, `Owner sign-in failed (${signInResponse.status})`);
  tokenId = String(signIn.id);
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  const anonymous = await fetch(`${base}/api/notifications?readOnly=1`);
  check(anonymous.status === 401, `Anonymous Notifications GET returned ${anonymous.status}`);
  const realNotifications = await page.evaluate(async () => {
    const token = await (window as any).Clerk?.session?.getToken();
    const response = await fetch("/api/notifications?readOnly=1", { headers: { Authorization: `Bearer ${token}` } });
    return { status: response.status, rows: await response.json() };
  });
  const ownedCampaignIds = new Set(campaigns.rows.map((row: any) => String(row.id)));
  check(realNotifications.status === 200 && Array.isArray(realNotifications.rows)
    && realNotifications.rows.every((row: any) => ownedCampaignIds.has(String(row.campaignId))),
  "Real Notifications API returned an error or a foreign campaign");

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === "/api/notifications" && request.method() === "GET") {
      if (notificationMode === "error") return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "fixture unavailable" }) });
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(notificationMode === "fixtures" ? fixtures : []) });
    }
    if (/^\/api\/campaigns\/[^/]+\/ga4-notifications\/reconcile$/.test(path) && request.method() === "POST") {
      interceptedReconciliations++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (request.method() !== "GET") {
      deniedWrites++;
      return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Read-only UI validation" }) });
    }
    return route.continue();
  });

  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const bell = page.getByTestId("button-notifications");
  await bell.waitFor({ timeout: 60_000 });
  await page.getByTestId("notification-breach-indicator").waitFor({ timeout: 30_000 });
  check(!(await bell.isDisabled()), "Bell is disabled away from Notifications");
  await bell.click();
  await page.waitForURL(/\/notifications(?:\?.*)?$/, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="button-notifications"]') as HTMLButtonElement | null;
    return Boolean(button?.disabled && button.getAttribute("aria-current") === "page");
  }, undefined, { timeout: 30_000 });
  check(await bell.isDisabled() && await bell.getAttribute("aria-current") === "page", "Bell current-page state failed");
  const cards = page.locator('[data-testid^="notification-fixture-"]');
  await page.getByTestId("notifications-active-alerts-list").waitFor({ timeout: 60_000 });
  check(await cards.count() === 10, "First page did not show ten alerts");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  check(await cards.count() === 2, "Second page did not show two alerts");
  await page.getByTestId("select-priority-filter").click();
  await page.getByRole("option", { name: "High", exact: true }).click();
  check(await cards.count() === 4, "Priority filter failed");
  await page.getByTestId("select-priority-filter").click();
  await page.getByRole("option", { name: "All Priorities" }).click();
  await page.getByTestId("select-client-filter").click();
  await page.getByRole("option").nth(1).click();
  check(await cards.count() === 6, "Client filter failed");
  await page.getByTestId("select-client-filter").click();
  await page.getByRole("option", { name: "All Clients" }).click();
  await page.getByTestId("select-campaign-filter").click();
  await page.getByRole("option").nth(1).click();
  check(await cards.count() === 6, "Campaign filter failed");
  await page.getByTestId("select-campaign-filter").click();
  await page.getByRole("option", { name: "All Campaigns" }).click();
  await page.getByTestId("select-date-filter").click();
  await page.getByRole("option", { name: "Today" }).click();
  check(await cards.count() === 6, "Today date filter failed");
  check(await page.getByRole("button", { name: /Dismiss|Mark All as Read/i }).count() === 0, "Legacy inbox controls appeared");

  await page.goto(`${base}/notifications?selected=fixture-11`, { waitUntil: "domcontentloaded" });
  await page.locator('[data-testid="notification-fixture-11"][data-selected="true"]').waitFor({ timeout: 60_000 });
  await page.goto(`${base}/notifications?selected=missing-fixture`, { waitUntil: "domcontentloaded" });
  await page.getByTestId("selected-notification-missing-alert").waitFor({ timeout: 60_000 });
  notificationMode = "empty";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByText("No active alerts found").waitFor({ timeout: 60_000 });
  notificationMode = "error";
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.getByTestId("notifications-unavailable").waitFor({ timeout: 60_000 });
  check(deniedWrites === 0, `Unexpected app mutation attempts: ${deniedWrites}`);
  console.log(JSON.stringify({ runtime: expectedSha, ui: "pass with intercepted fixture alerts", ownerClientCount: 2,
    bell: "active indicator/navigation/current-page pass", list: "filters/pagination/selected/missing/empty/error pass",
    legacyInboxControls: "absent", realOwnerScopedAlertCount: realNotifications.rows.length,
    anonymousNotificationsStatus: anonymous.status, blockedProductionReconciliations: interceptedReconciliations,
    unexpectedMutationAttempts: deniedWrites, productionDataWrites: 0 }));
} finally {
  await context.close().catch(() => undefined);
  if (sessionId || tokenId) {
    const revoked = await clerkPost(sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke`
      : `/sign_in_tokens/${encodeURIComponent(tokenId)}/revoke`).catch(() => null);
    check(revoked?.ok, "Clerk validation session/token revocation failed");
  }
  await browser.close().catch(() => undefined);
  client.release();
  await pool.end();
}
