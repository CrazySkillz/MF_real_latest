import { useParams } from "wouter";
import { useQuery, useMutation, keepPreviousData } from "@tanstack/react-query";
import { ArrowLeft, TrendingUp, TrendingDown, BarChart3, Activity, Calendar, Target, DollarSign, Settings, Plus, X, AlertTriangle, ArrowUpRight, ArrowDownRight, Layers, GitCompare, Search } from "lucide-react";
import { Link } from "wouter";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { formatPct } from "@shared/metric-math";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area, BarChart, Bar, ComposedChart, PieChart, Pie, Cell,
  ReferenceLine, ReferenceDot,
} from "recharts";
import { format, subDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useState, useEffect, useMemo } from "react";

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
  const { toast } = useToast();

  // Google Trends config state
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [industry, setIndustry] = useState("");
  const [keywords, setKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState("");

  // Page-level state
  const [perfPeriod, setPerfPeriod] = useState<string>("30d");
  const [activeTab, setActiveTab] = useState("overview");
  const [visibleSeries, setVisibleSeries] = useState<Set<string>>(new Set(['spend', 'revenue', 'conversions']));
  const [platformMetric, setPlatformMetric] = useState<string>("spend");

  const perfDays = perfPeriod === '7d' ? 7 : perfPeriod === '14d' ? 14 : perfPeriod === '90d' ? 90 : 30;

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

  // Google Trends embed URLs (built from campaign keywords — no API needed)
  const trendsEmbedUrls = useMemo(() => {
    const kws: string[] = (campaign as any)?.trendKeywords || [];
    if (kws.length === 0) return null;
    const q = kws.map(k => encodeURIComponent(k)).join(",");
    const comparisonItems = kws.map(k => ({ keyword: k, geo: "", time: "today 3-m" }));
    const req = encodeURIComponent(JSON.stringify({ comparisonItem: comparisonItems, category: 0, property: "" }));
    const guestPath = encodeURIComponent("https://trends.google.com:443/trends/embed/");
    return {
      timeseries: `https://trends.google.com/trends/embed/explore/TIMESERIES?req=${req}&tz=${new Date().getTimezoneOffset()}&eq=q=${q}&date=today%203-m`,
      geo: `https://trends.google.com/trends/embed/explore/GEO_MAP?req=${req}&tz=${new Date().getTimezoneOffset()}&eq=q=${q}&date=today%203-m`,
      related: `https://trends.google.com/trends/embed/explore/RELATED_QUERIES?req=${req}&tz=${new Date().getTimezoneOffset()}&eq=q=${q}&date=today%203-m`,
      explore: `https://trends.google.com/trends/explore?date=today%203-m&q=${q}`,
    };
  }, [campaign]);

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
    const sortedDates = [...new Set(allDates)].sort();
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

  // ─── Google Trends mutations & handlers ──────────────────────────
  const updateKeywordsMutation = useMutation({
    mutationFn: async (data: { industry: string; trendKeywords: string[] }) => {
      return await apiRequest('PATCH', `/api/campaigns/${campaignId}`, data);
    },
    onSuccess: async () => {
      toast({ title: "Keywords Saved", description: "Google Trends widgets updated." });
      setIsConfiguring(false);
      await queryClient.invalidateQueries({ queryKey: ["/api/campaigns", campaignId] });
    },
    onError: () => { toast({ title: "Error", description: "Failed to update keywords.", variant: "destructive" }); },
  });

  const handleAddKeyword = () => { if (newKeyword.trim() && !keywords.includes(newKeyword.trim())) { setKeywords([...keywords, newKeyword.trim()]); setNewKeyword(""); } };
  const handleRemoveKeyword = (kw: string) => setKeywords(keywords.filter(k => k !== kw));
  const handleSaveKeywords = () => {
    let finalKw = [...keywords];
    if (newKeyword.trim() && !finalKw.includes(newKeyword.trim())) { finalKw.push(newKeyword.trim()); setKeywords(finalKw); setNewKeyword(""); }
    if (finalKw.length === 0) { toast({ title: "No Keywords", description: "Add at least one keyword.", variant: "destructive" }); return; }
    updateKeywordsMutation.mutate({ industry, trendKeywords: finalKw });
  };

  useEffect(() => { if (campaign && !isConfiguring) { setIndustry((campaign as any).industry || ""); setKeywords((campaign as any).trendKeywords || []); } }, [campaign, isConfiguring]);

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

  const hasData = crossPlatformData && crossPlatformData.series.length > 0;
  const hasAdPlatforms = crossPlatformData && crossPlatformData.current.impressions > 0;

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
              {/* Period selector — shared across all tabs */}
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
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="overview">Executive Overview</TabsTrigger>
              <TabsTrigger value="efficiency">Efficiency Metrics</TabsTrigger>
              <TabsTrigger value="funnel">Conversion Funnel</TabsTrigger>
              <TabsTrigger value="platforms">Platform Breakdown</TabsTrigger>
              <TabsTrigger value="market">Market Trends</TabsTrigger>
            </TabsList>

            {/* ═══════════ TAB 1: EXECUTIVE OVERVIEW ═══════════ */}
            <TabsContent value="overview" className={`space-y-6 fade-in chart-transition ${isRefreshing ? 'chart-refreshing' : ''}`}>
              {!hasData ? (
                <Card>
                  <CardContent className="p-8 text-center">
                    <Activity className="w-16 h-16 mx-auto text-muted-foreground/60 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">No Performance Data Available</h3>
                    <p className="text-sm text-muted-foreground/70">
                      Connect a platform (GA4, LinkedIn, Meta, or Google Ads) to see performance trends.
                    </p>
                  </CardContent>
                </Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  {crossPlatformData.hasPrevious && (
                    <div className="grid gap-4 md:grid-cols-6">
                      {[
                        { label: 'Total Spend', value: fmtCur(crossPlatformData.current.spend), change: crossPlatformData.comparison.spend, invertColor: true },
                        { label: 'Total Revenue', value: fmtCur(crossPlatformData.current.revenue), change: crossPlatformData.comparison.revenue },
                        { label: 'ROAS', value: `${crossPlatformData.current.roas.toFixed(1)}x`, change: crossPlatformData.comparison.roas },
                        { label: 'Conversions', value: fmtNum(crossPlatformData.current.conversions), change: crossPlatformData.comparison.conversions },
                        { label: 'CPA', value: fmtCur(crossPlatformData.current.cpa), change: crossPlatformData.comparison.cpa, invertColor: true },
                        { label: 'Avg CTR', value: `${formatPct(crossPlatformData.current.ctr)}`, change: crossPlatformData.comparison.ctr },
                      ].map((card, i) => {
                        const isGood = card.invertColor ? card.change <= 0 : card.change >= 0;
                        return (
                          <Card key={i}>
                            <CardContent className="p-4">
                              <div className="text-xs text-muted-foreground/70 mb-1">{card.label}</div>
                              <div className="text-xl font-bold text-foreground">{card.value}</div>
                              <div className={`flex items-center text-xs mt-1 ${isGood ? 'text-green-600' : 'text-red-600'}`}>
                                {card.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                                {card.change >= 0 ? '+' : ''}{card.change.toFixed(1)}%
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {/* Metric Toggle Row */}
                  <div className="flex flex-wrap gap-2">
                    {[
                      { key: 'spend', label: 'Spend', color: '#f59e0b' },
                      { key: 'revenue', label: 'Revenue', color: '#10b981' },
                      { key: 'conversions', label: 'Conversions', color: '#8b5cf6' },
                      { key: 'impressions', label: 'Impressions', color: '#3b82f6' },
                      { key: 'clicks', label: 'Clicks', color: '#06b6d4' },
                      { key: 'users', label: 'Users', color: '#E37400' },
                      { key: 'sessions', label: 'Sessions', color: '#ec4899' },
                    ].map(s => (
                      <button
                        key={s.key}
                        onClick={() => toggleSeries(s.key)}
                        className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                          visibleSeries.has(s.key)
                            ? 'text-white border-transparent'
                            : 'text-muted-foreground/70 border-border bg-transparent'
                        }`}
                        style={visibleSeries.has(s.key) ? { backgroundColor: s.color } : {}}
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
                          <ComposedChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(value: any, name: string) => {
                              if (['Spend', 'Revenue'].some(n => name.includes(n))) return [fmtCur(Number(value)), name];
                              return [Number(value).toLocaleString(), name];
                            }} />
                            {visibleSeries.has('spend') && <Area yAxisId="right" type="monotone" dataKey="spend" fill="#f59e0b" fillOpacity={0.1} stroke="#f59e0b" strokeWidth={2} name="Spend ($)" />}
                            {visibleSeries.has('revenue') && <Line yAxisId="right" type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={2} dot={false} name="Revenue ($)" />}
                            {visibleSeries.has('conversions') && <Bar yAxisId="left" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />}
                            {visibleSeries.has('impressions') && <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.08} stroke="#3b82f6" strokeWidth={1.5} name="Impressions" />}
                            {visibleSeries.has('clicks') && <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={false} name="Clicks" />}
                            {visibleSeries.has('users') && <Line yAxisId="left" type="monotone" dataKey="users" stroke="#E37400" strokeWidth={2} dot={false} name="Users" />}
                            {visibleSeries.has('sessions') && <Line yAxisId="left" type="monotone" dataKey="sessions" stroke="#ec4899" strokeWidth={2} dot={false} name="Sessions" />}
                            {/* KPI target lines */}
                            {kpiTargets.revenue && visibleSeries.has('revenue') && (
                              <ReferenceLine yAxisId="right" y={kpiTargets.revenue} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'Revenue Target', fill: '#10b981', fontSize: 10 }} />
                            )}
                            {/* Anomaly dots */}
                            {crossPlatformData.anomalies.filter(a => visibleSeries.has(a.metric)).slice(0, 8).map((a, i) => (
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
                  {crossPlatformData.anomalies.length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <AlertTriangle className="w-5 h-5 text-orange-500" />
                          <span>Anomaly Detection</span>
                          <Badge variant="outline" className="text-xs">{crossPlatformData.anomalies.length} detected</Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          {crossPlatformData.anomalies.slice(0, 8).map((a, i) => {
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
            <TabsContent value="efficiency" className={`space-y-6 fade-in chart-transition ${isRefreshing ? 'chart-refreshing' : ''}`}>
              {!hasData ? (
                <Card><CardContent className="p-8 text-center"><Activity className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><p className="text-muted-foreground/70">No data available for efficiency analysis.</p></CardContent></Card>
              ) : (
                <>
                  {/* Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: 'Avg ROAS', value: `${crossPlatformData.current.roas.toFixed(1)}x`, change: crossPlatformData.comparison.roas },
                      { label: 'Avg CPA', value: fmtCur(crossPlatformData.current.cpa), change: crossPlatformData.comparison.cpa, invertColor: true },
                      { label: 'Avg CPC', value: fmtCur(crossPlatformData.current.cpc), change: pctChange(crossPlatformData.current.cpc, avgArr(crossPlatformData.series, 'cpc')), invertColor: true },
                      { label: 'Avg CPM', value: fmtCur(crossPlatformData.current.cpm), change: pctChange(crossPlatformData.current.cpm, avgArr(crossPlatformData.series, 'cpm')), invertColor: true },
                    ].map((card, i) => {
                      const isGood = card.invertColor ? card.change <= 0 : card.change >= 0;
                      return (
                        <Card key={i}>
                          <CardContent className="p-4">
                            <div className="text-xs text-muted-foreground mb-1">{card.label}</div>
                            <div className="text-xl font-bold text-foreground">{card.value}</div>
                            {crossPlatformData.hasPrevious && (
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

                  {/* ROAS & ROI Chart */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><DollarSign className="w-5 h-5" /><span>ROAS & ROI Trend</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" label={{ value: 'ROAS (x)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: 'ROI (%)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name === 'ROAS' ? `${Number(v).toFixed(2)}x` : `${Number(v).toFixed(1)}%`, name]} />
                            <Line yAxisId="left" type="monotone" dataKey="roas" stroke="#10b981" strokeWidth={2} dot={false} name="ROAS" />
                            <Line yAxisId="right" type="monotone" dataKey="roi" stroke="#8b5cf6" strokeWidth={2} dot={false} name="ROI %" />
                            {kpiTargets.roas && <ReferenceLine yAxisId="left" y={kpiTargets.roas / 100} stroke="#10b981" strokeDasharray="5 5" label={{ value: 'ROAS Target', fill: '#10b981', fontSize: 10 }} />}
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CPA & CPC Chart */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><Target className="w-5 h-5" /><span>CPA & CPC Trend</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis yAxisId="left" className="text-xs" label={{ value: 'CPA ($)', angle: -90, position: 'insideLeft', style: { fontSize: 10 } }} />
                            <YAxis yAxisId="right" orientation="right" className="text-xs" label={{ value: 'CPC ($)', angle: 90, position: 'insideRight', style: { fontSize: 10 } }} />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [fmtCur(Number(v)), name]} />
                            <Line yAxisId="left" type="monotone" dataKey="cpa" stroke="#ef4444" strokeWidth={2} dot={false} name="CPA" />
                            <Line yAxisId="right" type="monotone" dataKey="cpc" stroke="#f59e0b" strokeWidth={2} dot={false} name="CPC" />
                          </ComposedChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CTR & Engagement Rate Chart */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><BarChart3 className="w-5 h-5" /><span>CTR & Engagement Rate</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [`${formatPct(Number(v))}`, name]} />
                            <Line type="monotone" dataKey="ctr" stroke="#3b82f6" strokeWidth={2} dot={false} name="CTR %" />
                            <Line type="monotone" dataKey="engagementRate" stroke="#10b981" strokeWidth={2} dot={false} name="Engagement Rate %" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CPM Chart */}
                  {hasAdPlatforms && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><DollarSign className="w-5 h-5" /><span>CPM Trend</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-56">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={crossPlatformData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis className="text-xs" />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => [fmtCur(Number(v)), 'CPM']} />
                              <Area type="monotone" dataKey="cpm" fill="#8b5cf6" fillOpacity={0.15} stroke="#8b5cf6" strokeWidth={2} name="CPM ($)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 3: CONVERSION FUNNEL ═══════════ */}
            <TabsContent value="funnel" className={`space-y-6 fade-in chart-transition ${isRefreshing ? 'chart-refreshing' : ''}`}>
              {!hasData ? (
                <Card><CardContent className="p-8 text-center"><Layers className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><h3 className="text-lg font-semibold text-foreground mb-2">No Funnel Data</h3><p className="text-sm text-muted-foreground/70">Connect an ad platform to see conversion funnel trends.</p></CardContent></Card>
              ) : (
                <>
                  {/* Funnel Summary Cards */}
                  <div className="grid gap-4 md:grid-cols-4">
                    {[
                      { label: 'Total Impressions', value: fmtNum(crossPlatformData.current.impressions) },
                      { label: 'Click-Through Rate', value: `${formatPct(crossPlatformData.current.ctr)}` },
                      { label: 'Conversion Rate', value: formatPct(crossPlatformData.current.clicks > 0 ? (crossPlatformData.current.conversions / crossPlatformData.current.clicks) * 100 : 0) },
                      { label: 'Cost per Conversion', value: fmtCur(crossPlatformData.current.cpa) },
                    ].map((c, i) => (
                      <Card key={i}><CardContent className="p-4"><div className="text-xs text-muted-foreground mb-1">{c.label}</div><div className="text-xl font-bold text-foreground">{c.value}</div></CardContent></Card>
                    ))}
                  </div>

                  {/* Conversion Rates Over Time */}
                  <Card>
                    <CardHeader><CardTitle className="flex items-center space-x-2"><TrendingUp className="w-5 h-5" /><span>Conversion Rates Over Time</span></CardTitle></CardHeader>
                    <CardContent>
                      <div className="h-72">
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [`${formatPct(Number(v))}`, name]} />
                            <Line type="monotone" dataKey="ctr" stroke="#3b82f6" strokeWidth={2} dot={false} name="CTR (Impressions → Clicks)" />
                            <Line type="monotone" dataKey="convRate" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Conv Rate (Clicks → Conversions)" />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Funnel Stacked Area */}
                  {hasAdPlatforms && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><Layers className="w-5 h-5" /><span>Funnel Volume Trends</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={crossPlatformData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis yAxisId="left" className="text-xs" />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [Number(v).toLocaleString(), name]} />
                              <Area yAxisId="left" type="monotone" dataKey="impressions" fill="#3b82f6" fillOpacity={0.1} stroke="#3b82f6" strokeWidth={1.5} name="Impressions" />
                              <Line yAxisId="left" type="monotone" dataKey="clicks" stroke="#06b6d4" strokeWidth={2} dot={false} name="Clicks" />
                              <Bar yAxisId="right" dataKey="conversions" fill="#8b5cf6" fillOpacity={0.7} name="Conversions" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* GA4 Engagement Funnel */}
                  {crossPlatformData.current.users > 0 && (
                    <Card>
                      <CardHeader><CardTitle className="flex items-center space-x-2"><BarChart3 className="w-5 h-5" /><span>GA4 Engagement Funnel</span></CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-72">
                          <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={crossPlatformData.series}>
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis dataKey="label" className="text-xs" />
                              <YAxis yAxisId="left" className="text-xs" />
                              <YAxis yAxisId="right" orientation="right" className="text-xs" domain={[0, 100]} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [name.includes('Rate') ? `${Number(v).toFixed(1)}%` : Number(v).toLocaleString(), name]} />
                              <Area yAxisId="left" type="monotone" dataKey="ga4_users" fill="#E37400" fillOpacity={0.1} stroke="#E37400" strokeWidth={1.5} name="Users" />
                              <Line yAxisId="left" type="monotone" dataKey="ga4_sessions" stroke="#3b82f6" strokeWidth={2} dot={false} name="Sessions" />
                              <Bar yAxisId="left" dataKey="ga4_conversions" fill="#10b981" fillOpacity={0.7} name="Conversions" />
                              <Line yAxisId="right" type="monotone" dataKey="engagementRate" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Engagement Rate %" />
                            </ComposedChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 4: PLATFORM BREAKDOWN ═══════════ */}
            <TabsContent value="platforms" className={`space-y-6 fade-in chart-transition ${isRefreshing ? 'chart-refreshing' : ''}`}>
              {!hasData || !crossPlatformData.platformTotals.length ? (
                <Card><CardContent className="p-8 text-center"><GitCompare className="w-12 h-12 mx-auto text-muted-foreground/60 mb-4" /><h3 className="text-lg font-semibold text-foreground mb-2">No Platform Data</h3><p className="text-sm text-muted-foreground/70">Connect at least one ad platform to see breakdown analysis.</p></CardContent></Card>
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
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Spend</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Impressions</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Clicks</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CTR</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">Conversions</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CPA</th>
                              <th className="text-right py-3 px-2 font-medium text-muted-foreground">CPC</th>
                            </tr>
                          </thead>
                          <tbody>
                            {crossPlatformData.platformTotals.map((p, i) => {
                              const bestCpa = Math.min(...crossPlatformData.platformTotals.filter(x => x.cpa > 0).map(x => x.cpa));
                              const bestCpc = Math.min(...crossPlatformData.platformTotals.filter(x => x.cpc > 0).map(x => x.cpc));
                              return (
                                <tr key={i} className="border-b border-slate-100">
                                  <td className="py-3 px-2">
                                    <div className="flex items-center space-x-2">
                                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.color }} />
                                      <span className="font-medium text-foreground">{p.platform}</span>
                                    </div>
                                  </td>
                                  <td className="text-right py-3 px-2">{fmtCur(p.spend)}</td>
                                  <td className="text-right py-3 px-2">{fmtNum(p.impressions)}</td>
                                  <td className="text-right py-3 px-2">{fmtNum(p.clicks)}</td>
                                  <td className="text-right py-3 px-2">{formatPct(p.ctr)}</td>
                                  <td className="text-right py-3 px-2">{fmtNum(p.conversions)}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpa > 0 && p.cpa === bestCpa ? 'text-green-600 font-semibold' : ''}`}>{p.cpa > 0 ? fmtCur(p.cpa) : '—'}</td>
                                  <td className={`text-right py-3 px-2 ${p.cpc > 0 && p.cpc === bestCpc ? 'text-green-600 font-semibold' : ''}`}>{p.cpc > 0 ? fmtCur(p.cpc) : '—'}</td>
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
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                              <Pie
                                data={crossPlatformData.platformTotals.filter(p => p.spend > 0)}
                                dataKey="spend"
                                nameKey="platform"
                                cx="50%" cy="50%"
                                outerRadius={80}
                                label={({ platform, percent }) => `${platform} ${(percent * 100).toFixed(0)}%`}
                              >
                                {crossPlatformData.platformTotals.filter(p => p.spend > 0).map((p, i) => (
                                  <Cell key={i} fill={p.color} />
                                ))}
                              </Pie>
                              <Tooltip formatter={(v: any) => fmtCur(Number(v))} />
                            </PieChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Efficiency Comparison */}
                    <Card>
                      <CardHeader><CardTitle>Efficiency Comparison</CardTitle></CardHeader>
                      <CardContent>
                        <div className="h-64">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={crossPlatformData.platformTotals} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                              <XAxis type="number" className="text-xs" />
                              <YAxis dataKey="platform" type="category" className="text-xs" width={80} />
                              <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmtCur(Number(v))} />
                              <Bar dataKey="cpa" fill="#ef4444" name="CPA" />
                              <Bar dataKey="cpc" fill="#f59e0b" name="CPC" />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Platform Trends Stacked Bar */}
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>Platform Trends</CardTitle>
                        <Select value={platformMetric} onValueChange={setPlatformMetric}>
                          <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spend">Spend</SelectItem>
                            <SelectItem value="clicks">Clicks</SelectItem>
                            <SelectItem value="conversions">Conversions</SelectItem>
                            <SelectItem value="impressions">Impressions</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={crossPlatformData.series}>
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis dataKey="label" className="text-xs" />
                            <YAxis className="text-xs" />
                            <Tooltip contentStyle={tooltipStyle} formatter={(v: any, name: string) => [platformMetric === 'spend' ? fmtCur(Number(v)) : Number(v).toLocaleString(), name]} />
                            <Bar dataKey={`li_${platformMetric}`} stackId="a" fill={PLATFORM_COLORS.linkedin} name="LinkedIn" />
                            <Bar dataKey={`meta_${platformMetric}`} stackId="a" fill={PLATFORM_COLORS.meta} name="Meta" />
                            <Bar dataKey={`gads_${platformMetric}`} stackId="a" fill={PLATFORM_COLORS.google_ads} name="Google Ads" />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ═══════════ TAB 5: MARKET TRENDS ═══════════ */}
            <TabsContent value="market" className="space-y-6 fade-in">
              {/* Keyword Configuration */}
              {(!(campaign as any)?.trendKeywords?.length || isConfiguring) && (
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2"><Settings className="w-5 h-5" /><span>Configure Keyword Tracking</span></CardTitle>
                    <p className="text-sm text-muted-foreground/70">Add keywords to track search interest from Google Trends.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Industry (Optional)</label>
                      <Input placeholder="e.g., Wine, Digital Marketing" value={industry} onChange={(e) => setIndustry(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground mb-2 block">Trend Keywords *</label>
                      <div className="flex items-center space-x-2 mb-3">
                        <Input placeholder="e.g., wine" value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleAddKeyword()} />
                        <Button onClick={handleAddKeyword} size="sm"><Plus className="w-4 h-4" /></Button>
                      </div>
                      {keywords.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {keywords.map((kw, idx) => (
                            <Badge key={idx} variant="secondary">{kw}<button onClick={() => handleRemoveKeyword(kw)} className="ml-2 hover:text-red-600"><X className="w-3 h-3" /></button></Badge>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button onClick={handleSaveKeywords} disabled={updateKeywordsMutation.isPending}>
                        {updateKeywordsMutation.isPending ? "Saving..." : "Save & Track Trends"}
                      </Button>
                      {isConfiguring && (campaign as any)?.trendKeywords?.length > 0 && (
                        <Button variant="ghost" onClick={() => { setIsConfiguring(false); setKeywords([]); setIndustry(""); setNewKeyword(""); }}>Cancel</Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Configure button + View on Google Trends link */}
              {(campaign as any)?.trendKeywords?.length > 0 && !isConfiguring && (
                <div className="flex justify-between items-center">
                  <div className="flex flex-wrap gap-2">
                    {((campaign as any).trendKeywords || []).map((kw: string, idx: number) => (
                      <Badge key={idx} variant="outline" className="text-xs">{kw}</Badge>
                    ))}
                  </div>
                  <div className="flex space-x-2">
                    {trendsEmbedUrls && (
                      <Button variant="outline" size="sm" asChild>
                        <a href={trendsEmbedUrls.explore} target="_blank" rel="noopener noreferrer">
                          <ArrowUpRight className="w-4 h-4 mr-2" />View on Google Trends
                        </a>
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setIsConfiguring(true); setIndustry((campaign as any).industry || ""); setKeywords((campaign as any).trendKeywords || []); }}>
                      <Settings className="w-4 h-4 mr-2" />Configure Keywords
                    </Button>
                  </div>
                </div>
              )}

              {/* Google Trends Embed Widgets */}
              {(campaign as any)?.trendKeywords?.length > 0 && !isConfiguring && trendsEmbedUrls ? (
                <>
                  {/* Interest Over Time */}
                  <Card>
                    <CardHeader><CardTitle>Search Interest Over Time</CardTitle></CardHeader>
                    <CardContent>
                      <iframe
                        src={trendsEmbedUrls.timeseries}
                        width="100%"
                        height="400"
                        frameBorder="0"
                        style={{ border: "none" }}
                        title="Google Trends - Interest Over Time"
                      />
                    </CardContent>
                  </Card>

                  {/* Geographic Interest */}
                  <Card>
                    <CardHeader><CardTitle>Interest by Region</CardTitle></CardHeader>
                    <CardContent>
                      <iframe
                        src={trendsEmbedUrls.geo}
                        width="100%"
                        height="400"
                        frameBorder="0"
                        style={{ border: "none" }}
                        title="Google Trends - Interest by Region"
                      />
                    </CardContent>
                  </Card>

                  {/* Related Queries */}
                  <Card>
                    <CardHeader><CardTitle>Related Queries</CardTitle></CardHeader>
                    <CardContent>
                      <iframe
                        src={trendsEmbedUrls.related}
                        width="100%"
                        height="400"
                        frameBorder="0"
                        style={{ border: "none" }}
                        title="Google Trends - Related Queries"
                      />
                    </CardContent>
                  </Card>
                </>
              ) : !isConfiguring ? (
                <Card>
                  <CardContent className="p-12 text-center">
                    <Search className="w-16 h-16 mx-auto text-muted-foreground/60 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground mb-2">Market Trends</h3>
                    <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">
                      Track Google search trends for keywords related to your campaign. This is optional — your performance data is available in the other tabs.
                    </p>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
}
