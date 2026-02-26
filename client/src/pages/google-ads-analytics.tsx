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
import { ArrowLeft, ArrowUpDown, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Video, Search, Activity, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Filter, RefreshCw, Loader2, BarChart3 } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
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

// Volume gates and anomaly thresholds for enterprise insights engine
const GADS_THRESHOLDS = {
  minClicks7d: 100,
  minImpressions7d: 5000,
  minConversions7d: 20,
  minSpend7d: 50,
  cpcSpikePct: 20,
  ctrDropPct: 15,
  cvrDropPct: 20,
  cpmSpikePct: 25,
  impressionDecayPct: 20,
  spendSurgePct: 30,
  roasDropPct: 25,
  costPerConvSpikePct: 25,
  stableBandPct: 5,
  spendConcentrationPct: 70,
  minDaysForWoW: 14,
  minDaysForMoM: 60,
};

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
  const [sortBy, setSortBy] = useState<string>('spend');
  const [filterBy, setFilterBy] = useState<string>('all');

  // Insights state
  const [insightsTrendMetric, setInsightsTrendMetric] = useState('spend');
  const [insightsTrendMode, setInsightsTrendMode] = useState<'daily' | '7d' | '30d'>('daily');
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);
  const [insightsExpanded, setInsightsExpanded] = useState<Record<string, boolean>>({});

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
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'google_ads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'google_ads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'google_ads'] });
      toast({ title: 'Benchmark deleted' });
    },
  });

  // Fetch Reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/meta/reports', campaignId, 'google_ads'],
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
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports', campaignId, 'google_ads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports', campaignId, 'google_ads'] });
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
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports', campaignId, 'google_ads'] });
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

  // Reliability scoring: determines how much to trust an insight based on data volume
  const computeGadsReliability = (metricKey: string): 'high' | 'medium' | 'low' => {
    const days = insightsRollups.availableDays;
    if (days <= 0) return 'low';
    const ref = days >= 14 ? insightsRollups.prior7 : insightsRollups.last7;
    const clicks = ref.clicks || 0;
    const impressions = ref.impressions || 0;
    const conversions = ref.conversions || 0;
    const hasCtrVolume = clicks >= GADS_THRESHOLDS.minClicks7d && impressions >= GADS_THRESHOLDS.minImpressions7d;
    const hasCvrVolume = hasCtrVolume && conversions >= GADS_THRESHOLDS.minConversions7d;
    const key = metricKey.toLowerCase();
    if (['conversionrate', 'costperconversion', 'conversions'].includes(key)) return hasCvrVolume ? 'high' : clicks >= GADS_THRESHOLDS.minClicks7d ? 'medium' : 'low';
    if (['roas', 'roi', 'conversionvalue'].includes(key)) return hasCvrVolume ? 'medium' : 'low';
    if (['ctr', 'cpc', 'clicks', 'impressions', 'spend', 'cpm'].includes(key)) return hasCtrVolume ? 'high' : (clicks > 0 || impressions > 0) ? 'medium' : 'low';
    if (['searchimpressionshare'].includes(key)) return impressions >= GADS_THRESHOLDS.minImpressions7d ? 'high' : impressions > 0 ? 'medium' : 'low';
    return days >= 14 ? 'medium' : 'low';
  };

  // Enterprise insights engine — 22 rules across 5 tiers
  const googleAdsInsights = (() => {
    type InsightItem = { id: string; title: string; description: string; severity: 'high' | 'medium' | 'low'; recommendation: string; group: 'integrity' | 'performance'; reliability: 'high' | 'medium' | 'low'; evidence?: string[]; confidence?: 'high' | 'medium' | 'low' };
    const all: InsightItem[] = [];
    const d = insightsRollups.deltas;
    const l7 = insightsRollups.last7;
    const p7 = insightsRollups.prior7;
    const avail = insightsRollups.availableDays;
    const hasWoW = avail >= GADS_THRESHOLDS.minDaysForWoW;

    // Mutual exclusion flags
    let firedQualityScoreDecline = false;
    let firedLandingPageRegression = false;
    let firedCampaignCtrOutlier = false;

    // ─── TIER 1: DATA INTEGRITY ───────────────────────────────────────

    // Rule 1: Spend with zero conversions
    if (summary.spend > 0 && summary.conversions === 0) {
      all.push({
        id: 'integrity:no-conversions', severity: 'high', group: 'integrity', reliability: 'high',
        title: 'Spend recorded but zero conversions',
        description: `${fmtCurrency(summary.spend)} spent across ${campaignBreakdown.length} campaign(s) with 0 conversions. This may indicate broken conversion tracking, not poor performance.`,
        recommendation: 'Verify conversion actions are properly configured in Google Ads. Check: (1) Global site tag / Google Tag is installed, (2) Conversion actions are active and not recently edited, (3) Attribution window has not expired. If tracking is confirmed correct, pause underperforming campaigns.',
        evidence: [fmtCurrency(summary.spend) + ' total spend', fmt(summary.impressions) + ' impressions', fmt(summary.clicks) + ' clicks', '0 conversions'],
      });
    }

    // Rule 2: Conversions exist but value is $0
    if (summary.conversions > 0 && summary.conversionValue === 0) {
      all.push({
        id: 'integrity:conv-value-zero', severity: 'high', group: 'integrity', reliability: 'high',
        title: 'Conversions tracked but conversion value is $0',
        description: `${Math.round(summary.conversions)} conversions recorded, but total conversion value is $0. ROAS (${summary.roas.toFixed(2)}x) and ROI (${summary.roi.toFixed(1)}%) cannot be trusted until values are assigned.`,
        recommendation: 'Assign conversion values in Google Ads > Goals > Conversions > Settings. For e-commerce, use dynamic values from your checkout. For lead gen, assign estimated values per lead type. Without this, all ROAS/ROI insights are unreliable.',
        evidence: [Math.round(summary.conversions) + ' conversions', '$0 conversion value', 'ROAS: ' + summary.roas.toFixed(2) + 'x (unreliable)'],
      });
    }

    // Rule 3: Impressions but zero clicks
    if (summary.impressions > 0 && summary.clicks === 0) {
      all.push({
        id: 'integrity:impressions-no-clicks', severity: 'high', group: 'integrity', reliability: 'high',
        title: 'Ads showing but nobody clicking',
        description: `${fmt(summary.impressions)} impressions with 0 clicks (0.00% CTR). Ads are being served but generating zero engagement.`,
        recommendation: 'Check: (1) Ad relevance and Quality Score in the Google Ads UI, (2) Keyword-to-ad alignment, (3) Whether ads are showing for intended search terms via Search Terms report. Consider pausing campaigns until ads are revised.',
        evidence: [fmt(summary.impressions) + ' impressions', '0 clicks', '0.00% CTR'],
      });
    }

    // Rule 4: Zero spend across all campaigns
    if (summary.spend === 0 && summary.impressions === 0 && campaignBreakdown.length > 0) {
      all.push({
        id: 'integrity:zero-spend', severity: 'medium', group: 'integrity', reliability: 'high',
        title: 'Campaigns exist but no spend or impressions recorded',
        description: `${campaignBreakdown.length} campaign(s) found but $0 spend and 0 impressions in the reporting window. Campaigns may be paused, budgets exhausted, or ads disapproved.`,
        recommendation: 'Check campaign status in the Google Ads UI. Verify: (1) Campaigns are not paused/removed, (2) Daily budgets are set, (3) Ads are approved, (4) Billing is active.',
        evidence: [campaignBreakdown.length + ' campaigns', '$0 spend', '0 impressions'],
      });
    }

    // ─── TIER 2: FINANCIAL PERFORMANCE ────────────────────────────────

    // Rule 5: Negative ROI
    if (summary.conversionValue > 0 && summary.spend > 0 && summary.roi < 0 && summary.conversions >= 5) {
      all.push({
        id: 'financial:negative-roi', severity: summary.roi <= -20 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('roi'),
        title: `ROI is ${summary.roi.toFixed(1)}% — losing money`,
        description: `Spending ${fmtCurrency(summary.spend)} to generate ${fmtCurrency(summary.conversionValue)} in conversion value (ROI: ${summary.roi.toFixed(1)}%). Net loss: ${fmtCurrency(summary.spend - summary.conversionValue)}.`,
        recommendation: `Review the ${campaignBreakdown.length} active campaign(s). Consider pausing campaigns with CPA above target and reallocating budget to highest-ROAS campaigns. Check the Ad Comparison tab to identify which campaigns are profitable.`,
        evidence: ['Spend: ' + fmtCurrency(summary.spend), 'Value: ' + fmtCurrency(summary.conversionValue), 'ROI: ' + summary.roi.toFixed(1) + '%', 'Net loss: ' + fmtCurrency(summary.spend - summary.conversionValue)],
      });
    }

    // Rule 6: ROAS below breakeven
    if (summary.conversionValue > 0 && summary.spend > 0 && summary.roas > 0 && summary.roas < 1 && summary.conversions >= 5) {
      all.push({
        id: 'financial:roas-below-1', severity: summary.roas < 0.5 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('roas'),
        title: `ROAS is ${summary.roas.toFixed(2)}x — below breakeven`,
        description: `Every $1 spent returns only ${fmtCurrency(summary.roas)} in conversion value. To break even, ROAS must be at least 1.0x. Current gap: ${fmtCurrency(1 - summary.roas)} per dollar spent.`,
        recommendation: 'Audit campaign-level ROAS in the Ad Comparison tab. Focus budget on campaigns returning above 1.0x. For underperforming campaigns, review: keyword match types, negative keywords, audience segments, and bid strategy.',
        evidence: ['ROAS: ' + summary.roas.toFixed(2) + 'x', 'Spend: ' + fmtCurrency(summary.spend), 'Conversion value: ' + fmtCurrency(summary.conversionValue)],
      });
    }

    // Rule 7: Diminishing returns — spend up but conversions flat
    if (hasWoW && d.spend7 >= 20 && Math.abs(d.conversions7) < 10 && l7.spend >= GADS_THRESHOLDS.minSpend7d && p7.conversions >= GADS_THRESHOLDS.minConversions7d) {
      all.push({
        id: 'financial:diminishing-returns', severity: d.spend7 >= 40 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('conversions'),
        title: `Spend up ${d.spend7.toFixed(0)}% WoW but conversions flat`,
        description: `Week-over-week spend increased from ${fmtCurrency(p7.spend)} to ${fmtCurrency(l7.spend)} (+${d.spend7.toFixed(1)}%), but conversions moved only ${d.conversions7 >= 0 ? '+' : ''}${d.conversions7.toFixed(1)}% (${Math.round(p7.conversions)} to ${Math.round(l7.conversions)}). This suggests diminishing returns on incremental spend.`,
        recommendation: 'You may be hitting audience saturation or bidding into less efficient auction segments. Review: (1) Search Impression Share — are you already capturing most available demand? (2) Audience overlap across campaigns, (3) Whether new spend is going to existing or new keywords.',
        evidence: ['Spend: ' + fmtCurrency(p7.spend) + ' → ' + fmtCurrency(l7.spend), 'Conversions: ' + Math.round(p7.conversions) + ' → ' + Math.round(l7.conversions), 'Spend delta: +' + d.spend7.toFixed(1) + '%', 'Conv delta: ' + (d.conversions7 >= 0 ? '+' : '') + d.conversions7.toFixed(1) + '%'],
      });
    }

    // ─── TIER 3: WEEK-OVER-WEEK ANOMALY DETECTION ─────────────────────

    if (hasWoW) {
      // Rule 8: Quality Score decline signal — CPC spike + CTR drop
      if (d.cpc7 >= GADS_THRESHOLDS.cpcSpikePct && d.ctr7 <= -GADS_THRESHOLDS.ctrDropPct && p7.clicks >= GADS_THRESHOLDS.minClicks7d && p7.impressions >= GADS_THRESHOLDS.minImpressions7d) {
        firedQualityScoreDecline = true;
        all.push({
          id: 'anomaly:quality-score-decline', severity: 'high', group: 'performance', reliability: computeGadsReliability('cpc'),
          title: `Quality Score may be declining: CPC up ${d.cpc7.toFixed(0)}%, CTR down ${Math.abs(d.ctr7).toFixed(0)}%`,
          description: `CPC increased from ${fmtCurrency(p7.cpc)} to ${fmtCurrency(l7.cpc)} (+${d.cpc7.toFixed(1)}%) while CTR dropped from ${fmtPct(p7.ctr)} to ${fmtPct(l7.ctr)} (${d.ctr7.toFixed(1)}%). In Google Ads, this combination is a strong signal that Quality Score is declining, causing you to pay more for lower ad positions.`,
          recommendation: 'Check Quality Score in the Google Ads UI (Keywords tab > add Quality Score column). Focus on: (1) Ad relevance — ensure ad copy tightly matches keyword intent, (2) Landing page experience — speed, mobile-friendliness, relevance, (3) Expected CTR — test new ad variations. Improving Quality Score reduces CPC and improves ad position.',
          evidence: ['CPC: ' + fmtCurrency(p7.cpc) + ' → ' + fmtCurrency(l7.cpc), 'CTR: ' + fmtPct(p7.ctr) + ' → ' + fmtPct(l7.ctr), 'Period: ' + l7.startDate + ' to ' + l7.endDate],
        });
      }

      // Rule 9: Landing page regression — CVR drop with stable CTR
      if (d.conversionRate7 <= -GADS_THRESHOLDS.cvrDropPct && Math.abs(d.ctr7) <= GADS_THRESHOLDS.stableBandPct && p7.clicks >= GADS_THRESHOLDS.minClicks7d && p7.conversions >= GADS_THRESHOLDS.minConversions7d) {
        firedLandingPageRegression = true;
        all.push({
          id: 'anomaly:landing-page-regression', severity: 'high', group: 'performance', reliability: computeGadsReliability('conversionrate'),
          title: `Landing page regression: CVR down ${Math.abs(d.conversionRate7).toFixed(0)}%, CTR stable`,
          description: `Conversion rate dropped from ${fmtPct(p7.conversionRate)} to ${fmtPct(l7.conversionRate)} (${d.conversionRate7.toFixed(1)}%) while CTR remained stable at ~${fmtPct(l7.ctr)}. People are clicking your ads at the same rate but converting less — this points to a post-click issue, not an ad issue.`,
          recommendation: 'Investigate post-click experience: (1) Check for landing page changes or errors, (2) Test page load speed (Google PageSpeed Insights), (3) Verify form/checkout flows, (4) Check if mobile vs desktop conversion rates diverged, (5) Review the Search Terms report for new irrelevant queries consuming clicks.',
          evidence: ['CVR: ' + fmtPct(p7.conversionRate) + ' → ' + fmtPct(l7.conversionRate), 'CTR: ' + fmtPct(p7.ctr) + ' → ' + fmtPct(l7.ctr) + ' (stable)', 'Conversions: ' + Math.round(p7.conversions) + ' → ' + Math.round(l7.conversions)],
        });
      }

      // Rule 10: General CVR drop (CTR not stable) — only if Rule 9 didn't fire
      if (!firedLandingPageRegression && d.conversionRate7 <= -GADS_THRESHOLDS.cvrDropPct && p7.clicks >= GADS_THRESHOLDS.minClicks7d && p7.conversions >= GADS_THRESHOLDS.minConversions7d) {
        all.push({
          id: 'anomaly:cvr-drop', severity: Math.abs(d.conversionRate7) >= 40 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('conversionrate'),
          title: `Conversion rate dropped ${Math.abs(d.conversionRate7).toFixed(0)}% week-over-week`,
          description: `CVR went from ${fmtPct(p7.conversionRate)} to ${fmtPct(l7.conversionRate)} (${d.conversionRate7.toFixed(1)}%). CTR also shifted (${d.ctr7 >= 0 ? '+' : ''}${d.ctr7.toFixed(1)}%), suggesting a broader targeting or competitive shift rather than an isolated landing page issue.`,
          recommendation: 'Multiple factors may be contributing. Check: (1) Search Terms report for query drift, (2) Audience segment performance, (3) Competitor activity via Auction Insights, (4) Landing page experience. If using Smart Bidding, check the Strategy report for learning period alerts.',
          evidence: ['CVR: ' + fmtPct(p7.conversionRate) + ' → ' + fmtPct(l7.conversionRate), 'CTR: ' + fmtPct(p7.ctr) + ' → ' + fmtPct(l7.ctr), 'Clicks: ' + fmt(p7.clicks) + ' → ' + fmt(l7.clicks)],
        });
      }

      // Rule 11: CPC spike (standalone) — only if Rule 8 didn't fire
      if (!firedQualityScoreDecline && d.cpc7 >= GADS_THRESHOLDS.cpcSpikePct && p7.clicks >= GADS_THRESHOLDS.minClicks7d) {
        all.push({
          id: 'anomaly:cpc-spike', severity: d.cpc7 >= 40 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('cpc'),
          title: `CPC spiked ${d.cpc7.toFixed(0)}% week-over-week`,
          description: `Cost-per-click rose from ${fmtCurrency(p7.cpc)} to ${fmtCurrency(l7.cpc)} (+${d.cpc7.toFixed(1)}%). This could indicate increased auction competition, keyword match type broadening, or bid strategy adjustments taking effect.`,
          recommendation: 'Check Auction Insights for new competitors. Review: (1) Bid strategy changes in the last 7 days, (2) Keyword match type settings (broad match can cause CPC variance), (3) Whether new high-CPC keywords were added. If using Target CPA/ROAS, verify the target has not been changed.',
          evidence: ['CPC: ' + fmtCurrency(p7.cpc) + ' → ' + fmtCurrency(l7.cpc), 'Spend: ' + fmtCurrency(p7.spend) + ' → ' + fmtCurrency(l7.spend), 'Clicks: ' + fmt(p7.clicks) + ' → ' + fmt(l7.clicks)],
        });
      }

      // Rule 12: Impression decay
      if (d.impressions7 <= -GADS_THRESHOLDS.impressionDecayPct && p7.impressions >= GADS_THRESHOLDS.minImpressions7d) {
        const sisNote = summary.searchImpressionShare > 0 ? ` Current Search Impression Share is ${fmtPct(summary.searchImpressionShare)}.` : '';
        const sisRec = summary.searchImpressionShare > 0 && summary.searchImpressionShare < 50 ? ` With Search Impression Share at ${fmtPct(summary.searchImpressionShare)}, there is significant room to capture more demand.` : '';
        all.push({
          id: 'anomaly:impression-decay', severity: Math.abs(d.impressions7) >= 40 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('impressions'),
          title: `Impressions dropped ${Math.abs(d.impressions7).toFixed(0)}% week-over-week`,
          description: `Impressions fell from ${fmt(p7.impressions)} to ${fmt(l7.impressions)} (${d.impressions7.toFixed(1)}%).${sisNote} Reduced reach means fewer opportunities to convert.`,
          recommendation: `Investigate: (1) Budget exhaustion — check if campaigns are 'Limited by budget', (2) Bid competitiveness — you may be losing auctions, (3) Search demand changes (seasonal?), (4) Ad Schedule / geo restrictions narrowing delivery.${sisRec}`,
          evidence: ['Impressions: ' + fmt(p7.impressions) + ' → ' + fmt(l7.impressions), 'Delta: ' + d.impressions7.toFixed(1) + '%', summary.searchImpressionShare > 0 ? 'Search Imp. Share: ' + fmtPct(summary.searchImpressionShare) : 'Search Imp. Share: N/A'],
        });
      }

      // Rule 13: CPM surge
      if (d.cpm7 >= GADS_THRESHOLDS.cpmSpikePct && p7.impressions >= GADS_THRESHOLDS.minImpressions7d) {
        all.push({
          id: 'anomaly:cpm-surge', severity: 'medium', group: 'performance', reliability: computeGadsReliability('cpm'),
          title: `CPM up ${d.cpm7.toFixed(0)}% — auction costs rising`,
          description: `Cost per thousand impressions rose from ${fmtCurrency(p7.cpm)} to ${fmtCurrency(l7.cpm)} (+${d.cpm7.toFixed(1)}%). Higher CPM means you're paying more for the same audience reach, which can erode overall campaign efficiency.`,
          recommendation: 'Rising CPMs often reflect increased competition for your target audience. Consider: (1) Reviewing audience overlap across campaigns, (2) Exploring different audience segments with less competition, (3) Adjusting bid strategy ceilings, (4) Checking if Display/Video campaigns are driving up the average.',
          evidence: ['CPM: ' + fmtCurrency(p7.cpm) + ' → ' + fmtCurrency(l7.cpm), 'Impressions: ' + fmt(p7.impressions) + ' → ' + fmt(l7.impressions)],
        });
      }

      // Rule 14: ROAS deterioration WoW
      if (d.roas7 <= -GADS_THRESHOLDS.roasDropPct && p7.roas > 0 && p7.conversions >= GADS_THRESHOLDS.minConversions7d && p7.spend >= GADS_THRESHOLDS.minSpend7d) {
        all.push({
          id: 'anomaly:roas-drop', severity: l7.roas < 1 ? 'high' : 'medium', group: 'performance', reliability: computeGadsReliability('roas'),
          title: `ROAS declined ${Math.abs(d.roas7).toFixed(0)}% week-over-week`,
          description: `ROAS dropped from ${p7.roas.toFixed(2)}x to ${l7.roas.toFixed(2)}x (${d.roas7.toFixed(1)}%). Each dollar of ad spend is now returning ${fmtCurrency(l7.roas)} in conversion value, down from ${fmtCurrency(p7.roas)}.`,
          recommendation: 'Decompose the ROAS decline: Is conversion volume down, conversion value per conversion down, or CPC up? Use the Ad Comparison tab to identify which campaigns\' ROAS degraded most and prioritize those for review.',
          evidence: ['ROAS: ' + p7.roas.toFixed(2) + 'x → ' + l7.roas.toFixed(2) + 'x', 'Spend: ' + fmtCurrency(p7.spend) + ' → ' + fmtCurrency(l7.spend), 'Conv value: ' + fmtCurrency(p7.conversionValue) + ' → ' + fmtCurrency(l7.conversionValue)],
        });
      }
    }

    // ─── TIER 4: CAMPAIGN PORTFOLIO ANALYSIS ──────────────────────────

    // Rule 15: Spend concentration risk
    if (campaignBreakdown.length >= 2 && summary.spend >= 100) {
      const topCampaign = [...campaignBreakdown].sort((a, b) => b.spend - a.spend)[0];
      const concentration = (topCampaign.spend / summary.spend) * 100;
      if (concentration >= GADS_THRESHOLDS.spendConcentrationPct) {
        all.push({
          id: 'portfolio:spend-concentration', severity: concentration >= 90 ? 'high' : 'medium', group: 'performance', reliability: 'high',
          title: `${concentration.toFixed(0)}% of spend in one campaign`,
          description: `"${topCampaign.name}" accounts for ${fmtCurrency(topCampaign.spend)} of your ${fmtCurrency(summary.spend)} total spend (${concentration.toFixed(1)}%). This concentration creates risk — if this one campaign underperforms, overall results collapse.`,
          recommendation: 'Consider diversifying your campaign portfolio. Test additional campaigns for different audience segments, keyword themes, or funnel stages. This reduces single-point-of-failure risk and can reveal new high-performing opportunities.',
          evidence: ['Top: "' + topCampaign.name + '" — ' + fmtCurrency(topCampaign.spend), 'Total spend: ' + fmtCurrency(summary.spend), 'Concentration: ' + concentration.toFixed(1) + '%'],
        });
      }
    }

    // Rule 16: Low-CTR campaign outlier
    if (campaignBreakdown.length >= 2 && summary.ctr >= 1.5) {
      const worstCtr = [...campaignBreakdown].filter(c => c.impressions >= 1000).sort((a, b) => a.ctr - b.ctr)[0];
      if (worstCtr && worstCtr.ctr < 1.0) {
        firedCampaignCtrOutlier = true;
        all.push({
          id: 'portfolio:low-ctr-campaign', severity: worstCtr.ctr < 0.5 ? 'high' : 'medium', group: 'performance', reliability: worstCtr.impressions >= 5000 ? 'high' : 'medium',
          title: `Campaign "${worstCtr.name}" has ${fmtPct(worstCtr.ctr)} CTR`,
          description: `While your overall CTR is ${fmtPct(summary.ctr)}, "${worstCtr.name}" is at only ${fmtPct(worstCtr.ctr)} across ${fmt(worstCtr.impressions)} impressions. This campaign is dragging down your account-level Quality Score and wasting budget on impressions that don't convert to clicks.`,
          recommendation: `Review "${worstCtr.name}": (1) Check keyword relevance, (2) Refresh ad copy, (3) Review Search Terms for irrelevant matches, (4) Consider pausing if no improvement path is viable.`,
          evidence: ['Campaign CTR: ' + fmtPct(worstCtr.ctr), 'Account CTR: ' + fmtPct(summary.ctr), 'Impressions: ' + fmt(worstCtr.impressions)],
        });
      }
    }

    // Rule 17: Low Search Impression Share
    if (summary.searchImpressionShare > 0 && summary.searchImpressionShare < 40 && summary.spend > 0 && summary.impressions >= 1000) {
      all.push({
        id: 'portfolio:search-imp-share-low', severity: summary.searchImpressionShare < 20 ? 'high' : 'medium', group: 'performance', reliability: 'high',
        title: `Search Impression Share is only ${fmtPct(summary.searchImpressionShare)}`,
        description: `You're capturing only ${fmtPct(summary.searchImpressionShare)} of available search impressions. This means ~${fmtPct(100 - summary.searchImpressionShare)} of eligible searches are being won by competitors or lost due to budget/rank constraints.`,
        recommendation: 'Lost impression share has two causes: (1) Budget — campaigns hit daily limits and stop showing. Fix: increase budgets or narrow targeting. (2) Ad Rank — competitors outbid you. Fix: improve Quality Score or increase bids. Check the "Competitive metrics" columns in Google Ads for Search IS Lost (Budget) vs Search IS Lost (Rank).',
        evidence: ['Search Imp. Share: ' + fmtPct(summary.searchImpressionShare), 'Lost to competitors: ~' + fmtPct(100 - summary.searchImpressionShare), 'Impressions: ' + fmt(summary.impressions)],
      });
    }

    // ─── TIER 5: KPI & BENCHMARK EVALUATION ───────────────────────────

    // Rules 18-19: KPI performance
    const kpis = Array.isArray(kpisData) ? kpisData : [];
    kpis.forEach((kpi: any) => {
      const metricKey = kpi.metric || kpi.metricKey || '';
      const current = getLiveMetricValue(metricKey);
      const target = parseFloat(kpi.targetValue || '0');
      const p = computeProgress(current, target, metricKey);
      const def = getGoogleAdsMetricDef(metricKey);
      const trendKey = (metricKey + '7') as keyof typeof d;
      const wowTrend = hasWoW && d[trendKey] !== undefined ? ` Week-over-week trend: ${(d[trendKey] as number) >= 0 ? '+' : ''}${(d[trendKey] as number).toFixed(1)}%.` : '';

      if (p.status === 'behind') {
        all.push({
          id: `kpi:behind:${kpi.id}`, severity: 'high', group: 'performance', reliability: computeGadsReliability(metricKey),
          title: `KPI behind: ${kpi.name} at ${def.format(current)} vs ${def.format(target)} target`,
          description: `${def.label} is at ${def.format(current)}, which is ${Math.min(p.pct, 200).toFixed(0)}% of your ${def.format(target)} target.${wowTrend}`,
          recommendation: `Focus optimization efforts on ${def.label}. Use the Ad Comparison tab to identify which campaigns are contributing least to this KPI and reallocate budget accordingly.`,
          evidence: ['Current: ' + def.format(current), 'Target: ' + def.format(target), 'Progress: ' + Math.min(p.pct, 200).toFixed(0) + '%'],
        });
      } else if (p.status === 'needs_attention') {
        all.push({
          id: `kpi:attention:${kpi.id}`, severity: 'medium', group: 'performance', reliability: computeGadsReliability(metricKey),
          title: `KPI near target: ${kpi.name} at ${Math.min(p.pct, 200).toFixed(0)}%`,
          description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress). Close but not yet on track.${wowTrend}`,
          recommendation: `Monitor ${def.label} over the next 7 days. Small optimizations (ad copy tests, bid adjustments, negative keywords) may close the remaining gap.`,
          evidence: ['Current: ' + def.format(current), 'Target: ' + def.format(target), 'Progress: ' + Math.min(p.pct, 200).toFixed(0) + '%'],
        });
      }
    });

    // Rules 20-21: Benchmark performance
    const benchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
    benchmarks.forEach((b: any) => {
      const metricKey = b.metric || '';
      const current = getLiveMetricValue(metricKey);
      const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
      const p = computeProgress(current, benchVal, metricKey);
      const def = getGoogleAdsMetricDef(metricKey);

      if (p.status === 'behind') {
        all.push({
          id: `bench:behind:${b.id}`, severity: 'high', group: 'performance', reliability: computeGadsReliability(metricKey),
          title: `Below benchmark: ${b.name} (${def.format(current)} vs ${def.format(benchVal)})`,
          description: `Your ${def.label} of ${def.format(current)} is significantly below the benchmark of ${def.format(benchVal)}. This suggests structural campaign issues rather than normal variance.`,
          recommendation: 'Benchmark gaps this large typically require strategic changes — not just bid/budget tweaks. Review: campaign structure, keyword strategy, ad creative, and landing page alignment against industry best practices.',
          evidence: ['Current: ' + def.format(current), 'Benchmark: ' + def.format(benchVal), 'Progress: ' + Math.min(p.pct, 200).toFixed(0) + '%'],
        });
      } else if (p.status === 'needs_attention') {
        all.push({
          id: `bench:attention:${b.id}`, severity: 'medium', group: 'performance', reliability: computeGadsReliability(metricKey),
          title: `Near benchmark: ${b.name}`,
          description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)}. Approaching but not yet meeting the benchmark.`,
          recommendation: `Close to benchmark — targeted optimizations may get you there. Focus on the campaign(s) with the most room for improvement in the Ad Comparison tab.`,
          evidence: ['Current: ' + def.format(current), 'Benchmark: ' + def.format(benchVal)],
        });
      }
    });

    // Rule 22: Low CTR across account — only if no campaign-level CTR outlier fired
    if (!firedCampaignCtrOutlier && summary.ctr > 0 && summary.ctr < 1.0 && summary.impressions >= 5000) {
      all.push({
        id: 'performance:low-ctr-account', severity: summary.ctr < 0.5 ? 'high' : 'medium', group: 'performance',
        reliability: summary.impressions >= 10000 ? 'high' : 'medium',
        title: `Account-wide CTR is ${fmtPct(summary.ctr)} — below Google Ads average`,
        description: `Average CTR across all ${campaignBreakdown.length} campaigns is ${fmtPct(summary.ctr)}, below the typical 1-2% threshold for most Google Ads verticals. Low CTR drives up CPC (currently ${fmtCurrency(summary.cpc)}) and signals poor ad-to-query relevance.`,
        recommendation: 'Broad fixes: (1) Tighten keyword match types (phrase/exact over broad), (2) Add negative keywords from Search Terms report, (3) Write more specific ad copy with clear CTAs, (4) Use responsive search ads with diverse headlines, (5) Check ad extensions are enabled.',
        evidence: ['CTR: ' + fmtPct(summary.ctr), 'CPC: ' + fmtCurrency(summary.cpc), 'Impressions: ' + fmt(summary.impressions)],
      });
    }

    // ─── SORT: Integrity first, then by severity ──────────────────────
    const severityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 };
    const groupOrder: Record<string, number> = { integrity: 0, performance: 1 };
    all.sort((a, b) => {
      const gDiff = groupOrder[a.group] - groupOrder[b.group];
      if (gDiff !== 0) return gDiff;
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return all;
  })();

  // Ad comparison chart data — reacts to sortBy
  const campaignPerformanceChartMetric = sortBy;
  const campaignPerformanceData = [...campaignBreakdown]
    .sort((a: any, b: any) => (b[campaignPerformanceChartMetric] || 0) - (a[campaignPerformanceChartMetric] || 0))
    .slice(0, 5)
    .map(c => ({
      name: c.name.length > 35 ? c.name.substring(0, 35) + '...' : c.name,
      value: campaignPerformanceChartMetric === 'spend' ? Math.round(c.spend * 100) / 100
        : campaignPerformanceChartMetric === 'impressions' ? c.impressions
        : campaignPerformanceChartMetric === 'clicks' ? c.clicks
        : campaignPerformanceChartMetric === 'conversions' ? Math.round(c.conversions)
        : campaignPerformanceChartMetric === 'ctr' ? Math.round(c.ctr * 100) / 100
        : Math.round((c as any)[campaignPerformanceChartMetric] * 100) / 100,
    }));

  const campaignChartLabel = sortBy === 'spend' ? 'Spend ($)' : sortBy === 'impressions' ? 'Impressions' : sortBy === 'clicks' ? 'Clicks' : sortBy === 'conversions' ? 'Conversions' : sortBy === 'ctr' ? 'CTR (%)' : sortBy;

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

              {/* Campaign Performance Chart */}
              <Card>
                <CardHeader><CardTitle>Campaign Performance</CardTitle><CardDescription>Top 5 campaigns by {campaignChartLabel.toLowerCase()}</CardDescription></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={350}>
                    <BarChart data={campaignPerformanceData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" angle={-25} textAnchor="end" interval={0} tick={{ fontSize: 11 }} height={80} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="value" fill="#3b82f6" name={campaignChartLabel} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total Spend</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.spend)}</p>
                      </div>
                      <DollarSign className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total Conversions</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{fmt(Math.round(summary.conversions))}</p>
                      </div>
                      <Target className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Campaigns Compared</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{campaignBreakdown.length}</p>
                      </div>
                      <Activity className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ==================== INSIGHTS TAB ==================== */}
            <TabsContent value="insights" className="space-y-6">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Insights</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Actionable insights from financial integrity checks plus KPI + Benchmark performance.
                </p>
              </div>

              {/* Executive Financials */}
              <Card>
                <CardHeader>
                  <CardTitle>Executive financials</CardTitle>
                  <CardDescription>
                    Spend and conversion metrics from Google Ads imports.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 md:grid-cols-4">
                    <Card>
                      <CardContent className="p-5">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.spend)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: Google Ads</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-5">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Conversion Value</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtCurrency(summary.conversionValue)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Total value from conversions</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-5">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{summary.roas.toFixed(2)}x</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Conv. Value / Spend</div>
                      </CardContent>
                    </Card>
                    <Card>
                      <CardContent className="p-5">
                        <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</div>
                        <div className="text-2xl font-bold text-slate-900 dark:text-white">{fmtPct(summary.roi)}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">((Value - Spend) / Spend)</div>
                      </CardContent>
                    </Card>
                  </div>
                  <div className="mt-4 pt-3 border-t text-xs text-slate-600 dark:text-slate-400">
                    <div className="font-medium mb-1">Sources used</div>
                    <div className="grid gap-1">
                      <div><span className="font-medium">Spend</span>: Google Ads import session</div>
                      <div><span className="font-medium">Conversion Value</span>: {summary.conversionValue > 0 ? 'Google Ads conversion tracking' : 'Not available — no conversion value recorded'}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Trends - Daily/7d/30d */}
              <Card>
                <CardHeader>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <CardTitle>Trends</CardTitle>
                      <CardDescription>
                        Daily shows day-by-day values. 7d/30d smooth the chart with rolling windows; the table summarizes the latest window vs the prior window.
                      </CardDescription>
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

              {/* Insights Summary Cards */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total insights</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{googleAdsInsights.length}</p>
                      </div>
                      <BarChart3 className="w-7 h-7 text-slate-600 dark:text-slate-400" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High priority</p>
                        <p className="text-2xl font-bold text-red-600">{googleAdsInsights.filter(i => i.severity === 'high').length}</p>
                      </div>
                      <AlertTriangle className="w-7 h-7 text-red-600" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Needs attention</p>
                        <p className="text-2xl font-bold text-amber-600">{googleAdsInsights.filter(i => i.severity === 'medium').length}</p>
                      </div>
                      <TrendingDown className="w-7 h-7 text-amber-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* What changed, what to do next */}
              <Card>
                <CardHeader>
                  <CardTitle>What changed, what to do next</CardTitle>
                  <CardDescription>
                    Summary of integrity checks, KPI/Benchmark evaluations, and performance signals from Google Ads data.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {/* Data metadata */}
                  <div className="rounded-md border p-3 text-xs text-slate-600 dark:text-slate-400">
                    <div className="flex flex-wrap gap-x-4 gap-y-1">
                      <div><span className="font-medium">Data through:</span> {dailySeries.daily.length > 0 ? dailySeries.daily[dailySeries.daily.length - 1].date + ' (UTC)' : '—'}</div>
                      <div><span className="font-medium">Available days:</span> {insightsRollups.availableDays}</div>
                      <div><span className="font-medium">WoW window:</span> {insightsRollups.availableDays >= 14 ? `${insightsRollups.last7.startDate} → ${insightsRollups.last7.endDate}` : 'Needs 14+ days'}</div>
                      <div><span className="font-medium">Conversion tracking:</span> {summary.conversionValue > 0 ? 'Active' : 'No value recorded'}</div>
                    </div>
                  </div>

                  {/* Goal Impact: KPI + Benchmark gaps */}
                  {(kpiTracker.total > 0 || benchmarkTracker.total > 0) && (
                    <div className="rounded-md border p-3">
                      <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">Goal impact (KPIs & Benchmarks)</div>
                      <div className="grid gap-3 md:grid-cols-2">
                        {/* Top KPI gaps */}
                        <div className="rounded-md border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Top KPI gaps</div>
                            <Badge variant="secondary">{kpiTracker.behind}</Badge>
                          </div>
                          {kpiTracker.total === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No KPIs configured yet.</p>
                          ) : kpiTracker.behind === 0 && kpiTracker.needsAttention === 0 ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">All KPIs on track.</p>
                          ) : (
                            <div className="space-y-2">
                              {(Array.isArray(kpisData) ? kpisData : []).slice(0, 5).map((kpi: any) => {
                                const metricKey = kpi.metric || kpi.metricKey || '';
                                const current = getLiveMetricValue(metricKey);
                                const target = parseFloat(kpi.targetValue || '0');
                                const p = computeProgress(current, target, metricKey);
                                const def = getGoogleAdsMetricDef(metricKey);
                                if (p.status === 'on_track') return null;
                                return (
                                  <div key={kpi.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      {p.status === 'behind' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                                      <span className="font-medium text-slate-900 dark:text-white">{kpi.name}</span>
                                    </div>
                                    <span className="text-slate-500 dark:text-slate-400">{def.format(current)} / {def.format(target)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        {/* Top Benchmark gaps */}
                        <div className="rounded-md border p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="text-sm font-semibold text-slate-900 dark:text-white">Top Benchmark gaps</div>
                            <Badge variant="secondary">{benchmarkTracker.behind}</Badge>
                          </div>
                          {benchmarkTracker.total === 0 ? (
                            <p className="text-xs text-slate-500 dark:text-slate-400">No benchmarks configured yet.</p>
                          ) : benchmarkTracker.behind === 0 && benchmarkTracker.needsAttention === 0 ? (
                            <p className="text-xs text-emerald-600 dark:text-emerald-400">All benchmarks on track.</p>
                          ) : (
                            <div className="space-y-2">
                              {(Array.isArray(benchmarksData) ? benchmarksData : []).slice(0, 5).map((b: any) => {
                                const metricKey = b.metric || '';
                                const current = getLiveMetricValue(metricKey);
                                const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                const p = computeProgress(current, benchVal, metricKey);
                                const def = getGoogleAdsMetricDef(metricKey);
                                if (p.status === 'on_track') return null;
                                return (
                                  <div key={b.id} className="flex items-center justify-between text-xs">
                                    <div className="flex items-center gap-1.5">
                                      {p.status === 'behind' ? <AlertTriangle className="w-3.5 h-3.5 text-red-500" /> : <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                                      <span className="font-medium text-slate-900 dark:text-white">{b.name}</span>
                                    </div>
                                    <span className="text-slate-500 dark:text-slate-400">{def.format(current)} / {def.format(benchVal)}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Success stories */}
                  {(kpiTracker.onTrack > 0 || benchmarkTracker.onTrack > 0) && (
                    <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                      <CardHeader className="pb-2">
                        <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">Success stories</div>
                        <CardDescription className="text-emerald-700 dark:text-emerald-300">
                          KPIs and Benchmarks currently meeting or exceeding targets.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="grid gap-3 md:grid-cols-2">
                          {kpiTracker.onTrack > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">KPIs on track ({kpiTracker.onTrack})</div>
                              {(Array.isArray(kpisData) ? kpisData : []).map((kpi: any) => {
                                const metricKey = kpi.metric || kpi.metricKey || '';
                                const current = getLiveMetricValue(metricKey);
                                const target = parseFloat(kpi.targetValue || '0');
                                const p = computeProgress(current, target, metricKey);
                                if (p.status !== 'on_track') return null;
                                return (
                                  <div key={kpi.id} className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{kpi.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {benchmarkTracker.onTrack > 0 && (
                            <div className="space-y-1">
                              <div className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-1">Benchmarks on track ({benchmarkTracker.onTrack})</div>
                              {(Array.isArray(benchmarksData) ? benchmarksData : []).map((b: any) => {
                                const metricKey = b.metric || '';
                                const current = getLiveMetricValue(metricKey);
                                const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                const p = computeProgress(current, benchVal, metricKey);
                                if (p.status !== 'on_track') return null;
                                return (
                                  <div key={b.id} className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300">
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>{b.name}</span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Not enough data warning */}
                  {insightsRollups.availableDays > 0 && insightsRollups.availableDays < 14 && (
                    <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-700 dark:text-amber-300">
                      Need at least 14 days of daily history to compute week-over-week anomaly signals. Available days: {insightsRollups.availableDays}.
                    </div>
                  )}

                  {/* Insights list */}
                  {googleAdsInsights.length === 0 ? (
                    <div className="text-sm text-slate-600 dark:text-slate-400">
                      No insights available yet. Import Google Ads data, then create KPIs/Benchmarks to unlock more insights.
                    </div>
                  ) : (
                    <>
                      {/* Data integrity & configuration */}
                      {(() => {
                        const integrity = googleAdsInsights.filter(i => i.group === 'integrity');
                        if (integrity.length === 0) return null;
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">Data integrity & configuration</div>
                              <Badge variant="secondary">{integrity.length}</Badge>
                            </div>
                            {integrity.map((insight) => (
                              <Card key={insight.id} className={insight.severity === 'high' ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800'}>
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    {insight.severity === 'high' ? <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />}
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-slate-900 dark:text-white">{insight.title}</h4>
                                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setInsightsExpanded(prev => ({ ...prev, [insight.id]: !prev[insight.id] }))}>
                                          {insightsExpanded[insight.id] ? 'Less' : 'More'}
                                        </Button>
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{insight.description}</p>
                                      {insightsExpanded[insight.id] && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">{insight.recommendation}</p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        );
                      })()}

                      {/* Performance & anomalies */}
                      {(() => {
                        const performance = googleAdsInsights.filter(i => i.group === 'performance');
                        if (performance.length === 0) return null;
                        return (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white">Performance & anomalies</div>
                              <Badge variant="secondary">{performance.length}</Badge>
                            </div>
                            {performance.map((insight) => (
                              <Card key={insight.id} className={insight.severity === 'high' ? 'border-red-200 dark:border-red-800' : 'border-amber-200 dark:border-amber-800'}>
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    {insight.severity === 'high' ? <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" /> : <AlertCircle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />}
                                    <div className="flex-1">
                                      <div className="flex items-center justify-between">
                                        <h4 className="font-medium text-slate-900 dark:text-white">{insight.title}</h4>
                                        <Button type="button" variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setInsightsExpanded(prev => ({ ...prev, [insight.id]: !prev[insight.id] }))}>
                                          {insightsExpanded[insight.id] ? 'Less' : 'More'}
                                        </Button>
                                      </div>
                                      <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">{insight.description}</p>
                                      {insightsExpanded[insight.id] && (
                                        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 italic">{insight.recommendation}</p>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            ))}
                          </div>
                        );
                      })()}

                      {/* No issues fallback */}
                      {googleAdsInsights.filter(i => i.group === 'integrity').length === 0 && googleAdsInsights.filter(i => i.group === 'performance').length === 0 && (
                        <div className="text-sm text-slate-600 dark:text-slate-400">No issues detected. System is operating normally.</div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
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
