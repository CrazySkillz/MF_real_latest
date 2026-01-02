/**
 * Daily Auto-Refresh + Auto-Process Scheduler
 *
 * Goal: after a user completes initial setup (LinkedIn import + revenue mappings),
 * keep data and conversion value up-to-date without manual clicks.
 *
 * What this scheduler does:
 * - Refreshes LinkedIn data (creates a new import session per campaign) using existing scheduler logic
 * - Re-processes revenue metrics for HubSpot / Salesforce / Shopify based on stored mappingConfig
 *
 * Notes:
 * - We intentionally call the existing API endpoints for "save-mappings" so business logic stays in one place.
 * - This avoids duplicating provider token-refresh logic (HubSpot/Salesforce) here.
 */

import { storage } from "./storage";
import { refreshAllLinkedInData } from "./linkedin-scheduler";

type AnyRecord = Record<string, any>;

function getServerBaseUrl(): string {
  // Prefer explicit base URL when deployed behind a proxy.
  const explicit = (process.env.INTERNAL_API_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const port = String(process.env.PORT || "5000");
  return `http://127.0.0.1:${port}`;
}

async function postJson(path: string, body: AnyRecord): Promise<{ ok: boolean; status: number; json?: any; text?: string }> {
  const url = `${getServerBaseUrl()}${path.startsWith("/") ? "" : "/"}${path}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const text = await resp.text().catch(() => "");
  let json: any = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    // ignore
  }
  return { ok: resp.ok, status: resp.status, json, text };
}

function safeJsonParse<T = any>(raw: any): T | null {
  if (!raw) return null;
  if (typeof raw === "object") return raw as T;
  try {
    return JSON.parse(String(raw)) as T;
  } catch {
    return null;
  }
}

async function reprocessHubSpot(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body = {
    campaignProperty: mappingConfig.campaignProperty,
    selectedValues: mappingConfig.selectedValues,
    revenueProperty: mappingConfig.revenueProperty,
    days: mappingConfig.days,
    stageIds: mappingConfig.stageIds,
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] HubSpot reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueField: mappingConfig.revenueField,
    days: mappingConfig.days,
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/salesforce/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Salesforce reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueMetric: mappingConfig.revenueMetric,
    days: mappingConfig.days,
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/shopify/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Shopify reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

export async function runDailyAutoRefreshOnce(): Promise<void> {
  // Prevent overlapping runs (e.g. slow API + interval overlap).
  if ((global as any).__autoRefreshInProgress) {
    console.log("[Auto Refresh] Skipping run (already in progress)");
    return;
  }
  (global as any).__autoRefreshInProgress = true;

  const startedAt = Date.now();
  console.log("\n=== DAILY AUTO-REFRESH + AUTO-PROCESS RUNNING ===");
  console.log(`Timestamp: ${new Date().toISOString()}`);

  try {
    // 1) Refresh LinkedIn first (ensures latest conversions are available in latest import session).
    try {
      console.log("[Auto Refresh] Step 1/2: Refreshing LinkedIn data for all campaigns...");
      await refreshAllLinkedInData();
      console.log("[Auto Refresh] ✅ LinkedIn refresh complete");
    } catch (e: any) {
      console.error("[Auto Refresh] ⚠️ LinkedIn refresh failed (continuing to revenue reprocess):", e?.message || e);
    }

    // 2) Re-process revenue for providers that have a saved mappingConfig.
    console.log("[Auto Refresh] Step 2/2: Re-processing revenue mappings (HubSpot/Salesforce/Shopify)...");
    const campaigns = await storage.getCampaigns();

    let attempted = 0;
    let succeeded = 0;
    let skipped = 0;

    for (const campaign of campaigns) {
      const campaignId = campaign.id;
      try {
        // HubSpot
        const hub = await storage.getHubspotConnection(campaignId);
        const hubCfg = safeJsonParse(hub?.mappingConfig);
        if (hub && (hub as any).isActive !== false && hubCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessHubSpot(campaignId, hubCfg)) succeeded++;
        } else {
          skipped++;
        }

        // Salesforce
        const sf = await storage.getSalesforceConnection(campaignId);
        const sfCfg = safeJsonParse(sf?.mappingConfig);
        if (sf && (sf as any).isActive !== false && sfCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessSalesforce(campaignId, sfCfg)) succeeded++;
        } else {
          skipped++;
        }

        // Shopify
        const shop = await storage.getShopifyConnection(campaignId);
        const shopCfg = safeJsonParse(shop?.mappingConfig);
        if (shop && (shop as any).isActive !== false && shopCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessShopify(campaignId, shopCfg)) succeeded++;
        } else {
          skipped++;
        }
      } catch (e: any) {
        console.error(`[Auto Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }

    console.log("[Auto Refresh] Summary:");
    console.log(`   Campaigns scanned: ${campaigns.length}`);
    console.log(`   Provider jobs attempted: ${attempted}`);
    console.log(`   Provider jobs succeeded: ${succeeded}`);
    console.log(`   Provider jobs skipped (no mapping/disabled): ${skipped}`);
  } finally {
    (global as any).__autoRefreshInProgress = false;
    const elapsedMs = Date.now() - startedAt;
    console.log(`=== AUTO-REFRESH COMPLETE (${Math.round(elapsedMs / 1000)}s) ===\n`);
  }
}

/**
 * Start the daily scheduler.
 *
 * Defaults:
 * - Enabled by default (AUTO_REFRESH_ENABLED=true unless explicitly set to "false")
 * - Runs daily at 3:00 AM local server time (AUTO_REFRESH_DAILY_HOUR, AUTO_REFRESH_DAILY_MINUTE)
 * - Optional: run once on startup if AUTO_REFRESH_RUN_ON_STARTUP=true
 */
export function startDailyAutoRefreshScheduler(): void {
  const enabled = String(process.env.AUTO_REFRESH_ENABLED ?? "true").toLowerCase() !== "false";
  if (!enabled) {
    console.log("[Auto Refresh] Scheduler disabled via AUTO_REFRESH_ENABLED=false");
    return;
  }

  if ((global as any).__autoRefreshSchedulerInterval) {
    console.log("[Auto Refresh] Scheduler is already running");
    return;
  }

  const hour = Math.min(Math.max(parseInt(String(process.env.AUTO_REFRESH_DAILY_HOUR || "3"), 10) || 3, 0), 23);
  const minute = Math.min(Math.max(parseInt(String(process.env.AUTO_REFRESH_DAILY_MINUTE || "0"), 10) || 0, 0), 59);
  const intervalMs = 24 * 60 * 60 * 1000;

  console.log("\n🔁 Daily Auto-Refresh + Auto-Process Scheduler Started");
  console.log(`   Enabled: ${enabled}`);
  console.log(`   Scheduled time: ${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")} (server local time)`);

  const runOnStartup = String(process.env.AUTO_REFRESH_RUN_ON_STARTUP || "false").toLowerCase() === "true";
  if (runOnStartup) {
    console.log("[Auto Refresh] Running once on startup (AUTO_REFRESH_RUN_ON_STARTUP=true)...");
    runDailyAutoRefreshOnce();
  }

  const now = new Date();
  const nextRun = new Date(now);
  nextRun.setHours(hour, minute, 0, 0);
  if (nextRun.getTime() <= now.getTime()) nextRun.setDate(nextRun.getDate() + 1);
  const msUntilNextRun = nextRun.getTime() - now.getTime();

  console.log(`   First scheduled run: ${nextRun.toLocaleString()}`);

  setTimeout(() => {
    runDailyAutoRefreshOnce();
    (global as any).__autoRefreshSchedulerInterval = setInterval(() => {
      runDailyAutoRefreshOnce();
    }, intervalMs);
    console.log("[Auto Refresh] Scheduled daily runs are active");
  }, msUntilNextRun);
}


