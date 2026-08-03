import { createHash } from "node:crypto";
import { chromium, type Browser, type Page } from "playwright";
import { PDFParse } from "pdf-parse";
import { pool } from "../server/db";
import { computeBenchmarkThresholdResult } from "../shared/kpi-math";

const BASE_URL = process.env.GA4_BENCHMARK_BETA_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = String(process.env.GA4_BENCHMARK_BETA_EXPECTED_SHA || "").trim();
const RECIPIENT = String(process.env.GA4_BENCHMARK_AUTHORIZED_RECIPIENT || "").trim().toLowerCase();
const MANUAL_ONLY = process.env.GA4_BENCHMARK_COMMIT13_MANUAL_ONLY === "1";
const ALLOW_PENDING_DELIVERY = process.env.GA4_BENCHMARK_COMMIT13_ALLOW_PENDING_DELIVERY === "1";
const REPORT_TYPES = String(process.env.GA4_BENCHMARK_COMMIT13_REPORT_TYPES || "benchmarks,insights")
  .split(",")
  .map((value) => value.trim().toLowerCase())
  .filter((value): value is "benchmarks" | "insights" => value === "benchmarks" || value === "insights");
const sha = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const parseJson = (value: unknown): any => {
  if (value && typeof value === "object") return value;
  if (typeof value !== "string" || !value.trim()) return {};
  try { return JSON.parse(value); } catch { return {}; }
};
const stable = (value: any): any => Array.isArray(value)
  ? value.map(stable)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]))
    : value;
const boundaryHash = (value: any) => sha(JSON.stringify(stable(value)));
const normalizedText = (value: unknown) => String(value ?? "")
  .replace(/,/g, "")
  .replace(/\s+/g, " ")
  .trim()
  .toLowerCase();
const hasNumericEvidence = (text: string, value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  return [String(number), number.toFixed(2), number.toFixed(1)]
    .some((candidate) => text.includes(candidate.toLowerCase()));
};
const pdfText = async (data: Buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
};

if (!EXPECTED_SHA) throw new Error("GA4_BENCHMARK_BETA_EXPECTED_SHA is required");
if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(RECIPIENT)) {
  throw new Error("GA4_BENCHMARK_AUTHORIZED_RECIPIENT must be an explicit valid email address");
}
if (REPORT_TYPES.length === 0) throw new Error("At least one valid Commit 13 report type is required");
if (!pool) throw new Error("DATABASE_URL is required");
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");

const client = await pool.connect();
let browser: Browser | null = null;
let page: Page | null = null;
let report: any;
let original: any;
let temporary: any;
let temporaryApplied = false;
let restored = false;
let existingProviderResponseIds = new Set<string>();
let clerkSessionId = "";
let signInTokenId = "";
const startedAt = new Date();

const configurationBoundary = (row: any) => ({
  reportType: row.report_type ?? row.reportType,
  configuration: parseJson(row.configuration),
  scheduleEnabled: row.schedule_enabled ?? row.scheduleEnabled,
  scheduleFrequency: row.schedule_frequency ?? row.scheduleFrequency,
  scheduleDayOfWeek: row.schedule_day_of_week ?? row.scheduleDayOfWeek,
  scheduleDayOfMonth: row.schedule_day_of_month ?? row.scheduleDayOfMonth,
  scheduleTime: row.schedule_time ?? row.scheduleTime,
  scheduleTimeZone: row.schedule_time_zone ?? row.scheduleTimeZone,
  quarterTiming: row.quarter_timing ?? row.quarterTiming,
  scheduleRecipients: row.schedule_recipients ?? row.scheduleRecipients,
});

const clerkPost = async (path: string, body?: any) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const api = async (path: string, method = "GET", body?: any) => {
  if (!page) throw new Error("Authenticated page is unavailable");
  const sessionToken = await page.evaluate(async () => (window as any).Clerk?.session?.getToken());
  if (!sessionToken) throw new Error("Clerk session token is unavailable");
  const response = await page.request.fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { data: body }),
    timeout: 120000,
  });
  const text = await response.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { ok: response.ok(), status: response.status(), body: parsed };
};

const restoreViaDatabaseIfStillTemporary = async () => {
  if (!temporaryApplied || restored) return;
  const result = await client.query(`
    UPDATE linkedin_reports
    SET report_type = $1,
        configuration = $2,
        schedule_enabled = $3,
        schedule_frequency = $4,
        schedule_day_of_week = $5,
        schedule_day_of_month = $6,
        schedule_time = $7,
        schedule_time_zone = $8,
        quarter_timing = $9,
        schedule_recipients = $10,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $11
      AND report_type = $12
      AND configuration IS NOT DISTINCT FROM $13
      AND schedule_time IS NOT DISTINCT FROM $14
      AND schedule_recipients IS NOT DISTINCT FROM $15
  `, [
    original.reportType, original.configuration, original.scheduleEnabled, original.scheduleFrequency,
    original.scheduleDayOfWeek, original.scheduleDayOfMonth, original.scheduleTime,
    original.scheduleTimeZone, original.quarterTiming, original.scheduleRecipients,
    report.id, temporary.reportType, temporary.configuration, temporary.scheduleTime,
    temporary.scheduleRecipients,
  ]);
  if (result.rowCount !== 1) throw new Error(`Guarded fallback restoration changed ${result.rowCount} rows; expected 1`);
  restored = true;
};

const patchReport = async (boundary: any) => {
  const result = await api(
    `/api/platforms/google_analytics/reports/${encodeURIComponent(report.id)}`,
    "PATCH",
    boundary,
  );
  if (!result.ok) throw new Error(`Report patch failed (${result.status}): ${JSON.stringify(result.body)}`);
};

const nextScheduleTime = () => {
  const target = new Date(Date.now() + 3 * 60 * 1000);
  return `${String(target.getUTCHours()).padStart(2, "0")}:${String(target.getUTCMinutes()).padStart(2, "0")}`;
};

const createManualArtifact = async (reportType: "benchmarks" | "insights", benchmarkIds: string[]) => {
  const existingConfig = parseJson(original.configuration);
  temporary = {
    ...original,
    reportType,
    configuration: { ...existingConfig, selectedBenchmarkIds: benchmarkIds },
  };
  await patchReport(temporary);
  temporaryApplied = true;

  const created = await api(
    `/api/platforms/google_analytics/reports/${encodeURIComponent(report.id)}/snapshots`,
    "POST",
  );
  const snapshot = created.body?.snapshot;
  if (!created.ok || !snapshot?.id) {
    throw new Error(`${reportType} manual snapshot failed (${created.status}): ${JSON.stringify(created.body)}`);
  }
  const payload = parseJson(snapshot.snapshotJson);
  const immutableRows = Array.isArray(payload?.benchmarks) ? payload.benchmarks : [];
  if (immutableRows.length !== benchmarkIds.length) {
    throw new Error(`${reportType} manual snapshot Benchmark inventory mismatch`);
  }

  const persisted = await api(
    `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(report.campaign_id)}`,
  );
  if (!persisted.ok) throw new Error(`Persisted Benchmark inventory failed (${persisted.status})`);
  const persistedRows = Array.isArray(persisted.body) ? persisted.body : [];
  const rowEvidence = immutableRows.map((row: any) => {
    const current = persistedRows.find((item: any) => String(item?.id || "") === String(row?.id || ""));
    const expectedStatus = computeBenchmarkThresholdResult({
      metric: current?.metric,
      name: current?.name,
      unit: current?.unit,
      current: Number(current?.currentValue),
      benchmarkValue: Number(current?.benchmarkValue),
    }).status;
    return {
      benchmarkHash: sha(row?.id),
      exact: Boolean(
        current
        && Math.abs(Number(row?.currentValue) - Number(current?.currentValue)) <= 0.01
        && Math.abs(Number(row?.benchmarkValue) - Number(current?.benchmarkValue)) <= 0.01
        && String(row?.thresholdStatus || "") === String(expectedStatus || "")
      ),
      currentValue: Number(row?.currentValue),
      benchmarkValue: Number(row?.benchmarkValue),
      thresholdStatus: row?.thresholdStatus || null,
      name: String(row?.name || ""),
    };
  });
  if (!rowEvidence.every((row: any) => row.exact)) {
    throw new Error(`${reportType} manual immutable Benchmark value/state parity failed`);
  }

  const sessionToken = await page!.evaluate(async () => (window as any).Clerk?.session?.getToken());
  const pdfResponse = await page!.request.get(
    `${BASE_URL}/api/report-snapshots/${encodeURIComponent(String(snapshot.id))}/pdf`,
    { headers: { Authorization: `Bearer ${sessionToken}` }, timeout: 120000 },
  );
  const pdf = await pdfResponse.body();
  if (!pdfResponse.ok() || pdf.subarray(0, 5).toString() !== "%PDF-" || pdf.length < 1000) {
    throw new Error(`${reportType} manual snapshot PDF validation failed (${pdfResponse.status()}, ${pdf.length} bytes)`);
  }
  const text = normalizedText(await pdfText(pdf));
  const expectedPdfRows = reportType === "insights"
    ? rowEvidence.filter((row: any) => row.thresholdStatus === "behind" || row.thresholdStatus === "needs_attention")
    : rowEvidence;
  const pdfParity = expectedPdfRows.every((row: any) =>
    text.includes(normalizedText(row.name))
    && hasNumericEvidence(text, row.currentValue)
    && hasNumericEvidence(text, row.benchmarkValue));
  if (!pdfParity) throw new Error(`${reportType} manual snapshot PDF Benchmark parity failed`);

  return {
    reportType,
    source: "manual",
    snapshotHash: sha(snapshot.id),
    immutableBenchmarkCount: immutableRows.length,
    rowEvidence: rowEvidence.map(({ name: _name, ...row }: any) => row),
    pdf: { bytes: pdf.length, exact: true },
  };
};

const waitForScheduledArtifact = async (reportType: "benchmarks" | "insights", benchmarkIds: string[]) => {
  const scheduleTime = nextScheduleTime();
  const existingConfig = parseJson(original.configuration);
  const nextConfig = {
    ...existingConfig,
    selectedBenchmarkIds: benchmarkIds,
  };
  temporary = {
    ...original,
    reportType,
    configuration: nextConfig,
    scheduleEnabled: true,
    scheduleFrequency: "daily",
    scheduleTime,
    scheduleTimeZone: "UTC",
    scheduleRecipients: [RECIPIENT],
  };
  await patchReport(temporary);
  temporaryApplied = true;

  const deadline = Date.now() + 7 * 60 * 1000;
  let event: any = null;
  while (Date.now() < deadline) {
    const response = await api(
      `/api/platforms/google_analytics/reports/${encodeURIComponent(report.id)}/send-events`,
    );
    if (!response.ok) throw new Error(`Send-event inventory failed (${response.status})`);
    event = (Array.isArray(response.body?.events) ? response.body.events : []).find((item: any) =>
      String(item?.scheduledKey || "").includes(`T${scheduleTime}@UTC`)
      && new Date(item?.createdAt || 0).getTime() >= startedAt.getTime() - 60_000);
    if (event?.status === "sent" && event?.snapshotId) break;
    if (ALLOW_PENDING_DELIVERY && event?.status === "pending_delivery") break;
    if (event?.status === "failed" || event?.status === "skipped") {
      throw new Error(`${reportType} scheduled report ${event.status}: ${event.error || "unknown"}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 5000));
  }
  if (event?.status === "pending_delivery") {
    return {
      reportType,
      scheduledKey: event.scheduledKey,
      scheduledDeliveryState: "pending_delivery",
      failClosed: true,
      snapshotPresent: false,
      error: event.error || "Provider delivery was not confirmed",
    };
  }
  if (!event?.snapshotId || event?.status !== "sent") {
    throw new Error(`${reportType} scheduled report did not produce a sent snapshot`);
  }

  const snapshots = await api(
    `/api/platforms/google_analytics/reports/${encodeURIComponent(report.id)}/snapshots`,
  );
  if (!snapshots.ok) throw new Error(`Snapshot inventory failed (${snapshots.status})`);
  const snapshot = (Array.isArray(snapshots.body?.snapshots) ? snapshots.body.snapshots : [])
    .find((item: any) => String(item?.id || "") === String(event.snapshotId));
  if (!snapshot) throw new Error(`${reportType} sent snapshot was not readable`);
  const payload = parseJson(snapshot.snapshotJson);
  const immutableRows = Array.isArray(payload?.benchmarks) ? payload.benchmarks : [];
  if (immutableRows.length !== benchmarkIds.length) {
    throw new Error(`${reportType} snapshot Benchmark inventory mismatch`);
  }

  const persisted = await api(
    `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(report.campaign_id)}`,
  );
  if (!persisted.ok) throw new Error(`Persisted Benchmark inventory failed (${persisted.status})`);
  const persistedRows = Array.isArray(persisted.body) ? persisted.body : [];
  const rowEvidence = immutableRows.map((row: any) => {
    const current = persistedRows.find((item: any) => String(item?.id || "") === String(row?.id || ""));
    const expectedStatus = computeBenchmarkThresholdResult({
      metric: current?.metric,
      name: current?.name,
      unit: current?.unit,
      current: Number(current?.currentValue),
      benchmarkValue: Number(current?.benchmarkValue),
    }).status;
    return {
      benchmarkHash: sha(row?.id),
      exact: Boolean(
        current
        && Math.abs(Number(row?.currentValue) - Number(current?.currentValue)) <= 0.01
        && Math.abs(Number(row?.benchmarkValue) - Number(current?.benchmarkValue)) <= 0.01
        && String(row?.thresholdStatus || "") === String(expectedStatus || "")
      ),
      currentValue: Number(row?.currentValue),
      benchmarkValue: Number(row?.benchmarkValue),
      thresholdStatus: row?.thresholdStatus || null,
      name: String(row?.name || ""),
    };
  });
  if (!rowEvidence.every((row: any) => row.exact)) {
    throw new Error(`${reportType} immutable Benchmark value/state parity failed`);
  }

  const sessionToken = await page!.evaluate(async () => (window as any).Clerk?.session?.getToken());
  const pdfResponse = await page!.request.get(
    `${BASE_URL}/api/report-snapshots/${encodeURIComponent(String(event.snapshotId))}/pdf`,
    { headers: { Authorization: `Bearer ${sessionToken}` }, timeout: 120000 },
  );
  const pdf = await pdfResponse.body();
  if (!pdfResponse.ok() || pdf.subarray(0, 5).toString() !== "%PDF-" || pdf.length < 1000) {
    throw new Error(`${reportType} snapshot PDF validation failed (${pdfResponse.status()}, ${pdf.length} bytes)`);
  }
  const text = normalizedText(await pdfText(pdf));
  const expectedPdfRows = reportType === "insights"
    ? rowEvidence.filter((row: any) => row.thresholdStatus === "behind" || row.thresholdStatus === "needs_attention")
    : rowEvidence;
  const pdfParity = expectedPdfRows.every((row: any) =>
    text.includes(normalizedText(row.name))
    && hasNumericEvidence(text, row.currentValue)
    && hasNumericEvidence(text, row.benchmarkValue));
  if (!pdfParity) throw new Error(`${reportType} snapshot PDF Benchmark parity failed`);

  return {
    reportType,
    scheduledKey: event.scheduledKey,
    snapshotHash: sha(event.snapshotId),
    immutableBenchmarkCount: immutableRows.length,
    rowEvidence: rowEvidence.map(({ name: _name, ...row }: any) => row),
    pdf: { bytes: pdf.length, exact: true },
    providerConfirmedDelivery: true,
  };
};

try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const reports = await client.query(`
    SELECT r.*, c.owner_id
    FROM linkedin_reports r
    JOIN campaigns c ON c.id = r.campaign_id
    WHERE r.platform_type = 'google_analytics'
      AND r.report_type = 'benchmarks'
      AND r.status = 'active'
      AND EXISTS (
        SELECT 1 FROM ga4_connections g
        WHERE g.campaign_id = r.campaign_id AND g.is_active = true AND g.property_id IS NOT NULL
      )
      AND EXISTS (
        SELECT 1 FROM benchmarks b
        WHERE b.campaign_id = r.campaign_id
          AND b.platform_type = 'google_analytics'
          AND b.status = 'active'
      )
  `);
  if (reports.rows.length !== 1) {
    throw new Error(`Expected exactly one active configured GA4 Benchmark report; found ${reports.rows.length}`);
  }
  report = reports.rows[0];
  const benchmarks = await client.query(`
    SELECT id
    FROM benchmarks
    WHERE campaign_id = $1 AND platform_type = 'google_analytics' AND status = 'active'
    ORDER BY created_at
  `, [report.campaign_id]);
  const benchmarkIds = benchmarks.rows.map((row: any) => String(row.id));
  if (benchmarkIds.length === 0) throw new Error("The target report campaign has no active GA4 Benchmarks");
  original = configurationBoundary(report);
  const existingAudits = await client.query(`
    SELECT provider_response_id
    FROM email_alert_events
    WHERE kind = 'report' AND entity_type = 'report' AND entity_id = $1
  `, [report.id]);
  existingProviderResponseIds = new Set(
    existingAudits.rows.map((row: any) => String(row.provider_response_id || "")).filter(Boolean),
  );
  await client.query("ROLLBACK");

  const tokenResponse = await clerkPost("/sign_in_tokens", {
    user_id: String(report.owner_id),
    expires_in_seconds: 1200,
  });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);
  signInTokenId = String(tokenBody.id || "");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  page = await context.newPage();
  await page.goto(
    `${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`,
    { waitUntil: "domcontentloaded", timeout: 60000 },
  );
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  clerkSessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));
  const health = await api("/api/health");
  if (!health.ok || health.body?.commit !== EXPECTED_SHA) {
    throw new Error(`Exact deployed revision mismatch: ${health.body?.commit || health.status}`);
  }

  const artifacts = [];
  if (MANUAL_ONLY) {
    for (const reportType of REPORT_TYPES) {
      artifacts.push(await createManualArtifact(reportType, benchmarkIds));
    }
  } else {
    for (const reportType of REPORT_TYPES) {
      artifacts.push(await waitForScheduledArtifact(reportType, benchmarkIds));
    }
  }

  await patchReport(original);
  restored = true;

  await client.query("BEGIN TRANSACTION READ ONLY");
  const verification = await client.query("SELECT * FROM linkedin_reports WHERE id = $1", [report.id]);
  const deliveryRows = await client.query(`
    SELECT success, delivery_status, provider_response_id, delivered_at
    FROM email_alert_events
    WHERE kind = 'report' AND entity_type = 'report' AND entity_id = $1
    ORDER BY created_at
  `, [report.id]);
  await client.query("ROLLBACK");
  if (verification.rows.length !== 1) throw new Error("Restored report is missing");
  const originalHash = boundaryHash(original);
  const restoredHash = boundaryHash(configurationBoundary(verification.rows[0]));
  if (restoredHash !== originalHash) {
    throw new Error(`Restored configuration hash mismatch: ${restoredHash} != ${originalHash}`);
  }
  const delivered = deliveryRows.rows.filter((row: any) =>
    row.success === true
    && row.delivery_status === "delivered"
    && row.delivered_at
    && row.provider_response_id
    && !existingProviderResponseIds.has(String(row.provider_response_id)));
  if (!MANUAL_ONLY && !ALLOW_PENDING_DELIVERY && delivered.length < REPORT_TYPES.length) {
    throw new Error(`Expected ${REPORT_TYPES.length} provider-confirmed deliveries; found ${delivered.length}`);
  }

  console.log(JSON.stringify({
    success: true,
    deployedSha: EXPECTED_SHA,
    reportHash: sha(report.id),
    campaignHash: sha(report.campaign_id),
    ownerHash: sha(report.owner_id),
    recipientHash: sha(RECIPIENT),
    recipientCount: 1,
    benchmarkCount: benchmarkIds.length,
    artifacts,
    validationMode: MANUAL_ONLY ? "manual_snapshot_artifacts" : "scheduled_delivery_artifacts",
    productionDeliveryCertification: artifacts.some((artifact: any) => artifact?.scheduledDeliveryState === "pending_delivery")
      ? "UNVERIFIED_PENDING_DELIVERY"
      : "PROVIDER_CONFIRMED",
    providerConfirmedDeliveryCount: delivered.length,
    originalConfigurationHash: originalHash,
    restoredConfigurationHash: restoredHash,
    productionConfigurationRestored: true,
  }, null, 2));
} finally {
  if (temporaryApplied && !restored) {
    try {
      if (page) {
        const result = await api(
          `/api/platforms/google_analytics/reports/${encodeURIComponent(report.id)}`,
          "PATCH",
          original,
        );
        restored = result.ok;
      }
    } catch {}
    if (!restored) await restoreViaDatabaseIfStillTemporary();
  }
  if (clerkSessionId) await clerkPost(`/sessions/${encodeURIComponent(clerkSessionId)}/revoke`).catch(() => null);
  if (signInTokenId && !clerkSessionId) {
    await clerkPost(`/sign_in_tokens/${encodeURIComponent(signInTokenId)}/revoke`).catch(() => null);
  }
  if (browser) await browser.close().catch(() => null);
  await client.query("ROLLBACK").catch(() => null);
  client.release();
  await pool.end();
}
