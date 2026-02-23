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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { ArrowLeft, ArrowUpDown, TrendingUp, TrendingDown, DollarSign, Eye, MousePointer, Target, Users, Video, Activity, Plus, Pencil, Trash2, CheckCircle2, AlertCircle, AlertTriangle, Filter } from "lucide-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MetaKpiModal } from "./meta-analytics/MetaKpiModal";
import { MetaBenchmarkModal } from "./meta-analytics/MetaBenchmarkModal";
import { MetaReportModal } from "./meta-analytics/MetaReportModal";

// Meta-specific metric definitions for KPIs and Benchmarks
const META_METRICS = [
  { key: 'impressions', label: 'Impressions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'reach', label: 'Reach', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'clicks', label: 'Clicks', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'conversions', label: 'Conversions', unit: '', format: (v: number) => v.toLocaleString() },
  { key: 'spend', label: 'Spend', unit: '$', format: (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` },
  { key: 'ctr', label: 'CTR', unit: '%', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'cpc', label: 'CPC', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpm', label: 'CPM', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'cpp', label: 'CPP', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'frequency', label: 'Frequency', unit: '', format: (v: number) => v.toFixed(2) },
  { key: 'conversionRate', label: 'Conversion Rate', unit: '%', format: (v: number) => `${v.toFixed(2)}%` },
  { key: 'costPerConversion', label: 'Cost per Conversion', unit: '$', format: (v: number) => `$${v.toFixed(2)}` },
  { key: 'videoViews', label: 'Video Views', unit: '', format: (v: number) => v.toLocaleString() },
];

const LOWER_IS_BETTER_METRICS = ['cpc', 'cpm', 'cpp', 'costPerConversion', 'frequency', 'spend'];

function getMetaMetricDef(metricKey: string) {
  return META_METRICS.find(m => m.key === metricKey) || { key: metricKey, label: metricKey, unit: '', format: (v: number) => String(v) };
}

function formatMetaMetricValue(metricKey: string, value: number): string {
  return getMetaMetricDef(metricKey).format(value);
}

export default function MetaAnalytics() {
  const [, params] = useRoute("/campaigns/:id/meta-analytics");
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
    applyTo: 'all', specificCampaignId: '',
  });

  // Benchmark state
  const [isBenchmarkModalOpen, setIsBenchmarkModalOpen] = useState(false);
  const [editingBenchmark, setEditingBenchmark] = useState<any>(null);
  const [benchmarkForm, setBenchmarkForm] = useState({
    name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '',
    benchmarkType: 'industry' as 'industry' | 'custom',
    applyTo: 'all', specificCampaignId: '',
    alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
    alertThreshold: '', alertCondition: 'below', emailRecipients: '',
  });

  // Campaign filter state
  const [sortBy, setSortBy] = useState<string>('name');
  const [filterBy, setFilterBy] = useState<string>('all');

  // Insights state
  const [showDailyFinancialsView, setShowDailyFinancialsView] = useState(false);
  const [insightsTrendMetric, setInsightsTrendMetric] = useState('spend');
  const [insightsTrendMode, setInsightsTrendMode] = useState<'daily' | '7d' | '30d'>('daily');
  const [insightsDailyShowMore, setInsightsDailyShowMore] = useState(false);

  // Reports state
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<any>(null);
  const [reportModalStep, setReportModalStep] = useState<'standard' | 'custom' | 'type' | 'configuration'>('standard');
  const [reportFormErrors, setReportFormErrors] = useState<any>({});
  const [customReportConfig, setCustomReportConfig] = useState<any>({
    coreMetrics: [], derivedMetrics: [], revenueMetrics: [], campaignBreakdown: [],
    kpis: [], benchmarks: [], insights: [], demographics: [],
  });
  const [reportForm, setReportForm] = useState<any>({
    name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly',
    scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false,
    scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end',
  });

  const { data: analyticsData, isLoading } = useQuery({
    queryKey: ["/api/meta", campaignId, "analytics"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/analytics`);
      if (!response.ok) throw new Error("Failed to fetch Meta analytics");
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch revenue summary
  const { data: revenueSummary } = useQuery({
    queryKey: ["/api/meta", campaignId, "revenue", "summary"],
    queryFn: async () => {
      const response = await fetch(`/api/meta/${campaignId}/revenue/summary`);
      if (!response.ok) throw new Error("Failed to fetch revenue summary");
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch Meta KPIs
  const { data: kpisData, isLoading: kpisLoading } = useQuery({
    queryKey: ['/api/platforms/meta/kpis', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/platforms/meta/kpis/${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch Meta KPIs');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Fetch Meta Benchmarks
  const { data: benchmarksData, isLoading: benchmarksLoading } = useQuery({
    queryKey: ['/api/campaigns', campaignId, 'benchmarks', 'meta'],
    queryFn: async () => {
      const response = await fetch(`/api/campaigns/${campaignId}/benchmarks/evaluated?platform=meta`);
      if (!response.ok) throw new Error('Failed to fetch Meta Benchmarks');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // KPI mutations
  const createKpiMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/platforms/meta/kpis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId }),
      });
      if (!response.ok) throw new Error('Failed to create KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      toast({ title: 'KPI created successfully' });
    },
  });

  const updateKpiMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/platforms/meta/kpis/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      setIsKPIModalOpen(false);
      setEditingKPI(null);
      toast({ title: 'KPI updated successfully' });
    },
  });

  const deleteKpiMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/platforms/meta/kpis/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete KPI');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/platforms/meta/kpis'] });
      toast({ title: 'KPI deleted' });
    },
  });

  // Benchmark mutations
  const createBenchmarkMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/campaigns/${campaignId}/benchmarks`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId, platform: 'meta' }),
      });
      if (!response.ok) throw new Error('Failed to create benchmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      toast({ title: 'Benchmark created successfully' });
    },
  });

  const updateBenchmarkMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/benchmarks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update benchmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      setIsBenchmarkModalOpen(false);
      setEditingBenchmark(null);
      toast({ title: 'Benchmark updated successfully' });
    },
  });

  const deleteBenchmarkMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/benchmarks/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete benchmark');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/campaigns', campaignId, 'benchmarks'] });
      toast({ title: 'Benchmark deleted' });
    },
  });

  // Fetch Meta Reports
  const { data: reportsData, isLoading: reportsLoading } = useQuery({
    queryKey: ['/api/meta/reports', campaignId],
    queryFn: async () => {
      const response = await fetch(`/api/meta/reports?campaignId=${campaignId}`);
      if (!response.ok) throw new Error('Failed to fetch Meta Reports');
      return response.json();
    },
    enabled: !!campaignId,
  });

  // Report mutations
  const createReportMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/meta/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, campaignId, platformType: 'meta' }),
      });
      if (!response.ok) throw new Error('Failed to create report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports'] });
      setIsReportModalOpen(false);
      setEditingReport(null);
      toast({ title: 'Report created successfully' });
    },
  });

  const updateReportMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/meta/reports/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports'] });
      setIsReportModalOpen(false);
      setEditingReport(null);
      toast({ title: 'Report updated successfully' });
    },
  });

  const deleteReportMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/meta/reports/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete report');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta/reports'] });
      toast({ title: 'Report deleted' });
    },
  });

  // Fetch Meta daily data for time-series (Daily/7d/30d)
  const firstMetaCampaignId = analyticsData?.campaigns?.[0]?.campaign?.id;
  const { data: metaDailyResp, isLoading: metaDailyLoading } = useQuery({
    queryKey: ['/api/meta', campaignId, 'insights/daily', firstMetaCampaignId],
    queryFn: async () => {
      const resp = await fetch(`/api/meta/${campaignId}/insights/daily?metaCampaignId=${firstMetaCampaignId}&days=90`);
      if (!resp.ok) return { dailyInsights: [] };
      return resp.json();
    },
    enabled: !!campaignId && !!firstMetaCampaignId,
  });

  // Process daily data into series and rollups for Daily/7d/30d charts
  // NOTE: These useMemo hooks MUST be before conditional returns to satisfy Rules of Hooks
  const metaDailySeries = useMemo(() => {
    const raw = Array.isArray(metaDailyResp?.dailyInsights) ? metaDailyResp.dailyInsights : [];
    const hasRev = !!revenueSummary?.hasRevenueTracking;
    const convValue = revenueSummary?.conversionValue || 0;

    const byDate = raw
      .map((r: any) => {
        const date = String(r?.date_start || r?.date || '').trim().slice(0, 10);
        const impressions = Number(r?.impressions || 0) || 0;
        const reach = Number(r?.reach || 0) || 0;
        const clicks = Number(r?.clicks || r?.inline_link_clicks || 0) || 0;
        const conversions = Number(r?.conversions || r?.actions?.length || 0) || 0;
        const spend = Number(r?.spend || 0) || 0;
        const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
        const cpc = clicks > 0 ? spend / clicks : 0;
        const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0;
        const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;
        const revenue = hasRev ? conversions * convValue : 0;
        const roas = spend > 0 ? revenue / spend : 0;
        return { date, impressions, reach, clicks, conversions, spend, ctr, cpc, cpm, conversionRate, revenue, roas };
      })
      .filter((r: any) => /^\d{4}-\d{2}-\d{2}$/.test(r.date))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));

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
            acc.revenue += r.revenue;
            return acc;
          },
          { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
        );
        const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
        const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
        const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
        const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
        const roas = sums.spend > 0 ? sums.revenue / sums.spend : 0;
        out.push({ date: byDate[i].date, ...sums, ctr, cpc, cpm, conversionRate, roas });
      }
      return out;
    };

    return { daily: byDate, rolling7: rolling(7), rolling30: rolling(30), hasRevenueTracking: hasRev };
  }, [metaDailyResp, revenueSummary]);

  const metaInsightsRollups = useMemo(() => {
    const byDate = metaDailySeries.daily;
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
          acc.revenue += r.revenue;
          return acc;
        },
        { impressions: 0, clicks: 0, conversions: 0, spend: 0, revenue: 0 }
      );
      const ctr = sums.impressions > 0 ? (sums.clicks / sums.impressions) * 100 : 0;
      const cpc = sums.clicks > 0 ? sums.spend / sums.clicks : 0;
      const cpm = sums.impressions > 0 ? (sums.spend / sums.impressions) * 1000 : 0;
      const conversionRate = sums.clicks > 0 ? (sums.conversions / sums.clicks) * 100 : 0;
      const roas = sums.spend > 0 ? sums.revenue / sums.spend : 0;
      return { ...sums, ctr, cpc, cpm, conversionRate, roas, startDate: slice[0]?.date || null, endDate: slice[slice.length - 1]?.date || null, days: slice.length };
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
        revenue7: deltaPct(last7.revenue, prior7.revenue),
        roas7: prior7.roas > 0 ? ((last7.roas - prior7.roas) / prior7.roas) * 100 : 0,
        impressions30: deltaPct(last30.impressions, prior30.impressions),
        clicks30: deltaPct(last30.clicks, prior30.clicks),
        conversions30: deltaPct(last30.conversions, prior30.conversions),
        spend30: deltaPct(last30.spend, prior30.spend),
        ctr30: prior30.ctr > 0 ? ((last30.ctr - prior30.ctr) / prior30.ctr) * 100 : 0,
        cpc30: prior30.cpc > 0 ? ((last30.cpc - prior30.cpc) / prior30.cpc) * 100 : 0,
        cpm30: prior30.cpm > 0 ? ((last30.cpm - prior30.cpm) / prior30.cpm) * 100 : 0,
        conversionRate30: prior30.conversionRate > 0 ? ((last30.conversionRate - prior30.conversionRate) / prior30.conversionRate) * 100 : 0,
        revenue30: deltaPct(last30.revenue, prior30.revenue),
        roas30: prior30.roas > 0 ? ((last30.roas - prior30.roas) / prior30.roas) * 100 : 0,
      },
    };
  }, [metaDailySeries]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <p className="text-slate-600 dark:text-slate-400">Loading Meta analytics...</p>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  if (!analyticsData) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
        <Navigation />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-8">
            <div className="text-center py-12">
              <p className="text-slate-600 dark:text-slate-400">No Meta analytics data available</p>
            </div>
          </main>
        </div>
      </div>
    );
  }

  const { summary, campaigns } = analyticsData;
  const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#6366f1'];

  // Format date helper
  const formatShortDate = (yyyyMmDd: string) => {
    const s = String(yyyyMmDd || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return s;
    return `'${m[1].slice(-2)}-${m[2]}-${m[3]}`;
  };

  // Helper: get live metric value from Meta summary for KPIs/Benchmarks
  const getLiveMetricValue = (metricKey: string): number => {
    const map: Record<string, number> = {
      impressions: summary.totalImpressions || 0,
      reach: summary.totalReach || 0,
      clicks: summary.totalClicks || 0,
      conversions: summary.totalConversions || 0,
      spend: summary.totalSpend || 0,
      ctr: summary.avgCTR || 0,
      cpc: summary.avgCPC || 0,
      cpm: summary.avgCPM || 0,
      cpp: summary.avgCPP || 0,
      frequency: summary.avgFrequency || 0,
      conversionRate: summary.conversionRate || summary.avgConversionRate || 0,
      costPerConversion: summary.costPerConversion || 0,
      videoViews: summary.totalVideoViews || 0,
    };
    return map[metricKey] ?? 0;
  };

  // Helper: compute KPI/Benchmark progress
  const computeProgress = (current: number, target: number, metricKey: string) => {
    if (!target || target === 0) return { pct: 0, status: 'unknown' as const };
    const lowerIsBetter = LOWER_IS_BETTER_METRICS.includes(metricKey);
    let ratio: number;
    if (lowerIsBetter) {
      // For cost metrics, being under target = good (ratio > 1 means better)
      ratio = target / current;
    } else {
      ratio = current / target;
    }
    const pct = ratio * 100;
    const status = pct >= 90 ? 'on_track' as const : pct >= 70 ? 'needs_attention' as const : 'behind' as const;
    return { pct, status };
  };

  // Compute KPI tracker stats
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

  // Compute Benchmark tracker stats
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

  // Prepare data for charts
  const campaignPerformanceData = campaigns.slice(0, 5).map((c: any) => ({
    name: c.campaign.name.length > 20 ? c.campaign.name.substring(0, 20) + '...' : c.campaign.name,
    spend: c.totals.spend,
    conversions: c.totals.conversions,
    clicks: c.totals.clicks,
  }));

  const objectiveDistribution = campaigns.reduce((acc: any, c: any) => {
    const objective = c.campaign.objective;
    if (!acc[objective]) {
      acc[objective] = { name: objective, value: 0, campaigns: 0 };
    }
    acc[objective].value += c.totals.spend;
    acc[objective].campaigns += 1;
    return acc;
  }, {});

  const objectiveData = Object.values(objectiveDistribution);

  // Handler: create or update KPI
  const handleCreateKPI = () => {
    const payload = {
      name: kpiForm.name,
      metric: kpiForm.metric,
      metricKey: kpiForm.metric,
      targetValue: kpiForm.targetValue,
      currentValue: kpiForm.currentValue || String(getLiveMetricValue(kpiForm.metric)),
      description: kpiForm.description,
      unit: kpiForm.unit || getMetaMetricDef(kpiForm.metric).unit,
      priority: kpiForm.priority,
      status: 'active',
      category: kpiForm.category,
      timeframe: kpiForm.timeframe,
      trackingPeriod: kpiForm.trackingPeriod,
      alertsEnabled: kpiForm.alertsEnabled,
      emailNotifications: kpiForm.emailNotifications,
      alertFrequency: kpiForm.alertFrequency,
      alertThreshold: kpiForm.alertThreshold,
      alertCondition: kpiForm.alertCondition,
      emailRecipients: kpiForm.emailRecipients,
      applyTo: kpiForm.applyTo,
      specificCampaignId: kpiForm.specificCampaignId,
      platformType: 'meta',
    };
    if (editingKPI) {
      updateKpiMutation.mutate({ id: editingKPI.id, data: payload });
    } else {
      createKpiMutation.mutate(payload);
    }
  };

  // Handler: create or update Benchmark
  const handleCreateBenchmark = () => {
    const payload = {
      name: benchmarkForm.name,
      metric: benchmarkForm.metric,
      benchmarkValue: benchmarkForm.benchmarkValue,
      targetValue: benchmarkForm.benchmarkValue,
      currentValue: benchmarkForm.currentValue || String(getLiveMetricValue(benchmarkForm.metric)),
      description: benchmarkForm.description,
      industry: benchmarkForm.industry,
      unit: benchmarkForm.unit || getMetaMetricDef(benchmarkForm.metric).unit,
      benchmarkType: benchmarkForm.benchmarkType,
      applyTo: benchmarkForm.applyTo,
      specificCampaignId: benchmarkForm.specificCampaignId,
      alertsEnabled: benchmarkForm.alertsEnabled,
      emailNotifications: benchmarkForm.emailNotifications,
      alertFrequency: benchmarkForm.alertFrequency,
      alertThreshold: benchmarkForm.alertThreshold,
      alertCondition: benchmarkForm.alertCondition,
      emailRecipients: benchmarkForm.emailRecipients,
      platformType: 'meta',
      platform: 'meta',
    };
    if (editingBenchmark) {
      updateBenchmarkMutation.mutate({ id: editingBenchmark.id, data: payload });
    } else {
      createBenchmarkMutation.mutate(payload);
    }
  };

  // Report handlers
  const handleReportTypeSelect = (type: string) => {
    const nameMap: Record<string, string> = {
      overview: 'Meta Overview Report',
      kpis: 'Meta KPIs Report',
      benchmarks: 'Meta Benchmarks Report',
      ads: 'Meta Ad Comparison Report',
      insights: 'Meta Insights Report',
      custom: 'Custom Report',
    };
    setReportForm((prev: any) => ({
      ...prev,
      reportType: type,
      name: prev.name || nameMap[type] || 'Meta Report',
    }));
  };

  const handleCreateReport = () => {
    if (reportForm.scheduleEnabled && !String(reportForm.emailRecipients || '').trim()) {
      setReportFormErrors({ emailRecipients: 'Email recipients are required for scheduled reports' });
      return;
    }
    const payload = {
      ...reportForm,
      status: 'active',
      platformType: 'meta',
    };
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const handleUpdateReport = handleCreateReport;

  const handleCustomReport = () => {
    const payload = {
      ...reportForm,
      reportType: 'custom',
      customConfig: customReportConfig,
      status: 'active',
      platformType: 'meta',
    };
    if (editingReport) {
      updateReportMutation.mutate({ id: editingReport.id, data: payload });
    } else {
      createReportMutation.mutate(payload);
    }
  };

  const userTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const getTimeZoneDisplay = () => userTimeZone.replace(/_/g, ' ');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navigation />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-8">
          {/* Header */}
          <div className="mb-6">
            <Link href={`/campaigns/${campaignId}`}>
              <Button variant="ghost" size="sm" className="mb-4">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Campaign
              </Button>
            </Link>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Meta/Facebook Ads Analytics</h1>
                <p className="text-slate-600 dark:text-slate-400 mt-1">
                  Ad Account: {analyticsData.adAccountName}
                </p>
              </div>
              <Badge variant="outline" className="text-blue-600 border-blue-600">
                Test Mode - Realistic Demo Data
              </Badge>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid grid-cols-6 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="kpis">KPIs</TabsTrigger>
              <TabsTrigger value="benchmarks">Benchmarks</TabsTrigger>
              <TabsTrigger value="ad-comparison">Ad Comparison</TabsTrigger>
              <TabsTrigger value="insights">Insights</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-8">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total Spend</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${summary.totalSpend.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.totalCampaigns} campaigns
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Impressions</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalImpressions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgCPM.toFixed(2)} CPM
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Reach</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalReach.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {((summary.totalReach / summary.totalImpressions) * 100).toFixed(1)}% of impressions
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Clicks</CardTitle>
                <MousePointer className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalClicks.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {summary.avgCTR.toFixed(2)}% CTR
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Conversions</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalConversions.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  ${summary.costPerConversion.toFixed(2)} cost/conv
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Video Views</CardTitle>
                <Video className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{summary.totalVideoViews.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Video engagement
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Section */}
          {revenueSummary && revenueSummary.hasRevenueTracking ? (
            <Card className="mb-8 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg text-green-800 dark:text-green-200">Revenue Tracking Active</CardTitle>
                    <CardDescription>
                      {revenueSummary.windowStartDate} to {revenueSummary.windowEndDate}
                      {revenueSummary.webhookRevenueUsed && " • Webhook Events (Highest Accuracy)"}
                    </CardDescription>
                  </div>
                  <Badge variant="default" className="bg-green-600">
                    {revenueSummary.conversionValueSource === 'webhook_events' ? 'Webhook' :
                     revenueSummary.conversionValueSource === 'manual' ? 'Manual' :
                     revenueSummary.conversionValueSource === 'csv' ? 'CSV Import' : 'Derived'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Total Revenue</p>
                    <p className="text-3xl font-bold text-green-700 dark:text-green-300">
                      ${revenueSummary.totalRevenue.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">Conversion Value</p>
                    <p className="text-3xl font-bold">${revenueSummary.conversionValue.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROAS</p>
                    <p className="text-3xl font-bold">
                      {summary.totalSpend > 0 ? (revenueSummary.totalRevenue / summary.totalSpend).toFixed(2) : '0.00'}x
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-1">ROI</p>
                    <p className="text-3xl font-bold">
                      {summary.totalSpend > 0 ? (((revenueSummary.totalRevenue - summary.totalSpend) / summary.totalSpend) * 100).toFixed(1) : '0.0'}%
                    </p>
                  </div>
                </div>
                {revenueSummary.webhookEventCount && revenueSummary.webhookEventCount > 0 && (
                  <p className="text-xs text-slate-600 dark:text-slate-400 mt-4">
                    Using {revenueSummary.webhookEventCount} webhook conversion event(s) for highest accuracy
                  </p>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="mb-8 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-lg">Revenue Tracking Not Configured</CardTitle>
                <CardDescription>
                  Set up revenue tracking to unlock ROAS, ROI, and revenue-dependent metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                  To enable revenue tracking for Meta campaigns, you can:
                </p>
                <ul className="list-disc list-inside space-y-2 text-sm text-slate-600 dark:text-slate-400 mb-4">
                  <li>Manually enter revenue data for each campaign</li>
                  <li>Upload a CSV file with campaign revenue data (crosswalk matching)</li>
                  <li>Set up webhook integration for real-time conversion tracking</li>
                </ul>
                <Button variant="outline" size="sm">
                  Configure Revenue Tracking
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Performance Metrics - Derived Metrics */}
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
              <CardDescription>Key derived metrics across all campaigns</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CTR</p>
                  <p className="text-xl font-bold">{summary.avgCTR.toFixed(2)}%</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <DollarSign className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPC</p>
                  <p className="text-xl font-bold">${summary.avgCPC.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Eye className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPM</p>
                  <p className="text-xl font-bold">${summary.avgCPM.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Users className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">CPP</p>
                  <p className="text-xl font-bold">${summary.avgCPP.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Frequency</p>
                  <p className="text-xl font-bold">{summary.avgFrequency.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Target className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Cost/Conv</p>
                  <p className="text-xl font-bold">${summary.costPerConversion.toFixed(2)}</p>
                </div>

                <div className="flex flex-col items-center justify-center p-4 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <Activity className="h-5 w-5 text-muted-foreground mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">Conv Rate</p>
                  <p className="text-xl font-bold">{summary.conversionRate.toFixed(2)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* All Campaigns - Card Layout */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>All Campaigns</CardTitle>
                <CardDescription>Detailed performance metrics for all campaigns</CardDescription>
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
                    <SelectItem value="reach">Reach (High→Low)</SelectItem>
                    <SelectItem value="ctr">CTR (High→Low)</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterBy} onValueChange={setFilterBy}>
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <Filter className="w-3 h-3 mr-1" />
                    <SelectValue placeholder="Filter..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="ACTIVE">Active</SelectItem>
                    <SelectItem value="PAUSED">Paused</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {campaigns
                  .filter((c: any) => filterBy === 'all' || c.campaign.status === filterBy)
                  .sort((a: any, b: any) => {
                    switch (sortBy) {
                      case 'name': return a.campaign.name.localeCompare(b.campaign.name);
                      case 'spend': return (b.totals.spend || 0) - (a.totals.spend || 0);
                      case 'impressions': return (b.totals.impressions || 0) - (a.totals.impressions || 0);
                      case 'clicks': return (b.totals.clicks || 0) - (a.totals.clicks || 0);
                      case 'conversions': return (b.totals.conversions || 0) - (a.totals.conversions || 0);
                      case 'reach': return (b.totals.reach || 0) - (a.totals.reach || 0);
                      case 'ctr': return (b.totals.ctr || 0) - (a.totals.ctr || 0);
                      default: return 0;
                    }
                  })
                  .map((campaignData: any) => {
                  const { campaign, totals } = campaignData;
                  const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                  const formatNum = (v: number) => v.toLocaleString();
                  const formatPct = (v: number) => `${v.toFixed(2)}%`;

                  return (
                    <div key={campaign.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                      {/* Campaign header */}
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <h4 className="font-semibold text-slate-900 dark:text-white">{campaign.name}</h4>
                          <span className="text-xs text-slate-500">{campaign.objective}</span>
                        </div>
                        <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totals.spend || 0)}</span>
                      </div>

                      {/* Core metrics — prominent */}
                      <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Impressions</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.impressions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Reach</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.reach)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Clicks</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.clicks)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">CTR</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatPct(totals.ctr)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Conversions</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.conversions)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-slate-500 font-medium">Video Views</p>
                          <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.videoViews)}</p>
                        </div>
                      </div>

                      {/* Secondary metrics — smaller */}
                      <div className="grid grid-cols-4 md:grid-cols-7 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPC</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpc)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPM</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpm)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">CPP</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpp)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Frequency</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{totals.frequency.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Cost/Conv</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.costPerConversion)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Conv Rate</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatPct(totals.conversionRate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] text-slate-400 font-medium">Total Spend</p>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.spend)}</p>
                        </div>
                      </div>

                      {/* Revenue metrics — only when tracking */}
                      {revenueSummary?.hasRevenueTracking && (
                        <div className="grid grid-cols-3 gap-4 pt-3 mt-3 border-t border-green-100 dark:border-green-900/30">
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">Revenue</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(revenueSummary.totalRevenue / campaigns.length)}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">ROAS</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">
                              {totals.spend > 0 ? ((revenueSummary.totalRevenue / campaigns.length) / totals.spend).toFixed(2) + 'x' : 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-[10px] text-green-600 dark:text-green-400 font-medium">ROI</p>
                            <p className="text-sm font-bold text-green-700 dark:text-green-300">
                              {totals.spend > 0 ? (((revenueSummary.totalRevenue / campaigns.length) - totals.spend) / totals.spend * 100).toFixed(1) + '%' : 'N/A'}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Demographics & Geographics */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
            <Card>
              <CardHeader>
                <CardTitle>Top Demographics</CardTitle>
                <CardDescription>Performance by age and gender (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.demographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Age Range</TableHead>
                        <TableHead>Gender</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].demographics.slice(0, 6).map((demo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{demo.ageRange}</TableCell>
                          <TableCell className="capitalize">{demo.gender}</TableCell>
                          <TableCell className="text-right">{demo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{demo.clicks.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Locations</CardTitle>
                <CardDescription>Performance by country (first campaign)</CardDescription>
              </CardHeader>
              <CardContent>
                {campaigns[0]?.geographics && (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Country</TableHead>
                        <TableHead className="text-right">Impressions</TableHead>
                        <TableHead className="text-right">Clicks</TableHead>
                        <TableHead className="text-right">Spend</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {campaigns[0].geographics.map((geo: any, index: number) => (
                        <TableRow key={index}>
                          <TableCell>{geo.country}</TableCell>
                          <TableCell className="text-right">{geo.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-right">{geo.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-right">${geo.spend.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Placements */}
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Ad Placements</CardTitle>
              <CardDescription>Performance by placement (first campaign)</CardDescription>
            </CardHeader>
            <CardContent>
              {campaigns[0]?.placements && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Placement</TableHead>
                      <TableHead className="text-right">Impressions</TableHead>
                      <TableHead className="text-right">Clicks</TableHead>
                      <TableHead className="text-right">Spend</TableHead>
                      <TableHead className="text-right">Conversions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {campaigns[0].placements.map((placement: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{placement.placement}</TableCell>
                        <TableCell className="text-right">{placement.impressions.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.clicks.toLocaleString()}</TableCell>
                        <TableCell className="text-right">${placement.spend.toLocaleString()}</TableCell>
                        <TableCell className="text-right">{placement.conversions.toLocaleString()}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
            </TabsContent>

            <TabsContent value="kpis" className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Key Performance Indicators</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Track your Meta campaign KPIs and targets
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingKPI(null);
                    setKpiForm({
                      name: '', metric: '', targetValue: '', description: '', currentValue: '', unit: '',
                      priority: 'high', status: 'active', category: '', timeframe: 'monthly', trackingPeriod: '30',
                      alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
                      alertThreshold: '', alertCondition: 'below', emailRecipients: '',
                      applyTo: 'all', specificCampaignId: '',
                    });
                    setIsKPIModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-slate-300 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add KPI
                </Button>
              </div>

              {/* Meta info bar */}
              <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">KPIs:</span> {kpiTracker.total}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Campaigns:</span> {summary.totalCampaigns}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Data source:</span> Meta Graph API
                  </div>
                </div>
              </div>

              {/* Performance Tracker Panel */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total KPIs</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpiTracker.total}</p>
                      </div>
                      <Target className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                        <p className="text-2xl font-bold text-green-600">{kpiTracker.onTrack}</p>
                        <p className="text-xs text-slate-500">meeting or exceeding target</p>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p>
                        <p className="text-2xl font-bold text-amber-600">{kpiTracker.needsAttention}</p>
                        <p className="text-xs text-slate-500">within 70–90% of target</p>
                      </div>
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Behind</p>
                        <p className="text-2xl font-bold text-red-600">{kpiTracker.behind}</p>
                        <p className="text-xs text-slate-500">below 70% of target</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{kpiTracker.avgPct.toFixed(1)}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* KPI Cards */}
              {kpisLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              ) : Array.isArray(kpisData) && kpisData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {kpisData.map((kpi: any) => {
                    const metricKey = kpi.metric || kpi.metricKey || '';
                    const metricDef = getMetaMetricDef(metricKey);
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
                                {metricKey && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                    {metricKey.toUpperCase()}
                                  </Badge>
                                )}
                              </div>
                              <CardDescription className="text-sm">
                                {kpi.description || `Track ${metricDef.label} performance against target`}
                              </CardDescription>
                              <div className="mt-2">
                                <Badge variant="outline" className="bg-slate-50 text-slate-700 dark:bg-slate-900/20 dark:text-slate-300 border-slate-200 dark:border-slate-800">
                                  All Campaigns
                                </Badge>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-slate-500 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950"
                                onClick={() => {
                                  setEditingKPI(kpi);
                                  setKpiForm({
                                    name: kpi.name || '',
                                    metric: metricKey,
                                    targetValue: kpi.targetValue || '',
                                    description: kpi.description || '',
                                  });
                                  setIsKPIModalOpen(true);
                                }}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950">
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete KPI</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{kpi.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteKpiMutation.mutate(kpi.id)} className="bg-red-600 hover:bg-red-700">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatMetaMetricValue(metricKey, currentVal)}
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Target</div>
                              <div className="text-xl font-bold text-slate-900 dark:text-white">
                                {formatMetaMetricValue(metricKey, targetVal)}
                              </div>
                            </div>
                          </div>

                          {targetVal > 0 && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                <span>Progress</span>
                                <span>{Math.round(progress.pct)}%</span>
                              </div>
                              <Progress value={progressFill} className="h-2" indicatorClassName={progressColor} />
                            </div>
                          )}

                          {targetVal > 0 && (
                            <div className="text-xs text-slate-600 dark:text-slate-400">
                              {Math.abs(deltaPct) < 0.01 ? 'At target' :
                                deltaPct > 0 ? `${Math.round(Math.abs(deltaPct))}% above target (+${deltaPct.toFixed(1)}%)` :
                                `${Math.round(Math.abs(deltaPct))}% below target (${deltaPct.toFixed(1)}%)`}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  No KPIs have been created yet. Click "Add KPI" to track your first Meta performance indicator.
                </div>
              )}
            </TabsContent>

            <TabsContent value="benchmarks" className="space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Benchmarks</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Compare your Meta campaign performance against industry benchmarks
                  </p>
                </div>
                <Button
                  onClick={() => {
                    setEditingBenchmark(null);
                    setBenchmarkForm({
                      name: '', metric: '', benchmarkValue: '', description: '', industry: '', currentValue: '', unit: '',
                      benchmarkType: 'industry' as 'industry' | 'custom',
                      applyTo: 'all', specificCampaignId: '',
                      alertsEnabled: false, emailNotifications: false, alertFrequency: 'daily',
                      alertThreshold: '', alertCondition: 'below', emailRecipients: '',
                    });
                    setIsBenchmarkModalOpen(true);
                  }}
                  variant="outline"
                  size="sm"
                  className="border-slate-300 dark:border-slate-700"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Add Benchmark
                </Button>
              </div>

              {/* Meta info bar */}
              <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3 text-xs text-slate-600 dark:text-slate-400">
                <div className="flex flex-wrap gap-x-4 gap-y-1">
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Benchmarks:</span> {benchmarkTracker.total}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Campaigns:</span> {summary.totalCampaigns}
                  </div>
                  <div>
                    <span className="font-medium text-slate-700 dark:text-slate-300">Data source:</span> Meta Graph API
                  </div>
                </div>
              </div>

              {/* Performance Tracker Panel */}
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Total Benchmarks</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{benchmarkTracker.total}</p>
                      </div>
                      <Target className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">On Track</p>
                        <p className="text-2xl font-bold text-green-600">{benchmarkTracker.onTrack}</p>
                        <p className="text-xs text-slate-500">meeting or exceeding benchmark</p>
                      </div>
                      <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Needs Attention</p>
                        <p className="text-2xl font-bold text-amber-600">{benchmarkTracker.needsAttention}</p>
                        <p className="text-xs text-slate-500">within 70–90% of benchmark</p>
                      </div>
                      <AlertCircle className="w-8 h-8 text-amber-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Behind</p>
                        <p className="text-2xl font-bold text-red-600">{benchmarkTracker.behind}</p>
                        <p className="text-xs text-slate-500">below 70% of benchmark</p>
                      </div>
                      <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm text-slate-600 dark:text-slate-400">Avg. Progress</p>
                        <p className="text-2xl font-bold text-slate-900 dark:text-white">{benchmarkTracker.avgPct.toFixed(1)}%</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-violet-600" />
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Benchmark Cards */}
              {benchmarksLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              ) : Array.isArray(benchmarksData) && benchmarksData.length > 0 ? (
                <div className="grid gap-6 lg:grid-cols-2">
                  {benchmarksData.map((benchmark: any) => {
                    const metricKey = benchmark.metric || '';
                    const metricDef = getMetaMetricDef(metricKey);
                    const currentVal = getLiveMetricValue(metricKey);
                    const benchVal = parseFloat(benchmark.benchmarkValue || benchmark.targetValue || '0');
                    const progress = computeProgress(currentVal, benchVal, metricKey);
                    const progressFill = Math.min(progress.pct, 100);
                    const progressColor = progress.status === 'on_track' ? 'bg-green-500' : progress.status === 'needs_attention' ? 'bg-amber-500' : 'bg-red-500';

                    return (
                      <Card key={benchmark.id}>
                        <CardContent className="p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-semibold text-slate-900 dark:text-white text-lg">
                                  {benchmark.name}
                                </h3>
                                {metricKey && (
                                  <Badge variant="outline" className="bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-mono">
                                    {metricKey.toUpperCase()}
                                  </Badge>
                                )}
                                <Badge variant="outline" className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                                  All Campaigns
                                </Badge>
                              </div>
                              <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {benchmark.description || `Compare ${metricDef.label} against benchmark`}
                              </p>
                              <div className="flex items-center gap-4 text-xs text-slate-500 mt-2">
                                {benchmark.industry && <span>{benchmark.industry}</span>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingBenchmark(benchmark);
                                  setBenchmarkForm({
                                    metric: metricKey,
                                    name: benchmark.name || '',
                                    benchmarkValue: benchmark.benchmarkValue || benchmark.targetValue || '',
                                    description: benchmark.description || '',
                                    industry: benchmark.industry || '',
                                  });
                                  setIsBenchmarkModalOpen(true);
                                }}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                              >
                                <Pencil className="w-4 h-4" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button size="sm" variant="ghost" className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20">
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete Benchmark</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete "{benchmark.name}"? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteBenchmarkMutation.mutate(benchmark.id)} className="bg-red-600 hover:bg-red-700">
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          </div>

                          <div className="grid gap-4 md:grid-cols-3">
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Current Value</div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {formatMetaMetricValue(metricKey, currentVal)}
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Benchmark Value</div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {formatMetaMetricValue(metricKey, benchVal)}
                              </div>
                            </div>
                            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                              <div className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">Source</div>
                              <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {benchmark.industry ? `Industry (${benchmark.industry})` : 'Custom'}
                              </div>
                            </div>
                          </div>

                          {benchVal > 0 && (
                            <div className="mt-4">
                              <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400">
                                <span>Progress</span>
                                <span>{Math.round(progress.pct)}%</span>
                              </div>
                              <Progress value={progressFill} className="mt-2 h-2" indicatorClassName={progressColor} />
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="text-sm text-slate-600 dark:text-slate-400">
                  No benchmarks have been created yet. Click "Add Benchmark" to compare your Meta performance against industry standards.
                </div>
              )}
            </TabsContent>

            <TabsContent value="ad-comparison" className="space-y-6">
              {/* Header */}
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Campaign Comparison</h2>
                <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Compare performance across all Meta campaigns
                </p>
              </div>

              {/* Performance Rankings */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-green-600" />
                      Best Performing
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-green-600">Product Launch - Holiday Sale</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">ROAS: 6.2x • CTR: 2.8%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Activity className="w-4 h-4 text-blue-600" />
                      Most Efficient
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-blue-600">Retargeting Campaign</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">CPC: $0.72 • CPM: $11.20</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <TrendingDown className="w-4 h-4 text-orange-600" />
                      Needs Attention
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <p className="font-semibold text-orange-600">Video Views Campaign</p>
                        <p className="text-xs text-slate-600 dark:text-slate-400">CTR: 0.8% • Conv Rate: 1.2%</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Campaign Performance & Spend by Objective Charts */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Campaign Performance</CardTitle>
                    <CardDescription>Top 5 campaigns by spend</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaignPerformanceData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="spend" fill="#3b82f6" name="Spend ($)" />
                        <Bar dataKey="conversions" fill="#10b981" name="Conversions" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Spend by Objective</CardTitle>
                    <CardDescription>Budget allocation across campaign types</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={objectiveData}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={(entry: any) => `${entry.name}: $${entry.value.toFixed(0)}`}
                          outerRadius={80}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {objectiveData.map((entry: any, index: number) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>

              {/* Detailed Campaign Comparison - Card Layout */}
              <Card>
                <CardHeader>
                  <CardTitle>Detailed Campaign Comparison</CardTitle>
                  <CardDescription>Side-by-side metrics for all campaigns</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {campaigns.map((campaignData: any) => {
                      const { campaign, totals } = campaignData;
                      const formatCurrency = (v: number) => `$${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
                      const formatNum = (v: number) => v.toLocaleString();
                      const formatPct = (v: number) => `${v.toFixed(2)}%`;
                      const performanceScore = (totals.ctr * 10 + totals.conversionRate * 5) / 2;
                      const performance = performanceScore > 20 ? 'excellent' : performanceScore > 15 ? 'good' : performanceScore > 10 ? 'average' : 'poor';

                      return (
                        <div key={campaign.id} className="border rounded-lg p-4 bg-white dark:bg-slate-900">
                          {/* Campaign header with performance badge */}
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <h4 className="font-semibold text-slate-900 dark:text-white">{campaign.name}</h4>
                              <Badge variant={campaign.status === 'ACTIVE' ? 'default' : 'secondary'} className="text-xs">
                                {campaign.status}
                              </Badge>
                              {performance === 'excellent' && <Badge variant="default" className="bg-green-500 text-xs">Excellent</Badge>}
                              {performance === 'good' && <Badge variant="default" className="bg-blue-500 text-xs">Good</Badge>}
                              {performance === 'average' && <Badge variant="secondary" className="text-xs">Average</Badge>}
                              {performance === 'poor' && <Badge variant="destructive" className="text-xs">Poor</Badge>}
                            </div>
                            <span className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(totals.spend || 0)}</span>
                          </div>
                          <p className="text-xs text-slate-500 mb-3">{campaign.objective}</p>

                          {/* Core metrics — prominent */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-4 mb-3">
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Impressions</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.impressions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Reach</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.reach)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Clicks</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.clicks)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">CTR</p>
                              <p className={`text-base font-bold ${totals.ctr > 1.5 ? 'text-green-600' : totals.ctr < 1.0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                {formatPct(totals.ctr)}
                              </p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Conversions</p>
                              <p className="text-base font-bold text-slate-900 dark:text-white">{formatNum(totals.conversions)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-slate-500 font-medium">Conv Rate</p>
                              <p className={`text-base font-bold ${totals.conversionRate > 3.0 ? 'text-green-600' : totals.conversionRate < 2.0 ? 'text-red-600' : 'text-slate-900 dark:text-white'}`}>
                                {formatPct(totals.conversionRate)}
                              </p>
                            </div>
                          </div>

                          {/* Secondary metrics — smaller */}
                          <div className="grid grid-cols-3 md:grid-cols-6 gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPC</p>
                              <p className={`text-sm font-semibold ${totals.cpc < 1.0 ? 'text-green-600' : totals.cpc > 1.5 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {formatCurrency(totals.cpc)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPM</p>
                              <p className={`text-sm font-semibold ${totals.cpm < 12 ? 'text-green-600' : totals.cpm > 18 ? 'text-red-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {formatCurrency(totals.cpm)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">CPP</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.cpp)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Frequency</p>
                              <p className={`text-sm font-semibold ${totals.frequency > 3.0 ? 'text-orange-600' : 'text-slate-700 dark:text-slate-300'}`}>
                                {totals.frequency.toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Cost/Conv</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(totals.costPerConversion)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-400 font-medium">Video Views</p>
                              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatNum(totals.videoViews)}</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Key Metrics Comparison Chart */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle>CTR Comparison</CardTitle>
                    <CardDescription>Click-through rate across campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), ctr: c.totals.ctr }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="ctr" fill="#3b82f6" name="CTR (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Conversion Rate Comparison</CardTitle>
                    <CardDescription>Conversion rate across campaigns</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={campaigns.map((c: any) => ({ name: c.campaign.name.substring(0, 20), convRate: c.totals.conversionRate }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="convRate" fill="#10b981" name="Conv Rate (%)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="insights" className="space-y-6">
              <div className="space-y-6">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Insights</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Actionable insights from financial metrics plus KPI + Benchmark performance.
                  </p>
                </div>

                {/* Executive Financials */}
                <Card className="border-slate-200 dark:border-slate-700">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <CardTitle>Executive financials</CardTitle>
                        <CardDescription>
                          Spend comes from Meta imports. Revenue metrics appear only when a Meta revenue source is connected.
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-4">
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Spend</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            ${summary.totalSpend.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Source: Meta Ads</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Revenue</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            ${(revenueSummary?.hasRevenueTracking ? revenueSummary.totalRevenue : 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            {revenueSummary?.hasRevenueTracking ? "From connected revenue source" : "Not connected"}
                          </div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROAS</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {revenueSummary?.hasRevenueTracking && summary.totalSpend > 0
                              ? (revenueSummary.totalRevenue / summary.totalSpend).toFixed(2)
                              : '0.00'}x
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">Revenue ÷ Spend</div>
                        </CardContent>
                      </Card>
                      <Card>
                        <CardContent className="p-5">
                          <div className="text-sm font-medium text-slate-600 dark:text-slate-400">ROI</div>
                          <div className="text-2xl font-bold text-slate-900 dark:text-white">
                            {revenueSummary?.hasRevenueTracking && summary.totalSpend > 0
                              ? (((revenueSummary.totalRevenue - summary.totalSpend) / summary.totalSpend) * 100).toFixed(1)
                              : '0.0'}%
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">(Revenue - Spend) ÷ Spend</div>
                        </CardContent>
                      </Card>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-600 dark:text-slate-400">
                      <div className="font-medium text-slate-700 dark:text-slate-300 mb-1">Sources used</div>
                      <div className="grid gap-1">
                        <div>
                          <span className="font-medium">Spend</span>: Meta Graph API
                        </div>
                        <div>
                          <span className="font-medium">Revenue</span>: {revenueSummary?.hasRevenueTracking
                            ? (revenueSummary.conversionValueSource === 'webhook_events' ? 'Webhook Events'
                              : revenueSummary.conversionValueSource === 'manual' ? 'Manual Entry'
                              : revenueSummary.conversionValueSource === 'csv' ? 'CSV Import'
                              : 'Connected revenue source')
                            : "Not connected"}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Trends - Daily/7d/30d */}
                <Card className="border-slate-200 dark:border-slate-700">
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
                          <Button type="button" variant={insightsTrendMode === 'daily' ? 'default' : 'outline'} size="sm"
                            onClick={() => { setInsightsDailyShowMore(false); setInsightsTrendMode('daily'); }}>Daily</Button>
                          <Button type="button" variant={insightsTrendMode === '7d' ? 'default' : 'outline'} size="sm"
                            onClick={() => setInsightsTrendMode('7d')}>7d</Button>
                          <Button type="button" variant={insightsTrendMode === '30d' ? 'default' : 'outline'} size="sm"
                            onClick={() => setInsightsTrendMode('30d')}>30d</Button>
                        </div>
                        <div className="min-w-[220px]">
                          <Select value={insightsTrendMetric} onValueChange={(v: any) => setInsightsTrendMetric(v)}>
                            <SelectTrigger className="h-9">
                              <SelectValue placeholder="Metric" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="spend">Spend</SelectItem>
                              <SelectItem value="impressions">Impressions</SelectItem>
                              <SelectItem value="clicks">Clicks</SelectItem>
                              <SelectItem value="conversions">Conversions</SelectItem>
                              <SelectItem value="ctr">CTR</SelectItem>
                              <SelectItem value="cpc">CPC</SelectItem>
                              <SelectItem value="cpm">CPM</SelectItem>
                              <SelectItem value="conversionRate">Conversion Rate</SelectItem>
                              {metaDailySeries.hasRevenueTracking && <SelectItem value="revenue">Revenue</SelectItem>}
                              {metaDailySeries.hasRevenueTracking && <SelectItem value="roas">ROAS</SelectItem>}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {metaDailyLoading ? (
                      <div className="text-sm text-slate-600 dark:text-slate-400">Loading daily history...</div>
                    ) : (
                      <>
                        {(() => {
                          const series = insightsTrendMode === 'daily' ? metaDailySeries.daily
                            : insightsTrendMode === '7d' ? metaDailySeries.rolling7 : metaDailySeries.rolling30;
                          const minRequired = insightsTrendMode === 'daily' ? 2 : insightsTrendMode === '7d' ? 14 : 60;
                          const available = metaInsightsRollups.availableDays;

                          if (available <= 0) {
                            return (
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                No Meta daily history is available yet. Connect your Meta account and wait for daily data to populate.
                              </div>
                            );
                          }
                          if (available < minRequired) {
                            return (
                              <div className="text-sm text-slate-600 dark:text-slate-400">
                                Need at least {minRequired} days of Meta daily history for this view. Available days: {available}.
                              </div>
                            );
                          }

                          const formatChartValue = (v: any) => {
                            const n = Number(v || 0) || 0;
                            if (insightsTrendMetric === 'spend' || insightsTrendMetric === 'revenue') return `$${n.toFixed(2)}`;
                            if (insightsTrendMetric === 'ctr' || insightsTrendMetric === 'conversionRate') return `${n.toFixed(2)}%`;
                            if (insightsTrendMetric === 'cpc' || insightsTrendMetric === 'cpm') return `$${n.toFixed(2)}`;
                            if (insightsTrendMetric === 'roas') return `${n.toFixed(2)}x`;
                            return n.toLocaleString();
                          };

                          return (
                            <div className="h-[280px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <LineChart data={series}>
                                  <CartesianGrid strokeDasharray="3 3" />
                                  <XAxis dataKey="date" tick={{ fontSize: 12 }} tickFormatter={(v: any) => formatShortDate(String(v || ''))} />
                                  <YAxis tick={{ fontSize: 12 }} />
                                  <Tooltip formatter={(value: any) => formatChartValue(value)} />
                                  <Legend />
                                  <Line type="monotone" dataKey={insightsTrendMetric} stroke="#7c3aed" strokeWidth={2} dot={false}
                                    name={(() => {
                                      const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate', revenue: 'Revenue', roas: 'ROAS' };
                                      return labels[insightsTrendMetric] || insightsTrendMetric;
                                    })()} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          );
                        })()}

                        {/* Table view */}
                        <div className="overflow-hidden border rounded-md">
                          {insightsTrendMode === 'daily' ? (
                            <div>
                              <table className="w-full text-sm table-fixed">
                                <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                  <tr>
                                    <th className="text-left p-3 w-[38%]">Date</th>
                                    <th className="text-right p-3 w-[31%]">
                                      {(() => {
                                        const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate', revenue: 'Revenue', roas: 'ROAS' };
                                        return labels[insightsTrendMetric] || 'Metric';
                                      })()}
                                    </th>
                                    <th className="text-right p-3 w-[31%]">vs prior</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(() => {
                                    const daily = metaDailySeries.daily;
                                    const visibleDays = insightsDailyShowMore ? 14 : 7;
                                    const rows = daily.slice(-visibleDays);
                                    if (rows.length === 0) {
                                      return (
                                        <tr><td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">No daily records available yet.</td></tr>
                                      );
                                    }
                                    return rows.map((r: any, idx: number, arr: any[]) => {
                                      const prev = idx > 0 ? arr[idx - 1] : null;
                                      const metricKey = insightsTrendMetric;
                                      const curVal = Number(r?.[metricKey] ?? 0) || 0;
                                      const prevVal = Number(prev?.[metricKey] ?? 0) || 0;
                                      const deltaPct = prevVal > 0 ? ((curVal - prevVal) / prevVal) * 100 : 0;
                                      const showDelta = !!prev && prevVal > 0;

                                      const formatValue = (key: string, v: number) => {
                                        if (key === 'spend' || key === 'revenue' || key === 'cpc' || key === 'cpm') return `$${v.toFixed(2)}`;
                                        if (key === 'ctr' || key === 'conversionRate') return `${v.toFixed(2)}%`;
                                        if (key === 'roas') return `${v.toFixed(2)}x`;
                                        return v.toLocaleString();
                                      };

                                      return (
                                        <tr key={r.date} className="border-b">
                                          <td className="p-3">
                                            <div className="font-medium text-slate-900 dark:text-white">{formatShortDate(String(r.date || ''))}</div>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className="font-medium text-slate-900 dark:text-white">{formatValue(metricKey, curVal)}</div>
                                          </td>
                                          <td className="p-3 text-right">
                                            <div className={`text-xs ${showDelta ? (deltaPct >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300') : 'text-slate-400'}`}>
                                              {showDelta ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : '—'}
                                            </div>
                                          </td>
                                        </tr>
                                      );
                                    });
                                  })()}
                                </tbody>
                              </table>
                              {metaDailySeries.daily.length > 7 && (
                                <div className="flex justify-end px-3 py-2 bg-white dark:bg-slate-950">
                                  <Button type="button" variant="ghost" size="sm" onClick={() => setInsightsDailyShowMore((v) => !v)} className="h-8 text-xs">
                                    {insightsDailyShowMore ? 'View less' : 'View more'}
                                  </Button>
                                </div>
                              )}
                            </div>
                          ) : (
                            <table className="w-full text-sm table-fixed">
                              <thead className="bg-slate-50 dark:bg-slate-800 border-b">
                                <tr>
                                  <th className="text-left p-3 w-[38%]">Period</th>
                                  <th className="text-right p-3 w-[31%]">
                                    {(() => {
                                      const labels: Record<string, string> = { spend: 'Spend', impressions: 'Impressions', clicks: 'Clicks', conversions: 'Conversions', ctr: 'CTR', cpc: 'CPC', cpm: 'CPM', conversionRate: 'Conv Rate', revenue: 'Revenue', roas: 'ROAS' };
                                      return labels[insightsTrendMetric] || 'Metric';
                                    })()}
                                  </th>
                                  <th className="text-right p-3 w-[31%]">vs prior</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(() => {
                                  const is7 = insightsTrendMode === '7d';
                                  const available = metaInsightsRollups.availableDays;
                                  const minRequired = is7 ? 14 : 60;
                                  if (available < minRequired) {
                                    return (
                                      <tr><td colSpan={3} className="p-4 text-sm text-slate-600 dark:text-slate-400">
                                        {available <= 0 ? 'No records available yet.' : `Need at least ${minRequired} days for this view. Available: ${available}.`}
                                      </td></tr>
                                    );
                                  }
                                  const row = is7
                                    ? { key: '7d', cur: metaInsightsRollups.last7, d: metaInsightsRollups.deltas, label: 'Last 7d vs prior 7d' }
                                    : { key: '30d', cur: metaInsightsRollups.last30, d: metaInsightsRollups.deltas, label: 'Last 30d vs prior 30d' };

                                  const metricKey = insightsTrendMetric;
                                  const valueFor = (obj: any) => {
                                    const v = Number(obj?.[metricKey] ?? 0) || 0;
                                    if (metricKey === 'spend' || metricKey === 'revenue' || metricKey === 'cpc' || metricKey === 'cpm') return `$${v.toFixed(2)}`;
                                    if (metricKey === 'ctr' || metricKey === 'conversionRate') return `${v.toFixed(2)}%`;
                                    if (metricKey === 'roas') return `${v.toFixed(2)}x`;
                                    return v.toLocaleString();
                                  };
                                  const suffix = is7 ? '7' : '30';
                                  const deltaKey = `${metricKey}${suffix}` as keyof typeof row.d;
                                  const delta = Number(row.d[deltaKey] ?? 0);
                                  const deltaColor = delta >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300';

                                  return (
                                    <tr key={row.key} className="border-b">
                                      <td className="p-3">
                                        <div className="font-medium text-slate-900 dark:text-white">{row.cur.endDate}</div>
                                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                          {row.cur.startDate} → {row.cur.endDate} ({row.label})
                                        </div>
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className="font-medium text-slate-900 dark:text-white">{valueFor(row.cur)}</div>
                                      </td>
                                      <td className="p-3 text-right">
                                        <div className={`text-xs ${deltaColor}`}>{delta >= 0 ? '+' : ''}{delta.toFixed(1)}%</div>
                                      </td>
                                    </tr>
                                  );
                                })()}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                {/* Insight summary counter cards */}
                {(() => {
                  const allInsights: Array<{ id: string; title: string; description: string; severity: string; recommendation: string; group: string }> = [];

                  // Generate insights from KPI tracker
                  const kpis = Array.isArray(kpisData) ? kpisData : [];
                  kpis.forEach((kpi: any) => {
                    const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                    const target = parseFloat(kpi.targetValue || '0');
                    const p = computeProgress(current, target, kpi.metric || kpi.metricKey || '');
                    const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                    if (p.status === 'behind') {
                      allInsights.push({
                        id: `kpi-behind-${kpi.id}`,
                        title: `KPI Behind: ${kpi.name}`,
                        description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`,
                        severity: 'high',
                        recommendation: `Focus on improving ${def.label} to close the gap to your target.`,
                        group: 'performance',
                      });
                    } else if (p.status === 'needs_attention') {
                      allInsights.push({
                        id: `kpi-attention-${kpi.id}`,
                        title: `KPI Needs Attention: ${kpi.name}`,
                        description: `${def.label} is at ${def.format(current)} vs target ${def.format(target)} (${Math.min(p.pct, 200).toFixed(0)}% progress).`,
                        severity: 'medium',
                        recommendation: `Monitor ${def.label} closely and consider optimization strategies.`,
                        group: 'performance',
                      });
                    }
                  });

                  // Generate insights from Benchmark tracker
                  const benchmarks = Array.isArray(benchmarksData) ? benchmarksData : [];
                  benchmarks.forEach((b: any) => {
                    const current = getLiveMetricValue(b.metric || '');
                    const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                    const p = computeProgress(current, benchVal, b.metric || '');
                    const def = getMetaMetricDef(b.metric || '');
                    if (p.status === 'behind') {
                      allInsights.push({
                        id: `bench-behind-${b.id}`,
                        title: `Below Benchmark: ${b.name}`,
                        description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)} (${Math.min(p.pct, 200).toFixed(0)}% of benchmark).`,
                        severity: 'high',
                        recommendation: `Your ${def.label} is below industry benchmark. Review campaign strategy.`,
                        group: 'performance',
                      });
                    } else if (p.status === 'needs_attention') {
                      allInsights.push({
                        id: `bench-attention-${b.id}`,
                        title: `Near Benchmark: ${b.name}`,
                        description: `${def.label} is at ${def.format(current)} vs benchmark ${def.format(benchVal)}.`,
                        severity: 'medium',
                        recommendation: `${def.label} is close to benchmark but could use improvement.`,
                        group: 'performance',
                      });
                    }
                  });

                  // Generate insights from campaign performance
                  if (summary.avgFrequency > 3.0) {
                    allInsights.push({
                      id: 'frequency-high',
                      title: 'High Ad Frequency Detected',
                      description: `Average frequency is ${summary.avgFrequency.toFixed(2)}, above the 3.0 fatigue threshold. This may indicate audience saturation.`,
                      severity: 'high',
                      recommendation: 'Consider refreshing creatives, expanding targeting, or pausing campaigns with high frequency.',
                      group: 'integrity',
                    });
                  }
                  if (summary.avgCTR < 0.5) {
                    allInsights.push({
                      id: 'ctr-low',
                      title: 'Low CTR Across Campaigns',
                      description: `Average CTR is ${summary.avgCTR.toFixed(2)}%, which is below the typical 0.5% threshold.`,
                      severity: 'medium',
                      recommendation: 'Review ad creative and targeting. Test new ad formats or audience segments.',
                      group: 'performance',
                    });
                  }
                  if (!revenueSummary?.hasRevenueTracking) {
                    allInsights.push({
                      id: 'no-revenue',
                      title: 'Revenue Tracking Not Connected',
                      description: 'Without revenue tracking, ROAS and ROI calculations are unavailable.',
                      severity: 'low',
                      recommendation: 'Connect a revenue source to unlock ROAS, ROI, and revenue-dependent KPIs.',
                      group: 'integrity',
                    });
                  }

                  const highPriority = allInsights.filter(i => i.severity === 'high');
                  const medPriority = allInsights.filter(i => i.severity === 'medium');

                  return (
                    <>
                      <div className="grid gap-4 md:grid-cols-3">
                        <Card>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">Total insights</p>
                                <p className="text-2xl font-bold text-slate-900 dark:text-white">{allInsights.length}</p>
                              </div>
                              <Activity className="w-7 h-7 text-slate-600" />
                            </div>
                          </CardContent>
                        </Card>
                        <Card>
                          <CardContent className="p-5">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">High priority</p>
                                <p className="text-2xl font-bold text-red-600">{highPriority.length}</p>
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
                                <p className="text-2xl font-bold text-amber-600">{medPriority.length}</p>
                              </div>
                              <TrendingDown className="w-7 h-7 text-amber-600" />
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {/* What changed, what to do next */}
                      <Card className="border-slate-200 dark:border-slate-700">
                        <CardHeader>
                          <CardTitle>What changed, what to do next</CardTitle>
                          <CardDescription>
                            Insights from KPI/Benchmark evaluations and campaign performance analysis.
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-3">
                          {/* Goal impact panel */}
                          {(kpiTracker.behind > 0 || benchmarkTracker.behind > 0) && (
                            <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                              <div className="text-sm font-semibold text-slate-900 dark:text-white mb-3">
                                Goal impact (KPIs & Benchmarks)
                              </div>
                              <div className="grid gap-3 md:grid-cols-2">
                                {kpiTracker.behind > 0 && (
                                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Top KPI gaps</div>
                                      <Badge variant="outline" className="text-xs">{kpiTracker.behind}</Badge>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {kpis.filter((kpi: any) => {
                                        const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                        const target = parseFloat(kpi.targetValue || '0');
                                        return computeProgress(current, target, kpi.metric || kpi.metricKey || '').status === 'behind';
                                      }).slice(0, 5).map((kpi: any) => {
                                        const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                        const target = parseFloat(kpi.targetValue || '0');
                                        const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                                        return (
                                          <div key={kpi.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{kpi.name}</div>
                                              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                {def.label}: {def.format(current)} / {def.format(target)}
                                              </div>
                                            </div>
                                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                              Behind
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                                {benchmarkTracker.behind > 0 && (
                                  <div className="rounded-md border border-slate-200 dark:border-slate-700 p-3">
                                    <div className="flex items-center justify-between">
                                      <div className="text-sm font-semibold text-slate-900 dark:text-white">Top Benchmark gaps</div>
                                      <Badge variant="outline" className="text-xs">{benchmarkTracker.behind}</Badge>
                                    </div>
                                    <div className="mt-3 space-y-2">
                                      {benchmarks.filter((b: any) => {
                                        const current = getLiveMetricValue(b.metric || '');
                                        const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                        return computeProgress(current, benchVal, b.metric || '').status === 'behind';
                                      }).slice(0, 5).map((b: any) => {
                                        const current = getLiveMetricValue(b.metric || '');
                                        const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                        const def = getMetaMetricDef(b.metric || '');
                                        return (
                                          <div key={b.id} className="flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.name}</div>
                                              <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                {def.label}: {def.format(current)} / {def.format(benchVal)}
                                              </div>
                                            </div>
                                            <Badge className="text-xs border bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900">
                                              Behind
                                            </Badge>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Success stories */}
                          {(kpiTracker.onTrack > 0 || benchmarkTracker.onTrack > 0) && (
                            <Card className="border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/20">
                              <CardHeader>
                                <div className="text-sm font-semibold text-slate-900 dark:text-white">Success stories</div>
                                <CardDescription className="text-emerald-700 dark:text-emerald-300 mt-1">
                                  KPIs and Benchmarks currently meeting or exceeding targets
                                </CardDescription>
                              </CardHeader>
                              <CardContent>
                                <div className="grid gap-3 md:grid-cols-2">
                                  {kpiTracker.onTrack > 0 && (
                                    <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-950 p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">On-track KPIs</div>
                                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700">
                                          {kpiTracker.onTrack}
                                        </Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {kpis.filter((kpi: any) => {
                                          const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                          const target = parseFloat(kpi.targetValue || '0');
                                          return computeProgress(current, target, kpi.metric || kpi.metricKey || '').status === 'on_track';
                                        }).slice(0, 5).map((kpi: any) => {
                                          const def = getMetaMetricDef(kpi.metric || kpi.metricKey || '');
                                          const current = getLiveMetricValue(kpi.metric || kpi.metricKey || '');
                                          return (
                                            <div key={kpi.id} className="flex items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{kpi.name}</div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                  {def.label}: {def.format(current)}
                                                </div>
                                              </div>
                                              <Badge className="text-xs border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900">
                                                On Track
                                              </Badge>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                  {benchmarkTracker.onTrack > 0 && (
                                    <div className="rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-950 p-3">
                                      <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold text-slate-900 dark:text-white">On-track Benchmarks</div>
                                        <Badge variant="outline" className="text-xs text-emerald-700 border-emerald-300 dark:text-emerald-300 dark:border-emerald-700">
                                          {benchmarkTracker.onTrack}
                                        </Badge>
                                      </div>
                                      <div className="mt-3 space-y-2">
                                        {benchmarks.filter((b: any) => {
                                          const current = getLiveMetricValue(b.metric || '');
                                          const benchVal = parseFloat(b.benchmarkValue || b.targetValue || '0');
                                          return computeProgress(current, benchVal, b.metric || '').status === 'on_track';
                                        }).slice(0, 5).map((b: any) => {
                                          const def = getMetaMetricDef(b.metric || '');
                                          const current = getLiveMetricValue(b.metric || '');
                                          return (
                                            <div key={b.id} className="flex items-center justify-between gap-2">
                                              <div className="min-w-0">
                                                <div className="text-sm font-medium text-slate-900 dark:text-white truncate">{b.name}</div>
                                                <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
                                                  {def.label}: {def.format(current)}
                                                </div>
                                              </div>
                                              <Badge className="text-xs border bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-900">
                                                On Track
                                              </Badge>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          )}

                          {/* Insight cards */}
                          {allInsights.length === 0 ? (
                            <div className="text-sm text-slate-600 dark:text-slate-400">
                              No insights available yet. Create KPIs and Benchmarks to unlock performance insights.
                            </div>
                          ) : (
                            <>
                              {allInsights.filter(i => i.group === 'integrity').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Data integrity & configuration</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'integrity').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'integrity').map(i => (
                                    <div key={i.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-slate-900 dark:text-white">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {allInsights.filter(i => i.group === 'performance').length > 0 && (
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">Performance & KPI/Benchmark gaps</div>
                                    <Badge variant="outline" className="text-xs">{allInsights.filter(i => i.group === 'performance').length}</Badge>
                                  </div>
                                  {allInsights.filter(i => i.group === 'performance').map(i => (
                                    <div key={i.id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4">
                                      <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2 flex-wrap">
                                            <div className="font-semibold text-slate-900 dark:text-white">{i.title}</div>
                                            <Badge className={`text-xs border ${
                                              i.severity === 'high' ? 'bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-900'
                                              : i.severity === 'medium' ? 'bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-900'
                                              : 'bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:border-slate-700'
                                            }`}>
                                              {i.severity === 'high' ? 'High' : i.severity === 'medium' ? 'Medium' : 'Low'}
                                            </Badge>
                                          </div>
                                          <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">{i.description}</div>
                                          {i.recommendation && (
                                            <div className="text-sm text-slate-700 dark:text-slate-300 mt-2">
                                              <span className="font-medium">Next step:</span> {i.recommendation}
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </CardContent>
                      </Card>
                    </>
                  );
                })()}
              </div>
            </TabsContent>

            <TabsContent value="reports" className="space-y-6">
              {/* Header with Create Button */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Reports</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    Create, schedule, and manage Meta analytics reports
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    className="gap-2"
                    onClick={() => {
                      setEditingReport(null);
                      setReportModalStep('standard');
                      setReportFormErrors({});
                      setCustomReportConfig({
                        coreMetrics: [], derivedMetrics: [], revenueMetrics: [], campaignBreakdown: [],
                        kpis: [], benchmarks: [], insights: [], demographics: [],
                      });
                      setReportForm({
                        name: '', description: '', reportType: 'overview', scheduleFrequency: 'weekly',
                        scheduleTime: '9:00 AM', emailRecipients: '', scheduleEnabled: false,
                        scheduleDayOfWeek: 'monday', scheduleDayOfMonth: 'first', quarterTiming: 'end',
                      });
                      setIsReportModalOpen(true);
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    Create Report
                  </Button>
                </div>
              </div>

              {/* Reports List */}
              {reportsLoading ? (
                <div className="animate-pulse space-y-4">
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                  <div className="h-32 bg-slate-200 dark:bg-slate-800 rounded"></div>
                </div>
              ) : reportsData && Array.isArray(reportsData) && reportsData.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {(reportsData as any[]).map((report: any) => (
                    <Card key={report.id}>
                      <CardContent className="p-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="font-semibold text-slate-900 dark:text-white mb-1">
                              {report.name}
                            </h3>
                            {report.description && (
                              <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">
                                {report.description}
                              </p>
                            )}
                            <div className="flex items-center gap-4 text-sm">
                              <Badge variant="outline">{report.reportType || 'performance_summary'}</Badge>
                              {report.scheduleEnabled && report.scheduleFrequency && (
                                <span className="text-slate-500 flex items-center gap-1">
                                  {report.scheduleFrequency}{report.scheduleTime ? ` at ${report.scheduleTime}` : ''}
                                </span>
                              )}
                              {report.lastSentAt && (
                                <span className="text-slate-500">
                                  Last sent {new Date(report.lastSentAt).toLocaleDateString()}
                                </span>
                              )}
                              <span className="text-slate-400">
                                Created {new Date(report.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingReport(report);
                                setReportForm({
                                  name: report.name || '',
                                  description: report.description || '',
                                  reportType: report.reportType || 'performance_summary',
                                  scheduleFrequency: report.scheduleFrequency || 'weekly',
                                  scheduleTime: report.scheduleTime || '9:00 AM',
                                  emailRecipients: report.emailRecipients || '',
                                  scheduleEnabled: report.scheduleEnabled || false,
                                });
                                setIsReportModalOpen(true);
                              }}
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Report</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete "{report.name}"? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deleteReportMutation.mutate(report.id)}
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
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
                      <p className="text-sm text-slate-400 dark:text-slate-500 mt-2">
                        Create your first report to get started
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>

          {/* KPI Modal */}
          <MetaKpiModal
            isKPIModalOpen={isKPIModalOpen}
            setIsKPIModalOpen={setIsKPIModalOpen}
            editingKPI={editingKPI}
            setEditingKPI={setEditingKPI}
            kpiForm={kpiForm}
            setKpiForm={setKpiForm}
            summary={summary}
            revenueSummary={revenueSummary}
            campaigns={campaigns}
            toast={toast}
            handleCreateKPI={handleCreateKPI}
          />

          {/* Benchmark Modal */}
          <MetaBenchmarkModal
            isBenchmarkModalOpen={isBenchmarkModalOpen}
            setIsBenchmarkModalOpen={setIsBenchmarkModalOpen}
            editingBenchmark={editingBenchmark}
            setEditingBenchmark={setEditingBenchmark}
            benchmarkForm={benchmarkForm}
            setBenchmarkForm={setBenchmarkForm}
            summary={summary}
            revenueSummary={revenueSummary}
            campaigns={campaigns}
            toast={toast}
            handleCreateBenchmark={handleCreateBenchmark}
          />

          {/* Report Modal */}
          <MetaReportModal
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

