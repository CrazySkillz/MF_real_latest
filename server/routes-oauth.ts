import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertCampaignSchema, insertMetricSchema, insertIntegrationSchema, insertPerformanceDataSchema, insertGA4ConnectionSchema, insertGoogleSheetsConnectionSchema, insertLinkedInConnectionSchema, insertKPISchema, insertBenchmarkSchema, insertBenchmarkHistorySchema, insertAttributionModelSchema, insertCustomerJourneySchema, insertTouchpointSchema } from "@shared/schema";
import { z } from "zod";
import { ga4Service } from "./analytics";
import { realGA4Client } from "./real-ga4-client";
import multer from "multer";
import { parseCsvText } from "./utils/csv";
import { parsePDFMetrics } from "./services/pdf-parser";
import { nanoid } from "nanoid";
import { randomBytes, createHash, createHmac, timingSafeEqual } from "crypto";
import { snapshotScheduler } from "./scheduler";
import { detectColumnTypes } from "./utils/column-detection";
import { discoverSchema } from "./utils/schema-discovery";
import { autoMapColumns, validateMappings, isMappingValid } from "./utils/auto-mapping";
import { getPlatformFields, getRequiredFields } from "./utils/field-definitions";
import { transformData, filterRowsByCampaignAndPlatform, calculateConversionValue } from "./utils/data-transformation";
import { enrichRows, inferMissingFields } from "./utils/data-enrichment";
import { toCanonicalFormatBatch } from "./utils/canonical-format";
import { pickConversionValueFromRows } from "./utils/googleSheetsSelection";
import { db } from "./db";
import { sql } from "drizzle-orm";

// Helper functions for column type detection
function inferColumnType(values: any[]): 'number' | 'text' | 'date' | 'currency' | 'percentage' | 'boolean' | 'unknown' {
  if (values.length === 0) return 'unknown';
  
  const valueStrings = values.map(v => String(v).trim());
  
  // Check for currency
  const currencyPattern = /^[\$€£¥]\s*\d+[.,]?\d*$/;
  const currencyCount = valueStrings.filter(v => currencyPattern.test(v)).length;
  if (currencyCount / values.length > 0.5) return 'currency';
  
  // Check for percentage
  const percentagePattern = /^\d+[.,]?\d*\s*%$/;
  const percentageCount = valueStrings.filter(v => percentagePattern.test(v)).length;
  if (percentageCount / values.length > 0.5) return 'percentage';
  
  // Check for numbers
  const numericValues = values.filter(v => {
    const str = String(v).replace(/[,\s]/g, '');
    return !isNaN(parseFloat(str)) && isFinite(parseFloat(str));
  });
  if (numericValues.length / values.length > 0.7) return 'number';
  
  return 'text';
}

function calculateConfidence(values: any[], detectedType: string): number {
  if (values.length === 0) return 0;
  return 0.8; // Simple confidence score
}

// Configure multer for PDF file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Render/infra health checks should be fast and never depend on DB/OAuth.
  // Render defaults to checking "/" but that can depend on static serving; provide an explicit health endpoint.
  app.get("/health", (_req, res) => res.status(200).send("ok"));
  app.get("/api/health", (_req, res) => res.status(200).json({ ok: true }));

  // ============================================================================
  // Deterministic GA4 simulation (for demo/testing properties like "yesop")
  // - Used when ?mock=1 OR propertyId matches a known mock property id.
  // - Produces consistent-but-different outputs across date ranges (7/30/90).
  // ============================================================================
  const hashToSeed = (s: string) => {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  };

  const mulberry32 = (a: number) => {
    return function () {
      let t = (a += 0x6D2B79F5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  const dateRangeToDays = (dr: string): number => {
    const v = String(dr || "").toLowerCase();
    if (v.includes("7")) return 7;
    if (v.includes("90")) return 90;
    return 30;
  };

  const formatISODateUTC = (d: Date) => {
    const yyyy = d.getUTCFullYear();
    const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(d.getUTCDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  };

  const simulateGA4 = (opts: { campaignId: string; propertyId: string; dateRange: string; endOffsetDays?: number }) => {
    // IMPORTANT: normalize the propertyId so "yesop" and its numeric form don't produce different datasets.
    const pid = normalizePropertyIdForMock(opts.propertyId);
    const baseSeedKey = `${opts.campaignId}:${pid}`;
    const days = dateRangeToDays(opts.dateRange);

    // Use a fixed anchor date so mock data is STATIC (doesn't drift day-to-day).
    const anchor = new Date(Date.UTC(2026, 0, 7, 0, 0, 0)); // 2026-01-07 (UTC)

    // Generate a 90-day base series, then slice the last N days.
    // This guarantees monotonic totals: 7d <= 30d <= 90d.
    const maxDays = 90;
    const baseStart = new Date(anchor);
    baseStart.setUTCDate(baseStart.getUTCDate() - (maxDays - 1));

    const baseRand = mulberry32(hashToSeed(`${baseSeedKey}:base`));
    const baseUsersPerDay = 80 + baseRand() * 220; // 80 - 300
    const baseSessionsPerUser = 1.15 + baseRand() * 0.9; // 1.15 - 2.05
    const basePagesPerSession = 1.2 + baseRand() * 2.2; // 1.2 - 3.4
    const baseConvRate = 0.012 + baseRand() * 0.035; // 1.2% - 4.7%
    const baseAOV = 45 + baseRand() * 210; // 45 - 255

    const engagementRate = 0.38 + baseRand() * 0.42; // 0.38 - 0.80 (GA4 is 0-1)
    const bounceRate = Math.max(0, Math.min(1, 1 - engagementRate + (baseRand() * 0.08 - 0.04)));

    const series90: Array<{ date: string; users: number; sessions: number; pageviews: number; conversions: number; revenue: number }> = [];
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(baseStart);
      d.setUTCDate(baseStart.getUTCDate() + i);
      const date = formatISODateUTC(d);
      const weekday = d.getUTCDay();

      // Per-day deterministic noise based on date (so slices reuse the same day values)
      const r = mulberry32(hashToSeed(`${baseSeedKey}:day:${date}`));
      const seasonal = 0.92 + 0.12 * Math.sin(((weekday + 1) / 7) * Math.PI * 2) + (r() * 0.1 - 0.05);

      const users = Math.max(0, Math.round(baseUsersPerDay * seasonal));
      const sessions = Math.max(0, Math.round(users * baseSessionsPerUser * (0.95 + r() * 0.1)));
      const pageviews = Math.max(0, Math.round(sessions * basePagesPerSession * (0.92 + r() * 0.16)));
      const conversions = Math.max(0, Math.round(sessions * baseConvRate * (0.9 + r() * 0.2)));
      const revenue = Number((conversions * baseAOV * (0.85 + r() * 0.3)).toFixed(2));

      series90.push({ date, users, sessions, pageviews, conversions, revenue });
    }

    const endOffset = Math.max(0, Math.floor(Number(opts.endOffsetDays || 0)));
    const endIndex = Math.max(0, Math.min(maxDays, maxDays - endOffset));
    const startIndex = Math.max(0, endIndex - days);
    const series = series90.slice(startIndex, endIndex);

    let usersSum = 0;
    let sessionsSum = 0;
    let pageviewsSum = 0;
    let conversionsSum = 0;
    let revenueSum = 0;
    for (const row of series) {
      usersSum += row.users;
      sessionsSum += row.sessions;
      pageviewsSum += row.pageviews;
      conversionsSum += row.conversions;
      revenueSum += row.revenue;
    }

    // Build acquisition breakdown from the sliced series (last N days).
    const channels = [
      { channel: "Direct", source: "(direct)", medium: "(none)", campaign: "(direct)" },
      { channel: "Organic Search", source: "google", medium: "organic", campaign: "seo" },
      { channel: "Paid Search", source: "google", medium: "cpc", campaign: "brand_search" },
      { channel: "Paid Social", source: "facebook", medium: "paid_social", campaign: "prospecting" },
      { channel: "Email", source: "newsletter", medium: "email", campaign: "weekly_promo" },
    ];
    const devices = ["desktop", "mobile"];
    const countries = ["United States", "United Kingdom", "Canada", "Germany", "France", "(not set)"];

    const breakdownRows: any[] = [];
    for (const dayRow of series) {
      // deterministic per-day weights
      const wr = mulberry32(hashToSeed(`${baseSeedKey}:breakdown:${dayRow.date}`));
      const w = channels.map(() => 0.6 + wr() * 1.4);
      const wSum = w.reduce((a, b) => a + b, 0) || 1;

      let usersRemain = dayRow.users;
      let sessionsRemain = dayRow.sessions;
      let convRemain = dayRow.conversions;
      let revRemain = dayRow.revenue;

      for (let i = 0; i < channels.length; i++) {
        const share = w[i] / wSum;
        const isLast = i === channels.length - 1;
        const u = isLast ? usersRemain : Math.max(0, Math.round(dayRow.users * share));
        const s = isLast ? sessionsRemain : Math.max(0, Math.round(dayRow.sessions * share));
        const c = isLast ? convRemain : Math.max(0, Math.round(dayRow.conversions * share));
        const r = isLast ? Number(revRemain.toFixed(2)) : Number((dayRow.revenue * share).toFixed(2));

        usersRemain -= u;
        sessionsRemain -= s;
        convRemain -= c;
        revRemain -= r;

        breakdownRows.push({
          date: dayRow.date,
          ...channels[i],
          device: devices[Math.floor(wr() * devices.length)],
          country: countries[Math.floor(wr() * countries.length)],
          sessionsRaw: s,
          sessions: s,
          users: u,
          conversions: c,
          revenue: r,
        });
      }
    }

    const eventCount = Math.max(0, Math.round(pageviewsSum * (2.2 + baseRand() * 4.5)));
    const eventsPerSession = sessionsSum > 0 ? Number((eventCount / sessionsSum).toFixed(2)) : 0;

    return {
      totals: {
        users: usersSum,
        sessions: sessionsSum,
        sessionsRaw: sessionsSum,
        conversions: conversionsSum,
        revenue: Number(revenueSum.toFixed(2)),
        pageviews: pageviewsSum,
      },
      timeSeries: series,
      breakdownRows,
      metrics: {
        impressions: usersSum, // legacy compatibility field used by some clients for "users"
        clicks: sessionsSum, // legacy compatibility field used by some clients for "sessions"
        sessions: sessionsSum,
        pageviews: pageviewsSum,
        bounceRate,
        averageSessionDuration: Math.max(10, Math.round(45 + baseRand() * 180)),
        conversions: conversionsSum,
        revenue: Number(revenueSum.toFixed(2)),
        activeUsers: usersSum,
        newUsers: Math.max(0, Math.round(usersSum * (0.35 + baseRand() * 0.4))),
        userEngagementDuration: Math.max(0, Math.round(usersSum * (25 + baseRand() * 90))),
        engagedSessions: Math.max(0, Math.round(sessionsSum * engagementRate)),
        engagementRate,
        eventCount,
        eventsPerSession,
        screenPageViewsPerSession: sessionsSum > 0 ? Number((pageviewsSum / sessionsSum).toFixed(2)) : 0,
      },
    };
  };

  const parseGA4CampaignFilter = (raw: any): string | string[] | undefined => {
    if (raw === null || raw === undefined) return undefined;
    const s = String(raw || "").trim();
    if (!s) return undefined;
    // Backward compatible:
    // - Legacy: single string (e.g., "yesy_campaign")
    // - New: JSON array string (e.g., ["brand_search","retargeting"])
    if (s.startsWith("[") && s.endsWith("]")) {
      try {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          const vals = parsed.map((v) => String(v || "").trim()).filter((v) => !!v);
          return vals.length > 0 ? vals : undefined;
        }
      } catch {
        // fall through to treat as single string
      }
    }
    return s;
  };

  const normalizePropertyIdForMock = (pid: string) => {
    const raw = String(pid || "").trim();
    if (!raw) return raw;
    const m = raw.match(/properties\/(\d+)/i);
    if (m && m[1]) return m[1];
    return raw.replace(/^\/+/, "");
  };

  const isYesopMockProperty = (pid: string) => {
    const v = String(pid || "").trim().toLowerCase();
    const normalized = normalizePropertyIdForMock(v).toLowerCase();
    // Support both "yesop" (friendly id used in docs/scripts) and the numeric GA4 property id used by the API.
    return v === "yesop" || normalized === "yesop" || normalized === "498536418";
  };

  // ============================================================================
  // Spend ingestion (generic, campaign-scoped)
  // ============================================================================
  const uploadCsv = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (_req, file, cb) => {
      const ok =
        file.mimetype === "text/csv" ||
        file.mimetype === "application/csv" ||
        file.mimetype === "application/vnd.ms-excel" ||
        file.originalname.toLowerCase().endsWith(".csv");
      cb(ok ? null : new Error("Only CSV files are allowed"), ok);
    },
  });

  const parseNum = (val: any): number => {
    if (val === null || val === undefined || val === "") return 0;
    const str = String(val).replace(/[$,]/g, "").trim();
    const n = parseFloat(str);
    return Number.isFinite(n) ? n : 0;
  };

  const normalizeDate = (val: any): string | null => {
    const s = String(val || "").trim();
    if (!s) return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const m1 = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
    if (m1) {
      const y = m1[1];
      const mo = String(m1[2]).padStart(2, "0");
      const d = String(m1[3]).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
    const m2 = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (m2) {
      const mo = String(m2[1]).padStart(2, "0");
      const d = String(m2[2]).padStart(2, "0");
      const y = m2[3];
      return `${y}-${mo}-${d}`;
    }
    const dt = new Date(s);
    if (!Number.isNaN(dt.getTime())) {
      const y = dt.getUTCFullYear();
      const mo = String(dt.getUTCMonth() + 1).padStart(2, "0");
      const d = String(dt.getUTCDate()).padStart(2, "0");
      return `${y}-${mo}-${d}`;
    }
    return null;
  };

  const getDateRangeBounds = (dateRange: string) => {
    const now = new Date();
    const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    const days =
      String(dateRange).toLowerCase() === "7days" ? 7 :
      String(dateRange).toLowerCase() === "90days" ? 90 : 30;
    const start = new Date(end.getTime() - (days - 1) * 24 * 60 * 60 * 1000);
    const fmt = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
    return { startDate: fmt(start), endDate: fmt(end) };
  };

  const enumerateDatesInclusive = (startDate: string, endDate: string): string[] => {
    const start = new Date(startDate + "T00:00:00Z");
    const end = new Date(endDate + "T00:00:00Z");
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    const out: string[] = [];
    for (let t = start.getTime(); t <= end.getTime(); t += 24 * 60 * 60 * 1000) {
      const d = new Date(t);
      out.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
      if (out.length > 4000) break; // safety
    }
    return out;
  };

  const toA1Prefix = (sheetName?: string | null): string => {
    if (!sheetName) return "";
    const escaped = String(sheetName).replace(/'/g, "''");
    return `'${escaped}'!`;
  };

  app.get("/api/campaigns/:id/spend-sources", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const sources = await storage.getSpendSources(campaignId);
      res.json({ success: true, sources });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to fetch spend sources" });
    }
  });

  // Remove all active spend sources for a campaign (and therefore remove ROAS/ROI/CPA until re-imported).
  app.delete("/api/campaigns/:id/spend-sources", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const existing = await storage.getSpendSources(campaignId);
      for (const s of existing || []) {
        if (!s) continue;
        await storage.deleteSpendSource(String((s as any).id));
      }
      res.json({ success: true });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to remove spend sources" });
    }
  });

  app.get("/api/campaigns/:id/spend-totals", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || "30days");
      const { startDate, endDate } = getDateRangeBounds(dateRange);
      const totals = await storage.getSpendTotalForRange(campaignId, startDate, endDate);
      res.json({ success: true, dateRange, startDate, endDate, ...totals });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to fetch spend totals" });
    }
  });

  // Keep spend totals predictable: whenever a user "processes spend" for a campaign,
  // we deactivate prior spend sources so totals don't silently double-count across imports.
  const deactivateSpendSourcesForCampaign = async (campaignId: string) => {
    try {
      const existing = await storage.getSpendSources(campaignId);
      for (const s of existing || []) {
        if (!s) continue;
        await storage.deleteSpendSource(String((s as any).id));
      }
    } catch {
      // ignore
    }
  };

  app.post("/api/campaigns/:id/spend/process/manual", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const amount = parseNum((req.body as any)?.amount);
      const currency = (req.body as any)?.currency ? String((req.body as any).currency) : undefined;
      const dateRange = String((req.body as any)?.dateRange || (req.query as any)?.dateRange || "30days");
      if (!(amount > 0)) {
        return res.status(400).json({ success: false, error: "Amount must be > 0" });
      }
      const campaign = await storage.getCampaign(campaignId);
      const cur = currency || (campaign as any)?.currency || "USD";

      await deactivateSpendSourcesForCampaign(campaignId);

      const source = await storage.createSpendSource({
        campaignId,
        sourceType: "manual",
        displayName: "Manual spend",
        currency: cur,
        // Persist the last manual amount so the edit modal (pencil) can prefill the input.
        mappingConfig: JSON.stringify({ amount: Number(amount.toFixed(2)), currency: cur, dateRange }),
        isActive: true,
      } as any);

      const { startDate, endDate } = getDateRangeBounds(dateRange);
      const days = enumerateDates(startDate, endDate);
      if (days.length === 0) {
        return res.status(400).json({ success: false, error: "Invalid date range" });
      }

      // Distribute spend evenly across the selected range (no date column provided).
      // Ensure cents add up exactly by putting the remainder on the final day.
      const totalCents = Math.round(Number(amount.toFixed(2)) * 100);
      const baseCents = Math.floor(totalCents / days.length);
      const remainder = totalCents - baseCents * days.length;

      const records = days.map((date, idx) => {
        const cents = idx === days.length - 1 ? (baseCents + remainder) : baseCents;
        return {
          campaignId,
          spendSourceId: source.id,
          date,
          spend: (cents / 100).toFixed(2) as any,
          currency: cur,
        } as any;
      });

      await storage.createSpendRecords(records);

      res.json({ success: true, sourceId: source.id, startDate, endDate, days: days.length, amount: Number(amount.toFixed(2)), currency: cur });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to process manual spend" });
    }
  });

  const processConnectorDerivedSpend = async (req: any, res: any) => {
    try {
      const campaignId = req.params.id;
      const amount = parseNum((req.body as any)?.amount);
      const currency = (req.body as any)?.currency ? String((req.body as any).currency) : undefined;
      const breakdown = (req.body as any)?.breakdown || null;
      if (!(amount > 0)) {
        return res.status(400).json({ success: false, error: "Amount must be > 0" });
      }
      const campaign = await storage.getCampaign(campaignId);
      const cur = currency || (campaign as any)?.currency || "USD";

      await deactivateSpendSourcesForCampaign(campaignId);

      const source = await storage.createSpendSource({
        campaignId,
        sourceType: "connector_derived",
        displayName: "Connector-derived spend",
        currency: cur,
        mappingConfig: breakdown ? JSON.stringify(breakdown) : null,
        isActive: true,
      } as any);

      const now = new Date();
      const date = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
      await storage.createSpendRecords([{
        campaignId,
        spendSourceId: source.id,
        date,
        spend: amount.toFixed(2) as any,
        currency: cur,
      } as any]);

      res.json({ success: true, sourceId: source.id, date, amount, currency: cur });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to process connector-derived spend" });
    }
  };

  // New canonical endpoint name (preferred)
  app.post("/api/campaigns/:id/spend/process/connectors", processConnectorDerivedSpend);
  // Backwards-compatible alias (older clients may still call this)
  app.post("/api/campaigns/:id/spend/process/ad-platforms", processConnectorDerivedSpend);

  app.post("/api/campaigns/:id/spend/csv/preview", uploadCsv.single("file"), async (req, res) => {
    try {
      if (!(req as any).file) return res.status(400).json({ success: false, error: "No CSV file provided" });
      const file = (req as any).file as any;
      const csvText = Buffer.from(file.buffer).toString("utf-8");
      const parsed = parseCsvText(csvText, 5000);
      res.json({
        success: true,
        fileName: file.originalname,
        headers: parsed.headers,
        sampleRows: parsed.rows.slice(0, 25),
        rowCount: parsed.rows.length,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to preview CSV" });
    }
  });

  app.post("/api/campaigns/:id/spend/csv/process", uploadCsv.single("file"), async (req, res) => {
    try {
      const campaignId = req.params.id;
      if (!(req as any).file) return res.status(400).json({ success: false, error: "No CSV file provided" });
      const file = (req as any).file as any;
      const mapping = (req.body as any)?.mapping ? JSON.parse(String((req.body as any).mapping)) : null;
      if (!mapping?.spendColumn) {
        return res.status(400).json({ success: false, error: "spendColumn is required" });
      }

      const csvText = Buffer.from(file.buffer).toString("utf-8");
      const parsed = parseCsvText(csvText);

      const campaignCol = mapping.campaignColumn ? String(mapping.campaignColumn) : null;
      const campaignValue = mapping.campaignValue ? String(mapping.campaignValue) : null;
      const campaignValues: string[] | null = Array.isArray(mapping.campaignValues)
        ? (mapping.campaignValues.map((v: any) => String(v ?? "").trim()).filter((v: string) => !!v))
        : null;
      const campaignValueSet = campaignValues && campaignValues.length > 0 ? new Set<string>(campaignValues) : null;

      const grouped = new Map<string, number>();
      let kept = 0;
      const hasDateColumn = !!mapping?.dateColumn;
      const spendCol = String(mapping.spendColumn);
      const dateCol = hasDateColumn ? String(mapping.dateColumn) : null;
      const dateRange = String(mapping?.dateRange || "30days");
      const { startDate, endDate } = getDateRangeBounds(dateRange);
      const periodDays = enumerateDatesInclusive(startDate, endDate);
      let totalWithoutDate = 0;

      for (const row of parsed.rows) {
        if (campaignCol && (campaignValueSet || campaignValue)) {
          const v = String((row as any)[campaignCol] ?? "").trim();
          if (campaignValueSet) {
            if (!campaignValueSet.has(v)) continue;
          } else if (campaignValue && v !== campaignValue) {
            continue;
          }
        }
        const spend = parseNum((row as any)[spendCol]);
        if (!(spend > 0)) continue;
        kept++;
        if (dateCol) {
          const d = normalizeDate((row as any)[dateCol]);
          if (!d) continue;
          grouped.set(d, (grouped.get(d) || 0) + spend);
        } else {
          totalWithoutDate += spend;
        }
      }

      if (!dateCol) {
        const days = periodDays.length || 1;
        const totalCents = Math.round(totalWithoutDate * 100);
        const base = Math.floor(totalCents / days);
        const remainder = totalCents - base * days;
        const targetDays = periodDays.length ? periodDays : [endDate];
        for (let i = 0; i < targetDays.length; i++) {
          const cents = base + (i === targetDays.length - 1 ? remainder : 0);
          const v = cents / 100;
          if (v <= 0) continue;
          grouped.set(targetDays[i], (grouped.get(targetDays[i]) || 0) + v);
        }
      }

      const campaign = await storage.getCampaign(campaignId);
      const currency = mapping.currency || (campaign as any)?.currency || "USD";

      await deactivateSpendSourcesForCampaign(campaignId);

      const source = await storage.createSpendSource({
        campaignId,
        sourceType: "csv",
        displayName: mapping.displayName || file.originalname,
        currency,
        mappingConfig: JSON.stringify(mapping),
        isActive: true,
      } as any);

      await storage.deleteSpendRecordsBySource(source.id);

      const records = Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({
          campaignId,
          spendSourceId: source.id,
          date,
          spend: total.toFixed(2) as any,
          currency,
        }));

      await storage.createSpendRecords(records as any);

      const totalSpend = records.reduce((sum, r: any) => sum + parseFloat(String(r.spend)), 0);
      res.json({
        success: true,
        sourceId: source.id,
        currency,
        rowCount: parsed.rows.length,
        keptRows: kept,
        days: records.length,
        totalSpend: Number(totalSpend.toFixed(2)),
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to process CSV spend" });
    }
  });

  app.post("/api/campaigns/:id/spend/sheets/preview", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const connectionId = String((req.body as any)?.connectionId || "").trim();
      if (!connectionId) return res.status(400).json({ success: false, error: "connectionId is required" });

      const connections = await storage.getGoogleSheetsConnections(campaignId);
      const conn = (connections as any[]).find((c) => String(c.id) === connectionId);
      if (!conn) return res.status(404).json({ success: false, error: "Google Sheets connection not found" });
      if (!conn.accessToken) return res.status(400).json({ success: false, error: "Google Sheets access token missing; reconnect Google Sheets." });

      const range = conn.sheetName ? `${toA1Prefix(conn.sheetName)}A1:ZZ5000` : "A1:ZZ5000";
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
        { headers: { "Authorization": `Bearer ${conn.accessToken}` } }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(400).json({ success: false, error: `Failed to fetch sheet: ${txt}` });
      }

      const json = await resp.json().catch(() => ({} as any));
      const values: any[][] = Array.isArray(json?.values) ? json.values : [];
      const headerRow = values[0] || [];
      const headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));

      const rows: Array<Record<string, string>> = [];
      for (let i = 1; i < values.length; i++) {
        const r = values[i] || [];
        if (r.every((v) => String(v || "").trim() === "")) continue;
        const obj: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) obj[headers[c]] = String(r[c] ?? "").trim();
        rows.push(obj);
      }

      res.json({
        success: true,
        connectionId,
        spreadsheetId: conn.spreadsheetId,
        spreadsheetName: conn.spreadsheetName,
        sheetName: conn.sheetName,
        headers,
        sampleRows: rows.slice(0, 25),
        rowCount: rows.length,
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to preview sheet" });
    }
  });

  app.post("/api/campaigns/:id/spend/sheets/process", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const connectionId = String((req.body as any)?.connectionId || "").trim();
      const mapping = (req.body as any)?.mapping || null;
      if (!connectionId) return res.status(400).json({ success: false, error: "connectionId is required" });
      if (!mapping?.spendColumn) {
        return res.status(400).json({ success: false, error: "spendColumn is required" });
      }

      const connections = await storage.getGoogleSheetsConnections(campaignId);
      const conn = (connections as any[]).find((c) => String(c.id) === connectionId);
      if (!conn) return res.status(404).json({ success: false, error: "Google Sheets connection not found" });
      if (!conn.accessToken) return res.status(400).json({ success: false, error: "Google Sheets access token missing; reconnect Google Sheets." });

      const range = conn.sheetName ? `${toA1Prefix(conn.sheetName)}A1:ZZ5000` : "A1:ZZ5000";
      const resp = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}`,
        { headers: { "Authorization": `Bearer ${conn.accessToken}` } }
      );
      if (!resp.ok) {
        const txt = await resp.text();
        return res.status(400).json({ success: false, error: `Failed to fetch sheet: ${txt}` });
      }

      const json = await resp.json().catch(() => ({} as any));
      const values: any[][] = Array.isArray(json?.values) ? json.values : [];
      const headerRow = values[0] || [];
      const headers = headerRow.map((h, idx) => (String(h || "").trim() || `Column ${idx + 1}`));

      const rows: Array<Record<string, string>> = [];
      for (let i = 1; i < values.length; i++) {
        const r = values[i] || [];
        if (r.every((v) => String(v || "").trim() === "")) continue;
        const obj: Record<string, string> = {};
        for (let c = 0; c < headers.length; c++) obj[headers[c]] = String(r[c] ?? "").trim();
        rows.push(obj);
      }

      const campaignCol = mapping.campaignColumn ? String(mapping.campaignColumn) : null;
      const campaignValue = mapping.campaignValue ? String(mapping.campaignValue) : null;
      const campaignValues: string[] | null = Array.isArray(mapping.campaignValues)
        ? (mapping.campaignValues.map((v: any) => String(v ?? "").trim()).filter((v: string) => !!v))
        : null;
      const campaignValueSet = campaignValues && campaignValues.length > 0 ? new Set<string>(campaignValues) : null;

      const grouped = new Map<string, number>();
      let kept = 0;
      const hasDateColumn = !!mapping?.dateColumn;
      const spendCol = String(mapping.spendColumn);
      const dateCol = hasDateColumn ? String(mapping.dateColumn) : null;
      const dateRange = String(mapping?.dateRange || "30days");
      const { startDate, endDate } = getDateRangeBounds(dateRange);
      const periodDays = enumerateDatesInclusive(startDate, endDate);
      let totalWithoutDate = 0;

      for (const row of rows) {
        if (campaignCol && (campaignValueSet || campaignValue)) {
          const v = String((row as any)[campaignCol] ?? "").trim();
          if (campaignValueSet) {
            if (!campaignValueSet.has(v)) continue;
          } else if (campaignValue && v !== campaignValue) {
            continue;
          }
        }
        const spend = parseNum((row as any)[spendCol]);
        if (!(spend > 0)) continue;
        kept++;
        if (dateCol) {
          const d = normalizeDate((row as any)[dateCol]);
          if (!d) continue;
          grouped.set(d, (grouped.get(d) || 0) + spend);
        } else {
          totalWithoutDate += spend;
        }
      }

      if (!dateCol) {
        const days = periodDays.length || 1;
        const totalCents = Math.round(totalWithoutDate * 100);
        const base = Math.floor(totalCents / days);
        const remainder = totalCents - base * days;
        const targetDays = periodDays.length ? periodDays : [endDate];
        for (let i = 0; i < targetDays.length; i++) {
          const cents = base + (i === targetDays.length - 1 ? remainder : 0);
          const v = cents / 100;
          if (v <= 0) continue;
          grouped.set(targetDays[i], (grouped.get(targetDays[i]) || 0) + v);
        }
      }

      const campaign = await storage.getCampaign(campaignId);
      const currency = mapping.currency || (campaign as any)?.currency || "USD";

      await deactivateSpendSourcesForCampaign(campaignId);

      const source = await storage.createSpendSource({
        campaignId,
        sourceType: "google_sheets",
        displayName: mapping.displayName || `${conn.spreadsheetName || "Google Sheet"}${conn.sheetName ? ` (${conn.sheetName})` : ""}`,
        currency,
        mappingConfig: JSON.stringify({ ...mapping, connectionId, spreadsheetId: conn.spreadsheetId, sheetName: conn.sheetName || null }),
        isActive: true,
      } as any);

      await storage.deleteSpendRecordsBySource(source.id);

      const records = Array.from(grouped.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, total]) => ({
          campaignId,
          spendSourceId: source.id,
          date,
          spend: total.toFixed(2) as any,
          currency,
        }));

      await storage.createSpendRecords(records as any);
      const totalSpend = records.reduce((sum, r: any) => sum + parseFloat(String(r.spend)), 0);

      res.json({
        success: true,
        sourceId: source.id,
        currency,
        rowCount: rows.length,
        keptRows: kept,
        days: records.length,
        totalSpend: Number(totalSpend.toFixed(2)),
      });
    } catch (e: any) {
      res.status(500).json({ success: false, error: e?.message || "Failed to process sheet spend" });
    }
  });

  // ---------------------------------------------------------------------------
  // Salesforce PKCE support
  // Some Salesforce orgs require PKCE for the authorization code flow.
  // We store code_verifier briefly (10 min) keyed by a nonce embedded in `state`.
  // ---------------------------------------------------------------------------
  const salesforcePkceStore = new Map<string, { campaignId: string; codeVerifier: string; createdAt: number }>();
  const SALESFORCE_PKCE_TTL_MS = 10 * 60 * 1000;

  // ---------------------------------------------------------------------------
  // Shopify OAuth support
  // We store an OAuth nonce briefly (10 min) keyed by state.
  // ---------------------------------------------------------------------------
  const shopifyOauthStore = new Map<string, { campaignId: string; shopDomain: string; createdAt: number }>();
  const SHOPIFY_OAUTH_TTL_MS = 10 * 60 * 1000;

  const base64Url = (buf: Buffer) =>
    buf
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/g, '');

  const makeCodeVerifier = () => base64Url(randomBytes(32));
  const makeCodeChallenge = (verifier: string) => base64Url(createHash('sha256').update(verifier).digest());

  const cleanupSalesforcePkce = () => {
    const now = Date.now();
    for (const [k, v] of salesforcePkceStore.entries()) {
      if (!v?.createdAt || now - v.createdAt > SALESFORCE_PKCE_TTL_MS) {
        salesforcePkceStore.delete(k);
      }
    }
  };

  const cleanupShopifyOauth = () => {
    const now = Date.now();
    for (const [k, v] of shopifyOauthStore.entries()) {
      if (!v?.createdAt || now - v.createdAt > SHOPIFY_OAUTH_TTL_MS) {
        shopifyOauthStore.delete(k);
      }
    }
  };
  // Build a Sheets A1 range prefix for a tab name.
  // Sheet/tab names with spaces or special characters must be quoted in A1 notation.
  const toA1SheetPrefix = (sheetName?: string | null): string => {
    if (!sheetName) return '';
    // Escape single quotes by doubling them: O'Brien -> O''Brien
    const escaped = String(sheetName).replace(/'/g, "''");
    return `'${escaped}'!`;
  };

  // Import rate limiters
  const { 
    oauthRateLimiter, 
    googleSheetsRateLimiter,
    ga4RateLimiter 
  } = await import('./middleware/rateLimiter');

  // Notifications routes
  app.get("/api/notifications", async (req, res) => {
    try {
      console.log('[Notifications API] Fetching all notifications...');
      const allNotifications = await storage.getNotifications();
      console.log(`[Notifications API] Found ${allNotifications.length} notifications`);
      res.json(allNotifications);
    } catch (error) {
      console.error('[Notifications API] Error:', error);
      res.status(500).json({ 
        message: "Failed to fetch notifications",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Delete ALL notifications (for cleanup/reset)
  app.delete("/api/notifications/all/clear", async (req, res) => {
    try {
      console.log(`[Notifications API] Deleting ALL notifications...`);
      
      const { db } = await import("./db");
      const { notifications } = await import("../shared/schema");
      
      // Count before deletion
      const before = await db.select().from(notifications);
      const beforeCount = before.length;
      
      // Delete all notifications
      await db.delete(notifications);
      
      console.log(`[Notifications API] ✅ Deleted ${beforeCount} notifications`);
      
      res.json({ 
        success: true, 
        message: `Deleted ${beforeCount} notifications`,
        deletedCount: beforeCount
      });
    } catch (error) {
      console.error('[Notifications API] Error deleting all notifications:', error);
      res.status(500).json({ message: "Failed to delete all notifications" });
    }
  });
  
  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      console.log(`[Notifications API] Deleting notification: ${id}`);
      
      // Use storage layer instead of direct DB access
      const { db } = await import("./db");
      const { notifications } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const result = await db.delete(notifications).where(eq(notifications.id, id));
      
      console.log(`[Notifications API] Deleted notification: ${id}`, result);
      res.json({ success: true, message: "Notification deleted" });
    } catch (error) {
      console.error('[Notifications API] Delete error:', error);
      res.status(500).json({ 
        message: "Failed to delete notification",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  app.patch("/api/notifications/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const { read } = req.body;
      console.log(`[Notifications API] Updating notification: ${id}, read: ${read}`);
      
      const { db } = await import("./db");
      const { notifications } = await import("../shared/schema");
      const { eq } = await import("drizzle-orm");
      
      const result = await db.update(notifications)
        .set({ read: read })
        .where(eq(notifications.id, id));
      
      console.log(`[Notifications API] Updated notification: ${id}`, result);
      res.json({ success: true, message: "Notification updated" });
    } catch (error) {
      console.error('[Notifications API] Update error:', error);
      res.status(500).json({ 
        message: "Failed to update notification",
        error: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Industry benchmarks routes
  app.get("/api/industry-benchmarks", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const { getIndustries, getIndustryDisplayName, getBenchmarkValue } = await import('./data/industry-benchmarks.js');
      const industries = getIndustries();
      
      // Return list of industries with display names
      const industryList = industries.map(key => ({
        value: key,
        label: getIndustryDisplayName(key)
      })).sort((a, b) => String(a.label).localeCompare(String(b.label)));
      
      res.json({ industries: industryList });
    } catch (error) {
      console.error('Industry benchmarks fetch error:', error);
      res.status(500).json({ message: "Failed to fetch industry benchmarks" });
    }
  });

  // Get benchmark value for specific industry and metric
  app.get("/api/industry-benchmarks/:industry/:metric", async (req, res) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      const { industry, metric } = req.params;
      const { getBenchmarkValue } = await import('./data/industry-benchmarks.js');
      // MVP default: serve mock dataset unless explicitly overridden.
      const datasetMode = String(req.query.dataset || process.env.INDUSTRY_BENCHMARKS_DATASET || "mock").toLowerCase();
      if (datasetMode === "mock") {
        const { getMockBenchmarkValue } = await import("./data/industry-benchmarks.mock.js");
        const mock = getMockBenchmarkValue(industry, metric);
        if (!mock) {
          return res.status(404).json({ message: "Benchmark not found for this industry/metric combination" });
        }
        return res.json({
          ...mock,
          source: "mock",
          disclaimer: "Demo-only mock dataset. Not licensed/audited.",
          asOf: "2026-01-01",
        });
      }
      
      const benchmarkData = getBenchmarkValue(industry, metric);
      
      if (!benchmarkData) {
        return res.status(404).json({ 
          message: "Benchmark not found for this industry/metric combination" 
        });
      }
      
      res.json(benchmarkData);
    } catch (error) {
      console.error('Industry benchmark fetch error:', error);
      res.status(500).json({ message: "Failed to fetch industry benchmark" });
    }
  });

  // Campaign routes
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaigns" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      console.log('[Campaign Creation] Received data:', JSON.stringify(req.body, null, 2));
      
      // Sanitize numeric fields to strings for decimal columns
      const sanitizedData = { ...req.body };
      if (sanitizedData.budget !== undefined && sanitizedData.budget !== null && typeof sanitizedData.budget === 'number') {
        sanitizedData.budget = sanitizedData.budget.toString();
        console.log('[Campaign Creation] Converted budget from number to string:', sanitizedData.budget);
      }
      if (sanitizedData.conversionValue !== undefined && sanitizedData.conversionValue !== null && typeof sanitizedData.conversionValue === 'number') {
        sanitizedData.conversionValue = sanitizedData.conversionValue.toString();
        console.log('[Campaign Creation] Converted conversionValue from number to string:', sanitizedData.conversionValue);
      }
      if (sanitizedData.spend !== undefined && sanitizedData.spend !== null && typeof sanitizedData.spend === 'number') {
        sanitizedData.spend = sanitizedData.spend.toString();
        console.log('[Campaign Creation] Converted spend from number to string:', sanitizedData.spend);
      }
      
      const validatedData = insertCampaignSchema.parse(sanitizedData);
      console.log('[Campaign Creation] Validated data:', JSON.stringify(validatedData, null, 2));
      const campaign = await storage.createCampaign(validatedData);
      console.log('[Campaign Creation] Campaign created successfully:', campaign.id);
      
      // AUTO-GENERATE BENCHMARKS IF INDUSTRY IS SELECTED
      if (validatedData.industry) {
        console.log('[Benchmarks] Industry detected:', validatedData.industry);
        try {
          const { getIndustryBenchmarks } = await import('./data/industry-benchmarks.js');
          const industryBenchmarks = getIndustryBenchmarks(validatedData.industry);
          
          if (industryBenchmarks) {
            // Filter out revenue metrics (ROI, ROAS) if no conversion value is set
            const hasConversionValue = validatedData.conversionValue !== null && validatedData.conversionValue !== undefined;
            const revenueMetrics = ['roi', 'roas'];
            
            const metricsToCreate = Object.entries(industryBenchmarks).filter(([metricKey]) => {
              // If no conversion value, exclude revenue metrics
              if (!hasConversionValue && revenueMetrics.includes(metricKey.toLowerCase())) {
                console.log(`[Benchmarks] Skipping ${metricKey} (no conversion value set)`);
                return false;
              }
              return true;
            });
            
            console.log(`[Benchmarks] Generating ${metricsToCreate.length} benchmarks (${hasConversionValue ? 'with' : 'without'} revenue metrics)...`);
            
            for (const [metricKey, thresholds] of metricsToCreate) {
              await storage.createBenchmark({
                campaignId: campaign.id,
                platformType: 'linkedin',
                category: 'performance',
                name: `${metricKey.toUpperCase()} Target`,
                metric: metricKey,
                description: `${validatedData.industry} industry average for ${metricKey}`,
                benchmarkValue: thresholds.target.toString(),
                currentValue: '0',
                unit: thresholds.unit,
                benchmarkType: 'industry',
                industry: validatedData.industry,
                status: 'active',
                period: 'monthly',
              });
            }
            
            console.log(`[Benchmarks] ✅ Created ${metricsToCreate.length} benchmarks for campaign ${campaign.id}`);
          }
        } catch (benchmarkError) {
          console.error('[Benchmarks] ⚠️ Failed to generate benchmarks:', benchmarkError);
        }
      } else {
        console.log('[Benchmarks] No industry specified, skipping benchmark generation');
      }
      
      res.status(201).json(campaign);
    } catch (error) {
      console.error('[Campaign Creation] Error:', error);
      if (error instanceof z.ZodError) {
        console.error('[Campaign Creation] Validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      console.error('[Campaign Creation] Database error details:', error);
      res.status(500).json({ message: "Failed to create campaign", error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // Update a campaign by ID
  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
      const validatedData = insertCampaignSchema.partial().parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, validatedData);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      console.error('Campaign update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid campaign data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update campaign" });
    }
  });

  // Get a single campaign by ID
  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);
      
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch campaign" });
    }
  });

  // Delete a campaign by ID
  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const success = await storage.deleteCampaign(campaignId);
      
      if (!success) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      // Also delete any associated GA4 connection
      await storage.deleteGA4Connection(campaignId);
      
      res.json({ success: true, message: "Campaign deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete campaign" });
    }
  });

  // Get real GA4 metrics for a campaign - Updated for multiple connections
  app.get("/api/campaigns/:id/ga4-metrics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = req.query.dateRange as string || '30days';
      const propertyId = req.query.propertyId as string; // Optional - get specific property
      const forceMock = String((req.query as any)?.mock || '').toLowerCase() === '1' || String((req.query as any)?.mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';
      const shouldSimulate = forceMock || isYesopMockProperty(requestedPropertyId);

      if (shouldSimulate) {
        res.setHeader('Cache-Control', 'no-store');
        const sim = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange });
        const pid = requestedPropertyId || 'yesop';
        return res.json({
          success: true,
          metrics: sim.metrics,
          propertyId: pid,
          propertyName: 'Mock GA4 Property',
          displayName: `Mock ${pid}`,
          totalProperties: 1,
          properties: [
            { id: 'mock', propertyId: pid, propertyName: 'Mock GA4 Property', displayName: `Mock ${pid}`, isPrimary: true },
          ],
          isSimulated: true,
          simulationReason: 'Simulated GA4 metrics for demo/testing (propertyId yesop or ?mock=1).',
          lastUpdated: new Date().toISOString()
        });
      }

      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      
      // Get all connections or a specific one
      let connections;
      if (propertyId) {
        const connection = await storage.getGA4Connection(campaignId, propertyId);
        connections = connection ? [connection] : [];
      } else {
        connections = await storage.getGA4Connections(campaignId);
      }
      
      if (!connections || connections.length === 0) {
        return res.status(404).json({ 
          error: "No GA4 connection found for this campaign. Please connect your Google Analytics first." 
        });
      }
      
      // Convert date range to GA4 format
      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      // Always fetch real metrics for a single, well-defined GA4 property:
      // - If propertyId is provided: use that exact property for this campaign
      // - Otherwise: use the primary connection (or first active)
      const primaryConnection = connections.find((c: any) => c?.isPrimary) || connections[0];
      const selectedConnection = propertyId ? connections[0] : primaryConnection;

      if (!selectedConnection) {
        return res.status(404).json({ error: "No GA4 connection found for this campaign." });
      }

      if (selectedConnection.method !== 'access_token') {
        return res.status(400).json({
          success: false,
          error: "GA4 connection method not supported for metrics fetch",
          method: selectedConnection.method
        });
      }

      const metrics = await ga4Service.getMetricsWithAutoRefresh(
        campaignId,
        storage,
        ga4DateRange,
        selectedConnection.propertyId,
        campaignFilter
      );

      res.json({
        success: true,
        metrics,
        propertyId: selectedConnection.propertyId,
        propertyName: selectedConnection.propertyName,
        displayName: selectedConnection.displayName,
        totalProperties: connections.length,
        properties: connections.map((conn: any) => ({
          id: conn.id,
          propertyId: conn.propertyId,
          propertyName: conn.propertyName,
          displayName: conn.displayName,
          isPrimary: conn.isPrimary
        })),
        lastUpdated: new Date().toISOString()
      });
    } catch (error) {
      console.error('GA4 metrics error:', error);
      
      // Don't return mock metrics here — instead, return a structured error so the UI can prompt reconnect.
      if (error instanceof Error && (error.message === 'AUTO_REFRESH_NEEDED' || (error as any).isAutoRefreshNeeded)) {
        return res.status(401).json({
          success: false,
          error: 'AUTO_REFRESH_NEEDED',
          requiresReauthorization: true,
          message: 'GA4 token refresh is required. Please reconnect Google Analytics.'
        });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          requiresReauthorization: true,
          message: 'GA4 token expired. Please reconnect Google Analytics.'
        });
      }

      return res.status(500).json({
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch GA4 metrics'
      });
    }
  });

  // GA4 diagnostics (enterprise-grade: show provenance + report shape + warnings)
  app.get("/api/campaigns/:id/ga4-diagnostics", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || '30days');
      const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;

      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);

      // Convert date range to GA4 format
      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      // Resolve connection(s)
      const connections = propertyId
        ? ((await storage.getGA4Connection(campaignId, propertyId)) ? [await storage.getGA4Connection(campaignId, propertyId)] : [])
        : await storage.getGA4Connections(campaignId);

      if (!connections || connections.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'NO_GA4_CONNECTION',
          message: 'No GA4 connection found for this campaign.',
        });
      }

      const primaryConnection = (connections as any[]).find((c: any) => c?.isPrimary) || (connections as any[])[0];
      const selectedConnection = propertyId ? (connections as any[])[0] : primaryConnection;

      // Fetch breakdown to validate report shape and totals
      const breakdown = await ga4Service.getAcquisitionBreakdown(
        campaignId,
        storage,
        ga4DateRange,
        selectedConnection?.propertyId,
        2000,
        campaignFilter
      );

      const totals = breakdown?.totals || { sessions: 0, sessionsRaw: 0, users: 0, conversions: 0, revenue: 0 };
      const warnings: string[] = [];
      if ((totals.sessions || 0) === 0 && (totals.users || 0) > 0) {
        warnings.push('GA4 returned 0 sessions for this report shape while users > 0. Verify campaign filter and GA4 property configuration.');
      }
      if ((totals.users || 0) > 0 && (totals.conversions || 0) === (totals.users || 0)) {
        warnings.push('Conversions equals Users for this period. This can be valid, but often indicates a conversion event firing on most visits/users. Verify GA4 conversion configuration.');
      }

      res.json({
        success: true,
        campaignId,
        dateRange,
        ga4DateRange,
        campaignFilter: campaignFilter || null,
        connection: {
          propertyId: selectedConnection?.propertyId,
          propertyName: selectedConnection?.propertyName,
          displayName: selectedConnection?.displayName,
          isPrimary: Boolean(selectedConnection?.isPrimary),
          totalConnections: (connections as any[]).length,
        },
        breakdown: {
          totals,
          meta: breakdown?.meta || null,
        },
        warnings,
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[GA4 Diagnostics] Error:', error);
      if (error instanceof Error && error.message === 'NO_GA4_CONNECTION') {
        return res.status(404).json({ success: false, error: 'NO_GA4_CONNECTION' });
      }
      if (error instanceof Error && (error.message === 'AUTO_REFRESH_NEEDED' || (error as any).isAutoRefreshNeeded)) {
        return res.status(401).json({ success: false, error: 'AUTO_REFRESH_NEEDED', requiresReauthorization: true });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED', requiresReauthorization: true });
      }
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch GA4 diagnostics' });
    }
  });

  // Real Google Analytics OAuth flow (production-ready)
  app.post("/api/auth/google/integrated-connect", async (req, res) => {
    try {
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      console.log(`[Integrated OAuth] Starting flow for campaign ${campaignId}`);
      const authUrl = realGA4Client.generateAuthUrl(campaignId);

      res.json({
        authUrl,
        message: "Google Analytics OAuth flow initiated",
        isRealOAuth: !!process.env.GOOGLE_CLIENT_ID
      });
    } catch (error) {
      console.error('[Integrated OAuth] Initiation error:', error);
      res.status(500).json({ message: "Failed to initiate authentication" });
    }
  });

  // Simulation OAuth auth page (used when real credentials are absent)
  app.get("/api/auth/google/simulation-auth", async (req, res) => {
    try {
      const { state } = req.query;

      if (!state) {
        return res.status(400).send("Missing state parameter");
      }

      const authPageHtml = `
        <html>
          <head>
            <title>Connect Google Analytics</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 400px; margin: 50px auto; padding: 20px; }
              .consent-box { border: 1px solid #ddd; padding: 20px; border-radius: 8px; background: #f9f9f9; }
              .logo { text-align: center; margin-bottom: 20px; }
              .permissions { margin: 20px 0; }
              .permissions li { margin: 8px 0; }
              button { background: #4285f4; color: white; border: none; padding: 12px 24px; border-radius: 4px; cursor: pointer; width: 100%; font-size: 16px; }
              button:hover { background: #3367d6; }
              .cancel { background: #f8f9fa; color: #3c4043; border: 1px solid #dadce0; margin-top: 10px; }
              .cancel:hover { background: #f1f3f4; }
            </style>
          </head>
          <body>
            <div class="consent-box">
              <div class="logo">
                <h2>🔗 Connect Google Analytics</h2>
                <p>PerformanceCore wants to access your Google Analytics account</p>
              </div>
              
              <div class="permissions">
                <p><strong>This will allow PerformanceCore to:</strong></p>
                <ul>
                  <li>✓ Read your Google Analytics data</li>
                  <li>✓ Access real-time metrics and reports</li>
                  <li>✓ View your GA4 properties</li>
                </ul>
              </div>
              
              <button onclick="authorize()">Allow</button>
              <button class="cancel" onclick="window.close()">Cancel</button>
            </div>
            
            <script>
              function authorize() {
                const code = 'demo_auth_code_' + Date.now();
                const campaignState = '${String(state).replace(/'/g, "\\'")}';
                const callbackUrl = '/api/auth/google/callback?code=' + code + '&state=' + campaignState;
                window.location.href = callbackUrl;
              }
            </script>
          </body>
        </html>
      `;

      res.send(authPageHtml);
    } catch (error) {
      console.error('[Integrated OAuth] Simulation auth error:', error);
      res.status(500).send("Authentication setup failed");
    }
  });

  // Google Sheets OAuth - Start connection
  app.post("/api/auth/google-sheets/connect", oauthRateLimiter, async (req, res) => {
    try {
      const { campaignId } = req.body;

      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      console.log(`[Google Sheets OAuth] Starting flow for campaign ${campaignId}`);
      
      // Use the same base URL logic as GA4 to ensure consistency
      const rawBaseUrl = process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      
      // Strip trailing slashes to prevent double slashes
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/google-sheets/callback`;
      
      console.log(`[Google Sheets OAuth] Using redirect URI: ${redirectUri}`);
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(process.env.GOOGLE_CLIENT_ID || '')}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('https://www.googleapis.com/auth/spreadsheets.readonly https://www.googleapis.com/auth/drive.readonly')}&` +
        `access_type=offline&` +
        `prompt=consent&` +
        `state=${encodeURIComponent(campaignId)}`;

      res.json({
        authUrl,
        message: "Google Sheets OAuth flow initiated",
      });
    } catch (error) {
      console.error('[Google Sheets OAuth] Initiation error:', error);
      res.status(500).json({ message: "Failed to initiate authentication" });
    }
  });

  // Google Sheets OAuth callback
  app.get("/api/auth/google-sheets/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Failed</h2>
              <p>Error: ${error}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'sheets_auth_error', error: '${error}' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'sheets_auth_error', error: 'Missing parameters' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      const campaignId = state as string;
      console.log(`[Google Sheets OAuth] Processing callback for campaign ${campaignId}`);

      // Exchange code for tokens - use same base URL logic
      const rawBaseUrl = process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/google-sheets/callback`;
      
      console.log(`[Google Sheets OAuth] Using redirect URI for token exchange: ${redirectUri}`);
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: code as string,
          client_id: process.env.GOOGLE_CLIENT_ID || '',
          client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokens.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Store tokens temporarily (will be moved to real campaign later)
      // CRITICAL: Store clientId and clientSecret for token refresh
      // Use 'pending' as placeholder for spreadsheetId since schema requires notNull
      try {
        await storage.createGoogleSheetsConnection({
          campaignId,
          spreadsheetId: 'pending', // Will be set when user selects spreadsheet
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId: process.env.GOOGLE_CLIENT_ID || '',
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
          expiresAt: tokens.expires_in ? new Date(Date.now() + tokens.expires_in * 1000) : undefined,
        });
      } catch (error: any) {
        if (error.message && error.message.includes('Maximum limit')) {
          return res.status(400).json({ 
            error: error.message,
            errorCode: 'CONNECTION_LIMIT_REACHED'
          });
        }
        throw error;
      }

      console.log(`[Google Sheets OAuth] Tokens stored for campaign ${campaignId}`);

      // Send success message to parent window
      res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>✓ Authentication Successful</h2>
            <p>You can now close this window and select your spreadsheet.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'sheets_auth_success' }, window.location.origin);
              }
              setTimeout(() => window.close(), 1500);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[Google Sheets OAuth] Callback error:', error);
      res.send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Authentication Error</h2>
            <p>${error.message || 'Failed to complete authentication'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'sheets_auth_error', error: '${error.message}' }, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // HubSpot OAuth - Start connection
  app.post("/api/auth/hubspot/connect", oauthRateLimiter, async (req, res) => {
    try {
      const { campaignId } = req.body;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      const rawBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/hubspot/callback`;

      const clientId = process.env.HUBSPOT_CLIENT_ID || '';
      const scope = [
        'crm.objects.deals.read',
        'crm.schemas.deals.read',
      ].join(' ');

      if (!clientId) {
        return res.status(500).json({ message: "HubSpot OAuth is not configured (missing HUBSPOT_CLIENT_ID)" });
      }

      const authUrl =
        `https://app.hubspot.com/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(campaignId)}`;

      res.json({ authUrl, message: "HubSpot OAuth flow initiated" });
    } catch (error) {
      console.error('[HubSpot OAuth] Initiation error:', error);
      res.status(500).json({ message: "Failed to initiate authentication" });
    }
  });

  // Salesforce OAuth - Start connection
  app.post("/api/auth/salesforce/connect", oauthRateLimiter, async (req, res) => {
    try {
      const { campaignId } = req.body;
      if (!campaignId) return res.status(400).json({ message: "Campaign ID is required" });

      const rawBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/salesforce/callback`;

      const clientId = process.env.SALESFORCE_CLIENT_ID || '';
      if (!clientId) {
        return res.status(500).json({ message: "Salesforce OAuth is not configured (missing SALESFORCE_CLIENT_ID)" });
      }

      // Default login domain (can be overridden to test.salesforce.com later)
      const authBase = (process.env.SALESFORCE_AUTH_BASE_URL || 'https://login.salesforce.com').replace(/\/+$/, '');
      // Some orgs reject certain scope combos (we've seen invalid_scope for refresh_token).
      // Default to the minimum needed for this integration.
      // You can override via env var if your org allows/needs more (e.g. "api refresh_token offline_access").
      const scope = String(process.env.SALESFORCE_OAUTH_SCOPE || process.env.SALESFORCE_OAUTH_SCOPES || 'api').trim();

      // PKCE
      cleanupSalesforcePkce();
      const nonce = base64Url(randomBytes(16));
      const codeVerifier = makeCodeVerifier();
      const codeChallenge = makeCodeChallenge(codeVerifier);
      salesforcePkceStore.set(nonce, { campaignId: String(campaignId), codeVerifier, createdAt: Date.now() });
      const state = `${String(campaignId)}.${nonce}`;

      const authUrl =
        `${authBase}/services/oauth2/authorize?` +
        `response_type=code&` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `code_challenge=${encodeURIComponent(codeChallenge)}&` +
        `code_challenge_method=S256&` +
        `state=${encodeURIComponent(state)}`;

      res.json({ authUrl, message: "Salesforce OAuth flow initiated" });
    } catch (error) {
      console.error('[Salesforce OAuth] Initiation error:', error);
      res.status(500).json({ message: "Failed to initiate authentication" });
    }
  });

  // Shopify OAuth - Start connection
  app.post("/api/auth/shopify/connect", oauthRateLimiter, async (req, res) => {
    try {
      const { campaignId, shopDomain } = req.body || {};
      const campaignIdStr = String(campaignId || "").trim();
      const shop = String(shopDomain || "")
        .trim()
        .replace(/^https?:\/\//i, "")
        .split("/")[0]
        .toLowerCase();

      if (!campaignIdStr) return res.status(400).json({ message: "Campaign ID is required" });
      if (!shop) return res.status(400).json({ message: "Shop domain is required" });

      const clientId = process.env.SHOPIFY_CLIENT_ID || "";
      const scope = String(process.env.SHOPIFY_SCOPES || "read_orders,read_customers").trim();
      if (!clientId) {
        return res.status(500).json({ message: "Shopify OAuth is not configured (missing SHOPIFY_CLIENT_ID)" });
      }

      const rawBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get("host")}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, "");
      const redirectUri = `${baseUrl}/api/auth/shopify/callback`;

      cleanupShopifyOauth();
      const nonce = base64Url(randomBytes(16));
      const state = `${campaignIdStr}.${nonce}`;
      shopifyOauthStore.set(nonce, { campaignId: campaignIdStr, shopDomain: shop, createdAt: Date.now() });

      const authUrl =
        `https://${shop}/admin/oauth/authorize?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `scope=${encodeURIComponent(scope)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `state=${encodeURIComponent(state)}`;

      res.json({ authUrl, message: "Shopify OAuth flow initiated" });
    } catch (error: any) {
      console.error("[Shopify OAuth] Initiation error:", error);
      res.status(500).json({ message: "Failed to initiate Shopify authentication" });
    }
  });

  // Salesforce OAuth callback
  app.get("/api/auth/salesforce/callback", async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query as any;
      if (error) {
        const desc = error_description ? String(error_description) : '';
        return res.send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Failed</h2>
              <p><strong>Error:</strong> ${String(error)}</p>
              ${desc ? `<p style="max-width: 820px; margin: 12px auto; color: #555;"><strong>Details:</strong> ${desc}</p>` : ''}
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'salesforce_auth_error', error: ${JSON.stringify(String(error))}, details: ${JSON.stringify(desc)} }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }
      if (!code || !state) {
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'salesforce_auth_error', error: 'Missing parameters' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      // State format: "<campaignId>.<nonce>"
      const stateStr = String(state || '');
      const lastDot = stateStr.lastIndexOf('.');
      const campaignId = lastDot > 0 ? decodeURIComponent(stateStr.slice(0, lastDot)) : stateStr;
      const nonce = lastDot > 0 ? stateStr.slice(lastDot + 1) : '';
      cleanupSalesforcePkce();
      const pkce = nonce ? salesforcePkceStore.get(nonce) : null;
      const codeVerifier = pkce?.campaignId === String(campaignId) ? pkce.codeVerifier : null;
      if (nonce) salesforcePkceStore.delete(nonce);
      if (!codeVerifier) {
        throw new Error('PKCE verifier missing/expired. Please try connecting Salesforce again.');
      }

      const rawBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/salesforce/callback`;

      const clientId = process.env.SALESFORCE_CLIENT_ID || '';
      const clientSecret = process.env.SALESFORCE_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new Error('Salesforce OAuth is not configured (missing SALESFORCE_CLIENT_ID/SALESFORCE_CLIENT_SECRET)');
      }

      const tokenBase = (process.env.SALESFORCE_AUTH_BASE_URL || 'https://login.salesforce.com').replace(/\/+$/, '');
      const tokenResp = await fetch(`${tokenBase}/services/oauth2/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: String(code),
          code_verifier: codeVerifier,
        }),
      });
      const tokens: any = await tokenResp.json().catch(() => ({}));
      if (!tokenResp.ok || !tokens.access_token || !tokens.instance_url) {
        throw new Error(tokens?.error_description || tokens?.error || 'Failed to obtain Salesforce access token');
      }

      let orgId: string | null = null;
      let orgName: string | null = null;
      try {
        // Identity URL is returned by Salesforce in token response
        const idUrl = tokens.id ? String(tokens.id) : null;
        if (idUrl) {
          const idResp = await fetch(idUrl, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
          if (idResp.ok) {
            const ident: any = await idResp.json().catch(() => ({}));
            if (ident?.organization_id) orgId = String(ident.organization_id);
          }
        }
      } catch {
        // ignore
      }

      // Best-effort org name via SOQL (requires api scope)
      try {
        const version = process.env.SALESFORCE_API_VERSION || 'v59.0';
        const q = encodeURIComponent('SELECT Name FROM Organization LIMIT 1');
        const orgResp = await fetch(`${tokens.instance_url}/services/data/${version}/query?q=${q}`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (orgResp.ok) {
          const orgJson: any = await orgResp.json().catch(() => ({}));
          const rec = Array.isArray(orgJson?.records) ? orgJson.records[0] : null;
          if (rec?.Name) orgName = String(rec.Name);
        }
      } catch {
        // ignore
      }

      const expiresAt = tokens.issued_at ? new Date(Number(tokens.issued_at) + 2 * 60 * 60 * 1000) : undefined; // conservative 2h

      const existing = await storage.getSalesforceConnection(campaignId);
      if (existing) {
        await storage.updateSalesforceConnection(existing.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId,
          clientSecret,
          expiresAt,
          instanceUrl: tokens.instance_url,
          orgId,
          orgName,
          isActive: true,
        } as any);
      } else {
        await storage.createSalesforceConnection({
          campaignId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId,
          clientSecret,
          expiresAt,
          instanceUrl: tokens.instance_url,
          orgId,
          orgName,
          isActive: true,
        } as any);
      }

      res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>✓ Salesforce Connected</h2>
            <p>You can now close this window.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'salesforce_auth_success', orgId: ${JSON.stringify(orgId)}, orgName: ${JSON.stringify(orgName)} }, window.location.origin);
              }
              setTimeout(() => window.close(), 1200);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[Salesforce OAuth] Callback error:', error);
      res.send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Authentication Error</h2>
            <p>${error?.message || 'Failed to complete authentication'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'salesforce_auth_error', error: ${JSON.stringify(error?.message || 'Failed to complete authentication')} }, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // Shopify OAuth callback
  // Verifies HMAC, exchanges code for token, stores Shopify connection, and notifies opener via postMessage.
  app.get("/api/auth/shopify/callback", async (req, res) => {
    const sendPopup = (args: { ok: boolean; type: string; payload?: any; title: string; body: string }) => {
      const { ok, type, payload, title, body } = args;
      const payloadJson = payload ? JSON.stringify(payload) : "{}";
      return res.send(`
        <html>
          <head><title>${title}</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>${ok ? "✓" : ""} ${title}</h2>
            <p style="max-width: 820px; margin: 12px auto; color: #555;">${body}</p>
            <script>
              // Shopify may set Cross-Origin-Opener-Policy (COOP) on its pages, which can break window.opener.
              // Use BroadcastChannel as a reliable same-origin signal back to the main app.
              try {
                const bc = new BroadcastChannel('metricmind_oauth');
                bc.postMessage(Object.assign({ type: ${JSON.stringify(type)} }, ${payloadJson}));
                bc.close();
              } catch (e) {}
              if (window.opener) {
                window.opener.postMessage(Object.assign({ type: ${JSON.stringify(type)} }, ${payloadJson}), window.location.origin);
              }
              setTimeout(() => window.close(), ${ok ? 1500 : 2000});
            </script>
          </body>
        </html>
      `);
    };

    try {
      const q: any = req.query || {};
      const code = q.code ? String(q.code) : "";
      const shop = q.shop ? String(q.shop).toLowerCase() : "";
      const state = q.state ? String(q.state) : "";
      const hmac = q.hmac ? String(q.hmac) : "";

      if (q.error) {
        const err = String(q.error);
        const desc = q.error_description ? String(q.error_description) : "";
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: err, details: desc },
          title: "Authentication Failed",
          body: `${err}${desc ? ` — ${desc}` : ""}`,
        });
      }

      if (!code || !shop || !state || !hmac) {
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: "Missing parameters" },
          title: "Authentication Error",
          body: "Missing required OAuth parameters (code/shop/state/hmac).",
        });
      }

      // State format: "<campaignId>.<nonce>"
      const lastDot = state.lastIndexOf(".");
      const campaignId = lastDot > 0 ? state.slice(0, lastDot) : "";
      const nonce = lastDot > 0 ? state.slice(lastDot + 1) : "";
      const stored = nonce ? shopifyOauthStore.get(nonce) : null;
      if (!stored || stored.campaignId !== campaignId) {
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: "Invalid state" },
          title: "Authentication Error",
          body: "Invalid or expired state. Please try connecting again.",
        });
      }
      if (stored.shopDomain !== shop) {
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: "Shop mismatch" },
          title: "Authentication Error",
          body: "Shop mismatch. Please try connecting again.",
        });
      }

      // Verify HMAC per Shopify docs
      const secret = process.env.SHOPIFY_CLIENT_SECRET || "";
      if (!secret) {
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: "Shopify OAuth not configured" },
          title: "Configuration Error",
          body: "Missing SHOPIFY_CLIENT_SECRET.",
        });
      }

      const params = new URLSearchParams();
      Object.keys(q)
        .filter((k) => k !== "hmac" && k !== "signature")
        .sort()
        .forEach((k) => {
          const val = q[k];
          if (val === undefined || val === null) return;
          params.append(k, String(val));
        });
      const message = params.toString();
      const digest = createHmac("sha256", secret).update(message).digest("hex");
      const safeEq = (a: string, b: string) => {
        const ba = Buffer.from(a, "utf8");
        const bb = Buffer.from(b, "utf8");
        if (ba.length !== bb.length) return false;
        return timingSafeEqual(ba, bb);
      };
      if (!safeEq(digest, hmac)) {
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: "HMAC validation failed" },
          title: "Authentication Error",
          body: "HMAC validation failed. Please try connecting again.",
        });
      }

      // Exchange code for access token
      const clientId = process.env.SHOPIFY_CLIENT_ID || "";
      const tokenResp = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_id: clientId, client_secret: secret, code }),
      });
      const tokenJson: any = await tokenResp.json().catch(() => ({}));
      if (!tokenResp.ok || !tokenJson?.access_token) {
        const msg = tokenJson?.error_description || tokenJson?.error || "Failed to exchange token";
        return sendPopup({
          ok: false,
          type: "shopify_auth_error",
          payload: { error: msg },
          title: "Authentication Error",
          body: String(msg),
        });
      }
      const accessToken = String(tokenJson.access_token);

      // Fetch shop name
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
      let shopName: string | null = null;
      try {
        const shopResp = await fetch(`https://${shop}/admin/api/${apiVersion}/shop.json`, {
          headers: { "X-Shopify-Access-Token": accessToken, "Content-Type": "application/json" },
        });
        const shopJson: any = await shopResp.json().catch(() => ({}));
        if (shopResp.ok && shopJson?.shop?.name) shopName = String(shopJson.shop.name);
      } catch {
        shopName = null;
      }

      // Deactivate existing connections for campaign and create new one
      const existing = await storage.getShopifyConnections(campaignId);
      for (const c of existing || []) {
        if ((c as any)?.id) await storage.updateShopifyConnection((c as any).id, { isActive: false } as any);
      }
      const created = await storage.createShopifyConnection({
        campaignId,
        shopDomain: shop,
        shopName,
        accessToken,
        isActive: true,
        mappingConfig: null,
      } as any);

      // One-time use state
      shopifyOauthStore.delete(nonce);

      return sendPopup({
        ok: true,
        type: "shopify_auth_success",
        payload: { shopDomain: shop, shopName: shopName || null, connectionId: created.id },
        title: "Authentication Successful",
        body: "Shopify connected. You can now return to MetricMind.",
      });
    } catch (error: any) {
      console.error("[Shopify OAuth] Callback error:", error);
      return res.send(`
        <html><body><script>
          if (window.opener) window.opener.postMessage({ type: 'shopify_auth_error', error: ${JSON.stringify(error?.message || "Failed")} }, window.location.origin);
          setTimeout(() => window.close(), 2000);
        </script></body></html>
      `);
    }
  });

  // HubSpot OAuth callback
  app.get("/api/auth/hubspot/callback", async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Failed</h2>
              <p>Error: ${error}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'hubspot_auth_error', error: '${String(error)}' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'hubspot_auth_error', error: 'Missing parameters' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      const campaignId = String(state);

      const rawBaseUrl =
        process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/hubspot/callback`;

      const clientId = process.env.HUBSPOT_CLIENT_ID || '';
      const clientSecret = process.env.HUBSPOT_CLIENT_SECRET || '';
      if (!clientId || !clientSecret) {
        throw new Error('HubSpot OAuth is not configured (missing HUBSPOT_CLIENT_ID/HUBSPOT_CLIENT_SECRET)');
      }

      const tokenResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code: String(code),
        }),
      });
      const tokens: any = await tokenResponse.json().catch(() => ({}));
      if (!tokenResponse.ok || !tokens.access_token) {
        throw new Error(tokens?.message || 'Failed to obtain HubSpot access token');
      }

      // Best-effort portal details
      let portalId: string | null = tokens.hub_id ? String(tokens.hub_id) : null;
      let portalName: string | null = null;
      try {
        const infoResp = await fetch('https://api.hubapi.com/account-info/v3/details', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        if (infoResp.ok) {
          const info: any = await infoResp.json().catch(() => ({}));
          if (info?.portalId) portalId = String(info.portalId);
          if (info?.accountName) portalName = String(info.accountName);
        }
      } catch {
        // ignore
      }

      // Create/update active connection for this campaign
      const existing = await storage.getHubspotConnection(campaignId);
      const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : undefined;
      if (existing) {
        await storage.updateHubspotConnection(existing.id, {
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId,
          clientSecret,
          expiresAt,
          portalId,
          portalName,
          isActive: true,
        } as any);
      } else {
        await storage.createHubspotConnection({
          campaignId,
          accessToken: tokens.access_token,
          refreshToken: tokens.refresh_token,
          clientId,
          clientSecret,
          expiresAt,
          portalId,
          portalName,
          isActive: true,
        } as any);
      }

      res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>✓ HubSpot Connected</h2>
            <p>You can now close this window.</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'hubspot_auth_success', portalId: ${JSON.stringify(portalId)}, portalName: ${JSON.stringify(portalName)} }, window.location.origin);
              }
              setTimeout(() => window.close(), 1200);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[HubSpot OAuth] Callback error:', error);
      res.send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Authentication Error</h2>
            <p>${error?.message || 'Failed to complete authentication'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ type: 'hubspot_auth_error', error: ${JSON.stringify(error?.message || 'Failed to complete authentication')} }, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    }
  });

  // Get spreadsheets for campaign
  app.get("/api/google-sheets/:campaignId/spreadsheets", googleSheetsRateLimiter, async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[Google Sheets] Fetching spreadsheets for campaign ${campaignId}`);

      let connection = await storage.getGoogleSheetsConnection(campaignId);
      
      if (!connection || !connection.accessToken) {
        console.error(`[Google Sheets] No connection found for campaign ${campaignId}`);
        return res.status(404).json({ error: 'No Google Sheets connection found' });
      }
      
      // Check if clientId and clientSecret are stored (needed for token refresh)
      if (!connection.clientId || !connection.clientSecret) {
        console.warn(`[Google Sheets] Connection missing OAuth credentials, attempting to add them...`);
        // Try to update with environment variables if available
        if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
          await storage.updateGoogleSheetsConnection(connection.id, {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          });
          connection = await storage.getGoogleSheetsConnection(campaignId, connection.spreadsheetId); // Refresh connection
        }
      }

      console.log(`[Google Sheets] Found connection, access token exists: ${!!connection.accessToken}`);

      let accessToken = connection.accessToken;

      // Check if token needs refresh (if expired or expiring soon)
      const shouldRefreshToken = (conn: any) => {
        if (!conn.expiresAt && !conn.tokenExpiresAt) return false;
        const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : new Date(conn.tokenExpiresAt).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return (expiresAt - now) < fiveMinutes;
      };

      // Proactively refresh token if needed
      if (shouldRefreshToken(connection) && connection.refreshToken) {
        console.log('🔄 Token expires soon, refreshing before Drive API call...');
        try {
          accessToken = await refreshGoogleSheetsToken(connection);
          connection = await storage.getGoogleSheetsConnection(campaignId, connection.spreadsheetId); // Get updated connection
        } catch (refreshError) {
          console.error('⚠️ Token refresh failed:', refreshError);
          // Continue with existing token, will retry if 401
        }
      }

      // Fetch spreadsheets from Google Drive API
      const driveUrl = 'https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name)';
      console.log(`[Google Sheets] Calling Drive API: ${driveUrl}`);
      
      let driveResponse = await fetch(driveUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      console.log(`[Google Sheets] Drive API response status: ${driveResponse.status}`);

      // If 401, try refreshing token and retry
      if (driveResponse.status === 401 && connection.refreshToken) {
        console.log('🔄 Access token invalid (401), attempting refresh and retry...');
        try {
          accessToken = await refreshGoogleSheetsToken(connection);
          
          // Retry with new token
          driveResponse = await fetch(driveUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          console.log(`[Google Sheets] Retry after refresh - status: ${driveResponse.status}`);
        } catch (refreshError) {
          console.error('❌ Token refresh failed:', refreshError);
          return res.status(401).json({ 
            error: 'Authentication expired. Please reconnect Google Sheets.',
            needsReauth: true
          });
        }
      }

      if (!driveResponse.ok) {
        const errorBody = await driveResponse.text();
        console.error(`[Google Sheets] Drive API error response:`, errorBody);
        
        let errorMessage = 'Failed to fetch spreadsheets from Google Drive';
        let needsReauth = false;
        
        try {
          const errorJson = JSON.parse(errorBody);
          errorMessage = errorJson.error?.message || errorMessage;
          console.error(`[Google Sheets] Drive API error details:`, errorJson);
          
          // If insufficient scopes or auth error, user needs to reconnect
          if (errorJson.error?.code === 403 && errorJson.error?.message?.includes('insufficient authentication scopes')) {
            errorMessage = 'Please reconnect Google Sheets to grant Drive access permissions';
            needsReauth = true;
          } else if (errorJson.error?.code === 401) {
            errorMessage = 'Authentication expired. Please reconnect Google Sheets.';
            needsReauth = true;
          }
        } catch (e) {
          console.error(`[Google Sheets] Could not parse error response`);
        }
        
        return res.status(driveResponse.status).json({ error: errorMessage, needsReauth });
      }

      const driveData = await driveResponse.json();
      const spreadsheets = driveData.files?.map((file: any) => ({
        id: file.id,
        name: file.name,
      })) || [];

      console.log(`[Google Sheets] Found ${spreadsheets.length} spreadsheets`);
      res.json({ spreadsheets });
    } catch (error: any) {
      console.error('[Google Sheets] Fetch spreadsheets error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch spreadsheets' });
    }
  });

  // Delete/reset Google Sheets connection (for re-authentication)
  app.delete("/api/google-sheets/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { connectionId } = req.query; // Optional: delete specific connection
      
      console.log(`[Google Sheets] Deleting connection for campaign ${campaignId}${connectionId ? ` (connectionId: ${connectionId})` : ''}`);

      // Helper: identify whether a connection's mappings are used for revenue tracking (identifier + value source).
      const isRevenueTrackingConnection = (conn: any): boolean => {
        const mappingsRaw = conn.columnMappings || conn.column_mappings;
        if (!mappingsRaw) return false;
        try {
          const mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
          if (!Array.isArray(mappings) || mappings.length === 0) return false;
          const hasIdentifier =
            mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
            mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
          const hasValueSource =
            mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
            mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
          return hasIdentifier && hasValueSource;
        } catch {
          return false;
        }
      };

      // If deleting a specific connection, determine whether it was used for revenue tracking before removal.
      let deletedWasRevenueTracking = false;
      if (connectionId) {
        try {
          const before = await storage.getGoogleSheetsConnections(campaignId);
          const target = (before || []).find((c: any) => String(c?.id) === String(connectionId));
          deletedWasRevenueTracking = !!target && (target as any).isActive !== false && isRevenueTrackingConnection(target);
        } catch {
          deletedWasRevenueTracking = false;
        }
      }

      if (connectionId) {
        // Delete specific connection
        await storage.deleteGoogleSheetsConnection(connectionId as string);
      } else {
        // Delete all connections for this campaign (backward compatibility)
        const connections = await storage.getGoogleSheetsConnections(campaignId);
        for (const conn of connections) {
          await storage.deleteGoogleSheetsConnection(conn.id);
        }
      }

      // Check if there are any remaining active Google Sheets connections
      const remainingConnections = await storage.getGoogleSheetsConnections(campaignId);
      const hasActiveConnections = remainingConnections.length > 0;
      
      // Check if there are any remaining active connections that are USED FOR REVENUE TRACKING.
      // IMPORTANT: Revenue tracking can come from Google Sheets OR HubSpot OR Salesforce.
      // Deleting a view-only sheet must NOT disable revenue metrics if a CRM is still mapped for revenue.
      const remainingRevenueTrackingSheets = remainingConnections
        .filter((c: any) => (c as any).isActive !== false)
        .filter(isRevenueTrackingConnection);

      const isRevenueTrackingHubspotConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignProperty && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueProperty;
        } catch {
          return false;
        }
      };

      const remainingHubspotConnections = await storage.getHubspotConnections(campaignId);
      const remainingRevenueTrackingHubspot = (remainingHubspotConnections || [])
        .filter((c: any) => (c as any).isActive !== false)
        .filter(isRevenueTrackingHubspotConnection);

      const hasAnyRevenueTrackingSources =
        remainingRevenueTrackingSheets.length > 0 || remainingRevenueTrackingHubspot.length > 0;

      const isRevenueTrackingSalesforceConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignField && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueField;
        } catch {
          return false;
        }
      };
      const remainingSalesforceConnections = await storage.getSalesforceConnections(campaignId);
      const remainingRevenueTrackingSalesforce = (remainingSalesforceConnections || [])
        .filter((c: any) => (c as any).isActive !== false)
        .filter(isRevenueTrackingSalesforceConnection);

      const hasAnyRevenueTrackingSourcesIncludingSalesforce =
        hasAnyRevenueTrackingSources || remainingRevenueTrackingSalesforce.length > 0;
      
      let conversionValueCleared = false;
      // Clean UX rule: if the user deletes a revenue-tracking source, disable revenue metrics immediately.
      // Even if another mapped source exists, we cannot safely assume conversion value should remain unchanged without recomputation.
      if (!hasAnyRevenueTrackingSourcesIncludingSalesforce || deletedWasRevenueTracking) {
        console.log(`[Google Sheets] Clearing conversion values from platform connections (deletedWasRevenueTracking=${deletedWasRevenueTracking}, remainingRevenueTrackingSheets=${remainingRevenueTrackingSheets.length}, remainingRevenueTrackingHubspot=${remainingRevenueTrackingHubspot.length}, remainingRevenueTrackingSalesforce=${remainingRevenueTrackingSalesforce.length})`);
        
        // Clear campaign-level conversion value (if it was set from Google Sheets)
        const campaign = await storage.getCampaign(campaignId);
        if (campaign?.conversionValue) {
          await storage.updateCampaign(campaignId, {
            conversionValue: null
          });
          console.log(`[Google Sheets] Cleared campaign-level conversion value`);
          conversionValueCleared = true;
        }
        
        // Clear LinkedIn connection conversion value
        const linkedInConnection = await storage.getLinkedInConnection(campaignId);
        if (linkedInConnection?.conversionValue) {
          await storage.updateLinkedInConnection(campaignId, {
            conversionValue: null
          });
          console.log(`[Google Sheets] Cleared LinkedIn connection conversion value`);
          conversionValueCleared = true;
        }
        
        // Also clear conversion value from LinkedIn import sessions
        const linkedInSessions = await storage.getCampaignLinkedInImportSessions(campaignId);
        if (linkedInSessions && linkedInSessions.length > 0) {
          for (const session of linkedInSessions) {
            if (session.conversionValue) {
              await storage.updateLinkedInImportSession(session.id, {
                conversionValue: null
              });
              console.log(`[Google Sheets] Cleared conversion value from LinkedIn import session ${session.id}`);
              conversionValueCleared = true;
            }
          }
        }
        
        // Clear Meta connection conversion value
        const metaConnection = await storage.getMetaConnection(campaignId);
        if (metaConnection?.conversionValue) {
          await storage.updateMetaConnection(campaignId, {
            conversionValue: null
          });
          console.log(`[Google Sheets] Cleared Meta connection conversion value`);
          conversionValueCleared = true;
        }
      } else {
        console.log(`[Google Sheets] Revenue-tracking source(s) still exist (sheets=${remainingRevenueTrackingSheets.length}, hubspot=${remainingRevenueTrackingHubspot.length}, salesforce=${remainingRevenueTrackingSalesforce.length}) - keeping conversion values`);
      }

      console.log(`[Google Sheets] Connection deleted successfully`);
      res.json({
        success: true,
        message: 'Connection deleted',
        conversionValueCleared,
        deletedWasRevenueTracking,
        remainingRevenueTrackingConnections: remainingRevenueTrackingSheets.length + remainingRevenueTrackingHubspot.length + remainingRevenueTrackingSalesforce.length,
        hasActiveConnections,
      });
    } catch (error: any) {
      console.error('[Google Sheets] Delete connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete connection' });
    }
  });

  // Delete/reset HubSpot connection (CRM revenue source)
  app.delete("/api/hubspot/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { connectionId } = req.query; // Optional: delete specific connection

      const isRevenueTrackingHubspotConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignProperty && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueProperty;
        } catch {
          return false;
        }
      };

      let deletedWasRevenueTracking = false;
      let targetConnId: string | null = connectionId ? String(connectionId) : null;
      if (!targetConnId) {
        const latest = await storage.getHubspotConnection(campaignId);
        targetConnId = latest?.id ? String(latest.id) : null;
      }
      if (!targetConnId) {
        return res.status(404).json({ error: 'No HubSpot connection found' });
      }

      const before = await storage.getHubspotConnections(campaignId);
      const target = (before || []).find((c: any) => String(c?.id) === String(targetConnId));
      deletedWasRevenueTracking = !!target && (target as any).isActive !== false && isRevenueTrackingHubspotConnection(target);

      await storage.deleteHubspotConnection(targetConnId);

      // Determine if any revenue-tracking sources remain (Google Sheets OR HubSpot)
      const remainingSheets = await storage.getGoogleSheetsConnections(campaignId);
      const isRevenueTrackingSheet = (conn: any): boolean => {
        const mappingsRaw = conn.columnMappings || conn.column_mappings;
        if (!mappingsRaw) return false;
        try {
          const mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
          if (!Array.isArray(mappings) || mappings.length === 0) return false;
          const hasIdentifier =
            mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
            mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
          const hasValueSource =
            mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
            mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
          return hasIdentifier && hasValueSource;
        } catch {
          return false;
        }
      };
      const remainingRevenueSheets = (remainingSheets || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingSheet);

      const remainingHubspot = await storage.getHubspotConnections(campaignId);
      const remainingRevenueHubspot = (remainingHubspot || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingHubspotConnection);

      const isRevenueTrackingSalesforceConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignField && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueField;
        } catch {
          return false;
        }
      };
      const remainingSalesforce = await storage.getSalesforceConnections(campaignId);
      const remainingRevenueSalesforce = (remainingSalesforce || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingSalesforceConnection);

      const hasAnyRevenueTrackingSources =
        remainingRevenueSheets.length > 0 ||
        remainingRevenueHubspot.length > 0 ||
        remainingRevenueSalesforce.length > 0;

      let conversionValueCleared = false;
      if (!hasAnyRevenueTrackingSources || deletedWasRevenueTracking) {
        // Clear campaign + platform conversion values (same UX rule as Sheets)
        const campaign = await storage.getCampaign(campaignId);
        if (campaign?.conversionValue) {
          await storage.updateCampaign(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }

        const linkedInConnection = await storage.getLinkedInConnection(campaignId);
        if (linkedInConnection?.conversionValue) {
          await storage.updateLinkedInConnection(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }

        const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
        for (const s of sessions || []) {
          if (s.conversionValue) {
            await storage.updateLinkedInImportSession(s.id, { conversionValue: null } as any);
            conversionValueCleared = true;
          }
        }

        const metaConnection = await storage.getMetaConnection(campaignId);
        if (metaConnection?.conversionValue) {
          await storage.updateMetaConnection(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }
      }

      res.json({
        success: true,
        message: 'Connection deleted',
        deletedWasRevenueTracking,
        conversionValueCleared,
        remainingRevenueTrackingConnections: remainingRevenueSheets.length + remainingRevenueHubspot.length + remainingRevenueSalesforce.length,
      });
    } catch (error: any) {
      console.error('[HubSpot] Delete connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete connection' });
    }
  });

  // Delete/reset Salesforce connection (CRM revenue source)
  app.delete("/api/salesforce/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { connectionId } = req.query; // Optional: delete specific connection

      const isRevenueTrackingSalesforceConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignField && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueField;
        } catch {
          return false;
        }
      };

      let deletedWasRevenueTracking = false;
      let targetConnId: string | null = connectionId ? String(connectionId) : null;
      if (!targetConnId) {
        const latest = await storage.getSalesforceConnection(campaignId);
        targetConnId = latest?.id ? String(latest.id) : null;
      }
      if (!targetConnId) {
        return res.status(404).json({ error: 'No Salesforce connection found' });
      }

      const before = await storage.getSalesforceConnections(campaignId);
      const target = (before || []).find((c: any) => String(c?.id) === String(targetConnId));
      deletedWasRevenueTracking = !!target && (target as any).isActive !== false && isRevenueTrackingSalesforceConnection(target);

      await storage.deleteSalesforceConnection(targetConnId);

      // Determine if any revenue-tracking sources remain (Google Sheets OR HubSpot OR Salesforce)
      const remainingSheets = await storage.getGoogleSheetsConnections(campaignId);
      const isRevenueTrackingSheet = (conn: any): boolean => {
        const mappingsRaw = conn.columnMappings || conn.column_mappings;
        if (!mappingsRaw) return false;
        try {
          const mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
          if (!Array.isArray(mappings) || mappings.length === 0) return false;
          const hasIdentifier =
            mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
            mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
          const hasValueSource =
            mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
            mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
          return hasIdentifier && hasValueSource;
        } catch {
          return false;
        }
      };
      const remainingRevenueSheets = (remainingSheets || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingSheet);

      const isRevenueTrackingHubspotConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignProperty && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueProperty;
        } catch {
          return false;
        }
      };
      const remainingHubspot = await storage.getHubspotConnections(campaignId);
      const remainingRevenueHubspot = (remainingHubspot || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingHubspotConnection);

      const remainingSalesforce = await storage.getSalesforceConnections(campaignId);
      const remainingRevenueSalesforce = (remainingSalesforce || []).filter((c: any) => (c as any).isActive !== false).filter(isRevenueTrackingSalesforceConnection);

      const hasAnyRevenueTrackingSources =
        remainingRevenueSheets.length > 0 ||
        remainingRevenueHubspot.length > 0 ||
        remainingRevenueSalesforce.length > 0;

      let conversionValueCleared = false;
      if (!hasAnyRevenueTrackingSources || deletedWasRevenueTracking) {
        const campaign = await storage.getCampaign(campaignId);
        if (campaign?.conversionValue) {
          await storage.updateCampaign(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }
        const linkedInConnection = await storage.getLinkedInConnection(campaignId);
        if (linkedInConnection?.conversionValue) {
          await storage.updateLinkedInConnection(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }
        const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
        for (const s of sessions || []) {
          if (s.conversionValue) {
            await storage.updateLinkedInImportSession(s.id, { conversionValue: null } as any);
            conversionValueCleared = true;
          }
        }
        const metaConnection = await storage.getMetaConnection(campaignId);
        if (metaConnection?.conversionValue) {
          await storage.updateMetaConnection(campaignId, { conversionValue: null } as any);
          conversionValueCleared = true;
        }
      }

      res.json({
        success: true,
        message: 'Connection deleted',
        deletedWasRevenueTracking,
        conversionValueCleared,
        remainingRevenueTrackingConnections: remainingRevenueSheets.length + remainingRevenueHubspot.length + remainingRevenueSalesforce.length,
      });
    } catch (error: any) {
      console.error('[Salesforce] Delete connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete connection' });
    }
  });

  // Select spreadsheet for campaign
  app.post("/api/google-sheets/:campaignId/select-spreadsheet", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { spreadsheetId } = req.body;

      if (!spreadsheetId) {
        return res.status(400).json({ error: 'Spreadsheet ID is required' });
      }

      console.log(`[Google Sheets] Selecting spreadsheet ${spreadsheetId} for campaign ${campaignId}`);

      // Find existing connection with 'pending' spreadsheetId or create new one
      let connection = await storage.getGoogleSheetsConnection(campaignId, 'pending');
      
      if (!connection) {
        // Check if there's any connection for this campaign
        const existingConnections = await storage.getGoogleSheetsConnections(campaignId);
        if (existingConnections.length > 0) {
          // Use the first connection or create a new one
          connection = existingConnections[0];
        } else {
          return res.status(404).json({ error: 'No Google Sheets connection found. Please connect Google Sheets first.' });
        }
      }

      // Update connection with selected spreadsheet
      await storage.updateGoogleSheetsConnection(connection.id, {
        spreadsheetId,
      });

      console.log(`[Google Sheets] Spreadsheet selected successfully`);
      res.json({ success: true, message: 'Spreadsheet connected successfully' });
    } catch (error: any) {
      console.error('[Google Sheets] Select spreadsheet error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect spreadsheet' });
    }
  });

  // Real Google Analytics OAuth callback
  app.get("/api/auth/google/callback", oauthRateLimiter, async (req, res) => {
    try {
      const { code, state, error } = req.query;

      if (error) {
        return res.send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body>
              <h2>Authentication Failed</h2>
              <p>Error: ${error}</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <button onclick="window.close()">Close</button>
            </body>
          </html>
        `);
      }

      console.log(`[Integrated OAuth] Processing callback for campaign ${state} with code ${code}`);
      const result = await realGA4Client.handleCallback(code as string, state as string);
      console.log('[Integrated OAuth] Callback result:', result);

      if (result.success) {
        res.send(`
          <html>
            <head><title>Google Analytics Connected</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #4285f4;">🎉 Successfully Connected!</h2>
              <p>Your Google Analytics account is now connected.</p>
              <p>You can now access real-time metrics and data.</p>
              <button onclick="closeWindow()" style="background: #4285f4; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close Window</button>
              <script>
                function closeWindow() {
                  try {
                    if (window.opener) {
                      window.opener.postMessage({ type: 'auth_success' }, window.location.origin);
                    }
                  } catch (e) {}
                  window.close();
                }
                setTimeout(closeWindow, 3000);
              </script>
            </body>
          </html>
        `);
      } else {
        res.send(`
          <html>
            <head><title>Authentication Failed</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2 style="color: #d93025;">Authentication Failed</h2>
              <p>Error: ${result.error}</p>
              <button onclick="closeWithError()" style="background: #d93025; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer;">Close</button>
              <script>
                function closeWithError() {
                  try {
                    if (window.opener) {
                      window.opener.postMessage({
                        type: 'auth_error',
                        error: '${result.error}'
                      }, window.location.origin);
                    }
                  } catch (e) {}
                  window.close();
                }
              </script>
            </body>
          </html>
        `);
      }
    } catch (error) {
      console.error('[Integrated OAuth] Callback error:', error);
      res.redirect("/?error=callback_failed");
    }
  });

  // Check real GA4 connection status (supports integrated flow)
  app.get("/api/campaigns/:id/ga4-connection-status", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const isConnected = realGA4Client.isConnected(campaignId);

      if (isConnected) {
        const connection = realGA4Client.getConnection(campaignId);
        const properties = await realGA4Client.getProperties(campaignId);

        res.json({
          connected: true,
          email: connection?.email,
          propertyId: connection?.propertyId,
          properties: properties || [],
          isRealOAuth: !!process.env.GOOGLE_CLIENT_ID,
          dataSource: connection ? 'Real Google Analytics API' : 'Demo Mode'
        });
      } else {
        res.json({ connected: false });
      }
    } catch (error) {
      console.error('[Integrated OAuth] Connection status error:', error);
      res.status(500).json({ message: "Failed to check connection status" });
    }
  });

  // Set GA4 property for campaign (integrated flow)
  app.post("/api/campaigns/:id/ga4-property", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { propertyId } = req.body;

      if (!propertyId) {
        return res.status(400).json({ message: "Property ID is required" });
      }

      // Update in-memory connection
      const success = realGA4Client.setPropertyId(campaignId, propertyId);
      if (!success) {
        return res.status(400).json({ message: "Campaign not connected" });
      }

      // Get the connection from realGA4Client
      const connection = realGA4Client.getConnection(campaignId);
      if (!connection) {
        return res.status(400).json({ message: "Connection not found" });
      }

      // Find the property name from available properties
      const properties = await realGA4Client.getProperties(campaignId);
      const selectedProperty = properties?.find(p => p.id === propertyId);
      const propertyName = selectedProperty?.name || `Property ${propertyId}`;

      // Check if connection already exists in database
      const existingConnections = await storage.getGA4Connections(campaignId);
      
      console.log(`[Set Property] Found ${existingConnections.length} existing connections for ${campaignId}`);
      
      if (existingConnections.length > 0) {
        // Update existing connection
        const existingConnection = existingConnections[0];
        console.log(`[Set Property] Updating existing connection ${existingConnection.id}`);
        await storage.updateGA4Connection(existingConnection.id, {
          propertyId,
          propertyName,
          isPrimary: true,
          isActive: true
        });
        // Set as primary
        await storage.setPrimaryGA4Connection(campaignId, existingConnection.id);
        console.log(`[Set Property] Connection updated and set as primary`);
      } else {
        // Create new connection in database
        console.log(`[Set Property] Creating new connection for ${campaignId} with property ${propertyId}`);
        const newConnection = await storage.createGA4Connection({
          campaignId,
          propertyId,
          accessToken: connection.accessToken || '',
          refreshToken: connection.refreshToken || '',
          method: 'access_token',
          propertyName,
          isPrimary: true,
          isActive: true,
          clientId: process.env.GOOGLE_CLIENT_ID || undefined,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
          expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined
        });
        // Ensure it's set as primary
        await storage.setPrimaryGA4Connection(campaignId, newConnection.id);
        console.log(`[Set Property] New connection created: ${newConnection.id}, isPrimary: ${newConnection.isPrimary}, isActive: ${newConnection.isActive}`);
      }

      res.json({ success: true, message: "Property set successfully" });
    } catch (error) {
      console.error('[Integrated OAuth] Set property error:', error);
      res.status(500).json({ message: "Failed to set property" });
    }
  });

  // Get GA4 time series data for charts
  app.get("/api/campaigns/:id/ga4-timeseries", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = req.query.dateRange as string || '30days';
      const propertyId = req.query.propertyId as string; // Optional - get specific property
      const forceMock = String((req.query as any)?.mock || '').toLowerCase() === '1' || String((req.query as any)?.mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';
      const shouldSimulate = forceMock || isYesopMockProperty(requestedPropertyId);

      if (shouldSimulate) {
        res.setHeader('Cache-Control', 'no-store');
        const sim = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange });
        const pid = requestedPropertyId || 'yesop';
        return res.json({
          success: true,
          data: sim.timeSeries,
          propertyId: pid,
          propertyName: 'Mock GA4 Property',
          displayName: `Mock ${pid}`,
          isSimulated: true,
          simulationReason: 'Simulated GA4 time series for demo/testing (propertyId yesop or ?mock=1).',
          lastUpdated: new Date().toISOString(),
        });
      }
      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      
      // Get all connections or a specific one
      let connections: any[] = [];
      if (propertyId) {
        const conn = await storage.getGA4Connection(campaignId, propertyId);
        connections = conn ? [conn] : [];
      } else {
        connections = await storage.getGA4Connections(campaignId);
      }
      
      if (!connections || connections.length === 0) {
        return res.status(404).json({
          success: false,
          error: "No GA4 connection found for this campaign. Please connect your Google Analytics first."
        });
      }

      const primaryConnection = connections.find((c: any) => c?.isPrimary) || connections[0];
      const selectedConnection = propertyId ? connections[0] : primaryConnection;

      if (!selectedConnection || selectedConnection.method !== 'access_token') {
        return res.status(404).json({
          success: false,
          error: "No GA4 access-token connection found for this campaign."
        });
      }

        // Convert date range to GA4 format
        let ga4DateRange = '30daysAgo';
        switch (dateRange) {
          case '7days':
            ga4DateRange = '7daysAgo';
            break;
          case '30days':
            ga4DateRange = '30daysAgo';
            break;
          case '90days':
            ga4DateRange = '90daysAgo';
            break;
          default:
            ga4DateRange = '30daysAgo';
        }
        
        const timeSeriesData = await ga4Service.getTimeSeriesData(campaignId, storage, ga4DateRange, selectedConnection.propertyId, campaignFilter);
        
        res.json({
          success: true,
          data: timeSeriesData,
          propertyId: selectedConnection.propertyId,
          propertyName: selectedConnection.propertyName,
          displayName: selectedConnection.displayName,
          lastUpdated: new Date().toISOString()
        });
    } catch (error: any) {
      console.error('Error fetching GA4 time series data:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message || 'Failed to fetch time series data' 
      });
    }
  });

  // List GA4 campaign values (campaignName) for the connected property so the UI can pick a single campaign filter.
  app.get("/api/campaigns/:id/ga4-campaign-values", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || '30days');
      const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 200);

      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      const result = await ga4Service.getCampaignValues(campaignId, storage, ga4DateRange, propertyId, limit);
      res.json({ success: true, dateRange, ...result });
    } catch (error: any) {
      console.error('[GA4 Campaign Values] Error:', error);
      if (error instanceof Error && error.message === 'NO_GA4_CONNECTION') {
        return res.status(404).json({ success: false, error: 'NO_GA4_CONNECTION' });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED' });
      }
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch GA4 campaign values' });
    }
  });

  // GA4 Landing Pages (Phase 1: GA4-only, high value)
  app.get("/api/campaigns/:id/ga4-landing-pages", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || '30days');
      const compare = String((req.query as any)?.compare || '').toLowerCase();
      const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 500);
      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      const forceMock = String((req.query as any)?.mock || '').toLowerCase() === '1' || String((req.query as any)?.mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';
      const shouldSimulate = forceMock || isYesopMockProperty(requestedPropertyId);

      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      if (compare === 'wow') {
        if (shouldSimulate) {
          res.setHeader('Cache-Control', 'no-store');
          const last = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange: '7days', endOffsetDays: 0 });
          const prev = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange: '7days', endOffsetDays: 7 });

          const pages = ['/', '/pricing', '/product', '/blog/seo', '/blog/benchmarking', '/signup', '/checkout'];
          const seedLast = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:landing:last7`);
          const seedPrev = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:landing:prev7`);
          const randLast = mulberry32(seedLast);
          const randPrev = mulberry32(seedPrev);
          const wLast = pages.map(() => 0.8 + randLast() * 1.8);
          const wPrev = pages.map(() => 0.8 + randPrev() * 1.8);
          const sumLast = wLast.reduce((a, b) => a + b, 0) || 1;
          const sumPrev = wPrev.reduce((a, b) => a + b, 0) || 1;

          const totals = {
            last7: {
              sessions: Number(last.totals.sessions || 0),
              users: Number(last.totals.users || 0),
              conversions: Number(last.totals.conversions || 0),
              revenue: Number(last.totals.revenue || 0),
            },
            prev7: {
              sessions: Number(prev.totals.sessions || 0),
              users: Number(prev.totals.users || 0),
              conversions: Number(prev.totals.conversions || 0),
              revenue: Number(prev.totals.revenue || 0),
            },
          };

          const rows = pages.map((p, idx) => {
            const shareL = wLast[idx] / sumLast;
            const shareP = wPrev[idx] / sumPrev;
            const last7Sessions = Math.max(0, Math.floor(totals.last7.sessions * shareL));
            const prev7Sessions = Math.max(0, Math.floor(totals.prev7.sessions * shareP));
            const last7Conversions = Math.max(0, Math.floor(totals.last7.conversions * shareL));
            const prev7Conversions = Math.max(0, Math.floor(totals.prev7.conversions * shareP));
            const last7Revenue = Number((totals.last7.revenue * shareL).toFixed(2));
            const prev7Revenue = Number((totals.prev7.revenue * shareP).toFixed(2));
            const last7Users = Math.min(totals.last7.users, Math.max(0, Math.floor(last7Sessions * (0.65 + randLast() * 0.25))));
            const prev7Users = Math.min(totals.prev7.users, Math.max(0, Math.floor(prev7Sessions * (0.65 + randPrev() * 0.25))));
            return {
              landingPage: p,
              source: idx % 2 === 0 ? 'google' : 'linkedin',
              medium: idx % 2 === 0 ? 'cpc' : 'paid_social',
              last7: { sessions: last7Sessions, users: last7Users, conversions: last7Conversions, revenue: last7Revenue },
              prev7: { sessions: prev7Sessions, users: prev7Users, conversions: prev7Conversions, revenue: prev7Revenue },
            };
          });

          return res.json({
            success: true,
            compare: 'wow',
            propertyId: requestedPropertyId || 'yesop',
            rows: rows.slice(0, limit),
            totals,
            revenueMetric: 'totalRevenue',
            meta: { usersAreNonAdditive: true, isSimulated: true },
            lastUpdated: new Date().toISOString(),
          });
        }

        const result = await ga4Service.getLandingPagesWoWReport(campaignId, storage, propertyId, limit, campaignFilter);
        return res.json({ success: true, compare: 'wow', ...result, lastUpdated: new Date().toISOString() });
      }

      if (shouldSimulate) {
        res.setHeader('Cache-Control', 'no-store');
        const sim = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange });

        const pages = [
          '/',
          '/pricing',
          '/product',
          '/blog/seo',
          '/blog/benchmarking',
          '/signup',
          '/checkout',
        ];

        // Deterministic weights per page
        const seed = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:landing:${dateRange}`);
        const rand = mulberry32(seed);
        const weights = pages.map(() => 0.8 + rand() * 1.8);
        const wSum = weights.reduce((a, b) => a + b, 0) || 1;

        const totalSessions = Number(sim.totals.sessions || 0);
        const totalUsers = Number(sim.totals.users || 0);
        const totalConversions = Number(sim.totals.conversions || 0);
        const totalRevenue = Number(sim.totals.revenue || 0);

        let sRemain = totalSessions;
        let cRemain = totalConversions;
        let rRemain = totalRevenue;

        const rows = pages.map((p, idx) => {
          const share = weights[idx] / wSum;
          const isLast = idx === pages.length - 1;
          const sessions = isLast ? sRemain : Math.max(0, Math.floor(totalSessions * share));
          const conversions = isLast ? cRemain : Math.max(0, Math.floor(totalConversions * share));
          const revenue = isLast ? Number(rRemain.toFixed(2)) : Number((totalRevenue * share).toFixed(2));
          sRemain -= sessions;
          cRemain -= conversions;
          rRemain -= revenue;
          // Users are non-additive across landing pages in GA4; provide a plausible per-row value.
          const users = Math.min(totalUsers, Math.max(0, Math.floor(sessions * (0.65 + rand() * 0.25))));
          return {
            landingPage: p,
            source: idx % 2 === 0 ? 'google' : 'linkedin',
            medium: idx % 2 === 0 ? 'cpc' : 'paid_social',
            sessions,
            users,
            conversions,
            revenue: Number(revenue.toFixed(2)),
          };
        });

        return res.json({
          success: true,
          propertyId: requestedPropertyId || 'yesop',
          dateRange,
          rows: rows.slice(0, limit),
          totals: { sessions: totalSessions, users: totalUsers, conversions: totalConversions, revenue: Number(totalRevenue.toFixed(2)) },
          revenueMetric: 'totalRevenue',
          meta: { usersAreNonAdditive: true, isSimulated: true },
          lastUpdated: new Date().toISOString(),
        });
      }

      const result = await ga4Service.getLandingPagesReport(campaignId, storage, ga4DateRange, propertyId, limit, campaignFilter);
      res.json({ success: true, dateRange, ...result, lastUpdated: new Date().toISOString() });
    } catch (error: any) {
      console.error('[GA4 Landing Pages] Error:', error);
      if (error instanceof Error && error.message === 'NO_GA4_CONNECTION') {
        return res.status(404).json({ success: false, error: 'NO_GA4_CONNECTION' });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED' });
      }
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch GA4 landing pages' });
    }
  });

  // GA4 Conversion Events (Phase 1: GA4-only, high value)
  app.get("/api/campaigns/:id/ga4-conversion-events", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || '30days');
      const compare = String((req.query as any)?.compare || '').toLowerCase();
      const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 1), 500);
      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      const forceMock = String((req.query as any)?.mock || '').toLowerCase() === '1' || String((req.query as any)?.mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';
      const shouldSimulate = forceMock || isYesopMockProperty(requestedPropertyId);

      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      if (compare === 'wow') {
        if (shouldSimulate) {
          res.setHeader('Cache-Control', 'no-store');
          const last = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange: '7days', endOffsetDays: 0 });
          const prev = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange: '7days', endOffsetDays: 7 });

          const events = [
            { name: 'purchase', weight: 1.0 },
            { name: 'generate_lead', weight: 0.7 },
            { name: 'sign_up', weight: 0.6 },
            { name: 'begin_checkout', weight: 0.8 },
            { name: 'add_to_cart', weight: 0.9 },
          ];
          const seedLast = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:events:last7`);
          const seedPrev = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:events:prev7`);
          const randLast = mulberry32(seedLast);
          const randPrev = mulberry32(seedPrev);
          const wSum = events.reduce((a, e) => a + e.weight, 0) || 1;

          const totals = {
            last7: {
              conversions: Number(last.totals.conversions || 0),
              users: Number(last.totals.users || 0),
              revenue: Number(last.totals.revenue || 0),
            },
            prev7: {
              conversions: Number(prev.totals.conversions || 0),
              users: Number(prev.totals.users || 0),
              revenue: Number(prev.totals.revenue || 0),
            },
          };

          const rows = events.map((e, idx) => {
            const share = e.weight / wSum;
            const last7Conversions = Math.max(0, Math.floor(totals.last7.conversions * share));
            const prev7Conversions = Math.max(0, Math.floor(totals.prev7.conversions * share));
            const last7EventCount = Math.max(last7Conversions, Math.floor(last7Conversions * (1.2 + randLast() * 2.5)));
            const prev7EventCount = Math.max(prev7Conversions, Math.floor(prev7Conversions * (1.2 + randPrev() * 2.5)));
            const last7Users = Math.min(totals.last7.users, Math.max(0, Math.floor(last7Conversions * (1.0 + randLast() * 3.0))));
            const prev7Users = Math.min(totals.prev7.users, Math.max(0, Math.floor(prev7Conversions * (1.0 + randPrev() * 3.0))));
            const last7Revenue =
              e.name === 'purchase' ? Number((totals.last7.revenue * 0.92).toFixed(2)) : Number((totals.last7.revenue * 0.08 * share).toFixed(2));
            const prev7Revenue =
              e.name === 'purchase' ? Number((totals.prev7.revenue * 0.92).toFixed(2)) : Number((totals.prev7.revenue * 0.08 * share).toFixed(2));
            return {
              eventName: e.name,
              last7: { conversions: last7Conversions, eventCount: last7EventCount, users: last7Users, revenue: last7Revenue },
              prev7: { conversions: prev7Conversions, eventCount: prev7EventCount, users: prev7Users, revenue: prev7Revenue },
            };
          });

          return res.json({
            success: true,
            compare: 'wow',
            propertyId: requestedPropertyId || 'yesop',
            rows: rows.slice(0, limit),
            totals: {
              last7: { conversions: totals.last7.conversions, eventCount: rows.reduce((s, r) => s + Number(r.last7.eventCount || 0), 0), users: totals.last7.users, revenue: Number(totals.last7.revenue.toFixed(2)) },
              prev7: { conversions: totals.prev7.conversions, eventCount: rows.reduce((s, r) => s + Number(r.prev7.eventCount || 0), 0), users: totals.prev7.users, revenue: Number(totals.prev7.revenue.toFixed(2)) },
            },
            revenueMetric: 'totalRevenue',
            meta: { isSimulated: true },
            lastUpdated: new Date().toISOString(),
          });
        }

        const result = await ga4Service.getConversionEventsWoWReport(campaignId, storage, propertyId, limit, campaignFilter);
        return res.json({ success: true, compare: 'wow', ...result, lastUpdated: new Date().toISOString() });
      }

      if (shouldSimulate) {
        res.setHeader('Cache-Control', 'no-store');
        const sim = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange });

        const events = [
          { name: 'purchase', weight: 1.0 },
          { name: 'generate_lead', weight: 0.7 },
          { name: 'sign_up', weight: 0.6 },
          { name: 'begin_checkout', weight: 0.8 },
          { name: 'add_to_cart', weight: 0.9 },
        ];

        const seed = hashToSeed(`${campaignId}:${normalizePropertyIdForMock(requestedPropertyId || 'yesop')}:events:${dateRange}`);
        const rand = mulberry32(seed);
        const wSum = events.reduce((a, e) => a + e.weight, 0) || 1;

        const totalConversions = Number(sim.totals.conversions || 0);
        const totalUsers = Number(sim.totals.users || 0);
        const totalRevenue = Number(sim.totals.revenue || 0);

        let cRemain = totalConversions;
        let rRemain = totalRevenue;
        let eventCountSum = 0;

        const rows = events.map((e, idx) => {
          const share = e.weight / wSum;
          const isLast = idx === events.length - 1;
          const conversions = isLast ? cRemain : Math.max(0, Math.floor(totalConversions * share));
          // For non-purchase events, revenue is typically 0; allocate most revenue to purchase.
          const revenue =
            e.name === 'purchase'
              ? (isLast ? Number(rRemain.toFixed(2)) : Number((totalRevenue * 0.92).toFixed(2)))
              : Number((totalRevenue * 0.08 * share).toFixed(2));
          cRemain -= conversions;
          rRemain -= revenue;
          const eventCount = Math.max(conversions, Math.floor(conversions * (1.2 + rand() * 2.5)));
          eventCountSum += eventCount;
          const users = Math.min(totalUsers, Math.max(0, Math.floor(conversions * (1.0 + rand() * 3.0))));
          return { eventName: e.name, conversions, eventCount, users, revenue: Number(revenue.toFixed(2)) };
        });

        return res.json({
          success: true,
          propertyId: requestedPropertyId || 'yesop',
          dateRange,
          rows: rows.slice(0, limit),
          totals: { conversions: totalConversions, eventCount: eventCountSum, users: totalUsers, revenue: Number(totalRevenue.toFixed(2)) },
          revenueMetric: 'totalRevenue',
          meta: { isSimulated: true },
          lastUpdated: new Date().toISOString(),
        });
      }

      const result = await ga4Service.getConversionEventsReport(campaignId, storage, ga4DateRange, propertyId, limit, campaignFilter);
      res.json({ success: true, dateRange, ...result, lastUpdated: new Date().toISOString() });
    } catch (error: any) {
      console.error('[GA4 Conversion Events] Error:', error);
      if (error instanceof Error && error.message === 'NO_GA4_CONNECTION') {
        return res.status(404).json({ success: false, error: 'NO_GA4_CONNECTION' });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED' });
      }
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch GA4 conversion events' });
    }
  });

  // GA4 acquisition-style breakdown table (Date / Channel / Source / Medium / Campaign / Device / Country)
  app.get("/api/campaigns/:id/ga4-breakdown", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const dateRange = String(req.query.dateRange || '30days');
      const propertyId = req.query.propertyId ? String(req.query.propertyId) : undefined;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '2000'), 10) || 2000, 1), 10000);
      const debug = String(req.query.debug || '').toLowerCase() === '1' || String(req.query.debug || '').toLowerCase() === 'true';
      const campaign = await storage.getCampaign(campaignId);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
      const forceMock = String((req.query as any)?.mock || '').toLowerCase() === '1' || String((req.query as any)?.mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';
      const shouldSimulate = forceMock || isYesopMockProperty(requestedPropertyId);

      if (shouldSimulate) {
        res.setHeader('Cache-Control', 'no-store');
        const sim = simulateGA4({ campaignId, propertyId: requestedPropertyId || 'yesop', dateRange });
        const pid = requestedPropertyId || 'yesop';
        return res.json({
          success: true,
          propertyId: pid,
          dateRange,
          totals: {
            sessions: sim.totals.sessions,
            sessionsRaw: sim.totals.sessionsRaw,
            users: sim.totals.users,
            conversions: sim.totals.conversions,
            revenue: sim.totals.revenue,
          },
          rows: sim.breakdownRows.slice(0, limit),
          ...(debug ? { meta: { isSimulated: true, seedKey: `${campaignId}:${pid}:${dateRange}`, days: dateRangeToDays(dateRange) } } : {}),
          isSimulated: true,
          simulationReason: 'Simulated GA4 breakdown for demo/testing (propertyId yesop or ?mock=1).',
          lastUpdated: new Date().toISOString(),
        });
      }

      // Convert date range to GA4 format
      let ga4DateRange = '30daysAgo';
      switch (dateRange) {
        case '7days':
          ga4DateRange = '7daysAgo';
          break;
        case '30days':
          ga4DateRange = '30daysAgo';
          break;
        case '90days':
          ga4DateRange = '90daysAgo';
          break;
        default:
          ga4DateRange = '30daysAgo';
      }

      const result = await ga4Service.getAcquisitionBreakdown(campaignId, storage, ga4DateRange, propertyId, limit, campaignFilter);

      res.json({
        success: true,
        propertyId,
        dateRange,
        totals: result.totals,
        rows: result.rows,
        ...(debug ? { meta: result.meta } : {}),
        lastUpdated: new Date().toISOString(),
      });
    } catch (error: any) {
      console.error('[GA4 Breakdown] Error:', error);
      if (error instanceof Error && error.message === 'NO_GA4_CONNECTION') {
        return res.status(404).json({
          success: false,
          error: 'NO_GA4_CONNECTION',
          message: 'No GA4 connection found for this campaign. Please connect Google Analytics.',
        });
      }
      if (error instanceof Error && (error.message === 'AUTO_REFRESH_NEEDED' || (error as any).isAutoRefreshNeeded)) {
        return res.status(401).json({
          success: false,
          error: 'AUTO_REFRESH_NEEDED',
          requiresReauthorization: true,
          message: 'GA4 token refresh is required. Please reconnect Google Analytics.',
        });
      }
      if (error instanceof Error && (error.message === 'TOKEN_EXPIRED' || (error as any).isTokenExpired)) {
        return res.status(401).json({
          success: false,
          error: 'TOKEN_EXPIRED',
          requiresReauthorization: true,
          message: 'GA4 token expired. Please reconnect Google Analytics.',
        });
      }
      res.status(500).json({ success: false, error: error?.message || 'Failed to fetch GA4 breakdown' });
    }
  });

  // Geographic breakdown endpoint - Updated for multiple connections
  app.get('/api/campaigns/:id/ga4-geographic', async (req, res) => {
    try {
      const { id } = req.params;
      const { dateRange = '7days', propertyId, mock } = req.query;
      const campaign = await storage.getCampaign(id);
      const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);

      const toGa4StartDate = (dr: string) => {
        const v = String(dr || '').toLowerCase();
        switch (v) {
          case '7days':
            return '7daysAgo';
          case '30days':
            return '30daysAgo';
          case '90days':
            return '90daysAgo';
          default:
            return '7daysAgo';
        }
      };

      // Lightweight deterministic RNG for stable simulated outputs across refreshes.
      const hashToSeed = (s: string) => {
        let h = 2166136261;
        for (let i = 0; i < s.length; i++) {
          h ^= s.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        return h >>> 0;
      };

      const mulberry32 = (a: number) => {
        return function () {
          let t = (a += 0x6D2B79F5);
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
      };

      const hasUsefulGeo = (geo: any) => {
        const top = Array.isArray(geo?.topCountries) ? geo.topCountries : [];
        const cleaned = top
          .map((c: any) => ({ country: String(c?.country || '').trim(), users: Number(c?.users || 0) }))
          .filter((c: any) => !!c.country && c.country.toLowerCase() !== 'unknown' && c.country.toLowerCase() !== '(not set)' && c.users > 0);

        const uniqueCountries = new Set(cleaned.map((c: any) => c.country.toLowerCase()));
        // UI uses a threshold of >5 countries for the map/table; match that here.
        return uniqueCountries.size >= 6;
      };

      const simulateGeo = (opts: { totalUsers: number; totalSessions: number; totalPageviews: number; seedKey: string }) => {
        const totalUsers = Math.max(0, Math.floor(opts.totalUsers || 0));
        const totalSessions = Math.max(0, Math.floor(opts.totalSessions || 0));
        const totalPageviews = Math.max(0, Math.floor(opts.totalPageviews || 0));

        const seed = hashToSeed(opts.seedKey);
        const rand = mulberry32(seed);

        // A realistic "global marketing" distribution (not perfect, but believable for demos)
        const countries = [
          { country: 'United States of America', cities: [['New York', 'New York'], ['San Francisco', 'California'], ['Austin', 'Texas']] },
          { country: 'United Kingdom', cities: [['London', 'England'], ['Manchester', 'England']] },
          { country: 'Canada', cities: [['Toronto', 'Ontario'], ['Vancouver', 'British Columbia']] },
          { country: 'Germany', cities: [['Berlin', 'Berlin'], ['Munich', 'Bavaria']] },
          { country: 'France', cities: [['Paris', 'Île-de-France'], ['Lyon', 'Auvergne-Rhône-Alpes']] },
          { country: 'Australia', cities: [['Sydney', 'New South Wales'], ['Melbourne', 'Victoria']] },
          { country: 'Netherlands', cities: [['Amsterdam', 'North Holland'], ['Rotterdam', 'South Holland']] },
          { country: 'Sweden', cities: [['Stockholm', 'Stockholm'], ['Gothenburg', 'Västra Götaland']] },
          { country: 'Spain', cities: [['Madrid', 'Community of Madrid'], ['Barcelona', 'Catalonia']] },
          { country: 'Italy', cities: [['Milan', 'Lombardy'], ['Rome', 'Lazio']] },
          { country: 'Brazil', cities: [['São Paulo', 'São Paulo'], ['Rio de Janeiro', 'Rio de Janeiro']] },
          { country: 'India', cities: [['Bengaluru', 'Karnataka'], ['Mumbai', 'Maharashtra']] },
          { country: 'Japan', cities: [['Tokyo', 'Tokyo'], ['Osaka', 'Osaka']] },
          { country: 'Singapore', cities: [['Singapore', 'Singapore']] },
        ];

        // Pick 10-14 countries deterministically
        const desiredCount = Math.min(Math.max(10, Math.floor(10 + rand() * 5)), countries.length);
        const shuffled = [...countries].sort(() => rand() - 0.5);
        const picked = shuffled.slice(0, desiredCount);

        // Generate weights and normalize
        const rawWeights = picked.map(() => 0.5 + rand() * 1.5);
        const weightSum = rawWeights.reduce((a, b) => a + b, 0) || 1;

        // Allocate users
        const userAlloc: number[] = [];
        let userRemaining = totalUsers;
        for (let i = 0; i < picked.length; i++) {
          const share = rawWeights[i] / weightSum;
          const v = i === picked.length - 1 ? userRemaining : Math.max(0, Math.floor(totalUsers * share));
          userAlloc.push(v);
          userRemaining -= v;
        }

        // Allocate sessions and pageviews proportionally (with light randomness but deterministic)
        const sessionAlloc: number[] = [];
        let sessionRemaining = totalSessions;
        for (let i = 0; i < picked.length; i++) {
          const share = totalUsers > 0 ? userAlloc[i] / totalUsers : 1 / picked.length;
          const v = i === picked.length - 1 ? sessionRemaining : Math.max(0, Math.floor(totalSessions * share));
          sessionAlloc.push(v);
          sessionRemaining -= v;
        }

        const pageviewAlloc: number[] = [];
        let pageviewRemaining = totalPageviews;
        for (let i = 0; i < picked.length; i++) {
          const share = totalSessions > 0 ? sessionAlloc[i] / totalSessions : 1 / picked.length;
          const v = i === picked.length - 1 ? pageviewRemaining : Math.max(0, Math.floor(totalPageviews * share));
          pageviewAlloc.push(v);
          pageviewRemaining -= v;
        }

        const topCountries = picked
          .map((c, i) => ({
            country: c.country,
            users: userAlloc[i],
            sessions: sessionAlloc[i],
            pageviews: pageviewAlloc[i],
          }))
          .sort((a, b) => (b.users || 0) - (a.users || 0))
          .filter((c) => (c.users || 0) > 0)
          .slice(0, 20);

        // Location detail rows (city/region)
        const data: any[] = [];
        for (const c of topCountries.slice(0, 10)) {
          const def = picked.find((p) => p.country === c.country);
          const cityPairs = def?.cities || [[c.country, c.country]];
          const [city, region] = cityPairs[Math.floor(rand() * cityPairs.length)];
          data.push({
            city,
            region,
            country: c.country,
            users: Math.max(1, Math.floor((c.users || 1) * (0.2 + rand() * 0.4))),
            pageviews: Math.max(1, Math.floor((c.pageviews || 1) * (0.2 + rand() * 0.5))),
            sessions: Math.max(1, Math.floor((c.sessions || 1) * (0.2 + rand() * 0.4))),
          });
        }

        return {
          success: true,
          data,
          topCountries,
          totalLocations: data.length,
          totalUsers: totalUsers,
          totalSessions: totalSessions,
          totalPageviews: totalPageviews,
          isSimulated: true,
          simulationReason: 'GA4 did not return useful geographic distribution for this property/date range; showing simulated geo for demo/testing.',
        };
      };

      const forceMock = String(mock || '').toLowerCase() === '1' || String(mock || '').toLowerCase() === 'true';
      const requestedPropertyId = propertyId ? String(propertyId) : '';

      // If the user explicitly requests mock geo, allow testing even without a GA4 connection.
      // This is for MVP/demo validation of the UI and endpoint wiring (not GA4 accuracy).
      if (forceMock) {
        const simulated = simulateGeo({
          totalUsers: 2500,
          totalSessions: 4000,
          totalPageviews: 6000,
          seedKey: `${id}:${requestedPropertyId || 'no-property'}:${String(dateRange)}:forced-no-connection`,
        });

        return res.json({
          success: true,
          ...simulated,
          isSimulated: true,
          simulationReason: 'Forced mock mode (?mock=1) for UI testing (no GA4 connection required).',
          propertyId: requestedPropertyId || 'mock',
          propertyName: requestedPropertyId ? 'Requested property (mock)' : 'Mock property',
          displayName: requestedPropertyId ? `Mock ${requestedPropertyId}` : 'Mock GA4 Property',
          totalProperties: 0,
          sourceProperty: requestedPropertyId
            ? { id: 'mock', propertyId: requestedPropertyId, displayName: `Mock ${requestedPropertyId}` }
            : { id: 'mock', propertyId: 'mock', displayName: 'Mock GA4 Property' },
          lastUpdated: new Date().toISOString()
        });
      }

      // Get all connections or a specific one
      let connections;
      if (propertyId) {
        const connection = await storage.getGA4Connection(id, propertyId as string);
        connections = connection ? [connection] : [];
      } else {
        connections = await storage.getGA4Connections(id);
      }

      if (!connections || connections.length === 0) {
        return res.status(404).json({ success: false, error: 'GA4 connection not found' });
      }

      // Check if any connection has access token
      const hasValidToken = connections.some(conn => !!conn.accessToken);
      if (!hasValidToken) {
        return res.status(400).json({ 
          success: false, 
          error: 'GA4 access token missing',
          requiresConnection: true
        });
      }

      // Use the primary connection or first available connection
      const primaryConnection = connections.find(conn => conn.isPrimary && conn.accessToken) || 
                               connections.find(conn => conn.accessToken);

      if (!primaryConnection || !primaryConnection.accessToken) {
        throw new Error('No valid connection available');
      }

      console.log('Fetching GA4 geographic data:', {
        campaignId: id,
        propertyId: primaryConnection.propertyId,
        totalProperties: connections.length,
        dateRange
      });

      // (mock=1 handled above; from here onward we have a GA4 connection)

      // Try to get geographic data with automatic token refresh on failure
      let geographicData;
      try {
        geographicData = await ga4Service.getGeographicMetrics(
          primaryConnection.propertyId,
          primaryConnection.accessToken,
          dateRange as string,
          campaignFilter
        );
      } catch (authError: any) {
        console.log('Geographic API failed, attempting token refresh:', authError.message);
        
        // Check if we have refresh token to attempt refresh
        if (primaryConnection.refreshToken) {
          try {
            console.log('Refreshing access token for geographic data...');
            const tokenData = await ga4Service.refreshAccessToken(
              primaryConnection.refreshToken,
              primaryConnection.clientId || undefined,
              primaryConnection.clientSecret || undefined
            );
            
            // Update the connection with new token
            const expiresAt = new Date(Date.now() + (tokenData.expires_in * 1000));
            await storage.updateGA4ConnectionTokens(primaryConnection.id, {
              accessToken: tokenData.access_token,
              expiresAt
            });
            
            console.log('Token refreshed for geographic data - retrying...');
            geographicData = await ga4Service.getGeographicMetrics(
              primaryConnection.propertyId,
              tokenData.access_token,
              dateRange as string,
              campaignFilter
            );
          } catch (refreshError) {
            console.log('Token refresh failed for geographic data, using fallback');
            throw authError; // Re-throw original error to trigger fallback in component
          }
        } else {
          console.log('No refresh token available for geographic data');
          throw authError; // Re-throw original error to trigger fallback in component
        }
      }

      // If GA4 geo is empty/unknown/single-country (common for MP test data), return simulated geo so the UI can be tested.
      if (!hasUsefulGeo(geographicData)) {
        let totalUsers = 2500;
        let totalSessions = 4000;
        let totalPageviews = 6000;
        try {
          const m = await ga4Service.getMetricsWithAutoRefresh(id, storage, toGa4StartDate(String(dateRange)), primaryConnection.propertyId, campaignFilter);
          totalUsers = Math.max(0, Math.floor(Number((m as any)?.impressions || 0)));
          totalSessions = Math.max(0, Math.floor(Number((m as any)?.sessions || 0)));
          totalPageviews = Math.max(0, Math.floor(Number((m as any)?.pageviews || 0)));
          // Ensure at least a small dataset for demos
          if (totalUsers < 50) totalUsers = 2500;
          if (totalSessions < 50) totalSessions = 4000;
          if (totalPageviews < 50) totalPageviews = 6000;
        } catch (e) {
          // ignore and use defaults
        }

        geographicData = simulateGeo({
          totalUsers,
          totalSessions,
          totalPageviews,
          seedKey: `${id}:${primaryConnection.propertyId}:${String(dateRange)}`,
        });
      }

      res.json({
        success: true,
        ...geographicData,
        propertyId: primaryConnection.propertyId,
        propertyName: primaryConnection.propertyName,
        displayName: primaryConnection.displayName,
        totalProperties: connections.length,
        sourceProperty: {
          id: primaryConnection.id,
          propertyId: primaryConnection.propertyId,
          displayName: primaryConnection.displayName || primaryConnection.propertyName
        },
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error('GA4 geographic data error:', error);
      // Provide simulated geographic data instead of failing the UI (demo/testing friendly).
      res.json({
        success: true,
        isSimulated: true,
        simulationReason: 'GA4 geographic fetch failed; showing simulated geo for demo/testing.',
        topCountries: [
          { country: 'United States of America', users: 1247, sessions: 1856, pageviews: 3122 },
          { country: 'United Kingdom', users: 834, sessions: 1243, pageviews: 2101 },
          { country: 'Canada', users: 567, sessions: 892, pageviews: 1467 },
          { country: 'Germany', users: 445, sessions: 678, pageviews: 1099 },
          { country: 'France', users: 389, sessions: 523, pageviews: 947 },
          { country: 'Australia', users: 234, sessions: 356, pageviews: 612 },
          { country: 'Japan', users: 198, sessions: 289, pageviews: 501 },
          { country: 'Netherlands', users: 167, sessions: 245, pageviews: 419 },
          { country: 'Sweden', users: 143, sessions: 201, pageviews: 362 },
          { country: 'Brazil', users: 134, sessions: 198, pageviews: 347 },
        ],
        data: [
          { city: 'New York', region: 'New York', country: 'United States of America', users: 347, sessions: 512, pageviews: 892 },
          { city: 'London', region: 'England', country: 'United Kingdom', users: 234, sessions: 361, pageviews: 612 },
          { city: 'Toronto', region: 'Ontario', country: 'Canada', users: 198, sessions: 289, pageviews: 456 },
          { city: 'Berlin', region: 'Berlin', country: 'Germany', users: 167, sessions: 245, pageviews: 389 },
          { city: 'Paris', region: 'Île-de-France', country: 'France', users: 143, sessions: 198, pageviews: 324 },
          { city: 'Sydney', region: 'New South Wales', country: 'Australia', users: 112, sessions: 156, pageviews: 267 },
          { city: 'Tokyo', region: 'Tokyo', country: 'Japan', users: 98, sessions: 143, pageviews: 234 },
          { city: 'Amsterdam', region: 'North Holland', country: 'Netherlands', users: 87, sessions: 128, pageviews: 198 },
          { city: 'Stockholm', region: 'Stockholm', country: 'Sweden', users: 76, sessions: 112, pageviews: 167 },
          { city: 'São Paulo', region: 'São Paulo', country: 'Brazil', users: 65, sessions: 94, pageviews: 143 },
        ],
        totalLocations: 20,
        totalUsers: 2280,
        totalSessions: 3875,
        totalPageviews: 6200,
        _isFallbackData: true,
        _message: 'Using simulated geographic data - connection refresh in progress',
        lastUpdated: new Date().toISOString(),
      });
    }
  });

  // Google Analytics OAuth endpoints
  app.post("/api/auth/google/url", (req, res) => {
    try {
      const { campaignId, returnUrl } = req.body;
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(400).json({
          error: "Google OAuth credentials not configured. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to your environment variables."
        });
      }
      
      const baseUrl = "https://accounts.google.com/o/oauth2/v2/auth";
      const scopes = [
        "https://www.googleapis.com/auth/analytics.readonly",
        "https://www.googleapis.com/auth/userinfo.email"
      ];
      
      const state = Buffer.from(JSON.stringify({ campaignId, returnUrl })).toString('base64');
      
      const params = {
        client_id: clientId,
        redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`,
        scope: scopes.join(" "),
        response_type: "code",
        access_type: "offline",
        prompt: "select_account",
        state: state,
        include_granted_scopes: "true"
      };
      
      const queryString = new URLSearchParams(params).toString();
      const oauthUrl = `${baseUrl}?${queryString}`;
      
      res.json({ oauth_url: oauthUrl });
    } catch (error) {
      console.error('OAuth URL generation error:', error);
      res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
  });

  // OAuth callback endpoint
  app.post("/api/auth/google/callback", async (req, res) => {
    try {
      const { code, state } = req.body;
      
      if (!code) {
        return res.status(400).json({ error: 'Authorization code is required' });
      }
      
      const clientId = process.env.GOOGLE_CLIENT_ID;
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
      
      if (!clientId || !clientSecret) {
        return res.status(500).json({ error: 'OAuth not configured' });
      }
      
      let campaignId = 'unknown';
      try {
        const stateData = JSON.parse(Buffer.from(state, 'base64').toString());
        campaignId = stateData.campaignId || 'unknown';
      } catch (e) {
        console.warn('Could not parse OAuth state:', e);
      }
      
      // Exchange authorization code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code: code,
          grant_type: 'authorization_code',
          redirect_uri: `${req.protocol}://${req.get('host')}/auth/google/callback`
        })
      });
      
      const tokenData = await tokenResponse.json();
      
      if (!tokenResponse.ok) {
        console.error('Token exchange failed:', tokenData);
        return res.status(400).json({ 
          error: tokenData.error_description || 'Failed to exchange authorization code' 
        });
      }
      
      // Get user info
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      let userInfo = null;
      if (userInfoResponse.ok) {
        userInfo = await userInfoResponse.json();
      }
      
      // Get Analytics properties
      const accountsResponse = await fetch('https://analyticsadmin.googleapis.com/v1alpha/accounts', {
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      });
      
      let properties: any[] = [];
      if (accountsResponse.ok) {
        const accountsData = await accountsResponse.json();
        
        for (const account of accountsData.accounts || []) {
          try {
            const propertiesResponse = await fetch(`https://analyticsadmin.googleapis.com/v1alpha/${account.name}/properties`, {
              headers: {
                'Authorization': `Bearer ${tokenData.access_token}`
              }
            });
            
            if (propertiesResponse.ok) {
              const propertiesData = await propertiesResponse.json();
              for (const property of propertiesData.properties || []) {
                properties.push({
                  id: property.name.split('/').pop(),
                  name: property.displayName,
                  account: account.displayName
                });
              }
            }
          } catch (error) {
            console.warn('Error fetching properties for account:', account.name, error);
          }
        }
      }
      
      console.log('About to store OAuth connection...');
      console.log('Campaign ID:', campaignId);
      console.log('Properties found:', properties.length);
      console.log('Token data available:', !!tokenData.access_token, !!tokenData.refresh_token);
      
      // Store the OAuth connection
      (global as any).oauthConnections = (global as any).oauthConnections || new Map();
      (global as any).oauthConnections.set(campaignId, {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAt: Date.now() + (tokenData.expires_in * 1000),
        userInfo,
        properties,
        connectedAt: new Date().toISOString()
      });
      
      console.log('OAuth connection stored for campaignId:', campaignId);
      console.log('Total connections after storage:', (global as any).oauthConnections.size);
      console.log('All connection keys:', Array.from((global as any).oauthConnections.keys()));
      
      res.json({
        success: true,
        user: userInfo,
        properties,
        message: 'Successfully authenticated with Google Analytics'
      });
    } catch (error) {
      console.error('OAuth callback error:', error);
      res.status(500).json({ error: 'Authentication failed' });
    }
  });

  // Check GA4 connection status (checks actual database storage) - Updated for multiple connections
  app.get("/api/ga4/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      
      console.log(`[GA4 Check] Checking connection for campaign: ${campaignId}`);
      
      // Get all GA4 connections for this campaign
      const ga4Connections = await storage.getGA4Connections(campaignId);
      
      console.log(`[GA4 Check] Found ${ga4Connections.length} connections for campaign ${campaignId}`);
      
      if (ga4Connections && ga4Connections.length > 0) {
        const primaryConnection = ga4Connections.find(conn => conn.isPrimary) || ga4Connections[0];
        return res.json({
          connected: true,
          primaryPropertyId: primaryConnection.propertyId,
          totalConnections: ga4Connections.length,
          connections: ga4Connections.map(conn => ({
            id: conn.id,
            propertyId: conn.propertyId,
            propertyName: conn.propertyName,
            displayName: conn.displayName,
            websiteUrl: conn.websiteUrl,
            isPrimary: conn.isPrimary,
            isActive: conn.isActive,
            connectedAt: conn.connectedAt
          })),
          primaryPropertyName: primaryConnection.propertyName,
          primaryDisplayName: primaryConnection.displayName || primaryConnection.propertyName,
          primaryConnectedAt: primaryConnection.connectedAt,
          hasValidToken: ga4Connections.some(conn => !!conn.accessToken),
          method: primaryConnection.method
        });
      }

      // Fallback: check temporary OAuth connections for backward compatibility
      const connections = (global as any).oauthConnections;
      if (connections && connections.has(campaignId)) {
        const connection = connections.get(campaignId);
        return res.json({
          connected: true,
          properties: connection.properties || [],
          user: connection.userInfo
        });
      }
      
      res.json({ connected: false, totalConnections: 0, connections: [] });
    } catch (error) {
      console.error('Connection check error:', error);
      res.status(500).json({ error: 'Failed to check connection status' });
    }
  });

  // Connected platforms summary for campaign detail page
  app.get("/api/campaigns/:id/connected-platforms", async (req, res) => {
    try {
      const campaignId = req.params.id;
      console.log(`[Connected Platforms] Checking platforms for campaign ${campaignId}`);
      const campaign = await storage.getCampaign(campaignId);
      const campaignPlatformRaw = String((campaign as any)?.platform || '')
        .split(',')
        .map((s: string) => s.trim().toLowerCase())
        .filter(Boolean);
      const campaignWantsGoogleSheets = campaignPlatformRaw.includes('google-sheets') || campaignPlatformRaw.includes('google sheets');

      const [
        ga4Connections,
        googleSheetsConnections,
        linkedInConnection,
        metaConnection,
        customIntegration,
      ] = await Promise.all([
        storage.getGA4Connections(campaignId),
        storage.getGoogleSheetsConnections(campaignId),
        storage.getLinkedInConnection(campaignId),
        storage.getMetaConnection(campaignId),
        storage.getCustomIntegration(campaignId),
      ]);
      
      // Get primary Google Sheets connection for backward compatibility
      const googleSheetsConnection = googleSheetsConnections.find(c => c.isPrimary) || googleSheetsConnections[0];

      console.log(`[Connected Platforms] GA4 connections found: ${ga4Connections.length}`);
      if (ga4Connections.length > 0) {
        ga4Connections.forEach(conn => {
          console.log(`[Connected Platforms] - GA4 Connection: ${conn.id}, property: ${conn.propertyId}, isPrimary: ${conn.isPrimary}, isActive: ${conn.isActive}`);
        });
      }
      
      console.log(`[Connected Platforms] Google Sheets connection:`, googleSheetsConnection ? `Found (ID: ${googleSheetsConnection.id})` : 'Not found');
      console.log(`[Connected Platforms] LinkedIn connection:`, linkedInConnection ? `Found (ID: ${linkedInConnection.id}, adAccountId: ${linkedInConnection.adAccountId || 'missing'})` : 'Not found');
      console.log(`[Connected Platforms] Meta connection:`, metaConnection ? `Found (ID: ${metaConnection.id})` : 'Not found');
      console.log(`[Connected Platforms] Custom Integration:`, customIntegration ? `Found (ID: ${customIntegration.id}, webhook: ${customIntegration.webhookToken})` : 'Not found');

      // Get LinkedIn analytics path with latest session ID
      let linkedInAnalyticsPath = null;
      if (linkedInConnection) {
        const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
        if (sessions && sessions.length > 0) {
          // Sort by importedAt descending to get the most recent session
          const latestSession = sessions.sort((a: any, b: any) => 
            new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
          )[0];
          linkedInAnalyticsPath = `/campaigns/${campaignId}/linkedin-analytics?session=${latestSession.id}`;
          console.log(`[Connected Platforms] LinkedIn latest session: ${latestSession.id}`);
        } else {
          linkedInAnalyticsPath = `/campaigns/${campaignId}/linkedin-analytics`;
          console.log(`[Connected Platforms] LinkedIn has no import sessions yet`);
        }
      }

      // Include conversion values in connection data for UI display
      const linkedInConversionValue = linkedInConnection?.conversionValue || null;
      const metaConversionValue = metaConnection?.conversionValue || null;

      const statuses = [
        {
          id: "google-analytics",
          name: "Google Analytics",
          connected: ga4Connections.length > 0,
          analyticsPath:
            ga4Connections.length > 0
              ? `/campaigns/${campaignId}/ga4-metrics`
              : null,
          lastConnectedAt: ga4Connections[ga4Connections.length - 1]?.connectedAt,
        },
        {
          id: "google-sheets",
          name: "Google Sheets",
          // Google Sheets is considered "connected" if ANY active connection exists (not just primary/first)
          // This ensures that if one sheet is deleted, it still shows as connected if other sheets exist
          connected: googleSheetsConnections.length > 0,
          // Campaign-level Google Sheets card should only appear as "Connected" if the campaign was created/configured
          // with Google Sheets as a connector (Create Campaign flow). Google Sheets used only for LinkedIn revenue mapping
          // should be shown under LinkedIn -> Connected Data Sources, not as a campaign-level connector.
          connectedCampaignLevel:
            !!campaignWantsGoogleSheets &&
            googleSheetsConnections.some((c: any) => c?.spreadsheetId && c.spreadsheetId !== 'pending'),
          analyticsPath: googleSheetsConnections.length > 0
            ? `/campaigns/${campaignId}/google-sheets-data`
            : null,
          lastConnectedAt: googleSheetsConnection?.connectedAt,
        },
        {
          id: "linkedin",
          name: "LinkedIn Ads",
          connected: !!(linkedInConnection && linkedInConnection.adAccountId), // Require adAccountId to be considered connected
          analyticsPath: linkedInAnalyticsPath,
          lastConnectedAt: linkedInConnection?.connectedAt,
          conversionValue: linkedInConversionValue,
        },
        {
          id: "facebook",
          name: "Meta/Facebook Ads",
          connected: !!metaConnection,
          analyticsPath: metaConnection
            ? `/campaigns/${campaignId}/meta-analytics`
            : null,
          lastConnectedAt: metaConnection?.connectedAt,
          conversionValue: metaConversionValue,
        },
        {
          id: "custom-integration",
          name: "Custom Integration",
          connected: !!customIntegration,
          analyticsPath: customIntegration
            ? `/campaigns/${campaignId}/custom-integration-analytics`
            : null,
          lastConnectedAt: customIntegration?.connectedAt,
        },
      ];

      console.log(`[Connected Platforms] Returning statuses:`, JSON.stringify(statuses, null, 2));
      res.json({ statuses });
    } catch (error: any) {
      console.error("Connected platforms status error:", error);
      console.error("Error stack:", error?.stack);
      res
        .status(500)
        .json({ 
          message: "Failed to fetch connected platform statuses",
          error: error?.message,
          details: process.env.NODE_ENV === 'development' ? error?.stack : undefined
        });
    }
  });

  /**
   * Campaign Outcome Totals (Outcome-centric)
   * - GA4 is the source of truth for onsite outcomes (revenue, conversions, sessions, users)
   * - Platform connections contribute inputs (spend, clicks, impressions, leads)
   * - Revenue sources connected via LinkedIn "additional data" (HubSpot/Salesforce/Shopify) can optionally be classified
   *   as offsite revenue (not tracked in GA4) and will be reported separately to avoid double-counting.
   */
  app.get("/api/campaigns/:id/outcome-totals", async (req, res) => {
    try {
      const campaignId = String(req.params.id || "");
      const dateRange = String(req.query.dateRange || "30days");

      const parseNum = (v: any): number => {
        if (v === null || typeof v === "undefined" || v === "") return 0;
        const n = typeof v === "string" ? parseFloat(v) : Number(v);
        return Number.isFinite(n) ? n : 0;
      };

      const toGa4DateRange = (dr: string) => {
        switch (String(dr || "").toLowerCase()) {
          case "7days":
            return "7daysAgo";
          case "30days":
            return "30daysAgo";
          case "90days":
            return "90daysAgo";
          default:
            return "30daysAgo";
        }
      };

      const [campaign, linkedInConn, metaConn, customIntegration] = await Promise.all([
        storage.getCampaign(campaignId),
        storage.getLinkedInConnection(campaignId),
        storage.getMetaConnection(campaignId),
        storage.getCustomIntegration(campaignId),
      ]);

      // GA4 totals
      let ga4Totals: any = {
        connected: false,
        revenue: 0,
        conversions: 0,
        sessions: 0,
        users: 0,
      };
      try {
        const ga4DateRange = toGa4DateRange(dateRange);
        const campaignFilter = parseGA4CampaignFilter((campaign as any)?.ga4CampaignFilter);
        const result = await ga4Service.getAcquisitionBreakdown(campaignId, storage, ga4DateRange, undefined, 2000, campaignFilter);
        ga4Totals = {
          connected: true,
          revenue: parseNum(result?.totals?.revenue),
          conversions: parseNum(result?.totals?.conversions),
          sessions: parseNum(result?.totals?.sessions),
          users: parseNum(result?.totals?.users),
        };
      } catch (e: any) {
        // Best-effort: allow this endpoint to return even if GA4 is not connected.
        ga4Totals = { ...ga4Totals, connected: false, error: e?.message || "GA4 unavailable" };
      }

      // Persisted spend totals (manual/CSV/Sheets imports)
      const { startDate, endDate } = getDateRangeBounds(dateRange);
      const spendTotals = await storage.getSpendTotalForRange(campaignId, startDate, endDate);
      const persistedSpend = parseNum((spendTotals as any)?.totalSpend);

      // LinkedIn aggregated platform inputs (from latest import session)
      let linkedIn: any = { connected: false };
      let linkedInSpend = 0;
      try {
        if (linkedInConn && linkedInConn.adAccountId) {
          const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
          const latestSession = (sessions || []).sort((a: any, b: any) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];
          if (latestSession) {
            const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
            const aggregated: Record<string, number> = {};
            const keys = Array.from(new Set((metrics || []).map((m: any) => m.metricKey)));
            keys.forEach((k: string) => {
              const total = (metrics || [])
                .filter((m: any) => m.metricKey === k)
                .reduce((sum: number, m: any) => sum + parseNum(m.metricValue), 0);
              aggregated[k] = parseFloat(total.toFixed(2));
            });
            linkedInSpend = parseNum(aggregated.spend);
            linkedIn = {
              connected: true,
              spend: linkedInSpend,
              clicks: parseNum(aggregated.clicks),
              impressions: parseNum(aggregated.impressions),
              conversions: parseNum(aggregated.conversions),
              leads: parseNum(aggregated.leads),
              conversionValue: latestSession.conversionValue ? parseNum(latestSession.conversionValue) : 0,
              attributedRevenue: parseNum(aggregated.revenue),
              roas: parseNum(aggregated.roas),
              roi: parseNum(aggregated.roi),
              lastImportedAt: latestSession.importedAt,
            };
          } else {
            linkedIn = { connected: true, hasImport: false };
          }
        }
      } catch (e: any) {
        linkedIn = { connected: !!(linkedInConn && linkedInConn.adAccountId), error: e?.message || "LinkedIn unavailable" };
      }

      // Meta summary inputs (currently mock-backed)
      let meta: any = { connected: false };
      let metaSpend = 0;
      try {
        if (metaConn) {
          const { generateMetaMockData } = await import("./utils/metaMockData");
          const mockData = generateMetaMockData(metaConn.adAccountId, metaConn.adAccountName || "Meta Ad Account");
          const s = mockData?.summary || {};
          metaSpend = parseNum(s?.spend);
          meta = {
            connected: true,
            spend: metaSpend,
            clicks: parseNum(s?.clicks),
            impressions: parseNum(s?.impressions),
            conversions: parseNum(s?.conversions),
            // leads not reliably available in current meta mock shape
          };
        }
      } catch (e: any) {
        meta = { connected: !!metaConn, error: e?.message || "Meta unavailable" };
      }

      // Custom integration inputs (webhook-fed)
      let custom: any = { connected: false };
      try {
        if (customIntegration) {
          const latest = await storage.getLatestCustomIntegrationMetrics(campaignId);
          const m: any = latest || {};
          custom = {
            connected: true,
            spend: parseNum(m.spend),
            clicks: parseNum(m.clicks),
            impressions: parseNum(m.impressions),
            conversions: parseNum(m.conversions),
            users: parseNum(m.users),
            sessions: parseNum(m.sessions),
            pageviews: parseNum(m.pageviews),
            revenue: parseNum((m as any).revenue),
            lastUploadedAt: m.uploadedAt || null,
          };
        }
      } catch (e: any) {
        custom = { connected: !!customIntegration, error: e?.message || "Custom integration unavailable" };
      }

      // Web Analytics (platform-agnostic outcome source):
      // Prefer GA4 when connected; otherwise allow Custom Integration to serve as the web analytics outcome source.
      const webAnalyticsProvider =
        ga4Totals?.connected === true
          ? "ga4"
          : custom?.connected === true
          ? "custom_integration"
          : null;
      const webAnalytics = {
        connected: Boolean(webAnalyticsProvider),
        provider: webAnalyticsProvider,
        revenue:
          webAnalyticsProvider === "ga4"
            ? parseNum(ga4Totals.revenue)
            : webAnalyticsProvider === "custom_integration"
            ? parseNum(custom?.revenue)
            : 0,
        conversions:
          webAnalyticsProvider === "ga4"
            ? parseNum(ga4Totals.conversions)
            : webAnalyticsProvider === "custom_integration"
            ? parseNum(custom?.conversions)
            : 0,
        sessions:
          webAnalyticsProvider === "ga4"
            ? parseNum(ga4Totals.sessions)
            : webAnalyticsProvider === "custom_integration"
            ? parseNum(custom?.sessions)
            : 0,
        users:
          webAnalyticsProvider === "ga4"
            ? parseNum(ga4Totals.users)
            : webAnalyticsProvider === "custom_integration"
            ? parseNum(custom?.users)
            : 0,
      };

      // Unified spend rule:
      // - If the user imported spend (persistedSpend > 0), use that as campaign marketing spend.
      // - Otherwise, fall back to sum of connected ad-platform spends (LinkedIn + Meta today; extend as platforms are added).
      const platformSpendFallback = parseFloat((linkedInSpend + metaSpend).toFixed(2));
      const unifiedSpend = persistedSpend > 0 ? persistedSpend : platformSpendFallback;
      const spendSource = persistedSpend > 0 ? "persisted_spend_sources" : "platform_spend_fallback";

      // Offsite revenue sources (best-effort; populated by mapping wizards when configured)
      const parseMappingConfig = (raw: any) => {
        if (!raw) return null;
        try {
          return typeof raw === "string" ? JSON.parse(raw) : raw;
        } catch {
          return null;
        }
      };

      const revenueSources: any[] = [];
      let offsiteRevenueTotal = 0;
      try {
        const [hubspotConn, sfConn, shopifyConn] = await Promise.all([
          storage.getHubspotConnection(campaignId),
          storage.getSalesforceConnection(campaignId),
          storage.getShopifyConnection(campaignId),
        ]);
        const hubs = [
          { type: "hubspot", conn: hubspotConn },
          { type: "salesforce", conn: sfConn },
          { type: "shopify", conn: shopifyConn },
        ];
        for (const s of hubs) {
          const cfg = parseMappingConfig((s.conn as any)?.mappingConfig);
          if (!cfg) continue;
          const revenueClassification = String(cfg.revenueClassification || "");
          const lastTotalRevenue = parseNum(cfg.lastTotalRevenue);
          const offsite = revenueClassification === "offsite_not_in_ga4";
          revenueSources.push({
            type: s.type,
            connected: true,
            revenueClassification: revenueClassification || null,
            lastTotalRevenue: lastTotalRevenue || 0,
            offsite,
          });
          if (offsite && lastTotalRevenue > 0) offsiteRevenueTotal += lastTotalRevenue;
        }
      } catch {
        // ignore
      }

      const onsiteRevenue = parseNum(webAnalytics.revenue);
      const totalRevenueUnified = parseFloat((onsiteRevenue + offsiteRevenueTotal).toFixed(2));

      res.json({
        success: true,
        campaignId,
        dateRange,
        ga4: ga4Totals,
        webAnalytics,
        spend: {
          persistedSpend,
          unifiedSpend,
          spendSource,
          startDate,
          endDate,
          ...(spendTotals || {}),
        },
        platforms: {
          linkedin: linkedIn,
          meta,
          customIntegration: custom,
        },
        revenue: {
          onsiteRevenue,
          offsiteRevenue: parseFloat(offsiteRevenueTotal.toFixed(2)),
          totalRevenue: totalRevenueUnified,
        },
        revenueSources,
      });
    } catch (error: any) {
      console.error("[Outcome Totals] Error:", error);
      res.status(500).json({ success: false, error: error?.message || "Failed to compute outcome totals" });
    }
  });

  // New route: Get all GA4 connections for a campaign
  app.get("/api/campaigns/:id/ga4-connections", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const connections = await storage.getGA4Connections(campaignId);
      
      res.json({
        success: true,
        connections: connections.map(conn => ({
          id: conn.id,
          propertyId: conn.propertyId,
          propertyName: conn.propertyName,
          displayName: conn.displayName,
          websiteUrl: conn.websiteUrl,
          isPrimary: conn.isPrimary,
          isActive: conn.isActive,
          connectedAt: conn.connectedAt,
          method: conn.method
        }))
      });
    } catch (error) {
      console.error('Error fetching GA4 connections:', error);
      res.status(500).json({ error: 'Failed to fetch GA4 connections' });
    }
  });

  // New route: Set primary GA4 connection
  app.put("/api/campaigns/:id/ga4-connections/:connectionId/primary", async (req, res) => {
    try {
      const { id: campaignId, connectionId } = req.params;
      const success = await storage.setPrimaryGA4Connection(campaignId, connectionId);
      
      if (success) {
        res.json({ success: true, message: 'Primary connection updated' });
      } else {
        res.status(404).json({ error: 'Connection not found' });
      }
    } catch (error) {
      console.error('Error setting primary connection:', error);
      res.status(500).json({ error: 'Failed to set primary connection' });
    }
  });

  // New route: Delete GA4 connection
  app.delete("/api/ga4-connections/:connectionId", async (req, res) => {
    try {
      const { connectionId } = req.params;
      const success = await storage.deleteGA4Connection(connectionId);
      
      if (success) {
        res.json({ success: true, message: 'Connection deleted successfully' });
      } else {
        res.status(404).json({ error: 'Connection not found' });
      }
    } catch (error) {
      console.error('Error deleting connection:', error);
      res.status(500).json({ error: 'Failed to delete connection' });
    }
  });

  // Select GA4 property for campaign
  app.post("/api/ga4/select-property", async (req, res) => {
    try {
      const { campaignId, propertyId } = req.body;
      
      console.log('Property selection request:', { campaignId, propertyId });
      
      if (!campaignId || !propertyId) {
        return res.status(400).json({ error: 'Campaign ID and Property ID are required' });
      }
      
      const connections = (global as any).oauthConnections;
      console.log('Available connections:', {
        hasGlobalConnections: !!connections,
        connectionKeys: connections ? Array.from(connections.keys()) : [],
        hasThisCampaign: connections ? connections.has(campaignId) : false
      });
      
      if (!connections || !connections.has(campaignId)) {
        return res.status(404).json({ error: 'No OAuth connection found for this campaign' });
      }
      
      const connection = connections.get(campaignId);
      
      connection.selectedPropertyId = propertyId;
      connection.selectedProperty = connection.properties?.find((p: any) => p.id === propertyId);
      
      // CRITICAL: Update the database connection with the selected property ID
      const propertyName = connection.selectedProperty?.name || `Property ${propertyId}`;
      await storage.updateGA4Connection(campaignId, {
        propertyId,
        propertyName
      });
      
      console.log('Updated database connection with property:', {
        campaignId,
        propertyId,
        propertyName
      });
      
      // Store in real GA4 connections for metrics access
      (global as any).realGA4Connections = (global as any).realGA4Connections || new Map();
      (global as any).realGA4Connections.set(campaignId, {
        propertyId,
        accessToken: connection.accessToken,
        refreshToken: connection.refreshToken,
        connectedAt: connection.connectedAt,
        isReal: true,
        propertyName
      });
      
      res.json({
        success: true,
        selectedProperty: connection.selectedProperty
      });
    } catch (error) {
      console.error('Property selection error:', error);
      res.status(500).json({ error: 'Failed to select property' });
    }
  });




  // Manual GA4 token connection for users
  app.post("/api/ga4/connect-token", async (req, res) => {
    try {
      // Add proper validation for the fields the frontend sends
      const frontendSchema = insertGA4ConnectionSchema.pick({
        campaignId: true,
        accessToken: true, 
        refreshToken: true,
        propertyId: true
      });
      const validatedData = frontendSchema.parse(req.body);
      const { campaignId, accessToken, refreshToken, propertyId } = validatedData;
      
      console.log('GA4 connect-token request (AFTER validation):', {
        campaignId,
        propertyId,
        accessTokenLength: accessToken ? accessToken.length : 0,
        accessTokenStart: accessToken ? accessToken.substring(0, 20) : 'NULL',
        hasRefreshToken: !!refreshToken,
        validatedDataKeys: Object.keys(validatedData)
      });
      
      if (!campaignId || !accessToken || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, access token, and property ID are required" 
        });
      }

      // Store the user's GA4 connection in database using validated data
      const connection = await storage.createGA4Connection({
        campaignId,
        propertyId,
        accessToken,
        refreshToken: refreshToken || null,
        method: 'access_token',
        propertyName: `GA4 Property ${propertyId}`,
        serviceAccountKey: null
      });
      
      console.log('GA4 connection created:', {
        id: connection.id,
        campaignId: connection.campaignId,
        accessTokenStored: !!connection.accessToken,
        accessTokenLength: connection.accessToken ? connection.accessToken.length : 0
      });

      res.json({
        success: true,
        method: 'access_token',
        propertyId,
        message: 'Successfully connected with access token'
      });
    } catch (error) {
      console.error('GA4 token connection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid GA4 connection data", 
          details: error.errors 
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to connect with access token'
      });
    }
  });

  // Service account GA4 connection for users
  app.post("/api/ga4/connect-service-account", async (req, res) => {
    try {
      // Add proper validation for the fields the frontend sends  
      const serviceAccountSchema = insertGA4ConnectionSchema.pick({
        campaignId: true,
        serviceAccountKey: true,
        propertyId: true
      });
      const validatedData = serviceAccountSchema.parse(req.body);
      const { campaignId, serviceAccountKey, propertyId } = validatedData;
      
      if (!campaignId || !serviceAccountKey || !propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Campaign ID, service account key, and property ID are required" 
        });
      }

      // Validate JSON format
      let parsedKey;
      try {
        parsedKey = JSON.parse(serviceAccountKey);
      } catch (e) {
        return res.status(400).json({
          success: false,
          error: "Invalid JSON format for service account key"
        });
      }

      // Store the user's GA4 service account connection in database
      await storage.createGA4Connection({
        campaignId,
        propertyId,
        accessToken: null,
        refreshToken: null,
        method: 'service_account',
        propertyName: `GA4 Property ${propertyId}`,
        serviceAccountKey: JSON.stringify(parsedKey)
      });

      res.json({
        success: true,
        method: 'service_account',
        propertyId,
        message: 'Successfully connected with service account'
      });
    } catch (error) {
      console.error('GA4 service account connection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          success: false, 
          error: "Invalid GA4 service account data", 
          details: error.errors 
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to connect with service account'
      });
    }
  });

  // OAuth code exchange endpoint for client-side OAuth
  app.post("/api/ga4/oauth-exchange", async (req, res) => {
    try {
      const { campaignId, authCode, clientId, clientSecret, redirectUri } = req.body;
      
      // Debug logging
      console.log('OAuth exchange request body:', {
        campaignId: !!campaignId,
        authCode: !!authCode,
        clientId: !!clientId,
        clientSecret: !!clientSecret,
        clientSecretLength: clientSecret?.length || 0,
        redirectUri: !!redirectUri
      });
      
      if (!campaignId || !authCode || !clientId || !clientSecret || !redirectUri) {
        console.log('Missing required fields:', {
          campaignId: !campaignId,
          authCode: !authCode,
          clientId: !clientId,
          clientSecret: !clientSecret,
          redirectUri: !redirectUri
        });
        return res.status(400).json({
          success: false,
          error: "Missing required fields: campaignId, authCode, clientId, clientSecret, redirectUri"
        });
      }

      // Exchange authorization code for tokens
      const tokenParams = {
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };
      
      console.log('Token exchange params:', {
        code: !!authCode,
        client_id: !!clientId,
        client_secret: !!clientSecret,
        client_secret_length: clientSecret.length,
        redirect_uri: !!redirectUri,
        grant_type: 'authorization_code'
      });

      // Create URLSearchParams and log exactly what's being sent
      const urlParams = new URLSearchParams(tokenParams);
      const requestBody = urlParams.toString();
      console.log('Request body being sent to Google:', requestBody);
      console.log('URLSearchParams entries:', Array.from(urlParams.entries()));
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: requestBody
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Token exchange failed:', errorData);
        return res.status(400).json({
          success: false,
          error: 'Failed to exchange authorization code for tokens'
        });
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token } = tokens;

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'No access token received from Google'
        });
      }

      // Get GA4 properties using the access token
      try {
        let properties = [];
        
        // Step 1: Get all accounts first
        console.log('Step 1: Fetching Google Analytics accounts...');
        const accountsResponse = await fetch('https://analyticsadmin.googleapis.com/v1alpha/accounts', {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (!accountsResponse.ok) {
          const errorText = await accountsResponse.text();
          console.error('Failed to fetch accounts:', accountsResponse.status, errorText);
          throw new Error(`Failed to fetch accounts: ${accountsResponse.status}`);
        }

        const accountsData = await accountsResponse.json();
        console.log('Accounts found:', {
          count: accountsData.accounts?.length || 0,
          accounts: accountsData.accounts?.map((a: any) => ({
            name: a.name,
            displayName: a.displayName
          })) || []
        });

        // Step 2: For each account, fetch properties using both v1alpha and v1beta
        for (const account of accountsData.accounts || []) {
          const accountId = account.name.split('/').pop();
          console.log(`\nStep 2: Fetching properties for account: ${account.name} (${account.displayName})`);
          console.log(`Account ID extracted: ${accountId}`);
          
          // Try v1beta first (more stable)
          const endpoints = [
            `https://analyticsadmin.googleapis.com/v1beta/properties?filter=parent:accounts/${accountId}`,
            `https://analyticsadmin.googleapis.com/v1alpha/properties?filter=parent:accounts/${accountId}`
          ];
          
          let success = false;
          for (let i = 0; i < endpoints.length; i++) {
            const endpoint = endpoints[i];
            try {
              console.log(`Trying endpoint ${i + 1}/${endpoints.length}: ${endpoint}`);
              const propertiesResponse = await fetch(endpoint, {
                headers: { 'Authorization': `Bearer ${access_token}` }
              });
              
              console.log(`Response status: ${propertiesResponse.status}`);
              
              if (propertiesResponse.ok) {
                const propertiesData = await propertiesResponse.json();
                console.log(`Success! Properties data:`, {
                  propertiesCount: propertiesData.properties?.length || 0,
                  properties: propertiesData.properties?.map((p: any) => ({
                    name: p.name,
                    displayName: p.displayName
                  })) || []
                });
                
                for (const property of propertiesData.properties || []) {
                  properties.push({
                    id: property.name.split('/').pop(),
                    name: property.displayName || `Property ${property.name.split('/').pop()}`,
                    account: account.displayName
                  });
                }
                success = true;
                break; // Successfully got properties, stop trying other endpoints
              } else {
                const errorText = await propertiesResponse.text();
                console.error(`Failed with status ${propertiesResponse.status}:`, errorText);
              }
            } catch (error) {
              console.error(`Error with endpoint ${endpoint}:`, error);
            }
          }
          
          if (!success) {
            console.warn(`Could not fetch properties for account ${account.name} using any endpoint`);
          }
        }
        
        console.log('\nStep 3: Final results:');
        console.log('Total properties found:', properties.length);
        console.log('Properties summary:', properties.map(p => ({
          id: p.id,
          name: p.name,
          account: p.account
        })));

        // Create GA4 connection with tokens and OAuth credentials (no property selected yet)
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
        await storage.createGA4Connection({
          campaignId,
          accessToken: access_token,
          refreshToken: refresh_token || null,
          propertyId: '', // Will be set when user selects property
          method: 'access_token',
          propertyName: 'OAuth Connection',
          clientId: clientId, // Store client credentials for automatic refresh
          clientSecret: clientSecret,
          expiresAt: expiresAt
        });

        // CRITICAL: Also store in global oauthConnections for property selection
        (global as any).oauthConnections = (global as any).oauthConnections || new Map();
        (global as any).oauthConnections.set(campaignId, {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000),
          properties,
          connectedAt: new Date().toISOString()
        });
        
        console.log('OAuth connection stored for campaignId:', campaignId);
        console.log('Total connections after storage:', (global as any).oauthConnections.size);
        console.log('All connection keys:', Array.from((global as any).oauthConnections.keys()));

        res.json({
          success: true,
          properties,
          message: 'OAuth authentication successful'
        });

      } catch (error) {
        console.error('Failed to fetch GA4 properties:', error);
        res.json({
          success: true,
          properties: [],
          message: 'OAuth successful, but failed to fetch properties. You can enter Property ID manually.'
        });
      }

    } catch (error) {
      console.error('OAuth exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during OAuth exchange'
      });
    }
  });

  // Google Sheets OAuth endpoints
  
  // OAuth code exchange for Google Sheets
  app.post("/api/google-sheets/oauth-exchange", async (req, res) => {
    try {
      const { campaignId, authCode, clientId, clientSecret, redirectUri } = req.body;
      
      if (!campaignId || !authCode || !clientId || !clientSecret || !redirectUri) {
        return res.status(400).json({
          success: false,
          error: "Missing required fields: campaignId, authCode, clientId, clientSecret, redirectUri"
        });
      }

      // Exchange authorization code for tokens
      const tokenParams = {
        code: authCode,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      };
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(tokenParams)
      });

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.text();
        console.error('Google Sheets token exchange failed:', errorData);
        return res.status(400).json({
          success: false,
          error: 'Failed to exchange authorization code for tokens'
        });
      }

      const tokens = await tokenResponse.json();
      const { access_token, refresh_token } = tokens;

      if (!access_token) {
        return res.status(400).json({
          success: false,
          error: 'No access token received from Google'
        });
      }

      // Get available spreadsheets using the access token
      try {
        let spreadsheets = [];
        
        console.log('Fetching Google Sheets files...');
        const filesResponse = await fetch('https://www.googleapis.com/drive/v3/files?q=mimeType="application/vnd.google-apps.spreadsheet"&fields=files(id,name,webViewLink)', {
          headers: { 'Authorization': `Bearer ${access_token}` }
        });

        if (filesResponse.ok) {
          const filesData = await filesResponse.json();
          console.log('Google Sheets found:', {
            count: filesData.files?.length || 0,
            files: filesData.files?.map((f: any) => ({ id: f.id, name: f.name })) || []
          });
          
          for (const file of filesData.files || []) {
            spreadsheets.push({
              id: file.id,
              name: file.name || `Spreadsheet ${file.id}`,
              url: file.webViewLink || ''
            });
          }
        } else {
          const errorText = await filesResponse.text();
          console.error('Failed to fetch spreadsheets:', filesResponse.status, errorText);
          
          // If it's a 403 error, likely means Google Drive API is not enabled
          if (filesResponse.status === 403) {
            return res.status(400).json({
              success: false,
              error: 'Google Drive API access denied. Please enable BOTH the Google Drive API and Google Sheets API in your Google Cloud Console project, or provide a specific spreadsheet ID manually.',
              errorCode: 'DRIVE_API_DISABLED',
              requiresManualEntry: true
            });
          }
          
          // For other errors, also return error response
          return res.status(400).json({
            success: false,
            error: `Failed to fetch spreadsheets: ${filesResponse.status}`,
            errorCode: 'API_ERROR'
          });
        }

        // Store OAuth connection temporarily (no spreadsheet selected yet)
        const expiresAt = new Date(Date.now() + (tokens.expires_in * 1000));
        await storage.createGoogleSheetsConnection({
          campaignId,
          spreadsheetId: 'pending', // Will be set when user selects spreadsheet
          accessToken: access_token,
          refreshToken: refresh_token || null,
          clientId: clientId,
          clientSecret: clientSecret,
          expiresAt: expiresAt
        });

        // Store in global connections for spreadsheet selection
        (global as any).googleSheetsConnections = (global as any).googleSheetsConnections || new Map();
        (global as any).googleSheetsConnections.set(campaignId, {
          accessToken: access_token,
          refreshToken: refresh_token,
          expiresAt: Date.now() + (tokens.expires_in * 1000),
          spreadsheets,
          connectedAt: new Date().toISOString()
        });

        console.log('Google Sheets OAuth connection stored for campaignId:', campaignId);

        res.json({
          success: true,
          spreadsheets,
          message: 'Google Sheets OAuth authentication successful'
        });

      } catch (error) {
        console.error('Failed to fetch Google Sheets:', error);
        res.json({
          success: true,
          spreadsheets: [],
          message: 'OAuth successful, but failed to fetch spreadsheets. You can enter Spreadsheet ID manually.'
        });
      }

    } catch (error) {
      console.error('Google Sheets OAuth exchange error:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during OAuth exchange'
      });
    }
  });

  // Get available sheets/tabs from a spreadsheet
  app.get("/api/google-sheets/:spreadsheetId/sheets", async (req, res) => {
    try {
      const { spreadsheetId } = req.params;
      const { campaignId } = req.query;
      
      if (!campaignId) {
        return res.status(400).json({ error: 'campaignId is required' });
      }
      
      // Get connection to access token
      const connection = await storage.getGoogleSheetsConnection(campaignId as string);
      if (!connection || !connection.accessToken) {
        return res.status(404).json({ error: 'No Google Sheets connection found for this campaign' });
      }

      // Refresh token if needed
      let accessToken = connection.accessToken;
      if (connection.refreshToken && connection.clientId && connection.clientSecret) {
        const shouldRefresh = connection.expiresAt && new Date(connection.expiresAt).getTime() < Date.now() + (5 * 60 * 1000);
        if (shouldRefresh) {
          accessToken = await refreshGoogleSheetsToken(connection);
        }
      }

      // Fetch spreadsheet metadata to get sheet names
      const metadataResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );

      if (!metadataResponse.ok) {
        const errorText = await metadataResponse.text();
        throw new Error(`Failed to fetch spreadsheet metadata: ${errorText}`);
      }

      const metadata = await metadataResponse.json();
      const sheets = (metadata.sheets || []).map((sheet: any) => ({
        sheetId: sheet.properties.sheetId,
        title: sheet.properties.title,
        index: sheet.properties.index,
        sheetType: sheet.properties.sheetType,
        gridProperties: sheet.properties.gridProperties
      }));

      res.json({
        success: true,
        sheets: sheets
      });
    } catch (error: any) {
      console.error('Error fetching sheets:', error);
      res.status(500).json({ 
        error: 'Failed to fetch sheets',
        message: error.message 
      });
    }
  });

  // Select specific spreadsheet and sheet/tab
  app.post("/api/google-sheets/select-spreadsheet", async (req, res) => {
    try {
      const { campaignId, spreadsheetId, sheetName } = req.body;
      
      console.log('Spreadsheet selection request:', { campaignId, spreadsheetId, sheetName });
      
      // First, try to find connection in database (more reliable than global map)
      let dbConnection = await storage.getGoogleSheetsConnection(campaignId, 'pending');
      
      if (!dbConnection) {
        // Check if there's any connection for this campaign
        const existingConnections = await storage.getGoogleSheetsConnections(campaignId);
        if (existingConnections.length > 0) {
          // Use the first connection
          dbConnection = existingConnections[0];
        } else {
          // Try global map as fallback (for in-memory storage or if DB lookup failed)
          const connections = (global as any).googleSheetsConnections;
          if (connections && connections.has(campaignId)) {
            const connection = connections.get(campaignId);
            // Create a new DB connection from global map data
            if (connection.accessToken) {
              try {
                dbConnection = await storage.createGoogleSheetsConnection({
                  campaignId,
                  spreadsheetId: 'pending',
                  accessToken: connection.accessToken,
                  refreshToken: connection.refreshToken || null,
                  clientId: process.env.GOOGLE_CLIENT_ID || '',
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                  expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined,
                });
                console.log('[Select Spreadsheet] Created DB connection from global map');
              } catch (createError: any) {
                console.error('[Select Spreadsheet] Failed to create connection from global map:', createError);
                return res.status(404).json({ error: 'No Google Sheets connection found. Please reconnect Google Sheets.' });
              }
        } else {
          return res.status(404).json({ error: 'No Google Sheets connection found. Please connect Google Sheets first.' });
            }
          } else {
            return res.status(404).json({ error: 'No Google Sheets connection found. Please connect Google Sheets first.' });
          }
        }
      }

      // Get spreadsheet name - try to fetch from Google API if we have access token
      let spreadsheetName = `Spreadsheet ${spreadsheetId}`;
      if (dbConnection.accessToken) {
        try {
          const metadataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
            { headers: { 'Authorization': `Bearer ${dbConnection.accessToken}` } }
          );
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            spreadsheetName = metadata.properties?.title || spreadsheetName;
          }
        } catch (fetchError) {
          console.log('[Select Spreadsheet] Could not fetch spreadsheet name, using default');
        }
      }
      
      // Update the database connection with the selected spreadsheet and sheet
      // Note: sheetName will be ignored if column doesn't exist (handled in storage layer)
      const updateData: any = {
        spreadsheetId,
        spreadsheetName
      };
      // Only include sheetName if provided (will be ignored if column doesn't exist)
      if (sheetName) {
        updateData.sheetName = sheetName;
      }
      await storage.updateGoogleSheetsConnection(dbConnection.id, updateData);
      
      console.log('Updated database connection with spreadsheet:', {
        campaignId,
        spreadsheetId,
        spreadsheetName,
        sheetName: sheetName || 'first sheet (default)',
        connectionId: dbConnection.id
      });
      
      res.json({
        success: true,
        connectionId: dbConnection.id,
        selectedSpreadsheet: {
          id: spreadsheetId,
          name: spreadsheetName
        },
        sheetName: sheetName || null
      });
    } catch (error: any) {
      console.error('Spreadsheet selection error:', error);
      res.status(500).json({ error: error.message || 'Failed to select spreadsheet' });
    }
  });

  // Select multiple spreadsheet sheets/tabs in one call
  app.post("/api/google-sheets/select-spreadsheet-multiple", async (req, res) => {
    try {
      const { campaignId, spreadsheetId, sheetNames, selectionMode } = req.body;
      const mode: 'replace' | 'append' = (selectionMode === 'append' || selectionMode === 'replace') ? selectionMode : 'replace';
      
      console.log('Multiple spreadsheet selection request:', { campaignId, spreadsheetId, sheetNames, selectionMode: mode });
      
      if (!Array.isArray(sheetNames) || sheetNames.length === 0) {
        return res.status(400).json({ error: 'Sheet names array is required and must not be empty' });
      }

      // Enforce max connections per campaign server-side (prevents runaway counts like 48/10)
      const MAX_GOOGLE_SHEETS_CONNECTIONS = 10;
      // Exclude placeholder 'pending' connections from the limit count.
      const existingConnectionsForLimit = (await storage.getGoogleSheetsConnections(campaignId))
        .filter((c: any) => c && c.spreadsheetId && c.spreadsheetId !== 'pending');
      const existingCount = existingConnectionsForLimit.length;
      if (existingCount >= MAX_GOOGLE_SHEETS_CONNECTIONS) {
        return res.status(400).json({
          error: `Maximum of ${MAX_GOOGLE_SHEETS_CONNECTIONS} Google Sheets connections reached for this campaign. Please remove unused connections first.`,
          maxConnections: MAX_GOOGLE_SHEETS_CONNECTIONS,
          existingConnections: existingCount
        });
      }

      const normalizedSheetNames = sheetNames
        .filter((s: any) => typeof s === 'string' && s.trim().length > 0)
        .map((s: string) => s.trim());

      const availableSlots = Math.max(0, MAX_GOOGLE_SHEETS_CONNECTIONS - existingCount);
      // We'll always reuse/update existing connections for selected tabs.
      // The limit applies only to *new* tabs that aren't already connected.
      const existingForSpreadsheet = existingConnectionsForLimit
        .filter((c: any) => c.spreadsheetId === spreadsheetId);
      const existingBySheet = new Map<string, any>();
      for (const c of existingForSpreadsheet) {
        const key = String((c.sheetName || '').trim());
        if (!existingBySheet.has(key)) existingBySheet.set(key, c);
      }
      const newSheetsNeeded = normalizedSheetNames.filter((s) => !existingBySheet.has(String((s || '').trim())));
      const sheetsToCreate = newSheetsNeeded.slice(0, availableSlots);
      // These are the tabs we will actually connect (existing + newly created within slot limit).
      const connectedSheetNames = normalizedSheetNames.filter((s) => {
        const key = String((s || '').trim());
        return existingBySheet.has(key) || sheetsToCreate.includes(s);
      });
      if (connectedSheetNames.length === 0) {
        return res.status(400).json({
          error: `No available slots to add new Google Sheets connections (max ${MAX_GOOGLE_SHEETS_CONNECTIONS}).`,
          maxConnections: MAX_GOOGLE_SHEETS_CONNECTIONS,
          existingConnections: existingCount
        });
      }
      
      // First, try to find connection in database (more reliable than global map)
      let dbConnection = await storage.getGoogleSheetsConnection(campaignId, 'pending');
      
      if (!dbConnection) {
        // Check if there's any connection for this campaign
        const existingConnections = await storage.getGoogleSheetsConnections(campaignId);
        if (existingConnections.length > 0) {
          // Use the first connection
          dbConnection = existingConnections[0];
        } else {
          // Try global map as fallback (for in-memory storage or if DB lookup failed)
          const connections = (global as any).googleSheetsConnections;
          if (connections && connections.has(campaignId)) {
            const connection = connections.get(campaignId);
            // Create a new DB connection from global map data
            if (connection.accessToken) {
              try {
                dbConnection = await storage.createGoogleSheetsConnection({
                  campaignId,
                  spreadsheetId: 'pending',
                  accessToken: connection.accessToken,
                  refreshToken: connection.refreshToken || null,
                  clientId: process.env.GOOGLE_CLIENT_ID || '',
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
                  expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined,
                });
                console.log('[Select Multiple Spreadsheets] Created DB connection from global map');
              } catch (createError: any) {
                console.error('[Select Multiple Spreadsheets] Failed to create connection from global map:', createError);
                return res.status(404).json({ error: 'No Google Sheets connection found. Please reconnect Google Sheets.' });
              }
            } else {
              return res.status(404).json({ error: 'No Google Sheets connection found. Please connect Google Sheets first.' });
            }
          } else {
            return res.status(404).json({ error: 'No Google Sheets connection found. Please connect Google Sheets first.' });
          }
        }
      }

      // Get spreadsheet name - try to fetch from Google API if we have access token
      let spreadsheetName = `Spreadsheet ${spreadsheetId}`;
      let spreadsheetTabTitles: string[] | null = null;
      if (dbConnection.accessToken) {
        try {
          const metadataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
            { headers: { 'Authorization': `Bearer ${dbConnection.accessToken}` } }
          );
          if (metadataResponse.ok) {
            const metadata = await metadataResponse.json();
            spreadsheetName = metadata.properties?.title || spreadsheetName;
            spreadsheetTabTitles = Array.isArray(metadata?.sheets)
              ? metadata.sheets.map((s: any) => s?.properties?.title).filter(Boolean)
              : null;
          }
        } catch (fetchError) {
          console.log('[Select Multiple Spreadsheets] Could not fetch spreadsheet name, using default');
        }
      }
      
      // Guardrail: only allow sheetNames that actually exist in the spreadsheet.
      // This prevents mismatches where a stale client selection (or bad payload) connects unexpected tabs.
      if (spreadsheetTabTitles && spreadsheetTabTitles.length > 0) {
        const titleSet = new Set(spreadsheetTabTitles.map((t) => String(t).trim()));
        const invalid = normalizedSheetNames.filter((s) => !titleSet.has(String((s || '').trim())));
        if (invalid.length > 0) {
          return res.status(400).json({
            error: 'One or more selected tabs were not found in the spreadsheet',
            invalidTabs: invalid,
          });
        }
      }
      
      // Create/update connections for each sheet (idempotent: do not create duplicates)
      const connectionIds: string[] = [];
      const isFirstConnection = dbConnection.spreadsheetId === 'pending';
      let pendingConsumed = false;
      
      console.log(`[Select Multiple Spreadsheets] 📋 Creating connections for ${connectedSheetNames.length} sheet(s)`);
      console.log(`[Select Multiple Spreadsheets] Sheet names:`, connectedSheetNames);
      console.log(`[Select Multiple Spreadsheets] Is first connection:`, isFirstConnection);
      
      for (let i = 0; i < connectedSheetNames.length; i++) {
        const sheetName = connectedSheetNames[i];
        const sheetKey = String((sheetName || '').trim());
        
        console.log(`[Select Multiple Spreadsheets] Processing sheet ${i + 1}/${sheetNames.length}: "${sheetName}"`);
        
        const existing = existingBySheet.get(sheetKey);
        if (existing?.id) {
          // Refresh tokens/metadata on the existing connection (best-effort)
          try {
            await storage.updateGoogleSheetsConnection(existing.id, {
            spreadsheetId,
              spreadsheetName,
              sheetName,
              accessToken: dbConnection.accessToken,
              refreshToken: dbConnection.refreshToken || null,
              clientId: dbConnection.clientId,
              clientSecret: dbConnection.clientSecret,
              expiresAt: dbConnection.expiresAt,
              isActive: true as any,
            } as any);
          } catch {
            // ignore
          }
          connectionIds.push(existing.id);
          continue;
        }

        // New tab connection
        if (i === 0 && isFirstConnection && !pendingConsumed && dbConnection.id && dbConnection.spreadsheetId === 'pending') {
          // IMPORTANT: ensure this "pending" row becomes an active, real connection.
          // If `sheetName` fails to persist (older schema), downstream logic must not deactivate it.
          await storage.updateGoogleSheetsConnection(dbConnection.id, { spreadsheetId, spreadsheetName, sheetName, isActive: true as any } as any);
          connectionIds.push(dbConnection.id);
          pendingConsumed = true;
          existingBySheet.set(sheetKey, { ...dbConnection, id: dbConnection.id, spreadsheetId, spreadsheetName, sheetName });
          console.log(`[Select Multiple Spreadsheets] ✅ Updated pending connection ${dbConnection.id} with sheet: ${sheetName}`);
          continue;
        }

          console.log(`[Select Multiple Spreadsheets] 🆕 Creating NEW connection for sheet: ${sheetName}`);
          try {
            const newConnection = await storage.createGoogleSheetsConnection({
              campaignId,
              spreadsheetId,
              spreadsheetName,
              sheetName: sheetName || null,
              accessToken: dbConnection.accessToken,
              refreshToken: dbConnection.refreshToken || null,
              clientId: dbConnection.clientId,
              clientSecret: dbConnection.clientSecret,
              expiresAt: dbConnection.expiresAt,
            });
            connectionIds.push(newConnection.id);
          existingBySheet.set(sheetKey, newConnection);
            console.log(`[Select Multiple Spreadsheets] ✅ Created new connection ${newConnection.id} for sheet: ${sheetName || 'default'}`);
          } catch (error: any) {
            console.error(`[Select Multiple Spreadsheets] ❌ Failed to create connection for sheet ${sheetName}:`, error.message);
            console.error(`[Select Multiple Spreadsheets] Error stack:`, error.stack);
            // Continue with other sheets even if one fails
          }
        }

      // If a pending row wasn't consumed, delete it to avoid clutter/limits.
      if (dbConnection?.spreadsheetId === 'pending' && dbConnection?.id && !pendingConsumed && connectionIds.length > 0) {
        try {
          await storage.deleteGoogleSheetsConnection(dbConnection.id);
        } catch {
          // ignore
        }
      }

      // Treat the user's selected tabs as authoritative for this campaign+spreadsheet (replace mode).
      // In append mode (view-only connects), we keep existing tabs active and only add the newly selected ones.
      //
      // NOTE: We intentionally do NOT rely on `sheetName` for this deactivation check.
      // Some environments may not persist `sheetName` (older schema / failed migrations), which would otherwise cause
      // the just-created connections to be immediately deactivated (cards appear, then disappear).
      if (mode === 'replace') try {
        const keepIds = new Set(connectionIds.map((id) => String(id)));
        const allActiveForSpreadsheet = (await storage.getGoogleSheetsConnections(campaignId))
          .filter((c: any) => c && c.isActive)
          .filter((c: any) => c.spreadsheetId === spreadsheetId)
          .filter((c: any) => c.spreadsheetId && c.spreadsheetId !== 'pending');

        for (const c of allActiveForSpreadsheet) {
          const shouldKeep = keepIds.has(String(c.id));

          // If it's not one of the connections we just selected/returned, deactivate it.
          // This removes unrelated tabs like ROI_ROAS_Calculations when the user only selected Revenue_Closed_Won + LI_API_Campaign_Daily.
          if (!shouldKeep) {
            try {
              await storage.updateGoogleSheetsConnection(String(c.id), {
                isActive: false as any,
                columnMappings: null as any,
              } as any);
            } catch {
              // ignore
            }
          }
        }
      } catch {
        // best-effort cleanup; ignore failures
      }
      
      console.log(`[Select Multiple Spreadsheets] 🎯 Final connectionIds:`, connectionIds);
      
      console.log('Created/updated multiple database connections:', {
        campaignId,
        spreadsheetId,
        spreadsheetName,
        sheets: connectedSheetNames,
        connectionIds
      });
      
      res.json({
        success: true,
        connectionIds,
        selectedSpreadsheet: {
          id: spreadsheetId,
          name: spreadsheetName
        },
        sheetsConnected: connectedSheetNames.length,
        // Echo back the exact tab names we connected so the UI can scope detection/mapping reliably
        sheetNames: connectedSheetNames
      });
    } catch (error: any) {
      console.error('Multiple spreadsheet selection error:', error);
      res.status(500).json({ error: error.message || 'Failed to select spreadsheets' });
    }
  });

  // Check Google Sheets connection status
  // List all Google Sheets connections for a campaign
  app.get("/api/campaigns/:id/google-sheets-connections", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const connections = await storage.getGoogleSheetsConnections(campaignId);

      // If sheetName isn't persisted in the DB (older schema / failed migrations), the UI falls back to "Tab 1/2/3...".
      // For better UX and troubleshooting, attempt to enrich missing sheetName values from Google Sheets metadata.
      const bySpreadsheetId = new Map<string, any[]>();
      for (const conn of connections as any[]) {
        const key = String(conn.spreadsheetId || '');
        if (!bySpreadsheetId.has(key)) bySpreadsheetId.set(key, []);
        bySpreadsheetId.get(key)!.push(conn);
      }

      const spreadsheetTabTitles = new Map<string, string[]>();
      for (const [spreadsheetId, conns] of bySpreadsheetId.entries()) {
        if (!spreadsheetId) continue;
        const hasMissingSheetName = conns.some((c: any) => !(c as any).sheetName);
        if (!hasMissingSheetName) continue;

        const baseConn = conns.find((c: any) => c.accessToken) || conns[0];
        if (!baseConn?.accessToken) continue;

        const fetchTitles = async (accessToken: string): Promise<string[] | null> => {
          const metaResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (!metaResp.ok) return null;
          const meta = await metaResp.json().catch(() => ({}));
          const titles = Array.isArray(meta?.sheets)
            ? meta.sheets.map((s: any) => s?.properties?.title).filter(Boolean)
            : [];
          return titles;
        };

        let titles: string[] | null = await fetchTitles(baseConn.accessToken);
        // If token is expired, try a refresh (best-effort) and retry once.
        if ((!titles || titles.length === 0) && baseConn.refreshToken) {
          try {
            const refreshed = await refreshGoogleSheetsToken(baseConn);
            if (refreshed) {
              titles = await fetchTitles(refreshed);
            }
          } catch {
            // ignore - keep fallback labels
          }
        }

        if (titles && titles.length > 0) {
          spreadsheetTabTitles.set(spreadsheetId, titles);
        }
      }
      
      res.json({
        success: true,
        connections: connections.map(conn => {
          // Derive a stable "tab order index" within a spreadsheet group (based on server response order).
          const group = bySpreadsheetId.get(String(conn.spreadsheetId || '')) || [];
          const tabIndex = group.findIndex((c: any) => c.id === (conn as any).id);
          const titles = spreadsheetTabTitles.get(String(conn.spreadsheetId || ''));
          const derivedSheetName =
            (conn as any).sheetName ||
            (titles && tabIndex >= 0 && tabIndex < titles.length ? titles[tabIndex] : null);

          return ({
          id: conn.id,
          spreadsheetId: conn.spreadsheetId,
          spreadsheetName: conn.spreadsheetName,
            sheetName: derivedSheetName,
          isPrimary: conn.isPrimary,
          isActive: conn.isActive,
          columnMappings: conn.columnMappings,
          connectedAt: conn.connectedAt
          });
        })
      });
    } catch (error: any) {
      console.error('List connections error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ 
        error: error.message || 'Failed to list connections',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  /**
   * Connected Data Sources (LinkedIn tab)
   * - Unifies sources (Google Sheets now; CRMs later) into a consistent shape for the UI.
   */
  app.get("/api/campaigns/:id/connected-data-sources", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const campaign = await storage.getCampaign(campaignId);

      const googleSheetsConnectionsRaw = await storage.getGoogleSheetsConnections(campaignId);
      // Clean + streamlined behavior:
      // - Never show placeholder/half-created connections (spreadsheetId='pending') in the UI.
      // - Best-effort cleanup: delete old pending placeholders so they don't linger forever.
      // - Prefer showing active connections; only show inactive if there are *zero* active sources (recovery aid for legacy campaigns).
      const allGoogleSheetsConnections = (googleSheetsConnectionsRaw || []).filter((c: any) => c);
      const pendingGoogleSheetsConnections = allGoogleSheetsConnections.filter((c: any) => c.spreadsheetId === 'pending');
      const nonPendingConnections = allGoogleSheetsConnections.filter((c: any) => c.spreadsheetId && c.spreadsheetId !== 'pending');

      // Cleanup pending placeholders if they're stale OR if there is at least one real (non-pending) connection.
      // This avoids breaking an in-progress connection flow (recent pending row), while keeping the system clean.
      const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes
      const now = Date.now();
      const shouldCleanupPending =
        nonPendingConnections.length > 0 ||
        pendingGoogleSheetsConnections.some((c: any) => {
          try {
            const t = c?.connectedAt ? new Date(c.connectedAt).getTime() : 0;
            return t > 0 && (now - t) > PENDING_TTL_MS;
          } catch {
            return true;
          }
        });
      if (pendingGoogleSheetsConnections.length > 0 && shouldCleanupPending) {
        await Promise.allSettled(
          pendingGoogleSheetsConnections
            .map((c: any) => String(c?.id || ''))
            .filter(Boolean)
            .map((id: string) => storage.deleteGoogleSheetsConnection(id))
        );
      }

      const activeConnections = nonPendingConnections.filter((c: any) => !!c.isActive);
      const inactiveConnections = nonPendingConnections.filter((c: any) => !c.isActive);
      const googleSheetsConnections = activeConnections.length > 0 ? activeConnections : inactiveConnections;

      // Enrich missing sheetName values (same approach as /google-sheets-connections).
      const bySpreadsheetId = new Map<string, any[]>();
      for (const conn of googleSheetsConnections as any[]) {
        const key = String(conn.spreadsheetId || '');
        if (!bySpreadsheetId.has(key)) bySpreadsheetId.set(key, []);
        bySpreadsheetId.get(key)!.push(conn);
      }

      const spreadsheetTabTitles = new Map<string, string[]>();
      for (const [spreadsheetId, conns] of bySpreadsheetId.entries()) {
        if (!spreadsheetId) continue;
        const hasMissingSheetName = conns.some((c: any) => !(c as any).sheetName);
        if (!hasMissingSheetName) continue;

        const baseConn = conns.find((c: any) => c.accessToken) || conns[0];
        if (!baseConn?.accessToken) continue;

        const fetchTitles = async (accessToken: string): Promise<string[] | null> => {
          const metaResp = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } }
          );
          if (!metaResp.ok) return null;
          const meta = await metaResp.json().catch(() => ({}));
          const titles = Array.isArray(meta?.sheets)
            ? meta.sheets.map((s: any) => s?.properties?.title).filter(Boolean)
            : [];
          return titles;
        };

        let titles: string[] | null = await fetchTitles(baseConn.accessToken);
        if ((!titles || titles.length === 0) && baseConn.refreshToken) {
          try {
            const refreshed = await refreshGoogleSheetsToken(baseConn);
            if (refreshed) titles = await fetchTitles(refreshed);
          } catch {
            // ignore
          }
        }
        if (titles && titles.length > 0) spreadsheetTabTitles.set(spreadsheetId, titles);
      }

      const googleSheetsSourcesAll = (googleSheetsConnections || [])
        .map((conn: any) => {
          let hasMappings = false;
          let usedForRevenueTracking = false;
          try {
            const mappingsRaw = conn.columnMappings || conn.column_mappings;
            const mappings = mappingsRaw ? (typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw) : [];
            hasMappings = Array.isArray(mappings) && mappings.length > 0;
            if (hasMappings) {
              const hasIdentifier =
                mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
                mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
              const hasValueSource =
                mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
                mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
              usedForRevenueTracking = hasIdentifier && hasValueSource;
            }
          } catch {
            hasMappings = false;
            usedForRevenueTracking = false;
          }

          const group = bySpreadsheetId.get(String(conn.spreadsheetId || '')) || [];
          const tabIndex = group.findIndex((c: any) => c.id === (conn as any).id);
          const titles = spreadsheetTabTitles.get(String(conn.spreadsheetId || ''));
          const derivedSheetName =
            (conn as any).sheetName ||
            (titles && tabIndex >= 0 && tabIndex < titles.length ? titles[tabIndex] : null);

          const isActive = !!conn.isActive;
          return {
            id: conn.id,
            type: 'google_sheets',
            provider: 'Google Sheets',
            displayName: derivedSheetName
              ? `${derivedSheetName} — ${conn.spreadsheetName || conn.spreadsheetId}`
              : (conn.spreadsheetName || conn.spreadsheetId),
            spreadsheetId: conn.spreadsheetId,
            spreadsheetName: conn.spreadsheetName,
            sheetName: derivedSheetName,
            status: isActive ? 'connected' : 'inactive',
            isActive,
            connectedAt: conn.connectedAt,
            hasMappings,
            usedForRevenueTracking,
            campaignName: campaign?.name || null,
          };
        });

      // Defensive de-dupe: keep one source per (spreadsheetId, sheetName) key.
      // We include both mapped and unmapped sources so this can act as an "all connected sources" hub.
      const dedupedByKey = new Map<string, any>();
      for (const s of googleSheetsSourcesAll) {
        const key = `${String(s.spreadsheetId || '')}::${String(s.sheetName || '')}`;
        const existing = dedupedByKey.get(key);
        if (!existing) {
          dedupedByKey.set(key, s);
          continue;
        }
        // Prefer the most recently connected one.
        const existingTime = existing?.connectedAt ? new Date(existing.connectedAt).getTime() : 0;
        const nextTime = s?.connectedAt ? new Date(s.connectedAt).getTime() : 0;
        if (nextTime >= existingTime) dedupedByKey.set(key, s);
      }
      const googleSheetsSources = Array.from(dedupedByKey.values());

      // HubSpot sources
      const hubspotConnectionsRaw: any[] = await storage.getHubspotConnections(campaignId) as any;
      const hubspotConnectionsAll = (hubspotConnectionsRaw || []).filter(Boolean);
      const hubspotActive = hubspotConnectionsAll.filter((c: any) => !!c.isActive);
      const hubspotInactive = hubspotConnectionsAll.filter((c: any) => !c.isActive);
      const hubspotConnections = hubspotActive.length > 0 ? hubspotActive : hubspotInactive;

      const hubspotSources = (hubspotConnections || []).map((conn: any) => {
        let hasMappings = false;
        let usedForRevenueTracking = false;
        try {
          const cfgRaw = conn.mappingConfig;
          const cfg = cfgRaw ? (typeof cfgRaw === 'string' ? JSON.parse(cfgRaw) : cfgRaw) : null;
          hasMappings = !!cfg && typeof cfg === 'object';
          usedForRevenueTracking =
            !!cfg &&
            !!cfg.campaignProperty &&
            Array.isArray(cfg.selectedValues) &&
            cfg.selectedValues.length > 0 &&
            !!cfg.revenueProperty;
        } catch {
          hasMappings = false;
          usedForRevenueTracking = false;
        }

        const isActive = !!conn.isActive;
        // Prefer account name for display; do not show raw numeric IDs in the UI.
        // If we don't have an account name yet, show just "HubSpot" (avoid "HubSpot — HubSpot").
        const portalLabel = conn.portalName ? String(conn.portalName) : null;
        return {
          id: conn.id,
          type: 'hubspot',
          provider: 'HubSpot',
          displayName: portalLabel ? `HubSpot — ${portalLabel}` : 'HubSpot',
          status: isActive ? 'connected' : 'inactive',
          isActive,
          connectedAt: conn.connectedAt,
          hasMappings,
          usedForRevenueTracking,
          campaignName: campaign?.name || null,
          portalId: conn.portalId || null,
          portalName: conn.portalName || null,
        };
      });

      // Salesforce sources
      const salesforceConnectionsRaw: any[] = await storage.getSalesforceConnections(campaignId) as any;
      const salesforceConnectionsAll = (salesforceConnectionsRaw || []).filter(Boolean);
      const salesforceActive = salesforceConnectionsAll.filter((c: any) => !!c.isActive);
      const salesforceInactive = salesforceConnectionsAll.filter((c: any) => !c.isActive);
      const salesforceConnections = salesforceActive.length > 0 ? salesforceActive : salesforceInactive;

      const salesforceSources = (salesforceConnections || []).map((conn: any) => {
        let hasMappings = false;
        let usedForRevenueTracking = false;
        let mappingSummary: any = null;
        try {
          const cfgRaw = conn.mappingConfig;
          const cfg = cfgRaw ? (typeof cfgRaw === 'string' ? JSON.parse(cfgRaw) : cfgRaw) : null;
          hasMappings = !!cfg && typeof cfg === 'object';
          usedForRevenueTracking =
            !!cfg &&
            !!cfg.campaignField &&
            Array.isArray(cfg.selectedValues) &&
            cfg.selectedValues.length > 0 &&
            !!cfg.revenueField;

          if (usedForRevenueTracking) {
            const campaignField = String(cfg.campaignField || '').trim();
            const revenueField = String(cfg.revenueField || '').trim();
            const selectedValues = Array.isArray(cfg.selectedValues) ? cfg.selectedValues.map((v: any) => String(v)).filter(Boolean) : [];
            const campaignFieldLabel = campaignField.toLowerCase() === 'name' ? 'Opportunity Name' : campaignField;
            const revenueFieldLabel = revenueField || 'Amount';
            const sample = selectedValues.slice(0, 1);
            mappingSummary = {
              campaignField: campaignFieldLabel,
              revenueField: revenueFieldLabel,
              selectedValuesCount: selectedValues.length,
              selectedValuesSample: sample,
            };
          }
        } catch {
          hasMappings = false;
          usedForRevenueTracking = false;
          mappingSummary = null;
        }

        const isActive = !!conn.isActive;
        const orgLabel = conn.orgName ? String(conn.orgName) : 'Salesforce';
        return {
          id: conn.id,
          type: 'salesforce',
          provider: 'Salesforce',
          displayName: conn.orgName ? `Salesforce — ${orgLabel}` : 'Salesforce',
          status: isActive ? 'connected' : 'inactive',
          isActive,
          connectedAt: conn.connectedAt,
          hasMappings,
          usedForRevenueTracking,
          mappingSummary,
          campaignName: campaign?.name || null,
          orgId: conn.orgId || null,
          orgName: conn.orgName || null,
        };
      });

      res.json({
        success: true,
        campaignId,
        sources: [
          ...googleSheetsSources,
          ...hubspotSources,
          ...salesforceSources,
        ],
      });
    } catch (error: any) {
      console.error('[Connected Data Sources] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load connected data sources' });
    }
  });

  // Preview raw data for a connected data source (Google Sheets first; CRMs later)
  app.get("/api/campaigns/:id/connected-data-sources/:sourceId/preview", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const sourceId = req.params.sourceId;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '50'), 10) || 50, 10), 200);
      const columnsParam = String((req.query as any)?.columns || '').trim();
      const parseColumns = (raw: string): string[] => {
        if (!raw) return [];
        return raw
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
          // Safe SOQL identifier-ish: allow dotted paths (Owner.Name) and underscores.
          .filter((s) => /^[A-Za-z_][A-Za-z0-9_.]*$/.test(s))
          .slice(0, 30);
      };
      const requestedColumns = parseColumns(columnsParam);

      // NOTE: `sourceId` is the Google Sheets *connection id* (not spreadsheetId).
      // Pull from the campaign's connections list and find by id.
      const allConnections = await storage.getGoogleSheetsConnections(campaignId);
      let conn: any = (allConnections || []).find((c: any) => c?.id === sourceId);
      // Backwards-compat fallback: if caller passed spreadsheetId, try resolving that too.
      if (!conn) {
        conn = await storage.getGoogleSheetsConnection(campaignId, sourceId);
      }

      // If not a Google Sheets source, try HubSpot
      if (!conn) {
        const hubspotConns: any[] = await storage.getHubspotConnections(campaignId) as any;
        const hubConn: any = (hubspotConns || []).find((c: any) => c?.id === sourceId);
        if (!hubConn) {
          // Try Salesforce
          const sfConns: any[] = await storage.getSalesforceConnections(campaignId) as any;
          const sfConn: any = (sfConns || []).find((c: any) => c?.id === sourceId);
          if (!sfConn) {
            return res.status(404).json({ error: 'Source not found' });
          }

          // Salesforce preview: show rows based on saved mappingConfig (if present), otherwise a generic Closed Won sample.
          const { accessToken, instanceUrl } = await getSalesforceAccessTokenForCampaign(campaignId);
          const version = process.env.SALESFORCE_API_VERSION || 'v59.0';

          let cfg: any = null;
          try {
            cfg = sfConn.mappingConfig ? JSON.parse(String(sfConn.mappingConfig)) : null;
          } catch {
            cfg = null;
          }
          const rangeDays = Math.min(Math.max(parseInt(String(cfg?.days || '90'), 10) || 90, 1), 3650);
          const attribField = cfg?.campaignField ? String(cfg.campaignField) : null;
          const revenueField = cfg?.revenueField ? String(cfg.revenueField) : 'Amount';
          const selected = Array.isArray(cfg?.selectedValues) ? cfg.selectedValues.map((v: any) => String(v)) : [];

          const whereParts: string[] = [
            `StageName = 'Closed Won'`,
            `CloseDate = LAST_N_DAYS:${rangeDays}`,
          ];
          if (attribField && selected.length > 0) {
            const quoted = selected.map((v: string) => `'${String(v).replace(/'/g, "\\'")}'`).join(',');
            whereParts.push(`${attribField} IN (${quoted})`);
          }

          const defaultCols = [
            'Name',
            'StageName',
            'CloseDate',
            revenueField,
            ...(attribField ? [attribField] : []),
          ];
          const propsToFetch = Array.from(new Set((requestedColumns.length > 0 ? requestedColumns : defaultCols)));

          // Try including CurrencyIsoCode, but fall back for orgs without multi-currency enabled.
          const tryProps = async (includeCurrency: boolean) => {
            const headers = includeCurrency ? [...propsToFetch, 'CurrencyIsoCode'] : propsToFetch;
            const soql = `SELECT ${headers.join(', ')} FROM Opportunity WHERE ${whereParts.join(' AND ')} LIMIT ${Math.min(limit, 200)}`;
          const url = `${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`;
          const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
          const json: any = await resp.json().catch(() => ({}));
            return { resp, json, headers };
          };

          let { resp, json, headers } = await tryProps(true);
          if (!resp.ok) {
            const msg = String(json?.[0]?.message || json?.message || '');
            if (msg.toLowerCase().includes('no such column') && msg.toLowerCase().includes('currencyisocode')) {
              ({ resp, json, headers } = await tryProps(false));
            }
          }
          if (!resp.ok) {
            return res.status(resp.status).json({ error: json?.[0]?.message || json?.message || 'Failed to load Salesforce preview' });
          }

          const records = Array.isArray(json?.records) ? json.records : [];
          const rows = records.map((r: any) => headers.map((h: string) => String(r?.[h] ?? '')));

          return res.json({
            success: true,
            sourceId,
            type: 'salesforce',
            spreadsheetName: sfConn.orgName || 'Salesforce',
            spreadsheetId: sfConn.orgId || 'salesforce',
            sheetName: 'Opportunities',
            headers,
            rows,
            rowCount: rows.length,
          });
        }

        const { accessToken } = await getHubspotAccessTokenForCampaign(campaignId);

        let cfg: any = null;
        try {
          cfg = hubConn.mappingConfig ? JSON.parse(String(hubConn.mappingConfig)) : null;
        } catch {
          cfg = null;
        }

        const rangeDays = Math.min(Math.max(parseInt(String(cfg?.days || '90'), 10) || 90, 1), 3650);
        const startMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
        const stageIds = Array.isArray(cfg?.stageIds) && cfg.stageIds.length > 0 ? cfg.stageIds.map((v: any) => String(v)) : ['closedwon'];
        const propsToFetch = Array.from(new Set([
          'dealname',
          'dealstage',
          'closedate',
          'hs_currency',
          String(cfg?.revenueProperty || 'amount'),
          ...(cfg?.campaignProperty ? [String(cfg.campaignProperty)] : []),
        ]));

        const filters: any[] = [
          { propertyName: 'dealstage', operator: 'IN', values: stageIds },
          { propertyName: 'closedate', operator: 'GTE', value: String(startMs) },
        ];
        if (cfg?.campaignProperty && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0) {
          filters.unshift({ propertyName: String(cfg.campaignProperty), operator: 'IN', values: cfg.selectedValues.map((v: any) => String(v)) });
        }

        const body: any = {
          filterGroups: [{ filters }],
          properties: propsToFetch,
          limit,
        };

        const json = await hubspotSearchDeals(accessToken, body);
        const results = Array.isArray(json?.results) ? json.results : [];
        const headers = ['id', ...propsToFetch];
        const rows = results.map((d: any) => {
          const props = d?.properties || {};
          return headers.map((h: string) => {
            if (h === 'id') return d?.id || '';
            return props[h] ?? '';
          });
        });

        return res.json({
          success: true,
          sourceId,
          type: 'hubspot',
          spreadsheetName: hubConn.portalName || 'HubSpot',
          spreadsheetId: hubConn.portalId || 'hubspot',
          sheetName: 'Deals',
          headers,
          rows,
          rowCount: rows.length,
        });
      }

      if (!conn || !conn.accessToken) {
        return res.status(404).json({ error: 'Source not found or missing access token' });
      }

      let accessToken = conn.accessToken;
      try {
        if (conn.refreshToken && conn.clientId && conn.clientSecret) {
          const shouldRefresh = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + (5 * 60 * 1000);
          if (shouldRefresh) {
            accessToken = await refreshGoogleSheetsToken(conn);
          }
        }
      } catch {
        // ignore refresh failure; we'll try with the current token
      }

      // Ensure we have a sheet/tab name. Without it, the Sheets API range is often invalid for multi-tab spreadsheets.
      let sheetNameForPreview: string | null = conn.sheetName || null;
      if (!sheetNameForPreview) {
        try {
          const group = (allConnections || [])
            .filter((c: any) => c && c.isActive)
            .filter((c: any) => c.spreadsheetId === conn.spreadsheetId)
            .filter((c: any) => c.spreadsheetId && c.spreadsheetId !== 'pending');
          const idx = group.findIndex((c: any) => c.id === (conn as any).id);

          const fetchTitles = async (token: string): Promise<string[] | null> => {
            const metaResp = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}?fields=sheets.properties.title`,
              { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (!metaResp.ok) return null;
            const meta = await metaResp.json().catch(() => ({}));
            const titles = Array.isArray(meta?.sheets)
              ? meta.sheets.map((s: any) => s?.properties?.title).filter(Boolean)
              : [];
            return titles;
          };

          let titles: string[] | null = await fetchTitles(accessToken);
          if ((!titles || titles.length === 0) && conn.refreshToken) {
            try {
              const refreshed = await refreshGoogleSheetsToken(conn);
              if (refreshed) {
                accessToken = refreshed;
                titles = await fetchTitles(accessToken);
              }
            } catch {
              // ignore
            }
          }
          if (titles && titles.length > 0) {
            sheetNameForPreview = (idx >= 0 && idx < titles.length) ? titles[idx] : titles[0];
          }
        } catch {
          // best-effort only; handled below if still missing
        }
      }

      if (!sheetNameForPreview) {
        return res.status(400).json({
          error: 'Missing Google Sheets tab name for this connection',
          details: 'This connection is missing a sheet/tab name (likely created via Back/cancel flow). Please refresh connections or reconnect the sheet.',
        });
      }

      const range = `${toA1SheetPrefix(sheetNameForPreview)}A1:ZZ${limit + 1}`;
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(conn.spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
      const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${accessToken}` } });

      if (!resp.ok) {
        const body = await resp.text().catch(() => '');
        return res.status(resp.status).json({ error: 'Failed to fetch preview data from Google Sheets', details: body });
      }

      const json = await resp.json().catch(() => ({}));
      const rows: any[][] = json?.values || [];
      const headers = Array.isArray(rows) && rows.length > 0 ? (rows[0] || []) : [];
      const data = Array.isArray(rows) && rows.length > 1 ? rows.slice(1) : [];

      res.json({
        success: true,
        type: 'google_sheets',
        sourceId,
        spreadsheetId: conn.spreadsheetId,
        spreadsheetName: conn.spreadsheetName,
        sheetName: sheetNameForPreview,
        headers,
        rows: data,
        rowCount: data.length,
      });
    } catch (error: any) {
      console.error('[Connected Data Sources Preview] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load preview' });
    }
  });

  // Set primary Google Sheets connection
  app.post("/api/campaigns/:id/google-sheets-connections/:connectionId/set-primary", async (req, res) => {
    try {
      const { id: campaignId, connectionId } = req.params;
      const success = await storage.setPrimaryGoogleSheetsConnection(campaignId, connectionId);
      
      if (!success) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      res.json({ success: true, message: 'Primary connection updated' });
    } catch (error: any) {
      console.error('Set primary connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to set primary connection' });
    }
  });

  app.get("/api/google-sheets/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const connections = await storage.getGoogleSheetsConnections(campaignId);
      const primaryConnection = connections.find(c => c.isPrimary) || connections[0];
      
      // Check for both spreadsheetId AND accessToken - both are required for data fetching
      // Also check that spreadsheetId is not 'pending' (placeholder)
      if (!primaryConnection || !primaryConnection.spreadsheetId || primaryConnection.spreadsheetId === 'pending' || !primaryConnection.accessToken) {
        console.log(`[Google Sheets Check] Connection check failed for ${campaignId}:`, {
          hasConnection: !!primaryConnection,
          hasSpreadsheetId: !!primaryConnection?.spreadsheetId,
          spreadsheetId: primaryConnection?.spreadsheetId,
          hasAccessToken: !!primaryConnection?.accessToken
        });
        return res.json({ connected: false, totalConnections: connections.length });
      }
      
      res.json({
        connected: true,
        totalConnections: connections.length,
        spreadsheetId: primaryConnection.spreadsheetId,
        spreadsheetName: primaryConnection.spreadsheetName
      });
    } catch (error) {
      console.error('[Google Sheets Check] Error checking connection:', error);
      res.json({ connected: false });
    }
  });

  // HubSpot connection status
  app.get("/api/hubspot/:campaignId/status", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const conn: any = await storage.getHubspotConnection(campaignId);
      if (!conn || !conn.isActive || !conn.accessToken) {
        return res.json({ connected: false });
      }

      // Ensure we have a human-friendly account name for UI display.
      // HubSpot redirect screens + tokens provide hub_id, but not always accountName reliably.
      // Best-effort hydrate from HubSpot account-info endpoint.
      const hydrateAccountName = async (): Promise<{ portalId: string | null; portalName: string | null }> => {
        let accessToken = conn.accessToken;
        try {
          const shouldRefresh = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + (5 * 60 * 1000);
          if (shouldRefresh && conn.refreshToken) {
            accessToken = await refreshHubspotToken(conn);
          }
        } catch {
          // ignore refresh failure; try existing token
        }

        let portalId: string | null = conn.portalId ? String(conn.portalId) : null;
        let portalName: string | null = conn.portalName ? String(conn.portalName) : null;
        if (portalName) return { portalId, portalName };

        try {
          const infoResp = await fetch('https://api.hubapi.com/account-info/v3/details', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          if (infoResp.ok) {
            const info: any = await infoResp.json().catch(() => ({}));
            if (info?.portalId) portalId = String(info.portalId);
            if (info?.accountName) portalName = String(info.accountName);
            if (portalName || portalId) {
              await storage.updateHubspotConnection(String(conn.id), {
                portalId,
                portalName,
              } as any);
            }
          }
        } catch {
          // ignore
        }
        return { portalId, portalName };
      };

      const hydrated = await hydrateAccountName();

      res.json({
        connected: true,
        connectionId: conn.id,
        portalId: hydrated.portalId,
        portalName: hydrated.portalName,
      });
    } catch (error: any) {
      console.error('[HubSpot Status] Error:', error);
      res.json({ connected: false });
    }
  });

  // Get Salesforce connection details (including mappingConfig) for editing/reprocessing
  app.get("/api/salesforce/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { connectionId } = req.query as any;

      const conns = await storage.getSalesforceConnections(campaignId);
      const active = (conns || []).filter((c: any) => (c as any).isActive !== false);
      const selected =
        connectionId
          ? active.find((c: any) => String(c?.id) === String(connectionId))
          : active[active.length - 1];

      if (!selected) return res.status(404).json({ error: "Salesforce connection not found" });

      let mappingConfig: any = null;
      try {
        mappingConfig = (selected as any).mappingConfig ? JSON.parse(String((selected as any).mappingConfig)) : null;
      } catch {
        mappingConfig = null;
      }

      res.json({
        success: true,
        connection: {
          id: (selected as any).id,
          orgId: (selected as any).orgId || null,
          orgName: (selected as any).orgName || null,
          isActive: (selected as any).isActive !== false,
          mappingConfig,
          connectedAt: (selected as any).connectedAt || null,
        },
      });
    } catch (error: any) {
      console.error("[Salesforce Connection] Error:", error);
      res.status(500).json({ error: error.message || "Failed to load Salesforce connection" });
    }
  });

  // Salesforce connection status
  app.get("/api/salesforce/:campaignId/status", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const conn: any = await storage.getSalesforceConnection(campaignId);
      if (!conn || !conn.isActive || !conn.accessToken || !conn.instanceUrl) {
        return res.json({ connected: false });
      }
      res.json({
        connected: true,
        connectionId: conn.id,
        orgId: conn.orgId,
        orgName: conn.orgName,
        instanceUrl: conn.instanceUrl,
      });
    } catch (error: any) {
      console.error('[Salesforce Status] Error:', error);
      res.json({ connected: false });
    }
  });

  // Salesforce Opportunity fields (describe)
  app.get("/api/salesforce/:campaignId/opportunities/fields", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const { accessToken, instanceUrl } = await getSalesforceAccessTokenForCampaign(campaignId);
      const version = process.env.SALESFORCE_API_VERSION || 'v59.0';

      const resp = await fetch(`${instanceUrl}/services/data/${version}/sobjects/Opportunity/describe`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return res.status(resp.status).json({ error: json?.[0]?.message || json?.message || 'Failed to load Opportunity fields' });
      }

      const fields = Array.isArray(json?.fields) ? json.fields : [];
      const simplified = fields
        .filter((f: any) => f && f.name && f.label && f.nillable !== undefined)
        .map((f: any) => ({
          name: String(f.name),
          label: String(f.label),
          type: String(f.type || ''),
        }));

      // Defensive: ensure standard Opportunity Name field is present for attribution/crosswalk when users rely on naming conventions.
      // Salesforce standard API name is "Name" with label "Opportunity Name".
      if (!simplified.some((f: any) => String(f?.name || '').toLowerCase() === 'name')) {
        simplified.push({ name: 'Name', label: 'Opportunity Name', type: 'string' });
      }

      res.json({ success: true, fields: simplified });
    } catch (error: any) {
      console.error('[Salesforce Fields] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load Opportunity fields' });
    }
  });

  // Salesforce Opportunity unique values for a field (for crosswalk multi-select)
  app.get("/api/salesforce/:campaignId/opportunities/unique-values", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const field = String(req.query.field || '').trim();
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200'), 10) || 200, 10), 500);
      const days = Math.min(Math.max(parseInt(String(req.query.days || '90'), 10) || 90, 1), 3650);

      if (!field) return res.status(400).json({ error: 'Missing field' });

      const { accessToken, instanceUrl } = await getSalesforceAccessTokenForCampaign(campaignId);
      const version = process.env.SALESFORCE_API_VERSION || 'v59.0';

      const counts = new Map<string, number>();

      // Salesforce does not allow aliasing non-aggregate expressions in SOQL (e.g. "Name v").
      // Helper: read a dynamic (possibly dotted) field from a record.
      const readField = (rec: any, path: string): any => {
        if (!rec || !path) return undefined;
        // Fast path
        if (Object.prototype.hasOwnProperty.call(rec, path)) return rec[path];
        // Nested path (e.g. Owner.Name)
        const parts = String(path).split('.').filter(Boolean);
        let cur: any = rec;
        for (const p of parts) {
          if (!cur) return undefined;
          cur = cur[p];
        }
        return cur;
      };

      // Prefer aggregate query (fast). Some fields can't be GROUP BY'd; if so, fall back to row scan.
      const soqlAgg =
        `SELECT ${field}, COUNT(Id) c ` +
        `FROM Opportunity ` +
        `WHERE StageName = 'Closed Won' AND CloseDate = LAST_N_DAYS:${days} AND ${field} != null ` +
        `GROUP BY ${field} ` +
        `ORDER BY COUNT(Id) DESC ` +
        `LIMIT ${Math.min(limit, 500)}`;

      const queryUrl = `${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soqlAgg)}`;
      const aggResp = await fetch(queryUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
      const aggJson: any = await aggResp.json().catch(() => ({}));
      if (aggResp.ok && Array.isArray(aggJson?.records)) {
        for (const r of aggJson.records) {
          const raw = readField(r, field);
          const v = raw === undefined || raw === null ? '' : String(raw).trim();
          if (!v) continue;
          const c = Number(r?.c);
          counts.set(v, Number.isFinite(c) ? c : 1);
        }
      } else {
        // Fallback scan
        const soql =
          `SELECT Id, ${field} ` +
          `FROM Opportunity ` +
          `WHERE StageName = 'Closed Won' AND CloseDate = LAST_N_DAYS:${days} AND ${field} != null ` +
          `LIMIT 2000`;
        let nextUrl: string | null = `${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`;
        let pages = 0;
        while (nextUrl && pages < 10 && counts.size < limit) {
          const resp = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
          const json: any = await resp.json().catch(() => ({}));
          if (!resp.ok) {
            return res.status(resp.status).json({ error: json?.[0]?.message || json?.message || 'Failed to load unique values' });
          }
          const recs = Array.isArray(json?.records) ? json.records : [];
          for (const rec of recs) {
            const raw = readField(rec, field);
            const v = raw === undefined || raw === null ? '' : String(raw).trim();
            if (!v) continue;
            counts.set(v, (counts.get(v) || 0) + 1);
            if (counts.size >= limit) break;
          }
          nextUrl = json?.nextRecordsUrl ? `${instanceUrl}${json.nextRecordsUrl}` : null;
          pages += 1;
        }
      }

      const values = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      res.json({ success: true, field, values });
    } catch (error: any) {
      console.error('[Salesforce Unique Values] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load unique values' });
    }
  });

  // Salesforce Opportunity preview (before processing revenue metrics)
  // Returns sample rows for the chosen attribution field + selected values + revenue field.
  app.post("/api/salesforce/:campaignId/opportunities/preview", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const { campaignField, selectedValues, revenueField, days, limit } = req.body || {};

      const attribField = String(campaignField || '').trim();
      const revenue = String(revenueField || 'Amount').trim();
      const selected: string[] = Array.isArray(selectedValues) ? selectedValues.map((v: any) => String(v).trim()).filter(Boolean) : [];
      const rangeDays = Math.min(Math.max(parseInt(String(days || '90'), 10) || 90, 1), 3650);
      const rowLimit = Math.min(Math.max(parseInt(String(limit || '25'), 10) || 25, 5), 200);

      if (!attribField) return res.status(400).json({ error: 'campaignField is required' });
      if (selected.length === 0) return res.status(400).json({ error: 'selectedValues is required' });
      if (!revenue) return res.status(400).json({ error: 'revenueField is required' });

      const { accessToken, instanceUrl } = await getSalesforceAccessTokenForCampaign(campaignId);
      const version = process.env.SALESFORCE_API_VERSION || 'v59.0';

      // Helper: read a dynamic (possibly dotted) field from a record.
      const readField = (rec: any, path: string): any => {
        if (!rec || !path) return undefined;
        if (Object.prototype.hasOwnProperty.call(rec, path)) return rec[path];
        const parts = String(path).split('.').filter(Boolean);
        let cur: any = rec;
        for (const p of parts) {
          if (!cur) return undefined;
          cur = cur[p];
        }
        return cur;
      };

      const quoted = selected.map((v) => `'${String(v).replace(/'/g, "\\'")}'`).join(',');

      const buildSoql = (includeCurrency: boolean) => {
        const baseFields = Array.from(
          new Set([
            'Id',
            'Name',
            'StageName',
            'CloseDate',
            attribField,
            revenue,
            ...(includeCurrency ? ['CurrencyIsoCode'] : []),
          ])
        );
        const soql =
          `SELECT ${baseFields.join(', ')} ` +
          `FROM Opportunity ` +
          `WHERE StageName = 'Closed Won' AND CloseDate = LAST_N_DAYS:${rangeDays} AND ${attribField} IN (${quoted}) ` +
          `ORDER BY CloseDate DESC ` +
          `LIMIT ${rowLimit}`;
        return { soql, headers: baseFields };
      };

      const tryQuery = async (includeCurrency: boolean): Promise<{ ok: boolean; headers: string[]; records?: any[]; error?: string }> => {
        const { soql, headers } = buildSoql(includeCurrency);
        const url = `${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`;
        const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
        const json: any = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          const msg = String(json?.[0]?.message || json?.message || 'Failed to load Salesforce preview');
          return { ok: false, headers, error: msg };
        }
        const records = Array.isArray(json?.records) ? json.records : [];
        return { ok: true, headers, records };
      };

      let result = await tryQuery(true);
      if (!result.ok && String(result.error || '').toLowerCase().includes('currencyisocode')) {
        result = await tryQuery(false);
      }
      if (!result.ok) return res.status(400).json({ error: result.error || 'Failed to load Salesforce preview' });

      const headers = result.headers;
      const records = result.records || [];
      const rows = records.map((r: any) => headers.map((h: string) => String(readField(r, h) ?? '')));

      res.json({
        success: true,
        campaignField: attribField,
        revenueField: revenue,
        days: rangeDays,
        headers,
        rows,
        rowCount: rows.length,
      });
    } catch (error: any) {
      console.error('[Salesforce Preview] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load Salesforce preview' });
    }
  });

  // Salesforce save mappings (compute conversion value and unlock LinkedIn revenue metrics)
  app.post("/api/campaigns/:id/salesforce/save-mappings", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { campaignField, selectedValues, revenueField, days, revenueClassification } = req.body || {};

      const attribField = String(campaignField || '').trim();
      const revenue = String(revenueField || 'Amount').trim();
      const selected: string[] = Array.isArray(selectedValues) ? selectedValues.map((v: any) => String(v).trim()).filter(Boolean) : [];
      const rangeDays = Math.min(Math.max(parseInt(String(days || '90'), 10) || 90, 1), 3650);

      if (!attribField) return res.status(400).json({ error: 'campaignField is required' });
      if (selected.length === 0) return res.status(400).json({ error: 'selectedValues is required' });
      if (!revenue) return res.status(400).json({ error: 'revenueField is required' });

      const { accessToken, instanceUrl } = await getSalesforceAccessTokenForCampaign(campaignId);
      const version = process.env.SALESFORCE_API_VERSION || 'v59.0';

      // Helper: read a dynamic (possibly dotted) field from a record.
      const readField = (rec: any, path: string): any => {
        if (!rec || !path) return undefined;
        if (Object.prototype.hasOwnProperty.call(rec, path)) return rec[path];
        const parts = String(path).split('.').filter(Boolean);
        let cur: any = rec;
        for (const p of parts) {
          if (!cur) return undefined;
          cur = cur[p];
        }
        return cur;
      };

      // Query opportunities matching crosswalk values
      const quoted = selected.map((v) => `'${String(v).replace(/'/g, "\\'")}'`).join(',');

      // Some orgs (non-multi-currency) do not have CurrencyIsoCode on Opportunity.
      // We'll try with CurrencyIsoCode first, then fall back without it if Salesforce reports INVALID_FIELD.
      const buildSoql = (includeCurrency: boolean) =>
        // Salesforce does not allow aliasing non-aggregate expressions in SOQL.
        `SELECT Id, ${revenue}${includeCurrency ? ', CurrencyIsoCode' : ''} ` +
        `FROM Opportunity ` +
        `WHERE StageName = 'Closed Won' AND CloseDate = LAST_N_DAYS:${rangeDays} AND ${attribField} IN (${quoted}) ` +
        `LIMIT 2000`;

      const fetchOppRecords = async (includeCurrency: boolean): Promise<{ records: any[]; includeCurrency: boolean }> => {
        const soql = buildSoql(includeCurrency);
      let nextUrl: string | null = `${instanceUrl}/services/data/${version}/query?q=${encodeURIComponent(soql)}`;
        const all: any[] = [];
      let pages = 0;
      while (nextUrl && pages < 25) {
        const resp = await fetch(nextUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
        const json: any = await resp.json().catch(() => ({}));
        if (!resp.ok) {
            const msg = String(json?.[0]?.message || json?.message || '');
            const isInvalidCurrencyIsoCodeField =
              includeCurrency &&
              msg.toLowerCase().includes('no such column') &&
              msg.toLowerCase().includes('currencyisocode');
            if (isInvalidCurrencyIsoCodeField) {
              // Retry without CurrencyIsoCode
              return await fetchOppRecords(false);
            }
            return res.status(resp.status).json({ error: msg || 'Failed to load opportunities' }) as any;
        }
        const recs = Array.isArray(json?.records) ? json.records : [];
          all.push(...recs);
          nextUrl = json?.nextRecordsUrl ? `${instanceUrl}${json.nextRecordsUrl}` : null;
          pages += 1;
        }
        return { records: all, includeCurrency };
      };

      let totalRevenue = 0;
      const currencies = new Set<string>();

      const fetched = await fetchOppRecords(true);
      // If fetchOppRecords returned an Express response (error), stop here.
      if (!fetched || typeof (fetched as any).includeCurrency !== 'boolean') return;
      const { records, includeCurrency } = fetched as any;
      for (const rec of records) {
        const rRaw = readField(rec, revenue);
          const r = rRaw === undefined || rRaw === null ? NaN : Number(String(rRaw).replace(/[^0-9.\-]/g, ''));
          if (Number.isFinite(r)) totalRevenue += r;
        if (includeCurrency) {
          const c = rec?.CurrencyIsoCode ? String(rec.CurrencyIsoCode).trim() : '';
          if (c) currencies.add(c);
        }
      }

      // Only enforce currency homogeneity when CurrencyIsoCode exists in the org.
      if (currencies.size > 1) {
        return res.status(400).json({
          error: `Multiple currencies found for the selected opportunities (${Array.from(currencies).join(', ')}). Please filter Salesforce records to a single currency.`,
          currencies: Array.from(currencies),
        });
      }

      // Pull conversions from latest LinkedIn import session
      const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
      const latestSession = (sessions || []).sort((a: any, b: any) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];
      if (!latestSession) {
        return res.status(400).json({ error: 'No LinkedIn import session found. Please import LinkedIn metrics first.' });
      }
      const importMetrics = await storage.getLinkedInImportMetrics(latestSession.id);
      const canonicalKey = (k: string) => String(k || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const totalConversions = (importMetrics || []).reduce((sum: number, m: any) => {
        const key = canonicalKey(m.metricKey);
        if (key === 'conversions' || key === 'externalwebsiteconversions') {
          const v = Number(m.metricValue);
          if (Number.isFinite(v)) return sum + v;
        }
        return sum;
      }, 0);
      if (!Number.isFinite(totalConversions) || totalConversions <= 0) {
        return res.status(400).json({ error: 'LinkedIn conversions are 0. Cannot compute conversion value.' });
      }

      const calculatedConversionValue = Number((totalRevenue / totalConversions).toFixed(2));

      await storage.updateCampaign(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInConnection(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInImportSession(latestSession.id, { conversionValue: calculatedConversionValue } as any);

      const sfConn: any = await storage.getSalesforceConnection(campaignId);
      if (sfConn) {
        const rcRaw = String(revenueClassification || '').trim();
        const rc =
          rcRaw === 'offsite_not_in_ga4' || rcRaw === 'onsite_in_ga4' ? rcRaw : 'onsite_in_ga4';
        const mappingConfig = {
          objectType: 'opportunity',
          campaignField: attribField,
          selectedValues: selected,
          revenueField: revenue,
          days: rangeDays,
          currency: currencies.size === 1 ? Array.from(currencies)[0] : null,
          revenueClassification: rc,
          lastTotalRevenue: Number(totalRevenue.toFixed(2)),
        };
        await storage.updateSalesforceConnection(sfConn.id, { mappingConfig: JSON.stringify(mappingConfig) } as any);
      }

      res.json({
        success: true,
        conversionValueCalculated: true,
        conversionValue: calculatedConversionValue,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalConversions,
        currency: currencies.size === 1 ? Array.from(currencies)[0] : null,
        sessionId: latestSession.id,
      });
    } catch (error: any) {
      console.error('[Salesforce Save Mappings] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to save Salesforce mappings' });
    }
  });

  // HubSpot deals properties (for mapping wizard)
  app.get("/api/hubspot/:campaignId/deals/properties", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const { accessToken } = await getHubspotAccessTokenForCampaign(campaignId);

      const resp = await fetch('https://api.hubapi.com/crm/v3/properties/deals?archived=false', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return res.status(resp.status).json({ error: json?.message || 'Failed to load deal properties' });
      }

      const results = Array.isArray(json?.results) ? json.results : [];
      const properties = results
        .filter((p: any) => p && (p.hidden !== true))
        .map((p: any) => ({
          name: String(p.name),
          label: String(p.label || p.name),
          type: String(p.type || ''),
          fieldType: String(p.fieldType || ''),
        }));

      // Ensure common fields exist even if hidden in some portals
      const ensure = (name: string, label: string) => {
        if (!properties.some((p: any) => p.name === name)) properties.unshift({ name, label, type: 'string', fieldType: '' });
      };
      ensure('dealstage', 'Deal stage');
      ensure('amount', 'Deal amount');
      ensure('closedate', 'Close date');
      ensure('hs_currency', 'Currency');

      res.json({ success: true, properties });
    } catch (error: any) {
      console.error('[HubSpot Properties] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load deal properties' });
    }
  });

  // HubSpot deals pipelines (for default closed-won stage selection)
  app.get("/api/hubspot/:campaignId/deals/pipelines", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const { accessToken } = await getHubspotAccessTokenForCampaign(campaignId);

      const resp = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const json: any = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        return res.status(resp.status).json({ error: json?.message || 'Failed to load pipelines' });
      }

      const pipelines = Array.isArray(json?.results) ? json.results : [];
      res.json({ success: true, pipelines });
    } catch (error: any) {
      console.error('[HubSpot Pipelines] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load pipelines' });
    }
  });

  function deriveDefaultClosedWonStageIds(pipelines: any[]): string[] {
    const stageIds: string[] = [];
    for (const p of pipelines || []) {
      const stages = Array.isArray(p?.stages) ? p.stages : [];
      for (const s of stages) {
        const id = s?.id ? String(s.id) : null;
        if (!id) continue;
        const md = s?.metadata || {};
        const isClosed = String((md as any)?.isClosed ?? '').toLowerCase() === 'true';
        const probability = String((md as any)?.probability ?? '');
        const label = String(s?.label || '').toLowerCase();
        const looksLikeWon = label.includes('closed won') || id.toLowerCase() === 'closedwon';
        if ((isClosed && probability === '1') || looksLikeWon) {
          stageIds.push(id);
        }
      }
    }
    // De-dupe
    return Array.from(new Set(stageIds)).slice(0, 50);
  }

  async function hubspotSearchDeals(accessToken: string, body: any): Promise<any> {
    const resp = await fetch('https://api.hubapi.com/crm/v3/objects/deals/search', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      throw new Error(json?.message || `HubSpot search failed (${resp.status})`);
    }
    return json;
  }

  // HubSpot unique values for a deal property (used by crosswalk multi-select)
  app.get("/api/hubspot/:campaignId/deals/unique-values", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const property = String(req.query.property || '').trim();
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || '200'), 10) || 200, 10), 500);
      const days = Math.min(Math.max(parseInt(String(req.query.days || '90'), 10) || 90, 1), 3650);

      if (!property) {
        return res.status(400).json({ error: 'Missing property' });
      }

      const { accessToken } = await getHubspotAccessTokenForCampaign(campaignId);

      // Default filters: Closed Won-ish stages + last N days (by close date)
      let stageIds: string[] = ['closedwon'];
      try {
        const pipelinesResp = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const pipelinesJson: any = await pipelinesResp.json().catch(() => ({}));
        if (pipelinesResp.ok) {
          const pipelines = Array.isArray(pipelinesJson?.results) ? pipelinesJson.results : [];
          const derived = deriveDefaultClosedWonStageIds(pipelines);
          if (derived.length > 0) stageIds = derived;
        }
      } catch {
        // ignore
      }

      const startMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const counts = new Map<string, number>();

      let after: string | undefined;
      let pages = 0;
      while (pages < 10 && counts.size < limit) {
        const body: any = {
          filterGroups: [
            {
              filters: [
                { propertyName: 'dealstage', operator: 'IN', values: stageIds },
                { propertyName: 'closedate', operator: 'GTE', value: String(startMs) },
              ],
            },
          ],
          properties: [property],
          limit: 100,
          after,
        };
        const json = await hubspotSearchDeals(accessToken, body);
        const results = Array.isArray(json?.results) ? json.results : [];
        for (const d of results) {
          const vRaw = d?.properties ? d.properties[property] : null;
          const v = vRaw === undefined || vRaw === null ? '' : String(vRaw).trim();
          if (!v) continue;
          counts.set(v, (counts.get(v) || 0) + 1);
          if (counts.size >= limit) break;
        }
        after = json?.paging?.next?.after ? String(json.paging.next.after) : undefined;
        if (!after) break;
        pages += 1;
      }

      const values = Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      res.json({ success: true, property, values });
    } catch (error: any) {
      console.error('[HubSpot Unique Values] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to load unique values' });
    }
  });

  // HubSpot save mappings (compute conversion value and unlock LinkedIn revenue metrics)
  app.post("/api/campaigns/:id/hubspot/save-mappings", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const {
        campaignProperty,
        selectedValues,
        revenueProperty,
        revenueClassification,
        days,
        stageIds,
      } = req.body || {};

      const campaignProp = String(campaignProperty || '').trim();
      const revenueProp = String(revenueProperty || 'amount').trim();
      const selected: string[] = Array.isArray(selectedValues) ? selectedValues.map((v: any) => String(v).trim()).filter(Boolean) : [];
      const rangeDays = Math.min(Math.max(parseInt(String(days || '90'), 10) || 90, 1), 3650);

      if (!campaignProp) return res.status(400).json({ error: 'campaignProperty is required' });
      if (selected.length === 0) return res.status(400).json({ error: 'selectedValues is required' });
      if (!revenueProp) return res.status(400).json({ error: 'revenueProperty is required' });

      const { accessToken } = await getHubspotAccessTokenForCampaign(campaignId);

      // Determine default closed-won stage ids unless caller provides an explicit list
      let effectiveStageIds: string[] = Array.isArray(stageIds) && stageIds.length > 0 ? stageIds.map((v: any) => String(v)) : ['closedwon'];
      if (!Array.isArray(stageIds) || stageIds.length === 0) {
        try {
          const pipelinesResp = await fetch('https://api.hubapi.com/crm/v3/pipelines/deals', {
            headers: { Authorization: `Bearer ${accessToken}` },
          });
          const pipelinesJson: any = await pipelinesResp.json().catch(() => ({}));
          if (pipelinesResp.ok) {
            const pipelines = Array.isArray(pipelinesJson?.results) ? pipelinesJson.results : [];
            const derived = deriveDefaultClosedWonStageIds(pipelines);
            if (derived.length > 0) effectiveStageIds = derived;
          }
        } catch {
          // ignore
        }
      }

      const startMs = Date.now() - rangeDays * 24 * 60 * 60 * 1000;

      let totalRevenue = 0;
      const currencies = new Set<string>();

      let after: string | undefined;
      let pages = 0;
      while (pages < 50) {
        const body: any = {
          filterGroups: [
            {
              filters: [
                { propertyName: campaignProp, operator: 'IN', values: selected },
                { propertyName: 'dealstage', operator: 'IN', values: effectiveStageIds },
                { propertyName: 'closedate', operator: 'GTE', value: String(startMs) },
              ],
            },
          ],
          properties: [campaignProp, revenueProp, 'hs_currency', 'dealname', 'dealstage', 'closedate'],
          limit: 100,
          after,
        };

        const json = await hubspotSearchDeals(accessToken, body);
        const results = Array.isArray(json?.results) ? json.results : [];
        for (const d of results) {
          const props = d?.properties || {};
          const rRaw = props[revenueProp];
          const r = rRaw === undefined || rRaw === null ? NaN : Number(String(rRaw).replace(/[^0-9.\-]/g, ''));
          if (!Number.isFinite(r)) continue;
          totalRevenue += r;

          const c = props?.hs_currency ? String(props.hs_currency).trim() : '';
          if (c) currencies.add(c);
        }

        after = json?.paging?.next?.after ? String(json.paging.next.after) : undefined;
        if (!after) break;
        pages += 1;
      }

      if (currencies.size > 1) {
        return res.status(400).json({
          error: `Multiple currencies found for the selected deals (${Array.from(currencies).join(', ')}). Please filter HubSpot deals to a single currency.`,
          currencies: Array.from(currencies),
        });
      }

      // Pull conversions from latest LinkedIn import session
      const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
      const latestSession = (sessions || []).sort((a: any, b: any) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];
      if (!latestSession) {
        return res.status(400).json({ error: 'No LinkedIn import session found. Please import LinkedIn metrics first.' });
      }

      const importMetrics = await storage.getLinkedInImportMetrics(latestSession.id);
      const canonicalKey = (k: string) => String(k || '').toLowerCase();
      const totalConversions = (importMetrics || []).reduce((sum: number, m: any) => {
        const key = canonicalKey(m.metricKey);
        if (key === 'conversions' || key === 'externalwebsiteconversions') {
          const v = Number(m.metricValue);
          if (Number.isFinite(v)) return sum + v;
        }
        return sum;
      }, 0);

      if (!Number.isFinite(totalConversions) || totalConversions <= 0) {
        return res.status(400).json({ error: 'LinkedIn conversions are 0. Cannot compute conversion value.' });
      }

      const calculatedConversionValue = Number((totalRevenue / totalConversions).toFixed(2));

      // Persist conversion value across campaign + LinkedIn connection + import session (same pattern as Sheets)
      await storage.updateCampaign(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInConnection(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInImportSession(latestSession.id, { conversionValue: calculatedConversionValue } as any);

      // Persist mapping config on the active HubSpot connection
      const hubspotConn: any = await storage.getHubspotConnection(campaignId);
      if (hubspotConn) {
        const rcRaw = String(revenueClassification || '').trim();
        const rc =
          rcRaw === 'offsite_not_in_ga4' || rcRaw === 'onsite_in_ga4' ? rcRaw : 'onsite_in_ga4';
        const mappingConfig = {
          objectType: 'deals',
          campaignProperty: campaignProp,
          selectedValues: selected,
          revenueProperty: revenueProp,
          days: rangeDays,
          stageIds: effectiveStageIds,
          currency: currencies.size === 1 ? Array.from(currencies)[0] : null,
          revenueClassification: rc,
          lastTotalRevenue: Number(totalRevenue.toFixed(2)),
        };
        await storage.updateHubspotConnection(hubspotConn.id, { mappingConfig: JSON.stringify(mappingConfig) } as any);
      }

      res.json({
        success: true,
        conversionValueCalculated: true,
        conversionValue: calculatedConversionValue,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalConversions,
        currency: currencies.size === 1 ? Array.from(currencies)[0] : null,
        sessionId: latestSession.id,
      });
    } catch (error: any) {
      console.error('[HubSpot Save Mappings] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to save HubSpot mappings' });
    }
  });

  // Helper function to refresh Google Sheets access token with robust error handling
  async function refreshGoogleSheetsToken(connection: any) {
    if (!connection.refreshToken || !connection.clientId || !connection.clientSecret) {
      throw new Error('Missing refresh token or OAuth credentials for token refresh');
    }

    console.log('🔄 Attempting to refresh Google Sheets access token for campaign:', connection.campaignId);

    // Add timeout to token refresh to prevent hanging
    // Use Promise.race for timeout compatibility with older Node.js versions
    const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 15000) => {
      try {
        // Check if AbortController is available (Node 18+)
        if (typeof AbortController !== 'undefined') {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
          
          try {
            const response = await fetch(url, {
              ...options,
              signal: controller.signal
            });
            clearTimeout(timeoutId);
            return response;
          } catch (error: any) {
            clearTimeout(timeoutId);
            if (error.name === 'AbortError') {
              throw new Error('Token refresh timeout: OAuth API did not respond within 15 seconds');
            }
            throw error;
          }
        } else {
          // Fallback for older Node.js versions using Promise.race
          const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Token refresh timeout: OAuth API did not respond within 15 seconds')), timeoutMs);
          });
          
          const fetchPromise = fetch(url, options);
          return await Promise.race([fetchPromise, timeoutPromise]) as Response;
        }
      } catch (error: any) {
        if (error.message && error.message.includes('timeout')) {
          throw error;
        }
        throw new Error(`Failed to refresh token: ${error.message || 'Unknown error'}`);
      }
    };

    const refreshResponse = await fetchWithTimeout('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: connection.refreshToken,
        client_id: connection.clientId,
        client_secret: connection.clientSecret
      })
    }, 15000); // 15 second timeout for token refresh

    if (!refreshResponse.ok) {
      const errorText = await refreshResponse.text();
      console.error('Token refresh failed with status:', refreshResponse.status, errorText);
      
      // If refresh token is invalid/expired, throw specific error
      if (refreshResponse.status === 400 && errorText.includes('invalid_grant')) {
        throw new Error('REFRESH_TOKEN_EXPIRED');
      }
      
      throw new Error(`Token refresh failed: ${errorText}`);
    }

    const tokens = await refreshResponse.json();
    
    // Update the stored connection with new access token and potentially new refresh token
    const expiresAt = new Date(Date.now() + ((tokens.expires_in || 3600) * 1000));
    const updateData: any = {
      accessToken: tokens.access_token,
      expiresAt: expiresAt
    };
    
    // Some OAuth providers issue new refresh tokens on refresh
    if (tokens.refresh_token) {
      updateData.refreshToken = tokens.refresh_token;
    }
    
    await storage.updateGoogleSheetsConnection(connection.campaignId, updateData);

    console.log('✅ Google Sheets token refreshed successfully for campaign:', connection.campaignId);
    return tokens.access_token;
  }

  async function refreshHubspotToken(connection: any) {
    if (!connection.refreshToken || !connection.clientId || !connection.clientSecret) {
      throw new Error('Missing refresh token or OAuth credentials for HubSpot token refresh');
    }

    const refreshResponse = await fetch('https://api.hubapi.com/oauth/v1/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(connection.refreshToken),
        client_id: String(connection.clientId),
        client_secret: String(connection.clientSecret),
      }),
    });

    const tokens: any = await refreshResponse.json().catch(() => ({}));
    if (!refreshResponse.ok || !tokens.access_token) {
      throw new Error(tokens?.message || 'Failed to refresh HubSpot access token');
    }

    const expiresAt = tokens.expires_in ? new Date(Date.now() + Number(tokens.expires_in) * 1000) : undefined;
    const updateData: any = {
      accessToken: tokens.access_token,
      expiresAt,
    };
    if (tokens.refresh_token) updateData.refreshToken = tokens.refresh_token;
    await storage.updateHubspotConnection(String(connection.id), updateData);
    return tokens.access_token as string;
  }

  async function refreshSalesforceToken(connection: any) {
    if (!connection.refreshToken || !connection.clientId || !connection.clientSecret) {
      throw new Error('Missing refresh token or OAuth credentials for Salesforce token refresh');
    }
    const tokenBase = (process.env.SALESFORCE_AUTH_BASE_URL || 'https://login.salesforce.com').replace(/\/+$/, '');
    const resp = await fetch(`${tokenBase}/services/oauth2/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: String(connection.refreshToken),
        client_id: String(connection.clientId),
        client_secret: String(connection.clientSecret),
      }),
    });
    const json: any = await resp.json().catch(() => ({}));
    if (!resp.ok || !json.access_token) {
      throw new Error(json?.error_description || json?.error || 'Failed to refresh Salesforce access token');
    }
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    await storage.updateSalesforceConnection(String(connection.id), {
      accessToken: json.access_token,
      expiresAt,
      instanceUrl: json.instance_url || connection.instanceUrl || null,
    } as any);
    return json.access_token as string;
  }

  async function getSalesforceAccessTokenForCampaign(campaignId: string): Promise<{ accessToken: string; instanceUrl: string; connectionId: string }> {
    const conn: any = await storage.getSalesforceConnection(campaignId);
    if (!conn || !conn.accessToken || !conn.instanceUrl) throw new Error('No Salesforce connection found');
    let accessToken = conn.accessToken;
    try {
      const shouldRefresh = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + (5 * 60 * 1000);
      if (shouldRefresh && conn.refreshToken) {
        accessToken = await refreshSalesforceToken(conn);
      }
    } catch {
      // ignore and try existing token
    }
    return { accessToken, instanceUrl: String(conn.instanceUrl), connectionId: String(conn.id) };
  }

  async function getHubspotAccessTokenForCampaign(campaignId: string): Promise<{ accessToken: string; connectionId: string }> {
    const conn: any = await storage.getHubspotConnection(campaignId);
    if (!conn || !conn.accessToken) throw new Error('No HubSpot connection found');

    let accessToken = conn.accessToken;
    try {
      const shouldRefresh = conn.expiresAt && new Date(conn.expiresAt).getTime() < Date.now() + (5 * 60 * 1000);
      if (shouldRefresh && conn.refreshToken) {
        accessToken = await refreshHubspotToken(conn);
      }
    } catch {
      // ignore and try existing token
    }

    return { accessToken, connectionId: String(conn.id) };
  }

  // Helper function to check if token needs proactive refresh (within 5 minutes of expiry)
  function shouldRefreshToken(connection: any): boolean {
    if (!connection.expiresAt) return false;
    
    const expiresAt = new Date(connection.expiresAt);
    const now = new Date();
    const fiveMinutesFromNow = new Date(now.getTime() + 5 * 60 * 1000);
    
    return expiresAt <= fiveMinutesFromNow;
  }

  // Helper function to map MetricMind platform values to Google Sheets platform keywords
  function getPlatformKeywords(platform: string | null | undefined): string[] {
    if (!platform) return [];
    
    const platformLower = platform.toLowerCase();
    const platformMapping: Record<string, string[]> = {
      'linkedin': ['linkedin', 'linked in', 'linkedin ads'],
      'google_ads': ['google ads', 'google', 'google adwords', 'google advertising'],
      'facebook_ads': ['facebook ads', 'facebook', 'meta', 'meta ads', 'meta advertising'],
      'twitter_ads': ['twitter ads', 'twitter', 'x ads', 'x advertising'],
      'instagram_ads': ['instagram ads', 'instagram', 'ig ads'],
      'tiktok_ads': ['tiktok ads', 'tiktok', 'tik tok ads'],
      'snapchat_ads': ['snapchat ads', 'snapchat'],
      'pinterest_ads': ['pinterest ads', 'pinterest'],
      'youtube_ads': ['youtube ads', 'youtube', 'google video ads'],
      'bing_ads': ['bing ads', 'bing', 'microsoft ads', 'microsoft advertising'],
      'amazon_ads': ['amazon ads', 'amazon', 'amazon advertising'],
    };
    
    // Return mapped keywords or use platform name as fallback
    return platformMapping[platformLower] || [platformLower];
  }

  // Helper function to check if a platform value matches any of the keywords
  function matchesPlatform(platformValue: string, keywords: string[]): boolean {
    const valueLower = platformValue.toLowerCase();
    return keywords.some(keyword => valueLower.includes(keyword));
  }

  // Helper function to generate intelligent insights from spreadsheet data
  function generateInsights(
    rows: any[][], 
    detectedColumns: Array<{name: string, index: number, type: string, total: number}>,
    metrics: Record<string, number>
  ) {
    const insights: any = {
      topPerformers: [],
      bottomPerformers: [],
      anomalies: [],
      trends: [],
      correlations: [],
      recommendations: [],
      dataQuality: {
        completeness: 0,
        missingValues: 0,
        outliers: []
      }
    };

    if (rows.length <= 1 || detectedColumns.length === 0) {
      return insights;
    }

    const dataRows = rows.slice(1); // Exclude header
    const totalDataPoints = dataRows.length * detectedColumns.length;
    let missingCount = 0;

    // Analyze each numeric column
    detectedColumns.forEach(col => {
      const values: number[] = [];
      const rowData: Array<{rowIndex: number, value: number, rowContent: any[]}> = [];

      // Collect all values for this column
      dataRows.forEach((row, idx) => {
        const cellValue = row[col.index];
        if (!cellValue || cellValue === '') {
          missingCount++;
          return;
        }

        const cleanValue = String(cellValue).replace(/[$,]/g, '').trim();
        const numValue = parseFloat(cleanValue);

        if (!isNaN(numValue)) {
          values.push(numValue);
          rowData.push({ rowIndex: idx + 2, value: numValue, rowContent: row }); // +2 because row 1 is header
        } else {
          missingCount++;
        }
      });

      if (values.length === 0) return;

      // Calculate statistics
      const sum = values.reduce((a, b) => a + b, 0);
      const mean = sum / values.length;
      const sortedValues = [...values].sort((a, b) => a - b);
      const median = sortedValues[Math.floor(sortedValues.length / 2)];
      const min = sortedValues[0];
      const max = sortedValues[sortedValues.length - 1];
      
      // Calculate standard deviation
      const squareDiffs = values.map(value => Math.pow(value - mean, 2));
      const avgSquareDiff = squareDiffs.reduce((a, b) => a + b, 0) / values.length;
      const stdDev = Math.sqrt(avgSquareDiff);

      // Identify top performers (top 3 rows for this metric)
      const topRows = [...rowData].sort((a, b) => b.value - a.value).slice(0, 3);
      topRows.forEach(item => {
        insights.topPerformers.push({
          metric: col.name,
          value: item.value,
          rowNumber: item.rowIndex,
          type: col.type,
          percentOfTotal: col.total > 0 ? (item.value / col.total) * 100 : 0
        });
      });

      // Identify bottom performers (bottom 3 rows for this metric)
      const bottomRows = [...rowData].sort((a, b) => a.value - b.value).slice(0, 3);
      bottomRows.forEach(item => {
        if (item.value > 0) { // Only include non-zero values
          insights.bottomPerformers.push({
            metric: col.name,
            value: item.value,
            rowNumber: item.rowIndex,
            type: col.type,
            percentOfTotal: col.total > 0 ? (item.value / col.total) * 100 : 0
          });
        }
      });

      // Detect anomalies (values > 2 standard deviations from mean)
      rowData.forEach(item => {
        const zScore = Math.abs((item.value - mean) / stdDev);
        if (zScore > 2 && values.length >= 10) { // Only flag anomalies if we have enough data
          insights.anomalies.push({
            metric: col.name,
            value: item.value,
            rowNumber: item.rowIndex,
            type: col.type,
            deviation: zScore,
            direction: item.value > mean ? 'above' : 'below',
            message: `${col.name} is ${zScore.toFixed(1)}x ${item.value > mean ? 'higher' : 'lower'} than average`
          });
        }
      });

      // Generate trend insights (compare first half vs second half)
      if (values.length >= 10) {
        const midpoint = Math.floor(values.length / 2);
        const firstHalf = values.slice(0, midpoint);
        const secondHalf = values.slice(midpoint);
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        const percentChange = ((secondAvg - firstAvg) / firstAvg) * 100;

        if (Math.abs(percentChange) > 10) { // Only report significant trends
          insights.trends.push({
            metric: col.name,
            direction: percentChange > 0 ? 'increasing' : 'decreasing',
            percentChange: Math.abs(percentChange),
            type: col.type,
            message: `${col.name} is ${percentChange > 0 ? 'increasing' : 'decreasing'} by ${Math.abs(percentChange).toFixed(1)}% over time`
          });
        }
      }

      // Detect outliers for data quality
      rowData.forEach(item => {
        if (item.value > mean + 3 * stdDev || item.value < mean - 3 * stdDev) {
          insights.dataQuality.outliers.push({
            metric: col.name,
            value: item.value,
            rowNumber: item.rowIndex,
            type: col.type
          });
        }
      });
    });

    // Calculate correlations between metrics (if we have multiple metrics)
    if (detectedColumns.length >= 2) {
      for (let i = 0; i < detectedColumns.length; i++) {
        for (let j = i + 1; j < detectedColumns.length; j++) {
          const col1 = detectedColumns[i];
          const col2 = detectedColumns[j];

          const values1: number[] = [];
          const values2: number[] = [];

          // Collect paired values
          dataRows.forEach(row => {
            const val1 = row[col1.index];
            const val2 = row[col2.index];

            if (val1 && val2) {
              const num1 = parseFloat(String(val1).replace(/[$,]/g, '').trim());
              const num2 = parseFloat(String(val2).replace(/[$,]/g, '').trim());

              if (!isNaN(num1) && !isNaN(num2)) {
                values1.push(num1);
                values2.push(num2);
              }
            }
          });

          if (values1.length >= 5) {
            // Calculate Pearson correlation coefficient
            const mean1 = values1.reduce((a, b) => a + b, 0) / values1.length;
            const mean2 = values2.reduce((a, b) => a + b, 0) / values2.length;

            let numerator = 0;
            let denom1 = 0;
            let denom2 = 0;

            for (let k = 0; k < values1.length; k++) {
              const diff1 = values1[k] - mean1;
              const diff2 = values2[k] - mean2;
              numerator += diff1 * diff2;
              denom1 += diff1 * diff1;
              denom2 += diff2 * diff2;
            }

            const correlation = numerator / Math.sqrt(denom1 * denom2);

            if (Math.abs(correlation) > 0.5) { // Only report meaningful correlations
              insights.correlations.push({
                metric1: col1.name,
                metric2: col2.name,
                correlation: correlation,
                strength: Math.abs(correlation) > 0.8 ? 'strong' : 'moderate',
                direction: correlation > 0 ? 'positive' : 'negative',
                message: `${col1.name} and ${col2.name} have a ${Math.abs(correlation) > 0.8 ? 'strong' : 'moderate'} ${correlation > 0 ? 'positive' : 'negative'} correlation (${(correlation * 100).toFixed(0)}%)`
              });
            }
          }
        }
      }
    }

    // Generate actionable recommendations
    insights.topPerformers.slice(0, 5).forEach((perf: any) => {
      if (perf.percentOfTotal > 20) {
        insights.recommendations.push({
          type: 'opportunity',
          priority: 'high',
          metric: perf.metric,
          message: `Row ${perf.rowNumber} accounts for ${perf.percentOfTotal.toFixed(1)}% of total ${perf.metric}. Consider analyzing what makes this row successful.`,
          action: 'Investigate high performer'
        });
      }
    });

    insights.trends.forEach((trend: any) => {
      if (trend.direction === 'decreasing' && trend.percentChange > 20) {
        insights.recommendations.push({
          type: 'alert',
          priority: 'high',
          metric: trend.metric,
          message: `${trend.metric} has decreased by ${trend.percentChange.toFixed(1)}% over time. Immediate attention may be required.`,
          action: 'Review declining metric'
        });
      } else if (trend.direction === 'increasing' && trend.percentChange > 20) {
        insights.recommendations.push({
          type: 'opportunity',
          priority: 'medium',
          metric: trend.metric,
          message: `${trend.metric} is growing by ${trend.percentChange.toFixed(1)}%. Consider scaling this success.`,
          action: 'Scale successful strategy'
        });
      }
    });

    insights.anomalies.slice(0, 5).forEach((anomaly: any) => {
      insights.recommendations.push({
        type: 'warning',
        priority: 'medium',
        metric: anomaly.metric,
        message: `Row ${anomaly.rowNumber} has an unusual ${anomaly.metric} value. Verify data accuracy.`,
        action: 'Verify data point'
      });
    });

    // Data quality metrics
    insights.dataQuality.completeness = ((totalDataPoints - missingCount) / totalDataPoints) * 100;
    insights.dataQuality.missingValues = missingCount;

    console.log(`💡 Generated ${insights.recommendations.length} recommendations, ${insights.anomalies.length} anomalies, ${insights.correlations.length} correlations`);

    return insights;
  }

  // Get spreadsheet data for a campaign
  app.get("/api/campaigns/:id/google-sheets-data", async (req, res) => {
      const campaignId = req.params.id;
      const { spreadsheetId, view } = req.query; // Optional: fetch from specific spreadsheet or combined view
    try {
      // Handle combined view - aggregate data from all mapped connections
      if (view === 'combined') {
        const allConnections = await storage.getGoogleSheetsConnections(campaignId);
        const mappedConnections = allConnections.filter((conn: any) => {
          if (!conn.columnMappings) return false;
          try {
            const mappings = JSON.parse(conn.columnMappings);
            return Array.isArray(mappings) && mappings.length > 0;
          } catch {
            return false;
          }
        });

        if (mappedConnections.length === 0) {
          return res.json({
            success: true,
            data: [],
            transformedRows: [],
            insights: null,
            matchingInfo: {
              method: 'none',
              matchedCampaigns: [],
              unmatchedCampaigns: [],
              totalFilteredRows: 0,
              totalRows: 0,
              platform: null,
              campaignName: ''
            },
            calculatedConversionValues: [],
            lastUpdated: new Date().toISOString()
          });
        }

        // Aggregate data from all mapped connections
        const aggregatedData: any = {
          allRows: [],
          allHeaders: new Set<string>(),
          sheetBreakdown: [] as any[],
          totalRows: 0,
          totalFilteredRows: 0
        };

        const campaign = await storage.getCampaign(campaignId);
        const campaignName = campaign?.name || '';
        const campaignPlatform = campaign?.platform || null;
        const platformKeywords = campaignPlatform ? getPlatformKeywords(campaignPlatform) : [];

        for (const conn of mappedConnections) {
          try {
            // Refresh token if needed
            let accessToken = conn.accessToken;
            if (!accessToken && conn.refreshToken && conn.clientId && conn.clientSecret) {
              try {
                accessToken = await refreshGoogleSheetsToken(conn);
                await storage.updateGoogleSheetsConnection(conn.id, { accessToken });
              } catch (refreshError) {
                console.warn(`[Combined View] Failed to refresh token for ${conn.spreadsheetId}:`, refreshError);
                continue; // Skip this connection if token refresh fails
              }
            }

            if (!accessToken) {
              console.warn(`[Combined View] No access token for ${conn.spreadsheetId}`);
              continue;
            }

            // Process each connection (similar to single connection logic)
            const range = conn.sheetName ? `${toA1SheetPrefix(conn.sheetName)}A1:Z1000` : 'A1:Z1000';
            let sheetResponse = await fetch(
              `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheetId}/values/${encodeURIComponent(range)}`,
              { headers: { 'Authorization': `Bearer ${accessToken}` } }
            );

            // Retry with refreshed token if 401
            if (sheetResponse.status === 401 && conn.refreshToken) {
              try {
                accessToken = await refreshGoogleSheetsToken(conn);
                await storage.updateGoogleSheetsConnection(conn.id, { accessToken });
                sheetResponse = await fetch(
                  `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheetId}/values/${encodeURIComponent(range)}`,
                  { headers: { 'Authorization': `Bearer ${accessToken}` } }
                );
              } catch (retryError) {
                console.warn(`[Combined View] Retry failed for ${conn.spreadsheetId}:`, retryError);
                continue;
              }
            }

            if (!sheetResponse.ok) {
              console.warn(`[Combined View] Failed to fetch data from ${conn.spreadsheetId}`);
              continue;
            }

            const sheetData = await sheetResponse.json();
            const rows = sheetData.values || [];
            if (rows.length === 0) continue;

            const headers = rows[0] || [];
            headers.forEach((h: string) => aggregatedData.allHeaders.add(h));

            // Determine column indices for filtering
            let campaignNameColumnIndex = -1;
            let platformColumnIndex = -1;

            if (conn.columnMappings) {
              try {
                const mappings = JSON.parse(conn.columnMappings);
                campaignNameColumnIndex = mappings.find((m: any) => m.targetFieldId === 'campaign_name')?.sourceColumnIndex ?? -1;
                platformColumnIndex = mappings.find((m: any) => m.targetFieldId === 'platform')?.sourceColumnIndex ?? -1;
              } catch (e) {
                console.warn(`[Combined View] Failed to parse mappings for ${conn.spreadsheetId}`);
              }
            }

            // Filter rows by campaign name
            const allRows = rows.slice(1);
            let filteredRows: any[] = [];

            if (campaignNameColumnIndex >= 0 && campaignName) {
              if (platformColumnIndex >= 0 && platformKeywords.length > 0) {
                filteredRows = allRows.filter((row: any[]) => {
                  if (!Array.isArray(row) || row.length <= Math.max(platformColumnIndex, campaignNameColumnIndex)) return false;
                  const platformValue = String(row[platformColumnIndex] || '');
                  const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
                  const platformMatches = matchesPlatform(platformValue, platformKeywords);
                  const matchesCampaign = campaignNameValue.includes(campaignName.toLowerCase()) ||
                                         campaignName.toLowerCase().includes(campaignNameValue);
                  return platformMatches && matchesCampaign;
                });
              } else {
                filteredRows = allRows.filter((row: any[]) => {
                  if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) return false;
                  const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
                  return campaignNameValue.includes(campaignName.toLowerCase()) ||
                         campaignName.toLowerCase().includes(campaignNameValue);
                });
              }
            } else if (platformColumnIndex >= 0 && platformKeywords.length > 0) {
              filteredRows = allRows.filter((row: any[]) => {
                if (!Array.isArray(row) || row.length <= platformColumnIndex) return false;
                const platformValue = String(row[platformColumnIndex] || '');
                return matchesPlatform(platformValue, platformKeywords);
              });
            } else {
              filteredRows = allRows;
            }

            aggregatedData.allRows.push(...filteredRows);
            aggregatedData.totalRows += rows.length;
            aggregatedData.totalFilteredRows += filteredRows.length;

            aggregatedData.sheetBreakdown.push({
              spreadsheetId: conn.spreadsheetId,
              spreadsheetName: conn.spreadsheetName,
              sheetName: conn.sheetName,
              rowCount: filteredRows.length,
              totalRows: rows.length
            });
          } catch (error) {
            console.error(`[Combined View] Error processing connection ${conn.id}:`, error);
          }
        }

        // Generate summary from aggregated data
        const headers = Array.from(aggregatedData.allHeaders);
        const summaryMetrics: Record<string, number> = {};
        const detectedColumns: Array<{name: string, index: number, type: string, total: number}> = [];

        // Aggregate numeric columns
        headers.forEach((header: string, index: number) => {
          const headerStr = String(header || '').trim();
          if (!headerStr) return;

          let total = 0;
          let count = 0;
          let hasCurrency = false;
          let hasDecimals = false;

          for (const row of aggregatedData.allRows) {
            const cellValue = row[index];
            if (!cellValue) continue;

            const cellStr = String(cellValue).trim();
            if (cellStr.includes('$') || cellStr.includes('USD')) hasCurrency = true;

            const cleanValue = cellStr.replace(/[$,]/g, '').trim();
            const numValue = parseFloat(cleanValue);

            if (!isNaN(numValue)) {
              total += numValue;
              count++;
              if (cleanValue.includes('.')) hasDecimals = true;
            }
          }

          if (count > 0) {
            summaryMetrics[headerStr] = total;
            detectedColumns.push({
              name: headerStr,
              index,
              type: hasCurrency ? 'currency' : (hasDecimals ? 'decimal' : 'integer'),
              total
            });
          }
        });

        return res.json({
          success: true,
          spreadsheetName: `Combined (${mappedConnections.length} sheets)`,
          spreadsheetId: 'combined',
          totalRows: aggregatedData.totalRows,
          filteredRows: aggregatedData.totalFilteredRows,
          headers: headers,
          data: aggregatedData.allRows,
          summary: {
            metrics: summaryMetrics,
            detectedColumns: detectedColumns,
            totalImpressions: summaryMetrics['Impressions'] || summaryMetrics['impressions'] || 0,
            totalClicks: summaryMetrics['Clicks'] || summaryMetrics['clicks'] || 0,
            totalSpend: summaryMetrics['Spend (USD)'] || summaryMetrics['Budget'] || summaryMetrics['Cost'] || 0,
            averageCTR: (() => {
              const impressions = summaryMetrics['Impressions'] || summaryMetrics['impressions'] || 0;
              const clicks = summaryMetrics['Clicks'] || summaryMetrics['clicks'] || 0;
              return impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0;
            })()
          },
          insights: null, // Could generate insights from aggregated data
          matchingInfo: {
            method: campaignName ? 'campaign_name_platform' : 'all_rows',
            matchedCampaigns: campaignName ? [campaignName] : [],
            unmatchedCampaigns: [],
            totalFilteredRows: aggregatedData.totalFilteredRows,
            totalRows: aggregatedData.totalRows,
            platform: campaignPlatform,
            campaignName: campaignName
          },
          calculatedConversionValues: [], // Would need to recalculate from aggregated data
          sheetBreakdown: aggregatedData.sheetBreakdown,
          lastUpdated: new Date().toISOString()
        });
      }

      // If spreadsheetId is provided, fetch from that specific connection
      // spreadsheetId may be in format "spreadsheetId:sheetName" or "spreadsheetId:connectionId" to distinguish tabs from same spreadsheet
      // Otherwise, use the primary connection
      let connection: any;
      if (spreadsheetId) {
        const spreadsheetIdStr = spreadsheetId as string;
        // Check if it's a composite value (spreadsheetId:sheetName or spreadsheetId:connectionId)
        if (spreadsheetIdStr.includes(':')) {
          const [spreadsheetIdOnly, identifier] = spreadsheetIdStr.split(':');
          // Get all connections for this campaign and find the one matching both spreadsheetId and identifier
          const allConnections = await storage.getGoogleSheetsConnections(campaignId);
          connection = allConnections.find((conn: any) => 
            conn.spreadsheetId === spreadsheetIdOnly && 
            (conn.sheetName === identifier || conn.id === identifier)
          );
        } else {
          // Legacy format - just spreadsheetId (will get first matching connection)
          connection = await storage.getGoogleSheetsConnection(campaignId, spreadsheetIdStr);
        }
      } else {
        connection = await storage.getPrimaryGoogleSheetsConnection(campaignId) || 
                     await storage.getGoogleSheetsConnection(campaignId);
      }
      
      if (!connection) {
        console.log(`[Google Sheets Data] No connection found for campaign ${campaignId} - returning empty data`);
        // Return empty data structure instead of 404 so frontend can handle it gracefully
        return res.json({
          success: true,
          data: [],
          transformedRows: [],
          insights: null,
          matchingInfo: {
            method: 'none',
            matchedCampaigns: [],
            unmatchedCampaigns: [],
            totalFilteredRows: 0,
            totalRows: 0,
            platform: null
          },
          calculatedConversionValues: [], // Empty array - no conversion values
          lastUpdated: new Date().toISOString()
        });
      }
      
      if (!connection.spreadsheetId || connection.spreadsheetId === 'pending') {
        console.error(`[Google Sheets Data] Connection exists but no spreadsheetId for campaign ${campaignId}`);
        return res.status(400).json({ 
          success: false,
          error: "Google Sheets connection exists but no spreadsheet is selected. Please select a spreadsheet in the connection settings.",
          requiresReauthorization: false,
          missingSpreadsheet: true
        });
      }
      
      if (!connection.accessToken) {
        console.error(`[Google Sheets Data] Connection exists but no accessToken for campaign ${campaignId}`);
        // Try to refresh if we have refresh token
        if (connection.refreshToken && connection.clientId && connection.clientSecret) {
          try {
            console.log(`[Google Sheets Data] Attempting to refresh missing access token...`);
            connection.accessToken = await refreshGoogleSheetsToken(connection);
            // Update the connection with the new token
            await storage.updateGoogleSheetsConnection(connection.id, {
              accessToken: connection.accessToken
            });
            console.log(`[Google Sheets Data] ✅ Successfully refreshed access token`);
          } catch (refreshError: any) {
            console.error(`[Google Sheets Data] Token refresh failed:`, refreshError);
            if (refreshError.message === 'REFRESH_TOKEN_EXPIRED') {
              await storage.deleteGoogleSheetsConnection(connection.id);
              return res.status(401).json({ 
                success: false,
                error: 'REFRESH_TOKEN_EXPIRED',
                message: 'Connection expired. Please reconnect your Google Sheets account.',
                requiresReauthorization: true
              });
            }
            return res.status(401).json({ 
              success: false,
              error: 'ACCESS_TOKEN_EXPIRED',
              message: 'Connection expired. Please reconnect your Google Sheets account.',
              requiresReauthorization: true
            });
          }
        } else {
          // No refresh token available, need to reconnect
          console.error(`[Google Sheets Data] No access token and no refresh token available`);
          await storage.deleteGoogleSheetsConnection(connection.id);
          return res.status(401).json({ 
            success: false,
            error: 'ACCESS_TOKEN_EXPIRED',
            message: 'Connection expired. Please reconnect your Google Sheets account.',
            requiresReauthorization: true
          });
        }
      }

      let accessToken = connection.accessToken;

      // Check if token needs refresh (if expired or expiring soon)
      const shouldRefreshToken = (conn: any) => {
        if (!conn.expiresAt && !conn.tokenExpiresAt) return false;
        const expiresAt = conn.expiresAt ? new Date(conn.expiresAt).getTime() : new Date(conn.tokenExpiresAt).getTime();
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        return (expiresAt - now) < fiveMinutes;
      };

      // Proactively refresh token if it's close to expiring
      if (shouldRefreshToken(connection) && connection.refreshToken) {
        console.log('🔄 Token expires soon, proactively refreshing...');
        try {
          accessToken = await refreshGoogleSheetsToken(connection);
          connection.accessToken = accessToken; // Update local reference
        } catch (proactiveRefreshError) {
          console.error('⚠️ Proactive refresh failed, will try reactive refresh if needed:', proactiveRefreshError);
        }
      }

      // Try to fetch spreadsheet data with timeout
      // Use Promise.race for timeout compatibility with older Node.js versions
      const fetchWithTimeout = async (url: string, options: any, timeoutMs: number = 30000) => {
        try {
          // Check if AbortController is available (Node 18+)
          if (typeof AbortController !== 'undefined') {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
            
            try {
              const response = await fetch(url, {
                ...options,
                signal: controller.signal
              });
              clearTimeout(timeoutId);
              return response;
            } catch (error: any) {
              clearTimeout(timeoutId);
              if (error.name === 'AbortError') {
                throw new Error('Request timeout: Google Sheets API did not respond within 30 seconds');
              }
              throw error;
            }
          } else {
            // Fallback for older Node.js versions using Promise.race
            const timeoutPromise = new Promise((_, reject) => {
              setTimeout(() => reject(new Error('Request timeout: Google Sheets API did not respond within 30 seconds')), timeoutMs);
            });
            
            const fetchPromise = fetch(url, options);
            return await Promise.race([fetchPromise, timeoutPromise]) as Response;
          }
        } catch (error: any) {
          if (error.message && error.message.includes('timeout')) {
            throw error;
          }
          throw new Error(`Failed to fetch from Google Sheets API: ${error.message || 'Unknown error'}`);
        }
      };

      // Build range with sheet name if specified
      const range = connection.sheetName ? `${toA1SheetPrefix(connection.sheetName)}A1:Z1000` : 'A1:Z1000';

      let sheetResponse = await fetchWithTimeout(
        `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheetId}/values/${encodeURIComponent(range)}`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } },
        30000 // 30 second timeout
      );

      // If token expired despite proactive refresh, try reactive refresh
      if (sheetResponse.status === 401 && connection.refreshToken) {
        console.log('🔄 Access token expired, attempting automatic refresh...');
        try {
          accessToken = await refreshGoogleSheetsToken(connection);
          
          // Retry the request with new token (using same timeout helper)
          const fetchWithTimeoutRetry = async (url: string, options: any, timeoutMs: number = 30000) => {
            try {
              // Check if AbortController is available (Node 18+)
              if (typeof AbortController !== 'undefined') {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
                
                try {
                  const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                  });
                  clearTimeout(timeoutId);
                  return response;
                } catch (error: any) {
                  clearTimeout(timeoutId);
                  if (error.name === 'AbortError') {
                    throw new Error('Request timeout: Google Sheets API did not respond within 30 seconds');
                  }
                  throw error;
                }
              } else {
                // Fallback for older Node.js versions using Promise.race
                const timeoutPromise = new Promise((_, reject) => {
                  setTimeout(() => reject(new Error('Request timeout: Google Sheets API did not respond within 30 seconds')), timeoutMs);
                });
                
                const fetchPromise = fetch(url, options);
                return await Promise.race([fetchPromise, timeoutPromise]) as Response;
              }
            } catch (error: any) {
              if (error.message && error.message.includes('timeout')) {
                throw error;
              }
              throw new Error(`Failed to fetch from Google Sheets API: ${error.message || 'Unknown error'}`);
            }
          };

          // Build range with sheet name if specified
          const retryRange = connection.sheetName ? `${toA1SheetPrefix(connection.sheetName)}A1:Z1000` : 'A1:Z1000';

          sheetResponse = await fetchWithTimeoutRetry(
            `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheetId}/values/${encodeURIComponent(retryRange)}`,
            { headers: { 'Authorization': `Bearer ${accessToken}` } },
            30000
          );
        } catch (refreshError) {
          console.error('❌ Automatic token refresh failed:', refreshError);
          
          // For persistent connections, we need to handle refresh token expiration
          // by requesting fresh OAuth authorization
          console.log('🔄 Refresh token may have expired, connection needs re-authorization');
          
          // Clear the invalid connection so user can re-authorize
          await storage.deleteGoogleSheetsConnection(campaignId);
          
          return res.status(401).json({ 
            error: 'REFRESH_TOKEN_EXPIRED',
            message: 'Connection expired. Please reconnect your Google Sheets account.',
            requiresReauthorization: true,
            campaignId: campaignId
          });
        }
      }

      if (!sheetResponse.ok) {
        const errorText = await sheetResponse.text();
        let errorData;
        try {
          errorData = JSON.parse(errorText);
        } catch {
          errorData = { error: errorText };
        }
        
        console.error('[Google Sheets Data] Google Sheets API error:', {
          status: sheetResponse.status,
          statusText: sheetResponse.statusText,
          error: errorData,
          spreadsheetId: connection.spreadsheetId
        });
        
        // Handle token expiration - clear invalid connection and require re-authorization
        if (sheetResponse.status === 401) {
          console.log('🔄 Token expired without refresh capability, clearing connection');
          
          // Clear the invalid connection so user can re-authorize  
          await storage.deleteGoogleSheetsConnection(campaignId);
          
          return res.status(401).json({ 
            success: false,
            error: 'ACCESS_TOKEN_EXPIRED',
            message: 'Connection expired. Please reconnect your Google Sheets account.',
            requiresReauthorization: true,
            campaignId: campaignId
          });
        }
        
        // Handle 403 (Forbidden) - might be permissions issue
        if (sheetResponse.status === 403) {
          console.error('[Google Sheets Data] Permission denied - check spreadsheet sharing settings');
          return res.status(403).json({
            success: false,
            error: 'PERMISSION_DENIED',
            message: 'Access denied. Please ensure the Google Sheet is shared with the connected Google account and that the Google Sheets API is enabled.',
            requiresReauthorization: false
          });
        }
        
        // Handle 404 (Not Found) - spreadsheet might be deleted or ID is wrong
        if (sheetResponse.status === 404) {
          console.error('[Google Sheets Data] Spreadsheet not found');
          return res.status(404).json({
            success: false,
            error: 'SPREADSHEET_NOT_FOUND',
            message: 'Spreadsheet not found. The spreadsheet may have been deleted or the ID is incorrect. Please reconnect and select a valid spreadsheet.',
            requiresReauthorization: false,
            missingSpreadsheet: true
          });
        }
        
        // Generic API error
        const errorMessage = errorData.error?.message || errorData.error || errorText || 'Unknown Google Sheets API error';
        throw new Error(`Google Sheets API Error (${sheetResponse.status}): ${errorMessage}`);
      }

      let sheetData;
      try {
        sheetData = await sheetResponse.json();
      } catch (jsonError) {
        console.error('[Google Sheets Data] Failed to parse JSON response:', jsonError);
        const responseText = await sheetResponse.text();
        console.error('[Google Sheets Data] Response text:', responseText.substring(0, 500));
        throw new Error(`Invalid JSON response from Google Sheets API: ${jsonError instanceof Error ? jsonError.message : 'Unknown error'}`);
      }
      
      if (!sheetData || typeof sheetData !== 'object') {
        console.error('[Google Sheets Data] Invalid sheet data structure:', sheetData);
        throw new Error('Invalid data structure received from Google Sheets API');
      }
      
      const rows = sheetData.values || [];
      console.log(`[Google Sheets Data] Received ${rows.length} rows from Google Sheets`);
      
      // Get campaign name for filtering summary data
      const campaign = await storage.getCampaign(campaignId);
      const campaignName = campaign?.name || '';
      const campaignPlatform = campaign?.platform || null;
      
      // Get headers and determine column indices for filtering
      // First check if mappings exist (use mapped columns if available)
      const headers = rows[0] || [];
      let platformColumnIndex = -1;
      let campaignNameColumnIndex = -1;
      
      // Check if mappings exist and use them to find column indices
      if (connection.columnMappings) {
        try {
          const mappings = JSON.parse(connection.columnMappings);
          if (mappings && mappings.length > 0) {
            // Find mapped columns
            const campaignNameMapping = mappings.find((m: any) => m.targetFieldId === 'campaign_name');
            const platformMapping = mappings.find((m: any) => m.targetFieldId === 'platform');
            
            if (campaignNameMapping) {
              campaignNameColumnIndex = campaignNameMapping.sourceColumnIndex;
            }
            if (platformMapping) {
              platformColumnIndex = platformMapping.sourceColumnIndex;
            }
          }
        } catch (mappingError) {
          console.warn('[Google Sheets Summary] Failed to parse mappings, falling back to column detection:', mappingError);
        }
      }
      
      // Fallback to column detection if mappings don't exist or didn't find the columns
      if (campaignNameColumnIndex < 0) {
        campaignNameColumnIndex = headers.findIndex((h: string) => 
          String(h || '').toLowerCase().includes('campaign name')
        );
      }
      if (platformColumnIndex < 0) {
        platformColumnIndex = headers.findIndex((h: string) => 
          String(h || '').toLowerCase().includes('platform')
        );
      }
      
      // Get platform keywords for filtering
      const platformKeywords = campaignPlatform ? getPlatformKeywords(campaignPlatform) : [];
      
      // Filter rows by campaign name (and platform if available) for summary
      let filteredRowsForSummary: any[] = [];
      const allRows = rows.slice(1); // Skip header row
      
      if (campaignNameColumnIndex >= 0 && campaignName) {
        // Filter by campaign name (and platform if available)
        if (platformColumnIndex >= 0 && platformKeywords.length > 0) {
          // Strategy 1: Campaign Name + Platform matching
          filteredRowsForSummary = allRows.filter((row: any[]) => {
            if (!Array.isArray(row) || row.length <= Math.max(platformColumnIndex, campaignNameColumnIndex)) {
              return false;
            }
            const platformValue = String(row[platformColumnIndex] || '');
            const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
            const platformMatches = matchesPlatform(platformValue, platformKeywords);
            const matchesCampaign = campaignNameValue.includes(campaignName.toLowerCase()) ||
                                   campaignName.toLowerCase().includes(campaignNameValue);
            return platformMatches && matchesCampaign;
          });
        } else {
          // Strategy 2: Campaign Name only
          filteredRowsForSummary = allRows.filter((row: any[]) => {
            if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) {
              return false;
            }
            const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
            return campaignNameValue.includes(campaignName.toLowerCase()) ||
                   campaignName.toLowerCase().includes(campaignNameValue);
          });
        }
      } else if (platformColumnIndex >= 0 && platformKeywords.length > 0) {
        // Strategy 3: Platform only (if no campaign name column or campaign name)
        filteredRowsForSummary = allRows.filter((row: any[]) => {
          if (!Array.isArray(row) || row.length <= platformColumnIndex) {
            return false;
          }
          const platformValue = String(row[platformColumnIndex] || '');
          return matchesPlatform(platformValue, platformKeywords);
        });
      } else {
        // Strategy 4: Use all rows (no filtering possible)
        filteredRowsForSummary = allRows;
      }
      
      // Use filtered rows for summary if we have a campaign name match, otherwise use all rows
      const rowsForSummary = filteredRowsForSummary.length > 0 && campaignNameColumnIndex >= 0 && campaignName
        ? filteredRowsForSummary
        : allRows;
      
      console.log(`[Google Sheets Summary] Using ${rowsForSummary.length} rows for summary (filtered by campaign name "${campaignName}") out of ${allRows.length} total rows`);
      
      // Process spreadsheet data to extract campaign metrics (using filtered rows for summary, but show all rows in table)
      let campaignData = {
        totalRows: rows.length, // Keep original total for reference
        filteredRows: rowsForSummary.length, // Number of rows used for summary
        headers: headers,
        data: allRows, // Show all rows in the table (not filtered)
        sampleData: rowsForSummary.slice(0, 6), // First 5 filtered data rows
        metrics: {} as Record<string, number>,
        detectedColumns: [] as Array<{name: string, index: number, type: string, total: number}>
      };

      // Dynamically detect and aggregate numeric columns from FILTERED rows
      if (rowsForSummary.length > 0 && headers.length > 0) {
        console.log('📊 Detected spreadsheet headers:', headers);
        
        // First pass: Identify which columns contain numeric data
        const numericColumns: Array<{name: string, index: number, type: 'currency' | 'integer' | 'decimal', samples: number[]}> = [];
        
        headers.forEach((header: string, index: number) => {
          const headerStr = String(header || '').trim();
          if (!headerStr) return; // Skip empty headers
          
          // Sample first 5 filtered data rows to determine if column is numeric
          const samples: number[] = [];
          let hasNumericData = false;
          let hasCurrency = false;
          let hasDecimals = false;
          
          for (let i = 0; i < Math.min(6, rowsForSummary.length); i++) {
            const cellValue = rowsForSummary[i]?.[index];
            if (!cellValue) continue;
            
            const cellStr = String(cellValue).trim();
            if (cellStr.includes('$') || cellStr.includes('USD')) hasCurrency = true;
            
            // Clean and parse the value
            const cleanValue = cellStr.replace(/[$,]/g, '').trim();
            const numValue = parseFloat(cleanValue);
            
            if (!isNaN(numValue)) {
              samples.push(numValue);
              hasNumericData = true;
              if (cleanValue.includes('.')) hasDecimals = true;
            }
          }
          
          if (hasNumericData && samples.length > 0) {
            const type = hasCurrency ? 'currency' : (hasDecimals ? 'decimal' : 'integer');
            numericColumns.push({ name: headerStr, index, type, samples });
          }
        });
        
        console.log(`✅ Detected ${numericColumns.length} numeric columns:`, 
          numericColumns.map(col => `"${col.name}" (${col.type})`).join(', ')
        );
        
        // Second pass: Aggregate numeric columns from FILTERED rows only
        numericColumns.forEach(col => {
          let total = 0;
          let count = 0;
          
          for (let i = 0; i < rowsForSummary.length; i++) {
            const cellValue = rowsForSummary[i]?.[col.index];
            if (!cellValue) continue;
            
            const cleanValue = String(cellValue).replace(/[$,]/g, '').trim();
            const numValue = parseFloat(cleanValue);
            
            if (!isNaN(numValue)) {
              total += numValue;
              count++;
            }
          }
          
          if (count > 0) {
            campaignData.metrics[col.name] = total;
            campaignData.detectedColumns.push({
              name: col.name,
              index: col.index,
              type: col.type,
              total: total
            });
            
            console.log(`  ✓ ${col.name}: ${total.toLocaleString()} (${count} filtered rows)`);
          }
        });
        
        console.log(`📊 Successfully aggregated ${campaignData.detectedColumns.length} metrics from ${rowsForSummary.length} filtered rows (campaign: "${campaignName}")`);
      }

      // Generate intelligent insights from the filtered data
      let insights;
      try {
        // Use filtered rows + header for insights generation
        const rowsForInsights = [headers, ...rowsForSummary];
        insights = generateInsights(rowsForInsights, campaignData.detectedColumns, campaignData.metrics);
      } catch (insightsError) {
        console.error('[Google Sheets Data] Error generating insights:', insightsError);
        // Don't fail the request if insights generation fails
        insights = {
          topPerformers: [],
          bottomPerformers: [],
          anomalies: [],
          trends: [],
          correlations: [],
          recommendations: [],
          dataQuality: {
            completeness: 0,
            missingValues: 0,
            outliers: []
          }
        };
      }

      // Automatic Conversion Value Calculation from Google Sheets - DISABLED
      // Enable automatic conversion value calculation after mappings are saved
      const AUTO_CALCULATE_CONVERSION_VALUE = true;
      
      // Initialize calculatedConversionValues and matchingInfo (needed for response even when auto-calculation is disabled)
      let calculatedConversionValues: Array<{platform: string, conversionValue: string, revenue: number, conversions: number}> = [];
      let matchingInfo = {
        method: 'all_rows',
        matchedCampaigns: [] as string[],
        unmatchedCampaigns: [] as string[],
        totalFilteredRows: 0,
        totalRows: 0,
        platform: null as string | null
      };
      
      if (AUTO_CALCULATE_CONVERSION_VALUE) {
      // Automatic Conversion Value Calculation from Google Sheets
      // NEW: Calculates conversion value for EACH connected platform separately
      // If Revenue and Conversions columns are detected, calculate and save conversion value per platform
      // Smart matching: Campaign Name + Platform (best) → Platform only (fallback) → All rows (last resort)
      // NOW SUPPORTS MULTI-PLATFORM: LinkedIn, Google Ads, Facebook Ads, Twitter Ads, etc.
      
      try {
        // Campaign name and platform already fetched above for summary filtering
        // Reuse them here for conversion value calculation
        
        // Get ALL platform connections for this campaign to calculate conversion value for each
        const linkedInConnection = await storage.getLinkedInConnection(campaignId).catch(() => null);
        const metaConnection = await storage.getMetaConnection(campaignId).catch(() => null);
        // TODO: Add other platform connections when implemented (Google Ads, Twitter, etc.)
        
        // Determine which platforms are connected
        const connectedPlatforms: Array<{platform: string, connection: any, keywords: string[]}> = [];
        if (linkedInConnection) {
          connectedPlatforms.push({
            platform: 'linkedin',
            connection: linkedInConnection,
            keywords: getPlatformKeywords('linkedin')
          });
        }
        if (metaConnection) {
          connectedPlatforms.push({
            platform: 'facebook_ads',
            connection: metaConnection,
            keywords: getPlatformKeywords('facebook_ads')
          });
        }
        
        // Get platform keywords for matching (use campaign platform as primary, but calculate for all)
        const platformKeywords = getPlatformKeywords(campaignPlatform);
        const platformDisplayName = campaignPlatform || 'unknown';
        
        const headers = campaignData.headers || [];
        const platformColumnIndex = headers.findIndex((h: string) => 
          String(h || '').toLowerCase().includes('platform')
        );
        const campaignNameColumnIndex = headers.findIndex((h: string) => 
          String(h || '').toLowerCase().includes('campaign name')
        );
        
        let filteredRows: any[] = [];
        let allRows = rows.slice(1); // Skip header row
        let matchingMethod = 'all_rows'; // Track which method was used
        let matchedCampaigns: string[] = [];
        let unmatchedCampaigns: string[] = [];
        
        // Strategy 1: Campaign Name + Platform matching (most accurate)
        if (platformColumnIndex >= 0 && campaignNameColumnIndex >= 0 && campaignName && platformKeywords.length > 0) {
          filteredRows = allRows.filter((row: any[]) => {
            const platformValue = String(row[platformColumnIndex] || '');
            const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
            const platformMatches = matchesPlatform(platformValue, platformKeywords);
            const matchesCampaign = campaignNameValue.includes(campaignName.toLowerCase()) ||
                                   campaignName.toLowerCase().includes(campaignNameValue);
            return platformMatches && matchesCampaign;
          });
          
          if (filteredRows.length > 0) {
            matchingMethod = 'campaign_name_platform';
            // Collect matched and unmatched campaign names for feedback (for this platform only)
            const uniqueCampaignNames = new Set<string>();
            allRows.forEach((row: any[]) => {
              // Safety check: ensure row is an array and has enough elements
              if (!Array.isArray(row) || row.length <= Math.max(platformColumnIndex, campaignNameColumnIndex)) {
                return;
              }
              
              const platformValue = String(row[platformColumnIndex] || '');
              const campaignNameValue = String(row[campaignNameColumnIndex] || '').trim();
              if (matchesPlatform(platformValue, platformKeywords) && campaignNameValue) {
                uniqueCampaignNames.add(campaignNameValue);
              }
            });
            
            filteredRows.forEach((row: any[]) => {
              // Safety check: ensure row is an array and has enough elements
              if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) {
                return;
              }
              
              const name = String(row[campaignNameColumnIndex] || '').trim();
              if (name && !matchedCampaigns.includes(name)) matchedCampaigns.push(name);
            });
            
            Array.from(uniqueCampaignNames).forEach(name => {
              if (!matchedCampaigns.includes(name)) unmatchedCampaigns.push(name);
            });
            
            console.log(`[Auto Conversion Value] ✅ Campaign Name + Platform matching: Found ${filteredRows.length} matching ${platformDisplayName} rows for "${campaignName}"`);
            console.log(`[Auto Conversion Value] Matched campaigns: ${matchedCampaigns.join(', ')}`);
            if (unmatchedCampaigns.length > 0) {
              console.log(`[Auto Conversion Value] Other ${platformDisplayName} campaigns found: ${unmatchedCampaigns.join(', ')}`);
            }
          }
        }
        
        // Strategy 2: Platform-only filtering (fallback)
        if (filteredRows.length === 0 && platformColumnIndex >= 0 && platformKeywords.length > 0) {
          filteredRows = allRows.filter((row: any[]) => {
            // Safety check: ensure row is an array and has enough elements
            if (!Array.isArray(row) || row.length <= platformColumnIndex) {
              return false;
            }
            
            const platformValue = String(row[platformColumnIndex] || '');
            return matchesPlatform(platformValue, platformKeywords);
          });
          
          if (filteredRows.length > 0) {
            matchingMethod = 'platform_only';
            // Collect all platform campaign names for feedback
            if (campaignNameColumnIndex >= 0) {
              const uniqueCampaignNames = new Set<string>();
              filteredRows.forEach((row: any[]) => {
                // Safety check: ensure row is an array and has enough elements
                if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) {
                  return;
                }
                
                const name = String(row[campaignNameColumnIndex] || '').trim();
                if (name) uniqueCampaignNames.add(name);
              });
              unmatchedCampaigns = Array.from(uniqueCampaignNames);
            }
            
            console.log(`[Auto Conversion Value] ⚠️ Platform-only matching: Using ${filteredRows.length} ${platformDisplayName} rows (no Campaign Name match found)`);
            console.log(`[Auto Conversion Value] Campaign "${campaignName}" not found in Google Sheets. Found ${unmatchedCampaigns.length} unique ${platformDisplayName} campaign name(s): ${unmatchedCampaigns.join(', ')}`);
            if (unmatchedCampaigns.length > 0) {
              console.log(`[Auto Conversion Value] Found ${platformDisplayName} campaigns: ${unmatchedCampaigns.join(', ')}`);
            }
          } else {
            console.log(`[Auto Conversion Value] Platform column detected but no ${platformDisplayName} rows found. Using all rows.`);
            filteredRows = allRows; // Fallback to all rows if no platform match found
            matchingMethod = 'all_rows';
          }
        }
        
        // Strategy 3: All rows (last resort)
        if (filteredRows.length === 0) {
          filteredRows = allRows;
          matchingMethod = 'all_rows';
          if (campaignPlatform) {
            console.log(`[Auto Conversion Value] ℹ️ No Platform column detected or no ${platformDisplayName} match. Using all rows.`);
          } else {
            console.log(`[Auto Conversion Value] ℹ️ No Platform column detected and campaign has no platform set. Using all rows.`);
          }
        }
        
        // Update matchingInfo with final results
        matchingInfo = {
          method: matchingMethod,
          matchedCampaigns: matchedCampaigns,
          unmatchedCampaigns: unmatchedCampaigns,
          totalFilteredRows: filteredRows.length,
          totalRows: allRows.length,
          platform: campaignPlatform,
          campaignName: campaignName // Include campaign name for UI display
        };
        
        // Check if mappings exist for this connection (flexible mapping system)
        let useMappings = false;
        let mappings: any[] = [];
        let transformedRows: any[] = [];
        
        if (connection.columnMappings) {
          try {
            mappings = JSON.parse(connection.columnMappings);
            if (mappings && mappings.length > 0) {
              useMappings = true;
              console.log(`[Auto Conversion Value] Using saved column mappings (${mappings.length} mappings)`);
              
              // Transform data using mappings
              const transformationResult = transformData(rows, mappings, campaignPlatform || 'linkedin');
              transformedRows = transformationResult.transformedRows;
              
              if (transformationResult.errors.length > 0) {
                console.warn(`[Auto Conversion Value] Transformation errors:`, transformationResult.errors.slice(0, 5));
              }
              
              // Phase 4: Enrich data with context
              const enrichmentContext = {
                campaignName: campaignName || '',
                platform: campaignPlatform || 'linkedin',
                hasLinkedInApi: campaignPlatform?.toLowerCase() === 'linkedin'
              };
              transformedRows = enrichRows(transformedRows, enrichmentContext);
              
              // Phase 6: Convert to canonical format
              transformedRows = toCanonicalFormatBatch(transformedRows, 'google_sheets', 0.9);
              
              console.log(`[Auto Conversion Value] Transformed ${transformedRows.length} rows using mappings`);
            }
          } catch (mappingError) {
            console.warn(`[Auto Conversion Value] Failed to parse mappings, falling back to column detection:`, mappingError);
          }
        }
        
        // Find Revenue and Conversions column indices (fallback for non-mapped data)
        const revenueColumnIndex = headers.findIndex((h: string) => {
          const header = String(h || '').toLowerCase();
          return header.includes('revenue') || header.includes('sales revenue') || header.includes('revenue amount');
        });
        
        const conversionsColumnIndex = headers.findIndex((h: string) => {
          const header = String(h || '').toLowerCase();
          return header.includes('conversion') || header.includes('order') || header.includes('purchase');
        });
        
        // NEW APPROACH: Calculate conversion value for EACH connected platform separately
        // This ensures each platform gets its own accurate conversion value
        // Reset calculatedConversionValues for this calculation
        calculatedConversionValues = [];
        
        // Helper function to get LinkedIn API conversions for a campaign
        const getLinkedInApiConversions = async (campaignId: string): Promise<number | null> => {
          try {
            const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
            if (sessions && sessions.length > 0) {
              const latestSession = sessions.sort((a: any, b: any) => 
                new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
              )[0];
              const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
              
              const normalizeMetricKey = (key: any) =>
                String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

              // Sum all conversions from LinkedIn metrics (handle key variants)
              const totalConversions = metrics.reduce((sum: number, m: any) => {
                const k = normalizeMetricKey(m.metricKey);
                if (k === 'conversions' || k === 'externalwebsiteconversions') {
                  return sum + (parseFloat(m.metricValue || '0') || 0);
                }
                return sum;
              }, 0);
              
              return totalConversions > 0 ? totalConversions : null;
            }
          } catch (error) {
            console.warn(`[Auto Conversion Value] Could not fetch LinkedIn API conversions:`, error);
          }
          return null;
        };

        // Use mapped data if available, otherwise use column indices
        if (useMappings && transformedRows.length > 0) {
          // Use transformed data with mappings
          for (const platformInfo of connectedPlatforms) {
            try {
              // Filter transformed rows by platform and campaign (Phase 5: Enhanced with fuzzy matching)
              const platformRows = filterRowsByCampaignAndPlatform(
                transformedRows,
                campaignName,
                platformInfo.platform,
                {
                  fuzzyMatch: true,
                  minSimilarity: 0.8,
                  contextAware: true
                }
              );
              
              if (platformRows.length > 0) {
                // Get LinkedIn API conversions if this is a LinkedIn campaign
                let linkedInConversions: number | null = null;
                let conversionSource = 'Google Sheets';
                if (platformInfo.platform === 'linkedin') {
                  linkedInConversions = await getLinkedInApiConversions(campaignId);
                  if (linkedInConversions !== null && linkedInConversions > 0) {
                    conversionSource = 'LinkedIn API';
                  }
                }
                
                // Calculate conversion value from transformed data
                // Use LinkedIn API conversions if available, otherwise use Google Sheets conversions
                const conversionValue = calculateConversionValue(platformRows, linkedInConversions);
                
                if (conversionValue !== null) {
                  const totalRevenue = platformRows.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
                  const conversionsUsed = linkedInConversions !== null && linkedInConversions > 0 
                    ? linkedInConversions 
                    : platformRows.reduce((sum, row) => sum + (parseInt(row.conversions) || 0), 0);
                  
                  console.log(`[Auto Conversion Value] ${platformInfo.platform.toUpperCase()} (Mapped): Revenue: $${totalRevenue.toLocaleString()}, Conversions: ${conversionsUsed.toLocaleString()} (${conversionSource}), CV: $${conversionValue.toFixed(2)}`);
                  
                  calculatedConversionValues.push({
                    platform: platformInfo.platform,
                    conversionValue: conversionValue.toFixed(2),
                    revenue: totalRevenue,
                    conversions: conversionsUsed
                  });
                  
                  // DO NOT update platform connection - it will be cleared if needed by the analytics endpoint
                  console.log(`[Auto Conversion Value] ℹ️ Skipping platform connection update (managed by analytics endpoint)`);
                  // Platform connection values are managed by the LinkedIn Analytics endpoint
                  // which checks for active mappings and clears stale values
                }
              }
            } catch (platformError) {
              console.warn(`[Auto Conversion Value] Could not calculate conversion value for ${platformInfo.platform}:`, platformError);
            }
          }
        } else if (revenueColumnIndex >= 0 && conversionsColumnIndex >= 0 && platformColumnIndex >= 0) {
          // Fallback to existing column-based logic
          // Calculate conversion value for each connected platform
          for (const platformInfo of connectedPlatforms) {
            try {
              // Filter rows for this specific platform
              let platformRows = allRows.filter((row: any[]) => {
                // Safety check: ensure row is an array and has enough elements
                if (!Array.isArray(row) || row.length <= platformColumnIndex) {
                  return false;
                }
                
                const platformValue = String(row[platformColumnIndex] || '');
                return matchesPlatform(platformValue, platformInfo.keywords);
              });
              
              // Further filter by campaign name if available
              if (campaignNameColumnIndex >= 0 && campaignName) {
                platformRows = platformRows.filter((row: any[]) => {
                  // Safety check: ensure row is an array and has enough elements
                  if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) {
                    return false;
                  }
                  
                  const campaignNameValue = String(row[campaignNameColumnIndex] || '').toLowerCase();
                  return campaignNameValue.includes(campaignName.toLowerCase()) ||
                         campaignName.toLowerCase().includes(campaignNameValue);
                });
              }
              
              if (platformRows.length > 0) {
                // Calculate revenue from Google Sheets
                let platformRevenue = 0;
                let platformConversions = 0;
                
                platformRows.forEach((row: any[]) => {
                  // Safety check: ensure row is an array and has enough elements
                  if (!Array.isArray(row) || row.length <= Math.max(revenueColumnIndex, conversionsColumnIndex)) {
                    return; // Skip invalid rows
                  }
                  
                  const revenueValue = String(row[revenueColumnIndex] || '').replace(/[$,]/g, '').trim();
                  const revenue = parseFloat(revenueValue) || 0;
                  platformRevenue += revenue;
                  
                  const conversionsValue = String(row[conversionsColumnIndex] || '').replace(/[$,]/g, '').trim();
                  const conversions = parseFloat(conversionsValue) || 0;
                  platformConversions += conversions;
                });
                
                // Get LinkedIn API conversions if this is a LinkedIn campaign
                let linkedInConversions: number | null = null;
                let conversionSource = 'Google Sheets';
                if (platformInfo.platform === 'linkedin') {
                  linkedInConversions = await getLinkedInApiConversions(campaignId);
                  if (linkedInConversions !== null && linkedInConversions > 0) {
                    conversionSource = 'LinkedIn API';
                  }
                }
                
                // Use LinkedIn API conversions if available, otherwise use Google Sheets conversions
                const conversionsToUse = (linkedInConversions !== null && linkedInConversions > 0) 
                  ? linkedInConversions 
                  : platformConversions;
                
                if (platformRevenue > 0 && conversionsToUse > 0) {
                  const platformConversionValue = (platformRevenue / conversionsToUse).toFixed(2);
                  
                  console.log(`[Auto Conversion Value] ${platformInfo.platform.toUpperCase()}: Revenue: $${platformRevenue.toLocaleString()}, Conversions: ${conversionsToUse.toLocaleString()} (${conversionSource}), CV: $${platformConversionValue}`);
                  
                  // Store calculated value for response
                  calculatedConversionValues.push({
                    platform: platformInfo.platform,
                    conversionValue: platformConversionValue,
                    revenue: platformRevenue,
                    conversions: conversionsToUse
                  });
                  
                  // DO NOT update platform connection - it will be cleared if needed by the analytics endpoint
                  console.log(`[Auto Conversion Value] ℹ️ Skipping platform connection update (managed by analytics endpoint)`);
                  // Platform connection values are managed by the LinkedIn Analytics endpoint
                  // which checks for active mappings and clears stale values
                  if (false) { // Disabled - causes race condition with clearing logic
                  if (platformInfo.platform === 'linkedin' && linkedInConnection) {
                    await storage.updateLinkedInConnection(campaignId, {
                      conversionValue: platformConversionValue
                    });
                    console.log(`[Auto Conversion Value] ✅ Updated LinkedIn connection conversion value to $${platformConversionValue} (using ${conversionSource} conversions)`);
                  } else if (platformInfo.platform === 'facebook_ads' && metaConnection) {
                    await storage.updateMetaConnection(campaignId, {
                      conversionValue: platformConversionValue
                    });
                    console.log(`[Auto Conversion Value] ✅ Updated Meta/Facebook connection conversion value to $${platformConversionValue}`);
                    }
                  }
                } else {
                  console.log(`[Auto Conversion Value] ${platformInfo.platform.toUpperCase()}: No revenue/conversions data found`);
                }
              } else {
                console.log(`[Auto Conversion Value] ${platformInfo.platform.toUpperCase()}: No matching rows found in Google Sheets`);
              }
            } catch (platformError) {
              console.warn(`[Auto Conversion Value] Could not calculate conversion value for ${platformInfo.platform}:`, platformError);
            }
          }
        }
        
        // Update campaign-level conversion value ONLY if exactly ONE platform is connected
        // If multiple platforms are connected, leave it blank to avoid confusion
        // Each platform connection maintains its own conversionValue for accurate revenue calculations
        if (connectedPlatforms.length === 1) {
          // Only one platform connected - safe to update campaign-level value
          let totalRevenue = 0;
          let totalConversions = 0;
          
          // Calculate from filtered platform rows (based on campaign.platform)
          if (revenueColumnIndex >= 0 && conversionsColumnIndex >= 0) {
            filteredRows.forEach((row: any[]) => {
              // Safety check: ensure row is an array and has enough elements
              if (!Array.isArray(row) || row.length <= Math.max(revenueColumnIndex, conversionsColumnIndex)) {
                return; // Skip invalid rows
              }
              
              const revenueValue = String(row[revenueColumnIndex] || '').replace(/[$,]/g, '').trim();
              const revenue = parseFloat(revenueValue) || 0;
              totalRevenue += revenue;
              
              const conversionsValue = String(row[conversionsColumnIndex] || '').replace(/[$,]/g, '').trim();
              const conversions = parseFloat(conversionsValue) || 0;
              totalConversions += conversions;
            });
            
            // Get LinkedIn API conversions if this is a LinkedIn campaign
            let linkedInConversions: number | null = null;
            let conversionSource = 'Google Sheets';
            if (connectedPlatforms[0]?.platform === 'linkedin') {
              linkedInConversions = await getLinkedInApiConversions(campaignId);
              if (linkedInConversions !== null && linkedInConversions > 0) {
                conversionSource = 'LinkedIn API';
              }
            }
            
            // Use LinkedIn API conversions if available, otherwise use Google Sheets conversions
            const conversionsToUse = (linkedInConversions !== null && linkedInConversions > 0) 
              ? linkedInConversions 
              : totalConversions;
            
            const platformLabel = campaignPlatform ? `${campaignPlatform} ` : '';
            console.log(`[Auto Conversion Value] Campaign-level: Calculated from ${filteredRows.length} ${platformLabel}rows: Revenue: $${totalRevenue.toLocaleString()}, Conversions: ${conversionsToUse.toLocaleString()} (${conversionSource})`);
          } else {
            // Fallback: Try to find from aggregated metrics (if Platform filtering wasn't possible)
            const revenueKeys = ['Revenue', 'revenue', 'Total Revenue', 'total revenue', 'Revenue (USD)', 'Sales Revenue', 'Revenue Amount'];
            const conversionsKeys = ['Conversions', 'conversions', 'Total Conversions', 'total conversions', 'Orders', 'orders', 'Purchases', 'purchases'];
            
            // Find revenue value from aggregated metrics
            for (const key of revenueKeys) {
              if (campaignData.metrics[key] !== undefined) {
                totalRevenue = parseFloat(String(campaignData.metrics[key])) || 0;
                if (totalRevenue > 0) break;
              }
            }
            
            // Find conversions value from aggregated metrics
            for (const key of conversionsKeys) {
              if (campaignData.metrics[key] !== undefined) {
                totalConversions = parseFloat(String(campaignData.metrics[key])) || 0;
                if (totalConversions > 0) break;
              }
            }
            
            // Get LinkedIn API conversions if this is a LinkedIn campaign
            let linkedInConversions: number | null = null;
            let conversionSource = 'Google Sheets';
            if (connectedPlatforms[0]?.platform === 'linkedin') {
              linkedInConversions = await getLinkedInApiConversions(campaignId);
              if (linkedInConversions !== null && linkedInConversions > 0) {
                conversionSource = 'LinkedIn API';
              }
            }
            
            // Use LinkedIn API conversions if available, otherwise use Google Sheets conversions
            const conversionsToUse = (linkedInConversions !== null && linkedInConversions > 0) 
              ? linkedInConversions 
              : totalConversions;
            
            if (totalRevenue > 0 || conversionsToUse > 0) {
              console.log(`[Auto Conversion Value] Using aggregated metrics (not filtered by Platform): Revenue: $${totalRevenue.toLocaleString()}, Conversions: ${conversionsToUse.toLocaleString()} (${conversionSource})`);
            }
          }
          
          // Get LinkedIn API conversions for final calculation (if not already fetched)
          let finalLinkedInConversions: number | null = null;
          let finalConversionSource = 'Google Sheets';
          if (connectedPlatforms[0]?.platform === 'linkedin') {
            finalLinkedInConversions = await getLinkedInApiConversions(campaignId);
            if (finalLinkedInConversions !== null && finalLinkedInConversions > 0) {
              finalConversionSource = 'LinkedIn API';
            }
          }
          
          // Use LinkedIn API conversions if available, otherwise use Google Sheets conversions
          const finalConversions = (finalLinkedInConversions !== null && finalLinkedInConversions > 0) 
            ? finalLinkedInConversions 
            : totalConversions;
          
          // Update campaign conversion value (only when single platform)
          if (totalRevenue > 0 && finalConversions > 0) {
            const calculatedConversionValue = (totalRevenue / finalConversions).toFixed(2);
            
            console.log(`[Auto Conversion Value] Campaign-level: Revenue: $${totalRevenue.toLocaleString()}, Conversions: ${finalConversions.toLocaleString()} (${finalConversionSource}), CV: $${calculatedConversionValue}`);
            
            const updatedCampaign = await storage.updateCampaign(campaignId, {
              conversionValue: calculatedConversionValue
            });
            
            if (updatedCampaign) {
              console.log(`[Auto Conversion Value] ✅ Updated campaign ${campaignId} conversion value to $${calculatedConversionValue} (single platform, using ${finalConversionSource} conversions)`);
            }
            
            // Also update LinkedIn import sessions if they exist AND campaign is LinkedIn (for consistency)
            if (campaignPlatform && campaignPlatform.toLowerCase() === 'linkedin') {
              try {
                const linkedInSessions = await storage.getCampaignLinkedInImportSessions(campaignId);
                if (linkedInSessions && linkedInSessions.length > 0) {
                  const latestSession = linkedInSessions.sort((a, b) => 
                    new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
                  )[0];
                  
                  await storage.updateLinkedInImportSession(latestSession.id, {
                    conversionValue: calculatedConversionValue
                  });
                  
                  console.log(`[Auto Conversion Value] ✅ Updated LinkedIn import session ${latestSession.id} conversion value to $${calculatedConversionValue}`);
                }
              } catch (sessionError) {
                console.warn(`[Auto Conversion Value] Could not update LinkedIn sessions:`, sessionError);
              }
            }
          }
        } else if (connectedPlatforms.length > 1) {
          // Multiple platforms connected - leave campaign.conversionValue blank to avoid confusion
          // Each platform connection has its own conversionValue
          console.log(`[Auto Conversion Value] ℹ️ Multiple platforms connected (${connectedPlatforms.length}). Leaving campaign.conversionValue blank. Each platform has its own conversion value.`);
          
          // Optionally clear the campaign-level value if it was previously set
          const currentCampaign = await storage.getCampaign(campaignId);
          if (currentCampaign?.conversionValue) {
            await storage.updateCampaign(campaignId, {
              conversionValue: null
            });
            console.log(`[Auto Conversion Value] ℹ️ Cleared campaign.conversionValue (multiple platforms detected)`);
          }
        } else {
          if (totalRevenue === 0 && totalConversions === 0) {
            console.log(`[Auto Conversion Value] ℹ️ No Revenue or Conversions columns detected in Google Sheets`);
          } else if (totalRevenue === 0) {
            console.log(`[Auto Conversion Value] ℹ️ Revenue column not found (Conversions: ${totalConversions})`);
          } else if (totalConversions === 0) {
            console.log(`[Auto Conversion Value] ℹ️ Conversions column not found (Revenue: $${totalRevenue})`);
          }
        }
      } catch (calcError) {
        console.error(`[Auto Conversion Value] ❌ Error calculating conversion value:`, calcError);
        // Don't fail the request if auto-calculation fails
      }
      } // End of AUTO_CALCULATE_CONVERSION_VALUE check

      res.json({
        success: true,
        spreadsheetName: connection.spreadsheetName || connection.spreadsheetId,
        spreadsheetId: connection.spreadsheetId,
        totalRows: campaignData.totalRows,
        filteredRows: campaignData.filteredRows,
        headers: campaignData.headers,
        data: campaignData.data,
        summary: {
          metrics: campaignData.metrics,
          detectedColumns: campaignData.detectedColumns,
          // Legacy fields for backward compatibility
          totalImpressions: campaignData.metrics['Impressions'] || campaignData.metrics['impressions'] || 0,
          totalClicks: campaignData.metrics['Clicks'] || campaignData.metrics['clicks'] || 0,
          totalSpend: campaignData.metrics['Spend (USD)'] || campaignData.metrics['Budget'] || campaignData.metrics['Cost'] || 0,
          averageCTR: (() => {
            const impressions = campaignData.metrics['Impressions'] || campaignData.metrics['impressions'] || 0;
            const clicks = campaignData.metrics['Clicks'] || campaignData.metrics['clicks'] || 0;
            return impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : 0;
          })()
        },
        insights: insights,
        matchingInfo: matchingInfo, // Add matching information for UX feedback
        calculatedConversionValues: calculatedConversionValues, // Add calculated conversion values per platform
        lastUpdated: new Date().toISOString()
      });

    } catch (error) {
      console.error('[Google Sheets Data] ❌ Error fetching data:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[Google Sheets Data] Error details:', {
        campaignId,
        error: errorMessage,
        stack: errorStack ? errorStack.split('\n').slice(0, 5).join('\n') : undefined
      });
      
      // CRITICAL: Ensure we always send a response, even if headers were already sent
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          error: 'Failed to fetch Google Sheets data',
          message: errorMessage,
          // Only include stack in development
          ...(process.env.NODE_ENV === 'development' && errorStack ? { details: errorStack } : {})
        });
      } else {
        // If headers were already sent, log the error but can't send response
        console.error('[Google Sheets Data] ⚠️ Response already sent, cannot send error response');
      }
    }
  });

  // Google Trends API endpoint
  app.get("/api/campaigns/:id/google-trends", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get campaign to access industry and keywords
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }
      
      const keywords = (campaign as any).trendKeywords || [];
      const industry = (campaign as any).industry;
      
      if (!keywords || keywords.length === 0) {
        return res.status(400).json({ 
          message: "No trend keywords configured for this campaign",
          suggestion: "Add industry keywords to track market trends"
        });
      }
      
      // Check for SerpAPI key
      const apiKey = process.env.SERPAPI_API_KEY;
      if (!apiKey) {
        return res.status(500).json({ 
          message: "SerpAPI key not configured",
          suggestion: "Add SERPAPI_API_KEY to Replit Secrets"
        });
      }
      
      // Fetch Google Trends data using SerpAPI
      const { getJson } = await import("serpapi");
      const trendsData = [];
      
      for (const keyword of keywords) {
        let success = false;
        let data = [];
        
        try {
          const response = await getJson({
            engine: "google_trends",
            q: keyword,
            data_type: "TIMESERIES",
            date: "today 3-m", // Last 90 days
            api_key: apiKey,
            timeout: 30000 // 30 second timeout
          });
          
          // SerpAPI returns timeline data in interest_over_time.timeline_data
          const timelineData = response?.interest_over_time?.timeline_data || [];
          
          if (timelineData && timelineData.length > 0) {
            // Transform SerpAPI format to match Google Trends format expected by frontend
            // SerpAPI provides: timestamp (Unix epoch), date (formatted string), values array
            data = timelineData.map((item: any) => {
              const keywordValue = item.values?.find((v: any) => v.query === keyword);
              return {
                time: item.timestamp, // Unix timestamp for frontend parsing
                formattedTime: item.date, // Human-readable date range
                formattedAxisTime: item.date.split(' ')[0], // Shortened for axis display
                value: [keywordValue?.extracted_value || 0], // Numeric value (0-100)
                formattedValue: [String(keywordValue?.extracted_value || 0)] // String format
              };
            });
            
            console.log(`✓ SerpAPI: Fetched ${data.length} data points for "${keyword}"`);
            success = true;
          } else {
            console.warn(`⚠️  SerpAPI: No data returned for "${keyword}"`);
          }
        } catch (e) {
          console.error(`✗ SerpAPI error for "${keyword}":`, e instanceof Error ? e.message : String(e));
        }
        
        trendsData.push({
          keyword,
          data,
          success
        });
      }
      
      const totalDataPoints = trendsData.reduce((sum, t) => sum + (t.data?.length || 0), 0);
      const successCount = trendsData.filter(t => t.success).length;
      const failedCount = trendsData.filter(t => !t.success).length;
      
      console.log(`[Google Trends via SerpAPI] Returned ${trendsData.length} keywords (${successCount} successful, ${failedCount} failed) with ${totalDataPoints} total data points`);
      
      res.json({
        industry,
        keywords,
        trends: trendsData,
        timeframe: 'Last 90 days',
        meta: {
          totalKeywords: trendsData.length,
          successful: successCount,
          failed: failedCount,
          source: 'SerpAPI'
        }
      });
    } catch (error) {
      console.error('Google Trends fetch error:', error);
      res.status(500).json({ message: "Failed to fetch Google Trends data" });
    }
  });

  // ============================================================================
  // CENTRALIZED LINKEDIN OAUTH (mirrors Google Analytics pattern)
  // ============================================================================
  
  /**
   * Initiate LinkedIn OAuth flow with centralized credentials
   * Similar to Google Analytics - credentials stored in env vars, not user input
   */
  app.post("/api/auth/linkedin/connect", oauthRateLimiter, async (req, res) => {
    try {
      const { campaignId } = req.body;
      if (!campaignId) {
        return res.status(400).json({ message: "Campaign ID is required" });
      }

      console.log(`[LinkedIn OAuth] Starting flow for campaign ${campaignId}`);

      // Check for centralized LinkedIn credentials
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        console.log('[LinkedIn OAuth] Credentials not configured in environment variables');
        return res.status(500).json({ 
          message: "LinkedIn OAuth not configured. Please add LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET to environment variables.",
          setupRequired: true
        });
      }

      // Determine base URL
      const rawBaseUrl = process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;

      console.log(`[LinkedIn OAuth] Using redirect URI: ${redirectUri}`);

      // Build LinkedIn OAuth URL
      const authUrl = `https://www.linkedin.com/oauth/v2/authorization?` +
        `client_id=${encodeURIComponent(clientId)}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent('r_ads_reporting rw_ads r_organization_admin')}&` +
        `state=${encodeURIComponent(campaignId)}`;

      res.json({ authUrl, message: "LinkedIn OAuth flow initiated" });
    } catch (error) {
      console.error('[LinkedIn OAuth] Initiation error:', error);
      res.status(500).json({ message: "Failed to initiate authentication" });
    }
  });

  /**
   * Handle LinkedIn OAuth callback
   * Exchanges authorization code for access token using centralized credentials
   */
  app.get("/api/auth/linkedin/callback", oauthRateLimiter, async (req, res) => {
    try {
      const { code, state, error, error_description } = req.query;

      if (error) {
        console.error(`[LinkedIn OAuth] Error from LinkedIn: ${error} - ${error_description}`);
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>${error_description || error}</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ 
                    type: 'linkedin_auth_error', 
                    error: '${error_description || error}' 
                  }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      if (!code || !state) {
        console.error('[LinkedIn OAuth] Missing code or state parameter');
        return res.send(`
          <html>
            <head><title>Authentication Error</title></head>
            <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentication Error</h2>
              <p>Missing authorization code or state parameter.</p>
              <script>
                if (window.opener) {
                  window.opener.postMessage({ type: 'linkedin_auth_error', error: 'Missing parameters' }, window.location.origin);
                }
                setTimeout(() => window.close(), 2000);
              </script>
            </body>
          </html>
        `);
      }

      const campaignId = state as string;
      console.log(`[LinkedIn OAuth] Processing callback for campaign ${campaignId}`);

      // Get centralized credentials
      const clientId = process.env.LINKEDIN_CLIENT_ID;
      const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

      if (!clientId || !clientSecret) {
        throw new Error('LinkedIn OAuth credentials not configured');
      }

      // Determine redirect URI (must match what was used in authorization)
      const rawBaseUrl = process.env.APP_BASE_URL ||
        process.env.RENDER_EXTERNAL_URL ||
        (process.env.REPLIT_DOMAIN ? `https://${process.env.REPLIT_DOMAIN}` : undefined) ||
        `${req.protocol}://${req.get('host')}`;
      const baseUrl = rawBaseUrl.replace(/\/+$/, '');
      const redirectUri = `${baseUrl}/api/auth/linkedin/callback`;

      console.log(`[LinkedIn OAuth] Using redirect URI for token exchange: ${redirectUri}`);

      // Exchange code for access token
      const { retryOAuthExchange } = await import('./utils/retry');
      
      const tokenResponse = await retryOAuthExchange(async () => {
        console.log('[LinkedIn OAuth] Attempting token exchange...');
        const response = await fetch('https://www.linkedin.com/oauth/v2/accessToken', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            code: code as string,
            client_id: clientId,
            client_secret: clientSecret,
            redirect_uri: redirectUri,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[LinkedIn OAuth] Token exchange failed:', errorText);
          throw new Error(`Token exchange failed: ${errorText}`);
        }

        return await response.json();
      });

      console.log('[LinkedIn OAuth] Token exchange successful');

      if (!tokenResponse.access_token) {
        throw new Error('Failed to obtain access token');
      }

      // Store connection temporarily (will be moved to real campaign later)
      await storage.createLinkedInConnection({
        campaignId,
        adAccountId: '', // Will be set when user selects ad account
        adAccountName: '',
        accessToken: tokenResponse.access_token,
        expiresAt: tokenResponse.expires_in 
          ? new Date(Date.now() + tokenResponse.expires_in * 1000)
          : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // Default 60 days
        isPrimary: true,
        isActive: true,
      });

      console.log(`[LinkedIn OAuth] Connection stored for campaign ${campaignId}`);

      // Send success message to popup
      res.send(`
        <html>
          <head><title>Authentication Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>✓ LinkedIn Connected!</h2>
            <p>Authentication successful. Fetching your ad accounts...</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'linkedin_auth_success',
                  accessToken: '${tokenResponse.access_token}'
                }, window.location.origin);
              }
              setTimeout(() => window.close(), 1500);
            </script>
          </body>
        </html>
      `);
    } catch (error: any) {
      console.error('[LinkedIn OAuth] Callback error:', error);
      res.send(`
        <html>
          <head><title>Authentication Error</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
            <h2>Authentication Error</h2>
            <p>${error.message || 'Failed to complete authentication'}</p>
            <script>
              if (window.opener) {
                window.opener.postMessage({ 
                  type: 'linkedin_auth_error', 
                  error: '${error.message || 'Authentication failed'}' 
                }, window.location.origin);
              }
              setTimeout(() => window.close(), 2000);
            </script>
          </body>
        </html>
      `);
    }
  });

  /**
   * Fetch LinkedIn ad accounts using access token
   */
  app.post("/api/linkedin/ad-accounts", async (req, res) => {
    try {
      const { accessToken } = req.body;
      
      if (!accessToken) {
        return res.status(400).json({ error: 'Access token is required' });
      }

      console.log('[LinkedIn] Fetching ad accounts');

      const { LinkedInClient } = await import('./linkedinClient');
      const { retryApiCall } = await import('./utils/retry');
      
      const linkedInClient = new LinkedInClient(accessToken);
      
      const adAccounts = await retryApiCall(
        async () => await linkedInClient.getAdAccounts(),
        'LinkedIn Ad Accounts'
      );

      console.log(`[LinkedIn] Found ${adAccounts.length} ad accounts`);

      res.json({ 
        adAccounts: adAccounts.map(account => ({
          id: account.id,
          name: account.name
        }))
      });
    } catch (error: any) {
      console.error('[LinkedIn] Fetch ad accounts error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch ad accounts' });
    }
  });

  /**
   * Select LinkedIn ad account and finalize connection
   */
  app.post("/api/linkedin/:campaignId/select-ad-account", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { adAccountId, accessToken } = req.body;

      if (!adAccountId || !accessToken) {
        return res.status(400).json({ error: 'Ad account ID and access token are required' });
      }

      console.log(`[LinkedIn] Selecting ad account ${adAccountId} for campaign ${campaignId}`);

      // Fetch ad account details to get the name
      const { LinkedInClient } = await import('./linkedinClient');
      const linkedInClient = new LinkedInClient(accessToken);
      const adAccounts = await linkedInClient.getAdAccounts();
      const selectedAccount = adAccounts.find(acc => acc.id === adAccountId);

      if (!selectedAccount) {
        return res.status(404).json({ error: 'Ad account not found' });
      }

      // Update the connection with ad account details
      const connection = await storage.getLinkedInConnection(campaignId);
      
      if (connection) {
        // Update existing connection
        await storage.updateLinkedInConnection(campaignId, {
          adAccountId,
          adAccountName: selectedAccount.name,
        });
      } else {
        // Create new connection (shouldn't happen, but handle it)
        await storage.createLinkedInConnection({
          campaignId,
          adAccountId,
          adAccountName: selectedAccount.name,
          accessToken,
          expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000), // 60 days
          isPrimary: true,
          isActive: true,
        });
      }

      console.log(`[LinkedIn] Ad account selected successfully`);

      res.json({ success: true, message: 'Ad account connected' });
    } catch (error: any) {
      console.error('[LinkedIn] Select ad account error:', error);
      res.status(500).json({ error: error.message || 'Failed to select ad account' });
    }
  });

  /**
   * Delete LinkedIn connection
   */
  app.delete("/api/linkedin/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[LinkedIn] Deleting connection for campaign ${campaignId}`);
      
      await storage.deleteLinkedInConnection(campaignId);
      
      console.log(`[LinkedIn] Connection deleted successfully`);
      res.json({ success: true, message: 'Connection deleted' });
    } catch (error: any) {
      console.error('[LinkedIn] Delete connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete connection' });
    }
  });

  // ============================================================================
  // END CENTRALIZED LINKEDIN OAUTH
  // ============================================================================

  // ============================================================================
  // META/FACEBOOK ADS INTEGRATION
  // ============================================================================

  /**
   * Connect Meta/Facebook Ads account in test mode
   * For production, this would be replaced with real OAuth flow
   */
  // Test endpoint to trigger KPI alerts manually
  app.post("/api/kpis/test-alerts", async (req, res) => {
    try {
      const { checkPerformanceAlerts } = await import("./kpi-scheduler");
      await checkPerformanceAlerts();
      res.json({ success: true, message: "Alert check completed - check bell icon for notifications" });
    } catch (error) {
      console.error("[Test Alerts] Error:", error);
      res.status(500).json({ success: false, error: String(error) });
    }
  });

  app.post("/api/meta/:campaignId/connect-test", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { adAccountId, adAccountName } = req.body;

      if (!adAccountId || !adAccountName) {
        return res.status(400).json({ error: "Ad account ID and name are required" });
      }

      console.log(`[Meta] Connecting test ad account ${adAccountId} to campaign ${campaignId}`);

      // Create Meta connection in test mode
      await storage.createMetaConnection({
        campaignId,
        adAccountId,
        adAccountName,
        accessToken: `test_token_${Date.now()}`, // Test mode token
        method: 'test_mode',
      });

      console.log(`[Meta] Test connection created successfully`);
      res.json({ success: true, message: 'Meta ad account connected in test mode' });
    } catch (error: any) {
      console.error('[Meta] Test connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect Meta ad account' });
    }
  });

  /**
   * Get Meta connection status for a campaign
   */
  app.get("/api/meta/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const connection = await storage.getMetaConnection(campaignId);
      
      if (!connection) {
        return res.json({ connected: false });
      }

      res.json({
        connected: true,
        adAccountId: connection.adAccountId,
        adAccountName: connection.adAccountName,
        method: connection.method,
      });
    } catch (error: any) {
      console.error('[Meta] Get connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to get connection status' });
    }
  });

  /**
   * Delete Meta connection
   */
  app.delete("/api/meta/:campaignId/connection", async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[Meta] Deleting connection for campaign ${campaignId}`);
      
      await storage.deleteMetaConnection(campaignId);
      
      console.log(`[Meta] Connection deleted successfully`);
      res.json({ success: true, message: 'Connection deleted' });
    } catch (error: any) {
      console.error('[Meta] Delete connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to delete connection' });
    }
  });

  /**
   * Transfer Meta connection from temporary campaign to real campaign
   */
  app.post("/api/meta/transfer-connection", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;
      console.log(`[Meta Transfer] Transferring connection from ${fromCampaignId} to ${toCampaignId}`);

      const tempConnection = await storage.getMetaConnection(fromCampaignId);
      
      if (!tempConnection) {
        console.log(`[Meta Transfer] No connection found for ${fromCampaignId}`);
        return res.json({ success: true, message: 'No connection to transfer' });
      }

      // Create new connection for real campaign
      await storage.createMetaConnection({
        campaignId: toCampaignId,
        adAccountId: tempConnection.adAccountId,
        adAccountName: tempConnection.adAccountName,
        accessToken: tempConnection.accessToken,
        refreshToken: tempConnection.refreshToken,
        method: tempConnection.method,
        expiresAt: tempConnection.expiresAt,
      });

      // Delete temporary connection
      await storage.deleteMetaConnection(fromCampaignId);

      console.log(`[Meta Transfer] Connection transferred successfully`);
      res.json({ success: true, message: 'Meta connection transferred' });
    } catch (error: any) {
      console.error('[Meta Transfer] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to transfer connection' });
    }
  });

  /**
   * Get Meta analytics data for a campaign
   */
  app.get("/api/meta/:campaignId/analytics", async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[Meta Analytics] Fetching analytics for campaign ${campaignId}`);

      const connection = await storage.getMetaConnection(campaignId);
      
      if (!connection) {
        return res.status(404).json({ error: "Meta connection not found for this campaign" });
      }

      // Generate mock data based on the connected ad account
      const { generateMetaMockData } = await import('./utils/metaMockData');
      const mockData = generateMetaMockData(connection.adAccountId, connection.adAccountName || 'Meta Ad Account');

      console.log(`[Meta Analytics] Generated mock data for ${mockData.campaigns.length} campaigns`);
      res.json(mockData);
    } catch (error: any) {
      console.error('[Meta Analytics] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Meta analytics' });
    }
  });

  /**
   * Get Meta summary metrics for a campaign
   */
  app.get("/api/meta/:campaignId/summary", async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[Meta Summary] Fetching summary for campaign ${campaignId}`);

      const connection = await storage.getMetaConnection(campaignId);
      
      if (!connection) {
        return res.status(404).json({ error: "Meta connection not found for this campaign" });
      }

      // Generate mock data and return just the summary
      const { generateMetaMockData } = await import('./utils/metaMockData');
      const mockData = generateMetaMockData(connection.adAccountId, connection.adAccountName || 'Meta Ad Account');

      res.json({
        adAccountName: mockData.adAccountName,
        summary: mockData.summary,
        topCampaigns: mockData.campaigns
          .sort((a, b) => b.totals.spend - a.totals.spend)
          .slice(0, 5)
          .map(c => ({
            name: c.campaign.name,
            status: c.campaign.status,
            objective: c.campaign.objective,
            spend: c.totals.spend,
            impressions: c.totals.impressions,
            clicks: c.totals.clicks,
            conversions: c.totals.conversions,
            ctr: c.totals.ctr,
            cpc: c.totals.cpc,
            costPerConversion: c.totals.costPerConversion,
          })),
      });
    } catch (error: any) {
      console.error('[Meta Summary] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch Meta summary' });
    }
  });

  // ============================================================================
  // END META/FACEBOOK ADS INTEGRATION
  // ============================================================================

  // Custom Integration routes
  app.post("/api/custom-integration/connect", async (req, res) => {
    try {
      console.log("[Custom Integration] Received connection request:", req.body);
      const { email, campaignId, allowedEmailAddresses } = req.body;
      
      if (!email || !campaignId) {
        console.log("[Custom Integration] Missing email or campaignId");
        return res.status(400).json({ 
          success: false,
          error: "Email and campaign ID are required" 
        });
      }

      // Validate email format
      if (!email.includes('@')) {
        console.log("[Custom Integration] Invalid email format:", email);
        return res.status(400).json({ 
          success: false,
          error: "Invalid email format" 
        });
      }

      // Validate allowed email addresses if provided
      let validatedEmailAddresses: string[] | undefined;
      if (allowedEmailAddresses && allowedEmailAddresses.length > 0) {
        validatedEmailAddresses = allowedEmailAddresses
          .map((e: string) => e.trim())
          .filter((e: string) => e.includes('@'));
        
        if (validatedEmailAddresses.length === 0) {
          return res.status(400).json({ 
            success: false,
            error: "Invalid email addresses in whitelist" 
          });
        }
        
        console.log("[Custom Integration] Email whitelist configured:", validatedEmailAddresses);
      }

      // Check if integration already exists
      const existing = await storage.getCustomIntegration(campaignId);
      
      // Only generate a new webhook token if this is a new integration
      const webhookToken = existing?.webhookToken || nanoid(32);
      
      // Create or update the custom integration
      console.log("[Custom Integration] Creating custom integration for:", { campaignId, email, webhookToken, allowedEmailAddresses: validatedEmailAddresses });
      const customIntegration = await storage.createCustomIntegration({
        campaignId,
        email,
        webhookToken,
        allowedEmailAddresses: validatedEmailAddresses
      });
      console.log("[Custom Integration] Created successfully:", customIntegration);

      const responseData = { 
        success: true,
        customIntegration,
        message: `Successfully connected to ${email}`
      };
      console.log("[Custom Integration] Sending response:", responseData);
      res.json(responseData);
    } catch (error) {
      console.error("[Custom Integration] Connection error:", error);
      res.status(500).json({ 
        success: false,
        error: "Failed to connect custom integration" 
      });
    }
  });

  app.get("/api/custom-integration/:campaignId", async (req, res) => {
    try {
      const customIntegration = await storage.getCustomIntegration(req.params.campaignId);
      if (!customIntegration) {
        return res.status(404).json({ message: "Custom integration not found" });
      }
      
      // Include latest metrics for KPI creation dropdown
      const metrics = await storage.getLatestCustomIntegrationMetrics(req.params.campaignId);
      
      res.json({
        ...customIntegration,
        metrics: metrics || null
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch custom integration" });
    }
  });

  // Get real-time metric changes for custom integration
  app.get("/api/custom-integration/:campaignId/changes", async (req, res) => {
    try {
      const current = await storage.getLatestCustomIntegrationMetrics(req.params.campaignId);
      if (!current) {
        return res.status(404).json({ message: "No metrics found" });
      }

      let previous = null;
      let hasChanges = false;

      // Parse previous metrics if available
      if (current.previousMetrics) {
        try {
          previous = JSON.parse(current.previousMetrics);
          hasChanges = true;
        } catch (e) {
          console.error("Failed to parse previous metrics:", e);
        }
      }

      // Calculate changes
      const changes: any = {
        hasChanges,
        currentUpdate: current.uploadedAt,
        previousUpdate: current.previousUpdateAt,
        metrics: {}
      };

      if (previous && hasChanges) {
        const metricKeys = ['users', 'sessions', 'pageviews', 'bounceRate', 'emailsDelivered', 'openRate', 'clickThroughRate', 'spend', 'conversions', 'impressions', 'clicks'];
        
        metricKeys.forEach(key => {
          const currentVal = parseFloat(current[key] || '0');
          const previousVal = parseFloat(previous[key] || '0');
          const diff = currentVal - previousVal;
          const percentChange = previousVal !== 0 ? ((diff / previousVal) * 100) : 0;

          changes.metrics[key] = {
            current: currentVal,
            previous: previousVal,
            change: diff,
            percentChange: percentChange,
            direction: diff > 0 ? 'up' : diff < 0 ? 'down' : 'neutral'
          };
        });
      }

      res.json(changes);
    } catch (error) {
      console.error("Failed to fetch metric changes:", error);
      res.status(500).json({ message: "Failed to fetch metric changes" });
    }
  });

  // Get latest metrics for a custom integration
  app.get("/api/custom-integration/:campaignId/metrics", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const metrics = await storage.getLatestCustomIntegrationMetrics(campaignId);
      
      if (!metrics) {
        return res.status(404).json({ message: "No metrics found for this campaign" });
      }
      
      res.json(metrics);
    } catch (error) {
      console.error("Failed to fetch custom integration metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // Upload and parse PDF for custom integration
  app.post("/api/custom-integration/:campaignId/upload-pdf", upload.single('pdf'), async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      if (!req.file) {
        return res.status(400).json({ 
          success: false,
          error: "No PDF file provided" 
        });
      }

      console.log(`[PDF Upload] Processing PDF for campaign ${campaignId}, file: ${req.file.originalname}, size: ${req.file.size} bytes`);

      // Parse the PDF to extract metrics
      const parsedMetrics = await parsePDFMetrics(req.file.buffer);
      console.log(`[PDF Upload] Parsed metrics:`, parsedMetrics);

      // Helper to filter out NaN values
      const cleanMetric = (value: any) => (typeof value === 'number' && isNaN(value)) ? undefined : value;

      // Store the metrics in the database
      const metrics = await storage.createCustomIntegrationMetrics({
        campaignId,
        // Legacy metrics
        impressions: cleanMetric(parsedMetrics.impressions),
        reach: cleanMetric(parsedMetrics.reach),
        clicks: cleanMetric(parsedMetrics.clicks),
        engagements: cleanMetric(parsedMetrics.engagements),
        spend: parsedMetrics.spend?.toString(),
        conversions: cleanMetric(parsedMetrics.conversions),
        leads: cleanMetric(parsedMetrics.leads),
        videoViews: cleanMetric(parsedMetrics.videoViews),
        viralImpressions: cleanMetric(parsedMetrics.viralImpressions),
        // Audience & Traffic metrics
        users: parsedMetrics.users,
        sessions: parsedMetrics.sessions,
        pageviews: parsedMetrics.pageviews,
        avgSessionDuration: parsedMetrics.avgSessionDuration,
        pagesPerSession: parsedMetrics.pagesPerSession?.toString(),
        bounceRate: parsedMetrics.bounceRate?.toString(),
        // Traffic sources
        organicSearchShare: parsedMetrics.organicSearchShare?.toString(),
        directBrandedShare: parsedMetrics.directBrandedShare?.toString(),
        emailShare: parsedMetrics.emailShare?.toString(),
        referralShare: parsedMetrics.referralShare?.toString(),
        paidShare: parsedMetrics.paidShare?.toString(),
        socialShare: parsedMetrics.socialShare?.toString(),
        // Email metrics
        emailsDelivered: parsedMetrics.emailsDelivered,
        openRate: parsedMetrics.openRate?.toString(),
        clickThroughRate: parsedMetrics.clickThroughRate?.toString(),
        clickToOpenRate: parsedMetrics.clickToOpenRate?.toString(),
        hardBounces: parsedMetrics.hardBounces?.toString(),
        spamComplaints: parsedMetrics.spamComplaints?.toString(),
        listGrowth: parsedMetrics.listGrowth,
        // Metadata
        pdfFileName: req.file.originalname,
        emailSubject: null,
        emailId: null,
      });

      console.log(`[PDF Upload] Metrics stored successfully:`, metrics.id);

      res.json({
        success: true,
        message: "PDF processed successfully",
        metrics: parsedMetrics,
        uploadedAt: metrics.uploadedAt,
      });
    } catch (error) {
      console.error("[PDF Upload] Error processing PDF:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to process PDF" 
      });
    }
  });

  // Public webhook endpoint for receiving PDFs from external services (Zapier, IFTTT, etc.)
  app.post("/api/webhook/custom-integration/:token", upload.single('pdf'), async (req, res) => {
    try {
      const { token } = req.params;
      
      console.log(`[Webhook] Received request with token: ${token}`);
      console.log(`[Webhook] Request body:`, req.body);
      console.log(`[Webhook] Has file:`, !!req.file);
      
      // Find the custom integration by webhook token
      const customIntegrations = await storage.getAllCustomIntegrations();
      const integration = customIntegrations.find(ci => ci.webhookToken === token);
      
      if (!integration) {
        console.log(`[Webhook] Invalid token: ${token}`);
        return res.status(401).json({ 
          success: false,
          error: "Invalid webhook token" 
        });
      }

      let pdfBuffer: Buffer;
      let fileName: string;

      // Check if PDF file was uploaded directly (Zapier/manual upload)
      if (req.file) {
        pdfBuffer = req.file.buffer;
        fileName = req.file.originalname;
        console.log(`[Webhook] Processing uploaded PDF for campaign ${integration.campaignId}, file: ${fileName}, size: ${req.file.size} bytes`);
      } 
      // Check if PDF URL was provided (IFTTT)
      else if (req.body.pdfUrl || req.body.pdf_url || req.body.value1) {
        const pdfUrl = req.body.pdfUrl || req.body.pdf_url || req.body.value1;
        console.log(`[Webhook] Downloading PDF from URL: ${pdfUrl}`);
        
        try {
          const response = await fetch(pdfUrl);
          if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
          }
          
          const arrayBuffer = await response.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuffer);
          fileName = pdfUrl.split('/').pop()?.split('?')[0] || 'downloaded.pdf';
          
          console.log(`[Webhook] Downloaded PDF for campaign ${integration.campaignId}, size: ${pdfBuffer.length} bytes`);
        } catch (downloadError) {
          console.error('[Webhook] PDF download error:', downloadError);
          return res.status(400).json({ 
            success: false,
            error: "Failed to download PDF from URL" 
          });
        }
      } 
      else {
        return res.status(400).json({ 
          success: false,
          error: "No PDF file or PDF URL provided. Send either a file upload or provide 'pdfUrl' in the request body." 
        });
      }

      // Parse the PDF to extract metrics with enterprise validation
      const parsedMetrics = await parsePDFMetrics(pdfBuffer);
      console.log(`[Webhook] Parsed metrics:`, parsedMetrics);
      console.log(`[Webhook] Confidence: ${parsedMetrics._confidence}%`);
      console.log(`[Webhook] Extracted fields: ${parsedMetrics._extractedFields}`);
      
      if (parsedMetrics._warnings && parsedMetrics._warnings.length > 0) {
        console.warn(`[Webhook] ⚠️  Validation warnings:`, parsedMetrics._warnings);
      }
      
      if (parsedMetrics._requiresReview) {
        console.warn(`[Webhook] ⚠️  MANUAL REVIEW REQUIRED - Confidence: ${parsedMetrics._confidence}%`);
      }

      // Helper to filter out NaN values
      const cleanMetric = (value: any) => (typeof value === 'number' && isNaN(value)) ? undefined : value;

      // Store the metrics in the database
      const metrics = await storage.createCustomIntegrationMetrics({
        campaignId: integration.campaignId,
        // Legacy metrics
        impressions: cleanMetric(parsedMetrics.impressions),
        reach: cleanMetric(parsedMetrics.reach),
        clicks: cleanMetric(parsedMetrics.clicks),
        engagements: cleanMetric(parsedMetrics.engagements),
        spend: parsedMetrics.spend?.toString(),
        conversions: cleanMetric(parsedMetrics.conversions),
        leads: cleanMetric(parsedMetrics.leads),
        videoViews: cleanMetric(parsedMetrics.videoViews),
        viralImpressions: cleanMetric(parsedMetrics.viralImpressions),
        // Audience & Traffic metrics
        users: parsedMetrics.users,
        sessions: parsedMetrics.sessions,
        pageviews: parsedMetrics.pageviews,
        avgSessionDuration: parsedMetrics.avgSessionDuration,
        pagesPerSession: parsedMetrics.pagesPerSession?.toString(),
        bounceRate: parsedMetrics.bounceRate?.toString(),
        // Traffic sources
        organicSearchShare: parsedMetrics.organicSearchShare?.toString(),
        directBrandedShare: parsedMetrics.directBrandedShare?.toString(),
        emailShare: parsedMetrics.emailShare?.toString(),
        referralShare: parsedMetrics.referralShare?.toString(),
        paidShare: parsedMetrics.paidShare?.toString(),
        socialShare: parsedMetrics.socialShare?.toString(),
        // Email metrics
        emailsDelivered: parsedMetrics.emailsDelivered,
        openRate: parsedMetrics.openRate?.toString(),
        clickThroughRate: parsedMetrics.clickThroughRate?.toString(),
        clickToOpenRate: parsedMetrics.clickToOpenRate?.toString(),
        hardBounces: parsedMetrics.hardBounces?.toString(),
        spamComplaints: parsedMetrics.spamComplaints?.toString(),
        listGrowth: parsedMetrics.listGrowth,
        // Metadata
        pdfFileName: fileName,
        emailSubject: req.body.subject || req.body.value2 || null,
        emailId: req.body.emailId || req.body.value3 || null,
      });

      console.log(`[Webhook] Metrics stored successfully:`, metrics.id);

      // Prepare response with validation metadata
      const response: any = {
        success: true,
        message: parsedMetrics._requiresReview 
          ? "PDF processed but requires manual review" 
          : "PDF processed successfully",
        campaignId: integration.campaignId,
        metricsId: metrics.id,
        metrics: parsedMetrics,
        uploadedAt: metrics.uploadedAt,
        // Enterprise validation metadata
        confidence: parsedMetrics._confidence,
        extractedFields: parsedMetrics._extractedFields,
        requiresReview: parsedMetrics._requiresReview,
        warnings: parsedMetrics._warnings || [],
      };
      
      // If confidence is below threshold, include review URL
      if (parsedMetrics._requiresReview) {
        response.reviewUrl = `/campaigns/${integration.campaignId}/review-import/${metrics.id}`;
        response.message += ` (Confidence: ${parsedMetrics._confidence}%)`;
      }

      res.json(response);
    } catch (error) {
      console.error("[Webhook] Error processing PDF:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to process PDF" 
      });
    }
  });

  // CloudMailin email receiving endpoint
  app.post("/api/email/inbound/:token", async (req, res) => {
    try {
      const { token } = req.params;
      
      console.log(`[Email] Received email with token: ${token}`);
      console.log(`[Email] From:`, req.body.envelope?.from);
      console.log(`[Email] Subject:`, req.body.headers?.subject);
      
      // Find the custom integration by webhook token
      const customIntegrations = await storage.getAllCustomIntegrations();
      const integration = customIntegrations.find(ci => ci.webhookToken === token);
      
      if (!integration) {
        console.log(`[Email] Invalid token: ${token}`);
        return res.status(401).json({ 
          success: false,
          error: "Invalid email token" 
        });
      }

      // Validate email sender against whitelist (if configured)
      const senderEmail = req.body.envelope?.from?.toLowerCase();
      if (integration.allowedEmailAddresses && integration.allowedEmailAddresses.length > 0) {
        const normalizedWhitelist = integration.allowedEmailAddresses.map(e => e.toLowerCase());
        
        if (!senderEmail || !normalizedWhitelist.includes(senderEmail)) {
          console.log(`[Email] Rejected email from unauthorized sender: ${senderEmail}`);
          console.log(`[Email] Allowed senders:`, integration.allowedEmailAddresses);
          return res.status(403).json({ 
            success: false,
            error: "Email sender not authorized. Only whitelisted email addresses can send to this webhook." 
          });
        }
        
        console.log(`[Email] Email sender validated: ${senderEmail}`);
      }

      // Extract PDF attachment from CloudMailin format
      const attachments = req.body.attachments;
      if (!attachments || attachments.length === 0) {
        return res.status(400).json({ 
          success: false,
          error: "No attachments found in email" 
        });
      }

      // Find the first PDF attachment
      const pdfAttachment = attachments.find((att: any) => 
        att.content_type === 'application/pdf' || 
        att.file_name?.toLowerCase().endsWith('.pdf')
      );

      if (!pdfAttachment) {
        return res.status(400).json({ 
          success: false,
          error: "No PDF attachment found in email" 
        });
      }

      let pdfBuffer: Buffer;
      const fileName = pdfAttachment.file_name || 'email-attachment.pdf';

      // Check if attachment has base64 content (embedded)
      if (pdfAttachment.content) {
        console.log(`[Email] Decoding base64 PDF: ${fileName}`);
        pdfBuffer = Buffer.from(pdfAttachment.content, 'base64');
      } 
      // Check if attachment has URL (cloud storage)
      else if (pdfAttachment.url) {
        console.log(`[Email] Downloading PDF from cloud storage: ${pdfAttachment.url}`);
        try {
          const response = await fetch(pdfAttachment.url);
          if (!response.ok) {
            throw new Error(`Failed to download PDF: ${response.statusText}`);
          }
          const arrayBuffer = await response.arrayBuffer();
          pdfBuffer = Buffer.from(arrayBuffer);
        } catch (downloadError) {
          console.error('[Email] PDF download error:', downloadError);
          return res.status(400).json({ 
            success: false,
            error: "Failed to download PDF from cloud storage" 
          });
        }
      } 
      else {
        return res.status(400).json({ 
          success: false,
          error: "PDF attachment has no content or URL" 
        });
      }

      console.log(`[Email] Processing PDF for campaign ${integration.campaignId}, size: ${pdfBuffer.length} bytes`);

      // Parse the PDF to extract metrics
      const parsedMetrics = await parsePDFMetrics(pdfBuffer);
      console.log(`[Email] Parsed metrics:`, parsedMetrics);

      // Get existing metrics to save as "previous" for change tracking
      const existingMetrics = await storage.getLatestCustomIntegrationMetrics(integration.campaignId);
      let previousMetrics = null;
      let previousUpdateAt = null;
      
      if (existingMetrics) {
        // Save current state as previous before updating
        previousMetrics = JSON.stringify({
          users: existingMetrics.users,
          sessions: existingMetrics.sessions,
          pageviews: existingMetrics.pageviews,
          avgSessionDuration: existingMetrics.avgSessionDuration,
          bounceRate: existingMetrics.bounceRate,
          emailsDelivered: existingMetrics.emailsDelivered,
          openRate: existingMetrics.openRate,
          clickThroughRate: existingMetrics.clickThroughRate,
          spend: existingMetrics.spend,
          conversions: existingMetrics.conversions,
          impressions: existingMetrics.impressions,
          clicks: existingMetrics.clicks,
        });
        previousUpdateAt = existingMetrics.uploadedAt;
        console.log(`[Email] Saved previous metrics for change tracking`);
      }

      // Helper to filter out NaN values
      const cleanMetric = (value: any) => (typeof value === 'number' && isNaN(value)) ? undefined : value;

      // Store the metrics in the database
      const metrics = await storage.createCustomIntegrationMetrics({
        campaignId: integration.campaignId,
        // Legacy metrics
        impressions: cleanMetric(parsedMetrics.impressions),
        reach: cleanMetric(parsedMetrics.reach),
        clicks: cleanMetric(parsedMetrics.clicks),
        engagements: cleanMetric(parsedMetrics.engagements),
        spend: parsedMetrics.spend?.toString(),
        conversions: cleanMetric(parsedMetrics.conversions),
        leads: cleanMetric(parsedMetrics.leads),
        videoViews: cleanMetric(parsedMetrics.videoViews),
        viralImpressions: cleanMetric(parsedMetrics.viralImpressions),
        // Audience & Traffic metrics
        users: parsedMetrics.users,
        sessions: parsedMetrics.sessions,
        pageviews: parsedMetrics.pageviews,
        avgSessionDuration: parsedMetrics.avgSessionDuration,
        pagesPerSession: parsedMetrics.pagesPerSession?.toString(),
        bounceRate: parsedMetrics.bounceRate?.toString(),
        // Traffic sources
        organicSearchShare: parsedMetrics.organicSearchShare?.toString(),
        directBrandedShare: parsedMetrics.directBrandedShare?.toString(),
        emailShare: parsedMetrics.emailShare?.toString(),
        referralShare: parsedMetrics.referralShare?.toString(),
        paidShare: parsedMetrics.paidShare?.toString(),
        socialShare: parsedMetrics.socialShare?.toString(),
        // Email metrics
        emailsDelivered: parsedMetrics.emailsDelivered,
        openRate: parsedMetrics.openRate?.toString(),
        clickThroughRate: parsedMetrics.clickThroughRate?.toString(),
        clickToOpenRate: parsedMetrics.clickToOpenRate?.toString(),
        hardBounces: parsedMetrics.hardBounces?.toString(),
        spamComplaints: parsedMetrics.spamComplaints?.toString(),
        listGrowth: parsedMetrics.listGrowth,
        // Metadata
        pdfFileName: fileName,
        emailSubject: req.body.headers?.subject || null,
        emailId: req.body.headers?.['message-id'] || null,
        // Change tracking
        previousMetrics: previousMetrics,
        previousUpdateAt: previousUpdateAt,
      });

      console.log(`[Email] Metrics stored successfully:`, metrics.id);

      res.json({
        success: true,
        message: "Email PDF processed successfully",
        campaignId: integration.campaignId,
        metricsId: metrics.id,
        metrics: parsedMetrics,
        uploadedAt: metrics.uploadedAt,
      });
    } catch (error) {
      console.error("[Email] Error processing PDF:", error);
      res.status(500).json({ 
        success: false,
        error: error instanceof Error ? error.message : "Failed to process email PDF" 
      });
    }
  });

  // LinkedIn API routes
  
  // POST /api/linkedin/connect - Manual token connection
  app.post("/api/linkedin/connect", async (req, res) => {
    try {
      const validatedData = insertLinkedInConnectionSchema.parse(req.body);
      const connection = await storage.createLinkedInConnection(validatedData);
      
      res.status(201).json({
        success: true,
        connection: {
          id: connection.id,
          campaignId: connection.campaignId,
          adAccountId: connection.adAccountId,
          adAccountName: connection.adAccountName,
          method: connection.method,
          connectedAt: connection.connectedAt
        },
        message: 'LinkedIn connection created successfully'
      });
    } catch (error) {
      console.error('LinkedIn connection error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid LinkedIn connection data",
          details: error.errors
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to create LinkedIn connection'
      });
    }
  });

  // GET /api/linkedin/check-connection/:campaignId - Check if LinkedIn is connected
  app.get("/api/linkedin/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const connection = await storage.getLinkedInConnection(campaignId);
      
      if (!connection || !connection.adAccountId) {
        return res.json({ connected: false });
      }
      
      res.json({
        connected: true,
        connection: {
          id: connection.id,
          adAccountId: connection.adAccountId,
          adAccountName: connection.adAccountName,
          method: connection.method,
          connectedAt: connection.connectedAt
        }
      });
    } catch (error) {
      console.error('LinkedIn connection check error:', error);
      res.json({ connected: false });
    }
  });

  // DELETE /api/linkedin/disconnect/:campaignId - Remove connection
  app.delete("/api/linkedin/disconnect/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const deleted = await storage.deleteLinkedInConnection(campaignId);
      
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: "LinkedIn connection not found"
        });
      }
      
      res.json({
        success: true,
        message: 'LinkedIn connection deleted successfully'
      });
    } catch (error) {
      console.error('LinkedIn connection deletion error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to delete LinkedIn connection'
      });
    }
  });

  // PATCH /api/linkedin/update/:campaignId - Update connection
  app.patch("/api/linkedin/update/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      const validatedData = insertLinkedInConnectionSchema.partial().parse(req.body);
      
      const updatedConnection = await storage.updateLinkedInConnection(campaignId, validatedData);
      
      if (!updatedConnection) {
        return res.status(404).json({
          success: false,
          error: "LinkedIn connection not found"
        });
      }
      
      res.json({
        success: true,
        connection: {
          id: updatedConnection.id,
          campaignId: updatedConnection.campaignId,
          adAccountId: updatedConnection.adAccountId,
          adAccountName: updatedConnection.adAccountName,
          method: updatedConnection.method,
          connectedAt: updatedConnection.connectedAt
        },
        message: 'LinkedIn connection updated successfully'
      });
    } catch (error) {
      console.error('LinkedIn connection update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Invalid LinkedIn connection data",
          details: error.errors
        });
      }
      res.status(500).json({
        success: false,
        error: 'Failed to update LinkedIn connection'
      });
    }
  });

  // KPI routes
  app.get("/api/campaigns/:id/kpis", async (req, res) => {
    try {
      const { id } = req.params;
      const kpis = await storage.getCampaignKPIs(id);
      res.json(kpis);
    } catch (error) {
      console.error('KPI fetch error:', error);
      res.status(500).json({ message: "Failed to fetch KPIs" });
    }
  });

  // Platform-level KPI routes
  app.get("/api/platforms/:platformType/kpis", async (req, res) => {
    try {
      const { platformType } = req.params;
      const { campaignId } = req.query;
      const kpis = await storage.getPlatformKPIs(platformType, campaignId as string | undefined);
      res.json(kpis);
    } catch (error) {
      console.error('Platform KPI fetch error:', error);
      res.status(500).json({ message: "Failed to fetch platform KPIs" });
    }
  });

  app.post("/api/platforms/:platformType/kpis", async (req, res) => {
    try {
      const { platformType } = req.params;

      const toNullableDecimalString = (v: any) => {
        if (v === '' || v === null || typeof v === 'undefined') return null;
        // Drizzle-Zod decimal fields commonly expect strings; accept numbers too.
        if (typeof v === 'number') return String(v);
        return String(v);
      };
      
      // Convert empty strings to null for numeric and optional text fields
      const requestData = {
        ...req.body,
        platformType: platformType,
        campaignId: req.body.campaignId || null, // Preserve campaignId from request
        metric: req.body.metric === '' ? null : req.body.metric,
        targetValue: toNullableDecimalString(req.body.targetValue),
        currentValue: toNullableDecimalString(req.body.currentValue),
        alertThreshold: toNullableDecimalString(req.body.alertThreshold),
        emailRecipients: req.body.emailRecipients === '' ? null : req.body.emailRecipients,
        timeframe: req.body.timeframe || "monthly",
        trackingPeriod: req.body.trackingPeriod || 30,
        rollingAverage: req.body.rollingAverage || "7day",
        targetDate: req.body.targetDate ? new Date(req.body.targetDate) : null
      };
      
      const validatedKPI = insertKPISchema.parse(requestData);
      
      const kpi = await storage.createKPI(validatedKPI);
      res.json(kpi);
    } catch (error) {
      console.error('Platform KPI creation error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid KPI data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create platform KPI" });
      }
    }
  });

  app.patch("/api/platforms/:platformType/kpis/:kpiId", async (req, res) => {
    console.log('=== PATCH KPI ENDPOINT ===');
    console.log('KPI ID:', req.params.kpiId);
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const { kpiId } = req.params;
      
      const toNullableDecimalString = (v: any) => {
        if (v === '' || v === null || typeof v === 'undefined') return null;
        if (typeof v === 'number') return String(v);
        return String(v);
      };

      // Convert empty strings to null for numeric and optional text fields
      const updateData = {
        ...req.body,
        metric: req.body.metric === '' ? null : req.body.metric,
        targetValue: toNullableDecimalString(req.body.targetValue),
        currentValue: toNullableDecimalString(req.body.currentValue),
        alertThreshold: toNullableDecimalString(req.body.alertThreshold),
        emailRecipients: req.body.emailRecipients === '' ? null : req.body.emailRecipients,
        targetDate: req.body.targetDate ? new Date(req.body.targetDate) : req.body.targetDate === null ? null : undefined
      };
      
      console.log('Update data after processing:', JSON.stringify(updateData, null, 2));
      
      const updatedKPI = await storage.updateKPI(kpiId, updateData);
      
      console.log('Updated KPI result:', updatedKPI ? 'Found' : 'Not found');
      
      if (!updatedKPI) {
        console.log('KPI not found, returning 404');
        return res.status(404).json({ message: "KPI not found" });
      }
      
      console.log('Returning updated KPI');
      res.json(updatedKPI);
    } catch (error) {
      console.error('Platform KPI update error:', error);
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', error.errors);
        res.status(400).json({ message: "Invalid KPI data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update platform KPI" });
      }
    }
  });

  app.delete("/api/platforms/:platformType/kpis/:kpiId", async (req, res) => {
    console.log(`=== DELETE KPI ENDPOINT CALLED ===`);
    console.log(`Request params:`, req.params);
    console.log(`Platform Type: ${req.params.platformType}`);
    console.log(`KPI ID: ${req.params.kpiId}`);
    
    try {
      const { kpiId } = req.params;
      
      console.log(`About to call storage.deleteKPI with ID: ${kpiId}`);
      const deleted = await storage.deleteKPI(kpiId);
      console.log(`storage.deleteKPI returned: ${deleted}`);
      
      if (!deleted) {
        console.log(`KPI ${kpiId} not found or not deleted`);
        return res.status(404).json({ message: "KPI not found" });
      }
      
      console.log(`KPI ${kpiId} successfully deleted from storage`);
      res.setHeader('Content-Type', 'application/json');
      const response = { message: "KPI deleted successfully", success: true };
      console.log(`Sending response:`, response);
      res.json(response);
    } catch (error) {
      console.error('=== Platform KPI deletion error ===:', error);
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      res.status(500).json({ message: "Failed to delete KPI", error: error instanceof Error ? error.message : String(error) });
    }
  });

  app.post("/api/campaigns/:id/kpis", async (req, res) => {
    try {
      const { id } = req.params;

      // Ensure DB has the column for user-selected input configs (deployed environments may not have run migrations yet).
      if (db) {
        try {
          await db.execute(sql`
            ALTER TABLE kpis
            ADD COLUMN IF NOT EXISTS calculation_config JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE kpis
            ALTER COLUMN target_value TYPE DECIMAL(18, 2),
            ALTER COLUMN current_value TYPE DECIMAL(18, 2),
            ALTER COLUMN last_computed_value TYPE DECIMAL(18, 2),
            ALTER COLUMN alert_threshold TYPE DECIMAL(18, 2);
          `);
        } catch (e) {
          // Best-effort: do not block request on migration attempt; actual insert may still fail and surface below.
          console.error("[KPI Create] Failed to ensure calculation_config column:", e);
        }
      }
      
      // Convert numeric values to strings for decimal fields
      const requestData = {
        ...req.body,
        campaignId: id,
        targetValue: req.body.targetValue?.toString() || "0",
        currentValue: req.body.currentValue?.toString() || "0",
        timeframe: req.body.timeframe || "monthly",
        trackingPeriod: req.body.trackingPeriod || 30,
        rollingAverage: req.body.rollingAverage || "7day",
        targetDate: req.body.targetDate && req.body.targetDate.trim() !== '' 
          ? new Date(req.body.targetDate) 
          : null
      };
      
      const validatedKPI = insertKPISchema.parse(requestData);
      
      const kpi = await storage.createKPI(validatedKPI);
      res.json(kpi);
    } catch (error) {
      console.error('KPI create error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid KPI data", errors: error.errors });
      } else {
        const errMsg = error instanceof Error ? error.message : String(error);
        res.status(500).json({ message: `Failed to create KPI: ${errMsg}` });
      }
    }
  });

  app.patch("/api/campaigns/:id/kpis/:kpiId", async (req, res) => {
    try {
      const { kpiId } = req.params;

      // Ensure DB has the column for user-selected input configs (deployed environments may not have run migrations yet).
      if (db) {
        try {
          await db.execute(sql`
            ALTER TABLE kpis
            ADD COLUMN IF NOT EXISTS calculation_config JSONB;
          `);
          await db.execute(sql`
            ALTER TABLE kpis
            ALTER COLUMN target_value TYPE DECIMAL(18, 2),
            ALTER COLUMN current_value TYPE DECIMAL(18, 2),
            ALTER COLUMN last_computed_value TYPE DECIMAL(18, 2),
            ALTER COLUMN alert_threshold TYPE DECIMAL(18, 2);
          `);
        } catch (e) {
          console.error("[KPI Update] Failed to ensure calculation_config column:", e);
        }
      }
      
      // Convert numeric values to strings for decimal fields
      const updateData: any = {
        ...req.body,
      };
      
      if (req.body.targetValue !== undefined) {
        updateData.targetValue = req.body.targetValue?.toString();
      }
      if (req.body.currentValue !== undefined) {
        updateData.currentValue = req.body.currentValue?.toString();
      }
      if (req.body.alertThreshold !== undefined) {
        updateData.alertThreshold = req.body.alertThreshold?.toString();
      }
      if (req.body.targetDate !== undefined) {
        updateData.targetDate = req.body.targetDate && req.body.targetDate.trim() !== '' 
          ? new Date(req.body.targetDate) 
          : null;
      }
      
      const kpi = await storage.updateKPI(kpiId, updateData);
      if (!kpi) {
        return res.status(404).json({ message: "KPI not found" });
      }
      res.json(kpi);
    } catch (error) {
      console.error('KPI update error:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid KPI data", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update KPI" });
      }
    }
  });

  app.delete("/api/campaigns/:id/kpis/:kpiId", async (req, res) => {
    try {
      const { kpiId } = req.params;
      
      const deleted = await storage.deleteKPI(kpiId);
      if (!deleted) {
        return res.status(404).json({ message: "KPI not found" });
      }
      
      res.json({ message: "KPI deleted successfully", success: true });
    } catch (error) {
      console.error('KPI deletion error:', error);
      res.status(500).json({ message: "Failed to delete KPI" });
    }
  });

  // Campaign-level Benchmark routes
  app.get("/api/campaigns/:id/benchmarks", async (req, res) => {
    try {
      const { id } = req.params;
      const benchmarks = await storage.getCampaignBenchmarks(id);
      res.json(benchmarks);
    } catch (error) {
      console.error('Campaign Benchmark fetch error:', error);
      res.status(500).json({ message: "Failed to fetch campaign benchmarks" });
    }
  });

  app.post("/api/campaigns/:id/benchmarks", async (req, res) => {
    console.log('=== CREATE CAMPAIGN BENCHMARK ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const { id } = req.params;
      
      // Convert numeric values to strings for decimal fields
      const cleanedData = {
        ...req.body,
        campaignId: id,
        platformType: 'campaign', // Campaign-level benchmark (not platform-specific)
        category: req.body.category || 'performance', // Default category
        alertThreshold: req.body.alertThreshold ? String(req.body.alertThreshold) : null,
        benchmarkValue: req.body.benchmarkValue !== undefined && req.body.benchmarkValue !== '' ? String(req.body.benchmarkValue) : null,
        currentValue: req.body.currentValue !== undefined && req.body.currentValue !== '' ? String(req.body.currentValue) : null
      };
      
      const validatedBenchmark = insertBenchmarkSchema.parse(cleanedData);
      
      console.log('Validated benchmark:', JSON.stringify(validatedBenchmark, null, 2));
      
      const benchmark = await storage.createBenchmark(validatedBenchmark);
      console.log('Created benchmark:', JSON.stringify(benchmark, null, 2));
      
      res.json(benchmark);
    } catch (error) {
      console.error('Campaign Benchmark creation error:', error);
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid benchmark data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create campaign benchmark" });
    }
  });

  app.patch("/api/campaigns/:campaignId/benchmarks/:benchmarkId", async (req, res) => {
    console.log('=== UPDATE CAMPAIGN BENCHMARK ===');
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    
    try {
      const { benchmarkId } = req.params;
      
      // Convert numeric values to strings for decimal fields
      const cleanedData = { ...req.body };
      if (cleanedData.alertThreshold !== undefined) {
        cleanedData.alertThreshold = cleanedData.alertThreshold ? String(cleanedData.alertThreshold) : null;
      }
      if (cleanedData.benchmarkValue !== undefined) {
        cleanedData.benchmarkValue = cleanedData.benchmarkValue !== '' ? String(cleanedData.benchmarkValue) : null;
      }
      if (cleanedData.currentValue !== undefined) {
        cleanedData.currentValue = cleanedData.currentValue !== '' ? String(cleanedData.currentValue) : null;
      }
      
      const validatedBenchmark = insertBenchmarkSchema.partial().parse(cleanedData);
      console.log('Validated benchmark update:', JSON.stringify(validatedBenchmark, null, 2));
      
      const benchmark = await storage.updateBenchmark(benchmarkId, validatedBenchmark);
      if (!benchmark) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      console.log('Updated benchmark:', JSON.stringify(benchmark, null, 2));
      res.json(benchmark);
    } catch (error) {
      console.error('Campaign Benchmark update error:', error);
      if (error instanceof z.ZodError) {
        console.error('Zod validation errors:', JSON.stringify(error.errors, null, 2));
        return res.status(400).json({ message: "Invalid benchmark data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update campaign benchmark" });
    }
  });

  app.delete("/api/campaigns/:campaignId/benchmarks/:benchmarkId", async (req, res) => {
    console.log('=== DELETE CAMPAIGN BENCHMARK ===');
    console.log('Benchmark ID:', req.params.benchmarkId);
    
    try {
      const { benchmarkId } = req.params;
      
      const deleted = await storage.deleteBenchmark(benchmarkId);
      if (!deleted) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      console.log(`Benchmark ${benchmarkId} successfully deleted`);
      res.json({ message: "Benchmark deleted successfully", success: true });
    } catch (error) {
      console.error('Campaign Benchmark deletion error:', error);
      res.status(500).json({ message: "Failed to delete benchmark" });
    }
  });

  // Get KPI analytics
  app.get("/api/kpis/:id/analytics", async (req, res) => {
    try {
      const { id } = req.params;
      const timeframe = req.query.timeframe as string || "30d";
      
      const analytics = await storage.getKPIAnalytics(id, timeframe);
      res.json(analytics);
    } catch (error) {
      console.error('KPI analytics error:', error);
      res.status(500).json({ message: "Failed to fetch KPI analytics" });
    }
  });

  // Record KPI progress
  app.post("/api/kpis/:id/progress", async (req, res) => {
    try {
      const { id } = req.params;
      
      const progressData = {
        kpiId: id,
        value: req.body.value?.toString() || "0",
        rollingAverage7d: req.body.rollingAverage7d?.toString(),
        rollingAverage30d: req.body.rollingAverage30d?.toString(),
        trendDirection: req.body.trendDirection || "neutral",
        notes: req.body.notes
      };
      
      const progress = await storage.recordKPIProgress(progressData);
      res.json(progress);
    } catch (error) {
      console.error('KPI progress recording error:', error);
      res.status(500).json({ message: "Failed to record KPI progress" });
    }
  });

  // KPI Report routes
  app.get("/api/campaigns/:id/kpi-reports", async (req, res) => {
    try {
      const { id } = req.params;
      const reports = await storage.getCampaignKPIReports(id);
      res.json(reports);
    } catch (error) {
      console.error('KPI reports fetch error:', error);
      res.status(500).json({ message: "Failed to fetch KPI reports" });
    }
  });

  app.post("/api/campaigns/:id/kpi-reports", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.createKPIReport({ ...req.body, campaignId: id });
      res.json(report);
    } catch (error) {
      console.error('KPI report creation error:', error);
      res.status(500).json({ message: "Failed to create KPI report" });
    }
  });

  app.patch("/api/campaigns/:id/kpi-reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const report = await storage.updateKPIReport(reportId, req.body);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json(report);
    } catch (error) {
      console.error('KPI report update error:', error);
      res.status(500).json({ message: "Failed to update KPI report" });
    }
  });

  app.delete("/api/campaigns/:id/kpi-reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      const deleted = await storage.deleteKPIReport(reportId);
      if (!deleted) {
        return res.status(404).json({ message: "Report not found" });
      }
      res.json({ message: "Report deleted successfully" });
    } catch (error) {
      console.error('KPI report deletion error:', error);
      res.status(500).json({ message: "Failed to delete KPI report" });
    }
  });

  // Benchmark routes
  // Get campaign benchmarks
  app.get("/api/campaigns/:campaignId/benchmarks", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const benchmarks = await storage.getCampaignBenchmarks(campaignId);
      res.json(benchmarks);
    } catch (error) {
      console.error('Campaign benchmarks fetch error:', error);
      res.status(500).json({ message: "Failed to fetch campaign benchmarks" });
    }
  });

  // Get platform benchmarks
  app.get("/api/platforms/:platformType/benchmarks", async (req, res) => {
    try {
      const { platformType } = req.params;
      const { campaignId } = req.query;
      const benchmarks = await storage.getPlatformBenchmarks(platformType, campaignId as string | undefined);
      res.json(benchmarks);
    } catch (error) {
      console.error('Platform benchmarks fetch error:', error);
      res.status(500).json({ message: "Failed to fetch platform benchmarks" });
    }
  });

  // Create platform benchmark
  app.post("/api/platforms/:platformType/benchmarks", async (req, res) => {
    try {
      const { platformType } = req.params;
      
      // Convert empty strings to null for numeric fields
      const cleanedData = {
        ...req.body,
        platformType: platformType,
        campaignId: req.body.campaignId || null, // Preserve campaignId from request
        alertThreshold: req.body.alertThreshold === '' ? null : req.body.alertThreshold,
        benchmarkValue: req.body.benchmarkValue === '' ? null : req.body.benchmarkValue,
        currentValue: req.body.currentValue === '' ? null : req.body.currentValue
      };
      
      const validatedData = insertBenchmarkSchema.parse(cleanedData);
      
      // Calculate initial variance if current value exists
      if (validatedData.currentValue && validatedData.benchmarkValue) {
        const currentVal = parseFloat(validatedData.currentValue.toString());
        const benchmarkVal = parseFloat(validatedData.benchmarkValue.toString());
        const variance = ((currentVal - benchmarkVal) / benchmarkVal) * 100;
        validatedData.variance = variance.toString();
      }
      
      const benchmark = await storage.createBenchmark(validatedData);
      res.status(201).json(benchmark);
    } catch (error) {
      console.error('Platform benchmark creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid benchmark data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create platform benchmark" });
    }
  });

  // Update platform benchmark
  app.put("/api/platforms/:platformType/benchmarks/:benchmarkId", async (req, res) => {
    try {
      const { benchmarkId } = req.params;
      
      const validatedData = insertBenchmarkSchema.partial().parse(req.body);
      
      // Calculate variance if both values are provided
      if (validatedData.currentValue && validatedData.benchmarkValue) {
        const currentVal = parseFloat(validatedData.currentValue.toString());
        const benchmarkVal = parseFloat(validatedData.benchmarkValue.toString());
        const variance = ((currentVal - benchmarkVal) / benchmarkVal) * 100;
        validatedData.variance = variance.toString();
      }
      
      const benchmark = await storage.updateBenchmark(benchmarkId, validatedData);
      if (!benchmark) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      res.json(benchmark);
    } catch (error) {
      console.error('Platform benchmark update error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid benchmark data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update platform benchmark" });
    }
  });

  // Delete platform benchmark
  app.delete("/api/platforms/:platformType/benchmarks/:benchmarkId", async (req, res) => {
    try {
      const { benchmarkId } = req.params;
      
      const deleted = await storage.deleteBenchmark(benchmarkId);
      if (!deleted) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      res.json({ message: "Benchmark deleted successfully", success: true });
    } catch (error) {
      console.error('Platform benchmark deletion error:', error);
      res.status(500).json({ message: "Failed to delete benchmark" });
    }
  });

  // Platform Reports routes
  // Get platform reports
  app.get("/api/platforms/:platformType/reports", async (req, res) => {
    try {
      const { platformType } = req.params;
      const { campaignId } = req.query;
      const reports = await storage.getPlatformReports(platformType, campaignId as string | undefined);
      res.json(reports);
    } catch (error) {
      console.error('Platform reports fetch error:', error);
      res.status(500).json({ message: "Failed to fetch platform reports" });
    }
  });

  // Create platform report
  app.post("/api/platforms/:platformType/reports", async (req, res) => {
    try {
      const { platformType } = req.params;
      
      const report = await storage.createPlatformReport({
        ...req.body,
        platformType
      });
      
      res.status(201).json(report);
    } catch (error) {
      console.error('Platform report creation error:', error);
      res.status(500).json({ message: "Failed to create platform report" });
    }
  });

  // Update platform report
  app.patch("/api/platforms/:platformType/reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      const report = await storage.updatePlatformReport(reportId, req.body);
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error('Platform report update error:', error);
      res.status(500).json({ message: "Failed to update platform report" });
    }
  });

  // Delete platform report
  app.delete("/api/platforms/:platformType/reports/:reportId", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      const deleted = await storage.deletePlatformReport(reportId);
      if (!deleted) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json({ message: "Report deleted successfully", success: true });
    } catch (error) {
      console.error('Platform report deletion error:', error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Send test report email
  app.post("/api/platforms/:platformType/reports/:reportId/send-test", async (req, res) => {
    try {
      const { reportId } = req.params;
      
      console.log(`[API] Test report email requested for: ${reportId}`);
      
      // Check email configuration first
      const emailProvider = process.env.EMAIL_PROVIDER || 'smtp';
      const hasEmailConfig = 
        (emailProvider === 'mailgun' && process.env.MAILGUN_SMTP_USER && process.env.MAILGUN_SMTP_PASS) ||
        (emailProvider === 'sendgrid' && process.env.SENDGRID_API_KEY) ||
        (emailProvider === 'smtp' && process.env.SMTP_USER && process.env.SMTP_PASS);
      
      if (!hasEmailConfig) {
        console.error(`[API] Email not configured. Provider: ${emailProvider}`);
        return res.status(500).json({ 
          message: `Email service not configured. Please set up ${emailProvider.toUpperCase()} credentials in environment variables.`,
          success: false,
          emailProvider
        });
      }
      
      const { sendTestReport } = await import('./report-scheduler.js');
      const sent = await sendTestReport(reportId);
      
      if (sent) {
        console.log(`[API] ✅ Test email sent successfully for report: ${reportId}`);
        res.json({ 
          message: "Test report email sent successfully! Check your inbox.", 
          success: true 
        });
      } else {
        console.error(`[API] ❌ Failed to send test email for report: ${reportId}`);
        res.status(500).json({ 
          message: "Failed to send test report email. Check server logs for details.", 
          success: false 
        });
      }
    } catch (error) {
      console.error('[API] Test report send error:', error);
      res.status(500).json({ 
        message: `Error: ${error instanceof Error ? error.message : 'Failed to send test report'}`,
        success: false
      });
    }
  });

  // Get single benchmark
  app.get("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const benchmark = await storage.getBenchmark(id);
      
      if (!benchmark) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      res.json(benchmark);
    } catch (error) {
      console.error('Benchmark fetch error:', error);
      res.status(500).json({ message: "Failed to fetch benchmark" });
    }
  });

  // Create benchmark
  app.post("/api/benchmarks", async (req, res) => {
    try {
      const validatedData = insertBenchmarkSchema.parse(req.body);
      
      // Calculate initial variance if current value exists
      if (validatedData.currentValue && validatedData.benchmarkValue) {
        const currentVal = parseFloat(validatedData.currentValue.toString());
        const benchmarkVal = parseFloat(validatedData.benchmarkValue.toString());
        const variance = ((currentVal - benchmarkVal) / benchmarkVal) * 100;
        validatedData.variance = variance.toString();
      }
      
      const benchmark = await storage.createBenchmark(validatedData);
      res.status(201).json(benchmark);
    } catch (error) {
      console.error('Benchmark creation error:', error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid benchmark data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create benchmark" });
    }
  });

  // Update benchmark
  app.put("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updateData = req.body;
      
      // Recalculate variance if values are updated
      if (updateData.currentValue && updateData.benchmarkValue) {
        const currentVal = parseFloat(updateData.currentValue.toString());
        const benchmarkVal = parseFloat(updateData.benchmarkValue.toString());
        const variance = ((currentVal - benchmarkVal) / benchmarkVal) * 100;
        updateData.variance = variance.toString();
      }
      
      const benchmark = await storage.updateBenchmark(id, updateData);
      
      if (!benchmark) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      res.json(benchmark);
    } catch (error) {
      console.error('Benchmark update error:', error);
      res.status(500).json({ message: "Failed to update benchmark" });
    }
  });

  // Delete benchmark
  app.delete("/api/benchmarks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const success = await storage.deleteBenchmark(id);
      
      if (!success) {
        return res.status(404).json({ message: "Benchmark not found" });
      }
      
      res.json({ success: true, message: "Benchmark deleted successfully" });
    } catch (error) {
      console.error('Benchmark deletion error:', error);
      res.status(500).json({ message: "Failed to delete benchmark" });
    }
  });

  // Get benchmark history
  app.get("/api/benchmarks/:id/history", async (req, res) => {
    try {
      const { id } = req.params;
      const history = await storage.getBenchmarkHistory(id);
      res.json(history);
    } catch (error) {
      console.error('Benchmark history fetch error:', error);
      res.status(500).json({ message: "Failed to fetch benchmark history" });
    }
  });

  // Record benchmark history
  app.post("/api/benchmarks/:id/history", async (req, res) => {
    try {
      const { id } = req.params;
      
      const historyData = {
        benchmarkId: id,
        currentValue: req.body.currentValue?.toString(),
        benchmarkValue: req.body.benchmarkValue?.toString(),
        variance: req.body.variance?.toString(),
        performanceRating: req.body.performanceRating || "average",
        notes: req.body.notes
      };
      
      const history = await storage.recordBenchmarkHistory(historyData);
      res.json(history);
    } catch (error) {
      console.error('Benchmark history recording error:', error);
      res.status(500).json({ message: "Failed to record benchmark history" });
    }
  });

  // Get benchmark analytics
  app.get("/api/benchmarks/:id/analytics", async (req, res) => {
    try {
      const { id } = req.params;
      const analytics = await storage.getBenchmarkAnalytics(id);
      res.json(analytics);
    } catch (error) {
      console.error('Benchmark analytics fetch error:', error);
      res.status(500).json({ message: "Failed to fetch benchmark analytics" });
    }
  });

  // Attribution Analysis Routes
  
  // Attribution Models endpoints
  app.get('/api/attribution/models', async (req, res) => {
    try {
      // Fallback attribution models for demo
      const models = [
        {
          id: "first-touch",
          name: "First Touch",
          type: "first_touch",
          description: "100% credit to the first touchpoint in the customer journey",
          configuration: null,
          isDefault: true,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "last-touch", 
          name: "Last Touch",
          type: "last_touch",
          description: "100% credit to the last touchpoint before conversion",
          configuration: null,
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "linear",
          name: "Linear",
          type: "linear", 
          description: "Equal credit distributed across all touchpoints",
          configuration: null,
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "position-based",
          name: "Position Based",
          type: "position_based",
          description: "40% first, 40% last, 20% middle touchpoints",
          configuration: '{"first": 0.4, "last": 0.4, "middle": 0.2}',
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: "time-decay",
          name: "Time Decay",
          type: "time_decay",
          description: "More credit to touchpoints closer to conversion",
          configuration: '{"half_life": 7}',
          isDefault: false,
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];
      res.json(models);
    } catch (error) {
      console.error('Failed to get attribution models:', error);
      res.status(500).json({ error: 'Failed to get attribution models' });
    }
  });

  app.post('/api/attribution/models', async (req, res) => {
    try {
      const validated = insertAttributionModelSchema.parse(req.body);
      const model = await storage.createAttributionModel(validated);
      res.json(model);
    } catch (error) {
      console.error('Failed to create attribution model:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create attribution model' });
      }
    }
  });

  app.patch('/api/attribution/models/:id', async (req, res) => {
    try {
      const validated = insertAttributionModelSchema.partial().parse(req.body);
      const model = await storage.updateAttributionModel(req.params.id, validated);
      if (!model) {
        res.status(404).json({ error: 'Attribution model not found' });
        return;
      }
      res.json(model);
    } catch (error) {
      console.error('Failed to update attribution model:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update attribution model' });
      }
    }
  });

  app.delete('/api/attribution/models/:id', async (req, res) => {
    try {
      const success = await storage.deleteAttributionModel(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Attribution model not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to delete attribution model:', error);
      res.status(500).json({ error: 'Failed to delete attribution model' });
    }
  });

  app.post('/api/attribution/models/:id/set-default', async (req, res) => {
    try {
      const success = await storage.setDefaultAttributionModel(req.params.id);
      if (!success) {
        res.status(404).json({ error: 'Attribution model not found' });
        return;
      }
      res.json({ success: true });
    } catch (error) {
      console.error('Failed to set default attribution model:', error);
      res.status(500).json({ error: 'Failed to set default attribution model' });
    }
  });

  // Customer Journey endpoints
  app.get('/api/attribution/journeys', async (req, res) => {
    try {
      const { status } = req.query;
      
      // Sample customer journeys with touchpoints for demo
      const journeys = [
        {
          id: "journey-001",
          customerId: "CUST_001",
          sessionId: "session_abc123",
          deviceId: null,
          userId: null,
          journeyStart: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
          journeyEnd: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
          totalTouchpoints: 5,
          conversionValue: "285.00",
          conversionType: "purchase",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "journey-002", 
          customerId: "CUST_002",
          sessionId: "session_def456",
          deviceId: null,
          userId: null,
          journeyStart: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
          journeyEnd: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
          totalTouchpoints: 4,
          conversionValue: "125.50",
          conversionType: "subscription",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "journey-003",
          customerId: "CUST_003", 
          sessionId: "session_ghi789",
          deviceId: null,
          userId: null,
          journeyStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
          journeyEnd: new Date(),
          totalTouchpoints: 5,
          conversionValue: "450.00",
          conversionType: "purchase",
          status: "completed",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "journey-004",
          customerId: "CUST_004",
          sessionId: "session_jkl012", 
          deviceId: null,
          userId: null,
          journeyStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
          journeyEnd: null, // Still active
          totalTouchpoints: 6,
          conversionValue: null,
          conversionType: null,
          status: "active",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "journey-005",
          customerId: "CUST_005",
          sessionId: "session_mno345",
          deviceId: null,
          userId: null,
          journeyStart: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000), // 45 days ago
          journeyEnd: new Date(Date.now() - 35 * 24 * 60 * 60 * 1000), // 35 days ago
          totalTouchpoints: 4,
          conversionValue: null,
          conversionType: null,
          status: "abandoned",
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      ];
      
      // Filter by status if provided
      const filteredJourneys = status ? journeys.filter(j => j.status === status) : journeys;
      res.json(filteredJourneys);
    } catch (error) {
      console.error('Failed to get customer journeys:', error);
      res.status(500).json({ error: 'Failed to get customer journeys' });
    }
  });

  app.post('/api/attribution/journeys', async (req, res) => {
    try {
      const validated = insertCustomerJourneySchema.parse(req.body);
      const journey = await storage.createCustomerJourney(validated);
      res.json(journey);
    } catch (error) {
      console.error('Failed to create customer journey:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create customer journey' });
      }
    }
  });

  app.patch('/api/attribution/journeys/:id', async (req, res) => {
    try {
      const validated = insertCustomerJourneySchema.partial().parse(req.body);
      const journey = await storage.updateCustomerJourney(req.params.id, validated);
      if (!journey) {
        res.status(404).json({ error: 'Customer journey not found' });
        return;
      }
      res.json(journey);
    } catch (error) {
      console.error('Failed to update customer journey:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to update customer journey' });
      }
    }
  });

  app.get('/api/attribution/journeys/:id', async (req, res) => {
    try {
      const journey = await storage.getCustomerJourney(req.params.id);
      if (!journey) {
        res.status(404).json({ error: 'Customer journey not found' });
        return;
      }
      res.json(journey);
    } catch (error) {
      console.error('Failed to get customer journey:', error);
      res.status(500).json({ error: 'Failed to get customer journey' });
    }
  });

  // Touchpoint endpoints  
  app.get('/api/attribution/touchpoints', async (req, res) => {
    try {
      const { journeyId } = req.query;
      
      // Sample touchpoints data based on journey ID
      const touchpointsData: Record<string, any[]> = {
        "journey-001": [
          {
            id: "tp-001-1",
            journeyId: "journey-001",
            channel: "Google Ads",
            touchpointType: "paid_search",
            timestamp: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "summer_sale",
            attribution_credit: 0.20,
            sequence: 1,
            device_type: "desktop",
            referrer: "https://google.com/search?q=summer+sale",
            page_url: "/landing/summer-sale",
            conversion_value: "57.00"
          },
          {
            id: "tp-001-2", 
            journeyId: "journey-001",
            channel: "Facebook",
            touchpointType: "paid_social",
            timestamp: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
            utm_source: "facebook",
            utm_medium: "social",
            utm_campaign: "retargeting",
            attribution_credit: 0.20,
            sequence: 2,
            device_type: "mobile",
            referrer: "https://facebook.com",
            page_url: "/products/category/shoes",
            conversion_value: "57.00"
          },
          {
            id: "tp-001-3",
            journeyId: "journey-001", 
            channel: "Email",
            touchpointType: "email",
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            utm_source: "newsletter",
            utm_medium: "email",
            utm_campaign: "weekly_newsletter",
            attribution_credit: 0.20,
            sequence: 3,
            device_type: "mobile",
            referrer: "email_client",
            page_url: "/products/featured",
            conversion_value: "57.00"
          },
          {
            id: "tp-001-4",
            journeyId: "journey-001",
            channel: "Direct",
            touchpointType: "direct",
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            utm_source: "direct",
            utm_medium: "none",
            utm_campaign: "none",
            attribution_credit: 0.20,
            sequence: 4,
            device_type: "desktop",
            referrer: "",
            page_url: "/",
            conversion_value: "57.00"
          },
          {
            id: "tp-001-5",
            journeyId: "journey-001",
            channel: "Google Ads",
            touchpointType: "paid_search_retargeting",
            timestamp: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "retargeting",
            attribution_credit: 0.20,
            sequence: 5,
            device_type: "desktop",
            referrer: "https://google.com/search?q=brand+shoes",
            page_url: "/checkout",
            conversion_value: "57.00"
          }
        ],
        "journey-002": [
          {
            id: "tp-002-1",
            journeyId: "journey-002",
            channel: "LinkedIn Ads",
            touchpointType: "paid_social",
            timestamp: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000),
            utm_source: "linkedin",
            utm_medium: "social",
            utm_campaign: "b2b_software",
            attribution_credit: 0.25,
            sequence: 1,
            device_type: "desktop",
            referrer: "https://linkedin.com",
            page_url: "/landing/b2b-solution",
            conversion_value: "31.38"
          },
          {
            id: "tp-002-2",
            journeyId: "journey-002",
            channel: "Content Marketing",
            touchpointType: "organic",
            timestamp: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000),
            utm_source: "google",
            utm_medium: "organic",
            utm_campaign: "none",
            attribution_credit: 0.25,
            sequence: 2,
            device_type: "desktop",
            referrer: "https://google.com/search?q=marketing+automation",
            page_url: "/blog/marketing-automation-guide",
            conversion_value: "31.38"
          },
          {
            id: "tp-002-3",
            journeyId: "journey-002",
            channel: "Email",
            touchpointType: "email",
            timestamp: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
            utm_source: "drip_campaign",
            utm_medium: "email",
            utm_campaign: "nurture_sequence",
            attribution_credit: 0.25,
            sequence: 3,
            device_type: "desktop",
            referrer: "email_client",
            page_url: "/pricing",
            conversion_value: "31.38"
          },
          {
            id: "tp-002-4",
            journeyId: "journey-002",
            channel: "LinkedIn Ads",
            touchpointType: "paid_social_retargeting",
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            utm_source: "linkedin",
            utm_medium: "social",
            utm_campaign: "retargeting",
            attribution_credit: 0.25,
            sequence: 4,
            device_type: "desktop",
            referrer: "https://linkedin.com",
            page_url: "/signup",
            conversion_value: "31.38"
          }
        ],
        "journey-003": [
          {
            id: "tp-003-1",
            journeyId: "journey-003",
            channel: "Instagram",
            touchpointType: "paid_social",
            timestamp: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            utm_source: "instagram",
            utm_medium: "social",
            utm_campaign: "brand_awareness",
            attribution_credit: 0.20,
            sequence: 1,
            device_type: "mobile",
            referrer: "https://instagram.com",
            page_url: "/products/new-arrivals",
            conversion_value: "90.00"
          },
          {
            id: "tp-003-2",
            journeyId: "journey-003",
            channel: "Google Ads",
            touchpointType: "paid_search",
            timestamp: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "shopping_ads",
            attribution_credit: 0.20,
            sequence: 2,
            device_type: "desktop",
            referrer: "https://google.com/search?q=trendy+shoes",
            page_url: "/products/id/12345",
            conversion_value: "90.00"
          },
          {
            id: "tp-003-3",
            journeyId: "journey-003",
            channel: "YouTube",
            touchpointType: "video_ad",
            timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
            utm_source: "youtube",
            utm_medium: "video",
            utm_campaign: "product_demo",
            attribution_credit: 0.20,
            sequence: 3,
            device_type: "mobile",
            referrer: "https://youtube.com",
            page_url: "/video/product-demo",
            conversion_value: "90.00"
          },
          {
            id: "tp-003-4",
            journeyId: "journey-003",
            channel: "Email",
            touchpointType: "email",
            timestamp: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
            utm_source: "abandoned_cart",
            utm_medium: "email",
            utm_campaign: "cart_recovery",
            attribution_credit: 0.20,
            sequence: 4,
            device_type: "desktop",
            referrer: "email_client",
            page_url: "/cart",
            conversion_value: "90.00"
          },
          {
            id: "tp-003-5",
            journeyId: "journey-003",
            channel: "Google Ads",
            touchpointType: "paid_search_retargeting",
            timestamp: new Date(),
            utm_source: "google",
            utm_medium: "cpc",
            utm_campaign: "retargeting",
            attribution_credit: 0.20,
            sequence: 5,
            device_type: "desktop",
            referrer: "https://google.com/search?q=buy+shoes+now",
            page_url: "/checkout/complete",
            conversion_value: "90.00"
          }
        ]
      };
      
      const touchpoints = touchpointsData[journeyId as string] || [];
      res.json(touchpoints);
    } catch (error) {
      console.error('Failed to get touchpoints:', error);
      res.status(500).json({ error: 'Failed to get touchpoints' });
    }
  });

  app.post('/api/attribution/touchpoints', async (req, res) => {
    try {
      const validated = insertTouchpointSchema.parse(req.body);
      const touchpoint = await storage.createTouchpoint(validated);
      res.json(touchpoint);
    } catch (error) {
      console.error('Failed to create touchpoint:', error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ error: 'Validation error', details: error.errors });
      } else {
        res.status(500).json({ error: 'Failed to create touchpoint' });
      }
    }
  });

  // Attribution Calculation endpoint
  app.post('/api/attribution/calculate', async (req, res) => {
    try {
      const { journeyId, modelId } = req.body;
      
      if (!journeyId || !modelId) {
        res.status(400).json({ error: 'Journey ID and Model ID are required' });
        return;
      }

      const results = await storage.calculateAttributionResults(journeyId, modelId);
      res.json(results);
    } catch (error) {
      console.error('Failed to calculate attribution:', error);
      res.status(500).json({ error: 'Failed to calculate attribution' });
    }
  });

  // Channel Performance Attribution endpoint
  app.get('/api/attribution/channel-performance', async (req, res) => {
    try {
      const { startDate, endDate, modelId } = req.query;
      
      // Sample channel performance data with correct structure for frontend
      const performance = [
        {
          channel: "Google Ads",
          totalTouchpoints: 1247,
          totalAttributedValue: 12450.75,
          averageCredit: 0.42,
          assistedConversions: 89,
          lastClickConversions: 67,
          firstClickConversions: 78,
          conversionRate: 0.034,
          avgOrderValue: 285.00,
          attributionCredit: 0.42,
          costPerAcquisition: 45.20,
          returnOnAdSpend: 6.8
        },
        {
          channel: "Facebook",
          totalTouchpoints: 892,
          totalAttributedValue: 8920.50,
          averageCredit: 0.31,
          assistedConversions: 45,
          lastClickConversions: 23,
          firstClickConversions: 67,
          conversionRate: 0.028,
          avgOrderValue: 255.30,
          attributionCredit: 0.31,
          costPerAcquisition: 52.10,
          returnOnAdSpend: 4.9
        },
        {
          channel: "Email",
          totalTouchpoints: 634,
          totalAttributedValue: 6340.25,
          averageCredit: 0.18,
          assistedConversions: 78,
          lastClickConversions: 34,
          firstClickConversions: 12,
          conversionRate: 0.045,
          avgOrderValue: 195.80,
          attributionCredit: 0.18,
          costPerAcquisition: 12.50,
          returnOnAdSpend: 15.6
        },
        {
          channel: "Direct",
          totalTouchpoints: 423,
          totalAttributedValue: 4230.00,
          averageCredit: 0.09,
          assistedConversions: 12,
          lastClickConversions: 78,
          firstClickConversions: 34,
          conversionRate: 0.067,
          avgOrderValue: 310.50,
          attributionCredit: 0.09,
          costPerAcquisition: 0.00,
          returnOnAdSpend: 999.9
        }
      ];
      
      res.json(performance);
    } catch (error) {
      console.error('Failed to get channel performance attribution:', error);
      res.status(500).json({ error: 'Failed to get channel performance attribution' });
    }
  });

  // Campaign-specific attribution endpoint
  app.get('/api/campaigns/:campaignId/attribution', async (req, res) => {
    try {
      const { modelId } = req.query;
      
      // Get campaign touchpoints
      const touchpoints = await storage.getCampaignTouchpoints(req.params.campaignId);
      
      // Get attribution insights for this campaign
      const insights = await storage.getCampaignAttributionInsights(
        req.params.campaignId, 
        modelId as string
      );

      // Calculate campaign attribution summary
      const totalAttributedValue = touchpoints.reduce((sum, tp) => 
        sum + parseFloat(tp.eventValue || "0"), 0
      );

      res.json({
        touchpoints,
        insights,
        summary: {
          totalAttributedValue,
          totalTouchpoints: touchpoints.length,
          channelBreakdown: touchpoints.reduce((acc, tp) => {
            acc[tp.channel] = (acc[tp.channel] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error) {
      console.error('Failed to get campaign attribution:', error);
      res.status(500).json({ error: 'Failed to get campaign attribution' });
    }
  });

  // LinkedIn Import Routes
  
  // Create LinkedIn import session with metrics and ad performance data
  app.post("/api/linkedin/imports", async (req, res) => {
    try {
      const { campaignId, adAccountId, adAccountName, campaigns } = req.body;
      
      if (!campaignId || !adAccountId || !adAccountName || !campaigns || !Array.isArray(campaigns)) {
        return res.status(400).json({ message: "Invalid request body" });
      }
      
      // Count selected campaigns and metrics
      const selectedCampaignsCount = campaigns.length;
      const selectedMetricsCount = campaigns.reduce((sum, c) => sum + (c.selectedMetrics?.length || 0), 0);
      
      // Collect unique selected metric keys across all campaigns
      const selectedMetricKeysSet = new Set<string>();
      campaigns.forEach(c => {
        if (c.selectedMetrics && Array.isArray(c.selectedMetrics)) {
          c.selectedMetrics.forEach((key: string) => selectedMetricKeysSet.add(key));
        }
      });
      const selectedMetricKeys = Array.from(selectedMetricKeysSet);
      
      // Get conversion value from the first campaign (all campaigns share the same value)
      const conversionValue = campaigns[0]?.conversionValue || null;
      
      // Create import session
      const session = await storage.createLinkedInImportSession({
        campaignId,
        adAccountId,
        adAccountName,
        selectedCampaignsCount,
        selectedMetricsCount,
        selectedMetricKeys,
        conversionValue: conversionValue
      });
      
      // Create metrics for each campaign and selected metric
      for (const campaign of campaigns) {
        if (campaign.selectedMetrics && Array.isArray(campaign.selectedMetrics)) {
          for (const metricKey of campaign.selectedMetrics) {
            const metricValue = (Math.random() * 10000 + 1000).toFixed(2);
            await storage.createLinkedInImportMetric({
              sessionId: session.id,
              campaignUrn: campaign.id,
              campaignName: campaign.name,
              campaignStatus: campaign.status || "active",
              metricKey,
              metricValue
            });
          }
        }
        
        // Generate mock ad performance data (2-3 ads per campaign)
        // Only generate data for metrics that were actually selected for this campaign
        const numAds = Math.floor(Math.random() * 2) + 2;
        const selectedMetrics = campaign.selectedMetrics || [];
        
        for (let i = 0; i < numAds; i++) {
          // Initialize ad data with campaign info and defaults
          const adData: any = {
            sessionId: session.id,
            adId: `ad-${campaign.id}-${i + 1}`,
            adName: `Ad ${i + 1} - ${campaign.name}`,
            campaignUrn: campaign.id,
            campaignName: campaign.name,
            campaignSelectedMetrics: selectedMetrics,
            impressions: 0,
            clicks: 0,
            spend: "0",
            conversions: 0,
            revenue: "0",
            ctr: "0",
            cpc: "0",
            conversionRate: "0"
          };
          
          // Only populate metrics that were selected for this campaign
          // Core metrics
          if (selectedMetrics.includes('impressions')) {
            adData.impressions = Math.floor(Math.random() * 50000) + 10000;
          }
          
          if (selectedMetrics.includes('reach')) {
            adData.reach = Math.floor(Math.random() * 40000) + 8000;
          }
          
          if (selectedMetrics.includes('clicks')) {
            adData.clicks = Math.floor(Math.random() * 2000) + 500;
          }
          
          if (selectedMetrics.includes('engagements')) {
            adData.engagements = Math.floor(Math.random() * 3000) + 600;
          }
          
          if (selectedMetrics.includes('spend')) {
            adData.spend = (Math.random() * 5000 + 1000).toFixed(2);
          }
          
          if (selectedMetrics.includes('conversions')) {
            adData.conversions = Math.floor(Math.random() * 100) + 10;
          }
          
          if (selectedMetrics.includes('leads')) {
            adData.leads = Math.floor(Math.random() * 80) + 5;
          }
          
          if (selectedMetrics.includes('videoViews')) {
            adData.videoViews = Math.floor(Math.random() * 5000) + 1000;
          }
          
          if (selectedMetrics.includes('viralImpressions')) {
            adData.viralImpressions = Math.floor(Math.random() * 10000) + 2000;
          }
          
          // Calculate revenue if conversions are selected
          if (selectedMetrics.includes('conversions') && adData.conversions > 0) {
            adData.revenue = (adData.conversions * (Math.random() * 200 + 50)).toFixed(2);
          }
          
          // Calculate all derived metrics only if base metrics are available
          const spend = parseFloat(adData.spend);
          
          // CTR = (Clicks / Impressions) * 100
          if (selectedMetrics.includes('clicks') && selectedMetrics.includes('impressions') && adData.impressions > 0) {
            adData.ctr = ((adData.clicks / adData.impressions) * 100).toFixed(2);
          }
          
          // CPC = Spend / Clicks
          if (selectedMetrics.includes('spend') && selectedMetrics.includes('clicks') && adData.clicks > 0) {
            adData.cpc = (spend / adData.clicks).toFixed(2);
          }
          
          // CPM = (Spend / Impressions) * 1000
          if (selectedMetrics.includes('spend') && selectedMetrics.includes('impressions') && adData.impressions > 0) {
            adData.cpm = ((spend / adData.impressions) * 1000).toFixed(2);
          }
          
          // CVR (Conversion Rate) = (Conversions / Clicks) * 100
          if (selectedMetrics.includes('conversions') && selectedMetrics.includes('clicks') && adData.clicks > 0) {
            adData.cvr = ((adData.conversions / adData.clicks) * 100).toFixed(2);
            adData.conversionRate = adData.cvr; // Keep legacy field in sync
          }
          
          // CPA (Cost per Acquisition) = Spend / Conversions
          if (selectedMetrics.includes('spend') && selectedMetrics.includes('conversions') && adData.conversions > 0) {
            adData.cpa = (spend / adData.conversions).toFixed(2);
          }
          
          // CPL (Cost per Lead) = Spend / Leads
          if (selectedMetrics.includes('spend') && selectedMetrics.includes('leads') && adData.leads > 0) {
            adData.cpl = (spend / adData.leads).toFixed(2);
          }
          
          // ER (Engagement Rate) = (Engagements / Impressions) * 100
          if (selectedMetrics.includes('engagements') && selectedMetrics.includes('impressions') && adData.impressions > 0) {
            adData.er = ((adData.engagements / adData.impressions) * 100).toFixed(2);
          }
          
          // ROI = ((Revenue - Spend) / Spend) * 100
          if (selectedMetrics.includes('conversions') && selectedMetrics.includes('spend') && spend > 0 && parseFloat(adData.revenue) > 0) {
            const revenue = parseFloat(adData.revenue);
            adData.roi = (((revenue - spend) / spend) * 100).toFixed(2);
          }
          
          // ROAS = Revenue / Spend
          if (selectedMetrics.includes('conversions') && selectedMetrics.includes('spend') && spend > 0 && parseFloat(adData.revenue) > 0) {
            const revenue = parseFloat(adData.revenue);
            adData.roas = (revenue / spend).toFixed(2);
          }
          
          await storage.createLinkedInAdPerformance(adData);
        }
      }
      
      // Create LinkedIn connection for transfer to work
      // Check if connection already exists for this campaign
      const existingConnection = await storage.getLinkedInConnection(campaignId);
      
      if (!existingConnection) {
        // Create a test mode connection (using test data, no real OAuth tokens)
        await storage.createLinkedInConnection({
          campaignId,
          adAccountId,
          adAccountName,
          accessToken: 'test-mode-token', // Placeholder for test mode
          refreshToken: null,
          clientId: null,
          clientSecret: null,
          method: 'test',
          expiresAt: null
        });
        
        console.log('Created LinkedIn test mode connection for campaign:', campaignId);
      }
      
      // Stage 1: Automatically refresh KPIs after LinkedIn import
      try {
        const { refreshKPIsForCampaign } = await import('./utils/kpi-refresh');
        console.log(`[LinkedIn Import] Refreshing KPIs for campaign ${campaignId}...`);
        await refreshKPIsForCampaign(campaignId);
        console.log(`[LinkedIn Import] ✅ KPI refresh completed`);
        
        // Stage 2: Immediately check for alerts after KPI refresh (enterprise-grade)
        try {
          const { checkPerformanceAlerts } = await import('./kpi-scheduler');
          console.log(`[LinkedIn Import] Checking performance alerts immediately...`);
          await checkPerformanceAlerts();
          console.log(`[LinkedIn Import] ✅ Alert check completed`);
        } catch (alertError) {
          // Don't fail the import if alert check fails - log and continue
          console.error(`[LinkedIn Import] Warning: Alert check failed (import still succeeded):`, alertError);
        }
      } catch (kpiError) {
        // Don't fail the import if KPI refresh fails - log and continue
        console.error(`[LinkedIn Import] Warning: KPI refresh failed (import still succeeded):`, kpiError);
      }
      
      res.status(201).json({ success: true, sessionId: session.id });
    } catch (error) {
      console.error('LinkedIn import creation error:', error);
      res.status(500).json({ message: "Failed to create LinkedIn import" });
    }
  });
  
  // Get all import sessions for a campaign
  app.get("/api/linkedin/import-sessions/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
      res.json(sessions);
    } catch (error) {
      console.error('LinkedIn import sessions fetch error:', error);
      res.status(500).json({ message: "Failed to fetch import sessions" });
    }
  });

  // Get aggregated LinkedIn metrics for a campaign (for KPI creation)
  app.get("/api/linkedin/metrics/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      
      // Get the latest import session for this campaign
      const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
      if (!sessions || sessions.length === 0) {
        return res.json(null);
      }
      
      // Get the most recent session
      const latestSession = sessions.sort((a: any, b: any) => 
        new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
      )[0];
      
      // Get metrics for this session
      const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
      
      // Aggregate metrics
      const aggregated: Record<string, number> = {};
      const selectedMetrics = Array.from(new Set(metrics.map((m: any) => m.metricKey)));
      
      selectedMetrics.forEach((metricKey: string) => {
        const total = metrics
          .filter((m: any) => m.metricKey === metricKey)
          .reduce((sum: number, m: any) => sum + parseFloat(m.metricValue || '0'), 0);
        aggregated[metricKey] = parseFloat(total.toFixed(2));
      });
      
      // Calculate derived metrics
      const impressions = aggregated.impressions || 0;
      const clicks = aggregated.clicks || 0;
      const spend = aggregated.spend || 0;
      const conversions = aggregated.conversions || 0;
      
      // Calculate revenue from conversion value
      if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0 && conversions > 0) {
        const conversionValue = parseFloat(latestSession.conversionValue);
        aggregated.revenue = parseFloat((conversions * conversionValue).toFixed(2));
        aggregated.conversionValue = conversionValue;
        
        // Calculate ROI and ROAS if revenue is available
        if (spend > 0) {
          aggregated.roas = parseFloat((aggregated.revenue / spend).toFixed(2));
          aggregated.roi = parseFloat((((aggregated.revenue - spend) / spend) * 100).toFixed(2));
        }
      }
      
      // CTR: (Clicks / Impressions) * 100
      if (impressions > 0) {
        aggregated.ctr = parseFloat(((clicks / impressions) * 100).toFixed(2));
      }
      
      // CPC: Spend / Clicks
      if (clicks > 0) {
        aggregated.cpc = parseFloat((spend / clicks).toFixed(2));
      }
      
      // CPM: (Spend / Impressions) * 1000
      if (impressions > 0) {
        aggregated.cpm = parseFloat(((spend / impressions) * 1000).toFixed(2));
      }
      
      res.json(aggregated);
    } catch (error) {
      console.error('LinkedIn metrics fetch error:', error);
      res.status(500).json({ message: "Failed to fetch LinkedIn metrics" });
    }
  });

  // Metric Snapshot routes
  app.post("/api/campaigns/:id/snapshots", async (req, res) => {
    console.log('=== CREATE SNAPSHOT ROUTE HIT ===');
    console.log('Campaign ID:', req.params.id);
    try {
      const { id } = req.params;
      
      const parseNum = (val: any): number => {
        if (val === null || val === undefined || val === '') return 0;
        const num = typeof val === 'string' ? parseFloat(val) : Number(val);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };
      
      // Fetch LinkedIn metrics
      let linkedinMetrics: any = {};
      try {
        const sessions = await storage.getCampaignLinkedInImportSessions(id);
        if (sessions && sessions.length > 0) {
          const latestSession = sessions.sort((a: any, b: any) => 
            new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
          )[0];
          const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
          
          metrics.forEach((m: any) => {
            const value = parseFloat(m.metricValue || '0');
            const key = m.metricKey.toLowerCase();
            linkedinMetrics[key] = (linkedinMetrics[key] || 0) + value;
          });
        }
      } catch (err) {
        console.log('No LinkedIn metrics found');
      }
      
      // Fetch Custom Integration metrics
      let customIntegrationData: any = {};
      try {
        const customIntegration = await storage.getLatestCustomIntegrationMetrics(id);
        if (customIntegration) {
          customIntegrationData = customIntegration;
        }
      } catch (err) {
        console.log('No custom integration metrics found');
      }
      
      // Aggregate metrics from all sources
      const totalImpressions = parseNum(linkedinMetrics.impressions) + parseNum(customIntegrationData.impressions);
      const totalEngagements = parseNum(linkedinMetrics.engagements) + parseNum(customIntegrationData.engagements);
      const totalClicks = parseNum(linkedinMetrics.clicks) + parseNum(customIntegrationData.clicks);
      const totalConversions = parseNum(linkedinMetrics.conversions) + parseNum(customIntegrationData.conversions);
      const totalSpend = parseNum(linkedinMetrics.spend) + parseNum(customIntegrationData.spend);
      
      console.log('Snapshot metrics:', { totalImpressions, totalEngagements, totalClicks, totalConversions, totalSpend });
      
      const snapshot = await storage.createMetricSnapshot({
        campaignId: id,
        totalImpressions: Math.round(totalImpressions),
        totalEngagements: Math.round(totalEngagements),
        totalClicks: Math.round(totalClicks),
        totalConversions: Math.round(totalConversions),
        totalSpend: totalSpend.toFixed(2)
      });
      
      console.log(`Snapshot created for campaign ${id}:`, snapshot);
      res.json(snapshot);
    } catch (error) {
      console.error('Metric snapshot creation error:', error);
      res.status(500).json({ message: "Failed to create metric snapshot" });
    }
  });

  app.get("/api/campaigns/:id/snapshots/comparison", async (req, res) => {
    try {
      const { id } = req.params;
      const { type } = req.query;
      
      if (!type || !['yesterday', 'last_week', 'last_month'].includes(type as string)) {
        return res.status(400).json({ message: "Invalid comparison type. Use: yesterday, last_week, or last_month" });
      }
      
      const comparisonData = await storage.getComparisonData(id, type as 'yesterday' | 'last_week' | 'last_month');
      res.json(comparisonData);
    } catch (error) {
      console.error('Comparison data fetch error:', error);
      res.status(500).json({ message: "Failed to fetch comparison data" });
    }
  });

  // Get campaign snapshots by time period for trend analysis
  app.get("/api/campaigns/:id/snapshots", async (req, res) => {
    try {
      const { id } = req.params;
      const { period } = req.query;
      
      if (!period || !['daily', 'weekly', 'monthly'].includes(period as string)) {
        return res.status(400).json({ message: "Invalid period. Use: daily, weekly, or monthly" });
      }
      
      const snapshots = await storage.getCampaignSnapshotsByPeriod(id, period as 'daily' | 'weekly' | 'monthly');
      res.json(snapshots);
    } catch (error) {
      console.error('Snapshots fetch error:', error);
      res.status(500).json({ message: "Failed to fetch snapshots" });
    }
  });

  // Get snapshot scheduler status
  app.get("/api/snapshots/scheduler", async (req, res) => {
    try {
      const status = snapshotScheduler.getStatus();
      res.json(status);
    } catch (error) {
      console.error('Scheduler status fetch error:', error);
      res.status(500).json({ message: "Failed to fetch scheduler status" });
    }
  });

  // Get import session overview with aggregated metrics
  app.get("/api/linkedin/imports/:sessionId", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const session = await storage.getLinkedInImportSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Import session not found" });
      }
      
      // Get campaign to access conversion value
      const campaign = await storage.getCampaign(session.campaignId);
      console.log('=== LINKEDIN ANALYTICS DEBUG ===');
      console.log('Campaign ID:', session.campaignId);
      console.log('Campaign found:', campaign ? 'YES' : 'NO');
      console.log('Campaign conversion value:', campaign?.conversionValue);
      
      const rawMetrics = await storage.getLinkedInImportMetrics(sessionId);
      const ads = await storage.getLinkedInAdPerformance(sessionId);
      
      // ============================================
      // DATA VALIDATION LAYER
      // ============================================
      const { 
        LinkedInMetricSchema, 
        validateMetricValue, 
        validateMetricRelationships,
        calculateDataQualityScore 
      } = await import('./validation/linkedin-metrics.js');
      
      const validatedMetrics: any[] = [];
      const validationErrors: any[] = [];
      
      // Validate each metric
      for (const metric of rawMetrics) {
        try {
          // Schema validation
          const validated = LinkedInMetricSchema.parse(metric);
          
          // Value constraint validation
          const valueValidation = validateMetricValue(validated.metricKey, validated.metricValue);
          if (!valueValidation.isValid) {
            validationErrors.push({
              metric: validated.metricKey,
              value: validated.metricValue,
              campaign: validated.campaignName,
              error: valueValidation.error,
              timestamp: new Date(),
            });
            console.warn('[Validation Warning]', valueValidation.error);
            continue; // Skip this metric
          }
          
          validatedMetrics.push(validated);
        } catch (error) {
          console.error('[Validation Error]', error);
          validationErrors.push({
            metric: metric.metricKey,
            value: metric.metricValue,
            campaign: metric.campaignName,
            error: error instanceof Error ? error.message : 'Unknown validation error',
            timestamp: new Date(),
          });
        }
      }
      
      // Use validated metrics
      const metrics = validatedMetrics;
      
      // Log validation summary
      if (validationErrors.length > 0) {
        console.warn(`[LinkedIn Metrics Validation] ${validationErrors.length} metrics failed validation`);
      }
      
      const dataQuality = calculateDataQualityScore(
        rawMetrics.length,
        validatedMetrics.length,
        0 // Will add relationship errors later
      );
      
      console.log(`[Data Quality] Score: ${dataQuality.score.toFixed(1)}% (${dataQuality.grade}) - ${dataQuality.message}`);
      
      // Get unique selected metrics from the imported data
      const selectedMetrics = Array.from(new Set(metrics.map((m: any) => m.metricKey)));
      
      // Dynamically aggregate only the selected metrics
      const aggregated: Record<string, number> = {};
      
      selectedMetrics.forEach((metricKey: string) => {
        const total = metrics
          .filter((m: any) => m.metricKey === metricKey)
          .reduce((sum: number, m: any) => sum + parseFloat(m.metricValue || '0'), 0);
        
        // Use consistent naming: total{MetricName}
        const aggregateKey = `total${metricKey.charAt(0).toUpperCase() + metricKey.slice(1)}`;
        aggregated[aggregateKey] = parseFloat(total.toFixed(2));
      });
      
      const normalizeMetricKey = (key: any) =>
        String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');

      const sumMetricValues = (normalizedKeys: string[]) =>
        metrics.reduce((sum: number, m: any) => {
          const k = normalizeMetricKey(m.metricKey);
          if (normalizedKeys.includes(k)) {
            return sum + (parseFloat(m.metricValue || '0') || 0);
          }
          return sum;
        }, 0);

      // Calculate derived metrics (use canonical conversions so revenue tracking works regardless of LinkedIn key naming)
      const totalConversions = sumMetricValues(['conversions', 'externalwebsiteconversions']);
      aggregated.totalConversions = parseFloat(totalConversions.toFixed(2));
      const totalSpend = aggregated.totalSpend || 0;
      const totalClicks = aggregated.totalClicks || 0;
      const totalLeads = aggregated.totalLeads || 0;
      const totalImpressions = aggregated.totalImpressions || 0;
      const totalEngagements = aggregated.totalEngagements || sumMetricValues(['engagements']);
      
      // Validate metric relationships
      const { sanitizeCalculatedMetric } = await import('./validation/linkedin-metrics.js');
      const relationshipValidation = validateMetricRelationships({
        impressions: totalImpressions,
        clicks: totalClicks,
        conversions: totalConversions,
        leads: totalLeads,
        engagements: totalEngagements,
        reach: aggregated.totalReach || 0,
      });
      
      if (!relationshipValidation.isValid) {
        console.warn('[Relationship Validation] Issues detected:', relationshipValidation.errors);
        relationshipValidation.errors.forEach(err => {
          validationErrors.push({
            metric: 'relationship',
            value: null,
            campaign: session.adAccountName || 'Unknown',
            error: err,
            timestamp: new Date(),
          });
        });
      }
      
      // CTR (Click-Through Rate): (Clicks / Impressions) * 100
      if (totalImpressions > 0) {
        const ctr = (totalClicks / totalImpressions) * 100;
        aggregated.ctr = sanitizeCalculatedMetric('ctr', parseFloat(ctr.toFixed(2)));
      }
      
      // CPC (Cost Per Click): Spend / Clicks
      if (totalClicks > 0 && totalSpend > 0) {
        const cpc = totalSpend / totalClicks;
        aggregated.cpc = sanitizeCalculatedMetric('cpc', parseFloat(cpc.toFixed(2)));
      }
      
      // CPM (Cost Per Mille): (Spend / Impressions) * 1000
      if (totalImpressions > 0 && totalSpend > 0) {
        const cpm = (totalSpend / totalImpressions) * 1000;
        aggregated.cpm = sanitizeCalculatedMetric('cpm', parseFloat(cpm.toFixed(2)));
      }
      
      // CVR (Conversion Rate): (Conversions / Clicks) * 100
      if (totalClicks > 0) {
        const cvr = (totalConversions / totalClicks) * 100;
        aggregated.cvr = sanitizeCalculatedMetric('cvr', parseFloat(cvr.toFixed(2)));
      }
      
      // CPA (Cost per Conversion): Spend / Conversions
      if (totalConversions > 0 && totalSpend > 0) {
        const cpa = totalSpend / totalConversions;
        aggregated.cpa = sanitizeCalculatedMetric('cpa', parseFloat(cpa.toFixed(2)));
      }
      
      // CPL (Cost per Lead): Spend / Leads
      if (totalLeads > 0 && totalSpend > 0) {
        const cpl = totalSpend / totalLeads;
        aggregated.cpl = sanitizeCalculatedMetric('cpl', parseFloat(cpl.toFixed(2)));
      }
      
      // ER (Engagement Rate): (Total Engagements / Impressions) * 100
      if (totalImpressions > 0) {
        const er = (totalEngagements / totalImpressions) * 100;
        aggregated.er = sanitizeCalculatedMetric('er', parseFloat(er.toFixed(2)));
      }
      
      // Revenue sources (Google Sheets + HubSpot + Salesforce)
      // IMPORTANT: Revenue metrics should only be enabled when there is at least one ACTIVE *revenue-tracking* source.
      // View-only sources ("Just connect for viewing / later use") must NOT keep revenue metrics enabled.
      const googleSheetsConnections = await storage.getGoogleSheetsConnections(session.campaignId);
      const hubspotConnections = await storage.getHubspotConnections(session.campaignId);
      const salesforceConnections = await storage.getSalesforceConnections(session.campaignId);

      const isRevenueTrackingConnection = (conn: any): boolean => {
        const mappingsRaw = conn?.columnMappings || conn?.column_mappings;
        if (!mappingsRaw) return false;
        try {
          const mappings = typeof mappingsRaw === 'string' ? JSON.parse(mappingsRaw) : mappingsRaw;
          if (!Array.isArray(mappings) || mappings.length === 0) return false;
          const hasIdentifier =
            mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
            mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
          const hasValueSource =
            mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
            mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');
          return hasIdentifier && hasValueSource;
        } catch {
          return false;
        }
      };
      
      // Filter to only connections WITH MAPPINGS
      // Handle both camelCase (Drizzle) and snake_case (raw SQL) field names
      const connectionsWithMappings = googleSheetsConnections.filter((conn: any) => {
        const columnMappings = conn.columnMappings || conn.column_mappings;
        if (!columnMappings || (typeof columnMappings === 'string' && columnMappings.trim() === '')) {
          return false;
        }
        try {
          const mappings = typeof columnMappings === 'string' ? JSON.parse(columnMappings) : columnMappings;
          return Array.isArray(mappings) && mappings.length > 0;
        } catch {
          return false;
        }
      });
      
      const hasAnyActiveGoogleSheetsConnection = googleSheetsConnections.length > 0;
      const hasAnyActiveRevenueTrackingGoogleSheetsConnection =
        googleSheetsConnections.some((c: any) => (c as any)?.isActive !== false && isRevenueTrackingConnection(c));
      let hasActiveGoogleSheetsWithMappings = connectionsWithMappings.length > 0;

      const isRevenueTrackingHubspotConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignProperty && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueProperty;
        } catch {
          return false;
        }
      };

      const hasAnyActiveHubspotConnection = (hubspotConnections || []).some((c: any) => (c as any)?.isActive !== false && !!(c as any)?.accessToken);
      const hasAnyActiveRevenueTrackingHubspotConnection = (hubspotConnections || []).some((c: any) => (c as any)?.isActive !== false && isRevenueTrackingHubspotConnection(c));
      
      const isRevenueTrackingSalesforceConnection = (conn: any): boolean => {
        const raw = conn?.mappingConfig;
        if (!raw) return false;
        try {
          const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
          return !!cfg?.campaignField && Array.isArray(cfg?.selectedValues) && cfg.selectedValues.length > 0 && !!cfg?.revenueField;
        } catch {
          return false;
        }
      };

      const hasAnyActiveSalesforceConnection = (salesforceConnections || []).some((c: any) => (c as any)?.isActive !== false && !!(c as any)?.accessToken && !!(c as any)?.instanceUrl);
      const hasAnyActiveRevenueTrackingSalesforceConnection = (salesforceConnections || []).some((c: any) => (c as any)?.isActive !== false && isRevenueTrackingSalesforceConnection(c));

      const hasAnyActiveSourceConnection =
        hasAnyActiveGoogleSheetsConnection || hasAnyActiveHubspotConnection || hasAnyActiveSalesforceConnection;
      const hasAnyActiveRevenueTrackingSourceConnection =
        hasAnyActiveRevenueTrackingGoogleSheetsConnection ||
        hasAnyActiveRevenueTrackingHubspotConnection ||
        hasAnyActiveRevenueTrackingSalesforceConnection;
      
      // CRITICAL: Refetch campaign to get the latest conversion value (it might have just been updated by save-mappings)
      // The campaign was fetched earlier, but conversion value might have been updated since then
      const latestCampaign = await storage.getCampaign(session.campaignId);
      
      // CRITICAL: If we have a conversion value but no mappings detected, do a recheck immediately
      // This handles race conditions where mappings were just saved but not yet visible
      const hasConversionValue = latestCampaign?.conversionValue && parseFloat(latestCampaign.conversionValue.toString()) > 0;
      if (hasConversionValue && !hasActiveGoogleSheetsWithMappings) {
        // Recheck connections - mappings might have just been saved
        const recheckConnections = await storage.getGoogleSheetsConnections(session.campaignId);
        const recheckMappings = recheckConnections.filter((conn: any) => {
          const cm = conn.columnMappings || conn.column_mappings;
          if (!cm || (typeof cm === 'string' && cm.trim() === '')) return false;
          try {
            const m = typeof cm === 'string' ? JSON.parse(cm) : cm;
            return Array.isArray(m) && m.length > 0;
          } catch { return false; }
        });
        if (recheckMappings.length > 0) {
          hasActiveGoogleSheetsWithMappings = true;
          connectionsWithMappings.push(...recheckMappings);
        }
      }
      
      // Determine conversion value (campaign → session → linkedin connection).
      let conversionValue = 0;
      if (hasAnyActiveSourceConnection) {
        const campaignConversionValue = latestCampaign?.conversionValue
        ? parseFloat(latestCampaign.conversionValue.toString()) 
          : 0;
        const sessionConversionValue = parseFloat(session.conversionValue || '0');
        
        conversionValue = campaignConversionValue > 0 ? campaignConversionValue : sessionConversionValue;

        if (conversionValue === 0) {
          const linkedInConn = await storage.getLinkedInConnection(session.campaignId);
          if (linkedInConn?.conversionValue) {
            conversionValue = parseFloat(linkedInConn.conversionValue.toString());
          }
        }
      } else {
        // No active Google Sheets connections at all: clear stale conversion values
        console.log('[LinkedIn Analytics OAuth] ❌ NO active revenue source connections - clearing stale conversion values');
        
        // Clear stale values
        if (latestCampaign?.conversionValue) {
          await storage.updateCampaign(session.campaignId, { conversionValue: null });
        }
        if (session.conversionValue) {
          await storage.updateLinkedInImportSession(session.id, { conversionValue: null });
        }
        
        // Clear LinkedIn connection conversion value
        const linkedInConnection = await storage.getLinkedInConnection(session.campaignId);
        if (linkedInConnection?.conversionValue) {
          console.log('[LinkedIn Analytics OAuth] Clearing LinkedIn connection conversion value:', linkedInConnection.conversionValue);
          await storage.updateLinkedInConnection(session.campaignId, { conversionValue: null });
        }
        
        console.log('[LinkedIn Analytics OAuth] ✅ All conversion values cleared - revenue tracking DISABLED');
        conversionValue = 0;
      }
      
      console.log('Final conversion value used:', conversionValue);
        
        const totalRevenue = totalConversions * conversionValue;
        const profit = totalRevenue - totalSpend;
      
      // Calculate revenue metrics only if conversion value is set AND there is at least one ACTIVE revenue-tracking connection.
      // View-only connections must not keep revenue metrics enabled after a revenue source is deleted.
      const shouldEnableRevenueTracking = conversionValue > 0 && hasAnyActiveRevenueTrackingSourceConnection;
      if (shouldEnableRevenueTracking) {
        console.log('✅ Revenue tracking ENABLED');
        
        aggregated.hasRevenueTracking = 1;
        aggregated.conversionValue = conversionValue;
        aggregated.totalRevenue = parseFloat(totalRevenue.toFixed(2));
        aggregated.profit = parseFloat(profit.toFixed(2));
        
        // ROI - Return on Investment: ((Revenue - Spend) / Spend) × 100
        if (totalSpend > 0) {
          const roi = ((totalRevenue - totalSpend) / totalSpend) * 100;
          aggregated.roi = sanitizeCalculatedMetric('roi', parseFloat(roi.toFixed(2)));
        }
        
        // ROAS - Return on Ad Spend: Revenue / Spend
        if (totalSpend > 0) {
          const roas = totalRevenue / totalSpend;
          aggregated.roas = sanitizeCalculatedMetric('roas', parseFloat(roas.toFixed(2)));
        }
        
        // Profit Margin: (Profit / Revenue) × 100
        if (totalRevenue > 0) {
          const profitMargin = (profit / totalRevenue) * 100;
          aggregated.profitMargin = sanitizeCalculatedMetric('profitMargin', parseFloat(profitMargin.toFixed(2)));
        }
        
        // Revenue Per Lead: Revenue / Leads
        if (totalLeads > 0) {
          aggregated.revenuePerLead = parseFloat((totalRevenue / totalLeads).toFixed(2));
        }
      } else {
        console.log('❌ Revenue tracking DISABLED - conversion value is 0 or missing');
        aggregated.hasRevenueTracking = 0;
        aggregated.conversionValue = 0;
        aggregated.totalRevenue = 0;
        aggregated.profit = 0;
        aggregated.roi = 0;
        aggregated.roas = 0;
        aggregated.profitMargin = 0;
        aggregated.revenuePerLead = 0;
      }
      
      // Calculate performance indicators based on benchmarks
      try {
        const campaignBenchmarks = await storage.getCampaignBenchmarks(session.campaignId);
        
        if (campaignBenchmarks && campaignBenchmarks.length > 0) {
          console.log(`[Performance Indicators] Found ${campaignBenchmarks.length} benchmarks for campaign`);
          
          // Helper function to calculate performance level
          const getPerformanceLevel = (actualValue: number, benchmark: any): string | null => {
            if (!benchmark || !benchmark.benchmarkValue) return null;
            
            const target = parseFloat(benchmark.benchmarkValue);
            const metricKey = benchmark.metric?.toLowerCase();
            
            // For cost metrics (lower is better): CPC, CPM, CPA, CPL
            const lowerIsBetter = ['cpc', 'cpm', 'cpa', 'cpl'].includes(metricKey || '');
            
            if (lowerIsBetter) {
              // Lower is better logic
              if (actualValue <= target * 0.75) return 'excellent'; // 25% below target
              if (actualValue <= target) return 'good';
              if (actualValue <= target * 1.25) return 'fair'; // 25% above target
              return 'poor';
            } else {
              // Higher is better logic (CTR, CVR, ER, ROI, ROAS)
              if (actualValue >= target * 1.25) return 'excellent'; // 25% above target
              if (actualValue >= target) return 'good';
              if (actualValue >= target * 0.75) return 'fair'; // 25% below target
              return 'poor';
            }
          };
          
          // Calculate performance for each metric
          const performanceIndicators: Record<string, string | null> = {};
          
          for (const benchmark of campaignBenchmarks) {
            const metricKey = benchmark.metric?.toLowerCase();
            if (!metricKey) continue;
            
            const actualValue = aggregated[metricKey];
            if (actualValue !== undefined && actualValue !== null) {
              performanceIndicators[metricKey] = getPerformanceLevel(actualValue, benchmark);
            }
          }
          
          aggregated.performanceIndicators = performanceIndicators;
          console.log('[Performance Indicators] Calculated:', performanceIndicators);
        } else {
          console.log('[Performance Indicators] No benchmarks found for campaign');
          aggregated.performanceIndicators = {};
        }
      } catch (benchmarkError) {
        console.error('[Performance Indicators] Error calculating performance:', benchmarkError);
        aggregated.performanceIndicators = {};
      }
      
      // Calculate final data quality score
      const finalDataQuality = calculateDataQualityScore(
        rawMetrics.length,
        validatedMetrics.length,
        relationshipValidation.errors.length
      );
      
      // Prepare validation summary
      const validationSummary = validationErrors.length > 0 ? {
        totalMetrics: rawMetrics.length,
        validMetrics: validatedMetrics.length,
        invalidMetrics: validationErrors.length,
        dataQuality: finalDataQuality,
        message: `${validationErrors.length} metrics failed validation and were excluded`,
        errors: validationErrors.slice(0, 10), // Include first 10 errors for debugging
      } : undefined;
      
      res.json({
        session,
        metrics,
        aggregated,
        validationSummary
      });
    } catch (error) {
      console.error('LinkedIn import session fetch error:', error);
      res.status(500).json({ message: "Failed to fetch import session" });
    }
  });
  
  // Get ad performance data sorted by revenue
  app.get("/api/linkedin/imports/:sessionId/ads", async (req, res) => {
    try {
      const { sessionId } = req.params;
      
      const ads = await storage.getLinkedInAdPerformance(sessionId);
      
      // Sort by revenue descending (convert string to number for comparison)
      const sortedAds = ads.sort((a, b) => {
        const revenueA = parseFloat(a.revenue || '0');
        const revenueB = parseFloat(b.revenue || '0');
        return revenueB - revenueA;
      });
      
      res.json(sortedAds);
    } catch (error) {
      console.error('LinkedIn ad performance fetch error:', error);
      res.status(500).json({ message: "Failed to fetch ad performance" });
    }
  });

  // LinkedIn Reports Routes
  
  // Get all LinkedIn reports
  app.get("/api/linkedin/reports", async (req, res) => {
    try {
      const reports = await storage.getLinkedInReports();
      res.json(reports);
    } catch (error) {
      console.error('Failed to fetch LinkedIn reports:', error);
      res.status(500).json({ message: "Failed to fetch reports" });
    }
  });

  // Get single LinkedIn report
  app.get("/api/linkedin/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const report = await storage.getLinkedInReport(id);
      
      if (!report) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(report);
    } catch (error) {
      console.error('Failed to fetch LinkedIn report:', error);
      res.status(500).json({ message: "Failed to fetch report" });
    }
  });

  // Create LinkedIn report
  app.post("/api/linkedin/reports", async (req, res) => {
    try {
      const report = await storage.createLinkedInReport(req.body);
      res.status(201).json(report);
    } catch (error) {
      console.error('Failed to create LinkedIn report:', error);
      res.status(500).json({ message: "Failed to create report" });
    }
  });

  // Update LinkedIn report
  app.patch("/api/linkedin/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateLinkedInReport(id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Failed to update LinkedIn report:', error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  // Update LinkedIn report (PUT method)
  app.put("/api/linkedin/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const updated = await storage.updateLinkedInReport(id, req.body);
      
      if (!updated) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json(updated);
    } catch (error) {
      console.error('Failed to update LinkedIn report:', error);
      res.status(500).json({ message: "Failed to update report" });
    }
  });

  // Delete LinkedIn report
  app.delete("/api/linkedin/reports/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const deleted = await storage.deleteLinkedInReport(id);
      
      if (!deleted) {
        return res.status(404).json({ message: "Report not found" });
      }
      
      res.json({ success: true, message: "Report deleted successfully" });
    } catch (error) {
      console.error('Failed to delete LinkedIn report:', error);
      res.status(500).json({ message: "Failed to delete report" });
    }
  });

  // Executive Summary API endpoint - Strategic aggregated metrics
  app.get("/api/campaigns/:id/executive-summary", async (req, res) => {
    try {
      const { id } = req.params;
      
      // Get campaign details
      const campaign = await storage.getCampaign(id);
      if (!campaign) {
        return res.status(404).json({ message: "Campaign not found" });
      }

      // Helper to parse numbers safely
      const parseNum = (val: any): number => {
        if (val === null || val === undefined || val === '') return 0;
        const num = typeof val === 'string' ? parseFloat(val) : Number(val);
        return isNaN(num) || !isFinite(num) ? 0 : num;
      };

      // Helper to convert PostgreSQL interval to seconds
      const parseInterval = (interval: any): number => {
        if (!interval) return 0;
        const str = String(interval);
        // Format: "HH:MM:SS" or "MM:SS" or just seconds
        const parts = str.split(':');
        if (parts.length === 3) {
          // HH:MM:SS
          return parseInt(parts[0]) * 3600 + parseInt(parts[1]) * 60 + parseInt(parts[2]);
        } else if (parts.length === 2) {
          // MM:SS
          return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        } else {
          // Just seconds
          return parseNum(str);
        }
      };

      // Fetch LinkedIn metrics
      let linkedinMetrics: any = {
        impressions: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0
      };
      let linkedinLastUpdate: string | null = null;
      
      try {
        const sessions = await storage.getCampaignLinkedInImportSessions(id);
        if (sessions && sessions.length > 0) {
          const latestSession = sessions.sort((a: any, b: any) => 
            new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
          )[0];
          
          linkedinLastUpdate = latestSession.importedAt;
          
          const metrics = await storage.getLinkedInImportMetrics(latestSession.id);
          
          metrics.forEach((m: any) => {
            const value = parseFloat(m.metricValue || '0');
            const key = m.metricKey.toLowerCase();
            linkedinMetrics[key] = (linkedinMetrics[key] || 0) + value;
          });
          
          // Calculate LinkedIn revenue from conversion value
          if (latestSession.conversionValue && parseFloat(latestSession.conversionValue) > 0) {
            const conversionValue = parseFloat(latestSession.conversionValue);
            linkedinMetrics.revenue = linkedinMetrics.conversions * conversionValue;
          }
        }
      } catch (err) {
        console.log('No LinkedIn metrics found for campaign', id);
      }

      // Fetch Custom Integration metrics
      let customMetrics: any = {
        impressions: 0,
        engagements: 0,
        clicks: 0,
        conversions: 0,
        spend: 0,
        revenue: 0
      };
      let customIntegrationRawData: any = null; // Store raw data for website analytics
      let customIntegrationLastUpdate: string | null = null;
      let hasCustomIntegration = false;
      
      try {
        const customIntegration = await storage.getLatestCustomIntegrationMetrics(id);
        if (customIntegration) {
          hasCustomIntegration = true;
          customIntegrationRawData = customIntegration; // Store original values
          // Map GA4/Website metrics to campaign metrics
          // Pageviews = Ad Impressions equivalent (eyeballs on content)
          // Sessions = Engagement equivalent (meaningful interactions)
          customMetrics.impressions = parseNum(customIntegration.pageviews);
          customMetrics.engagements = parseNum(customIntegration.sessions);
          customMetrics.clicks = parseNum(customIntegration.clicks);
          customMetrics.conversions = parseNum(customIntegration.conversions);
          customMetrics.spend = parseNum(customIntegration.spend);
          customMetrics.revenue = 0; // Custom Integration doesn't have revenue field
          customIntegrationLastUpdate = customIntegration.uploadedAt;
        }
      } catch (err) {
        console.log('No custom integration metrics found for campaign', id);
      }

      // Fetch comparison data for trend analysis
      let comparisonData = null;
      try {
        comparisonData = await storage.getComparisonData(id, 'last_week');
      } catch (err) {
        console.log('No comparison data found');
      }

      // Data freshness validation
      const now = new Date();
      const dataFreshnessWarnings = [];
      
      if (linkedinLastUpdate) {
        const linkedinAge = (now.getTime() - new Date(linkedinLastUpdate).getTime()) / (1000 * 60 * 60 * 24); // days
        if (linkedinAge > 7) {
          dataFreshnessWarnings.push({
            source: 'LinkedIn Ads',
            age: Math.round(linkedinAge),
            severity: linkedinAge > 14 ? 'high' : 'medium',
            message: `LinkedIn data is ${Math.round(linkedinAge)} days old - recommendations may be outdated`
          });
        }
      }
      
      if (customIntegrationLastUpdate) {
        const customAge = (now.getTime() - new Date(customIntegrationLastUpdate).getTime()) / (1000 * 60 * 60 * 24); // days
        if (customAge > 7) {
          dataFreshnessWarnings.push({
            source: 'Custom Integration',
            age: Math.round(customAge),
            severity: customAge > 14 ? 'high' : 'medium',
            message: `Custom Integration data is ${Math.round(customAge)} days old - recommendations may be outdated`
          });
        }
      }

      // Aggregate totals (Custom Integration: pageviews→impressions, sessions→engagements)
      const totalImpressions = linkedinMetrics.impressions + customMetrics.impressions;
      const totalEngagements = linkedinMetrics.engagements + customMetrics.engagements;
      const totalClicks = linkedinMetrics.clicks + customMetrics.clicks;
      const totalConversions = linkedinMetrics.conversions + customMetrics.conversions;
      const totalSpend = linkedinMetrics.spend + customMetrics.spend;
      const totalRevenue = linkedinMetrics.revenue + customMetrics.revenue;

      // Calculate breakdown for funnel visualization (separate advertising from website analytics)
      const advertisingImpressions = linkedinMetrics.impressions; // Only actual ad impressions from LinkedIn
      const websitePageviews = customIntegrationRawData ? parseNum(customIntegrationRawData.pageviews) : 0; // Website pageviews from Custom Integration
      const advertisingClicks = linkedinMetrics.clicks; // Only actual ad clicks from LinkedIn
      const websiteClicks = customIntegrationRawData ? parseNum(customIntegrationRawData.clicks) : 0; // Website clicks from Custom Integration

      // Calculate KPIs
      const roas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
      const roi = totalSpend > 0 ? ((totalRevenue - totalSpend) / totalSpend) * 100 : 0;
      const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
      
      // CVR Calculation - Full Transparency Approach
      // Click-Through CVR: Only conversions that can be attributed to direct clicks (capped at 100%)
      const clickThroughConversions = Math.min(totalConversions, totalClicks);
      const clickThroughCvr = totalClicks > 0 ? (clickThroughConversions / totalClicks) * 100 : 0;
      
      // Total CVR: Includes view-through conversions (can exceed 100%)
      const totalCvr = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;
      
      // Legacy CVR for backward compatibility
      const cvr = totalCvr;
      
      const cpc = totalClicks > 0 ? totalSpend / totalClicks : 0;
      const cpa = totalConversions > 0 ? totalSpend / totalConversions : 0;

      // Calculate campaign health score (0-100)
      let healthScore = 0;
      let healthFactors = [];

      // ROI component (0-30 points)
      if (roi >= 100) { healthScore += 30; healthFactors.push({ factor: 'ROI', score: 30, status: 'excellent' }); }
      else if (roi >= 50) { healthScore += 22; healthFactors.push({ factor: 'ROI', score: 22, status: 'good' }); }
      else if (roi >= 0) { healthScore += 15; healthFactors.push({ factor: 'ROI', score: 15, status: 'acceptable' }); }
      else { healthScore += 5; healthFactors.push({ factor: 'ROI', score: 5, status: 'poor' }); }

      // ROAS component (0-25 points)
      if (roas >= 3) { healthScore += 25; healthFactors.push({ factor: 'ROAS', score: 25, status: 'excellent' }); }
      else if (roas >= 1.5) { healthScore += 18; healthFactors.push({ factor: 'ROAS', score: 18, status: 'good' }); }
      else if (roas >= 1) { healthScore += 10; healthFactors.push({ factor: 'ROAS', score: 10, status: 'acceptable' }); }
      else { healthScore += 3; healthFactors.push({ factor: 'ROAS', score: 3, status: 'poor' }); }

      // CTR component (0-20 points)
      if (ctr >= 3) { healthScore += 20; healthFactors.push({ factor: 'CTR', score: 20, status: 'excellent' }); }
      else if (ctr >= 2) { healthScore += 15; healthFactors.push({ factor: 'CTR', score: 15, status: 'good' }); }
      else if (ctr >= 1) { healthScore += 10; healthFactors.push({ factor: 'CTR', score: 10, status: 'acceptable' }); }
      else { healthScore += 3; healthFactors.push({ factor: 'CTR', score: 3, status: 'poor' }); }

      // Conversion Rate component (0-25 points)
      if (cvr >= 5) { healthScore += 25; healthFactors.push({ factor: 'CVR', score: 25, status: 'excellent' }); }
      else if (cvr >= 3) { healthScore += 18; healthFactors.push({ factor: 'CVR', score: 18, status: 'good' }); }
      else if (cvr >= 1) { healthScore += 10; healthFactors.push({ factor: 'CVR', score: 10, status: 'acceptable' }); }
      else { healthScore += 3; healthFactors.push({ factor: 'CVR', score: 3, status: 'poor' }); }

      // Determine campaign grade
      let grade = 'F';
      if (healthScore >= 90) grade = 'A';
      else if (healthScore >= 80) grade = 'B';
      else if (healthScore >= 70) grade = 'C';
      else if (healthScore >= 60) grade = 'D';

      // Platform performance breakdown - only include platforms with actual data
      const platforms: any[] = [];
      const platformsForDisplay: any[] = []; // Separate array for UI display (includes platforms with no data)
      
      // Check if LinkedIn has any meaningful advertising data
      // We check spend, conversions, or revenue (not just impressions/clicks which could be organic)
      const hasLinkedInData = linkedinMetrics.spend > 0 || linkedinMetrics.conversions > 0 || linkedinMetrics.revenue > 0;
      if (hasLinkedInData) {
        const linkedInPlatform = {
          name: 'LinkedIn Ads',
          spend: linkedinMetrics.spend,
          revenue: linkedinMetrics.revenue,
          conversions: linkedinMetrics.conversions,
          roas: linkedinMetrics.spend > 0 ? linkedinMetrics.revenue / linkedinMetrics.spend : 0,
          roi: linkedinMetrics.spend > 0 ? ((linkedinMetrics.revenue - linkedinMetrics.spend) / linkedinMetrics.spend) * 100 : 0,
          spendShare: totalSpend > 0 ? (linkedinMetrics.spend / totalSpend) * 100 : 0
        };
        platforms.push(linkedInPlatform);
        platformsForDisplay.push(linkedInPlatform);
      }
      
      // Check if Custom Integration has any meaningful advertising data
      // We check spend, conversions, or revenue (not impressions/engagements which could be website analytics)
      const hasCustomIntegrationData = customMetrics.spend > 0 || customMetrics.conversions > 0 || customMetrics.revenue > 0;
      
      if (hasCustomIntegration && customIntegrationRawData) {
        const customPlatform = {
          name: 'Custom Integration',
          spend: customMetrics.spend,
          revenue: customMetrics.revenue,
          conversions: customMetrics.conversions,
          roas: customMetrics.spend > 0 ? customMetrics.revenue / customMetrics.spend : 0,
          roi: customMetrics.spend > 0 ? ((customMetrics.revenue - customMetrics.spend) / customMetrics.spend) * 100 : 0,
          spendShare: totalSpend > 0 ? (customMetrics.spend / totalSpend) * 100 : 0,
          hasData: hasCustomIntegrationData, // Flag to indicate if platform has actual advertising data
          // Website analytics data (always included for Executive Overview)
          // Use original database values, not mapped values
          websiteAnalytics: {
            pageviews: parseNum(customIntegrationRawData.pageviews),
            sessions: parseNum(customIntegrationRawData.sessions),
            clicks: parseNum(customIntegrationRawData.clicks),
            impressions: parseNum(customIntegrationRawData.impressions), // Actual impressions from database
            users: parseNum(customIntegrationRawData.users),
            bounceRate: parseNum(customIntegrationRawData.bounceRate),
            avgSessionDuration: parseInterval(customIntegrationRawData.avgSessionDuration)
          }
        };
        
        // Only include in recommendations/insights if it has actual advertising data
        if (hasCustomIntegrationData) {
          platforms.push(customPlatform);
        }
        
        // Always include in display array (with website analytics for Executive Overview)
        platformsForDisplay.push(customPlatform);
      }

      // Identify top and bottom performers (only from platforms with data)
      const topPlatform = platforms.length > 0 ? platforms.reduce((top, p) => p.roas > top.roas ? p : top) : null;
      const bottomPlatform = platforms.length > 1 ? platforms.reduce((bottom, p) => p.roas < bottom.roas ? p : bottom) : null;

      // Calculate growth trajectory based on comparison data (only if historical data exists)
      let growthTrajectory: string | null = null;
      let trendPercentage = 0;
      let hasHistoricalData = false;
      
      if (comparisonData?.current && comparisonData?.previous) {
        hasHistoricalData = true;
        const currentRevenue = parseNum(comparisonData.current.totalConversions) * (totalRevenue / (totalConversions || 1));
        const previousRevenue = parseNum(comparisonData.previous.totalConversions) * (totalRevenue / (totalConversions || 1));
        trendPercentage = previousRevenue > 0 ? ((currentRevenue - previousRevenue) / previousRevenue) * 100 : 0;
        
        if (trendPercentage > 10) growthTrajectory = 'accelerating';
        else if (trendPercentage < -10) growthTrajectory = 'declining';
        else growthTrajectory = 'stable';
      }

      // Risk assessment - only based on platforms with actual advertising data
      let riskLevel = 'low';
      const riskFactors = [];
      
      // Platform concentration risk
      if (platforms.length === 1 && platformsForDisplay.length === 1) {
        // Only one platform total - true single platform dependency
        riskFactors.push({ type: 'concentration', message: 'Single advertising platform - diversification recommended' });
        riskLevel = 'medium';
      } else if (platforms.length === 1 && platformsForDisplay.length > 1) {
        // Multiple platforms connected but only one has advertising data
        const platformsWithoutAdData = platformsForDisplay.filter(p => !platforms.some(pd => pd.name === p.name));
        riskFactors.push({ 
          type: 'concentration', 
          message: `All advertising spend on ${platforms[0].name} - ${platformsWithoutAdData.map(p => p.name).join(', ')} ${platformsWithoutAdData.length === 1 ? 'has' : 'have'} no advertising data` 
        });
        riskLevel = 'medium';
      } else if (platforms.length > 1 && platforms[0].spendShare > 70) {
        // Multiple platforms with advertising data but high concentration
        riskFactors.push({ type: 'concentration', message: `${platforms[0].spendShare.toFixed(0)}% spend on ${platforms[0].name} - high concentration risk` });
        riskLevel = 'medium';
      }

      // Performance risk
      if (roi < 0) {
        riskFactors.push({ type: 'performance', message: 'Negative ROI - immediate optimization required' });
        riskLevel = 'high';
      } else if (roas < 1) {
        riskFactors.push({ type: 'performance', message: 'ROAS below breakeven - review campaign strategy' });
        if (riskLevel === 'low') riskLevel = 'medium';
      }

      // Declining trend risk
      if (growthTrajectory === 'declining' && trendPercentage < -15) {
        riskFactors.push({ type: 'trend', message: `Performance declining ${Math.abs(trendPercentage).toFixed(0)}% - intervention needed` });
        if (riskLevel === 'low') riskLevel = 'medium';
      }
      
      // Generate risk explanation
      let riskExplanation = '';
      if (riskLevel === 'low') {
        riskExplanation = 'Campaign is performing well with minimal risk factors. Continue monitoring performance.';
      } else if (riskLevel === 'medium') {
        const reasons = [];
        if (platforms.length === 1 && platformsForDisplay.length === 1) {
          reasons.push('single advertising platform');
        } else if (platforms.length === 1 && platformsForDisplay.length > 1) {
          reasons.push('advertising spend concentrated on one platform');
        }
        if (platforms.length > 1 && platforms[0].spendShare > 70) reasons.push('high platform concentration');
        if (roas < 1) reasons.push('ROAS below breakeven');
        if (growthTrajectory === 'declining') reasons.push('declining performance trend');
        riskExplanation = `Moderate risk due to ${reasons.join(', ')}. Review recommended.`;
      } else if (riskLevel === 'high') {
        riskExplanation = 'High risk: Campaign experiencing negative ROI. Immediate action required to prevent further losses.';
      }

      // Generate CEO summary
      let ceoSummary = '';
      if (grade === 'A' || grade === 'B') {
        ceoSummary = `${campaign.name} is performing ${grade === 'A' ? 'exceptionally' : 'well'} with ${roi >= 0 ? 'strong' : 'positive'} ROI of ${roi.toFixed(1)}% and ROAS of ${roas.toFixed(1)}x. `;
      } else if (grade === 'C') {
        ceoSummary = `${campaign.name} is showing acceptable performance with ROI of ${roi.toFixed(1)}% and ROAS of ${roas.toFixed(1)}x. `;
      } else {
        ceoSummary = `${campaign.name} requires attention with ${roi < 0 ? 'negative' : 'below-target'} ROI of ${roi.toFixed(1)}% and ROAS of ${roas.toFixed(1)}x. `;
      }

      if (topPlatform) {
        ceoSummary += `${topPlatform.name} delivering ${topPlatform.roas > 2 ? 'exceptional' : 'strong'} results (${topPlatform.roas.toFixed(1)}x ROAS). `;
      }

      if (bottomPlatform && bottomPlatform.roas < 1.5) {
        ceoSummary += `${bottomPlatform.name} underperforming and requires optimization. `;
      } else if (growthTrajectory === 'accelerating') {
        ceoSummary += `Campaign momentum growing - recommend increased investment. `;
      } else if (growthTrajectory === 'declining') {
        ceoSummary += `Performance trending downward - strategic review recommended. `;
      }

      // Strategic recommendations with enterprise-grade projections
      const recommendations = [];
      
      // Helper: Calculate diminishing returns for scaling (industry standard: 15-25% efficiency loss per doubling)
      const calculateDiminishingReturns = (currentSpend: number, additionalSpend: number, currentRoas: number) => {
        const spendIncreasePct = (additionalSpend / currentSpend) * 100;
        let efficiencyLoss = 0;
        
        // Conservative diminishing returns model based on ad platform data
        if (spendIncreasePct <= 25) efficiencyLoss = 0.05; // 5% loss for small increases
        else if (spendIncreasePct <= 50) efficiencyLoss = 0.15; // 15% loss for moderate increases  
        else if (spendIncreasePct <= 100) efficiencyLoss = 0.25; // 25% loss for doubling
        else efficiencyLoss = 0.35; // 35% loss for aggressive scaling
        
        const adjustedRoas = currentRoas * (1 - efficiencyLoss);
        return {
          adjustedRoas,
          efficiencyLoss: efficiencyLoss * 100,
          bestCase: currentRoas * (1 - efficiencyLoss * 0.5), // 50% less efficiency loss
          worstCase: currentRoas * (1 - efficiencyLoss * 1.5)  // 50% more efficiency loss
        };
      };
      
      // Budget optimization recommendations
      if (topPlatform && bottomPlatform && topPlatform.roas > bottomPlatform.roas * 1.5) {
        // Dynamic reallocation based on performance gap
        const performanceGap = topPlatform.roas / bottomPlatform.roas;
        const reallocationPct = performanceGap > 3 ? 0.5 : performanceGap > 2 ? 0.3 : 0.2;
        const reallocationAmount = bottomPlatform.spend * reallocationPct;
        
        // Conservative estimate assuming some efficiency loss
        const conservativeTopRoas = topPlatform.roas * 0.9; // 10% efficiency loss from reallocation
        const estimatedImpact = reallocationAmount * (conservativeTopRoas - bottomPlatform.roas);
        
        recommendations.push({
          priority: 'high',
          category: 'Budget Reallocation',
          action: `Shift ${(reallocationPct * 100).toFixed(0)}% ($${reallocationAmount.toFixed(0)}) from ${bottomPlatform.name} to ${topPlatform.name}`,
          expectedImpact: `+$${estimatedImpact.toFixed(0)} revenue`,
          investmentRequired: '$0 (reallocation)',
          timeline: 'Immediate',
          confidence: 'high',
          assumptions: [
            `${topPlatform.name} maintains ${(conservativeTopRoas / topPlatform.roas * 100).toFixed(0)}% of current efficiency`,
            'Sufficient audience scale available',
            'No major market changes'
          ],
          scenarios: {
            bestCase: `+$${(estimatedImpact * 1.3).toFixed(0)} revenue`,
            expected: `+$${estimatedImpact.toFixed(0)} revenue`,
            worstCase: `+$${(estimatedImpact * 0.7).toFixed(0)} revenue`
          }
        });
      }

      // Scaling recommendations with diminishing returns
      if (roi > 50 && roas > 2 && growthTrajectory !== 'declining') {
        const scaleAmount = totalSpend * 0.5;
        const scalingModel = calculateDiminishingReturns(totalSpend, scaleAmount, roas);
        
        const expectedRevenue = scaleAmount * scalingModel.adjustedRoas;
        const expectedProfit = expectedRevenue - scaleAmount;
        
        const bestCaseRevenue = scaleAmount * scalingModel.bestCase;
        const bestCaseProfit = bestCaseRevenue - scaleAmount;
        
        const worstCaseRevenue = scaleAmount * scalingModel.worstCase;
        const worstCaseProfit = worstCaseRevenue - scaleAmount;
        
        recommendations.push({
          priority: 'high',
          category: 'Scaling Opportunity',
          action: `Increase campaign budget by 50% to capitalize on strong performance`,
          expectedImpact: `+$${expectedProfit.toFixed(0)} profit (${scalingModel.adjustedRoas.toFixed(1)}x ROAS)`,
          investmentRequired: `$${scaleAmount.toFixed(0)}`,
          timeline: '30 days',
          confidence: 'medium',
          assumptions: [
            `${scalingModel.efficiencyLoss.toFixed(0)}% efficiency loss from diminishing returns`,
            'Audience targeting remains effective at scale',
            'Market demand supports increased spend',
            'Creative performance remains stable'
          ],
          scenarios: {
            bestCase: `+$${bestCaseProfit.toFixed(0)} profit (${scalingModel.bestCase.toFixed(1)}x ROAS)`,
            expected: `+$${expectedProfit.toFixed(0)} profit (${scalingModel.adjustedRoas.toFixed(1)}x ROAS)`,
            worstCase: `+$${worstCaseProfit.toFixed(0)} profit (${scalingModel.worstCase.toFixed(1)}x ROAS)`
          },
          disclaimer: 'Projections based on industry-standard diminishing returns. Actual results may vary based on audience saturation, competition, and creative fatigue.'
        });
      }

      // Optimization recommendations with realistic projections
      if (bottomPlatform && bottomPlatform.roas < 1.5) {
        const targetRoas = 1.5;
        const currentRoasGap = targetRoas - bottomPlatform.roas;
        const potentialRevenueLift = bottomPlatform.spend * currentRoasGap;
        
        recommendations.push({
          priority: 'medium',
          category: 'Performance Optimization',
          action: `Optimize ${bottomPlatform.name} targeting and creative (current ROAS: ${bottomPlatform.roas.toFixed(1)}x)`,
          expectedImpact: `+$${potentialRevenueLift.toFixed(0)} revenue at 1.5x ROAS target`,
          investmentRequired: 'Creative & targeting resources',
          timeline: '60 days',
          confidence: 'medium',
          assumptions: [
            'Optimization achieves industry-average 1.5x ROAS',
            'Testing and iteration improve targeting precision',
            'Creative refresh reduces ad fatigue'
          ],
          scenarios: {
            bestCase: `+$${(potentialRevenueLift * 1.4).toFixed(0)} revenue (1.7x ROAS)`,
            expected: `+$${potentialRevenueLift.toFixed(0)} revenue (1.5x ROAS)`,
            worstCase: `+$${(potentialRevenueLift * 0.6).toFixed(0)} revenue (1.3x ROAS)`
          },
          disclaimer: 'Optimization success depends on execution quality and market conditions. Historical improvements vary 20-40%.'
        });
      }

      // Diversification recommendations with realistic expectations
      if (platforms.length === 1) {
        const testBudget = totalSpend * 0.15; // 15% of current spend for testing
        const conservativeRoas = roas * 0.7; // Assume 30% lower ROAS on new platform
        const expectedRevenue = testBudget * conservativeRoas;
        const expectedProfit = expectedRevenue - testBudget;
        
        recommendations.push({
          priority: 'medium',
          category: 'Risk Mitigation',
          action: 'Test additional platforms to reduce single-platform dependency',
          expectedImpact: `${expectedProfit > 0 ? `+$${expectedProfit.toFixed(0)} profit` : 'Reduced platform risk'} from diversification`,
          investmentRequired: `$${testBudget.toFixed(0)} testing budget`,
          timeline: '90 days',
          confidence: 'low',
          assumptions: [
            'New platform achieves 70% of current ROAS initially',
            'Learning curve spans 60-90 days',
            'Risk reduction outweighs potential lower initial returns'
          ],
          scenarios: {
            bestCase: `+$${(testBudget * roas - testBudget).toFixed(0)} profit (matches current ROAS)`,
            expected: `+$${expectedProfit.toFixed(0)} profit (70% of current ROAS)`,
            worstCase: `-$${(testBudget * 0.4).toFixed(0)} loss (testing investment only)`
          },
          disclaimer: 'Diversification is primarily a risk mitigation strategy. Initial ROI may be lower during testing phase.'
        });
      }

      res.json({
        campaign: {
          id: campaign.id,
          name: campaign.name,
          objective: campaign.objective || 'Drive conversions and revenue'
        },
        metrics: {
          totalRevenue,
          totalSpend,
          totalConversions,
          totalClicks,
          totalImpressions,
          totalEngagements,
          roi,
          roas,
          ctr,
          cvr,
          clickThroughCvr,
          totalCvr,
          clickThroughConversions,
          cpc,
          cpa,
          // Funnel breakdown (separate advertising from website analytics)
          advertisingImpressions,
          websitePageviews,
          advertisingClicks,
          websiteClicks
        },
        health: {
          score: Math.round(healthScore),
          grade,
          factors: healthFactors,
          ...(hasHistoricalData && { 
            trajectory: growthTrajectory,
            trendPercentage 
          })
        },
        risk: {
          level: riskLevel,
          explanation: riskExplanation,
          factors: riskFactors
        },
        platforms: platformsForDisplay, // UI display - includes all connected platforms
        platformsWithData: platforms, // Only platforms with actual data (for internal use)
        topPerformer: topPlatform,
        bottomPerformer: bottomPlatform,
        ceoSummary,
        recommendations,
        dataFreshness: {
          linkedinLastUpdate,
          customIntegrationLastUpdate,
          warnings: dataFreshnessWarnings,
          overallStatus: dataFreshnessWarnings.length === 0 ? 'current' : 
                        dataFreshnessWarnings.some(w => w.severity === 'high') ? 'stale' : 'aging'
        },
        metadata: {
          generatedAt: now.toISOString(),
          disclaimer: 'All projections are estimates based on historical performance and industry benchmarks. Actual results will vary based on market conditions, competition, creative execution, and other factors. Recommendations should be validated through controlled testing before full implementation.',
          dataAccuracy: {
            hasLinkedInData,
            hasCustomIntegrationData,
            platformsExcludedFromRecommendations: platformsForDisplay.filter(p => !platforms.some(pd => pd.name === p.name)).map(p => p.name)
          }
        }
      });

    } catch (error) {
      console.error('Executive summary error:', error);
      res.status(500).json({ message: "Failed to generate executive summary" });
    }
  });

  // ============================================================================
  // TRANSFER CONNECTION ENDPOINTS
  // ============================================================================

  // Transfer GA4 connection from temp campaign to real campaign
  app.post("/api/ga4/transfer-connection", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;

      console.log(`[GA4 Transfer] Transferring connection from ${fromCampaignId} to ${toCampaignId}`);

      if (!fromCampaignId || !toCampaignId) {
        return res.status(400).json({ 
          success: false, 
          error: "Both fromCampaignId and toCampaignId are required" 
        });
      }

      // Get existing connections from temp campaign
      const existingConnections = await storage.getGA4Connections(fromCampaignId);
      console.log(`[GA4 Transfer] Found ${existingConnections.length} connections for ${fromCampaignId}`);

      if (existingConnections.length === 0) {
        console.log(`[GA4 Transfer] No connections found for ${fromCampaignId}`);
        return res.status(404).json({ 
          success: false, 
          error: "No GA4 connection found for source campaign" 
        });
      }

      // Get the primary connection or the first one
      const existingConnection = existingConnections.find(c => c.isPrimary) || existingConnections[0];
      console.log(`[GA4 Transfer] Using connection ${existingConnection.id} (isPrimary: ${existingConnection.isPrimary})`);

      // Create new connection for target campaign
      const newConnection = await storage.createGA4Connection({
        campaignId: toCampaignId,
        propertyId: existingConnection.propertyId,
        accessToken: existingConnection.accessToken,
        refreshToken: existingConnection.refreshToken,
        method: 'access_token',
        propertyName: existingConnection.propertyName,
        serviceAccountKey: existingConnection.serviceAccountKey,
        isPrimary: true,
        isActive: true,
        clientId: existingConnection.clientId,
        clientSecret: existingConnection.clientSecret,
        expiresAt: existingConnection.expiresAt
      });

      await storage.setPrimaryGA4Connection(toCampaignId, newConnection.id);
      console.log(`[GA4 Transfer] Created new connection ${newConnection.id} for ${toCampaignId} (isPrimary: ${newConnection.isPrimary}, isActive: ${newConnection.isActive})`);

      // Delete temp connections
      const tempConnections = await storage.getGA4Connections(fromCampaignId);
      for (const conn of tempConnections) {
        await storage.deleteGA4Connection(conn.id);
        console.log(`[GA4 Transfer] Deleted temp connection ${conn.id}`);
      }

      res.json({ 
        success: true, 
        message: 'GA4 connection transferred successfully',
        connectionId: newConnection.id
      });
    } catch (error) {
      console.error('[GA4 Transfer] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to transfer GA4 connection' 
      });
    }
  });

  // Set GA4 property for a campaign (used during initial setup)
  app.post("/api/campaigns/:id/ga4-property", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { propertyId } = req.body;

      console.log(`[Set Property] Setting property ${propertyId} for campaign ${campaignId}`);

      if (!propertyId) {
        return res.status(400).json({ 
          success: false, 
          error: "Property ID is required" 
        });
      }

      // Get connection from real GA4 client
      const connection = realGA4Client.getConnection(campaignId);
      if (!connection) {
        console.log(`[Set Property] No connection found in realGA4Client for ${campaignId}`);
        return res.status(404).json({ 
          success: false, 
          error: "No active GA4 connection found" 
        });
      }

      // Update property ID in memory
      realGA4Client.setPropertyId(campaignId, propertyId);

      // Find property name from available properties
      const propertyName = connection.availableProperties?.find(p => p.id === propertyId)?.name || propertyId;
      console.log(`[Set Property] Property name: ${propertyName}`);

      // Check if connection already exists in database
      const existingConnections = await storage.getGA4Connections(campaignId);
      console.log(`[Set Property] Found ${existingConnections.length} existing connections for ${campaignId}`);

      if (existingConnections.length > 0) {
        // Update existing connection
        const existingConnection = existingConnections[0];
        console.log(`[Set Property] Updating existing connection ${existingConnection.id}`);
        
        await storage.updateGA4Connection(existingConnection.id, {
          propertyId,
          propertyName,
          isPrimary: true,
          isActive: true
        });
        
        await storage.setPrimaryGA4Connection(campaignId, existingConnection.id);
        console.log(`[Set Property] Connection updated and set as primary`);
      } else {
        // Create new connection
        console.log(`[Set Property] Creating new connection for ${campaignId} with property ${propertyId}`);
        
        const newConnection = await storage.createGA4Connection({
          campaignId,
          propertyId,
          accessToken: connection.accessToken || '',
          refreshToken: connection.refreshToken || '',
          method: 'access_token',
          propertyName,
          isPrimary: true,
          isActive: true,
          clientId: process.env.GOOGLE_CLIENT_ID || undefined,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET || undefined,
          expiresAt: connection.expiresAt ? new Date(connection.expiresAt) : undefined
        });

        await storage.setPrimaryGA4Connection(campaignId, newConnection.id);
        console.log(`[Set Property] New connection created: ${newConnection.id}, isPrimary: ${newConnection.isPrimary}, isActive: ${newConnection.isActive}`);
      }

      res.json({ 
        success: true, 
        message: "Property set successfully" 
      });
    } catch (error) {
      console.error('[Set Property] Error:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Failed to set property' 
      });
    }
  });

  // Check GA4 connection status for a campaign
  app.get("/api/ga4/check-connection/:campaignId", async (req, res) => {
    try {
      const campaignId = req.params.campaignId;
      console.log(`[GA4 Check] Checking connection for campaign ${campaignId}`);

      const connections = await storage.getGA4Connections(campaignId);
      console.log(`[GA4 Check] Found ${connections.length} connections in database`);

      if (connections.length > 0) {
        const primaryConnection = connections.find(c => c.isPrimary) || connections[0];
        console.log(`[GA4 Check] Returning connected=true for ${campaignId}, primary connection: ${primaryConnection.id}`);
        
        res.json({
          connected: true,
          totalConnections: connections.length,
          primaryConnection: {
            id: primaryConnection.id,
            propertyId: primaryConnection.propertyId,
            propertyName: primaryConnection.propertyName,
            isPrimary: primaryConnection.isPrimary,
            isActive: primaryConnection.isActive
          },
          connections: connections.map(c => ({
            id: c.id,
            propertyId: c.propertyId,
            propertyName: c.propertyName,
            isPrimary: c.isPrimary,
            isActive: c.isActive
          }))
        });
      } else {
        console.log(`[GA4 Check] No connections found for ${campaignId}, returning connected=false`);
        res.json({ 
          connected: false, 
          totalConnections: 0, 
          connections: [] 
        });
      }
    } catch (error) {
      console.error('[GA4 Check] Error:', error);
      res.status(500).json({ 
        connected: false, 
        error: 'Failed to check connection status' 
      });
    }
  });

  // Get GA4 connection status (used during setup flow)
  app.get("/api/campaigns/:id/ga4-connection-status", async (req, res) => {
    try {
      const campaignId = req.params.id;
      console.log(`[GA4 Status] Checking status for campaign ${campaignId}`);

      const connection = realGA4Client.getConnection(campaignId);
      
      if (connection && connection.availableProperties) {
        console.log(`[GA4 Status] Found connection with ${connection.availableProperties.length} properties`);
        res.json({
          connected: true,
          properties: connection.availableProperties,
          email: connection.email
        });
      } else {
        console.log(`[GA4 Status] No connection found for ${campaignId}`);
        res.json({ connected: false, properties: [] });
      }
    } catch (error) {
      console.error('[GA4 Status] Error:', error);
      res.status(500).json({ 
        connected: false, 
        error: 'Failed to get connection status' 
      });
    }
  });

  // Transfer Google Sheets connection
  app.post("/api/google-sheets/transfer-connection", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;
      console.log(`[Sheets Transfer] Transferring from ${fromCampaignId} to ${toCampaignId}`);

      const existingConnection = await storage.getGoogleSheetsConnection(fromCampaignId);
      
      if (!existingConnection) {
        return res.status(404).json({ 
          success: false, 
          error: "No Google Sheets connection found" 
        });
      }

      await storage.createGoogleSheetsConnection({
        campaignId: toCampaignId,
        spreadsheetId: existingConnection.spreadsheetId,
        spreadsheetName: existingConnection.spreadsheetName,
        accessToken: existingConnection.accessToken,
        refreshToken: existingConnection.refreshToken,
        clientId: existingConnection.clientId,
        clientSecret: existingConnection.clientSecret,
        expiresAt: existingConnection.expiresAt
      });

      await storage.deleteGoogleSheetsConnection(fromCampaignId);
      console.log(`[Sheets Transfer] Transfer complete`);

      res.json({ success: true, message: 'Google Sheets connection transferred' });
    } catch (error) {
      console.error('[Sheets Transfer] Error:', error);
      res.status(500).json({ success: false, error: 'Transfer failed' });
    }
  });

  // Transfer LinkedIn connection
  app.post("/api/linkedin/transfer-connection", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;
      console.log(`[LinkedIn Transfer] Transferring from ${fromCampaignId} to ${toCampaignId}`);

      const existingConnection = await storage.getLinkedInConnection(fromCampaignId);
      
      if (!existingConnection) {
        return res.status(404).json({ 
          success: false, 
          error: "No LinkedIn connection found" 
        });
      }

      // Transfer the connection
      await storage.createLinkedInConnection({
        campaignId: toCampaignId,
        adAccountId: existingConnection.adAccountId,
        adAccountName: existingConnection.adAccountName,
        accessToken: existingConnection.accessToken,
        refreshToken: existingConnection.refreshToken,
        clientId: existingConnection.clientId,
        clientSecret: existingConnection.clientSecret,
        method: existingConnection.method,
        expiresAt: existingConnection.expiresAt
      });

      // Transfer import sessions
      const importSessions = await storage.getCampaignLinkedInImportSessions(fromCampaignId);
      console.log(`[LinkedIn Transfer] Found ${importSessions?.length || 0} import sessions to transfer`);
      
      if (importSessions && importSessions.length > 0) {
        for (const session of importSessions) {
          // Update the session's campaignId
          await storage.updateLinkedInImportSession(session.id, { campaignId: toCampaignId });
          console.log(`[LinkedIn Transfer] Transferred session ${session.id} to campaign ${toCampaignId}`);
        }
      }

      await storage.deleteLinkedInConnection(fromCampaignId);
      console.log(`[LinkedIn Transfer] Transfer complete`);

      res.json({ success: true, message: 'LinkedIn connection and import sessions transferred' });
    } catch (error) {
      console.error('[LinkedIn Transfer] Error:', error);
      res.status(500).json({ success: false, error: 'Transfer failed' });
    }
  });

  // ============================================================================
  // CUSTOM INTEGRATION
  // ============================================================================

  /**
   * Connect custom integration for a campaign
   * Creates a custom integration with webhook token and unique email address
   */
  app.post("/api/custom-integration/:campaignId/connect", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { allowedEmailAddresses, campaignName } = req.body;

      console.log(`[Custom Integration] Connecting for campaign ${campaignId}`);

      // Handle temporary campaign during setup flow
      let nameForEmail: string;
      
      if (campaignId === 'temp-campaign-setup') {
        // Use provided campaign name or generate a temporary one
        nameForEmail = campaignName || `temp-${Date.now()}`;
        console.log(`[Custom Integration] Using temporary campaign name: ${nameForEmail}`);
      } else {
        // Get campaign details to generate email from name
        const campaign = await storage.getCampaign(campaignId);
        if (!campaign) {
          return res.status(404).json({ error: 'Campaign not found' });
        }
        nameForEmail = campaign.name;
      }

      // Generate unique email address based on campaign name
      const { generateCampaignEmail } = await import('./utils/email-generator');
      const campaignEmail = await generateCampaignEmail(nameForEmail, storage);

      console.log(`[Custom Integration] Generated email: ${campaignEmail}`);

      // Generate a unique webhook token for security
      const webhookToken = randomBytes(32).toString('hex');

      // Create the custom integration
      const integration = await storage.createCustomIntegration({
        campaignId,
        email: campaignEmail, // Store the generated email
        webhookToken,
        allowedEmailAddresses: allowedEmailAddresses || []
      });

      console.log(`[Custom Integration] Created integration with email: ${campaignEmail}`);

      res.json({
        success: true,
        integration,
        campaignEmail,  // Return email for UI display
        webhookUrl: `${req.protocol}://${req.get('host')}/api/mailgun/inbound`
      });
    } catch (error: any) {
      console.error('[Custom Integration] Connection error:', error);
      res.status(500).json({ error: error.message || 'Failed to connect custom integration' });
    }
  });

  /**
   * Upload PDF for custom integration
   * Uses multer middleware for file handling (imported at top of file)
   */
  app.post("/api/custom-integration/:campaignId/upload-pdf", upload.single('pdf'), async (req, res) => {
    try {
      const { campaignId } = req.params;
      console.log(`[Custom Integration] PDF upload for campaign ${campaignId}`);

      // Check if custom integration exists
      const integration = await storage.getCustomIntegration(campaignId);
      if (!integration) {
        return res.status(404).json({ error: 'Custom integration not found. Please connect first.' });
      }

      // Check if file was uploaded
      if (!req.file) {
        return res.status(400).json({ error: 'No PDF file uploaded' });
      }

      console.log(`[Custom Integration] Processing PDF: ${req.file.originalname}, size: ${req.file.size} bytes`);
      
      // Parse the PDF
      const { parsePDFMetrics } = await import('./services/pdf-parser');
      const metrics = await parsePDFMetrics(req.file.buffer);

      // Store the metrics
      await storage.createCustomIntegrationMetrics({
        campaignId,
        ...metrics,
        pdfFileName: req.file.originalname,
        emailSubject: `Manual Upload: ${req.file.originalname}`,
        emailId: `manual-${Date.now()}`
      });

      console.log(`[Custom Integration] PDF parsed and metrics stored for campaign ${campaignId}`);
      console.log(`[Custom Integration] Metrics confidence: ${metrics._confidence}%`);

      res.json({
        success: true,
        message: 'PDF uploaded and parsed successfully',
        ...metrics
      });
    } catch (error: any) {
      console.error('[Custom Integration] PDF upload error:', error);
      res.status(500).json({ error: error.message || 'Failed to upload PDF' });
    }
  });

  /**
   * SendGrid Inbound Parse Webhook
   * Receives forwarded emails with PDF attachments
   * Email format: {campaign-slug}@import.mforensics.com
   */
  app.post("/api/sendgrid/inbound", async (req, res) => {
    try {
      console.log('[SendGrid] Received inbound email webhook');

      // 1. Verify webhook signature (if SendGrid verification key is configured)
      if (process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY) {
        const signature = req.headers['x-twilio-email-event-webhook-signature'];
        const timestamp = req.headers['x-twilio-email-event-webhook-timestamp'];
        
        if (signature && timestamp) {
          const crypto = await import('crypto');
          const payload = timestamp + JSON.stringify(req.body);
          const expectedSignature = crypto
            .createHmac('sha256', process.env.SENDGRID_WEBHOOK_VERIFICATION_KEY)
            .update(payload)
            .digest('base64');
          
          if (signature !== expectedSignature) {
            console.error('[SendGrid] Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
        }
      }

      // 2. Extract email details (SendGrid format)
      const recipient = req.body.to; // e.g., "q4-wine-marketing@import.mforensics.com"
      const sender = req.body.from;
      const subject = req.body.subject || 'No subject';
      
      console.log(`[SendGrid] Recipient: ${recipient}`);
      console.log(`[SendGrid] From: ${sender}`);
      console.log(`[SendGrid] Subject: ${subject}`);

      // 3. Find campaign by email address
      const { extractEmailAddress } = await import('./utils/email-generator');
      const cleanRecipient = extractEmailAddress(recipient);
      
      const integration = await storage.getCustomIntegrationByEmail(cleanRecipient);
      
      if (!integration) {
        console.error(`[SendGrid] No integration found for email: ${cleanRecipient}`);
        return res.status(404).json({ error: 'Campaign not found for this email address' });
      }

      const campaignId = integration.campaignId;
      console.log(`[SendGrid] Routing to campaign: ${campaignId}`);

      // 4. Check email whitelist (if configured)
      if (integration.allowedEmailAddresses && integration.allowedEmailAddresses.length > 0) {
        const cleanSender = extractEmailAddress(sender);
        if (!integration.allowedEmailAddresses.includes(cleanSender)) {
          console.error(`[SendGrid] Sender ${cleanSender} not in whitelist`);
          return res.status(403).json({ error: 'Sender not authorized' });
        }
      }

      // 5. Extract PDF attachment (SendGrid format - JSON with base64)
      let pdfBuffer: Buffer | null = null;
      let pdfFileName: string | null = null;

      // SendGrid sends attachments as JSON string
      const attachmentsStr = req.body.attachments;
      if (attachmentsStr) {
        try {
          const attachments = JSON.parse(attachmentsStr);
          console.log(`[SendGrid] Found ${attachments.length} attachment(s)`);
          
          // Find PDF attachment
          const pdfAttachment = attachments.find((att: any) => 
            att.type === 'application/pdf' || att.filename?.endsWith('.pdf')
          );
          
          if (pdfAttachment) {
            console.log(`[SendGrid] Found PDF: ${pdfAttachment.filename}`);
            pdfBuffer = Buffer.from(pdfAttachment.content, 'base64');
            pdfFileName = pdfAttachment.filename || 'report.pdf';
          }
        } catch (parseError) {
          console.error('[SendGrid] Failed to parse attachments JSON:', parseError);
        }
      }

      if (!pdfBuffer) {
        console.error(`[SendGrid] No PDF attachment found in email`);
        return res.status(400).json({ error: 'No PDF attachment found' });
      }

      console.log(`[SendGrid] Processing PDF: ${pdfFileName}, size: ${pdfBuffer.length} bytes`);

      // 6. Parse PDF
      const { parsePDFMetrics } = await import('./services/pdf-parser');
      const metrics = await parsePDFMetrics(pdfBuffer);

      // 7. Store metrics
      await storage.createCustomIntegrationMetrics({
        campaignId,
        ...metrics,
        pdfFileName,
        emailSubject: subject,
        emailId: req.body['message-id'] || `sendgrid-${Date.now()}`,
      });

      console.log(`[SendGrid] ✅ Metrics stored for campaign ${campaignId}`);
      console.log(`[SendGrid] Confidence: ${metrics._confidence}%`);

      if (metrics._requiresReview) {
        console.warn(`[SendGrid] ⚠️  Metrics require manual review (confidence: ${metrics._confidence}%)`);
      }

      res.json({
        success: true,
        message: 'PDF processed successfully',
        confidence: metrics._confidence,
        requiresReview: metrics._requiresReview,
        campaignId
      });

    } catch (error: any) {
      console.error('[SendGrid] Error processing email:', error);
      res.status(500).json({ error: 'Failed to process email' });
    }
  });

  /**
   * Mailgun Inbound Webhook
   * Receives forwarded emails with PDF attachments
   * Email format: {campaign-slug}@sandbox....mailgun.org
   * Note: Uses multer middleware to parse multipart/form-data from Mailgun
   */
  app.post("/api/mailgun/inbound", upload.any(), async (req, res) => {
    try {
      console.log('[Mailgun] Received inbound email webhook');
      console.log('[Mailgun] Request body keys:', Object.keys(req.body));

      // 1. Verify webhook signature (if Mailgun signing key is configured)
      if (process.env.MAILGUN_WEBHOOK_SIGNING_KEY) {
        const crypto = await import('crypto');
        const timestamp = req.body.timestamp;
        const token = req.body.token;
        const signature = req.body.signature;
        
        if (timestamp && token && signature) {
          const expectedSignature = crypto
            .createHmac('sha256', process.env.MAILGUN_WEBHOOK_SIGNING_KEY)
            .update(timestamp + token)
            .digest('hex');
          
          if (signature !== expectedSignature) {
            console.error('[Mailgun] Invalid webhook signature');
            return res.status(401).json({ error: 'Invalid signature' });
          }
          console.log('[Mailgun] Signature verified');
        }
      }

      // 2. Extract email details (Mailgun format)
      const recipient = req.body.recipient; // e.g., "temp-1763426057214@sandbox....mailgun.org"
      const sender = req.body.sender || req.body.from;
      const subject = req.body.subject || 'No subject';
      
      console.log(`[Mailgun] Recipient: ${recipient}`);
      console.log(`[Mailgun] From: ${sender}`);
      console.log(`[Mailgun] Subject: ${subject}`);

      // 3. Find campaign by email address
      const { extractEmailAddress } = await import('./utils/email-generator');
      const cleanRecipient = extractEmailAddress(recipient);
      
      const integration = await storage.getCustomIntegrationByEmail(cleanRecipient);
      
      if (!integration) {
        console.error(`[Mailgun] No integration found for email: ${cleanRecipient}`);
        return res.status(404).json({ error: 'Campaign not found for this email address' });
      }

      const campaignId = integration.campaignId;
      console.log(`[Mailgun] Routing to campaign: ${campaignId}`);

      // 4. Check email whitelist (if configured)
      if (integration.allowedEmailAddresses && integration.allowedEmailAddresses.length > 0) {
        const cleanSender = extractEmailAddress(sender);
        if (!integration.allowedEmailAddresses.includes(cleanSender)) {
          console.error(`[Mailgun] Sender ${cleanSender} not in whitelist`);
          return res.status(403).json({ error: 'Sender not authorized' });
        }
      }

      // 5. Extract PDF attachment (Mailgun format via multer)
      let pdfBuffer: Buffer | null = null;
      let pdfFileName: string | null = null;

      // Multer parses multipart/form-data and puts files in req.files
      const files = (req as any).files as Express.Multer.File[] | undefined;
      console.log(`[Mailgun] Found ${files?.length || 0} file(s)`);
      
      if (files && files.length > 0) {
        // Find PDF file
        const pdfFile = files.find(file => 
          file.mimetype === 'application/pdf' || 
          file.originalname?.endsWith('.pdf') ||
          file.fieldname?.startsWith('attachment-')
        );
        
        if (pdfFile) {
          console.log(`[Mailgun] Found PDF: ${pdfFile.originalname}, size: ${pdfFile.size} bytes`);
          pdfBuffer = pdfFile.buffer;
          pdfFileName = pdfFile.originalname || 'report.pdf';
        }
      }

      if (!pdfBuffer) {
        console.error(`[Mailgun] No PDF attachment found in email`);
        console.log(`[Mailgun] Available body fields:`, Object.keys(req.body));
        console.log(`[Mailgun] Files:`, files?.map(f => ({ name: f.originalname, field: f.fieldname, type: f.mimetype })));
        return res.status(400).json({ error: 'No PDF attachment found' });
      }

      console.log(`[Mailgun] Processing PDF: ${pdfFileName}, size: ${pdfBuffer.length} bytes`);

      // 6. Parse PDF
      const { parsePDFMetrics } = await import('./services/pdf-parser');
      const metrics = await parsePDFMetrics(pdfBuffer);

      // 7. Store metrics
      await storage.createCustomIntegrationMetrics({
        campaignId,
        ...metrics,
        pdfFileName,
        emailSubject: subject,
        emailId: req.body['message-id'] || req.body['Message-Id'] || `mailgun-${Date.now()}`,
      });

      console.log(`[Mailgun] ✅ Metrics stored for campaign ${campaignId}`);
      console.log(`[Mailgun] Confidence: ${metrics._confidence}%`);

      if (metrics._requiresReview) {
        console.warn(`[Mailgun] ⚠️  Metrics require manual review (confidence: ${metrics._confidence}%)`);
      }

      res.json({
        success: true,
        message: 'PDF processed successfully',
        confidence: metrics._confidence,
        requiresReview: metrics._requiresReview,
        campaignId
      });

    } catch (error: any) {
      console.error('[Mailgun] Error processing email:', error);
      res.status(500).json({ error: 'Failed to process email' });
    }
  });

  // Transfer Custom Integration
  app.post("/api/custom-integration/transfer", async (req, res) => {
    try {
      const { fromCampaignId, toCampaignId } = req.body;
      console.log(`[Custom Integration Transfer] Transferring from ${fromCampaignId} to ${toCampaignId}`);

      const existingIntegration = await storage.getCustomIntegration(fromCampaignId);
      
      if (!existingIntegration) {
        return res.status(404).json({ 
          success: false, 
          error: "No custom integration found" 
        });
      }

      // Create new integration connection
      const newIntegration = await storage.createCustomIntegration({
        campaignId: toCampaignId,
        email: existingIntegration.email,
        webhookToken: existingIntegration.webhookToken,
        allowedEmailAddresses: existingIntegration.allowedEmailAddresses
      });
      console.log(`[Custom Integration Transfer] Created new integration for campaign ${toCampaignId}:`, {
        id: newIntegration.id,
        webhookToken: newIntegration.webhookToken,
        email: newIntegration.email
      });

      // Transfer metrics data if any exists (but NOT from temp-campaign-setup)
      // temp-campaign-setup is just a placeholder and may have old test data
      const shouldTransferMetrics = fromCampaignId !== 'temp-campaign-setup';
      const existingMetrics = shouldTransferMetrics 
        ? await storage.getAllCustomIntegrationMetrics(fromCampaignId)
        : [];
      
      console.log(`[Custom Integration Transfer] Found ${existingMetrics.length} metrics to transfer`);
      if (fromCampaignId === 'temp-campaign-setup') {
        console.log(`[Custom Integration Transfer] Skipping metrics transfer from temp campaign (would be old test data)`);
      }
      
      if (existingMetrics.length > 0) {
        for (const metric of existingMetrics) {
          // Create new metric record for the new campaign
          await storage.createCustomIntegrationMetrics({
            campaignId: toCampaignId,
            impressions: metric.impressions,
            reach: metric.reach,
            clicks: metric.clicks,
            engagements: metric.engagements,
            spend: metric.spend,
            conversions: metric.conversions,
            leads: metric.leads,
            videoViews: metric.videoViews,
            viralImpressions: metric.viralImpressions,
            users: metric.users,
            sessions: metric.sessions,
            pageviews: metric.pageviews,
            avgSessionDuration: metric.avgSessionDuration,
            pagesPerSession: metric.pagesPerSession,
            bounceRate: metric.bounceRate,
            organicSearchShare: metric.organicSearchShare,
            directBrandedShare: metric.directBrandedShare,
            emailShare: metric.emailShare,
            referralShare: metric.referralShare,
            paidShare: metric.paidShare,
            socialShare: metric.socialShare,
            emailsDelivered: metric.emailsDelivered,
            openRate: metric.openRate,
            clickThroughRate: metric.clickThroughRate,
            clickToOpenRate: metric.clickToOpenRate,
            hardBounces: metric.hardBounces,
            spamComplaints: metric.spamComplaints,
            listGrowth: metric.listGrowth,
            pdfFileName: metric.pdfFileName,
            emailSubject: metric.emailSubject,
            emailId: metric.emailId,
          });
        }
        console.log(`[Custom Integration Transfer] Transferred ${existingMetrics.length} metrics`);
      }

      // Delete old integration and metrics
      await storage.deleteCustomIntegration(fromCampaignId);
      console.log(`[Custom Integration Transfer] Deleted old integration from ${fromCampaignId}`);
      
      // Verify the transfer was successful
      const verifyIntegration = await storage.getCustomIntegration(toCampaignId);
      if (verifyIntegration) {
        console.log(`[Custom Integration Transfer] ✅ VERIFIED: Integration exists for campaign ${toCampaignId}`);
      } else {
        console.error(`[Custom Integration Transfer] ❌ VERIFICATION FAILED: Integration NOT found for campaign ${toCampaignId}`);
      }
      
      console.log(`[Custom Integration Transfer] Transfer complete`);

      res.json({ success: true, message: 'Custom integration and metrics transferred' });
    } catch (error) {
      console.error('[Custom Integration Transfer] Error:', error);
      res.status(500).json({ success: false, error: 'Transfer failed' });
    }
  });

  // Conversion Value Webhook - MVP Implementation
  // Accepts conversion events with actual values from e-commerce, CRM, or custom systems
  app.post("/api/webhook/conversion/:campaignId", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const { value, currency, conversionId, conversionType, occurredAt, metadata } = req.body;

      // Validate campaign exists
      const campaign = await storage.getCampaign(campaignId);
      if (!campaign) {
        return res.status(404).json({
          success: false,
          error: "Campaign not found"
        });
      }

      // Validate required fields
      if (!value || isNaN(parseFloat(value))) {
        return res.status(400).json({
          success: false,
          error: "Invalid or missing 'value' field. Must be a number."
        });
      }

      // Create conversion event
      const event = await storage.createConversionEvent({
        campaignId,
        conversionId: conversionId || null,
        value: String(parseFloat(value).toFixed(2)),
        currency: currency || "USD",
        conversionType: conversionType || null,
        source: "webhook",
        metadata: metadata || null,
        occurredAt: occurredAt ? new Date(occurredAt) : new Date(),
      });

      console.log(`[Conversion Webhook] Created event for campaign ${campaignId}:`, {
        eventId: event.id,
        value: event.value,
        currency: event.currency,
        conversionType: event.conversionType
      });

      // Optionally update campaign's average conversion value (for backward compatibility)
      // Calculate average from recent events (last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const recentEvents = await storage.getConversionEvents(campaignId, thirtyDaysAgo);
      
      if (recentEvents.length > 0) {
        const totalValue = recentEvents.reduce((sum, e) => sum + parseFloat(e.value || "0"), 0);
        const avgValue = (totalValue / recentEvents.length).toFixed(2);
        
        // Update campaign's conversionValue with average (optional - for backward compatibility)
        await storage.updateCampaign(campaignId, {
          conversionValue: avgValue
        });
      }

      return res.status(200).json({
        success: true,
        event: {
          id: event.id,
          value: event.value,
          currency: event.currency,
          occurredAt: event.occurredAt
        },
        message: "Conversion event recorded successfully"
      });
    } catch (error) {
      console.error("[Conversion Webhook] Error:", error);
      return res.status(500).json({
        success: false,
        error: "Failed to process conversion event"
      });
    }
  });

  // ============================================
  // FLEXIBLE DATA MAPPING API ENDPOINTS
  // ============================================

  // Get platform fields for a platform
  app.get("/api/platforms/:platform/fields", async (req, res) => {
    try {
      const { platform } = req.params;
      const { campaignId } = req.query;
      
      let fields = getPlatformFields(platform);
      
      // For LinkedIn campaigns with LinkedIn API connected, adjust required fields
      // LinkedIn API already provides: Impressions, Clicks, Spend, Conversions
      // Google Sheets only needs: Campaign Name (to match rows) and Revenue (for conversion value)
      if (platform.toLowerCase() === 'linkedin' && campaignId) {
        try {
          const linkedInConnection = await storage.getLinkedInConnection(campaignId);
          if (linkedInConnection) {
            // Check if Google Sheets connection exists and has a Platform column
            // If Platform column exists, it's likely a multi-platform dataset and Platform is REQUIRED for filtering
            const googleSheetsConnections = await storage.getGoogleSheetsConnections(campaignId);
            let hasPlatformColumn = false;
            
            if (googleSheetsConnections.length > 0) {
              // Check if any connection has column mappings that include Platform
              for (const conn of googleSheetsConnections) {
                if (conn.columnMappings) {
                  try {
                    const mappings = JSON.parse(conn.columnMappings);
                    const platformMapping = mappings.find((m: any) => m.targetFieldId === 'platform');
                    if (platformMapping) {
                      hasPlatformColumn = true;
                      break;
                    }
                  } catch (e) {
                    // Ignore parsing errors
                  }
                }
              }
              
              // Also check detected columns from schema discovery (if available)
              // This helps when user first opens mapping interface before mappings are saved
              if (!hasPlatformColumn) {
                try {
                  const { spreadsheetId } = req.query;
                  const connection = spreadsheetId 
                    ? googleSheetsConnections.find(c => c.spreadsheetId === spreadsheetId)
                    : googleSheetsConnections.find(c => c.isPrimary) || googleSheetsConnections[0];
                  
                  if (connection?.spreadsheetId && connection?.accessToken) {
                    // Fetch schema to check for Platform column
                    const schemaResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheetId}?includeGridData=false`, {
                      headers: { 'Authorization': `Bearer ${connection.accessToken}` }
                    });
                    if (schemaResponse.ok) {
                      const schema = await schemaResponse.json();
                      const sheet = schema.sheets?.[0];
                      if (sheet?.properties?.gridProperties) {
                        // Get first row (headers) to check for Platform column
                        const valuesResponse = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheetId}/values/${sheet.properties.title}!1:1`, {
                          headers: { 'Authorization': `Bearer ${connection.accessToken}` }
                        });
                        if (valuesResponse.ok) {
                          const values = await valuesResponse.json();
                          const headers = values.values?.[0] || [];
                          hasPlatformColumn = headers.some((h: string) => 
                            /platform|channel|network|source/i.test(String(h || ''))
                          );
                        }
                      }
                    }
                  }
                } catch (e) {
                  // If we can't check, assume Platform might be needed (safer default)
                  console.log('[Platform Fields] Could not check for Platform column, defaulting to optional');
                }
              }
            }
            
            // LinkedIn API is connected - adjust required fields
            fields = fields.map(f => {
              // Only Campaign Name and Revenue are required from Google Sheets
              if (f.id === 'campaign_name' || f.id === 'revenue') {
                return { ...f, required: true };
              }
              
              // Platform is REQUIRED if Platform column exists (multi-platform dataset)
              // Platform is optional only if no Platform column exists (single-platform, can default to "LinkedIn")
              if (f.id === 'platform') {
                return { ...f, required: hasPlatformColumn };
              }
              
              // All other fields are optional since LinkedIn API provides them
              if (f.id === 'impressions' || f.id === 'clicks' || f.id === 'spend' || f.id === 'conversions') {
                return { ...f, required: false };
              }
              return f;
            });
          }
        } catch (error) {
          // If we can't check connection, use default fields
          console.log('[Platform Fields] Could not check LinkedIn connection, using default fields');
        }
      }
      
      res.json({
        success: true,
        platform,
        fields: fields.map(f => ({
          id: f.id,
          name: f.name,
          type: f.type,
          required: f.required,
          category: f.category,
          description: f.description
        }))
      });
    } catch (error: any) {
      console.error('[Platform Fields] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get platform fields' });
    }
  });

  // Detect columns from Google Sheets
  app.get("/api/campaigns/:id/google-sheets/detect-columns", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { spreadsheetId, connectionId, connectionIds, fetchAll, sheetNames } = req.query;
      
      console.log('[Detect Columns] 🔍 Query params:', { spreadsheetId, connectionId, connectionIds, fetchAll, sheetNames, campaignId });
      
      // Get connections
      let connections: any[] = [];
      
      // If sheetNames is provided, fetch ONLY those specific sheets
      if (sheetNames && spreadsheetId) {
        const selectedSheets = (sheetNames as string).split(',').map(s => s.trim());
        console.log('[Detect Columns] 🎯 Fetching ONLY selected sheets:', selectedSheets);
        
        // Get any connection for this spreadsheet to use the access token
        const allConnections = await storage.getGoogleSheetsConnections(campaignId);
        const baseConnection = allConnections.find(conn => conn.spreadsheetId === spreadsheetId);
        
        if (!baseConnection || !baseConnection.accessToken) {
          console.error('[Detect Columns] ❌ No connection found for spreadsheet:', spreadsheetId);
          return res.status(404).json({ error: 'No Google Sheets connection found' });
        }
        
        // Create virtual connections for ONLY the selected sheets
        connections = selectedSheets.map((sheetName: string) => ({
          ...baseConnection,
          sheetName,
          id: `${baseConnection.id}-${sheetName}`
        }));
        
        console.log('[Detect Columns] ✅ Will fetch columns from', connections.length, 'selected sheet(s):', selectedSheets);
      }
      // If fetchAll is specified with spreadsheetId, fetch ALL tabs directly from Google Sheets API
      else if (fetchAll === 'true' && spreadsheetId) {
        // Get any connection for this spreadsheet to use the access token
        const allConnections = await storage.getGoogleSheetsConnections(campaignId);
        const baseConnection = allConnections.find(conn => conn.spreadsheetId === spreadsheetId);
        
        if (!baseConnection || !baseConnection.accessToken) {
          console.error('[Detect Columns] ❌ No connection found for spreadsheet:', spreadsheetId);
          return res.status(404).json({ error: 'No Google Sheets connection found' });
        }
        
        console.log('[Detect Columns] 📊 Fetching ALL tabs from spreadsheet:', spreadsheetId);
        
        // Fetch spreadsheet metadata to get all sheet names
        try {
          const metadataResponse = await fetch(
            `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?includeGridData=false`,
            { headers: { 'Authorization': `Bearer ${baseConnection.accessToken}` } }
          );
          
          if (!metadataResponse.ok) {
            throw new Error(`Failed to fetch spreadsheet metadata: ${metadataResponse.statusText}`);
          }
          
          const metadata = await metadataResponse.json();
          const allSheets = metadata.sheets || [];
          
          console.log('[Detect Columns] 📋 Found', allSheets.length, 'sheet(s) in spreadsheet');
          
          // Create virtual connections for each sheet
          connections = allSheets.map((sheet: any) => ({
            ...baseConnection,
            sheetName: sheet.properties.title,
            id: `${baseConnection.id}-${sheet.properties.title}` // Virtual ID for this tab
          }));
          
          console.log('[Detect Columns] ✅ Will fetch columns from ALL', connections.length, 'sheet(s):', connections.map(c => c.sheetName));
        } catch (error: any) {
          console.error('[Detect Columns] ❌ Failed to fetch sheet metadata:', error.message);
          // Fallback to just the base connection
          connections = [baseConnection];
        }
      }
      // Parse connectionIds if provided (comma-separated)
      else if (connectionIds) {
        const connectionIdList = (connectionIds as string).split(',').filter(id => id.trim());
        const allConnections = await storage.getGoogleSheetsConnections(campaignId);
        connections = allConnections.filter(conn => connectionIdList.includes(conn.id));
        console.log('[Detect Columns] 📋 Using connectionIds:', connectionIdList, '- found', connections.length, 'connection(s)');
      }
      // Single connectionId
      else if (connectionId) {
        const allConnections = await storage.getGoogleSheetsConnections(campaignId);
        const conn = allConnections.find(c => c.id === connectionId);
        if (conn) connections = [conn];
        console.log('[Detect Columns] 📄 Using single connectionId:', connectionId);
      }
      // Fallback: spreadsheetId
      else if (spreadsheetId) {
        const conn = await storage.getGoogleSheetsConnection(campaignId, spreadsheetId as string);
        if (conn) connections = [conn];
        console.log('[Detect Columns] 📑 Using spreadsheetId:', spreadsheetId);
      }
      // Last resort: primary connection
      else {
        const conn = await storage.getPrimaryGoogleSheetsConnection(campaignId) || 
                     await storage.getGoogleSheetsConnection(campaignId);
        if (conn) connections = [conn];
        console.log('[Detect Columns] 🎯 Using primary/fallback connection');
      }
      
      if (connections.length === 0 || !connections[0]?.accessToken) {
        console.error('[Detect Columns] ❌ No valid connections found');
        return res.status(404).json({ error: 'No Google Sheets connection found' });
      }
      
      console.log('[Detect Columns] ✅ Will process', connections.length, 'sheet(s):', connections.map(c => c.sheetName || 'default'));
      
      // Collect all columns from all sheets
      const allColumnsMap = new Map<string, DetectedColumn>();
      const sheetNamesRequested = connections.map(c => c.sheetName || 'default');
      const sheetNamesFetched: string[] = [];
      const sheetNamesFailed: Array<{ sheet: string; status?: number; statusText?: string }> = [];
      let totalRowsAcrossSheets = 0;
      let globalColumnIndex = 0; // Track global index across all sheets
      
      for (const connection of connections) {
        // Build range with sheet name if specified
        const analysisRange = connection.sheetName ? `${toA1SheetPrefix(connection.sheetName)}A1:Z100` : 'A1:Z100';
        
        console.log(`[Detect Columns] Fetching columns from sheet: ${connection.sheetName || 'default'}, spreadsheet: ${connection.spreadsheetId}`);
        
        // Fetch first 100 rows for analysis
        const sheetResponse = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${connection.spreadsheetId}/values/${encodeURIComponent(analysisRange)}?valueRenderOption=UNFORMATTED_VALUE`,
          { headers: { 'Authorization': `Bearer ${connection.accessToken}` } }
        );
        
        if (!sheetResponse.ok) {
          console.warn(`[Detect Columns] Failed to fetch sheet ${connection.sheetName || 'default'}: ${sheetResponse.statusText}`);
          sheetNamesFailed.push({ sheet: connection.sheetName || 'default', status: sheetResponse.status, statusText: sheetResponse.statusText });
          continue; // Skip this sheet and continue with others
        }
        sheetNamesFetched.push(connection.sheetName || 'default');
        
        const sheetData = await sheetResponse.json();
        const rows = sheetData.values || [];
        
        if (rows.length === 0) {
          console.warn(`[Detect Columns] Sheet ${connection.sheetName || 'default'} has no data`);
          continue;
        }
        
        totalRowsAcrossSheets += rows.length;
        
        // Analyze columns from this sheet
        const headers = rows[0] || [];
        const dataRows = rows.slice(1);
        
        headers.forEach((header: any, localIndex: number) => {
          const columnName = String(header || `Column ${localIndex + 1}`).trim();
          
          // If column already exists (from another sheet), merge sample values but keep existing index
          if (allColumnsMap.has(columnName)) {
            const existing = allColumnsMap.get(columnName)!;
            // Add more sample values from this sheet
            const columnValues = dataRows.map((row: any[]) => row[localIndex]).filter((val: any) => val !== undefined && val !== null && val !== '');
            existing.sampleValues = [...existing.sampleValues, ...columnValues.slice(0, 3)].slice(0, 5);
            // Track which sheets this column appeared in
            (existing as any).sheets = Array.from(new Set([...(existing as any).sheets || [], connection.sheetName || 'default']));
            console.log(`[Detect Columns] Merged column "${columnName}" (keeping index ${existing.index})`);
          } else {
            // New column - analyze it and assign unique global index
            const columnValues = dataRows.map((row: any[]) => row[localIndex]);
            const nonEmptyValues = columnValues.filter((val: any) => val !== undefined && val !== null && val !== '');
            
            // Detect column type using simple inference
            const detectedType = inferColumnType(nonEmptyValues);
            const confidence = calculateConfidence(nonEmptyValues, detectedType);
            
            allColumnsMap.set(columnName, {
              index: globalColumnIndex++, // Assign unique sequential index
              name: columnName,
              originalName: header,
              detectedType,
              confidence,
              sampleValues: nonEmptyValues.slice(0, 5),
              uniqueValues: new Set(nonEmptyValues).size,
              nullCount: columnValues.length - nonEmptyValues.length,
              // Extra metadata (safe for clients): which sheet tabs contained this column
              ...( { sheets: [connection.sheetName || 'default'] } as any )
            });
            console.log(`[Detect Columns] Added new column "${columnName}" with global index ${globalColumnIndex - 1}`);
          }
        });
      }
      
      const detectedColumns = Array.from(allColumnsMap.values());
      
      console.log(`[Detect Columns] Combined columns from ${connections.length} sheet(s): ${detectedColumns.length} unique columns found`);
      console.log('[Detect Columns] Column names:', detectedColumns.map(c => c.name));
      console.log('[Detect Columns] Response:', JSON.stringify({
        columnsCount: detectedColumns.length,
        totalRows: totalRowsAcrossSheets,
        sheetsAnalyzed: connections.length,
        sampleColumn: detectedColumns[0]
      }, null, 2));
      
      res.json({
        success: true,
        columns: detectedColumns,
        totalRows: totalRowsAcrossSheets,
        sheetsAnalyzed: connections.length,
        sheetNamesRequested,
        sheetNamesFetched,
        sheetNamesFailed
      });
    } catch (error: any) {
      console.error('[Detect Columns] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to detect columns' });
    }
  });

  // Fetch unique values for a given column across selected Google Sheets tabs (used for crosswalk dropdown)
  app.get("/api/campaigns/:id/google-sheets/unique-values", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const spreadsheetId = String(req.query.spreadsheetId || '').trim();
      const sheetNamesRaw = String(req.query.sheetNames || '').trim();
      const columnName = String(req.query.columnName || '').trim();
      const maxValues = Math.min(Math.max(parseInt(String(req.query.maxValues || '500'), 10) || 500, 50), 1000);

      if (!spreadsheetId) return res.status(400).json({ error: 'spreadsheetId is required' });
      if (!sheetNamesRaw) return res.status(400).json({ error: 'sheetNames is required' });
      if (!columnName) return res.status(400).json({ error: 'columnName is required' });

      const sheetNames = sheetNamesRaw.split(',').map(s => s.trim()).filter(Boolean);
      if (sheetNames.length === 0) return res.status(400).json({ error: 'sheetNames must include at least one sheet' });

      const connections = await storage.getGoogleSheetsConnections(campaignId);
      const baseConn =
        connections.find((c: any) => c.spreadsheetId === spreadsheetId && c.accessToken) ||
        connections.find((c: any) => c.accessToken);

      if (!baseConn?.accessToken) {
        return res.status(404).json({ error: 'No Google Sheets connection with access token found' });
      }

      const unique = new Set<string>();
      let truncated = false;

      let accessToken = baseConn.accessToken as string;
      const tryFetchValuesFromSheet = async (sn: string, token: string): Promise<any[][] | null> => {
        // NOTE: Use a wider range than A:Z to avoid missing columns that sit beyond Z.
        // This endpoint only reads headers + one column, so the extra width is a pragmatic tradeoff.
        const range = `${toA1SheetPrefix(sn)}A1:ZZ2000`;
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueRenderOption=UNFORMATTED_VALUE`;
        const resp = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
        if (!resp.ok) return null;
        const json = await resp.json().catch(() => ({}));
        const rows: any[][] = json?.values || [];
        return rows;
      };

      let anySheetFetched = false;

      for (const sn of sheetNames) {
        if (unique.size >= maxValues) {
          truncated = true;
          break;
        }

        let rows: any[][] | null = await tryFetchValuesFromSheet(sn, accessToken);
        if (!rows) {
          // If token is expired, attempt a refresh once and retry.
          // (We don't have response status here because we only return null on non-ok;
          // refresh is best-effort and safe.)
          if ((baseConn as any).refreshToken) {
            try {
              const refreshed = await refreshGoogleSheetsToken(baseConn as any);
              if (refreshed) {
                accessToken = refreshed;
                rows = await tryFetchValuesFromSheet(sn, accessToken);
              }
            } catch {
              // ignore
            }
          }
        }

        if (!rows) continue;
        anySheetFetched = true;
        if (!Array.isArray(rows) || rows.length < 2) continue;

        const headers = rows[0] || [];
        const idx = headers.findIndex((h: any) => String(h || '').trim().toLowerCase() === columnName.trim().toLowerCase());
        if (idx < 0) continue;

        for (const row of rows.slice(1)) {
          if (!Array.isArray(row) || row.length <= idx) continue;
          const v = String(row[idx] ?? '').trim();
          if (!v) continue;
          unique.add(v);
          if (unique.size >= maxValues) {
            truncated = true;
            break;
          }
        }
      }

      if (!anySheetFetched) {
        return res.status(502).json({
          error: 'Failed to fetch values from Google Sheets. Please reconnect Google Sheets and try again.',
        });
      }

      res.json({
        success: true,
        columnName,
        values: Array.from(unique).slice(0, maxValues),
        truncated,
        count: unique.size,
      });
    } catch (error: any) {
      console.error('[Unique Values] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch unique values' });
    }
  });

  // Auto-map columns to platform fields
  app.post("/api/campaigns/:id/google-sheets/auto-map", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { platform, columns } = req.body;
      
      if (!platform) {
        return res.status(400).json({ error: 'Platform is required' });
      }
      
      if (!columns || !Array.isArray(columns)) {
        return res.status(400).json({ error: 'Columns array is required' });
      }
      
      // Get platform fields
      const platformFields = getPlatformFields(platform);
      
      // Auto-map
      const mappings = autoMapColumns(columns, platformFields);
      
      res.json({
        success: true,
        mappings,
        requiredFields: getRequiredFields(platform).map(f => f.id),
        mappedFields: mappings.map(m => m.targetFieldId)
      });
    } catch (error: any) {
      console.error('[Auto-Map] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to auto-map columns' });
    }
  });

  // Save column mappings to connection
  app.post("/api/campaigns/:id/google-sheets/save-mappings", async (req, res) => {
    console.log(`[Save Mappings] ========== SAVE MAPPINGS ENDPOINT CALLED ==========`);
    console.log(`[Save Mappings] Campaign ID: ${req.params.id}`);
    console.log(`[Save Mappings] Request body:`, JSON.stringify({ connectionId: req.body.connectionId, mappingsCount: req.body.mappings?.length, platform: req.body.platform, spreadsheetId: req.body.spreadsheetId, sheetNames: req.body.sheetNames }));
    
    try {
      const campaignId = req.params.id;
      const { connectionId, mappings, platform } = req.body;
      const spreadsheetIdFromBody: string | undefined = req.body.spreadsheetId;
      const sheetNamesFromBody: string[] = Array.isArray(req.body.sheetNames)
        ? req.body.sheetNames.filter((s: any) => typeof s === 'string' && s.trim().length > 0).map((s: string) => s.trim())
        : (typeof req.body.sheetNames === 'string'
            ? req.body.sheetNames.split(',').map((s: string) => s.trim()).filter(Boolean)
            : []);
      
      if (!connectionId || !mappings || !Array.isArray(mappings)) {
        console.error(`[Save Mappings] ❌ Validation failed: connectionId=${!!connectionId}, mappings is array=${Array.isArray(mappings)}`);
        return res.status(400).json({ error: 'connectionId and mappings array are required' });
      }
      
      console.log(`[Save Mappings] ✅ Validation passed. Processing ${mappings.length} mappings...`);
      
      // Get platform fields with dynamic requirements (same logic as /api/platforms/:platform/fields)
      let platformFields = getPlatformFields(platform || 'linkedin');
      
      // For LinkedIn, adjust field requirements based on whether LinkedIn API is connected
      if (platform?.toLowerCase() === 'linkedin' || !platform) {
        try {
          const linkedInConnection = await storage.getLinkedInConnection(campaignId);
          if (linkedInConnection) {
            // Guided mapping supports:
            // - Identifier: campaign_name OR campaign_id (either is acceptable)
            // - Value: revenue OR conversion_value (either is acceptable)
            // Platform is optional (can default to LinkedIn)
            // Other fields (impressions, clicks, spend, conversions) are optional since LinkedIn API provides them
            platformFields = platformFields.map(f => {
              // We enforce "either/or" requirements below, so don't mark individual fields required here.
              if (f.id === 'campaign_name' || f.id === 'campaign_id' || f.id === 'revenue' || f.id === 'conversion_value') {
                return { ...f, required: false };
              }
              // Platform is optional (can skip if entire sheet is for LinkedIn)
              if (f.id === 'platform') {
                return { ...f, required: false };
              }
              // All other fields are optional since LinkedIn API provides them
              if (f.id === 'impressions' || f.id === 'clicks' || f.id === 'spend' || f.id === 'conversions') {
                return { ...f, required: false };
              }
              return f;
            });
          }
        } catch (error) {
          console.log('[Save Mappings] Could not check LinkedIn connection, using default field requirements');
        }
      }
      
      // Validate mappings
      const errors = validateMappings(mappings, platformFields);
      // LinkedIn guided flow "either/or" requirements:
      // - Must map one identifier: campaign_name OR campaign_id
      // - Must map one value source: conversion_value OR revenue
      if ((platform?.toLowerCase() === 'linkedin' || !platform)) {
        const hasIdentifier =
          mappings.some((m: any) => m?.targetFieldId === 'campaign_name' || m?.platformField === 'campaign_name') ||
          mappings.some((m: any) => m?.targetFieldId === 'campaign_id' || m?.platformField === 'campaign_id');
        const hasValueSource =
          mappings.some((m: any) => m?.targetFieldId === 'conversion_value' || m?.platformField === 'conversion_value') ||
          mappings.some((m: any) => m?.targetFieldId === 'revenue' || m?.platformField === 'revenue');

        if (!hasIdentifier) {
          errors.set('campaign_identifier', 'Please map Campaign Name or Campaign ID');
        }
        if (!hasValueSource) {
          errors.set('value_source', 'Please map Conversion Value or Revenue');
        }
      }
      
      if (errors.size > 0) {
        return res.status(400).json({
          error: 'Mapping validation failed',
          errors: Object.fromEntries(errors)
        });
      }
      
      // Update connection with mappings AND ensure it's active
      const updateResult = await storage.updateGoogleSheetsConnection(connectionId, {
        columnMappings: JSON.stringify(mappings),
        isActive: true  // Ensure connection stays active
      });
      
      console.log(`[Save Mappings] Update result:`, updateResult ? 'SUCCESS' : 'FAILED');
      if (updateResult) {
        console.log(`[Save Mappings] Updated connection:`, {
          id: updateResult.id,
          isActive: updateResult.isActive,
          hasColumnMappings: !!updateResult.columnMappings,
          columnMappingsLength: updateResult.columnMappings?.length || 0
        });
      }
      
      // Verify the update was successful by fetching all connections and finding this one
      const allConnections = await storage.getGoogleSheetsConnections(campaignId);
      console.log(`[Save Mappings] Total active connections for campaign:`, allConnections.length);
      const updatedConnection = allConnections.find(conn => conn.id === connectionId);
      
      if (!updatedConnection) {
        console.error(`[Save Mappings] ❌ Connection ${connectionId} not found in active connections after update`);
        console.error(`[Save Mappings] Available connection IDs:`, allConnections.map(c => c.id));
        return res.status(404).json({ error: 'Connection not found after update' });
      }
      
      console.log(`[Save Mappings] ✅ Verified connection ${connectionId} exists with mappings:`, updatedConnection.columnMappings ? 'YES' : 'NO');
      if (updatedConnection.columnMappings) {
        try {
          const parsedMappings = JSON.parse(updatedConnection.columnMappings);
          console.log(`[Save Mappings] Mappings are valid JSON with ${parsedMappings.length} entries`);
        } catch (e) {
          console.error(`[Save Mappings] ❌ Mappings are not valid JSON:`, e);
        }
      }
      
      // IMMEDIATELY calculate and save conversion value after saving mappings
      console.log(`[Save Mappings] 🚀 Calculating conversion value immediately...`);
      console.log(`[Save Mappings] Campaign ID: ${campaignId}, Connection ID: ${connectionId}`);
      
      try {
        const campaign = await storage.getCampaign(campaignId);
        console.log(`[Save Mappings] Campaign found:`, campaign ? campaign.name : 'NOT FOUND');
        
        const linkedInSessions = await storage.getCampaignLinkedInImportSessions(campaignId);
        console.log(`[Save Mappings] LinkedIn sessions found: ${linkedInSessions.length}`);
        
        const linkedInConnection = await storage.getLinkedInConnection(campaignId);
        console.log(`[Save Mappings] LinkedIn connection found:`, linkedInConnection ? 'YES' : 'NO');
        
        if (linkedInConnection && linkedInSessions.length > 0 && campaign) {
          // Get all mapped Google Sheets connections
          const sheetsConnections = await storage.getGoogleSheetsConnections(campaignId);
          const mappedConnections = sheetsConnections.filter((conn: any) => {
            const cm = conn.columnMappings || conn.column_mappings;
            if (!cm || (typeof cm === 'string' && cm.trim() === '')) return false;
            try {
              const m = typeof cm === 'string' ? JSON.parse(cm) : cm;
              return Array.isArray(m) && m.length > 0 && conn.isActive;
            } catch {
              return false;
            }
          });
          
          console.log(`[Save Mappings] Found ${mappedConnections.length} active mapped connections out of ${sheetsConnections.length} total`);
          
          if (mappedConnections.length > 0) {
            // Get LinkedIn conversions from API
            let totalConversions = 0;
            const latestSession = linkedInSessions.sort((a, b) => 
              new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime()
            )[0];
            
            console.log(`[Save Mappings] Using latest session: ${latestSession.id}`);
            
            const linkedInMetrics = await storage.getLinkedInImportMetrics(latestSession.id);
            console.log(`[Save Mappings] LinkedIn metrics found: ${linkedInMetrics.length}`);
            
            const normalizeMetricKey = (key: any) =>
              String(key || '').toLowerCase().replace(/[^a-z0-9]/g, '');
            
            for (const metric of linkedInMetrics) {
              const k = normalizeMetricKey(metric.metricKey);
              if (k === 'conversions' || k === 'externalwebsiteconversions') {
                const convValue = parseFloat(metric.metricValue || '0') || 0;
                totalConversions += convValue;
                console.log(`[Save Mappings] Found conversions metric (${metric.metricKey}): ${convValue} (total: ${totalConversions})`);
              }
            }
            
            console.log(`[Save Mappings] Total LinkedIn conversions: ${totalConversions}`);
            
            // Fetch revenue from Google Sheets
            let totalRevenue = 0;
            
            // If the DB cannot persist sheet_name (older schema), mappedConnections will all have sheetName=null.
            // In that case, rely on sheetNames passed by the client to fetch the correct tabs (e.g. Revenue_Closed_Won).
            const shouldUseSheetNamesFromBody = !!spreadsheetIdFromBody && sheetNamesFromBody.length > 0;
            const connectionsToProcess = (() => {
              if (!shouldUseSheetNamesFromBody) return mappedConnections;
              const tokenConn = mappedConnections.find((c: any) => c.spreadsheetId === spreadsheetIdFromBody) || mappedConnections[0];
              if (!tokenConn) return mappedConnections;
              return sheetNamesFromBody.map((sn) => ({ ...tokenConn, sheetName: sn }));
            })();

            for (const conn of connectionsToProcess) {
              try {
                console.log(`[Save Mappings] Processing connection ${conn.id} (${conn.spreadsheetId}, sheet: ${conn.sheetName || 'default'})`);
                
                // Fetch Google Sheets data using the same logic as google-sheets-data endpoint
                const range = conn.sheetName ? `${toA1SheetPrefix(conn.sheetName)}A1:Z1000` : 'A1:Z1000';
                const sheetsUrl = `https://sheets.googleapis.com/v4/spreadsheets/${conn.spreadsheetId}/values/${range}`;
                
                const sheetsResponse = await fetch(sheetsUrl, {
                  headers: {
                    'Authorization': `Bearer ${conn.accessToken}`
                  }
                });
                
                if (!sheetsResponse.ok) {
                  const errorData = await sheetsResponse.json().catch(() => ({}));
                  console.error(`[Save Mappings] Google Sheets API error for ${conn.id}:`, sheetsResponse.status, errorData);
                  continue;
                }
                
                const sheetsData = await sheetsResponse.json();
                const rows = sheetsData.values || [];
                
                console.log(`[Save Mappings] Sheet ${conn.id} has ${rows.length} rows`);
                
                if (rows.length === 0) {
                  console.log(`[Save Mappings] No data in sheet ${conn.spreadsheetId}`);
                  continue;
                }
                
                const headers = rows[0] || [];
                const dataRows = rows.slice(1);
                
                const mappings = JSON.parse(conn.columnMappings || '[]');
                console.log(`[Save Mappings] Mappings for ${conn.id}:`, JSON.stringify(mappings));
                
                const revenueMapping = mappings.find((m: any) => m.targetFieldId === 'revenue' || m.platformField === 'revenue');
                const conversionValueMapping = mappings.find((m: any) => m.targetFieldId === 'conversion_value' || m.platformField === 'conversion_value');
                const campaignIdMapping = mappings.find((m: any) => m.targetFieldId === 'campaign_id' || m.platformField === 'campaign_id');
                const campaignNameMapping = mappings.find((m: any) => m.targetFieldId === 'campaign_name' || m.platformField === 'campaign_name');
                
                console.log(`[Save Mappings] Revenue mapping:`, revenueMapping);
                console.log(`[Save Mappings] Conversion Value mapping:`, conversionValueMapping);
                console.log(`[Save Mappings] Campaign ID mapping:`, campaignIdMapping);
                console.log(`[Save Mappings] Campaign name mapping:`, campaignNameMapping);
                
                if (revenueMapping || conversionValueMapping) {
                  const resolveColumnIndex = (mapping: any, sheetHeaders: any[]): number => {
                    let idx = mapping?.sourceColumnIndex ?? mapping?.columnIndex ?? -1;
                    if (idx >= 0 && idx < sheetHeaders.length) return idx;
                    const mappedName = String(mapping?.sourceColumnName || '').trim().toLowerCase();
                    if (!mappedName) return -1;
                    const byName = sheetHeaders.findIndex((h: any) => String(h || '').trim().toLowerCase() === mappedName);
                    return byName;
                  };

                  const revenueColumnIndex = revenueMapping ? resolveColumnIndex(revenueMapping, headers) : -1;
                  const conversionValueColumnIndex = conversionValueMapping ? resolveColumnIndex(conversionValueMapping, headers) : -1;
                if (revenueMapping) {
                  console.log(`[Save Mappings] Revenue column index: ${revenueColumnIndex} (from mapping:`, revenueMapping, ')');
                  if (revenueColumnIndex < 0 || revenueColumnIndex >= headers.length) {
                    console.error(`[Save Mappings] ❌ Invalid revenue column index: ${revenueColumnIndex} (headers length: ${headers.length})`);
                    continue;
                  }
                  }
                  if (conversionValueMapping) {
                    console.log(`[Save Mappings] Conversion Value column index: ${conversionValueColumnIndex} (from mapping:`, conversionValueMapping, ')');
                    if (conversionValueColumnIndex < 0 || conversionValueColumnIndex >= headers.length) {
                      console.error(`[Save Mappings] ❌ Invalid conversion value column index: ${conversionValueColumnIndex} (headers length: ${headers.length})`);
                      continue;
                    }
                  }
                  
                  // Filter by campaign identifier if mapped.
                  // Prefer Campaign ID when available (more reliable), otherwise fall back to Campaign Name.
                  // IMPORTANT: The spreadsheet typically contains LinkedIn *campaign names* or IDs, not necessarily the MetricMind workspace campaign name.
                  let filteredRows = dataRows;
                  const workspaceCampaignName = String(campaign?.name || '').toLowerCase().trim();
                  const linkedInCampaignNames = new Set(
                    linkedInMetrics
                      .map((m: any) => String(m?.campaignName || '').toLowerCase().trim())
                      .filter(Boolean)
                  );

                  // LinkedIn import metrics store `campaignUrn` like "urn:li:sponsoredCampaign:123".
                  const linkedInCampaignIds = new Set(
                    linkedInMetrics
                      .map((m: any) => String(m?.campaignUrn || '').trim())
                      .map((urn: string) => urn.split(':').pop() || '')
                      .map((id: string) => id.trim())
                      .filter((id: string) => /^[0-9]+$/.test(id))
                  );

                  const normalizeNumericId = (raw: any): string => {
                    const s = String(raw || '').toLowerCase().trim();
                    if (!s) return '';
                    return s.replace(/^urn:li:sponsoredcampaign:/, '').replace(/[^0-9]/g, '');
                  };

                  const matchesByName = (sheetNameRaw: string): boolean => {
                    const sheetName = String(sheetNameRaw || '').toLowerCase().trim();
                    if (!sheetName) return false;

                    // Per guided UI: when a user maps by Campaign Name, they expect it to match the MetricMind campaign name.
                    // So prefer the workspace campaign name first, then fall back to LinkedIn imported campaign names.
                    if (workspaceCampaignName) {
                      if (sheetName.includes(workspaceCampaignName) || workspaceCampaignName.includes(sheetName)) return true;
                    }

                    for (const liName of linkedInCampaignNames) {
                      if (!liName) continue;
                      if (sheetName === liName) return true;
                      if (sheetName.includes(liName) || liName.includes(sheetName)) return true;
                    }

                    return false;
                  };

                  // 0) If UI provided an explicit crosswalk value, prefer filtering by that exact value first.
                  const selectedIdValue = String(campaignIdMapping?.selectedValue ?? campaignIdMapping?.campaignIdentifierValue ?? '').trim();
                  const selectedNameValue = String(campaignNameMapping?.selectedValue ?? campaignNameMapping?.campaignIdentifierValue ?? '').trim();
                  if (campaignIdMapping && selectedIdValue) {
                    const campaignIdColumnIndex = resolveColumnIndex(campaignIdMapping, headers);
                    if (campaignIdColumnIndex >= 0 && campaignIdColumnIndex < headers.length) {
                      const selectedNumeric = normalizeNumericId(selectedIdValue);
                      const filteredBySelectedId = dataRows.filter((row: any[]) => {
                        if (!Array.isArray(row) || row.length <= campaignIdColumnIndex) return false;
                        const numericCandidate = normalizeNumericId(row[campaignIdColumnIndex]);
                        return !!selectedNumeric && numericCandidate === selectedNumeric;
                      });
                      if (filteredBySelectedId.length > 0) {
                        filteredRows = filteredBySelectedId;
                      }
                    }
                  } else if (campaignNameMapping && selectedNameValue) {
                    const campaignNameColumnIndex = resolveColumnIndex(campaignNameMapping, headers);
                    if (campaignNameColumnIndex >= 0 && campaignNameColumnIndex < headers.length) {
                      const selectedLower = selectedNameValue.toLowerCase().trim();
                      const filteredBySelectedName = dataRows.filter((row: any[]) => {
                        if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) return false;
                        const v = String(row[campaignNameColumnIndex] || '').toLowerCase().trim();
                        if (!v) return false;
                        return v === selectedLower || v.includes(selectedLower) || selectedLower.includes(v);
                      });
                      if (filteredBySelectedName.length > 0) {
                        filteredRows = filteredBySelectedName;
                      }
                    }
                  }

                  // 1) Prefer Campaign ID mapping if provided and valid for this sheet
                  if (filteredRows === dataRows && campaignIdMapping) {
                    const campaignIdColumnIndex = resolveColumnIndex(campaignIdMapping, headers);
                    if (campaignIdColumnIndex >= 0 && campaignIdColumnIndex < headers.length) {
                      const filteredById = dataRows.filter((row: any[]) => {
                        if (!Array.isArray(row) || row.length <= campaignIdColumnIndex) return false;
                        const numericCandidate = normalizeNumericId(row[campaignIdColumnIndex]);
                        return !!numericCandidate && linkedInCampaignIds.has(numericCandidate);
                      });
                      filteredRows = filteredById.length > 0 ? filteredById : filteredRows;
                    } else {
                      console.log(`[Save Mappings] ⚠️ Invalid campaign ID column index: ${campaignIdColumnIndex}, skipping ID filter`);
                    }
                  }

                  // 2) If still unfiltered or Campaign ID not provided, try Campaign Name mapping
                  if (filteredRows === dataRows && campaignNameMapping) {
                    const campaignNameColumnIndex = resolveColumnIndex(campaignNameMapping, headers);
                    if (campaignNameColumnIndex >= 0 && campaignNameColumnIndex < headers.length) {
                      const filteredByName = dataRows.filter((row: any[]) => {
                        if (!Array.isArray(row) || row.length <= campaignNameColumnIndex) return false;
                        return matchesByName(String(row[campaignNameColumnIndex] || ''));
                      });
                      filteredRows = filteredByName.length > 0 ? filteredByName : filteredRows;
                    } else {
                      console.log(`[Save Mappings] ⚠️ Invalid campaign name column index: ${campaignNameColumnIndex}, skipping name filter`);
                    }
                  }

                  // 3) If matching yields no rows, don't zero out revenue—fall back to using all rows.
                  if (filteredRows.length === 0) {
                    filteredRows = dataRows;
                  }
                  
                  // If conversion_value is mapped, prefer extracting conversion value directly.
                  // Otherwise, sum revenue to compute conversion value.
                  if (conversionValueMapping) {
                    const stratRaw = String((conversionValueMapping as any)?.dateStrategy || (conversionValueMapping as any)?.aggregation || 'median').toLowerCase();
                    const strategy: 'latest' | 'median' = stratRaw === 'latest' ? 'latest' : 'median';
                    const dateColumnIndexMaybe = (conversionValueMapping as any)?.dateColumnIndex;
                    const dateColumnNameMaybe = String((conversionValueMapping as any)?.dateColumnName || '').trim();
                    let dateIdx = -1;
                    if (typeof dateColumnIndexMaybe === 'number') {
                      dateIdx = dateColumnIndexMaybe;
                    } else if (dateColumnNameMaybe) {
                      const byName = headers.findIndex((h: any) => String(h || '').trim().toLowerCase() === dateColumnNameMaybe.toLowerCase());
                      dateIdx = byName;
                    }

                    const picked = pickConversionValueFromRows({
                      rows: filteredRows,
                      valueColumnIndex: conversionValueColumnIndex,
                      dateColumnIndex: dateIdx >= 0 ? dateIdx : undefined,
                      strategy: (dateIdx >= 0 ? strategy : 'median'),
                    });

                    if (picked && picked > 0) {
                      const prev = (campaign as any).__conversionValuesFromSheets;
                      (campaign as any).__conversionValuesFromSheets = Array.isArray(prev) ? [...prev, picked] : [picked];
                      console.log(`[Save Mappings] ✅ Extracted conversion value from sheet: $${picked} (strategy=${dateIdx >= 0 ? strategy : 'median'})`);
                    } else {
                      console.log(`[Save Mappings] ⚠️ No conversion value rows found in mapped column`);
                    }
                  }

                  if (revenueMapping) {
                  // Sum revenue
                  let connectionRevenue = 0;
                  let revenueRowCount = 0;
                  for (const row of filteredRows) {
                    if (!Array.isArray(row) || row.length <= revenueColumnIndex) continue;
                    const rawValue = String(row[revenueColumnIndex] || '0');
                    const revenueValue = parseFloat(rawValue.replace(/[$,]/g, '')) || 0;
                    if (revenueValue > 0) {
                      connectionRevenue += revenueValue;
                      revenueRowCount++;
                      if (revenueRowCount <= 3) {
                        console.log(`[Save Mappings] Revenue row ${revenueRowCount}: "${rawValue}" -> $${revenueValue}`);
                      }
                    }
                  }
                  
                  totalRevenue += connectionRevenue;
                  console.log(`[Save Mappings] Revenue from connection ${conn.id}: $${connectionRevenue} (from ${revenueRowCount} rows with revenue > 0, total so far: $${totalRevenue})`);
                  }
                } else {
                  console.log(`[Save Mappings] ⚠️ No revenue/conversion_value mapping found for connection ${conn.id}`);
                }
              } catch (sheetError: any) {
                console.error(`[Save Mappings] ❌ Error fetching sheet data for connection ${conn.id}:`, sheetError.message);
                console.error(`[Save Mappings] Error stack:`, sheetError.stack);
              }
            }
            
            console.log(`[Save Mappings] 💰 FINAL: Total revenue: $${totalRevenue}, Total conversions: ${totalConversions}`);
            
            // Calculate conversion value
            let calculatedConversionValue: string | null = null;
            const extracted = (campaign as any).__conversionValuesFromSheets as number[] | undefined;
            if (Array.isArray(extracted) && extracted.length > 0) {
              const sorted = extracted.slice().sort((a, b) => a - b);
              const mid = Math.floor(sorted.length / 2);
              const median = sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
              if (median > 0) {
                calculatedConversionValue = median.toFixed(2);
                console.log(`[Save Mappings] 💰 Using conversion value from sheet: $${calculatedConversionValue} (from ${extracted.length} tab(s))`);
              }
            }
            if (!calculatedConversionValue && totalRevenue > 0 && totalConversions > 0) {
              calculatedConversionValue = (totalRevenue / totalConversions).toFixed(2);
              
              console.log(`[Save Mappings] 💰 Calculated conversion value: $${calculatedConversionValue} (Revenue: $${totalRevenue}, Conversions: ${totalConversions})`);
              
              // Save to campaign - use conversionValue field name that matches schema
              console.log(`[Save Mappings] Attempting to save conversionValue "${calculatedConversionValue}" to campaign ${campaignId}`);
              try {
                const updatedCampaign = await storage.updateCampaign(campaignId, { conversionValue: calculatedConversionValue });
                if (!updatedCampaign) {
                  console.error(`[Save Mappings] ❌ updateCampaign returned null/undefined!`);
                  throw new Error('updateCampaign returned null');
                }
                
                // Check if the value was actually saved (handle both string and number comparison)
                const savedValue = updatedCampaign.conversionValue?.toString() || null;
                const expectedValue = calculatedConversionValue.toString();
                
                console.log(`[Save Mappings] Update result - Expected: "${expectedValue}", Got: "${savedValue}"`);
                
                if (savedValue !== expectedValue && parseFloat(savedValue || '0') !== parseFloat(expectedValue)) {
                  console.error(`[Save Mappings] ❌ Value mismatch! Expected "${expectedValue}", got "${savedValue}"`);
                  // Don't throw - continue to try other saves
                } else {
                  console.log(`[Save Mappings] ✅ Campaign updated successfully: conversionValue = ${savedValue}`);
                }
              } catch (updateError: any) {
                console.error(`[Save Mappings] ❌❌❌ ERROR updating campaign:`, updateError.message);
                console.error(`[Save Mappings] Error stack:`, updateError.stack);
                // Continue with other saves even if campaign update fails
              }
              
              // Save to LinkedIn connection
              const updatedLinkedIn = await storage.updateLinkedInConnection(campaignId, { conversionValue: calculatedConversionValue });
              if (!updatedLinkedIn) {
                console.error(`[Save Mappings] ❌ FAILED to update LinkedIn connection conversion value!`);
              } else {
                console.log(`[Save Mappings] ✅ LinkedIn connection updated: conversionValue = ${updatedLinkedIn.conversionValue}`);
              }
              
              // Save to all sessions
              for (const session of linkedInSessions) {
                const updatedSession = await storage.updateLinkedInImportSession(session.id, { conversionValue: calculatedConversionValue });
                if (!updatedSession) {
                  console.error(`[Save Mappings] ❌ FAILED to update session ${session.id} conversion value!`);
                } else {
                  console.log(`[Save Mappings] ✅ Session ${session.id} updated: conversionValue = ${updatedSession.conversionValue}`);
                }
              }
              
              console.log(`[Save Mappings] ✅✅✅ Conversion value $${calculatedConversionValue} saved to campaign, LinkedIn connection, and ${linkedInSessions.length} session(s)`);
              
              // Verify it was saved by refetching
              const verifyCampaign = await storage.getCampaign(campaignId);
              console.log(`[Save Mappings] 🔍 VERIFICATION: Campaign conversion value after save: ${verifyCampaign?.conversionValue}`);
              if (verifyCampaign?.conversionValue !== calculatedConversionValue) {
                console.error(`[Save Mappings] ❌❌❌ VERIFICATION FAILED! Expected ${calculatedConversionValue}, got ${verifyCampaign?.conversionValue}`);
              }
            } else {
              console.log(`[Save Mappings] ⚠️ Cannot calculate conversion value: Revenue=${totalRevenue}, Conversions=${totalConversions}`);
            }
          } else {
            console.log(`[Save Mappings] ⚠️ No mapped connections found`);
          }
        } else {
          console.log(`[Save Mappings] ⚠️ Missing requirements: LinkedIn connection=${!!linkedInConnection}, Sessions=${linkedInSessions.length}, Campaign=${!!campaign}`);
        }
      } catch (calcError: any) {
        console.error(`[Save Mappings] ❌❌❌ Error calculating conversion value:`, calcError.message);
        console.error(`[Save Mappings] Error stack:`, calcError.stack);
        // Don't fail the request if calculation fails
      }
      
      // Get the final conversion value for the response
      const finalCampaign = await storage.getCampaign(campaignId);
      const finalConversionValue = finalCampaign?.conversionValue || null;
      
      console.log(`[Save Mappings] ✅✅✅ Mappings saved for connection ${connectionId}`);
      console.log(`[Save Mappings] Final conversion value in database: ${finalConversionValue}`);
      
      res.json({
        success: true,
        message: 'Mappings saved successfully',
        connectionId: connectionId,
        conversionValue: finalConversionValue,
        conversionValueCalculated: !!finalConversionValue
      });
    } catch (error: any) {
      console.error('[Save Mappings] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to save mappings' });
    }
  });

  // Get mappings for a connection
  app.get("/api/campaigns/:id/google-sheets/mappings", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { connectionId } = req.query;
      
      let connection: any;
      if (connectionId) {
        // `connectionId` is the google_sheets_connections.id (NOT spreadsheetId).
        const all = await storage.getGoogleSheetsConnections(campaignId);
        connection = (all || []).find((c: any) => c?.id === String(connectionId));
        // Backwards-compat fallback: allow callers to pass a spreadsheetId.
        if (!connection) {
        connection = await storage.getGoogleSheetsConnection(campaignId, connectionId as string);
        }
      } else {
        connection = await storage.getPrimaryGoogleSheetsConnection(campaignId);
      }
      
      if (!connection) {
        return res.status(404).json({ error: 'Connection not found' });
      }
      
      let mappings: any[] = [];
      try {
        const raw = (connection as any).columnMappings ?? (connection as any).column_mappings ?? null;
        if (raw) {
          mappings = typeof raw === 'string' ? JSON.parse(raw) : raw;
        }
      } catch {
        mappings = [];
      }
      
      res.json({
        success: true,
        mappings,
        hasMappings: mappings.length > 0
      });
    } catch (error: any) {
      console.error('[Get Mappings] Error:', error);
      res.status(500).json({ error: error.message || 'Failed to get mappings' });
    }
  });

  // ---------------------------------------------------------------------------
  // Shopify (Ecommerce) - Connect + Preview + Revenue mappings
  // NOTE: This is a token-based connection (Shopify Admin API access token).
  // Users generate a token via a Shopify custom app and paste it into MetricMind.
  // ---------------------------------------------------------------------------

  const normalizeShopDomain = (input: string) => {
    const raw = String(input || "").trim();
    if (!raw) return "";
    const withoutProto = raw.replace(/^https?:\/\//i, "");
    const host = withoutProto.split("/")[0].trim();
    return host.toLowerCase();
  };

  const shopifyApiFetch = async (args: { shopDomain: string; accessToken: string; path: string }) => {
    const { shopDomain, accessToken, path } = args;
    const base = `https://${shopDomain}`;
    const url = `${base}${path.startsWith("/") ? "" : "/"}${path}`;
    const resp = await fetch(url, {
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
      },
    });
    const text = await resp.text().catch(() => "");
    let json: any = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch {
      json = {};
    }
    if (!resp.ok) {
      const msg =
        json?.errors ||
        json?.error ||
        json?.message ||
        (text && text.length < 300 ? text : "") ||
        `Shopify API error (HTTP ${resp.status})`;
      throw new Error(String(msg));
    }
    return json;
  };

  const parseUtm = (urlOrPath: string | null | undefined) => {
    const s = String(urlOrPath || "").trim();
    if (!s) return {};
    try {
      // landing_site can be a path like "/?utm_campaign=..." or a full URL.
      const u = s.startsWith("http") ? new URL(s) : new URL(s.startsWith("/") ? `https://dummy.local${s}` : `https://dummy.local/${s}`);
      const p = u.searchParams;
      return {
        utm_campaign: p.get("utm_campaign") || "",
        utm_source: p.get("utm_source") || "",
        utm_medium: p.get("utm_medium") || "",
      };
    } catch {
      return {};
    }
  };

  const getShopifyConnectionForCampaign = async (campaignId: string) => {
    const conn: any = await storage.getShopifyConnection(campaignId);
    if (!conn || !conn.isActive || !conn.accessToken || !conn.shopDomain) {
      throw new Error("No active Shopify connection found for this campaign.");
    }
    return conn as any;
  };

  app.post("/api/shopify/connect", async (req, res) => {
    try {
      const { campaignId, shopDomain, accessToken } = req.body || {};
      const campaignIdStr = String(campaignId || "").trim();
      const shop = normalizeShopDomain(shopDomain);
      const token = String(accessToken || "").trim();
      if (!campaignIdStr) return res.status(400).json({ error: "campaignId is required" });
      if (!shop) return res.status(400).json({ error: "shopDomain is required" });
      if (!token) return res.status(400).json({ error: "accessToken is required" });

      // Validate token by fetching shop info
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
      const shopResp = await shopifyApiFetch({
        shopDomain: shop,
        accessToken: token,
        path: `/admin/api/${apiVersion}/shop.json`,
      });
      const shopName = shopResp?.shop?.name ? String(shopResp.shop.name) : null;

      // Deactivate existing connections for campaign (single active connection)
      const existing = await storage.getShopifyConnections(campaignIdStr);
      for (const c of existing || []) {
        if ((c as any)?.id) {
          await storage.updateShopifyConnection((c as any).id, { isActive: false } as any);
        }
      }

      const created = await storage.createShopifyConnection({
        campaignId: campaignIdStr,
        shopDomain: shop,
        shopName: shopName,
        accessToken: token,
        isActive: true,
        mappingConfig: null,
      } as any);

      res.json({
        success: true,
        connected: true,
        id: created.id,
        shopDomain: shop,
        shopName,
      });
    } catch (error: any) {
      console.error("[Shopify Connect] Error:", error);
      res.status(500).json({ error: error.message || "Failed to connect Shopify" });
    }
  });

  app.get("/api/shopify/:campaignId/status", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const conn: any = await storage.getShopifyConnection(campaignId);
      const connected = !!(conn && conn.isActive && conn.accessToken && conn.shopDomain);
      res.json({
        connected,
        shopDomain: connected ? conn.shopDomain : null,
        shopName: connected ? conn.shopName : null,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to check Shopify connection" });
    }
  });

  app.get("/api/shopify/:campaignId/orders/preview", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "50"), 10) || 50, 1), 100);
      const columnsParam = String(req.query.columns || "").trim();
      const columns = columnsParam ? columnsParam.split(",").map((s) => s.trim()).filter(Boolean) : [];

      const conn = await getShopifyConnectionForCampaign(campaignId);
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";

      // Default: last 90 days
      const createdAtMin = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const ordersResp = await shopifyApiFetch({
        shopDomain: conn.shopDomain,
        accessToken: conn.accessToken,
        path: `/admin/api/${apiVersion}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`,
      });
      const orders: any[] = Array.isArray(ordersResp?.orders) ? ordersResp.orders : [];

      const availableColumns = [
        "Order",
        "Created At",
        "Total Price",
        "Currency",
        "Discount Codes",
        "Landing Site",
        "Referring Site",
        "UTM Campaign",
        "UTM Source",
        "UTM Medium",
      ];
      const selectedColumns = columns.length > 0 ? columns : ["Order", "Created At", "Total Price", "Currency", "UTM Campaign"];
      const headers = selectedColumns.filter((h) => availableColumns.includes(h));

      const rows = orders.slice(0, limit).map((o) => {
        const utm = parseUtm(o?.landing_site || o?.landing_site_ref || "");
        const discountCodes = Array.isArray(o?.discount_codes)
          ? o.discount_codes.map((d: any) => d?.code).filter(Boolean).join(", ")
          : "";
        const record: Record<string, any> = {
          "Order": o?.name || o?.order_number || "",
          "Created At": o?.created_at || "",
          "Total Price": o?.total_price || "",
          "Currency": o?.currency || "",
          "Discount Codes": discountCodes,
          "Landing Site": o?.landing_site || "",
          "Referring Site": o?.referring_site || "",
          "UTM Campaign": (utm as any).utm_campaign || "",
          "UTM Source": (utm as any).utm_source || "",
          "UTM Medium": (utm as any).utm_medium || "",
        };
        return headers.map((h) => String(record[h] ?? ""));
      });

      res.json({
        success: true,
        headers,
        rows,
        rowCount: rows.length,
      });
    } catch (error: any) {
      console.error("[Shopify Preview] Error:", error);
      res.status(500).json({ error: error.message || "Failed to load Shopify preview" });
    }
  });

  app.get("/api/shopify/:campaignId/orders/unique-values", async (req, res) => {
    try {
      const { campaignId } = req.params;
      const field = String(req.query.field || "").trim();
      const days = Math.min(Math.max(parseInt(String(req.query.days || "90"), 10) || 90, 1), 3650);
      const limit = Math.min(Math.max(parseInt(String(req.query.limit || "300"), 10) || 300, 1), 500);

      const conn = await getShopifyConnectionForCampaign(campaignId);
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
      const createdAtMin = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
      const ordersResp = await shopifyApiFetch({
        shopDomain: conn.shopDomain,
        accessToken: conn.accessToken,
        path: `/admin/api/${apiVersion}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`,
      });
      const orders: any[] = Array.isArray(ordersResp?.orders) ? ordersResp.orders : [];

      const getValue = (o: any): string => {
        const utm = parseUtm(o?.landing_site || o?.landing_site_ref || "");
        if (field === "utm_campaign") return String((utm as any).utm_campaign || "");
        if (field === "utm_source") return String((utm as any).utm_source || "");
        if (field === "utm_medium") return String((utm as any).utm_medium || "");
        if (field === "discount_code") {
          const codes = Array.isArray(o?.discount_codes) ? o.discount_codes.map((d: any) => d?.code).filter(Boolean) : [];
          return codes.length > 0 ? String(codes[0]) : "";
        }
        return "";
      };

      const counts = new Map<string, number>();
      for (const o of orders) {
        const v = getValue(o).trim();
        if (!v) continue;
        counts.set(v, (counts.get(v) || 0) + 1);
      }

      const values = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
        .map(([value, count]) => ({ value, count }));

      res.json({ success: true, field, days, values });
    } catch (error: any) {
      console.error("[Shopify Unique Values] Error:", error);
      res.status(500).json({ error: error.message || "Failed to load Shopify values" });
    }
  });

  app.post("/api/campaigns/:id/shopify/save-mappings", async (req, res) => {
    try {
      const campaignId = req.params.id;
      const { campaignField, selectedValues, revenueMetric, revenueClassification, days } = req.body || {};
      const field = String(campaignField || "").trim();
      const selected: string[] = Array.isArray(selectedValues) ? selectedValues.map((v: any) => String(v).trim()).filter(Boolean) : [];
      const metric = String(revenueMetric || "total_price").trim();
      const rangeDays = Math.min(Math.max(parseInt(String(days || "90"), 10) || 90, 1), 3650);

      if (!field) return res.status(400).json({ error: "campaignField is required" });
      if (selected.length === 0) return res.status(400).json({ error: "selectedValues is required" });

      const conn = await getShopifyConnectionForCampaign(campaignId);
      const apiVersion = process.env.SHOPIFY_API_VERSION || "2024-01";
      const createdAtMin = new Date(Date.now() - rangeDays * 24 * 60 * 60 * 1000).toISOString();
      const ordersResp = await shopifyApiFetch({
        shopDomain: conn.shopDomain,
        accessToken: conn.accessToken,
        path: `/admin/api/${apiVersion}/orders.json?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`,
      });
      const orders: any[] = Array.isArray(ordersResp?.orders) ? ordersResp.orders : [];

      const getFieldValue = (o: any): string => {
        const utm = parseUtm(o?.landing_site || o?.landing_site_ref || "");
        if (field === "utm_campaign") return String((utm as any).utm_campaign || "");
        if (field === "utm_source") return String((utm as any).utm_source || "");
        if (field === "utm_medium") return String((utm as any).utm_medium || "");
        if (field === "discount_code") {
          const codes = Array.isArray(o?.discount_codes) ? o.discount_codes.map((d: any) => d?.code).filter(Boolean) : [];
          return codes.length > 0 ? String(codes[0]) : "";
        }
        return "";
      };

      const parseMoney = (val: any): number => {
        const n = Number(String(val ?? "").replace(/[^0-9.\-]/g, ""));
        return Number.isFinite(n) ? n : 0;
      };

      let totalRevenue = 0;
      const matchedOrders: any[] = [];
      const selectedSet = new Set(selected);
      for (const o of orders) {
        const v = getFieldValue(o).trim();
        if (!v || !selectedSet.has(v)) continue;
        matchedOrders.push(o);
        if (metric === "total_price") totalRevenue += parseMoney(o?.total_price);
        else if (metric === "current_total_price") totalRevenue += parseMoney(o?.current_total_price);
        else totalRevenue += parseMoney(o?.total_price);
      }

      // Compute LinkedIn conversion value using latest import session metrics (same pattern as HubSpot/Salesforce)
      const sessions = await storage.getCampaignLinkedInImportSessions(campaignId);
      if (!sessions || sessions.length === 0) {
        return res.status(400).json({ error: "No LinkedIn import session found for this campaign." });
      }
      const latestSession = sessions.sort((a: any, b: any) => new Date(b.importedAt).getTime() - new Date(a.importedAt).getTime())[0];
      const importMetrics = await storage.getLinkedInImportMetrics(latestSession.id);
      const canonicalKey = (k: any) => String(k || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const totalConversions = (importMetrics || []).reduce((sum: number, m: any) => {
        const key = canonicalKey(m.metricKey);
        if (key === "conversions" || key === "externalwebsiteconversions") {
          const v = Number(m.metricValue);
          if (Number.isFinite(v)) return sum + v;
        }
        return sum;
      }, 0);
      if (!Number.isFinite(totalConversions) || totalConversions <= 0) {
        return res.status(400).json({ error: "LinkedIn conversions are 0. Cannot compute conversion value." });
      }

      const calculatedConversionValue = Number((totalRevenue / totalConversions).toFixed(2));
      await storage.updateCampaign(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInConnection(campaignId, { conversionValue: calculatedConversionValue } as any);
      await storage.updateLinkedInImportSession(latestSession.id, { conversionValue: calculatedConversionValue } as any);

      // Persist mapping config on the active Shopify connection
      const shopifyConn: any = await storage.getShopifyConnection(campaignId);
      if (shopifyConn) {
        const rcRaw = String(revenueClassification || "").trim();
        const rc =
          rcRaw === "offsite_not_in_ga4" || rcRaw === "onsite_in_ga4" ? rcRaw : "onsite_in_ga4";
        const mappingConfig = {
          objectType: "orders",
          campaignField: field,
          selectedValues: selected,
          revenueMetric: metric,
          days: rangeDays,
          shopDomain: conn.shopDomain,
          revenueClassification: rc,
          lastTotalRevenue: Number(totalRevenue.toFixed(2)),
        };
        await storage.updateShopifyConnection(shopifyConn.id, { mappingConfig: JSON.stringify(mappingConfig) } as any);
      }

      res.json({
        success: true,
        conversionValueCalculated: true,
        conversionValue: calculatedConversionValue,
        totalRevenue: Number(totalRevenue.toFixed(2)),
        totalConversions: Number(totalConversions.toFixed(2)),
        matchedOrderCount: matchedOrders.length,
      });
    } catch (error: any) {
      console.error("[Shopify Save Mappings] Error:", error);
      res.status(500).json({ error: error.message || "Failed to process Shopify revenue metrics" });
    }
  });

  const server = createServer(app);
  return server;
}