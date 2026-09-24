import { useParams } from "wouter";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Calendar, Target, DollarSign, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, GitCompare } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatPct, normalizeRateToPercent } from "@shared/metric-math";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Area, BarChart, Bar, ComposedChart, PieChart, Pie, Cell,
  ReferenceLine, ReferenceDot,
} from "recharts";
import { format, subDays } from "date-fns";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState, useMemo } from "react";
import {
  detectTrendAnomalies,
  deriveExactCumulativeGA4Traffic,
  deriveTrendFinancialRatios,
  expandTrendRowsToCalendarWindow,
  filterTrendRowsToCalendarWindow,
  formatExactTrendCount,
  formatTrendComparison,
  resolveVerifiedTrendGA4DailyRows,
  resolveCompatibleTrendFinancialDaily,
  resolveTrendConsumerMode,
  resolveTrendComparisonDate,
} from "@/lib/trend-analysis-cumulative";

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
const fmtCur = (n: number, currency = "USD") => new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n);
const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : curr > 0 ? 100 : 0;
const sumArr = (arr: any[], key: string) => arr.reduce((s, r) => s + (r[key] || 0), 0);
const avgArr = (arr: any[], key: string) => arr.length > 0 ? sumArr(arr, key) / arr.length : 0;

const TREND_REFRESH_MS = 30000;
const TREND_GA4_DAILY_DAYS = 91;
const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const tooltipStyle = {
  backgroundColor: 'var(--background)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
};

const filterAggregateTrendWindow = (rows: any[], aggregate: any, days: number, previous = false) => {
  const endDate = String(aggregate?.endDate || "");
  return filterTrendRowsToCalendarWindow(rows, previous ? resolveTrendComparisonDate(endDate, days) : endDate, days, String(aggregate?.startDate || ""));
};

const expandAggregateTrendWindow = (rows: any[], aggregate: any, days: number) =>
  expandTrendRowsToCalendarWindow(rows, String(aggregate?.endDate || ""), days, String(aggregate?.startDate || ""));

// ─── Anomaly Detection ──────────────────────────────────────────────
// ─── Main Component ─────────────────────────────────────────────────
export default function TrendAnalysis() {
  const { id: campaignId } = useParams();

  // Page-level state
  const [perfPeriod, setPerfPeriod] = useState<string>("7d");
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(['spend', 'revenue', 'conversions']));
  const [platformMetric, setPlatformMetric] = useState<string>("spend");

  const perfDays = perfPeriod === '7d' ? 7 : perfPeriod === '14d' ? 14 : perfPeriod === '90d' ? 90 : 30;
  const trendDateRange = `${perfDays}days`;

  // ─── Data Queries (all fetched on load, not gated by tab) ────────
  const { data: campaign, isLoading: campaignLoading, error: campaignError } = useQuery({
    queryKey: ["/api/campaigns", campaignId],
    enabled: !!campaignId,
  });

  const { data: connectedPlatforms } = useQuery({
    queryKey: ["/api/campaigns", campaignId, "connected-platforms"],
    enabled: !!campaignId,
  });

  const { data: kpis = [], isFetched: trendKpisFetched } = useQuery<any[]>({
    queryKey: [`/api/platforms/google_analytics/kpis`, campaignId],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/platforms/google_analytics/kpis?campaignId=${encodeURIComponent(String(campaignId))}`);
      if (!response.ok) throw new Error("Failed to fetch GA4 KPIs");
      return response.json();
    },
  });

  const { data: trendGA4ConnectionsResponse, isFetched: trendGA4ConnectionsFetched, error: trendGA4ConnectionsError } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-connections", "performance-summary-read-only"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-connections?readOnly=1`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false) throw new Error(data?.error || "Failed to fetch GA4 connections");
      return data;
    },
  });
  const trendGA4Connections = Array.isArray(trendGA4ConnectionsResponse?.connections)
    ? trendGA4ConnectionsResponse.connections
    : [];
  const trendGA4PropertyId = String(
    (trendGA4Connections.find((connection: any) => connection?.isPrimary) || trendGA4Connections[0])?.propertyId || "",
  );

  const { data: ga4Daily, isFetched: trendGA4DailyFetched, error: trendGA4DailyError } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-daily", TREND_GA4_DAILY_DAYS, trendGA4PropertyId, "trend-read-only"],
    enabled: !!campaignId && !!trendGA4PropertyId,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/ga4-daily?days=${TREND_GA4_DAILY_DAYS}&propertyId=${encodeURIComponent(trendGA4PropertyId)}&readOnly=1`);
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data || data?.success === false || data?.validationReadOnly !== true
        || String(data?.propertyId || "") !== trendGA4PropertyId) {
        throw new Error(data?.error || "Failed to fetch cumulative GA4 Trend inputs");
      }
      return data;
    },
    staleTime: 0,
    refetchInterval: TREND_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { data: trendGA4Coverage, isFetching: trendGA4CoverageFetching, error: trendGA4CoverageError } = useQuery<any>({
    queryKey: ["/api/campaigns", campaignId, "ga4-insights-trends-coverage", "90days-provider", trendGA4PropertyId, ga4Daily?.dataThroughDate, ga4Daily?.lastCompletedRefreshAt],
    enabled: !!campaignId && !!trendGA4PropertyId && ga4Daily !== undefined,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/ga4-insights-trends-coverage?propertyId=${encodeURIComponent(trendGA4PropertyId)}&days=90`);
      const data = await response.json().catch(() => null);
      if (!response.ok || !data || data?.success === false) throw new Error(data?.error || "Failed to verify GA4 Trend daily history");
      return data;
    },
    staleTime: 0,
    refetchInterval: 30 * 60 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const { data: outcomeTotals, isFetched: outcomeTotalsFetched, error: outcomeTotalsError } = useQuery<any>({
    queryKey: [`/api/campaigns/${campaignId}/outcome-totals`, "90days", "live"],
    enabled: !!campaignId,
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/outcome-totals?dateRange=90days`, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok || !data?.performanceSummary) throw new Error(data?.error || "Failed to fetch cumulative Trend totals");
      return data;
    },
    staleTime: 0,
    refetchInterval: TREND_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  });

  const trendComparisonDate = resolveTrendComparisonDate(
    String(outcomeTotals?.performanceSummary?.currentValueWindow?.dataThroughDate || ""),
    perfDays,
  );
  const trendFinancialComparisonUrl = `/api/campaigns/${campaignId}/snapshots/comparison?type=last_week&snapshotType=financial_daily&comparisonDate=${trendComparisonDate}`;
  const { data: trendFinancialComparison, isFetched: trendFinancialComparisonFetched, error: trendFinancialComparisonError } = useQuery<any>({
    queryKey: [trendFinancialComparisonUrl, "trend-exact-financial"],
    enabled: !!campaignId && !!trendComparisonDate,
    queryFn: async () => {
      const response = await fetch(trendFinancialComparisonUrl, { credentials: "include" });
      const data = await response.json().catch(() => null);
      if (!response.ok || data?.comparisonDate !== trendComparisonDate) {
        throw new Error(data?.message || "Failed to fetch exact-date Trend financials");
      }
      return data;
    },
    staleTime: 0,
    refetchInterval: TREND_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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
      const end = new Date();
      end.setUTCDate(end.getUTCDate() - 1);
      const start = new Date(end);
      start.setUTCDate(start.getUTCDate() - (perfDays * 2 - 1));
      const resp = await fetch(`/api/campaigns/${campaignId}/daily-financials?start=${start.toISOString().slice(0, 10)}&end=${end.toISOString().slice(0, 10)}`);
      if (!resp.ok) return null;
      return resp.json().catch(() => null);
    },
  });

  const {
    data: trendAnalysisResponse,
    isLoading: trendAnalysisLoading,
    isPlaceholderData: isTrendAnalysisRefreshing,
    isFetched: trendAnalysisFetched,
    error: trendAnalysisError,
  } = useQuery({
    queryKey: [`/api/campaigns/${campaignId}/trend-analysis`, trendDateRange, perfDays],
    enabled: !!campaignId,
    queryFn: async () => {
      const resp = await fetch(`/api/campaigns/${campaignId}/trend-analysis?dateRange=${trendDateRange}&days=${perfDays * 2}`, {
        credentials: "include",
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok || !data) throw new Error(data?.error || "Failed to fetch Trend Analysis");
      return data;
    },
    staleTime: 0,
    refetchInterval: TREND_REFRESH_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
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

    const anomalies = detectTrendAnomalies(currentPeriod, ['spend', 'clicks', 'conversions', 'impressions', 'revenue', 'cpa', 'roas']);

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

  const responseTrendAggregate = (trendAnalysisResponse as any)?.trendAnalysis;
  const trendAggregate = responseTrendAggregate?.campaignId === campaignId
    && responseTrendAggregate?.dateRange === trendDateRange
    ? responseTrendAggregate
    : null;
  const performanceSummary = outcomeTotals?.performanceSummary;
  const trendConsumerMode = resolveTrendConsumerMode({
    outcomeTotalsFetched,
    performanceSummary,
    campaignId: String(campaignId || ""),
  });
  const currentValueWindow = performanceSummary?.currentValueWindow;
  const performanceMainSources = Array.isArray(performanceSummary?.sources)
    ? performanceSummary.sources.filter((source: any) => source?.connected === true && source?.category !== "financial")
    : [];
  const usesCumulativeGA4Consumer = trendConsumerMode === "cumulative_ga4";
  const selectedTrendStartDate = trendComparisonDate ? (() => {
    const date = new Date(`${trendComparisonDate}T00:00:00.000Z`);
    date.setUTCDate(date.getUTCDate() + 1);
    return date.toISOString().slice(0, 10);
  })() : "";
  const requestedAnomalyTrendStartDate = resolveTrendComparisonDate(selectedTrendStartDate, 7);
  const selectedTrendComparisonStartDate = resolveTrendComparisonDate(selectedTrendStartDate, perfDays);
  const coverageStartDate = String(trendGA4Coverage?.startDate || "");
  const anomalyTrendStartDate = ISO_DATE_PATTERN.test(requestedAnomalyTrendStartDate)
    && ISO_DATE_PATTERN.test(coverageStartDate) && coverageStartDate > requestedAnomalyTrendStartDate
    ? coverageStartDate
    : requestedAnomalyTrendStartDate;
  // Provider coverage verifies freshness; persisted daily facts remain the shared Overview/Trend display source.
  const verifiedTrendGA4DailyRows = usesCumulativeGA4Consumer && trendGA4Coverage && !trendGA4CoverageError ? resolveVerifiedTrendGA4DailyRows({
    dailyResponse: ga4Daily,
    coverageResponse: {
      ...trendGA4Coverage,
      providerDailyRows: trendGA4Coverage.dailyRows,
      providerZeroDates: trendGA4Coverage.zeroDates,
    },
    propertyId: trendGA4PropertyId,
    selectedStartDate: selectedTrendStartDate,
  }) : null;
  const verifiedTrendGA4ComparisonRows = usesCumulativeGA4Consumer && trendGA4Coverage && !trendGA4CoverageError ? resolveVerifiedTrendGA4DailyRows({
    dailyResponse: ga4Daily,
    coverageResponse: {
      ...trendGA4Coverage,
      providerDailyRows: trendGA4Coverage.dailyRows,
      providerZeroDates: trendGA4Coverage.zeroDates,
    },
    propertyId: trendGA4PropertyId,
    selectedStartDate: selectedTrendComparisonStartDate,
  }) : null;
  const verifiedTrendGA4AnomalyRows = usesCumulativeGA4Consumer && trendGA4Coverage && !trendGA4CoverageError ? resolveVerifiedTrendGA4DailyRows({
    dailyResponse: ga4Daily,
    coverageResponse: {
      ...trendGA4Coverage,
      providerDailyRows: trendGA4Coverage.dailyRows,
      providerZeroDates: trendGA4Coverage.zeroDates,
    },
    propertyId: trendGA4PropertyId,
    selectedStartDate: anomalyTrendStartDate,
  }) : null;
  const trendGA4DailyHistoryVerified = !usesCumulativeGA4Consumer || verifiedTrendGA4DailyRows !== null;
  const trendGA4DailyHistoryPending = usesCumulativeGA4Consumer && ga4Daily !== undefined
    && trendGA4CoverageFetching && !trendGA4Coverage;
  const ga4TrendSource = Array.isArray(trendAggregate?.sources)
    ? trendAggregate.sources.find((source: any) => source?.id === "ga4")
    : null;
  const cumulativeGA4CurrentCompatible = usesCumulativeGA4Consumer
    && performanceSummary?.campaignId === campaignId
    && performanceSummary?.version === "performance_summary_aggregate_v3"
    && currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && ISO_DATE_PATTERN.test(String(currentValueWindow?.startDate || ""))
    && ISO_DATE_PATTERN.test(String(currentValueWindow?.endDate || ""))
    && currentValueWindow.startDate <= currentValueWindow.endDate
    && currentValueWindow?.startDate === ga4Daily?.overviewStartDate
    && currentValueWindow?.endDate === ga4Daily?.dataThroughDate
    && currentValueWindow?.dataThroughDate === ga4Daily?.dataThroughDate
    && ga4Daily?.endDate === ga4Daily?.dataThroughDate
    && ga4Daily?.reportingTimeZone === currentValueWindow?.reportingTimeZone
    && Boolean(String(currentValueWindow?.reportingTimeZone || "").trim())
    && ga4Daily?.success === true
    && ga4Daily?.validationReadOnly === true
    && ga4Daily?.providerRefreshAttempted === false
    && ["read_only", "simulated"].includes(String(ga4Daily?.providerRefreshOutcome || ""))
    && !ga4Daily?.providerRefreshWarning
    && String(ga4Daily?.propertyId || "") === trendGA4PropertyId
    && (!ga4TrendSource?.freshness?.propertyId || String(ga4TrendSource.freshness.propertyId) === trendGA4PropertyId);
  const aggregateMetricValue = (metricName: string): number | null => {
    const metric = performanceSummary?.totals?.[metricName];
    if (metric?.value === null || typeof metric?.value === "undefined" || metric?.value === "") return null;
    const value = Number(metric?.value);
    const validValue = Number.isFinite(value) && (metricName === "roi" || value >= 0);
    return metric?.available === true && Array.isArray(metric?.sources) && metric.sources.length > 0 && validValue ? value : null;
  };
  const hasAuthoritativeHeadlineWindow = performanceSummary?.campaignId === campaignId
    && performanceSummary?.version === "performance_summary_aggregate_v3"
    && performanceMainSources.length > 0
    && currentValueWindow?.mode === "initial_import_to_latest_completed_day"
    && ISO_DATE_PATTERN.test(String(currentValueWindow?.startDate || ""))
    && ISO_DATE_PATTERN.test(String(currentValueWindow?.endDate || ""))
    && currentValueWindow.startDate <= currentValueWindow.endDate
    && currentValueWindow?.dataThroughDate === currentValueWindow?.endDate
    && Boolean(String(currentValueWindow?.reportingTimeZone || "").trim());
  const exactCumulativeTraffic = cumulativeGA4CurrentCompatible
    ? deriveExactCumulativeGA4Traffic(ga4Daily, trendComparisonDate)
    : null;
  const currentTraffic = exactCumulativeTraffic?.current || (() => {
    if (!cumulativeGA4CurrentCompatible) return null;
    const totals = ga4Daily?.overviewTotals || {};
    if ([totals.users, totals.sessions, totals.conversions, totals.engagedSessions]
      .some((value) => value === null || typeof value === "undefined" || value === "")) return null;
    const users = Number(totals.users);
    const sessions = Number(totals.sessions);
    const conversions = Number(totals.conversions);
    const engagedSessions = Number(totals.engagedSessions);
    if ([users, sessions, conversions, engagedSessions].some((value) => !Number.isFinite(value) || value < 0)) return null;
    return {
      users, sessions, conversions, engagedSessions,
      engagementRate: sessions > 0 ? (engagedSessions / sessions) * 100 : 0,
      cvr: sessions > 0 ? (conversions / sessions) * 100 : 0,
    };
  })();
  const exactTrafficComparison = exactCumulativeTraffic;
  const campaignCurrency = String((campaign as any)?.currency || "USD").trim().toUpperCase() || "USD";
  const fmtTrendCurrency = (value: number) => fmtCur(value, campaignCurrency);
  const fmtHeadlineCurrency = (value: number) => fmtCur(value, campaignCurrency);
  const compatibleFinancialDaily = resolveCompatibleTrendFinancialDaily({
    snapshot: trendFinancialComparison?.previous,
    campaignId: String(campaignId || ""),
    comparisonDate: trendComparisonDate,
    campaignCurrency,
    currentValueWindow,
  });
  const historicalFinancialValue = (metricName: "spend" | "revenue" | "conversions"): number | null => {
    const input = compatibleFinancialDaily?.inputs?.[metricName];
    if (input?.value === null || typeof input?.value === "undefined" || input?.value === "") return null;
    const value = Number(input?.value);
    return input?.available === true && Array.isArray(input?.sources) && input.sources.length > 0
      && Number.isFinite(value) && value >= 0 ? value : null;
  };
  const currentRevenue = aggregateMetricValue("revenue");
  const currentSpend = aggregateMetricValue("spend");
  const currentFinancialRatios = deriveTrendFinancialRatios({
    spend: currentSpend,
    revenue: currentRevenue,
    conversions: currentTraffic?.conversions ?? null,
  });
  const financialDecisionContext = outcomeTotals?.financialDecisionContext;
  const executiveROASDecisionReady = hasAuthoritativeHeadlineWindow
    && currentRevenue !== null
    && currentSpend !== null
    && currentSpend > 0
    && financialDecisionContext?.version === "financial_decision_context_v1"
    && financialDecisionContext?.status === "ready"
    && financialDecisionContext?.campaignId === campaignId
    && financialDecisionContext?.currency === campaignCurrency
    && financialDecisionContext?.dataThroughDate === currentValueWindow?.endDate
    && financialDecisionContext?.revenueModel === "ga4_campaign_to_date_plus_imported_source_to_date"
    && financialDecisionContext?.spendModel === "source_to_date"
    && Math.abs(Number(financialDecisionContext?.roas) - (currentRevenue / currentSpend)) < 0.005
    && (["revenue", "spend"] as const).every((metricName) => {
      const inputs = outcomeTotals?.financialInputs?.[metricName];
      const expectedTotal = metricName === "revenue" ? currentRevenue : currentSpend;
      return Array.isArray(inputs) && inputs.length > 0
        && Math.abs(inputs.reduce((sum: number, input: any) => sum + Number(input?.value || 0), 0) - expectedTotal) < 0.005
        && inputs.every((input: any) => {
          const expectedScope = metricName === "revenue" && input?.id === "ga4_native_revenue"
            ? "campaign_to_date"
            : "source_to_date";
          return input?.campaignId === campaignId
            && input?.scopeMode === expectedScope
            && ISO_DATE_PATTERN.test(String(input?.startDate || ""))
            && input.startDate <= currentValueWindow?.endDate
            && input?.endDate === currentValueWindow?.endDate
            && String(input?.currency || "").trim().toUpperCase() === campaignCurrency
            && input?.currencyVerified === true
            && Number.isFinite(Number(input?.value));
        });
    });
  const authoritativeTrendCurrent = cumulativeGA4CurrentCompatible && currentTraffic ? {
    users: currentTraffic.users,
    sessions: currentTraffic.sessions,
    engagedSessions: currentTraffic.engagedSessions,
    conversions: currentTraffic.conversions,
    engagementRate: currentTraffic.engagementRate,
    cvr: currentTraffic.cvr,
    revenue: currentRevenue,
    spend: currentSpend,
    roas: currentFinancialRatios.roas,
    roi: currentFinancialRatios.roi,
    cpa: currentFinancialRatios.cpa,
    impressions: aggregateMetricValue("impressions"),
    clicks: aggregateMetricValue("clicks"),
    ctr: aggregateMetricValue("ctr"),
    cpc: aggregateMetricValue("cpc"),
    cpm: aggregateMetricValue("cpm"),
  } : null;
  const authoritativeHeadlineCurrent = hasAuthoritativeHeadlineWindow ? {
    revenue: aggregateMetricValue("revenue"),
    spend: aggregateMetricValue("spend"),
    roas: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.roas ?? null : aggregateMetricValue("roas"),
    roi: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.roi ?? null : aggregateMetricValue("roi"),
    conversions: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.conversions ?? null : aggregateMetricValue("conversions"),
    cpa: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.cpa ?? null : aggregateMetricValue("cpa"),
    cpc: aggregateMetricValue("cpc"),
    cpm: aggregateMetricValue("cpm"),
    sessions: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.sessions ?? null : aggregateMetricValue("sessions"),
    users: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.users ?? null : aggregateMetricValue("users"),
    cvr: usesCumulativeGA4Consumer ? authoritativeTrendCurrent?.cvr ?? null : aggregateMetricValue("cvr"),
    engagementRate: authoritativeTrendCurrent?.engagementRate ?? null,
    ctr: aggregateMetricValue("ctr"),
  } : null;
  const historicalSpend = historicalFinancialValue("spend");
  const historicalRevenue = historicalFinancialValue("revenue");
  const historicalFinancialRatios = deriveTrendFinancialRatios({
    spend: historicalSpend,
    revenue: historicalRevenue,
    conversions: exactTrafficComparison?.previous.conversions ?? null,
  });
  const authoritativeTrendPrevious = exactTrafficComparison || compatibleFinancialDaily ? {
    users: exactTrafficComparison?.previous.users ?? null,
    sessions: exactTrafficComparison?.previous.sessions ?? null,
    engagedSessions: exactTrafficComparison?.previous.engagedSessions ?? null,
    conversions: exactTrafficComparison?.previous.conversions ?? null,
    engagementRate: exactTrafficComparison?.previous.engagementRate ?? null,
    cvr: exactTrafficComparison?.previous.cvr ?? null,
    revenue: historicalRevenue,
    spend: historicalSpend,
    roas: historicalFinancialRatios.roas,
    roi: historicalFinancialRatios.roi,
    cpa: historicalFinancialRatios.cpa,
    impressions: null,
    clicks: null,
    ctr: null,
    cpc: null,
    cpm: null,
  } : null;

  const overviewTrendData = useMemo<any>(() => {
    if (trendConsumerMode === "pending" || trendConsumerMode === "unavailable") return null;
    const aggregate = trendAggregate;
    const rows = usesCumulativeGA4Consumer && verifiedTrendGA4DailyRows
      ? verifiedTrendGA4DailyRows.map((row: any) => ({
        date: row.date,
        metrics: {
          users: row.users,
          sessions: row.sessions,
          conversions: row.conversions,
          engagementRate: row.engagementRate,
        },
      }))
      : Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    const anomalyRows = usesCumulativeGA4Consumer
      ? (verifiedTrendGA4AnomalyRows ? verifiedTrendGA4AnomalyRows.map((row: any) => ({
        date: row.date,
        metrics: {
          users: row.users,
          sessions: row.sessions,
          conversions: row.conversions,
          engagementRate: row.engagementRate,
        },
      })) : [])
      : rows;
    if (rows.length === 0 && !authoritativeTrendCurrent) return null;

    const sourcesFor = (metricName: string): string[] => {
      const sources = aggregate?.metrics?.[metricName]?.sources;
      return Array.isArray(sources) ? sources.map(String) : [];
    };
    const hasMetric = (metricName: string) => usesCumulativeGA4Consumer
      ? ["users", "sessions", "conversions"].includes(metricName)
        && authoritativeTrendCurrent?.[metricName as "users" | "sessions" | "conversions"] != null
      : sourcesFor(metricName).length > 0;
    const hasEngagementRate = Array.isArray(aggregate?.sources)
      && aggregate.sources.some((source: any) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes("engagementRate"));

    const mapSeries = (sourceRows: any[]) => sourceRows.map((row: any) => {
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
    const series: any[] = mapSeries(rows);
    const comparisonSeries: any[] = usesCumulativeGA4Consumer && verifiedTrendGA4ComparisonRows
      ? mapSeries(verifiedTrendGA4ComparisonRows.map((row: any) => ({
        date: row.date,
        metrics: { users: row.users, sessions: row.sessions, conversions: row.conversions },
      })))
      : series;
    const anomalySeries: any[] = usesCumulativeGA4Consumer ? mapSeries(anomalyRows) : series;

    const currentPeriod = usesCumulativeGA4Consumer
      ? filterTrendRowsToCalendarWindow(series, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
      : filterAggregateTrendWindow(series, aggregate, perfDays);
    const chartSeries = currentPeriod.length > 0
      ? (usesCumulativeGA4Consumer
        ? expandTrendRowsToCalendarWindow(series, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
        : expandAggregateTrendWindow(series, aggregate, perfDays)).map((row) => ({
        spend: null, revenue: null, conversions: null, impressions: null, clicks: null, users: null, sessions: null,
        ...row,
        label: format(new Date(`${row.date}T00:00:00`), 'MMM dd'),
      }))
      : currentPeriod;
    const previousPeriod = usesCumulativeGA4Consumer
      ? (String(currentValueWindow?.startDate || "") <= selectedTrendComparisonStartDate
        ? comparisonSeries.filter((row: any) => row.date >= selectedTrendComparisonStartDate && row.date <= trendComparisonDate)
        : [])
      : filterAggregateTrendWindow(series, aggregate, perfDays, true);
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

    const current = usesCumulativeGA4Consumer ? authoritativeTrendCurrent : buildSummary(currentPeriod);
    const previous = usesCumulativeGA4Consumer ? authoritativeTrendPrevious : buildSummary(previousPeriod);
    if (!current) return null;
    const likeForLikeTrafficComparison = usesCumulativeGA4Consumer
      && currentPeriod.length === perfDays && previousPeriod.length === perfDays
      ? {
        currentStartDate: String(currentPeriod[0]?.date || ""),
        currentEndDate: String(currentPeriod.at(-1)?.date || ""),
        previousStartDate: String(previousPeriod[0]?.date || ""),
        previousEndDate: String(previousPeriod.at(-1)?.date || ""),
        currentSessions: sum(currentPeriod, "sessions"),
        previousSessions: sum(previousPeriod, "sessions"),
        currentConversions: sum(currentPeriod, "conversions"),
        previousConversions: sum(previousPeriod, "conversions"),
      }
      : null;
    const comparison = Object.fromEntries(
      Object.keys(current).map((key) => {
        const currentValue = (current as any)[key];
        const previousValue = (previous as any)?.[key];
        return [key, Number.isFinite(currentValue) && Number.isFinite(previousValue)
          && (!usesCumulativeGA4Consumer || Number(previousValue) > 0)
          ? pctChange(Number(currentValue), Number(previousValue))
          : null];
      }),
    );
    const availableSeries = [
      { key: "spend", label: "Spend", color: "#f59e0b", available: !usesCumulativeGA4Consumer && hasMetric("spend") },
      { key: "revenue", label: "Revenue", color: "#10b981", available: !usesCumulativeGA4Consumer && hasMetric("revenue") },
      { key: "conversions", label: "Conversions", color: "#8b5cf6", available: hasMetric("conversions") },
      { key: "impressions", label: "Impressions", color: "#3b82f6", available: hasMetric("impressions") },
      { key: "clicks", label: "Clicks", color: "#06b6d4", available: hasMetric("clicks") },
      { key: "users", label: "Users", color: "#E37400", available: hasMetric("users") },
      { key: "sessions", label: "Sessions", color: "#ec4899", available: hasMetric("sessions") },
    ].filter((item) => item.available);
    const anomalyKeys = availableSeries.map((item) => item.key).filter((key) => ["spend", "clicks", "conversions", "impressions", "revenue"].includes(key));
    const currentPeriodDates = new Set(currentPeriod.map((row: any) => String(row?.date || "")));

    return {
      series: chartSeries,
      current,
      previous,
      comparison,
      availableSeries,
      anomalies: detectTrendAnomalies(anomalySeries, anomalyKeys).filter((anomaly) => currentPeriodDates.has(anomaly.date)),
      hasPrevious: Object.values(comparison).some((value) => typeof value === "number"),
      hasCompleteCurrentPeriod: usesCumulativeGA4Consumer ? Boolean(authoritativeTrendCurrent) : currentPeriod.length >= perfDays,
      currentValuesUnavailable: usesCumulativeGA4Consumer && !authoritativeTrendCurrent,
      exactComparisonDate: usesCumulativeGA4Consumer ? trendComparisonDate : null,
      currentPeriodDays: currentPeriod.length,
      chartCalendarDays: chartSeries.length,
      previousPeriodDays: previousPeriod.length,
      likeForLikeTrafficComparison,
      requestedPeriodDays: perfDays,
      connectedSources: Array.isArray(aggregate?.sources) && aggregate.sources.length > 0
        ? aggregate.sources.map((source: any) => String(source?.label || source?.id)).filter(Boolean)
        : performanceMainSources.map((source: any) => String(source?.label || source?.id)).filter(Boolean),
    };
  }, [trendAggregate, perfDays, trendConsumerMode, usesCumulativeGA4Consumer, verifiedTrendGA4DailyRows, verifiedTrendGA4ComparisonRows, verifiedTrendGA4AnomalyRows, authoritativeTrendCurrent, authoritativeTrendPrevious, trendComparisonDate, selectedTrendComparisonStartDate, performanceMainSources]);

  const overviewVisibleSeries = useMemo(() => {
    const keys = (overviewTrendData?.availableSeries || []).map((item: any) => item.key);
    const hasInitialSelection = visibleSeries.size === 3
      && ["spend", "revenue", "conversions"].every((key) => visibleSeries.has(key));
    if (hasInitialSelection) {
      const preferred = usesCumulativeGA4Consumer
        ? ["users", "sessions", "conversions"]
        : ["spend", "revenue", "conversions"];
      return new Set(preferred.filter((key) => keys.includes(key)));
    }
    const selected = new Set(Array.from(visibleSeries).filter((key) => keys.includes(key)));
    if (selected.size > 0) return selected;
    return new Set(keys.slice(0, 3));
  }, [visibleSeries, overviewTrendData, usesCumulativeGA4Consumer]);

  const efficiencyTrendData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const rows = usesCumulativeGA4Consumer && Array.isArray(verifiedTrendGA4DailyRows)
      ? verifiedTrendGA4DailyRows.map((row: any) => ({
        date: row.date,
        metrics: {
          users: row.users,
          sessions: row.sessions,
          conversions: row.conversions,
          cvr: Number(row.sessions) > 0 ? (Number(row.conversions) / Number(row.sessions)) * 100 : null,
          engagementRate: row.engagementRate,
        },
      }))
      : Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    if (rows.length === 0 && !authoritativeTrendCurrent) return null;

    const toMetric = (value: any) => {
      if (value === null || typeof value === "undefined") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const ga4DailyRowsByDate = new Map<string, any>(
      (usesCumulativeGA4Consumer && Array.isArray(ga4Daily?.data) ? ga4Daily.data : [])
        .map((row: any) => [String(row?.date || "").slice(0, 10), row]),
    );
    const verifiedNoActivityDates = new Set<string>(
      (usesCumulativeGA4Consumer && Array.isArray(verifiedTrendGA4DailyRows) ? verifiedTrendGA4DailyRows : [])
        .filter((row: any) => Number(row?.sessions) === 0 && Number(row?.conversions) === 0 && Number(row?.users) === 0)
        .map((row: any) => String(row?.date || "").slice(0, 10)),
    );

    const series = rows.map((row: any) => {
      const date = String(row?.date || "").slice(0, 10);
      const metrics = row?.metrics || {};
      const engagementRate = toMetric(metrics.engagementRate);
      const ga4DailyRow = ga4DailyRowsByDate.get(date);
      const ga4DailyRowMatches = ga4DailyRow
        && Number(ga4DailyRow.sessions) === Number(metrics.sessions || 0)
        && Number(ga4DailyRow.conversions) === Number(metrics.conversions || 0)
        && engagementRate !== null
        && Math.abs(normalizeRateToPercent(Number(ga4DailyRow.engagementRate)) - normalizeRateToPercent(engagementRate)) < 0.01;
      return {
        date,
        label: format(new Date(`${date}T00:00:00`), 'MMM dd'),
        spend: Number(metrics.spend || 0),
        revenue: Number(metrics.revenue || 0),
        conversions: Number(metrics.conversions || 0),
        clicks: Number(metrics.clicks || 0),
        impressions: Number(metrics.impressions || 0),
        sessions: Number(metrics.sessions || 0),
        engagedSessions: ga4DailyRowMatches ? toMetric(ga4DailyRow.engagedSessions) : null,
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

    const currentPeriod = usesCumulativeGA4Consumer
      ? filterTrendRowsToCalendarWindow(series, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
      : filterAggregateTrendWindow(series, aggregate, perfDays);
    const efficiencyChartSeries = currentPeriod.length > 0
      ? (usesCumulativeGA4Consumer
        ? expandTrendRowsToCalendarWindow(series, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
        : expandAggregateTrendWindow(series, aggregate, perfDays)).map((row) => {
        const noActivity = verifiedNoActivityDates.has(String(row.date || ""));
        return {
          roas: null, roi: null, cpa: null, cpc: null, cpm: null, ctr: null,
          ...row,
          sessions: noActivity ? 0 : row.sessions,
          conversions: noActivity ? 0 : row.conversions,
          engagedSessions: noActivity ? 0 : row.engagedSessions,
          cvr: noActivity ? null : row.cvr,
          engagementRate: noActivity ? null : row.engagementRate,
          noActivity: noActivity ? 0 : null,
          label: format(new Date(`${row.date}T00:00:00`), 'MMM dd'),
        };
      })
      : currentPeriod;
    const previousPeriod = usesCumulativeGA4Consumer
      ? series.slice(-perfDays * 2, -perfDays)
      : filterAggregateTrendWindow(series, aggregate, perfDays, true);
    const sum = (items: any[], key: string) => items.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    const avg = (items: any[], key: string) => {
      const values = items.map((row) => row[key]).filter((value) => value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)));
      return values.length > 0 ? values.reduce((total, value) => total + Number(value), 0) / values.length : null;
    };
    const compatibleRows = (items: any[], key: string) => items.filter((row) =>
      row[key] !== null && typeof row[key] !== "undefined" && Number.isFinite(Number(row[key])),
    );
    const buildSummary = (items: any[]) => {
      const roasRows = compatibleRows(items, "roas");
      const roiRows = compatibleRows(items, "roi");
      const cpaRows = compatibleRows(items, "cpa");
      const cpcRows = compatibleRows(items, "cpc");
      const cpmRows = compatibleRows(items, "cpm");
      const ctrRows = compatibleRows(items, "ctr");
      const cvrRows = compatibleRows(items, "cvr");
      const roasSpend = sum(roasRows, "spend");
      const roiSpend = sum(roiRows, "spend");
      const cvrConversions = sum(cvrRows, "conversions");
      const cvrClicks = sum(cvrRows, "clicks");
      const cvrSessions = sum(cvrRows, "sessions");
      return {
        roas: roasRows.length > 0 && roasSpend > 0 ? sum(roasRows, "revenue") / roasSpend : null,
        roi: roiRows.length > 0 && roiSpend > 0 ? ((sum(roiRows, "revenue") - roiSpend) / roiSpend) * 100 : null,
        cpa: cpaRows.length > 0 && sum(cpaRows, "conversions") > 0 ? sum(cpaRows, "spend") / sum(cpaRows, "conversions") : null,
        cpc: cpcRows.length > 0 && sum(cpcRows, "clicks") > 0 ? sum(cpcRows, "spend") / sum(cpcRows, "clicks") : null,
        cpm: cpmRows.length > 0 && sum(cpmRows, "impressions") > 0 ? (sum(cpmRows, "spend") / sum(cpmRows, "impressions")) * 1000 : null,
        ctr: ctrRows.length > 0 && sum(ctrRows, "impressions") > 0 ? (sum(ctrRows, "clicks") / sum(ctrRows, "impressions")) * 100 : null,
        cvr: cvrRows.length > 0
          ? cvrClicks > 0
            ? (cvrConversions / cvrClicks) * 100
            : cvrSessions > 0
              ? (cvrConversions / cvrSessions) * 100
              : null
          : null,
        engagementRate: avg(items, "engagementRate"),
      };
    };

    const current = usesCumulativeGA4Consumer ? authoritativeTrendCurrent : buildSummary(currentPeriod);
    const previous = usesCumulativeGA4Consumer ? authoritativeTrendPrevious : buildSummary(previousPeriod);
    if (!current) return null;
    const compare = (key: string) => {
      const curr = (current as any)[key];
      const prev = (previous as any)?.[key];
      return Number.isFinite(curr) && Number.isFinite(prev)
        && (!usesCumulativeGA4Consumer || Number(prev) > 0)
        ? pctChange(Number(curr), Number(prev))
        : null;
    };
    const hasValue = (key: string) => usesCumulativeGA4Consumer
      ? current[key as keyof typeof current] !== null
      : current[key as keyof typeof current] !== null || currentPeriod.some((row: any) => row[key] !== null && typeof row[key] !== "undefined");
    const cards = [
      { key: "roas", label: "ROAS", value: current.roas === null ? null : `${current.roas.toFixed(1)}x`, change: compare("roas") },
      { key: "roi", label: "ROI", value: current.roi === null ? null : formatPct(current.roi), change: compare("roi") },
      { key: "cpa", label: "CPA", value: current.cpa === null ? null : fmtTrendCurrency(current.cpa), change: compare("cpa"), invertColor: true },
      { key: "cvr", label: "CVR", value: current.cvr === null ? null : formatPct(current.cvr), change: compare("cvr") },
      { key: "engagementRate", label: "Engagement Rate", value: current.engagementRate === null ? null : formatPct(current.engagementRate), change: compare("engagementRate") },
      { key: "cpc", label: "CPC", value: current.cpc === null ? null : fmtTrendCurrency(current.cpc), change: compare("cpc"), invertColor: true },
      { key: "cpm", label: "CPM", value: current.cpm === null ? null : fmtTrendCurrency(current.cpm), change: compare("cpm"), invertColor: true },
      { key: "ctr", label: "CTR", value: current.ctr === null ? null : formatPct(current.ctr), change: compare("ctr") },
    ].filter((card) => hasValue(card.key) && card.value !== null);

    return {
      series: efficiencyChartSeries,
      current,
      cards,
      hasPrevious: cards.some((card) => typeof card.change === "number"),
      hasCompleteCurrentPeriod: usesCumulativeGA4Consumer ? Boolean(authoritativeTrendCurrent) : currentPeriod.length >= perfDays,
      exactComparisonDate: usesCumulativeGA4Consumer ? trendComparisonDate : null,
      currentPeriodDays: currentPeriod.length,
      requestedPeriodDays: perfDays,
      hasFinancialEfficiency: !usesCumulativeGA4Consumer && (hasValue("roas") || hasValue("roi")),
      hasCostEfficiency: !usesCumulativeGA4Consumer && (hasValue("cpa") || hasValue("cpc") || hasValue("cpm")),
      hasRateEfficiency: hasValue("ctr") || hasValue("cvr") || hasValue("engagementRate"),
    };
  }, [trendAggregate, ga4Daily, verifiedTrendGA4DailyRows, perfDays, usesCumulativeGA4Consumer, authoritativeTrendCurrent, authoritativeTrendPrevious, trendComparisonDate, campaignCurrency]);

  const conversionFunnelData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const rows = Array.isArray(aggregate?.dailyTotals) ? aggregate.dailyTotals : [];
    if (rows.length === 0 && !authoritativeTrendCurrent) return null;

    const webSources = Array.isArray(aggregate?.sources)
      ? aggregate.sources.filter((source: any) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes("sessions"))
      : [];
    const hasEngagementRate = webSources.some((source: any) => source.includedMetrics.includes("engagementRate"));
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
    const currentPeriod = usesCumulativeGA4Consumer
      ? filterTrendRowsToCalendarWindow(series, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
      : filterAggregateTrendWindow(series, aggregate, perfDays);
    const avg = (key: string) => {
      const values = currentPeriod.map((row: any) => row[key]).filter((value: any) => value !== null && typeof value !== "undefined" && Number.isFinite(Number(value)));
      return values.length > 0 ? values.reduce((total: number, value: any) => total + Number(value), 0) / values.length : null;
    };
    const webMetricTotal = (metricName: string): number | null => {
      const compatibleSources = webSources.filter((source: any) => source.includedMetrics.includes(metricName));
      if (compatibleSources.length === 0) return null;
      return compatibleSources.reduce((total: number, source: any) => total + filterAggregateTrendWindow(
        Array.isArray(source?.dailyRows) ? source.dailyRows : [], aggregate, perfDays,
      ).reduce((sourceTotal: number, row: any) => sourceTotal + (Number(row?.metrics?.[metricName]) || 0), 0), 0);
    };
    const sessions = webMetricTotal("sessions");
    const users = webMetricTotal("users");
    const conversions = webMetricTotal("conversions");
    const paidSources = Array.isArray(aggregate?.sources)
      ? aggregate.sources.filter((source: any) => source?.category === "paid_media")
      : [];
    const paidMetricTotal = (metricName: string): number | null => {
      const compatibleSources = paidSources.filter((source: any) => Array.isArray(source?.includedMetrics) && source.includedMetrics.includes(metricName));
      if (compatibleSources.length === 0) return null;
      return compatibleSources.reduce((total: number, source: any) => total + filterAggregateTrendWindow(
        Array.isArray(source?.dailyRows) ? source.dailyRows : [], aggregate, perfDays,
      ).reduce((sourceTotal: number, row: any) => sourceTotal + (Number(row?.metrics?.[metricName]) || 0), 0), 0);
    };
    const impressions = paidMetricTotal("impressions");
    const clicks = paidMetricTotal("clicks");
    const paidConversions = paidMetricTotal("conversions");
    const spend = paidMetricTotal("spend");

    const rollingCurrent = {
        sessions,
        users,
        engagedSessions: null,
        conversions,
        webCvr: conversions !== null && sessions && sessions > 0 ? (conversions / sessions) * 100 : null,
        engagementRate: hasEngagementRate ? avg("engagementRate") : null,
        impressions,
        clicks,
        paidConversions,
        spend,
        ctr: impressions && impressions > 0 && clicks !== null ? (clicks / impressions) * 100 : null,
        paidCvr: clicks && clicks > 0 && paidConversions !== null ? (paidConversions / clicks) * 100 : null,
        cpa: spend && spend > 0 && paidConversions ? spend / paidConversions : null,
        cpc: spend && spend > 0 && clicks ? spend / clicks : null,
        cpm: spend && spend > 0 && impressions ? (spend / impressions) * 1000 : null,
        roas: avg("roas"),
    };
    const current = usesCumulativeGA4Consumer && authoritativeTrendCurrent ? {
      sessions: authoritativeTrendCurrent.sessions,
      users: authoritativeTrendCurrent.users,
      engagedSessions: authoritativeTrendCurrent.engagedSessions,
      conversions: authoritativeTrendCurrent.conversions,
      webCvr: authoritativeTrendCurrent.cvr,
      engagementRate: authoritativeTrendCurrent.engagementRate,
      impressions: null,
      clicks: null,
      paidConversions: null,
      spend: null,
      ctr: null,
      paidCvr: null,
      cpa: null,
      cpc: null,
      cpm: null,
      roas: null,
    } : rollingCurrent;

    return {
      series: currentPeriod,
      current,
      webAvailable: usesCumulativeGA4Consumer ? Boolean(authoritativeTrendCurrent) : webSources.length > 0,
      paidAvailable: usesCumulativeGA4Consumer ? false : paidSources.some((source: any) => Array.isArray(source?.includedMetrics) && (source.includedMetrics.includes("impressions") || source.includedMetrics.includes("clicks"))),
      hasCompleteCurrentPeriod: usesCumulativeGA4Consumer ? Boolean(authoritativeTrendCurrent) : currentPeriod.length >= perfDays,
      currentPeriodDays: currentPeriod.length,
      requestedPeriodDays: perfDays,
    };
  }, [trendAggregate, perfDays, usesCumulativeGA4Consumer, authoritativeTrendCurrent]);

  const platformBreakdownData = useMemo<any>(() => {
    const aggregate = trendAggregate;
    const sources = Array.isArray(aggregate?.sources) ? aggregate.sources : [];
    if (usesCumulativeGA4Consumer && !authoritativeTrendCurrent) return null;
    if (sources.length === 0 && !authoritativeTrendCurrent) return null;

    const toMetric = (value: any) => {
      if (value === null || typeof value === "undefined") return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    };
    const rollingSourceRows = sources.map((source: any, index: number) => {
      const includedMetrics = Array.isArray(source?.includedMetrics) ? source.includedMetrics.map(String) : [];
      const excludedMetrics = Array.isArray(source?.excludedMetrics) ? source.excludedMetrics : [];
      const dailyRows = Array.isArray(source?.dailyRows) ? source.dailyRows : [];
      const currentRows = usesCumulativeGA4Consumer
        ? filterTrendRowsToCalendarWindow(dailyRows, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
        : filterAggregateTrendWindow(dailyRows, aggregate, perfDays);
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
    const sourceRows = usesCumulativeGA4Consumer && authoritativeTrendCurrent ? [{
      id: "ga4",
      label: "Google Analytics",
      category: "web_analytics",
      color: PLATFORM_COLORS.ga4,
      users: authoritativeTrendCurrent.users,
      sessions: authoritativeTrendCurrent.sessions,
      impressions: null,
      clicks: null,
      spend: null,
      conversions: authoritativeTrendCurrent.conversions,
      revenue: null,
      ctr: null,
      cpc: null,
      cpa: null,
      roas: null,
      includedMetrics: ["users", "sessions", "conversions", "engagementRate"],
      unavailable: ["spend: no compatible source-level daily series", "revenue: no compatible source-level daily series", "impressions: GA4 is not an ad-impression source"],
    }] : rollingSourceRows;

    const metricOptions = ["spend", "clicks", "conversions", "impressions", "sessions", "users", "revenue"]
      .filter((metricName) => sourceRows.some((source: any) => source[metricName] !== null));
    const activeMetric = metricOptions.includes(platformMetric) ? platformMetric : metricOptions[0] || "conversions";

    const trendRowsByDate = new Map<string, any>();
    for (const source of sources) {
      const sourceId = String(source?.id || "");
      const sourceDailyRows = Array.isArray(source?.dailyRows) ? source.dailyRows : [];
      const dailyRows = usesCumulativeGA4Consumer
        ? filterTrendRowsToCalendarWindow(sourceDailyRows, String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
        : filterAggregateTrendWindow(sourceDailyRows, aggregate, perfDays);
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

    const sourceTrendRows = Array.from(trendRowsByDate.values())
      .sort((a: any, b: any) => String(a.date).localeCompare(String(b.date)));
    const chartTrendRows = !usesCumulativeGA4Consumer && sourceTrendRows.length > 0
      ? expandAggregateTrendWindow(sourceTrendRows, aggregate, perfDays)
        .map((row) => ({ ...row, label: format(new Date(`${row.date}T00:00:00`), 'MMM dd') }))
      : sourceTrendRows;

    return {
      sources: sourceRows,
      trendRows: chartTrendRows,
      metricOptions,
      activeMetric,
      spendSources: sourceRows.filter((source: any) => source.spend !== null && source.spend > 0),
      efficiencySources: sourceRows.filter((source: any) => (source.cpa !== null && source.cpa > 0) || (source.cpc !== null && source.cpc > 0)),
    };
  }, [trendAggregate, perfDays, platformMetric, usesCumulativeGA4Consumer, authoritativeTrendCurrent]);

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

    if (usesCumulativeGA4Consumer && overviewTrendData?.likeForLikeTrafficComparison) {
      const comparison = overviewTrendData.likeForLikeTrafficComparison;
      const currentRate = comparison.currentSessions > 0
        ? (comparison.currentConversions / comparison.currentSessions) * 100
        : null;
      const previousRate = comparison.previousSessions > 0
        ? (comparison.previousConversions / comparison.previousSessions) * 100
        : null;
      const currentRange = `${format(new Date(`${comparison.currentStartDate}T00:00:00`), "MMM d")}–${format(new Date(`${comparison.currentEndDate}T00:00:00`), "MMM d")}`;
      const previousRange = `${format(new Date(`${comparison.previousStartDate}T00:00:00`), "MMM d")}–${format(new Date(`${comparison.previousEndDate}T00:00:00`), "MMM d")}`;
      const conversionsIncreased = comparison.currentConversions > comparison.previousConversions;
      const conversionsDecreased = comparison.currentConversions < comparison.previousConversions;
      const action = conversionsIncreased
        ? "Identify the traffic sources and landing pages associated with the increase, then verify conversion-event integrity before considering budget reallocation."
        : conversionsDecreased && comparison.currentSessions >= comparison.previousSessions
          ? "Audit conversion-event tracking, source mix, and landing-page changes because conversions declined without a decline in sessions."
          : conversionsDecreased
            ? "Review source-level traffic delivery first, then inspect conversion frequency to separate acquisition loss from on-site performance."
            : "Compare the flat conversion volume with the approved campaign target and review source mix before changing spend.";
      pushInsight({
        type: conversionsDecreased ? "warning" : "info",
        title: conversionsIncreased
          ? "Conversions Increased — Validate the Drivers"
          : conversionsDecreased
            ? "Conversions Decreased — Investigate the Drivers"
            : "Conversion Volume Flat — Review the Target Gap",
        message: `${currentRange} recorded ${formatExactTrendCount(comparison.currentConversions)} conversions from ${formatExactTrendCount(comparison.currentSessions)} sessions${currentRate === null ? "" : ` (${currentRate.toFixed(1)} per 100 sessions)`}, versus ${formatExactTrendCount(comparison.previousConversions)} conversions from ${formatExactTrendCount(comparison.previousSessions)} sessions${previousRate === null ? "" : ` (${previousRate.toFixed(1)} per 100 sessions)`} during ${previousRange}. Next action: ${action}`,
      });
    } else if (!usesCumulativeGA4Consumer && overviewTrendData?.hasPrevious) {
      const revenueChange = overviewTrendData.comparison?.revenue;
      const conversionsChange = overviewTrendData.comparison?.conversions;
      const observedChanges = [
        typeof revenueChange === "number" ? `revenue ${revenueChange >= 0 ? "+" : ""}${revenueChange.toFixed(1)}%` : null,
        typeof conversionsChange === "number" ? `conversions ${conversionsChange >= 0 ? "+" : ""}${conversionsChange.toFixed(1)}%` : null,
      ].filter(Boolean);
      pushInsight({
        type: "info",
        title: "Comparable-Period Movement",
        message: observedChanges.length > 0
          ? `${observedChanges.join(" and ")} versus the previous comparable period. Next action: compare the movement with approved campaign targets and inspect source-level drivers before changing budget.`
          : "Comparable-period values are available, but no supported revenue or conversion change is available for executive action.",
      });
    }

    if (efficiencyTrendData?.cards?.length) {
      const roas = efficiencyTrendData.current?.roas;
      const cpa = efficiencyTrendData.current?.cpa;
      if (usesCumulativeGA4Consumer && typeof roas === "number" && executiveROASDecisionReady) {
        pushInsight({
          type: "info",
          title: "Campaign-to-Date ROAS — Reconciled Sources",
          message: `Cumulative ROAS is ${roas.toFixed(2)}x using financial records dated no later than ${currentValueWindow.endDate}. It reconciles live GA4 native campaign-to-date revenue and every active stored imported revenue and spend source-to-date, all in ${campaignCurrency}. Compare it with approved profit and ROAS targets before any budget change.`,
        });
      } else if (usesCumulativeGA4Consumer && typeof roas === "number") {
        pushInsight({
          type: "warning",
          title: "ROAS Decision Context Not Verified",
          message: `A descriptive cumulative ROAS of ${roas.toFixed(2)}x is available, but its active sources, scope metadata, currency, and input totals did not all reconcile. It is withheld from executive budget guidance.`,
        });
      } else if (typeof roas === "number") {
        pushInsight({
          type: "info",
          title: "Observed Revenue Efficiency",
          message: `ROAS is ${roas.toFixed(2)}x from the available revenue and spend inputs. This is descriptive, not a scaling signal; compare it with an approved campaign ROAS and profit target before changing budget.`,
        });
      } else if (typeof cpa === "number" && cpa > 0) {
        pushInsight({
          type: "info",
          title: "Observed Acquisition Cost",
          message: `CPA is ${fmtTrendCurrency(cpa)} from the available spend and conversion inputs. Compare it with an approved campaign CPA target and confirm the conversion definition before changing budget.`,
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
      if (usesCumulativeGA4Consumer && typeof webCvr === "number") {
        pushInsight({
          type: "info",
          title: "Campaign-to-Date Conversion Volume & Frequency",
          message: `Current cumulative data shows ${formatExactTrendCount(conversionFunnelData.current.conversions)} conversions, or ${webCvr.toFixed(1)} conversions per 100 sessions. Review conversion-event configuration and campaign targets before judging conversion quality.`,
        });
      } else if (typeof webCvr === "number") {
        pushInsight({
          type: "info",
          title: "Observed Web Conversion Frequency",
          message: `${formatExactTrendCount(conversionFunnelData.current.conversions)} conversions from ${formatExactTrendCount(conversionFunnelData.current.sessions)} sessions produced ${formatPct(webCvr)}. This ratio does not establish conversion quality; compare it with an approved campaign target and verify the conversion-event definition.`,
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
  }, [trendAggregate, overviewTrendData, efficiencyTrendData, conversionFunnelData, platformBreakdownData, campaignCurrency, usesCumulativeGA4Consumer, executiveROASDecisionReady]);

  const toggleSeries = (key: string) => {
    setVisibleSeries(prev => {
      const hasInitialSelection = prev.size === 3
        && ["spend", "revenue", "conversions"].every((item) => prev.has(item));
      const next = new Set(hasInitialSelection && usesCumulativeGA4Consumer
        ? ["users", "sessions", "conversions"]
        : prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  // KPI targets for reference lines
  const kpiTargets = useMemo(() => {
    const candidates: Record<'revenue' | 'conversions' | 'roas', number[]> = { revenue: [], conversions: [], roas: [] };
    const targets: Record<string, number> = {};
    (kpis || []).forEach((k: any) => {
      const name = (k.metric || k.name || '').toLowerCase();
      const target = parseFloat(k.targetValue);
      if (!Number.isFinite(target) || target <= 0) return;
      if (name.includes('revenue')) candidates.revenue.push(target);
      if (name.includes('conversion')) candidates.conversions.push(target);
      if (name.includes('roas')) candidates.roas.push(target);
    });
    (Object.keys(candidates) as Array<keyof typeof candidates>).forEach((metric) => {
      if (candidates[metric].length === 1) targets[metric] = candidates[metric][0];
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

  const overviewHasData = Boolean(overviewTrendData
    && (overviewTrendData.series.length > 0 || (usesCumulativeGA4Consumer && authoritativeTrendCurrent)));
  const trendInitialLoadFailed = Boolean(
    (outcomeTotalsError && !outcomeTotals)
    || (trendAnalysisError && !trendAnalysisResponse)
    || (usesCumulativeGA4Consumer && trendGA4ConnectionsError && !trendGA4ConnectionsResponse)
    || (usesCumulativeGA4Consumer && trendGA4DailyError && !ga4Daily)
    || (usesCumulativeGA4Consumer && trendGA4CoverageError && !trendGA4Coverage),
  );
  const trendRetainedRefreshFailed = Boolean(
    (outcomeTotalsError && outcomeTotals)
    || (trendAnalysisError && trendAnalysisResponse)
    || (trendFinancialComparisonError && trendFinancialComparison)
    || (usesCumulativeGA4Consumer && trendGA4ConnectionsError && trendGA4ConnectionsResponse)
    || (usesCumulativeGA4Consumer && trendGA4DailyError && ga4Daily)
    || (usesCumulativeGA4Consumer && trendGA4CoverageError && trendGA4Coverage),
  );
  const trendDataStale = trendRetainedRefreshFailed || (usesCumulativeGA4Consumer && ga4Daily?.refreshIsStale === true);
  const trendPartialLoadFailure = trendInitialLoadFailed && overviewHasData;
  const cumulativeConsumerLoading = usesCumulativeGA4Consumer && (
    !trendGA4ConnectionsFetched
    || (!!trendGA4PropertyId && !trendGA4DailyFetched)
    || (!!trendGA4PropertyId && trendGA4CoverageFetching && !trendGA4Coverage)
    || (!!trendComparisonDate && !trendFinancialComparisonFetched)
  );
  const overviewLoading = !overviewTrendData && (
    (trendAnalysisLoading && !trendAnalysisFetched)
    || trendConsumerMode === "pending"
    || !trendKpisFetched
    || cumulativeConsumerLoading
  );
  const executiveTrendInsights = trendInsights
    .filter((insight) => !["Connected Source Coverage", "Single-Source Trend View"].includes(insight.title))
    .slice(0, 3);
  const comparisonDateLabel = trendComparisonDate
    ? format(new Date(`${trendComparisonDate}T00:00:00`), "MMM d, yyyy")
    : "";
  const cumulativeDataThroughDate = String(currentValueWindow?.dataThroughDate || "");
  const cumulativeDataThroughLabel = ISO_DATE_PATTERN.test(cumulativeDataThroughDate)
    ? format(new Date(`${cumulativeDataThroughDate}T00:00:00`), "MMM d, yyyy")
    : "";
  const headlineComparison = usesCumulativeGA4Consumer ? overviewTrendData?.comparison || {} : {};
  const authoritativeHeadlineEfficiencyCards = authoritativeHeadlineCurrent ? [
    { key: "roi", label: "ROI", value: authoritativeHeadlineCurrent.roi === null ? null : formatPct(authoritativeHeadlineCurrent.roi), change: headlineComparison.roi },
    { key: "cpc", label: "CPC", value: authoritativeHeadlineCurrent.cpc === null ? null : fmtHeadlineCurrency(authoritativeHeadlineCurrent.cpc), change: headlineComparison.cpc, invertColor: true },
    { key: "cpm", label: "CPM", value: authoritativeHeadlineCurrent.cpm === null ? null : fmtHeadlineCurrency(authoritativeHeadlineCurrent.cpm), change: headlineComparison.cpm, invertColor: true },
  ] : [];
  const trendWindowCalendar = usesCumulativeGA4Consumer
    ? expandTrendRowsToCalendarWindow([], String(currentValueWindow?.dataThroughDate || ""), perfDays, String(currentValueWindow?.startDate || ""))
    : [];
  const trendWindowStartLabel = trendWindowCalendar[0]?.date
    ? format(new Date(`${trendWindowCalendar[0].date}T00:00:00`), "MMM d, yyyy")
    : "";
  const trendWindowEndLabel = trendWindowCalendar.at(-1)?.date
    ? format(new Date(`${trendWindowCalendar.at(-1).date}T00:00:00`), "MMM d, yyyy")
    : "";
  const latestTrendDailyDate = String(ga4Daily?.latestStoredDailyDate || "");
  const latestTrendDailyDateLabel = ISO_DATE_PATTERN.test(latestTrendDailyDate)
    ? format(new Date(`${latestTrendDailyDate}T00:00:00`), "MMM d, yyyy")
    : "";

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
                  <div className="flex flex-wrap items-center gap-x-2 mt-1">
                    <p className="text-muted-foreground/70">{(campaign as any)?.name}</p>
                    {overviewTrendData?.connectedSources?.length > 0 && (
                      <span className="text-xs text-muted-foreground">Source: {overviewTrendData.connectedSources.join(", ")}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Trend & comparison window</span>
                <Select value={perfPeriod} onValueChange={setPerfPeriod}>
                  <SelectTrigger className="w-[140px] h-9">
                    <Calendar className="w-3.5 h-3.5 mr-1.5" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent data-trend-window-select>
                    <SelectItem value="7d">Last 7 Days</SelectItem>
                    <SelectItem value="14d">Last 14 Days</SelectItem>
                    <SelectItem value="30d">Last 30 Days</SelectItem>
                    <SelectItem value="90d">Last 90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* One executive Trend Analysis view. Legacy tab panels remain unmounted below for contract-safe cleanup. */}
          <Tabs value="overview" className="space-y-6">

            {/* ═══════════ TAB 1: EXECUTIVE OVERVIEW ═══════════ */}
            <TabsContent value="overview" className={`space-y-6 fade-in chart-transition ${isTrendAnalysisRefreshing ? 'chart-refreshing' : ''}`}>
              {(trendDataStale || trendPartialLoadFailure) && (
                <Card className="border-amber-300 bg-amber-50 dark:bg-amber-900/20">
                  <CardContent className="flex items-start gap-3 p-4">
                    <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                    <div>
                      <p className="font-medium text-foreground">{trendDataStale ? "Trend data may be stale" : "Some Trend data is unavailable"}</p>
                      <p className="text-sm text-muted-foreground">
                        {trendDataStale
                          ? "Showing the latest available Trend values. Latest completed-day coverage or a background refresh could not be verified."
                          : "Available values remain shown; failed inputs and dependent sections are withheld."}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
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
              ) : trendInitialLoadFailed && !overviewHasData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto text-destructive/70 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Trend Analysis unavailable</h3>
                    <p className="text-sm text-muted-foreground/70">
                      Current source data could not be loaded. This is not being treated as an empty campaign; reload or try again shortly.
                    </p>
                  </CardContent>
                </Card>
              ) : trendConsumerMode === "unavailable" ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <AlertTriangle className="w-16 h-16 mx-auto text-muted-foreground/60 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Trend Analysis unavailable</h3>
                    <p className="text-sm text-muted-foreground/70">
                      Connected-source scope or the current reporting-window contract could not be verified, so Trend values are withheld.
                    </p>
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
                  {/* Executive KPI scorecard: one card per decision metric. */}
                  {authoritativeHeadlineCurrent ? <>
                  <div className="space-y-1">
                    <h2 className="text-2xl font-semibold text-foreground">Campaign-to-Date Performance Summary</h2>
                    {cumulativeDataThroughLabel && (
                      <p className="text-sm text-muted-foreground">
                        Current totals are cumulative through {cumulativeDataThroughLabel}; the selector controls charts and the exact comparison date.
                      </p>
                    )}
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {[
                        { label: 'Revenue', value: authoritativeHeadlineCurrent.revenue === null ? null : fmtHeadlineCurrency(authoritativeHeadlineCurrent.revenue), change: headlineComparison.revenue, comparisonPending: !trendFinancialComparisonFetched },
                        { label: 'Spend', value: authoritativeHeadlineCurrent.spend === null ? null : fmtHeadlineCurrency(authoritativeHeadlineCurrent.spend), change: headlineComparison.spend, invertColor: true, comparisonPending: !trendFinancialComparisonFetched },
                        { label: 'ROAS', value: authoritativeHeadlineCurrent.roas === null ? null : `${authoritativeHeadlineCurrent.roas.toFixed(1)}x`, change: headlineComparison.roas, comparisonPending: !trendFinancialComparisonFetched },
                        { ...(authoritativeHeadlineEfficiencyCards.find((card) => card.key === "roi") || { label: 'ROI', value: null, change: null }), comparisonPending: !trendFinancialComparisonFetched },
                        { label: 'Conversions', value: authoritativeHeadlineCurrent.conversions === null ? null : formatExactTrendCount(authoritativeHeadlineCurrent.conversions), change: headlineComparison.conversions },
                        { label: 'CPA', value: authoritativeHeadlineCurrent.cpa === null ? null : fmtHeadlineCurrency(authoritativeHeadlineCurrent.cpa), change: headlineComparison.cpa, invertColor: true, comparisonPending: !trendFinancialComparisonFetched },
                        authoritativeHeadlineEfficiencyCards.find((card) => card.key === "cpc") || { label: 'CPC', value: null, change: null, invertColor: true },
                        authoritativeHeadlineEfficiencyCards.find((card) => card.key === "cpm") || { label: 'CPM', value: null, change: null, invertColor: true },
                        { label: 'Sessions', value: authoritativeHeadlineCurrent.sessions === null ? null : formatExactTrendCount(authoritativeHeadlineCurrent.sessions), change: headlineComparison.sessions },
                        { label: 'Users', value: authoritativeHeadlineCurrent.users === null ? null : formatExactTrendCount(authoritativeHeadlineCurrent.users), change: headlineComparison.users },
                        { label: 'CVR', value: authoritativeHeadlineCurrent.cvr === null ? null : formatPct(authoritativeHeadlineCurrent.cvr), change: headlineComparison.cvr },
                        { label: 'Engagement Rate', value: authoritativeHeadlineCurrent.engagementRate === null ? null : formatPct(normalizeRateToPercent(authoritativeHeadlineCurrent.engagementRate)), change: headlineComparison.engagementRate },
                        { label: 'CTR', value: authoritativeHeadlineCurrent.ctr === null ? null : formatPct(authoritativeHeadlineCurrent.ctr), change: headlineComparison.ctr },
                      ].filter((card) => card.value !== null).map((card, i) => {
                        const comparisonColorClass = Number(card.change) > 0
                          ? "text-green-600"
                          : Number(card.change) < 0
                            ? "text-red-600"
                            : "text-muted-foreground";
                        const countKey = ({ Conversions: "conversions", Sessions: "sessions", Users: "users" } as Record<string, string>)[card.label];
                        const rateKey = ({ CVR: "cvr", "Engagement Rate": "engagementRate", CTR: "ctr" } as Record<string, string>)[card.label];
                        const comparisonKey = countKey || rateKey;
                        const cumulativeComparison = usesCumulativeGA4Consumer && comparisonKey && trendComparisonDate
                          ? formatTrendComparison({
                              current: Number(authoritativeHeadlineCurrent[comparisonKey as keyof typeof authoritativeHeadlineCurrent]),
                              previous: Number(overviewTrendData.previous?.[comparisonKey]),
                              comparisonDate: trendComparisonDate,
                              kind: rateKey ? "rate" : "count",
                            })
                          : null;
                        return (
                          <Card key={i} className="h-full">
                            <CardContent className="p-4 h-full">
                              <div className="text-xs text-muted-foreground/70 mb-1">{card.label}</div>
                              <div className="text-xl font-bold text-foreground">{card.value}</div>
                              <div className="min-h-[5rem]">
                              {overviewTrendData.hasPrevious && typeof card.change === "number" && (
                                cumulativeComparison ? (
                                  <div className="text-xs mt-1 leading-tight">
                                    <div className={comparisonColorClass}>{cumulativeComparison.value}</div>
                                    <div className="text-muted-foreground">{cumulativeComparison.context}</div>
                                  </div>
                                ) : (
                                  <div className="text-xs mt-1 leading-tight">
                                    <div className={`flex items-center ${comparisonColorClass}`}>
                                      {card.change > 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : card.change < 0 ? <ArrowDownRight className="w-3 h-3 mr-0.5" /> : null}
                                      {card.change >= 0 ? '+' : ''}{card.change.toFixed(1)}%
                                    </div>
                                    {usesCumulativeGA4Consumer && comparisonDateLabel && (
                                      <div className="text-muted-foreground">vs {comparisonDateLabel}</div>
                                    )}
                                  </div>
                                )
                              )}
                              {hasAuthoritativeHeadlineWindow && comparisonDateLabel && typeof card.change !== "number" && !("comparisonPending" in card && card.comparisonPending) && (
                                <div className="text-xs text-muted-foreground mt-1 leading-tight">
                                  <div>Comparison unavailable</div>
                                  <div>vs {comparisonDateLabel}</div>
                                </div>
                              )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </> : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground">Current cumulative summary is unavailable because its reporting-window contract could not be verified.</CardContent></Card>
                  )}

                  {trendGA4DailyHistoryVerified && usesCumulativeGA4Consumer && trendWindowCalendar.length < perfDays && trendWindowStartLabel ? (
                    <p className="text-sm text-muted-foreground">
                      Showing {trendWindowCalendar.length} of {perfDays} selected calendar dates because imported GA4 history begins {trendWindowStartLabel}.
                    </p>
                  ) : trendGA4DailyHistoryVerified && !overviewTrendData.hasCompleteCurrentPeriod && (
                    <p className="text-sm text-muted-foreground">
                      Showing {overviewTrendData.currentPeriodDays} of {overviewTrendData.requestedPeriodDays} days available for this selection. Full-period trend comparisons appear once enough daily history exists.
                    </p>
                  )}
                  <h2 className="flex items-center space-x-2 text-2xl font-semibold text-foreground">
                    <Activity className="w-5 h-5" />
                    <span>Campaign Performance Trend</span>
                  </h2>
                  {trendGA4DailyHistoryPending ? (
                    <Card><CardContent className="p-6"><div className="h-80 rounded-md bg-muted animate-pulse" aria-label="Verifying GA4 campaign performance daily history" /></CardContent></Card>
                  ) : trendGA4DailyHistoryVerified && overviewTrendData.series.length > 0 ? <>
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
                    {usesCumulativeGA4Consumer && overviewTrendData.series.length > 0 && (
                      <CardHeader>
                        <p className="text-xs text-muted-foreground">Verified daily values: {overviewTrendData.currentPeriodDays} of {overviewTrendData.chartCalendarDays} calendar dates; missing dates remain gaps unless GA4 verifies them as zero.</p>
                        {overviewTrendData.anomalies.some((anomaly: any) => overviewVisibleSeries.has(anomaly.metric)) && (
                          <div className="space-y-1 text-xs text-muted-foreground" aria-label="Anomaly marker legend">
                            <div className="flex flex-wrap items-center gap-4">
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" aria-hidden="true" />
                                Critical statistical change
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden="true" />
                                Warning statistical change
                              </span>
                            </div>
                            <p>Conversion markers compare each date with the previous 7 comparable dates; severity shows how unusual the change is, not whether it is good or bad.</p>
                          </div>
                        )}
                      </CardHeader>
                    )}
                    <CardContent>
                      <div className="h-80">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={overviewTrendData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => {
                              if (['Spend', 'Revenue'].some(n => name.includes(n))) return [fmtTrendCurrency(Number(value)), name];
                              return [Number(value).toLocaleString(), name];
                            }} />
                            {overviewVisibleSeries.has('spend') && <Area isAnimationActive={false} yAxisId="right" type="monotone" dataKey="spend" fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeWidth={2} name={`Spend (${campaignCurrency})`} />}
                            {overviewVisibleSeries.has('revenue') && <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name={`Revenue (${campaignCurrency})`} />}
                            {overviewVisibleSeries.has('conversions') && <Bar isAnimationActive={false} yAxisId="left" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />}
                            {overviewVisibleSeries.has('impressions') && <Area isAnimationActive={false} yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.08} stroke="#3b82f6" strokeWidth={1.5} name="Impressions" />}
                            {overviewVisibleSeries.has('clicks') && <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={false} name="Clicks" />}
                            {overviewVisibleSeries.has('users') && <Line isAnimationActive={false} connectNulls={false} yAxisId="left" type="monotone" dataKey="users" stroke="#E37400" strokeWidth={2} dot={false} name="Users" />}
                            {overviewVisibleSeries.has('sessions') && <Line isAnimationActive={false} connectNulls={false} yAxisId="left" type="monotone" dataKey="sessions" stroke="#ec4899" strokeWidth={2} strokeDasharray="6 4" dot={false} name="Sessions" />}
                            {/* KPI target lines */}
                            {kpiTargets.revenue && overviewVisibleSeries.has('revenue') && (
                              <ReferenceLine yAxisId="right" y={kpiTargets.revenue} ifOverflow="extendDomain" stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Revenue Target', fill: '#10b981', fontSize: 10 }} />
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
                  </> : (
                    <Card>
                      <CardContent className="p-8 text-center text-sm text-muted-foreground">
                        {usesCumulativeGA4Consumer && !trendGA4DailyHistoryVerified
                          ? <>Campaign performance daily values are withheld because current GA4 data could not be verified.</>
                          : usesCumulativeGA4Consumer && trendWindowCalendar.length < perfDays && trendWindowStartLabel
                          ? <>{perfDays}-day trend unavailable: {trendWindowCalendar.length} of {perfDays} calendar days are available. Data begins {trendWindowStartLabel}.</>
                          : usesCumulativeGA4Consumer && trendWindowStartLabel && trendWindowEndLabel
                            ? <>No GA4 daily records for {trendWindowStartLabel}–{trendWindowEndLabel}.{latestTrendDailyDateLabel ? ` Latest recorded date: ${latestTrendDailyDateLabel}.` : ""}</>
                          : <>No daily records are available for this trend window.</>}
                      </CardContent>
                    </Card>
                  )}

                  {efficiencyTrendData && (efficiencyTrendData.hasFinancialEfficiency || efficiencyTrendData.hasCostEfficiency || efficiencyTrendData.hasRateEfficiency) && (
                    <div className="space-y-3">
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">Efficiency Trends</h2>
                        <p className="text-sm text-muted-foreground">How return, acquisition cost, and conversion quality are changing over time.</p>
                        {usesCumulativeGA4Consumer && !efficiencyTrendData.hasFinancialEfficiency && !efficiencyTrendData.hasCostEfficiency && (
                          <p className="text-xs text-muted-foreground mt-1">Return and cost trends are unavailable because compatible daily financial history is not available. Current campaign-to-date financial totals remain shown above.</p>
                        )}
                      </div>
                      <div className="grid gap-6 lg:grid-cols-2">
                        {efficiencyTrendData.series.length > 0 && efficiencyTrendData.hasFinancialEfficiency && (
                          <Card>
                            <CardHeader><CardTitle>Return Efficiency</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <ComposedChart data={efficiencyTrendData.series}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis dataKey="label" className="text-xs" />
                                    <YAxis yAxisId="left" className="text-xs" />
                                    <YAxis yAxisId="right" orientation="right" className="text-xs" />
                                    <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => [name === "ROAS" ? `${Number(value).toFixed(2)}x` : formatPct(Number(value)), name]} />
                                    {efficiencyTrendData.current.roas !== null && <Line isAnimationActive={false} yAxisId="left" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} dot={false} name="ROAS" />}
                                    {efficiencyTrendData.current.roi !== null && <Line isAnimationActive={false} yAxisId="right" type="monotone" dataKey="roi" stroke="#8b5cf6" strokeWidth={2} dot={false} name="ROI" />}
                                    {kpiTargets.roas && efficiencyTrendData.current.roas !== null && <ReferenceLine yAxisId="left" y={kpiTargets.roas} ifOverflow="extendDomain" stroke="#10b981" strokeDasharray="5 5" label={{ value: "ROAS Target", fill: "#10b981", fontSize: 10 }} />}
                                  </ComposedChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {efficiencyTrendData.series.length > 0 && efficiencyTrendData.hasCostEfficiency && (
                          <Card>
                            <CardHeader><CardTitle>Acquisition Cost Trend</CardTitle></CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={efficiencyTrendData.series}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis dataKey="label" className="text-xs" />
                                    <YAxis className="text-xs" />
                                    <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => [fmtTrendCurrency(Number(value)), name]} />
                                    {efficiencyTrendData.current.cpa !== null && <Line isAnimationActive={false} type="monotone" dataKey="cpa" stroke="#ef4444" strokeWidth={2} dot={false} name="CPA" />}
                                    {efficiencyTrendData.current.cpc !== null && <Line isAnimationActive={false} type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC" />}
                                    {efficiencyTrendData.current.cpm !== null && <Line isAnimationActive={false} type="monotone" dataKey="cpm" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CPM" />}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}

                        {efficiencyTrendData.series.length > 0 && efficiencyTrendData.hasRateEfficiency && (
                          <Card className="lg:col-span-2">
                            <CardHeader>
                              <CardTitle>Conversion Quality Trend</CardTitle>
                              {usesCumulativeGA4Consumer && <p className="text-xs text-muted-foreground">Daily rates; hover a date to see the exact counts used.</p>}
                              {usesCumulativeGA4Consumer && efficiencyTrendData.series.some((row: any) => row.noActivity === 0) && (
                                <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                                  <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" aria-hidden="true" />
                                  No activity — 0 sessions; rates unavailable
                                </p>
                              )}
                            </CardHeader>
                            <CardContent>
                              <div className="h-64">
                                <ResponsiveContainer width="100%" height="100%">
                                  <LineChart data={efficiencyTrendData.series}>
                                    <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                    <XAxis dataKey="label" className="text-xs" />
                                    <YAxis className="text-xs" />
                                    {usesCumulativeGA4Consumer ? (
                                      <Tooltip content={({ active, payload, label }: any) => {
                                        if (!active || !payload?.length) return null;
                                        const row = payload[0]?.payload || {};
                                        if (row.noActivity === 0) {
                                          return (
                                            <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
                                              <p className="mb-2 font-medium">{label}</p>
                                              <p>Sessions: 0</p>
                                              <p>Conversions: 0</p>
                                              <p>Engaged Sessions: 0</p>
                                              <p className="mt-2 text-amber-600">No activity — rates unavailable</p>
                                            </div>
                                          );
                                        }
                                        return (
                                          <div className="rounded-md border bg-background p-3 text-sm shadow-sm">
                                            <p className="mb-2 font-medium">{label}</p>
                                            <p>Sessions: {formatExactTrendCount(Number(row.sessions || 0))}</p>
                                            <p>Conversions: {formatExactTrendCount(Number(row.conversions || 0))}</p>
                                            <p>Engaged Sessions: {row.engagedSessions === null || typeof row.engagedSessions === "undefined" ? "Unavailable" : formatExactTrendCount(Number(row.engagedSessions))}</p>
                                            {row.cvr !== null && typeof row.cvr !== "undefined" && <p className="mt-2 text-[#8b5cf6]">CVR: {formatPct(Number(row.cvr))}</p>}
                                            {row.engagementRate !== null && typeof row.engagementRate !== "undefined" && <p className="text-[#10b981]">Engagement Rate: {formatPct(Number(row.engagementRate))}</p>}
                                          </div>
                                        );
                                      }} />
                                    ) : (
                                      <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => [formatPct(Number(value)), name]} />
                                    )}
                                    <Legend />
                                    {efficiencyTrendData.current.ctr !== null && <Line isAnimationActive={false} type="monotone" dataKey="ctr" stroke="#3b82f6" strokeWidth={2} dot={false} name="CTR" />}
                                    {efficiencyTrendData.current.cvr !== null && <Line isAnimationActive={false} type="monotone" dataKey="cvr" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CVR" />}
                                    {efficiencyTrendData.current.engagementRate !== null && <Line isAnimationActive={false} type="monotone" dataKey="engagementRate" stroke="#10b981" strokeWidth={2} dot={false} name="Engagement Rate" />}
                                    {usesCumulativeGA4Consumer && <Line isAnimationActive={false} type="linear" dataKey="noActivity" stroke="transparent" dot={{ r: 5, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#f59e0b', stroke: '#ffffff', strokeWidth: 2 }} legendType="none" name="No activity" />}
                                  </LineChart>
                                </ResponsiveContainer>
                              </div>
                            </CardContent>
                          </Card>
                        )}
                        {efficiencyTrendData.series.length === 0 && (
                          <Card className="lg:col-span-2">
                            <CardContent className="p-8 text-center text-sm text-muted-foreground">
                              {usesCumulativeGA4Consumer && trendWindowCalendar.length < perfDays && trendWindowStartLabel
                                ? <>{perfDays}-day efficiency trend unavailable: {trendWindowCalendar.length} of {perfDays} calendar days are available. Data begins {trendWindowStartLabel}.</>
                                : usesCumulativeGA4Consumer && trendWindowStartLabel && trendWindowEndLabel
                                  ? <>No daily efficiency data for {trendWindowStartLabel}–{trendWindowEndLabel}.{latestTrendDailyDateLabel ? ` Latest recorded date: ${latestTrendDailyDateLabel}.` : ""}</>
                                  : <>No daily efficiency data is available for this trend window.</>}
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </div>
                  )}

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
                                    <span className="font-semibold">{a.metric === 'spend' || a.metric === 'cpa' ? fmtTrendCurrency(a.value) : a.value.toLocaleString()}</span>
                                    <span className="text-xs ml-1">(previous 7-day average ~{a.metric === 'spend' || a.metric === 'cpa' ? fmtTrendCurrency(a.expected) : Math.round(a.expected).toLocaleString()})</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {conversionFunnelData?.webAvailable && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <BarChart3 className="w-5 h-5" />
                          <span>Website Engagement &amp; Conversion Summary</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Website activity, engagement, and conversion volume from connected source data.</p>
                        {usesCumulativeGA4Consumer && cumulativeDataThroughLabel && (
                          <p className="text-xs text-muted-foreground">Cumulative from initial import through {cumulativeDataThroughLabel}.</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-3">
                          {[
                            { label: "Sessions", value: conversionFunnelData.current.sessions === null ? null : formatExactTrendCount(conversionFunnelData.current.sessions) },
                            Number.isFinite(conversionFunnelData.current.engagedSessions)
                              ? { label: "Engaged Sessions", value: formatExactTrendCount(conversionFunnelData.current.engagedSessions) }
                              : { label: "Users", value: conversionFunnelData.current.users === null ? null : formatExactTrendCount(conversionFunnelData.current.users) },
                            { label: "Conversions", value: conversionFunnelData.current.conversions === null ? null : formatExactTrendCount(conversionFunnelData.current.conversions) },
                          ].filter((stage) => stage.value !== null).map((stage) => (
                            <div key={stage.label} className="relative rounded-lg border p-4">
                              <div className="text-xs text-muted-foreground mb-1">{stage.label}</div>
                              <div className="text-xl font-bold text-foreground">{stage.value}</div>
                            </div>
                          ))}
                        </div>
                        <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                          {conversionFunnelData.current.engagementRate !== null && (
                            <div><span className="text-xs text-muted-foreground">Engagement rate</span><div className="font-semibold">{formatPct(conversionFunnelData.current.engagementRate)}</div></div>
                          )}
                          {conversionFunnelData.current.webCvr !== null && (
                            <div><span className="text-xs text-muted-foreground">Conversions per 100 sessions</span><div className="font-semibold">{conversionFunnelData.current.webCvr.toFixed(1)}</div></div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {conversionFunnelData?.paidAvailable && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Layers className="w-5 h-5" />
                          <span>Paid Acquisition Funnel</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">Reach-to-conversion progression for connected paid-media sources.</p>
                      </CardHeader>
                      <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                        {[
                          { label: "Impressions", value: conversionFunnelData.current.impressions === null ? null : fmtNum(conversionFunnelData.current.impressions) },
                          { label: "Clicks", value: conversionFunnelData.current.clicks === null ? null : fmtNum(conversionFunnelData.current.clicks) },
                          { label: "Conversions", value: conversionFunnelData.current.paidConversions === null ? null : fmtNum(conversionFunnelData.current.paidConversions) },
                          { label: "CTR", value: conversionFunnelData.current.ctr === null ? null : formatPct(conversionFunnelData.current.ctr) },
                          { label: "Paid CVR", value: conversionFunnelData.current.paidCvr === null ? null : formatPct(conversionFunnelData.current.paidCvr) },
                        ].filter((item) => item.value !== null).map((item) => (
                          <div key={item.label} className="rounded-lg border p-4">
                            <div className="text-xs text-muted-foreground mb-1">{item.label}</div>
                            <div className="text-xl font-bold text-foreground">{item.value}</div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {platformBreakdownData?.sources?.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <GitCompare className="w-5 h-5" />
                          <span>Source Contribution</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b text-muted-foreground">
                              <th className="text-left py-2 pr-4">Source</th>
                              <th className="text-right py-2 px-2">Spend</th>
                              <th className="text-right py-2 px-2">Traffic</th>
                              <th className="text-right py-2 px-2">Conversions</th>
                              <th className="text-right py-2 px-2">Revenue</th>
                              <th className="text-right py-2 px-2">ROAS</th>
                              <th className="text-right py-2 px-2">CPA</th>
                              <th className="text-right py-2 px-2">CTR</th>
                              <th className="text-right py-2 px-2">CPC</th>
                              <th className="text-left py-2 pl-2">Coverage notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {platformBreakdownData.sources.map((source: any) => (
                              <tr key={source.id} className="border-b last:border-0">
                                <td className="py-3 pr-4 font-medium">{source.label}</td>
                                <td className="text-right py-3 px-2">{source.spend === null ? "—" : fmtTrendCurrency(source.spend)}</td>
                                <td className="text-right py-3 px-2">
                                  {source.sessions !== null ? fmtNum(source.sessions) : source.clicks !== null ? fmtNum(source.clicks) : "—"}
                                  {(source.sessions !== null || source.clicks !== null) && <div className="text-[10px] text-muted-foreground">{source.sessions !== null ? "sessions" : "clicks"}</div>}
                                </td>
                                <td className="text-right py-3 px-2">{source.conversions === null ? "—" : fmtNum(source.conversions)}</td>
                                <td className="text-right py-3 px-2">{source.revenue === null ? "—" : fmtTrendCurrency(source.revenue)}</td>
                                <td className="text-right py-3 px-2">{source.roas === null ? "—" : `${source.roas.toFixed(2)}x`}</td>
                                <td className="text-right py-3 px-2">{source.cpa === null ? "—" : fmtTrendCurrency(source.cpa)}</td>
                                <td className="text-right py-3 px-2">{source.ctr === null ? "—" : formatPct(source.ctr)}</td>
                                <td className="text-right py-3 px-2">{source.cpc === null ? "—" : fmtTrendCurrency(source.cpc)}</td>
                                <td className="py-3 pl-2 text-xs text-muted-foreground">{source.unavailable.length ? source.unavailable.join("; ") : "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {platformBreakdownData.trendRows.length > 0 && platformBreakdownData.metricOptions.length > 0 && (
                          <div className="border-t mt-6 pt-6">
                            <div className="flex items-center justify-between mb-4">
                              <div>
                                <h3 className="font-medium text-foreground">Contribution Over Time</h3>
                                <p className="text-xs text-muted-foreground">See which connected source is driving the selected metric.</p>
                              </div>
                              <Select value={platformBreakdownData.activeMetric} onValueChange={setPlatformMetric}>
                                <SelectTrigger className="w-[140px] h-8 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {platformBreakdownData.metricOptions.map((metricName: string) => (
                                    <SelectItem key={metricName} value={metricName}>{metricName.charAt(0).toUpperCase() + metricName.slice(1)}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="h-64">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={platformBreakdownData.trendRows}>
                                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                                  <XAxis dataKey="label" className="text-xs" />
                                  <YAxis className="text-xs" />
                                  <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => [platformBreakdownData.activeMetric === "spend" || platformBreakdownData.activeMetric === "revenue" ? fmtTrendCurrency(Number(value)) : Number(value).toLocaleString(), name]} />
                                  {platformBreakdownData.sources.map((source: any) => (
                                    <Bar isAnimationActive={false} key={source.id} dataKey={`${source.id}_${platformBreakdownData.activeMetric}`} stackId="source" fill={source.color} name={source.label} />
                                  ))}
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}

                  {executiveTrendInsights.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <Target className="w-5 h-5" />
                          <span>Executive Recommendations</span>
                        </CardTitle>
                        <p className="text-sm text-muted-foreground">
                          Decision guidance based on the available campaign trend, efficiency, and conversion signals.
                        </p>
                      </CardHeader>
                      <CardContent className="grid gap-4 lg:grid-cols-3">
                        {executiveTrendInsights.map((insight, index) => {
                          const style = insight.type === "warning"
                            ? "border-l-orange-500 bg-orange-50 dark:bg-orange-900/20"
                            : insight.type === "success"
                              ? "border-l-green-500 bg-green-50 dark:bg-green-900/20"
                              : "border-l-blue-500 bg-blue-50 dark:bg-blue-900/20";
                          return (
                            <div key={index} className={`border-l-4 p-4 rounded-r-lg ${style}`}>
                              <h3 className="font-semibold mb-1">{insight.title}</h3>
                              <p className="text-sm text-muted-foreground">{insight.message}</p>
                            </div>
                          );
                        })}
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
                  {usesCumulativeGA4Consumer && efficiencyTrendData.hasCompleteCurrentPeriod && !efficiencyTrendData.hasPrevious && trendComparisonDate && (
                    <p className="text-sm text-muted-foreground">
                      Exact comparison for {trendComparisonDate} is unavailable. Current cumulative efficiency values remain visible without a fallback comparison.
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
                              {kpiTargets.roas && efficiencyTrendData.current.roas !== null && <ReferenceLine yAxisId="left" y={kpiTargets.roas} ifOverflow="extendDomain" stroke="#10b981" strokeDasharray="5 5" label={{ value: 'ROAS Target', fill: '#10b981', fontSize: 10 }} />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground/70">
                      {usesCumulativeGA4Consumer
                        ? "Daily ROAS and ROI trends are unavailable because no compatible cumulative financial series exists. Current cumulative cards remain authoritative."
                        : "ROAS and ROI require both spend and revenue from connected source data."}
                    </CardContent></Card>
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
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [fmtTrendCurrency(Number(v)), name]} />
                              {efficiencyTrendData.current.cpa !== null && <Line type="monotone" dataKey="cpa" stroke="#ef4444" strokeWidth={2} dot={false} name="CPA" />}
                              {efficiencyTrendData.current.cpc !== null && <Line type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC" />}
                              {efficiencyTrendData.current.cpm !== null && <Line type="monotone" dataKey="cpm" stroke="#8b5cf6" strokeWidth={2} dot={false} name="CPM" />}
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card><CardContent className="p-6 text-sm text-muted-foreground/70">
                      {usesCumulativeGA4Consumer
                        ? "Daily cost-efficiency trends are unavailable because no compatible cumulative financial series exists. Current cumulative cards remain authoritative."
                        : "CPA requires spend and conversions. CPC and CPM require paid-media clicks or impressions from a connected source."}
                    </CardContent></Card>
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
                            { label: 'CPA', value: conversionFunnelData.current.cpa === null ? null : fmtTrendCurrency(conversionFunnelData.current.cpa) },
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
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name === 'Spend' ? fmtTrendCurrency(Number(v)) : Number(v).toLocaleString(), name]} />
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
                                  <td className="text-right py-3 px-2">{p.spend === null ? '—' : fmtTrendCurrency(p.spend)}</td>
                                  <td className="text-right py-3 px-2">{p.impressions === null ? '—' : fmtNum(p.impressions)}</td>
                                  <td className="text-right py-3 px-2">{p.clicks === null ? '—' : fmtNum(p.clicks)}</td>
                                  <td className="text-right py-3 px-2">{p.ctr === null ? '—' : formatPct(p.ctr)}</td>
                                  <td className="text-right py-3 px-2">{p.conversions === null ? '—' : fmtNum(p.conversions)}</td>
                                  <td className="text-right py-3 px-2">{p.revenue === null ? '—' : fmtTrendCurrency(p.revenue)}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpa > 0 && p.cpa === bestCpa ? 'text-green-600 font-semibold' : ''}`}>{p.cpa > 0 ? fmtTrendCurrency(p.cpa) : '—'}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpc > 0 && p.cpc === bestCpc ? 'text-green-600 font-semibold' : ''}`}>{p.cpc > 0 ? fmtTrendCurrency(p.cpc) : '—'}</td>
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
                                <Tooltip formatter={(v: any) => fmtTrendCurrency(Number(v))} />
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
                                <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtTrendCurrency(Number(v))} />
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
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [platformBreakdownData.activeMetric === 'spend' || platformBreakdownData.activeMetric === 'revenue' ? fmtTrendCurrency(Number(v)) : Number(v).toLocaleString(), name]} />
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
