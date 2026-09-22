import { randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";
import { storage } from "../server/storage";

const base = "https://marketforensics.onrender.com";
const expectedSha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const name = `Notifications Audit Delete ${randomBytes(8).toString("hex")}`;
const secret = String(process.env.CLERK_SECRET_KEY || "");
const check = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
if (!pool || !secret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY required");

const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let benchmarkId = "";
let sessionId = "";
let tokenId = "";
let actorId = "";
let failure: unknown = null;
let output: Record<string, unknown> = {};
const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = (page: Page, method: string, path: string, body?: unknown) => page.evaluate(async (input) => {
  const token = await (window as any).Clerk?.session?.getToken();
  if (!token) throw new Error("Owner token missing");
  const response = await fetch(input.path, {
    method: input.method, credentials: "include",
    headers: { Authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "Content-Type": "application/json" }) },
    body: input.body === undefined ? undefined : JSON.stringify(input.body),
  });
  const raw = await response.text();
  let parsed: any = raw;
  try { parsed = raw ? JSON.parse(raw) : null; } catch { /* retain response text */ }
  return { status: response.status, ok: response.ok, body: parsed };
}, { method, path, body });

try {
  const healthResponse = await fetch(`${base}/api/health`);
  const health: any = await healthResponse.json();
  check(healthResponse.ok && health.commit === expectedSha && health.nodeEnv === "production", "Render runtime changed");
  const campaign = await client.query(`SELECT owner_id, name FROM campaigns WHERE id = $1`, [campaignId]);
  check(campaign.rowCount === 1 && campaign.rows[0].name === "Campaign2" && campaign.rows[0].owner_id, "Campaign2 owner changed");
  actorId = String(campaign.rows[0].owner_id);
  const existing = await client.query(`SELECT COUNT(*)::int AS count FROM benchmarks WHERE campaign_id = $1`, [campaignId]);
  check(existing.rows[0].count === 0, "Campaign2 Benchmark baseline changed");
  const signInResponse = await clerkPost("/sign_in_tokens", { user_id: campaign.rows[0].owner_id, expires_in_seconds: 600 });
  const signIn: any = await signInResponse.json().catch(() => ({}));
  check(signInResponse.ok && signIn.token && signIn.id, `Owner sign-in failed (${signInResponse.status})`);
  tokenId = String(signIn.id);
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));

  const created = await api(page, "POST", "/api/benchmarks", {
    campaignId, platformType: "google_analytics", name, metric: "__custom__", category: "performance",
    benchmarkType: "goal", period: "monthly", unit: "count", currentValue: "0", benchmarkValue: "10",
    alertsEnabled: true, alertThreshold: "5", alertCondition: "below", alertFrequency: "immediate",
    emailNotifications: false,
  });
  check(created.ok && created.body?.id && created.body.campaignId === campaignId, `Scoped create failed (${created.status})`);
  benchmarkId = String(created.body.id);
  const visible = await api(page, "GET", "/api/notifications?readOnly=1");
  const active = Array.isArray(visible.body) ? visible.body.filter((row: any) => {
    try { return JSON.parse(row.metadata).benchmarkId === benchmarkId; } catch { return false; }
  }) : [];
  check(visible.ok && active.length === 1, "One scoped active alert was not visible");

  const deleted = await api(page, "DELETE", `/api/benchmarks/${benchmarkId}`);
  output = { runtime: expectedSha, routeStatus: deleted.status, routeBody: deleted.body,
    createdActiveAlertCount: active.length, emailSent: false };
  if (!deleted.ok) failure = new Error(`Benchmark delete API returned ${deleted.status}`);
} catch (error) {
  failure ||= error;
} finally {
  try {
    const rows = await client.query(`SELECT id FROM benchmarks WHERE campaign_id = $1 AND name = $2`, [campaignId, name]);
    check(rows.rowCount <= 1, "Temporary Benchmark cleanup scope ambiguous");
    if (rows.rowCount === 1) {
      benchmarkId = String(rows.rows[0].id);
      const notifications = await client.query(`SELECT id, metadata FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2`, [campaignId, `%${benchmarkId}%`]);
      const hides = notifications.rows.map((row: any) => {
        const meta = JSON.parse(row.metadata);
        check(meta.benchmarkId === benchmarkId, "Temporary notification scope mismatch");
        return { id: row.id, campaignId, metadata: JSON.stringify({ ...meta, dismissedAt: new Date().toISOString(),
          dismissedBy: actorId, dismissalReason: "benchmark_deleted" }) };
      });
      check(await storage.deleteBenchmark(benchmarkId, hides), "Exact storage cleanup failed");
      output.fallbackCleanup = "exact temporary Benchmark deleted; linked alert history soft-hidden";
    }
    const remaining = await client.query(`SELECT COUNT(*)::int AS count FROM benchmarks WHERE campaign_id = $1 AND name = $2`, [campaignId, name]);
    check(remaining.rows[0].count === 0, "Temporary Benchmark remains");
  } catch (error) {
    failure ||= error;
    output.cleanupError = String(error);
  }
  await context.close().catch(() => undefined);
  if (sessionId || tokenId) {
    const revoked = await clerkPost(sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke`
      : `/sign_in_tokens/${encodeURIComponent(tokenId)}/revoke`).catch(() => null);
    if (!revoked?.ok) failure ||= new Error("Owner session/token revocation failed");
  }
  await browser.close().catch(() => undefined);
  client.release();
  await pool.end();
}
console.log(JSON.stringify(output));
if (failure) throw failure;
