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
import { refreshKPIsForCampaign } from "./utils/kpi-refresh";
import { checkPerformanceAlerts } from "./kpi-scheduler";
import { checkBenchmarkPerformanceAlerts } from "./benchmark-notifications";

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
  const body: AnyRecord = {
    campaignProperty: mappingConfig.campaignProperty,
    selectedValues: mappingConfig.selectedValues,
    revenueProperty: mappingConfig.revenueProperty,
    conversionValueProperty: mappingConfig.conversionValueProperty,
    valueSource: mappingConfig.valueSource,
    days: mappingConfig.days,
    stageIds: mappingConfig.stageIds,
    pipelineEnabled: mappingConfig.pipelineEnabled,
    pipelineStageId: mappingConfig.pipelineStageId,
    pipelineStageLabel: mappingConfig.pipelineStageLabel,
    platformContext: mappingConfig.platformContext,
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/hubspot/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] HubSpot reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessSalesforce(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body: AnyRecord = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueField: mappingConfig.revenueField,
    conversionValueField: mappingConfig.conversionValueField,
    valueSource: mappingConfig.valueSource,
    days: mappingConfig.days,
    pipelineEnabled: mappingConfig.pipelineEnabled,
    pipelineStageName: mappingConfig.pipelineStageName,
    pipelineStageLabel: mappingConfig.pipelineStageLabel,
    platformContext: mappingConfig.platformContext,
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/salesforce/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Salesforce reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessShopify(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body: AnyRecord = {
    campaignField: mappingConfig.campaignField,
    selectedValues: mappingConfig.selectedValues,
    revenueMetric: mappingConfig.revenueMetric,
    revenueClassification: mappingConfig.revenueClassification,
    days: mappingConfig.days,
    platformContext: mappingConfig.platformContext,
    valueSource: mappingConfig.valueSource,
    ...(Array.isArray(mappingConfig.campaignMappings) && mappingConfig.campaignMappings.length > 0
      ? { campaignMappings: mappingConfig.campaignMappings }
      : {}),
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/shopify/save-mappings`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Shopify reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessGoogleSheetsSpend(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return false;
  const body = {
    connectionId,
    // The process endpoint tolerates extra keys; we keep the exact mapping that the user configured.
    mapping: { ...(mappingConfig || {}) },
  };
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/spend/sheets/process`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] Google Sheets spend reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  return true;
}

async function reprocessGoogleSheetsRevenue(campaignId: string, source: any, mappingConfig: AnyRecord): Promise<boolean> {
  const connectionId = String(mappingConfig?.connectionId || "").trim();
  if (!connectionId) return false;
  try {
    // Direct DB operations — avoids auth/rate-limit issues from HTTP self-calls
    const connections = await storage.getGoogleSheetsConnections(campaignId);
    let conn = (connections as any[]).find((c: any) => String(c.id) === connectionId);
    if (!conn) {
      // Try without purpose filter
      const allConns = await storage.getGoogleSheetsConnections(campaignId);
      conn = (allConns as any[]).find((c: any) => String(c.id) === connectionId);
    }
    if (!conn || !conn.accessToken) {
      console.warn(`[Auto Refresh] Google Sheets revenue: connection ${connectionId} not found for campaign ${campaignId}`);
      return false;
    }

    // Read sheet data with token refresh
    let accessToken = conn.accessToken;
    const sheetName = conn.sheetName ? String(conn.sheetName).trim() : "";
    const range = sheetName ? `'${sheetName.replace(/'/g, "''")}'!A1:ZZ5000` : "A1:ZZ5000";
    let resp = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
      { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) }
    );
    if (resp.status === 401 && conn.refreshToken && conn.clientId && conn.clientSecret) {
      try {
        const tr = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: conn.refreshToken, client_id: conn.clientId, client_secret: conn.clientSecret }),
          signal: AbortSignal.timeout(15000),
        });
        if (tr.ok) {
          const tokens = await tr.json();
          accessToken = tokens.access_token;
          await storage.updateGoogleSheetsConnection(conn.id, { accessToken, expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000) } as any);
          resp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(30000) }
          );
        }
      } catch { /* fall through */ }
    }
    if (!resp.ok) {
      console.warn(`[Auto Refresh] Google Sheets revenue fetch failed for campaign ${campaignId}: HTTP ${resp.status}`);
      return false;
    }

    const data = await resp.json();
    const allRows = data.values || [];
    if (allRows.length < 2) return false;
    const headers: string[] = allRows[0];
    const dataRows: string[][] = allRows.slice(1);

    // Parse rows using stored mapping
    const revenueCol = String(mappingConfig.revenueColumn || "");
    const campaignCol = String(mappingConfig.campaignColumn || "");
    const campaignValues: string[] = Array.isArray(mappingConfig.campaignValues) ? mappingConfig.campaignValues : [];
    const campaignValueSet = campaignValues.length > 0 ? new Set(campaignValues) : null;

    const parseNum = (v: any) => { const n = parseFloat(String(v || "0").replace(/[^0-9.\-]/g, "")); return Number.isFinite(n) ? n : 0; };

    const dateCol = mappingConfig.dateColumn ? String(mappingConfig.dateColumn) : null;
    let totalRevenue = 0;
    let kept = 0;
    const dailyRevenueMap = new Map<string, number>(); // date -> revenue
    for (const row of dataRows) {
      const rowObj: any = {};
      headers.forEach((h, i) => { rowObj[h] = row[i] ?? ""; });
      if (campaignCol && campaignValueSet) {
        const v = String(rowObj[campaignCol] ?? "").trim();
        if (!campaignValueSet.has(v)) continue;
      }
      const rev = parseNum(rowObj[revenueCol]);
      if (rev > 0) {
        totalRevenue += rev;
        kept++;

        // Track daily revenue if date column provided
        if (dateCol) {
          const dateStr = String(rowObj[dateCol] ?? "").trim();
          if (dateStr) {
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
              const normalizedDate = date.toISOString().split('T')[0];
              dailyRevenueMap.set(normalizedDate, (dailyRevenueMap.get(normalizedDate) || 0) + rev);
            }
          }
        }
      }
    }

    const total = Number(totalRevenue.toFixed(2));
    const sourceId = String(source.id);
    const endDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10); // yesterday

    // Delete old records and create new
    await storage.deleteRevenueRecordsBySource(sourceId);
    if (total > 0) {
      const campaign = await storage.getCampaign(campaignId);
      const currency = String(mappingConfig.currency || (campaign as any)?.currency || "USD");

      if (dateCol && dailyRevenueMap.size > 0) {
        const revenueRecordsToInsert = Array.from(dailyRevenueMap.entries())
          .filter(([, rev]) => rev > 0)
          .map(([date, rev]) => ({
            campaignId,
            revenueSourceId: sourceId,
            date,
            revenue: Number(rev.toFixed(2)).toFixed(2) as any,
            currency,
          } as any));
        if (revenueRecordsToInsert.length > 0) {
          await storage.createRevenueRecords(revenueRecordsToInsert);
        }
      } else {
        await storage.createRevenueRecords([{ campaignId, revenueSourceId: sourceId, date: endDate, revenue: total.toFixed(2) as any, currency } as any]);
      }
    }

    // Update lastSyncedAt
    await storage.updateRevenueSource(sourceId, {
      mappingConfig: JSON.stringify({ ...mappingConfig, lastSyncedAt: new Date().toISOString() }),
    } as any);

    console.log(`[Auto Refresh] ✅ Google Sheets revenue synced for campaign ${campaignId}: $${total} from ${kept} rows`);
    return true;
  } catch (err: any) {
    console.error(`[Auto Refresh] Google Sheets revenue reprocess failed for campaign ${campaignId}:`, err?.message || err);
    return false;
  }
}

async function reprocessLinkedInSpend(campaignId: string, mappingConfig: AnyRecord): Promise<boolean> {
  const body: AnyRecord = {
    currency: mappingConfig?.currency || "USD",
  };
  // If specific campaigns were selected during initial import, re-use them
  if (Array.isArray(mappingConfig?.selectedCampaignIds) && mappingConfig.selectedCampaignIds.length > 0) {
    body.campaignIds = mappingConfig.selectedCampaignIds;
  }
  const result = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/spend/linkedin/process`, body);
  if (!result.ok) {
    console.error(`[Auto Refresh] LinkedIn spend reprocess failed for campaign ${campaignId}:`, result.status, result.json?.error || result.text);
    return false;
  }
  console.log(`[Auto Refresh] ✅ LinkedIn spend refreshed for campaign ${campaignId}: ${result.json?.currency || "USD"} ${result.json?.totalSpend || 0} from ${result.json?.campaignCount || 0} campaigns`);
  return true;
}

/**
 * Refresh Google Sheets raw data for all active connections in a campaign.
 * Fetches latest data from Google Sheets API and caches it in the database
 * so page loads can serve cached data instead of making live API calls.
 */
export async function refreshGoogleSheetsDataForCampaign(campaignId: string): Promise<boolean> {
  const connections = await storage.getGoogleSheetsConnections(campaignId);
  const activeConnections = (Array.isArray(connections) ? connections : []).filter(
    (c: any) => c.isActive !== false && c.accessToken && c.spreadsheetId && c.spreadsheetId !== 'pending'
  );

  if (activeConnections.length === 0) return false;

  let anyUpdated = false;

  for (const conn of activeConnections) {
    try {
      // Build range: sheet-specific or default
      const sheetName = conn.sheetName ? String(conn.sheetName).trim() : '';
      const range = sheetName
        ? `'${sheetName.replace(/'/g, "''")}'!A1:Z1000`
        : 'A1:Z1000';

      let accessToken = conn.accessToken;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`;

      let response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(30000),
      });

      // Retry with refreshed token on 401
      if (response.status === 401 && conn.refreshToken && conn.clientId && conn.clientSecret) {
        console.log(`[Auto Refresh] 🔄 Refreshing token for Google Sheets connection ${conn.id}`);
        try {
          const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
              grant_type: 'refresh_token',
              refresh_token: conn.refreshToken,
              client_id: conn.clientId,
              client_secret: conn.clientSecret,
            }),
            signal: AbortSignal.timeout(15000),
          });

          if (refreshResponse.ok) {
            const tokens = await refreshResponse.json();
            accessToken = tokens.access_token;
            const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000));
            const tokenUpdate: any = { accessToken: tokens.access_token, expiresAt };
            if (tokens.refresh_token) tokenUpdate.refreshToken = tokens.refresh_token;
            await storage.updateGoogleSheetsConnection(conn.id, tokenUpdate);

            // Retry with new token
            response = await fetch(url, {
              headers: { 'Authorization': `Bearer ${accessToken}` },
              signal: AbortSignal.timeout(30000),
            });
          }
        } catch (refreshErr: any) {
          console.error(`[Auto Refresh] Token refresh failed for connection ${conn.id}:`, refreshErr?.message || refreshErr);
        }
      }

      if (!response.ok) {
        console.warn(`[Auto Refresh] ⚠️ Google Sheets fetch failed for connection ${conn.id} (${conn.spreadsheetName || conn.spreadsheetId}): ${response.status}`);
        continue;
      }

      const data = await response.json();
      const rows = data.values || [];

      if (rows.length === 0) {
        console.log(`[Auto Refresh] ⏭️ Empty sheet for connection ${conn.id} (${conn.spreadsheetName || conn.spreadsheetId})`);
        continue;
      }

      const headers = rows[0];
      const dataRows = rows.slice(1);
      const now = new Date();

      await storage.updateGoogleSheetsConnection(conn.id, {
        cachedData: { headers, rows: dataRows, fetchedAt: now.toISOString(), totalRows: dataRows.length },
        lastDataRefreshAt: now,
      } as any);

      console.log(`[Auto Refresh] ✅ Cached ${dataRows.length} rows for "${conn.spreadsheetName || conn.spreadsheetId}" / "${conn.sheetName || 'default'}"`);
      anyUpdated = true;
    } catch (err: any) {
      console.error(`[Auto Refresh] ❌ Google Sheets data refresh failed for connection ${conn.id}:`, err?.message || err);
    }
  }

  return anyUpdated;
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
    let anyCampaignUpdated = false;

    for (const campaign of campaigns) {
      const campaignId = campaign.id;
      try {
        let anyUpdated = false;
        // HubSpot
        const hub = await storage.getHubspotConnection(campaignId);
        const hubCfg = safeJsonParse(hub?.mappingConfig);
        if (hub && (hub as any).isActive !== false && hubCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessHubSpot(campaignId, hubCfg)) { succeeded++; anyUpdated = true; }
        } else {
          skipped++;
        }

        // Salesforce
        const sf = await storage.getSalesforceConnection(campaignId);
        const sfCfg = safeJsonParse(sf?.mappingConfig);
        if (sf && (sf as any).isActive !== false && sfCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessSalesforce(campaignId, sfCfg)) { succeeded++; anyUpdated = true; }
        } else {
          skipped++;
        }

        // Shopify
        const shop = await storage.getShopifyConnection(campaignId);
        const shopCfg = safeJsonParse(shop?.mappingConfig);
        if (shop && (shop as any).isActive !== false && shopCfg?.selectedValues?.length) {
          attempted++;
          if (await reprocessShopify(campaignId, shopCfg)) { succeeded++; anyUpdated = true; }
        } else {
          skipped++;
        }

        // Google Sheets (Spend) — process ALL active Sheets spend sources
        try {
          const spendSources = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          const sheetSpendSources = (Array.isArray(spendSources) ? spendSources : []).filter((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
          });
          for (const sheetSpend of sheetSpendSources) {
            const spendCfg = safeJsonParse(sheetSpend?.mappingConfig);
            if (spendCfg?.connectionId && spendCfg?.spendColumn) {
              attempted++;
              if (await reprocessGoogleSheetsSpend(campaignId, spendCfg)) { succeeded++; anyUpdated = true; }
            } else {
              skipped++;
            }
          }
          if (sheetSpendSources.length === 0) skipped++;
        } catch {
          // ignore
        }

        // LinkedIn Ads (Spend)
        try {
          const spendSources = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          const linkedInSpend = (Array.isArray(spendSources) ? spendSources : []).find((s: any) => {
            return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "linkedin_api";
          });
          const liCfg = safeJsonParse(linkedInSpend?.mappingConfig);
          if (linkedInSpend && liCfg?.platform === "linkedin") {
            attempted++;
            if (await reprocessLinkedInSpend(campaignId, liCfg)) { succeeded++; anyUpdated = true; }
          } else {
            skipped++;
          }
        } catch {
          // ignore
        }

        // Ad Platform Spend (Google Ads / Meta) — pull from daily metrics tables
        try {
          const spendSrcs = await storage.getSpendSources(campaignId).catch(() => [] as any[]);
          for (const src of (Array.isArray(spendSrcs) ? spendSrcs : [])) {
            if ((src as any).isActive === false) continue;
            if (String((src as any).sourceType || "") !== "ad_platforms") continue;
            const displayName = String((src as any).displayName || "");
            const startDate = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
            const endDate = new Date().toISOString().slice(0, 10);

            let rows: any[] = [];
            if (displayName.includes("Google Ads")) {
              rows = (await storage.getGoogleAdsDailyMetrics(campaignId, startDate, endDate)) || [];
            } else if (displayName.includes("Meta")) {
              rows = (await storage.getMetaDailyMetrics(campaignId, startDate, endDate)) || [];
            } else {
              continue;
            }

            if (rows.length === 0) continue;

            const spendByDate = new Map<string, number>();
            for (const r of rows) {
              const date = String((r as any).date || "").trim();
              const spend = parseFloat(String((r as any).spend || "0"));
              if (date && !Number.isNaN(spend)) spendByDate.set(date, (spendByDate.get(date) || 0) + spend);
            }

            const records = Array.from(spendByDate.entries()).map(([date, spend]) => ({
              campaignId,
              spendSourceId: String((src as any).id),
              date,
              spend: String(spend.toFixed(2)),
              currency: "USD",
            }));

            if (records.length > 0) {
              attempted++;
              try {
                await storage.createSpendRecords(records);
                const allSpend = await storage.getSpendTotalForRange(campaignId, "2020-01-01", endDate);
                await storage.updateCampaign(campaignId, { spend: String(allSpend.totalSpend.toFixed(2)) } as any);
                succeeded++;
                anyUpdated = true;
                console.log(`[Auto Refresh] ✅ ${displayName} spend refreshed for campaign ${campaignId}: ${records.length} days`);
              } catch {
                // ignore duplicate records
              }
            }
          }
        } catch {
          // ignore
        }

        // Google Sheets (Revenue) — process ALL active Sheets revenue sources across all platform contexts
        try {
          let sheetRevCount = 0;
          for (const ctx of ["ga4", "linkedin", "meta"] as const) {
            const revenueSources = await storage.getRevenueSources(campaignId, ctx).catch(() => [] as any[]);
            const sheetRevSources = (Array.isArray(revenueSources) ? revenueSources : []).filter((s: any) => {
              return !!s && (s as any).isActive !== false && String((s as any).sourceType || "") === "google_sheets";
            });
            for (const sheetRevenue of sheetRevSources) {
              sheetRevCount++;
              const revCfg = safeJsonParse(sheetRevenue?.mappingConfig);
              if (revCfg?.connectionId && revCfg?.revenueColumn) {
                attempted++;
                if (await reprocessGoogleSheetsRevenue(campaignId, sheetRevenue, revCfg)) { succeeded++; anyUpdated = true; }
              } else {
                skipped++;
              }
            }
          }
          if (sheetRevCount === 0) skipped++;
        } catch {
          // ignore
        }

        // Google Sheets (Raw Data Cache — for Overview/Summary/Insights tabs)
        try {
          if (await refreshGoogleSheetsDataForCampaign(campaignId)) { anyUpdated = true; }
        } catch {
          // ignore
        }

        // If any upstream sources changed for this campaign, immediately recompute GA4 KPI/Benchmark series for Insights.
        if (anyUpdated) {
          anyCampaignUpdated = true;
          const r = await postJson(`/api/campaigns/${encodeURIComponent(campaignId)}/ga4/run-insights-jobs`, {});
          if (!r.ok) {
            console.warn(`[Auto Refresh] KPI/Benchmark recompute failed for campaign ${campaignId}:`, r.status, r.json?.error || r.text);
          }

          // Also recompute KPI values immediately (exec-grade freshness).
          await refreshKPIsForCampaign(campaignId).catch((e) => {
            console.warn(`[Auto Refresh] KPI refresh failed for campaign ${campaignId}:`, (e as any)?.message || e);
          });
        }
      } catch (e: any) {
        console.error(`[Auto Refresh] Error processing campaign ${campaignId}:`, e?.message || e);
      }
    }

    // Run alert check once per refresh cycle (avoid N-times per campaign).
    if (anyCampaignUpdated) {
      await checkPerformanceAlerts().catch((e) => {
        console.warn("[Auto Refresh] Alert check failed after provider reprocess:", (e as any)?.message || e);
      });
      await checkBenchmarkPerformanceAlerts().catch((e) => {
        console.warn("[Auto Refresh] Benchmark alert check failed after provider reprocess:", (e as any)?.message || e);
      });
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


