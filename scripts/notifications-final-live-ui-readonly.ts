import { chromium } from "playwright";
import { pool } from "../server/db";

const base = "https://marketforensics.onrender.com";
const sha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const secret = String(process.env.CLERK_SECRET_KEY || "").trim();
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
if (!pool || !secret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY required");
const db = await pool.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let sessionId = "";
let tokenId = "";
let blockedReconciliations = 0;
let unexpectedMutations = 0;
const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

try {
  const healthResponse = await fetch(`${base}/api/health`);
  const health: any = await healthResponse.json();
  check(healthResponse.ok && health.commit === sha && health.nodeEnv === "production", "Render runtime changed");
  const owner = await db.query("SELECT owner_id FROM campaigns WHERE id=$1 AND name=$2", [campaignId, "Campaign2"]);
  check(owner.rowCount === 1 && owner.rows[0].owner_id, "Campaign2 owner changed");
  const benchmark = await db.query("SELECT id, name FROM benchmarks WHERE campaign_id=$1 AND name LIKE $2 AND email_notifications=true", [campaignId, "Notifications Cert % Scheduled Email Benchmark"]);
  check(benchmark.rowCount === 1, "Exactly one opted-in disposable Benchmark is required");
  const alert = await db.query("SELECT id, metadata FROM notifications WHERE campaign_id=$1 AND metadata LIKE $2 AND read=false", [campaignId, `%${benchmark.rows[0].id}%`]);
  check(alert.rowCount === 1, "Exactly one live temporary alert is required");
  const alertId = String(alert.rows[0].id);
  const metadata = JSON.parse(alert.rows[0].metadata);
  check(metadata.benchmarkId === benchmark.rows[0].id, "Alert-to-Benchmark identity mismatch");

  const signInResponse = await clerkPost("/sign_in_tokens", { user_id: owner.rows[0].owner_id, expires_in_seconds: 600 });
  const signIn: any = await signInResponse.json().catch(() => ({}));
  check(signInResponse.ok && signIn.token && signIn.id, "Owner sign-in failed");
  tokenId = String(signIn.id);
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  const real = await page.evaluate(async () => {
    const token = await (window as any).Clerk.session.getToken();
    const response = await fetch("/api/notifications?readOnly=1", { headers: { Authorization: `Bearer ${token}` } });
    return { status: response.status, rows: await response.json() };
  });
  check(real.status === 200 && Array.isArray(real.rows) && real.rows.some((row: any) => row.id === alertId),
    "Live owner API did not return the temporary alert");

  await page.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (/^\/api\/campaigns\/[^/]+\/ga4-notifications\/reconcile$/.test(path) && request.method() === "POST") {
      blockedReconciliations++;
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
    }
    if (request.method() !== "GET") {
      unexpectedMutations++;
      return route.fulfill({ status: 403, contentType: "application/json", body: JSON.stringify({ message: "Read-only validation" }) });
    }
    return route.continue();
  });
  await page.goto(base, { waitUntil: "domcontentloaded", timeout: 60_000 });
  const bell = page.getByTestId("button-notifications");
  await bell.waitFor({ timeout: 60_000 });
  await page.getByTestId("notification-breach-indicator").waitFor({ timeout: 30_000 });
  check(!(await bell.isDisabled()), "Bell disabled away from Notifications");
  await bell.click();
  await page.waitForURL(/\/notifications(?:\?.*)?$/, { timeout: 30_000 });
  await page.waitForFunction(() => {
    const button = document.querySelector('[data-testid="button-notifications"]') as HTMLButtonElement | null;
    return Boolean(button?.disabled && button.getAttribute("aria-current") === "page");
  }, undefined, { timeout: 30_000 });
  check(await bell.isDisabled() && await bell.getAttribute("aria-current") === "page", "Bell current-page state failed");
  const card = page.getByTestId(`notification-${alertId}`);
  await card.waitFor({ timeout: 60_000 });
  check((await card.textContent())?.includes(benchmark.rows[0].name), "Live alert title missing");
  check((await card.textContent())?.includes("Current value:"), "Live current value missing");
  check((await card.textContent())?.includes("Threshold value:"), "Live threshold missing");
  check(await page.getByRole("button", { name: /Dismiss|Mark All as Read/i }).count() === 0, "Legacy inbox control appeared");
  await page.goto(`${base}/notifications?selected=${encodeURIComponent(alertId)}`, { waitUntil: "domcontentloaded" });
  await page.locator(`[data-testid="notification-${alertId}"][data-selected="true"]`).waitFor({ timeout: 60_000 });
  await page.getByTestId(`button-view-alert-${alertId}`).click();
  await page.waitForURL((url) => url.pathname === `/campaigns/${campaignId}/ga4-metrics`
    && url.searchParams.get("tab") === "benchmarks" && url.searchParams.get("highlight") === benchmark.rows[0].id,
  { timeout: 30_000 });
  check(unexpectedMutations === 0, `Unexpected mutation attempts: ${unexpectedMutations}`);
  console.log(JSON.stringify({ runtime: sha, liveOwnerAlert: alertId, bell: "pass", list: "real active alert rendered with values", selected: "pass",
    benchmarkDeepLink: "pass", legacyControls: "absent", blockedReconciliations, unexpectedMutations,
    productionWrites: 0 }));
} finally {
  await context.close().catch(() => undefined);
  if (sessionId || tokenId) {
    const response = await clerkPost(sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke`
      : `/sign_in_tokens/${encodeURIComponent(tokenId)}/revoke`).catch(() => null);
    check(response?.ok, "Clerk validation session/token revocation failed");
  }
  await browser.close().catch(() => undefined);
  db.release();
  await pool.end();
}
