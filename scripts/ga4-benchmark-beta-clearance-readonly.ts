import { createHash } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Download, type Page } from "playwright";
import { PDFParse } from "pdf-parse";
import { pool } from "../server/db";
import { resolveGA4InsightTargetPeriodCompatibility, resolveGA4KpiConsumerState } from "../shared/ga4-kpi-consumer-state";
import { computeBenchmarkThresholdResult } from "../shared/kpi-math";

const BASE_URL = process.env.GA4_BENCHMARK_BETA_BASE_URL || "https://marketforensics.onrender.com";
const EXPECTED_SHA = process.env.GA4_BENCHMARK_BETA_EXPECTED_SHA || "5366d0babc9550ecd408e55bc385e7024854f424";
const sha = (value: unknown) => createHash("sha256").update(String(value ?? "")).digest("hex").slice(0, 12);
const round2 = (value: unknown) => Number((Number(value) || 0).toFixed(2));

if (!pool) throw new Error("DATABASE_URL is required");
const clerkSecret = String(process.env.CLERK_SECRET_KEY || "");
if (!clerkSecret) throw new Error("CLERK_SECRET_KEY is required");

type InventoryRow = {
  id: string;
  campaign_id: string;
  owner_id: string;
  metric: string | null;
  name: string;
  current_value: string | null;
  benchmark_value: string;
  period: string | null;
  unit: string;
  alerts_enabled: boolean;
  alert_threshold: string | null;
  alert_condition: string | null;
  updated_at: Date;
  reporting_time_zone: string | null;
  ga4_campaign_filter: unknown;
  property_id: string | null;
  method: string | null;
  history_count: string;
  latest_history_at: Date | null;
  report_count: string;
};

const parseJson = (value: unknown): any => {
  if (!value) return {};
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return {}; }
};

const normalizedEvidenceText = (value: unknown) =>
  String(value ?? "").replace(/,/g, "").replace(/\s+/g, " ").trim().toLowerCase();

const hasNumericEvidence = (text: string, value: unknown) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return false;
  const candidates = new Set([
    String(number),
    number.toFixed(2),
    number.toFixed(1),
    Math.round(number).toString(),
  ]);
  return [...candidates].some((candidate) => text.includes(candidate.toLowerCase()));
};

const pdfText = async (data: Buffer) => {
  const parser = new PDFParse({ data: new Uint8Array(data) });
  try {
    return (await parser.getText()).text;
  } finally {
    await parser.destroy();
  }
};

const downloadBuffer = async (download: Download) => {
  const stream = await download.createReadStream();
  if (!stream) throw new Error("Downloaded PDF stream is unavailable");
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  return Buffer.concat(chunks);
};

const reportConfig = (report: any) => parseJson(report?.configuration);
const reportIncludesBenchmarks = (report: any) => {
  const type = String(report?.reportType || "").trim().toLowerCase();
  if (type === "benchmarks" || type === "insights") return true;
  if (type !== "custom") return false;
  const config = reportConfig(report);
  return Boolean(
    config?.sections?.benchmarks
    || config?.subsections?.benchmarks?.items
    || config?.sections?.insights
    || (Array.isArray(config?.selectedBenchmarkIds) && config.selectedBenchmarkIds.length > 0),
  );
};

const selectedReportBenchmarks = (report: any, rows: InventoryRow[]) => {
  const config = reportConfig(report);
  const selected = new Set((Array.isArray(config?.selectedBenchmarkIds) ? config.selectedBenchmarkIds : []).map(String));
  return selected.size === 0 ? rows : rows.filter((row) => selected.has(String(row.id)));
};

const thresholdFor = (row: InventoryRow) => computeBenchmarkThresholdResult({
  metric: row.metric,
  name: row.name,
  unit: row.unit,
  current: Number(row.current_value),
  benchmarkValue: Number(row.benchmark_value),
});

const alertBreached = (row: InventoryRow, eligible: boolean) => {
  if (!eligible || !row.alerts_enabled || row.alert_threshold === null) return false;
  const current = Number(row.current_value);
  const threshold = Number(row.alert_threshold);
  if (!Number.isFinite(current) || !Number.isFinite(threshold)) return false;
  const condition = String(row.alert_condition || "below").toLowerCase();
  if (condition === "above") return current > threshold;
  if (condition === "equals") return Math.abs(current - threshold) < 0.01;
  return current < threshold;
};

const client = await pool.connect();
let browser: Browser | null = null;
const sessions: Array<{ sessionId: string; signInTokenId: string }> = [];

const clerkPost = async (path: string, body?: unknown) => fetch(`https://api.clerk.com/v1${path}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${clerkSecret}`, "Content-Type": "application/json" },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
});

const authenticatedContext = async (ownerId: string): Promise<{ context: BrowserContext; page: Page }> => {
  if (!browser) throw new Error("Browser is unavailable");
  const tokenResponse = await clerkPost("/sign_in_tokens", { user_id: ownerId, expires_in_seconds: 600 });
  const tokenBody: any = await tokenResponse.json().catch(() => ({}));
  if (!tokenResponse.ok || !tokenBody?.token) throw new Error(`Clerk sign-in token failed (${tokenResponse.status})`);

  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/sign-in?__clerk_ticket=${encodeURIComponent(String(tokenBody.token))}`, {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });
  await page.waitForFunction(() => Boolean((window as any).Clerk?.session?.id), undefined, { timeout: 60000 });
  const sessionId = await page.evaluate(() => String((window as any).Clerk?.session?.id || ""));
  sessions.push({ sessionId, signInTokenId: String(tokenBody.id || "") });
  return { context, page };
};

const api = async (page: Page, path: string) => page.evaluate(async (requestPath) => {
  const sessionToken = await (window as any).Clerk?.session?.getToken();
  if (!sessionToken) throw new Error("Clerk session token is unavailable");
  const response = await fetch(requestPath, {
    method: "GET",
    credentials: "include",
    headers: { Authorization: `Bearer ${sessionToken}` },
  });
  const text = await response.text();
  let body: any = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = text; }
  return { ok: response.ok, status: response.status, body };
}, path);

try {
  await client.query("BEGIN TRANSACTION READ ONLY");
  const inventory = await client.query<InventoryRow>(`
    SELECT
      b.id,
      b.campaign_id,
      c.owner_id,
      b.metric,
      b.name,
      b.current_value,
      b.benchmark_value,
      b.period,
      b.unit,
      b.alerts_enabled,
      b.alert_threshold,
      b.alert_condition,
      b.updated_at,
      c.reporting_time_zone,
      c.ga4_campaign_filter,
      connection.property_id,
      connection.method,
      COALESCE(history.history_count, 0)::text AS history_count,
      history.latest_history_at,
      COALESCE(reports.report_count, 0)::text AS report_count
    FROM benchmarks b
    JOIN campaigns c ON c.id = b.campaign_id
    LEFT JOIN LATERAL (
      SELECT g.property_id, g.method
      FROM ga4_connections g
      WHERE g.campaign_id = b.campaign_id AND g.is_active = true
      ORDER BY g.is_primary DESC, g.connected_at ASC
      LIMIT 1
    ) connection ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS history_count, MAX(recorded_at) AS latest_history_at
      FROM benchmark_history h
      WHERE h.benchmark_id = b.id
    ) history ON true
    LEFT JOIN LATERAL (
      SELECT COUNT(*) AS report_count
      FROM linkedin_reports r
      WHERE r.campaign_id = b.campaign_id
        AND r.platform_type = 'google_analytics'
        AND r.status = 'active'
    ) reports ON true
    WHERE b.platform_type = 'google_analytics'
      AND b.status = 'active'
      AND b.campaign_id IS NOT NULL
    ORDER BY c.owner_id, b.campaign_id, b.created_at
  `);
  await client.query("ROLLBACK");

  if (inventory.rows.length === 0) throw new Error("No active campaign-scoped GA4 Benchmarks exist in the target database");
  browser = await chromium.launch({ headless: true });

  const campaigns = new Map<string, InventoryRow[]>();
  for (const row of inventory.rows) {
    const key = `${row.owner_id}:${row.campaign_id}`;
    campaigns.set(key, [...(campaigns.get(key) || []), row]);
  }

  const failures: string[] = [];
  const results: any[] = [];
  for (const rows of campaigns.values()) {
    const first = rows[0];
    const { context, page } = await authenticatedContext(first.owner_id);
    const blockedApplicationMutations: string[] = [];
    let resolveDailyFreshness: (value: any) => void = () => undefined;
    const dailyFreshnessPromise = new Promise<any>((resolve) => { resolveDailyFreshness = resolve; });
    page.on("response", async (response) => {
      const url = new URL(response.url());
      if (url.pathname !== `/api/campaigns/${first.campaign_id}/ga4-daily`
        || url.searchParams.get("days") !== "30"
        || url.searchParams.get("propertyId") !== String(first.property_id || "")
        || url.searchParams.get("readOnly") !== "1") return;
      const body = response.ok() ? await response.json().catch(() => null) : null;
      resolveDailyFreshness(body && String(body?.propertyId || "") === String(first.property_id || "") ? body : null);
    });
    await page.route(`${BASE_URL}/**`, async (route) => {
      if (route.request().method() !== "GET") {
        blockedApplicationMutations.push(`${route.request().method()} ${new URL(route.request().url()).pathname}`);
        await route.abort();
        return;
      }
      await route.continue();
    });

    try {
      const health = await api(page, "/api/health");
      if (!health.ok || health.body?.commit !== EXPECTED_SHA) {
        failures.push(`${sha(first.campaign_id)}: deployed SHA mismatch`);
        continue;
      }

      const list = await api(page, `/api/platforms/google_analytics/benchmarks?campaignId=${encodeURIComponent(first.campaign_id)}`);
      const listed = Array.isArray(list.body) ? list.body : [];
      const expectedIds = new Set(rows.map((row) => String(row.id)));
      const listedIds = new Set(listed.map((row: any) => String(row?.id || "")));
      const listParity = expectedIds.size === listedIds.size && [...expectedIds].every((id) => listedIds.has(id));
      if (!list.ok || !listParity) failures.push(`${sha(first.campaign_id)}: authenticated Benchmark list parity failed`);

      let provider: any = null;
      let providerComparisons: any[] = [];
      let liveProvider = false;
      if (first.property_id) {
        const validation = await api(
          page,
          `/api/campaigns/${encodeURIComponent(first.campaign_id)}/ga4-benchmark-provider-validation?propertyId=${encodeURIComponent(first.property_id)}&disableTokenRefresh=1`,
        );
        if (!validation.ok || validation.body?.simulation?.tokenRefreshDisabled !== true) {
          failures.push(`${sha(first.campaign_id)}: provider validation failed or token refresh was not disabled`);
        } else {
          const comparisons = Array.isArray(validation.body?.benchmarks) ? validation.body.benchmarks : [];
          providerComparisons = comparisons;
          const comparisonIds = new Set(comparisons.map((row: any) => String(row?.id || "")));
          const comparisonParity = expectedIds.size === comparisonIds.size && [...expectedIds].every((id) => comparisonIds.has(id));
          if (!comparisonParity) failures.push(`${sha(first.campaign_id)}: provider comparison inventory mismatch`);
          const live = String(validation.body?.currentValueProvider?.status || "").startsWith("live_provider_success");
          liveProvider = live;
          const mismatches = comparisons.filter((row: any) => row?.computable && live && (
            Math.abs(Number(row?.storedVsSchedulerDelta || 0)) > 0.01 || Math.abs(Number(row?.storedVsUiDelta || 0)) > 0.01
          ));
          if (mismatches.length > 0) failures.push(`${sha(first.campaign_id)}: ${mismatches.length} live stored/scheduler/UI mismatches`);
          provider = {
            status: validation.body?.currentValueProvider?.status || null,
            requestedWindowStatus: validation.body?.provider?.status || null,
            propertyHash: sha(validation.body?.propertyId),
            campaignFilterConfigured: validation.body?.campaignFilter !== null,
            currentValueWindow: validation.body?.sourceWindows?.currentValue || null,
            persistedRowCount: Number(validation.body?.currentValuePersistedDaily?.rowCount || 0),
            comparisonCount: comparisons.length,
            mismatchCount: mismatches.length,
            comparisons: comparisons.map((row: any) => ({
              benchmarkHash: sha(row?.id),
              metric: row?.metric || null,
              storedCurrentValue: row?.storedCurrentValue ?? null,
              schedulerCandidateCurrentValue: row?.schedulerCandidateCurrentValue ?? null,
              uiCandidateCurrentValue: row?.uiCandidateCurrentValue ?? null,
              storedVsSchedulerDelta: row?.storedVsSchedulerDelta ?? null,
              storedVsUiDelta: row?.storedVsUiDelta ?? null,
              computable: Boolean(row?.computable),
            })),
          };
        }
      }

      await page.goto(`${BASE_URL}/campaigns/${encodeURIComponent(first.campaign_id)}/ga4-metrics?tab=benchmarks&readOnly=1`, {
        waitUntil: "domcontentloaded",
        timeout: 60000,
      });
      await page.locator("body").waitFor({ state: "visible", timeout: 30000 });
      await page.waitForFunction(() => {
        const text = String(document.body?.innerText || "");
        const section = document.querySelector("#ga4-benchmarks-section") as HTMLElement | null;
        const sectionVisible = Boolean(section && section.offsetParent !== null);
        return sectionVisible
          || text.includes("Connect Google Analytics")
          || text.includes("Connect GA4")
          || text.includes("Unable to load")
          || text.includes("Failed to load");
      }, undefined, { timeout: 60000 }).catch(() => null);
      if (first.property_id) {
        await page.waitForFunction((benchmarkIds) => benchmarkIds.every((id) => {
          const card = document.querySelector(`#ga4-benchmark-${id}`) as HTMLElement | null;
          const text = String(card?.innerText || "");
          return Boolean(card)
            && !/required source inputs are still loading|the benchmark list is still loading/i.test(text)
            && /on track|needs attention|behind|unavailable|last-good|insufficient data|blocked|failed/i.test(text);
        }), rows.map((row) => row.id), { timeout: 60000 }).catch(() => null);
      }
      const dailyFreshness = first.property_id
        ? await Promise.race([
            dailyFreshnessPromise,
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000)),
          ])
        : null;
      if (first.property_id && !dailyFreshness) {
        failures.push(`${sha(first.campaign_id)}: authoritative read-only GA4 daily freshness response was unavailable`);
      }
      const dailyRefreshIsStale = dailyFreshness?.refreshIsStale === true;
      const expectedConsumerStateById = new Map(rows.map((row) => [String(row.id), resolveGA4KpiConsumerState({
        metric: row.metric,
        name: row.name,
        listState: "ready",
        trafficState: dailyRefreshIsStale ? "stale" : dailyFreshness ? "ready" : "unavailable",
        revenueState: "ready",
        spendState: "ready",
        entityLabel: "Benchmark",
      }).code]));
      const bodyText = await page.locator("body").innerText();
      const benchmarkSectionVisible = await page.locator("#ga4-benchmarks-section").isVisible().catch(() => false);
      const missingCardNames = benchmarkSectionVisible ? rows.filter((row) => !bodyText.includes(row.name)) : rows;
      const trackerVisible = bodyText.includes("Total Benchmarks");
      const connectionPromptVisible = bodyText.includes("Connect Google Analytics") || bodyText.includes("Connect GA4");
      const errorStateVisible = bodyText.includes("Unable to load") || bodyText.includes("Failed to load");
      const cardEvidence: any[] = [];
      let trackerParity: boolean | string = first.property_id ? false : "not_applicable_no_property";
      if (first.property_id) {
        const scoredRows = rows.filter((row) => expectedConsumerStateById.get(String(row.id)) === "verified");
        const expectedTracker = {
          total: rows.length,
          onTrack: scoredRows.filter((row) => thresholdFor(row).status === "on_track").length,
          needsAttention: scoredRows.filter((row) => thresholdFor(row).status === "needs_attention").length,
          behind: scoredRows.filter((row) => thresholdFor(row).status === "behind").length,
          avgPct: scoredRows.length > 0 ? scoredRows.reduce((sum, row) => sum + thresholdFor(row).pct, 0) / scoredRows.length : 0,
        };
        const trackerDom = await page.evaluate(() => {
          const labels = ["Total Benchmarks", "On Track", "Needs Attention", "Behind", "Avg. Progress"];
          return Object.fromEntries(labels.map((label) => {
            const node = [...document.querySelectorAll("p")].find((item) => String(item.textContent || "").trim() === label);
            const values = node?.parentElement ? [...node.parentElement.querySelectorAll("p")] : [];
            return [label, String(values[1]?.textContent || "").trim()];
          }));
        });
        trackerParity = Number(trackerDom["Total Benchmarks"]) === expectedTracker.total
          && Number(trackerDom["On Track"]) === expectedTracker.onTrack
          && Number(trackerDom["Needs Attention"]) === expectedTracker.needsAttention
          && Number(trackerDom["Behind"]) === expectedTracker.behind
          && Math.abs(Number(String(trackerDom["Avg. Progress"]).replace("%", "")) - expectedTracker.avgPct) <= 0.11;
        for (const row of rows) {
          const card = page.locator(`#ga4-benchmark-${row.id}`);
          const visible = await card.isVisible().catch(() => false);
          const text = visible ? normalizedEvidenceText(await card.innerText()) : "";
          const threshold = thresholdFor(row);
          const statusLabel = threshold.status === "on_track"
            ? "on track"
            : threshold.status === "needs_attention"
              ? "needs attention"
              : "behind";
          const checks = {
            name: text.includes(normalizedEvidenceText(row.name)),
            current: hasNumericEvidence(text, row.current_value),
            target: hasNumericEvidence(text, row.benchmark_value),
            status: text.includes(statusLabel),
          };
          const statusLabelsPresent = ["on track", "needs attention", "behind"].filter((label) => text.includes(label));
          const displayedState = text.includes("last-good")
            ? "stale_last_good"
            : text.includes("not available") || text.includes("unavailable")
              ? "unavailable"
              : text.includes("needs more data")
                ? "insufficient_data"
                : text.includes("paused until inputs are restored")
                  ? "blocked"
                  : "scored";
          const expectedState = expectedConsumerStateById.get(String(row.id));
          const staleFailClosed = expectedState === "stale"
            ? checks.name && checks.current && checks.target && displayedState === "stale_last_good" && statusLabelsPresent.length === 0
            : null;
          const exact = visible && (expectedState === "stale" ? staleFailClosed === true : Object.values(checks).every(Boolean));
          if (!exact) failures.push(`${sha(row.id)}: deployed Benchmark card value/target/state parity failed`);
          cardEvidence.push({
            benchmarkHash: sha(row.id),
            visible,
            exact,
            expectedState,
            status: threshold.status,
            checks,
            numericTokens: text.match(/-?\d+(?:\.\d+)?/g) || [],
            statusLabelsPresent,
            displayedState,
            staleFailClosed,
          });
        }
        if (missingCardNames.length > 0 || !trackerVisible || !trackerParity) {
          failures.push(`${sha(first.campaign_id)}: deployed card/Tracker render parity failed`);
        }
      } else if (!connectionPromptVisible || errorStateVisible) {
        failures.push(`${sha(first.campaign_id)}: no-property Benchmark consumer did not fail closed to the connection state`);
      }

      let insightsParity: boolean | string = first.property_id ? false : "fail_closed_no_property";
      const insightEvidence: any[] = [];
      if (first.property_id) {
        await page.getByRole("tab", { name: "Insights", exact: true }).click();
        await page.getByText("What to investigate next", { exact: true }).waitFor({ state: "visible", timeout: 60000 });
        const expectedInsightTitles = rows
          .map((row) => ({ row, threshold: thresholdFor(row), compatibility: resolveGA4InsightTargetPeriodCompatibility(row) }))
          .filter(({ row, threshold, compatibility }) => expectedConsumerStateById.get(String(row.id)) === "verified"
            && compatibility.comparable
            && (threshold.status === "behind" || threshold.status === "needs_attention"))
          .map(({ row, threshold }) => `${row.name} ${threshold.status === "behind" ? "Behind Benchmark" : "Below Benchmark"}`);
        await page.waitForFunction((titles) => {
          const text = String(document.body?.innerText || "");
          return titles.every((title) => text.includes(title));
        }, expectedInsightTitles, { timeout: 60000 }).catch(() => null);
        const insightsText = normalizedEvidenceText(await page.locator("body").innerText());
        insightsParity = true;
        for (const row of rows) {
          const threshold = thresholdFor(row);
          const compatibility = resolveGA4InsightTargetPeriodCompatibility(row);
          const actionable = expectedConsumerStateById.get(String(row.id)) === "verified"
            && compatibility.comparable
            && (threshold.status === "behind" || threshold.status === "needs_attention");
          const title = `${row.name} ${threshold.status === "behind" ? "Behind Benchmark" : "Below Benchmark"}`;
          const titlePresent = insightsText.includes(normalizedEvidenceText(title));
          const negativeTitlePresent = insightsText.includes(normalizedEvidenceText(`${row.name} Behind Benchmark`))
            || insightsText.includes(normalizedEvidenceText(`${row.name} Below Benchmark`));
          const checks = {
            title: titlePresent,
            current: hasNumericEvidence(insightsText, row.current_value),
            target: hasNumericEvidence(insightsText, row.benchmark_value),
          };
          const exact = actionable
            ? Object.values(checks).every(Boolean)
            : !negativeTitlePresent;
          if (!exact) {
            insightsParity = false;
            failures.push(`${sha(row.id)}: deployed Insights Benchmark conclusion parity failed`);
          }
          insightEvidence.push({
            benchmarkHash: sha(row.id),
            expectedStatus: threshold.status,
            actionable,
            exact,
            checks,
            titleLabelsPresent: ["behind benchmark", "below benchmark"].filter((label) => insightsText.includes(label)),
          });
        }
      }

      const notificationsResponse = await api(page, "/api/notifications?readOnly=1");
      const notifications = Array.isArray(notificationsResponse.body) ? notificationsResponse.body : [];
      const comparisonById = new Map(providerComparisons.map((comparison: any) => [String(comparison?.id || ""), comparison]));
      const notificationEvidence: any[] = [];
      if (!notificationsResponse.ok) failures.push(`${sha(first.campaign_id)}: authenticated notification inventory failed`);
      for (const row of rows) {
        const visible = notifications.filter((notification: any) => {
          const metadata = parseJson(notification?.metadata);
          return String(metadata?.benchmarkId || "") === String(row.id);
        });
        const comparison = comparisonById.get(String(row.id)) as any;
        const expectedState = expectedConsumerStateById.get(String(row.id));
        const eligible = Boolean(first.property_id && liveProvider && comparison?.computable && expectedState === "verified");
        const expectedBreach = alertBreached(row, eligible);
        let exact = expectedBreach ? visible.length === 1 : visible.length === 0;
        if (visible.length === 1) {
          const metadata = parseJson(visible[0]?.metadata);
          exact = exact
            && Math.abs(Number(metadata?.currentValue) - Number(row.current_value)) <= 0.01
            && Math.abs(Number(metadata?.thresholdValue) - Number(row.alert_threshold)) <= 0.01
            && String(metadata?.alertCondition || "below") === String(row.alert_condition || "below")
            && String(metadata?.actionUrl || "") === `/campaigns/${row.campaign_id}/ga4-metrics?tab=benchmarks&highlight=${row.id}`;
        }
        if (!exact) failures.push(`${sha(row.id)}: deployed Benchmark alert/notification decision parity failed`);
        notificationEvidence.push({
          benchmarkHash: sha(row.id),
          eligible,
          expectedState,
          alertsEnabled: row.alerts_enabled,
          expectedBreach,
          visibleCount: visible.length,
          exact,
        });
      }

      const reportsResponse = await api(
        page,
        `/api/platforms/google_analytics/reports?campaignId=${encodeURIComponent(first.campaign_id)}`,
      );
      const reports = (Array.isArray(reportsResponse.body) ? reportsResponse.body : [])
        .filter((report: any) => String(report?.status || "active") === "active");
      const relevantReports = reports.filter(reportIncludesBenchmarks);
      if (!reportsResponse.ok || reports.length !== Number(first.report_count || 0)) {
        failures.push(`${sha(first.campaign_id)}: authenticated GA4 report inventory parity failed`);
      }

      const reportEvidence: any[] = [];
      if (first.property_id && relevantReports.length > 0) {
        await page.getByRole("tab", { name: "Reports", exact: true }).click();
        await page.getByText("Reports", { exact: true }).first().waitFor({ state: "visible", timeout: 60000 });
      }
      for (const report of relevantReports) {
        const type = String(report?.reportType || "").trim().toLowerCase();
        const selectedRows = selectedReportBenchmarks(report, rows);
        const actionableRows = selectedRows.filter((row) => {
          const status = thresholdFor(row).status;
          return expectedConsumerStateById.get(String(row.id)) === "verified"
            && (status === "behind" || status === "needs_attention");
        });
        let browserPdfParity = false;
        let browserPdfError: string | null = null;
        let browserPdfRowEvidence: any[] = [];
        let browserPdfNumericTokens: string[] = [];
        if (first.property_id) {
          try {
            const heading = page.locator("h3").filter({ hasText: String(report?.name || "") }).first();
            await heading.waitFor({ state: "visible", timeout: 60000 });
            const card = heading.locator("xpath=ancestor::div[.//button[contains(normalize-space(.), 'Download')]][1]");
            const button = card.getByRole("button", { name: "Download" }).first();
            const downloadPromise = page.waitForEvent("download", { timeout: 90000 });
            await button.click();
            const download = await downloadPromise;
            const failure = await download.failure();
            if (failure) throw new Error(failure);
            const text = normalizedEvidenceText(await pdfText(await downloadBuffer(download)));
            browserPdfNumericTokens = (text.match(/-?\d+(?:\.\d+)?/g) || []).slice(0, 100);
            const expectedRows = type === "insights" ? actionableRows : selectedRows;
            browserPdfRowEvidence = expectedRows.map((row) => {
              const expectedState = expectedConsumerStateById.get(String(row.id));
              const name = text.includes(normalizedEvidenceText(row.name));
              const current = hasNumericEvidence(text, row.current_value);
              const target = hasNumericEvidence(text, row.benchmark_value);
              const staleFailClosed = expectedState === "stale"
                ? name && current && !target && text.includes("last-good value (not verified)")
                : null;
              return {
                benchmarkHash: sha(row.id),
                expectedState,
                name,
                current,
                target,
                staleFailClosed,
                exact: expectedState === "stale" ? staleFailClosed === true : name && current && target,
              };
            });
            browserPdfParity = browserPdfRowEvidence.every((item) => item.exact);
            if (!browserPdfParity) failures.push(`${sha(report?.id)}: deployed browser PDF Benchmark parity failed`);
          } catch (error: any) {
            browserPdfError = error?.message || "Browser PDF validation failed";
            failures.push(`${sha(report?.id)}: deployed browser PDF was unavailable for read-only validation`);
          }
        }

        const sendEvents = await api(
          page,
          `/api/platforms/google_analytics/reports/${encodeURIComponent(String(report?.id || ""))}/send-events`,
        );
        const snapshots = await api(
          page,
          `/api/platforms/google_analytics/reports/${encodeURIComponent(String(report?.id || ""))}/snapshots`,
        );
        const eventRows = Array.isArray(sendEvents.body?.events) ? sendEvents.body.events : [];
        const snapshotRows = Array.isArray(snapshots.body?.snapshots) ? snapshots.body.snapshots : [];
        const sentEvent = eventRows.find((event: any) => event?.status === "sent" && event?.sentAt && event?.snapshotId);
        const latestEvent = eventRows[0] || null;
        const scheduledArtifactCorrectlyFailClosed = Boolean(
          latestEvent?.status === "pending_delivery"
          && !latestEvent?.sentAt
          && !latestEvent?.snapshotId
          && String(latestEvent?.error || "").includes("delivery was not confirmed"),
        );
        const sentSnapshot = sentEvent
          ? snapshotRows.find((snapshot: any) => String(snapshot?.id || "") === String(sentEvent.snapshotId))
          : null;
        const payload = parseJson(sentSnapshot?.snapshotJson);
        const immutableBenchmarkRows = Array.isArray(payload?.benchmarks) ? payload.benchmarks : [];
        const scheduledArtifactMetadataParity = Boolean(
          sentEvent
          && sentSnapshot
          && String(sentSnapshot?.reportId || "") === String(report?.id || "")
          && String(sentSnapshot?.campaignId || "") === String(first.campaign_id)
          && String(sentSnapshot?.platformType || "").toLowerCase() === "google_analytics"
          && String(payload?.scheduledKey || "") === String(sentEvent?.scheduledKey || ""),
        );
        const scheduledArtifactValueParity = scheduledArtifactMetadataParity
          && immutableBenchmarkRows.length > 0
          && selectedRows.every((row) => immutableBenchmarkRows.some((item: any) =>
            String(item?.id || "") === String(row.id)
            && Math.abs(Number(item?.currentValue) - Number(row.current_value)) <= 0.01
            && Math.abs(Number(item?.benchmarkValue) - Number(row.benchmark_value)) <= 0.01));
        if (report?.scheduleEnabled
          && !scheduledArtifactCorrectlyFailClosed
          && (!scheduledArtifactMetadataParity || !scheduledArtifactValueParity)) {
          failures.push(`${sha(report?.id)}: existing scheduled report artifact lacks immutable Benchmark value parity evidence`);
        }
        reportEvidence.push({
          reportHash: sha(report?.id),
          reportType: type,
          scheduleEnabled: Boolean(report?.scheduleEnabled),
          scheduleTime: report?.scheduleTime || null,
          scheduleTimeZone: report?.scheduleTimeZone || null,
          scheduleRecipientCount: Array.isArray(report?.scheduleRecipients) ? report.scheduleRecipients.length : 0,
          selectedBenchmarkCount: selectedRows.length,
          browserPdfParity: first.property_id ? browserPdfParity : "not_applicable_no_property",
          browserPdfRowEvidence,
          browserPdfNumericTokens,
          browserPdfError,
          sendEventAccessible: sendEvents.ok,
          snapshotInventoryAccessible: snapshots.ok,
          sentEventObserved: Boolean(sentEvent),
          sentSnapshotObserved: Boolean(sentSnapshot),
          latestSendEventStatus: eventRows[0]?.status || null,
          latestSendEventError: eventRows[0]?.error || null,
          latestSendEventKey: eventRows[0]?.scheduledKey || null,
          scheduledArtifactMetadataParity,
          scheduledArtifactValueParity,
          scheduledArtifactCorrectlyFailClosed,
          scheduledArtifactPdfFetchAttempted: false,
          scheduledArtifactPdfFetchReason: "The deployed snapshot-PDF GET path performs a persisted GA4 KPI/Benchmark recompute, so it is prohibited by this read-only production validation.",
        });
      }

      if (blockedApplicationMutations.length > 0) {
        failures.push(`${sha(first.campaign_id)}: application mutation request was attempted during read-only validation`);
      }

      const emailAudits: any[] = [];
      for (const row of rows) {
        const audit = await api(page, `/api/benchmarks/${encodeURIComponent(row.id)}/alert-email-delivery-validation`);
        emailAudits.push({
          benchmarkHash: sha(row.id),
          accessible: audit.ok,
          deliveredEvidenceCount: Array.isArray(audit.body?.events)
            ? audit.body.events.filter((event: any) => event?.deliveryStatus === "delivered" && event?.deliveredAt).length
            : 0,
        });
      }

      results.push({
        campaignHash: sha(first.campaign_id),
        ownerHash: sha(first.owner_id),
        reportingTimeZone: first.reporting_time_zone || "UTC",
        propertyConfigured: Boolean(first.property_id),
        propertyHash: first.property_id ? sha(first.property_id) : null,
        connectionMethod: first.method,
        benchmarkCount: rows.length,
        authenticatedListParity: list.ok && listParity,
        cardAndTrackerRenderParity: first.property_id
          ? missingCardNames.length === 0 && trackerVisible && trackerParity
          : "not_applicable_no_property",
        insightsParity,
        browserState: {
          path: new URL(page.url()).pathname + new URL(page.url()).search,
          benchmarkSectionVisible,
          trackerVisible,
          benchmarkNamesFound: rows.length - missingCardNames.length,
          connectionPromptVisible,
          errorStateVisible,
        },
        cardEvidence,
        insightEvidence,
        dailyFreshness: first.property_id ? {
          refreshIsStale: dailyRefreshIsStale,
          validationReadOnly: dailyFreshness?.validationReadOnly === true,
          dataThroughDate: dailyFreshness?.dataThroughDate || null,
          latestStoredDailyDate: dailyFreshness?.latestStoredDailyDate || null,
          oldestDueMissingDailyDate: dailyFreshness?.oldestDueMissingDailyDate || null,
        } : null,
        provider,
        activeReportCount: Number(first.report_count || 0),
        relevantReportCount: relevantReports.length,
        reports: reportEvidence,
        notifications: notificationEvidence,
        benchmarks: rows.map((row) => ({
          benchmarkHash: sha(row.id),
          metric: row.metric,
          currentValue: round2(row.current_value),
          targetValue: round2(row.benchmark_value),
          thresholdStatus: thresholdFor(row).status,
          alertsEnabled: row.alerts_enabled,
          alertThreshold: row.alert_threshold === null ? null : round2(row.alert_threshold),
          alertCondition: row.alert_condition || "below",
          historyCount: Number(row.history_count || 0),
          latestHistoryAt: row.latest_history_at?.toISOString() || null,
          updatedAt: row.updated_at?.toISOString() || null,
        })),
        emailAudits,
        blockedApplicationMutationCount: blockedApplicationMutations.length,
      });
    } finally {
      await context.close();
    }
  }

  const schedulerResponse = await fetch(`${BASE_URL}/health/scheduler`);
  const scheduler = await schedulerResponse.json().catch(() => null as any);
  const output = {
    success: failures.length === 0,
    mode: "read_only_application_data",
    deployedSha: EXPECTED_SHA,
    campaignCount: campaigns.size,
    benchmarkCount: inventory.rows.length,
    failures,
    scheduler: scheduler?.ga4DailyScheduler || null,
    campaigns: results,
  };
  console.log(JSON.stringify(output, null, 2));
  if (failures.length > 0) process.exitCode = 1;
} finally {
  for (const session of sessions) {
    if (session.sessionId) await clerkPost(`/sessions/${encodeURIComponent(session.sessionId)}/revoke`).catch(() => null);
    else if (session.signInTokenId) await clerkPost(`/sign_in_tokens/${encodeURIComponent(session.signInTokenId)}/revoke`).catch(() => null);
  }
  if (browser) await browser.close().catch(() => null);
  client.release();
  await pool.end();
}
