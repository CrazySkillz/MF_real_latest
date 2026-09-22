import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { pool } from "../server/db";

const base = "https://marketforensics.onrender.com";
const sha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const campaign2 = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const secret = String(process.env.CLERK_SECRET_KEY || "").trim();
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
if (!pool || !secret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY required");
const clientId = randomUUID();
const campaignId = randomUUID();
const notificationId = randomUUID();
const syntheticOwner = `notifications-cert-foreign-${randomUUID()}`;
const db = await pool.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let inserted = false;
let sessionId = "";
let tokenId = "";
let failure: unknown = null;
const result: Record<string, unknown> = { runtime: sha };
const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const apiGet = async (path: string) => page.evaluate(async (path) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Owner session unavailable");
  const response = await fetch(path, { headers: { Authorization: `Bearer ${token}` } });
  const raw = await response.text();
  let body: any = raw;
  try { body = raw ? JSON.parse(raw) : null; } catch { /* keep raw */ }
  return { status: response.status, body };
}, path);
const apiWrite = async (method: "PATCH" | "DELETE", path: string, body?: unknown) => page.evaluate(async (input) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Owner session unavailable");
  const response = await fetch(input.path, {
    method: input.method,
    headers: { Authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  return { status: response.status };
}, { method, path, body });

try {
  const healthResponse = await fetch(`${base}/api/health`);
  const health: any = await healthResponse.json();
  check(healthResponse.ok && health.commit === sha && health.nodeEnv === "production", "Render runtime changed");
  const owner = await db.query("SELECT owner_id FROM campaigns WHERE id=$1 AND name=$2", [campaign2, "Campaign2"]);
  check(owner.rowCount === 1 && owner.rows[0].owner_id && owner.rows[0].owner_id !== syntheticOwner,
    "Owner boundary changed");
  await db.query("BEGIN");
  try {
    await db.query("INSERT INTO clients (id, owner_id, name) VALUES ($1,$2,$3)", [clientId, syntheticOwner, "Disposable Notifications foreign-owner check"]);
    await db.query("INSERT INTO campaigns (id, owner_id, client_id, name, status, platform) VALUES ($1,$2,$3,$4,$5,$6)",
      [campaignId, syntheticOwner, clientId, "Disposable Notifications foreign campaign", "active", "google_analytics"]);
    await db.query("INSERT INTO notifications (id, title, message, type, campaign_id, metadata) VALUES ($1,$2,$3,$4,$5,$6)",
      [notificationId, "Disposable foreign-owner notification", "Access boundary check", "info", campaignId, "{}"]);
    await db.query("COMMIT");
    inserted = true;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
  const signInResponse = await clerkPost("/sign_in_tokens", { user_id: owner.rows[0].owner_id, expires_in_seconds: 600 });
  const signIn: any = await signInResponse.json().catch(() => ({}));
  check(signInResponse.ok && signIn.token && signIn.id, "Owner sign-in failed");
  tokenId = String(signIn.id);
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));

  const [foreignCampaign, foreignClientFilter, clients, campaigns, notifications] = await Promise.all([
    apiGet(`/api/campaigns/${campaignId}`), apiGet(`/api/campaigns?clientId=${clientId}`),
    apiGet("/api/clients"), apiGet("/api/campaigns"), apiGet("/api/notifications?readOnly=1"),
  ]);
  check(foreignCampaign.status === 404 && foreignClientFilter.status === 404,
    "Foreign campaign/client direct reads did not fail closed");
  check(clients.status === 200 && Array.isArray(clients.body) && !clients.body.some((row: any) => row.id === clientId),
    "Foreign client leaked into owner list");
  check(campaigns.status === 200 && Array.isArray(campaigns.body) && !campaigns.body.some((row: any) => row.id === campaignId),
    "Foreign campaign leaked into owner list");
  check(notifications.status === 200 && Array.isArray(notifications.body)
    && !notifications.body.some((row: any) => row.id === notificationId), "Foreign notification leaked into owner list");
  const legacyPatch = await apiWrite("PATCH", `/api/notifications/${notificationId}`, { read: true });
  const legacyDelete = await apiWrite("DELETE", `/api/notifications/${notificationId}`);
  check(legacyPatch.status === 404 && legacyDelete.status === 404, "Legacy per-alert API accepted foreign mutation");
  const unchanged = await db.query("SELECT read, metadata FROM notifications WHERE id=$1 AND campaign_id=$2", [notificationId, campaignId]);
  check(unchanged.rowCount === 1 && unchanged.rows[0].read === false && unchanged.rows[0].metadata === "{}",
    "Legacy foreign API changed the disposable notification");
  result.crossOwnerFailClosed = "client, campaign, notification lists and direct reads passed";
  result.legacyPerAlertForeignMutationDenied = true;
} catch (error) {
  failure = error;
} finally {
  try {
    if (inserted) {
      await db.query("BEGIN");
      try {
        const n = await db.query("DELETE FROM notifications WHERE id=$1 AND campaign_id=$2", [notificationId, campaignId]);
        const c = await db.query("DELETE FROM campaigns WHERE id=$1 AND owner_id=$2 AND client_id=$3", [campaignId, syntheticOwner, clientId]);
        const o = await db.query("DELETE FROM clients WHERE id=$1 AND owner_id=$2", [clientId, syntheticOwner]);
        check(n.rowCount === 1 && c.rowCount === 1 && o.rowCount === 1, "Synthetic fixture cleanup scope mismatch");
        await db.query("COMMIT");
        result.cleanup = "exact synthetic-owner rows removed";
      } catch (error) {
        await db.query("ROLLBACK");
        throw error;
      }
    }
  } catch (error) {
    failure ||= error;
    result.cleanupError = String(error);
  }
  await context.close().catch(() => undefined);
  if (sessionId || tokenId) {
    const response = await clerkPost(sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke`
      : `/sign_in_tokens/${encodeURIComponent(tokenId)}/revoke`).catch(() => null);
    if (!response?.ok) failure ||= new Error("Clerk session/token revocation failed");
  }
  await browser.close().catch(() => undefined);
  db.release();
  await pool.end();
}
console.log(JSON.stringify(result));
if (failure) throw failure;
