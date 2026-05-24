import { useParams } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Calendar, Target, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, GitCompare } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatPct, normalizeRateToPercent } from "@shared/metric-math";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Area, BarChart, Bar, ComposedChart, PieChart, Pie, Cell,
  ReferenceLine, ReferenceDot,
} from "recharts";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";

const COLORS = ['#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#06b6d4'];
const PLATFORM_COLORS: Record<string, string> = {
  linkedin: '#0077B5',
  meta: '#1877F2',
  google_ads: '#34A853',
  ga4: '#E37400',
};

// ─── Helpers ─────────────────────────────────────────────────────────
const fmtNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return n.toLocaleString();
};
const fmtCur = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
const sumArr = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] || 0), 0);
const avgArr = (arr: any[], key: string) => arr.length > 0 ? sumArr(arr, key) / arr.length : 0;

const tooltipStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
};

// ─── Anomaly Detection ──────────────────────────────────────────────
interface Anomaly {
  date: string;
  label: string;
  metric: string;
  value: number;
  expected: number;
  severity: 'warning' | 'critical';
}

function detectAnomalies(series: any[], metrics: string[]): Anomaly[] {
  const anomalies: Anomaly[] = [];
  metrics.forEach(metric => {
    const values = series.map(r => r[metric] || 0);
    if (values.length < 8) return;
    for (let i = 7; i < values.length; i++) {
      const window = values.slice(i - 7, i);
      const mean = window.reduce((a, b) => a + b, 0) / window.length;
      const variance = window.reduce((a, b) => a + (b - mean) ** 2, 0) / window.length;
      const stddev = Math.sqrt(variance);
      const val = values[i];
      if (stddev > 0) {
        const deviations = Math.abs(val - mean) / stddev;
        if (deviations > 2) {
          anomalies.push({
            date: series[i].date,
            label: series[i].label,
            metric,
            value: val,
            expected: mean,
            severity: deviations > 3 ? 'critical' : 'warning',
          });
        }
      }
    }
  });
  return anomalies;
}

// ─── Main Component ─────────────────────────────────────────────────
export default function TrendAnalysis() {
  const { id: campaignId } = useParams();

  // Page-level state
  const [perfPeriod, setPerfPeriod] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(['spend', 'revenue', 'conversions']));
  const [platformMetric, setPlatformMetric] = useState<string>("spend");

  const perfDays = perfPeriod === '7d' ? 7 : perfPeriod === '14d' ? 14 : perfPeriod === '90d' ? 90 : 30;
  const trendDateRange = perfDays === 7 ? "7days" : perfDays === 90 ? "90days" : "30days";

  // ─── Data Queries (all fetched on load, not gated by tab) ────────
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: connectedPlatforms } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId,
  });

  const { data: kpis = [] } = useQuery<any[]>({
    queryKey: [`/api/campaigns/${campaignId}/kpis`],
    enabled: !!campaignId,
  });

  const { data: ga4Daily, isPlaceholderData: isRefreshing } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "ga4-daily", perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-daily?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: linkedinDaily } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "linkedin-daily", perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/linkedin-daily?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: metaDaily } = useQuery({
    queryKey: ["/api/meta", campaignId, "daily-metrics", perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const start = subDays(new Date(), perfDays * 2).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      const resp = await fetch(`/api/meta/${campaignId}/daily-metrics?startDate=${start}&endDate=${end}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: googleAdsDaily } = useQuery({
    queryKey: ["/api/google-ads", campaignId, "daily-metrics", perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const start = subDays(new Date(), perfDays * 2).toISOString().slice(0, 10);
      const end = new Date().toISOString().slice(0, 10);
      const resp = await fetch(`/api/google-ads/${campaignId}/daily-metrics?startDate=${start}&endDate=${end}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const { data: dailyFinancials } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "daily-financials", perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/daily-financials?days=${perfDays * 2}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const {
    data: trendAnalysisResponse,
    isLoading: trendAnalysisLoading,
    isPlaceholderData: isTrendAnalysisRefreshing,
    isFetched: trendAnalysisFetched,
  } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/trend-analysis`, trendDateRange, perfDays],
    enabled: !!campaignId,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/trend-analysis?dateRange=${trendDateRange}&days=${perfDays * 2}`, {
        credentials: "include",
      });
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  // ─── Unified Cross-Platform Data Layer ───────────────────────────
  const crossPlatformData = useMemo(() => {
    const dateMap: Record<string, any> = {};
    const allDates: string[] = [];

    const addDate = (d: string) => {
      if (!dateMap[d]) { dateMap[d] = { date: d }; allDates.push(d); }
    };

    // GA4 daily
    const ga4Rows = Array.isArray(ga4Daily) ? ga4Daily : (ga4Daily as any)?.data || [];
    ga4Rows.forEach((row: any) => {
      const d = (row.date || '').substring(0, 10);
      if (!d) return;
      addDate(d);
      dateMap[d].ga4_users = (dateMap[d].ga4_users || 0) + (parseFloat(row.users) || 0);
      dateMap[d].ga4_sessions = (dateMap[d].ga4_sessions || 0) + (parseFloat(row.sessions) || 0);
      dateMap[d].ga4_pageviews = (dateMap[d].ga4_pageviews || 0) + (parseFloat(row.pageviews) || 0);
      dateMap[d].ga4_conversions = (dateMap[d].ga4_conversions || 0) + (parseFloat(row.conversions) || 0);
      dateMap[d].ga4_revenue = (dateMap[d].ga4_revenue || 0) + (parseFloat(row.revenue) || 0);
      dateMap[d].ga4_engagementRate = parseFloat(row.engagementRate) || 0;
    });

    // LinkedIn daily
    const liRows = Array.isArray(linkedinDaily) ? linkedinDaily : (linkedinDaily as any)?.dailyMetrics || (linkedinDaily as any)?.data || [];
    liRows.forEach((row: any) => {
      const d = (row.date || row.day || '').substring(0, 10);
      if (!d) return;
      addDate(d);
      dateMap[d].li_impressions = (dateMap[d].li_impressions || 0) + (parseFloat(row.impressions) || 0);
      dateMap[d].li_clicks = (dateMap[d].li_clicks || 0) + (parseFloat(row.clicks) || 0);
      dateMap[d].li_spend = (dateMap[d].li_spend || 0) + (parseFloat(row.spend || row.costInLocalCurrency) || 0);
      dateMap[d].li_conversions = (dateMap[d].li_conversions || 0) + (parseFloat(row.conversions || row.externalWebsiteConversions) || 0);
    });

    // Meta daily
    const metaRows = Array.isArray(metaDaily) ? metaDaily : (metaDaily as any)?.metrics || (metaDaily as any)?.data || [];
    metaRows.forEach((row: any) => {
      const d = (row.date || row.date_start || '').substring(0, 10);
      if (!d) return;
      addDate(d);
      dateMap[d].meta_impressions = (dateMap[d].meta_impressions || 0) + (parseFloat(row.impressions) || 0);
      dateMap[d].meta_clicks = (dateMap[d].meta_clicks || 0) + (parseFloat(row.clicks) || 0);
      dateMap[d].meta_spend = (dateMap[d].meta_spend || 0) + (parseFloat(row.spend) || 0);
      dateMap[d].meta_conversions = (dateMap[d].meta_conversions || 0) + (parseFloat(row.conversions) || 0);
    });

    // Google Ads daily
    const gadsRows = Array.isArray(googleAdsDaily) ? googleAdsDaily : (googleAdsDaily as any)?.metrics || (googleAdsDaily as any)?.data || [];
    gadsRows.forEach((row: any) => {
      const d = (row.date || '').substring(0, 10);
      if (!d) return;
      addDate(d);
      dateMap[d].gads_impressions = (dateMap[d].gads_impressions || 0) + (parseFloat(row.impressions) || 0);
      dateMap[d].gads_clicks = (dateMap[d].gads_clicks || 0) + (parseFloat(row.clicks) || 0);
      dateMap[d].gads_spend = (dateMap[d].gads_spend || 0) + (parseFloat(row.spend) || 0);
      dateMap[d].gads_conversions = (dateMap[d].gads_conversions || 0) + (parseFloat(row.conversions) || 0);
    });

    // Daily financials (canonical spend/revenue)
    const finRows = Array.isArray(dailyFinancials) ? dailyFinancials : (dailyFinancials as any)?.data || [];
    finRows.forEach((row: any) => {
      const d = (row.date || '').substring(0, 10);
      if (!d) return;
      addDate(d);
      dateMap[d].fin_spend = (dateMap[d].fin_spend || 0) + (parseFloat(row.spend || row.totalSpend) || 0);
      dateMap[d].fin_revenue = (dateMap[d].fin_revenue || 0) + (parseFloat(row.revenue || row.totalRevenue) || 0);
    });

    // Merge by date
    const sortedDates = Array.from(new Set(allDates)).sort();
    const series = sortedDates.map(d => {
      const pt = dateMap[d];
      const impressions = (pt.li_impressions || 0) + (pt.meta_impressions || 0) + (pt.gads_impressions || 0);
      const clicks = (pt.li_clicks || 0) + (pt.meta_clicks || 0) + (pt.gads_clicks || 0);
      const adConversions = (pt.li_conversions || 0) + (pt.meta_conversions || 0) + (pt.gads_conversions || 0);
      const conversions = adConversions || (pt.ga4_conversions || 0);
      const spend = pt.fin_spend || ((pt.li_spend || 0) + (pt.meta_spend || 0) + (pt.gads_spend || 0));
      const revenue = pt.fin_revenue || (pt.ga4_revenue || 0);
      const users = pt.ga4_users || 0;
      const sessions = pt.ga4_sessions || 0;

      // Efficiency metrics
      const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
      const cpc = clicks > 0 ? spend / clicks : 0;
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
      const cpa = conversions > 0 ? spend / conversions : 0;
      const roas = spend > 0 ? revenue / spend : 0;
      const roi = spend > 0 ? ((revenue - spend) / spend) * 100 : 0;
      const convRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
      const engagementRate = pt.ga4_engagementRate || 0;

      return {
        date: d,
        label: format(new Date(d + 'T00:00:00'), 'MMM dd'),
        impressions, clicks, spend, conversions, revenue, users, sessions,
        ctr, cpc, cpm, cpa, roas, roi, convRate, engagementRate,
        // Per-platform
        li_impressions: pt.li_impressions || 0, li_clicks: pt.li_clicks || 0,
        li_spend: pt.li_spend || 0, li_conversions: pt.li_conversions || 0,
        meta_impressions: pt.meta_impressions || 0, meta_clicks: pt.meta_clicks || 0,
        meta_spend: pt.meta_spend || 0, meta_conversions: pt.meta_conversions || 0,
        gads_impressions: pt.gads_impressions || 0, gads_clicks: pt.gads_clicks || 0,
        gads_spend: pt.gads_spend || 0, gads_conversions: pt.gads_conversions || 0,
        ga4_users: pt.ga4_users || 0, ga4_sessions: pt.ga4_sessions || 0,
        ga4_conversions: pt.ga4_conversions || 0, ga4_revenue: pt.ga4_revenue || 0,
        ga4_pageviews: pt.ga4_pageviews || 0,
      };
    });

    if (series.length === 0) return null;

    const currentPeriod = series.slice(-perfDays);
    const previousPeriod = series.slice(-perfDays * 2, -perfDays);

    const current = {
      spend: sumArr(currentPeriod, 'spend'),
      revenue: sumArr(currentPeriod, 'revenue'),
      impressions: sumArr(currentPeriod, 'impressions'),
      clicks: sumArr(currentPeriod, 'clicks'),
      conversions: sumArr(currentPeriod, 'conversions'),
      users: sumArr(currentPeriod, 'users'),
      sessions: sumArr(currentPeriod, 'sessions'),
      ctr: avgArr(currentPeriod, 'ctr'),
      cpc: avgArr(currentPeriod, 'cpc'),
      cpm: avgArr(currentPeriod, 'cpm'),
      roas: (() => { const s = sumArr(currentPeriod, 'spend'); const r = sumArr(currentPeriod, 'revenue'); return s > 0 ? r / s : 0; })(),
      cpa: (() => { const s = sumArr(currentPeriod, 'spend'); const c = sumArr(currentPeriod, 'conversions'); return c > 0 ? s / c : 0; })(),
    };
    const previous = {
      spend: sumArr(previousPeriod, 'spend'),
      revenue: sumArr(previousPeriod, 'revenue'),
      impressions: sumArr(previousPeriod, 'impressions'),
      clicks: sumArr(previousPeriod, 'clicks'),
      conversions: sumArr(previousPeriod, 'conversions'),
      ctr: avgArr(previousPeriod, 'ctr'),
      roas: (() => { const s = sumArr(previousPeriod, 'spend'); const r = sumArr(previousPeriod, 'revenue'); return s > 0 ? r / s : 0; })(),
      cpa: (() => { const s = sumArr(previousPeriod, 'spend'); const c = sumArr(previousPeriod, 'conversions'); return c > 0 ? s / c : 0; })(),
    };

    const comparison = {
      spend: pctChange(current.spend, previous.spend),
      revenue: pctChange(current.revenue, previous.revenue),
      conversions: pctChange(current.conversions, previous.conversions),
      ctr: pctChange(current.ctr, previous.ctr),
      roas: pctChange(current.roas, previous.roas),
      cpa: pctChange(current.cpa, previous.cpa),
    };

    const anomalies = detectAnomalies(currentPeriod, ['spend', 'clicks', 'conversions', 'impressions', 'revenue', 'cpa', 'roas']);

    // Platform totals for breakdown tab
    const platformTotals = [
      { platform: 'LinkedIn', color: PLATFORM_COLORS.linkedin, spend: sumArr(currentPeriod, 'li_spend'), impressions: sumArr(currentPeriod, 'li_impressions'), clicks: sumArr(currentPeriod, 'li_clicks'), conversions: sumArr(currentPeriod, 'li_conversions') },
      { platform: 'Meta', color: PLATFORM_COLORS.meta, spend: sumArr(currentPeriod, 'meta_spend'), impressions: sumArr(currentPeriod, 'meta_impressions'), clicks: sumArr(currentPeriod, 'meta_clicks'), conversions: sumArr(currentPeriod, 'meta_conversions') },
      { platform: 'Google Ads', color: PLATFORM_COLORS.google_ads, spend: sumArr(currentPeriod, 'gads_spend'), impressions: sumArr(currentPeriod, 'gads_impressions'), clicks: sumArr(currentPeriod, 'gads_clicks'), conversions: sumArr(currentPeriod, 'gads_conversions') },
    ].filter(p => p.spend > 0 || p.impressions > 0 || p.clicks > 0).map(p => ({
      ...p,
      ctr: p.impressions > 0 ? (p.clicks / p.impressions) * 100 : 0,
      cpc: p.clicks > 0 ? p.spend / p.clicks : 0,
      cpa: p.conversions > 0 ? p.spend / p.conversions : 0,
      cpm: p.impressions > 0 ? (p.spend / p.impressions) * 1000 : 0,
    }));

    return { series: currentPeriod, current, previous, comparison, anomalies, hasPrevious: previousPeriod.length > 0, platformTotals };
  }, [ga4Daily, linkedinDaily, metaDaily, googleAdsDaily, dailyFinancials, perfDays]);

  const trendAggregate = (trendAnalysisResponse as any)?.trendAnalysis;

  const overviewTrendData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const rows = Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    if (rows.length === 0) return null;

    const sourcesFor = (metricName: string): string[] => {
      const sources = aggregate?.metrics?.[metricName]?.sources;
      return Array.isArray(sources) ? sources.map(String) : [];
    };
    const hasMetric = (metricName: string) => sourcesFor(metricName).length > 0;
    const hasEngagementRate = Array.isArray(aggregate?.sources)
      && aggregate.sources.some((source: any) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes("engagementRate"));

    const series: any[] = rows.map((row: any) => {
      const date = String(row?.date || "").slice(0, 10);
      const metrics = row?.metrics || {};
      return {
        date,
        label: format(new Date(`${date}T00:00:00`), 'MMM dd'),
        spend: Number(metrics.spend || 0),
        revenue: Number(metrics.revenue || 0),
        conversions: Number(metrics.conversions || 0),
        impressions: Number(metrics.impressions || 0),
        clicks: Number(metrics.clicks || 0),
        users: Number(metrics.users || 0),
        sessions: Number(metrics.sessions || 0),
        engagementRate: metrics.engagementRate === null || typeof metrics.engagementRate === "undefined" ? null : Number(metrics.engagementRate),
      };
    });

    const currentPeriod = series.slice(-perfDays);
    const previousPeriod = series.slice(-perfDays * 2, -perfDays);
    const sum = (items: any[], key: string) => items.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const avg = (items: any[], key: string) => {
      const values = items.map((row) => row[key]).filter((value) => value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)));
      return values.length > 0 ? values.reduce((total, value) => total + Number(value), 0) / values.length : null;
    };
    const buildSummary = (items: any[]) => {
      const spend = hasMetric("spend") ? sum(items, "spend") : null;
      const revenue = hasMetric("revenue") ? sum(items, "revenue") : null;
      const conversions = hasMetric("conversions") ? sum(items, "conversions") : null;
      const clicks = hasMetric("clicks") ? sum(items, "clicks") : null;
      const impressions = hasMetric("impressions") ? sum(items, "impressions") : null;
      const sessions = hasMetric("sessions") ? sum(items, "sessions") : null;
      const users = hasMetric("users") ? sum(items, "users") : null;
      return {
        spend,
        revenue,
        conversions,
        clicks,
        impressions,
        sessions,
        users,
        roas: spend && spend > 0 && revenue && revenue > 0 ? revenue / spend : null,
        cpa: spend && spend > 0 && conversions && conversions > 0 ? spend / conversions : null,
        ctr: impressions && impressions > 0 && clicks && clicks > 0 ? (clicks / impressions) * 100 : null,
        cvr: conversions && conversions > 0
          ? clicks && clicks > 0
            ? (conversions / clicks) * 100
            : sessions && sessions > 0
              ? (conversions / sessions) * 100
              : null
          : null,
        engagementRate: hasEngagementRate ? avg(items, "engagementRate") : null,
      };
    };

    const current = buildSummary(currentPeriod);
    const previous = buildSummary(previousPeriod);
    const hasCompleteCurrentPeriod = currentPeriod.length >= perfDays;
    const hasCompletePreviousPeriod = previousPeriod.length >= perfDays;
    const comparison = Object.fromEntries(
      Object.keys(current).map((key) => [key, pctChange(Number((current as any)[key] || 0), Number((previous as any)[key] || 0))]),
    );
    const availableSeries = [
      { key: "spend", label: "Spend", color: "#f59e0b", available: hasMetric("spend") },
      { key: "revenue", label: "Revenue", color: "#10b981", available: hasMetric("revenue") },
      { key: "conversions", label: "Conversions", color: "#8b5cf6", available: hasMetric("conversions") },
      { key: "impressions", label: "Impressions", color: "#3b82f6", available: hasMetric("impressions") },
      { key: "clicks", label: "Clicks", color: "#06b6d4", available: hasMetric("clicks") },
      { key: "users", label: "Users", color: "#E37400", available: hasMetric("users") },
      { key: "sessions", label: "Sessions", color: "#ec4899", available: hasMetric("sessions") },
    ].filter((item) => item.available);
    const anomalyKeys = availableSeries.map((item) => item.key).filter((key) => ["spend", "clicks", "conversions", "impressions", "revenue"].includes(key));

    return {
      series: currentPeriod,
      current,
      previous,
      comparison,
      availableSeries,
      anomalies: detectAnomalies(currentPeriod, anomalyKeys),
      hasPrevious: hasCompletePreviousPeriod,
      hasCompleteCurrentPeriod,
      currentPeriodDays: currentPeriod.length,
      previousPeriodDays: previousPeriod.length,
      requestedPeriodDays: perfDays,
      connectedSources: Array.isArray(aggregate?.sources) ? aggregate.sources.map((source: any) => String(source?.label || source?.id)).filter(Boolean) : [],
    };
  }, [trendAggregate, perfDays]);

  const overviewVisibleSeries = useMemo(() => {
    const keys = (overviewTrendData?.availableSeries || []).map((item: any) => item.key);
    const selected = new Set(Array.from(visibleSeries).filter((key) => keys.includes(key)));
    if (selected.size > 0) return selected;
    return new Set(keys.slice(0, 3));
  }, [visibleSeries, overviewTrendData]);

  const efficiencyTrendData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const rows = Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    if (rows.length === 0) return null;

    const toMetric = (value: any) => {
      if (value === null || typeof value === "undefined") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };

    const series = rows.map((row: any) => {
      const date = String(row?.date || "").slice(0, 10);
      const metrics = row?.metrics || {};
      const engagementRate = toMetric(metrics.engagementRate);
      return {
        date,
        label: format(new Date(`${date}T00:00:00`), 'MMM dd'),
        spend: Number(metrics.spend || 0),
        revenue: Number(metrics.revenue || 0),
        conversions: Number(metrics.conversions || 0),
        clicks: Number(metrics.clicks || 0),
        impressions: Number(metrics.impressions || 0),
        sessions: Number(metrics.sessions || 0),
        roas: toMetric(metrics.roas),
        roi: toMetric(metrics.roi),
        cpa: toMetric(metrics.cpa),
        cpc: toMetric(metrics.cpc),
        cpm: toMetric(metrics.cpm),
        ctr: toMetric(metrics.ctr),
        cvr: toMetric(metrics.cvr),
        engagementRate: engagementRate === null ? null : normalizeRateToPercent(engagementRate),
      };
    });

    const currentPeriod = series.slice(-perfDays);
    const previousPeriod = series.slice(-perfDays * 2, -perfDays);
    const sum = (items: any[], key: string) => items.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const avg = (items: any[], key: string) => {
      const values = items.map((row) => row[key]).filter((value) => value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)));
      return values.length > 0 ? values.reduce((total, value) => total + Number(value), 0) / values.length : null;
    };
    const buildSummary = (items: any[]) => {
      const spend = sum(items, "spend");
      const revenue = sum(items, "revenue");
      const conversions = sum(items, "conversions");
      const clicks = sum(items, "clicks");
      const impressions = sum(items, "impressions");
      const sessions = sum(items, "sessions");
      return {
        roas: spend > 0 && revenue > 0 ? revenue / spend : null,
        roi: spend > 0 && revenue > 0 ? ((revenue - spend) / spend) * 100 : null,
        cpa: spend > 0 && conversions > 0 ? spend / conversions : null,
        cpc: spend > 0 && clicks > 0 ? spend / clicks : null,
        cpm: spend > 0 && impressions > 0 ? (spend / impressions) * 1000 : null,
        ctr: impressions > 0 && clicks > 0 ? (clicks / impressions) * 100 : null,
        cvr: conversions > 0
          ? clicks > 0
            ? (conversions / clicks) * 100
            : sessions > 0
              ? (conversions / sessions) * 100
              : null
          : null,
        engagementRate: avg(items, "engagementRate"),
      };
    };

    const current = buildSummary(currentPeriod);
    const previous = buildSummary(previousPeriod);
    const compare = (key: string) => {
      const curr = (current as any)[key];
      const prev = (previous as any)[key];
      return curr !== null && prev !== null ? pctChange(Number(curr), Number(prev)) : null;
    };
    const hasValue = (key: string) => current[key as keyof typeof current] !== null || currentPeriod.some((row: any) => row[key] !== null && typeof row[key] !== "undefined");
    const cards = [
      { key: "roas", label: "ROAS", value: current.roas === null ? null : `${current.roas.toFixed(1)}x`, change: compare("roas") },
      { key: "roi", label: "ROI", value: current.roi === null ? null : formatPct(current.roi), change: compare("roi") },
      { key: "cpa", label: "CPA", value: current.cpa === null ? null : fmtCur(current.cpa), change: compare("cpa"), invertColor: true },
      { key: "cvr", label: "CVR", value: current.cvr === null ? null : formatPct(current.cvr), change: compare("cvr") },
      { key: "engagementRate", label: "Engagement Rate", value: current.engagementRate === null ? null : formatPct(current.engagementRate), change: compare("engagementRate") },
      { key: "cpc", label: "CPC", value: current.cpc === null ? null : fmtCur(current.cpc), change: compare("cpc"), invertColor: true },
      { key: "cpm", label: "CPM", value: current.cpm === null ? null : fmtCur(current.cpm), change: compare("cpm"), invertColor: true },
      { key: "ctr", label: "CTR", value: current.ctr === null ? null : formatPct(current.ctr), change: compare("ctr") },
    ].filter((card) => hasValue(card.key) && card.value !== null);

    return {
      series: currentPeriod,
      current,
      cards,
      hasPrevious: previousPeriod.length >= perfDays,
      hasCompleteCurrentPeriod: currentPeriod.length >= perfDays,
      currentPeriodDays: currentPeriod.length,
      requestedPeriodDays: perfDays,
      hasFinancialEfficiency: hasValue("roas") || hasValue("roi"),
      hasCostEfficiency: hasValue("cpa") || hasValue("cpc") || hasValue("cpm"),
      hasRateEfficiency: hasValue("ctr") || hasValue("cvr") || hasValue("engagementRate"),
    };
  }, [trendAggregate, perfDays]);

  const conversionFunnelData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const rows = Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    if (rows.length === 0) return null;

    const sourcesFor = (metricName: string): string[] => {
      const sources = aggregate?.metrics?.[metricName]?.sources;
      return Array.isArray(sources) ? sources.map(String) : [];
    };
    const hasMetric = (metricName: string) => sourcesFor(metricName).length > 0;
    const hasEngagementRate = Array.isArray(aggregate?.sources)
      && aggregate.sources.some((source: any) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes("engagementRate"));
    const toMetric = (value: any) => {
      if (value === null || typeof value === "undefined") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const series = rows.map((row: any) => {
      const date = String(row?.date || "").slice(0, 10);
      const metrics = row?.metrics || {};
      const engagementRate = toMetric(metrics.engagementRate);
      return {
        date,
        label: format(new Date(`${date}T00:00:00`), 'MMM dd'),
        users: Number(metrics.users || 0),
        sessions: Number(metrics.sessions || 0),
        conversions: Number(metrics.conversions || 0),
        engagementRate: engagementRate === null ? null : normalizeRateToPercent(engagementRate),
        impressions: Number(metrics.impressions || 0),
        clicks: Number(metrics.clicks || 0),
        spend: Number(metrics.spend || 0),
        ctr: toMetric(metrics.ctr),
        cpc: toMetric(metrics.cpc),
        cpm: toMetric(metrics.cpm),
        cpa: toMetric(metrics.cpa),
        roas: toMetric(metrics.roas),
      };
    });
    const currentPeriod = series.slice(-perfDays);
    const sum = (key: string) => currentPeriod.reduce((total: number, row: any) => total + (Number(row[key]) || 0), 0);
    const avg = (key: string) => {
      const values = currentPeriod.map((row: any) => row[key]).filter((value: any) => value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)));
      return values.length > 0 ? values.reduce((total: number, value: any) => total + Number(value), 0) / values.length : null;
    };
    const sessions = hasMetric("sessions") ? sum("sessions") : null;
    const users = hasMetric("users") ? sum("users") : null;
    const conversions = hasMetric("conversions") ? sum("conversions") : null;
    const impressions = hasMetric("impressions") ? sum("impressions") : null;
    const clicks = hasMetric("clicks") ? sum("clicks") : null;
    const spend = hasMetric("spend") ? sum("spend") : null;

    return {
      series: currentPeriod,
      current: {
        sessions,
        users,
        conversions,
        webCvr: conversions !== null && sessions && sessions > 0 ? (conversions / sessions) * 100 : null,
        engagementRate: hasEngagementRate ? avg("engagementRate") : null,
        impressions,
        clicks,
        spend,
        ctr: impressions && impressions > 0 && clicks !== null ? (clicks / impressions) * 100 : null,
        paidCvr: clicks && clicks > 0 && conversions !== null ? (conversions / clicks) * 100 : null,
        cpa: spend && spend > 0 && conversions ? spend / conversions : null,
        cpc: spend && spend > 0 && clicks ? spend / clicks : null,
        cpm: spend && spend > 0 && impressions ? (spend / impressions) * 1000 : null,
        roas: avg("roas"),
      },
      webAvailable: hasMetric("sessions") || hasMetric("users") || hasMetric("conversions") || hasEngagementRate,
      paidAvailable: hasMetric("impressions") || hasMetric("clicks"),
      hasCompleteCurrentPeriod: currentPeriod.length >= perfDays,
      currentPeriodDays: currentPeriod.length,
      requestedPeriodDays: perfDays,
    };
  }, [trendAggregate, perfDays]);

  const platformBreakdownData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const sources = Array.isArray(aggregate?.sources) ? aggregate.sources : [];
    if (sources.length === 0) return null;

    const toMetric = (value: any) => {
      if (value === null || typeof value === "undefined") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const sourceRows = sources.map((source: any, index: number) => {
      const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String) : [];
      const excludedMetrics = Array.isArray(source?.excludedMetrics) ? source.excludedMetrics : [];
      const dailyRows = Array.isArray(source?.dailyRows) ? source.dailyRows : [];
      const currentRows = dailyRows.slice(-perfDays);
      const hasMetric = (metricName: string) => includedMetrics.includes(metricName);
      const sum = (metricName: string) => hasMetric(metricName)
        ? currentRows.reduce((total: number, row: any) => total + (Number(row?.metrics?.[metricName]) || 0), 0)
        : null;
      const users = sum("users");
      const sessions = sum("sessions");
      const impressions = sum("impressions");
      const clicks = sum("clicks");
      const spend = sum("spend");
      const conversions = sum("conversions");
      const revenue = sum("revenue");
      return {
        id: String(source?.id || `source_${index}`),
        label: String(source?.label || source?.id || "Connected Source"),
        category: String(source?.category || "custom"),
        color: PLATFORM_COLORS[String(source?.id || "")] || COLORS[index % COLORS.length],
        users,
        sessions,
        impressions,
        clicks,
        spend,
        conversions,
        revenue,
        ctr: impressions && impressions > 0 && clicks !== null ? (clicks / impressions) * 100 : null,
        cpc: spend && spend > 0 && clicks ? spend / clicks : null,
        cpa: spend && spend > 0 && conversions ? spend / conversions : null,
        roas: spend && spend > 0 && revenue !== null ? revenue / spend : null,
        includedMetrics,
        unavailable: excludedMetrics.map((item: any) => `${item.metric}: ${item.reason}`).slice(0, 3),
      };
    });

    const metricOptions = ["spend", "clicks", "conversions", "impressions", "sessions", "users", "revenue"]
      .filter((metricName) => sourceRows.some((source: any) => source[metricName] !== null));
    const activeMetric = metricOptions.includes(platformMetric) ? platformMetric : metricOptions[0] || "conversions";

    const trendRowsByDate = new Map<string, any>();
    for (const source of sources) {
      const sourceId = String(source?.id || "");
      const dailyRows = Array.isArray(source?.dailyRows) ? source.dailyRows.slice(-perfDays) : [];
      for (const row of dailyRows) {
        const date = String(row?.date || "").slice(0, 10);
        if (!date) continue;
        if (!trendRowsByDate.has(date)) {
          trendRowsByDate.set(date, { date, label: format(new Date(`${date}T00:00:00`), 'MMM dd') });
        }
        const trendRow = trendRowsByDate.get(date);
        trendRow[`${sourceId}_${activeMetric}`] = Number(row?.metrics?.[activeMetric] || 0);
      }
    }

    return {
      sources: sourceRows,
      trendRows: Array.from(trendRowsByDate.values()).sort((a: any, b: any) => String(a.date).localeCompare(String(b.date))),
      metricOptions,
      activeMetric,
      spendSources: sourceRows.filter((source: any) => source.spend !== null && source.spend > 0),
      efficiencySources: sourceRows.filter((source: any) => (source.cpa !== null && source.cpa > 0) || (source.cpc !== null && source.cpc > 0)),
    };
  }, [trendAggregate, perfDays, platformMetric]);

  const trendInsights = useMemo<any[]>(() => {
    const insights: any[] = [];
    const pushInsight = (insight: any) => insights.push(insight);
    const sourceLabels = Array.isArray(trendAggregate?.sources)
      ? trendAggregate.sources.map((source: any) => source?.label).filter(Boolean)
      : [];

    if (sourceLabels.length > 0) {
      pushInsight({
        type: "info",
        title: "Connected Source Coverage",
        message: `Trend Analysis is using ${sourceLabels.join(", ")} for the selected period. Metrics shown here reflect only capabilities from those connected main sources.`,
      });
    }

    if (overviewTrendData?.hasPrevious) {
      const revenueChange = overviewTrendData.comparison?.revenue;
      const conversionsChange = overviewTrendData.comparison?.conversions;
      if (typeof revenueChange === "number" && revenueChange < -10) {
        pushInsight({
          type: "warning",
          title: "Revenue Trend Needs Review",
          message: `Revenue is down ${Math.abs(revenueChange).toFixed(1)}% versus the previous comparable period. Review the source and funnel tabs before changing spend.`,
        });
      } else if (typeof conversionsChange === "number" && conversionsChange < -10) {
        pushInsight({
          type: "warning",
          title: "Conversion Trend Needs Review",
          message: `Conversions are down ${Math.abs(conversionsChange).toFixed(1)}% versus the previous comparable period. Check traffic quality and conversion path changes.`,
        });
      } else {
        pushInsight({
          type: "success",
          title: "Performance Trend Stable",
          message: "No major negative movement is visible in the current comparable trend window. Continue monitoring source-level changes before making budget decisions.",
        });
      }
    } else if (overviewTrendData?.currentPeriodDays) {
      pushInsight({
        type: "info",
        title: "Historical Comparison Pending",
        message: `Current values are available for ${overviewTrendData.currentPeriodDays} of ${overviewTrendData.requestedPeriodDays} selected days. Full trend comparisons need enough compatible daily history.`,
      });
    }

    if (efficiencyTrendData?.cards?.length) {
      const roas = efficiencyTrendData.current?.roas;
      const cpa = efficiencyTrendData.current?.cpa;
      if (typeof roas === "number" && roas >= 4) {
        pushInsight({
          type: "success",
          title: "Revenue Efficiency Is Strong",
          message: `ROAS is ${roas.toFixed(2)}x from available revenue and spend inputs. Consider scaling only after source capacity and campaign goals are confirmed.`,
        });
      } else if (typeof cpa === "number" && cpa > 0) {
        pushInsight({
          type: "info",
          title: "Cost Efficiency Available",
          message: `CPA is ${fmtCur(cpa)}. Use this with conversion trend movement before deciding whether spend needs optimization.`,
        });
      }
    } else {
      pushInsight({
        type: "warning",
        title: "Efficiency Inputs Are Limited",
        message: "ROAS, ROI, CPA, CPC, and CPM require the needed spend, revenue, click, or conversion inputs from connected sources.",
      });
    }

    if (conversionFunnelData?.webAvailable) {
      const webCvr = conversionFunnelData.current?.webCvr;
      if (typeof webCvr === "number" && webCvr < 2) {
        pushInsight({
          type: "warning",
          title: "Conversion Path Opportunity",
          message: `Web conversion rate is ${formatPct(webCvr)}. Review landing pages, offer clarity, and conversion tracking before increasing acquisition activity.`,
        });
      } else if (typeof webCvr === "number") {
        pushInsight({
          type: "success",
          title: "Web Funnel Is Converting",
          message: `Web conversion rate is ${formatPct(webCvr)} from available sessions and conversions. Monitor whether this holds as more daily history accumulates.`,
        });
      }
    }

    if (platformBreakdownData?.sources?.length === 1) {
      pushInsight({
        type: "info",
        title: "Single-Source Trend View",
        message: `${platformBreakdownData.sources[0].label} is the only connected main source in this Trend Analysis view. Cross-platform trend recommendations will become stronger after more main sources are connected.`,
      });
    }

    if (insights.length === 0) {
      pushInsight({
        type: "info",
        title: "Trend Insights Pending",
        message: "Connect a source or wait for compatible daily trend rows to generate executive recommendations.",
      });
    }

    return insights.slice(0, 5);
  }, [trendAggregate, overviewTrendData, efficiencyTrendData, conversionFunnelData, platformBreakdownData]);

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // KPI targets for reference lines
  const kpiTargets = useMemo(() => {
    const targets: Record<string, number> = {};
    (kpis || []).forEach((k: any) => {
      const name = (k.metric || k.name || '').toLowerCase();
      if (name.includes('revenue') && k.targetValue) targets.revenue = parseFloat(k.targetValue);
      if (name.includes('conversion') && k.targetValue) targets.conversions = parseFloat(k.targetValue);
      if (name.includes('roas') && k.targetValue) targets.roas = parseFloat(k.targetValue);
    });
    return targets;
  }, [kpis]);

  // ─── Loading / Error States ──────────────────────────────────────
  if (campaignLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="animate-pulse space-y-6">
              <div className="h-8 bg-muted rounded w-1/3" />
              <div className="grid gap-4 md:grid-cols-4">
                {[0,1,2,3].map(i => <div key={i} className="h-24 bg-muted rounded" />)}
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (campaignError || !campaign) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-8">
              <h1 className="text-xl font-semibold text-foreground mb-2">Campaign Not Found</h1>
              <p className="text-muted-foreground/70">Unable to load campaign data for trend analysis.</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const overviewHasData = Boolean(overviewTrendData && overviewTrendData.series.length > 0);
  const overviewLoading = trendAnalysisLoading && !trendAnalysisFetched && !overviewTrendData;

  // ─── Render ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-4">
                <Link href={`/campaigns/${(campaign as any)?.id}`}>
                  <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-2" />Back to Campaign</Button>
                </Link>
                <div>
                  <h1 className="text-3xl font-bold text-foreground">Trend Analysis</h1>
                  <p className="text-muted-foreground/70 mt-1">{(campaign as any)?.name}</p>
                </div>
              </div>
              {/* Period selector is hidden on Insights because that tab summarizes other views. */}
              {activeTab !== "insights" && (
                <Select value={perfPeriod} onValueChange={setPerfPeriod}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="14d">Last 14 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency Metrics</TabsTrigger>
              <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
              <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
            </TabsList>

            {/* ═══════════ TAB 1: EXECUTIVE OVERVIEW ═══════════ */}
            <TabsContent value="overview" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {overviewLoading ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="grid gap-4 md:grid-cols-4">
                        {[0, 1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded" />)}
                      </div>
                      <div className="h-72 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ) : !overviewHasData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Activity className="w-16 h-16 mx-auto text-muted-foreground/60 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No connected source trend data available</h3>
                    <p className="text-sm text-muted-foreground/70">
                      Refresh a connected platform to populate source-aware trend history.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-6">
                      {[
                        { label: 'Sessions', value: overviewTrendData.current.sessions === null ? null : fmtNum(overviewTrendData.current.sessions), change: overviewTrendData.comparison.sessions },
                        { label: 'Users', value: overviewTrendData.current.users === null ? null : fmtNum(overviewTrendData.current.users), change: overviewTrendData.comparison.users },
                        { label: 'Conversions', value: overviewTrendData.current.conversions === null ? null : fmtNum(overviewTrendData.current.conversions), change: overviewTrendData.comparison.conversions },
                        { label: 'Revenue', value: overviewTrendData.current.revenue === null ? null : fmtCur(overviewTrendData.current.revenue), change: overviewTrendData.comparison.revenue },
                        { label: 'CVR', value: overviewTrendData.current.cvr === null ? null : formatPct(overviewTrendData.current.cvr), change: overviewTrendData.comparison.cvr },
                        { label: 'Engagement Rate', value: overviewTrendData.current.engagementRate === null ? null : formatPct(normalizeRateToPercent(overviewTrendData.current.engagementRate)), change: overviewTrendData.comparison.engagementRate },
                        { label: 'Spend', value: overviewTrendData.current.spend === null ? null : fmtCur(overviewTrendData.current.spend), change: overviewTrendData.comparison.spend, invertColor: true },
                        { label: 'ROAS', value: overviewTrendData.current.roas === null ? null : `${overviewTrendData.current.roas.toFixed(1)}x`, change: overviewTrendData.comparison.roas },
                        { label: 'CPA', value: overviewTrendData.current.cpa === null ? null : fmtCur(overviewTrendData.current.cpa), change: overviewTrendData.comparison.cpa, invertColor: true },
                        { label: 'CTR', value: overviewTrendData.current.ctr === null ? null : formatPct(overviewTrendData.current.ctr), change: overviewTrendData.comparison.ctr },
                      ].filter((card) => card.value !== null).slice(0, 6).map((card, i) => {
                        const isGood = card.invertColor ? card.change <= 0 : card.change >= 0;
                        return (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="text-xs text-muted-foreground/70 mb-1">{card.label}</div>
                              <div className="text-xl font-bold text-foreground">{card.value}</div>
                              {overviewTrendData.hasPrevious && (
                                <div className={`flex items-center text-xs mt-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                                  {card.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                                  {card.change >= 0 ? '+' : ''}{card.change.toFixed(1)}%
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>

                  {!overviewTrendData.hasCompleteCurrentPeriod && (
                    <p className="text-sm text-muted-foreground">
                      Showing {overviewTrendData.currentPeriodDays} of {overviewTrendData.requestedPeriodDays} days available for this selection. Full-period trend comparisons appear once enough daily history exists.
                    </p>
                  )}

                  {/* Metric Toggle Row */}
                  <div className="flex flex-wrap gap-2">
                    {overviewTrendData.availableSeries.map((s: any) => (
                      <button
                        key={s.key}
                        onClick={() => toggleSeries(s.key)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          overviewVisibleSeries.has(s.key)
                            ? 'text-white border-transparent'
                            : 'text-muted-foreground/70 border-border bg-transparent'
                        }`}
                        style={overviewVisibleSeries.has(s.key) ? { backgroundColor: s.color } : {}}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>

                  {/* Main Chart */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="w-5 h-5" />
                        <span>Cross-Platform Performance</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={overviewTrendData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => {
                              if (['Spend', 'Revenue'].some(n => name.includes(n))) return [fmtCur(Number(value)), name];
                              return [Number(value).toLocaleString(), name];
                            }} />
                            {overviewVisibleSeries.has('spend') && <Area yAxisId="right" type="monotone" dataKey="spend" fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeWidth={2} name="Spend ($)" />}
                            {overviewVisibleSeries.has('revenue') && <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue ($)" />}
                            {overviewVisibleSeries.has('conversions') && <Bar yAxisId="left" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />}
                            {overviewVisibleSeries.has('impressions') && <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.08} stroke="#3b82f6" strokeWidth={1.5} name="Impressions" />}
                            {overviewVisibleSeries.has('clicks') && <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={false} name="Clicks" />}
                            {overviewVisibleSeries.has('users') && <Line yAxisId="left" type="monotone" dataKey="users" stroke="#E37400" strokeWidth={2} dot={false} name="Users" />}
                            {overviewVisibleSeries.has('sessions') && <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#ec4899" strokeWidth={2} dot={false} name="Sessions" />}
                            {/* KPI target lines */}
                            {kpiTargets.revenue && overviewVisibleSeries.has('revenue') && (
                              <ReferenceLine yAxisId="right" y={kpiTargets.revenue} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Revenue Target', fill: '#10b981', fontSize: 10 }} />
                            )}
                            {/* Anomaly dots */}
                            {overviewTrendData.anomalies.filter((a: any) => overviewVisibleSeries.has(a.metric)).slice(0, 8).map((a: any, i: number) => (
                              <ReferenceDot key={i} x={a.label} y={a.value}
                                yAxisId={['spend', 'revenue'].includes(a.metric) ? 'right' : 'left'}
                                r={5} fill={a.severity === 'critical' ? '#ef4444' : '#f59e0b'} stroke="white" strokeWidth={2}
                              />
                            ))}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Anomaly Alerts */}
                  {overviewTrendData.anomalies.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          <span>Anomaly Detection</span>
                          <Badge variant="outline" className="text-xs">{overviewTrendData.anomalies.length} detected</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {overviewTrendData.anomalies.slice(0, 8).map((a: any, i: number) => {
                            const isSpike = a.value > a.expected;
                            return (
                              <div key={i} className={`p-3 rounded-lg border ${a.severity === 'critical' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' : 'border-orange-200 bg-orange-50 dark:bg-orange-900/20'}`}>
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-2">
                                    {isSpike ? <TrendingUp className="w-4 h-4 text-orange-600" /> : <TrendingDown className="w-4 h-4 text-blue-600" />}
                                    <span className="text-sm font-medium capitalize">{a.metric} {isSpike ? 'spike' : 'drop'}</span>
                                    <Badge variant={a.severity === 'critical' ? 'destructive' : 'outline'} className="text-xs">{a.severity}</Badge>
                                    <Badge variant="outline" className="text-xs">{a.label}</Badge>
                                  </div>
                                  <div className="text-sm text-muted-foreground/70">
                                    <span className="font-semibold">{a.metric === 'spend' || a.metric === 'cpa' ? fmtCur(a.value) : a.value.toLocaleString()}</span>
                                    <span className="text-xs ml-1">(expected ~{a.metric === 'spend' || a.metric === 'cpa' ? fmtCur(a.expected) : Math.round(a.expected).toLocaleString()})</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 2: EFFICIENCY METRICS ═══════════ */}
            <TabsContent value="efficiency" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {trendAnalysisLoading && !trendAnalysisFetched && !efficiencyTrendData ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="grid gap-4 md:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 bg-muted rounded" />)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !efficiencyTrendData || efficiencyTrendData.cards.length === 0 ? (
                <Card><CardContent className="p-8 text-center"><Activity className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><p className="text-muted-foreground/70">No connected source efficiency metrics available. Efficiency metrics appear only when the connected sources provide the required inputs.</p></CardContent></Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    {efficiencyTrendData.cards.map((card: any, i: number) => {
                      const isGood = card.invertColor ? Number(card.change) <= 0 : Number(card.change) >= 0;
                      return (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                            <div className="text-xl font-bold text-foreground">{card.value}</div>
                            {efficiencyTrendData.hasPrevious && card.change !== null && (
                              <div className={`flex items-center text-xs mt-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                                {card.change >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                                {card.change >= 0 ? '+' : ''}{card.change.toFixed(1)}%
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>

                  {!efficiencyTrendData.hasCompleteCurrentPeriod && (
                    <p className="text-sm text-muted-foreground">
                      Showing {efficiencyTrendData.currentPeriodDays} of {efficiencyTrendData.requestedPeriodDays} days available for this selection. Validate full-period efficiency trends after enough daily history exists.
                    </p>
                  )}

                  {/* ROAS & ROI Chart */}
                  {efficiencyTrendData.hasFinancialEfficiency ? (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><DollarSign className="w-5 h-5" /><span>ROAS & ROI Trend</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={efficiencyTrendData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis yAxisId="left" className="text-xs" label={{ value: 'ROAS (x)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: 'ROI (%)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name === 'ROAS' ? `${Number(v).toFixed(2)}x` : `${Number(v).toFixed(1)}%`, name]} />
                              {efficiencyTrendData.current.roas !== null && <Line yAxisId="left" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} dot={false} name="ROAS" />}
                              {efficiencyTrendData.current.roi !== null && <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#8b5cf6" strokeWidth={2} dot={false} name="ROI %" />}
                              {kpiTargets.roas && efficiencyTrendData.current.roas !== null && <ReferenceLine yAxisId="left" y={kpiTargets.roas / 100} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'ROAS Target', fill: '#10b981', fontSize: 10 }} />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground/70">ROAS and ROI require both spend and revenue from connected source data.</CardContent></Card>
                  )}

                  {/* CPA & CPC Chart */}
                  {efficiencyTrendData.hasCostEfficiency ? (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><Target className="w-5 h-5" /><span>Cost Efficiency Trend</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={efficiencyTrendData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [fmtCur(Number(v)), name]} />
                              {efficiencyTrendData.current.cpa !== null && <Line type="monotone" dataKey="cpa" stroke="#ef4444" strokeWidth={2} dot={false} name="CPA" />}
                              {efficiencyTrendData.current.cpc !== null && <Line type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC" />}
                              {efficiencyTrendData.current.cpm !== null && <Line type="monotone" dataKey="cpm" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CPM" />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground/70">CPA requires spend and conversions. CPC and CPM require paid-media clicks or impressions from a connected source.</CardContent></Card>
                  )}

                  {/* CTR & Engagement Rate Chart */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><BarChart3 className="w-5 h-5" /><span>Rate Efficiency Trend</span></CardTitle></CardHeader>
                    <CardContent>
                      {efficiencyTrendData.hasRateEfficiency ? (
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={efficiencyTrendData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [`${formatPct(Number(v))}`, name]} />
                              {efficiencyTrendData.current.ctr !== null && <Line type="monotone" dataKey="ctr" stroke="#3b82f6" strokeWidth={2} dot={false} name="CTR %" />}
                              {efficiencyTrendData.current.cvr !== null && <Line type="monotone" dataKey="cvr" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CVR %" />}
                              {efficiencyTrendData.current.engagementRate !== null && <Line type="monotone" dataKey="engagementRate" stroke="#10b981" strokeWidth={2} dot={false} name="Engagement Rate %" />}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground/70">Rate efficiency requires CTR, CVR, or engagement-rate inputs from connected source data.</p>
                      )}
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 3: CONVERSION FUNNEL ═══════════ */}
            <TabsContent value="funnel" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {trendAnalysisLoading && !trendAnalysisFetched && !conversionFunnelData ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="grid gap-4 md:grid-cols-4">
                        {[0, 1, 2, 3].map((item) => <div key={item} className="h-24 bg-muted rounded" />)}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : !conversionFunnelData || (!conversionFunnelData.webAvailable && !conversionFunnelData.paidAvailable) ? (
                <Card><CardContent className="p-8 text-center"><Layers className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><h3 className="text-lg font-semibold text-foreground mb-2">No Funnel Data</h3><p className="text-sm text-muted-foreground/70">No connected source provides funnel metrics for this selection.</p></CardContent></Card>
              ) : (
                <>
                  {conversionFunnelData.webAvailable && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><BarChart3 className="w-5 h-5" /><span>Web Analytics Funnel</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="grid gap-4 md:grid-cols-4 mb-6">
                        {[
                          { label: 'Sessions', value: conversionFunnelData.current.sessions === null ? null : fmtNum(conversionFunnelData.current.sessions) },
                          { label: 'Users', value: conversionFunnelData.current.users === null ? null : fmtNum(conversionFunnelData.current.users) },
                          { label: 'Conversions', value: conversionFunnelData.current.conversions === null ? null : fmtNum(conversionFunnelData.current.conversions) },
                          { label: 'Web CVR', value: conversionFunnelData.current.webCvr === null ? null : formatPct(conversionFunnelData.current.webCvr) },
                          { label: 'Engagement Rate', value: conversionFunnelData.current.engagementRate === null ? null : formatPct(conversionFunnelData.current.engagementRate) },
                        ].filter((card) => card.value !== null).map((card, i) => (
                          <Card key={i}><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1">{card.label}</div><div className="text-xl font-bold text-foreground">{card.value}</div></CardContent></Card>
                        ))}
                      </div>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={conversionFunnelData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" domain={[0, 100]} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name.includes('Rate') || name.includes('CVR') ? `${formatPct(Number(v))}` : Number(v).toLocaleString(), name]} />
                            {conversionFunnelData.current.users !== null && <Area yAxisId="left" type="monotone" dataKey="users" fill="#E37400" fillOpacity={0.1} stroke="#E37400" strokeWidth={1.5} name="Users" />}
                            {conversionFunnelData.current.sessions !== null && <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sessions" />}
                            {conversionFunnelData.current.conversions !== null && <Bar yAxisId="left" dataKey="conversions" fill="#10b981" fillOpacity={0.7} name="Conversions" />}
                            {conversionFunnelData.current.engagementRate !== null && <Line yAxisId="right" type="monotone" dataKey="engagementRate" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Engagement Rate %" />}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                    </Card>
                  )}

                  {conversionFunnelData.paidAvailable ? (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><Layers className="w-5 h-5" /><span>Paid-Media Funnel</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="grid gap-4 md:grid-cols-4 mb-6">
                          {[
                            { label: 'Impressions', value: conversionFunnelData.current.impressions === null ? null : fmtNum(conversionFunnelData.current.impressions) },
                            { label: 'Clicks', value: conversionFunnelData.current.clicks === null ? null : fmtNum(conversionFunnelData.current.clicks) },
                            { label: 'CTR', value: conversionFunnelData.current.ctr === null ? null : formatPct(conversionFunnelData.current.ctr) },
                            { label: 'Paid CVR', value: conversionFunnelData.current.paidCvr === null ? null : formatPct(conversionFunnelData.current.paidCvr) },
                            { label: 'CPA', value: conversionFunnelData.current.cpa === null ? null : fmtCur(conversionFunnelData.current.cpa) },
                          ].filter((card) => card.value !== null).map((card, i) => (
                            <Card key={i}><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1">{card.label}</div><div className="text-xl font-bold text-foreground">{card.value}</div></CardContent></Card>
                          ))}
                        </div>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={conversionFunnelData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis yAxisId="left" className="text-xs" />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name === 'Spend' ? fmtCur(Number(v)) : Number(v).toLocaleString(), name]} />
                              {conversionFunnelData.current.impressions !== null && <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={1.5} name="Impressions" />}
                              {conversionFunnelData.current.clicks !== null && <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={false} name="Clicks" />}
                              {conversionFunnelData.current.conversions !== null && <Bar yAxisId="left" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />}
                              {conversionFunnelData.current.spend !== null && <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#f59e0b" strokeWidth={2} dot={false} name="Spend" />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground/70">Paid-media funnel metrics require a connected paid-media source with impressions or clicks. GA4 web analytics are shown separately above.</CardContent></Card>
                  )}

                  {!conversionFunnelData.hasCompleteCurrentPeriod && (
                    <p className="text-sm text-muted-foreground">
                      Showing {conversionFunnelData.currentPeriodDays} of {conversionFunnelData.requestedPeriodDays} days available for this selection. Validate full-period funnel trends after enough daily history exists.
                    </p>
                  )}
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 4: PLATFORM BREAKDOWN ═══════════ */}
            <TabsContent value="platforms" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {trendAnalysisLoading && !trendAnalysisFetched && !platformBreakdownData ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="h-48 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ) : !platformBreakdownData || !platformBreakdownData.sources.length ? (
                <Card><CardContent className="p-8 text-center"><GitCompare className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><h3 className="text-lg font-semibold text-foreground mb-2">No Platform Data</h3><p className="text-sm text-muted-foreground/70">No connected source trend data is available for this selection.</p></CardContent></Card>
              ) : (
                <>
                  {/* Platform Comparison Table */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><GitCompare className="w-5 h-5" /><span>Platform Performance Comparison</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Platform</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Users</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Sessions</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Spend</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Impressions</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Clicks</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CTR</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Conversions</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Revenue</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CPA</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CPC</th>
                              <th className="text-left py-3 px-2 font-medium text-muted-foreground">Unavailable</th>
                            </tr>
                          </thead>
                          <tbody>
                            {platformBreakdownData.sources.map((p: any, i: number) => {
                              const bestCpa = Math.min(...platformBreakdownData.sources.filter((x: any) => x.cpa > 0).map((x: any) => x.cpa));
                              const bestCpc = Math.min(...platformBreakdownData.sources.filter((x: any) => x.cpc > 0).map((x: any) => x.cpc));
                              return (
                                <tr key={i} className="border-b border-slate-100">
                                  <td className="py-3 px-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                      <span className="font-medium text-foreground">{p.label}</span>
                                      <Badge variant="outline" className="capitalize">{p.category.replace("_", " ")}</Badge>
                                    </div>
                                  </td>
                                  <td className="text-right py-3 px-2">{p.users === null ? '—' : fmtNum(p.users)}</td>
                                  <td className="text-right py-3 px-2">{p.sessions === null ? '—' : fmtNum(p.sessions)}</td>
                                  <td className="text-right py-3 px-2">{p.spend === null ? '—' : fmtCur(p.spend)}</td>
                                  <td className="text-right py-3 px-2">{p.impressions === null ? '—' : fmtNum(p.impressions)}</td>
                                  <td className="text-right py-3 px-2">{p.clicks === null ? '—' : fmtNum(p.clicks)}</td>
                                  <td className="text-right py-3 px-2">{p.ctr === null ? '—' : formatPct(p.ctr)}</td>
                                  <td className="text-right py-3 px-2">{p.conversions === null ? '—' : fmtNum(p.conversions)}</td>
                                  <td className="text-right py-3 px-2">{p.revenue === null ? '—' : fmtCur(p.revenue)}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpa > 0 && p.cpa === bestCpa ? 'text-green-600 font-semibold' : ''}`}>{p.cpa > 0 ? fmtCur(p.cpa) : '—'}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpc > 0 && p.cpc === bestCpc ? 'text-green-600 font-semibold' : ''}`}>{p.cpc > 0 ? fmtCur(p.cpc) : '—'}</td>
                                  <td className="py-3 px-2 text-xs text-muted-foreground">{p.unavailable.length ? p.unavailable.join("; ") : "—"}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Spend Distribution Pie + Stacked Trends */}
                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Pie Chart */}
                    <Card>
                      <CardHeader><CardTitle>Spend Distribution</CardTitle></CardHeader>
                      <CardContent>
                        {platformBreakdownData.spendSources.length ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={platformBreakdownData.spendSources}
                                  dataKey="spend"
                                  nameKey="label"
                                  cx="50%" cy="50%"
                                  outerRadius={80}
                                  label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                                >
                                  {platformBreakdownData.spendSources.map((p: any, i: number) => (
                                    <Cell key={i} fill={p.color} />
                                  ))}
                                </Pie>
                                <Tooltip formatter={(v: any) => fmtCur(Number(v))} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground/70">No connected main source provides source-level spend for this selection.</p>
                        )}
                      </CardContent>
                    </Card>

                    {/* Efficiency Comparison */}
                    <Card>
                      <CardHeader><CardTitle>Efficiency Comparison</CardTitle></CardHeader>
                      <CardContent>
                        {platformBreakdownData.efficiencySources.length ? (
                          <div className="h-64">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={platformBreakdownData.efficiencySources} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                <XAxis type="number" className="text-xs" />
                                <YAxis dataKey="label" type="category" className="text-xs" width={100} />
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtCur(Number(v))} />
                                <Bar dataKey="cpa" fill="#ef4444" name="CPA" />
                                <Bar dataKey="cpc" fill="#f59e0b" name="CPC" />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground/70">CPA and CPC require source-level spend plus conversions or clicks from a connected main source.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Platform Trends Stacked Bar */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Platform Trends</CardTitle>
                        <Select value={platformBreakdownData.activeMetric} onValueChange={setPlatformMetric}>
                          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {platformBreakdownData.metricOptions.map((metricName: string) => (
                              <SelectItem key={metricName} value={metricName}>{metricName.charAt(0).toUpperCase() + metricName.slice(1)}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={platformBreakdownData.trendRows}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [platformBreakdownData.activeMetric === 'spend' || platformBreakdownData.activeMetric === 'revenue' ? fmtCur(Number(v)) : Number(v).toLocaleString(), name]} />
                            {platformBreakdownData.sources.map((source: any) => (
                              <Bar key={source.id} dataKey={`${source.id}_${platformBreakdownData.activeMetric}`} stackId="a" fill={source.color} name={source.label} />
                            ))}
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 5: INSIGHTS ═══════════ */}
            <TabsContent value="insights" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {trendAnalysisLoading && !trendAnalysisFetched ? (
                <Card>
                  <CardContent className="p-8">
                    <div className="space-y-4">
                      <div className="h-5 bg-muted rounded w-1/3" />
                      <div className="h-24 bg-muted rounded" />
                      <div className="h-24 bg-muted rounded" />
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <Target className="w-5 h-5" />
                      <span>Trend Performance Insights</span>
                    </CardTitle>
                    <p className="text-sm text-muted-foreground/70">
                      Executive recommendations based on connected-source trend data from the other Trend Analysis tabs.
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {trendInsights.map((insight, index) => {
                        const style = insight.type === "warning"
                          ? "border-l-orange-500 bg-orange-50 dark:bg-orange-900/20"
                          : insight.type === "success"
                            ? "border-l-green-500 bg-green-50 dark:bg-green-900/20"
                            : "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20";
                        const titleStyle = insight.type === "warning"
                          ? "text-orange-900 dark:text-orange-100"
                          : insight.type === "success"
                            ? "text-green-900 dark:text-green-100"
                            : "text-blue-900 dark:text-blue-100";
                        const bodyStyle = insight.type === "warning"
                          ? "text-orange-800 dark:text-orange-200"
                          : insight.type === "success"
                            ? "text-green-800 dark:text-green-200"
                            : "text-blue-800 dark:text-blue-200";
                        return (
                          <div key={index} className={`border-l-4 p-4 rounded-r-lg ${style}`}>
                            <h4 className={`font-semibold mb-1 ${titleStyle}`}>{insight.title}</h4>
                            <p className={`text-sm ${bodyStyle}`}>{insight.message}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
