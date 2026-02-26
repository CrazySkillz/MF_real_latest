import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { useState, useMemo } from "react";
import Navigation from "@/components/layout/navigation";
import Sidebar from "@/components/layout/sidebar";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowUpDown, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Video, Search, Activity, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Filter, RefreshCw, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { GoogleAdsKpiModal } from "./google-ads-analytics/GoogleAdsKpiModal";
import { GoogleAdsBenchmarkModal } from "./google-ads-analytics/GoogleAdsBenchmarkModal";
import { GoogleAdsReportModal } from "./google-ads-analytics/GoogleAdsReportModal";

// Google Ads metric definitions for KPIs and Benchmarks
const GOOGLE_ADS_METRICS = [
  { key: 'impressions', label: 'Impressions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'clicks', label: 'Clicks', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'conversions', label: 'Conversions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'spend', label: 'Spend', unit: '$', format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'videoViews', label: 'Video Views', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'ctr', label: 'CTR', unit: '%', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'cpc', label: 'CPC', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpm', label: 'CPM', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'conversionRate', label: 'Conversion Rate', unit: '%', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'costPerConversion', label: 'Cost per Conversion', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'searchImpressionShare', label: 'Search Imp. Share', unit: '%', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'roas', label: 'ROAS', unit: 'x', format: (v: number) => `${v.toFixed(2)}x` },
];

const LOWER_IS_BETTER_METRICS = ['cpc', 'cpm', 'costPerConversion', 'spend'];

const METRIC_OPTIONS = [
  { key: "spend", label: "Spend", format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, color: "#8b5cf6" },
  { key: "impressions", label: "Impressions", format: (v: number) => v.toLocaleString(), color: "#3b82f6" },
  { key: "clicks", label: "Clicks", format: (v: number) => v.toLocaleString(), color: "#10b981" },
  { key: "conversions", label: "Conversions", format: (v: number) => v.toLocaleString(), color: "#f59e0b" },
  { key: "ctr", label: "CTR (%)", format: (v: number) => `${v.toFixed(2)}%`, color: "#ef4444" },
  { key: "cpc", label: "CPC", format: (v: number) => `$${v.toFixed(2)}`, color: "#ec4899" },
  { key: "cpm", label: "CPM", format: (v: number) => `$${v.toFixed(2)}`, color: "#6366f1" },
  { key: "videoViews", label: "Video Views", format: (v: number) => v.toLocaleString(), color: "#14b8a6" },
  { key: "conversionRate", label: "Conversion Rate (%)", format: (v: number) => `${v.toFixed(2)}%`, color: "#f97316" },
  { key: "searchImpressionShare", label: "Search Imp. Share (%)", format: (v: number) => `${v.toFixed(2)}%`, color: "#a855f7" },
  { key: "roas", label: "ROAS", format: (v: number) => `${v.toFixed(2)}x`, color: "#059669" },
];

function getGoogleAdsMetricDef(metricKey: string) {
  return GOOGLE_ADS_METRICS.find(m => m.key === metricKey) || { key: metricKey, label: metricKey, unit: '', format: (v: number) => String(v) };
}

function formatGoogleAdsMetricValue(metricKey: string, value: number): string {
  return getGoogleAdsMetricDef(metricKey).format(value);
}

interface DailyMetric {
  date: string;
  impressions: number;
  clicks: number;
  spend: string;
  conversions: string;
  conversionValue: string;
  ctr: string;
  cpc: string;
  cpm: string;
  videoViews: number;
  searchImpressionShare: string;
  costPerConversion: string | null;
  conversionRate: string | null;
  googleCampaignName: string;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

export default function GoogleAdsAnalytics() {
  const [, params] = useRoute("/campaigns/:id/google-ads-analytics");
  const campaignId = params?.id;
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // KPI state
  const [isKPIModalOpen, setIsKPIModalOpen] = useState(false);
  const [editingKPI, setEditingKPI] = useState<any>(null);
  const [kpiForm, setKpiForm] = useState({
    name: '', metric: '', targetValue: '', description: '', currentValue: '', unit: '',
    priority: 'high', status: 'active', category: '', timeframe: 'monthly', trackingPeriod: '30',
    alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
    alertThreshold: '', alertCondition: 'below', emailRecipients: '',
  });

  // Benchmark state
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '',
    benchmarkType: 'industry' as 'industry' | 'custom',
    alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
    alertThreshold: '', alertCondition: 'below', emailRecipients: '',
  });

  // Ad comparison state
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');

  // Insights state
  const [insightsTrendMetric, setInsightsTrendMetric] = useState('spend');
  const [insightsTrendMode, setInsightsTrendMode] = useState<'daily' | '7d' | '30d'>('daily');
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);

  // Reports state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [reportFormErrors, setReportFormErrors] = useState<any>({});
  const [customReportConfig, setCustomReportConfig] = useState<any>({
    coreMetrics: [], derivedMetrics: [], campaignBreakdown: [],
    kpis: [], benchmarks: [], insights: [],
  });
  const [reportForm, setReportForm] = useState<any>({
    name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly',
    scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false,
    scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end',
  });

  // Fetch connection
  const { data: connection } = useQuery({
    queryKey: ["/api/google-ads", campaignId, "connection"],
    queryFn: async () => {
      const res = await fetch(`/api/google-ads/${campaignId}/connection`);
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Refresh data mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/google-ads/${campaignId}/refresh`, { method: 'POST' });
      if (!res.ok) throw new Error('Failed to refresh');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/google-ads", campaignId] });
      toast({ title: 'Data Refreshed', description: 'Google Ads metrics updated.' });
    },
    onError: (err: any) => {
      toast({ title: 'Refresh Failed', description: err.message, variant: 'destructive' });
    },
  });

  // Fetch daily metrics (hardcoded 90-day window)
  const { data: metricsData, isLoading } = useQuery({
    queryKey: ["/api/google-ads", campaignId, "daily-metrics"],
    queryFn: async () => {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 90 * 86400000).toISOString().slice(0, 10);
      const res = await fetch(`/api/google-ads/${campaignId}/daily-metrics?startDate=${start}&endDate=${end}`);
      if (!res.ok) return { metrics: [] };
      return res.json();
    },
    enabled: !!campaignId,
  });

  const metrics: DailyMetric[] = metricsData?.metrics || [];

  // Fetch KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/google_ads/kpis', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/platforms/google_ads/kpis/${campaignId}`);
      if (!res.ok) throw new Error('Failed to fetch KPIs');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Fetch Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'google_ads'],
    queryFn: async () => {
      const res = await fetch(`/api/campaigns/${campaignId}/benchmarks/evaluated?platform=google_ads`);
      if (!res.ok) throw new Error('Failed to fetch Benchmarks');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // KPI mutations
  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/platforms/google_ads/kpis', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId }),
      });
      if (!res.ok) throw new Error('Failed to create KPI');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_ads/kpis'] });
      setIsKPIModalOpen(false); setEditingKPI(null);
      toast({ title: 'KPI created successfully' });
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/platforms/google_ads/kpis/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update KPI');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_ads/kpis'] });
      setIsKPIModalOpen(false); setEditingKPI(null);
      toast({ title: 'KPI updated successfully' });
    },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/platforms/google_ads/kpis/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete KPI');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/google_ads/kpis'] });
      toast({ title: 'KPI deleted' });
    },
  });

  // Benchmark mutations
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(`/api/campaigns/${campaignId}/benchmarks`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId, platform: 'google_ads' }),
      });
      if (!res.ok) throw new Error('Failed to create benchmark');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      setIsBenchmarkModalOpen(false); setEditingBenchmark(null);
      toast({ title: 'Benchmark created successfully' });
    },
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/benchmarks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update benchmark');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      setIsBenchmarkModalOpen(false); setEditingBenchmark(null);
      toast({ title: 'Benchmark updated successfully' });
    },
  });

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/benchmarks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete benchmark');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      toast({ title: 'Benchmark deleted' });
    },
  });

  // Fetch Reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/google-ads/reports', campaignId],
    queryFn: async () => {
      const res = await fetch(`/api/meta/reports?campaignId=${campaignId}&platformType=google_ads`);
      if (!res.ok) throw new Error('Failed to fetch Reports');
      return res.json();
    },
    enabled: !!campaignId,
  });

  // Report mutations
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/meta/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId, platformType: 'google_ads' }),
      });
      if (!res.ok) throw new Error('Failed to create report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-ads/reports'] });
      setIsReportModalOpen(false); setEditingReport(null);
      toast({ title: 'Report created successfully' });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const res = await fetch(`/api/meta/reports/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-ads/reports'] });
      setIsReportModalOpen(false); setEditingReport(null);
      toast({ title: 'Report updated successfully' });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/meta/reports/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete report');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/google-ads/reports'] });
      toast({ title: 'Report deleted' });
    },
  });

  // Aggregate summary (useMemo MUST be before conditional returns)
  const summary = useMemo(() => {
    if (!metrics.length) return null;
    const totals = metrics.reduce(
      (acc, m) => ({
        impressions: acc.impressions + (m.impressions || 0),
        clicks: acc.clicks + (m.clicks || 0),
        spend: acc.spend + parseFloat(m.spend || "0"),
        conversions: acc.conversions + parseFloat(m.conversions || "0"),
        conversionValue: acc.conversionValue + parseFloat(m.conversionValue || "0"),
        videoViews: acc.videoViews + (m.videoViews || 0),
        searchImpressionShareSum: acc.searchImpressionShareSum + parseFloat(m.searchImpressionShare || "0"),
        searchImpressionShareCount: acc.searchImpressionShareCount + (parseFloat(m.searchImpressionShare || "0") > 0 ? 1 : 0),
      }),
      { impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, videoViews: 0, searchImpressionShareSum: 0, searchImpressionShareCount: 0 }
    );
    const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
    const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
    const cpm = totals.impressions > 0 ? (totals.spend / totals.impressions) * 1000 : 0;
    const convRate = totals.clicks > 0 ? (totals.conversions / totals.clicks) * 100 : 0;
    const costPerConv = totals.conversions > 0 ? totals.spend / totals.conversions : 0;
    const searchImpressionShare = totals.searchImpressionShareCount > 0 ? totals.searchImpressionShareSum / totals.searchImpressionShareCount : 0;
    const roas = totals.spend > 0 ? totals.conversionValue / totals.spend : 0;
    const roi = totals.spend > 0 ? ((totals.conversionValue - totals.spend) / totals.spend) * 100 : 0;
    return { ...totals, ctr, cpc, cpm, convRate, costPerConv, searchImpressionShare, roas, roi };
  }, [metrics]);

  // Chart data (aggregated by date)
  const chartData = useMemo(() => {
    const byDate = new Map<string, any>();
    for (const m of metrics) {
      const existing = byDate.get(m.date) || {
        date: m.date, impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, videoViews: 0,
        ctr: 0, cpc: 0, cpm: 0, conversionRate: 0, searchImpressionShare: 0, _count: 0,
      };
      existing.impressions += m.impressions || 0;
      existing.clicks += m.clicks || 0;
      existing.spend += parseFloat(m.spend || "0");
      existing.conversions += parseFloat(m.conversions || "0");
      existing.conversionValue += parseFloat(m.conversionValue || "0");
      existing.videoViews += m.videoViews || 0;
      existing.ctr += parseFloat(m.ctr || "0");
      existing.searchImpressionShare += parseFloat(m.searchImpressionShare || "0");
      existing._count += 1;
      byDate.set(m.date, existing);
    }
    return Array.from(byDate.values())
      .map((d) => ({
        ...d,
        ctr: d._count > 0 ? d.ctr / d._count : 0,
        cpc: d.clicks > 0 ? d.spend / d.clicks : 0,
        cpm: d.impressions > 0 ? (d.spend / d.impressions) * 1000 : 0,
        conversionRate: d.clicks > 0 ? (d.conversions / d.clicks) * 100 : 0,
        searchImpressionShare: d._count > 0 ? d.searchImpressionShare / d._count : 0,
        roas: d.spend > 0 ? d.conversionValue / d.spend : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [metrics]);

  // Campaign breakdown for Ad Comparison tab
  const campaignBreakdown = useMemo(() => {
    const byName = new Map<string, any>();
    for (const m of metrics) {
      const name = m.googleCampaignName || 'Unknown Campaign';
      const existing = byName.get(name) || { name, impressions: 0, clicks: 0, spend: 0, conversions: 0, conversionValue: 0, videoViews: 0, days: 0 };
      existing.impressions += m.impressions || 0;
      existing.clicks += m.clicks || 0;
      existing.spend += parseFloat(m.spend || "0");
      existing.conversions += parseFloat(m.conversions || "0");
      existing.conversionValue += parseFloat(m.conversionValue || "0");
      existing.videoViews += m.videoViews || 0;
      existing.days += 1;
      byName.set(name, existing);
    }
    return Array.from(byName.values()).map(c => ({
      ...c,
      ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      cpm: c.impressions > 0 ? (c.spend / c.impressions) * 1000 : 0,
      conversionRate: c.clicks > 0 ? (c.conversions / c.clicks) * 100 : 0,
      costPerConversion: c.conversions > 0 ? c.spend / c.conversions : 0,
      roas: c.spend > 0 ? c.conversionValue / c.spend : 0,
      roi: c.spend > 0 ? ((c.conversionValue - c.spend) / c.spend) * 100 : 0,
    }));
  }, [metrics]);

  // Daily series for Insights tab (Daily/7d/30d)
  const dailySeries = useMemo(() => {
    const byDate = chartData;

    const rolling = (windowDays: number) => {
      const out: any[] = [];
      for (let i = 0; i < byDate.length; i++) {
        const startIdx = Math.max(0, i - windowDays + 1);
        const slice = byDate.slice(startIdx, i + 1);
        if (slice.length < windowDays) continue;
        const sums = slice.reduce(
          (acc: any, r: any) => {
            acc.impressions += r.impressions;
            acc.clicks += r.clicks;
            acc.conversions += r.conversions;
            acc.spend += r.spend;
            acc.conversionValue += r.conversionValue || 0;
            return acc;
          },
          { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 }
        );
        const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
        const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
        const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
        const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
        const costPerConversion = sums.conversions > 0 ? sums.spend / sums.conversions : 0;
        const roas = sums.spend > 0 ? sums.conversionValue / sums.spend : 0;
        out.push({ date: byDate[i].date, ...sums, ctr, cpc, cpm, conversionRate, costPerConversion, roas });
      }
      return out;
    };

    return { daily: byDate, rolling7: rolling(7), rolling30: rolling(30) };
  }, [chartData]);

  // Insights rollups
  const insightsRollups = useMemo(() => {
    const byDate = dailySeries.daily;
    const dates = byDate.map((r: any) => r.date);

    const rollup = (n: number, offsetFromEnd: number = 0) => {
      const endIdx = Math.max(0, dates.length - offsetFromEnd);
      const startIdx = Math.max(0, endIdx - n);
      const slice = byDate.slice(startIdx, endIdx);
      const sums = slice.reduce(
        (acc: any, r: any) => {
          acc.impressions += r.impressions;
          acc.clicks += r.clicks;
          acc.conversions += r.conversions;
          acc.spend += r.spend;
          acc.conversionValue += r.conversionValue || 0;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, conversionValue: 0 }
      );
      const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
      const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
      const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
      const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
      const costPerConversion = sums.conversions > 0 ? sums.spend / sums.conversions : 0;
      const roas = sums.spend > 0 ? sums.conversionValue / sums.spend : 0;
      return { ...sums, ctr, cpc, cpm, conversionRate, costPerConversion, roas, startDate: slice[0]?.date || null, endDate: slice[slice.length - 1]?.date || null, days: slice.length };
    };

    const last7 = rollup(7, 0);
    const prior7 = rollup(7, 7);
    const last30 = rollup(30, 0);
    const prior30 = rollup(30, 30);
    const deltaPct = (cur: number, prev: number) => (prev > 0 ? ((cur - prev) / prev) * 100 : cur > 0 ? 100 : 0);

    return {
      availableDays: dates.length,
      last7, prior7, last30, prior30,
      deltas: {
        impressions7: deltaPct(last7.impressions, prior7.impressions),
        clicks7: deltaPct(last7.clicks, prior7.clicks),
        conversions7: deltaPct(last7.conversions, prior7.conversions),
        spend7: deltaPct(last7.spend, prior7.spend),
        ctr7: prior7.ctr > 0 ? ((last7.ctr - prior7.ctr) / prior7.ctr) * 100 : 0,
        cpc7: prior7.cpc > 0 ? ((last7.cpc - prior7.cpc) / prior7.cpc) * 100 : 0,
        cpm7: prior7.cpm > 0 ? ((last7.cpm - prior7.cpm) / prior7.cpm) * 100 : 0,
        conversionRate7: prior7.conversionRate > 0 ? ((last7.conversionRate - prior7.conversionRate) / prior7.conversionRate) * 100 : 0,
        costPerConversion7: prior7.costPerConversion > 0 ? ((last7.costPerConversion - prior7.costPerConversion) / prior7.costPerConversion) * 100 : 0,
        roas7: prior7.roas > 0 ? ((last7.roas - prior7.roas) / prior7.roas) * 100 : 0,
        impressions30: deltaPct(last30.impressions, prior30.impressions),
        clicks30: deltaPct(last30.clicks, prior30.clicks),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        spend30: deltaPct(last30.spend, prior30.spend),
        ctr30: prior30.ctr > 0 ? ((last30.ctr - prior30.ctr) / prior30.ctr) * 100 : 0,
        cpc30: prior30.cpc > 0 ? ((last30.cpc - prior30.cpc) / prior30.cpc) * 100 : 0,
        cpm30: prior30.cpm > 0 ? ((last30.cpm - prior30.cpm) / prior30.cpm) * 100 : 0,
        conversionRate30: prior30.conversionRate > 0 ? ((last30.conversionRate - prior30.conversionRate) / prior30.conversionRate) * 100 : 0,
        costPerConversion30: prior30.costPerConversion > 0 ? ((last30.costPerConversion - prior30.costPerConversion) / prior30.costPerConversion) * 100 : 0,
        roas30: prior30.roas > 0 ? ((last30.roas - prior30.roas) / prior30.roas) * 100 : 0,
      },
    };
  }, [dailySeries]);

  // Format date helper
  const formatShortDate = (yyyyMmDd: string) => {
    const s = String(yyyyMmDd || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `'${m[1].slice(-2)}-${m[2]}-${m[3]}`;
  };

  const fmt = (v: number) => v.toLocaleString();
  const fmtCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const fmtPct = (v: number) => `${v.toFixed(2)}%`;

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading Google Ads analytics...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  // No data state
  if (!summary) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 overflow-auto">
            <div className="flex items-center gap-3 mb-6">
              <Link href={`/campaigns/${campaignId}`}>
                <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
              </Link>
              <div className="flex items-center gap-2">
                <i className="fab fa-google text-yellow-600 text-xl" />
                <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Google Ads Analytics</h1>
              </div>
            </div>
            <Card>
              <CardContent className="py-12 text-center text-slate-500">
                <p className="text-lg font-medium">No data yet</p>
                <p className="text-sm mt-1">Click "Refresh Data" to generate initial metrics.</p>
              </CardContent>
            </Card>
          </main>
        </div>
      </div>
    );
  }

  // Helper: get live metric value from summary
  const getLiveMetricValue = (metricKey: string): number => {
    const map: Record<string, number> = {
      impressions: summary.impressions || 0,
      clicks: summary.clicks || 0,
      conversions: summary.conversions || 0,
      spend: summary.spend || 0,
      videoViews: summary.videoViews || 0,
      ctr: summary.ctr || 0,
      cpc: summary.cpc || 0,
      cpm: summary.cpm || 0,
      conversionRate: summary.convRate || 0,
      costPerConversion: summary.costPerConv || 0,
      searchImpressionShare: summary.searchImpressionShare || 0,
      conversionValue: summary.conversionValue || 0,
      roas: summary.roas || 0,
      roi: summary.roi || 0,
    };
    return map[metricKey] ?? 0;
  };

  // Helper: compute KPI/Benchmark progress
  const computeProgress = (current: number, target: number, metricKey: string) => {
    if (!target || target === 0) return { pct: 0, status: 'unknown' as const };
    const lowerIsBetter = LOWER_IS_BETTER_METRICS.includes(metricKey);
    let ratio: number;
    if (lowerIsBetter) {
      ratio = target / current;
    } else {
      ratio = current / target;
    }
    const pct = ratio * 100;
    const status = pct >= 90 ? 'on_track' as const : pct >= 70 ? 'needs_attention' as const : 'behind' as const;
    return { pct, status };
  };

  // KPI tracker stats
  const kpiTracker = (() => {
    const items = Array.isArray(kpisData) ? kpisData : [];
    let onTrack = 0, needsAttention = 0, behind = 0, totalPct = 0;
    items.forEach((kpi: any) => {
      const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
      const target = parseFloat(kpi.targetValue || '0');
      const p = computeProgress(current, target, kpi.metric || kpi.metricKey || '');
      if (p.status === 'on_track') onTrack++;
      else if (p.status === 'needs_attention') needsAttention++;
      else behind++;
      totalPct += Math.min(p.pct, 200);
    });
    return { total: items.length, onTrack, needsAttention, behind, avgPct: items.length > 0 ? totalPct / items.length : 0 };
  })();

  // Benchmark tracker stats
  const benchmarkTracker = (() => {
    const items = Array.isArray(benchmarksData) ? benchmarksData : [];
    let onTrack = 0, needsAttention = 0, behind = 0, totalPct = 0;
    items.forEach((b: any) => {
      const current = getLiveMetricValue(b.metric || '');
      const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
      const p = computeProgress(current, benchVal, b.metric || '');
      if (p.status === 'on_track') onTrack++;
      else if (p.status === 'needs_attention') needsAttention++;
      else behind++;
      totalPct += Math.min(p.pct, 200);
    });
    return { total: items.length, onTrack, needsAttention, behind, avgPct: items.length > 0 ? totalPct / items.length : 0 };
  })();

  // Ad comparison chart data — reacts to sortBy
  const campaignPerformanceChartMetric = sortBy === 'name' ? 'spend' : sortBy;
  const campaignPerformanceData = [...campaignBreakdown]
    .sort((a: any, b: any) => (b[campaignPerformanceChartMetric] || 0) - (a[campaignPerformanceChartMetric] || 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
      value: campaignPerformanceChartMetric === 'spend' ? Math.round(c.spend * 100) / 100
        : campaignPerformanceChartMetric === 'impressions' ? c.impressions
        : campaignPerformanceChartMetric === 'clicks' ? c.clicks
        : campaignPerformanceChartMetric === 'conversions' ? Math.round(c.conversions)
        : campaignPerformanceChartMetric === 'ctr' ? Math.round(c.ctr * 100) / 100
        : Math.round((c as any)[campaignPerformanceChartMetric] * 100) / 100,
    }));

  const campaignChartLabel = sortBy === 'name' ? 'Spend ($)' : sortBy === 'spend' ? 'Spend ($)' : sortBy === 'impressions' ? 'Impressions' : sortBy === 'clicks' ? 'Clicks' : sortBy === 'conversions' ? 'Conversions' : sortBy === 'ctr' ? 'CTR (%)' : sortBy;

  const spendDistribution = campaignBreakdown.map(c => ({
    name: c.name.length > 20 ? c.name.substring(0, 20) + '...' : c.name,
    value: Math.round(c.spend * 100) / 100,
  }));

  // Ad comparison performance rankings
  const bestPerforming = [...campaignBreakdown].sort((a, b) => b.conversions - a.conversions)[0];
  const mostEfficient = [...campaignBreakdown].sort((a, b) => (a.cpc || Infinity) - (b.cpc || Infinity))[0];
  const needsAttentionCampaign = [...campaignBreakdown].sort((a, b) => (a.ctr || 0) - (b.ctr || 0))[0];

  // Handlers
  const handleCreateKPI = () => {
    const payload = {
      name: kpiForm.name, metric: kpiForm.metric, metricKey: kpiForm.metric,
      targetValue: kpiForm.targetValue,
      currentValue: kpiForm.currentValue || String(getLiveMetricValue(kpiForm.metric)),
      description: kpiForm.description,
      unit: kpiForm.unit || getGoogleAdsMetricDef(kpiForm.metric).unit,
      priority: kpiForm.priority, status: 'active', category: kpiForm.category,
      timeframe: kpiForm.timeframe, trackingPeriod: kpiForm.trackingPeriod,
      alertsEnabled: kpiForm.alertsEnabled, emailNotifications: kpiForm.emailNotifications,
      alertFrequency: kpiForm.alertFrequency, alertThreshold: kpiForm.alertThreshold,
      alertCondition: kpiForm.alertCondition, emailRecipients: kpiForm.emailRecipients,
      platformType: 'google_ads',
    };
    if (editingKPI) {
      updateKpiMutation.mutate({ id: editingKPI.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  const handleCreateBenchmark = () => {
    const payload = {
      name: benchmarkForm.name, metric: benchmarkForm.metric,
      benchmarkValue: benchmarkForm.benchmarkValue, targetValue: benchmarkForm.benchmarkValue,
      currentValue: benchmarkForm.currentValue || String(getLiveMetricValue(benchmarkForm.metric)),
      description: benchmarkForm.description, industry: benchmarkForm.industry,
      unit: benchmarkForm.unit || getGoogleAdsMetricDef(benchmarkForm.metric).unit,
      benchmarkType: benchmarkForm.benchmarkType,
      alertsEnabled: benchmarkForm.alertsEnabled, emailNotifications: benchmarkForm.emailNotifications,
      alertFrequency: benchmarkForm.alertFrequency, alertThreshold: benchmarkForm.alertThreshold,
      alertCondition: benchmarkForm.alertCondition, emailRecipients: benchmarkForm.emailRecipients,
      platformType: 'google_ads', platform: 'google_ads',
    };
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: payload });
    } else {
      createBenchmarkMutation.mutate(payload);
    }
  };

  const handleReportTypeSelect = (type: string) => {
    const nameMap: Record<string, string> = {
      overview: 'Google Ads Overview Report', kpis: 'Google Ads KPIs Report',
      benchmarks: 'Google Ads Benchmarks Report', ads: 'Google Ads Campaign Comparison Report',
      insights: 'Google Ads Insights Report', custom: 'Custom Report',
    };
    setReportForm((prev: any) => ({ ...prev, reportType: type, name: prev.name || nameMap[type] || 'Google Ads Report' }));
  };

  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled && !String(reportForm.emailRecipients || '').trim()) {
      setReportFormErrors({ emailRecipients: 'Email recipients are required for scheduled reports' });
      return;
    }
    const payload = { ...reportForm, status: 'active', platformType: 'google_ads' };
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const handleUpdateReport = handleCreateReport;

  const handleCustomReport = () => {
    const payload = { ...reportForm, reportType: 'custom', customConfig: customReportConfig, status: 'active', platformType: 'google_ads' };
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const getTimeZoneDisplay = () => userTimeZone.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 overflow-auto">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>
            </Link>
            <div className="flex items-center gap-2">
              <i className="fab fa-google text-yellow-600 text-xl" />
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Google Ads Analytics</h1>
            </div>
            {connection?.connected && (
              <Badge className="bg-blue-600 text-white ml-2">
                {connection.customerName || connection.customerId}
                {connection.method === "test_mode" && " (Test)"}
              </Badge>
            )}
            <div className="ml-auto">
              <Button variant="outline" size="sm" onClick={() => refreshMutation.mutate()} disabled={refreshMutation.isPending}>
                {refreshMutation.isPending ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <RefreshCw className="w-3 h-3 mr-1" />}
                Refresh Data
              </Button>
            </div>
          </div>

          {/* 6-Tab Layout */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="ad-comparison">Ad Comparison</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            {/* ==================== OVERVIEW TAB ==================== */}
            <TabsContent value="overview" className="space-y-6">
              {/* Primary Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                <SummaryCard icon={<Eye className="w-4 h-4" />} label="Impressions" value={fmt(summary.impressions)} />
                <SummaryCard icon={<MousePointer className="w-4 h-4" />} label="Clicks" value={fmt(summary.clicks)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Spend" value={fmtCurrency(summary.spend)} />
                <SummaryCard icon={<Target className="w-4 h-4" />} label="Conversions" value={fmt(Math.round(summary.conversions))} />
                <SummaryCard icon={<TrendingUp className="w-4 h-4" />} label="CTR" value={fmtPct(summary.ctr)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="CPC" value={fmtCurrency(summary.cpc)} />
              </div>

              {/* Secondary Metrics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="CPM" value={fmtCurrency(summary.cpm)} />
                <SummaryCard icon={<Video className="w-4 h-4" />} label="Video Views" value={fmt(summary.videoViews)} />
                <SummaryCard icon={<Target className="w-4 h-4" />} label="Conv. Rate" value={fmtPct(summary.convRate)} />
                <SummaryCard icon={<DollarSign className="w-4 h-4" />} label="Cost/Conv" value={fmtCurrency(summary.costPerConv)} />
              </div>

              {/* Financial Metrics */}
              {summary.conversionValue > 0 && (
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Financial Metrics</CardTitle>
                    <CardDescription>Revenue and efficiency metrics from Google Ads conversion tracking</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Spend</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.spend)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: Google Ads</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Conversion Value</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.conversionValue)}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total value from conversions</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.roas.toFixed(2)}x</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Conv. Value / Spend</p>
                      </div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROI</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{summary.roi.toFixed(1)}%</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">(Value - Spend) / Spend</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Performance Metrics */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                  <CardDescription>Key derived metrics across all campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">CTR</p>
                      <p className="text-xl font-bold">{fmtPct(summary.ctr)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <DollarSign className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">CPC</p>
                      <p className="text-xl font-bold">{fmtCurrency(summary.cpc)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Eye className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">CPM</p>
                      <p className="text-xl font-bold">{fmtCurrency(summary.cpm)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Target className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Cost/Conv</p>
                      <p className="text-xl font-bold">{fmtCurrency(summary.costPerConv)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Conv Rate</p>
                      <p className="text-xl font-bold">{fmtPct(summary.convRate)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <Search className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Search Imp. Share</p>
                      <p className="text-xl font-bold">{fmtPct(summary.searchImpressionShare)}</p>
                    </div>
                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <DollarSign className="h-5 w-5 text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground font-medium">Conv. Value</p>
                      <p className="text-xl font-bold">{fmtCurrency(summary.conversionValue)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== KPIS TAB ==================== */}
            <TabsContent value="kpis" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Track your Google Ads campaign KPIs and targets</p>
                </div>
                <Button
                  onClick={() => {
                    setEditingKPI(null);
                    setKpiForm({ name: '', metric: '', targetValue: '', description: '', currentValue: '', unit: '', priority: 'high', status: 'active', category: '', timeframe: 'monthly', trackingPeriod: '30', alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily', alertThreshold: '', alertCondition: 'below', emailRecipients: '' });
                    setIsKPIModalOpen(true);
                  }}
                  variant="outline" size="sm" className="border-slate-300 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add KPI
                </Button>
              </div>

              {/* Info bar */}
              <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div><span className="font-medium text-slate-700 dark:text-slate-300">KPIs:</span> {kpiTracker.total}</div>
                  <div><span className="font-medium text-slate-700 dark:text-slate-300">Campaigns:</span> {campaignBreakdown.length}</div>
                  <div><span className="font-medium text-slate-700 dark:text-slate-300">Data source:</span> Google Ads API</div>
                </div>
              </div>

              {/* Performance Tracker Panel */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{kpiTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">On Track</p><p className="text-2xl font-bold text-green-600">{kpiTracker.onTrack}</p><p className="text-xs text-slate-500">meeting or exceeding target</p></div><CheckCircle2 className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p><p className="text-2xl font-bold text-amber-600">{kpiTracker.needsAttention}</p><p className="text-xs text-slate-500">within 70-90% of target</p></div><AlertCircle className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Behind</p><p className="text-2xl font-bold text-red-600">{kpiTracker.behind}</p><p className="text-xs text-slate-500">below 70% of target</p></div><AlertTriangle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{kpiTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
              </div>

              {/* KPI Cards */}
              {kpisLoading ? (
                <div className="animate-pulse space-y-4"><div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div><div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div></div>
              ) : Array.isArray(kpisData) && kpisData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {kpisData.map((kpi: any) => {
                    const metricKey = kpi.metric || kpi.metricKey || '';
                    const metricDef = getGoogleAdsMetricDef(metricKey);
                    const currentVal = getLiveMetricValue(metricKey);
                    const targetVal = parseFloat(kpi.targetValue || '0');
                    const progress = computeProgress(currentVal, targetVal, metricKey);
                    const progressFill = Math.min(progress.pct, 100);
                    const progressColor = progress.status === 'on_track' ? 'bg-green-500' : progress.status === 'needs_attention' ? 'bg-amber-500' : 'bg-red-500';
                    const deltaPct = targetVal > 0 ? ((currentVal - targetVal) / targetVal * 100) : 0;

                    return (
                      <Card key={kpi.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <CardTitle className="text-lg">{kpi.name}</CardTitle>
                                {metricKey && <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">{metricKey.toUpperCase()}</Badge>}
                              </div>
                              <CardDescription className="text-sm">{kpi.description || `Track ${metricDef.label} performance against target`}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                onClick={() => { setEditingKPI(kpi); setKpiForm({ name: kpi.name || '', metric: metricKey, targetValue: kpi.targetValue || '', description: kpi.description || '' } as any); setIsKPIModalOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete KPI</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{kpi.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteKpiMutation.mutate(kpi.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">{formatGoogleAdsMetricValue(metricKey, currentVal)}</div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Target</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">{formatGoogleAdsMetricValue(metricKey, targetVal)}</div>
                            </div>
                          </div>
                          {targetVal > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"><span>Progress</span><span>{Math.round(progress.pct)}%</span></div>
                              <Progress value={progressFill} className="h-2" indicatorClassName={progressColor} />
                            </div>
                          )}
                          {targetVal > 0 && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {Math.abs(deltaPct) < 0.01 ? 'At target' : deltaPct > 0 ? `${Math.round(Math.abs(deltaPct))}% above target (+${deltaPct.toFixed(1)}%)` : `${Math.round(Math.abs(deltaPct))}% below target (${deltaPct.toFixed(1)}%)`}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">No KPIs have been created yet. Click "Add KPI" to track your first Google Ads performance indicator.</div>
              )}
            </TabsContent>

            {/* ==================== BENCHMARKS TAB ==================== */}
            <TabsContent value="benchmarks" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Benchmarks</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Compare your Google Ads metrics against industry benchmarks</p>
                </div>
                <Button
                  onClick={() => {
                    setEditingBenchmark(null);
                    setBenchmarkForm({ name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '', benchmarkType: 'industry', alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily', alertThreshold: '', alertCondition: 'below', emailRecipients: '' });
                    setIsBenchmarkModalOpen(true);
                  }}
                  variant="outline" size="sm" className="border-slate-300 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Benchmark
                </Button>
              </div>

              {/* Benchmark Tracker Panel */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{benchmarkTracker.total}</p></div><Target className="w-8 h-8 text-purple-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">On Track</p><p className="text-2xl font-bold text-green-600">{benchmarkTracker.onTrack}</p><p className="text-xs text-slate-500">meeting or exceeding benchmark</p></div><CheckCircle2 className="w-8 h-8 text-green-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p><p className="text-2xl font-bold text-amber-600">{benchmarkTracker.needsAttention}</p><p className="text-xs text-slate-500">within 70-90% of benchmark</p></div><AlertCircle className="w-8 h-8 text-amber-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Behind</p><p className="text-2xl font-bold text-red-600">{benchmarkTracker.behind}</p><p className="text-xs text-slate-500">below 70% of benchmark</p></div><AlertTriangle className="w-8 h-8 text-red-500" /></div></CardContent></Card>
                <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{benchmarkTracker.avgPct.toFixed(1)}%</p></div><TrendingUp className="w-8 h-8 text-violet-600" /></div></CardContent></Card>
              </div>

              {/* Benchmark Cards */}
              {benchmarksLoading ? (
                <div className="animate-pulse space-y-4"><div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div></div>
              ) : Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {benchmarksData.map((b: any) => {
                    const metricKey = b.metric || '';
                    const metricDef = getGoogleAdsMetricDef(metricKey);
                    const currentVal = getLiveMetricValue(metricKey);
                    const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                    const progress = computeProgress(currentVal, benchVal, metricKey);
                    const progressFill = Math.min(progress.pct, 100);
                    const progressColor = progress.status === 'on_track' ? 'bg-green-500' : progress.status === 'needs_attention' ? 'bg-amber-500' : 'bg-red-500';

                    return (
                      <Card key={b.id}>
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap mb-1">
                                <CardTitle className="text-lg">{b.name}</CardTitle>
                                {metricKey && <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">{metricKey.toUpperCase()}</Badge>}
                                {b.industry && <Badge variant="secondary" className="text-xs">{b.industry}</Badge>}
                              </div>
                              <CardDescription className="text-sm">{b.description || `Benchmark ${metricDef.label} against industry standards`}</CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                onClick={() => { setEditingBenchmark(b); setBenchmarkForm({ name: b.name || '', metric: metricKey, benchmarkValue: b.benchmarkValue || b.targetValue || '', description: b.description || '', industry: b.industry || '', currentValue: '', unit: '', benchmarkType: b.benchmarkType || 'industry', alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily', alertThreshold: '', alertCondition: 'below', emailRecipients: '' }); setIsBenchmarkModalOpen(true); }}>
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Delete Benchmark</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{b.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteBenchmarkMutation.mutate(b.id)} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">{formatGoogleAdsMetricValue(metricKey, currentVal)}</div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Benchmark</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">{formatGoogleAdsMetricValue(metricKey, benchVal)}</div>
                            </div>
                          </div>
                          {benchVal > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400"><span>Progress</span><span>{Math.round(progress.pct)}%</span></div>
                              <Progress value={progressFill} className="h-2" indicatorClassName={progressColor} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">No benchmarks have been created yet. Click "Add Benchmark" to compare your metrics against industry standards.</div>
              )}
            </TabsContent>

            {/* ==================== AD COMPARISON TAB ==================== */}
            <TabsContent value="ad-comparison" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Comparison</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Compare performance across all Google Ads campaigns</p>
                </div>
                <div className="flex items-center gap-2">
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger className="w-[180px] h-8 text-xs">
                      <ArrowUpDown className="w-3 h-3 mr-1" />
                      <SelectValue placeholder="Sort by..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Name (A-Z)</SelectItem>
                      <SelectItem value="spend">Spend (High→Low)</SelectItem>
                      <SelectItem value="impressions">Impressions (High→Low)</SelectItem>
                      <SelectItem value="clicks">Clicks (High→Low)</SelectItem>
                      <SelectItem value="conversions">Conversions (High→Low)</SelectItem>
                      <SelectItem value="ctr">CTR (High→Low)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Performance Rankings — only meaningful with 2+ campaigns */}
              {campaignBreakdown.length > 1 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingUp className="w-4 h-4 text-green-600" /> Best Performing</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {bestPerforming && (
                        <div>
                          <p className="font-semibold text-green-600">{bestPerforming.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">Conversions: {fmt(Math.round(bestPerforming.conversions))} | CTR: {fmtPct(bestPerforming.ctr)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><Activity className="w-4 h-4 text-blue-600" /> Most Efficient</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {mostEfficient && (
                        <div>
                          <p className="font-semibold text-blue-600">{mostEfficient.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">CPC: {fmtCurrency(mostEfficient.cpc)} | CPM: {fmtCurrency(mostEfficient.cpm)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-medium flex items-center gap-2"><TrendingDown className="w-4 h-4 text-orange-600" /> Needs Attention</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {needsAttentionCampaign && (
                        <div>
                          <p className="font-semibold text-orange-600">{needsAttentionCampaign.name}</p>
                          <p className="text-xs text-slate-600 dark:text-slate-400">CTR: {fmtPct(needsAttentionCampaign.ctr)} | Conv Rate: {fmtPct(needsAttentionCampaign.conversionRate)}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader><CardTitle>Campaign Performance</CardTitle><CardDescription>Top 5 campaigns by {campaignChartLabel.toLowerCase()}</CardDescription></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaignPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="value" fill="#3b82f6" name={campaignChartLabel} />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader><CardTitle>Spend Distribution</CardTitle><CardDescription>Budget allocation across campaigns</CardDescription></CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie data={spendDistribution} cx="50%" cy="50%" labelLine={false} label={(entry: any) => `${entry.name}: $${entry.value.toFixed(0)}`} outerRadius={80} fill="#8884d8" dataKey="value">
                          {spendDistribution.map((_: any, index: number) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Campaign Cards */}
              <Card>
                <CardHeader><CardTitle>Detailed Campaign Comparison</CardTitle><CardDescription>Side-by-side metrics for all campaigns</CardDescription></CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaignBreakdown
                      .sort((a, b) => {
                        switch (sortBy) {
                          case 'spend': return b.spend - a.spend;
                          case 'impressions': return b.impressions - a.impressions;
                          case 'clicks': return b.clicks - a.clicks;
                          case 'conversions': return b.conversions - a.conversions;
                          case 'ctr': return b.ctr - a.ctr;
                          default: return a.name.localeCompare(b.name);
                        }
                      })
                      .map((c) => {
                        const performanceScore = (c.ctr * 10 + c.conversionRate * 5) / 2;
                        const performance = performanceScore > 20 ? 'excellent' : performanceScore > 15 ? 'good' : performanceScore > 10 ? 'average' : 'poor';

                        return (
                          <div key={c.name} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex items-center gap-2">
                                <h4 className="font-semibold text-slate-900 dark:text-white">{c.name}</h4>
                                {performance === 'excellent' && <Badge variant="default" className="bg-green-500 text-xs">Excellent</Badge>}
                                {performance === 'good' && <Badge variant="default" className="bg-blue-500 text-xs">Good</Badge>}
                                {performance === 'average' && <Badge variant="secondary" className="text-xs">Average</Badge>}
                                {performance === 'poor' && <Badge variant="destructive" className="text-xs">Poor</Badge>}
                              </div>
                              <span className="text-lg font-bold text-slate-900 dark:text-white">{fmtCurrency(c.spend)}</span>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                              <div><p className="text-xs text-slate-500 font-medium">Impressions</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmt(c.impressions)}</p></div>
                              <div><p className="text-xs text-slate-500 font-medium">Clicks</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmt(c.clicks)}</p></div>
                              <div><p className="text-xs text-slate-500 font-medium">CTR</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmtPct(c.ctr)}</p></div>
                              <div><p className="text-xs text-slate-500 font-medium">Conversions</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmt(Math.round(c.conversions))}</p></div>
                              <div><p className="text-xs text-slate-500 font-medium">Conv Rate</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmtPct(c.conversionRate)}</p></div>
                              <div><p className="text-xs text-slate-500 font-medium">Video Views</p><p className="text-base font-bold text-slate-900 dark:text-white">{fmt(c.videoViews)}</p></div>
                            </div>
                            <div className="grid grid-cols-3 md:grid-cols-7 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                              <div><p className="text-[10px] text-slate-400 font-medium">CPC</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtCurrency(c.cpc)}</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">CPM</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtCurrency(c.cpm)}</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">Cost/Conv</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtCurrency(c.costPerConversion)}</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">Conv. Value</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{fmtCurrency(c.conversionValue)}</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">ROAS</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{c.roas.toFixed(2)}x</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">ROI</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{c.roi.toFixed(1)}%</p></div>
                              <div><p className="text-[10px] text-slate-400 font-medium">Days</p><p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{c.days}</p></div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ==================== INSIGHTS TAB ==================== */}
            <TabsContent value="insights" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Insights</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Actionable insights from financial metrics plus KPI + Benchmark performance.</p>
              </div>

              {/* Executive Financials */}
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <CardTitle>Executive financials</CardTitle>
                  <CardDescription>Key financial metrics from Google Ads imports.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card><CardContent className="p-5"><div className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend</div><div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.spend)}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: Google Ads</div></CardContent></Card>
                    <Card><CardContent className="p-5"><div className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversions</div><div className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(Math.round(summary.conversions))}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">All conversion actions</div></CardContent></Card>
                    <Card><CardContent className="p-5"><div className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Value</div><div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.conversionValue)}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total value from conversions</div></CardContent></Card>
                    <Card><CardContent className="p-5"><div className="text-sm font-medium text-slate-600 dark:text-slate-400">Cost/Conversion</div><div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.costPerConv)}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Spend / Conversions</div></CardContent></Card>
                  </div>
                </CardContent>
              </Card>

              {/* Trends - Daily/7d/30d */}
              <Card className="border-slate-200 dark:border-slate-700">
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle>Trends</CardTitle>
                      <CardDescription>Daily shows day-by-day values. 7d/30d smooth the chart with rolling windows.</CardDescription>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                      <div className="flex items-center gap-2">
                        <Button type="button" variant={insightsTrendMode === 'daily' ? 'default' : 'outline'} size="sm" onClick={() => { setInsightsDailyShowMore(false); setInsightsTrendMode('daily'); }}>Daily</Button>
                        <Button type="button" variant={insightsTrendMode === '7d' ? 'default' : 'outline'} size="sm" onClick={() => setInsightsTrendMode('7d')}>7d</Button>
                        <Button type="button" variant={insightsTrendMode === '30d' ? 'default' : 'outline'} size="sm" onClick={() => setInsightsTrendMode('30d')}>30d</Button>
                      </div>
                      <div className="min-w-[220px]">
                        <Select value={insightsTrendMetric} onValueChange={setInsightsTrendMetric}>
                          <SelectTrigger className="h-9"><SelectValue placeholder="Metric" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="spend">Spend</SelectItem>
                            <SelectItem value="impressions">Impressions</SelectItem>
                            <SelectItem value="clicks">Clicks</SelectItem>
                            <SelectItem value="conversions">Conversions</SelectItem>
                            <SelectItem value="ctr">CTR</SelectItem>
                            <SelectItem value="cpc">CPC</SelectItem>
                            <SelectItem value="cpm">CPM</SelectItem>
                            <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                            <SelectItem value="costPerConversion">Cost/Conversion</SelectItem>
                            <SelectItem value="roas">ROAS</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {(() => {
                    const series = insightsTrendMode === 'daily' ? dailySeries.daily
                      : insightsTrendMode === '7d' ? dailySeries.rolling7 : dailySeries.rolling30;
                    const minRequired = insightsTrendMode === 'daily' ? 2 : insightsTrendMode === '7d' ? 14 : 60;
                    const available = insightsRollups.availableDays;

                    if (available <= 0) return <div className="text-sm text-slate-600 dark:text-slate-400">No daily history available yet.</div>;
                    if (available < minRequired) return <div className="text-sm text-slate-600 dark:text-slate-400">Need at least {minRequired} days for this view. Available: {available}.</div>;

                    const formatChartValue = (v: any) => {
                      const n = Number(v || 0) || 0;
                      if (['spend', 'cpc', 'cpm', 'costPerConversion'].includes(insightsTrendMetric)) return `$${n.toFixed(2)}`;
                      if (['ctr', 'conversionRate'].includes(insightsTrendMetric)) return `${n.toFixed(2)}%`;
                      if (insightsTrendMetric === 'roas') return `${n.toFixed(2)}x`;
                      return n.toLocaleString();
                    };

                    const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate', costPerConversion: 'Cost/Conv', roas: 'ROAS' };

                    return (
                      <>
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={series}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: any) => formatShortDate(String(v || ''))} />
                              <YAxis tick={{ fontSize: 12 }} />
                              <Tooltip formatter={(value: any) => formatChartValue(value)} />
                              <Legend />
                              <Line type="monotone" dataKey={insightsTrendMetric} stroke="#7c3aed" strokeWidth={2} dot={false} name={labels[insightsTrendMetric] || insightsTrendMetric} />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>

                        {/* Table view */}
                        <div className="overflow-hidden border rounded-md">
                          {insightsTrendMode === 'daily' ? (
                            <div>
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[38%]">Date</th>
                                    <th className="text-right p-3 w-[31%]">{labels[insightsTrendMetric] || 'Metric'}</th>
                                    <th className="text-right p-3 w-[31%]">vs prior</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const daily = dailySeries.daily;
                                    const visibleDays = insightsDailyShowMore ? 14 : 7;
                                    const rows = daily.slice(-visibleDays);
                                    if (rows.length === 0) return <tr><td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">No daily records available yet.</td></tr>;
                                    return rows.map((r: any, idx: number, arr: any[]) => {
                                      const prev = idx > 0 ? arr[idx - 1] : null;
                                      const curVal = Number(r?.[insightsTrendMetric] ?? 0) || 0;
                                      const prevVal = Number(prev?.[insightsTrendMetric] ?? 0) || 0;
                                      const deltaPctVal = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;
                                      const showDelta = !!prev && prevVal > 0;
                                      return (
                                        <tr key={r.date} className="border-b">
                                          <td className="p-3"><div className="font-medium text-slate-900 dark:text-white">{formatShortDate(String(r.date || ''))}</div></td>
                                          <td className="p-3 text-right"><div className="font-medium text-slate-900 dark:text-white">{formatChartValue(curVal)}</div></td>
                                          <td className="p-3 text-right"><div className={`text-xs ${showDelta ? (deltaPctVal >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300') : 'text-slate-400'}`}>{showDelta ? `${deltaPctVal >= 0 ? '+' : ''}${deltaPctVal.toFixed(1)}%` : '—'}</div></td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                              {dailySeries.daily.length > 7 && (
                                <div className="flex justify-end px-3 py-2 bg-white dark:bg-slate-950">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setInsightsDailyShowMore((v) => !v)} className="h-8 text-xs">{insightsDailyShowMore ? 'View less' : 'View more'}</Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                <tr>
                                  <th className="text-left p-3 w-[38%]">Period</th>
                                  <th className="text-right p-3 w-[31%]">{labels[insightsTrendMetric] || 'Metric'}</th>
                                  <th className="text-right p-3 w-[31%]">vs prior</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const is7 = insightsTrendMode === '7d';
                                  const minReq = is7 ? 14 : 60;
                                  if (insightsRollups.availableDays < minReq) return <tr><td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">Need at least {minReq} days. Available: {insightsRollups.availableDays}.</td></tr>;
                                  const row = is7
                                    ? { key: '7d', cur: insightsRollups.last7, d: insightsRollups.deltas, label: 'Last 7d vs prior 7d' }
                                    : { key: '30d', cur: insightsRollups.last30, d: insightsRollups.deltas, label: 'Last 30d vs prior 30d' };
                                  const valueFor = (obj: any) => {
                                    const v = Number(obj?.[insightsTrendMetric] ?? 0) || 0;
                                    return formatChartValue(v);
                                  };
                                  const suffix = is7 ? '7' : '30';
                                  const deltaKey = `${insightsTrendMetric}${suffix}` as keyof typeof row.d;
                                  const delta = Number(row.d[deltaKey] ?? 0);
                                  const deltaColor = delta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300';
                                  return (
                                    <tr key={row.key} className="border-b">
                                      <td className="p-3"><div className="font-medium text-slate-900 dark:text-white">{row.cur.endDate}</div><div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{row.cur.startDate} → {row.cur.endDate} ({row.label})</div></td>
                                      <td className="p-3 text-right"><div className="font-medium text-slate-900 dark:text-white">{valueFor(row.cur)}</div></td>
                                      <td className="p-3 text-right"><div className={`text-xs ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</div></td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Insight summary cards */}
              {(() => {
                const allInsights: Array<{ id: string; title: string; description: string; severity: string; recommendation: string }> = [];

                const kpis = Array.isArray(kpisData) ? kpisData : [];
                kpis.forEach((kpi: any) => {
                  const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                  const target = parseFloat(kpi.targetValue || '0');
                  const p = computeProgress(current, target, kpi.metric || kpi.metricKey || '');
                  const def = getGoogleAdsMetricDef(kpi.metric || kpi.metricKey || '');
                  if (p.status === 'behind') {
                    allInsights.push({ id: `kpi-behind-${kpi.id}`, title: `KPI Behind: ${kpi.name}`, description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`, severity: 'high', recommendation: `Focus on improving ${def.label} to close the gap.` });
                  } else if (p.status === 'needs_attention') {
                    allInsights.push({ id: `kpi-attention-${kpi.id}`, title: `KPI Needs Attention: ${kpi.name}`, description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`, severity: 'medium', recommendation: `Monitor ${def.label} closely and consider optimization.` });
                  }
                });

                const benchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
                benchmarks.forEach((b: any) => {
                  const current = getLiveMetricValue(b.metric || '');
                  const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                  const p = computeProgress(current, benchVal, b.metric || '');
                  const def = getGoogleAdsMetricDef(b.metric || '');
                  if (p.status === 'behind') {
                    allInsights.push({ id: `bench-behind-${b.id}`, title: `Below Benchmark: ${b.name}`, description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)}.`, severity: 'high', recommendation: `Your ${def.label} is below industry benchmark. Review campaign strategy.` });
                  } else if (p.status === 'needs_attention') {
                    allInsights.push({ id: `bench-attention-${b.id}`, title: `Near Benchmark: ${b.name}`, description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)}.`, severity: 'medium', recommendation: `${def.label} is close to benchmark but could use improvement.` });
                  }
                });

                if (summary.ctr < 1.0) {
                  allInsights.push({ id: 'ctr-low', title: 'Low CTR Across Campaigns', description: `Average CTR is ${fmtPct(summary.ctr)}, below the typical 1.0% threshold for Google Ads.`, severity: 'medium', recommendation: 'Review ad copy, keywords, and targeting. Consider improving ad relevance and quality score.' });
                }

                if (summary.costPerConv > 50) {
                  allInsights.push({ id: 'cost-per-conv-high', title: 'High Cost Per Conversion', description: `Average cost per conversion is ${fmtCurrency(summary.costPerConv)}.`, severity: 'medium', recommendation: 'Consider refining targeting, negative keywords, and bid strategy to reduce costs.' });
                }

                if (allInsights.length === 0) return null;

                return (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Performance Insights</h3>
                    {allInsights.map((insight) => (
                      <Card key={insight.id} className={insight.severity === 'high' ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800'}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            {insight.severity === 'high' ? <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />}
                            <div>
                              <h4 className="font-medium text-slate-900 dark:text-white">{insight.title}</h4>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{insight.description}</p>
                              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">{insight.recommendation}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>

            {/* ==================== REPORTS TAB ==================== */}
            <TabsContent value="reports" className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">Create, schedule, and manage Google Ads analytics reports</p>
                </div>
                <Button
                  className="gap-2"
                  onClick={() => {
                    setEditingReport(null);
                    setReportModalStep('standard');
                    setReportFormErrors({});
                    setCustomReportConfig({ coreMetrics: [], derivedMetrics: [], campaignBreakdown: [], kpis: [], benchmarks: [], insights: [] });
                    setReportForm({ name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly', scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false, scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end' });
                    setIsReportModalOpen(true);
                  }}
                >
                  <Plus className="w-4 h-4" /> Create Report
                </Button>
              </div>

              {reportsLoading ? (
                <div className="animate-pulse space-y-4"><div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div></div>
              ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {(reportsData as any[]).map((report: any) => (
                    <Card key={report.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">{report.name}</h3>
                            {report.description && <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{report.description}</p>}
                            <div className="flex items-center gap-4 text-sm">
                              <Badge variant="outline">{report.reportType || 'performance_summary'}</Badge>
                              {report.scheduleEnabled && report.scheduleFrequency && <span className="text-slate-500">{report.scheduleFrequency}{report.scheduleTime ? ` at ${report.scheduleTime}` : ''}</span>}
                              <span className="text-slate-400">Created {new Date(report.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={() => {
                              setEditingReport(report);
                              setReportForm({ name: report.name || '', description: report.description || '', reportType: report.reportType || 'performance_summary', scheduleFrequency: report.scheduleFrequency || 'weekly', scheduleTime: report.scheduleTime || '9:00 AM', emailRecipients: report.emailRecipients || '', scheduleEnabled: report.scheduleEnabled || false });
                              setIsReportModalOpen(true);
                            }}>
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete Report</AlertDialogTitle><AlertDialogDescription>Are you sure you want to delete "{report.name}"? This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteReportMutation.mutate(report.id)} className="bg-red-600 hover:bg-red-700 text-white">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent>
                    <div className="text-center py-12">
                      <Activity className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-4" />
                      <p className="text-slate-500 dark:text-slate-400">No reports created yet</p>
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">Create your first report to get started</p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* KPI Modal */}
          <GoogleAdsKpiModal
            isKPIModalOpen={isKPIModalOpen}
            setIsKPIModalOpen={setIsKPIModalOpen}
            editingKPI={editingKPI}
            setEditingKPI={setEditingKPI}
            kpiForm={kpiForm}
            setKpiForm={setKpiForm}
            summary={summary}
            toast={toast}
            handleCreateKPI={handleCreateKPI}
          />

          {/* Benchmark Modal */}
          <GoogleAdsBenchmarkModal
            isBenchmarkModalOpen={isBenchmarkModalOpen}
            setIsBenchmarkModalOpen={setIsBenchmarkModalOpen}
            editingBenchmark={editingBenchmark}
            setEditingBenchmark={setEditingBenchmark}
            benchmarkForm={benchmarkForm}
            setBenchmarkForm={setBenchmarkForm}
            summary={summary}
            toast={toast}
            handleCreateBenchmark={handleCreateBenchmark}
          />

          {/* Report Modal */}
          <GoogleAdsReportModal
            isReportModalOpen={isReportModalOpen}
            setIsReportModalOpen={setIsReportModalOpen}
            reportModalStep={reportModalStep}
            setReportModalStep={setReportModalStep}
            editingReportId={editingReport?.id?.toString() || null}
            setEditingReportId={(id: string | null) => { if (!id) setEditingReport(null); }}
            reportForm={reportForm}
            setReportForm={setReportForm}
            reportFormErrors={reportFormErrors}
            setReportFormErrors={setReportFormErrors}
            customReportConfig={customReportConfig}
            setCustomReportConfig={setCustomReportConfig}
            summary={summary}
            kpisData={kpisData}
            benchmarksData={benchmarksData}
            handleReportTypeSelect={handleReportTypeSelect}
            handleCreateReport={handleCreateReport}
            handleUpdateReport={handleUpdateReport}
            handleCustomReport={handleCustomReport}
            createReportMutation={createReportMutation}
            updateReportMutation={updateReportMutation}
            userTimeZone={userTimeZone}
            getTimeZoneDisplay={getTimeZoneDisplay}
          />
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 text-slate-500 mb-1">
          {icon}
          <span className="text-xs font-medium">{label}</span>
        </div>
        <div className="text-lg font-bold text-slate-900 dark:text-white">{value}</div>
      </CardContent>
    </Card>
  );
}
