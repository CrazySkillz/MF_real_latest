import { randomBytes } from "node:crypto";
import { chromium, type BrowserContext, type Page } from "playwright";
import { pool } from "../server/db";

const base = "https://marketforensics.onrender.com";
const campaignId = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const expectedSha = "b732693752db996b39b185e9c4d342b05f877676";
const recipient = "tester_for_mm@outlook.com";
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "").trim();
const name = `Notifications Audit ${randomBytes(8).toString("hex")}`;
const check = (ok: unknown, reason: string) => { if (!ok) throw new Error(reason); };
const metadata = (value: any) => {
  try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch { return {}; }
};

if (!pool || !clerkSecret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY are required");
const client = await pool.connect();
const browser = await chromium.launch({ headless: true });
let context: BrowserContext | null = null;
let page: Page | null = null;
let sessionId = "";
let signInTokenId = "";
let benchmarkId = "";
let result: Record<string, unknown> = {};
let failure: unknown = null;

const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (method: string, path: string, body?: unknown) => {
  check(page, "Owner session unavailable");
  return page!.evaluate(async (input) => {
    const token = await (window as any).Clerk?.session?.getToken();
    if (!token) throw new Error("Owner session token unavailable");
    const response = await fetch(input.path, {
      method: input.method,
      credentials: "include",
      headers: { Authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const raw = await response.text();
    let parsed: any = raw;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* retain text */ }
    return { ok: response.ok, status: response.status, body: parsed };
  }, { method, path, body });
};
const visibleFor = async (id: string) => {
  const response = await api("GET", "/api/notifications?readOnly=1");
  check(response.ok && Array.isArray(response.body), `Read-only notifications GET failed (${response.status})`);
  return response.body.filter((row: any) => String(metadata(row.metadata).benchmarkId || "") === id);
};

try {
  const healthResponse = await fetch(`${base}/api/health`);
  const health: any = await healthResponse.json();
  check(healthResponse.ok && health.commit === expectedSha && health.nodeEnv === "production", "Render revision/runtime changed");

  const campaign = await client.query(`
    SELECT c.owner_id, c.client_id, c.name, g.property_id
    FROM campaigns c JOIN LATERAL (
      SELECT property_id FROM ga4_connections WHERE campaign_id = c.id AND is_active = true
      ORDER BY is_primary DESC, connected_at ASC LIMIT 1
    ) g ON true WHERE c.id = $1
  `, [campaignId]);
  check(campaign.rowCount === 1 && campaign.rows[0].name === "Campaign2"
    && campaign.rows[0].owner_id && campaign.rows[0].client_id && campaign.rows[0].property_id,
  "Campaign2 GA4 owner/client boundary changed");
  const inventory = await client.query(`
    SELECT (SELECT COUNT(*)::int FROM kpis WHERE campaign_id = $1) AS kpis,
      (SELECT COUNT(*)::int FROM benchmarks WHERE campaign_id = $1) AS benchmarks,
      (SELECT COUNT(*)::int FROM notifications WHERE campaign_id = $1) AS notifications,
      (SELECT COUNT(*)::int FROM email_alert_events WHERE campaign_id = $1 AND kind = 'alert') AS email_events
  `, [campaignId]);
  check(Object.values(inventory.rows[0]).every((count) => count === 0), "Campaign2 baseline changed; refusing production write");
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: campaign.rows[0].owner_id, expires_in_seconds: 600 });
  const signIn: any = await tokenResponse.json().catch(() => ({}));
  check(tokenResponse.ok && signIn.token && signIn.id, `Owner sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(signIn.id);
  context = await browser.newContext();
  page = await context.newPage();
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  check((await api("GET", "/api/notifications?readOnly=1")).ok, "Owner notification GET failed");

  const created = await api("POST", "/api/benchmarks", {
    campaignId, platformType: "google_analytics", name, metric: "__custom__",
    description: "Temporary, owner-authorized Notifications validation", category: "performance",
    benchmarkType: "goal", period: "monthly", unit: "count",
    currentValue: "0", benchmarkValue: "10", alertsEnabled: true,
    alertThreshold: "5", alertCondition: "below", alertFrequency: "immediate",
    emailNotifications: false,
  });
  check(created.ok && created.body?.id, `Temporary Benchmark create failed (${created.status})`);
  benchmarkId = String(created.body.id);
  check(created.body.campaignId === campaignId && created.body.name === name, "Created Benchmark scope mismatch");
  const initial = await visibleFor(benchmarkId);
  check(initial.length === 1, `Initial alert count ${initial.length}, expected 1`);
  const link = `/campaigns/${campaignId}/ga4-metrics?tab=benchmarks&highlight=${benchmarkId}`;
  check(metadata(initial[0].metadata).actionUrl === link, "Benchmark deep link mismatch");
  check(initial[0].campaignId === campaignId && initial[0].priority === "high", "Alert scope/priority mismatch");

  const cleared = await api("PUT", `/api/benchmarks/${benchmarkId}`, { currentValue: "10" });
  check(cleared.ok && (await visibleFor(benchmarkId)).length === 0, "Breach resolution failed");
  const rebreeched = await api("PUT", `/api/benchmarks/${benchmarkId}`, { currentValue: "0" });
  check(rebreeched.ok, `Re-breach update failed (${rebreeched.status})`);
  const current = await visibleFor(benchmarkId);
  check(current.length === 1 && metadata(current[0].metadata).actionUrl === link, "Re-breach alert/deep link failed");

  const optedIn = await api("PUT", `/api/benchmarks/${benchmarkId}`, {
    emailNotifications: true, emailRecipients: recipient,
  });
  check(optedIn.ok, `One authorized email trigger failed (${optedIn.status})`);
  const evidence = await api("GET", `/api/benchmarks/${benchmarkId}/alert-email-delivery-validation`);
  check(evidence.ok && evidence.body?.campaignId === campaignId, "Email audit evidence unavailable");
  const events = evidence.body.auditEvents || [];
  check(events.length === 1 && events[0].recipientCount === 1 && events[0].recipients?.[0] === recipient,
    `Unexpected email audit attempts (${events.length}) or recipient`);
  result = {
    deployedSha: expectedSha, runtime: health.nodeEnv, campaign: "Campaign2",
    initialAlertCount: initial.length, clearedAlertCount: 0, rebreachAlertCount: current.length,
    deepLink: link, emailAuditCount: events.length, emailProvider: events[0].provider,
    emailSuccess: events[0].success, emailDeliveryStatus: events[0].deliveryStatus,
    providerDeliveryProven: evidence.body.providerDeliveryProven,
    inboxReceiptProvenByApp: evidence.body.inboxReceiptProvenByApp,
  };
} catch (error) {
  failure = error;
} finally {
  try {
    const ownedRows = await client.query(`SELECT id FROM benchmarks WHERE campaign_id = $1 AND name = $2`, [campaignId, name]);
    check(ownedRows.rowCount <= 1, "Multiple temporary Benchmark rows; cleanup scope ambiguous");
    if (ownedRows.rowCount === 1) {
      benchmarkId = String(ownedRows.rows[0].id);
      const deleted = await api("DELETE", `/api/benchmarks/${benchmarkId}`);
      check(deleted.ok, `Temporary Benchmark API deletion failed (${deleted.status})`);
      check((await visibleFor(benchmarkId)).length === 0, "Temporary alert remains visible after deletion");
    }
    const remaining = await client.query(`SELECT COUNT(*)::int AS count FROM benchmarks WHERE campaign_id = $1 AND name = $2`, [campaignId, name]);
    check(remaining.rows[0].count === 0, "Temporary Benchmark remains in production");
    result.cleanup = "temporary Benchmark deleted via API; alert history soft-hidden; email audit retained";
  } catch (error) {
    failure ||= error;
    result.cleanupError = String(error);
  }
  if (context) await context.close().catch(() => undefined);
  if (sessionId || signInTokenId) {
    const path = sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke` : `/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`;
    const revoked = await clerkPost(path).catch(() => null);
    if (!revoked?.ok) failure ||= new Error(`Clerk session/token revocation failed (${revoked?.status || "unavailable"})`);
  }
  await browser.close().catch(() => undefined);
  client.release();
  await pool.end();
}
console.log(JSON.stringify(result));
if (failure) throw failure;
