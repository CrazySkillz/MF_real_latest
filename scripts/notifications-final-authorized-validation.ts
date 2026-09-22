import { randomBytes } from "node:crypto";
import { chromium, type Page } from "playwright";
import { pool } from "../server/db";

const base = "https://marketforensics.onrender.com";
const expectedSha = "e6a9d7cb17e9389bfa12c80f9f9563da44f33bb1";
const campaign2 = "eee3e654-b736-4e8e-86ec-1050e4d905c0";
const recipient = "tester_for_mm@outlook.com";
const marker = `Notifications Cert ${randomBytes(8).toString("hex")}`;
const secret = String(process.env.CLERK_SECRET_KEY || "").trim();
const check = (ok: unknown, message: string) => { if (!ok) throw new Error(message); };
const meta = (value: unknown): any => {
  try { return typeof value === "string" ? JSON.parse(value) : value || {}; } catch { return {}; }
};

if (!pool || !secret) throw new Error("DATABASE_URL and CLERK_SECRET_KEY are required");
const db = await pool.connect();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();
let ownerId = "";
let sessionId = "";
let signInTokenId = "";
let clientId = "";
let campaignA = "";
let campaignB = "";
let kpiId = "";
let benchmarkA = "";
let benchmarkB = "";
let emailBenchmarkId = "";
let emailEnabled = false;
let failure: unknown = null;
const result: Record<string, unknown> = { runtime: expectedSha, marker };

const health = async () => {
  const response = await fetch(`${base}/api/health`);
  const body: any = await response.json();
  check(response.ok && body.commit === expectedSha && body.nodeEnv === "production", "Render runtime changed");
};
const clerkPost = (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST", headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});
const api = async (method: string, path: string, body?: unknown) => {
  if (method !== "GET") await health();
  return page.evaluate(async (input) => {
    const token = await (window as any).Clerk?.session?.getToken();
    if (!token) throw new Error("Owner session unavailable");
    const response = await fetch(input.path, {
      method: input.method, credentials: "include",
      headers: { Authorization: `Bearer ${token}`, ...(input.body === undefined ? {} : { "Content-Type": "application/json" }) },
      body: input.body === undefined ? undefined : JSON.stringify(input.body),
    });
    const raw = await response.text();
    let parsed: any = raw;
    try { parsed = raw ? JSON.parse(raw) : null; } catch { /* retain raw response */ }
    return { ok: response.ok, status: response.status, body: parsed };
  }, { method, path, body });
};
const activeFor = async (key: "kpiId" | "benchmarkId", id: string) => {
  const response = await api("GET", "/api/notifications?readOnly=1");
  check(response.ok && Array.isArray(response.body), `Notification GET failed (${response.status})`);
  return response.body.filter((row: any) => String(meta(row.metadata)[key] || "") === id);
};
const assertHiddenHistory = async (key: "kpiId" | "benchmarkId", id: string, campaignId: string, reason: string) => {
  check((await activeFor(key, id)).length === 0, `${reason}: alert remains visible`);
  const rows = await db.query("SELECT read, metadata FROM notifications WHERE campaign_id = $1 AND metadata LIKE $2", [campaignId, `%${id}%`]);
  check(rows.rowCount === 1 && rows.rows[0].read && meta(rows.rows[0].metadata).dismissalReason === reason,
    `${reason}: soft-hidden history mismatch`);
};
const createBenchmark = async (campaignId: string, suffix: string) => {
  const response = await api("POST", "/api/benchmarks", {
    campaignId, platformType: "google_analytics", name: `${marker} ${suffix}`, metric: "__custom__",
    description: "Disposable Notifications certification alert", category: "performance",
    benchmarkType: "goal", period: "monthly", unit: "count",
    currentValue: "0", benchmarkValue: "10", alertsEnabled: true,
    alertThreshold: "5", alertCondition: "below", alertFrequency: "daily", emailNotifications: false,
  });
  check(response.ok && response.body?.id && response.body.campaignId === campaignId,
    `Disposable Benchmark ${suffix} create failed (${response.status})`);
  return String(response.body.id);
};

try {
  await health();
  const owner = await db.query("SELECT owner_id, client_id, name FROM campaigns WHERE id = $1", [campaign2]);
  check(owner.rowCount === 1 && owner.rows[0].name === "Campaign2" && owner.rows[0].owner_id, "Campaign2 boundary changed");
  ownerId = String(owner.rows[0].owner_id);
  const baseline = await db.query("SELECT (SELECT count(*)::int FROM kpis WHERE campaign_id = $1) AS kpis, (SELECT count(*)::int FROM benchmarks WHERE campaign_id = $1) AS benchmarks", [campaign2]);
  check(baseline.rows[0].kpis === 0 && baseline.rows[0].benchmarks === 0, "Campaign2 is not empty; refusing test writes");
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 600 });
  const signIn: any = await tokenResponse.json().catch(() => ({}));
  check(tokenResponse.ok && signIn.token && signIn.id, `Owner sign-in failed (${tokenResponse.status})`);
  signInTokenId = String(signIn.id);
  await page.goto(`${base}/sign-in?__clerk_ticket=${encodeURIComponent(String(signIn.token))}`, { waitUntil: "domcontentloaded", timeout: 60_000 });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60_000 });
  sessionId = await page.evaluate(() => String((window as any).Clerk.session.id));
  check((await api("GET", "/api/notifications?readOnly=1")).ok, "Owner notification GET failed");

  if (process.env.NOTIFICATIONS_EMAIL_ONLY !== "true") {
  const foreign = await db.query("SELECT id, client_id FROM campaigns WHERE owner_id <> $1 AND client_id IS NOT NULL LIMIT 1", [ownerId]);
  if (foreign.rowCount === 1) {
    check((await api("GET", `/api/campaigns/${foreign.rows[0].id}`)).status === 404, "Foreign campaign GET did not fail closed");
    check((await api("GET", `/api/campaigns?clientId=${encodeURIComponent(foreign.rows[0].client_id)}`)).status === 404,
      "Foreign client filter did not fail closed");
    result.crossOwnerReadDenied = true;
  } else {
    const owned = await db.query("SELECT id FROM campaigns WHERE owner_id = $1", [ownerId]);
    const ownedIds = new Set(owned.rows.map((row: any) => String(row.id)));
    const visible = await api("GET", "/api/notifications?readOnly=1");
    check(visible.ok && Array.isArray(visible.body) && visible.body.every((row: any) => ownedIds.has(String(row.campaignId))),
      "Owner notification GET included a foreign or orphaned campaign");
    result.crossOwnerReadDenied = "owner-scoped list only; no live foreign campaign available for direct denial";
  }

  const newClient = await api("POST", "/api/clients", { name: `${marker} Client` });
  check(newClient.status === 201 && newClient.body?.id && newClient.body.ownerId === ownerId, "Disposable client create failed");
  clientId = String(newClient.body.id);
  const createCampaign = async (suffix: string) => {
    const response = await api("POST", "/api/campaigns", {
      clientId, name: `${marker} ${suffix}`, platform: "google_analytics", status: "active",
      reportingTimeZone: "Europe/Amsterdam", currency: "USD",
    });
    check(response.status === 201 && response.body?.id && response.body.clientId === clientId,
      `Disposable campaign ${suffix} create failed (${response.status})`);
    return String(response.body.id);
  };
  campaignA = await createCampaign("Campaign A");
  campaignB = await createCampaign("Campaign B");
  benchmarkA = await createBenchmark(campaignA, "Benchmark A");
  benchmarkB = await createBenchmark(campaignB, "Benchmark B");
  check((await activeFor("benchmarkId", benchmarkA)).length === 1 && (await activeFor("benchmarkId", benchmarkB)).length === 1,
    "Disposable campaign alerts not visible");
  const deletedA = await api("DELETE", `/api/campaigns/${campaignA}`);
  check(deletedA.ok, `Campaign delete failed (${deletedA.status})`);
  await assertHiddenHistory("benchmarkId", benchmarkA, campaignA, "campaign_deleted");
  check((await activeFor("benchmarkId", benchmarkB)).length === 1, "Other campaign alert was affected");
  campaignA = ""; benchmarkA = "";
  const deletedClient = await api("DELETE", `/api/clients/${clientId}`);
  check(deletedClient.ok, `Client delete failed (${deletedClient.status})`);
  await assertHiddenHistory("benchmarkId", benchmarkB, campaignB, "campaign_deleted");
  const clientRemaining = await db.query("SELECT (SELECT count(*)::int FROM clients WHERE id=$1) AS clients, (SELECT count(*)::int FROM campaigns WHERE client_id=$1) AS campaigns", [clientId]);
  check(clientRemaining.rows[0].clients === 0 && clientRemaining.rows[0].campaigns === 0, "Client cascade left child rows");
  clientId = ""; campaignB = ""; benchmarkB = "";
  result.campaignAndClientDelete = "active alerts soft-hidden; other campaign stayed visible; child rows removed";
  console.log("Disposable campaign and client deletion: passed");

  const newKpi = await api("POST", "/api/platforms/google_analytics/kpis", {
    campaignId: campaign2, name: `${marker} KPI`, metric: "__custom__", description: "Disposable KPI delete check",
    unit: "count", currentValue: "0", targetValue: "10", priority: "high", status: "tracking",
    alertsEnabled: true, alertThreshold: "5", alertCondition: "below", emailNotifications: false,
  });
  check(newKpi.ok && newKpi.body?.id && newKpi.body.campaignId === campaign2, `Disposable KPI create failed (${newKpi.status})`);
  kpiId = String(newKpi.body.id);
  check((await activeFor("kpiId", kpiId)).length === 1, "Disposable KPI active alert missing");
  const deletedKpi = await api("DELETE", `/api/platforms/google_analytics/kpis/${kpiId}`);
  check(deletedKpi.ok, `KPI delete failed (${deletedKpi.status})`);
  await assertHiddenHistory("kpiId", kpiId, campaign2, "kpi_deleted");
  const kpiRemaining = await db.query("SELECT (SELECT count(*)::int FROM kpis WHERE id=$1) AS parent, (SELECT count(*)::int FROM kpi_progress WHERE kpi_id=$1) AS progress, (SELECT count(*)::int FROM kpi_alerts WHERE kpi_id=$1) AS alerts, (SELECT count(*)::int FROM kpi_periods WHERE kpi_id=$1) AS periods", [kpiId]);
  check(Object.values(kpiRemaining.rows[0]).every((count) => count === 0), "KPI deletion left parent/child rows");
  kpiId = "";
  result.kpiDelete = "active alert soft-hidden; parent and children removed";
  console.log("Disposable GA4 KPI deletion: passed");
  }

  emailBenchmarkId = await createBenchmark(campaign2, "Scheduled Email Benchmark");
  check((await activeFor("benchmarkId", emailBenchmarkId)).length === 1, "Scheduled Benchmark alert missing");
  const priorAudit = await db.query("SELECT count(*)::int AS count FROM email_alert_events WHERE entity_type='benchmark' AND entity_id=$1", [emailBenchmarkId]);
  check(priorAudit.rows[0].count === 0, "Scheduled Benchmark already has an email audit");
  const enabledAt = new Date();
  const enabled = await db.query("UPDATE benchmarks SET email_notifications=true, email_recipients=$1, alert_frequency='daily', last_alert_sent=NULL WHERE id=$2 AND campaign_id=$3 AND name=$4 AND email_notifications=false RETURNING id", [recipient, emailBenchmarkId, campaign2, `${marker} Scheduled Email Benchmark`]);
  check(enabled.rowCount === 1, "Exact scheduled-email opt-in failed");
  emailEnabled = true;
  console.log("One temporary Benchmark opted in; waiting for natural scheduler event");
  let audit: any = null;
  const deadline = Date.now() + 18 * 60_000;
  while (Date.now() < deadline) {
    const rows = await db.query('SELECT id, "to", provider, success, delivery_status, provider_response_id, created_at FROM email_alert_events WHERE entity_type=$2 AND entity_id=$1 ORDER BY created_at', [emailBenchmarkId, "benchmark"]);
    check(rows.rowCount <= 1, "More than one email audit was created");
    if (rows.rowCount === 1) { audit = rows.rows[0]; break; }
    await new Promise((resolve) => setTimeout(resolve, 15_000));
  }
  check(audit, "No natural scheduled email audit within 18 minutes");
  const disabled = await db.query("UPDATE benchmarks SET email_notifications=false WHERE id=$1 AND campaign_id=$2 AND name=$3 AND email_notifications=true RETURNING id", [emailBenchmarkId, campaign2, `${marker} Scheduled Email Benchmark`]);
  check(disabled.rowCount === 1, "Exact scheduled-email opt-out failed");
  emailEnabled = false;
  check(String(audit.to).trim() === recipient, "Scheduled email recipient mismatch");
  const deliveryDeadline = Date.now() + 3 * 60_000;
  while (Date.now() < deliveryDeadline) {
    const rows = await db.query("SELECT success, delivery_status, provider, provider_response_id, delivered_at FROM email_alert_events WHERE entity_type='benchmark' AND entity_id=$1", [emailBenchmarkId]);
    check(rows.rowCount === 1, "Scheduled email audit count changed");
    audit = rows.rows[0];
    if (["delivered", "failed", "retry_scheduled", "skipped"].includes(String(audit.delivery_status))) break;
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  result.naturalSchedulerEmail = {
    auditCount: 1, recipient, enabledAt: enabledAt.toISOString(), provider: audit.provider,
    providerAccepted: Boolean(audit.success), deliveryStatus: audit.delivery_status,
    providerDeliveryConfirmed: audit.delivery_status === "delivered" && Boolean(audit.delivered_at),
  };
  console.log(`Natural scheduler audit: ${audit.delivery_status}`);
  check(result.naturalSchedulerEmail && audit.delivery_status === "delivered" && audit.delivered_at,
    "Scheduled email provider delivery was not confirmed");
  const deletedEmailBenchmark = await api("DELETE", `/api/benchmarks/${emailBenchmarkId}`);
  check(deletedEmailBenchmark.ok, `Scheduled Benchmark cleanup failed (${deletedEmailBenchmark.status})`);
  await assertHiddenHistory("benchmarkId", emailBenchmarkId, campaign2, "benchmark_deleted");
  emailBenchmarkId = "";
  await health();
  result.complete = true;
} catch (error) {
  failure = error;
} finally {
  try {
    if (emailEnabled && emailBenchmarkId) {
      await db.query("UPDATE benchmarks SET email_notifications=false WHERE id=$1 AND campaign_id=$2 AND name=$3", [emailBenchmarkId, campaign2, `${marker} Scheduled Email Benchmark`]);
    }
    if (emailBenchmarkId) await api("DELETE", `/api/benchmarks/${emailBenchmarkId}`);
    if (kpiId) await api("DELETE", `/api/platforms/google_analytics/kpis/${kpiId}`);
    if (campaignA) await api("DELETE", `/api/campaigns/${campaignA}`);
    if (campaignB) await api("DELETE", `/api/campaigns/${campaignB}`);
    if (clientId) await api("DELETE", `/api/clients/${clientId}`);
    const remaining = await db.query("SELECT (SELECT count(*)::int FROM clients WHERE owner_id=$1 AND name LIKE $2) AS clients, (SELECT count(*)::int FROM campaigns WHERE owner_id=$1 AND name LIKE $2) AS campaigns, (SELECT count(*)::int FROM kpis WHERE campaign_id=$3 AND name LIKE $2) AS kpis, (SELECT count(*)::int FROM benchmarks WHERE campaign_id=$3 AND name LIKE $2) AS benchmarks", [ownerId, `${marker}%`, campaign2]);
    check(Object.values(remaining.rows[0]).every((count) => count === 0), "Disposable parent records remain after cleanup");
    result.cleanup = "all disposable parent records removed; notification and email audit retained";
  } catch (error) {
    failure ||= error;
    result.cleanupError = String(error);
  }
  if (sessionId || signInTokenId) {
    const path = sessionId ? `/sessions/${encodeURIComponent(sessionId)}/revoke` : `/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`;
    const revoked = await clerkPost(path).catch(() => null);
    if (!revoked?.ok) failure ||= new Error(`Clerk session/token revocation failed (${revoked?.status || "unavailable"})`);
  }
  await context.close().catch(() => undefined);
  await browser.close().catch(() => undefined);
  db.release();
  await pool.end();
}
console.log(JSON.stringify(result));
if (failure) throw failure;
